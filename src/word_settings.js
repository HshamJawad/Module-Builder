// ============================================================
// /src/word_settings.js
// «Word export settings» — a dialog that controls the SHAPE of the
// exported .docx and nothing else. It never touches the on-screen tool.
//
// ── WHAT THIS FILE OWNS ─────────────────────────────────────
//   1. Four font SIZES, one per heading role actually present in
//      exports_docx.js (see the role table below).
//   2. One heading COLOUR, applied to every run that is explicitly
//      blue today (`0070C0`).
//   3. One table-header COLOUR, applied to the shaded header cells of
//      the resources table — with the text on top computed, not
//      guessed.
//   4. The dialog, the preview, the reset, and the storage key.
//
// ── WHY FOUR SIZES AND NOT THREE ────────────────────────────
// The export does not have "a title and some subheadings". Reading it
// end to end, there are FOUR distinct heading roles carrying FOUR
// distinct sizes, and collapsing any two of them would mean the
// defaults no longer reproduce today's file:
//
//   role                              today   field
//   module title (once per document)  16 pt   titleSize
//   page / section headings           14 pt   sectionSize
//   third-level headings              13 pt   subSize
//   inline headings + body + content  12 pt   bodySize
//
// The last row is the one worth staring at. «Objective:», «Duration:»,
// «Step 3» and the body paragraph under them are ALL 12 pt today. They
// are different ROLES at an identical SIZE. One field moves them
// together, which is the only behaviour that keeps «Reset to default»
// honest — the alternative is inventing a distinction the file has
// never had.
//
// ── WHAT IS DELIBERATELY NOT SETTABLE ───────────────────────
// Fixed at their current values, by decision, because each is a TABLE
// measurement rather than a heading level and binding it to a heading
// field would resize it the moment anyone pressed Reset:
//   cover table            18 pt   (exports_docx.js ~680, ~707)
//   resources table        14 pt   (~246-290, ~1407-1412)
//   criteria checklist     14 pt   (~1454-1462)
//   user tables in cards   11 pt   (~1189)
//   mark boxes             11 pt   (marks.js) — and their colours come
//                                  from the mark's own theme, which is
//                                  a feature of that file, not ours.
// Also fixed: the two dark blues `1F4E78` / `1F4788`, and the hyperlink
// blue `0563C1`. The first two differ by a single hex digit and look
// like a typo of one another; correcting that is a separate decision
// and not one this feature gets to make silently.
//
// ── WHY NO FREE COLOUR PICKER ───────────────────────────────
// A fixed palette is what keeps a team's modules looking like one
// family. `0070C0` — today's blue, and today's table-header fill — is
// already one of the eight, so no extra swatch is needed and the
// defaults land exactly on the current output.
//
// ── STORAGE ─────────────────────────────────────────────────
// One key, one JSON object, global to the tool. Written only when the
// user presses Save. It is NOT per language
// and NOT per project: the same settings apply to an English, French or
// Arabic export of any module. Read through mbGetSetting/mbSetSetting,
// never through localStorage directly — persistence.js is the only file
// in this project allowed to name that API.
//
// Validation happens on READ, per field. A hand-edited or corrupted
// value falls back to the default FOR THAT FIELD ONLY; it never takes
// the export down with it.
// ============================================================

/* ── Strings ────────────────────────────────────────────────
   This file owns its own table, the same way content.js and steps.js
   own theirs, and for the same reason: a dialog that only exists here
   should not be able to come out untranslated because a key was missed
   in a 124 KB dictionary. */
var _WS_STRINGS = {
    en: {
        wsButton:        'Settings',
        wsTitle:         'Word Export Settings',
        wsIntro:         'These settings control the appearance of the exported Word file only. They are shared across all languages and stay until you change them.',
        wsColors:        'Colours',
        wsHeadingColor:  'Heading colour',
        wsTableColor:    'Table header colour',
        wsContrastNote:  'Text inside shaded cells is set to white or black automatically.',
        wsSizes:         'Font sizes',
        wsTitleSize:     'Module title size',
        wsSectionSize:   'Section heading size',
        wsSubSize:       'Sub-heading size',
        wsBodySize:      'Body and content size',
        wsCoverSize:     'Cover table size',
        wsTableSize:     'Resources and checklist table size',
        wsUserTableSize: 'Content-card table size',
        wsFixedNote:     'Mark boxes keep their own size and theme colours.',
        wsPdfFont:       'Export font',
        wsPdfFontNote:   'Auto keeps the current behaviour: Arial for Arabic and Calibri for Latin in Word, Cairo in PDF. Choosing a family applies it to both. Arial and Calibri are downloaded only when selected.',
        wsHtmlGroup:     'HTML export sections',
        wsHtmlNote:      'Choose which parts of the module the HTML file contains. Covers are not included in the HTML package.',
        wsSec_overview: 'Module Overview',
        wsSec_intro: 'Introduction &amp; Work Team',
        wsSec_outcomes: 'Learning Outcomes',
        wsSec_infoSheets: 'Information Sheets',
        wsSec_activitySheets: 'Activity / Job Sheets',
        wsSec_assessment: 'Assessment Unit',
        wsSec_references: 'References',
        wsPreview:       'Preview',
        wsPvTitle:       'Module Title',
        wsPvSection:     'Introduction',
        wsPvSub:         'Learning Outcome 1',
        wsPvHeading:     'Objective:',
        wsPvBody:        'By the end of this outcome the trainee will be able to…',
        wsPvTable:       'Material / Equipment',
        wsPvUserCell:    'Table cell',
        wsPvTableCell:   'Screwdriver set',
        wsReset:         'Reset to default',
        wsClose:         'Close',
        wsSave:          'Save',
        wsSaved:         'Saved',
        wsUnsaved:       'You have unsaved changes. Press Close again to discard them.',
        wsPt:            'pt'
    },
    fr: {
        wsButton:        'Paramètres',
        wsTitle:         'Paramètres d\u2019export Word',
        wsIntro:         'Ces paramètres contrôlent uniquement l\u2019apparence du fichier Word exporté. Ils sont communs à toutes les langues et restent en place jusqu\u2019à ce que vous les changiez.',
        wsColors:        'Couleurs',
        wsHeadingColor:  'Couleur des titres',
        wsTableColor:    'Couleur d\u2019en-tête de tableau',
        wsContrastNote:  'Le texte dans les cellules ombrées passe automatiquement en blanc ou en noir.',
        wsSizes:         'Tailles de police',
        wsTitleSize:     'Taille du titre du module',
        wsSectionSize:   'Taille des titres de section',
        wsSubSize:       'Taille des sous-titres',
        wsBodySize:      'Taille du texte et du contenu',
        wsCoverSize:     'Taille du tableau de couverture',
        wsTableSize:     'Taille des tableaux de ressources et de checklist',
        wsUserTableSize: 'Taille des tableaux dans les cartes de contenu',
        wsFixedNote:     'Les encadrés gardent leur taille et leurs couleurs de thème.',
        wsPdfFont:       'Police d\u2019export',
        wsPdfFontNote:   'Auto conserve le comportement actuel : Arial pour l\u2019arabe et Calibri pour le latin dans Word, Cairo en PDF. Choisir une police l\u2019applique aux deux. Arial et Calibri ne sont t\u00e9l\u00e9charg\u00e9s que si vous les s\u00e9lectionnez.',
        wsHtmlGroup:     'Sections de l\u2019export HTML',
        wsHtmlNote:      'Choisissez les parties du module que contient le fichier HTML. Les couvertures ne sont pas incluses.',
        wsSec_overview: 'Aper\u00e7u du module',
        wsSec_intro: 'Introduction et \u00e9quipe',
        wsSec_outcomes: 'R\u00e9sultats d\u2019apprentissage',
        wsSec_infoSheets: 'Fiches d\u2019information',
        wsSec_activitySheets: 'Fiches d\u2019activit\u00e9',
        wsSec_assessment: 'Unit\u00e9 d\u2019\u00e9valuation',
        wsSec_references: 'R\u00e9f\u00e9rences',
        wsPreview:       'Aperçu',
        wsPvTitle:       'Titre du module',
        wsPvSection:     'Introduction',
        wsPvSub:         'Résultat d\u2019apprentissage 1',
        wsPvHeading:     'Objectif :',
        wsPvBody:        'À la fin de ce résultat, l\u2019apprenant sera capable de…',
        wsPvTable:       'Matériel / Équipement',
        wsPvUserCell:    'Cellule de tableau',
        wsPvTableCell:   'Jeu de tournevis',
        wsReset:         'Réinitialiser',
        wsClose:         'Fermer',
        wsSave:          'Enregistrer',
        wsSaved:         'Enregistré',
        wsUnsaved:       'Modifications non enregistrées. Appuyez de nouveau sur Fermer pour les abandonner.',
        wsPt:            'pt'
    },
    ar: {
        wsButton:        'الإعدادات',
        wsTitle:         'إعدادات تصدير Word',
        wsIntro:         'هذه الإعدادات تتحكم بشكل ملف Word المُصدَّر فقط. مشتركة بين كل اللغات وتبقى حتى تغيّرها.',
        wsColors:        'الألوان',
        wsHeadingColor:  'لون العناوين',
        wsTableColor:    'لون رأس الجدول',
        wsContrastNote:  'نص الخلايا المظللة يُضبط أبيض أو أسود تلقائياً.',
        wsSizes:         'أحجام الخط',
        wsTitleSize:     'حجم عنوان الوحدة',
        wsSectionSize:   'حجم عناوين الأقسام',
        wsSubSize:       'حجم العناوين الفرعية',
        wsBodySize:      'حجم النص والمحتوى',
        wsCoverSize:     'حجم جدول الغلاف',
        wsTableSize:     'حجم جداول الموارد وقائمة التحقق',
        wsUserTableSize: 'حجم جداول بطاقات المحتوى',
        wsFixedNote:     'صناديق الملاحظات تحتفظ بحجمها وألوان ثيمتها.',
        wsPdfFont:       'خط التصدير',
        wsPdfFontNote:   '«Auto» يُبقي السلوك الحالي: Arial للعربية وCalibri للاتينية في Word، وCairo في PDF. واختيار خط يطبّقه على الاثنين. وArial وCalibri لا يُنزَّلان إلا عند اختيارهما.',
        wsHtmlGroup:     'أقسام تصدير HTML',
        wsHtmlNote:      'اختر الأجزاء التي يحويها ملف HTML. الأغلفة غير مضمَّنة في حزمة HTML.',
        wsSec_overview: 'نظرة عامة على الوحدة',
        wsSec_intro: 'التقديم وفريق العمل',
        wsSec_outcomes: 'نواتج التعلّم',
        wsSec_infoSheets: 'أوراق المعلومات',
        wsSec_activitySheets: 'أوراق النشاط',
        wsSec_assessment: 'وحدة التقييم',
        wsSec_references: 'المراجع',
        wsPreview:       'المعاينة',
        wsPvTitle:       'عنوان الوحدة',
        wsPvSection:     'المقدمة',
        wsPvSub:         'ناتج التعلّم ١',
        wsPvHeading:     'الهدف:',
        wsPvBody:        'في نهاية هذا الناتج سيكون المتدرّب قادراً على…',
        wsPvTable:       'المادة / التجهيزات',
        wsPvUserCell:    'خلية جدول',
        wsPvTableCell:   'طقم مفكات',
        wsReset:         'إعادة للوضع الافتراضي',
        wsClose:         'إغلاق',
        wsSave:          'حفظ',
        wsSaved:         'تم الحفظ',
        wsUnsaved:       'لديك تغييرات غير محفوظة. اضغط «إغلاق» مرة أخرى لتجاهلها.',
        wsPt:            'نقطة'
    }
};

function _wsT(key) {
    var lang = (window.i18n && window.i18n.getLang) ? window.i18n.getLang() : 'en';
    var table = _WS_STRINGS[lang] || _WS_STRINGS.en;
    return table[key] || _WS_STRINGS.en[key] || key;
}

/* ── The palette ────────────────────────────────────────────
   Eight fixed colours. `0070C0` is first because it is what the export
   uses today for both headings and the table header fill, so it is the
   default for both fields and no ninth "current value" swatch is
   needed. */
var WS_PALETTE = [
    { hex: '0070C0', en: 'Blue',        fr: 'Bleu',            ar: 'أزرق' },
    { hex: '1F3864', en: 'Navy',        fr: 'Marine',          ar: 'كحلي' },
    { hex: '375623', en: 'Dark green',  fr: 'Vert foncé',      ar: 'أخضر داكن' },
    { hex: '7B241C', en: 'Maroon',      fr: 'Bordeaux',        ar: 'عنّابي' },
    { hex: '5B2C6F', en: 'Purple',      fr: 'Violet',          ar: 'بنفسجي' },
    { hex: '3F464D', en: 'Dark grey',   fr: 'Gris foncé',      ar: 'رمادي داكن' },
    { hex: '0F6674', en: 'Dark teal',   fr: 'Sarcelle foncé',  ar: 'فيروزي داكن' },
    { hex: '000000', en: 'Black',       fr: 'Noir',            ar: 'أسود' }
];

function _wsSwatchName(sw) {
    var lang = (window.i18n && window.i18n.getLang) ? window.i18n.getLang() : 'en';
    return sw[lang] || sw.en;
}

/* ── Defaults ───────────────────────────────────────────────
   Every value here was read out of exports_docx.js, not chosen. That is
   the whole contract: an untouched install, and a freshly reset one,
   must produce byte-for-byte the file the tool produced before this
   feature existed. */
var WS_DEFAULTS = {
    titleSize:        16,        /* exports_docx.js size: 32 */
    sectionSize:      14,        /* exports_docx.js size: 28 */
    subSize:          13,        /* exports_docx.js size: 26 */
    bodySize:         12,        /* exports_docx.js size: 24 */
    coverSize:        18,        /* exports_docx.js size: 36 */
    tableSize:        14,        /* exports_docx.js size: 28 (tables) */
    userTableSize:    11,        /* exports_docx.js size: 22 */
    headingColor:     '0070C0',
    tableHeaderColor: '0070C0',
    /* Arabic PDF face. Not a Word setting — Word embeds nothing and
       uses whatever the reader has — but the dialog is where the user
       already goes to control how exports look, and a second dialog for
       one field would be worse. */
    /* 'Auto' = the tool's historic behaviour: Arial for Arabic, Calibri
       for Latin in Word, and Cairo for the PDF. It is the default so an
       untouched install keeps producing exactly the document it always
       did — picking a real family here changes BOTH exports. */
    pdfFont:          'Auto',
    /* Which parts of the module the HTML export includes. All on by
       default, so an untouched install exports everything exactly as
       before. Covers are deliberately absent: a full-bleed cover image
       is a print artefact, and the HTML package opens straight into the
       content. */
    htmlSections:     null   /* null = everything; otherwise an array of ids */
};

var WS_HTML_SECTIONS = ['overview', 'intro', 'outcomes', 'infoSheets',
                        'activitySheets', 'assessment', 'references'];

var WS_PDF_FONTS = ['Auto', 'Cairo', 'Arial', 'Calibri'];

/* Field order in the dialog. Kept in one place so the dialog, the
   reset and the read path can never drift apart. */
var WS_SIZE_FIELDS = [
    'titleSize', 'sectionSize', 'subSize', 'bodySize',
    'coverSize', 'tableSize', 'userTableSize'
];

var WS_MIN_PT = 11;
var WS_MAX_PT = 18;

/* ── Reading ────────────────────────────────────────────────
   Per-field validation. A single bad number must cost that one field
   and nothing else — a thrown parse or a rejected object would mean a
   corrupted key silently disables export for a user who has no idea the
   key exists. */
function _wsValidSize(v, fallback) {
    var n = parseInt(v, 10);
    if (!isFinite(n) || n < WS_MIN_PT || n > WS_MAX_PT) return fallback;
    return n;
}

function _wsValidColor(v, fallback) {
    if (typeof v !== 'string') return fallback;
    var hex = v.replace(/^#/, '').toUpperCase();
    if (!/^[0-9A-F]{6}$/.test(hex)) return fallback;
    for (var i = 0; i < WS_PALETTE.length; i++) {
        if (WS_PALETTE[i].hex === hex) return hex;
    }
    return fallback;
}

function wsReadSettings() {
    var raw = null;
    try {
        if (typeof mbGetSetting === 'function' && typeof MB_KEYS === 'object') {
            raw = mbGetSetting(MB_KEYS.wordExport);
        }
    } catch (e) { raw = null; }

    var o = {};
    if (raw) {
        try { o = JSON.parse(raw) || {}; } catch (e) { o = {}; }
    }
    if (typeof o !== 'object' || o === null) o = {};

    var out = {
        headingColor:     _wsValidColor(o.headingColor,     WS_DEFAULTS.headingColor),
        tableHeaderColor: _wsValidColor(o.tableHeaderColor, WS_DEFAULTS.tableHeaderColor),
        pdfFont: (WS_PDF_FONTS.indexOf(o.pdfFont) !== -1) ? o.pdfFont : WS_DEFAULTS.pdfFont,
        /* A corrupted list falls back to "everything" rather than to
           "nothing" — the failure mode has to be a complete document,
           never a silently empty one. */
        htmlSections: Array.isArray(o.htmlSections)
            ? o.htmlSections.filter(function (x) { return WS_HTML_SECTIONS.indexOf(x) !== -1; })
            : null
    };
    WS_SIZE_FIELDS.forEach(function (f) {
        out[f] = _wsValidSize(o[f], WS_DEFAULTS[f]);
    });
    return out;
}

function wsWriteSettings(s) {
    _WS_CACHE = null;
    try {
        if (typeof mbSetSetting === 'function' && typeof MB_KEYS === 'object') {
            return mbSetSetting(MB_KEYS.wordExport, JSON.stringify(s));
        }
    } catch (e) { /* storage unavailable — the dialog still works in-session */ }
    return false;
}

/* ── Contrast ───────────────────────────────────────────────
   WCAG relative luminance, then the standard contrast ratio against
   pure white and pure black. Guessing "dark colours get white text"
   works for seven of the eight swatches and fails on the eighth the day
   somebody adds a pale one. */
function wsRelativeLuminance(hex) {
    var c = [0, 2, 4].map(function (i) {
        var v = parseInt(hex.substr(i, 2), 16) / 255;
        return (v <= 0.03928) ? (v / 12.92) : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function wsContrastText(hex) {
    var L = wsRelativeLuminance(hex);
    var withWhite = 1.05 / (L + 0.05);
    var withBlack = (L + 0.05) / 0.05;
    return (withWhite >= withBlack) ? 'FFFFFF' : '000000';
}

/* ── Export-time accessors ──────────────────────────────────
   exports_docx.js calls these instead of carrying literals. They return
   HALF-POINTS, because that is what OOXML stores in w:sz — the number
   in the file is always the point size doubled.

   The cache exists so one export does not hit storage a hundred times,
   and it is refreshed by _wsBeginExport() at the top of every export
   rather than at page load. That is what makes a change in the dialog
   apply to the very next export with no reload. */
var _WS_CACHE = null;

function _wsGet() {
    if (!_WS_CACHE) _WS_CACHE = wsReadSettings();
    return _WS_CACHE;
}

function _wsBeginExport() { _WS_CACHE = wsReadSettings(); return _WS_CACHE; }

function _wsTitle()     { return _wsGet().titleSize   * 2; }
function _wsCover()     { return _wsGet().coverSize     * 2; }
function _wsTable()     { return _wsGet().tableSize     * 2; }
function _wsUserTable() { return _wsGet().userTableSize * 2; }
function _wsSection()   { return _wsGet().sectionSize * 2; }
function _wsSub()       { return _wsGet().subSize     * 2; }
function _wsBody()      { return _wsGet().bodySize    * 2; }
function _wsHeadColor() { return _wsGet().headingColor; }
function _wsTblFill()   { return _wsGet().tableHeaderColor; }
function _wsTblText()   { return wsContrastText(_wsGet().tableHeaderColor); }
function _wsPdfFont()   { return _wsGet().pdfFont; }

/** True when the HTML export should include this section. */
function wsHtmlIncludes(id) {
    var list = _wsGet().htmlSections;
    if (!Array.isArray(list)) return true;      /* null = everything */
    return list.indexOf(id) !== -1;
}

/* ── The dialog ─────────────────────────────────────────────
   Deliberately NOT a `.tab`. switchTab() clears `.active` from every
   `.tab` on the page and re-derives it from data-args, so a settings
   button wearing that class would blank whichever tab the user was on.
   It lives in the toolbar with its own action name and its own class. */

/* The dialog edits a DRAFT. Nothing reaches storage until Save is
   pressed, so a user who opens the settings to look around, drags a few
   sizes, and closes gets the file they had — which is what a Close
   button next to a Save button promises. The preview follows the draft
   live so the choice is visible before it is committed. */
var _wsDraft  = null;
var _wsSaved  = null;   /* the last committed state, for the dirty check */
var _wsEscHnd = null;
var _wsArmed  = false;  /* Close pressed once while dirty */

function _wsSizeSelect(field, value) {
    var out = '';
    for (var pt = WS_MIN_PT; pt <= WS_MAX_PT; pt++) {
        out += '<option value="' + pt + '"' + (pt === value ? ' selected' : '') + '>' +
               pt + ' ' + _wsT('wsPt') + '</option>';
    }
    return '<select class="ws-select" data-ws-size="' + field + '">' + out + '</select>';
}

function _wsSwatches(field, value) {
    return WS_PALETTE.map(function (sw) {
        /* The colour rides on a class, not an inline style: the global
           `button:not(...)` rule in mb-styles.css carries !important,
           which outranks any inline background. See the matching block
           of .ws-c-XXXXXX rules in that file. */
        return '<button type="button" class="ws-swatch ws-c-' + sw.hex + (sw.hex === value ? ' is-on' : '') +
               '" data-ws-color="' + field + '" data-ws-hex="' + sw.hex + '"' +
               ' title="' + _wsSwatchName(sw) + '" aria-label="' + _wsSwatchName(sw) + '"></button>';
    }).join('');
}

function _wsPreviewHTML(s) {
    var head = '#' + s.headingColor;
    var fill = '#' + s.tableHeaderColor;
    var onFill = '#' + wsContrastText(s.tableHeaderColor);
    /* Point sizes shown as points. The preview is an approximation of
       Word, not a rendering of it — its job is to answer "is that too
       big" before the user spends a minute on an export. */
    return '' +
        '<div class="ws-pv-line" style="font-size:' + s.titleSize   + 'pt;font-weight:700;color:' + head + '">' + _wsT('wsPvTitle')   + '</div>' +
        '<div class="ws-pv-line" style="font-size:' + s.sectionSize + 'pt;font-weight:700;color:' + head + '">' + _wsT('wsPvSection') + '</div>' +
        '<div class="ws-pv-line" style="font-size:' + s.subSize     + 'pt;font-weight:700;color:#1F4E78">' + _wsT('wsPvSub') + '</div>' +
        '<div class="ws-pv-line" style="font-size:' + s.bodySize    + 'pt;font-weight:700;color:' + head + '">' + _wsT('wsPvHeading') + '</div>' +
        '<div class="ws-pv-line" style="font-size:' + s.bodySize    + 'pt">' + _wsT('wsPvBody') + '</div>' +
        '<div class="ws-pv-th" style="background:' + fill + ';color:' + onFill + '">' + _wsT('wsPvTable') + '</div>' +
        '<div class="ws-pv-line" style="font-size:' + s.tableSize     + 'pt;margin-top:6px">' + _wsT('wsPvTableCell') + '</div>' +
        '<div class="ws-pv-line" style="font-size:' + s.userTableSize + 'pt">' + _wsT('wsPvUserCell') + '</div>';
}

function _wsRepaintPreview() {
    var pv = document.getElementById('ws-preview');
    if (pv) pv.innerHTML = _wsPreviewHTML(_wsDraft);
}

function _wsIsDirty() {
    return JSON.stringify(_wsDraft) !== JSON.stringify(_wsSaved);
}

/* Footer message line. Doubles as the save confirmation and the
   unsaved-changes warning, so the dialog never has to open a nested
   confirm — mbConfirm sits at z-index 10000 and this overlay at 10050,
   so a nested dialog would render BEHIND the settings modal. */
function _wsSetMsg(text, kind) {
    var el = document.getElementById('ws-msg');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'ws-msg' + (kind ? ' ws-msg-' + kind : '');
}

function _wsTouch() {
    _wsArmed = false;
    _wsRepaintPreview();
    var save = document.getElementById('ws-save');
    if (save) save.disabled = !_wsIsDirty();
    _wsSetMsg('');
}

function _wsSave() {
    wsWriteSettings(_wsDraft);
    _wsSaved = Object.assign({}, _wsDraft);
    _wsArmed = false;
    var save = document.getElementById('ws-save');
    if (save) save.disabled = true;
    _wsSetMsg('\u2713 ' + _wsT('wsSaved'), 'ok');
}

function openWordSettings() {
    if (document.getElementById('ws-overlay')) return;
    _wsDraft = wsReadSettings();
    _wsSaved = Object.assign({}, _wsDraft);
    _wsArmed = false;

    var rtl = !!(window.i18n && window.i18n.isRTL && window.i18n.isRTL());

    var ov = document.createElement('div');
    ov.id = 'ws-overlay';
    ov.className = 'ws-overlay';
    ov.setAttribute('dir', rtl ? 'rtl' : 'ltr');
    ov.innerHTML =
        '<div class="ws-modal" role="dialog" aria-modal="true" aria-labelledby="ws-head">' +
          '<div class="ws-head">' +
            '<span id="ws-head">\u2699\uFE0F ' + _wsT('wsTitle') + '</span>' +
            '<button type="button" class="ws-x" id="ws-close" aria-label="' + _wsT('wsClose') + '">\u00D7</button>' +
          '</div>' +
          '<div class="ws-body">' +
            '<p class="ws-note">\u2139\uFE0F ' + _wsT('wsIntro') + '</p>' +

            '<h4 class="ws-group">\uD83C\uDFA8 ' + _wsT('wsColors') + '</h4>' +
            '<div class="ws-row"><label>' + _wsT('wsHeadingColor') + '</label>' +
              '<div class="ws-swatches" id="ws-sw-heading">' + _wsSwatches('headingColor', _wsDraft.headingColor) + '</div></div>' +
            '<div class="ws-row"><label>' + _wsT('wsTableColor') + '</label>' +
              '<div class="ws-swatches" id="ws-sw-table">' + _wsSwatches('tableHeaderColor', _wsDraft.tableHeaderColor) + '</div></div>' +
            '<p class="ws-note ws-note-sm">\u2139\uFE0F ' + _wsT('wsContrastNote') + '</p>' +

            '<h4 class="ws-group">\uD83D\uDD24 ' + _wsT('wsSizes') + '</h4>' +
            '<div class="ws-row"><label>' + _wsT('wsTitleSize')   + '</label>' + _wsSizeSelect('titleSize',   _wsDraft.titleSize)   + '</div>' +
            '<div class="ws-row"><label>' + _wsT('wsSectionSize') + '</label>' + _wsSizeSelect('sectionSize', _wsDraft.sectionSize) + '</div>' +
            '<div class="ws-row"><label>' + _wsT('wsSubSize')     + '</label>' + _wsSizeSelect('subSize',     _wsDraft.subSize)     + '</div>' +
            '<div class="ws-row"><label>' + _wsT('wsBodySize')    + '</label>' + _wsSizeSelect('bodySize',    _wsDraft.bodySize)    + '</div>' +
            '<div class="ws-row"><label>' + _wsT('wsCoverSize')     + '</label>' + _wsSizeSelect('coverSize',     _wsDraft.coverSize)     + '</div>' +
            '<div class="ws-row"><label>' + _wsT('wsTableSize')     + '</label>' + _wsSizeSelect('tableSize',     _wsDraft.tableSize)     + '</div>' +
            '<div class="ws-row"><label>' + _wsT('wsUserTableSize') + '</label>' + _wsSizeSelect('userTableSize', _wsDraft.userTableSize) + '</div>' +
            '<p class="ws-note ws-note-sm">\u2139\uFE0F ' + _wsT('wsFixedNote') + '</p>' +

            '<div class="ws-row"><label>' + _wsT('wsPdfFont') + '</label>' +
              '<select class="ws-select" data-ws-font="pdfFont">' +
                WS_PDF_FONTS.map(function (f) {
                    return '<option value="' + f + '"' + (f === _wsDraft.pdfFont ? ' selected' : '') + '>' + f + '</option>';
                }).join('') +
              '</select></div>' +
            '<p class="ws-note ws-note-sm">\u2139\uFE0F ' + _wsT('wsPdfFontNote') + '</p>' +

            '<h4 class="ws-group">\uD83D\uDDA5\uFE0F ' + _wsT('wsHtmlGroup') + '</h4>' +
            '<div class="ws-checks">' +
              WS_HTML_SECTIONS.map(function (id) {
                  var on = !Array.isArray(_wsDraft.htmlSections) || _wsDraft.htmlSections.indexOf(id) !== -1;
                  return '<label class="ws-check"><input type="checkbox" data-ws-sec="' + id + '"' +
                         (on ? ' checked' : '') + '><span>' + _wsT('wsSec_' + id) + '</span></label>';
              }).join('') +
            '</div>' +
            '<p class="ws-note ws-note-sm">\u2139\uFE0F ' + _wsT('wsHtmlNote') + '</p>' +

            '<h4 class="ws-group">\uD83D\uDC41\uFE0F ' + _wsT('wsPreview') + '</h4>' +
            '<div class="ws-preview" id="ws-preview">' + _wsPreviewHTML(_wsDraft) + '</div>' +
          '</div>' +
          '<div class="ws-foot">' +
            '<button type="button" class="ws-btn ws-btn-ghost" id="ws-reset">' + _wsT('wsReset') + '</button>' +
            '<span class="ws-msg" id="ws-msg"></span>' +
            '<span class="ws-foot-right">' +
              '<button type="button" class="ws-btn ws-btn-ghost" id="ws-done">' + _wsT('wsClose') + '</button>' +
              '<button type="button" class="ws-btn ws-btn-primary" id="ws-save" disabled>' + _wsT('wsSave') + '</button>' +
            '</span>' +
          '</div>' +
        '</div>';

    document.body.appendChild(ov);

    ov.addEventListener('click', function (e) {
        if (e.target === ov) closeWordSettings();
    });
    document.getElementById('ws-close').addEventListener('click', closeWordSettings);
    document.getElementById('ws-done').addEventListener('click', closeWordSettings);
    document.getElementById('ws-save').addEventListener('click', _wsSave);

    document.getElementById('ws-reset').addEventListener('click', function () {
        /* Reset fills the DRAFT with the defaults. It still needs Save
           to take effect, so the button means the same thing everywhere
           in this dialog. */
        _wsDraft = Object.assign({}, WS_DEFAULTS);
        _wsTouch();
        /* Repaint the controls from the draft rather than rebuilding the
           dialog: rebuilding would drop focus and scroll position. */
        ov.querySelectorAll('[data-ws-size]').forEach(function (sel) {
            sel.value = String(_wsDraft[sel.getAttribute('data-ws-size')]);
        });
        var fsel = ov.querySelector('[data-ws-font]');
        if (fsel) fsel.value = _wsDraft.pdfFont;
        ov.querySelectorAll('[data-ws-sec]').forEach(function (cb) { cb.checked = true; });
        ov.querySelectorAll('[data-ws-color]').forEach(function (b) {
            var f = b.getAttribute('data-ws-color');
            b.classList.toggle('is-on', b.getAttribute('data-ws-hex') === _wsDraft[f]);
        });
    });

    ov.addEventListener('change', function (e) {
        var fontField = e.target && e.target.getAttribute && e.target.getAttribute('data-ws-font');
        if (fontField) {
            _wsDraft.pdfFont = (WS_PDF_FONTS.indexOf(e.target.value) !== -1)
                ? e.target.value : WS_DEFAULTS.pdfFont;
            _wsTouch();
            return;
        }
        var secField = e.target && e.target.getAttribute && e.target.getAttribute('data-ws-sec');
        if (secField) {
            var cur = Array.isArray(_wsDraft.htmlSections)
                ? _wsDraft.htmlSections.slice() : WS_HTML_SECTIONS.slice();
            var i = cur.indexOf(secField);
            if (e.target.checked) { if (i === -1) cur.push(secField); }
            else if (i !== -1) { cur.splice(i, 1); }
            /* Stored as an explicit list once touched, so a section
               added to the tool in future is NOT silently switched on
               for someone who had made a deliberate selection. */
            _wsDraft.htmlSections = cur;
            _wsTouch();
            return;
        }
        var f = e.target && e.target.getAttribute && e.target.getAttribute('data-ws-size');
        if (!f) return;
        _wsDraft[f] = _wsValidSize(e.target.value, WS_DEFAULTS[f]);
        _wsTouch();
    });

    ov.addEventListener('click', function (e) {
        var b = e.target && e.target.closest ? e.target.closest('[data-ws-color]') : null;
        if (!b) return;
        var f = b.getAttribute('data-ws-color');
        _wsDraft[f] = _wsValidColor(b.getAttribute('data-ws-hex'), WS_DEFAULTS[f]);
        b.parentNode.querySelectorAll('[data-ws-color]').forEach(function (o) {
            o.classList.remove('is-on');
        });
        b.classList.add('is-on');
        _wsTouch();
    });

    _wsEscHnd = function (e) { if (e.key === 'Escape') closeWordSettings(); };
    document.addEventListener('keydown', _wsEscHnd);
}

function closeWordSettings() {
    /* Two-step close when there is something to lose: the first press
       warns in the footer, the second discards. */
    if (_wsIsDirty() && !_wsArmed && document.getElementById('ws-overlay')) {
        _wsArmed = true;
        _wsSetMsg(_wsT('wsUnsaved'), 'warn');
        return;
    }
    var ov = document.getElementById('ws-overlay');
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
    if (_wsEscHnd) { document.removeEventListener('keydown', _wsEscHnd); _wsEscHnd = null; }
    _wsArmed = false;
}

/* The toolbar label carries no data-i18n, on purpose and for the same
   reason content.js gives: applyTranslations() would overwrite it from
   the main dictionary, which does not hold these keys. Repainted here
   instead, from this file's own table, on every language change. */
window.addEventListener('mb:langchange', function () {
    var span = document.querySelector('[data-act="openWordSettings"] span:not(.figma-btn-icon)');
    if (span) span.textContent = _wsT('wsButton');
});
