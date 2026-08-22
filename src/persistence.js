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
   Promise-based, because these are the operations that will cross a
   network. */
function mbLoadDoc(key) {
    return new Promise(function (resolve) {
        var raw = mbBackend.get(key);
        if (raw === null) return resolve(null);
        try {
            resolve(JSON.parse(raw));
        } catch (e) {
            /* A corrupt record is not an empty one, and the difference
               matters: silently returning null would let the next save
               overwrite recoverable work. */
            console.error('stored document at "' + key + '" is not valid JSON', e);
            resolve({ __corrupt: true, raw: raw });
        }
    });
}

function mbSaveDoc(key, obj) {
    return new Promise(function (resolve, reject) {
        var json;
        try {
            json = JSON.stringify(obj);
        } catch (e) {
            return reject(new Error('document could not be serialised: ' + e.message));
        }
        if (mbBackend.set(key, json)) resolve({ bytes: json.length });
        else reject(new Error('QUOTA_OR_UNAVAILABLE'));
    });
}

function mbRemoveDoc(key) {
    return Promise.resolve(mbBackend.remove(key));
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
