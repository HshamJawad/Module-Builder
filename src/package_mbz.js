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

/**
 * Read a package (a File or Blob). Nothing is stored here.
 * Resolves { manifest, card, module, forms, project, images, name, size }
 * where images is { hash: { bytes, type } }.
 */
function mbReadPackage(file) {
    return file.arrayBuffer().then(function (buf) {
        var files;
        try { files = fflate.unzipSync(new Uint8Array(buf)); }
        catch (e) { throw _mbPkgError('notZip'); }
        if (!files['manifest.json'] || !files['module.json']) throw _mbPkgError('notPackage');
        var manifest, body, proj = null;
        try {
            manifest = _mbPkgParse(files['manifest.json']);
            body = _mbPkgParse(files['module.json']);
            if (files['project.json']) proj = _mbPkgParse(files['project.json']);
        } catch (e) { throw _mbPkgError('broken'); }
        if (manifest.format !== MB_PKG_FORMAT) throw _mbPkgError('notPackage');
        if ((manifest.packageVersion || 0) > MB_PKG_VERSION) throw _mbPkgError('newer');
        if (manifest.kind !== 'module') throw _mbPkgError('notPackage');
        if (!body || !body.module || !body.module.id) throw _mbPkgError('broken');

        var images = {};
        (manifest.images || []).forEach(function (it) {
            var bytes = files[it.path];
            if (bytes && /^[0-9a-f]{64}$/.test(it.h)) images[it.h] = { bytes: bytes, type: it.type || 'image/jpeg' };
        });
        return {
            manifest: manifest,
            card: body.card || manifest.card || {},
            module: body.module,
            forms: body.assessmentForms || {},
            project: proj,
            images: images,
            name: file.name || '',
            size: buf.byteLength
        };
    });
}
