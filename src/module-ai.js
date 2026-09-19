// ============================================================
// /src/module-ai.js
// AI-Assisted Training Structure Mapping.
//
// This is an instructional-design ASSISTANT, not an autonomous content
// generator: it proposes a structure (which Information Sheets,
// Activity/Job Sheets, and Assessment forms would make sense given the
// module's Learning Outcomes, Performance Criteria, source Tasks and
// Task Analysis), the user reviews/edits that proposal, and only on
// explicit approval does anything become a real sheet — via the SAME
// creation functions the rest of the app already uses (addNewInfoSheet,
// addNewActivitySheet, sheets.js's bilingual field helpers). Nothing in
// here writes Task Analysis, Learning Outcomes, or Performance Criteria
// data; it only reads them.
//
// Requires (all already loaded before this file — see index.html):
//   mb_state.js   → mbState
//   modules.js    → mbState.modulesData, mbState.currentModuleId
//   outcomes.js   → mbState.learningOutcomesData, syncLearningOutcomesFromCurrentModule
//   sheets.js     → addNewInfoSheet, addNewActivitySheet, saveCurrentModuleLOData,
//                    updateLOSummary, loadInfoSheetAtIndex, loadActivitySheetAtIndex
//   assessment.js → mbState.assessmentFormsData, renderAssessmentForms
//   bilang.js     → biPut
//   ui.js         → showStatus, escapeHtml
//   mb-translations.js → window.i18n
// ============================================================

// ── Backend contract ─────────────────────────────────────────
// The API key lives on this server, never in the browser. See the end
// of this file for the exact request/response contract this endpoint
// must implement.
const MB_AI_BACKEND_BASE = 'https://dacum-ai-backend-production.up.railway.app';
const MB_AI_ENDPOINT = MB_AI_BACKEND_BASE + '/api/module-mapping';

// Ephemeral working proposal — NOT part of mbState's saved shape.
// Cleared on every new analysis/manual-mapping session; only what the
// user actually approves ever reaches mbState.modulesData /
// mbState.assessmentFormsData (which DO save/load normally).
mbState.structureProposal = null;   // { informationSheets:[], activitySheets:[], assessmentUnits:[], missingInformation:[], mode }

// ── Data gathering ───────────────────────────────────────────

/** Everything the backend needs for the module currently selected —
 *  the same fields already shown in the read-only Task Analysis
 *  Reference panel (renderModuleTaskAnalysisPanel in modules.js), plus
 *  the module's Learning Outcomes/Performance Criteria. Nothing here
 *  is a new source of truth; it is read straight from mbState. */
function mbGatherModuleMappingInput() {
    const module = mbState.modulesData.find(m => m.id === mbState.currentModuleId);
    if (!module) return null;

    syncLearningOutcomesFromCurrentModule();

    const learningOutcomes = (module.learningOutcomes || []).map(lo => ({
        id: lo.id,
        number: lo.number || '',
        statement: (typeof biGetStrict === 'function' ? biGetStrict(lo.statement, contentLang()) : lo.statement) || '',
        performanceCriteria: (lo.performanceCriteria || []).map(pc => ({
            id: pc.id || '', text: pc.text || pc.id || pc || '', taskId: pc.taskId || null
        }))
    }));

    const src = module.taskAnalysisSource || { sourceTaskIds: [], taskAnalysis: {} };

    return {
        module: {
            moduleId: module.id,
            moduleNumber: module.moduleNumber || '',
            moduleTitle: module.title || ''
        },
        learningOutcomes,
        sourceTaskIds: src.sourceTaskIds || [],
        taskAnalysis: src.taskAnalysis || {},
        language: (typeof contentLang === 'function' ? contentLang() : 'en')
    };
}

// ── AI-assisted analysis ─────────────────────────────────────

async function mbAnalyzeModuleStructure() {
    const input = mbGatherModuleMappingInput();
    if (!input) { showStatus(window.i18n.t('mbNoModuleSelected'), 'error'); return; }
    if (!input.learningOutcomes.length) { showStatus(window.i18n.t('mbNoLOsToAnalyze'), 'error'); return; }

    const btn = document.getElementById('mb-ai-analyze-btn');
    if (btn) { btn.disabled = true; btn.dataset.origText = btn.textContent; btn.textContent = window.i18n.t('mbAnalyzing'); }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 45000);
        let res;
        try {
            res = await fetch(MB_AI_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(input),
                signal: controller.signal
            });
        } finally {
            clearTimeout(timeout);
        }

        if (res.status === 429) { showStatus(window.i18n.t('mbAiRateLimited'), 'error'); return; }
        if (res.status >= 500) { showStatus(window.i18n.t('mbAiServerError'), 'error'); return; }
        if (!res.ok) { showStatus(window.i18n.t('mbAiRequestFailed'), 'error'); return; }

        let data;
        try { data = await res.json(); }
        catch (_) { showStatus(window.i18n.t('mbAiInvalidResponse'), 'error'); return; }

        if (!data || typeof data !== 'object') { showStatus(window.i18n.t('mbAiInvalidResponse'), 'error'); return; }

        mbState.structureProposal = mbNormalizeProposal(data, 'ai');
        renderStructureProposal();
        renderAssignedItemsPanel();
        showStatus(window.i18n.t('mbAiProposalReady'), 'success');
    } catch (err) {
        console.error('Module mapping AI request failed:', err);
        if (err && err.name === 'AbortError') showStatus(window.i18n.t('mbAiTimeout'), 'error');
        else showStatus(window.i18n.t('mbAiNetworkError'), 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = btn.dataset.origText || btn.textContent; }
    }
}

/** Defensive normalization: an incomplete or slightly-off-schema AI
 *  response must degrade to "fewer suggestions", never to a crash or a
 *  fabricated entry. Every array defaults to empty; every item gets the
 *  fields the review UI and the build step depend on. */
function mbNormalizeProposal(data, mode) {
    const arr = (v) => Array.isArray(v) ? v : [];
    const str = (v) => (typeof v === 'string' ? v : '');
    const idArr = (v) => arr(v).map(String);

    const normSelection = (s) => ({
        taskId: str(s && s.taskId), field: str(s && s.field),
        itemIndex: Number.isInteger(s && s.itemIndex) ? s.itemIndex : 0,
        itemText: str(s && s.itemText)
    });

    const normItem = (item, prefix, index) => ({
        tempId: str(item && item.tempId) || `${prefix}-${Date.now()}-${index}`,
        title: str(item && item.title),
        rationale: str(item && item.rationale),
        learningOutcomeIds: idArr(item && item.learningOutcomeIds),
        performanceCriteriaIds: idArr(item && item.performanceCriteriaIds),
        // Item-level source references — see section 12 of the granular-
        // mapping spec. A field-level sourceFields/sourceTaskIds pair from
        // an older AI response (or an older saved proposal) is no longer
        // read: this array is now the single source of truth for what a
        // proposal item draws from in Task Analysis.
        sourceSelections: arr(item && item.sourceSelections).map(normSelection).filter(s => s.taskId && s.field),
        mappingType: (item && (item.mappingType === 'transformation' ? 'transformation' : 'direct'))
    });

    return {
        mode,
        analysisSummary: str(data && data.analysisSummary),
        informationSheets: arr(data && data.informationSheets).map((it, i) => normItem(it, 'is', i)),
        activitySheets: arr(data && data.activitySheets).map((it, i) => normItem(it, 'as', i)),
        assessmentUnits: arr(data && data.assessmentUnits).map((it, i) => normItem(it, 'au', i)),
        missingInformation: arr(data && data.missingInformation).map(m => ({
            sourceTaskId: str(m && m.sourceTaskId), field: str(m && m.field), message: str(m && m.message)
        }))
    };
}

// ── Manual mapping (AI unavailable, or user prefers to skip it) ─

function mbStartManualMapping() {
    mbState.structureProposal = { mode: 'manual', analysisSummary: '', informationSheets: [], activitySheets: [], assessmentUnits: [], missingInformation: [] };
    renderStructureProposal();
    renderAssignedItemsPanel();
}

function mbAddManualProposalItem(kind) {
    if (!mbState.structureProposal) mbStartManualMapping();
    const key = kind === 'info' ? 'informationSheets' : kind === 'activity' ? 'activitySheets' : 'assessmentUnits';
    const prefix = kind === 'info' ? 'is' : kind === 'activity' ? 'as' : 'au';
    mbState.structureProposal[key].push({
        tempId: `${prefix}-${Date.now()}-${mbState.structureProposal[key].length}`,
        title: '', rationale: '', learningOutcomeIds: [], performanceCriteriaIds: [],
        sourceSelections: [], mappingType: 'direct'
    });
    renderStructureProposal();
    renderAssignedItemsPanel();
}

function mbRemoveProposalItem(kind, tempId) {
    if (!mbState.structureProposal) return;
    const key = kind === 'info' ? 'informationSheets' : kind === 'activity' ? 'activitySheets' : 'assessmentUnits';
    mbState.structureProposal[key] = mbState.structureProposal[key].filter(it => it.tempId !== tempId);
    renderStructureProposal();
    renderAssignedItemsPanel();
}

// ── Icons (exact SVGs used elsewhere in the app — .mb-icon-btn is built
// around an <svg class="mb-ico"> child; plain emoji text does not size
// or color correctly inside it, which is why earlier buttons rendered
// as empty boxes). Copied verbatim from outcomes.js for visual parity.
const _MB_ICON_EDIT = '<svg class="mb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4.5 19.5h4l10-10a2.1 2.1 0 0 0-3-3l-10 10z"/><path d="M14.5 6.5l3 3"/><path d="M4.5 19.5l.6-3.4"/></svg>';
const _MB_ICON_DELETE = '<svg class="mb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 7h16"/><path d="M9.5 7V5.6A1.6 1.6 0 0 1 11.1 4h1.8a1.6 1.6 0 0 1 1.6 1.6V7"/><path d="M6.6 7l.75 11.6A1.7 1.7 0 0 0 9.05 20.2h5.9a1.7 1.7 0 0 0 1.7-1.6L17.4 7"/><path d="M10.3 11v5.4M13.7 11v5.4"/></svg>';

const MB_TA_FIELD_LABELS = {
    requiredKnowledge: 'Required Knowledge', requiredSkills: 'Required Skills',
    performanceSteps: 'Performance Steps', toolsEquipmentMaterials: 'Tools, Equipment & Materials',
    safetyOSH: 'Safety / OSH', conditionsWorkEnvironment: 'Conditions / Work Environment',
    decisionsCriticalPoints: 'Decisions / Critical Points', performanceCriteria: 'Performance Criteria (task-level)',
    performanceStandard: 'Performance Standard', commonErrorsTroubleshooting: 'Common Errors / Troubleshooting'
};

function _mbCurrentModule() {
    return mbState.modulesData.find(m => m.id === mbState.currentModuleId);
}

/** "TASK A1" — resolved from the module's own taskAnalysisSource, same
 *  source renderModuleTaskAnalysisPanel() reads, so this always matches
 *  what the reference panel above it already shows. Falls back to the
 *  raw id only for a task DACUM never sent Task Analysis for. */
function _mbTaskLabel(taskId) {
    if (!taskId) return '';
    const module = _mbCurrentModule();
    const ta = module && module.taskAnalysisSource && module.taskAnalysisSource.taskAnalysis[taskId];
    return (ta && ta.taskCode) || String(taskId);
}

function _mbFieldLabel(field) {
    return MB_TA_FIELD_LABELS[field] || field;
}

/** Every Learning Outcome/Performance Criterion that already traces back
 *  to this task, straight from the DACUM import — this is what lets a
 *  proposal item inherit its LO/PC automatically instead of asking the
 *  user to re-pick relationships DACUM already established. */
function _mbLoPcForTask(module, taskId) {
    const loIds = new Set(); const pcIds = new Set();
    (module.learningOutcomes || []).forEach(lo => {
        (lo.performanceCriteria || []).forEach(pc => {
            if (pc.taskId === taskId) { loIds.add(lo.id); pcIds.add(pc.id); }
        });
    });
    return { loIds: [...loIds], pcIds: [...pcIds] };
}

/** Inherited links for a whole proposal item — the union of every
 *  source task's own LO/PC, recomputed fresh from sourceSelections every
 *  time. This is why learningOutcomeIds/performanceCriteriaIds are
 *  overwritten on every save rather than left as independently editable
 *  fields: a stored value could drift from the selections it is
 *  supposed to describe, and inherited relationships are exactly the
 *  thing this feature must never require the user to maintain by hand. */
function _mbInheritedLinksForItem(module, item) {
    const loIds = new Set(); const pcIds = new Set();
    (item.sourceSelections || []).forEach(sel => {
        const derived = _mbLoPcForTask(module, sel.taskId);
        derived.loIds.forEach(id => loIds.add(id));
        derived.pcIds.forEach(id => pcIds.add(id));
    });
    return { loIds: [...loIds], pcIds: [...pcIds] };
}

/** { selKey: {kind, tempId, title} } for every source item currently
 *  assigned to ANY proposal item — the single source of truth for
 *  "available" vs "assigned", read straight from the proposal itself
 *  (sourceSelections) rather than a second, separately-maintained list
 *  that could fall out of sync with it. */
function _mbAllAssignments() {
    const map = {};
    if (!mbState.structureProposal) return map;
    const groups = [
        ['informationSheets', 'info'], ['activitySheets', 'activity'], ['assessmentUnits', 'assessment']
    ];
    groups.forEach(([listKey, kind]) => {
        mbState.structureProposal[listKey].forEach(item => {
            (item.sourceSelections || []).forEach(sel => {
                map[_mbSelKey(sel)] = { kind, tempId: item.tempId, title: item.title || window.i18n.t('mbUntitled') };
            });
        });
    });
    return map;
}

function _mbFindProposalItem(kind, tempId) {
    if (!mbState.structureProposal) return null;
    const listKey = kind === 'info' ? 'informationSheets' : kind === 'activity' ? 'activitySheets' : 'assessmentUnits';
    return mbState.structureProposal[listKey].find(it => it.tempId === tempId) || null;
}

/** Individual, selectable items for one task's one field. Array fields
 *  (Performance Steps, Required Knowledge, …) yield one entry per item;
 *  a scalar field (Conditions/Work Environment, Performance Standard —
 *  free text, not a list) yields its whole value as a single item, per
 *  the data-type rule: "for scalar fields, treat the entire value as
 *  one source item". Never fabricates a placeholder for an empty/absent
 *  field — it simply contributes nothing to select. */
function _mbGetFieldItems(module, taskId, field) {
    const ta = module.taskAnalysisSource && module.taskAnalysisSource.taskAnalysis[taskId];
    if (!ta) return [];
    const val = ta[field];
    if (Array.isArray(val)) return val.filter(v => v && String(v).trim()).map(v => String(v).trim());
    if (val && String(val).trim()) return [String(val).trim()];
    return [];
}

// Stable reference into a specific Task Analysis item — {taskId, field,
// itemIndex} — encoded as one string so it can round-trip through a
// checkbox's value attribute. itemIndex is the item's position within
// _mbGetFieldItems(module, taskId, field) for that field, NOT a
// database id: Task Analysis has none, and per section 11 this is
// exactly the kind of stable-enough internal reference to create
// without touching the original Task Analysis data.
function _mbSelKey(sel) { return `${sel.taskId}|||${sel.field}|||${sel.itemIndex}`; }
function _mbParseSelKey(key) {
    const parts = key.split('|||');
    return { taskId: parts[0], field: parts[1], itemIndex: parseInt(parts[2], 10) };
}

/** Renders the full "browse Task Analysis, check individual items"
 *  control — grouped by task, then by field, one checkbox per item.
 *  Shared by the standalone source browser (pick items, THEN create a
 *  sheet from them) and the item editor (refine an existing item's
 *  selections) so the two never drift into different interactions. */
/** Renders the "browse Task Analysis, check individual items" control —
 *  grouped by task, then by field, one checkbox per item.
 *
 *  excludeKeys hides an item entirely rather than just disabling it:
 *  once assigned to a proposal item it must read as GONE from the
 *  available list, not merely greyed out, so it can never be picked
 *  into a second sheet by accident. checkedKeys pre-checks items that
 *  belong to the item currently being edited (excludeKeys and
 *  checkedKeys are always disjoint in practice — the editor excludes
 *  everything assigned to OTHER items and only ever checks this item's
 *  own selections). Shared by the standalone browser (excludeKeys = all
 *  assignments) and the item editor (excludeKeys = assignments minus
 *  this item's own) so the two never drift into different behaviour. */
function _mbBuildSourceChecklistHtml(module, checkedKeys, namePrefix, excludeKeys) {
    excludeKeys = excludeKeys || [];
    const taskIds = (module.taskAnalysisSource && module.taskAnalysisSource.sourceTaskIds) || [];
    const blocks = taskIds.map(taskId => {
        const fieldsHtml = Object.keys(MB_TA_FIELD_LABELS).map(field => {
            const items = _mbGetFieldItems(module, taskId, field);
            if (!items.length) return '';
            const rows = items.map((text, idx) => {
                const key = _mbSelKey({ taskId, field, itemIndex: idx });
                if (excludeKeys.includes(key)) return '';
                const checked = checkedKeys.includes(key);
                return `
                    <label style="display:flex;align-items:flex-start;gap:8px;padding:3px 2px;cursor:pointer;">
                        <input type="checkbox" name="${namePrefix}" value="${escapeHtml(key)}"
                               data-item-text="${escapeHtml(text)}" ${checked ? 'checked' : ''}
                               style="margin-top:3px;flex-shrink:0;">
                        <span dir="auto" style="font-size:0.87em;color:#374151;">${escapeHtml(text)}</span>
                    </label>`;
            }).filter(Boolean).join('');
            if (!rows) return '';
            return `
                <div style="margin-bottom:10px;">
                    <div style="font-size:0.8em;font-weight:600;color:#4b5563;margin-bottom:3px;">${_mbFieldLabel(field)}</div>
                    ${rows}
                </div>`;
        }).join('');
        if (!fieldsHtml) return '';
        return `
            <div style="border:1px solid #e5e7eb;border-radius:8px;padding:10px 12px;margin-bottom:10px;background:#fff;">
                <div style="font-weight:700;color:#0ea5e9;font-size:0.88em;margin-bottom:6px;">${escapeHtml(_mbTaskLabel(taskId))}</div>
                ${fieldsHtml}
            </div>`;
    }).join('');
    return blocks || `<p style="color:#9ca3af;font-size:0.85em;font-style:italic;">${window.i18n.t('mbAllItemsAssigned')}</p>`;
}

// ── Standalone source browser: pick items, THEN create a sheet ──
// Lives outside the proposal list (see index.html #mb-source-browser)
// so its checkbox state survives a proposal re-render — checking a
// dozen items and having them cleared because an unrelated proposal
// row was deleted elsewhere would be exactly the kind of quiet data
// loss this tool needs to avoid.
function renderSourceBrowser() {
    const host = document.getElementById('mb-source-browser');
    if (!host) return;
    const module = _mbCurrentModule();
    if (!module || !module.taskAnalysisSource || !(module.taskAnalysisSource.sourceTaskIds || []).length) {
        host.innerHTML = '';
        return;
    }
    host.innerHTML = `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;margin-bottom:18px;">
            <h4 style="margin:0 0 4px;color:#374151;">${window.i18n.t('mbSourceBrowserTitle')}</h4>
            <p style="margin:0 0 10px;color:#6b7280;font-size:0.85em;">${window.i18n.t('mbSourceBrowserIntro')}</p>
            <div id="mb-source-browser-list">${_mbBuildSourceChecklistHtml(module, [], 'mbsrc', Object.keys(_mbAllAssignments()))}</div>
            <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
                <button data-act="mbCreateFromSelection" data-args='["info"]' style="background:#eef2ff;color:#4338ca;border:1px solid #c7d2fe;border-radius:6px;padding:7px 14px;font-size:0.85em;font-weight:600;cursor:pointer;">➕ ${window.i18n.t('mbCreateInfoFromSelection')}</button>
                <button data-act="mbCreateFromSelection" data-args='["activity"]' style="background:#eef2ff;color:#4338ca;border:1px solid #c7d2fe;border-radius:6px;padding:7px 14px;font-size:0.85em;font-weight:600;cursor:pointer;">➕ ${window.i18n.t('mbCreateActivityFromSelection')}</button>
                <button data-act="mbCreateFromSelection" data-args='["assessment"]' style="background:#eef2ff;color:#4338ca;border:1px solid #c7d2fe;border-radius:6px;padding:7px 14px;font-size:0.85em;font-weight:600;cursor:pointer;">➕ ${window.i18n.t('mbCreateAssessmentFromSelection')}</button>
            </div>
        </div>`;
}

/** Turns the currently-checked items in the standalone browser into one
 *  new proposal item — this is the "select several related items, group
 *  them into one sheet" interaction (spec section 14). The title is
 *  seeded from the first selected item purely as a starting point; nothing
 *  stops the user renaming it via the item editor immediately after. */
function mbCreateFromSelection(kind) {
    const list = document.getElementById('mb-source-browser-list');
    if (!list) return;
    const checked = [...list.querySelectorAll('input[name="mbsrc"]:checked')];
    if (!checked.length) { showStatus(window.i18n.t('mbSelectAtLeastOneItem'), 'error'); return; }

    const module = _mbCurrentModule();
    const sourceSelections = checked.map(cb => ({ ..._mbParseSelKey(cb.value), itemText: cb.dataset.itemText }));

    if (!mbState.structureProposal) mbStartManualMapping();
    const key = kind === 'info' ? 'informationSheets' : kind === 'activity' ? 'activitySheets' : 'assessmentUnits';
    const prefix = kind === 'info' ? 'is' : kind === 'activity' ? 'as' : 'au';

    const firstText = sourceSelections[0].itemText;
    const autoTitle = firstText.length > 60 ? firstText.slice(0, 57) + '…' : firstText;

    // Inherited automatically from whichever task(s) the checked items
    // belong to — the user never has to re-pick a Learning Outcome or
    // Performance Criterion DACUM Live Pro already established.
    const inherited = module ? _mbInheritedLinksForItem(module, { sourceSelections }) : { loIds: [], pcIds: [] };

    mbState.structureProposal[key].push({
        tempId: `${prefix}-${Date.now()}-${mbState.structureProposal[key].length}`,
        title: autoTitle, rationale: '',
        learningOutcomeIds: inherited.loIds, performanceCriteriaIds: inherited.pcIds,
        sourceSelections, mappingType: 'direct'
    });

    checked.forEach(cb => { cb.checked = false; });
    renderStructureProposal();
    renderSourceBrowser();
    renderAssignedItemsPanel();
    showStatus(window.i18n.t('mbItemCreatedFromSelection'), 'success');
}


// ── Assigned / Used Items panel ──────────────────────────────
// The other half of the available/assigned model: every source item
// currently attached to some proposal item, with a way to see where,
// unassign it back to the browser above, or move it straight to a
// different proposal item — mirroring how a Performance Criterion is
// reassigned between Learning Outcomes in DACUM Live Pro's own
// modules.js (reassignPCToLO), just applied to Task Analysis items
// instead of Performance Criteria.
function renderAssignedItemsPanel() {
    const host = document.getElementById('mb-assigned-items');
    if (!host) return;
    if (!mbState.structureProposal) { host.innerHTML = ''; return; }

    const groups = [
        ['informationSheets', 'info', 'mbProposalInfoSheets'],
        ['activitySheets', 'activity', 'mbActivityJobSheets'],
        ['assessmentUnits', 'assessment', 'mbAssessmentUnitsTitle']
    ];

    const allTargets = [];
    const rows = [];
    groups.forEach(([listKey, kind, labelKey]) => {
        mbState.structureProposal[listKey].forEach(item => {
            const title = item.title || window.i18n.t('mbUntitled');
            allTargets.push({ kind, tempId: item.tempId, title, labelKey });
            (item.sourceSelections || []).forEach(sel => {
                rows.push({ sel, kind, tempId: item.tempId, title, labelKey });
            });
        });
    });

    if (!rows.length) { host.innerHTML = ''; return; }

    const rowsHtml = rows.map((r, i) => {
        const moveOptions = allTargets
            .filter(t => !(t.kind === r.kind && t.tempId === r.tempId))
            .map(t => `<option value="${t.kind}|||${t.tempId}">${escapeHtml(window.i18n.t(t.labelKey))}: ${escapeHtml(t.title)}</option>`)
            .join('');
        return `
            <div class="mb-assigned-row" data-row-index="${i}" style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:6px 10px;background:#fff;border:1px solid #e5e7eb;border-radius:6px;margin-bottom:6px;">
                <div style="flex:1;min-width:0;">
                    <div dir="auto" style="font-size:0.87em;color:#374151;">${escapeHtml(r.sel.itemText)}</div>
                    <div style="font-size:0.76em;color:#9ca3af;">${escapeHtml(window.i18n.t(r.labelKey))}: ${escapeHtml(r.title)}</div>
                </div>
                <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">
                    <select class="mb-move-select" style="font-size:0.78em;padding:3px 6px;border:1px solid #d1d5db;border-radius:5px;">
                        <option value="">${window.i18n.t('mbMoveTo')}</option>
                        ${moveOptions}
                    </select>
                    <button type="button" class="mb-icon-btn mb-unassign-btn" title="${window.i18n.t('mbUnassign')}">↩</button>
                </div>
            </div>`;
    }).join('');

    host.innerHTML = `
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;margin-bottom:18px;">
            <h4 style="margin:0 0 4px;color:#374151;">${window.i18n.t('mbAssignedItemsTitle')}</h4>
            <p style="margin:0 0 10px;color:#6b7280;font-size:0.85em;">${window.i18n.t('mbAssignedItemsIntro')}</p>
            ${rowsHtml}
        </div>`;

    // Direct listeners rather than the generic data-act dispatcher: each
    // row needs its own row's data (which item, which selection) at the
    // moment of the event, which a static data-args attribute can't carry
    // for a value the user is choosing right then in a <select>.
    host.querySelectorAll('.mb-assigned-row').forEach((rowEl, i) => {
        const r = rows[i];
        const select = rowEl.querySelector('.mb-move-select');
        const unassignBtn = rowEl.querySelector('.mb-unassign-btn');
        select.addEventListener('change', () => {
            if (!select.value) return;
            const [toKind, toTempId] = select.value.split('|||');
            mbMoveAssignedItem(r.kind, r.tempId, r.sel, toKind, toTempId);
        });
        unassignBtn.addEventListener('click', () => mbUnassignItem(r.kind, r.tempId, r.sel));
    });
}

function _mbRemoveSelection(item, sel) {
    const key = _mbSelKey(sel);
    item.sourceSelections = (item.sourceSelections || []).filter(s => _mbSelKey(s) !== key);
}

/** Returns an item to "Available" — it disappears from the Assigned
 *  panel and reappears in the source browser above, exactly like
 *  removing a task from a DACUM cluster returns its criteria to being
 *  unclaimed rather than deleting them. */
function mbUnassignItem(kind, tempId, sel) {
    const item = _mbFindProposalItem(kind, tempId);
    if (!item) return;
    _mbRemoveSelection(item, sel);
    const module = _mbCurrentModule();
    if (module) {
        const inherited = _mbInheritedLinksForItem(module, item);
        item.learningOutcomeIds = inherited.loIds;
        item.performanceCriteriaIds = inherited.pcIds;
    }
    renderStructureProposal();
    renderSourceBrowser();
    renderAssignedItemsPanel();
}

/** Moves one item from its current proposal item to a different one —
 *  never duplicates it, and never touches Task Analysis itself. */
function mbMoveAssignedItem(fromKind, fromTempId, sel, toKind, toTempId) {
    const fromItem = _mbFindProposalItem(fromKind, fromTempId);
    const toItem = _mbFindProposalItem(toKind, toTempId);
    if (!fromItem || !toItem) return;
    _mbRemoveSelection(fromItem, sel);
    if (!(toItem.sourceSelections || []).some(s => _mbSelKey(s) === _mbSelKey(sel))) {
        toItem.sourceSelections = [...(toItem.sourceSelections || []), sel];
    }
    const module = _mbCurrentModule();
    [fromItem, toItem].forEach(it => {
        if (!module) return;
        const inherited = _mbInheritedLinksForItem(module, it);
        it.learningOutcomeIds = inherited.loIds;
        it.performanceCriteriaIds = inherited.pcIds;
    });
    renderStructureProposal();
    renderSourceBrowser();
    renderAssignedItemsPanel();
    showStatus(window.i18n.tf('mbItemMovedTo', { v0: toItem.title || window.i18n.t('mbUntitled') }), 'success');
}


// This is what makes Manual Mapping (and editing an AI suggestion)
// actually connect to Task Analysis instead of being a bare title with
// no traceability — the gap flagged after the first hands-on test.
async function _mbOpenItemEditor(kind, tempId) {
    if (!mbState.structureProposal) return;
    const item = _mbFindProposalItem(kind, tempId);
    if (!item) return;

    const module = _mbCurrentModule();
    if (!module) return;
    syncLearningOutcomesFromCurrentModule();

    const existing = document.getElementById('mbItemEditorModal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'mbItemEditorModal';
    overlay.className = 'mb-dialog-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    // Items assigned to OTHER proposal items are hidden here — moving an
    // item between sheets is a deliberate action done from the Assigned
    // Items panel (mbMoveAssignedItem), not something that can happen by
    // accident just by opening a different item's editor. This item's
    // OWN selections stay visible and checked.
    const allAssignments = _mbAllAssignments();
    const ownKeys = (item.sourceSelections || []).map(_mbSelKey);
    const excludeKeys = Object.keys(allAssignments).filter(k => !ownKeys.includes(k));

    const renderInherited = (selections) => {
        const inherited = _mbInheritedLinksForItem(module, { sourceSelections: selections || item.sourceSelections });
        const loText = inherited.loIds.length
            ? inherited.loIds.map(id => {
                const lo = (module.learningOutcomes || []).find(l => l.id === id);
                return lo ? (lo.number || lo.id) : id;
              }).join(', ')
            : window.i18n.t('mbNoneYet');
        const pcText = inherited.pcIds.length ? inherited.pcIds.join(', ') : window.i18n.t('mbNoneYet');
        return `${window.i18n.t('mbLinkLearningOutcomes')}: <strong>${escapeHtml(loText)}</strong> &nbsp;·&nbsp; ${window.i18n.t('mbLinkPerformanceCriteria')}: <strong>${escapeHtml(pcText)}</strong>`;
    };

    const box = document.createElement('div');
    box.className = 'mb-dialog';
    box.style.maxWidth = '520px';
    box.style.maxHeight = '85vh';
    box.style.overflowY = 'auto';
    box.setAttribute('dir', (window.i18n && window.i18n.isRTL && window.i18n.isRTL()) ? 'rtl' : 'ltr');
    box.innerHTML = `
        <div style="font-weight:700;color:#1f2937;margin-bottom:10px;">${window.i18n.t('mbEditLinks')}</div>
        <label style="display:block;font-size:0.82em;color:#6b7280;margin-bottom:4px;">${window.i18n.t('mbEnterTitle')}</label>
        <input type="text" id="mbItemEditorTitle" value="${escapeHtml(item.title)}" dir="auto"
               style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #d1d5db;border-radius:6px;margin-bottom:12px;font-size:0.92em;">

        <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:8px 10px;margin-bottom:14px;font-size:0.82em;color:#0c4a6e;">
            <div style="font-weight:600;margin-bottom:2px;">${window.i18n.t('mbInheritedLinksTitle')}</div>
            <div id="mbItemEditorInherited">${renderInherited()}</div>
        </div>

        <div style="font-size:0.82em;font-weight:600;color:#374151;margin-bottom:4px;">${window.i18n.t('mbLinkTaItems')}</div>
        <div id="mbItemEditorTaItems" style="margin-bottom:6px;max-height:260px;overflow-y:auto;border:1px solid #eef0f4;border-radius:8px;padding:8px;">
            ${_mbBuildSourceChecklistHtml(module, ownKeys, 'mbedititem', excludeKeys)}
        </div>

        <div class="mb-dialog-actions" style="margin-top:14px;">
            <button type="button" class="mb-dialog-btn mb-dialog-cancel" id="mbItemEditorCancel">${window.i18n.t('dlgCancel') || 'Cancel'}</button>
            <button type="button" class="mb-dialog-btn mb-dialog-ok" id="mbItemEditorSave">${window.i18n.t('dlgSave') || 'Save'}</button>
        </div>`;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    // Recompute the inherited LO/PC display live as the user (un)checks
    // items — it must never look like a stale value left over from
    // before the edit.
    box.querySelector('#mbItemEditorTaItems').addEventListener('change', () => {
        const checkedNow = [...box.querySelectorAll('input[name="mbedititem"]:checked')]
            .map(cb => ({ ..._mbParseSelKey(cb.value) }));
        const inheritedNow = document.getElementById('mbItemEditorInherited');
        if (inheritedNow) inheritedNow.innerHTML = renderInherited(checkedNow);
    });

    const close = () => { document.removeEventListener('keydown', onKey, true); overlay.remove(); };
    function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); close(); } }
    document.addEventListener('keydown', onKey, true);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    box.querySelector('#mbItemEditorCancel').addEventListener('click', close);
    box.querySelector('#mbItemEditorSave').addEventListener('click', () => {
        item.title = box.querySelector('#mbItemEditorTitle').value.trim();
        item.sourceSelections = [...box.querySelectorAll('input[name="mbedititem"]:checked')]
            .map(cb => ({ ..._mbParseSelKey(cb.value), itemText: cb.dataset.itemText }));
        const inherited = _mbInheritedLinksForItem(module, item);
        item.learningOutcomeIds = inherited.loIds;
        item.performanceCriteriaIds = inherited.pcIds;
        close();
        renderStructureProposal();
        renderAssignedItemsPanel();
        renderSourceBrowser();
    });
}

function _mbProposalSection(kind, items, titleKey, addLabelKey) {
    const rows = items.map(it => {
        const sel = it.sourceSelections || [];
        const taskLabels = [...new Set(sel.map(s => _mbTaskLabel(s.taskId)))];
        const fieldLabels = [...new Set(sel.map(s => _mbFieldLabel(s.field)))];
        const sourceParts = [
            ...it.learningOutcomeIds,
            ...it.performanceCriteriaIds,
            ...taskLabels,
            ...fieldLabels
        ].filter(Boolean).join(' | ');
        const selectedItemsList = sel.length
            ? `<div dir="auto" style="font-size:0.8em;color:#6b7280;margin-top:3px;">${sel.map(s => escapeHtml(s.itemText)).join(' • ')}</div>`
            : '';
        return `
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:10px 12px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;margin-bottom:8px;">
                <div style="flex:1;min-width:0;">
                    <div dir="auto" style="font-weight:600;color:#1f2937;">${escapeHtml(it.title || window.i18n.t('mbUntitled'))}</div>
                    ${sourceParts ? `<div style="font-size:0.8em;color:#6b7280;margin-top:3px;">${window.i18n.t('mbSources')}: ${escapeHtml(sourceParts)}</div>` : `<div style="font-size:0.8em;color:#d97706;margin-top:3px;">${window.i18n.t('mbNotLinkedYet')}</div>`}
                    ${selectedItemsList}
                    ${it.rationale ? `<div dir="auto" style="font-size:0.82em;color:#9ca3af;margin-top:3px;font-style:italic;">${escapeHtml(it.rationale)}</div>` : ''}
                </div>
                <div style="display:flex;gap:6px;flex-shrink:0;">
                    <button data-act="_mbOpenItemEditor" data-args='["${kind}","${it.tempId}"]' class="mb-icon-btn" title="${window.i18n.t('mbEditLinks')}">${_MB_ICON_EDIT}</button>
                    <button data-act="mbRemoveProposalItem" data-args='["${kind}","${it.tempId}"]' class="mb-icon-btn danger" title="${window.i18n.t('mbDelete')}">${_MB_ICON_DELETE}</button>
                </div>
            </div>`;
    }).join('');

    return `
        <div style="margin-bottom:18px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <h4 style="margin:0;color:#374151;">${window.i18n.t(titleKey)}</h4>
                <button data-act="mbAddManualProposalItem" data-args='["${kind}"]' style="background:#eef2ff;color:#4338ca;border:1px solid #c7d2fe;border-radius:6px;padding:5px 12px;font-size:0.85em;font-weight:600;cursor:pointer;">
                    ➕ ${window.i18n.t(addLabelKey)}
                </button>
            </div>
            ${rows || `<p style="color:#9ca3af;font-size:0.88em;font-style:italic;">${window.i18n.t('mbNoItemsYet')}</p>`}
        </div>`;
}

function renderStructureProposal() {
    const host = document.getElementById('mb-structure-proposal');
    if (!host) return;
    const p = mbState.structureProposal;
    if (!p) { host.innerHTML = ''; return; }

    const missing = p.missingInformation.length ? `
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:0.85em;color:#92400e;">
            <strong>${window.i18n.t('mbMissingInfoTitle')}:</strong>
            <ul style="margin:6px 0 0;padding-inline-start:20px;">
                ${p.missingInformation.map(m => `<li>${escapeHtml(m.message || m.field || '')}</li>`).join('')}
            </ul>
        </div>` : '';

    host.innerHTML = `
        ${p.analysisSummary ? `<p dir="auto" style="color:#4b5563;font-size:0.9em;margin-bottom:16px;">${escapeHtml(p.analysisSummary)}</p>` : ''}
        ${missing}
        ${_mbProposalSection('info', p.informationSheets, 'mbProposalInfoSheets', 'mbAddInfoSheetSuggestion')}
        ${_mbProposalSection('activity', p.activitySheets, 'mbActivityJobSheets', 'mbAddActivitySheetSuggestion')}
        ${_mbProposalSection('assessment', p.assessmentUnits, 'mbAssessmentUnitsTitle', 'mbAddAssessmentSuggestion')}
        <div style="text-align:center;margin-top:20px;">
            <button data-act="mbApproveAndBuild" style="background:linear-gradient(135deg,#10b981,#059669);color:white;padding:12px 28px;border:none;border-radius:8px;font-weight:700;font-size:1em;cursor:pointer;box-shadow:0 4px 12px rgba(16,185,129,0.3);">
                ✓ ${window.i18n.t('mbApproveAndBuild')}
            </button>
        </div>`;
}

// ── Approval: proposal → real sheets ─────────────────────────
//
// Reuses the exact same creation functions the manual "+ Add..."
// buttons already call (addNewInfoSheet/addNewActivitySheet), then
// sets the AI-suggested title through biPut exactly as
// saveCurrentSheetToLO() does from the form. Nothing here invents a
// parallel sheet format.
//
// Duplicate prevention: module.aiMapping.builtTempIds records which
// proposal items already became real sheets, so re-running an analysis
// and approving again does not create a second copy of the same
// suggestion. A genuinely NEW proposal (new tempIds, e.g. after editing
// and re-analyzing) still builds normally.

function _mbEnsureAiMapping(module) {
    if (!module.aiMapping) module.aiMapping = { builtTempIds: [] };
    if (!Array.isArray(module.aiMapping.builtTempIds)) module.aiMapping.builtTempIds = [];
    return module.aiMapping;
}

async function _mbBuildInfoSheet(module, item, aiMapping, touchedLOs) {
    const lo = (module.learningOutcomes || []).find(l => l.id === item.learningOutcomeIds[0]) || module.learningOutcomes[0];
    if (!lo) return;
    mbState.currentLOId = lo.id;
    await addNewInfoSheet();
    // addNewInfoSheet() already painted the new sheet's (still-empty)
    // title into the on-screen form before this line runs — that is why
    // Information Sheet titles were not appearing after approval even
    // though the underlying data was correct. Setting the title on the
    // data object here does not, by itself, repaint that already-drawn
    // form; mbApproveAndBuild() repaints it explicitly afterward using
    // touchedLOs, once every sheet's title has actually been set.
    const newIndex = lo.infoSheets.length - 1;
    const newSheet = lo.infoSheets[newIndex];
    if (newSheet && item.title) biPut(newSheet, 'title', item.title);
    if (newSheet) newSheet._aiSource = { learningOutcomeIds: item.learningOutcomeIds, performanceCriteriaIds: item.performanceCriteriaIds, sourceSelections: item.sourceSelections, mappingType: item.mappingType };
    aiMapping.builtTempIds.push(item.tempId);
    if (touchedLOs) { if (!touchedLOs[lo.id]) touchedLOs[lo.id] = {}; touchedLOs[lo.id].infoIndex = newIndex; }
}

async function _mbBuildActivitySheet(module, item, aiMapping, touchedLOs) {
    const lo = (module.learningOutcomes || []).find(l => l.id === item.learningOutcomeIds[0]) || module.learningOutcomes[0];
    if (!lo) return;
    mbState.currentLOId = lo.id;
    await addNewActivitySheet();
    const newIndex = lo.activitySheets.length - 1;
    const newSheet = lo.activitySheets[newIndex];
    if (newSheet && item.title) biPut(newSheet, 'title', item.title);
    if (newSheet) newSheet._aiSource = { learningOutcomeIds: item.learningOutcomeIds, performanceCriteriaIds: item.performanceCriteriaIds, sourceSelections: item.sourceSelections, mappingType: item.mappingType };
    aiMapping.builtTempIds.push(item.tempId);
    if (touchedLOs) { if (!touchedLOs[lo.id]) touchedLOs[lo.id] = {}; touchedLOs[lo.id].activityIndex = newIndex; }
}

/** Assessment is ONE form per Learning Outcome in this app (see
 *  assessment.js) — there is no independent "named assessment unit" to
 *  create. Approving an assessment suggestion for LO-X therefore means:
 *  make sure LO-X has a form (creating the same blank shape
 *  addNewAssessmentForm() uses, if it does not already have one), then
 *  pre-fill its criteria rows from the linked Performance Criteria —
 *  never overwriting a row the user already filled in. */
function _mbBuildAssessmentUnit(module, item, aiMapping) {
    const loId = item.learningOutcomeIds[0];
    const lo = (module.learningOutcomes || []).find(l => l.id === loId);
    if (!lo) return false; // no LO linked — see the caller's skip-count warning

    if (!mbState.assessmentFormsData[lo.id]) {
        mbState.assessmentFormsData[lo.id] = {
            rows: [], competent: false, notYetCompetent: false,
            teacherName: '', teacherSignature: '', teacherDate: '',
            learnerName: '', learnerSignature: '', learnerDate: ''
        };
    }
    const form = mbState.assessmentFormsData[lo.id];

    const criteriaTexts = item.performanceCriteriaIds
        .map(pcId => (lo.performanceCriteria || []).find(pc => pc.id === pcId))
        .filter(Boolean)
        .map(pc => pc.text)
        // Granular Task Analysis items the user selected directly for this
        // assessment (Performance Standard, Common Errors, Decisions, …) —
        // section 9 of the mapping spec asks for these to be assessable
        // too, not only PC-linked criteria.
        .concat((item.sourceSelections || []).map(s => s.itemText));

    const existingCriteria = new Set(form.rows.map(r => (r.criteria || '').trim()).filter(Boolean));
    criteriaTexts.forEach(text => {
        if (existingCriteria.has(text.trim())) return;
        form.rows.push({ criteria: text, activities: '', outcomes: '', verification: '', date: '' });
    });
    if (form.rows.length === 0) form.rows.push({ criteria: '', activities: '', outcomes: '', verification: '', date: '' });

    aiMapping.builtTempIds.push(item.tempId);
    return true;
}

async function mbApproveAndBuild() {
    const module = mbState.modulesData.find(m => m.id === mbState.currentModuleId);
    const p = mbState.structureProposal;
    if (!module || !p) return;

    const total = p.informationSheets.length + p.activitySheets.length + p.assessmentUnits.length;
    if (!total) { showStatus(window.i18n.t('mbNothingToApprove'), 'error'); return; }
    if (!await mbConfirm(window.i18n.tf('mbConfirmApprove', { v0: total }))) return;

    syncLearningOutcomesFromCurrentModule();
    const originalLOId = mbState.currentLOId;
    const aiMapping = _mbEnsureAiMapping(module);
    const already = new Set(aiMapping.builtTempIds);
    const touchedLOs = {}; // loId -> { infoIndex?, activityIndex? } of the LAST sheet built for it

    for (const item of p.informationSheets) {
        if (already.has(item.tempId)) continue;
        await _mbBuildInfoSheet(module, item, aiMapping, touchedLOs);
    }
    for (const item of p.activitySheets) {
        if (already.has(item.tempId)) continue;
        await _mbBuildActivitySheet(module, item, aiMapping, touchedLOs);
    }
    let skippedAssessments = 0;
    for (const item of p.assessmentUnits) {
        if (already.has(item.tempId)) continue;
        if (!_mbBuildAssessmentUnit(module, item, aiMapping)) skippedAssessments++;
    }

    // The loop above may have briefly switched mbState.currentLOId to
    // reuse addNewInfoSheet()/addNewActivitySheet() for other outcomes.
    // Put the selection back to what the user actually had open before
    // approval, then repaint its forms explicitly: if that LO is one
    // this approval just added a sheet to, loadCurrentLOSheets() alone
    // would reset back to sheet index 0 and could show an older sheet
    // instead of the one just titled — and even at the right index, it
    // would still show the empty title addNewInfoSheet()/
    // addNewActivitySheet() drew BEFORE biPut() set it above. Loading
    // the specific new index directly is what actually fixes the
    // Information Sheet title not appearing after approval.
    mbState.currentLOId = originalLOId;
    renderLOSelector();
    const touched = touchedLOs[originalLOId];
    const lo = module.learningOutcomes.find(l => l.id === originalLOId);
    if (lo && touched && typeof touched.infoIndex === 'number') {
        mbState.currentInfoSheetIndex = touched.infoIndex;
        loadInfoSheetAtIndex(lo, touched.infoIndex);
    }
    if (lo && touched && typeof touched.activityIndex === 'number') {
        mbState.currentActivitySheetIndex = touched.activityIndex;
        loadActivitySheetAtIndex(lo, touched.activityIndex);
    }
    if (!touched && typeof loadCurrentLOSheets === 'function') loadCurrentLOSheets();

    saveCurrentModuleLOData();
    updateLOSummary();
    renderAssessmentForms();
    mbState.structureProposal = null;
    renderStructureProposal();
    renderAssignedItemsPanel();
    if (skippedAssessments > 0) {
        showStatus(window.i18n.tf('mbSomeAssessmentsSkipped', { v0: skippedAssessments }), 'error');
    } else {
        showStatus(window.i18n.t('mbModuleBuilt'), 'success');
    }
}

// ── Mode switch (AI-assisted / Manual / Hybrid) ─────────────────
// "Hybrid" is simply: run AI-assisted, then keep editing manually —
// mbAddManualProposalItem/mbRemoveProposalItem/_mbOpenItemEditor
// already operate on whatever proposal is currently loaded, whether it
// came from the AI or from mbStartManualMapping(). No separate code
// path is needed for it.
function mbSwitchMappingMode(mode) {
    document.querySelectorAll('[data-mapping-mode]').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-mapping-mode') === mode);
    });
    const aiPanel = document.getElementById('mb-ai-mode-panel');
    if (aiPanel) aiPanel.style.display = (mode === 'ai') ? 'block' : 'none';
    if (mode === 'manual' && !mbState.structureProposal) mbStartManualMapping();
    // The item browser is useful in every mode — Hybrid explicitly means
    // inspecting/adding individual Task Analysis items on top of an AI
    // proposal, not just when Manual is selected.
    renderSourceBrowser();
    renderAssignedItemsPanel();
}

// ============================================================
// BACKEND CONTRACT — POST /api/module-mapping
// (documented here since this repository does not contain the
// backend source; add this endpoint to the existing Railway service
// following its current routing/auth conventions)
// ============================================================
//
// Request body (application/json):
// {
//   "module": { "moduleId": "...", "moduleNumber": "M1", "moduleTitle": "..." },
//   "learningOutcomes": [
//     { "id": "lo-1", "number": "LO1", "statement": "...",
//       "performanceCriteria": [ { "id": "1-1", "text": "...", "taskId": "..." } ] }
//   ],
//   "sourceTaskIds": ["duty_1_2", ...],
//   "taskAnalysis": {
//     "duty_1_2": {
//       "taskCode": "TASK B4",
//       "requiredKnowledge": [...], "requiredSkills": [...],
//       "performanceSteps": [...], "toolsEquipmentMaterials": [...],
//       "safetyOSH": [...], "conditionsWorkEnvironment": "...",
//       "decisionsCriticalPoints": [...], "performanceCriteria": [...],
//       "performanceStandard": "...", "commonErrorsTroubleshooting": [...]
//     }
//   },
//   "language": "en" | "ar" | "fr"
// }
//
// Response body (200, application/json) — see mbNormalizeProposal()
// above for exactly which fields are read and how a missing/malformed
// field degrades (never a crash, never a fabricated substitute):
// {
//   "analysisSummary": "...",
//   "informationSheets": [ { "tempId": "is-1", "title": "...", "rationale": "...",
//       "learningOutcomeIds": ["lo-1"], "performanceCriteriaIds": ["1-1"],
//       "sourceSelections": [
//         { "taskId": "duty_1_2", "field": "requiredKnowledge", "itemIndex": 0,
//           "itemText": "Principle of measurement" },
//         { "taskId": "duty_1_2", "field": "requiredKnowledge", "itemIndex": 2,
//           "itemText": "Reading the digital display" }
//       ],
//       "mappingType": "direct" | "transformation" } ],
//   "activitySheets": [ ...same shape... ],
//   "assessmentUnits": [ ...same shape (learningOutcomeIds[0] identifies
//       which LO's single assessment form the criteria are merged into;
//       sourceSelections here are typically drawn from performanceStandard /
//       commonErrorsTroubleshooting / decisionsCriticalPoints)... ],
//   "missingInformation": [ { "sourceTaskId": "...", "field": "safetyOSH",
//       "message": "No safety information was provided for this task." } ]
// }
// itemIndex is the item's position within that task+field's own list as
// sent in the request (0-based) — NOT a database id, since Task Analysis
// has none. itemText should match the request payload's text for that
// index; the client displays itemText directly and does not re-resolve
// it, so a mismatched index/text pair shows exactly what the AI said
// rather than silently substituting the "correct" source text.
//
// Error responses: 4xx/5xx with any JSON body (body is not parsed for
// errors — only the status code drives the message shown to the user;
// see the status checks in mbAnalyzeModuleStructure above). 429 → rate
// limit message; 5xx → server error message; any other non-2xx →
// generic request-failed message. The client never sees or sends an
// API key — that stays entirely on the backend, as it already does for
// DACUM Live Pro's own AI features.
