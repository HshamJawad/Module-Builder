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
            
            // Diagnostic only — confirms exactly what this side actually
            // read out of localStorage before anything else touches it, so
            // "fewer modules than expected" can be checked against this
            // line to rule the import step in or out. Safe to remove once
            // transfer reliability is fully confirmed.
            console.log('[ModuleBuilder←DACUM] read', (exportData.modules || []).length, 'module(s):',
                (exportData.modules || []).map(m => m.moduleId));

            // Clear localStorage after reading (one-time import)
            mbRemoveSetting(MB_KEYS.dacumImport);

            // autosave.js restores the last IndexedDB snapshot ~1.2s after
            // load, unconditionally, into the same mbState.modulesData this
            // import is about to fill. Without this flag that restore wins
            // the race every time — the fresh DACUM import renders first,
            // then silently reverts to whatever was open before, which is
            // exactly the "shows the new modules for a moment, then goes
            // back to the old session" symptom this fixes. A fresh handoff
            // from DACUM is a deliberate new session; it should not be
            // merged with unrelated leftover autosave data at all.
            mbState._skipAutosaveRestore = true;
            
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
                        /* Task Analysis detail from DACUM Live Pro for this
                           module's source tasks — read by the Training
                           Structure Mapping tab (module-ai.js) to let the
                           user select, assign and move individual items.
                           Absent (undefined) for a module created manually
                           in Module Builder, or for a DACUM export built
                           before this field existed; every reader of this
                           property already treats that as "nothing to
                           show" rather than an error. */
                        taskAnalysisSource: {
                            sourceTaskIds: dacumModule.sourceTaskIds || [],
                            taskAnalysis: dacumModule.taskAnalysis || {}
                        }
                    };

                    /* Programme level (1..N) and specialisation code
                       ("CMCN", "CM" …) from DACUM's Module Mapping tab.
                       Optional: absent on exports made before DACUM Live
                       Pro 3.26, and every reader below treats absent as
                       "not set". Saved with the module, so they survive
                       autosave and the project JSON with no other change. */
                    const lvl = parseInt(dacumModule.level, 10);
                    if (Number.isInteger(lvl) && lvl > 0) newModule.level = lvl;
                    const trk = String(dacumModule.track || '').trim();
                    if (trk) newModule.track = trk;

                    /* Verified Occupational Reference Data — occupation-
                       level evidence from DACUM's supplementary
                       verification. It used to be dropped here, because
                       the export key is removed right after this read and
                       nothing else ever saw it. Kept on each imported
                       module (the module object is what autosave and the
                       project file already persist). Reference only: it
                       is never turned into outcomes or content. */
                    const ref = exportData.occupationalReference;
                    if (ref && typeof ref === 'object' && ref.available !== false) {
                        newModule.occupationalReference = ref;
                    }
                    
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
                
                // Fill empty cover rows from the handoff (never overwrites).
                try { _mbPrefillCoverFromDacum(exportData); }
                catch (e) { console.warn('[ModuleBuilder←DACUM] cover prefill skipped:', e); }

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

/**
 * Pre-fill the cover table from a DACUM handoff — EMPTY rows only.
 *
 *   Level        ← the modules' level, when every imported module that
 *                  has one shares it (a multi-level import has no single
 *                  answer, so the row is left for the author).
 *   Occupation   ← the occupation title from DACUM.
 *   Unit title   ← the module title, when exactly one module came over.
 *
 * Written to every language side: the values are names and a number,
 * and a side left empty would make the row vanish from an export in
 * that language. Anything the author has typed is never touched.
 */
function _mbPrefillCoverFromDacum(exportData) {
    if (!Array.isArray(mbState.coverRows) || typeof biSet !== 'function') return;
    if (typeof mbSeedCoverLabels === 'function') mbSeedCoverLabels();   // rows + seedKeys exist
    const codes = (typeof BILANG_CODES !== 'undefined' && BILANG_CODES.length) ? BILANG_CODES : ['en', 'ar'];
    const rowBy = key => mbState.coverRows.find(r => r.seedKey === key || r.field === key);
    const isEmpty = r => (typeof biEmpty === 'function') ? biEmpty(r.value)
        : !codes.some(c => String((r.value || {})[c] || '').trim());
    const fill = (key, text) => {
        const r = rowBy(key);
        text = String(text || '').trim();
        if (!r || !text) return;
        if (typeof biIs === 'function' && !biIs(r.value)) r.value = biNew();
        if (!isEmpty(r)) return;
        codes.forEach(c => biSet(r, 'value', c, text));
    };

    const mods = exportData.modules || [];
    const levels = Array.from(new Set(mods.map(m => parseInt(m.level, 10)).filter(n => n > 0)));
    if (levels.length === 1) fill('cvLevel', String(levels[0]));
    if (exportData.occupation && exportData.occupation !== 'Unknown Occupation') fill('cvOccupation', exportData.occupation);
    if (mods.length === 1) fill('cvUnitTitle', mods[0].moduleTitle);

    if (typeof renderCoverTable === 'function') renderCoverTable();
}

/* "(L1 · CMCN)" after a module's name — level and specialisation from
   DACUM, when present. Short on purpose: it sits inside a <select>. */
function _mbLevelShort() {
    const lang = (window.i18n && window.i18n.getLang) ? window.i18n.getLang() : 'en';
    return ({ ar: 'م', fr: 'N' })[lang] || 'L';
}
function mbModuleTag(m) {
    const parts = [];
    if (m && m.level) parts.push(_mbLevelShort() + m.level);
    if (m && m.track) parts.push(m.track);
    return parts.length ? ` (${parts.join(' · ')})` : '';
}
function mbModuleLabel(m) {
    return (m.moduleNumber ? m.moduleNumber + ' — ' : '') + m.title + mbModuleTag(m);
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
        mbState.modulesData.map(m => `<option value="${m.id}">${mbModuleLabel(m)}</option>`).join('');

    // Sync ALL module selectors (basic-info + tab bars)
    ['current-module-selector',
     'info-module-selector',
     'activity-module-selector',
     'assessment-module-selector',
     'mapping-module-selector'].forEach(id => {
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
     'assessment-module-selector',
     'mapping-module-selector'].forEach(id => {
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
    // A pending Training Structure Mapping proposal belongs to the
    // module it was built for; switching modules invalidates it rather
    // than silently approving suggestions onto the wrong module.
    mbState.structureProposal = null;
    if (typeof renderStructureProposal === 'function') renderStructureProposal();
    if (typeof renderSourceBrowser === 'function') renderSourceBrowser();
    if (typeof renderAssignedItemsPanel === 'function') renderAssignedItemsPanel();
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
    mbState.structureProposal = null;
    if (typeof renderStructureProposal === 'function') renderStructureProposal();
    if (typeof renderSourceBrowser === 'function') renderSourceBrowser();
    if (typeof renderAssignedItemsPanel === 'function') renderAssignedItemsPanel();
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

    /* Level / specialisation line, only for a module that has them
       (imported from DACUM Live Pro). Created on first use so index.html
       needs no change. */
    let info = document.getElementById('module-level-info');
    if (!module.level && !module.track) { if (info) info.remove(); return; }
    if (!info) {
        info = document.createElement('div');
        info.id = 'module-level-info';
        info.style.cssText = 'margin-top:12px;padding-top:10px;border-top:1px solid #e0f2fe;color:#0c4a6e;font-size:0.95em;display:flex;flex-wrap:wrap;gap:6px 18px;';
        summary.appendChild(info);
    }
    const lang = (window.i18n && window.i18n.getLang) ? window.i18n.getLang() : 'en';
    const lvlLabel = (window.i18n && window.i18n.t && window.i18n.t('cvLevel') !== 'cvLevel')
        ? window.i18n.t('cvLevel').replace(/:\s*$/, '')
        : ({ ar: 'المستوى', fr: 'Niveau' })[lang] || 'Level';
    const trkLabel = ({ ar: 'التخصص', fr: 'Spécialisation' })[lang] || 'Specialisation';
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    info.innerHTML =
        (module.level ? `<span><strong>${esc(lvlLabel)}:</strong> ${esc(module.level)}</span>` : '') +
        (module.track ? `<span><strong>${esc(trkLabel)}:</strong> ${esc(module.track)}</span>` : '');
}
