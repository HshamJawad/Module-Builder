// ============================================================
// /src/storage.js
// Save / load / clear project JSON
// Extracted verbatim from Module_Builder.html lines 4571-5003 (v2.0-legacy).
// ============================================================

/**
 * Empty the three Performance-Criteria boilerplate fields and show the
 * default wording as a PLACEHOLDER instead.
 *
 * The placeholder follows the CONTENT language, not the interface: a
 * field the author is about to type Arabic into wants an Arabic hint
 * even inside an English interface. tIn is the same lookup the DOCX
 * export uses, so what is hinted here is exactly what the export will
 * emit if the field is left alone.
 *
 * Nothing is written to `.value`, which is the whole point: an empty
 * field lets the export's localized fallback fire, in whatever language
 * the module is finally exported to.
 */
function mbSeedCriteriaPlaceholders(sheetNumber) {
    var cl  = (typeof contentLang === 'function') ? contentLang() : 'en';
    var num = sheetNumber || document.getElementById('sheet-number')?.value || '';
    var set = function (id, key, vars) {
        var el = document.getElementById(id);
        if (!el) return;
        el.value = '';
        el.placeholder = vars ? window.i18n.tfIn(key, cl, vars) : window.i18n.tIn(key, cl);
        el.setAttribute('dir', biIsRtl(cl) ? 'rtl' : 'ltr');
        el.style.textAlign = 'start';
    };
    set('criteria-title',       'expCriteriaCheckList', { v0: num });
    set('criteria-instruction', 'expCriteriaInstructionDefault');
    set('criteria-footer',      'expCriteriaFooterDefault');
}

async function clearForm() {
    if (await mbConfirm(window.i18n.t('dgAreYouSureYouWant2'))) {
        document.getElementById('sheet-number').value = '';
        document.getElementById('title').value = '';
        document.getElementById('objective-lead').value = window.i18n.tIn('mbActivityObjectiveLead', contentLang());
        document.getElementById('objective').value = '';
        document.getElementById('duration').value = '0';
        document.getElementById('resources-container').innerHTML = '';
        document.getElementById('steps-container').innerHTML = '';
        document.getElementById('activity-link-subject').value = '';
        document.getElementById('activity-link-url').value = '';
        document.getElementById('activity-qr-preview').innerHTML = '';
        mbState.activityQRImage = null;
        document.getElementById('criteria-tbody').innerHTML = '';
        /* include-criteria removed */
        /* edit-instruction removed */
        /* edit-footer removed */
        /* readOnly removed */
        /* readOnly removed */
        /* A default belongs in `.placeholder`, never in `.value`.
           These two lines used to assign the ENGLISH boilerplate to
           `.value`; the next save read it straight back out and stored it
           as if the author had typed it. That is why the Performance
           Criteria table kept coming out of an Arabic export in English:
           the export's own localized fallback
           (`activity.criteriaInstruction || _mbT(...)`) could never fire,
           because the field was never empty after a single Clear. */
        mbSeedCriteriaPlaceholders();
        toggleCriteriaSection();
        mbState.resourceCount = 0;
        mbState.stepCount = 0;
        mbState.criteriaCount = 0;
        // Clear stored images
        for (let key in mbState.stepImages) {
            delete mbState.stepImages[key];
        }
        addResource(); addResource();
        addStep();
        showStatus(window.i18n.t('dgActivitySheetCleared'), 'success');
    }
}

/**
 * 💾 Save: the OPEN MODULE as one package (.mbz) — module_library.js,
 * package_mbz.js. A module package is the tool's only file format since
 * 3.13.0: it carries the module, its pictures and its identity card, and
 * 📂 imports any number of them back.
 */
function saveWork() {
    return mbSaveModulePackage();
}

function loadWork() {
    document.getElementById('load-file-input').click();
}

/** 📂: the chosen packages are imported, one after another (package_ui.js). */
function handleLoadFile() {
    const input = document.getElementById('load-file-input');
    const files = Array.prototype.slice.call(input.files || []);
    input.value = '';
    if (!files.length) return;
    return mbImportPackages(files);
}

async function clearAll() {
    if (typeof mbIsReadOnly === 'function' && mbIsReadOnly()) return;
    if (await mbConfirm(window.i18n.t('dgConfirmClearAllDatathisWill'), { danger: true })) {

        // ── Covers tab ────────────────────────────────────────────
        const covAddInfo = document.getElementById('covers-additional-info');
        if (covAddInfo) covAddInfo.value = '';
        const covAddNotes = document.getElementById('covers-additional-notes');
        if (covAddNotes) covAddNotes.value = '';
        deleteFrontCoverImage();
        deleteBackCoverImage();
        /* Was seven hard-coded English labels with NO seedKey:
               { id: 1, label: 'Sector:', value: '' }
           which made every reset project permanently English. The seeder
           identifies a factory row by its seedKey, so a row without one
           is indistinguishable from a label the user typed themselves,
           and is (correctly) never translated. Empty bilingual pairs +
           the key: mbSeedCoverLabels() fills the text in both languages
           on the next render. */
        /* MB_COVER_ROW_ORDER, not MB_COVER_SEED_KEYS: the second is the
           positional fallback for identifying legacy rows and is frozen
           in the order those files were written. Using it here would put
           the unit title at the bottom, under Version. */
        /* mbMakeCoverRow, not an inline literal: the framework rows carry
           a `field` marker that decides whether they render as a date
           picker, a dropdown or a text box, and a second constructor here
           is exactly how that marker would go missing on reset only. */
        mbState.coverRows = MB_COVER_ROW_ORDER.map(function (key, i) {
            return mbMakeCoverRow(key, i + 1);
        });
        mbState.coverRowIdCounter = MB_COVER_ROW_ORDER.length;
        mbState.coverFrameworkSeeded = true;
        renderCoverTable();

        // ── Introduction tab ──────────────────────────────────────
        mbState.teamMembers = [];
        mbState.teamMemberIdCounter = 0;
        renderWorkTeam();
        const introDetails = document.getElementById('intro-additional-details');
        if (introDetails) introDetails.value = '';
        mbState.introBlocks = [];
        mbRenderBlocks('intro');
        mbState.includeLearningGuide = false;
        if (typeof mbRenderLearningGuideToggle === 'function') mbRenderLearningGuideToggle();

        // ── Information Sheet tab ─────────────────────────────────
        document.getElementById('info-sheet-number').value = '';
        document.getElementById('info-title').value = '';
        document.getElementById('info-objective-lead').value = window.i18n.tIn('mbInfoObjectiveLead', contentLang());
        document.getElementById('info-objective').value = '';
        document.getElementById('info-link-subject').value = '';
        document.getElementById('info-link-url').value = '';
        document.getElementById('info-qr-preview').innerHTML = '';
        mbState.infoQRImage = null;
        document.getElementById('self-check-number').value = '';
        document.getElementById('self-check-content').value = '';
        document.getElementById('answers-key-number').value = '';
        document.getElementById('answers-key-content').value = '';
        document.getElementById('content-sections-container').innerHTML = '';
        mbState.contentSectionCount = 0;
        for (let k in mbState.contentSectionImages) delete mbState.contentSectionImages[k];

        // ── Activity / Job Sheet tab ──────────────────────────────
        document.getElementById('sheet-number').value = '';
        document.getElementById('title').value = '';
        document.getElementById('objective-lead').value = window.i18n.tIn('mbActivityObjectiveLead', contentLang());
        document.getElementById('objective').value = '';
        document.getElementById('duration').value = '0';
        document.getElementById('activity-link-subject').value = '';
        document.getElementById('activity-link-url').value = '';
        document.getElementById('activity-qr-preview').innerHTML = '';
        mbState.activityQRImage = null;
        document.getElementById('resources-container').innerHTML = '';
        document.getElementById('steps-container').innerHTML = '';
        mbState.resourceCount = 0;
        mbState.stepCount = 0;
        for (let k in mbState.stepImages) delete mbState.stepImages[k];
        // Performance criteria
        document.getElementById('criteria-tbody').innerHTML = '';
        mbState.criteriaCount = 0;
        /* include-criteria removed */
        /* Empty values + translated placeholders — see the note in
           clearForm(). Hard-coded English here poisoned every new
           project on its first reset. */
        mbSeedCriteriaPlaceholders('1-1');
        toggleCriteriaSection();

        // ── Assessment tab ────────────────────────────────────────
        const assessContent = document.getElementById('assessment-simple-content');
        if (assessContent) assessContent.value = '';
        mbState.assessmentFormsData = {};
        const assessmentList = document.getElementById('assessment-forms-list');
        if (assessmentList) assessmentList.innerHTML = '<p style="color: #6b7280; text-align: center; padding: 20px;" data-i18n="dgNoAssessmentFormsYet">' +
            escapeHtml(window.i18n.t('dgNoAssessmentFormsYet')) + '</p>';

        // ── References tab ────────────────────────────────────────
        mbState.referencesTitle = null;   // reseeded by renderReferences()
        mbState.referencesData = [{ id: 1, value: '' }];
        mbState.refIdCounter = 1;
        renderReferences();

        /* ── Retired framework card ────────────────────────────────
           Cleared, not rendered: there is no card left to render, and
           leaving stale values here would have the migration write a
           reset project's table full of the previous project's
           accreditation dates on the next render. */
        mbState.tvqfBasic = {};
        mbState.tvqfExtended = {};

        // ── Instructional marks ───────────────────────────────────
        document.querySelectorAll('.marks-container').forEach(c => { c.innerHTML = ''; });
        mbState.markItemCount = 0;

        // Re-add initial empty rows for info/activity forms
        addContentSection();
        addResource(); addResource();
        addStep();

        // ── Modules & Learning Outcomes ───────────────────────────
        /* Clears the OPEN PROJECT of the library: its modules leave
           storage, and one default module replaces them. Other projects
           are not touched. */
        await mbLibraryClearModules();
        mbState.modulesData = [];
        mbState.currentModuleId = null;
        mbState.moduleIdCounter = 0;
        mbState.learningOutcomesData = [];
        mbState.currentLOId = null;
        mbState.loIdCounter = 0;
        mbState.currentInfoSheetIndex = 0;
        mbState.currentActivitySheetIndex = 0;
        updateInfoSheetNav(null);
        updateActivitySheetNav(null);

        await mbLibraryAfterClear();

        // ── Training Structure Mapping & mapped-source panels ─────
        /* These are painted from state by their own renderers and were
           never told the project changed, so the previous module's
           context, Task Analysis items and proposal stayed on screen. */
        mbState.structureProposal = null;
        if (typeof renderStructureProposal === 'function') renderStructureProposal();
        if (typeof renderSourceBrowser === 'function') renderSourceBrowser();
        if (typeof renderAssignedItemsPanel === 'function') renderAssignedItemsPanel();
        if (typeof mbRenderSheetMappedSource === 'function') {
            mbRenderSheetMappedSource('info', null);
            mbRenderSheetMappedSource('activity', null);
        }
        if (typeof updateModuleSummary === 'function') updateModuleSummary();
        if (typeof renderAssessmentForms === 'function' && Object.keys(mbState.assessmentFormsData).length) renderAssessmentForms();

        window.dispatchEvent(new CustomEvent('mb:projectcleared'));

        showStatus(window.i18n.t('dgAllDataCleared'), 'success');
    }
}
