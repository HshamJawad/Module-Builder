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
    taskCode: 1, code: 1, source: 1, dacumI18n: 1, labelMode: 1,
    mbI18n: 1, dacumLang: 1
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

/** shown text → text in `lang`, from every module of `modules`.
 *  3.34.0: then the translations made here (module.mbI18n — "✨
 *  Translate" in the suggested-content panels), for texts DACUM did not
 *  translate. DACUM's own come first. */
function _mbDacumMap(modules, lang) {
    var map = new Map();
    var list = Array.isArray(modules) ? modules : [];
    list.forEach(function (m) {
        var r = m && m.dacumI18n;
        if (!r || !Array.isArray(r.tables) || r.shown === lang) return;
        r.tables.forEach(function (t) {
            if (t.lang !== lang) return;
            t.pairs.forEach(function (p) { if (!map.has(p[0])) map.set(p[0], p[1]); });
        });
    });
    list.forEach(function (m) {
        var own = m && m.mbI18n && m.mbI18n[lang];
        if (!own || typeof own !== 'object' || mbDacumLang(m) === lang) return;
        Object.keys(own).forEach(function (k) { if (!map.has(k) && typeof own[k] === 'string') map.set(k, own[k]); });
    });
    return map;
}

/* ── 3.34.0: the language DACUM's texts are in ──────────────────
   DACUM Live Pro 3.105+ says so (contentLanguage); before that the
   translations record says which version was shown; with neither, the
   script of the texts decides (Arabic letters → 'ar', else English). */
function mbDacumLang(module) {
    var codes = (typeof BILANG_CODES !== 'undefined') ? BILANG_CODES : ['en', 'ar', 'fr'];
    if (!module) return 'en';
    if (codes.indexOf(module.dacumLang) !== -1) return module.dacumLang;
    var r = module.dacumI18n;
    if (r && codes.indexOf(r.shown) !== -1) return r.shown;
    var sample = [String(module.title || '')];
    (module.learningOutcomes || []).forEach(function (lo) { sample.push(String(lo.statement || '')); });
    var ta = (module.taskAnalysisSource && module.taskAnalysisSource.taskAnalysis) || {};
    Object.keys(ta).slice(0, 5).forEach(function (k) { sample.push((ta[k].performanceSteps || []).join(' ')); });
    var t = sample.join(' ');
    var ar = (t.match(/[\u0600-\u06FF]/g) || []).length;
    var lat = (t.match(/[A-Za-z\u00C0-\u017F]/g) || []).length;
    if (ar > lat) return 'ar';
    if (/[àâçéèêëîïôûùüÿœæ]/i.test(t) && (t.match(/\b(le|la|les|des|du|et)\b/gi) || []).length > 3) return 'fr';
    return 'en';
}

/** A DACUM text of `module` in `lang`; null when it has no version in
 *  that language yet (never the text of another language). */
function mbDacumTextIn(module, text, lang) {
    if (typeof text !== 'string' || !text) return text;
    if (lang === mbDacumLang(module)) return text;
    var st = (typeof window !== 'undefined' && window.mbState) || null;
    var map = _mbDacumMap(st && st.modulesData, lang);
    if (!map.size) return null;
    var out = _mbDacumStr(text, map, lang);
    return out !== text ? out : null;
}

function _mbDacumStr(v, map, lang) {
    if (!v || !map.size) return v;
    if (map.has(v)) return map.get(v);
    var m = MB_DI18N_PREFIX.exec(v);
    var p = m ? m[1] : '';
    var rest = v.slice(p.length);
    var tail = /\s*$/.exec(rest)[0];
    var core = rest.slice(0, rest.length - tail.length);
    if (map.has(core)) return p + map.get(core) + tail;
    /* 3.34.0: "Safety: <text>" written by the suggested-content panels —
       the label goes into the language too. */
    var lab2 = /^([^:\n]{1,40}):\s+([\s\S]+)$/.exec(v);
    if (lab2 && lang && typeof mbSpLabelIn === 'function') {
        var tl = mbSpLabelIn(lab2[1], lang);
        if (tl !== null) {
            var body = map.has(lab2[2]) ? map.get(lab2[2]) : _mbDacumStr(lab2[2], map, lang);
            if (body !== lab2[2]) return tl + ': ' + body;
        }
    }
    /* "LO1: <statement>" — the outcome title Module Builder builds. */
    var lab = /^([^\s:]{1,12}:\s+)([\s\S]+)$/.exec(v);
    if (lab && map.has(lab[2])) return lab[1] + map.get(lab[2]);
    if (v.indexOf('\n') !== -1) {
        var ch = false;
        var out = v.split('\n').map(function (l) { var r = _mbDacumStr(l, map, lang); if (r !== l) ch = true; return r; });
        return ch ? out.join('\n') : v;
    }
    return v;
}

function _mbDacumWalk(node, map, key, lang) {
    if (key && MB_DI18N_SKIP[key]) return node;
    if (typeof node === 'string') return _mbDacumStr(node, map, lang);
    if (Array.isArray(node)) {
        for (var i = 0; i < node.length; i++) node[i] = _mbDacumWalk(node[i], map, null, lang);
        return node;
    }
    if (node && typeof node === 'object') {
        Object.keys(node).forEach(function (k) { node[k] = _mbDacumWalk(node[k], map, k, lang); });
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
    return _mbDacumWalk(st, map, null, lang);
}

/** One DACUM text in `lang` (default: the content language being
 *  edited), using the modules currently held. */
function mbDacumText(text, lang) {
    if (typeof text !== 'string' || !text) return text;
    var l = lang || ((typeof contentLang === 'function') ? contentLang() : 'en');
    var st = (typeof window !== 'undefined' && window.mbState) || null;
    var map = _mbDacumMap(st && st.modulesData, l);
    return map.size ? _mbDacumStr(text, map, l) : text;
}
