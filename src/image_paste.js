// ============================================================
// /src/image_paste.js
// Paste an image straight from the clipboard into a content card or an
// activity step — as an alternative to picking a file from disk.
//
// WHY A SEPARATE FILE
// The two call sites (content.js, steps.js) differ only in WHICH array
// the bytes land in and WHICH gallery is redrawn. Everything expensive —
// reading the clipboard, the permission dance, the Ctrl+V fallback, the
// URL case — is identical, and duplicating it into both files would mean
// fixing every future browser quirk twice.
//
// WHY THERE ARE TWO PATHS
// navigator.clipboard.read() is the one-click path, and it only exists
// in a secure context (https or localhost) in Chromium browsers, behind
// a permission the user can refuse. Firefox does not offer it to pages
// at all. A button that works for half the users is worse than no
// button, so every failure falls through to a small modal that listens
// for a real `paste` event — which is unprivileged, needs no permission,
// and has worked in every browser for twenty years.
//
// WHAT IS NOT HANDLED, DELIBERATELY
// "Copy image address" puts TEXT on the clipboard, not pixels. We try to
// fetch it, but a cross-origin server without CORS headers will refuse,
// and a canvas fed a tainted image cannot be read back at all. On that
// failure the user is told to use "Copy image" instead. Guessing harder
// here would only produce a blank thumbnail with no explanation.
//
// STORAGE
// Nothing new is stored. The bytes go through image_prep.js on the
// 'content' profile — the same downscale-and-JPEG pass the file upload
// uses — and are pushed as a data URL into the same arrays. Autosave,
// save/load and the DOCX export therefore need no change whatsoever;
// they cannot tell a pasted image from an uploaded one.
// ============================================================

/* ── Targets ─────────────────────────────────────────────────
   The only thing that differs between the two call sites. Kept as data
   rather than as two near-identical functions so a third card type
   (should one ever want images) is three lines, not a copy. */
var MB_PASTE_TARGETS = {
    content: {
        bucket: function () { return mbState.contentSectionImages; },
        render: function (id) {
            if (typeof renderContentImageGallery === 'function') renderContentImageGallery(id);
        },
        galleryId: function (id) { return 'content-image-gallery-' + id; },
        cardSelector: '.content-section-item',
        idAttr: 'data-content-id'
    },
    step: {
        bucket: function () { return mbState.stepImages; },
        render: function (id) {
            if (typeof renderStepImageGallery === 'function') renderStepImageGallery(id);
        },
        galleryId: function (id) { return 'step-image-gallery-' + id; },
        cardSelector: '.step-item',
        idAttr: 'data-step-id'
    },
    /* 3.54.0: the QR code of the Video, Link & QR dialog (link_modal.js).
       One image, not a list, so it brings its own `put` instead of a
       bucket; the 'qr' profile keeps it PNG, since JPEG blurs the
       modules of a QR code. No cardSelector: it is reached from the
       dialog's own button and paste listener, never from a card. */
    /* 3.81.0: the Front / Back Cover. One image per side, so like the QR
       code it brings its own `put`; unlike it, a failed one-click paste
       falls back to the Ctrl+V window (touch screens have no Ctrl+V, but
       a long-press paste lands in that window's box). `idFrom` serves the
       Ctrl+V listener: it resolves the side from where the paste
       happened, and also from the open cover tab when nothing is focused. */
    cover: {
        profile: 'cover',
        put: function (side, dataUrl) {
            if (typeof _mbApplyCoverImage === 'function') _mbApplyCoverImage(side, dataUrl, true);
        },
        idFrom: function (el) {
            var scope = el.closest('#covers-tab, #back-cover-tab');
            if (!scope && (el === document.body || el === document.documentElement)) {
                scope = document.querySelector('#covers-tab.active, #back-cover-tab.active');
            }
            if (!scope) return null;
            return scope.id === 'back-cover-tab' ? 'back' : 'front';
        },
        /* No window: Ctrl+V works anywhere in the cover tab, so a refused
           one-click paste just says so. */
        fail: function (side, reason) {
            _mbPasteStatus(reason === 'url'
                ? _mbPasteT('dgPasteUrlFailed', 'That looks like an image link, not an image. Use right-click → Copy image.')
                : _mbPasteT('dgCoverPasteHint', 'Nothing could be pasted from the clipboard. Copy an image, then press Ctrl+V (⌘+V on Mac) on this page.'), 'error');
        }
    },
    qr: {
        profile: 'qr',
        put: function (id, dataUrl) {
            if (typeof mbLinkModalSetQr === 'function') mbLinkModalSetQr(dataUrl);
        },
        /* 3.54.1: no "press Ctrl+V" window for the QR code — the dialog
           says what went wrong in its own message line instead. */
        fail: function (id, reason) {
            if (typeof mbLinkModalPasteFailed === 'function') mbLinkModalPasteFailed(reason);
        }
    }
};

function _mbPasteT(key, fallback) {
    if (window.i18n && window.i18n.has && window.i18n.has(key)) return window.i18n.t(key);
    if (window.i18n && window.i18n.t) {
        var v = window.i18n.t(key);
        if (v && v !== key) return v;
    }
    return fallback;
}

function _mbPasteStatus(msg, type) {
    if (typeof showStatus === 'function') showStatus(msg, type || 'success');
}

/* Autosave listens for `input`/`change` bubbling out of the main
   container. A paste fires neither — the file input does, which is why
   uploads have always been saved. Without this line a pasted image lives
   only in memory until the user happens to type somewhere else. */
function _mbPasteNotifyChanged(el) {
    if (!el) return;
    el.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Push one Blob into a target card.
 * Resolves true if an image was actually stored.
 */
function _mbStorePastedBlob(targetName, id, blob) {
    var target = MB_PASTE_TARGETS[targetName];
    if (!target || !blob) return Promise.resolve(false);

    /* image_prep.js reads `.type` and `.size`, both of which a Blob
       already has, but it also logs the file name on failure — and a
       File is a Blob, so wrapping costs nothing and keeps the two paths
       identical downstream. */
    var file;
    var ext = (blob.type === 'image/png') ? 'png'
            : (blob.type === 'image/webp') ? 'webp'
            : (blob.type === 'image/gif') ? 'gif' : 'jpg';
    try {
        file = new File([blob], 'pasted-' + Date.now() + '.' + ext, { type: blob.type });
    } catch (e) {
        file = blob; // Safari < 14 has no File constructor
    }

    var bucket = target.put ? null : target.bucket();
    if (bucket && !bucket[id]) bucket[id] = [];

    var store = function (dataUrl) {
        if (target.put) {
            target.put(id, dataUrl);   // the target reports success itself
            return true;
        }
        bucket[id].push(dataUrl);
        target.render(id);
        _mbPasteNotifyChanged(document.getElementById(target.galleryId(id)));
        _mbPasteStatus(_mbPasteT('dgImagePasted', 'Image pasted'), 'success');
        return true;
    };

    if (typeof mbPrepareImage === 'function') {
        return mbPrepareImage(file, target.profile || 'content').then(function (out) { return store(out.dataUrl); });
    }
    return new Promise(function (resolve) {
        var reader = new FileReader();
        reader.onload = function (e) { resolve(store(e.target.result)); };
        reader.onerror = function () { resolve(false); };
        reader.readAsDataURL(file);
    });
}

/* ── The URL case ────────────────────────────────────────────
   "Copy image address" gives a string. We fetch it as a blob rather than
   loading it into an <img> and drawing it: a cross-origin <img> taints
   the canvas, and toDataURL() on a tainted canvas throws — so the img
   route can only ever succeed on same-origin images, which is not the
   case the user is in. fetch at least succeeds wherever the server sends
   permissive CORS headers, which many CDNs do. */
function _mbFetchImageUrl(url) {
    return fetch(url, { mode: 'cors' })
        .then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.blob();
        })
        .then(function (blob) {
            if (!blob.type || blob.type.indexOf('image/') !== 0) throw new Error('not an image');
            return blob;
        });
}

function _mbLooksLikeImageUrl(text) {
    if (!text) return false;
    var t = text.trim();
    if (!/^https?:\/\//i.test(t) && !/^data:image\//i.test(t)) return false;
    if (/^data:image\//i.test(t)) return true;
    return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/i.test(t) || t.length < 2048;
}

/* ── Reading a DataTransfer (the Ctrl+V path) ────────────────
   Images first: a copy from a web page usually puts BOTH the bitmap and
   an <img> HTML fragment on the clipboard, and the bitmap is the one
   worth having. */
function _mbBlobFromDataTransfer(dt) {
    if (!dt) return null;
    var items = dt.items || [];
    for (var i = 0; i < items.length; i++) {
        if (items[i].kind === 'file' && items[i].type && items[i].type.indexOf('image/') === 0) {
            var f = items[i].getAsFile();
            if (f) return f;
        }
    }
    if (dt.files && dt.files.length) {
        for (var j = 0; j < dt.files.length; j++) {
            if (dt.files[j].type && dt.files[j].type.indexOf('image/') === 0) return dt.files[j];
        }
    }
    return null;
}

function _mbUrlFromDataTransfer(dt) {
    if (!dt || !dt.getData) return '';
    var text = '';
    try { text = dt.getData('text/plain') || ''; } catch (e) { text = ''; }
    if (_mbLooksLikeImageUrl(text)) return text.trim();

    var html = '';
    try { html = dt.getData('text/html') || ''; } catch (e) { html = ''; }
    var m = html.match(/<img[^>]+src\s*=\s*["']([^"']+)["']/i);
    return m ? m[1] : '';
}

/**
 * Handle a paste event (or a synthesised one) for a given card.
 * Resolves true if something was stored.
 */
function mbHandlePasteEvent(targetName, id, evt) {
    var dt = evt.clipboardData || window.clipboardData;
    var blob = _mbBlobFromDataTransfer(dt);
    if (blob) {
        if (evt.preventDefault) evt.preventDefault();
        return _mbStorePastedBlob(targetName, id, blob);
    }
    var url = _mbUrlFromDataTransfer(dt);
    if (url) {
        if (evt.preventDefault) evt.preventDefault();
        return _mbFetchImageUrl(url)
            .then(function (b) { return _mbStorePastedBlob(targetName, id, b); })
            .catch(function () {
                _mbPasteStatus(_mbPasteT('dgPasteUrlFailed',
                    'That looks like an image link, not an image. Use right-click → Copy image.'), 'error');
                return false;
            });
    }
    return Promise.resolve(false);
}

/* ── The fallback modal ──────────────────────────────────────
   Reuses the dialog.js overlay classes so it inherits the tool's
   direction, spacing and dark-overlay behaviour instead of introducing a
   second modal look. It is not built on mbConfirm because it must stay
   open while listening for a paste, and mbConfirm resolves on the first
   button press. */
var _mbPasteZoneOpen = null;

function mbOpenPasteZone(targetName, id) {
    if (_mbPasteZoneOpen) return;

    var rtl = (window.i18n && window.i18n.isRTL && window.i18n.isRTL());
    var overlay = document.createElement('div');
    overlay.className = 'mb-dialog-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    var box = document.createElement('div');
    box.className = 'mb-dialog';
    box.setAttribute('dir', rtl ? 'rtl' : 'ltr');

    var msg = document.createElement('div');
    msg.className = 'mb-dialog-msg';
    msg.textContent = _mbPasteT('dgPasteHint',
        'Press Ctrl+V (⌘+V on Mac) now to paste the copied image.');
    box.appendChild(msg);

    /* contenteditable, not a div with tabindex: on Safari and Firefox a
       paste event only reaches an element that can actually receive
       text. It is emptied on every input so the user never sees the
       pasted HTML appear inside it. */
    var zone = document.createElement('div');
    zone.className = 'mb-paste-zone';
    zone.setAttribute('contenteditable', 'true');
    zone.setAttribute('role', 'textbox');
    zone.setAttribute('aria-label', msg.textContent);
    zone.textContent = '';
    box.appendChild(zone);

    var actions = document.createElement('div');
    actions.className = 'mb-dialog-actions';
    var cancel = document.createElement('button');
    cancel.className = 'mb-dialog-btn';
    cancel.textContent = _mbPasteT('dgCancel', rtl ? 'إلغاء' : 'Cancel');
    actions.appendChild(cancel);
    box.appendChild(actions);

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    function close() {
        document.removeEventListener('keydown', onKey, true);
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        _mbPasteZoneOpen = null;
    }
    function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); close(); } }

    zone.addEventListener('paste', function (e) {
        mbHandlePasteEvent(targetName, id, e).then(function (ok) {
            zone.innerHTML = '';
            if (ok) close();
            else _mbPasteStatus(_mbPasteT('dgPasteNoImage',
                'No image found on the clipboard.'), 'error');
        });
    });
    zone.addEventListener('input', function () { zone.innerHTML = ''; });
    cancel.addEventListener('click', close);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', onKey, true);

    _mbPasteZoneOpen = close;
    setTimeout(function () { zone.focus(); }, 30);
}

/* ── The one-click path ──────────────────────────────────────
   Everything that can go wrong here — no API, insecure context, refused
   permission, empty clipboard, text-only clipboard — ends in the same
   place: the modal, which always works. The only case that does NOT
   fall through is a clipboard that held an image link, because there the
   modal would fail in exactly the same way and the user needs the real
   explanation instead. */
function mbPasteImageInto(targetName, id) {
    var target = MB_PASTE_TARGETS[targetName];
    if (!target) return;
    /* A target with its own `fail` (the QR code) is told why nothing was
       pasted; the others fall back to the paste prompt as before. */
    var fallback = function (reason) {
        if (target.fail) target.fail(id, reason);
        else mbOpenPasteZone(targetName, id);
    };
    var urlFailed = function () {
        if (target.fail) { target.fail(id, 'url'); return false; }
        _mbPasteStatus(_mbPasteT('dgPasteUrlFailed',
            'That looks like an image link, not an image. Use right-click → Copy image.'), 'error');
        return false;
    };

    var canRead = !!(navigator.clipboard && navigator.clipboard.read && window.isSecureContext);
    if (!canRead) { fallback('denied'); return; }

    navigator.clipboard.read().then(function (items) {
        var imageType = null, imageItem = null, textItem = null, htmlItem = null;
        for (var i = 0; i < items.length && !imageType; i++) {
            var types = items[i].types || [];
            for (var j = 0; j < types.length; j++) {
                if (types[j].indexOf('image/') === 0) { imageType = types[j]; imageItem = items[i]; break; }
                if (types[j] === 'text/plain' && !textItem) textItem = items[i];
                if (types[j] === 'text/html' && !htmlItem) htmlItem = items[i];
            }
        }

        /* 3.54.2: a picture copied out of Word, an e-mail or a selection
           on a web page often arrives as HTML around an <img>, with no
           bitmap of its own. Its src — a data: URI or a web address —
           is the image. */
        if (!imageItem && htmlItem) {
            return htmlItem.getType('text/html').then(function (b) { return b.text(); })
                .then(function (html) {
                    var m = html.match(/<img[^>]+src\s*=\s*["']([^"']+)["']/i);
                    if (!m) { fallback('empty'); return false; }
                    return _mbFetchImageUrl(m[1])
                        .then(function (blob) { return _mbStorePastedBlob(targetName, id, blob); })
                        .catch(urlFailed);
                });
        }

        if (imageItem) {
            return imageItem.getType(imageType).then(function (blob) {
                return _mbStorePastedBlob(targetName, id, blob);
            });
        }
        if (textItem) {
            return textItem.getType('text/plain').then(function (b) { return b.text(); })
                .then(function (text) {
                    if (!_mbLooksLikeImageUrl(text)) { fallback('empty'); return false; }
                    return _mbFetchImageUrl(text.trim())
                        .then(function (blob) { return _mbStorePastedBlob(targetName, id, blob); })
                        .catch(urlFailed);
                });
        }
        fallback('empty');
        return false;
    }).catch(function (err) {
        /* Permission refused, or a browser that has read() but not the
           permission model. The modal needs neither. Any other error
           (Chrome's "no valid data on the clipboard", for one) means
           there was nothing it could read — not a refusal. */
        fallback(err && err.name === 'NotAllowedError' ? 'denied' : 'empty');
    });
}

/* ── data-act entry points ───────────────────────────────────
   events.js resolves an action name against the globals, so these two
   need no registration beyond existing. */
function pasteContentImage(contentId) { mbPasteImageInto('content', contentId); }
function pasteStepImage(stepId)       { mbPasteImageInto('step', stepId); }

/* ── Ctrl+V anywhere inside a card ───────────────────────────
   One delegated listener, so it covers cards that do not exist yet. It
   only acts when the clipboard actually carries an image: pasting TEXT
   into a step's textarea must keep working exactly as before, and it
   does, because _mbBlobFromDataTransfer returns null and we return
   without touching the event.

   The URL branch is deliberately NOT reached from here. Someone pasting
   a link into the textarea means to paste a link. */
document.addEventListener('paste', function (e) {
    if (_mbPasteZoneOpen) return;                 // the modal owns the event
    var blob = _mbBlobFromDataTransfer(e.clipboardData);
    if (!blob) return;

    var el = e.target;
    if (!el || !el.closest) return;

    var names = Object.keys(MB_PASTE_TARGETS);
    for (var i = 0; i < names.length; i++) {
        var t = MB_PASTE_TARGETS[names[i]];
        var id = null;
        if (t.idFrom) {
            id = t.idFrom(el);
        } else if (t.cardSelector) {
            var card = el.closest(t.cardSelector);
            if (!card) continue;
            var field = card.querySelector('[' + t.idAttr + ']');
            id = field ? field.getAttribute(t.idAttr) : null;
        }
        if (!id) continue;
        e.preventDefault();
        _mbStorePastedBlob(names[i], id, blob);
        return;
    }
});
