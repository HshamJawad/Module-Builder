// ============================================================
// /src/folder_sync.js
// 📁 A folder on this computer that always holds every module (3.15.0).
//
// The library lives in the browser. A browser can lose it — site data
// cleared, a profile reset, a new computer — and until now the only copy
// outside it was whatever .mbz the author last remembered to download.
//
// With a folder linked to a project (Chrome and Edge on a computer:
// File System Access API), the tool writes ONE .mbz PER MODULE into it,
// by itself, a few seconds after each change to that module. The same
// file is rewritten each time — no "module (1).mbz", no download bar —
// so the folder is always an up-to-date copy of the project. A folder
// that OneDrive, Google Drive or Dropbox synchronises becomes a shared
// one: colleagues' modules arrive in it, and "Import from folder" brings
// them in.
//
//   file name   <code>_<title>.mbz — stable, so a module keeps its file;
//               renamed when the title or code changes
//   a module deleted in the tool → its file is MOVED to _deleted/, never
//               erased: the folder is a backup, and a backup that obeys a
//               mistaken "Clear All" is no backup
//   cover, references, team → written with the next module that changes
//               (each package carries them); "Write all now" refreshes
//               every file at once
//
// Permission: the browser remembers the folder but asks again, once per
// session, before the tool may write to it. Until the author clicks
// "Allow", changes wait and are written the moment access is given.
//
// One folder per project. A read-only tab (tab_guard.js) never writes.
// Each file written counts as a backup (module_library.js markers).
// ============================================================

var mbFolderSync = (function () {
    'use strict';

    var supported = typeof window.showDirectoryPicker === 'function';
    var st = {
        pid: null,
        rec: null,          // { handle, name, files: { mid: { name, rev, at } } }
        perm: 'none',       // none | granted | prompt | denied
        queue: new Set(),
        busy: false,
        writing: null,      // label of the file being written
        lastAt: null,
        error: null
    };
    var timer = null;
    var DELAY = 2500;

    function key(pid) { return 'folder:' + pid; }
    function emit() { window.dispatchEvent(new CustomEvent('mb:folderchanged')); }
    function t(k, v) { return v ? window.i18n.tf(k, v) : window.i18n.t(k); }

    function stem(card, mid) {
        var parts = [card && card.moduleCode, card && card.moduleTitle].filter(function (x) { return x && String(x).trim(); });
        var s = parts.join('_').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '').replace(/\s+/g, '_').replace(/^\.+/, '').slice(0, 100);
        return s || String(mid);
    }

    function saveRec() {
        if (!st.rec || !st.pid) return Promise.resolve();
        return mbSaveDoc(key(st.pid), st.rec).catch(function (e) { console.warn('[Folder] state not saved:', e); });
    }

    function checkPerm() {
        if (!st.rec || !st.rec.handle) { st.perm = 'none'; return Promise.resolve(st.perm); }
        var h = st.rec.handle;
        if (typeof h.queryPermission !== 'function') { st.perm = 'granted'; return Promise.resolve(st.perm); }
        return h.queryPermission({ mode: 'readwrite' }).then(function (p) { st.perm = p; return p; })
            .catch(function () { st.perm = 'prompt'; return st.perm; });
    }

    /** The open project changed: read its folder link. */
    function load(pid) {
        st.pid = pid; st.rec = null; st.perm = 'none'; st.queue.clear(); st.error = null; st.lastAt = null;
        if (!pid || !window.mbLib || !mbLib.enabled) { emit(); return Promise.resolve(null); }
        return mbLoadDoc(key(pid)).then(function (rec) {
            if (st.pid !== pid) return null;
            st.rec = (rec && rec.handle) ? rec : null;
            if (st.rec && !st.rec.files) st.rec.files = {};
            return checkPerm();
        }).then(function () {
            emit();
            if (st.rec && st.perm === 'granted') return syncStale();
            return null;
        }).catch(function (e) { console.warn('[Folder] load:', e); emit(); });
    }

    /* ── Linking ──────────────────────────────────────────────── */
    /** "Choose a folder" — needs the click that called it. */
    function link() {
        if (!supported || !window.mbLib || !mbLib.project) return Promise.resolve(false);
        if (mbLib.readOnly) { mbIsReadOnly(); return Promise.resolve(false); }
        return window.showDirectoryPicker({ mode: 'readwrite', id: 'mb-folder' })
            .then(linkHandle)
            .catch(function (e) {
                if (e && e.name === 'AbortError') return false;     // the user closed the picker
                console.warn('[Folder] link failed:', e);
                showStatus(t('mbFldError', { v0: (e && e.message) || e }), 'error');
                return false;
            });
    }

    /** Link a directory handle to the open project and write everything. */
    function linkHandle(handle) {
        st.pid = mbLib.project.id;
        st.rec = { handle: handle, name: handle.name || '', files: {}, linkedAt: new Date().toISOString() };
        st.error = null;
        return saveRec().then(checkPerm).then(function (p) {
            if (p !== 'granted' && typeof handle.requestPermission === 'function') {
                return handle.requestPermission({ mode: 'readwrite' }).then(function (q) { st.perm = q; });
            }
        }).then(function () {
            emit();
            showStatus(t('mbFldLinked', { v0: st.rec.name }), 'success');
            return writeAll();
        }).then(function () { return true; });
    }

    function unlink() {
        if (!st.rec) return Promise.resolve();
        var name = st.rec.name;
        st.rec = null; st.perm = 'none'; st.queue.clear();
        return mbRemoveDoc(key(st.pid)).then(function () {
            emit();
            showStatus(t('mbFldUnlinked', { v0: name }), 'success');
        });
    }

    /** "Allow" — the browser's permission prompt, on a click. */
    function allow() {
        if (!st.rec || typeof st.rec.handle.requestPermission !== 'function') return Promise.resolve(st.perm);
        return st.rec.handle.requestPermission({ mode: 'readwrite' }).then(function (p) {
            st.perm = p;
            emit();
            if (p === 'granted') return syncStale().then(function () { return p; });
            return p;
        }).catch(function () { return st.perm; });
    }

    /* ── Writing ──────────────────────────────────────────────── */
    /** A module of the open project changed (or was deleted). */
    function queue(mid) {
        if (!st.rec || !window.mbLib || !mbLib.project || mbLib.project.id !== st.pid) return;
        st.queue.add(mid);
        clearTimeout(timer);
        timer = setTimeout(flush, DELAY);
        emit();
    }

    function flush() {
        clearTimeout(timer);
        if (st.busy || !st.rec) return Promise.resolve();
        if (mbLib.readOnly) return Promise.resolve();
        if (st.perm !== 'granted') { emit(); return Promise.resolve(); }
        st.busy = true;
        var pid = st.pid;
        var next = function () {
            if (!st.rec || st.pid !== pid || mbLib.readOnly) return Promise.resolve();
            var it = st.queue.values().next();
            if (it.done) return Promise.resolve();
            var mid = it.value;
            st.queue.delete(mid);
            return writeOne(mid).then(next, function (e) {
                console.warn('[Folder] write failed:', mid, e);
                st.error = (e && e.message) || String(e);
                /* Permission withdrawn, folder moved or deleted: stop and
                   say so; the module is kept in the queue for "Retry". */
                st.queue.add(mid);
                if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) st.perm = 'prompt';
                emit();
            });
        };
        return next().then(function () {
            st.busy = false;
            st.writing = null;
            emit();
            if (st.queue.size && !st.error && st.perm === 'granted') timer = setTimeout(flush, DELAY);
        });
    }

    function writeFile(dir, name, blob) {
        return dir.getFileHandle(name, { create: true }).then(function (fh) {
            return fh.createWritable();
        }).then(function (w) {
            return w.write(blob).then(function () { return w.close(); });
        });
    }

    /** Move a file into _deleted/ — the folder is a backup, nothing in it
     *  is ever erased by the tool. */
    function retire(name) {
        var dir = st.rec.handle;
        return dir.getFileHandle(name).then(function (fh) {
            return fh.getFile();
        }).then(function (file) {
            return dir.getDirectoryHandle('_deleted', { create: true }).then(function (bin) {
                var stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
                return writeFile(bin, name.replace(/\.mbz$/i, '') + '_' + stamp + '.mbz', file);
            });
        }).then(function () {
            return dir.removeEntry(name);
        }).catch(function (e) {
            if (e && e.name === 'NotFoundError') return null;      // already gone
            throw e;
        });
    }

    /* An untouched default module ("Module 1" of a new or cleared
       project) is not written: an empty file is noise in a backup, and
       the module disappears as soon as real modules arrive. */
    function placeholder(head) {
        return !!(head && head.stats && head.stats.skeleton && !head.fromDacum);
    }

    function writeOne(mid, force) {
        var head = mbLib.heads[mid];
        var known = st.rec.files[mid];
        if (head && !force && !known && placeholder(head)) return Promise.resolve();
        if (!head) {
            /* Deleted from the project. */
            if (!known) return Promise.resolve();
            st.writing = known.name;
            emit();
            return retire(known.name).then(function () {
                delete st.rec.files[mid];
                return saveRec();
            });
        }
        var name = stem(head.card, mid) + '.mbz';
        /* Two modules with the same code and title (a kept copy): the
           second one gets its id appended. */
        var taken = Object.keys(st.rec.files).some(function (m) { return m !== mid && st.rec.files[m].name === name; });
        if (taken) name = stem(head.card, mid) + '_' + String(mid).replace(/[^A-Za-z0-9_-]+/g, '').slice(-8) + '.mbz';
        st.writing = name;
        emit();
        return mbBuildModulePackage(mid).then(function (p) {
            return writeFile(st.rec.handle, name, p.blob);
        }).then(function () {
            var old = known && known.name !== name ? known.name : null;
            st.rec.files[mid] = { name: name, rev: (head.card && head.card.revision) || 0, at: new Date().toISOString() };
            st.lastAt = st.rec.files[mid].at;
            st.error = null;
            return (old ? st.rec.handle.removeEntry(old).catch(function () {}) : Promise.resolve())
                .then(saveRec)
                .then(function () { return mbLibraryMarkBackedUp(st.pid, [mid]); });
        });
    }

    /** Write whatever the folder does not have yet: modules changed since
     *  their file was written, and files of modules deleted meanwhile. */
    function syncStale() {
        if (!st.rec || !window.mbLib) return Promise.resolve();
        (mbState.modulesData || []).forEach(function (m) {
            var h = mbLib.heads[m.id], f = st.rec.files[m.id];
            if (h && !(placeholder(h) && !f) && (!f || (h.card && (h.card.revision || 0) !== f.rev))) st.queue.add(m.id);
        });
        Object.keys(st.rec.files).forEach(function (mid) { if (!mbLib.heads[mid]) st.queue.add(mid); });
        emit();
        return st.queue.size ? flush() : Promise.resolve();
    }

    /** "Write all now": every module of the project, whatever its state —
     *  also refreshes the cover and references every file carries. */
    function writeAll() {
        if (!st.rec) return Promise.resolve();
        (mbState.modulesData || []).forEach(function (m) { st.queue.add(m.id); });
        Object.keys(st.rec.files).forEach(function (mid) { if (!mbLib.heads[mid]) st.queue.add(mid); });
        st.error = null;
        return flush().then(function () {
            if (!st.error && st.perm === 'granted') showStatus(t('mbFldAllWritten', { v0: Object.keys(st.rec.files).length, v1: st.rec.name }), 'success');
        });
    }

    /** "Import from folder": every .mbz in the folder (not in _deleted/). */
    function importFromFolder() {
        if (!st.rec) return Promise.resolve(null);
        var go = st.perm === 'granted' ? Promise.resolve('granted') : allow();
        return go.then(function (p) {
            if (p !== 'granted') return null;
            var files = [];
            var it = st.rec.handle.values();
            var step = function () {
                return it.next().then(function (r) {
                    if (r.done) return null;
                    var h = r.value;
                    if (h.kind === 'file' && /\.mbz$/i.test(h.name)) {
                        return h.getFile().then(function (f) { files.push(f); return step(); });
                    }
                    return step();
                });
            };
            return step().then(function () {
                if (!files.length) { showStatus(t('mbFldNoFiles', { v0: st.rec.name }), 'error'); return null; }
                return mbImportPackages(files);
            });
        });
    }

    function retry() { st.error = null; return syncStale(); }

    /** 💾 with a folder linked: write the module's file NOW (the same
     *  file autosave keeps up to date) and say where. Asks for the
     *  permission first when the browser needs it — 💾 is a click, so it
     *  may. Resolves the file name, or null when it could not write. */
    function writeNow(mid) {
        if (!st.rec || mbLib.readOnly) return Promise.resolve(null);
        var ready = st.perm === 'granted' ? Promise.resolve('granted') : allow();
        return ready.then(function (p) {
            if (p !== 'granted') return null;
            var wait = function () {
                return st.busy ? new Promise(function (r) { setTimeout(r, 120); }).then(wait) : Promise.resolve();
            };
            return wait().then(function () {
                st.busy = true;
                st.queue.delete(mid);
                return writeOne(mid, true).then(function () {
                    st.busy = false; st.writing = null; st.error = null; emit();
                    return st.rec.files[mid] ? st.rec.files[mid].name : null;
                }, function (e) {
                    st.busy = false; st.writing = null; st.error = (e && e.message) || String(e); emit();
                    return null;
                });
            });
        });
    }

    /* ── The permission bar ───────────────────────────────────────
       The browser forgets the permission between sessions. Writes then
       wait — and an author who never opens the panel would never know
       the backup had stopped. So a bar says so, with the one click the
       browser needs. */
    var bar = null, dismissed = false;
    function paintBar() {
        var need = !!st.rec && st.perm !== 'granted' && !dismissed && !(window.mbLib && mbLib.readOnly);
        if (!need) { if (bar) bar.hidden = true; return; }
        if (!bar) {
            bar = document.createElement('div');
            bar.className = 'mb-fld-bar';
            bar.setAttribute('role', 'status');
            document.body.appendChild(bar);
            bar.addEventListener('click', function (e) {
                var b = e.target.closest('[data-fb]');
                if (!b) return;
                if (b.getAttribute('data-fb') === 'allow') allow();
                else { dismissed = true; paintBar(); }
            });
        }
        bar.hidden = false;
        bar.innerHTML = '<span>📁 ' + t('mbFldBar', { v0: st.rec.name }) + '</span>' +
            '<button type="button" data-fb="allow">' + t('mbFldAllow') + '</button>' +
            '<button type="button" data-fb="later" aria-label="' + t('dgDismiss') + '">✕</button>';
    }
    window.addEventListener('mb:folderchanged', paintBar);
    window.addEventListener('mb:langchange', paintBar);

    /** Leaving the page: whatever is queued goes out now. */
    window.addEventListener('pagehide', function () { if (st.queue.size) flush(); });

    return {
        supported: supported,
        state: function () {
            return { linked: !!st.rec, name: st.rec ? st.rec.name : '', perm: st.perm, pending: st.queue.size,
                     busy: st.busy, writing: st.writing, lastAt: st.lastAt, error: st.error,
                     files: st.rec ? Object.keys(st.rec.files).length : 0 };
        },
        load: load, link: link, linkHandle: linkHandle, unlink: unlink, allow: allow,
        queue: queue, flush: flush, syncStale: syncStale, writeAll: writeAll,
        importFromFolder: importFromFolder, retry: retry, writeNow: writeNow,
        stem: stem
    };
})();
