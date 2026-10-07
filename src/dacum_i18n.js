// ============================================================
// /src/dacum_i18n.js
// Translations that arrive with a DACUM Live Pro handoff (3.16.0).
//
// DACUM Live Pro 3.79+ keeps a project in several content languages
// (its original and AI translations of it). What it hands over — module
// titles, outcome statements, performance criteria, Task Analysis,
// curriculum — is written in the language DACUM was SHOWING, as plain
// strings. Alongside, the handoff now carries `contentLanguages`:
//
//   { v: 1, original: 'en', shown: 'en',
//     tables: [ { lang: 'ar', pairs: [[shownText, arabicText], …] },
//               { lang: 'fr', pairs: [ … ] } ] }
//
// Each module keeps that record (module.dacumI18n). The DACUM strings
// themselves are NOT rewritten: every reader of a module goes on seeing
// the same plain strings it always did. The translation is applied when
// a text is SHOWN or EXPORTED in another language:
//
//   • exports — once, right after biFlattenDeep() (exports_docx.js,
//     module_model.js): every string of the flattened state that is a
//     DACUM text gets its version in the export language;
//   • the outcome list, the criteria list and the AI card, in the
//     content language being edited.
//
// A text without a translation stays as it came — exactly what happened
// before this file existed. The record is shaped so that biIs() never
// takes it for a { en, ar, fr } value (no object in it has such keys).
// ============================================================

/* A list item keeps its bullet or number ("2. Wear PPE"); DACUM
   translates the text after it. Same pattern as DACUM's content_lang.js. */
var MB_DI18N_PREFIX = /^(\s*(?:[•\-*○●▪◦·]\s*)?(?:\d+[.)]\s*)?)/;

/* Keys whose values are ids, codes or numbers — never content. */
var MB_DI18N_SKIP = {
    id: 1, moduleId: 1, loId: 1, dacumLoId: 1, taskId: 1, sourceTaskIds: 1,
    moduleCode: 1, shortName: 1, moduleNumber: 1, number: 1, track: 1,
    taskCode: 1, code: 1, source: 1, dacumI18n: 1, labelMode: 1
};

/** The record to keep on a module, from a handoff (or null). */
function mbDacumI18nFrom(exportData) {
    var cl = exportData && exportData.contentLanguages;
    if (!cl || typeof cl !== 'object' || !Array.isArray(cl.tables)) return null;
    var tables = cl.tables.filter(function (t) {
        return t && typeof t.lang === 'string' && Array.isArray(t.pairs) && t.pairs.length;
    }).map(function (t) {
        return { lang: t.lang, pairs: t.pairs.filter(function (p) {
            return Array.isArray(p) && typeof p[0] === 'string' && typeof p[1] === 'string';
        }) };
    });
    if (!tables.length) return null;
    return { v: 1, original: String(cl.original || ''), shown: String(cl.shown || ''), tables: tables };
}

/** shown text → text in `lang`, from every module of `modules`. */
function _mbDacumMap(modules, lang) {
    var map = new Map();
    (Array.isArray(modules) ? modules : []).forEach(function (m) {
        var r = m && m.dacumI18n;
        if (!r || !Array.isArray(r.tables) || r.shown === lang) return;
        r.tables.forEach(function (t) {
            if (t.lang !== lang) return;
            t.pairs.forEach(function (p) { if (!map.has(p[0])) map.set(p[0], p[1]); });
        });
    });
    return map;
}

function _mbDacumStr(v, map) {
    if (!v || !map.size) return v;
    if (map.has(v)) return map.get(v);
    var m = MB_DI18N_PREFIX.exec(v);
    var p = m ? m[1] : '';
    var rest = v.slice(p.length);
    var tail = /\s*$/.exec(rest)[0];
    var core = rest.slice(0, rest.length - tail.length);
    if (map.has(core)) return p + map.get(core) + tail;
    /* "LO1: <statement>" — the outcome title Module Builder builds. */
    var lab = /^([^\s:]{1,12}:\s+)([\s\S]+)$/.exec(v);
    if (lab && map.has(lab[2])) return lab[1] + map.get(lab[2]);
    if (v.indexOf('\n') !== -1) {
        var ch = false;
        var out = v.split('\n').map(function (l) { var r = _mbDacumStr(l, map); if (r !== l) ch = true; return r; });
        return ch ? out.join('\n') : v;
    }
    return v;
}

function _mbDacumWalk(node, map, key) {
    if (key && MB_DI18N_SKIP[key]) return node;
    if (typeof node === 'string') return _mbDacumStr(node, map);
    if (Array.isArray(node)) {
        for (var i = 0; i < node.length; i++) node[i] = _mbDacumWalk(node[i], map, null);
        return node;
    }
    if (node && typeof node === 'object') {
        Object.keys(node).forEach(function (k) { node[k] = _mbDacumWalk(node[k], map, k); });
    }
    return node;
}

/**
 * Put DACUM texts of an ALREADY FLATTENED state copy into `lang`.
 * Mutates and returns `st` (it is the private copy biFlattenDeep made).
 */
function mbLocalizeDacum(st, lang) {
    if (!st || typeof st !== 'object') return st;
    var map = _mbDacumMap(st.modulesData, lang);
    if (!map.size) return st;
    return _mbDacumWalk(st, map, null);
}

/** One DACUM text in `lang` (default: the content language being
 *  edited), using the modules currently held. */
function mbDacumText(text, lang) {
    if (typeof text !== 'string' || !text) return text;
    var l = lang || ((typeof contentLang === 'function') ? contentLang() : 'en');
    var st = (typeof window !== 'undefined' && window.mbState) || null;
    var map = _mbDacumMap(st && st.modulesData, l);
    return map.size ? _mbDacumStr(text, map) : text;
}
