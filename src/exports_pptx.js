// ============================================================
// /src/exports_pptx.js
// PowerPoint export — a TEACHING deck, not a copy of the document.
//
// ── WHAT THIS FILE IS FOR ───────────────────────────────────
// Word and PDF produce the trainee's manual: everything, in order,
// including the covers and the assessment forms. A slide deck has a
// different job — it is what the trainer stands in front of. So this
// exporter deliberately DROPS the covers, the work team, the references
// and the assessment forms, and keeps the four things a trainer
// actually projects: the module title, the outcomes with their
// performance criteria, the content-card headings, and the activity
// steps.
//
// ── THE ARABIC BULLET, AND WHY rtlMode IS REPEATED ──────────
// PptxGenJS writes rtl="1" into <a:pPr> from the options of the
// PARAGRAPH. When the text of a shape is an ARRAY, each item's own
// options become that paragraph's properties — so setting rtlMode once
// on the shape produces
//
//     <a:pPr algn="r" marL="342900" indent="-342900">     ← no rtl="1"
//
// right-ALIGNED but not right-to-LEFT, and PowerPoint then hangs the
// bullet off the left of the line. Proven in PowerPoint, not guessed.
// Hence _pxLine(): every list item carries rtlMode itself, and nothing
// in this file builds a text array by hand.
//
// lang is set on every run for the same class of reason: without it
// PptxGenJS stamps lang="en-US", which makes PowerPoint's spellchecker
// underline an entire Arabic deck and can push it to substitute a Latin
// face for complex-script text.
//
// ── DIACRITICS ──────────────────────────────────────────────
// None are added, ever. What the author typed is what ships, harakat or
// no harakat. That is a decision, not an omission.
//
// ── STORAGE ─────────────────────────────────────────────────
// Its own key, read through mbGetSetting/mbSetSetting like every other
// setting in the tool. Validation happens on READ, per field, so a
// hand-edited or half-written value costs that one field and never the
// export.
// ============================================================

/* The CDN copy is fetched on FIRST EXPORT, not at page load. PptxGenJS
   is ~1 MB; every user pays for it in the <head>, and only the ones who
   press this button need it. The three libraries the page does load
   eagerly (docx, jspdf) are there because they predate this decision —
   not because eager is right. */
var PX_CDN = 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js';

/* ── Strings ────────────────────────────────────────────────
   This file owns its own table, the same way word_settings.js and
   content.js own theirs: a pane that only exists here must not be able
   to come out untranslated because a key was missed in a 124 KB
   dictionary. */
var _PX_STRINGS = {
    en: {
        btn: 'Export to PPTX',
        pane: 'PowerPoint',
        intro: 'These settings control the slide deck only. Word, PDF and HTML are unaffected.',
        gInclude: 'What goes in',
        sec_title: 'Module title slide',
        sec_outcomes: 'Learning outcomes and performance criteria',
        sec_cards: 'Content-card slides',
        sec_selfcheck: 'Self-check: question slide, then answer slide',
        sec_steps: 'Activity steps',
        excludedNote: 'Covers, work team, references and assessment forms are never included — a deck is what the trainer projects, not the trainee\u2019s manual.',
        gCards: 'Content cards',
        cardMode: 'Card text',
        cardSlide: 'On the slide',
        cardNotes: 'In the speaker notes',
        cardTitle: 'Heading only',
        cardModeNote: 'Speaker notes keep the slide clean and give the trainer the wording. On the slide is better for a deck that is handed out.',
        firstImage: 'Include the first image of each card',
        gSteps: 'Activity steps',
        stepsThreshold: 'One slide per step, up to',
        stepsUnit: 'steps',
        stepsNote: 'Above this count the steps become a numbered list, split across slides. The author does not know in advance how many steps they will write, which is why this is a threshold and not a choice between two layouts.',
        gLook: 'Appearance',
        theme: 'Colour theme',
        font: 'Slide font',
        fontNote: 'Auto uses Arial for Arabic and Calibri otherwise. The name is written into the file; the font itself must exist on the machine that opens it.',
        maxLines: 'Maximum lines per slide',
        maxLinesNote: 'Longer lists continue on a following slide rather than overflowing the one they are on.',
        th_indigo: 'Indigo', th_slate: 'Slate', th_teal: 'Teal', th_plum: 'Plum',
        contd: '(cont.)',
        criteria: 'Performance criteria',
        selfCheck: 'Self-check',
        answers: 'Answer key',
        steps: 'Steps',
        resources: 'Materials and equipment',
        duration: 'Duration',
        exporting: '\u23F3 Building the slide deck\u2026',
        loading: '\u23F3 Loading the PowerPoint library\u2026',
        done: '\u2705 Slide deck exported',
        failed: '\u274C PPTX export failed: ',
        noLib: 'The PowerPoint library could not be loaded. Check the connection and try again.'
    },
    fr: {
        btn: 'Exporter en PPTX',
        pane: 'PowerPoint',
        intro: 'Ces réglages ne concernent que le diaporama. Word, PDF et HTML ne changent pas.',
        gInclude: 'Contenu inclus',
        sec_title: 'Diapositive de titre du module',
        sec_outcomes: 'Résultats d\u2019apprentissage et critères de performance',
        sec_cards: 'Diapositives des fiches de contenu',
        sec_selfcheck: 'Auto-évaluation : diapositive question, puis réponse',
        sec_steps: 'Étapes de l\u2019activité',
        excludedNote: 'Les couvertures, l\u2019équipe de travail, les références et les formulaires d\u2019évaluation ne sont jamais inclus : un diaporama est ce que le formateur projette, pas le manuel du stagiaire.',
        gCards: 'Fiches de contenu',
        cardMode: 'Texte de la fiche',
        cardSlide: 'Sur la diapositive',
        cardNotes: 'Dans les notes du présentateur',
        cardTitle: 'Titre seul',
        cardModeNote: 'Les notes gardent la diapositive épurée et donnent la formulation au formateur. Sur la diapositive convient mieux à un diaporama distribué.',
        firstImage: 'Inclure la première image de chaque fiche',
        gSteps: 'Étapes de l\u2019activité',
        stepsThreshold: 'Une diapositive par étape, jusqu\u2019à',
        stepsUnit: 'étapes',
        stepsNote: 'Au-delà, les étapes deviennent une liste numérotée répartie sur plusieurs diapositives. L\u2019auteur ignore à l\u2019avance combien d\u2019étapes il écrira : d\u2019où un seuil plutôt qu\u2019un choix entre deux mises en page.',
        gLook: 'Apparence',
        theme: 'Thème de couleur',
        font: 'Police des diapositives',
        fontNote: 'Auto utilise Arial pour l\u2019arabe et Calibri sinon. Le nom est inscrit dans le fichier ; la police doit exister sur la machine qui l\u2019ouvre.',
        maxLines: 'Nombre maximal de lignes par diapositive',
        maxLinesNote: 'Les listes plus longues continuent sur la diapositive suivante au lieu de déborder.',
        th_indigo: 'Indigo', th_slate: 'Ardoise', th_teal: 'Sarcelle', th_plum: 'Prune',
        contd: '(suite)',
        criteria: 'Critères de performance',
        selfCheck: 'Auto-évaluation',
        answers: 'Corrigé',
        steps: 'Étapes',
        resources: 'Matériel et équipement',
        duration: 'Durée',
        exporting: '\u23F3 Création du diaporama\u2026',
        loading: '\u23F3 Chargement de la bibliothèque PowerPoint\u2026',
        done: '\u2705 Diaporama exporté',
        failed: '\u274C Échec de l\u2019export PPTX : ',
        noLib: 'La bibliothèque PowerPoint n\u2019a pas pu être chargée. Vérifiez la connexion et réessayez.'
    },
    ar: {
        btn: 'تصدير PPTX',
        pane: 'باوربوينت',
        intro: 'هذه الإعدادات تخصّ العرض التقديمي وحده. ولا يتأثّر بها Word ولا PDF ولا HTML.',
        gInclude: 'ما يُدرَج',
        sec_title: 'شريحة عنوان الوحدة',
        sec_outcomes: 'نواتج التعلّم ومعايير الأداء',
        sec_cards: 'شرائح بطاقات المحتوى',
        sec_selfcheck: 'التحقّق الذاتي: شريحة سؤال ثم شريحة إجابة',
        sec_steps: 'خطوات النشاط',
        excludedNote: 'الأغلفة وفريق العمل والمراجع ونماذج التقييم لا تُدرَج أبداً — العرض ما يعرضه المدرّب، لا دليل المتدرّب.',
        gCards: 'بطاقات المحتوى',
        cardMode: 'نصّ البطاقة',
        cardSlide: 'على الشريحة',
        cardNotes: 'في ملاحظات المحاضر',
        cardTitle: 'العنوان فقط',
        cardModeNote: 'الملاحظات تُبقي الشريحة نظيفة وتمنح المدرّب الصياغة. ووضع النصّ على الشريحة أنسب لعرض يُوزَّع على المتدرّبين.',
        firstImage: 'إدراج أول صورة من كل بطاقة',
        gSteps: 'خطوات النشاط',
        stepsThreshold: 'شريحة لكل خطوة، حتى',
        stepsUnit: 'خطوات',
        stepsNote: 'وفوق هذا العدد تتحوّل الخطوات إلى قائمة مرقّمة موزّعة على شرائح. صانع الوحدة لا يعرف مسبقاً كم خطوة سيكتب، ولهذا هي عتبة لا اختيار بين تخطيطين.',
        gLook: 'المظهر',
        theme: 'قالب الألوان',
        font: 'خط الشرائح',
        fontNote: 'الوضع التلقائي يستخدم Arial للعربية وCalibri لغيرها. الاسم يُكتب داخل الملف، والخط نفسه يجب أن يكون موجوداً على الجهاز الذي يفتحه.',
        maxLines: 'أقصى عدد أسطر في الشريحة',
        maxLinesNote: 'القوائم الأطول تكمل في شريحة تالية بدل أن تفيض عن حدود شريحتها.',
        th_indigo: 'نيلي', th_slate: 'رمادي', th_teal: 'أزرق مخضرّ', th_plum: 'برقوقي',
        contd: '(تابع)',
        criteria: 'معايير الأداء',
        selfCheck: 'التحقّق الذاتي',
        answers: 'مفتاح الإجابة',
        steps: 'الخطوات',
        resources: 'المواد والتجهيزات',
        duration: 'المدة',
        exporting: '\u23F3 جارٍ بناء العرض التقديمي\u2026',
        loading: '\u23F3 جارٍ تحميل مكتبة باوربوينت\u2026',
        done: '\u2705 تمّ تصدير العرض التقديمي',
        failed: '\u274C فشل تصدير PPTX: ',
        noLib: 'تعذّر تحميل مكتبة باوربوينت. تحقّق من الاتصال وأعد المحاولة.'
    }
};

function _pxUiLang() {
    try {
        if (typeof window !== 'undefined' && window.i18n && typeof window.i18n.getLang === 'function') {
            var l = window.i18n.getLang();
            if (_PX_STRINGS[l]) return l;
        }
    } catch (e) { /* dictionary not up */ }
    return 'en';
}

/** Interface language by default; pass one for export-time strings,
    which follow the EXPORT language and not the screen. */
function pxT(key, lang) {
    var table = _PX_STRINGS[lang || _pxUiLang()] || _PX_STRINGS.en;
    return table[key] || _PX_STRINGS.en[key] || key;
}

/* ── Settings ───────────────────────────────────────────────
   Deliberately a SEPARATE key from mb_word_export_settings. Those two
   objects are validated field by field against different tables, and
   merging them would mean a corrupt PPTX field could take the Word
   export down with it. */
var PX_KEY = 'mb_pptx_export_settings';

var PX_SECTIONS = ['title', 'outcomes', 'cards', 'selfcheck', 'steps'];

var PX_FONTS = ['Auto', 'Cairo', 'Arial', 'Calibri'];

/* Four themes, each a complete set rather than one accent colour, so no
   combination can produce grey text on a grey slide. `text` is checked
   against `bg` at design time, not computed at run time — the palette
   is fixed and small enough that a contrast function would only be
   machinery around four known-good answers. */
var PX_THEMES = {
    indigo: { bg: 'FFFFFF', title: '312E81', body: '334155', accent: '4F46E5', soft: 'EEF2FF' },
    slate:  { bg: 'FFFFFF', title: '0F172A', body: '334155', accent: '475569', soft: 'F1F5F9' },
    teal:   { bg: 'FFFFFF', title: '134E4A', body: '334155', accent: '0D9488', soft: 'ECFDF5' },
    plum:   { bg: 'FFFFFF', title: '4A044E', body: '3F3F46', accent: '9333EA', soft: 'FAF5FF' }
};

var PX_DEFAULTS = {
    /* null = everything, matching the htmlSections convention in
       word_settings.js. Once the user touches a box the list becomes
       explicit, so a section added to the tool later is NOT silently
       switched on for someone who made a deliberate selection. */
    sections:       null,
    /* 'slide' by decision: the tool's users hand the deck out. */
    cardMode:       'slide',
    firstImage:     true,
    stepsThreshold: 8,
    maxLines:       6,
    theme:          'indigo',
    font:           'Auto'
};

var PX_MIN_LINES = 4,  PX_MAX_LINES = 12;
var PX_MIN_STEPS = 3,  PX_MAX_STEPS = 20;

function _pxInt(v, min, max, fallback) {
    var n = parseInt(v, 10);
    if (!isFinite(n) || n < min || n > max) return fallback;
    return n;
}

function pxReadSettings() {
    var raw = null;
    try {
        if (typeof mbGetSetting === 'function') {
            var key = (typeof MB_KEYS === 'object' && MB_KEYS.pptxExport) || PX_KEY;
            raw = mbGetSetting(key);
        }
    } catch (e) { raw = null; }

    var o = {};
    if (raw) { try { o = JSON.parse(raw) || {}; } catch (e) { o = {}; } }
    if (typeof o !== 'object' || o === null) o = {};

    return {
        /* A corrupted list falls back to "everything", never to
           "nothing": the failure mode has to be a complete deck. */
        sections: Array.isArray(o.sections)
            ? o.sections.filter(function (x) { return PX_SECTIONS.indexOf(x) !== -1; })
            : null,
        cardMode: (['slide', 'notes', 'title'].indexOf(o.cardMode) !== -1)
            ? o.cardMode : PX_DEFAULTS.cardMode,
        firstImage: (typeof o.firstImage === 'boolean') ? o.firstImage : PX_DEFAULTS.firstImage,
        stepsThreshold: _pxInt(o.stepsThreshold, PX_MIN_STEPS, PX_MAX_STEPS, PX_DEFAULTS.stepsThreshold),
        maxLines: _pxInt(o.maxLines, PX_MIN_LINES, PX_MAX_LINES, PX_DEFAULTS.maxLines),
        theme: PX_THEMES[o.theme] ? o.theme : PX_DEFAULTS.theme,
        font: (PX_FONTS.indexOf(o.font) !== -1) ? o.font : PX_DEFAULTS.font
    };
}

function pxWriteSettings(s) {
    try {
        if (typeof mbSetSetting === 'function') {
            var key = (typeof MB_KEYS === 'object' && MB_KEYS.pptxExport) || PX_KEY;
            return mbSetSetting(key, JSON.stringify(s));
        }
    } catch (e) { /* storage unavailable — the dialog still works in-session */ }
    return false;
}

function pxIncludes(cfg, id) {
    if (!Array.isArray(cfg.sections)) return true;
    return cfg.sections.indexOf(id) !== -1;
}

/* ── The settings pane ──────────────────────────────────────
   The markup and the strings live here rather than in the dialog, so
   this feature stays in one file: word_settings.js asks for a pane and
   hands back changes, and knows nothing about what is on it. */
function mbPptxPaneHTML(d) {
    var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); };

    var checks = PX_SECTIONS.map(function (id) {
        var on = !Array.isArray(d.sections) || d.sections.indexOf(id) !== -1;
        return '<label class="ws-check"><input type="checkbox" data-px-sec="' + id + '"' +
               (on ? ' checked' : '') + '><span>' + esc(pxT('sec_' + id)) + '</span></label>';
    }).join('');

    var modes = [['slide', 'cardSlide'], ['notes', 'cardNotes'], ['title', 'cardTitle']]
        .map(function (m) {
            return '<label class="ws-check"><input type="radio" name="px-cardmode" value="' + m[0] + '"' +
                   (d.cardMode === m[0] ? ' checked' : '') + '><span>' + esc(pxT(m[1])) + '</span></label>';
        }).join('');

    var themes = Object.keys(PX_THEMES).map(function (k) {
        var t = PX_THEMES[k];
        return '<button type="button" class="px-theme' + (d.theme === k ? ' is-on' : '') +
               '" data-px-theme="' + k + '" title="' + esc(pxT('th_' + k)) + '">' +
               '<span class="px-theme-dot" style="background:#' + t.accent + '"></span>' +
               '<span>' + esc(pxT('th_' + k)) + '</span></button>';
    }).join('');

    var fonts = PX_FONTS.map(function (f) {
        return '<option value="' + f + '"' + (d.font === f ? ' selected' : '') + '>' + f + '</option>';
    }).join('');

    var num = function (field, val, min, max) {
        var out = '';
        for (var i = min; i <= max; i++) {
            out += '<option value="' + i + '"' + (i === val ? ' selected' : '') + '>' + i + '</option>';
        }
        return '<select class="ws-select" data-px-num="' + field + '">' + out + '</select>';
    };

    return '' +
      '<p class="ws-note">\u2139\uFE0F ' + esc(pxT('intro')) + '</p>' +

      '<h4 class="ws-group">\uD83D\uDCCB ' + esc(pxT('gInclude')) + '</h4>' +
      '<div class="ws-checks">' + checks + '</div>' +
      '<p class="ws-note ws-note-sm">\u2139\uFE0F ' + esc(pxT('excludedNote')) + '</p>' +

      '<h4 class="ws-group">\uD83D\uDCC4 ' + esc(pxT('gCards')) + '</h4>' +
      '<div class="ws-row lm-row-type"><label>' + esc(pxT('cardMode')) + '</label>' +
        '<div class="lm-radios" role="radiogroup">' + modes + '</div></div>' +
      '<p class="ws-note ws-note-sm">\u2139\uFE0F ' + esc(pxT('cardModeNote')) + '</p>' +
      '<div class="ws-checks"><label class="ws-check"><input type="checkbox" data-px-bool="firstImage"' +
        (d.firstImage ? ' checked' : '') + '><span>' + esc(pxT('firstImage')) + '</span></label></div>' +

      '<h4 class="ws-group">\uD83E\uDDF0 ' + esc(pxT('gSteps')) + '</h4>' +
      '<div class="ws-row"><label>' + esc(pxT('stepsThreshold')) + '</label>' +
        num('stepsThreshold', d.stepsThreshold, PX_MIN_STEPS, PX_MAX_STEPS) +
        '<span class="ws-unit">' + esc(pxT('stepsUnit')) + '</span></div>' +
      '<p class="ws-note ws-note-sm">\u2139\uFE0F ' + esc(pxT('stepsNote')) + '</p>' +

      '<h4 class="ws-group">\uD83C\uDFA8 ' + esc(pxT('gLook')) + '</h4>' +
      '<div class="ws-row"><label>' + esc(pxT('theme')) + '</label>' +
        '<div class="px-themes">' + themes + '</div></div>' +
      '<div class="ws-row"><label>' + esc(pxT('font')) + '</label>' +
        '<select class="ws-select" data-px-font="1">' + fonts + '</select></div>' +
      '<p class="ws-note ws-note-sm">\u2139\uFE0F ' + esc(pxT('fontNote')) + '</p>' +
      '<div class="ws-row"><label>' + esc(pxT('maxLines')) + '</label>' +
        num('maxLines', d.maxLines, PX_MIN_LINES, PX_MAX_LINES) + '</div>' +
      '<p class="ws-note ws-note-sm">\u2139\uFE0F ' + esc(pxT('maxLinesNote')) + '</p>';
}

/** Applies one change event to the draft. Returns true when the draft
    actually changed, so the dialog can leave the Save button alone for
    events that were not ours. */
function mbPptxPaneChange(e, d) {
    var t = e.target;
    if (!t || !t.getAttribute) return false;

    var sec = t.getAttribute('data-px-sec');
    if (sec) {
        var cur = Array.isArray(d.sections) ? d.sections.slice() : PX_SECTIONS.slice();
        var i = cur.indexOf(sec);
        if (t.checked) { if (i === -1) cur.push(sec); }
        else if (i !== -1) { cur.splice(i, 1); }
        d.sections = cur;
        return true;
    }
    if (t.name === 'px-cardmode') { d.cardMode = t.value; return true; }
    var b = t.getAttribute('data-px-bool');
    if (b) { d[b] = !!t.checked; return true; }
    var n = t.getAttribute('data-px-num');
    if (n === 'maxLines')       { d.maxLines = _pxInt(t.value, PX_MIN_LINES, PX_MAX_LINES, PX_DEFAULTS.maxLines); return true; }
    if (n === 'stepsThreshold') { d.stepsThreshold = _pxInt(t.value, PX_MIN_STEPS, PX_MAX_STEPS, PX_DEFAULTS.stepsThreshold); return true; }
    if (t.getAttribute('data-px-font')) {
        d.font = (PX_FONTS.indexOf(t.value) !== -1) ? t.value : PX_DEFAULTS.font;
        return true;
    }
    return false;
}

/** Theme swatches are buttons, not inputs, so they arrive as clicks. */
function mbPptxPaneClick(e, d) {
    var b = e.target && e.target.closest ? e.target.closest('[data-px-theme]') : null;
    if (!b) return false;
    var k = b.getAttribute('data-px-theme');
    if (!PX_THEMES[k]) return false;
    d.theme = k;
    b.parentNode.querySelectorAll('[data-px-theme]').forEach(function (o) { o.classList.remove('is-on'); });
    b.classList.add('is-on');
    return true;
}

/* ── Text ───────────────────────────────────────────────────
   The model carries the author's rich text as HTML, because that is
   what a contenteditable produces. A slide takes plain lines, so the
   markup is turned into line breaks BEFORE the text ever reaches
   PptxGenJS — a stray <div> printed literally on a slide is the kind of
   defect a trainer discovers in front of a room. */
function _pxLines(html) {
    if (!html) return [];
    var s = String(html);
    if (typeof document !== 'undefined') {
        var d = document.createElement('div');
        /* Block ends become newlines first; without this, two paragraphs
           collapse into one run-on line. */
        d.innerHTML = s.replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
                       .replace(/<br\s*\/?>/gi, '\n');
        s = d.textContent || '';
    } else {
        s = s.replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
             .replace(/<br\s*\/?>/gi, '\n')
             .replace(/<[^>]+>/g, '');
    }
    return s.replace(/\u00A0/g, ' ')
            .split('\n')
            .map(function (x) { return x.trim(); })
            .filter(Boolean);
}

/** Splits an array into slabs of at most n. One place, so every list in
    the deck obeys the same maximum. */
function _pxChunk(arr, n) {
    var out = [];
    for (var i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
}

/** A data URL as PptxGenJS wants it: the `data:` scheme prefix removed,
    the media type and base64 payload kept. */
function _pxImageData(src) {
    var s = String(src || '');
    if (!s) return null;
    if (s.indexOf('data:') === 0) return s.slice(5);
    return null;                     /* not embedded — nothing to place */
}

/* ── The deck ───────────────────────────────────────────────
   Pure: it takes a model, a settings object and the PptxGenJS
   constructor, and returns a presentation. No DOM, no storage, no
   download — which is what makes it runnable outside a browser, and
   that is how the Arabic was verified before any of this shipped. */
function mbBuildPptxDeck(model, cfg, PptxGen) {
    var p = new PptxGen();
    p.layout = 'LAYOUT_WIDE';                       /* 13.3in × 7.5in */

    var L = model.lang, rtl = !!model.rtl;
    var th = PX_THEMES[cfg.theme] || PX_THEMES.indigo;
    var face = (cfg.font === 'Auto') ? (rtl ? 'Arial' : 'Calibri') : cfg.font;

    /* Every text option in this file starts here, so no slide can end up
       left-aligned in an Arabic deck because one call forgot. */
    function base(extra) {
        var o = {
            fontFace: face,
            isTextBox: true,
            rtlMode: rtl,
            align: rtl ? 'right' : 'left',
            lang: rtl ? 'ar-SA' : (L === 'fr' ? 'fr-FR' : 'en-US')
        };
        for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) o[k] = extra[k];
        return o;                       /* a FRESH object every call —
                                           PptxGenJS mutates what it is
                                           given, converting to EMU */
    }

    /* THE bullet fix. rtlMode and align live on the ITEM, because the
       item's options become the paragraph's <a:pPr>. */
    function line(text, last, numbered) {
        return {
            text: text,
            options: {
                bullet: numbered ? { type: 'number' } : true,
                rtlMode: rtl,
                align: rtl ? 'right' : 'left',
                breakLine: !last
            }
        };
    }

    function slide() {
        var s = p.addSlide();
        s.background = { color: th.bg };
        return s;
    }

    function heading(s, text, small) {
        s.addText(text, base({
            x: 0.7, y: 0.55, w: 11.9, h: 1.0,
            fontSize: small ? 24 : 28, bold: true, color: th.title, valign: 'middle'
        }));
    }

    /** A list of lines, split over as many slides as the maximum needs.
        The continuation slides say so in their title rather than
        repeating it unchanged — a trainer flicking back should be able
        to tell slide 4 of a list from slide 3. */
    function listSlides(title, items, numbered) {
        var chunks = _pxChunk(items, cfg.maxLines);
        chunks.forEach(function (chunk, ci) {
            var s = slide();
            heading(s, ci === 0 ? title : title + ' ' + pxT('contd', L));
            s.addText(chunk.map(function (t, i) {
                return line(t, i === chunk.length - 1, numbered);
            }), base({
                x: 0.7, y: 1.75, w: 11.9, h: 5.0,
                fontSize: 20, color: th.body, paraSpaceAfter: 10, valign: 'top'
            }));
        });
    }

    /* ── 1. Title ──────────────────────────────────────── */
    if (pxIncludes(cfg, 'title')) {
        var s0 = slide();
        s0.addText(model.title || '', base({
            x: 0.8, y: 2.5, w: 11.7, h: 1.6,
            fontSize: 40, bold: true, color: th.title, valign: 'middle'
        }));
        /* The subtitle is the first cover row that has a value — the
           author already wrote the level, the trade or the institution
           there, and inventing a second field for the deck would ask
           them to type it twice. */
        var sub = (model.cover && model.cover.rows && model.cover.rows[0])
            ? model.cover.rows[0].value : '';
        if (sub) {
            s0.addText(sub, base({
                x: 0.8, y: 4.0, w: 11.7, h: 0.8, fontSize: 20, color: th.accent
            }));
        }
    }

    /* ── 2. Outcomes and their criteria ────────────────── */
    if (pxIncludes(cfg, 'outcomes')) {
        model.outcomes.forEach(function (out) {
            var title = 'LO ' + out.index + ': ' + out.title;
            if (rtl) title = 'ن.ت ' + out.index + ': ' + out.title;
            if (L === 'fr') title = 'RA ' + out.index + ' : ' + out.title;

            if (out.criteria.length) {
                listSlides(title, out.criteria, false);
            } else {
                var s = slide();
                heading(s, title);
                var desc = _pxLines(out.description);
                if (desc.length) {
                    s.addText(desc.join('\n'), base({
                        x: 0.7, y: 1.9, w: 11.9, h: 4.5,
                        fontSize: 20, color: th.body, lineSpacingMultiple: 1.3
                    }));
                }
            }
        });
    }

    /* ── 3. Content cards ──────────────────────────────── */
    if (pxIncludes(cfg, 'cards')) {
        model.outcomes.forEach(function (out) {
            out.infoSheets.forEach(function (sh) {
                sh.sections.forEach(function (cs) {
                    var head = cs.heading || sh.title;
                    if (!head && !cs.text) return;

                    var img = (cfg.firstImage && cs.images && cs.images.length)
                        ? _pxImageData(cs.images[0]) : null;
                    var lines = _pxLines(cs.text);
                    var s = slide();

                    if (cfg.cardMode === 'notes') {
                        /* Heading centred, text in the notes. The slide
                           carries nothing the trainer has to read out. */
                        s.addText(head, base({
                            x: 0.8, y: img ? 0.6 : 2.9, w: 11.7, h: 1.1,
                            fontSize: 30, bold: true, color: th.title, valign: 'middle'
                        }));
                        if (lines.length) s.addNotes(lines.join('\n'));
                        if (img) s.addImage({ data: img, x: 3.5, y: 2.0, w: 6.3, h: 4.4, sizing: { type: 'contain', w: 6.3, h: 4.4 } });
                    } else if (cfg.cardMode === 'title') {
                        s.addText(head, base({
                            x: 0.8, y: 2.9, w: 11.7, h: 1.1,
                            fontSize: 32, bold: true, color: th.title, valign: 'middle', align: 'center'
                        }));
                    } else {
                        heading(s, head);
                        /* With an image the text takes half the slide, so
                           the two never overlap; the side it takes
                           follows the reading direction. */
                        var tx = img ? (rtl ? 6.9 : 0.7) : 0.7;
                        var tw = img ? 5.7 : 11.9;
                        if (lines.length) {
                            s.addText(lines.slice(0, cfg.maxLines).map(function (t, i, a) {
                                return line(t, i === a.length - 1, false);
                            }), base({
                                x: tx, y: 1.75, w: tw, h: 4.9,
                                fontSize: img ? 16 : 18, color: th.body,
                                paraSpaceAfter: 8, valign: 'top'
                            }));
                            /* Anything past the maximum goes to the notes
                               rather than off the edge of the slide. */
                            if (lines.length > cfg.maxLines) {
                                s.addNotes(lines.slice(cfg.maxLines).join('\n'));
                            }
                        }
                        if (img) {
                            s.addImage({
                                data: img,
                                x: rtl ? 0.7 : 6.9, y: 1.75, w: 5.7, h: 4.6,
                                sizing: { type: 'contain', w: 5.7, h: 4.6 }
                            });
                        }
                    }
                });

                /* ── 4. Self-check: question, then answer ── */
                if (pxIncludes(cfg, 'selfcheck') && sh.selfCheck) {
                    var q = _pxLines(sh.selfCheck.content);
                    if (q.length) listSlides(pxT('selfCheck', L) + ' ' + sh.selfCheck.number, q, true);
                    if (sh.answersKey) {
                        var a = _pxLines(sh.answersKey.content);
                        if (a.length) listSlides(pxT('answers', L) + ' ' + sh.answersKey.number, a, true);
                    }
                }
            });
        });
    }

    /* ── 5. Activity steps ─────────────────────────────── */
    if (pxIncludes(cfg, 'steps')) {
        model.outcomes.forEach(function (out) {
            out.activitySheets.forEach(function (sh) {
                if (!sh.steps.length) return;
                var title = sh.title || pxT('steps', L);

                if (sh.steps.length <= cfg.stepsThreshold) {
                    /* Few enough to give each its own slide: the step
                       number stays visible while the trainee works. */
                    sh.steps.forEach(function (stp) {
                        var s = slide();
                        heading(s, title + ' \u2014 ' + stp.index, true);
                        var lines = _pxLines(stp.text);
                        var img = (cfg.firstImage && stp.images && stp.images.length)
                            ? _pxImageData(stp.images[0]) : null;
                        if (lines.length) {
                            s.addText(lines.join('\n'), base({
                                x: img ? (rtl ? 6.9 : 0.7) : 0.7, y: 1.75,
                                w: img ? 5.7 : 11.9, h: 4.6,
                                fontSize: 20, color: th.body, lineSpacingMultiple: 1.3, valign: 'top'
                            }));
                        }
                        if (img) {
                            s.addImage({
                                data: img, x: rtl ? 0.7 : 6.9, y: 1.75, w: 5.7, h: 4.6,
                                sizing: { type: 'contain', w: 5.7, h: 4.6 }
                            });
                        }
                    });
                } else {
                    listSlides(title, sh.steps.map(function (stp) {
                        return _pxLines(stp.text).join(' ') || String(stp.index);
                    }), true);
                }
            });
        });
    }

    return p;
}

/* ── Loading the library ────────────────────────────────────
   One <script> tag, once, and every later call reuses the same promise
   so two quick presses cannot start two downloads. */
var _pxLibPromise = null;

function _pxLoadLib() {
    if (typeof window !== 'undefined' && window.PptxGenJS) return Promise.resolve(window.PptxGenJS);
    if (_pxLibPromise) return _pxLibPromise;
    _pxLibPromise = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = PX_CDN;
        s.onload = function () {
            window.PptxGenJS ? resolve(window.PptxGenJS) : reject(new Error('library loaded but absent'));
        };
        s.onerror = function () {
            _pxLibPromise = null;         /* let a later press retry */
            reject(new Error('network'));
        };
        document.head.appendChild(s);
    });
    return _pxLibPromise;
}

/* ── Entry point ────────────────────────────────────────────
   Same shape as mbExportToHtml: readiness first, then the model, then
   the file. Checking readiness BEFORE building anything is what stops
   the tool from downloading an empty deck that looks like a success. */
async function mbExportToPptx() {
    var lang = 'en';
    try {
        if (typeof exportLang === 'function') {
            var l = exportLang();
            if (_PX_STRINGS[l]) lang = l;
        }
    } catch (e) { /* fall through to English */ }

    try {
        if (typeof mbCheckExportReadiness === 'function') {
            var ready = mbCheckExportReadiness(lang);
            if (ready && !ready.ok) {
                var msg = ready.title + '\n\n' + ready.message;
                if (typeof mbAlert === 'function') await mbAlert(msg);
                else alert(msg);
                if (typeof showStatus === 'function') showStatus(ready.title, 'error');
                return;
            }
        }

        if (typeof showStatus === 'function') showStatus(pxT('loading', lang), 'info');
        var PptxGen;
        try {
            PptxGen = await _pxLoadLib();
        } catch (e) {
            if (typeof mbAlert === 'function') await mbAlert(pxT('noLib', lang));
            if (typeof showStatus === 'function') showStatus(pxT('noLib', lang), 'error');
            return;
        }

        if (typeof showStatus === 'function') showStatus(pxT('exporting', lang), 'info');

        var model = mbBuildModuleModel(lang);
        if (!model) return;

        var deck = mbBuildPptxDeck(model, pxReadSettings(), PptxGen);
        var name = (typeof getExportFilename === 'function')
            ? getExportFilename('pptx') : 'module.pptx';

        await deck.writeFile({ fileName: name });
        if (typeof showStatus === 'function') showStatus(pxT('done', lang), 'success');
    } catch (e) {
        console.error('PPTX export failed:', e);
        if (typeof showStatus === 'function') showStatus(pxT('failed', lang) + e.message, 'error');
    }
}

/* The toolbar label carries no data-i18n, for the same reason
   exports_html.js gives: applyTranslations() would overwrite it from a
   dictionary that does not hold these keys. */
function _pxPaintButton() {
    var span = document.querySelector('[data-act="mbExportToPptx"] span:not(.figma-btn-icon)');
    if (span) span.textContent = pxT('btn');
}

if (typeof window !== 'undefined') {
    window.addEventListener('mb:langchange', _pxPaintButton);
    document.addEventListener('DOMContentLoaded', _pxPaintButton);
}

/* Node can require this file to test the builder without a browser —
   which is how the Arabic bullet direction was settled. */
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { mbBuildPptxDeck: mbBuildPptxDeck, PX_DEFAULTS: PX_DEFAULTS,
                       PX_THEMES: PX_THEMES, _pxLines: _pxLines, _pxChunk: _pxChunk };
}
