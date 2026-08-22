// ============================================================
// /src/image_prep.js
// Downscale and re-encode every image at the moment it is picked.
//
// WHY THIS IS THE FIRST THING TO FIX
// A module is not big because it has many images; it is big because it
// has a dozen photos straight off a phone at 4000 × 3000 px, each stored
// as a base64 data URL — which is 33% larger than the file on disk, and
// then held as a UTF-16 string, which doubles it again in memory. One
// such photo is bigger than the whole localStorage quota. Autosave
// re-serialises the entire project 900 ms after every keystroke, so the
// cost is not paid once at save time; it is paid on every pause in
// typing.
//
// Shrinking at the door removes the weight before any of that. A cover
// downscaled to A4 at 300 dpi and re-encoded as JPEG is typically 0.6–1
// MB instead of 12. No other layer has to know it happened: the rest of
// the tool still receives a data URL and cannot tell the difference.
//
// WHY JPEG AND NOT WEBP
// WebP is smaller, and it is the wrong choice here. These images end up
// in a DOCX, and Word only renders WebP in recent builds — a ministry
// running Office 2016 would open the module and find empty frames. JPEG
// is understood by every version of Word ever shipped. The saving from
// WebP is not worth a deliverable that fails to open correctly on the
// machine it was made for.
//
// WHAT IS NOT RE-ENCODED
// QR codes. They are read by a camera at 2.5 cm, so JPEG ringing around
// the finder patterns is a real scanning failure, not a cosmetic one.
// They stay PNG, and they are small enough that it costs nothing.
// Anything already inside its profile's bounds and under the size floor
// is returned untouched: re-encoding a 40 KB diagram to prove a point
// only degrades it.
//
// FAILURE POLICY
// Every error path returns the ORIGINAL image. A cover that is too big
// is a problem; a cover that vanished because a canvas call failed on
// someone's browser is a catastrophe. There is no case in this file
// where the user ends up with nothing.
// ============================================================

/* ── Profiles ────────────────────────────────────────────────
   Bounds come from what the image is FOR, not from a global guess.

   cover   — printed full-page. A4 at 300 dpi is 2480 × 3508 px, which
             is exactly what the tip text in the Covers tab already
             tells the user to supply.
   content — placed in a table cell; exports_docx caps it at 280 pt
             wide, about 3.9 inches. 1600 px still leaves room to print
             at 300 dpi and to zoom on screen.
   qr      — 2.5 cm square in the document. Anything above 800 px is
             detail no scanner will ever see. */
var MB_IMAGE_PROFILES = {
    cover:   { maxW: 2480, maxH: 3508, format: 'image/jpeg', quality: 0.85, floorBytes: 300 * 1024 },
    content: { maxW: 1600, maxH: 1600, format: 'image/jpeg', quality: 0.82, floorBytes: 120 * 1024 },
    qr:      { maxW: 800,  maxH: 800,  format: 'image/png',  quality: 1,    floorBytes: 60 * 1024 }
};

/* A data URL's payload is base64: 4 characters per 3 bytes. Close
   enough for a size report, and free — no decode required. */
function mbDataUrlBytes(dataUrl) {
    if (typeof dataUrl !== 'string') return 0;
    var i = dataUrl.indexOf(',');
    if (i === -1) return 0;
    var b64 = dataUrl.slice(i + 1);
    var pad = b64.endsWith('==') ? 2 : (b64.endsWith('=') ? 1 : 0);
    return Math.floor(b64.length * 3 / 4) - pad;
}

function mbFormatBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB';
    return (n / (1024 * 1024)).toFixed(1) + ' MB';
}

function _mbReadAsDataUrl(blob) {
    return new Promise(function (resolve, reject) {
        var r = new FileReader();
        r.onload  = function () { resolve(r.result); };
        r.onerror = function () { reject(new Error('FileReader failed')); };
        r.readAsDataURL(blob);
    });
}

/**
 * Decode a file into something drawable.
 *
 * createImageBitmap with imageOrientation:'from-image' is used where it
 * exists for one specific reason: a photo taken on a phone held sideways
 * carries its rotation in an EXIF tag, and drawImage on an <img> ignores
 * that tag in some browsers. The cover would then be re-encoded rotated,
 * permanently — the original is gone by then. The <img> fallback keeps
 * older browsers working; those show the same rotation on screen, so at
 * least what the user sees is what they get.
 */
function _mbDecodeImage(file) {
    if (typeof createImageBitmap === 'function') {
        try {
            return createImageBitmap(file, { imageOrientation: 'from-image' })
                .catch(function () { return createImageBitmap(file); });
        } catch (e) { /* fall through to <img> */ }
    }
    return _mbReadAsDataUrl(file).then(function (url) {
        return new Promise(function (resolve, reject) {
            var img = new Image();
            img.onload  = function () { resolve(img); };
            img.onerror = function () { reject(new Error('image could not be decoded')); };
            img.src = url;
        });
    });
}

function _mbCanvasToDataUrl(canvas, format, quality) {
    /* toBlob + FileReader rather than toDataURL: toDataURL builds the
       whole base64 string on the main thread synchronously, which on a
       12-megapixel image is a visible freeze. */
    if (canvas.toBlob) {
        return new Promise(function (resolve, reject) {
            canvas.toBlob(function (blob) {
                if (!blob) return reject(new Error('toBlob returned null'));
                resolve(_mbReadAsDataUrl(blob));
            }, format, quality);
        });
    }
    return Promise.resolve(canvas.toDataURL(format, quality));
}

/**
 * Prepare one picked file for storage.
 *
 * Resolves to { dataUrl, before, after, width, height, changed }.
 * NEVER rejects: on any failure it resolves with the original bytes and
 * `changed: false`, because losing the image is worse than storing a
 * large one.
 */
function mbPrepareImage(file, profileName) {
    var p = MB_IMAGE_PROFILES[profileName] || MB_IMAGE_PROFILES.content;
    var before = file && file.size ? file.size : 0;

    var original = function (reason) {
        return _mbReadAsDataUrl(file).then(function (url) {
            if (reason) console.warn('[ImagePrep] kept original:', reason);
            return { dataUrl: url, before: before, after: mbDataUrlBytes(url),
                     width: 0, height: 0, changed: false };
        });
    };

    if (!file || !file.type || file.type.indexOf('image/') !== 0) {
        return original('not an image');
    }
    /* SVG is vector: rasterising it to fit a box throws away the one
       property that makes it worth using, and it is tiny already. */
    if (file.type === 'image/svg+xml') return original('vector');

    return _mbDecodeImage(file).then(function (src) {
        var w = src.width  || src.naturalWidth;
        var h = src.height || src.naturalHeight;
        if (!w || !h) return original('zero dimensions');

        var scale = Math.min(p.maxW / w, p.maxH / h, 1);

        /* Already small enough AND already light enough: touching it can
           only make it worse. */
        if (scale === 1 && before && before <= p.floorBytes) {
            if (src.close) src.close();
            return original(null);
        }

        var tw = Math.max(1, Math.round(w * scale));
        var th = Math.max(1, Math.round(h * scale));

        var canvas = document.createElement('canvas');
        canvas.width  = tw;
        canvas.height = th;
        var ctx = canvas.getContext('2d');
        if (!ctx) return original('no 2d context');

        /* JPEG has no alpha. Without this, anything transparent in the
           source composites onto black — a logo with a clear background
           comes back on a black rectangle. */
        if (p.format === 'image/jpeg') {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, tw, th);
        }
        ctx.imageSmoothingEnabled = true;
        if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(src, 0, 0, tw, th);
        if (src.close) src.close();

        return _mbCanvasToDataUrl(canvas, p.format, p.quality).then(function (url) {
            var after = mbDataUrlBytes(url);

            /* Re-encoding made it BIGGER. Happens with flat graphics and
               screenshots, where PNG beats JPEG comfortably. Keep the
               original unless we also gained pixels back by scaling. */
            if (scale === 1 && before && after >= before) return original(null);

            return { dataUrl: url, before: before, after: after,
                     width: tw, height: th, changed: true };
        });
    }).catch(function (e) {
        return original(e && e.message);
    });
}

/**
 * Prepare a file and tell the user what happened.
 *
 * The report is the point: an author who watches a 12 MB photo become
 * 800 KB learns, once, why the tool asks for A4-sized images — and an
 * author whose image was left alone is not told anything, because
 * nothing happened to it.
 */
function mbPrepareImageAndReport(file, profileName) {
    return mbPrepareImage(file, profileName).then(function (out) {
        if (out.changed && typeof showStatus === 'function' &&
            window.i18n && window.i18n.tf) {
            showStatus(window.i18n.tf('dgImageOptimized', {
                v0: mbFormatBytes(out.before),
                v1: mbFormatBytes(out.after)
            }), 'success');
        }
        return out;
    });
}

/** Every file from one <input multiple>, in order, one at a time.
    Sequential on purpose: eight 12-megapixel decodes in parallel is how
    a phone browser runs out of memory and kills the tab. */
function mbPrepareImages(fileList, profileName) {
    var files = Array.prototype.slice.call(fileList || []);
    var out = [];
    return files.reduce(function (chain, f) {
        return chain.then(function () {
            return mbPrepareImageAndReport(f, profileName).then(function (r) { out.push(r); });
        });
    }, Promise.resolve()).then(function () { return out; });
}
