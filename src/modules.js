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
                        learningOutcomes: [],
                        /* "M1" as assigned in DACUM Live Pro's own Module
                           Mapping tab — carried through purely for display
                           continuity between the two tools; nothing here
                           derives module identity from it. */
                        moduleNumber: dacumModule.moduleNumber || '',
                        /* Read-only source material for the module currently
                           selected — see renderModuleTaskAnalysisPanel()
                           below. Absent (undefined) for a module created
                           manually in Module Builder, or for a DACUM export
                           built before this field existed; every reader of
                           this property already treats that as "nothing to
                           show" rather than an error. */
                        taskAnalysisSource: {
                            sourceTaskIds: dacumModule.sourceTaskIds || [],
                            taskAnalysis: dacumModule.taskAnalysis || {}
                        }
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
    renderModuleTaskAnalysisPanel();
}

/**
 * Read-only reference panel: the Task Analysis detail DACUM Live Pro
 * attached to the currently-selected module's source tasks (Knowledge,
 * Performance Steps, Tools/Equipment/Materials, Safety/OSH, Decisions,
 * Performance Standard, Common Errors) — grouped by task so it stays
 * legible when a module draws on more than one.
 *
 * Deliberately read-only and deliberately NOT copied into any sheet
 * automatically: this is source material for the author to consult
 * while writing the Information Sheet, Activity Sheet and Assessment
 * Unit by hand, matching how DACUM Live Pro itself hands the module
 * off ("do not overwhelm the user" — the person stays in control of
 * what actually goes in the document). Hidden entirely for a module
 * with nothing to show — created manually here, or imported before
 * this field existed.
 *
 * Labels are plain English, not window.i18n — this reference panel is
 * new and mb-translations.js (Module Builder's own dictionary file)
 * was not part of this change, so there are no keys for it to resolve.
 */
function renderModuleTaskAnalysisPanel() {
    const host = document.getElementById('moduleTaskAnalysisPanel');
    if (!host) return;

    const module = mbState.modulesData.find(m => m.id === mbState.currentModuleId);
    const src = module && module.taskAnalysisSource;
    const taskIds = src && src.sourceTaskIds || [];

    if (!module || !taskIds.length) {
        host.innerHTML = '';
        return;
    }

    const FIELD_MAP = [
        ['requiredKnowledge',           '📘 Required Knowledge',            'Information Sheet'],
        ['requiredSkills',              '🧩 Required Skills',               'Activity / Job Sheet'],
        ['performanceSteps',            '🛠️ Performance Steps',             'Activity / Job Sheet'],
        ['toolsEquipmentMaterials',     '🧰 Tools, Equipment & Materials',  'Activity / Job Sheet — Resources'],
        ['safetyOSH',                   '⚠️ Safety / OSH',                  'Activity / Job Sheet'],
        ['conditionsWorkEnvironment',   '🏗️ Conditions / Work Environment', 'Activity / Job Sheet'],
        ['decisionsCriticalPoints',     '🧭 Decisions / Critical Points',   'Activity / Job Sheet'],
        ['performanceStandard',         '🎯 Performance Standard',          'Assessment Unit'],
        ['commonErrorsTroubleshooting', '🐛 Common Errors / Troubleshooting','Assessment Unit'],
    ];

    const blocks = taskIds.map(taskId => {
        const ta = src.taskAnalysis[taskId];
        if (!ta) return '';
        const sections = FIELD_MAP.map(([key, label]) => {
            const val = ta[key];
            const items = Array.isArray(val) ? val.filter(Boolean) : (val && String(val).trim() ? [val] : []);
            if (!items.length) return '';
            const body = Array.isArray(val)
                ? '<ul style="margin:4px 0 0;padding-inline-start:20px;">' +
                  items.map(i => `<li dir="auto" style="margin-bottom:2px;">${escapeHtml(i)}</li>`).join('') +
                  '</ul>'
                : `<div dir="auto" style="margin-top:4px;">${escapeHtml(items[0])}</div>`;
            return `<div style="margin-bottom:10px;"><strong style="color:#374151;font-size:0.92em;">${label}</strong>${body}</div>`;
        }).join('');
        if (!sections) return '';
        return `
            <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px;margin-bottom:12px;">
                <div style="font-weight:700;color:#0ea5e9;font-size:0.88em;margin-bottom:8px;">${escapeHtml(ta.taskCode || taskId)}</div>
                ${sections}
            </div>`;
    }).join('');

    if (!blocks) { host.innerHTML = ''; return; }

    host.innerHTML = `
        <div style="background:#f0f9ff;border:2px solid #0ea5e9;border-radius:12px;padding:18px 20px;margin:20px 0;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                <span style="font-size:1.2em;">📥</span>
                <strong style="color:#0c4a6e;font-size:1.05em;">Task Analysis Reference (from DACUM Live Pro)</strong>
            </div>
            <p style="margin:0 0 14px;color:#64748b;font-size:0.85em;">
                Source detail for this module's task(s) — for your reference only. Nothing here is
                copied automatically; use it while writing the Information Sheet, Activity/Job Sheet
                and Assessment Unit below.
            </p>
            ${blocks}
        </div>`;
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
    renderModuleTaskAnalysisPanel();
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
    renderModuleTaskAnalysisPanel();
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
