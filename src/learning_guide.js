// ============================================================
// /src/learning_guide.js
// «دليل التعلم / Learning Guide» — the two-column orientation table
// that opens each learning outcome.
//
// WHY THIS FILE EXISTS
// The guide is not a thing the author writes. Every cell of it is
// already somewhere else in the project: the information-sheet titles,
// the self-check numbers, the activity-sheet titles. Asking the author
// to retype them into a table would guarantee the table and the sheets
// disagree the first time a sheet is renamed or renumbered — and a
// learning guide that points at «1-3» when the module now stops at
// «1-2» is worse than no learning guide at all.
//
// So the guide is DERIVED, not stored. Nothing here is state except the
// single on/off flag; the table is rebuilt from the outcome every time
// it is looked at, whether that is the preview or the export. That is
// also why the preview is read-only: there is nowhere for an edit to
// go. The author edits the sheets, or edits the table in Word after the
// export, and both of those are honest. An editable preview would look
// like it was saving something and would not be.
//
// ONE GUIDE PER OUTCOME. The guide orients a trainee inside ONE
// learning outcome — it lists that outcome's sheets and no others — so
// a module with four outcomes exports four guides, each on the page
// immediately before its own first information sheet.
//
// THE THREE INSTRUCTION BLOCKS are the tool's own words, not the
// author's, and therefore live in the dictionary (lgInfoInstr*,
// lgSelfInstr*, lgActInstr*) and are emitted in the EXPORT language —
// the same rule as every other piece of boilerplate. See _mbT in
// docx_bidi.js for why reading them through window.i18n.t() would put
// English instructions inside an Arabic deliverable.
// ============================================================

/* ── Section keys, in the order they appear in the guide ──────────
   Each entry names its heading, its instruction lines, and which part
   of the outcome fills it. Adding a fourth kind of sheet later means
   adding one entry here, not editing three renderers. */
var MB_LG_SECTIONS = ['info', 'self', 'activity'];

/**
 * A value that may be a bilingual pair or a plain string.
 *
 * The export flattens state before it reads it, so it hands us strings.
 * The preview reads live state, so it hands us pairs. One accessor
 * covers both rather than making each caller remember which it has.
 */
function _lgText(v, lang) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'object') {
        if (typeof biGet === 'function') return String(biGet(v, lang) || '');
        return String(v[lang] || v.en || v.ar || '');
    }
    return String(v);
}

/** Dictionary lookup in an EXPLICIT language — never the interface one. */
function _lgT(key, lang, vars) {
    if (!window.i18n) return key;
    return vars ? window.i18n.tfIn(key, lang, vars) : window.i18n.tIn(key, lang);
}

/**
 * Build the guide for ONE outcome, in ONE language.
 *
 * Returns a plain data structure — no DOM, no docx — so the preview and
 * the export render the same model and cannot drift apart. That is the
 * whole point of separating this from both renderers: a guide that
 * previews differently from how it exports is a guide nobody trusts.
 *
 *   {
 *     title, colActivities, colInstructions,
 *     sections: [ { header, instructions: [..], items: [..] } ]
 *   }
 *
 * Returns null when the outcome has nothing to guide anyone through.
 * Presence is not content: an outcome whose sheets are all untitled
 * would otherwise produce a page with three headings and no rows, which
 * reads as an export that failed rather than as a section never
 * started — the same rule the export already applies to outcome
 * heading pages.
 */
function mbBuildLearningGuideModel(lo, loIndex, lang) {
    if (!lo) return null;

    var infoSheets = (lo.infoSheets || []).filter(function (s) {
        return _lgText(s.title, lang).trim();
    });
    var actSheets = (lo.activitySheets || []).filter(function (s) {
        return _lgText(s.title, lang).trim();
    });
    /* A self-check counts only when the author actually wrote questions
       into it. An empty self-check box exists on every sheet from the
       moment the sheet is created; listing those numbers would tell the
       trainee to answer questions that are not in the document. */
    var selfNums = [];
    (lo.infoSheets || []).forEach(function (s, i) {
        var body = _lgText(s.selfCheckContent, lang);
        if (!body || !body.trim()) return;
        var auto = (typeof getAutoSheetNumber === 'function')
            ? getAutoSheetNumber(loIndex, i)
            : (loIndex + 1) + '-' + (i + 1);
        selfNums.push(_lgText(s.selfCheckNumber, lang) || _lgText(s.sheetNumber, lang) || auto);
    });

    if (!infoSheets.length && !actSheets.length && !selfNums.length) return null;

    var sections = [];

    /* The heading numbers count only the sections that are actually
       present. A module with no activity sheets must not print
       «1- …» then «3- …» and leave the trainee looking for a step 2
       that was never written. */
    var n = 0;

    if (infoSheets.length) {
        n++;
        sections.push({
            kind: 'info',
            header: _lgT('lgInfoHeader', lang, { v0: n }),
            instructions: [_lgT('lgInfoInstr1', lang), _lgT('lgInfoInstr2', lang)],
            items: infoSheets.map(function (s) {
                var idx = (lo.infoSheets || []).indexOf(s);
                var auto = (typeof getAutoSheetNumber === 'function')
                    ? getAutoSheetNumber(loIndex, idx)
                    : (loIndex + 1) + '-' + (idx + 1);
                var num = _lgText(s.sheetNumber, lang) || auto;
                return _lgT('expInfoSheetTitled', lang, { v0: num, v1: _lgText(s.title, lang) });
            })
        });
    }

    if (selfNums.length) {
        n++;
        sections.push({
            kind: 'self',
            header: _lgT('lgSelfHeader', lang, { v0: n }),
            instructions: [_lgT('lgSelfInstr1', lang), _lgT('lgSelfInstr2', lang), _lgT('lgSelfInstr3', lang)],
            /* One cell, not one per number: the sample groups them under
               a single label, and a numbered self-check is a pointer into
               a sheet already listed above rather than a document of its
               own. */
            items: [_lgT('lgSelfItemsLabel', lang)].concat(selfNums.map(function (x) { return '• ' + x; })),
            groupItems: true
        });
    }

    if (actSheets.length) {
        n++;
        sections.push({
            kind: 'activity',
            header: _lgT('lgActHeader', lang, { v0: n }),
            instructions: [_lgT('lgActInstr1', lang), _lgT('lgActInstr2', lang), _lgT('lgActInstr3', lang)],
            items: actSheets.map(function (s) {
                var idx = (lo.activitySheets || []).indexOf(s);
                var auto = (typeof getAutoSheetNumber === 'function')
                    ? getAutoSheetNumber(loIndex, idx)
                    : (loIndex + 1) + '-' + (idx + 1);
                var num = _lgText(s.sheetNumber, lang) || auto;
                return _lgT('expActivitySheetTitled', lang, { v0: num, v1: _lgText(s.title, lang) });
            })
        });
    }

    return {
        title:           _lgT('lgTitle', lang),
        colActivities:   _lgT('lgColActivities', lang),
        colInstructions: _lgT('lgColInstructions', lang),
        outcomeTitle:    _lgText(lo.title, lang),
        sections:        sections
    };
}

/** Is the guide switched on for this project? */
function mbLearningGuideOn() {
    return !!(window.mbState && mbState.includeLearningGuide);
}

// ============================================================
// The toggle
// ============================================================

/**
 * Radio pair in the Introduction tab.
 *
 * A pair of radios rather than a checkbox because the two states are a
 * genuine editorial choice — some ministries require the guide, some
 * forbid it — and a checkbox reads as "extra", which this is not.
 */
function mbSetLearningGuide(on) {
    mbState.includeLearningGuide = !!on;
    mbRenderLearningGuideToggle();
    if (typeof showStatus === 'function') {
        showStatus(window.i18n.t(on ? 'lgEnabled' : 'lgDisabled'), 'success');
    }
    /* No explicit autosave call: this handler runs off the radio's own
       `change`, and autosave.js already listens for `change` on
       #main-container. Calling a save here as well would write the
       snapshot twice for one click. */
}

function mbRenderLearningGuideToggle() {
    var yes = document.getElementById('lg-include-yes');
    var no  = document.getElementById('lg-include-no');
    if (yes) yes.checked = mbLearningGuideOn();
    if (no)  no.checked  = !mbLearningGuideOn();

    /* Preview is meaningless while the guide is off — it would show a
       table that will not be in the document. Disabled rather than
       hidden so the button does not jump the layout on every toggle. */
    var btn = document.getElementById('lg-preview-btn');
    if (btn) {
        btn.disabled = !mbLearningGuideOn();
        btn.style.opacity = mbLearningGuideOn() ? '1' : '0.45';
        btn.style.cursor  = mbLearningGuideOn() ? 'pointer' : 'not-allowed';
    }
}

// ============================================================
// Preview — read-only, every outcome, one scroll
// ============================================================

function _lgEscape(s) {
    return String(s === null || s === undefined ? '' : s)
        .replace(/[&<>"]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
        });
}

/** One outcome's guide as an HTML table. */
function _lgRenderTable(model, rtl) {
    var align = rtl ? 'right' : 'left';
    var html = '<table class="lg-table" dir="' + (rtl ? 'rtl' : 'ltr') + '">';
    html += '<thead><tr>' +
        '<th style="text-align:' + align + '">' + _lgEscape(model.colActivities) + '</th>' +
        '<th style="text-align:' + align + '">' + _lgEscape(model.colInstructions) + '</th>' +
        '</tr></thead><tbody>';

    model.sections.forEach(function (sec) {
        html += '<tr class="lg-head-row">' +
            '<td style="text-align:' + align + '"><strong>' + _lgEscape(sec.header) + '</strong></td>' +
            '<td style="text-align:' + align + '"><ul class="lg-instr">' +
            sec.instructions.map(function (i) { return '<li>' + _lgEscape(i) + '</li>'; }).join('') +
            '</ul></td></tr>';

        if (sec.groupItems) {
            html += '<tr><td style="text-align:' + align + '">' +
                sec.items.map(function (i) { return _lgEscape(i); }).join('<br/>') +
                '</td><td></td></tr>';
        } else {
            sec.items.forEach(function (item) {
                html += '<tr><td style="text-align:' + align + '">' + _lgEscape(item) + '</td><td></td></tr>';
            });
        }
    });

    return html + '</tbody></table>';
}

/**
 * Open the preview.
 *
 * Built as its own overlay rather than through mbAlert(): that dialog
 * takes textContent only, deliberately, because every message it shows
 * interpolates something the user typed. A table is not a message.
 */
function previewLearningGuide() {
    /* Whatever is open in the editor has not necessarily reached state
       yet, and a preview that omits the sheet the author is looking at
       is the one thing this feature cannot afford. */
    if (typeof syncProjectTextFromDOM === 'function') syncProjectTextFromDOM();
    if (mbState.currentLOId && typeof saveCurrentSheetToLO === 'function') saveCurrentSheetToLO();
    if (mbState.currentModuleId && typeof saveCurrentModuleLOData === 'function') saveCurrentModuleLOData();

    var lang = (typeof contentLang === 'function') ? contentLang() : 'en';
    var rtl  = (typeof biIsRtl === 'function') ? biIsRtl(lang) : (lang === 'ar');

    var body = '';
    (mbState.learningOutcomesData || []).forEach(function (lo, i) {
        var model = mbBuildLearningGuideModel(lo, i, lang);
        if (!model) return;
        var loLabel = window.i18n.tfIn('expLearningOutcomeN', lang, { v0: i + 1, v1: model.outcomeTitle });
        body += '<div class="lg-block">' +
            '<div class="lg-lo-label" dir="' + (rtl ? 'rtl' : 'ltr') + '">' + _lgEscape(loLabel) + '</div>' +
            '<div class="lg-page-title" dir="' + (rtl ? 'rtl' : 'ltr') + '">' + _lgEscape(model.title) + '</div>' +
            _lgRenderTable(model, rtl) +
            '</div>';
    });

    if (!body) body = '<p class="lg-empty">' + _lgEscape(window.i18n.t('lgNothingToShow')) + '</p>';

    var overlay = document.createElement('div');
    overlay.className = 'lg-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    var box = document.createElement('div');
    box.className = 'lg-modal';
    /* The CHROME follows the interface language; the tables inside carry
       their own dir, because they are content. Same split as dialog.js. */
    box.setAttribute('dir', (window.i18n && window.i18n.isRTL && window.i18n.isRTL()) ? 'rtl' : 'ltr');

    box.innerHTML =
        '<div class="lg-modal-head">' +
            '<span class="lg-modal-title">' + _lgEscape(window.i18n.t('lgPreviewTitle')) + '</span>' +
            '<button type="button" class="lg-close" aria-label="' + _lgEscape(window.i18n.t('lgClose')) + '">✕</button>' +
        '</div>' +
        '<div class="lg-readonly-note">' + _lgEscape(window.i18n.t('lgReadOnlyNote')) + '</div>' +
        '<div class="lg-modal-body">' + body + '</div>' +
        '<div class="lg-modal-foot"><button type="button" class="lg-close-btn">' +
            _lgEscape(window.i18n.t('lgClose')) + '</button></div>';

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    function close() {
        document.removeEventListener('keydown', onKey, true);
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }
    function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); close(); } }
    document.addEventListener('keydown', onKey, true);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    box.querySelector('.lg-close').addEventListener('click', close);
    box.querySelector('.lg-close-btn').addEventListener('click', close);
}

/* Paint the toggle once the markup exists. Cheap, and it means the
   radios agree with state after a project load without every load path
   having to remember to call it — mbRenderLearningGuideToggle() is also
   called from storage.js and autosave.js for the same reason. */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mbRenderLearningGuideToggle);
} else {
    mbRenderLearningGuideToggle();
}
