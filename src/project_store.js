// ============================================================
// /src/project_store.js
// The module library's storage: one IndexedDB record per module.
//
// WHY
// Until 3.11 the whole session — every module, every sheet, every image
// — was one snapshot, rewritten 900 ms after each keystroke. Its cost
// grew with the number of modules: typing in module 3 of 40 rewrote all
// 40. Here a project is split so that a write costs what the OPEN module
// costs, however many modules the project holds:
//
//   projects  { id, name, programId, …, moduleOrder, currentModuleId,
//               moduleIdCounter, loIdCounter }        small, per project
//   shared    { pid, data }    cover, team, intro, references — shared by
//                              every module of the project
//   heads     { pid, mid, skeleton, card, stats }     one per module,
//              light: what the module list and the Task Analysis index
//              need without opening the module
//   modules   { pid, mid, module, assessmentForms, card }  one per
//              module, everything the author wrote in it
//
// Only `heads` is read for the whole project at boot. A `modules` record
// is read when that module is opened and written when it changes.
//
// Every function returns a Promise and resolves `null` (reads) or
// `false` (writes) when IndexedDB is unavailable, so the caller can keep
// working in memory rather than fail.
// ============================================================

var mbStore = (function () {
    'use strict';

    function db() { return (typeof mbIdbOpen === 'function') ? mbIdbOpen() : Promise.resolve(null); }

    /* One transaction, any number of stores. `fn(stores)` issues the
       requests; the promise resolves on COMPLETE (not on the last
       request's success), so a resolved write is a durable write. */
    function tx(names, mode, fn) {
        return db().then(function (d) {
            if (!d) return null;
            return new Promise(function (resolve, reject) {
                var t, out;
                try {
                    t = d.transaction(names, mode);
                    var stores = {};
                    names.forEach(function (n) { stores[n] = t.objectStore(n); });
                    out = fn(stores);
                } catch (e) { return reject(e); }
                t.oncomplete = function () {
                    resolve((typeof IDBRequest !== 'undefined' && out instanceof IDBRequest) ? out.result : out);
                };
                t.onerror = function () { reject(t.error || new Error('IDB transaction failed')); };
                t.onabort = function () { reject(t.error || new Error('IDB transaction aborted')); };
            });
        });
    }

    /* Marks the request whose result tx() hands back. */
    function req(r) { return r; }

    function range(pid) {
        /* Every [pid, mid] key of one project. Module ids are strings, and
           '￿' sorts after any of them. */
        return IDBKeyRange.bound([pid, ''], [pid, '￿']);
    }

    function available() {
        return db().then(function (d) { return !!d; });
    }

    /* ── Projects ─────────────────────────────────────────────── */
    function listProjects() {
        return tx(['projects'], 'readonly', function (s) { return req(s.projects.getAll()); })
            .then(function (r) { return r || []; })
            .catch(function (e) { console.warn('[mbStore] listProjects:', e); return []; });
    }
    function getProject(id) {
        return tx(['projects'], 'readonly', function (s) { return req(s.projects.get(id)); })
            .catch(function () { return null; });
    }
    function putProject(meta) {
        return tx(['projects'], 'readwrite', function (s) { s.projects.put(meta); return true; })
            .then(function (r) { return !!r; });
    }

    /* ── Shared project data ──────────────────────────────────── */
    function getShared(pid) {
        return tx(['shared'], 'readonly', function (s) { return req(s.shared.get(pid)); })
            .then(function (r) { return r ? r.data : null; })
            .catch(function () { return null; });
    }
    /* `images`: the picture ids the shared data points at (the covers),
       so the image collector can see them without reading the data. */
    function putShared(pid, data, images) {
        return tx(['shared'], 'readwrite', function (s) {
            s.shared.put({ pid: pid, data: data, images: images || [] });
            return true;
        }).then(function (r) { return !!r; });
    }
    function getSharedRecord(pid) {
        return tx(['shared'], 'readonly', function (s) { return req(s.shared.get(pid)); })
            .catch(function () { return null; });
    }

    /* ── Images (3.13.0) ──────────────────────────────────────
       One Blob per picture, keyed by the SHA-256 of its bytes, shared by
       every module of every project: the same photograph used in ten
       modules is stored once. */
    function hasImages(hashes) {
        return tx(['images'], 'readonly', function (s) {
            var out = {};
            hashes.forEach(function (h) {
                var r = s.images.getKey(h);
                r.onsuccess = function () { out[h] = r.result !== undefined; };
            });
            return out;
        }).then(function (r) { return r || {}; });
    }
    function putImages(recs) {
        if (!recs.length) return Promise.resolve(true);
        return tx(['images'], 'readwrite', function (s) {
            recs.forEach(function (rec) { s.images.put(rec); });
            return true;
        }).then(function (r) { return !!r; });
    }
    function getImages(hashes) {
        if (!hashes.length) return Promise.resolve({});
        return tx(['images'], 'readonly', function (s) {
            var out = {};
            hashes.forEach(function (h) {
                var r = s.images.get(h);
                r.onsuccess = function () { if (r.result) out[h] = r.result; };
            });
            return out;
        }).then(function (r) { return r || {}; })
          .catch(function (e) { console.warn('[mbStore] getImages:', e); return {}; });
    }
    function imageKeys() {
        return tx(['images'], 'readonly', function (s) { return req(s.images.getAllKeys()); })
            .then(function (r) { return r || []; }).catch(function () { return []; });
    }
    function deleteImages(hashes) {
        if (!hashes.length) return Promise.resolve(true);
        return tx(['images'], 'readwrite', function (s) {
            hashes.forEach(function (h) { s.images.delete(h); });
            return true;
        }).then(function (r) { return !!r; });
    }
    /** Every picture id any module or shared record of ANY project points
     *  at — read from the light records only. */
    function liveImageIds() {
        return tx(['heads', 'shared'], 'readonly', function (s) {
            var live = {};
            var a = s.heads.openCursor(), b = s.shared.openCursor();
            a.onsuccess = function () {
                var c = a.result; if (!c) return;
                (c.value.images || []).forEach(function (h) { live[h] = true; });
                c.continue();
            };
            b.onsuccess = function () {
                var c = b.result; if (!c) return;
                (c.value.images || []).forEach(function (h) { live[h] = true; });
                c.continue();
            };
            return live;
        }).then(function (r) { return r || {}; });
    }
    /** Heads of every project — for the one-time image migration. */
    function allHeads() {
        return tx(['heads'], 'readonly', function (s) { return req(s.heads.getAll()); })
            .then(function (r) { return r || []; }).catch(function () { return []; });
    }
    function allShared() {
        return tx(['shared'], 'readonly', function (s) { return req(s.shared.getAll()); })
            .then(function (r) { return r || []; }).catch(function () { return []; });
    }

    /* ── Modules ──────────────────────────────────────────────── */
    function getHeads(pid) {
        return tx(['heads'], 'readonly', function (s) { return req(s.heads.getAll(range(pid))); })
            .then(function (r) { return r || []; })
            .catch(function (e) { console.warn('[mbStore] getHeads:', e); return []; });
    }
    function getHead(pid, mid) {
        return tx(['heads'], 'readonly', function (s) { return req(s.heads.get([pid, mid])); })
            .catch(function () { return null; });
    }
    function getModule(pid, mid) {
        return tx(['modules'], 'readonly', function (s) { return req(s.modules.get([pid, mid])); })
            .catch(function (e) { console.warn('[mbStore] getModule:', e); return null; });
    }
    /** Head and body in ONE transaction: the list can never describe a
     *  module that was not written, or miss one that was. */
    function putModule(head, body) {
        return tx(['heads', 'modules'], 'readwrite', function (s) {
            s.heads.put(head);
            if (body) s.modules.put(body);
            return true;
        }).then(function (r) { return !!r; });
    }
    function deleteModule(pid, mid) {
        return tx(['heads', 'modules'], 'readwrite', function (s) {
            s.heads.delete([pid, mid]);
            s.modules.delete([pid, mid]);
            return true;
        }).then(function (r) { return !!r; });
    }
    /** Everything a project owns. */
    function deleteProject(pid) {
        return tx(['projects', 'shared', 'heads', 'modules'], 'readwrite', function (s) {
            s.projects.delete(pid);
            s.shared.delete(pid);
            s.heads.delete(range(pid));
            s.modules.delete(range(pid));
            return true;
        }).then(function (r) { return !!r; });
    }
    /** Modules only — the project record and its shared data stay. */
    function clearModules(pid) {
        return tx(['heads', 'modules'], 'readwrite', function (s) {
            s.heads.delete(range(pid));
            s.modules.delete(range(pid));
            return true;
        }).then(function (r) { return !!r; });
    }

    return {
        available: available,
        listProjects: listProjects, getProject: getProject, putProject: putProject,
        getShared: getShared, putShared: putShared, getSharedRecord: getSharedRecord,
        hasImages: hasImages, putImages: putImages, getImages: getImages,
        imageKeys: imageKeys, deleteImages: deleteImages, liveImageIds: liveImageIds,
        allHeads: allHeads, allShared: allShared,
        getHeads: getHeads, getHead: getHead, getModule: getModule,
        putModule: putModule, deleteModule: deleteModule,
        deleteProject: deleteProject, clearModules: clearModules
    };
})();
