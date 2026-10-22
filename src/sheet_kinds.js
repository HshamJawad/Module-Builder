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

var MB_SHEET_KINDS = ['activity', 'task', 'job', 'operation', 'jobsheet', 'custom'];
var MB_SHEET_KIND_KEYS = {
    info: 'skInfo', activity: 'skActivity', task: 'skTask', job: 'skJob', operation: 'skOperation',
    jobsheet: 'skJob', custom: 'skActivity'
};
/* 3.73.0: two more types.
   'jobsheet' — the Job Sheet in the Learner guide, where 'job' is named
                the Worksheet. Named like the standard template's Job Sheet
                (skJob, and the name typed for it in Settings → Misc).
   'custom'   — a name the author types for THIS sheet (sheet.sheetTypeName,
                a language pair), as DACUM's «Other (specify)». Empty, it
                falls back to the learning / activity sheet's name. */
if (window.i18n && window.i18n.extend) window.i18n.extend({
    en: { skCustom: '✏️ Custom name…', skCustomPh: 'Type the name of this sheet…' },
    fr: { skCustom: '✏️ Nom personnalisé…', skCustomPh: 'Saisissez le nom de cette fiche…' },
    ar: { skCustom: '✏️ اسم مخصص…', skCustomPh: 'اكتب اسم هذه الورقة…' }
});

/** The name typed for a custom-type sheet, in one language, or ''. */
function mbSheetCustomName(sheet, lang) {
    var v = sheet && sheet.sheetTypeName;
    if (!v) return '';
    if (typeof v === 'string') return v.trim();
    return String((typeof biGetStrict === 'function') ? biGetStrict(v, lang) : (v[lang] || '')).trim();
}

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
    if (kind === 'jobsheet') kind = 'job_std';   // 3.73.0: the standard Job Sheet's own name
    if (kind === 'custom') return '';
    /* 3.67.0: in the Learner guide, its own names typed in Settings first. */
    var lgOwn = (typeof mbLgSheetNameCustom === 'function') ? mbLgSheetNameCustom(kind, lang) : '';
    if (lgOwn) return lgOwn;
    var all = _mbSkSettings().sheetLabels || {};
    var side = all[lang] || {};
    var own = String(side[kind === 'job_std' ? 'job' : kind] || '').trim();
    if (kind === 'job_std') return own;
    /* 3.59.0: the Learner guide names its sheets «Knowledge», «Learning
       activity» and «Worksheet» unless the user typed a name. */
    if (!own && typeof mbLgSheetName === 'function') own = mbLgSheetName(kind, lang);
    return own;
}

/** The name to print: the user's, else the dictionary's. */
function mbSheetLabel(kind, lang, sheet) {
    /* 3.73.0: a custom-type sheet prints the name typed for it. */
    if (kind === 'custom') {
        var typed = mbSheetCustomName(sheet, lang);
        if (typed) return typed;
        kind = 'activity';
    }
    var own = mbSheetLabelCustom(kind, lang);
    if (own) return own;
    var key = MB_SHEET_KIND_KEYS[kind] || MB_SHEET_KIND_KEYS.activity;
    return (window.i18n && window.i18n.tIn) ? window.i18n.tIn(key, lang) : key;
}

/** '' when the exporter should keep its own wording: the information
    sheet and the 'activity' type, while the user has not renamed them.
    The other types always have a name of their own. */
function mbSheetLabelExplicit(kind, lang, sheet) {
    if (kind === 'custom') {   // 3.73.0
        var typed = mbSheetCustomName(sheet, lang);
        if (typed) return typed;
        kind = 'activity';
    }
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
    /* 3.59.0: the Learner guide has two kinds of activity sheet — the
       learning activity and the worksheet (a Job sheet). A sheet of
       another type keeps it. */
    /* 3.73.0: + the Job Sheet in the Learner guide, + a custom name in both.
       The standard template's own 'job' is already its Job Sheet. */
    var kinds = (typeof mbIsLearnerGuide === 'function' && mbIsLearnerGuide())
        ? MB_SHEET_KINDS.filter(function (k) { return k === 'activity' || k === 'job' || k === 'jobsheet' || k === 'custom' || k === cur; })
        : MB_SHEET_KINDS.filter(function (k) { return k !== 'jobsheet' || k === cur; });
    sel.innerHTML = kinds.map(function (k) {
        var name = (k === 'custom' ? window.i18n.tIn('skCustom', (window.i18n.getLang && window.i18n.getLang()) || lang) : mbSheetLabel(k, lang)).replace(/[&<>"]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
        });
        return '<option value="' + k + '"' + (k === cur ? ' selected' : '') + '>' + name + '</option>';
    }).join('');
    sel.value = cur;
    mbPaintSheetTypeName();
    /* 3.44.0: the open sheet's title field follows its type. */
    if (typeof mbRepaintSheetNames === 'function') mbRepaintSheetNames();
}

/* 3.73.0: the name box beside the selector, shown for 'custom' only. */
function mbPaintSheetTypeName() {
    var sel = document.getElementById('activity-sheet-type');
    var box = document.getElementById('activity-sheet-type-name');
    if (!sel || !box) return;
    var on = sel.value === 'custom';
    box.hidden = !on;
    box.placeholder = window.i18n ? window.i18n.t('skCustomPh') : '';
    box.setAttribute('dir', 'auto');
}
/** Load: the open sheet's typed name (content language) into the box. */
function mbLoadSheetTypeName(sheet) {
    var box = document.getElementById('activity-sheet-type-name');
    if (!box) return;
    var lang = (typeof contentLang === 'function') ? contentLang() : 'en';
    box.value = mbSheetCustomName(sheet, lang);
    mbPaintSheetTypeName();
}
/** Save: the box onto the sheet being collected (its active side). */
function mbCollectSheetTypeName(activityData) {
    var box = document.getElementById('activity-sheet-type-name');
    if (!box) return;
    if (activityData.sheetType === 'custom' || box.value.trim() || (activityData.sheetTypeName && typeof biIs === 'function' && biIs(activityData.sheetTypeName))) {
        if (!activityData.sheetTypeName || typeof activityData.sheetTypeName !== 'object') activityData.sheetTypeName = (typeof biNew === 'function') ? biNew() : {};
        biPut(activityData, 'sheetTypeName', box.value);
    }
}

if (typeof window !== 'undefined') {
    window.addEventListener('mb:langchange', function () { mbRenderSheetKindSelect(); });
    window.addEventListener('mb:settingschange', function () { mbRenderSheetKindSelect(); });
}

/* ── The names in the INTERFACE (3.44.0) ──────────────────────
   A name typed in Settings → Misc for the interface language replaces
   the sheet's name on the tabs, the side navigation, the sheet's own
   labels and buttons, and its short messages — so the tool says
   «المعرفة» where the file says «المعرفة». A box left empty changes
   nothing. Applied by i18n.t() (mb-translations.js), so every label
   built from the dictionary follows, and repainted on a settings change.

   The interface strings are rebuilt from templates rather than by
   replacing words inside the dictionary's sentences: «ورقة معلومات» and
   «la fiche d'information» carry grammar a user's name would not fit.

   Information sheet: its own name. Activity sheet: the name of the type
   a new sheet starts as (Settings → Misc) — each sheet may be another
   type — except the title field of the open sheet, which follows that
   sheet's own type. */
var _MB_SN_TPL = {
    en: {
        name: '{L}', list: '{I} {L}:', proceed: 'Proceed to {L} →', title: '{L} title:',
        enterTitle: 'Enter the title…', prev: 'Previous {L}', next: 'Next {L}', add: '➕ Add {L}',
        added: '{L} {v0} added!', removed: '{L} removed!', cleared: '{L} cleared!', none: 'No {L} to remove.'
    },
    fr: {
        name: '{L}', list: '{I} {L} :', proceed: 'Passer à : {L} →', title: 'Titre — {L} :',
        enterTitle: 'Saisissez le titre…', prev: 'Précédent : {L}', next: 'Suivant : {L}', add: '➕ Ajouter : {L}',
        added: 'Ajouté : {L} {v0} !', removed: 'Supprimé : {L} !', cleared: 'Vidé : {L} !', none: 'Rien à supprimer : {L}.'
    },
    ar: {
        name: '{L}', list: '{I} {L}:', proceed: 'المتابعة إلى {L} ←',
        title: 'عنوان {L}:', enterTitle: 'أدخل العنوان…',
        prev: 'السابق: {L}', next: 'التالي: {L}', add: '➕ إضافة {L}',
        added: 'أُضيف: {L} {v0}!', removed: 'أُزيل: {L}!', cleared: 'تم مسح: {L}!',
        none: 'لا يوجد ما يُزال: {L}.'
    }
};

/* key → [which sheet, which template, icon for lists] */
var _MB_SN_KEYS = {
    mbInformationSheet: ['info', 'name'], mbInformationSheets: ['info', 'list', '📄'],
    mbProceedToInformationSheet: ['info', 'proceed'], mbInformationSheetTitle: ['info', 'title'],
    mbEnterInformationSheetTitle: ['info', 'enterTitle'], mbPreviousInfoSheet: ['info', 'prev'],
    mbNextInfoSheet: ['info', 'next'], mbAddInfoSheet: ['info', 'add'], dgInformationSheetCleared: ['info', 'cleared'],
    mbCmDest_info: ['info', 'name'], mbSpKind_info: ['info', 'name'],
    mbActivityJobSheet: ['activity', 'name'], mbActivityJobSheet2: ['activity', 'name'],
    mbActivitySheets: ['activity', 'list', '⚡'], mbProceedToActivityJobSheet: ['activity', 'proceed'],
    mbPreviousActivitySheet: ['activity', 'prev'], mbNextActivitySheet: ['activity', 'next'],
    mbAddActivitySheet: ['activity', 'add'], mbActivitySheetTitle: ['open', 'title'],
    mbEnterActivitySheetTitle: ['open', 'enterTitle'], dgActivitySheetAdded: ['activity', 'added'],
    dgActivitySheetRemoved: ['activity', 'removed'], dgActivitySheetCleared: ['activity', 'cleared'],
    dgNoActivitySheetToRemove: ['activity', 'none'], mbCmDest_activity: ['activity', 'name'],
    mbSpKind_activity: ['activity', 'name']
};

/** The interface name for 'info', 'activity' (the default type) or
    'open' (the activity sheet on screen), or '' to keep the dictionary's. */
function mbSheetUiName(which, lang) {
    if (which === 'info') return mbSheetLabelCustom('info', lang);
    var kind = mbDefaultSheetKind();
    if (which === 'open') {
        var sel = (typeof document !== 'undefined') ? document.getElementById('activity-sheet-type') : null;
        if (sel && sel.value) kind = mbSheetKind(sel.value);
        if (kind === 'custom') {   // 3.73.0: the name typed for the open sheet
            var box = document.getElementById('activity-sheet-type-name');
            if (box && box.value.trim()) return box.value.trim();
            kind = 'activity';
        }
    }
    if (kind === 'custom') kind = 'activity';
    var own = mbSheetLabelCustom(kind, lang);
    if (own) return own;
    return kind === 'activity' ? '' : mbSheetLabel(kind, lang);
}

/** Called by i18n.t(): the dictionary's text, or the user's name in its place. */
function mbSheetNameOverlay(key, lang, text) {
    /* 3.67.0: the Learner guide's «learning unit» and «objectives». */
    if (typeof mbLgUiOverlay === 'function') {
        var lg = mbLgUiOverlay(key, lang);
        if (lg) return lg;
    }
    var spec = _MB_SN_KEYS[key];
    if (!spec) return text;
    var L = mbSheetUiName(spec[0], lang);
    if (!L) return text;
    var tpl = (_MB_SN_TPL[lang] || _MB_SN_TPL.en)[spec[1]];
    return tpl.replace('{L}', L).replace('{I}', spec[2] || '');
}

/** Repaint every element labelled by one of these keys. */
function mbRepaintSheetNames() {
    if (!window.i18n || typeof document === 'undefined') return;
    var keys = Object.keys(_MB_SN_KEYS);
    if (typeof MB_LG_UI_KEYS === 'object') keys = keys.concat(Object.keys(MB_LG_UI_KEYS));   // 3.67.0
    keys.forEach(function (key) {
        document.querySelectorAll('[data-i18n="' + key + '"],[data-i18n-title="' + key + '"],[data-i18n-placeholder="' + key + '"]').forEach(function (el) {
            var txt = window.i18n.t(key);
            if (el.getAttribute('data-i18n') === key) {
                var attr = el.getAttribute('data-i18n-attr');
                if (attr) el.setAttribute(attr, txt); else el.textContent = txt;
            }
            if (el.getAttribute('data-i18n-title') === key) el.setAttribute('title', txt);
            if (el.getAttribute('data-i18n-placeholder') === key) el.setAttribute('placeholder', txt);
        });
    });
}

if (typeof window !== 'undefined') {
    window.addEventListener('mb:settingschange', function () { mbRepaintSheetNames(); });
    document.addEventListener('change', function (e) {
        if (e.target && e.target.id === 'activity-sheet-type') { mbPaintSheetTypeName(); mbRepaintSheetNames(); }
    });
    document.addEventListener('input', function (e) {
        if (e.target && e.target.id === 'activity-sheet-type-name') mbRepaintSheetNames();
    });
}
