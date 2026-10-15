// ============================================================
// /src/rating_scale.js
// Rating scale and passing standard (3.51.0; on screen too: 3.51.1)
//
// WHY
// A checklist answered «Yes / No» says whether each criterion was met.
// A rating scale says how well: «Not yet / Acceptable / Proficient», or
// 0–3, or the programme's own levels — with a passing standard such as
// «Acceptable or higher on every criterion».
//
// WHERE, AND OPTIONAL IN EACH PLACE
//   Activity / job / task sheet — its Performance Criteria Checklist is
//     the trainee's SELF-check (Yes / No by default). A sheet can switch
//     to the scale (sheet.useScale), e.g. when the trainer observes.
//   Assessment unit — the trainer's form for the whole learning outcome.
//     A form can add a rating table of its criteria (form.useScale),
//     with the passing standard above the overall result.
// The scale and the standard are defined once for the project
// (mbState.ratingScale), per language, like the result options:
//   { levels: [ { lang, options: [...] } ], pass: [ { lang, text } ] }
// — records, not { en, ar, fr }, so biFlattenDeep leaves them alone.
// Levels run from the lowest to the highest.
// ============================================================

var MB_SCALE_PRESETS = {
    three: { en: ['Not yet', 'Acceptable', 'Proficient'], fr: ['Pas encore', 'Acceptable', 'Maîtrisé'], ar: ['لم يُتقن بعد', 'مقبول', 'متقن'] },
    num: { en: ['0', '1', '2', '3'], fr: ['0', '1', '2', '3'], ar: ['0', '1', '2', '3'] },
    four: { en: ['Beginning', 'Developing', 'Proficient', 'Exemplary'], fr: ['Débutant', 'En progression', 'Maîtrisé', 'Exemplaire'], ar: ['مبتدئ', 'في طور التطوّر', 'متمكّن', 'متميّز'] }
};

var _SC_STRINGS = {
    en: {
        actToggle: 'Use a rating scale instead of Yes / No',
        asmToggle: 'Rate each criterion on the rating scale (trainer)',
        edit: '✏️ Rating scale…',
        cols: 'Columns: {v0}',
        title: 'Rating scale and passing standard',
        intro: 'One level per line, from the lowest to the highest. Each language keeps its own list. The passing standard is printed under the checklist and above the result; left empty, it is written for you.',
        presets: 'Ready-made scales',
        p_three: 'Not yet / Acceptable / Proficient', p_num: '0 – 3', p_four: 'Beginning … Exemplary',
        levelsIn: 'Levels in {v0}', passIn: 'Passing standard in {v0}',
        passAuto: 'Passing standard: «{v0}» or higher on every criterion.',
        rating: 'Rating of the criteria',
        critCol: 'Assessment criteria', noCrit: 'The criteria of the table above appear here.',
        defaults: '↺ Defaults', cancel: 'Cancel', save: 'Save', saved: 'Rating scale saved.'
    },
    fr: {
        actToggle: 'Utiliser une échelle d’appréciation au lieu de Oui / Non',
        asmToggle: 'Apprécier chaque critère sur l’échelle (formateur)',
        edit: '✏️ Échelle d’appréciation…',
        cols: 'Colonnes : {v0}',
        title: 'Échelle d’appréciation et critère de réussite',
        intro: 'Un niveau par ligne, du plus bas au plus haut. Chaque langue a sa propre liste. Le critère de réussite est imprimé sous la liste et au-dessus du résultat ; laissé vide, il est rédigé pour vous.',
        presets: 'Échelles prêtes à l’emploi',
        p_three: 'Pas encore / Acceptable / Maîtrisé', p_num: '0 – 3', p_four: 'Débutant … Exemplaire',
        levelsIn: 'Niveaux en {v0}', passIn: 'Critère de réussite en {v0}',
        passAuto: 'Critère de réussite : « {v0} » ou plus pour chaque critère.',
        rating: 'Appréciation des critères',
        critCol: 'Critères d’évaluation', noCrit: 'Les critères du tableau ci-dessus apparaissent ici.',
        defaults: '↺ Par défaut', cancel: 'Annuler', save: 'Enregistrer', saved: 'Échelle enregistrée.'
    },
    ar: {
        actToggle: 'استخدام مقياس تقدير بدل «نعم / لا»',
        asmToggle: 'تقدير كل معيار على المقياس (المدرّب)',
        edit: '✏️ مقياس التقدير…',
        cols: 'الأعمدة: {v0}',
        title: 'مقياس التقدير ومعيار النجاح',
        intro: 'مستوى في كل سطر، من الأدنى إلى الأعلى. لكل لغة قائمتها. يُطبع معيار النجاح تحت قائمة التدقيق وفوق النتيجة؛ وإن تُرك فارغاً كُتب تلقائياً.',
        presets: 'مقاييس جاهزة',
        p_three: 'لم يُتقن بعد / مقبول / متقن', p_num: '0 – 3', p_four: 'مبتدئ … متميّز',
        levelsIn: 'المستويات بـ{v0}', passIn: 'معيار النجاح بـ{v0}',
        passAuto: 'معيار النجاح: «{v0}» أو أعلى في كل معيار.',
        rating: 'تقدير المعايير',
        critCol: 'معايير التقييم', noCrit: 'تظهر هنا معايير الجدول أعلاه.',
        defaults: '↺ الافتراضي', cancel: 'إلغاء', save: 'حفظ', saved: 'حُفظ مقياس التقدير.'
    }
};
var _SC_LANG_NAMES = { en: 'English', fr: 'Français', ar: 'العربية' };

function _scUi() {
    try { var g = window.i18n && window.i18n.getLang && window.i18n.getLang(); if (_SC_STRINGS[g]) return g; } catch (e) { /* not up */ }
    return 'en';
}
function _scT(k, vars, lang) {
    var L = _SC_STRINGS[lang || _scUi()] || _SC_STRINGS.en;
    var s = L[k] || _SC_STRINGS.en[k] || k;
    if (vars) Object.keys(vars).forEach(function (n) { s = s.split('{' + n + '}').join(String(vars[n])); });
    return s;
}
function _scEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
}
function _scLang() { return (typeof contentLang === 'function') ? contentLang() : 'en'; }

function _scMap(list, key) {
    var m = {};
    (Array.isArray(list) ? list : []).forEach(function (r) { if (r && typeof r.lang === 'string') m[r.lang] = r[key]; });
    return m;
}
/** The stored value, cleaned: null when nothing is the user's own. */
function mbScaleNormalize(v) {
    if (!v || typeof v !== 'object') return null;
    var lv = _scMap(v.levels, 'options'), ps = _scMap(v.pass, 'text');
    var levels = [], pass = [];
    ['en', 'ar', 'fr'].forEach(function (l) {
        var a = (Array.isArray(lv[l]) ? lv[l] : []).map(function (x) { return String(x || '').trim(); }).filter(Boolean).slice(0, 8);
        if (a.length >= 2) levels.push({ lang: l, options: a });
        var t = String(ps[l] || '').trim();
        if (t) pass.push({ lang: l, text: t.slice(0, 400) });
    });
    return (levels.length || pass.length) ? { levels: levels, pass: pass } : null;
}

/** The levels in `lang`, lowest first. */
function mbScaleLevels(lang, state) {
    var st = state || (typeof window !== 'undefined' ? window.mbState : null) || {};
    var v = mbScaleNormalize(st.ratingScale);
    var own = v ? _scMap(v.levels, 'options')[lang] : null;
    return (own && own.length) ? own.slice() : (MB_SCALE_PRESETS.three[lang] || MB_SCALE_PRESETS.three.en).slice();
}
/** The passing standard in `lang`: typed, else «<middle level> or higher». */
function mbScalePass(lang, state) {
    var st = state || (typeof window !== 'undefined' ? window.mbState : null) || {};
    var v = mbScaleNormalize(st.ratingScale);
    var own = v ? _scMap(v.pass, 'text')[lang] : '';
    if (own) return own;
    var lv = mbScaleLevels(lang, st);
    return _scT('passAuto', { v0: lv[Math.floor(lv.length / 2)] }, _SC_STRINGS[lang] ? lang : 'en');
}

/* ── Activity sheet: the switch under the checklist ─────────── */
function _scCurrentActivity() {
    var lo = (typeof mbCurrentLOObject === 'function') ? mbCurrentLOObject() : null;
    return lo && (lo.activitySheets || [])[mbState.currentActivitySheetIndex] || null;
}
function mbScalePaintActivity() {
    var host = document.getElementById('act-scale-host');
    if (!host) return;
    var sh = _scCurrentActivity();
    var on = !!(sh && sh.useScale);
    var lang = _scLang();
    host.innerHTML =
        '<label class="mb-scale-toggle"><input type="checkbox" data-act="mbScaleToggleActivity" data-on="change" data-args=\'["$checked"]\'' + (on ? ' checked' : '') + '> ' +
            _scEsc(_scT('actToggle')) + '</label>' +
        '<button type="button" class="mb-asm-edit" data-act="mbScaleEdit">' + _scEsc(_scT('edit')) + '</button>' +
        (on ? '<p class="mb-asm-note" dir="auto">' + _scEsc(_scT('cols', { v0: mbScaleLevels(lang).join(' · ') })) + '<br>' + _scEsc(mbScalePass(lang)) + '</p>' : '');
    mbScaleSyncActivityTable();
}

/* 3.51.1: the checklist on screen shows the scale's columns, as printed.
   The Yes / No headers stay in the page (hidden) so their i18n keeps
   working; the extra cells are empty, like Yes / No, and nothing reads them. */
function mbScaleSyncActivityTable() {
    var tbody = document.getElementById('criteria-tbody');
    var table = tbody && tbody.closest('table');
    var hr = table && table.querySelector('thead tr');
    if (!hr) return;
    var sh = _scCurrentActivity();
    var lv = (sh && sh.useScale) ? mbScaleLevels(_scLang()) : null;
    var ths = Array.prototype.slice.call(hr.children);
    ths.forEach(function (th, i) {
        if (th.classList.contains('mb-sc-th')) th.remove();
        else if (i >= 2) th.style.display = lv ? 'none' : '';
    });
    if (lv) {
        var w = Math.max(8, Math.floor(30 / lv.length));
        lv.forEach(function (l) {
            var th = document.createElement('th');
            th.className = 'mb-sc-th';
            th.setAttribute('dir', 'auto');
            th.style.cssText = 'border:1px solid #d1d5db;padding:8px;width:' + w + '%;text-align:center;color:#374151;font-weight:700;';
            th.textContent = l;
            hr.appendChild(th);
        });
    }
    tbody.__scCols = lv ? lv.length : 2;
    _scFitRows(tbody);
    if (!tbody.__scObs && typeof MutationObserver === 'function') {
        tbody.__scObs = new MutationObserver(function () { _scFitRows(tbody); });
        tbody.__scObs.observe(tbody, { childList: true });
    }
}
function _scFitRows(tbody) {
    var n = tbody.__scCols || 2;
    Array.prototype.forEach.call(tbody.rows, function (tr) {
        while (tr.cells.length > 2 + n) tr.deleteCell(-1);
        while (tr.cells.length < 2 + n) { var td = tr.insertCell(-1); td.style.textAlign = 'center'; }
    });
}
function mbScaleToggleActivity(checked) {
    if (typeof saveCurrentSheetToLO === 'function') saveCurrentSheetToLO();
    var sh = _scCurrentActivity();
    if (!sh) return;
    sh.useScale = (checked === true || checked === 'true');
    if (!sh.useScale) delete sh.useScale;
    if (typeof saveCurrentModuleLOData === 'function') saveCurrentModuleLOData();
    if (typeof mbLibrarySave === 'function') { try { mbLibrarySave(); } catch (e) { /* ignore */ } }
    mbScalePaintActivity();
}
if (typeof window !== 'undefined') {
    /* Repaint with the sheet on screen: wraps the loader so every way of
       opening a sheet (navigation, outcome switch, undo) passes here. */
    window.addEventListener('DOMContentLoaded', function () {
        if (typeof loadActivitySheetAtIndex === 'function' && !loadActivitySheetAtIndex.__sc) {
            var orig = loadActivitySheetAtIndex;
            loadActivitySheetAtIndex = function () { var r = orig.apply(this, arguments); try { mbScalePaintActivity(); } catch (e) { /* ignore */ } return r; };
            loadActivitySheetAtIndex.__sc = true;
        }
        mbScalePaintActivity();
    });
    window.addEventListener('mb:langchange', function () { try { mbScalePaintActivity(); } catch (e) { /* ignore */ } });
    window.addEventListener('mb:contentlangchange', function () { try { mbScalePaintActivity(); } catch (e) { /* ignore */ } });
}

/* ── Assessment unit: the switch above the result ─────────── */
function mbScaleFormHtml(loId) {
    var f = (mbState.assessmentFormsData || {})[loId] || {};
    var on = !!f.useScale;
    var lang = _scLang();
    return '<div class="mb-scale-form" data-sc-lo="' + _scEsc(loId) + '">' +
        '<label class="mb-scale-toggle"><input type="checkbox" data-act="mbScaleToggleForm" data-on="change" data-args=\'["' + _scEsc(loId) + '","$checked"]\'' + (on ? ' checked' : '') + '> ' +
            _scEsc(_scT('asmToggle')) + '</label>' +
        '<button type="button" class="mb-asm-edit" data-act="mbScaleEdit">' + _scEsc(_scT('edit')) + '</button>' +
        (on ? _scFormTable(f, lang) + '<p class="mb-asm-note" dir="auto">' + _scEsc(_scT('cols', { v0: mbScaleLevels(lang).join(' · ') })) + '<br><strong>' + _scEsc(mbScalePass(lang)) + '</strong></p>' : '') +
    '</div>';
}
/** Redraws one form's scale block after its criteria change. */
function mbScaleRefreshForm(loId) {
    var f = (mbState.assessmentFormsData || {})[loId];
    if (!f || !f.useScale) return;
    document.querySelectorAll('.mb-scale-form').forEach(function (el) {
        if (el.getAttribute('data-sc-lo') === String(loId)) el.outerHTML = mbScaleFormHtml(loId);
    });
}
/* 3.51.1: the rating table of the form's criteria, as printed. */
function _scFormTable(f, lang) {
    var lv = mbScaleLevels(lang);
    var crit = (f.rows || []).map(function (r) {
        return String((typeof _mbAsmCriteria === 'function') ? _mbAsmCriteria(r.criteria) : (r.criteria || '')).trim();
    }).filter(Boolean);
    var td = 'border:1px solid #d1d5db;padding:6px 8px;';
    var head = '<tr style="background:#e0e7ff"><th style="' + td + 'width:6%">#</th><th style="' + td + 'text-align:start">' + _scEsc(_scT('critCol')) + '</th>' +
        lv.map(function (l) { return '<th style="' + td + 'text-align:center" dir="auto">' + _scEsc(l) + '</th>'; }).join('') + '</tr>';
    var body = (crit.length ? crit : ['']).map(function (c, i) {
        return '<tr><td style="' + td + 'text-align:center">' + (c ? i + 1 : '') + '</td><td style="' + td + '" dir="auto">' + (c ? _scEsc(c) : '<em style="color:#9ca3af">' + _scEsc(_scT('noCrit')) + '</em>') + '</td>' +
            lv.map(function () { return '<td style="' + td + '"></td>'; }).join('') + '</tr>';
    }).join('');
    return '<div class="mb-scale-table"><h6 style="margin:10px 0 6px;font-weight:700;color:#374151">' + _scEsc(_scT('rating')) + '</h6>' +
        '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:0.9em;background:#fff">' + head + body + '</table></div></div>';
}
function mbScaleToggleForm(loId, checked) {
    var f = (mbState.assessmentFormsData || {})[loId];
    if (!f) return;
    f.useScale = (checked === true || checked === 'true');
    if (!f.useScale) delete f.useScale;
    if (typeof renderAssessmentForms === 'function') renderAssessmentForms();
    if (typeof mbLibrarySave === 'function') { try { mbLibrarySave(); } catch (e) { /* ignore */ } }
}

/* ── The editor ─────────────────────────────────────────────── */
function mbScaleEdit() {
    if (document.getElementById('sc-overlay')) return;
    var lang = _scLang();
    var v = mbScaleNormalize(mbState.ratingScale);
    var draftLv = v ? _scMap(v.levels, 'options') : {};
    var draftPs = v ? _scMap(v.pass, 'text') : {};
    var rtl = !!(window.i18n && window.i18n.isRTL && window.i18n.isRTL());
    var ov = document.createElement('div');
    ov.id = 'sc-overlay';
    ov.className = 'ws-overlay';
    ov.setAttribute('dir', rtl ? 'rtl' : 'ltr');
    var ln = _SC_LANG_NAMES[lang] || lang;
    ov.innerHTML =
      '<div class="ws-modal" role="dialog" aria-modal="true" aria-labelledby="sc-title">' +
        '<div class="ws-head"><span id="sc-title">📏 ' + _scEsc(_scT('title')) + '</span>' +
          '<button type="button" class="ws-x" id="sc-x" aria-label="' + _scEsc(_scT('cancel')) + '">×</button></div>' +
        '<div class="ws-body">' +
          '<p class="ws-note ws-note-sm">' + _scEsc(_scT('intro')) + '</p>' +
          '<h4 class="ws-group">' + _scEsc(_scT('presets')) + '</h4>' +
          '<div class="asm-presets">' + Object.keys(MB_SCALE_PRESETS).map(function (k) {
              return '<button type="button" class="asm-preset" data-preset="' + k + '">' + _scEsc(_scT('p_' + k)) + '</button>';
          }).join('') + '</div>' +
          '<label class="asm-label" for="sc-levels">' + _scEsc(_scT('levelsIn', { v0: ln })) + '</label>' +
          '<textarea id="sc-levels" class="asm-text" rows="4" dir="auto"></textarea>' +
          '<label class="asm-label" for="sc-pass" style="margin-top:12px">' + _scEsc(_scT('passIn', { v0: ln })) + '</label>' +
          '<textarea id="sc-pass" class="asm-text" rows="2" dir="auto"></textarea>' +
        '</div>' +
        '<div class="ws-foot">' +
          '<button type="button" class="ws-btn ws-btn-ghost" id="sc-def">' + _scEsc(_scT('defaults')) + '</button>' +
          '<span class="ws-foot-right">' +
            '<button type="button" class="ws-btn ws-btn-ghost" id="sc-cancel">' + _scEsc(_scT('cancel')) + '</button>' +
            '<button type="button" class="ws-btn ws-btn-primary" id="sc-save">' + _scEsc(_scT('save')) + '</button>' +
          '</span>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    var lvEl = document.getElementById('sc-levels'), psEl = document.getElementById('sc-pass');
    lvEl.value = (draftLv[lang] && draftLv[lang].length ? draftLv[lang] : mbScaleLevels(lang)).join('\n');
    psEl.value = draftPs[lang] || '';
    psEl.placeholder = mbScalePass(lang);
    var dirty = false, downOnBackdrop = false;
    var lines = function () { return lvEl.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean); };
    lvEl.addEventListener('input', function () { draftLv[lang] = lines(); dirty = true; });
    psEl.addEventListener('input', function () { draftPs[lang] = psEl.value.trim(); dirty = true; });
    ov.querySelectorAll('[data-preset]').forEach(function (b) {
        b.addEventListener('click', function () {
            var p = MB_SCALE_PRESETS[b.getAttribute('data-preset')];
            draftLv = JSON.parse(JSON.stringify(p));
            draftPs = {};
            lvEl.value = (p[lang] || p.en).join('\n');
            psEl.value = '';
            dirty = true;
        });
    });
    document.getElementById('sc-def').addEventListener('click', function () {
        draftLv = {}; draftPs = {};
        lvEl.value = MB_SCALE_PRESETS.three[lang].join('\n'); psEl.value = '';
        dirty = true;
    });
    var close = function () { ov.remove(); document.removeEventListener('keydown', esc); };
    var esc = function (e) { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', esc);
    document.getElementById('sc-x').addEventListener('click', close);
    document.getElementById('sc-cancel').addEventListener('click', close);
    ov.addEventListener('mousedown', function (e) { downOnBackdrop = (e.target === ov); });
    ov.addEventListener('click', function (e) { if (e.target === ov && downOnBackdrop && !dirty) close(); downOnBackdrop = false; });
    document.getElementById('sc-save').addEventListener('click', function () {
        mbState.ratingScale = mbScaleNormalize({
            levels: Object.keys(draftLv).map(function (l) { return { lang: l, options: draftLv[l] }; }),
            pass: Object.keys(draftPs).map(function (l) { return { lang: l, text: draftPs[l] }; })
        });
        close();
        mbScalePaintActivity();
        if (typeof renderAssessmentForms === 'function') renderAssessmentForms();
        if (typeof mbLibrarySave === 'function') { try { mbLibrarySave(); } catch (e) { /* ignore */ } }
        if (typeof showStatus === 'function') showStatus(_scT('saved'), 'success');
    });
    lvEl.focus();
}
