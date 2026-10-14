// ============================================================
// /src/sheet_kinds.js
// Sheet types and their names (3.42.0)
//
// WHY
// TESDA's competency-based learning materials distinguish a Task Sheet,
// a Job Sheet and an Operation Sheet; this tool had one «Activity / Job
// Sheet». Each activity sheet now carries a type (sheet.sheetType), and
// the name printed for every type — and for the information sheet — can
// be changed per language in Settings → Misc.
//
// WHAT IS STORED WHERE
//   sheet.sheetType              per activity sheet, in the project
//                                ('activity' when absent: every sheet
//                                written before 3.42.0)
//   settings.sheetLabels         { en: { info, activity, task, job,
//                                  operation }, fr: {…}, ar: {…} },
//                                global to the tool (word_settings.js),
//                                '' = the dictionary's name
//   settings.defaultSheetKind    the type a NEW activity sheet starts as
//   settings.checklistTime       add «within the required time» to each
//                                activity checklist when a duration is set
//
// UNCHANGED OUTPUT BY DEFAULT
// An untouched install exports exactly what it did: for the information
// sheet and the 'activity' type, the exporters keep their own wording
// unless the user has typed a name (mbSheetLabelExplicit returns '').
// ============================================================

var MB_SHEET_KINDS = ['activity', 'task', 'job', 'operation'];
var MB_SHEET_KIND_KEYS = {
    info: 'skInfo', activity: 'skActivity', task: 'skTask', job: 'skJob', operation: 'skOperation'
};

function _mbSkSettings() {
    try { if (typeof _wsGet === 'function') return _wsGet() || {}; } catch (e) { /* fall through */ }
    return {};
}

/** A valid activity-sheet type, 'activity' for anything else. */
function mbSheetKind(v) {
    return MB_SHEET_KINDS.indexOf(v) !== -1 ? v : 'activity';
}

/** The type a new activity sheet starts as (Settings → Misc). */
function mbDefaultSheetKind() {
    return mbSheetKind(_mbSkSettings().defaultSheetKind);
}

/** The name the user typed for this type in this language, or ''. */
function mbSheetLabelCustom(kind, lang) {
    var all = _mbSkSettings().sheetLabels || {};
    var side = all[lang] || {};
    return String(side[kind] || '').trim();
}

/** The name to print: the user's, else the dictionary's. */
function mbSheetLabel(kind, lang) {
    var own = mbSheetLabelCustom(kind, lang);
    if (own) return own;
    var key = MB_SHEET_KIND_KEYS[kind] || MB_SHEET_KIND_KEYS.activity;
    return (window.i18n && window.i18n.tIn) ? window.i18n.tIn(key, lang) : key;
}

/** '' when the exporter should keep its own wording: the information
    sheet and the 'activity' type, while the user has not renamed them.
    The other types always have a name of their own. */
function mbSheetLabelExplicit(kind, lang) {
    var own = mbSheetLabelCustom(kind, lang);
    if (own) return own;
    if (kind === 'info' || kind === 'activity') return '';
    return mbSheetLabel(kind, lang);
}

/** «Label 1-2 / Title», «Label / Title», or the label alone. */
function mbSheetHeading(label, num, title) {
    var s = label;
    if (num) s += ' ' + num;
    if (title) s += ' / ' + title;
    return s;
}

/** Whether the time row is added to checklists (default on). */
function mbChecklistTimeOn() {
    return _mbSkSettings().checklistTime !== false;
}

/** The checklist row for a sheet with a duration, or ''. */
function mbTimeCriterion(duration, lang) {
    var n = parseInt(duration, 10);
    if (!mbChecklistTimeOn() || !isFinite(n) || n <= 0) return '';
    var tpl = (window.i18n && window.i18n.tIn) ? window.i18n.tIn('expTimeCriterion', lang) : '';
    return String(tpl || '').replace('{v0}', String(n));
}

/* ── The selector on the activity sheet ───────────────────────
   Options are named in the CONTENT language — the name that will be
   printed — and repainted when either language or the settings change. */
function mbRenderSheetKindSelect(value) {
    var sel = document.getElementById('activity-sheet-type');
    if (!sel) return;
    var cur = mbSheetKind(value !== undefined ? value : sel.value);
    var lang = (typeof contentLang === 'function') ? contentLang() : 'en';
    sel.innerHTML = MB_SHEET_KINDS.map(function (k) {
        var name = mbSheetLabel(k, lang).replace(/[&<>"]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
        });
        return '<option value="' + k + '"' + (k === cur ? ' selected' : '') + '>' + name + '</option>';
    }).join('');
    sel.value = cur;
}

if (typeof window !== 'undefined') {
    window.addEventListener('mb:langchange', function () { mbRenderSheetKindSelect(); });
    window.addEventListener('mb:settingschange', function () { mbRenderSheetKindSelect(); });
}
