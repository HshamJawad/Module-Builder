// ============================================================
// /src/outcomes.js
// Learning outcome CRUD, performance criteria panel
// Extracted verbatim from Module_Builder.html lines 3272-3598 (v2.0-legacy).
// ============================================================

/**
 * A caller-supplied title, or nothing.
 *
 * events.js appends the ELEMENT and the EVENT after whatever `data-args`
 * declares:
 *
 *     out = fn.apply(el, args.concat([el, ev]));
 *
 * The button that adds a learning outcome carries no `data-args`, so the
 * first parameter of this function received the <button> itself. An
 * element is truthy, so `defaultTitle || await mbPrompt(...)` short-
 * circuited: the dialog never opened and the outcome was named
 * "[object HTMLButtonElement]".
 *
 * The convention in events.js is deliberate and worth keeping — several
 * handlers still want `this` and `event` where their old inline call put
 * them. What it means is that any handler with an OPTIONAL first
 * parameter must state what it will accept. This one accepts a string.
 */
function _loTitleArg(v) {
    return (typeof v === 'string' && v.trim()) ? v : null;
}

async function addNewLearningOutcome(defaultTitle) {
    if (!mbState.currentModuleId) {
        await mbAlert(window.i18n.t('dgPleaseSelectOrCreateA'));
        return;
    }

    const preset = _loTitleArg(defaultTitle);
    const fallbackName = window.i18n.tf('dgDefaultLOName', { v0: mbState.learningOutcomesData.length + 1 });

    const title = preset || await mbPrompt(window.i18n.t('dgEnterLearningOutcomeTitle'), fallbackName);

    /* Cancelled: mbPrompt resolves null. Only a preset title may skip
       the dialog, and then there is nothing to cancel. */
    if (!preset && (title === null || !String(title).trim())) return;

    mbState.loIdCounter++;
    const newLO = {
        id: `lo-${mbState.loIdCounter}`,
        /* A pair, not a string. Everything the user TYPES is bilingual;
           storing a bare string here would work until the first content-
           language switch, then read as the wrong side. biPut writes the
           active side and leaves the other empty. */
        title: biNew(),
        number: '',
        statement: '',
        performanceCriteria: [],
        /* Author-defined sections for this outcome — LO contents,
           assessment methods, training conditions. Travels inside the
           outcome, so it is saved and loaded with modulesData. */
        blocks: [],
        infoSheets: [],
        activitySheets: []
    };
    
    biPut(newLO, 'title', String(title || fallbackName).trim());

    mbState.learningOutcomesData.push(newLO);
    saveCurrentModuleLOData(); // Save to current module
    renderLOSelector();
    
    // Select the newly created LO
    mbState.currentLOId = newLO.id;
    ['current-lo-selector','info-lo-selector','activity-lo-selector'].forEach(id => { const s=document.getElementById(id); if(s) s.value=mbState.currentLOId; });
    switchLearningOutcome();
    
    updateModuleSummary(); // Update module stats
    showStatus(window.i18n.t('dgLearningOutcomeAdded'), 'success');
}

/* An <option> label is plain text, so anything with < or & in it has to
   be escaped or it silently truncates the name. */
function _loEscape(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
}

/* One place converts a stored title into something displayable. Titles
   are { en, ar } pairs; `${lo.title}` printed "[object Object]" into the
   dropdown. biGet (not biGetStrict) so a title typed on one side only
   still shows rather than leaving a blank row in the list. */
function loTitleText(lo) {
    var t = (typeof biGet === 'function') ? biGet(lo.title, contentLang()) : lo.title;
    return String(t == null ? '' : t);
}

function renderLOSelector() {
    const optionsHtml = '<option data-i18n="mbSelectLearningOutcome" value="">' + window.i18n.t('mbSelectLearningOutcome') + '</option>' +
        mbState.learningOutcomesData.map(lo =>
            `<option value="${lo.id}">${_loEscape(loTitleText(lo))}</option>`
        ).join('');

    // Determine which LO to select: keep mbState.currentLOId if valid, else first LO
    let targetId = mbState.currentLOId;
    if (!targetId || !mbState.learningOutcomesData.find(lo => lo.id === targetId)) {
        targetId = mbState.learningOutcomesData.length > 0 ? mbState.learningOutcomesData[0].id : '';
        if (targetId) mbState.currentLOId = targetId;
    }

    // Populate and sync all three selectors
    ['current-lo-selector', 'info-lo-selector', 'activity-lo-selector'].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        sel.innerHTML = optionsHtml;
        sel.value = targetId;
    });

    updateLOSummary();
}

function switchLearningOutcome() {
    const selector = document.getElementById('current-lo-selector');
    _applyLOSwitch(selector.value);
}

// Called from inline selectors in Info / Activity tabs
function switchLearningOutcomeFromTab(source) {
    const selectorId = source === 'info' ? 'info-lo-selector' : 'activity-lo-selector';
    const selector = document.getElementById(selectorId);
    _applyLOSwitch(selector.value);
}

// Core logic: sync all selectors, save current sheets, load new LO sheets
function _applyLOSwitch(selectedLOId) {
    if (!selectedLOId) {
        mbState.currentLOId = null;
        const summary = document.getElementById('lo-sheets-summary');
        if (summary) summary.style.display = 'none';
        // Sync all to empty
        ['current-lo-selector', 'info-lo-selector', 'activity-lo-selector'].forEach(id => {
            const s = document.getElementById(id);
            if (s) s.value = '';
        });
        if (typeof mbRenderBlocks === 'function') mbRenderBlocks('lo');
        return;
    }

    // Save current sheets before switching
    if (mbState.currentLOId && mbState.currentLOId !== selectedLOId) {
        saveCurrentSheetToLO();
    }

    mbState.currentLOId = selectedLOId;

    // Sync all selectors to this value
    ['current-lo-selector', 'info-lo-selector', 'activity-lo-selector'].forEach(id => {
        const s = document.getElementById(id);
        if (s) s.value = selectedLOId;
    });

    loadCurrentLOSheets();
    updateLOSummary();
}

function updateLOSummary() {
    /* One call covers every branch below: blocks.js hides its own
       section when there is no outcome to attach a section to. */
    if (typeof mbRenderBlocks === 'function') mbRenderBlocks('lo');

    const summary = document.getElementById('lo-sheets-summary');
    
    if (!mbState.currentLOId) {
        summary.style.display = 'none';
        updatePerformanceCriteriaPanel();
        return;
    }
    
    const lo = mbState.learningOutcomesData.find(l => l.id === mbState.currentLOId);
    if (!lo) {
        summary.style.display = 'none';
        updatePerformanceCriteriaPanel();
        return;
    }
    
    summary.style.display = 'block';
    
    // Module title display removed - shown at module level now
    const moduleInfo = document.getElementById('lo-module-info');
    if (moduleInfo) {
        moduleInfo.style.display = 'none';
    }
    
    document.getElementById('info-sheets-count').textContent = lo.infoSheets.length;
    document.getElementById('activity-sheets-count').textContent = lo.activitySheets.length;
    
    // Update performance criteria panel
    updatePerformanceCriteriaPanel();
}

function updatePerformanceCriteriaPanel() {
    const panel = document.getElementById('performance-criteria-panel');
    const content = document.getElementById('performance-criteria-content');
    
    if (!mbState.currentLOId) {
        panel.style.display = 'none';
        return;
    }
    
    const lo = mbState.learningOutcomesData.find(l => l.id === mbState.currentLOId);
    if (!lo) {
        panel.style.display = 'none';
        return;
    }
    
    // Always show panel when LO is selected
    panel.style.display = 'block';
    
    if (!lo.performanceCriteria || lo.performanceCriteria.length === 0) {
        /* Single-quoted string, not a template literal — the interpolation
           has to be concatenated rather than embedded. */
        content.innerHTML = '<p style="color: #6b7280; margin: 0; font-style: italic;">' +
            '<span data-i18n="dgNoCriteriaAvailable">' + window.i18n.t('dgNoCriteriaAvailable') + '</span></p>';
        return;
    }
    
    // Display performance criteria with edit/delete buttons
    let html = '<div style="display: flex; flex-direction: column; gap: 12px;">';
    lo.performanceCriteria.forEach((pc, index) => {
        const criteriaText = pc.text || pc.id || pc;
        html += `
            <div style="display: flex; align-items: start; gap: 10px; padding: 10px; background: #f9fafb; border-radius: 6px; border: 1px solid #e5e7eb;">
                <div style="min-width: 30px; font-weight: 600; color: #667eea;">${index + 1}.</div>
                <div class="criteria-text" dir="auto" data-dir-auto="1" style="flex: 1; color: #374151; line-height: 1.6; text-align: start;">${criteriaText}</div>
                <div style="display: flex; gap: 5px;">
                    <button class="mb-icon-btn" data-act="editPerformanceCriterion" data-args='[${index}]'
                        title="${window.i18n.t('rxRename')}" data-i18n-title="rxRename">
                        <svg class="mb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4.5 19.5h4l10-10a2.1 2.1 0 0 0-3-3l-10 10z"/><path d="M14.5 6.5l3 3"/><path d="M4.5 19.5l.6-3.4"/></svg>
                    </button>
                    <button class="mb-icon-btn danger" data-act="deletePerformanceCriterion" data-args='[${index}]'
                        title="${window.i18n.t('mbDelete')}" data-i18n-title="mbDelete">
                        <svg class="mb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 7h16"/><path d="M9.5 7V5.6A1.6 1.6 0 0 1 11.1 4h1.8a1.6 1.6 0 0 1 1.6 1.6V7"/><path d="M6.6 7l.75 11.6A1.7 1.7 0 0 0 9.05 20.2h5.9a1.7 1.7 0 0 0 1.7-1.6L17.4 7"/><path d="M10.3 11v5.4M13.7 11v5.4"/></svg>
                    </button>
                </div>
            </div>
        `;
    });
    html += '</div>';
    
    content.innerHTML = html;
}

async function addPerformanceCriterion() {
    if (!mbState.currentLOId) {
        await mbAlert(window.i18n.t('dgPleaseSelectALearningOutcome'));
        return;
    }
    
    const lo = mbState.learningOutcomesData.find(l => l.id === mbState.currentLOId);
    if (!lo) return;
    
    const criterionText = await mbPrompt(window.i18n.t('dgEnterPerformanceCriterion'));
    if (!criterionText || !criterionText.trim()) return;
    
    if (!lo.performanceCriteria) {
        lo.performanceCriteria = [];
    }
    
    lo.performanceCriteria.push({
        id: `PC${lo.performanceCriteria.length + 1}`,
        text: criterionText.trim()
    });
    
    saveCurrentModuleLOData();
    updatePerformanceCriteriaPanel();
    showStatus(window.i18n.t('dgPerformanceCriterionAdded'), 'success');
}

async function editPerformanceCriterion(index) {
    if (!mbState.currentLOId) return;
    
    const lo = mbState.learningOutcomesData.find(l => l.id === mbState.currentLOId);
    if (!lo || !lo.performanceCriteria || !lo.performanceCriteria[index]) return;
    
    const currentText = lo.performanceCriteria[index].text || lo.performanceCriteria[index].id || lo.performanceCriteria[index];
    const newText = await mbPrompt(window.i18n.t('dgEditPerformanceCriterion'), currentText);
    
    if (newText === null) return; // Cancelled
    if (!newText.trim()) {
        await mbAlert(window.i18n.t('dgPerformanceCriterionCannotBeEmpty'));
        return;
    }
    
    lo.performanceCriteria[index] = {
        id: lo.performanceCriteria[index].id || `PC${index + 1}`,
        text: newText.trim()
    };
    
    saveCurrentModuleLOData();
    updatePerformanceCriteriaPanel();
    showStatus(window.i18n.t('dgPerformanceCriterionUpdated'), 'success');
}

async function deletePerformanceCriterion(index) {
    if (!mbState.currentLOId) return;
    
    const lo = mbState.learningOutcomesData.find(l => l.id === mbState.currentLOId);
    if (!lo || !lo.performanceCriteria || !lo.performanceCriteria[index]) return;
    
    if (!await mbConfirm(window.i18n.t('dgConfirmDeletionthisWillPermanently5'), { danger: true })) {
        return;
    }
    
    lo.performanceCriteria.splice(index, 1);
    
    saveCurrentModuleLOData();
    updatePerformanceCriteriaPanel();
    showStatus(window.i18n.t('dgPerformanceCriterionDeleted'), 'success');
}

async function clearAndStartManual() {
    /* Was an English-only confirmation, built here rather than in
       index.html, so applyTranslations() never saw it. */
    const confirmed = await mbConfirm(window.i18n.t('dgClearImportedStartManual'));
    
    if (!confirmed) return;
    
    // Clear all module data
    mbState.modulesData = [];
    mbState.moduleIdCounter = 0;
    mbState.loIdCounter = 0;
    mbState.currentModuleId = null;
    mbState.currentLOId = null;
    mbState.learningOutcomesData = [];
    
    // Create a default empty module
    await addNewModule();

    showStatus(window.i18n.t('dgSwitchedToManualAuthoringMode'), 'success');
}

async function renameLearningOutcome() {
    if (!mbState.currentLOId) {
        await mbAlert(window.i18n.t('dgPleaseSelectALearningOutcome'));
        return;
    }
    
    const lo = mbState.learningOutcomesData.find(l => l.id === mbState.currentLOId);
    if (!lo) return;
    
    /* Show the side being edited, and write back to that same side.
       `lo.title = newTitle` flattened the pair: renaming in Arabic
       destroyed the English title that had been typed beside it. */
    const newTitle = await mbPrompt(window.i18n.t('dgEnterNewTitle'), loTitleText(lo));
    if (newTitle === null || !String(newTitle).trim()) return;

    biPut(lo, 'title', String(newTitle).trim());
    saveCurrentModuleLOData();
    renderLOSelector();
    showStatus(window.i18n.t('dgLearningOutcomeRenamed'), 'success');
}

async function deleteLearningOutcome() {
    if (!mbState.currentLOId) {
        await mbAlert(window.i18n.t('dgPleaseSelectALearningOutcome'));
        return;
    }
    
    const lo = mbState.learningOutcomesData.find(l => l.id === mbState.currentLOId);
    if (!lo) return;
    
    const totalSheets = lo.infoSheets.length + lo.activitySheets.length;

    /* Built here rather than in the markup, so applyTranslations() never
       saw it: this confirmation stayed English in an Arabic interface.
       It reads through i18n now, with the English text as the fallback
       so it degrades to what it said before if the key is missing. */
    const message = totalSheets > 0
        ? (window.i18n.has && window.i18n.has('dgConfirmDeleteLOWithSheets')
            ? window.i18n.tf('dgConfirmDeleteLOWithSheets', { v0: totalSheets })
            : `⚠️ Delete this Learning Outcome?\n\nThis Learning Outcome contains ${totalSheets} sheet(s).\n\nThis action cannot be undone. Continue?`)
        : (window.i18n.has && window.i18n.has('dgConfirmDeleteLO')
            ? window.i18n.t('dgConfirmDeleteLO')
            : '⚠️ Delete this Learning Outcome?\n\nThis action cannot be undone. Continue?');

    if (!await mbConfirm(message, { danger: true })) {
        return;
    }
    
    if (mbState.assessmentFormsData[mbState.currentLOId]) {
        delete mbState.assessmentFormsData[mbState.currentLOId];
    }
    
    mbState.learningOutcomesData = mbState.learningOutcomesData.filter(l => l.id !== mbState.currentLOId);
    saveCurrentModuleLOData();
    mbState.currentLOId = null;
    
    if (mbState.learningOutcomesData.length > 0) {
        mbState.currentLOId = mbState.learningOutcomesData[0].id;
        loadCurrentLOSheets();
    } else {
        clearAllForms();
    }
    
    renderLOSelector();
    updateModuleSummary();
    showStatus(window.i18n.t('dgLearningOutcomeDeleted'), 'success');
}
