// ============================================================
// /src/package_mbz.js
// The module package: one .mbz file per module (3.13.0).
//
// A .mbz is an ordinary ZIP (written and read with fflate, vendor/):
//
//   manifest.json   what the package is, and the module's identity card
//   module.json     the module, its assessment forms, its own cover rows
//   project.json    what the module shares with its programme: the cover,
//                   the references and the work team
//   images/<sha-256>.<ext>   every picture, named by its content
//
// Pictures stay stored as they are (JPEG is compressed already); the
// JSON is deflated. Inside module.json and project.json a picture is a
// reference, "mbimg:<sha-256>", exactly as in the library — so writing a
// package copies records and Blobs, and reading one checks every picture
// against its name before it is stored.
//
// No interface here: building and reading only. The buttons, the
// progress bar and the questions are in package_ui.js.
// ============================================================

var MB_PKG_FORMAT  = 'mb-package';
var MB_PKG_VERSION = 1;

var _MB_PKG_EXT = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
                    'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/bmp': 'bmp' };

function _mbPkgJson(obj) { return fflate.strToU8(JSON.stringify(obj)); }
function _mbPkgParse(u8) { return JSON.parse(fflate.strFromU8(u8)); }

/** The part of the shared data a package carries. */
function mbPackageProjectPart(shared) {
    shared = shared || {};
    return {
        cover: {
            coversAdditionalInfo:  shared.coversAdditionalInfo,
            coversAdditionalNotes: shared.coversAdditionalNotes,
            frontCoverImage:       shared.frontCoverImage || null,
            backCoverImage:        shared.backCoverImage || null,
            coverRows:             shared.coverRows || [],
            coverRowIdCounter:     shared.coverRowIdCounter || 0,
            coverFrameworkSeeded:  !!shared.coverFrameworkSeeded
        },
        references: {
            referencesTitle: shared.referencesTitle || null,
            referencesData:  shared.referencesData || [],
            refIdCounter:    shared.refIdCounter || 1
        },
        team: {
            teamMembers:         shared.teamMembers || [],
            teamMemberIdCounter: shared.teamMemberIdCounter || 0
        }
    };
}

/** File name: code, title, author, date — what a coordinator needs to
 *  tell forty attachments apart. Characters Windows forbids are dropped;
 *  Arabic and French letters are kept. */
function mbPackageFileName(card) {
    var d = new Date(card && card.savedAt ? card.savedAt : Date.now());
    var p = function (n) { return String(n).padStart(2, '0'); };
    var parts = [card.moduleCode, card.moduleTitle, card.author].filter(function (x) { return x && String(x).trim(); });
    var base = parts.join('_').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '').replace(/\s+/g, '_').slice(0, 90) || 'module';
    return base + '_' + d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '.mbz';
}

/**
 * Data URLs (a library without IndexedDB) → references + bytes. In the
 * library proper everything is already a reference and this finds nothing.
 */
function _mbPkgInlineToRefs(value, images) {
    var found = [];
    (function scan(v) {
        if (typeof v === 'string') { if (mbImages.isData(v)) found.push(v); return; }
        if (!v || typeof v !== 'object') return;
        if (Array.isArray(v)) { v.forEach(scan); return; }
        for (var k in v) if (Object.prototype.hasOwnProperty.call(v, k)) scan(v[k]);
    })(value);
    var map = new Map();
    var chain = Promise.resolve();
    found.forEach(function (s) {
        if (map.has(s)) return;
        map.set(s, null);
        chain = chain.then(function () {
            var d = mbImages.dataUrlToBytes(s);
            return mbImages.sha256(d.bytes).then(function (h) { map.set(s, h); images[h] = d; });
        });
    });
    return chain.then(function () {
        if (!found.length) return value;
        return (function copy(v) {
            if (typeof v === 'string') return map.has(v) && map.get(v) ? mbImages.PREFIX + map.get(v) : v;
            if (!v || typeof v !== 'object') return v;
            if (Array.isArray(v)) return v.map(copy);
            var o = {};
            for (var k in v) if (Object.prototype.hasOwnProperty.call(v, k)) o[k] = copy(v[k]);
            return o;
        })(value);
    });
}

/**
 * Build the package of one module of the open project.
 * Resolves { blob, name, card, bytes }.
 */
function mbBuildModulePackage(mid) {
    var project = mbLib.project || {};
    var images = {};
    var src;
    if (mbLib.enabled) {
        src = mbLibrarySave().then(function () {
            return Promise.all([mbStore.getModule(project.id, mid), mbStore.getSharedRecord(project.id)]);
        }).then(function (r) {
            var rec = r[0];
            if (!rec || !rec.module) throw new Error('module not found');
            return { module: rec.module, forms: rec.assessmentForms || {}, card: rec.card,
                     shared: (r[1] && r[1].data) || {} };
        });
    } else {
        var m = (mbState.modulesData || []).find(function (x) { return x.id === mid; });
        if (m) _mbStashModuleCover(m);
        _mbLibFlush();
        src = Promise.resolve({ module: m, forms: _mbFormsOf(m), card: mbMakeModuleCard(project, m, mbLib.cards[mid]),
                                shared: mbCollectShared() });
    }
    return src.then(function (s) {
        var part = mbPackageProjectPart(s.shared);
        return Promise.all([_mbPkgInlineToRefs({ module: s.module, forms: s.forms }, images),
                            _mbPkgInlineToRefs(part, images)]).then(function (r) {
            var body = r[0], proj = r[1];
            var hashes = mbImages.refsIn(body).concat(mbImages.refsIn(proj))
                .filter(function (h, i, a) { return a.indexOf(h) === i && !images[h]; });
            return mbImages.readBytes(hashes).then(function (bytes) {
                Object.keys(bytes).forEach(function (h) { images[h] = bytes[h]; });
                var card = Object.assign({}, s.card || {});
                if (!card.format) card = mbMakeModuleCard(project, s.module, null);
                var list = Object.keys(images).map(function (h) {
                    var type = images[h].type || 'image/jpeg';
                    return { h: h, type: type, size: images[h].bytes.length,
                             path: 'images/' + h + '.' + (_MB_PKG_EXT[type] || 'bin') };
                });
                var manifest = {
                    format: MB_PKG_FORMAT,
                    packageVersion: MB_PKG_VERSION,
                    kind: 'module',
                    createdAt: new Date().toISOString(),
                    createdBy: mbAuthorName(),
                    toolVersion: mbToolVersion(),
                    card: card,
                    project: {
                        id: project.id || null, name: project.name || '',
                        programId: project.programId || null, programName: project.programName || '',
                        occupation: project.occupation || ''
                    },
                    modules: [{ id: s.module.id, code: card.moduleCode || '', title: card.moduleTitle || '' }],
                    images: list
                };
                var files = {
                    'manifest.json': [_mbPkgJson(manifest), { level: 6 }],
                    'module.json':   [_mbPkgJson({ card: card, module: body.module, assessmentForms: body.forms }), { level: 6 }],
                    'project.json':  [_mbPkgJson(proj), { level: 6 }]
                };
                list.forEach(function (it) { files[it.path] = [images[it.h].bytes, { level: 0 }]; });
                var zip = fflate.zipSync(files);
                return {
                    blob: new Blob([zip], { type: 'application/zip' }),
                    name: mbPackageFileName(card),
                    card: card,
                    bytes: zip.length
                };
            });
        });
    });
}

/** An error the interface can name in three languages. */
function _mbPkgError(code, detail) {
    var e = new Error(code + (detail ? ': ' + detail : ''));
    e.mbCode = code;
    return e;
}

/* ══════════════════════════════════════════════════════════
   READING — from the central directory, one entry at a time
   ══════════════════════════════════════════════════════════
   A programme bundle of forty modules is a couple of hundred megabytes.
   Unzipping it whole would hold all of it in memory at once — exactly
   what the library exists to avoid. So the reader takes the File apart
   by slices: the central directory from the end of the file, then each
   entry only when it is asked for. A picture is read when the module
   that uses it is imported, and let go with it.

   Supports what this tool writes and what ordinary archivers make of it
   when someone unzips and re-zips a package: stored and deflated
   entries, data descriptors. Not ZIP64 (over 4 GB, 65 535 entries) and
   not encryption — both are reported as a damaged package. */

function _mbU16(b, o) { return b[o] | (b[o + 1] << 8); }
function _mbU32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }
function _mbSlice(file, start, end) {
    return file.slice(start, end).arrayBuffer().then(function (b) { return new Uint8Array(b); });
}

/** { entries: { name: { method, csize, size, offset } } } */
function mbZipIndex(file) {
    var tail = Math.min(file.size, 65557);
    return _mbSlice(file, file.size - tail, file.size).then(function (b) {
        var eocd = -1;
        for (var i = b.length - 22; i >= 0; i--) {
            if (b[i] === 0x50 && b[i + 1] === 0x4b && b[i + 2] === 0x05 && b[i + 3] === 0x06) { eocd = i; break; }
        }
        if (eocd < 0) throw _mbPkgError('notZip');
        var count = _mbU16(b, eocd + 10), cdSize = _mbU32(b, eocd + 12), cdOff = _mbU32(b, eocd + 16);
        if (cdOff === 0xffffffff || count === 0xffff) throw _mbPkgError('broken');
        if (cdOff + cdSize > file.size) throw _mbPkgError('broken');
        return _mbSlice(file, cdOff, cdOff + cdSize).then(function (cd) {
            var entries = {}, p = 0, dec = new TextDecoder();
            for (var n = 0; n < count; n++) {
                if (_mbU32(cd, p) !== 0x02014b50) throw _mbPkgError('broken');
                var flags = _mbU16(cd, p + 8), method = _mbU16(cd, p + 10);
                var csize = _mbU32(cd, p + 20), size = _mbU32(cd, p + 24);
                var nl = _mbU16(cd, p + 28), xl = _mbU16(cd, p + 30), cl = _mbU16(cd, p + 32);
                var off = _mbU32(cd, p + 42);
                var name = dec.decode(cd.subarray(p + 46, p + 46 + nl));
                if (flags & 1) throw _mbPkgError('broken');          // encrypted
                entries[name] = { method: method, csize: csize, size: size, offset: off };
                p += 46 + nl + xl + cl;
            }
            return { file: file, entries: entries };
        });
    });
}

/** The bytes of one entry, uncompressed. */
function mbZipRead(index, name) {
    var e = index.entries[name];
    if (!e) return Promise.resolve(null);
    return _mbSlice(index.file, e.offset, e.offset + 30).then(function (h) {
        if (_mbU32(h, 0) !== 0x04034b50) throw _mbPkgError('broken');
        var start = e.offset + 30 + _mbU16(h, 26) + _mbU16(h, 28);
        return _mbSlice(index.file, start, start + e.csize);
    }).then(function (data) {
        if (e.method === 0) return data;
        if (e.method === 8) {
            try { return fflate.inflateSync(data, { out: new Uint8Array(e.size) }); }
            catch (err) { throw _mbPkgError('broken'); }
        }
        throw _mbPkgError('broken');
    });
}

function _mbZipJson(index, name) {
    return mbZipRead(index, name).then(function (u8) {
        if (!u8) return null;
        try { return _mbPkgParse(u8); } catch (e) { throw _mbPkgError('broken'); }
    });
}

/** Pictures of one module, by hash, from an opened package. */
function _mbZipImages(index, manifest, hashes) {
    var byHash = {};
    (manifest.images || []).forEach(function (it) { byHash[it.h] = it; });
    var out = {};
    var chain = Promise.resolve();
    (hashes || []).forEach(function (h) {
        var it = byHash[h];
        if (!it || !/^[0-9a-f]{64}$/.test(h)) return;
        chain = chain.then(function () {
            return mbZipRead(index, it.path).then(function (u8) {
                if (u8) out[h] = { bytes: u8, type: it.type || 'image/jpeg' };
            });
        });
    });
    return chain.then(function () { return out; });
}

/**
 * Open a package without reading its contents. Works for both kinds:
 *   kind 'module'     one module (module.json)
 *   kind 'programme'  a whole programme (modules/<n>.json each)
 * Resolves { kind, manifest, project, count, name, size,
 *            readModule(i) → { card, module, forms, images } }.
 * readModule reads one module and only its pictures.
 */
function mbOpenPackage(file) {
    return mbZipIndex(file).then(function (index) {
        if (!index.entries['manifest.json']) throw _mbPkgError('notPackage');
        return _mbZipJson(index, 'manifest.json').then(function (manifest) {
            if (!manifest || manifest.format !== MB_PKG_FORMAT) throw _mbPkgError('notPackage');
            if ((manifest.packageVersion || 0) > MB_PKG_VERSION) throw _mbPkgError('newer');
            if (manifest.kind !== 'module' && manifest.kind !== 'programme') throw _mbPkgError('notPackage');
            return _mbZipJson(index, 'project.json').then(function (project) {
                var list = manifest.kind === 'module'
                    ? [{ path: 'module.json', images: null }]
                    : (manifest.modules || []);
                return {
                    kind: manifest.kind,
                    manifest: manifest,
                    project: project,
                    count: list.length,
                    name: file.name || '',
                    size: file.size,
                    entries: list,
                    /** Pictures by hash — the covers' for a preview. */
                    readImages: function (hashes) { return _mbZipImages(index, manifest, hashes || []); },
                    readModule: function (i) {
                        var it = list[i];
                        return _mbZipJson(index, it.path).then(function (body) {
                            if (!body || !body.module || !body.module.id) throw _mbPkgError('broken');
                            var hashes = it.images || mbImages.refsIn([body.module, body.assessmentForms || {}]);
                            return _mbZipImages(index, manifest, hashes).then(function (images) {
                                return {
                                    card: body.card || (manifest.kind === 'module' ? manifest.card : {}) || {},
                                    module: body.module,
                                    forms: body.assessmentForms || {},
                                    images: images
                                };
                            });
                        });
                    }
                };
            });
        });
    });
}

/**
 * One module package, read whole (it is small). Kept for callers that
 * want a single object.
 * Resolves { manifest, card, module, forms, project, images, name, size }.
 */
function mbReadPackage(file) {
    return mbOpenPackage(file).then(function (pk) {
        if (pk.kind !== 'module') throw _mbPkgError('notPackage');
        return pk.readModule(0).then(function (m) {
            return { manifest: pk.manifest, card: m.card, module: m.module, forms: m.forms,
                     project: pk.project, images: m.images, name: pk.name, size: pk.size };
        });
    });
}

/* ══════════════════════════════════════════════════════════
   WRITING A PROGRAMME — one bundle, module after module
   ══════════════════════════════════════════════════════════
   The ZIP is streamed (fflate.Zip). Its output is gathered into Blob
   parts of a few megabytes, so what stays in JavaScript memory is one
   module and one part, however large the programme. A picture shared by
   several modules is written once. */

function _mbBlobSink() {
    var parts = [], chunks = [], pending = 0;
    return {
        push: function (c) {
            chunks.push(c); pending += c.length;
            if (pending > 8 * 1048576) { parts.push(new Blob(chunks)); chunks = []; pending = 0; }
        },
        blob: function (type) {
            if (chunks.length) parts.push(new Blob(chunks));
            chunks = [];
            return new Blob(parts, { type: type || 'application/zip' });
        }
    };
}

/** A ZIP being written; add(name, bytes, store) then finish(). */
function mbZipWriter() {
    var sink = _mbBlobSink(), error = null;
    var zip = new fflate.Zip(function (err, chunk) {
        if (err) { error = err; return; }
        sink.push(chunk);
    });
    return {
        add: function (name, bytes, store) {
            var f = store ? new fflate.ZipPassThrough(name) : new fflate.ZipDeflate(name, { level: 6 });
            zip.add(f);
            f.push(bytes, true);
            if (error) throw error;
        },
        finish: function () {
            zip.end();
            if (error) throw error;
            return sink.blob('application/zip');
        }
    };
}

function _mbPkgExt(type) { return _MB_PKG_EXT[type] || 'bin'; }

/**
 * Every module of a project (open or not) as ONE package, read from the
 * library one module at a time. `onStep(i, n, label)` reports progress;
 * returning false from `stopped()` keeps going.
 * Resolves { blob, name, count, bytes }.
 */
function mbBuildProgrammePackage(pid, onStep, stopped) {
    var w = mbZipWriter(), written = {}, images = [], modules = [];
    var meta, sharedRec, heads;
    return mbLibrarySave().then(function () {
        return Promise.all([mbStore.getProject(pid), mbStore.getSharedRecord(pid), mbStore.getHeads(pid)]);
    }).then(function (r) {
        meta = r[0]; sharedRec = r[1]; heads = r[2] || [];
        if (!meta) throw new Error('project not found');
        var byId = {}; heads.forEach(function (h) { byId[h.mid] = h; });
        var order = (meta.moduleOrder || []).filter(function (id) { return byId[id]; });
        heads.forEach(function (h) { if (order.indexOf(h.mid) === -1) order.push(h.mid); });
        var part = mbPackageProjectPart((sharedRec && sharedRec.data) || {});
        w.add('project.json', _mbPkgJson(part));
        var addImages = function (hashes) {
            var need = hashes.filter(function (h) { return !written[h]; });
            return mbImages.readBytes(need).then(function (bytes) {
                Object.keys(bytes).forEach(function (h) {
                    var type = bytes[h].type || 'image/jpeg';
                    var path = 'images/' + h + '.' + _mbPkgExt(type);
                    w.add(path, bytes[h].bytes, true);
                    written[h] = true;
                    images.push({ h: h, type: type, size: bytes[h].bytes.length, path: path });
                });
            });
        };
        var chain = addImages(mbImages.refsIn(part));
        order.forEach(function (mid, i) {
            chain = chain.then(function () {
                if (stopped && stopped()) return null;
                var h = byId[mid];
                if (onStep) onStep(i, order.length, ((h.card && h.card.moduleCode) ? h.card.moduleCode + ' — ' : '') + ((h.card && h.card.moduleTitle) || ''));
                return mbStore.getModule(pid, mid).then(function (rec) {
                    if (!rec || !rec.module) return null;
                    var hashes = mbImages.refsIn([rec.module, rec.assessmentForms || {}]);
                    var path = 'modules/' + String(i + 1).padStart(3, '0') + '.json';
                    w.add(path, _mbPkgJson({ card: rec.card, module: rec.module, assessmentForms: rec.assessmentForms || {} }));
                    modules.push({ id: mid, code: (rec.card && rec.card.moduleCode) || '', title: (rec.card && rec.card.moduleTitle) || '',
                                   card: rec.card, path: path, images: hashes });
                    return addImages(hashes);
                });
            });
        });
        return chain;
    }).then(function () {
        if (stopped && stopped()) return null;
        var manifest = {
            format: MB_PKG_FORMAT, packageVersion: MB_PKG_VERSION, kind: 'programme',
            createdAt: new Date().toISOString(), createdBy: mbAuthorName(), toolVersion: mbToolVersion(),
            project: { id: meta.id, name: meta.name || '', programId: meta.programId || null,
                       programName: meta.programName || '', occupation: meta.occupation || '' },
            modules: modules,
            images: images
        };
        w.add('manifest.json', _mbPkgJson(manifest));
        var blob = w.finish();
        var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); };
        var base = String(meta.name || 'programme').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '').replace(/\s+/g, '_').slice(0, 80);
        return { blob: blob, name: base + '_' + modules.length + '_' + d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '.mbz',
                 count: modules.length, bytes: blob.size };
    });
}
