// ============================================================
// /src/outcomes.js
// Learning outcome CRUD, performance criteria panel
// Extracted verbatim from Module_Builder.html lines 3272-3598 (v2.0-legacy).
// ============================================================

async function addNewLearningOutcome(defaultTitle) {
    if (!mbState.currentModuleId) {
        await mbAlert(window.i18n.t('dgPleaseSelectOrCreateA'));
        return;
    }
    
    const title = defaultTitle || await mbPrompt(window.i18n.t('dgEnterLearningOutcomeTitle'), window.i18n.tf('dgDefaultLOName', { v0: mbState.learningOutcomesData.length + 1 }));
    if (!title && !defaultTitle) return;
    
    mbState.loIdCounter++;
    const newLO = {
        id: `lo-${mbState.loIdCounter}`,
        title: title || window.i18n.tf('dgDefaultLOName', { v0: mbState.learningOutcomesData.length + 1 }),
        number: '',
        statement: '',
        performanceCriteria: [],
        infoSheets: [],
        activitySheets: []
    };
    
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

function renderLOSelector() {
    const optionsHtml = '<option data-i18n="mbSelectLearningOutcome" value="">' + window.i18n.t('mbSelectLearningOutcome') + '</option>' +
        mbState.learningOutcomesData.map(lo =>
            `<option value="${lo.id}">${lo.title}</option>`
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
                    <button data-act="editPerformanceCriterion" data-args='[${index}]' style="background: #3b82f6; color: white; padding: 4px 8px; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85em;">
                        ✏️
                    </button>
                    <button data-act="deletePerformanceCriterion" data-args='[${index}]' style="background: #ef4444; color: white; padding: 4px 8px; border: none; border-radius: 4px; cursor: pointer; font-size: 0.85em;">
                        🗑️
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
    
    const newTitle = await mbPrompt(window.i18n.t('dgEnterNewTitle'), lo.title);
    if (!newTitle) return;
    
    lo.title = newTitle;
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
    const message = totalSheets > 0 
        ? `⚠️ Delete this Learning Outcome?\n\nThis Learning Outcome contains ${totalSheets} sheet(s).\n\nThis action cannot be undone. Continue?`
        : '⚠️ Delete this Learning Outcome?\n\nThis action cannot be undone. Continue?';
    
    if (!await mbConfirm(message)) {
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
