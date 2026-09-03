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

/* ── Export-centre strings ──────────────────────────────────
   Appended rather than woven into the three tables above: this is a
   later feature, and keeping its keys together means the day the dialog
   changes again the diff is one block per language rather than thirty
   scattered lines. */
Object.assign(_WS_STRINGS.en, {
    wsCenterTitle: 'Export Settings',
    navDoc:  'Word & PDF',
    navHtml: 'HTML',
    navPptx: 'PowerPoint',
    navLang: 'Language',
    navKeys: 'Shortcuts',
    wsLangTitle: 'Interface and export language',
    wsLangNote:  'This changes the tool, the exported document and this dialog at once. Your unsaved settings below are kept.',
    wsKeysTitle: 'Keyboard shortcuts',
    wsKeysNote:  'Every shortcut needs Ctrl (⌘ on a Mac), so none of them can fire while you are typing. Ctrl + S works inside a field too.'
});
Object.assign(_WS_STRINGS.fr, {
    wsCenterTitle: 'Réglages d\u2019export',
    navDoc:  'Word et PDF',
    navHtml: 'HTML',
    navPptx: 'PowerPoint',
    navLang: 'Langue',
    navKeys: 'Raccourcis',
    wsLangTitle: 'Langue de l\u2019interface et des exports',
    wsLangNote:  'Ceci change l\u2019outil, le document exporté et cette fenêtre en même temps. Vos réglages non enregistrés sont conservés.',
    wsKeysTitle: 'Raccourcis clavier',
    wsKeysNote:  'Chaque raccourci exige Ctrl (⌘ sur Mac) : aucun ne peut se déclencher pendant la saisie. Ctrl + S fonctionne aussi dans un champ.'
});
Object.assign(_WS_STRINGS.ar, {
    wsCenterTitle: 'إعدادات التصدير',
    navDoc:  'Word و PDF',
    navHtml: 'HTML',
    navPptx: 'باوربوينت',
    navLang: 'اللغة',
    navKeys: 'الاختصارات',
    wsLangTitle: 'لغة الواجهة والتصدير',
    wsLangNote:  'هذا يغيّر الأداة والمستند المُصدَّر وهذه النافذة معاً. وإعداداتك غير المحفوظة تبقى كما هي.',
    wsKeysTitle: 'اختصارات لوحة المفاتيح',
    wsKeysNote:  'كل اختصار يتطلّب Ctrl (أو ⌘ على ماك)، فلا يمكن أن ينطلق أثناء الكتابة. وCtrl + S يعمل داخل الحقول أيضاً.'
});

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

/* The PPTX pane edits its own draft, stored in its own key, because the
   two settings objects are validated against different tables and a
   corrupt slide field must not be able to take the Word export with it.
   They are nonetheless SAVED TOGETHER by the one button in the footer:
   the alternative — a Save per pane — means a user who changed
   something in two panes and pressed one of the buttons loses the other
   change without ever being told. */
var _pxDraft  = null;
var _pxSaved  = null;

/* Which pane is open, and whether the next open() should keep the
   current drafts. Set by the language pane, which has to rebuild the
   whole dialog to retranslate it and must not throw away work to do
   so. Not a parameter: events.js appends the element and the event to
   every action's arguments, so a positional flag on openWordSettings
   would arrive truthy on an ordinary toolbar click. */
var _wsPane   = 'doc';
var _wsKeep   = false;

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
    return JSON.stringify(_wsDraft) !== JSON.stringify(_wsSaved) ||
           JSON.stringify(_pxDraft) !== JSON.stringify(_pxSaved);
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
    if (typeof pxWriteSettings === 'function') pxWriteSettings(_pxDraft);
    _wsSaved = Object.assign({}, _wsDraft);
    _pxSaved = JSON.parse(JSON.stringify(_pxDraft));
    _wsArmed = false;
    var save = document.getElementById('ws-save');
    if (save) save.disabled = true;
    _wsSetMsg('\u2713 ' + _wsT('wsSaved'), 'ok');
}

/* ── The shell's own stylesheet ─────────────────────────────
   mb-styles.css already dresses .ws-modal, .ws-row, .ws-check and the
   rest; what it has never had is a two-column dialog. Those rules are
   injected here rather than added there for the same reason link_modal
   injects its own: a layout that exists in one dialog should not be
   able to move anything else in the tool, and the file that owns the
   dialog should own its geometry.

   Scoped to #ws-overlay throughout, and only classes this file
   introduces are styled — the panes inside keep whatever mb-styles.css
   already gives them. */
function _wsEnsureStyle() {
    if (document.getElementById('ws-shell-style')) return;
    var s = document.createElement('style');
    s.id = 'ws-shell-style';
    s.textContent = [
        /* The modal grows: a sidebar plus a pane needs the width, and a
           fixed height keeps the footer still while panes of very
           different lengths are switched under it. Without the fixed
           height the Save button jumps up and down as the user moves
           between Language (six lines) and Word (a preview and twelve
           rows). */
        '#ws-overlay .ws-modal{max-width:900px;width:min(94vw,900px);',
        'height:min(86vh,720px);display:flex;flex-direction:column;}',

        '#ws-overlay .ws-shell{display:flex;flex:1;min-height:0;}',

        /* The rail. Logical border so it lands on the inner edge in both
           directions without a second rule. */
        '#ws-overlay .ws-nav{flex:0 0 210px;display:flex;flex-direction:column;',
        'gap:2px;padding:14px 10px;overflow-y:auto;background:#f8fafc;',
        'border-inline-end:1px solid #e2e8f0;}',
        '#ws-overlay .ws-nav-btn{display:flex;align-items:center;gap:10px;',
        'width:100%;padding:9px 12px;border:none;border-radius:9px;',
        'background:transparent;color:#334155;font:inherit;font-size:.95em;',
        'text-align:start;cursor:pointer;transition:background .12s,color .12s;}',
        '#ws-overlay .ws-nav-btn:hover{background:#eef2ff;}',
        '#ws-overlay .ws-nav-btn.is-on{background:#e0e7ff;color:#3730a3;font-weight:600;}',
        '#ws-overlay .ws-nav-ico{flex:0 0 auto;font-size:1.05em;line-height:1;}',

        /* Only the pane scrolls. The head and the foot stay put, so the
           Save button is reachable without scrolling to the bottom of a
           long pane — which is exactly the complaint the old one-column
           dialog earned. */
        '#ws-overlay .ws-panes{flex:1;min-width:0;overflow-y:auto;padding:18px 22px;}',
        '#ws-overlay .ws-pane{display:none;}',
        '#ws-overlay .ws-pane.is-on{display:block;}',

        /* Controls that the panes introduce. */
        '#ws-overlay .ws-unit{color:#64748b;font-size:.9em;margin-inline-start:8px;}',
        '#ws-overlay .px-themes{display:flex;flex-wrap:wrap;gap:8px;}',
        '#ws-overlay .px-theme{display:inline-flex;align-items:center;gap:8px;',
        'padding:7px 12px;border:1px solid #e2e8f0;border-radius:10px;',
        'background:#fff;font:inherit;font-size:.9em;cursor:pointer;}',
        '#ws-overlay .px-theme:hover{border-color:#c7d2fe;}',
        '#ws-overlay .px-theme.is-on{border-color:#6366f1;background:#eef2ff;',
        'color:#3730a3;font-weight:600;box-shadow:inset 0 0 0 1px #6366f1;}',
        '#ws-overlay .px-theme-dot{width:14px;height:14px;border-radius:50%;',
        'flex:0 0 auto;}',

        /* The radio pills borrowed from link_modal.js, so the two
           dialogs do not disagree about what a radio looks like. */
        '#ws-overlay .ws-row.lm-row-type{display:flex;align-items:center;',
        'flex-wrap:wrap;gap:10px 16px;}',
        '#ws-overlay .lm-radios{display:flex;align-items:center;flex-wrap:wrap;gap:8px;}',
        '#ws-overlay .lm-radios .ws-check{display:inline-flex;align-items:center;',
        'gap:9px;margin:0;padding:7px 13px;min-height:38px;border:1px solid #e2e8f0;',
        'border-radius:10px;background:#fff;font-size:.93em;line-height:1;cursor:pointer;}',
        '#ws-overlay .lm-radios .ws-check:hover{border-color:#c7d2fe;background:#f8faff;}',
        '#ws-overlay .lm-radios .ws-check > input[type="radio"]{width:17px;height:17px;',
        'margin:0;flex:0 0 auto;accent-color:#6366f1;cursor:pointer;}',
        '#ws-overlay .lm-radios .ws-check:has(input:checked){border-color:#6366f1;',
        'background:#eef2ff;color:#3730a3;font-weight:600;box-shadow:inset 0 0 0 1px #6366f1;}',

        /* Language pane. */
        '#ws-overlay .ws-langs{display:flex;flex-wrap:wrap;gap:10px;}',
        '#ws-overlay .ws-lang{display:flex;flex-direction:column;gap:2px;',
        'padding:12px 18px;border:1px solid #e2e8f0;border-radius:12px;',
        'background:#fff;font:inherit;cursor:pointer;text-align:start;min-width:150px;}',
        '#ws-overlay .ws-lang:hover{border-color:#c7d2fe;}',
        '#ws-overlay .ws-lang.is-on{border-color:#6366f1;background:#eef2ff;',
        'color:#3730a3;box-shadow:inset 0 0 0 1px #6366f1;}',
        '#ws-overlay .ws-lang-name{font-weight:600;}',
        '#ws-overlay .ws-lang-code{font-size:.82em;opacity:.7;letter-spacing:.04em;}',

        /* Shortcuts pane. */
        '#ws-overlay .ws-keys{display:flex;flex-direction:column;gap:6px;}',
        '#ws-overlay .ws-key-row{display:flex;align-items:center;gap:14px;',
        'padding:9px 12px;border-radius:9px;background:#f8fafc;}',
        '#ws-overlay .ws-key-combo{flex:0 0 auto;min-width:120px;font-family:',
        'ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.9em;',
        'color:#3730a3;background:#e0e7ff;border-radius:7px;padding:4px 9px;',
        'text-align:center;direction:ltr;}',

        /* Below ~700px the rail becomes a strip of chips above the pane;
           a 210px sidebar on a phone leaves nothing for the settings. */
        '@media (max-width:700px){',
        '#ws-overlay .ws-shell{flex-direction:column;}',
        '#ws-overlay .ws-nav{flex:0 0 auto;flex-direction:row;overflow-x:auto;',
        'border-inline-end:none;border-bottom:1px solid #e2e8f0;padding:10px;}',
        '#ws-overlay .ws-nav-btn{width:auto;white-space:nowrap;}',
        '#ws-overlay .ws-nav-btn span:not(.ws-nav-ico){display:none;}',
        '#ws-overlay .ws-nav-btn.is-on span:not(.ws-nav-ico){display:inline;}}'
    ].join('');
    document.head.appendChild(s);
}

/* The rail. One array, so a pane cannot exist without a button or a
   button without a pane. */
var WS_PANES = [
    { id: 'doc',  icon: '\uD83D\uDCC4', key: 'navDoc'  },
    { id: 'html', icon: '\uD83D\uDDA5\uFE0F', key: 'navHtml' },
    { id: 'pptx', icon: '\uD83D\uDCCA', key: 'navPptx' },
    { id: 'lang', icon: '\uD83C\uDF10', key: 'navLang' },
    { id: 'keys', icon: '\u2328\uFE0F', key: 'navKeys' }
];

/* ── Panes ──────────────────────────────────────────────────
   Each returns markup and nothing else. The document and HTML panes are
   the old one-column body, cut in two along the seam it already had. */

function _wsPaneDoc() {
    return '' +
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

        '<h4 class="ws-group">\uD83D\uDC41\uFE0F ' + _wsT('wsPreview') + '</h4>' +
        '<div class="ws-preview" id="ws-preview">' + _wsPreviewHTML(_wsDraft) + '</div>';
}

function _wsPaneHtml() {
    return '' +
        '<h4 class="ws-group">\uD83D\uDDA5\uFE0F ' + _wsT('wsHtmlGroup') + '</h4>' +
        '<div class="ws-checks">' +
          WS_HTML_SECTIONS.map(function (id) {
              var on = !Array.isArray(_wsDraft.htmlSections) || _wsDraft.htmlSections.indexOf(id) !== -1;
              return '<label class="ws-check"><input type="checkbox" data-ws-sec="' + id + '"' +
                     (on ? ' checked' : '') + '><span>' + _wsT('wsSec_' + id) + '</span></label>';
          }).join('') +
        '</div>' +
        '<p class="ws-note ws-note-sm">\u2139\uFE0F ' + _wsT('wsHtmlNote') + '</p>';
}

/* The PPTX pane's markup and strings belong to exports_pptx.js. If that
   file is not loaded the pane says nothing rather than throwing —
   the dialog has to open even when one exporter is missing. */
function _wsPanePptx() {
    if (typeof mbPptxPaneHTML !== 'function' || !_pxDraft) return '';
    return mbPptxPaneHTML(_pxDraft);
}

/* The language pane DRIVES the existing menu rather than reimplementing
   it: it clicks .mb-lang-opt, which is the same path a click on the
   toolbar menu takes. One language mechanism, two ways in. */
function _wsPaneLang() {
    var cur = 'en';
    try { if (window.i18n && window.i18n.getLang) cur = window.i18n.getLang(); } catch (e) {}
    var names = { en: 'English', fr: 'Fran\u00e7ais', ar: '\u0627\u0644\u0639\u0631\u0628\u064a\u0629' };
    var btns = ['en', 'fr', 'ar'].map(function (code) {
        return '<button type="button" class="ws-lang' + (code === cur ? ' is-on' : '') +
               '" data-ws-lang="' + code + '">' +
               '<span class="ws-lang-name">' + names[code] + '</span>' +
               '<span class="ws-lang-code">' + code.toUpperCase() + '</span></button>';
    }).join('');
    return '<h4 class="ws-group">\uD83C\uDF10 ' + _wsT('wsLangTitle') + '</h4>' +
           '<div class="ws-langs">' + btns + '</div>' +
           '<p class="ws-note ws-note-sm">\u2139\uFE0F ' + _wsT('wsLangNote') + '</p>';
}

/* Built from MB_SHORTCUTS — the same array the listener reads, so a
   printed shortcut cannot outlive the binding behind it. */
function _wsPaneKeys() {
    if (typeof MB_SHORTCUTS === 'undefined') return '';
    var lang = 'en';
    try { if (window.i18n && window.i18n.getLang) lang = window.i18n.getLang(); } catch (e) {}
    var rows = MB_SHORTCUTS.map(function (sc) {
        return '<div class="ws-key-row"><span class="ws-key-combo">' +
               mbShortcutText(sc) + '</span><span>' + mbShortcutLabel(sc, lang) + '</span></div>';
    }).join('');
    return '<h4 class="ws-group">\u2328\uFE0F ' + _wsT('wsKeysTitle') + '</h4>' +
           '<div class="ws-keys">' + rows + '</div>' +
           '<p class="ws-note ws-note-sm">\u2139\uFE0F ' + _wsT('wsKeysNote') + '</p>';
}

function _wsPaneHTMLFor(id) {
    if (id === 'doc')  return _wsPaneDoc();
    if (id === 'html') return _wsPaneHtml();
    if (id === 'pptx') return _wsPanePptx();
    if (id === 'lang') return _wsPaneLang();
    if (id === 'keys') return _wsPaneKeys();
    return '';
}

function _wsShowPane(id) {
    _wsPane = id;
    var ov = document.getElementById('ws-overlay');
    if (!ov) return;
    ov.querySelectorAll('.ws-pane').forEach(function (p) {
        p.classList.toggle('is-on', p.getAttribute('data-pane') === id);
    });
    ov.querySelectorAll('.ws-nav-btn').forEach(function (b) {
        var on = b.getAttribute('data-ws-pane') === id;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    var panes = ov.querySelector('.ws-panes');
    if (panes) panes.scrollTop = 0;
}

/* Reopen in the new language, keeping both drafts and the open pane.
   The alternative — translating in place — would mean every label in
   every pane needing an id, and one missed id showing the old language
   until the dialog is closed. */
function _wsReopen(pane) {
    _wsKeep = true;
    _wsPane = pane || _wsPane;
    closeWordSettings();          /* _wsKeep also suppresses the guard */
    openWordSettings();
}

function openWordSettings() {
    if (document.getElementById('ws-overlay')) return;

    /* A reopen carries the drafts across; an ordinary open reads them
       fresh from storage. */
    if (!_wsKeep || !_wsDraft) {
        _wsDraft = wsReadSettings();
        _wsSaved = Object.assign({}, _wsDraft);
        _pxDraft = (typeof pxReadSettings === 'function') ? pxReadSettings() : null;
        _pxSaved = _pxDraft ? JSON.parse(JSON.stringify(_pxDraft)) : null;
        _wsPane  = _wsKeep ? _wsPane : 'doc';
    }
    _wsKeep = false;
    _wsArmed = false;

    _wsEnsureStyle();

    var rtl = !!(window.i18n && window.i18n.isRTL && window.i18n.isRTL());

    var ov = document.createElement('div');
    ov.id = 'ws-overlay';
    ov.className = 'ws-overlay';
    ov.setAttribute('dir', rtl ? 'rtl' : 'ltr');

    var nav = WS_PANES.map(function (p) {
        return '<button type="button" class="ws-nav-btn' + (p.id === _wsPane ? ' is-on' : '') +
               '" data-ws-pane="' + p.id + '" role="tab" aria-selected="' +
               (p.id === _wsPane ? 'true' : 'false') + '">' +
               '<span class="ws-nav-ico" aria-hidden="true">' + p.icon + '</span>' +
               '<span>' + _wsT(p.key) + '</span></button>';
    }).join('');

    var panes = WS_PANES.map(function (p) {
        return '<section class="ws-pane' + (p.id === _wsPane ? ' is-on' : '') +
               '" data-pane="' + p.id + '" role="tabpanel">' + _wsPaneHTMLFor(p.id) + '</section>';
    }).join('');

    ov.innerHTML =
        '<div class="ws-modal" role="dialog" aria-modal="true" aria-labelledby="ws-head">' +
          '<div class="ws-head">' +
            '<span id="ws-head">\u2699\uFE0F ' + _wsT('wsCenterTitle') + '</span>' +
            '<button type="button" class="ws-x" id="ws-close" aria-label="' + _wsT('wsClose') + '">\u00D7</button>' +
          '</div>' +
          '<div class="ws-shell">' +
            '<nav class="ws-nav" role="tablist" aria-label="' + _wsT('wsCenterTitle') + '">' + nav + '</nav>' +
            '<div class="ws-panes">' + panes + '</div>' +
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

    /* A reopen after a language change lands with drafts that differ
       from what is stored, so the footer has to reflect that at once
       rather than waiting for the next keystroke. */
    var save = document.getElementById('ws-save');
    if (save) save.disabled = !_wsIsDirty();

    ov.addEventListener('click', function (e) {
        if (e.target === ov) closeWordSettings();
    });
    document.getElementById('ws-close').addEventListener('click', closeWordSettings);
    document.getElementById('ws-done').addEventListener('click', closeWordSettings);
    document.getElementById('ws-save').addEventListener('click', _wsSave);

    document.getElementById('ws-reset').addEventListener('click', function () {
        /* Reset fills the DRAFTS with the defaults — both of them, since
           one button in the footer means one meaning of Reset. It still
           needs Save to take effect, so the button says the same thing
           everywhere in this dialog. */
        _wsDraft = Object.assign({}, WS_DEFAULTS);
        if (typeof PX_DEFAULTS === 'object') _pxDraft = JSON.parse(JSON.stringify(PX_DEFAULTS));
        _wsTouch();
        /* Repaint the controls from the drafts rather than rebuilding
           the dialog: rebuilding would drop focus and scroll position. */
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
        /* The PPTX pane has enough controls that setting each one by
           hand here would be a second place to forget a field. It is
           rebuilt from the draft instead — it holds no focus worth
           preserving, unlike the pane the user is standing on. */
        var pp = ov.querySelector('[data-pane="pptx"]');
        if (pp) pp.innerHTML = _wsPanePptx();
    });

    ov.addEventListener('change', function (e) {
        /* PPTX first: its fields carry their own attributes and the
           function reports whether the event was one of its own. */
        if (_pxDraft && typeof mbPptxPaneChange === 'function' && mbPptxPaneChange(e, _pxDraft)) {
            _wsTouch();
            return;
        }
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
        /* Rail. */
        var navBtn = e.target && e.target.closest ? e.target.closest('[data-ws-pane]') : null;
        if (navBtn) { _wsShowPane(navBtn.getAttribute('data-ws-pane')); return; }

        /* Language. The menu in the toolbar is the one implementation;
           this clicks it, then rebuilds the dialog in the new language
           with both drafts intact. */
        var langBtn = e.target && e.target.closest ? e.target.closest('[data-ws-lang]') : null;
        if (langBtn) {
            var code = langBtn.getAttribute('data-ws-lang');
            var opt = document.querySelector('.mb-lang-opt[data-lang="' + code + '"]');
            if (opt) opt.click();
            /* One frame for the i18n pass and every listener on
               mb:langchange to finish writing before the dialog is
               rebuilt from the new strings. */
            requestAnimationFrame(function () { _wsReopen('lang'); });
            return;
        }

        if (_pxDraft && typeof mbPptxPaneClick === 'function' && mbPptxPaneClick(e, _pxDraft)) {
            _wsTouch();
            return;
        }

        var b = e.target && e.target.closest ? e.target.closest('[data-ws-color]') : null;
        if (!b) return;
        var cf = b.getAttribute('data-ws-color');
        _wsDraft[cf] = _wsValidColor(b.getAttribute('data-ws-hex'), WS_DEFAULTS[cf]);
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
       warns in the footer, the second discards. _wsKeep means this is a
       rebuild, not a close — the drafts are carried straight into the
       next open, so warning about them would be a lie. */
    if (!_wsKeep && _wsIsDirty() && !_wsArmed && document.getElementById('ws-overlay')) {
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
