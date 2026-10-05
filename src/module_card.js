// ============================================================
// /src/module_card.js
// The module's identity card, and the small measurements the module
// library keeps about each module.
//
// THE CARD
// Every module record carries a card saying what it is and where it came
// from. It is written with the module on every save, and it is the same
// object that a module package (.mbz, next release) will carry as its
// manifest — so whoever receives one module can tell, without opening
// it: which programme it belongs to, which module it is, who last wrote
// in it, when, and with which build of the tool.
//
//   format, formatVersion   'mb-module', 1 — what this record is
//   programId, programName  the DACUM project the module came from
//                           (null for a project started by hand)
//   projectId               this library's project
//   moduleId, moduleCode, moduleTitle
//   createdBy, createdAt    first save
//   author, savedAt         last save that CHANGED something
//   revision                +1 on every such save; with savedAt and
//                           author it tells two copies of a module apart
//   toolVersion             build that wrote it
//
// A save that changes nothing does not touch the card, so opening a
// module and closing it again never makes the opener its author.
// ============================================================

var MB_MODULE_FORMAT         = 'mb-module';
var MB_MODULE_FORMAT_VERSION = 1;

/* The keys of the cover table that describe ONE module rather than the
   whole programme. They are kept with each module and put back on the
   table when it is opened (module_library.js). */
var MB_MODULE_COVER_KEYS = ['cvUnitTitle', 'cvModuleCode', 'cvLevel', 'cvHours', 'cvEntryReq'];

/* ── Author ───────────────────────────────────────────────── */
function mbAuthorName() {
    return String(mbGetSetting(MB_KEYS.authorName, '') || '').trim();
}
function mbSetAuthorName(name) {
    name = String(name || '').trim();
    if (name) mbSetSetting(MB_KEYS.authorName, name);
    else mbRemoveSetting(MB_KEYS.authorName);
    return name;
}

/* ── Tool version ─────────────────────────────────────────────
   Read from the ?v= on this build's own script tags, which every release
   bumps already — a second copy of the number would be one more thing
   to forget. */
function mbToolVersion() {
    var el = document.querySelector('script[src*="persistence.js"]');
    var m = el && /[?&]v=([^&]+)/.exec(el.getAttribute('src') || '');
    return m ? m[1] : '';
}

/* ── Plain text of a field that may be a bilingual pair ────── */
function mbPlainText(v, lang) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'object') {
        var l = lang || ((typeof contentLang === 'function') ? contentLang() : 'en');
        if (typeof v[l] === 'string' && v[l].trim()) return v[l];
        for (var k in v) if (typeof v[k] === 'string' && v[k].trim()) return v[k];
    }
    return '';
}

/**
 * The card for a module about to be saved.
 * `prev` is the card already stored (null for a first save).
 */
function mbMakeModuleCard(project, module, prev) {
    var now = new Date().toISOString();
    var who = mbAuthorName();
    prev = prev || {};
    return {
        format:        MB_MODULE_FORMAT,
        formatVersion: MB_MODULE_FORMAT_VERSION,
        programId:     (project && project.programId) || null,
        programName:   (project && (project.programName || project.name)) || '',
        projectId:     (project && project.id) || null,
        moduleId:      module.id,
        moduleCode:    module.moduleCode || module.moduleNumber || '',
        moduleTitle:   mbPlainText(module.title),
        createdBy:     prev.createdBy !== undefined ? prev.createdBy : who,
        createdAt:     prev.createdAt || now,
        author:        who,
        savedAt:       now,
        revision:      (prev.revision || 0) + 1,
        toolVersion:   mbToolVersion()
    };
}

/* ── Fingerprint ──────────────────────────────────────────────
   Decides whether a save is needed at all, and measures the record's
   size, in ONE walk and without JSON.stringify — the cost autosave was
   built to avoid. Text is hashed whole; an image (any string over 2 KB,
   i.e. a data URL) by its length and nine 32-character samples spread
   across it, so a module full of photographs is hashed in microseconds.
   FNV-1a, 32 bit: a collision means one skipped save that the next
   keystroke repeats, not lost work. */
function mbFingerprint(value) {
    var h = 0x811c9dc5, bytes = 0;
    function mixStr(str) {
        for (var i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 0x01000193);
        }
    }
    function walk(v) {
        if (v === null || v === undefined) { mixStr('\u0000'); return; }
        var t = typeof v;
        if (t === 'string') {
            bytes += v.length;
            if (v.length > 2048) {
                mixStr('#' + v.length);
                var step = Math.floor((v.length - 32) / 8);
                for (var k = 0; k <= 8; k++) mixStr(v.substr(k * step, 32));
            } else {
                mixStr(v);
            }
            mixStr('\u0001');
            return;
        }
        if (t === 'number' || t === 'boolean') { var s = String(v); bytes += s.length; mixStr(s); mixStr('\u0002'); return; }
        if (Array.isArray(v)) { mixStr('['); for (var i = 0; i < v.length; i++) walk(v[i]); mixStr(']'); return; }
        if (t === 'object') {
            mixStr('{');
            for (var key in v) {
                if (!Object.prototype.hasOwnProperty.call(v, key)) continue;
                mixStr(key); mixStr(':'); bytes += key.length;
                walk(v[key]);
            }
            mixStr('}');
        }
    }
    walk(value);
    return { fp: (h >>> 0).toString(16) + ':' + bytes, bytes: bytes };
}

/* ── Light copy of a module ───────────────────────────────────
   What stays in memory for every module that is NOT open: the fields
   DACUM sent (title, code, level, Task Analysis for ta_finder.js) and
   the outcomes with their criteria — but no sheets and no sections. */
function mbModuleSkeleton(module) {
    var s = {};
    for (var k in module) if (Object.prototype.hasOwnProperty.call(module, k)) s[k] = module[k];
    s.learningOutcomes = (module.learningOutcomes || []).map(function (lo) {
        var l = {};
        for (var k2 in lo) if (Object.prototype.hasOwnProperty.call(lo, k2)) l[k2] = lo[k2];
        l.infoSheets = [];
        l.activitySheets = [];
        l.blocks = [];
        return l;
    });
    return s;
}

/* ── Progress ─────────────────────────────────────────────────
   Three parts per learning outcome: an information sheet, an activity
   sheet and a filled assessment form — the three things the exported
   module is made of. "Has a sheet" means a TITLED sheet, as in the
   export (module_model.js): the tool creates an empty sheet the moment
   a tab is opened. */
function mbModuleStats(module, forms) {
    var los = module.learningOutcomes || [];
    var done = 0, sheets = 0, written = false;
    var hasSheet = (typeof mmSheetHasContent === 'function') ? mmSheetHasContent
        : function (s) { return !!(s && mbPlainText(s.title).trim()); };
    var filled = (typeof mmAssessmentFilled === 'function') ? mmAssessmentFilled : function () { return false; };
    los.forEach(function (lo) {
        var info = (lo.infoSheets || []).filter(hasSheet).length;
        var act  = (lo.activitySheets || []).filter(hasSheet).length;
        var asm  = filled((forms || {})[lo.id]);
        sheets += info + act;
        if (info) done++;
        if (act) done++;
        if (asm) done++;
        if (info || act || asm) written = true;
        if ((lo.blocks || []).some(function (b) { return b && (mbPlainText(b.title).trim() || mbPlainText(b.body).trim()); })) written = true;
    });
    var total = los.length * 3;
    return {
        los: los.length,
        sheets: sheets,
        done: done,
        total: total,
        completion: total ? Math.round(done * 100 / total) : 0,
        /* Nothing written here yet. Shown as "structure from DACUM only"
           for a module that came from DACUM, as "empty" otherwise. */
        skeleton: !written
    };
}
