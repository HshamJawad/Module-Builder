// ============================================================
// /src/mb_state.js
// Single source of truth for all mutable application state.
//
// Phase 1 Step B: these were 26 bare globals declared with let/const at
// the top of the monolith's script block. A `let` at the top level of a
// classic script is a LEXICAL global — it is not a property of window,
// and it shadows any property of the same name. autosave.js restored by
// writing window.modulesData = ..., which therefore landed somewhere no
// reader ever looked: restore had been silently dead. Collapsing every
// global into one object removes that whole class of failure, and is
// also the precondition for a storage layer that can be swapped for a
// server later.
//
// Access pattern: mbState.modulesData, mbState.currentLOId, and so on.
// Nothing in the app declares state of its own.
// ============================================================

var mbState = {

    // ── Counters ───────────────────────────────────────────────
    resourceCount: 0,
    stepCount: 0,
    criteriaCount: 0,
    contentSectionCount: 0,
    markItemCount: 0,

    // ── Images ─────────────────────────────────────────────────
    contentSectionImages: {},   // { contentId: [images] }
    /* Was a top-level `const stepImages` in steps.js. Being a lexical
       global it sat in the temporal dead zone until that file ran — and
       the i18n engine boots from the FIRST script, so anything it
       triggered before then threw ReferenceError rather than reading an
       empty object. Found by booting the app under jsdom. */
    stepImages: {},             // { stepId: [images] }
    infoQRImage: null,
    activityQRImage: null,
    frontCoverImage: null,
    backCoverImage: null,

    // ── Sheet navigation ───────────────────────────────────────
    currentInfoSheetIndex: 0,
    currentActivitySheetIndex: 0,

    // ── Modules ────────────────────────────────────────────────
    modulesData: [],
    currentModuleId: null,
    moduleIdCounter: 0,

    // ── Learning Outcomes (legacy mirror of the active module) ─
    learningOutcomesData: [],
    currentLOId: null,
    loIdCounter: 0,

    // ── Assessment ─────────────────────────────────────────────
    assessmentFormsData: {},

    /* ── References ─────────────────────────────────────────────
       `referencesTitle` used to be a bare string default here — even
       though it is listed in BILANG_FIELDS.project as bilingual. That
       mismatch is exactly the "References" heading staying English in
       an Arabic export that you found: a brand-new project never goes
       through biMigrateProject (there is nothing to migrate FROM), so
       this literal default was the pair's only value, in every
       language, forever. It is null now and seeded the same way the
       cover-row labels are — see mbSeedReferencesTitle() in
       references.js — rather than hard-coding a second translation of
       "References" here that the dictionary would have no say over. */
    referencesTitle: null,
    referencesData: [{ id: 1, value: '' }],
    refIdCounter: 1,

    /* ── Cover table ────────────────────────────────────────────
       These labels are DATA, not interface. The user renames them, and
       once renamed the name is theirs — an interface-language switch
       must never overwrite it. So they cannot carry data-i18n and cannot
       be swept by applyTranslations.

       They are seeded instead: `mbSeedCoverLabels()` fills the label of
       any row still holding its factory key, in whichever language the
       CONTENT is being authored in, and leaves every edited row alone.
       The key is kept on the row (`seedKey`) precisely so "still
       untouched" is answerable later without tracking an edit flag that
       a paste or an undo could desynchronise.

       label/value are EMPTY PAIRS, not null. biFlattenDeep passes null
       through untouched, so a null here reached the export as null and
       `row.value.trim()` threw — caught by running a real export under
       jsdom rather than by reading. */
    coverRows: [
        { id: 1, seedKey: 'cvSector', label: { en: '', ar: '' }, value: { en: '', ar: '' } },
        { id: 2, seedKey: 'cvOccupation', label: { en: '', ar: '' }, value: { en: '', ar: '' } },
        { id: 3, seedKey: 'cvJob', label: { en: '', ar: '' }, value: { en: '', ar: '' } },
        { id: 4, seedKey: 'cvQualification', label: { en: '', ar: '' }, value: { en: '', ar: '' } },
        /* The unit's own title, distinct from the qualification's: a
           qualification is composed of units, so the two are different
           levels of granularity and naming them the same way is what
           made "Module code and Title" hold two facts in one field.
           id 8, not 5, because the ids are identity and renumbering the
           rows below it would orphan every project file that refers to
           them. Position in this array is display order; the id is not. */
        { id: 8, seedKey: 'cvUnitTitle', label: { en: '', ar: '' }, value: { en: '', ar: '' } },
        { id: 5, seedKey: 'cvModuleCode', label: { en: '', ar: '' }, value: { en: '', ar: '' } },
        { id: 6, seedKey: 'cvLevel', label: { en: '', ar: '' }, value: { en: '', ar: '' } },
        { id: 7, seedKey: 'cvVersion', label: { en: '', ar: '' }, value: { en: '', ar: '' } }
    ],
    coverRowIdCounter: 8,

    /* The nine qualifications-framework rows — entry requirements,
       qualification type, framework name, notional hours, awarding body,
       RPL, accreditation date, review due date, referencing — are NOT
       listed above. They are added by mbEnsureFrameworkRows(), which runs
       from every render, because the same nine rows also have to reach
       projects that were saved before they existed. One code path that
       serves new, loaded and legacy projects alike is one place for the
       list to be wrong; two would eventually disagree.

       This flag is what stops them coming back after the user deletes the
       ones their own framework does not ask for. */
    coverFrameworkSeeded: false,

    // ── Work team ──────────────────────────────────────────────
    teamMembers: [],
    teamMemberIdCounter: 0,

    /* ── Free-text project fields ───────────────────────────────
       These four lived ONLY in the DOM in v2: saveWork read them out of
       their textareas, and the export read them again. Nothing held
       them between the two. That was survivable while there was one
       language; it is not survivable now, because a textarea can hold
       one side of a pair and the other side has nowhere to live.
       They are state now, bilingual like everything else the user
       types, and the textareas are just a view onto them. */
    coversAdditionalInfo:  { en: '', ar: '' },
    coversAdditionalNotes: { en: '', ar: '' },
    introAdditionalDetails:{ en: '', ar: '' },
    assessmentContent:     { en: '', ar: '' },

    /* ── Retired framework card ─────────────────────────────────
       Kept as empty objects, and read on load, PURELY for migration.
       The TVQF/NQF card these held is gone: its nine own fields are
       rows of the cover table now (covers.js), and every project file
       written while the card existed still carries these two keys.
       mbMigrateTvqfRows() empties them into the table on the first
       render after a load, so a saved file never loses what was typed
       into a card the tool no longer shows.

       Do not add fields here. When enough time has passed that no file
       in circulation still carries a card, both keys and the migration
       go together. */
    tvqfBasic: {},
    tvqfExtended: {},

    /* ── Learning Guide ─────────────────────────────────────────
       One boolean, and deliberately nothing else. The guide table
       itself is DERIVED from each outcome's sheets every time it is
       rendered (see learning_guide.js), so there is no copy of the
       sheet titles here to fall out of date when a sheet is renamed.
       Default off: it is an editorial choice, not a default layout. */
    includeLearningGuide: false,

    /* Author-added introduction sections:
           [{ uid, title: { en, ar }, body: { en, ar } }]
       Not in MB_PROJECT_TEXT below — those four are one textarea each
       with a fixed id; this is a variable-length list rendered by
       blocks.js, which binds each box straight to its pair. */
    introBlocks: []
};

/* Map of textarea id → mbState key, for the four fields above. */
var MB_PROJECT_TEXT = {
    'covers-additional-info':   'coversAdditionalInfo',
    'covers-additional-notes':  'coversAdditionalNotes',
    'intro-additional-details': 'introAdditionalDetails',
    'assessment-simple-content':'assessmentContent'
};

/** DOM → state, active side only. Call before any save or export. */
function syncProjectTextFromDOM() {
    Object.keys(MB_PROJECT_TEXT).forEach(function (id) {
        var el = document.getElementById(id);
        if (el) biPut(mbState, MB_PROJECT_TEXT[id], el.value);
    });
    /* The section boxes bind live, so this is a belt-and-braces flush
       for a value set without an input event (a paste by script). */
    if (typeof mbSyncBlocksFromDOM === 'function') mbSyncBlocksFromDOM();
}

/** State → DOM, active side only. Call after load or a content-language switch. */
function applyProjectTextToDOM() {
    Object.keys(MB_PROJECT_TEXT).forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.value = biGetStrict(mbState[MB_PROJECT_TEXT[id]], contentLang());
    });
    if (typeof mbRenderAllBlocks === 'function') mbRenderAllBlocks();
}

/* Declared with `var` deliberately: this is a classic script, and `var`
   at top level puts mbState on window, so inline onclick handlers and
   any late-loading script can reach it. It is the ONE global the app
   has. */

/* Error handler — initialize immediately. */
if (typeof initErrorHandler === 'function') initErrorHandler();
