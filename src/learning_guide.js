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

/* ── This feature's own strings ───────────────────────────────────
   Carried HERE, not only in mb-translations.js, and this is not
   duplication for its own sake.

   A key that is missing from the dictionary does not fail loudly: the
   i18n engine returns the key itself, so the card renders the literal
   text "lgSectionLabel" and the guide exports with "lgInfoHeader" as a
   heading. That is what happens whenever this file is deployed and the
   dictionary file is not — an entirely ordinary thing to do when
   copying a handful of changed files onto a server — and the failure
   looks like a bug in the feature rather than a missing file.

   So the strings ship with the code that uses them. mb-translations.js
   still carries the same keys, for the audit tooling and for anyone
   translating the tool from one place, but nothing here depends on it.
   The table below is authoritative; the dictionary is consulted only
   for keys that genuinely belong to it (expInfoSheetTitled and its
   siblings, which the sheets themselves already use). */
var MB_LG_STRINGS = {
    en: {
        lgTitle: "Learning Guide",
        lgColActivities: "Activities",
        lgColInstructions: "Detailed Instructions",
        lgInfoHeader: "{v0}- Read the following information sheets for this learning outcome:",
        lgInfoInstr1: "Read carefully what is written on the guidance notes.",
        lgInfoInstr2: "Study the information sheets carefully and focus on acquiring the required knowledge.",
        lgSelfHeader: "{v0}- Answer the self-check questions at the end of the following information sheets for this learning outcome:",
        lgSelfInstr1: "Answer the questions without going back to the information sheet.",
        lgSelfInstr2: "Compare your answers with the model answers held by the trainer.",
        lgSelfInstr3: "Review the information again to correct your mistakes.",
        lgSelfItemsLabel: "Numbered self-check questions:",
        lgActHeader: "{v0}- Carry out what is asked of you in the following activity sheets for this learning outcome:",
        lgActInstr1: "Read the activity steps carefully.",
        lgActInstr2: "Start carrying out the activity.",
        lgActInstr3: "Inform the facilitator when you have completed the activity.",
        lgSectionLabel: "\uD83D\uDCD1 Learning Guide (Optional)",
        lgSectionNote: "One guide per learning outcome \u2014 placed just before its first information sheet",
        lgQuestion: "Include a Learning Guide table for each learning outcome?",
        lgYes: "Yes, include it",
        lgNo: "No",
        lgPreviewBtn: "\uD83D\uDC41 PREVIEW",
        lgHint: "The table fills itself from the sheet titles and self-check numbers you have already entered. It is read-only here; edit it in Word after export if you need to.",
        lgPreviewTitle: "Learning Guide \u2014 Preview",
        lgReadOnlyNote: "Read-only preview. This table is generated from your sheets and can be edited after export.",
        lgClose: "Close",
        lgNothingToShow: "Nothing to show yet \u2014 add information or activity sheets first.",
        lgEnabled: "Learning Guide will be included",
        lgDisabled: "Learning Guide will not be included"
    },
    fr: {
        lgTitle: "Guide d'apprentissage",
        lgColActivities: "Activit\u00e9s",
        lgColInstructions: "Instructions d\u00e9taill\u00e9es",
        lgInfoHeader: "{v0}- Lisez les fiches d'information suivantes relatives \u00e0 ce r\u00e9sultat d'apprentissage :",
        lgInfoInstr1: "Lisez attentivement ce qui est \u00e9crit sur les consignes.",
        lgInfoInstr2: "\u00c9tudiez les fiches d'information avec soin et concentrez-vous sur l'acquisition des connaissances requises.",
        lgSelfHeader: "{v0}- R\u00e9pondez aux questions d'auto-\u00e9valuation \u00e0 la fin des fiches d'information suivantes :",
        lgSelfInstr1: "R\u00e9pondez aux questions sans revenir \u00e0 la fiche d'information.",
        lgSelfInstr2: "Comparez vos r\u00e9ponses avec le corrig\u00e9 d\u00e9tenu par le formateur.",
        lgSelfInstr3: "Revoyez les informations pour corriger vos erreurs.",
        lgSelfItemsLabel: "Questions d'auto-\u00e9valuation num\u00e9rot\u00e9es :",
        lgActHeader: "{v0}- R\u00e9alisez ce qui vous est demand\u00e9 dans les fiches d'activit\u00e9 suivantes :",
        lgActInstr1: "Lisez attentivement les \u00e9tapes de l'activit\u00e9.",
        lgActInstr2: "Commencez \u00e0 r\u00e9aliser l'activit\u00e9.",
        lgActInstr3: "Informez le facilitateur lorsque vous avez termin\u00e9 l'activit\u00e9.",
        lgSectionLabel: "\uD83D\uDCD1 Guide d'apprentissage (facultatif)",
        lgSectionNote: "Un guide par r\u00e9sultat d'apprentissage \u2014 plac\u00e9 juste avant sa premi\u00e8re fiche d'information",
        lgQuestion: "Inclure un tableau \u00ab Guide d'apprentissage \u00bb pour chaque r\u00e9sultat d'apprentissage ?",
        lgYes: "Oui, l'inclure",
        lgNo: "Non",
        lgPreviewBtn: "\uD83D\uDC41 APER\u00c7U",
        lgHint: "Le tableau se remplit \u00e0 partir des titres de fiches et des num\u00e9ros d'auto-\u00e9valuation d\u00e9j\u00e0 saisis. Il est en lecture seule ici ; modifiez-le dans Word apr\u00e8s l'exportation.",
        lgPreviewTitle: "Guide d'apprentissage \u2014 Aper\u00e7u",
        lgReadOnlyNote: "Aper\u00e7u en lecture seule. Ce tableau est g\u00e9n\u00e9r\u00e9 \u00e0 partir de vos fiches et peut \u00eatre modifi\u00e9 apr\u00e8s l'exportation.",
        lgClose: "Fermer",
        lgNothingToShow: "Rien \u00e0 afficher pour l'instant \u2014 ajoutez d'abord des fiches d'information ou d'activit\u00e9.",
        lgEnabled: "Le guide d'apprentissage sera inclus",
        lgDisabled: "Le guide d'apprentissage ne sera pas inclus"
    },
    ar: {
        lgTitle: "\u062f\u0644\u064a\u0644 \u0627\u0644\u062a\u0639\u0644\u0645",
        lgColActivities: "\u0627\u0644\u0623\u0646\u0634\u0637\u0629",
        lgColInstructions: "\u062a\u0639\u0644\u064a\u0645\u0627\u062a \u062a\u0641\u0635\u064a\u0644\u064a\u0629",
        lgInfoHeader: "{v0}- \u0627\u0642\u0631\u0623 \u0623\u0648\u0631\u0627\u0642 \u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0627\u0644\u062a\u0627\u0644\u064a\u0629 \u0627\u0644\u062e\u0627\u0635\u0629 \u0628\u0647\u0630\u0647 \u0627\u0644\u0645\u062d\u0635\u0644\u0629:",
        lgInfoInstr1: "\u0625\u0642\u0631\u0623 \u0628\u0639\u0646\u0627\u064a\u0629 \u0645\u0627 \u0647\u0648 \u0645\u0643\u062a\u0648\u0628 \u0641\u064a \u0627\u0644\u0639\u0644\u0627\u0645\u0627\u062a \u0627\u0644\u0625\u0631\u0634\u0627\u062f\u064a\u0629.",
        lgInfoInstr2: "\u0623\u062f\u0631\u0633 \u0623\u0648\u0631\u0627\u0642 \u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0628\u0639\u0646\u0627\u064a\u0629 \u0648\u0631\u0643\u0651\u0632 \u0639\u0644\u0649 \u0627\u0643\u062a\u0633\u0627\u0628 \u0627\u0644\u0645\u0639\u0627\u0631\u0641 \u0627\u0644\u0645\u0637\u0644\u0648\u0628\u0629.",
        lgSelfHeader: "{v0}- \u0623\u062c\u0628 \u0639\u0644\u0649 \u0623\u0633\u0626\u0644\u0629 \u0627\u0644\u062a\u0642\u064a\u064a\u0645 \u0627\u0644\u0630\u0627\u062a\u064a \u0641\u064a \u0646\u0647\u0627\u064a\u0629 \u0623\u0648\u0631\u0627\u0642 \u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0627\u0644\u062a\u0627\u0644\u064a\u0629 \u0627\u0644\u062e\u0627\u0635\u0629 \u0628\u0647\u0630\u0647 \u0627\u0644\u0645\u062d\u0635\u0644\u0629:",
        lgSelfInstr1: "\u0623\u062c\u0628 \u0639\u0644\u0649 \u0627\u0644\u0623\u0633\u0626\u0644\u0629 \u062f\u0648\u0646 \u0627\u0644\u0631\u062c\u0648\u0639 \u0625\u0644\u0649 \u0648\u0631\u0642\u0629 \u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062a.",
        lgSelfInstr2: "\u0642\u0627\u0631\u0646 \u0623\u062c\u0648\u0628\u062a\u0643 \u0645\u0639 \u0627\u0644\u0623\u062c\u0648\u0628\u0629 \u0627\u0644\u0646\u0645\u0648\u0630\u062c\u064a\u0629 \u0644\u062f\u0649 \u0627\u0644\u0645\u062f\u0631\u0651\u0628.",
        lgSelfInstr3: "\u0623\u0639\u062f \u0645\u0631\u0627\u062c\u0639\u0629 \u0627\u0644\u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0644\u062a\u0635\u062d\u064a\u062d \u0623\u062e\u0637\u0627\u0626\u0643.",
        lgSelfItemsLabel: "\u0623\u0633\u0626\u0644\u0629 \u0627\u0644\u062a\u0642\u064a\u064a\u0645 \u0627\u0644\u0630\u0627\u062a\u064a \u0627\u0644\u0645\u0631\u0642\u0645\u0629:",
        lgActHeader: "{v0}- \u0623\u0646\u062c\u0632 \u0645\u0627 \u0647\u0648 \u0645\u0637\u0644\u0648\u0628 \u0645\u0646\u0643 \u0641\u064a \u0623\u0648\u0631\u0627\u0642 \u0627\u0644\u0646\u0634\u0627\u0637 \u0627\u0644\u062a\u0627\u0644\u064a\u0629 \u0627\u0644\u062e\u0627\u0635\u0629 \u0628\u0647\u0630\u0647 \u0627\u0644\u0645\u062d\u0635\u0644\u0629:",
        lgActInstr1: "\u0625\u0642\u0631\u0623 \u062e\u0637\u0648\u0627\u062a \u0627\u0644\u0646\u0634\u0627\u0637 \u0628\u062f\u0642\u0629.",
        lgActInstr2: "\u0625\u0628\u062f\u0623 \u0628\u062a\u0646\u0641\u064a\u0630 \u0627\u0644\u0646\u0634\u0627\u0637.",
        lgActInstr3: "\u0623\u0639\u0644\u0650\u0645 \u0627\u0644\u0645\u064a\u0633\u0651\u0631 \u0639\u0646\u062f \u0625\u0643\u0645\u0627\u0644\u0643 \u0627\u0644\u0646\u0634\u0627\u0637.",
        lgSectionLabel: "\uD83D\uDCD1 \u062f\u0644\u064a\u0644 \u0627\u0644\u062a\u0639\u0644\u0645 (\u0627\u062e\u062a\u064a\u0627\u0631\u064a)",
        lgSectionNote: "\u062f\u0644\u064a\u0644 \u0648\u0627\u062d\u062f \u0644\u0643\u0644 \u0645\u062d\u0635\u0644\u0629 \u062a\u0639\u0644\u0645 \u2014 \u064a\u0648\u0636\u0639 \u0642\u0628\u0644 \u0623\u0648\u0644 \u0648\u0631\u0642\u0629 \u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0644\u0647\u0627 \u0645\u0628\u0627\u0634\u0631\u0629",
        lgQuestion: "\u0647\u0644 \u062a\u0631\u064a\u062f \u062a\u0636\u0645\u064a\u0646 \u062c\u062f\u0648\u0644 (\u062f\u0644\u064a\u0644 \u0627\u0644\u062a\u0639\u0644\u0645) \u0644\u0643\u0644 \u0645\u062d\u0635\u0644\u0629 \u062a\u0639\u0644\u0645\u061f",
        lgYes: "\u0646\u0639\u0645\u060c \u0636\u0645\u0651\u0646\u0647",
        lgNo: "\u0644\u0627",
        lgPreviewBtn: "\uD83D\uDC41 \u0645\u0639\u0627\u064a\u0646\u0629",
        lgHint: "\u064a\u0645\u0644\u0623 \u0627\u0644\u062c\u062f\u0648\u0644 \u0646\u0641\u0633\u0647 \u062a\u0644\u0642\u0627\u0626\u064a\u0627\u064b \u0645\u0646 \u0639\u0646\u0627\u0648\u064a\u0646 \u0627\u0644\u0623\u0648\u0631\u0627\u0642 \u0648\u0623\u0631\u0642\u0627\u0645 \u0627\u0644\u062a\u0642\u064a\u064a\u0645 \u0627\u0644\u0630\u0627\u062a\u064a \u0627\u0644\u062a\u064a \u0623\u062f\u062e\u0644\u062a\u0647\u0627. \u0627\u0644\u0645\u0639\u0627\u064a\u0646\u0629 \u0644\u0644\u0642\u0631\u0627\u0621\u0629 \u0641\u0642\u0637 \u2014 \u064a\u0645\u0643\u0646\u0643 \u062a\u0639\u062f\u064a\u0644 \u0627\u0644\u062c\u062f\u0648\u0644 \u0641\u064a Word \u0628\u0639\u062f \u0627\u0644\u062a\u0635\u062f\u064a\u0631.",
        lgPreviewTitle: "\u062f\u0644\u064a\u0644 \u0627\u0644\u062a\u0639\u0644\u0645 \u2014 \u0645\u0639\u0627\u064a\u0646\u0629",
        lgReadOnlyNote: "\u0645\u0639\u0627\u064a\u0646\u0629 \u0644\u0644\u0642\u0631\u0627\u0621\u0629 \u0641\u0642\u0637. \u0647\u0630\u0627 \u0627\u0644\u062c\u062f\u0648\u0644 \u064a\u064f\u0628\u0646\u0649 \u062a\u0644\u0642\u0627\u0626\u064a\u0627\u064b \u0645\u0646 \u0623\u0648\u0631\u0627\u0642\u0643 \u0648\u064a\u0645\u0643\u0646 \u062a\u0639\u062f\u064a\u0644\u0647 \u0628\u0639\u062f \u0627\u0644\u062a\u0635\u062f\u064a\u0631.",
        lgClose: "\u0625\u063a\u0644\u0627\u0642",
        lgNothingToShow: "\u0644\u0627 \u064a\u0648\u062c\u062f \u0645\u0627 \u064a\u064f\u0639\u0631\u0636 \u0628\u0639\u062f \u2014 \u0623\u0636\u0641 \u0623\u0648\u0631\u0627\u0642 \u0645\u0639\u0644\u0648\u0645\u0627\u062a \u0623\u0648 \u0646\u0634\u0627\u0637 \u0623\u0648\u0644\u0627\u064b.",
        lgEnabled: "\u0633\u064f\u064a\u0636\u0645\u0651\u064e\u0646 \u062f\u0644\u064a\u0644 \u0627\u0644\u062a\u0639\u0644\u0645",
        lgDisabled: "\u0644\u0646 \u064a\u064f\u0636\u0645\u0651\u064e\u0646 \u062f\u0644\u064a\u0644 \u0627\u0644\u062a\u0639\u0644\u0645"
    }
};

/**
 * Look a key up in an EXPLICIT language.
 *
 * Our own table first, the dictionary second. The order matters: the
 * table is the one that is guaranteed to be present, since it is in
 * this file. The dictionary handles the keys this feature borrows from
 * the rest of the tool (expInfoSheetTitled, expActivitySheetTitled,
 * expLearningOutcomeN) so a sheet title reads identically in the guide
 * and on the sheet's own page.
 */
function _lgT(key, lang, vars) {
    var table = MB_LG_STRINGS[lang] || MB_LG_STRINGS.en;
    var s = table[key];
    if (s === undefined) s = MB_LG_STRINGS.en[key];
    if (s === undefined) {
        if (!window.i18n) return key;
        return vars ? window.i18n.tfIn(key, lang, vars) : window.i18n.tIn(key, lang);
    }
    if (!vars) return s;
    return s.replace(/\{(\w+)\}/g, function (m, k) {
        return vars[k] !== undefined ? vars[k] : m;
    });
}

/** The same lookup, in the INTERFACE language — for the card and modal. */
function _lgUI(key) {
    var lang = (window.i18n && window.i18n.getLang) ? window.i18n.getLang() : 'en';
    return _lgT(key, lang);
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
        showStatus(_lgUI(on ? 'lgEnabled' : 'lgDisabled'), 'success');
    }
    /* No explicit autosave call: this handler runs off the radio's own
       `change`, and autosave.js already listens for `change` on
       #main-container. Calling a save here as well would write the
       snapshot twice for one click. */
}

function mbRenderLearningGuideToggle() {
    /* Every visible word of the card is written HERE rather than left to
       a data-i18n sweep. Two reasons, and the second is the one that
       bit: the sweep can only paint keys the dictionary knows, so a
       missing key renders as the key itself; and it runs on its own
       schedule, so the card could be built before the sweep or after it
       depending on script order. Writing the text at render time, from
       the table in this file, makes both problems structurally
       impossible. */
    var setText = function (id, key) {
        var el = document.getElementById(id);
        if (el) el.textContent = _lgUI(key);
    };
    setText('lg-card-label',    'lgSectionLabel');
    setText('lg-card-note',     'lgSectionNote');
    setText('lg-question',      'lgQuestion');
    setText('lg-yes-label',     'lgYes');
    setText('lg-no-label',      'lgNo');
    setText('lg-preview-btn',   'lgPreviewBtn');
    setText('lg-hint',          'lgHint');

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
        var loLabel = _lgT('expLearningOutcomeN', lang, { v0: i + 1, v1: model.outcomeTitle });
        body += '<div class="lg-block">' +
            '<div class="lg-lo-label" dir="' + (rtl ? 'rtl' : 'ltr') + '">' + _lgEscape(loLabel) + '</div>' +
            '<div class="lg-page-title" dir="' + (rtl ? 'rtl' : 'ltr') + '">' + _lgEscape(model.title) + '</div>' +
            _lgRenderTable(model, rtl) +
            '</div>';
    });

    if (!body) body = '<p class="lg-empty">' + _lgEscape(_lgUI('lgNothingToShow')) + '</p>';

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
            '<span class="lg-modal-title">' + _lgEscape(_lgUI('lgPreviewTitle')) + '</span>' +
            '<button type="button" class="lg-close" aria-label="' + _lgEscape(_lgUI('lgClose')) + '">✕</button>' +
        '</div>' +
        '<div class="lg-readonly-note">' + _lgEscape(_lgUI('lgReadOnlyNote')) + '</div>' +
        '<div class="lg-modal-body">' + body + '</div>' +
        '<div class="lg-modal-foot"><button type="button" class="lg-close-btn">' +
            _lgEscape(_lgUI('lgClose')) + '</button></div>';

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

/* Paint the card once the markup exists, and REPAINT on every interface
   language switch.

   `mb:langchange` is fired by applyTranslations() in mb-translations.js
   at the end of every switch, and listening for it is what lets this
   card carry its own strings without opting out of the language button:
   the dictionary sweep skips these elements (they have no data-i18n),
   and this listener paints them instead. Same event, same moment, one
   source of truth per string.

   Also called from storage.js and autosave.js after a project load, so
   the radios agree with the flag that was just restored. */
function _lgBoot() {
    mbRenderLearningGuideToggle();
}
/* The listener is attached NOW, not inside a readyState branch. Those
   branches are a trap: if the document has already finished loading,
   a DOMContentLoaded listener added here never fires at all, and the
   card silently keeps whatever text it was born with — empty, in this
   case, since the strings are painted rather than in the markup. Found
   by booting the app headless, where the parse finishes before the
   scripts are evaluated. Attaching unconditionally, then painting once
   now and once more when the DOM is ready, is correct in both orders
   and costs one extra render. */
window.addEventListener('mb:langchange', mbRenderLearningGuideToggle);
document.addEventListener('DOMContentLoaded', _lgBoot);
_lgBoot();
