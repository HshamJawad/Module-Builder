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

    const normItem = (item, prefix, index) => ({
        tempId: str(item && item.tempId) || `${prefix}-${Date.now()}-${index}`,
        title: str(item && item.title),
        rationale: str(item && item.rationale),
        learningOutcomeIds: idArr(item && item.learningOutcomeIds),
        performanceCriteriaIds: idArr(item && item.performanceCriteriaIds),
        sourceTaskIds: idArr(item && item.sourceTaskIds),
        sourceFields: idArr(item && item.sourceFields),
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
}

function mbAddManualProposalItem(kind) {
    if (!mbState.structureProposal) mbStartManualMapping();
    const key = kind === 'info' ? 'informationSheets' : kind === 'activity' ? 'activitySheets' : 'assessmentUnits';
    const prefix = kind === 'info' ? 'is' : kind === 'activity' ? 'as' : 'au';
    mbState.structureProposal[key].push({
        tempId: `${prefix}-${Date.now()}-${mbState.structureProposal[key].length}`,
        title: '', rationale: '', learningOutcomeIds: [], performanceCriteriaIds: [],
        sourceTaskIds: [], sourceFields: [], mappingType: 'direct'
    });
    renderStructureProposal();
}

function mbRemoveProposalItem(kind, tempId) {
    if (!mbState.structureProposal) return;
    const key = kind === 'info' ? 'informationSheets' : kind === 'activity' ? 'activitySheets' : 'assessmentUnits';
    mbState.structureProposal[key] = mbState.structureProposal[key].filter(it => it.tempId !== tempId);
    renderStructureProposal();
}

// ── Icons (exact SVGs used elsewhere in the app — .mb-icon-btn is built
// around an <svg class="mb-ico"> child; plain emoji text does not size
// or color correctly inside it, which is why earlier buttons rendered
// as empty boxes). Copied verbatim from outcomes.js for visual parity.
const _MB_ICON_EDIT = '<svg class="mb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4.5 19.5h4l10-10a2.1 2.1 0 0 0-3-3l-10 10z"/><path d="M14.5 6.5l3 3"/><path d="M4.5 19.5l.6-3.4"/></svg>';
const _MB_ICON_DELETE = '<svg class="mb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 7h16"/><path d="M9.5 7V5.6A1.6 1.6 0 0 1 11.1 4h1.8a1.6 1.6 0 0 1 1.6 1.6V7"/><path d="M6.6 7l.75 11.6A1.7 1.7 0 0 0 9.05 20.2h5.9a1.7 1.7 0 0 0 1.7-1.6L17.4 7"/><path d="M10.3 11v5.4M13.7 11v5.4"/></svg>';

// ── Item editor: link a proposal item to its actual source ──────
// This is what makes Manual Mapping (and editing an AI suggestion)
// actually connect to Task Analysis instead of being a bare title with
// no traceability — the gap flagged after the first hands-on test.
async function _mbOpenItemEditor(kind, tempId) {
    if (!mbState.structureProposal) return;
    const key = kind === 'info' ? 'informationSheets' : kind === 'activity' ? 'activitySheets' : 'assessmentUnits';
    const item = mbState.structureProposal[key].find(it => it.tempId === tempId);
    if (!item) return;

    const module = _mbCurrentModule();
    if (!module) return;
    syncLearningOutcomesFromCurrentModule();
    const los = module.learningOutcomes || [];
    const taskIds = (module.taskAnalysisSource && module.taskAnalysisSource.sourceTaskIds) || [];

    // Union of Task Analysis field names that actually have content on
    // AT LEAST ONE of the module's source tasks — never offer a field
    // nothing in this module actually filled in.
    const availableFields = Object.keys(MB_TA_FIELD_LABELS).filter(field =>
        taskIds.some(tid => {
            const ta = module.taskAnalysisSource.taskAnalysis[tid];
            const val = ta && ta[field];
            return Array.isArray(val) ? val.filter(Boolean).length : !!(val && String(val).trim());
        })
    );

    const existing = document.getElementById('mbItemEditorModal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'mbItemEditorModal';
    overlay.className = 'mb-dialog-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    const checklist = (list, selected, name) => list.map(opt => `
        <label style="display:flex;align-items:flex-start;gap:8px;padding:5px 2px;cursor:pointer;">
            <input type="checkbox" name="${name}" value="${escapeHtml(opt.value)}" ${selected.includes(opt.value) ? 'checked' : ''} style="margin-top:3px;flex-shrink:0;">
            <span dir="auto" style="font-size:0.88em;color:#374151;">${escapeHtml(opt.label)}</span>
        </label>`).join('') || `<p style="color:#9ca3af;font-size:0.85em;font-style:italic;margin:2px 0;">${window.i18n.t('mbNoItemsYet')}</p>`;

    const loOptions = los.map(lo => ({ value: lo.id, label: `${lo.number || lo.id}: ${biGetStrict(lo.statement, contentLang()) || ''}` }));
    const pcOptions = [];
    los.forEach(lo => (lo.performanceCriteria || []).forEach(pc =>
        pcOptions.push({ value: pc.id, label: `${pc.id} — ${pc.text}` })));
    const taskOptions = taskIds.map(tid => ({ value: tid, label: _mbTaskLabel(tid) }));
    const fieldOptions = availableFields.map(f => ({ value: f, label: _mbFieldLabel(f) }));

    const box = document.createElement('div');
    box.className = 'mb-dialog';
    box.style.maxWidth = '480px';
    box.style.maxHeight = '85vh';
    box.style.overflowY = 'auto';
    box.setAttribute('dir', (window.i18n && window.i18n.isRTL && window.i18n.isRTL()) ? 'rtl' : 'ltr');
    box.innerHTML = `
        <div style="font-weight:700;color:#1f2937;margin-bottom:10px;">${window.i18n.t('mbEditLinks')}</div>
        <label style="display:block;font-size:0.82em;color:#6b7280;margin-bottom:4px;">${window.i18n.t('mbEnterTitle')}</label>
        <input type="text" id="mbItemEditorTitle" value="${escapeHtml(item.title)}" dir="auto"
               style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #d1d5db;border-radius:6px;margin-bottom:14px;font-size:0.92em;">

        <div style="font-size:0.82em;font-weight:600;color:#374151;margin-bottom:4px;">${window.i18n.t('mbLinkLearningOutcomes')}</div>
        <div style="margin-bottom:12px;">${checklist(loOptions, item.learningOutcomeIds, 'lo')}</div>

        <div style="font-size:0.82em;font-weight:600;color:#374151;margin-bottom:4px;">${window.i18n.t('mbLinkPerformanceCriteria')}</div>
        <div style="margin-bottom:12px;">${checklist(pcOptions, item.performanceCriteriaIds, 'pc')}</div>

        <div style="font-size:0.82em;font-weight:600;color:#374151;margin-bottom:4px;">${window.i18n.t('mbLinkSourceTasks')}</div>
        <div style="margin-bottom:12px;">${checklist(taskOptions, item.sourceTaskIds, 'task')}</div>

        <div style="font-size:0.82em;font-weight:600;color:#374151;margin-bottom:4px;">${window.i18n.t('mbLinkTaFields')}</div>
        <div style="margin-bottom:6px;">${checklist(fieldOptions, item.sourceFields, 'field')}</div>

        <div class="mb-dialog-actions" style="margin-top:14px;">
            <button type="button" class="mb-dialog-btn mb-dialog-cancel" id="mbItemEditorCancel">${window.i18n.t('dlgCancel') || 'Cancel'}</button>
            <button type="button" class="mb-dialog-btn mb-dialog-ok" id="mbItemEditorSave">${window.i18n.t('dlgSave') || 'Save'}</button>
        </div>`;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const close = () => { document.removeEventListener('keydown', onKey, true); overlay.remove(); };
    function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); close(); } }
    document.addEventListener('keydown', onKey, true);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    box.querySelector('#mbItemEditorCancel').addEventListener('click', close);
    box.querySelector('#mbItemEditorSave').addEventListener('click', () => {
        const checked = (name) => [...box.querySelectorAll(`input[name="${name}"]:checked`)].map(cb => cb.value);
        item.title = box.querySelector('#mbItemEditorTitle').value.trim();
        item.learningOutcomeIds = checked('lo');
        item.performanceCriteriaIds = checked('pc');
        item.sourceTaskIds = checked('task');
        item.sourceFields = checked('field');
        close();
        renderStructureProposal();
    });
}



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

function _mbProposalSection(kind, items, titleKey, addLabelKey) {
    const rows = items.map(it => {
        const sourceParts = [
            ...it.learningOutcomeIds,
            ...it.performanceCriteriaIds,
            ...it.sourceTaskIds.map(_mbTaskLabel),
            ...it.sourceFields.map(_mbFieldLabel)
        ].filter(Boolean).join(' | ');
        return `
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:10px 12px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;margin-bottom:8px;">
                <div style="flex:1;min-width:0;">
                    <div dir="auto" style="font-weight:600;color:#1f2937;">${escapeHtml(it.title || window.i18n.t('mbUntitled'))}</div>
                    ${sourceParts ? `<div style="font-size:0.8em;color:#6b7280;margin-top:3px;">${window.i18n.t('mbSources')}: ${escapeHtml(sourceParts)}</div>` : `<div style="font-size:0.8em;color:#d97706;margin-top:3px;">${window.i18n.t('mbNotLinkedYet')}</div>`}
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

async function _mbBuildInfoSheet(module, item, aiMapping) {
    const lo = (module.learningOutcomes || []).find(l => l.id === item.learningOutcomeIds[0]) || module.learningOutcomes[0];
    if (!lo) return;
    mbState.currentLOId = lo.id;
    await addNewInfoSheet();
    const newSheet = lo.infoSheets[lo.infoSheets.length - 1];
    if (newSheet && item.title) biPut(newSheet, 'title', item.title);
    if (newSheet) newSheet._aiSource = { learningOutcomeIds: item.learningOutcomeIds, performanceCriteriaIds: item.performanceCriteriaIds, sourceTaskIds: item.sourceTaskIds, sourceFields: item.sourceFields, mappingType: item.mappingType };
    aiMapping.builtTempIds.push(item.tempId);
}

async function _mbBuildActivitySheet(module, item, aiMapping) {
    const lo = (module.learningOutcomes || []).find(l => l.id === item.learningOutcomeIds[0]) || module.learningOutcomes[0];
    if (!lo) return;
    mbState.currentLOId = lo.id;
    await addNewActivitySheet();
    const newSheet = lo.activitySheets[lo.activitySheets.length - 1];
    if (newSheet && item.title) biPut(newSheet, 'title', item.title);
    if (newSheet) newSheet._aiSource = { learningOutcomeIds: item.learningOutcomeIds, performanceCriteriaIds: item.performanceCriteriaIds, sourceTaskIds: item.sourceTaskIds, sourceFields: item.sourceFields, mappingType: item.mappingType };
    aiMapping.builtTempIds.push(item.tempId);
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
    if (!lo) return;

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
        .map(pc => pc.text);

    const existingCriteria = new Set(form.rows.map(r => (r.criteria || '').trim()).filter(Boolean));
    criteriaTexts.forEach(text => {
        if (existingCriteria.has(text.trim())) return;
        form.rows.push({ criteria: text, activities: '', outcomes: '', verification: '', date: '' });
    });
    if (form.rows.length === 0) form.rows.push({ criteria: '', activities: '', outcomes: '', verification: '', date: '' });

    aiMapping.builtTempIds.push(item.tempId);
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

    for (const item of p.informationSheets) {
        if (already.has(item.tempId)) continue;
        await _mbBuildInfoSheet(module, item, aiMapping);
    }
    for (const item of p.activitySheets) {
        if (already.has(item.tempId)) continue;
        await _mbBuildActivitySheet(module, item, aiMapping);
    }
    for (const item of p.assessmentUnits) {
        if (already.has(item.tempId)) continue;
        _mbBuildAssessmentUnit(module, item, aiMapping);
    }

    // The loop above may have briefly switched mbState.currentLOId to
    // reuse addNewInfoSheet()/addNewActivitySheet() for other outcomes,
    // each of which repaints the on-screen form for ITS OWN outcome as
    // a side effect. Put both the selection and the visible form back
    // to what the user actually had open before approval.
    mbState.currentLOId = originalLOId;
    renderLOSelector();
    if (typeof loadCurrentLOSheets === 'function') loadCurrentLOSheets();

    saveCurrentModuleLOData();
    updateLOSummary();
    renderAssessmentForms();
    mbState.structureProposal = null;
    renderStructureProposal();
    showStatus(window.i18n.t('mbModuleBuilt'), 'success');
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
//       "sourceTaskIds": ["duty_1_2"], "sourceFields": ["requiredKnowledge"],
//       "mappingType": "direct" | "transformation" } ],
//   "activitySheets": [ ...same shape... ],
//   "assessmentUnits": [ ...same shape (learningOutcomeIds[0] identifies
//       which LO's single assessment form the criteria are merged into)... ],
//   "missingInformation": [ { "sourceTaskId": "...", "field": "safetyOSH",
//       "message": "No safety information was provided for this task." } ]
// }
//
// Error responses: 4xx/5xx with any JSON body (body is not parsed for
// errors — only the status code drives the message shown to the user;
// see the status checks in mbAnalyzeModuleStructure above). 429 → rate
// limit message; 5xx → server error message; any other non-2xx →
// generic request-failed message. The client never sees or sends an
// API key — that stays entirely on the backend, as it already does for
// DACUM Live Pro's own AI features.
