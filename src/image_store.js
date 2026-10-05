// ============================================================
// /src/image_store.js
// Pictures as Blobs, apart from the text (3.13.0).
//
// WHY
// A picture used to live inside the module as a data URL — base64 text a
// third bigger than the picture, copied into every save and kept in
// memory as a string for as long as the module was loaded. Now:
//
//   in storage   one Blob per picture in the `images` store, keyed by the
//                SHA-256 of its bytes. Modules point at it with a short
//                reference, "mbimg:<hash>". The same picture in ten
//                modules is ONE Blob.
//   on screen    an object URL ("blob:…") made from that Blob when the
//                module is opened, released when it is closed.
//   in exports   a data URL again, made just before an export runs
//                (mbImagesInlineForExport) — Word, PPTX, HTML and PDF
//                read data URLs and were not changed.
//
// A picture just uploaded or pasted stays a data URL in memory, exactly
// as before, until the next save turns it into a Blob and a reference.
// So no upload or paste path changed either.
//
// THE COLLECTOR
// Each module's head lists the pictures it uses, and so does each
// project's shared record (the covers). A picture nothing lists any more
// is deleted (mbLibraryCollectImages). Pictures on screen, and those in
// the open module or the covers that are not saved yet, are always kept.
// ============================================================

var mbImages = (function () {
    'use strict';

    var PREFIX = 'mbimg:';
    var MAX_INLINE_SCAN = 512;      // only strings at least this long can be pictures

    var known  = new Map();   // data URL string → hash (this session)
    var stored = new Set();   // hashes known to be in the store
    var sizes  = new Map();   // hash → bytes
    var urlOf  = new Map();   // hash → object URL
    var hashOf = new Map();   // object URL → hash

    function isRef(s)  { return typeof s === 'string' && s.indexOf(PREFIX) === 0 && s.length === PREFIX.length + 64; }
    function isData(s) { return typeof s === 'string' && s.length >= MAX_INLINE_SCAN && /^data:image\//.test(s); }
    function isBlob(s) { return typeof s === 'string' && s.indexOf('blob:') === 0 && hashOf.has(s); }
    function refOf(h)  { return PREFIX + h; }
    function hashOfRef(s) { return s.slice(PREFIX.length); }

    /* ── Bytes and hashes ─────────────────────────────────────── */
    function hex(buf) {
        var b = new Uint8Array(buf), out = '';
        for (var i = 0; i < b.length; i++) out += (b[i] < 16 ? '0' : '') + b[i].toString(16);
        return out;
    }
    function sha256(bytes) {
        return crypto.subtle.digest('SHA-256', bytes).then(hex);
    }
    function dataUrlToBytes(dataUrl) {
        var comma = dataUrl.indexOf(',');
        var head = dataUrl.slice(5, comma);                 // "image/jpeg;base64"
        var type = head.split(';')[0] || 'application/octet-stream';
        var b64 = head.indexOf(';base64') !== -1;
        var body = dataUrl.slice(comma + 1);
        var bytes;
        if (b64) {
            var bin = atob(body);
            bytes = new Uint8Array(bin.length);
            for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        } else {
            bytes = new TextEncoder().encode(decodeURIComponent(body));
        }
        return { bytes: bytes, type: type };
    }
    function blobToDataUrl(blob) {
        return new Promise(function (resolve, reject) {
            var r = new FileReader();
            r.onload = function () { resolve(r.result); };
            r.onerror = function () { reject(r.error); };
            r.readAsDataURL(blob);
        });
    }

    /** Store bytes as a picture; returns its hash. */
    function putBytes(bytes, type) {
        return sha256(bytes).then(function (h) {
            sizes.set(h, bytes.length);
            if (stored.has(h)) return h;
            return mbStore.hasImages([h]).then(function (has) {
                if (has[h]) { stored.add(h); return h; }
                return mbStore.putImages([{ h: h, blob: new Blob([bytes], { type: type }), type: type, size: bytes.length }])
                    .then(function () { stored.add(h); return h; });
            });
        });
    }

    /* ── Walks ────────────────────────────────────────────────── */
    function collectStrings(v, test, out) {
        if (typeof v === 'string') { if (test(v)) out.push(v); return out; }
        if (!v || typeof v !== 'object') return out;
        if (Array.isArray(v)) { for (var i = 0; i < v.length; i++) collectStrings(v[i], test, out); return out; }
        for (var k in v) if (Object.prototype.hasOwnProperty.call(v, k)) collectStrings(v[k], test, out);
        return out;
    }

    /**
     * A copy of `value` with every picture replaced by its reference,
     * ready to store. New pictures (data URLs) are hashed and stored on
     * the way. Returns { value, hashes, bytes } — `hashes` are the
     * pictures the copy points at, `bytes` their total size.
     */
    function dehydrate(value) {
        var fresh = collectStrings(value, function (s) { return isData(s) && !known.has(s); }, []);
        var chain = Promise.resolve();
        var seen = new Set();
        fresh.forEach(function (s) {
            if (seen.has(s)) return;
            seen.add(s);
            chain = chain.then(function () {
                var d = dataUrlToBytes(s);
                return putBytes(d.bytes, d.type).then(function (h) { known.set(s, h); });
            }).catch(function (e) { console.warn('[Images] picture not stored:', e); });
        });
        return chain.then(function () {
            /* The pictures on screen may have been collected away since
               they were opened (another tab, a deleted module sharing
               one): re-check the ones not confirmed this session. */
            var need = [];
            collectStrings(value, function (s) { return isBlob(s) || isRef(s); }, []).forEach(function (s) {
                var h = isRef(s) ? hashOfRef(s) : hashOf.get(s);
                if (!stored.has(h) && need.indexOf(h) === -1) need.push(h);
            });
            if (!need.length) return null;
            return mbStore.hasImages(need).then(function (has) {
                var missing = need.filter(function (h) { return !has[h]; });
                need.forEach(function (h) { if (has[h]) stored.add(h); });
                /* A picture on screen that the store lost: put it back
                   from its object URL. */
                return Promise.all(missing.map(function (h) {
                    var u = urlOf.get(h);
                    if (!u) return null;
                    return fetch(u).then(function (r) { return r.blob(); }).then(function (b) {
                        return mbStore.putImages([{ h: h, blob: b, type: b.type, size: b.size }]).then(function () { stored.add(h); });
                    }).catch(function () {});
                }));
            });
        }).then(function () {
            var hashes = new Set();
            function copy(v) {
                if (typeof v === 'string') {
                    if (v.length < 40) return v;
                    var h = null;
                    if (isRef(v)) h = hashOfRef(v);
                    else if (isBlob(v)) h = hashOf.get(v);
                    else if (isData(v) && known.has(v)) h = known.get(v);
                    if (h) { hashes.add(h); return refOf(h); }
                    return v;     // a data URL that arrived after the scan: next save
                }
                if (!v || typeof v !== 'object') return v;
                if (Array.isArray(v)) return v.map(copy);
                var o = {};
                for (var k in v) if (Object.prototype.hasOwnProperty.call(v, k)) o[k] = copy(v[k]);
                return o;
            }
            var out = copy(value);
            var list = Array.from(hashes), bytes = 0;
            list.forEach(function (h) { bytes += sizes.get(h) || 0; });
            return { value: out, hashes: list, bytes: bytes };
        });
    }

    /** Hashes a stored value points at (no I/O). */
    function refsIn(value) {
        var out = [];
        collectStrings(value, isRef, []).forEach(function (s) {
            var h = hashOfRef(s);
            if (out.indexOf(h) === -1) out.push(h);
        });
        return out;
    }

    /** Object URLs for these hashes, reading only the Blobs not yet open. */
    function ensureUrls(hashes) {
        var need = hashes.filter(function (h) { return !urlOf.has(h); });
        if (!need.length) return Promise.resolve();
        return mbStore.getImages(need).then(function (recs) {
            need.forEach(function (h) {
                var rec = recs[h];
                if (!rec || !rec.blob) return;
                var u = URL.createObjectURL(rec.blob);
                urlOf.set(h, u); hashOf.set(u, h);
                stored.add(h);
                sizes.set(h, rec.size || rec.blob.size || 0);
            });
        });
    }

    /** In place: every reference in `obj` becomes an object URL. A
     *  picture missing from the store becomes '' and is dropped from the
     *  arrays it was in, rather than a broken image. */
    function hydrate(obj) {
        var hashes = refsIn(obj);
        return ensureUrls(hashes).then(function () {
            function walk(v) {
                if (Array.isArray(v)) {
                    for (var i = v.length - 1; i >= 0; i--) {
                        if (isRef(v[i])) {
                            var u = urlOf.get(hashOfRef(v[i]));
                            if (u) v[i] = u; else v.splice(i, 1);
                        } else walk(v[i]);
                    }
                    return;
                }
                if (!v || typeof v !== 'object') return;
                for (var k in v) {
                    if (!Object.prototype.hasOwnProperty.call(v, k)) continue;
                    if (isRef(v[k])) { var u2 = urlOf.get(hashOfRef(v[k])); v[k] = u2 || null; }
                    else walk(v[k]);
                }
            }
            walk(obj);
            return hashes;
        });
    }

    /** Hashes of the pictures a live value uses — references and the
     *  object URLs made here. */
    function hashesIn(value) {
        var out = [];
        collectStrings(value, function (s) { return isRef(s) || isBlob(s); }, []).forEach(function (s) {
            var h = isRef(s) ? hashOfRef(s) : hashOf.get(s);
            if (h && out.indexOf(h) === -1) out.push(h);
        });
        return out;
    }

    /** Release the object URLs of pictures no longer on screen. */
    function release(keepHashes) {
        var keep = new Set(keepHashes || []);
        urlOf.forEach(function (u, h) {
            if (keep.has(h)) return;
            URL.revokeObjectURL(u);
            urlOf.delete(h); hashOf.delete(u);
        });
    }

    /* ── Exports ──────────────────────────────────────────────────
       Every exporter reads data URLs. Before one runs, the pictures of
       the open module and of the covers are turned back into data URLs
       IN STATE. They stay that way until the module is closed; the next
       save maps them to the same references, so nothing is rewritten. */
    function inlineForExport() {
        var cache = new Map();
        function toData(s) {
            var h = isRef(s) ? hashOfRef(s) : hashOf.get(s);
            if (cache.has(h)) return Promise.resolve(cache.get(h));
            return ensureUrls([h]).then(function () {
                var u = urlOf.get(h);
                if (!u) return null;
                return fetch(u).then(function (r) { return r.blob(); }).then(blobToDataUrl).then(function (d) {
                    cache.set(h, d); known.set(d, h);
                    return d;
                });
            }).catch(function () { return null; });
        }
        var holders = [];
        function scan(parent, key) {
            var v = parent[key];
            if (typeof v === 'string') { if (isBlob(v) || isRef(v)) holders.push([parent, key, v]); return; }
            if (!v || typeof v !== 'object') return;
            if (Array.isArray(v)) { for (var i = 0; i < v.length; i++) scan(v, i); return; }
            for (var k in v) if (Object.prototype.hasOwnProperty.call(v, k)) scan(v, k);
        }
        var st = window.mbState || {};
        var openMod = (st.modulesData || []).find(function (m) { return m.id === st.currentModuleId; });
        var SCALARS = ['infoQRImage', 'activityQRImage', 'frontCoverImage', 'backCoverImage'];
        var roots = { m: openMod, lo: st.learningOutcomesData, c: st.contentSectionImages, s: st.stepImages };
        SCALARS.forEach(function (k) { roots[k] = st[k]; });
        Object.keys(roots).forEach(function (k) { scan(roots, k); });
        return Promise.all(holders.map(function (hd) {
            return toData(hd[2]).then(function (d) { if (d && hd[0][hd[1]] === hd[2]) hd[0][hd[1]] = d; });
        })).then(function () {
            /* The four single pictures were copied into `roots`; put the
               data URLs back on state. */
            SCALARS.forEach(function (k) { if (roots[k] !== st[k]) st[k] = roots[k]; });
            return holders.length;
        });
    }

    function wrapExporters() {
        ['exportToDocx', 'mbExportToHtml', 'mbExportToPdf', 'mbExportToPptx'].forEach(function (name) {
            var orig = window[name];
            if (typeof orig !== 'function' || orig.__mbInlined) return;
            var wrapped = function () {
                var self = this, args = arguments;
                return inlineForExport().then(function () { return orig.apply(self, args); });
            };
            wrapped.__mbInlined = true;
            window[name] = wrapped;
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wrapExporters);
    else wrapExporters();

    /* ── Packages ─────────────────────────────────────────────── */
    /** { hash: { bytes: Uint8Array, type } } for these pictures. */
    function readBytes(hashes) {
        return mbStore.getImages(hashes).then(function (recs) {
            var out = {};
            return Promise.all(hashes.map(function (h) {
                var rec = recs[h];
                if (!rec || !rec.blob) return null;
                return rec.blob.arrayBuffer().then(function (buf) {
                    out[h] = { bytes: new Uint8Array(buf), type: rec.type || rec.blob.type || 'image/jpeg' };
                });
            })).then(function () { return out; });
        });
    }
    /** Store a picture that arrived in a package, after checking that its
     *  bytes match its name. Resolves the hash, or null when they do not. */
    function putVerified(hash, bytes, type) {
        return sha256(bytes).then(function (h) {
            if (h !== hash) return null;
            sizes.set(h, bytes.length);
            if (stored.has(h)) return h;
            return mbStore.putImages([{ h: h, blob: new Blob([bytes], { type: type }), type: type, size: bytes.length }])
                .then(function () { stored.add(h); return h; });
        });
    }

    /* ── Collector ────────────────────────────────────────────── */
    /* `inMemory`: what is open right now (the module and the shared
       data). Its pictures are kept even if no record lists them yet — an
       edit not saved at the moment the collector runs. */
    function collect(inMemory) {
        return Promise.all([mbStore.imageKeys(), mbStore.liveImageIds()]).then(function (r) {
            var keys = r[0], live = r[1];
            urlOf.forEach(function (u, h) { live[h] = true; });
            collectStrings(inMemory, function (s) { return isRef(s) || isBlob(s) || (isData(s) && known.has(s)); }, [])
                .forEach(function (s) {
                    var h = isRef(s) ? hashOfRef(s) : (isBlob(s) ? hashOf.get(s) : known.get(s));
                    if (h) live[h] = true;
                });
            var dead = keys.filter(function (h) { return !live[h]; });
            dead.forEach(function (h) { stored.delete(h); sizes.delete(h); });
            return mbStore.deleteImages(dead).then(function () { return dead.length; });
        });
    }

    function sizeOf(hashes) {
        var n = 0;
        (hashes || []).forEach(function (h) { n += sizes.get(h) || 0; });
        return n;
    }

    return {
        PREFIX: PREFIX,
        isRef: isRef, isData: isData,
        dehydrate: dehydrate, hydrate: hydrate, refsIn: refsIn, hashesIn: hashesIn,
        release: release, inlineForExport: inlineForExport,
        readBytes: readBytes, putVerified: putVerified, putBytes: putBytes,
        collect: collect, sizeOf: sizeOf, sha256: sha256,
        dataUrlToBytes: dataUrlToBytes
    };
})();

function mbImagesInlineForExport() { return mbImages.inlineForExport(); }
