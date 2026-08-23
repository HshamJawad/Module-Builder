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
        el.setAttribute('dir', cl === 'ar' ? 'rtl' : 'ltr');
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

function saveWork() {
    try {
        // Save current sheet to LO before creating backup
        if (mbState.currentLOId) {
            saveCurrentSheetToLO();
        }
        
        // Save current module's LO data
        if (mbState.currentModuleId) {
            saveCurrentModuleLOData();
        }
        
        // Save cover data
        syncProjectTextFromDOM();
        saveCoverData();
        
        // Save work team data
        saveWorkTeamData();
        
        const data = {
            version: '3.0',
            schemaVersion: 4,      // bilingual { en, ar } content
            coversAdditionalInfo: mbState.coversAdditionalInfo,
            coversAdditionalNotes: mbState.coversAdditionalNotes,
            frontCoverImage: mbState.frontCoverImage,
            backCoverImage: mbState.backCoverImage,
            coverRows: mbState.coverRows,
            coverRowIdCounter: mbState.coverRowIdCounter,
            teamMembers: mbState.teamMembers,
            teamMemberIdCounter: mbState.teamMemberIdCounter,
            introAdditionalDetails: mbState.introAdditionalDetails,
            introBlocks: mbState.introBlocks,
            modules: mbState.modulesData,
            currentModuleId: mbState.currentModuleId,
            moduleIdCounter: mbState.moduleIdCounter,
            currentLOId: mbState.currentLOId,
            loIdCounter: mbState.loIdCounter,
            assessmentContent: mbState.assessmentContent,
            assessmentFormsData: mbState.assessmentFormsData,
            referencesTitle: mbState.referencesTitle,
            referencesData: mbState.referencesData,
            refIdCounter: mbState.refIdCounter,
            /* Saved whole, empty or not. An empty object costs two bytes
               and keeps the load path symmetric with this one; the
               "don't print empty fields" rule belongs to the export, not
               to the file format. */
            tvqfBasic: mbState.tvqfBasic,
            tvqfExtended: mbState.tvqfExtended,
        };

        // Create and download JSON file
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = getExportFilename('json');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        showStatus(window.i18n.t('dgWorkSavedSuccessfully'), 'success');
    } catch (error) {
        console.error('Save error:', error);
        showStatus(window.i18n.t('dgErrorSavingWork') + error.message, 'error');
        /* Route to error handler with SAVE context */
        if (window.onerror) window.onerror('[SAVE] ' + error.message, 'saveWork', 0, 0, error);
    }
}

function loadWork() {
    document.getElementById('load-file-input').click();
}

function handleLoadFile() {
    const input = document.getElementById('load-file-input');
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = mbAssignProjectUids(biMigrateProject(JSON.parse(e.target.result)));
            /* Every project file written before Schema v4 holds bare
               strings. Migration runs here, on the way IN, and nowhere
               else — so the rest of the app may assume pairs, and a file
               is never rewritten on disk until the user saves. */
            
            // Check if this is v3.0 with module support
            if (data.version === '3.0' && data.modules) {
                // Load cover data
                if (document.getElementById('covers-additional-info')) {
                    mbState.coversAdditionalInfo = biUpgrade(data.coversAdditionalInfo);
                }
                if (document.getElementById('covers-additional-notes')) {
                    mbState.coversAdditionalNotes = biUpgrade(data.coversAdditionalNotes);
                }
                // Load front & back cover images
                mbState.frontCoverImage = data.frontCoverImage || null;
                if (mbState.frontCoverImage) { _showCoverPreview('front', mbState.frontCoverImage); } else { deleteFrontCoverImage(); }
                mbState.backCoverImage = data.backCoverImage || null;
                if (mbState.backCoverImage) { _showCoverPreview('back', mbState.backCoverImage); } else { deleteBackCoverImage(); }
                if (data.coverRows) {
                    mbState.coverRows = data.coverRows;
                    mbState.coverRowIdCounter = data.coverRowIdCounter || 7;
                    renderCoverTable();
                }
                
                // Load work team data
                if (data.teamMembers) {
                    mbState.teamMembers = data.teamMembers;
                    mbState.teamMemberIdCounter = data.teamMemberIdCounter || 0;
                    renderWorkTeam();
                }
                if (document.getElementById('intro-additional-details')) {
                    mbState.introAdditionalDetails = biUpgrade(data.introAdditionalDetails);
                }
                /* mbNormalizeBlocks is idempotent and tolerates the key
                   being absent — every file saved before this feature. */
                mbState.introBlocks = mbNormalizeBlocks(data.introBlocks);
                mbRenderBlocks('intro');
                
                // Load assessment data
                if (document.getElementById('assessment-simple-content')) {
                    mbState.assessmentContent = biUpgrade(data.assessmentContent);
                    applyProjectTextToDOM();
                }
                if (data.assessmentFormsData) {
                    mbState.assessmentFormsData = data.assessmentFormsData;
                }

                // Load references data
                if (data.referencesData) {
                    mbState.referencesData = data.referencesData;
                    mbState.refIdCounter = data.refIdCounter || mbState.referencesData.length;
                }
                /* biUpgrade, not a bare assignment: biMigrateProject already
                   upgrades this field for a project that went through
                   migration, but this load path also serves the older
                   branch below where that may not have run — biUpgrade is
                   a no-op on an already-upgraded pair, so it's safe either
                   way. renderReferences() reads and displays it (with
                   biGetStrict, not string concatenation, which used to
                   print "[object Object]" the moment this became a pair). */
                if (data.referencesTitle) {
                    mbState.referencesTitle = biUpgrade(data.referencesTitle);
                }
                renderReferences();

                /* Absent in every project file written before this
                   feature existed, which is why the fallback is an empty
                   object rather than a skeleton: an older file simply has
                   no framework card, and tvqf.js creates the keys as the
                   user types. biMigrateProject has already upgraded the
                   prose fields to pairs by this point. */
                mbState.tvqfBasic    = data.tvqfBasic    || {};
                mbState.tvqfExtended = data.tvqfExtended || {};
                if (typeof mbRenderTvqf === 'function') mbRenderTvqf();
                
                // Load module data
                mbState.modulesData = data.modules || [];
                mbState.moduleIdCounter = data.moduleIdCounter || 0;
                mbState.currentModuleId = data.currentModuleId || null;
                mbState.loIdCounter = data.loIdCounter || 0;
                mbState.currentLOId = data.currentLOId || null;
                
                // If no current module but modules exist, select first
                if (!mbState.currentModuleId && mbState.modulesData.length > 0) {
                    mbState.currentModuleId = mbState.modulesData[0].id;
                }
                
                // Sync LO data from current module
                syncLearningOutcomesFromCurrentModule();
                
                // If no current LO but LOs exist in module, select first
                if (!mbState.currentLOId && mbState.learningOutcomesData.length > 0) {
                    mbState.currentLOId = mbState.learningOutcomesData[0].id;
                }
                
                renderModuleSelector();
                renderLOSelector();
                loadCurrentLOSheets();
                showStatus(window.i18n.t('dgWorkLoadedSuccessfully'), 'success');
            }
            // Check if this is v2.0 with Learning Outcomes (convert to v3.0)
            else if (data.version === '2.0' && data.learningOutcomes) {
                // Load cover data
                if (document.getElementById('covers-additional-info')) {
                    mbState.coversAdditionalInfo = biUpgrade(data.coversAdditionalInfo);
                }
                if (document.getElementById('covers-additional-notes')) {
                    mbState.coversAdditionalNotes = biUpgrade(data.coversAdditionalNotes);
                }
                // Load front & back cover images
                mbState.frontCoverImage = data.frontCoverImage || null;
                if (mbState.frontCoverImage) { _showCoverPreview('front', mbState.frontCoverImage); } else { deleteFrontCoverImage(); }
                mbState.backCoverImage = data.backCoverImage || null;
                if (mbState.backCoverImage) { _showCoverPreview('back', mbState.backCoverImage); } else { deleteBackCoverImage(); }
                if (data.coverRows) {
                    mbState.coverRows = data.coverRows;
                    mbState.coverRowIdCounter = data.coverRowIdCounter || 7;
                    renderCoverTable();
                }
                
                // Load work team data
                if (data.teamMembers) {
                    mbState.teamMembers = data.teamMembers;
                    mbState.teamMemberIdCounter = data.teamMemberIdCounter || 0;
                    renderWorkTeam();
                }
                if (document.getElementById('intro-additional-details')) {
                    mbState.introAdditionalDetails = biUpgrade(data.introAdditionalDetails);
                }
                /* mbNormalizeBlocks is idempotent and tolerates the key
                   being absent — every file saved before this feature. */
                mbState.introBlocks = mbNormalizeBlocks(data.introBlocks);
                mbRenderBlocks('intro');
                
                // Load assessment data
                if (document.getElementById('assessment-simple-content')) {
                    mbState.assessmentContent = biUpgrade(data.assessmentContent);
                    applyProjectTextToDOM();
                }
                if (data.assessmentFormsData) {
                    mbState.assessmentFormsData = data.assessmentFormsData;
                }

                // Load references data
                if (data.referencesData) {
                    mbState.referencesData = data.referencesData;
                    mbState.refIdCounter = data.refIdCounter || mbState.referencesData.length;
                }
                /* biUpgrade, not a bare assignment: biMigrateProject already
                   upgrades this field for a project that went through
                   migration, but this load path also serves the older
                   branch below where that may not have run — biUpgrade is
                   a no-op on an already-upgraded pair, so it's safe either
                   way. renderReferences() reads and displays it (with
                   biGetStrict, not string concatenation, which used to
                   print "[object Object]" the moment this became a pair). */
                if (data.referencesTitle) {
                    mbState.referencesTitle = biUpgrade(data.referencesTitle);
                }
                renderReferences();

                /* Absent in every project file written before this
                   feature existed, which is why the fallback is an empty
                   object rather than a skeleton: an older file simply has
                   no framework card, and tvqf.js creates the keys as the
                   user types. biMigrateProject has already upgraded the
                   prose fields to pairs by this point. */
                mbState.tvqfBasic    = data.tvqfBasic    || {};
                mbState.tvqfExtended = data.tvqfExtended || {};
                if (typeof mbRenderTvqf === 'function') mbRenderTvqf();
                
                // Convert v2.0 to v3.0: wrap LOs in a module
                mbState.moduleIdCounter = 1;
                mbState.modulesData = [{
                    id: 'module-1',
                    title: 'Imported Module',
                    learningOutcomes: data.learningOutcomes || []
                }];
                mbState.currentModuleId = 'module-1';
                mbState.loIdCounter = data.loIdCounter || 0;
                mbState.currentLOId = data.currentLOId || null;
                
                syncLearningOutcomesFromCurrentModule();
                
                if (!mbState.currentLOId && mbState.learningOutcomesData.length > 0) {
                    mbState.currentLOId = mbState.learningOutcomesData[0].id;
                }
                
                renderModuleSelector();
                renderLOSelector();
                loadCurrentLOSheets();
                showStatus(window.i18n.t('dgWorkLoadedSuccessfullyConvertedFro'), 'success');
            } else {
                // Convert old format to new
                if (document.getElementById('covers-additional-info')) {
                    document.getElementById('covers-additional-info').value = data.coversContent || '';
                }
                document.getElementById('assessment-placeholder').value = data.assessmentContent || '';
                
                mbState.loIdCounter = 1;
                mbState.learningOutcomesData = [{
                    id: 'lo-1',
                    title: 'Imported Learning Outcome',
                    infoSheets: [],
                    activitySheets: []
                }];
                
                if (data.infoTitle || data.infoObjective) {
                    mbState.learningOutcomesData[0].infoSheets.push({
                        sheetNumber: data.infoSheetNumber || '',
                        title: data.infoTitle || '',
                        objective: data.infoObjective || '',
                        linkSubject: data.infoLinkSubject || '',
                        linkUrl: data.infoLinkUrl || '',
                        qrImage: data.infoQRImage || null,
                        selfCheckNumber: data.selfCheckNumber || '',
                        selfCheckContent: data.selfCheckContent || '',
                        answersKeyNumber: data.answersKeyNumber || '',
                        answersKeyContent: data.answersKeyContent || '',
                        contentSections: data.contentSections || [],
                        contentSectionImages: data.contentSectionImages || {}
                    });
                }
                
                if (data.title || data.objective) {
                    mbState.learningOutcomesData[0].activitySheets.push({
                        sheetNumber: data.sheetNumber || '',
                        title: data.title || '',
                        objective: data.objective || '',
                        duration: data.duration || '0',
                        linkSubject: data.activityLinkSubject || '',
                        linkUrl: data.activityLinkUrl || '',
                        qrImage: data.activityQRImage || null,
                        resources: data.resources || [],
                        steps: data.steps || [],
                        images: data.images || {},
                        includeCriteria: data.includeCriteria || false,
                        criteriaTitle: data.criteriaTitle || '',
                        criteriaInstruction: data.criteriaInstruction || '',
                        criteriaFooter: data.criteriaFooter || '',
                        criteria: data.criteria || []
                    });
                }
                
                mbState.currentLOId = 'lo-1';
                renderLOSelector();
                loadCurrentLOSheets();
                showStatus(window.i18n.t('dgOldFormatImportedSuccessfully'), 'success');
            }
        } catch (error) {
            console.error('Load error:', error);
            showStatus(window.i18n.t('dgErrorLoadingWork') + error.message, 'error');
            /* Route to error handler with LOAD context */
            if (window.onerror) window.onerror('[LOAD] ' + error.message, 'handleLoadFile', 0, 0, error);
        }
    };
    reader.readAsText(file);
    input.value = '';
}

async function clearAll() {
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
        mbState.coverRows = MB_COVER_SEED_KEYS.map(function (key, i) {
            return { id: i + 1, seedKey: key, label: biNew(), value: biNew() };
        });
        mbState.coverRowIdCounter = MB_COVER_SEED_KEYS.length;
        renderCoverTable();

        // ── Introduction tab ──────────────────────────────────────
        mbState.teamMembers = [];
        mbState.teamMemberIdCounter = 0;
        renderWorkTeam();
        const introDetails = document.getElementById('intro-additional-details');
        if (introDetails) introDetails.value = '';
        mbState.introBlocks = [];
        mbRenderBlocks('intro');

        // ── Information Sheet tab ─────────────────────────────────
        document.getElementById('info-sheet-number').value = '';
        document.getElementById('info-title').value = '';
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

        // ── Qualifications-framework card ─────────────────────────
        mbState.tvqfBasic = {};
        mbState.tvqfExtended = {};
        if (typeof mbRenderTvqf === 'function') mbRenderTvqf();

        // ── Instructional marks ───────────────────────────────────
        document.querySelectorAll('.marks-container').forEach(c => { c.innerHTML = ''; });
        mbState.markItemCount = 0;

        // Re-add initial empty rows for info/activity forms
        addContentSection();
        addResource(); addResource();
        addStep();

        // ── Modules & Learning Outcomes ───────────────────────────
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

        await initializeLearningOutcomes();
        showStatus(window.i18n.t('dgAllDataCleared'), 'success');
    }
}
