// ============================================================
// /src/modules.js
// Module CRUD, module selector, module summary
// Extracted verbatim from Module_Builder.html lines 2932-3271 (v2.0-legacy).
// ============================================================

async function initializeLearningOutcomes() {
    // Check for DACUM export data in localStorage
    try {
        const dacumExportData = mbGetSetting(MB_KEYS.dacumImport);
        if (dacumExportData) {
            const exportData = JSON.parse(dacumExportData);
            
            // Clear localStorage after reading (one-time import)
            mbRemoveSetting(MB_KEYS.dacumImport);
            
            // Convert DACUM modules to Module Builder format
            if (exportData.modules && exportData.modules.length > 0) {
                mbState.modulesData = [];
                mbState.moduleIdCounter = 0;
                mbState.loIdCounter = 0;
                
                exportData.modules.forEach(dacumModule => {
                    mbState.moduleIdCounter++;
                    const newModule = {
                        id: dacumModule.moduleId || `module-${mbState.moduleIdCounter}`,
                        title: dacumModule.moduleTitle || window.i18n.tf('dgDefaultModuleName', { v0: mbState.moduleIdCounter }),
                        learningOutcomes: []
                    };
                    
                    dacumModule.learningOutcomes.forEach(lo => {
                        mbState.loIdCounter++;
                        const newLO = {
                            id: `lo-${mbState.loIdCounter}`,
                            title: `${lo.number}: ${lo.statement}`,
                            number: lo.number || '',
                            statement: lo.statement || '',
                            performanceCriteria: lo.performanceCriteria || [],
                            infoSheets: [],
                            activitySheets: []
                        };
                        newModule.learningOutcomes.push(newLO);
                    });
                    
                    mbState.modulesData.push(newModule);
                });
                
                // Select first module
                if (mbState.modulesData.length > 0) {
                    mbState.currentModuleId = mbState.modulesData[0].id;
                    syncLearningOutcomesFromCurrentModule();
                    renderModuleSelector();
                    renderLOSelector();
                    
                    // Select first LO
                    if (mbState.learningOutcomesData.length > 0) {
                        mbState.currentLOId = mbState.learningOutcomesData[0].id;
                        ['current-lo-selector','info-lo-selector','activity-lo-selector'].forEach(id => { const s=document.getElementById(id); if(s) s.value=mbState.currentLOId; });
                        loadCurrentLOSheets();
                    }
                }
                
                showStatus(window.i18n.tf('dgImportedModulesWithLearningOutcome', { v0: mbState.modulesData.length, v1: mbState.loIdCounter }), 'success');
                return;
            }
        }
    } catch (error) {
        console.error('Error loading DACUM export:', error);
    }
    
    // If no DACUM data or error, proceed with default initialization
    // Create default module structure
    if (mbState.modulesData.length === 0) {
        mbState.moduleIdCounter = 1;
        mbState.modulesData = [{
            id: `module-${mbState.moduleIdCounter}`,
            title: window.i18n.tf('dgDefaultModuleName', { v0: 1 }),
            learningOutcomes: []
        }];
        mbState.currentModuleId = mbState.modulesData[0].id;
    }
    
    // If no LOs exist in current module, create a default one
    syncLearningOutcomesFromCurrentModule();
    if (mbState.learningOutcomesData.length === 0) {
        /* awaited: addNewLearningOutcome is async now (it can raise a
           modal), and the two renderers below read the list it creates.
           Without the await they would run against an empty list and the
           new outcome would not appear until some later repaint. */
        await addNewLearningOutcome(window.i18n.tf('dgDefaultLOName', { v0: 1 }));
    }
    renderModuleSelector();
    renderLOSelector();
}

// Helper function to sync mbState.learningOutcomesData with current module
function syncLearningOutcomesFromCurrentModule() {
    const currentModule = mbState.modulesData.find(m => m.id === mbState.currentModuleId);
    if (currentModule) {
        mbState.learningOutcomesData = currentModule.learningOutcomes;
    } else {
        mbState.learningOutcomesData = [];
    }
}

// Helper function to save current module's LO data
function saveCurrentModuleLOData() {
    const currentModule = mbState.modulesData.find(m => m.id === mbState.currentModuleId);
    if (currentModule) {
        currentModule.learningOutcomes = mbState.learningOutcomesData;
    }
}

// Module Management Functions
function renderModuleSelector() {
    /* Rebuilt on every render, so it carries data-i18n as well as a
       resolved label: the attribute lets a language switch repaint it
       without re-rendering the list and losing the current selection. */
    const optionsHtml = '<option data-i18n="mbSelectModule" value="">' + window.i18n.t('mbSelectModule') + '</option>' +
        mbState.modulesData.map(m => `<option value="${m.id}">${m.title}</option>`).join('');

    // Sync ALL module selectors (basic-info + tab bars)
    ['current-module-selector',
     'info-module-selector',
     'activity-module-selector',
     'assessment-module-selector'].forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        sel.innerHTML = optionsHtml;
        if (mbState.currentModuleId && mbState.modulesData.find(m => m.id === mbState.currentModuleId)) {
            sel.value = mbState.currentModuleId;
        } else if (mbState.modulesData.length > 0) {
            sel.value = mbState.modulesData[0].id;
            mbState.currentModuleId = mbState.modulesData[0].id;
        }
    });

    updateModuleSummary();
}

// Called from tab context bars — mirrors switchModule() logic
function switchModuleFromTab(source) {
    const selectorId = source + '-module-selector';
    const sel = document.getElementById(selectorId);
    if (!sel) return;
    const selectedId = sel.value;

    // Sync all module selectors first
    ['current-module-selector',
     'info-module-selector',
     'activity-module-selector',
     'assessment-module-selector'].forEach(id => {
        const s = document.getElementById(id);
        if (s) s.value = selectedId;
    });

    if (!selectedId) {
        mbState.currentModuleId = null;
        mbState.learningOutcomesData = [];
        const summary = document.getElementById('module-summary');
        if (summary) summary.style.display = 'none';
        renderLOSelector();
        return;
    }

    if (mbState.currentModuleId && mbState.currentModuleId !== selectedId) {
        saveCurrentModuleLOData();
        if (mbState.currentLOId) saveCurrentSheetToLO();
    }

    mbState.currentModuleId = selectedId;
    syncLearningOutcomesFromCurrentModule();
    mbState.currentLOId = null;
    if (mbState.learningOutcomesData.length > 0) {
        mbState.currentLOId = mbState.learningOutcomesData[0].id;
        loadCurrentLOSheets();
    } else {
        clearAllForms();
    }
    renderLOSelector();
    updateModuleSummary();
    const selText = sel.options[sel.selectedIndex]?.text || selectedId;
    showStatus(window.i18n.tf('dgSwitchedTo', { v0: selText }), 'success');
}

function switchModule() {
    const selector = document.getElementById('current-module-selector');
    const selectedModuleId = selector.value;

    // Sync all module selectors
    ['info-module-selector',
     'activity-module-selector',
     'assessment-module-selector'].forEach(id => {
        const s = document.getElementById(id);
        if (s) s.value = selectedModuleId;
    });

    if (!selectedModuleId) {
        mbState.currentModuleId = null;
        mbState.learningOutcomesData = [];
        document.getElementById('module-summary').style.display = 'none';
        renderLOSelector();
        return;
    }
    
    // Save current module's LO data before switching
    if (mbState.currentModuleId && mbState.currentModuleId !== selectedModuleId) {
        saveCurrentModuleLOData();
        // Also save current sheet to LO
        if (mbState.currentLOId) {
            saveCurrentSheetToLO();
        }
    }
    
    // Switch to new module
    mbState.currentModuleId = selectedModuleId;
    syncLearningOutcomesFromCurrentModule();
    
    // Reset current LO and load first LO if available
    mbState.currentLOId = null;
    if (mbState.learningOutcomesData.length > 0) {
        mbState.currentLOId = mbState.learningOutcomesData[0].id;
        loadCurrentLOSheets();
    } else {
        clearAllForms();
    }
    
    renderLOSelector();
    updateModuleSummary();
    showStatus(window.i18n.tf('dgSwitchedTo2', { v0: selector.options[selector.selectedIndex].text }), 'success');
}

async function addNewModule() {
    const title = await mbPrompt(window.i18n.t('dgEnterModuleTitle'), window.i18n.tf('dgDefaultModuleName', { v0: mbState.modulesData.length + 1 }));
    if (!title) return;
    
    // Save current module before creating new one
    if (mbState.currentModuleId) {
        saveCurrentModuleLOData();
        if (mbState.currentLOId) {
            saveCurrentSheetToLO();
        }
    }
    
    mbState.moduleIdCounter++;
    const newModule = {
        id: `module-${mbState.moduleIdCounter}`,
        title: title,
        learningOutcomes: []
    };
    
    mbState.modulesData.push(newModule);
    mbState.currentModuleId = newModule.id;
    syncLearningOutcomesFromCurrentModule();
    
    renderModuleSelector();
    ['current-module-selector','info-module-selector','activity-module-selector','assessment-module-selector'].forEach(id=>{const s=document.getElementById(id);if(s)s.value=mbState.currentModuleId;});
    
    // Clear LO selection and forms
    mbState.currentLOId = null;
    clearAllForms();
    renderLOSelector();
    
    showStatus(window.i18n.t('dgModuleAddedYouCanNow'), 'success');
}

async function renameModule() {
    if (!mbState.currentModuleId) {
        await mbAlert(window.i18n.t('dgPleaseSelectAModuleFirst'));
        return;
    }
    
    const module = mbState.modulesData.find(m => m.id === mbState.currentModuleId);
    if (!module) return;
    
    const newTitle = await mbPrompt(window.i18n.t('dgEnterNewModuleTitle'), module.title);
    if (!newTitle) return;
    
    module.title = newTitle;
    renderModuleSelector();
    showStatus(window.i18n.t('dgModuleRenamed'), 'success');
}

async function deleteModule() {
    if (!mbState.currentModuleId) {
        await mbAlert(window.i18n.t('dgPleaseSelectAModuleFirst'));
        return;
    }
    
    const module = mbState.modulesData.find(m => m.id === mbState.currentModuleId);
    if (!module) return;
    
    const totalLOs = module.learningOutcomes.length;
    const totalSheets = module.learningOutcomes.reduce((sum, lo) => 
        sum + lo.infoSheets.length + lo.activitySheets.length, 0);
    
    const message = (totalLOs > 0 || totalSheets > 0)
        ? `⚠️ Delete Module "${module.title}"?\n\nThis module contains:\n• ${totalLOs} Learning Outcome(s)\n• ${totalSheets} sheet(s)\n\nThis action cannot be undone. Continue?`
        : `⚠️ Delete Module "${module.title}"?\n\nThis action cannot be undone. Continue?`;
    
    if (!await mbConfirm(message)) {
        return;
    }
    
    mbState.modulesData = mbState.modulesData.filter(m => m.id !== mbState.currentModuleId);
    mbState.currentModuleId = null;
    
    // If there are still modules, select the first one
    if (mbState.modulesData.length > 0) {
        mbState.currentModuleId = mbState.modulesData[0].id;
        syncLearningOutcomesFromCurrentModule();
        if (mbState.learningOutcomesData.length > 0) {
            mbState.currentLOId = mbState.learningOutcomesData[0].id;
            loadCurrentLOSheets();
        } else {
            mbState.currentLOId = null;
            clearAllForms();
        }
    } else {
        mbState.learningOutcomesData = [];
        mbState.currentLOId = null;
        clearAllForms();
    }
    
    renderModuleSelector();
    renderLOSelector();
    showStatus(window.i18n.t('dgModuleDeleted'), 'success');
}

function updateModuleSummary() {
    const summary = document.getElementById('module-summary');
    
    if (!mbState.currentModuleId) {
        summary.style.display = 'none';
        return;
    }
    
    const module = mbState.modulesData.find(m => m.id === mbState.currentModuleId);
    if (!module) {
        summary.style.display = 'none';
        return;
    }
    
    summary.style.display = 'block';
    
    const loCount = module.learningOutcomes.length;
    const sheetsCount = module.learningOutcomes.reduce((sum, lo) => 
        sum + lo.infoSheets.length + lo.activitySheets.length, 0);
    
    document.getElementById('module-lo-count').textContent = loCount;
    document.getElementById('module-sheets-count').textContent = sheetsCount;
}
