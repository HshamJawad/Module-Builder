// ============================================================
// /src/assessment_results.js
// The «Result» of an assessment form, and its options (3.50.0)
//
// WHY
// The result is ticked by the TRAINER, on paper or in the HTML package,
// after assessing the trainee — not by the author while building the
// module. The two checkboxes on the form invited a click that meant
// nothing, so the form now shows the options as they will print (☐ …)
// with a button to change them.
//
// WHICH OPTIONS
// «Competent / Not Yet Competent» by default. A programme may use
// «Pass / Not pass», «Satisfactory / Unsatisfactory», «Met / Not met»,
// or a rubric scale such as «Exemplary / Proficient / Developing /
// Beginning» (as in WIDS performance assessments). The options are the
// project's, per language, edited one per line like the module
// categories in DACUM Live Pro. Stored as
//   mbState.assessmentResults = [ { lang: 'en', options: [...] }, … ]
// or null for the defaults — a list of records, NOT { en, ar, fr }: an
// object with those keys is a bilingual text to biFlattenDeep, which
// would flatten it before an export.
//
// EXPORTS
// Word and PDF print each option with an empty box; the HTML package
// makes them real checkboxes the trainer can tick in the browser.
// ============================================================

var MB_ASM_PRESETS = {
    cnyc: {
        en: ['Competent', 'Not Yet Competent'],
        fr: ['Compétent', 'Pas encore compétent'],
        ar: ['كفؤ', 'غير كفؤ بعد']
    },
    pass: {
        en: ['Pass', 'Not pass'],
        fr: ['Réussi', 'Non réussi'],
        ar: ['ناجح', 'غير ناجح']
    },
    sat: {
        en: ['Satisfactory', 'Unsatisfactory'],
        fr: ['Satisfaisant', 'Insatisfaisant'],
        ar: ['مُرضٍ', 'غير مُرضٍ']
    },
    met: {
        en: ['Met', 'Not met'],
        fr: ['Atteint', 'Non atteint'],
        ar: ['مُتحقِّق', 'غير مُتحقِّق']
    },
    rubric: {
        en: ['Exemplary', 'Proficient', 'Developing', 'Beginning'],
        fr: ['Exemplaire', 'Maîtrisé', 'En progression', 'Débutant'],
        ar: ['متميّز', 'متمكّن', 'في طور التطوّر', 'مبتدئ']
    }
};

var _ASM_STRINGS = {
    en: {
        lead: 'The learner is',
        edit: '✏️ Result options…',
        note: 'Ticked by the trainer after assessing the trainee: printed with empty boxes in Word and PDF, clickable in the HTML package.',
        title: 'Result options',
        intro: 'One option per line, in the order they should appear. Each language keeps its own list; a list left empty uses the default (Competent / Not Yet Competent).',
        presets: 'Ready-made sets',
        p_cnyc: 'Competent / Not yet competent', p_pass: 'Pass / Not pass', p_sat: 'Satisfactory / Unsatisfactory',
        p_met: 'Met / Not met', p_rubric: 'Rubric: Exemplary … Beginning',
        presetNote: 'A ready-made set fills all three languages.',
        forLang: 'Options in {v0}',
        defaults: '↺ Defaults', cancel: 'Cancel', save: 'Save', saved: 'Result options saved.'
    },
    fr: {
        lead: 'L’apprenant est',
        edit: '✏️ Options du résultat…',
        note: 'Cochées par le formateur après l’évaluation : imprimées avec des cases vides dans Word et PDF, cliquables dans le paquet HTML.',
        title: 'Options du résultat',
        intro: 'Une option par ligne, dans l’ordre d’affichage. Chaque langue a sa propre liste ; une liste vide utilise les options par défaut (Compétent / Pas encore compétent).',
        presets: 'Jeux prêts à l’emploi',
        p_cnyc: 'Compétent / Pas encore compétent', p_pass: 'Réussi / Non réussi', p_sat: 'Satisfaisant / Insatisfaisant',
        p_met: 'Atteint / Non atteint', p_rubric: 'Grille : Exemplaire … Débutant',
        presetNote: 'Un jeu prêt à l’emploi remplit les trois langues.',
        forLang: 'Options en {v0}',
        defaults: '↺ Par défaut', cancel: 'Annuler', save: 'Enregistrer', saved: 'Options du résultat enregistrées.'
    },
    ar: {
        lead: 'المتعلم',
        edit: '✏️ خيارات النتيجة…',
        note: 'يؤشّرها المدرّب بعد تقييم المتدرب: تُطبع بمربعات فارغة في Word وPDF، وقابلة للتأشير في حزمة HTML.',
        title: 'خيارات النتيجة',
        intro: 'خيار في كل سطر، بالترتيب الذي تظهر به. لكل لغة قائمتها؛ والقائمة الفارغة تستخدم الافتراضي (كفؤ / غير كفؤ بعد).',
        presets: 'مجموعات جاهزة',
        p_cnyc: 'كفؤ / غير كفؤ بعد', p_pass: 'ناجح / غير ناجح', p_sat: 'مُرضٍ / غير مُرضٍ',
        p_met: 'مُتحقِّق / غير مُتحقِّق', p_rubric: 'سلّم تقدير: متميّز … مبتدئ',
        presetNote: 'المجموعة الجاهزة تملأ اللغات الثلاث.',
        forLang: 'الخيارات بـ{v0}',
        defaults: '↺ الافتراضي', cancel: 'إلغاء', save: 'حفظ', saved: 'حُفظت خيارات النتيجة.'
    }
};
var _ASM_LANG_NAMES = { en: 'English', fr: 'Français', ar: 'العربية' };

function _asmT(k, vars) {
    var l = 'en';
    try { var g = window.i18n && window.i18n.getLang && window.i18n.getLang(); if (_ASM_STRINGS[g]) l = g; } catch (e) { /* not up */ }
    var s = _ASM_STRINGS[l][k] || _ASM_STRINGS.en[k] || k;
    if (vars) Object.keys(vars).forEach(function (n) { s = s.split('{' + n + '}').join(String(vars[n])); });
    return s;
}
function _asmEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
}

/** { en: [...], … } from the stored list (or from a map), empty lists dropped. */
function _asmMap(v) {
    var m = {};
    if (Array.isArray(v)) v.forEach(function (r) { if (r && typeof r.lang === 'string' && Array.isArray(r.options)) m[r.lang] = r.options; });
    else if (v && typeof v === 'object') Object.keys(v).forEach(function (k) { if (Array.isArray(v[k])) m[k] = v[k]; });
    var out = {};
    ['en', 'ar', 'fr'].forEach(function (l) {
        var a = (m[l] || []).map(function (x) { return String(x || '').trim(); }).filter(Boolean).slice(0, 12);
        if (a.length) out[l] = a;
    });
    return out;
}
/** The value to store: [ { lang, options } ] with at least one list, else null. */
function mbAsmNormalizeResults(v) {
    var m = _asmMap(v);
    var keys = Object.keys(m);
    return keys.length ? keys.map(function (l) { return { lang: l, options: m[l] }; }) : null;
}

/** The options printed in `lang`: the project's, else the dictionary's. */
function mbAsmResultLabels(lang, state) {
    var st = state || (typeof window !== 'undefined' ? window.mbState : null) || {};
    var own = _asmMap(st.assessmentResults);
    if (own[lang]) return own[lang].slice();
    var t = function (k) { return (window.i18n && window.i18n.tIn) ? window.i18n.tIn(k, lang) : k; };
    return [t('expCompetent'), t('expNotYetCompetent')];
}

/** The form's «Result» block in the editor: the options as they print. */
function mbAsmResultHtml() {
    var lang = (typeof contentLang === 'function') ? contentLang() : 'en';
    var labels = mbAsmResultLabels(lang);
    return '<div class="mb-asm-result">' +
        '<div class="mb-asm-opts" dir="auto"><span class="mb-asm-lead">' + _asmEsc(_asmT('lead')) + '</span>' + labels.map(function (l) {
            return '<span class="mb-asm-opt"><span class="mb-asm-box" aria-hidden="true">☐</span> ' + _asmEsc(l) + '</span>';
        }).join('') + '</div>' +
        '<button type="button" class="mb-asm-edit" data-act="mbAsmResultEdit">' + _asmEsc(_asmT('edit')) + '</button>' +
        '<p class="mb-asm-note" dir="auto">ℹ️ ' + _asmEsc(_asmT('note')) + '</p>' +
    '</div>';
}

/* ── The editor (same shape as DACUM's «Module categories») ── */
var _asmDraft = null;

function mbAsmResultEdit() {
    if (document.getElementById('asm-overlay')) return;
    var lang = (typeof contentLang === 'function') ? contentLang() : 'en';
    _asmDraft = _asmMap(mbState.assessmentResults);
    var shown = (_asmDraft[lang] || mbAsmResultLabels(lang)).join('\n');
    var rtl = !!(window.i18n && window.i18n.isRTL && window.i18n.isRTL());
    var ov = document.createElement('div');
    ov.id = 'asm-overlay';
    ov.className = 'ws-overlay';
    ov.setAttribute('dir', rtl ? 'rtl' : 'ltr');
    ov.innerHTML =
      '<div class="ws-modal" role="dialog" aria-modal="true" aria-labelledby="asm-title">' +
        '<div class="ws-head"><span id="asm-title">🏷️ ' + _asmEsc(_asmT('title')) + '</span>' +
          '<button type="button" class="ws-x" id="asm-x" aria-label="' + _asmEsc(_asmT('cancel')) + '">×</button></div>' +
        '<div class="ws-body">' +
          '<p class="ws-note ws-note-sm">' + _asmEsc(_asmT('intro')) + '</p>' +
          '<h4 class="ws-group">' + _asmEsc(_asmT('presets')) + '</h4>' +
          '<div class="asm-presets">' + Object.keys(MB_ASM_PRESETS).map(function (k) {
              return '<button type="button" class="asm-preset" data-preset="' + k + '">' + _asmEsc(_asmT('p_' + k)) + '</button>';
          }).join('') + '</div>' +
          '<p class="asm-small">' + _asmEsc(_asmT('presetNote')) + '</p>' +
          '<label class="asm-label" for="asm-text">' + _asmEsc(_asmT('forLang', { v0: _ASM_LANG_NAMES[lang] || lang })) + '</label>' +
          '<textarea id="asm-text" class="asm-text" rows="5" dir="auto" lang="' + lang + '"></textarea>' +
        '</div>' +
        '<div class="ws-foot">' +
          '<button type="button" class="ws-btn ws-btn-ghost" id="asm-def">' + _asmEsc(_asmT('defaults')) + '</button>' +
          '<span class="ws-foot-right">' +
            '<button type="button" class="ws-btn ws-btn-ghost" id="asm-cancel">' + _asmEsc(_asmT('cancel')) + '</button>' +
            '<button type="button" class="ws-btn ws-btn-primary" id="asm-save">' + _asmEsc(_asmT('save')) + '</button>' +
          '</span>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    var ta = document.getElementById('asm-text');
    ta.value = shown;
    var lines = function () { return ta.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean); };
    ta.addEventListener('input', function () { _asmDraft[lang] = lines(); });
    ov.querySelectorAll('[data-preset]').forEach(function (b) {
        b.addEventListener('click', function () {
            var p = MB_ASM_PRESETS[b.getAttribute('data-preset')];
            _asmDraft = JSON.parse(JSON.stringify(p));
            ta.value = (p[lang] || p.en).join('\n');
        });
    });
    document.getElementById('asm-def').addEventListener('click', function () {
        _asmDraft = {};
        var t = function (k) { return window.i18n.tIn(k, lang); };
        ta.value = [t('expCompetent'), t('expNotYetCompetent')].join('\n');
    });
    var close = function () { ov.remove(); document.removeEventListener('keydown', esc); _asmDraft = null; };
    var esc = function (e) { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', esc);
    document.getElementById('asm-x').addEventListener('click', close);
    document.getElementById('asm-cancel').addEventListener('click', close);
    /* 3.50.1: the backdrop closes the dialog only for a click that
       STARTED on it, and never over unsaved typing. Selecting text in the
       box and releasing the mouse outside it fired a «click» on the
       backdrop, and the dialog vanished with what had been typed. */
    var downOnBackdrop = false, dirty = false;
    ov.addEventListener('mousedown', function (e) { downOnBackdrop = (e.target === ov); });
    ta.addEventListener('input', function () { dirty = true; });
    ov.querySelectorAll('[data-preset]').forEach(function (b) { b.addEventListener('click', function () { dirty = true; }); });
    ov.addEventListener('click', function (e) { if (e.target === ov && downOnBackdrop && !dirty) close(); downOnBackdrop = false; });
    document.getElementById('asm-save').addEventListener('click', function () {
        mbState.assessmentResults = mbAsmNormalizeResults(_asmDraft);
        close();
        if (typeof renderAssessmentForms === 'function') renderAssessmentForms();
        if (typeof mbLibrarySave === 'function') { try { mbLibrarySave(); } catch (e) { /* autosave absent */ } }
        if (typeof mbTouch === 'function') { try { mbTouch(); } catch (e) { /* ignore */ } }
        if (typeof showStatus === 'function') showStatus(_asmT('saved'), 'success');
    });
    ta.focus();
}
