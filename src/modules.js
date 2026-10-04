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
            // back to the old session" symptom this fixes. Set BEFORE the
            // first await below, while still inside the synchronous part of
            // the boot, so the 1.2 s restore timer always sees it.
            mbState._skipAutosaveRestore = true;
            
            if (exportData.modules && exportData.modules.length > 0) {
                /* 3.9.0 — never discard earlier work silently. The previous
                   session lives only in the autosave snapshot (a page load
                   starts clean), and this import used to replace it: a
                   module built yesterday and not saved to a file was gone
                   the moment another module arrived from DACUM. When that
                   snapshot holds real work the user now chooses: add the
                   received modules to it, or start a new session — and in
                   that case the previous one is first kept as a backup
                   (a downloaded project file + a stored copy). */
                const prev = await _mbPreviousSessionWithWork();
                let mode = 'new';
                if (prev) {
                    const answer = await _mbAskDacumImportMode(exportData.modules.length);
                    // Esc (null) takes the choice that loses nothing on screen.
                    mode = answer === false ? 'new' : 'add';
                }

                let added = 0, updated = 0;
                if (mode === 'add') {
                    /* Same path the "restore previous session" banner uses,
                       so the whole project — cover, team, references,
                       assessment — comes back exactly as it was. */
                    document.dispatchEvent(new CustomEvent('autosave:restore', { detail: prev }));
                    if (!Array.isArray(mbState.modulesData)) mbState.modulesData = [];
                    exportData.modules.forEach(dacumModule => {
                        const existing = mbState.modulesData.find(m => m.id === dacumModule.moduleId);
                        if (existing) { _mbMergeDacumModule(existing, dacumModule, exportData); updated++; }
                        else { mbState.modulesData.push(_mbModuleFromDacum(dacumModule, exportData)); added++; }
                    });
                } else {
                    if (prev) await _mbBackupPreviousSession(prev);
                    mbState.modulesData = [];
                    mbState.moduleIdCounter = 0;
                    mbState.loIdCounter = 0;
                    exportData.modules.forEach(dacumModule => {
                        mbState.modulesData.push(_mbModuleFromDacum(dacumModule, exportData));
                    });
                }
                
                // Fill empty cover rows from the handoff (never overwrites).
                try { _mbPrefillCoverFromDacum(exportData); }
                catch (e) { console.warn('[ModuleBuilder←DACUM] cover prefill skipped:', e); }

                // Select the first module that just arrived
                const firstId = exportData.modules[0].moduleId;
                const first = mbState.modulesData.find(m => m.id === firstId) || mbState.modulesData[0];
                if (first) {
                    mbState.currentModuleId = first.id;
                    syncLearningOutcomesFromCurrentModule();
                    renderModuleSelector();
                    renderLOSelector();
                    
                    // Select first LO
                    if (mbState.learningOutcomesData.length > 0) {
                        mbState.currentLOId = mbState.learningOutcomesData[0].id;
                        ['current-lo-selector','info-lo-selector','activity-lo-selector'].forEach(id => { const s=document.getElementById(id); if(s) s.value=mbState.currentLOId; });
                        loadCurrentLOSheets();
                    } else {
                        mbState.currentLOId = null;
                    }
                }
                if (typeof renderStructureProposal === 'function') renderStructureProposal();
                if (typeof renderSourceBrowser === 'function') renderSourceBrowser();

                const loCount = exportData.modules.reduce((n, m) => n + (m.learningOutcomes || []).length, 0);
                if (mode === 'add') {
                    showStatus(window.i18n.tf('mbDacumMerged', { v0: added, v1: updated }), 'success');
                } else {
                    showStatus(window.i18n.tf('dgImportedModulesWithLearningOutcome', { v0: exportData.modules.length, v1: loCount }), 'success');
                }
                /* Persist the session that now exists (autosave only
                   writes on edits; without this the snapshot would still
                   hold the old session, and the next page load would offer
                   to bring it back over the received modules). */
                _mbTouchAutosave();
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
    /* DACUM Live Pro 3.44+: job title and sector from Chart Info. */
    fill('cvJob', exportData.jobTitle);
    fill('cvSector', exportData.sector);
    if (mods.length === 1) {
        const m = mods[0];
        fill('cvUnitTitle', m.moduleTitle);
        fill('cvModuleCode', m.moduleCode);
        /* From DACUM's Module Curriculum tab, when it was filled in. */
        const cur = m.curriculum || {};
        if (cur.totalHours) fill('cvHours', String(cur.totalHours));
        if (Array.isArray(cur.prerequisites) && cur.prerequisites.length) fill('cvEntryReq', cur.prerequisites.join('\n'));
    }

    if (typeof renderCoverTable === 'function') renderCoverTable();
}

/* ── DACUM Live Pro handoff helpers (3.9.0) ───────────────────── */

/** A Module Builder module built from one module of a DACUM export. */
function _mbModuleFromDacum(dacumModule, exportData) {
    mbState.moduleIdCounter++;
    const newModule = {
        id: dacumModule.moduleId || `module-${mbState.moduleIdCounter}`,
        title: dacumModule.moduleTitle || window.i18n.tf('dgDefaultModuleName', { v0: mbState.moduleIdCounter }),
        learningOutcomes: [],
        /* "M1" as assigned in DACUM Live Pro's own Module Mapping tab —
           carried through for display continuity between the two tools;
           nothing here derives module identity from it. */
        moduleNumber: dacumModule.moduleNumber || ''
    };
    _mbApplyDacumModuleFields(newModule, dacumModule, exportData);
    (dacumModule.learningOutcomes || []).forEach(lo => {
        newModule.learningOutcomes.push(_mbLoFromDacum(lo));
    });
    return newModule;
}

function _mbLoFromDacum(lo) {
    mbState.loIdCounter++;
    return {
        id: `lo-${mbState.loIdCounter}`,
        title: `${lo.number}: ${lo.statement}`,
        number: lo.number || '',
        statement: lo.statement || '',
        // DACUM's own outcome id (DACUM Live Pro 3.44+) — lets a later
        // transfer update this outcome instead of matching by position.
        dacumLoId: lo.loId || null,
        performanceCriteria: lo.performanceCriteria || [],
        infoSheets: [],
        activitySheets: []
    };
}

/** Fields DACUM owns on a module — written on import and on every later
 *  transfer of the same module. Sheets, blocks and assessment written in
 *  Module Builder are never touched. */
function _mbApplyDacumModuleFields(module, dacumModule, exportData) {
    module.title = dacumModule.moduleTitle || module.title;
    module.moduleNumber = dacumModule.moduleNumber || module.moduleNumber || '';
    /* Task Analysis detail from DACUM Live Pro for this module's source
       tasks — read by the Training Structure Mapping tab (module-ai.js).
       sourceTasks (DACUM 3.44+) carries the code and statement of every
       source task, so a task without Task Analysis is still labelled. */
    module.taskAnalysisSource = {
        sourceTaskIds: dacumModule.sourceTaskIds || [],
        taskAnalysis: dacumModule.taskAnalysis || {},
        sourceTasks: dacumModule.sourceTasks || []
    };
    /* Programme level (1..N) and specialisation code ("CMCN", "CM" …)
       from DACUM's Module Mapping tab. Optional: absent on exports made
       before DACUM Live Pro 3.26; every reader treats absent as unset. */
    const lvl = parseInt(dacumModule.level, 10);
    if (Number.isInteger(lvl) && lvl > 0) module.level = lvl; else delete module.level;
    const trk = String(dacumModule.track || '').trim();
    if (trk) module.track = trk; else delete module.track;
    /* Module code ("CMCN 1-1") and short name (DACUM 3.34+), and how
       DACUM shows modules (code / number / both). */
    const code = String(dacumModule.moduleCode || '').trim();
    if (code) module.moduleCode = code; else delete module.moduleCode;
    const short = String(dacumModule.shortName || '').trim();
    if (short) module.shortName = short; else delete module.shortName;
    if (exportData.labelMode) module.labelMode = exportData.labelMode;
    /* Module Curriculum summary (DACUM 3.44+): credits, hours, purpose,
       prerequisites, outcome hours. Reference data on the module. */
    if (dacumModule.curriculum && typeof dacumModule.curriculum === 'object') module.curriculum = dacumModule.curriculum;
    else delete module.curriculum;
    /* Verified Occupational Reference Data — occupation-level evidence
       from DACUM's supplementary verification. Reference only: it is
       never turned into outcomes or content. */
    const ref = exportData.occupationalReference;
    if (ref && typeof ref === 'object' && ref.available !== false) module.occupationalReference = ref;
}

/** A module Module Builder already holds receives a new transfer: DACUM's
 *  fields are refreshed; each outcome is matched by DACUM id (then by
 *  number) and gets its new statement and criteria while keeping its
 *  sheets; new outcomes are appended; outcomes DACUM no longer sends are
 *  kept, because they may carry sheets written here. */
function _mbMergeDacumModule(module, dacumModule, exportData) {
    _mbApplyDacumModuleFields(module, dacumModule, exportData);
    if (!Array.isArray(module.learningOutcomes)) module.learningOutcomes = [];
    const used = new Set();
    (dacumModule.learningOutcomes || []).forEach(lo => {
        let target = lo.loId ? module.learningOutcomes.find(x => x.dacumLoId === lo.loId) : null;
        if (!target) target = module.learningOutcomes.find(x => !used.has(x) && !x.dacumLoId && x.number && x.number === lo.number);
        if (target) {
            target.number = lo.number || target.number;
            target.statement = lo.statement || '';
            target.title = `${lo.number}: ${lo.statement}`;
            target.dacumLoId = lo.loId || target.dacumLoId || null;
            target.performanceCriteria = lo.performanceCriteria || [];
            used.add(target);
        } else {
            const fresh = _mbLoFromDacum(lo);
            module.learningOutcomes.push(fresh);
            used.add(fresh);
        }
    });
}

/** The autosaved previous session, when it holds real work; else null. */
async function _mbPreviousSessionWithWork() {
    try {
        let snap = await mbLoadDoc(MB_KEYS.autosave);
        if (!snap || snap.__corrupt) return null;
        if (typeof snap === 'string') { try { snap = JSON.parse(snap); } catch (e) { return null; } }
        if (!snap._autosave || !snap.version) return null;
        if (typeof window.mbSnapshotHasWork === 'function' && !window.mbSnapshotHasWork(snap)) return null;
        return snap;
    } catch (e) {
        console.warn('[ModuleBuilder←DACUM] could not read the previous session:', e);
        return null;
    }
}

function _mbAskDacumImportMode(n) {
    return _mbDialog({
        type: 'confirm',
        message: window.i18n.tf('mbDacumAskMode', { v0: n }),
        okLabel: window.i18n.t('mbDacumAddBtn'),
        cancelLabel: window.i18n.t('mbDacumNewBtn'),
        noBackdrop: true
    });
}

/** Keeps the previous session before a new one replaces it: a project
 *  file in Downloads (opens with 📂 Load) and a stored copy. */
async function _mbBackupPreviousSession(snap) {
    const d = new Date(), p = n => String(n).padStart(2, '0');
    const name = `Module_Builder_backup_${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}.json`;
    try {
        const file = Object.assign({}, snap);
        delete file._autosave; delete file._savedAt;
        const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = name;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) { console.warn('[ModuleBuilder←DACUM] backup file failed:', e); }
    try { await mbSaveDoc(MB_KEYS.autosave + '_before_dacum', snap); }
    catch (e) { console.warn('[ModuleBuilder←DACUM] stored backup failed:', e); }
    showStatus(window.i18n.tf('mbDacumBackupSaved', { v0: name }), 'success');
}

/** Asks autosave.js to write the current session (it listens for input
 *  events on the main container; an untrusted event does not mark the
 *  page as edited by the user). */
function _mbTouchAutosave() {
    const root = document.getElementById('main-container') || document.body;
    root.dispatchEvent(new Event('input', { bubbles: true }));
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
    /* DACUM 3.34+ sends the module code; it is shown the way DACUM shows
       modules ("Show modules as": code / number / both). Without a code,
       the number as before. */
    const num = m.moduleNumber || '';
    const code = m.moduleCode || '';
    let ref = num;
    if (code) ref = m.labelMode === 'number' ? (num || code) : (m.labelMode === 'both' && num ? `${num} · ${code}` : code);
    // A code already carries track and level ("CMCN 1-1"), so the tag is not repeated.
    return (ref ? ref + ' — ' : '') + m.title + (code ? '' : mbModuleTag(m));
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
        mbState.modulesData.map(m => `<option value="${m.id}">${mbModuleLabel(m)}${typeof mbModuleTaSuffix === 'function' ? mbModuleTaSuffix(m) : ''}</option>`).join('');

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

    /* Level / track / code / short-name line, only for a module that has them
       (imported from DACUM Live Pro). Created on first use so index.html
       needs no change. */
    let info = document.getElementById('module-level-info');
    if (!module.level && !module.track && !module.moduleCode && !module.shortName) { if (info) info.remove(); return; }
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
    /* 3.9.1: the same names DACUM Live Pro's Module Mapping card uses
       ("Track / code prefix", "Code", "Short name") — it used to read
       "Specialisation", which made the same value look like a different
       field. Code and short name arrive from DACUM 3.34+. */
    const t = (k, fb) => (window.i18n && window.i18n.t && window.i18n.t(k) !== k) ? window.i18n.t(k) : fb;
    const trkLabel  = t('mbInfoTrack', 'Track / code prefix');
    const codeLabel = t('mbInfoCode', 'Code');
    const shortLbl  = t('mbInfoShortName', 'Short name');
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    /* <bdi>: codes such as "CMCN 1-1" stay in their own order inside an
       Arabic line. */
    const colon = lang === 'fr' ? '\u00A0:' : ':';   // French puts a space before the colon
    const item = (label, value) => `<span><strong>${esc(String(label).trim())}${colon}</strong> <bdi>${esc(value)}</bdi></span>`;
    info.innerHTML =
        (module.level ? item(lvlLabel, module.level) : '') +
        (module.track ? item(trkLabel, module.track) : '') +
        (module.moduleCode ? item(codeLabel, module.moduleCode) : '') +
        (module.shortName ? item(shortLbl, module.shortName) : '');
}
