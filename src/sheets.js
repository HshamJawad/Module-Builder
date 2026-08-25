// ============================================================
// /src/sheets.js
// Info sheet / activity sheet save-load-navigate
// Extracted verbatim from Module_Builder.html lines 3599-4152 (v2.0-legacy).
// ============================================================

/* Bilingual keys collected from the DOM on each sheet. Kept beside the
   collector rather than in bilang.js because they are DOM-shaped: they
   mirror the input ids on this screen, and they change when the screen
   changes. */
const INFO_BI     = ['title', 'objective', 'selfCheckContent', 'answersKeyContent'];
const ACTIVITY_BI = ['title', 'objective', 'criteriaTitle', 'criteriaInstruction', 'criteriaFooter'];

/* ── The objective lead-in ───────────────────────────────────
   The line that stands between «Objective:» and the list itself:
   «After studying this information sheet, you will be able to:».

   Boilerplate, not authored content — which is why it is seeded into
   ALL THREE sides at once rather than only the side being edited. Every
   other bilingual field is deliberately one-sided: writing an Arabic
   sentence into the English slot would be a fabricated translation. But
   this sentence already HAS an official wording in each language, sitting
   in the dictionary, so seeding each side with its own is not a guess.
   The alternative was ugly: author in Arabic, export in English, and the
   line silently disappears from a document whose objective list then
   begins with no introduction.

   Seeded only when the key is ABSENT. Once the key exists the stored
   value wins, empty included — a user who deletes the line means to
   delete it, and the export must respect that rather than helpfully
   putting it back on the next load. */

function mbSeedObjectiveLead(data, dictKey) {
    if (!data || data.objectiveLead !== undefined) return;
    data.objectiveLead = biNew();
    BILANG_CODES.forEach(function (code) {
        biSet(data, 'objectiveLead', code, window.i18n.tIn(dictKey, code));
    });
}

/** Text on ANY side of a bilingual pair (or a bare pre-v4 string). */
function _mbBiHasAny(v) {
    if (!v) return false;
    if (typeof v === 'string') return !!v.trim();
    return BILANG_CODES.some(function (c) {
        return typeof v[c] === 'string' && v[c].trim() !== '';
    });
}

function _mbFilled(s) { return typeof s === 'string' && s.trim() !== ''; }

function _mbInfoSheetHasContent(d) {
    if (!d) return false;
    return _mbBiHasAny(d.title) ||
           _mbBiHasAny(d.objective) ||
           _mbBiHasAny(d.selfCheckContent) ||
           _mbBiHasAny(d.answersKeyContent) ||
           !!(d.contentSections && d.contentSections.length) ||
           _mbFilled(d.linkSubject) ||
           _mbFilled(d.linkUrl) ||
           !!d.qrImage;
}

function _mbActivitySheetHasContent(d) {
    if (!d) return false;
    return _mbBiHasAny(d.title) ||
           _mbBiHasAny(d.objective) ||
           !!(d.steps     && d.steps.length) ||
           !!(d.resources && d.resources.length) ||
           !!(d.criteria  && d.criteria.length) ||
           _mbFilled(d.linkSubject) ||
           _mbFilled(d.linkUrl) ||
           !!d.qrImage ||
           /* '0' is the default the duration box loads with. */
           (_mbFilled(String(d.duration || '')) && String(d.duration).trim() !== '0');
}

function saveCurrentSheetToLO() {
    if (!mbState.currentLOId) return;

    const lo = mbState.learningOutcomesData.find(l => l.id === mbState.currentLOId);
    if (!lo) return;

    /* ── Info Sheet ────────────────────────────────────────────────
       Merged onto the stored sheet, never rebuilt over it. The DOM holds
       only the side the user is editing; a wholesale replace would drop
       the other language without a word. */
    const storedInfo = (lo.infoSheets && lo.infoSheets[mbState.currentInfoSheetIndex]) || {};
    const infoData = Object.assign({}, storedInfo, {
        sheetNumber: document.getElementById('info-sheet-number').value,
        linkSubject: document.getElementById('info-link-subject').value,
        linkUrl: document.getElementById('info-link-url').value,
        qrImage: mbState.infoQRImage,
        selfCheckNumber: document.getElementById('self-check-number').value,
        answersKeyNumber: document.getElementById('answers-key-number').value,
        contentSectionImages: { ...mbState.contentSectionImages }
    });
    /* Seed BEFORE biPut: a brand-new sheet gets all three sides from the
       dictionary, then the active side is overwritten by whatever is on
       screen — the default itself, or the user's edit, or '' if they
       cleared it. */
    mbSeedObjectiveLead(infoData, 'mbInfoObjectiveLead');
    biPut(infoData, 'objectiveLead',     document.getElementById('info-objective-lead').value);
    biPut(infoData, 'title',             document.getElementById('info-title').value);
    biPut(infoData, 'objective',         document.getElementById('info-objective').value);
    biPut(infoData, 'selfCheckContent',  document.getElementById('self-check-content').value);
    biPut(infoData, 'answersKeyContent', document.getElementById('answers-key-content').value);

    // Collect content sections
    const incomingSections = [];
    const contentTextareas = document.querySelectorAll('[data-content-id]');
    contentTextareas.forEach((content) => {
        if (typeof content.value === 'undefined') return; // skip non-textarea elements
        const cid    = content.dataset.contentId;
        const tables = collectContentTables(cid);
        const marks  = collectMarks(`content-marks-${cid}`);
        /* The card's own name, when the author renamed it. Collected as
           the ACTIVE side's plain string, exactly like `text`, so
           biMergeArrayById writes it onto the stored pair instead of
           replacing the pair with a bare value. */
        const heading = (typeof mbContentHeading === 'function') ? mbContentHeading(cid) : '';
        /* A renamed but still-empty card is kept. Dropping it would throw
           away the name the moment the author typed it and moved on to
           fill the box in later. */
        if (content.value.trim() || tables.length || marks.length || heading.trim()) {
            incomingSections.push({ text: content.value, heading, contentId: cid, marks, tables,
                                    uid: mbRowUid(content) });
        }
    });
    infoData.contentSections = biMergeArrayById(storedInfo.contentSections, incomingSections, ['text', 'heading']);

    /* ── When is a sheet worth storing? ─────────────────────────
       The v2 test was `title.trim() || objective.trim()`, carried
       forward onto the pair as "does the active side of the title or
       objective have text". That question is not the same as "did the
       user put any work into this sheet", and the gap between them is
       silent data loss: fill five content sections, a self-check and an
       answers key, leave the title box empty, and the whole sheet is
       discarded at save time without a word. The export is then
       correctly empty, so nothing looks broken until the file is
       reopened and the work is simply gone.

       So the test now asks about the WHOLE sheet. Two deliberate
       exclusions:

       - sheetNumber, which loadInfoSheetAtIndex auto-fills, so
         including it would make every untouched sheet look occupied.
       - the criteria title/instruction/footer on the activity sheet,
         which mbSeedCriteriaPlaceholders() writes for the same reason.

       Everything else is something only a person can put there.

       `infoData` already carries the stored sheet merged underneath
       (Object.assign above) and contentSections already merged across
       languages, so testing it alone covers the other side too. */
    if (_mbInfoSheetHasContent(infoData)) {
        if (!lo.infoSheets || lo.infoSheets.length === 0) {
            lo.infoSheets = [infoData];
            mbState.currentInfoSheetIndex = 0;
        } else {
            lo.infoSheets[mbState.currentInfoSheetIndex] = infoData;
        }
    }

    /* ── Activity Sheet ────────────────────────────────────────── */
    const storedAct = (lo.activitySheets && lo.activitySheets[mbState.currentActivitySheetIndex]) || {};
    const activityData = Object.assign({}, storedAct, {
        sheetNumber: document.getElementById('sheet-number').value,
        duration: document.getElementById('duration').value,
        linkSubject: document.getElementById('activity-link-subject').value,
        linkUrl: document.getElementById('activity-link-url').value,
        qrImage: mbState.activityQRImage,
        images: { ...mbState.stepImages },
        includeCriteria: true
    });
    mbSeedObjectiveLead(activityData, 'mbActivityObjectiveLead');
    biPut(activityData, 'objectiveLead', document.getElementById('objective-lead').value);
    ACTIVITY_BI.forEach(k => {
        const el = document.getElementById(
            k === 'title' ? 'title' :
            k === 'objective' ? 'objective' :
            k === 'criteriaTitle' ? 'criteria-title' :
            k === 'criteriaInstruction' ? 'criteria-instruction' : 'criteria-footer'
        );
        if (el) biPut(activityData, k, el.value);
    });

    // Collect resources
    const incomingResources = [];
    document.querySelectorAll('.resource-name').forEach((resource) => {
        const qtyEl = document.querySelector(`[data-quantity-id="${resource.dataset.resourceId}"]`);
        if (resource.value.trim()) {
            incomingResources.push({ name: resource.value, quantity: qtyEl ? qtyEl.value : '',
                                     uid: mbRowUid(resource) });
        }
    });
    activityData.resources = biMergeArrayById(storedAct.resources, incomingResources, ['name']);

    // Collect steps
    const incomingSteps = [];
    document.querySelectorAll('[data-step-id]').forEach((step) => {
        if (step.value.trim()) {
            const sid = step.dataset.stepId;
            incomingSteps.push({ text: step.value, stepId: sid, marks: collectMarks(`step-marks-${sid}`),
                                 uid: mbRowUid(step) });
        }
    });
    activityData.steps = biMergeArrayById(storedAct.steps, incomingSteps, ['text']);

    // Collect criteria
    const incomingCriteria = [];
    document.querySelectorAll('.criteria-text').forEach(item => {
        if (item.value.trim()) incomingCriteria.push({ text: item.value, uid: mbRowUid(item) });
    });
    activityData.criteria = biMergeStringsById(storedAct.criteria, incomingCriteria);

    if (_mbActivitySheetHasContent(activityData)) {
        if (!lo.activitySheets || lo.activitySheets.length === 0) {
            lo.activitySheets = [activityData];
            mbState.currentActivitySheetIndex = 0;
        } else {
            lo.activitySheets[mbState.currentActivitySheetIndex] = activityData;
        }
    }

    updateLOSummary();
}

function loadCurrentLOSheets() {
    if (!mbState.currentLOId) {
        clearAllForms();
        return;
    }
    
    const lo = mbState.learningOutcomesData.find(l => l.id === mbState.currentLOId);
    if (!lo) {
        clearAllForms();
        return;
    }
    
    // Reset indices when loading a new LO
    mbState.currentInfoSheetIndex = 0;
    mbState.currentActivitySheetIndex = 0;
    
    loadInfoSheetAtIndex(lo, mbState.currentInfoSheetIndex);
    loadActivitySheetAtIndex(lo, mbState.currentActivitySheetIndex);
}

function loadInfoSheetAtIndex(lo, index) {
    updateInfoSheetNav(lo);
    const loIndex = mbState.learningOutcomesData.indexOf(lo);
    // Load Info Sheet if exists
    if (lo.infoSheets && lo.infoSheets.length > 0 && lo.infoSheets[index]) {
        const info = lo.infoSheets[index];
        // Auto-assign sheetNumber if missing
        if (!info.sheetNumber) info.sheetNumber = getAutoSheetNumber(loIndex, index);
        document.getElementById('info-sheet-number').value = info.sheetNumber;
        document.getElementById('info-title').value = biGetStrict(info.title, contentLang());
        /* Seeded here too, not only on save: a sheet stored before this
           field existed has no key, and it should show the line rather
           than a blank box the user has to discover and fill. */
        mbSeedObjectiveLead(info, 'mbInfoObjectiveLead');
        document.getElementById('info-objective-lead').value = biGetStrict(info.objectiveLead, contentLang());
        document.getElementById('info-objective').value = biGetStrict(info.objective, contentLang());
        document.getElementById('info-link-subject').value = info.linkSubject || '';
        document.getElementById('info-link-url').value = info.linkUrl || '';
        document.getElementById('self-check-number').value = info.selfCheckNumber || info.sheetNumber || '';
        document.getElementById('self-check-content').value = biGetStrict(info.selfCheckContent, contentLang());
        document.getElementById('answers-key-number').value = info.answersKeyNumber || info.sheetNumber || '';
        document.getElementById('answers-key-content').value = biGetStrict(info.answersKeyContent, contentLang());
        
        if (info.qrImage) {
            document.getElementById('info-qr-preview').innerHTML = `<img src="${info.qrImage}" alt="QR Code" style="width: 100px; height: 100px;">`;
            mbState.infoQRImage = info.qrImage;
        } else {
            document.getElementById('info-qr-preview').innerHTML = '';
            mbState.infoQRImage = null;
        }
        
        document.getElementById('content-sections-container').innerHTML = '';
        mbState.contentSectionCount = 0;
        for (let key in mbState.contentSectionImages) {
            delete mbState.contentSectionImages[key];
        }
        
        if (info.contentSections && info.contentSections.length > 0) {
            info.contentSections.forEach((contentData) => {
                /* biGetStrict, not biGet: a name written only in English
                   must not fall back into the Arabic editing side, where
                   the author would see it as already translated. */
                addContentSection(biGetStrict(contentData.heading, contentLang()));
                const lastContent = document.querySelector(`[data-content-id="${mbState.contentSectionCount}"]`);
                if (lastContent) {
                    lastContent.value = biGetStrict(contentData.text, contentLang());
                    /* Re-attach the STORED identity to the row just built.
                       Without this the row carries the fresh uid it was
                       born with, the collector cannot match it to the
                       stored item, and every save would look like a
                       delete-and-recreate — losing the other language. */
                    mbRestoreRowUid(lastContent, contentData.uid);
                }
                // Restore marks for this content section
                if (contentData.marks && contentData.marks.length) {
                    restoreMarks(`content-marks-${mbState.contentSectionCount}`, contentData.marks);
                }
                // Restore tables for this content section
                if (contentData.tables && contentData.tables.length) {
                    restoreContentTables(mbState.contentSectionCount, contentData.tables);
                }
            });
        } else {
            addContentSection();
        }
        
        if (info.contentSectionImages) {
            Object.assign(mbState.contentSectionImages, info.contentSectionImages);
            for (let contentId in info.contentSectionImages) {
                renderContentImageGallery(contentId);
            }
        }
    } else {
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
        addContentSection();
    }
} // end loadInfoSheetAtIndex

function loadActivitySheetAtIndex(lo, index) {
    updateActivitySheetNav(lo);
    const loIndex = mbState.learningOutcomesData.indexOf(lo);
    // Load Activity Sheet if exists
    if (lo.activitySheets && lo.activitySheets.length > 0 && lo.activitySheets[index]) {
        const activity = lo.activitySheets[index];
        // Auto-assign sheetNumber if missing
        if (!activity.sheetNumber) activity.sheetNumber = getAutoSheetNumber(loIndex, index);
        document.getElementById('sheet-number').value = activity.sheetNumber;
        /* There used to be an unconditional auto-sync here:
             if (!activity.criteriaTitle) activity.criteriaTitle = `Performance Criteria Check List/ ${activity.sheetNumber}`;
           It wrote a bare English string into STATE — not the DOM — the
           first time any activity sheet loaded, regardless of language.
           The DOM-level fix below (biGetStrict on a bare string, for a
           non-English content language) correctly showed an EMPTY field,
           which is exactly why this was invisible from the editor: the
           screen was right and the data underneath it was already wrong.
           The very next save read that poisoned state back out and
           carried it forward permanently. There is nothing to "sync" —
           the sheet number is read directly wherever it's needed
           (placeholder text, export fallback); it never needs to be
           copied into criteriaTitle at all. */
        document.getElementById('title').value = biGetStrict(activity.title, contentLang());
        mbSeedObjectiveLead(activity, 'mbActivityObjectiveLead');
        document.getElementById('objective-lead').value = biGetStrict(activity.objectiveLead, contentLang());
        document.getElementById('objective').value = biGetStrict(activity.objective, contentLang());
        document.getElementById('duration').value = activity.duration || '0';
        document.getElementById('activity-link-subject').value = activity.linkSubject || '';
        document.getElementById('activity-link-url').value = activity.linkUrl || '';
        
        if (activity.qrImage) {
            document.getElementById('activity-qr-preview').innerHTML = `<img src="${activity.qrImage}" alt="QR Code" style="width: 100px; height: 100px;">`;
            mbState.activityQRImage = activity.qrImage;
        } else {
            document.getElementById('activity-qr-preview').innerHTML = '';
            mbState.activityQRImage = null;
        }
        
        document.getElementById('resources-container').innerHTML = '';
        mbState.resourceCount = 0;
        if (activity.resources && activity.resources.length > 0) {
            activity.resources.forEach((resource) => {
                addResource();
                const lastResource = document.querySelector(`[data-resource-id="${mbState.resourceCount}"]`);
                const lastQuantity = document.querySelector(`[data-quantity-id="${mbState.resourceCount}"]`);
                if (lastResource) {
                    lastResource.value = biGetStrict(resource.name, contentLang());
                    mbRestoreRowUid(lastResource, resource.uid);
                }
                if (lastQuantity) lastQuantity.value = resource.quantity;
            });
        } else {
            addResource();
        }
        
        document.getElementById('steps-container').innerHTML = '';
        mbState.stepCount = 0;
        for (let key in mbState.stepImages) {
            delete mbState.stepImages[key];
        }
        
        if (activity.steps && activity.steps.length > 0) {
            activity.steps.forEach((stepData) => {
                addStep();
                const lastStep = document.querySelector(`[data-step-id="${mbState.stepCount}"]`);
                if (lastStep) {
                    lastStep.value = biGetStrict(stepData.text, contentLang());
                    mbRestoreRowUid(lastStep, stepData.uid);
                }
                // Restore marks for this step
                if (stepData.marks && stepData.marks.length) {
                    restoreMarks(`step-marks-${mbState.stepCount}`, stepData.marks);
                }
            });
        } else {
            addStep();
        }
        
        if (activity.images) {
            Object.assign(mbState.stepImages, activity.images);
            for (let stepId in activity.images) {
                renderStepImageGallery(stepId);
            }
        }
        
        /* THE ACTUAL BUG BEHIND "the export is still mostly English":
           this used to write the fallback text into `.value`. A value is
           real content — the very next save read it back out and stored
           it as if the user had typed it, in whichever language happened
           to be active, permanently. The export-time fallback in
           exports_docx.js (`activity.criteriaTitle || _mbT(...)`) could
           then never fire, because the field was never actually empty
           after the first time this ran.

           The fix is the standard one: a default belongs in `.placeholder`
           (a hint, shown only while empty, never read back as data), not
           in `.value`. `.value` now holds exactly what is stored — which
           may legitimately be empty — and the placeholder is translated
           into the CONTENT language (not the interface language: a field
           for typing Arabic wants an Arabic hint even in an English
           interface) via tIn, the same lookup the DOCX export uses. */
        const _cl = contentLang();
        const _tTitle = document.getElementById('criteria-title');
        const _tInstr = document.getElementById('criteria-instruction');
        const _tFoot  = document.getElementById('criteria-footer');
        _tTitle.value = biGetStrict(activity.criteriaTitle, _cl);
        _tTitle.placeholder = window.i18n.tfIn('expCriteriaCheckList', _cl, { v0: activity.sheetNumber || '' });
        _tInstr.value = biGetStrict(activity.criteriaInstruction, _cl);
        _tInstr.placeholder = window.i18n.tIn('expCriteriaInstructionDefault', _cl);
        _tFoot.value = biGetStrict(activity.criteriaFooter, _cl);
        _tFoot.placeholder = window.i18n.tIn('expCriteriaFooterDefault', _cl);
        
        document.getElementById('criteria-tbody').innerHTML = '';
        mbState.criteriaCount = 0;
        
        if (activity.criteria && activity.criteria.length > 0) {
            activity.criteria.forEach((criteriaText) => {
                addCriteria();
                const lastCriteria = document.querySelector(`[data-criteria-id="${mbState.criteriaCount}"]`);
                if (lastCriteria) {
                    lastCriteria.value = biGetStrict(criteriaText, contentLang());
                    mbRestoreRowUid(lastCriteria, criteriaText && criteriaText.uid);
                }
            });
        }
        
        toggleCriteriaSection();
    } else {
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
        document.getElementById('criteria-tbody').innerHTML = '';
        /* include-criteria removed */
        mbState.resourceCount = 0;
        mbState.stepCount = 0;
        mbState.criteriaCount = 0;
        addResource(); addResource();
        addStep();
        toggleCriteriaSection();
    }
} // end loadActivitySheetAtIndex

// ── Info sheet navigation helpers ──────────────────────────────
function updateInfoSheetNav(lo) {
    const nav = document.getElementById('info-sheet-nav');
    if (!nav) return;
    const total = lo && lo.infoSheets ? lo.infoSheets.length : 0;
    nav.textContent = total === 0
        ? window.i18n.t('dgNoSheets')
        : window.i18n.tf('dgSheetXOfY', { v0: mbState.currentInfoSheetIndex + 1, v1: total });
}

// ── Auto-numbering helper ──────────────────────────────────────
function getAutoSheetNumber(loIndex, sheetIndex) {
    return `${loIndex + 1}-${sheetIndex + 1}`;
}

function getModuleTitleSlug() {
    const mod = mbState.modulesData.find(m => m.id === mbState.currentModuleId);
    const title = (mod && mod.title) ? mod.title.trim() : 'module';
    return title.replace(/[^a-z0-9\u0600-\u06FF]/gi, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
}

function getExportFilename(ext) {
    const slug = getModuleTitleSlug();
    const d = new Date();
    const date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return `${slug}_${date}.${ext}`;
}

// ── Ensure first sheet exists when entering info/activity tab ──
function ensureFirstInfoSheet() {
    if (!mbState.currentLOId) return;
    const lo = mbState.learningOutcomesData.find(l => l.id === mbState.currentLOId);
    if (!lo) return;
    if (!lo.infoSheets || lo.infoSheets.length === 0) {
        const loIndex = mbState.learningOutcomesData.indexOf(lo);
        lo.infoSheets = [{
            sheetNumber: getAutoSheetNumber(loIndex, 0),
            title: '', objective: '',
            linkSubject: '', linkUrl: '', qrImage: null,
            selfCheckNumber: '', selfCheckContent: '',
            answersKeyNumber: '', answersKeyContent: '',
            contentSections: [], contentSectionImages: {}
        }];
        mbState.currentInfoSheetIndex = 0;
        saveCurrentModuleLOData();
        loadInfoSheetAtIndex(lo, 0);
    }
}

function ensureFirstActivitySheet() {
    if (!mbState.currentLOId) return;
    const lo = mbState.learningOutcomesData.find(l => l.id === mbState.currentLOId);
    if (!lo) return;
    if (!lo.activitySheets || lo.activitySheets.length === 0) {
        const loIndex = mbState.learningOutcomesData.indexOf(lo);
        lo.activitySheets = [{
            sheetNumber: getAutoSheetNumber(loIndex, 0),
            title: '', objective: '', duration: '0',
            linkSubject: '', linkUrl: '', qrImage: null,
            resources: [], steps: [], images: {},
            includeCriteria: false,
            /* criteriaTitle / criteriaInstruction / criteriaFooter are
               deliberately UNSET here, not pre-filled. A pre-filled
               English default becomes real saved content the moment the
               sheet is stored — in whatever language happens to be
               active — permanently defeating the translated placeholder
               (edit time) and the _mbT fallback (export time), which
               exist for exactly this situation and only work on a field
               that is genuinely empty. */
            criteria: []
        }];
        mbState.currentActivitySheetIndex = 0;
        saveCurrentModuleLOData();
        loadActivitySheetAtIndex(lo, 0);
    }
}

async function addNewInfoSheet() {
    if (!mbState.currentLOId) { await mbAlert(window.i18n.t('dgPleaseSelectALearningOutcome')); return; }
    const lo = mbState.learningOutcomesData.find(l => l.id === mbState.currentLOId);
    if (!lo) return;
    saveCurrentSheetToLO();
    const loIndex = mbState.learningOutcomesData.indexOf(lo);
    const newSheetIndex = lo.infoSheets.length;
    lo.infoSheets.push({
        sheetNumber: getAutoSheetNumber(loIndex, newSheetIndex),
        title: '', objective: '',
        linkSubject: '', linkUrl: '', qrImage: null,
        selfCheckNumber: '', selfCheckContent: '',
        answersKeyNumber: '', answersKeyContent: '',
        contentSections: [], contentSectionImages: {}
    });
    mbState.currentInfoSheetIndex = lo.infoSheets.length - 1;
    saveCurrentModuleLOData();
    updateLOSummary();
    loadInfoSheetAtIndex(lo, mbState.currentInfoSheetIndex);
    showStatus(window.i18n.tf('dgInfoSheetAdded', { v0: mbState.currentInfoSheetIndex + 1 }), 'success');
}

function prevInfoSheet() {
    if (!mbState.currentLOId) return;
    const lo = mbState.learningOutcomesData.find(l => l.id === mbState.currentLOId);
    if (!lo || lo.infoSheets.length === 0) return;
    saveCurrentSheetToLO();
    mbState.currentInfoSheetIndex = (mbState.currentInfoSheetIndex - 1 + lo.infoSheets.length) % lo.infoSheets.length;
    loadInfoSheetAtIndex(lo, mbState.currentInfoSheetIndex);
}

function nextInfoSheet() {
    if (!mbState.currentLOId) return;
    const lo = mbState.learningOutcomesData.find(l => l.id === mbState.currentLOId);
    if (!lo || lo.infoSheets.length === 0) return;
    saveCurrentSheetToLO();
    mbState.currentInfoSheetIndex = (mbState.currentInfoSheetIndex + 1) % lo.infoSheets.length;
    loadInfoSheetAtIndex(lo, mbState.currentInfoSheetIndex);
}

async function removeCurrentInfoSheet() {
    if (!mbState.currentLOId) return;
    const lo = mbState.learningOutcomesData.find(l => l.id === mbState.currentLOId);
    if (!lo) return;
    if (lo.infoSheets.length === 0) { showStatus(window.i18n.t('dgNoInfoSheetToRemove'), 'error'); return; }
    if (!await mbConfirm(window.i18n.tf('dgConfirmDeletionthisWillPermanently6', { v0: mbState.currentInfoSheetIndex + 1 }), { danger: true })) return;
    lo.infoSheets.splice(mbState.currentInfoSheetIndex, 1);
    mbState.currentInfoSheetIndex = Math.max(0, Math.min(mbState.currentInfoSheetIndex, lo.infoSheets.length - 1));
    saveCurrentModuleLOData();
    updateLOSummary();
    if (lo.infoSheets.length === 0) {
        // Clear the form and add a blank section
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
        addContentSection();
        updateInfoSheetNav(lo);
    } else {
        loadInfoSheetAtIndex(lo, mbState.currentInfoSheetIndex);
    }
    showStatus(window.i18n.t('dgInfoSheetRemoved'), 'success');
}

// ── Activity sheet navigation helpers ──────────────────────────
function updateActivitySheetNav(lo) {
    const nav = document.getElementById('activity-sheet-nav');
    if (!nav) return;
    const total = lo && lo.activitySheets ? lo.activitySheets.length : 0;
    nav.textContent = total === 0
        ? window.i18n.t('dgNoSheets')
        : window.i18n.tf('dgSheetXOfY', { v0: mbState.currentActivitySheetIndex + 1, v1: total });
}

async function addNewActivitySheet() {
    if (!mbState.currentLOId) { await mbAlert(window.i18n.t('dgPleaseSelectALearningOutcome')); return; }
    const lo = mbState.learningOutcomesData.find(l => l.id === mbState.currentLOId);
    if (!lo) return;
    saveCurrentSheetToLO();
    const loIndex = mbState.learningOutcomesData.indexOf(lo);
    const newSheetIndex = lo.activitySheets.length;
    const autoNum = getAutoSheetNumber(loIndex, newSheetIndex);
    lo.activitySheets.push({
        sheetNumber: autoNum, title: '', objective: '', duration: '0',
        linkSubject: '', linkUrl: '', qrImage: null,
        resources: [], steps: [], images: {},
        includeCriteria: false,
        /* Same reasoning as ensureFirstActivitySheet() — see its comment. */
        criteria: []
    });
    mbState.currentActivitySheetIndex = lo.activitySheets.length - 1;
    saveCurrentModuleLOData();
    updateLOSummary();
    loadActivitySheetAtIndex(lo, mbState.currentActivitySheetIndex);
    showStatus(window.i18n.tf('dgActivitySheetAdded', { v0: mbState.currentActivitySheetIndex + 1 }), 'success');
}

function prevActivitySheet() {
    if (!mbState.currentLOId) return;
    const lo = mbState.learningOutcomesData.find(l => l.id === mbState.currentLOId);
    if (!lo || lo.activitySheets.length === 0) return;
    saveCurrentSheetToLO();
    mbState.currentActivitySheetIndex = (mbState.currentActivitySheetIndex - 1 + lo.activitySheets.length) % lo.activitySheets.length;
    loadActivitySheetAtIndex(lo, mbState.currentActivitySheetIndex);
}

function nextActivitySheet() {
    if (!mbState.currentLOId) return;
    const lo = mbState.learningOutcomesData.find(l => l.id === mbState.currentLOId);
    if (!lo || lo.activitySheets.length === 0) return;
    saveCurrentSheetToLO();
    mbState.currentActivitySheetIndex = (mbState.currentActivitySheetIndex + 1) % lo.activitySheets.length;
    loadActivitySheetAtIndex(lo, mbState.currentActivitySheetIndex);
}

async function removeCurrentActivitySheet() {
    if (!mbState.currentLOId) return;
    const lo = mbState.learningOutcomesData.find(l => l.id === mbState.currentLOId);
    if (!lo) return;
    if (lo.activitySheets.length === 0) { showStatus(window.i18n.t('dgNoActivitySheetToRemove'), 'error'); return; }
    if (!await mbConfirm(window.i18n.tf('dgConfirmDeletionthisWillPermanently7', { v0: mbState.currentActivitySheetIndex + 1 }), { danger: true })) return;
    lo.activitySheets.splice(mbState.currentActivitySheetIndex, 1);
    mbState.currentActivitySheetIndex = Math.max(0, Math.min(mbState.currentActivitySheetIndex, lo.activitySheets.length - 1));
    saveCurrentModuleLOData();
    updateLOSummary();
    if (lo.activitySheets.length === 0) {
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
        document.getElementById('criteria-tbody').innerHTML = '';
        /* include-criteria removed */
        mbState.resourceCount = 0; mbState.stepCount = 0; mbState.criteriaCount = 0;
        addResource(); addResource(); addStep(); toggleCriteriaSection();
        updateActivitySheetNav(lo);
    } else {
        loadActivitySheetAtIndex(lo, mbState.currentActivitySheetIndex);
    }
    showStatus(window.i18n.t('dgActivitySheetRemoved'), 'success');
}
