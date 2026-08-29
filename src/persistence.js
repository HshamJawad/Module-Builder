// ============================================================
// /src/persistence.js
// The only module that talks to a storage backend.
//
// WHY THIS EXISTS
// `localStorage` was reached directly from four modules. Each call site
// is a place where the tool assumes storage is synchronous, local,
// unlimited, always available, and private to one person. None of those
// hold once this runs against a server, and three of them do not hold
// today: Safari in private mode throws on write, the quota is ~5 MB, and
// the quota is where this tool actually breaks — a module with a dozen
// base64 cover images passes it easily.
//
// Everything goes through here instead. The interface is deliberately
// PROMISE-BASED even though the current backend is synchronous: a
// network backend cannot be synchronous, and retrofitting async into
// callers later means auditing them all a second time. That audit was
// already done once for the dialog conversion; doing it once more for
// storage is avoidable, so it is avoided.
//
// TWO BACKENDS, ONE INTERFACE
// Settings stay in localStorage; documents moved to IndexedDB. That
// split is not a compromise, it is the shape of the problem. A language
// choice is read DURING the first paint and must answer synchronously,
// or the interface renders in the wrong language and then flips. A
// project record is megabytes, is read once, and has nowhere to live in
// a 5 MB quota. IndexedDB answers the second and cannot answer the
// first — it has no synchronous read at all.
//
// The document API did not change shape: it was written Promise-based
// from the start precisely so this day would cost nothing above it. One
// call site had to be converted, and the old comment on it named it in
// advance — autosave's tryRestore.
//
// NAMESPACING
// Keys are grouped by owner, and one of them is deliberately NOT
// namespaced: `dacum_lang` is shared with DACUM Live Pro so a person
// moving between the two tools in one session does not set the language
// twice. That sharing is a feature and it is why a blanket `mb_` prefix
// would be wrong.
// ============================================================

var MB_KEYS = {
    autosave:    'module_builder_autosave',
    contentLang: 'mb_content_lang',
    exportLang:  'mb_export_lang',
    i18nDebug:   'mb_i18n_debug',
    /* Word export appearance: sizes and colours of the .docx only.
       One key for the whole tool — not per project and not per
       language, because a team's documents should look alike whichever
       side they were written on. Owned by word_settings.js. */
    wordExport:  'mb_word_export_settings',
    /* Last captured error, written by error-handler2.js. Registered here
       so the key is visible in one place with the rest; that file loads
       before this one and falls back to the literal if MB_KEYS is not
       up yet, because an error report must not depend on load order. */
    lastError:   'app_last_error',
    /* Sidebar fold state, written by the inline script at the foot of
       index.html. That script runs on DOMContentLoaded, before this file
       is parsed, so it resolves the key at call time and falls back to
       the literal — registered here so MB_KEYS remains a complete list
       of what the tool writes. */
    navCollapsed: 'mb_nav_collapsed',
    /* Cross-tool. Not prefixed on purpose — see header. */
    uiLang:      'dacum_lang',
    dacumImport: 'dacum_modules_export'
};

/* ── Backend ────────────────────────────────────────────────
   One object to replace when this moves to a server. Nothing outside
   this file names localStorage. */
var mbBackend = {
    available: (function () {
        /* Feature-detected by USE, not by presence. Safari in private
           mode exposes localStorage and throws on the first write, so
           `typeof localStorage !== 'undefined'` is not an answer. */
        try {
            var k = '__mb_probe__';
            localStorage.setItem(k, '1');
            localStorage.removeItem(k);
            return true;
        } catch (e) {
            return false;
        }
    })(),

    get: function (key) {
        if (!this.available) return null;
        try { return localStorage.getItem(key); } catch (e) { return null; }
    },
    set: function (key, value) {
        if (!this.available) return false;
        try { localStorage.setItem(key, value); return true; }
        catch (e) {
            /* Quota is the expected failure, not an exotic one. The
               caller is told, and decides — autosave degrades quietly,
               a deliberate save must not. */
            console.warn('storage write failed for "' + key + '":', e && e.name);
            return false;
        }
    },
    remove: function (key) {
        if (!this.available) return false;
        try { localStorage.removeItem(key); return true; } catch (e) { return false; }
    }
};

/* ── IndexedDB backend, for documents only ──────────────────
   Three things make this more than a wrapper:

   1. OPENING CAN HANG. Safari in private mode, and Firefox with
      cookies blocked, neither resolve nor reject indexedDB.open().
      Awaiting it forever means the tool never boots. It is raced
      against a timeout and the localStorage backend is used instead.
   2. NO JSON. Values go in through structured clone, so a project
      never becomes a megabytes-long string on the main thread. That
      cost was the freeze on every autosave, not the write itself.
   3. MIGRATION IS ONE-WAY AND LAZY. The first successful open moves
      any autosave sitting in localStorage across, then deletes it —
      so the ~5 MB it was occupying is returned, and a user who opens
      an older build afterwards simply finds no autosave rather than a
      corrupt one. */

var MB_IDB_NAME    = 'module_builder';
var MB_IDB_VERSION = 1;
var MB_IDB_STORE   = 'docs';
var MB_IDB_OPEN_TIMEOUT = 3000;

var _mbIdbPromise = null;

function mbIdbOpen() {
    if (_mbIdbPromise) return _mbIdbPromise;

    _mbIdbPromise = new Promise(function (resolve) {
        if (typeof indexedDB === 'undefined' || !indexedDB) return resolve(null);

        var settled = false;
        var finish = function (db) {
            if (settled) return;
            settled = true;
            resolve(db);
        };

        /* The timeout IS the feature — see note 1 above. */
        setTimeout(function () {
            if (!settled) console.warn('[Storage] IndexedDB did not open in time; using localStorage');
            finish(null);
        }, MB_IDB_OPEN_TIMEOUT);

        var req;
        try {
            req = indexedDB.open(MB_IDB_NAME, MB_IDB_VERSION);
        } catch (e) {
            return finish(null);
        }

        req.onupgradeneeded = function () {
            var db = req.result;
            if (!db.objectStoreNames.contains(MB_IDB_STORE)) db.createObjectStore(MB_IDB_STORE);
        };
        req.onsuccess = function () {
            var db = req.result;
            /* A version change from another tab: close, or that tab
               blocks forever on its upgrade. */
            db.onversionchange = function () { db.close(); _mbIdbPromise = null; };
            finish(db);
        };
        req.onerror = function () {
            console.warn('[Storage] IndexedDB unavailable:', req.error && req.error.name);
            finish(null);
        };
        req.onblocked = function () { finish(null); };
    }).then(function (db) {
        if (db) mbIdbMigrateFromLocal(db);
        return db;
    });

    return _mbIdbPromise;
}

function _mbIdbRun(db, mode, fn) {
    return new Promise(function (resolve, reject) {
        var tx, store;
        try {
            tx = db.transaction(MB_IDB_STORE, mode);
            store = tx.objectStore(MB_IDB_STORE);
        } catch (e) { return reject(e); }

        var req;
        try { req = fn(store); } catch (e) { return reject(e); }

        req.onsuccess = function () { resolve(req.result); };
        req.onerror   = function () { reject(req.error || new Error('IDB request failed')); };
        /* QuotaExceeded surfaces on the TRANSACTION, not the request. */
        tx.onabort    = function () { reject(tx.error || new Error('IDB transaction aborted')); };
    });
}

/**
 * Move an autosave written by an older build into IndexedDB, once.
 *
 * Deliberately fire-and-forget: a failure here must not delay boot, and
 * the worst case is that the localStorage copy stays where it is and
 * keeps being read by the fallback path below.
 */
function mbIdbMigrateFromLocal(db) {
    if (!mbBackend.available) return;
    var raw;
    try { raw = localStorage.getItem(MB_KEYS.autosave); } catch (e) { return; }
    if (raw === null) return;

    var obj;
    try { obj = JSON.parse(raw); } catch (e) {
        /* Unparseable: leave it alone. mbLoadDoc reports corruption
           rather than deleting work nobody has looked at yet. */
        return;
    }
    _mbIdbRun(db, 'readwrite', function (store) { return store.put(obj, MB_KEYS.autosave); })
        .then(function () {
            try { localStorage.removeItem(MB_KEYS.autosave); } catch (e) {}
            console.info('[Storage] autosave migrated to IndexedDB (' +
                         Math.round(raw.length / 1024) + ' KB freed from localStorage)');
        })
        .catch(function (e) { console.warn('[Storage] migration failed:', e && e.name); });
}

/* ── Small synchronous settings ─────────────────────────────
   Language choices and debug flags. Kept synchronous on purpose: they
   are read during render, and making them async would mean the first
   paint happens before the language is known — a visible flash of the
   wrong language on every load. When this moves to a server these stay
   local; a UI preference does not belong in a project record anyway. */
function mbGetSetting(key, fallback) {
    var v = mbBackend.get(key);
    return v === null ? (fallback === undefined ? null : fallback) : v;
}
function mbSetSetting(key, value) {
    return mbBackend.set(key, String(value));
}
function mbRemoveSetting(key) {
    return mbBackend.remove(key);
}

/* ── Project documents ──────────────────────────────────────
   IndexedDB when it opens, localStorage when it does not. Both paths
   are live in the same session: a browser that refuses IndexedDB is not
   a browser that should lose autosave. */

function mbLoadDoc(key) {
    return mbIdbOpen().then(function (db) {
        if (!db) return null;
        return _mbIdbRun(db, 'readonly', function (store) { return store.get(key); })
            .catch(function (e) {
                console.warn('[Storage] read failed for "' + key + '":', e && e.name);
                return null;
            });
    }).then(function (fromIdb) {
        /* undefined means "no such key"; null is a stored null. Only the
           first should fall through to the legacy backend. */
        if (fromIdb !== undefined && fromIdb !== null) return fromIdb;

        var raw = mbBackend.get(key);
        if (raw === null) return null;
        try {
            return JSON.parse(raw);
        } catch (e) {
            /* A corrupt record is not an empty one, and the difference
               matters: silently returning null would let the next save
               overwrite recoverable work. */
            console.error('stored document at "' + key + '" is not valid JSON', e);
            return { __corrupt: true, raw: raw };
        }
    });
}

function mbSaveDoc(key, obj) {
    return mbIdbOpen().then(function (db) {
        if (!db) return _mbSaveDocLocal(key, obj);

        return _mbIdbRun(db, 'readwrite', function (store) { return store.put(obj, key); })
            .then(function () { return { backend: 'indexeddb' }; })
            .catch(function (e) {
                /* Structured clone rejects functions, DOM nodes and
                   cycles. That is a bug in what was passed, not a
                   storage failure, and the JSON path would reject it
                   too — so it is reported rather than silently retried
                   into a backend that will also fail. */
                console.warn('[Storage] IndexedDB write failed for "' + key + '":', e && e.name);
                return _mbSaveDocLocal(key, obj);
            });
    });
}

/* The original localStorage path, unchanged, now a fallback. */
function _mbSaveDocLocal(key, obj) {
    var json;
    try {
        json = JSON.stringify(obj);
    } catch (e) {
        return Promise.reject(new Error('document could not be serialised: ' + e.message));
    }
    if (mbBackend.set(key, json)) return Promise.resolve({ bytes: json.length, backend: 'localstorage' });
    return Promise.reject(new Error('QUOTA_OR_UNAVAILABLE'));
}

function mbRemoveDoc(key) {
    /* Both backends: a key may exist in either after a partial
       migration, and a delete that leaves one copy behind would
       resurrect the document on the next load. */
    mbBackend.remove(key);
    return mbIdbOpen().then(function (db) {
        if (!db) return true;
        return _mbIdbRun(db, 'readwrite', function (store) { return store.delete(key); })
            .then(function () { return true; })
            .catch(function () { return false; });
    });
}

/**
 * How much room is actually left, asked of the browser.
 *
 * navigator.storage.estimate() reports the whole origin — IndexedDB,
 * Cache Storage and localStorage together — and the quota it returns is
 * typically a percentage of free disk, in gigabytes. That is the number
 * that replaced the 5 MB wall, and it is worth showing the user when a
 * module gets big.
 */
function mbStorageEstimate() {
    if (!navigator.storage || !navigator.storage.estimate) {
        return Promise.resolve({ usage: mbStorageBytes(), quota: 5 * 1024 * 1024, exact: false });
    }
    return navigator.storage.estimate().then(function (e) {
        return { usage: e.usage || 0, quota: e.quota || 0, exact: true };
    }).catch(function () {
        return { usage: mbStorageBytes(), quota: 5 * 1024 * 1024, exact: false };
    });
}

/**
 * Rough size of what is stored, for the quota warning.
 * Approximate by design — an exact figure would mean serialising
 * everything again on a timer.
 */
function mbStorageBytes() {
    if (!mbBackend.available) return 0;
    var total = 0;
    try {
        for (var i = 0; i < localStorage.length; i++) {
            var k = localStorage.key(i);
            var v = localStorage.getItem(k);
            total += (k.length + (v ? v.length : 0)) * 2;   // UTF-16
        }
    } catch (e) { /* nothing useful to do */ }
    return total;
}
