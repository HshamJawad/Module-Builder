// ============================================================
// /src/modules.js
// Module CRUD, module selector, module summary
// Extracted verbatim from Module_Builder.html lines 2932-3271 (v2.0-legacy).
// ============================================================

/**
 * Boot: hands over to the module library (module_library.js), which
 * opens the last project — or, when DACUM Live Pro has just handed
 * modules over, files them into the project of their programme.
 *
 * The handoff is read and removed HERE, synchronously, during the first
 * script turn after DOMContentLoaded: it must be consumed exactly once,
 * whatever happens to the asynchronous boot that follows.
 */
async function initializeLearningOutcomes() {
    let exportData = null;
    try {
        const raw = mbGetSetting(MB_KEYS.dacumImport);
        if (raw) {
            exportData = JSON.parse(raw);
            // Diagnostic only — what this side read, to compare with the
            // line DACUM logs when it writes the handoff.
            console.log('[ModuleBuilder←DACUM] read', (exportData.modules || []).length, 'module(s):',
                (exportData.modules || []).map(m => m.moduleId), 'programme:', exportData.programId || '(none)');
        }
    } catch (error) {
        console.error('Error reading DACUM export:', error);
        exportData = null;
    }
    // One-time import, read or unreadable.
    if (mbGetSetting(MB_KEYS.dacumImport) !== null) mbRemoveSetting(MB_KEYS.dacumImport);

    return mbLibraryBoot(exportData);
}

/**
 * Pre-fill the cover table from a DACUM handoff — EMPTY rows only, and
 * only the rows the whole programme shares: occupation, job, sector.
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

    if (exportData.occupation && exportData.occupation !== 'Unknown Occupation') fill('cvOccupation', exportData.occupation);
    /* DACUM Live Pro 3.44+: job title and sector from Chart Info. */
    fill('cvJob', exportData.jobTitle);
    fill('cvSector', exportData.sector);
    /* Unit title, module code, level, hours and entry requirements are
       per module since 3.12.0: each module carries its own and puts them
       on the table when it is opened (module_library.js). */

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
        moduleNumber: dacumModule.moduleNumber || '',
        source: 'dacum'
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
    /* 3.16.0: the other content languages of DACUM's texts (DACUM Live
       Pro 3.79+) — see dacum_i18n.js. Replaced on every transfer, so a
       transfer without them leaves no stale translations behind. */
    const di = (typeof mbDacumI18nFrom === 'function') ? mbDacumI18nFrom(exportData) : null;
    if (di) module.dacumI18n = di; else delete module.dacumI18n;
    /* 3.17.0: tasks left out of training in DACUM's Task Verification
       (DACUM Live Pro 3.84+), with their reasons — documentation only.
       Programme-level, kept on every module like the reference data and
       replaced on every transfer, so a transfer without it clears it. */
    const ts = exportData.taskSelection;
    if (ts && typeof ts === 'object' && Array.isArray(ts.excluded) && ts.excluded.length) module.dacumTaskSelection = ts;
    else delete module.dacumTaskSelection;
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

/** Asks the module library to write what is open (it writes only what
 *  changed). */
function _mbTouchAutosave() {
    if (typeof mbLibrarySave === 'function') mbLibrarySave();
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

const MB_MODULE_SELECTORS = ['current-module-selector', 'info-module-selector', 'activity-module-selector',
                             'assessment-module-selector', 'mapping-module-selector'];

/**
 * Every module selector ends here. The module is opened through the
 * library, which saves the one being left and reads the chosen one from
 * storage (only one module is complete in memory at a time).
 */
async function mbSelectModule(selectedId, labelText) {
    if (!selectedId) {
        /* "-- Select module --" is not a state the library has: there is
           always an open module. Put the selectors back. */
        MB_MODULE_SELECTORS.forEach(id => { const s = document.getElementById(id); if (s) s.value = mbState.currentModuleId || ''; });
        return;
    }
    MB_MODULE_SELECTORS.forEach(id => { const s = document.getElementById(id); if (s) s.value = selectedId; });
    if (selectedId === mbState.currentModuleId) return;
    await mbLibraryOpenModule(selectedId);
    const m = mbState.modulesData.find(x => x.id === selectedId);
    showStatus(window.i18n.tf('dgSwitchedTo', { v0: labelText || (m ? mbModuleLabel(m) : selectedId) }), 'success');
}

// Called from tab context bars
function switchModuleFromTab(source) {
    const sel = document.getElementById(source + '-module-selector');
    if (!sel) return;
    return mbSelectModule(sel.value, sel.options[sel.selectedIndex]?.text);
}

function switchModule() {
    const sel = document.getElementById('current-module-selector');
    if (!sel) return;
    return mbSelectModule(sel.value, sel.options[sel.selectedIndex]?.text);
}

async function addNewModule() {
    if (typeof mbIsReadOnly === 'function' && mbIsReadOnly()) return;
    const title = await mbPrompt(window.i18n.t('dgEnterModuleTitle'), window.i18n.tf('dgDefaultModuleName', { v0: mbState.modulesData.length + 1 }));
    if (!title) return;

    mbState.moduleIdCounter++;
    const newModule = {
        id: `module-${mbState.moduleIdCounter}`,
        title: title,
        learningOutcomes: []
    };
    /* Saves the module being left, then appends and opens this one. */
    await mbLibraryAddModule(newModule);
    showStatus(window.i18n.t('dgModuleAddedYouCanNow'), 'success');
}

async function renameModule() {
    if (typeof mbIsReadOnly === 'function' && mbIsReadOnly()) return;
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
    _mbTouchAutosave();
    showStatus(window.i18n.t('dgModuleRenamed'), 'success');
}

async function deleteModule() {
    if (typeof mbIsReadOnly === 'function' && mbIsReadOnly()) return;
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
    
    /* Removed from storage too; the first remaining module opens (or a
       new default one, when this was the last). */
    await mbLibraryDeleteModule(module.id);
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
