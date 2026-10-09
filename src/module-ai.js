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

    /* 3.16.0: with translations from DACUM (module.dacumI18n), DACUM's
       statement and criteria are given in the content language. */
    const _di = !!(module.dacumI18n && typeof mbDacumText === 'function');
    const _tr = (v) => (_di && typeof v === 'string') ? mbDacumText(v, contentLang()) : v;
    const learningOutcomes = (module.learningOutcomes || []).map(lo => ({
        id: lo.id,
        number: lo.number || '',
        statement: (_di && typeof lo.statement === 'string') ? _tr(lo.statement)
            : ((typeof biGetStrict === 'function' ? biGetStrict(lo.statement, contentLang()) : lo.statement) || ''),
        performanceCriteria: (lo.performanceCriteria || []).map(pc => ({
            id: pc.id || '', text: _tr(pc.text || pc.id || pc || ''), taskId: pc.taskId || null,
            /* DACUM 3.44+: the tasks a competency criterion traces to. */
            sourceTaskIds: Array.isArray(pc.sourceTaskIds) ? pc.sourceTaskIds : []
        }))
    }));

    const src = module.taskAnalysisSource || { sourceTaskIds: [], taskAnalysis: {} };

    /* 3.26.0: per outcome, the tasks it traces to with the closest first
       (closestTaskIds — a text hint, see _mbRankLoTasks), and the outcome
       chosen in the bar. Additive and optional: the server may use them
       to place each sheet under the right outcome; the user still picks
       "Goes to" on every item before approving. */
    learningOutcomes.forEach(lo => {
        const ids = (src.sourceTaskIds || []).filter(id => _mbLoTaskIds(module, lo.id).has(id));
        const rank = _mbRankLoTasks(module, lo.id, ids);
        lo.relatedTaskIds = rank.order;
        lo.closestTaskIds = [...rank.near];
    });

    const ref = _mbOccRef(module);
    return {
        module: {
            moduleId: module.id,
            moduleNumber: module.moduleNumber || '',
            moduleTitle: module.title || '',
            moduleCode: module.moduleCode || '',
            /* From DACUM Live Pro's Module Mapping (3.26+); null / '' when
               the module was built here or came from an older export. */
            level: module.level || null,
            track: module.track || ''
        },
        learningOutcomes,
        focusLearningOutcomeId: (module.learningOutcomes || []).some(l => l.id === mbState.currentLOId) ? mbState.currentLOId : null,
        sourceTaskIds: src.sourceTaskIds || [],
        taskAnalysis: src.taskAnalysis || {},
        /* DACUM 3.44+: code and statement of every source task, including
           those without Task Analysis. */
        sourceTasks: src.sourceTasks || [],
        /* Verified Occupational Reference Data, compacted to what a
           suggestion can use. Reference evidence only — see the contract
           at the end of this file. Absent when the module has none. */
        occupationalReference: ref ? {
            usage: 'reference-only: suggest sheet content/resources from it; never new learning outcomes',
            categories: ref.categories.map(c => ({
                id: c.id, kind: c.kind || 'custom', name: c.name || c.id,
                items: (c.items || []).map(i => ({ text: i.text, percentage: i.percentage, rank: i.rank }))
            }))
        } : null,
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
        mappingType: (item && (item.mappingType === 'transformation' ? 'transformation' : 'direct')),
        // 3.22.0: the outcome the user chose for this item (see _mbItemLoId).
        ...(item && item.targetLoId ? { targetLoId: str(item.targetLoId) } : {})
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
        sourceSelections: [], mappingType: 'direct',
        ...(mbState.currentLOId ? { targetLoId: mbState.currentLOId } : {})
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
/* 3.27.0: "unassign" (return to the browser). .mb-icon-btn hides any
   text (font-size: 0), so the "↩" it used to hold showed an empty box. */
const _MB_ICON_UNASSIGN = '<svg class="mb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>';
const _MB_ICON_DELETE = '<svg class="mb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 7h16"/><path d="M9.5 7V5.6A1.6 1.6 0 0 1 11.1 4h1.8a1.6 1.6 0 0 1 1.6 1.6V7"/><path d="M6.6 7l.75 11.6A1.7 1.7 0 0 0 9.05 20.2h5.9a1.7 1.7 0 0 0 1.7-1.6L17.4 7"/><path d="M10.3 11v5.4M13.7 11v5.4"/></svg>';

/* English fallbacks; the interface label comes from mb-translations.js
   (mbTaFld_<field>) since 3.11.0 — these used to show in English in
   every language. */
const MB_TA_FIELD_LABELS = {
    requiredKnowledge: 'Required Knowledge', requiredSkills: 'Required Skills',
    workerBehaviours: 'Worker Behaviours',   /* 3.19.0 — DACUM 3.92 */
    performanceSteps: 'Performance Steps', toolsEquipmentMaterials: 'Tools, Equipment & Materials',
    safetyOSH: 'Safety / OSH', conditionsWorkEnvironment: 'Conditions / Work Environment',
    decisionsCriticalPoints: 'Decisions / Critical Points', performanceCriteria: 'Performance Criteria (task-level)',
    performanceStandard: 'Performance Standard', commonErrorsTroubleshooting: 'Common Errors / Troubleshooting'
};

/* 3.11.0: the order DACUM Live Pro 3.46 shows them in — by importance. */
const MB_TA_FIELD_ORDER = [
    'performanceSteps', 'requiredKnowledge', 'requiredSkills', 'workerBehaviours',
    'performanceCriteria', 'performanceStandard',
    'toolsEquipmentMaterials', 'safetyOSH', 'decisionsCriticalPoints',
    'conditionsWorkEnvironment', 'commonErrorsTroubleshooting'
];

/* Sections the user added in DACUM (3.46+) arrive per task as
   customSections [{ title, items }]. Their field key here is
   "custom:<title>" — the title is what identifies them across transfers
   (DACUM does not send its internal ids), and it keeps working in the
   selection keys (taskId|||field|||index) like any standard field. */
const MB_TA_CUSTOM = 'custom:';

/** Fields of one task, in display order: the standard ones, then the
 *  sections the user added, as they come from DACUM. */
function _mbTaskFields(module, taskId) {
    const ta = module && module.taskAnalysisSource && module.taskAnalysisSource.taskAnalysis[taskId];
    const custom = (ta && Array.isArray(ta.customSections) ? ta.customSections : [])
        .filter(sec => sec && String(sec.title || '').trim())
        .map(sec => MB_TA_CUSTOM + String(sec.title).trim());
    return MB_TA_FIELD_ORDER.concat(custom);
}

function _mbCurrentModule() {
    return mbState.modulesData.find(m => m.id === mbState.currentModuleId);
}

/* ── Verified Occupational Reference Data ─────────────────────
   Carried on the module by modules.js when it was imported from DACUM
   Live Pro. It is offered in the source browser beside Task Analysis,
   under one pseudo-task id, so picking from it reuses the whole
   available/assigned machinery unchanged: a reference item is selected,
   assigned, moved and unassigned exactly like a Task Analysis item.

   It never creates or links a Learning Outcome on its own (a reference
   "task" has no LO/PC to inherit — _mbLoPcForTask finds none), which is
   the rule DACUM states for this data: reference evidence, not
   outcomes. Using a verified tool as a resource or a knowledge item as
   sheet content is the designer's decision, made by ticking it. */
const MB_REF_TASK = '__occref__';

function _mbOccRef(module) {
    const r = module && module.occupationalReference;
    return (r && r.available && Array.isArray(r.categories) && r.categories.length) ? r : null;
}

function _mbRefText(key) {
    const lang = (window.i18n && window.i18n.getLang) ? window.i18n.getLang() : 'en';
    const T = {
        title: { en: 'Verified occupational reference (DACUM)', fr: 'Référence professionnelle vérifiée (DACUM)', ar: 'المرجع المهني المُتحقَّق منه (DACUM)' },
        hint:  { en: 'Reference evidence ranked by the verification panel — tick items to use them as sheet content or resources.',
                 fr: 'Données de référence classées par le panel de vérification — cochez des éléments pour les utiliser comme contenu ou ressources.',
                 ar: 'أدلة مرجعية رتّبها فريق التحقق — اختر عناصر لاستخدامها محتوى أو موارد للأوراق.' }
    };
    return (T[key] && (T[key][lang] || T[key].en)) || key;
}

function _mbRefCategory(module, catId) {
    const ref = _mbOccRef(module);
    return ref ? ref.categories.find(c => String(c.id) === String(catId)) || null : null;
}

/* ── Competency criteria (3.20.0) ────────────────────────────
   A criterion written in DACUM's Competency Clusters tab — not in a
   task's Task Analysis — arrives inside the outcome it is linked to,
   with no taskId and with sourceTaskIds = every task of its
   competency. When the panel skipped Task Analysis and wrote the
   criteria at competency level (common in practice), those were the
   ONLY criteria of the module, and the source browser, which lists
   Task Analysis fields only, showed none of them.

   They are offered under one pseudo-task, like the occupational
   reference above, one group per competency. Each criterion is listed
   ONCE (not under each of its tasks), shown with its number, the
   outcome(s) it belongs to and the tasks of its competency. Picking it
   links the sheet or assessment to those outcomes and that criterion
   (see _mbInheritedLinksForItem). Nothing is written back to DACUM. */
const MB_CC_TASK = '__compcrit__';

function _mbPcText(pc) {
    let t = pc && (pc.text != null ? pc.text : pc.id);
    if (t && typeof t === 'object') {
        const lang = (typeof contentLang === 'function') ? contentLang() : 'en';
        t = (typeof biGet === 'function') ? biGet(t, lang) : (t[lang] || t.en || t.ar || '');
    } else if (typeof t === 'string' && typeof mbDacumText === 'function') {
        t = mbDacumText(t);
    }
    return String(t == null ? '' : t).trim();
}

/** The competency criteria of this module's outcomes, once each:
 *  [{ comp, pcId, text, loIds, loNumbers, taskIds }], grouped by the
 *  competency number DACUM put in the id ("3-4" → 3). */
function _mbCompCriteria(module) {
    const byId = new Map();
    (module && module.learningOutcomes || []).forEach(lo => {
        (lo.performanceCriteria || []).forEach(pc => {
            if (!pc || typeof pc !== 'object' || pc.taskId) return;
            if (!Array.isArray(pc.sourceTaskIds) || !pc.sourceTaskIds.length) return;
            const pcId = String(pc.id || '');
            const text = _mbPcText(pc);
            if (!pcId || !text) return;
            let e = byId.get(pcId);
            if (!e) {
                e = { comp: pcId.split('-')[0], pcId, text, loIds: [], loNumbers: [], taskIds: pc.sourceTaskIds.slice() };
                byId.set(pcId, e);
            }
            if (!e.loIds.includes(lo.id)) { e.loIds.push(lo.id); if (lo.number) e.loNumbers.push(lo.number); }
        });
    });
    return [...byId.values()];
}

function _mbCompGroups(module) {
    const groups = new Map();
    _mbCompCriteria(module).forEach(e => {
        if (!groups.has(e.comp)) groups.set(e.comp, []);
        groups.get(e.comp).push(e);
    });
    return groups;
}

function _mbCcText(key, vars) {
    const lang = (window.i18n && window.i18n.getLang) ? window.i18n.getLang() : 'en';
    const T = {
        title: { en: 'Performance criteria written in Competency Clusters (DACUM)',
                 fr: 'Critères de performance rédigés dans les groupes de compétences (DACUM)',
                 ar: 'معايير الأداء المكتوبة في تجمعات الكفاءات (DACUM)' },
        hint:  { en: 'These criteria were written for the whole competency, not in a task\'s Task Analysis. Tick them to use them in a sheet or an assessment; the outcome and criterion links follow.',
                 fr: 'Ces critères ont été rédigés pour toute la compétence, et non dans l\'analyse d\'une tâche. Cochez-les pour les utiliser dans une fiche ou une évaluation ; les liens au résultat et au critère suivent.',
                 ar: 'كُتبت هذه المعايير للكفاءة كاملة، لا في تحليل مهمة بعينها. اخترها لاستخدامها في ورقة أو تقييم، ويُحفظ ربطها بالمحصلة والمعيار تلقائيًا.' },
        comp:  { en: 'Competency {c}', fr: 'Compétence {c}', ar: 'الكفاءة {c}' },
        tasks: { en: 'Tasks of this competency: {t}', fr: 'Tâches de cette compétence : {t}', ar: 'مهام هذه الكفاءة: {t}' },
        near:  { en: 'closest task: {t}', fr: 'tâche la plus proche : {t}', ar: 'أقرب مهمة: {t}' }
    };
    let out = (T[key] && (T[key][lang] || T[key].en)) || key;
    Object.keys(vars || {}).forEach(k => { out = out.split('{' + k + '}').join(vars[k]); });
    return out;
}

/* A hint only — never a link. The task whose statement shares the most
   words with the criterion, shown when it clearly stands out (≥ 2 words
   and more than any other task). The criterion still traces to every
   task of its competency, as in DACUM. */
function _mbClosestTask(module, e) {
    const words = s => new Set(String(s || '').toLowerCase()
        .split(/[^\p{L}\p{N}]+/u).filter(w => w.length >= 4));
    const cw = words(e.text);
    const tasks = (module.taskAnalysisSource && module.taskAnalysisSource.sourceTasks) || [];
    let best = null, bestN = 0, second = 0;
    e.taskIds.forEach(id => {
        const t = tasks.find(x => x.id === id);
        if (!t) return;
        let n = 0; words(t.text).forEach(w => { if (cw.has(w)) n++; });
        if (n > bestN) { second = bestN; bestN = n; best = id; } else if (n > second) second = n;
    });
    return (best && bestN >= 2 && bestN > second) ? best : null;
}

/** "TASK A1" — resolved from the module's own taskAnalysisSource, same
 *  source renderModuleTaskAnalysisPanel() reads, so this always matches
 *  what the reference panel above it already shows. Falls back to the
 *  raw id only for a task DACUM never sent Task Analysis for. */
function _mbTaskLabel(taskId) {
    if (!taskId) return '';
    if (taskId === MB_REF_TASK) return _mbRefText('title');
    if (taskId === MB_CC_TASK) return _mbCcText('title');
    const module = _mbCurrentModule();
    const ta = module && module.taskAnalysisSource && module.taskAnalysisSource.taskAnalysis[taskId];
    if (ta && ta.taskCode) return ta.taskCode;
    /* DACUM 3.44+ also sends the code of source tasks that have no Task
       Analysis yet. */
    const st = module && module.taskAnalysisSource && (module.taskAnalysisSource.sourceTasks || []).find(t => t.id === taskId);
    return (st && st.code) || String(taskId);
}

function _mbFieldLabel(field) {
    if (String(field).indexOf('cc:') === 0) return _mbCcText('comp', { c: String(field).slice(3) });
    if (String(field).indexOf(MB_TA_CUSTOM) === 0) return String(field).slice(MB_TA_CUSTOM.length);
    if (MB_TA_FIELD_LABELS[field]) {
        const k = 'mbTaFld_' + field;
        const tr = window.i18n && window.i18n.t ? window.i18n.t(k) : k;
        return tr && tr !== k ? tr : MB_TA_FIELD_LABELS[field];
    }
    const cat = _mbRefCategory(_mbCurrentModule(), field);
    return (cat && cat.name) || field;
}

/** Every Learning Outcome/Performance Criterion that already traces back
 *  to this task, straight from the DACUM import — this is what lets a
 *  proposal item inherit its LO/PC automatically instead of asking the
 *  user to re-pick relationships DACUM already established. */
function _mbLoPcForTask(module, taskId) {
    const loIds = new Set(); const pcIds = new Set();
    (module.learningOutcomes || []).forEach(lo => {
        (lo.performanceCriteria || []).forEach(pc => {
            /* pc.sourceTaskIds (DACUM 3.44+): a competency criterion traces
               to every task of its competency, not to one taskId. */
            if (pc.taskId === taskId || (Array.isArray(pc.sourceTaskIds) && pc.sourceTaskIds.includes(taskId))) {
                loIds.add(lo.id); pcIds.add(pc.id);
            }
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
        /* 3.20.0: a competency criterion links its own outcome(s) and itself. */
        if (sel.taskId === MB_CC_TASK) {
            const e = (_mbCompGroups(module).get(String(sel.field).slice(3)) || [])[sel.itemIndex];
            if (e) { e.loIds.forEach(id => loIds.add(id)); pcIds.add(e.pcId); }
            return;
        }
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
    if (taskId === MB_CC_TASK) {
        return (_mbCompGroups(module).get(String(field).slice(3)) || []).map(e => e.text);
    }
    if (taskId === MB_REF_TASK) {
        const cat = _mbRefCategory(module, field);
        return cat ? (cat.items || []).map(i => String((i && i.text) || '').trim()).filter(Boolean) : [];
    }
    const ta = module.taskAnalysisSource && module.taskAnalysisSource.taskAnalysis[taskId];
    if (!ta) return [];
    if (String(field).indexOf(MB_TA_CUSTOM) === 0) {
        const title = String(field).slice(MB_TA_CUSTOM.length);
        const sec = (Array.isArray(ta.customSections) ? ta.customSections : [])
            .find(x => x && String(x.title || '').trim() === title);
        return sec ? (sec.items || []).map(v => String(v == null ? '' : v).trim()).filter(Boolean) : [];
    }
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
function _mbBuildSourceChecklistHtml(module, checkedKeys, namePrefix, excludeKeys, onlyLo) {
    excludeKeys = excludeKeys || [];
    let taskIds = (module.taskAnalysisSource && module.taskAnalysisSource.sourceTaskIds) || [];
    /* 3.23.0: the standalone browser can show only the tasks of one outcome. */
    if (onlyLo) { const keep = _mbLoTaskIds(module, onlyLo); taskIds = taskIds.filter(id => keep.has(id)); }
    /* 3.25.0: tasks closest to the outcome first, the rest folded. */
    const rank = onlyLo ? _mbRankLoTasks(module, onlyLo, taskIds) : null;
    const block = taskId => {
        const fieldsHtml = _mbTaskFields(module, taskId).map(field => {
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
                    <div dir="auto" style="font-size:0.8em;font-weight:600;color:#4b5563;margin-bottom:3px;">${escapeHtml(_mbFieldLabel(field))}</div>
                    ${rows}
                </div>`;
        }).join('');
        if (!fieldsHtml) return '';
        const near = rank && rank.near.has(taskId)
            ? ` <span dir="auto" style="font-size:0.8em;font-weight:600;color:#0369a1;background:#e0f2fe;border-radius:999px;padding:1px 8px;">≈ ${escapeHtml(window.i18n.t('mbTaskNearLo'))}</span>` : '';
        return `
            <div style="border:1px solid ${near ? '#7dd3fc' : '#e5e7eb'};border-radius:8px;padding:10px 12px;margin-bottom:10px;background:#fff;">
                <div style="font-weight:700;color:#0ea5e9;font-size:0.88em;margin-bottom:6px;">${escapeHtml(_mbTaskLabel(taskId))}${near}</div>
                ${fieldsHtml}
            </div>`;
    };
    let blocks;
    if (rank && rank.near.size) {
        const top = rank.order.filter(id => rank.top.has(id)).map(block).join('');
        const restHtml = rank.order.filter(id => !rank.top.has(id)).map(block).filter(Boolean);
        blocks = top + (restHtml.length ? `
            <details style="margin-bottom:10px;border:1px dashed #cbd5e1;border-radius:8px;background:#f8fafc;padding:6px 10px;">
                <summary dir="auto" style="cursor:pointer;font-size:0.86em;font-weight:600;color:#475569;padding:4px 0;">${escapeHtml(window.i18n.tf('mbOtherCompTasks', { v0: restHtml.length }))}</summary>
                <div style="margin-top:8px;">${restHtml.join('')}</div>
            </details>` : '');
    } else {
        blocks = taskIds.map(block).join('');
    }
    return (blocks + _mbBuildCcChecklistHtml(module, checkedKeys, namePrefix, excludeKeys, onlyLo) +
            _mbBuildRefChecklistHtml(module, checkedKeys, namePrefix, excludeKeys)) ||
        `<p style="color:#9ca3af;font-size:0.85em;font-style:italic;">${window.i18n.t('mbAllItemsAssigned')}</p>`;
}

/* 3.20.0: competency criteria — same rows, keys and exclude/check rules
   as the blocks above; each row also says where the criterion sits. */
function _mbBuildCcChecklistHtml(module, checkedKeys, namePrefix, excludeKeys, onlyLo) {
    const groups = _mbCompGroups(module);
    if (!groups.size) return '';
    const chip = (txt, bg, fg) => `<span dir="auto" style="font-size:0.74em;background:${bg};color:${fg};border-radius:999px;padding:1px 7px;flex-shrink:0;white-space:nowrap;">${escapeHtml(txt)}</span>`;
    const comps = [...groups.entries()].map(([comp, list]) => {
        const field = 'cc:' + comp;
        const rows = list.map((e, idx) => {
            const key = _mbSelKey({ taskId: MB_CC_TASK, field, itemIndex: idx });
            if (excludeKeys.includes(key)) return '';
            if (onlyLo && !e.loIds.includes(onlyLo)) return '';
            const near = _mbClosestTask(module, e);
            return `
                <label style="display:flex;align-items:flex-start;gap:8px;padding:3px 2px;cursor:pointer;flex-wrap:wrap;">
                    <input type="checkbox" name="${namePrefix}" value="${escapeHtml(key)}"
                           data-item-text="${escapeHtml(e.text)}" ${checkedKeys.includes(key) ? 'checked' : ''}
                           style="margin-top:3px;flex-shrink:0;">
                    <span dir="ltr" style="font-size:0.8em;font-weight:700;color:#7c3aed;flex-shrink:0;">${escapeHtml(e.pcId)}</span>
                    <span dir="auto" style="font-size:0.87em;color:#374151;flex:1;min-width:180px;">${escapeHtml(e.text)}</span>
                    ${e.loNumbers.map(n => chip(n, '#ede9fe', '#5b21b6')).join('')}
                    ${near ? chip('≈ ' + _mbCcText('near', { t: _mbTaskLabel(near) }), '#e0f2fe', '#0369a1') : ''}
                </label>`;
        }).filter(Boolean).join('');
        if (!rows) return '';
        const sep = (window.i18n && window.i18n.getLang && window.i18n.getLang() === 'ar') ? '، ' : ', ';
        const taskList = [...new Set(list.flatMap(e => e.taskIds))].map(id => _mbTaskLabel(id)).join(sep);
        return `
            <div style="margin-bottom:10px;">
                <div dir="auto" style="font-size:0.8em;font-weight:700;color:#5b21b6;">${escapeHtml(_mbCcText('comp', { c: comp }))}</div>
                <div dir="auto" style="font-size:0.75em;color:#6b7280;margin-bottom:3px;">${escapeHtml(_mbCcText('tasks', { t: taskList }))}</div>
                ${rows}
            </div>`;
    }).join('');
    if (!comps) return '';
    return `
        <div style="border:1px solid #ddd6fe;border-radius:8px;padding:10px 12px;margin-bottom:10px;background:#f5f3ff;">
            <div dir="auto" style="font-weight:700;color:#5b21b6;font-size:0.88em;margin-bottom:2px;">🎯 ${escapeHtml(_mbCcText('title'))}</div>
            <div dir="auto" style="font-size:0.78em;color:#4c1d95;margin-bottom:8px;">${escapeHtml(_mbCcText('hint'))}</div>
            ${comps}
        </div>`;
}

/* Same rows, same keys and same exclude/check rules as the Task
   Analysis blocks above — only the grouping (category instead of field)
   and the verified percentage beside each item differ. */
function _mbBuildRefChecklistHtml(module, checkedKeys, namePrefix, excludeKeys) {
    const ref = _mbOccRef(module);
    if (!ref) return '';
    const cats = ref.categories.map(cat => {
        const items = _mbGetFieldItems(module, MB_REF_TASK, cat.id);
        const rows = items.map((text, idx) => {
            const key = _mbSelKey({ taskId: MB_REF_TASK, field: String(cat.id), itemIndex: idx });
            if (excludeKeys.includes(key)) return '';
            const pct = (cat.items[idx] && cat.items[idx].percentage != null) ? `${cat.items[idx].percentage}%` : '';
            return `
                <label style="display:flex;align-items:flex-start;gap:8px;padding:3px 2px;cursor:pointer;">
                    <input type="checkbox" name="${namePrefix}" value="${escapeHtml(key)}"
                           data-item-text="${escapeHtml(text)}" ${checkedKeys.includes(key) ? 'checked' : ''}
                           style="margin-top:3px;flex-shrink:0;">
                    <span dir="auto" style="font-size:0.87em;color:#374151;flex:1;">${escapeHtml(text)}</span>
                    ${pct ? `<span dir="ltr" style="font-size:0.75em;color:#0f766e;background:#ccfbf1;border-radius:999px;padding:1px 7px;flex-shrink:0;">${pct}</span>` : ''}
                </label>`;
        }).filter(Boolean).join('');
        if (!rows) return '';
        return `
            <div style="margin-bottom:10px;">
                <div style="font-size:0.8em;font-weight:600;color:#4b5563;margin-bottom:3px;">${escapeHtml(cat.name || cat.id)}</div>
                ${rows}
            </div>`;
    }).join('');
    if (!cats) return '';
    return `
        <div style="border:1px solid #99f6e4;border-radius:8px;padding:10px 12px;margin-bottom:10px;background:#f0fdfa;">
            <div style="font-weight:700;color:#0f766e;font-size:0.88em;margin-bottom:2px;">${escapeHtml(_mbRefText('title'))}</div>
            <div style="font-size:0.78em;color:#115e59;margin-bottom:8px;">${escapeHtml(_mbRefText('hint'))}</div>
            ${cats}
        </div>`;
}

/* 3.23.0: the tasks one outcome traces to — through its criteria: a
   Task Analysis criterion's own task, a competency criterion's tasks. */
function _mbLoTaskIds(module, loId) {
    const out = new Set();
    const lo = ((module && module.learningOutcomes) || []).find(l => l.id === loId);
    ((lo && lo.performanceCriteria) || []).forEach(pc => {
        if (!pc || typeof pc !== 'object') return;
        if (pc.taskId) out.add(pc.taskId);
        (Array.isArray(pc.sourceTaskIds) ? pc.sourceTaskIds : []).forEach(id => out.add(id));
    });
    return out;
}

/* 3.25.0: which of an outcome's tasks come first. A task its criteria
   name directly (a Task Analysis criterion) always does. When the
   outcome's criteria were written in Competency Clusters (they trace to
   every task of the competency), the tasks whose statement shares the
   most words with the outcome and its criteria come first, marked
   "closest"; the others are folded below, never hidden. A hint only —
   with no clear match nothing is folded. */
function _mbRankLoTasks(module, loId, taskIds) {
    const lo = ((module && module.learningOutcomes) || []).find(l => l.id === loId);
    const top = new Set(), near = new Set();
    if (!lo) return { order: taskIds, top, near };
    const pcs = (lo.performanceCriteria || []).filter(pc => pc && typeof pc === 'object');
    pcs.forEach(pc => { if (pc.taskId) top.add(pc.taskId); });
    /* Words of 3+ letters ("aid", "use" …) minus the common ones. */
    const STOP = new Set(['the', 'and', 'for', 'are', 'with', 'from', 'that', 'this', 'into', 'all', 'its', 'per', 'any',
        'according', 'procedures', 'procedure', 'requirements', 'standards', 'specifications', 'best', 'practices',
        'les', 'des', 'aux', 'pour', 'dans', 'une', 'selon', 'avec', 'sur', 'par']);
    const words = s => new Set(String(s || '').toLowerCase().split(/[^\p{L}\p{N}]+/u)
        .filter(w => w.length >= 3 && !STOP.has(w)));
    const loText = [lo.statement || '', (typeof lo.title === 'string' ? lo.title : _mbPcText({ text: lo.title }))]
        .concat(pcs.map(pc => _mbPcText(pc))).join(' ');
    const lw = words(loText);
    const tasks = (module.taskAnalysisSource && module.taskAnalysisSource.sourceTasks) || [];
    const score = {};
    taskIds.forEach(id => {
        if (top.has(id)) return;
        const t = tasks.find(x => x.id === id);
        let n = 0; words(t && t.text).forEach(w => { if (lw.has(w)) n++; });
        score[id] = n;
    });
    const best = Math.max(0, ...Object.values(score));
    if (best >= 2) Object.keys(score).forEach(id => { if (score[id] >= Math.max(2, best - 1)) { near.add(id); top.add(id); } });
    if (!near.size) return { order: taskIds, top: new Set(), near };
    const order = taskIds.slice().sort((a, b) => (top.has(b) - top.has(a)) || ((score[b] || 0) - (score[a] || 0)));
    return { order, top, near };
}

function mbToggleMapAllTasks(on) {
    mbState.mapAllTasks = !!on;
    renderSourceBrowser();
}

// ── Standalone source browser: pick items, THEN create a sheet ──
// Lives outside the proposal list (see index.html #mb-source-browser)
// so its checkbox state survives a proposal re-render — checking a
// dozen items and having them cleared because an unrelated proposal
// row was deleted elsewhere would be exactly the kind of quiet data
// loss this tool needs to avoid.
function renderSourceBrowser() {
    /* 3.10.0: the project-wide "Where is the Task Analysis?" index above
       this tab is repainted with it (ta_finder.js). */
    if (typeof mbRenderTaskAnalysisIndex === 'function') mbRenderTaskAnalysisIndex();
    const host = document.getElementById('mb-source-browser');
    if (!host) return;
    const module = _mbCurrentModule();
    const hasTasks = !!(module && module.taskAnalysisSource && (module.taskAnalysisSource.sourceTaskIds || []).length);
    if (!module || (!hasTasks && !_mbOccRef(module) && !_mbCompGroups(module).size)) {
        host.innerHTML = '';
        return;
    }
    /* 3.23.0: by default only the tasks of the outcome chosen in the bar
       (the module's tasks are already the only ones listed). A tick shows
       every task of the module. An outcome with no traced task shows all. */
    const allIds = (module.taskAnalysisSource && module.taskAnalysisSource.sourceTaskIds) || [];
    const curLo = (module.learningOutcomes || []).find(l => l.id === mbState.currentLOId);
    const loTasks = curLo ? _mbLoTaskIds(module, curLo.id) : new Set();
    const nLo = allIds.filter(id => loTasks.has(id)).length;
    const canFilter = !!(curLo && nLo);
    const onlyLo = canFilter && !mbState.mapAllTasks ? curLo.id : null;
    const loFilterHtml = canFilter ? `
            <label style="display:flex;align-items:center;gap:8px;margin:0 0 10px;padding:7px 10px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;font-size:0.86em;color:#1e3a8a;cursor:pointer;font-weight:500;">
                <input type="checkbox" data-act="mbToggleMapAllTasks" data-on="change" data-args='["$checked"]' ${mbState.mapAllTasks ? 'checked' : ''} style="margin:0;flex-shrink:0;width:auto;">
                <span dir="auto">${escapeHtml(window.i18n.tf(onlyLo ? 'mbMapOnlyLoTasks' : 'mbMapAllTasksOn', { v0: (curLo.number || loTitleText(curLo)), v1: nLo, v2: allIds.length }))}</span>
            </label>` : '';
    host.innerHTML = `
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;margin-bottom:18px;">
            <h4 style="margin:0 0 4px;color:#374151;">${window.i18n.t('mbSourceBrowserTitle')}</h4>
            <p style="margin:0 0 10px;color:#6b7280;font-size:0.85em;">${window.i18n.t('mbSourceBrowserIntro')}</p>
            ${typeof mbTaskAnalysisModuleLine === 'function' ? mbTaskAnalysisModuleLine(module) : ''}
            ${loFilterHtml}
            <div id="mb-source-browser-list">${_mbBuildSourceChecklistHtml(module, [], 'mbsrc', Object.keys(_mbAllAssignments()), onlyLo)}</div>
            <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
                <button data-act="mbCreateFromSelection" data-args='["info"]' style="background:#eef2ff;color:#4338ca;border:1px solid #c7d2fe;border-radius:6px;padding:7px 14px;font-size:0.85em;font-weight:600;cursor:pointer;">➕ ${window.i18n.t('mbCreateInfoFromSelection')}</button>
                <button data-act="mbCreateFromSelection" data-args='["activity"]' style="background:#eef2ff;color:#4338ca;border:1px solid #c7d2fe;border-radius:6px;padding:7px 14px;font-size:0.85em;font-weight:600;cursor:pointer;">➕ ${window.i18n.t('mbCreateActivityFromSelection')}</button>
                <button data-act="mbCreateFromSelection" data-args='["assessment"]' style="background:#eef2ff;color:#4338ca;border:1px solid #c7d2fe;border-radius:6px;padding:7px 14px;font-size:0.85em;font-weight:600;cursor:pointer;">➕ ${window.i18n.t('mbCreateAssessmentFromSelection')}</button>
                ${_mbAddToSelectHtml()}
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

    const firstText = _mbCleanItem(sourceSelections[0].itemText);   // 3.28.0: without the leading "1."
    const autoTitle = firstText.length > 60 ? firstText.slice(0, 57) + '…' : firstText;

    // Inherited automatically from whichever task(s) the checked items
    // belong to — the user never has to re-pick a Learning Outcome or
    // Performance Criterion DACUM Live Pro already established.
    const inherited = module ? _mbInheritedLinksForItem(module, { sourceSelections }) : { loIds: [], pcIds: [] };

    mbState.structureProposal[key].push({
        tempId: `${prefix}-${Date.now()}-${mbState.structureProposal[key].length}`,
        title: autoTitle, rationale: '',
        learningOutcomeIds: inherited.loIds, performanceCriteriaIds: inherited.pcIds,
        sourceSelections, mappingType: 'direct',
        // 3.22.0: goes to the outcome chosen in the bar above.
        ...(mbState.currentLOId ? { targetLoId: mbState.currentLOId } : {})
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
                    <button type="button" class="mb-icon-btn mb-unassign-btn" title="${window.i18n.t('mbUnassign')}" aria-label="${window.i18n.t('mbUnassign')}">${_MB_ICON_UNASSIGN}</button>
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


/* 3.28.0: the "✏️ Edit links" modal is gone. It repeated the whole
   source browser in a second place. An item is now edited on its own
   card (title in place, ✕ on each selected item, "Goes to:"), items are
   added from the browser ("➕ Add to…") and moved in Assigned / Used
   Items — one place for each action. */

/* ── Which outcome an item is built into (3.22.0) ─────────────
   Before, approval took the first outcome the item's tasks trace to,
   or silently the module's FIRST outcome when there was none — so a
   sheet could land under an outcome the user never meant. Now:
     1. the outcome the user chose for the item (the bar's outcome when
        the item was created, or the chooser on the item's row);
     2. else the first outcome DACUM links its items to (AI proposals);
     3. else the outcome open in the bar.
   Never the module's first outcome by default. */
function _mbItemLoId(module, item) {
    const los = (module && module.learningOutcomes) || [];
    const has = id => id && los.some(l => l.id === id);
    if (has(item.targetLoId)) return item.targetLoId;
    const inh = (item.learningOutcomeIds || []).find(has);
    if (inh) return inh;
    return has(mbState.currentLOId) ? mbState.currentLOId : '';
}

function mbSetItemLo(kind, tempId, loId) {
    const it = _mbFindProposalItem(kind, tempId);
    if (!it) return;
    if (loId) it.targetLoId = loId; else delete it.targetLoId;
    renderStructureProposal();
}

function _mbItemLoChooser(kind, it) {
    const module = _mbCurrentModule();
    const los = (module && module.learningOutcomes) || [];
    if (!los.length) return '';
    const cur = _mbItemLoId(module, it);
    const linked = new Set(it.learningOutcomeIds || []);
    const opts = los.map(lo => `<option value="${escapeHtml(lo.id)}" ${lo.id === cur ? 'selected' : ''}>${escapeHtml(typeof loTitleText === 'function' ? loTitleText(lo) : (lo.number || lo.id))}${linked.has(lo.id) ? ' ✓' : ''}</option>`).join('');
    const warn = cur && linked.size && !linked.has(cur)
        ? `<div dir="auto" style="font-size:0.78em;color:#b45309;margin-top:3px;">⚠ ${escapeHtml(window.i18n.t('mbItemLoNotLinked'))}</div>` : '';
    return `
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:6px;">
            <span style="font-size:0.8em;font-weight:600;color:#0369a1;">📚 ${escapeHtml(window.i18n.t('mbItemGoesToLo'))}</span>
            <select data-act="mbSetItemLo" data-on="change" data-args='["${kind}","${it.tempId}","$value"]'
                    style="padding:3px 6px;border:1px solid #bae6fd;border-radius:6px;font-size:0.82em;max-width:100%;min-width:0;">
                ${cur ? '' : `<option value="" selected>${escapeHtml(window.i18n.t('mbSelectLearningOutcome'))}</option>`}
                ${opts}
            </select>
        </div>${warn}`;
}

function mbSetItemTitle(kind, tempId, value) {
    const it = _mbFindProposalItem(kind, tempId);
    if (!it) return;
    it.title = String(value || '').trim();
    renderAssignedItemsPanel();
}

function mbUnassignSel(kind, tempId, key) {
    const it = _mbFindProposalItem(kind, tempId);
    const sel = it && (it.sourceSelections || []).find(s => _mbSelKey(s) === key);
    if (sel) mbUnassignItem(kind, tempId, sel);
}

/* 3.28.0: "➕ Add to…" in the browser — the ticked items join an
   existing sheet / assessment of the proposal. */
function mbAddSelectionTo(value) {
    if (!value) return;
    const [kind, tempId] = String(value).split('|||');
    const it = _mbFindProposalItem(kind, tempId);
    const list = document.getElementById('mb-source-browser-list');
    if (!it || !list) return;
    const checked = [...list.querySelectorAll('input[name="mbsrc"]:checked')];
    if (!checked.length) { showStatus(window.i18n.t('mbSelectAtLeastOneItem'), 'error'); renderSourceBrowser(); return; }
    const have = new Set((it.sourceSelections || []).map(_mbSelKey));
    checked.forEach(cb => {
        const sel = { ..._mbParseSelKey(cb.value), itemText: cb.dataset.itemText };
        if (!have.has(_mbSelKey(sel))) { it.sourceSelections = [...(it.sourceSelections || []), sel]; have.add(_mbSelKey(sel)); }
    });
    const module = _mbCurrentModule();
    if (module) {
        const inh = _mbInheritedLinksForItem(module, it);
        it.learningOutcomeIds = inh.loIds; it.performanceCriteriaIds = inh.pcIds;
    }
    renderStructureProposal(); renderSourceBrowser(); renderAssignedItemsPanel();
    showStatus(window.i18n.tf('mbItemMovedTo', { v0: it.title || window.i18n.t('mbUntitled') }), 'success');
}

function _mbAddToSelectHtml() {
    const p = mbState.structureProposal;
    if (!p) return '';
    const opts = [['informationSheets', 'info', 'mbProposalInfoSheets'], ['activitySheets', 'activity', 'mbActivityJobSheets'], ['assessmentUnits', 'assessment', 'mbAssessmentUnitsTitle']]
        .flatMap(([k, kind, label]) => p[k].map(it => `<option value="${kind}|||${escapeHtml(it.tempId)}">${escapeHtml(window.i18n.t(label))}: ${escapeHtml(it.title || window.i18n.t('mbUntitled'))}</option>`));
    if (!opts.length) return '';
    return `<select data-act="mbAddSelectionTo" data-on="change" data-args='["$value"]' style="font-size:0.85em;padding:6px 8px;border:1px solid #c7d2fe;border-radius:6px;background:#eef2ff;color:#4338ca;font-weight:600;width:auto;">
                <option value="">➕ ${escapeHtml(window.i18n.t('mbAddToExisting'))}</option>${opts.join('')}</select>`;
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
        /* 3.28.0: each selected item on the card, with ✕ to return it. */
        const selectedItemsList = sel.length
            ? `<div class="mb-sel-chips">${sel.map(s => `<span class="mb-sel-chip"><span dir="auto">${escapeHtml(s.itemText)}</span><button type="button" data-act="mbUnassignSel" data-args='${escapeHtml(JSON.stringify([kind, it.tempId, _mbSelKey(s)]))}' title="${escapeHtml(window.i18n.t('mbUnassign'))}" aria-label="${escapeHtml(window.i18n.t('mbUnassign'))}">✕</button></span>`).join('')}</div>`
            : `<div style="font-size:0.8em;color:#6b7280;margin-top:4px;">${escapeHtml(window.i18n.t('mbCardHowToAdd'))}</div>`;
        return `
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:10px 12px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;margin-bottom:8px;">
                <div style="flex:1;min-width:0;">
                    <input type="text" class="mb-item-title" dir="auto" value="${escapeHtml(it.title || '')}" placeholder="${escapeHtml(window.i18n.t('mbUntitled'))}"
                           title="${escapeHtml(window.i18n.t('mbEditTitleTip'))}" data-act="mbSetItemTitle" data-on="change" data-args='["${kind}","${it.tempId}","$value"]'>
                    ${sourceParts ? `<div style="font-size:0.8em;color:#6b7280;margin-top:3px;">${window.i18n.t('mbSources')}: ${escapeHtml(sourceParts)}</div>` : `<div style="font-size:0.8em;color:#d97706;margin-top:3px;">${window.i18n.t('mbNotLinkedYet')}</div>`}
                    ${selectedItemsList}
                    ${_mbItemLoChooser(kind, it)}
                    ${it.rationale ? `<div dir="auto" style="font-size:0.82em;color:#9ca3af;margin-top:3px;font-style:italic;">${escapeHtml(it.rationale)}</div>` : ''}
                </div>
                <div style="display:flex;gap:6px;flex-shrink:0;">
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
    /* 3.28.0: keep the browser's "➕ Add to…" list in step. */
    const addTo = document.querySelector('#mb-source-browser select[data-act="mbAddSelectionTo"]');
    if (addTo) addTo.outerHTML = _mbAddToSelectHtml() || '<span></span>';
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

// ── Filling a sheet from Task Analysis items (3.28.0) ─────────
// Used by Approve & Build and by the "📥 From Task Analysis" picker in
// the Information and Activity tabs. Everything lands as ordinary,
// editable rows; an item already on the sheet is not added twice.
function _mbCleanItem(t) { return String(t == null ? '' : t).replace(/^\s*\d+\s*[.)\-–]\s*/, '').trim(); }
function _mbNorm(t) { return _mbCleanItem(t).toLowerCase().replace(/[.\s]+$/, ''); }

function mbFillInfoSheet(sheet, texts) {
    if (!sheet) return 0;
    const lang = contentLang();
    if (!Array.isArray(sheet.contentSections)) sheet.contentSections = [];
    const have = new Set(sheet.contentSections.map(c => _mbNorm(biGetStrict(c.heading, lang))));
    let n = 0;
    texts.forEach(t => {
        const h = _mbCleanItem(t);
        if (!h || have.has(_mbNorm(h))) return;
        const sec = { contentId: '', marks: [], tables: [], uid: mbUid() };
        biPut(sec, 'heading', h); biPut(sec, 'text', '');
        sheet.contentSections.push(sec); have.add(_mbNorm(h)); n++;
    });
    return n;
}

/* Where an item goes on an activity / job sheet. */
function _mbActivityPlace(field, taskId) {
    if (taskId === MB_CC_TASK || field === 'performanceCriteria' || field === 'performanceStandard') return 'criteria';
    if (field === 'toolsEquipmentMaterials') return 'resources';
    return 'steps';
}

function mbFillActivitySheet(sheet, entries, pcTexts) {
    if (!sheet) return 0;
    const lang = contentLang();
    ['steps', 'resources', 'criteria'].forEach(k => { if (!Array.isArray(sheet[k])) sheet[k] = []; });
    const has = {
        steps: new Set(sheet.steps.map(x => _mbNorm(biGetStrict(x.text, lang)))),
        resources: new Set(sheet.resources.map(x => _mbNorm(biGetStrict(x.name, lang)))),
        criteria: new Set(sheet.criteria.map(x => _mbNorm(biGetStrict(x, lang))))
    };
    let n = 0;
    const add = (place, text) => {
        const t = _mbCleanItem(text);
        if (!t || has[place].has(_mbNorm(t))) return;
        has[place].add(_mbNorm(t)); n++;
        if (place === 'steps') { const o = { stepId: '', marks: [], tables: [], uid: mbUid() }; biPut(o, 'text', t); sheet.steps.push(o); }
        else if (place === 'resources') { const o = { quantity: '', uid: mbUid() }; biPut(o, 'name', t); sheet.resources.push(o); }
        else { const o = biNew(); o[lang] = t; o.uid = mbUid(); sheet.criteria.push(o); sheet.includeCriteria = true; }
    };
    entries.forEach(e => add(_mbActivityPlace(e.field, e.taskId), e.text));
    (pcTexts || []).forEach(t => add('criteria', t));
    return n;
}

/* ── "📥 From Task Analysis" in the Information / Activity tabs ──
   The items of the tasks of the outcome open in the bar (closest first,
   same rule as the browser), plus that outcome's competency criteria.
   An item already on the sheet is shown ticked-off and cannot be added
   again. Picked items join the sheet on screen. */
function mbOpenTaPicker(kind) {
    const host = document.getElementById('mb-ta-pick-' + kind);
    if (!host) return;
    if (host.innerHTML) { host.innerHTML = ''; return; }   // second click closes
    const module = _mbCurrentModule();
    const lo = module && (module.learningOutcomes || []).find(l => l.id === mbState.currentLOId);
    if (!module || !lo) { showStatus(window.i18n.t('dgPleaseSelectALearningOutcome'), 'error'); return; }
    if (typeof saveCurrentSheetToLO === 'function') saveCurrentSheetToLO();
    const lang = contentLang();
    const sheet = kind === 'info' ? (lo.infoSheets || [])[mbState.currentInfoSheetIndex] : (lo.activitySheets || [])[mbState.currentActivitySheetIndex];
    const on = new Set();
    if (sheet && kind === 'info') (sheet.contentSections || []).forEach(c => on.add(_mbNorm(biGetStrict(c.heading, lang))));
    if (sheet && kind === 'activity') {
        (sheet.steps || []).forEach(x => on.add(_mbNorm(biGetStrict(x.text, lang))));
        (sheet.resources || []).forEach(x => on.add(_mbNorm(biGetStrict(x.name, lang))));
        (sheet.criteria || []).forEach(x => on.add(_mbNorm(biGetStrict(x, lang))));
    }
    const all = (module.taskAnalysisSource && module.taskAnalysisSource.sourceTaskIds) || [];
    const loTasks = _mbLoTaskIds(module, lo.id);
    const ids = all.filter(id => loTasks.has(id));
    const rank = _mbRankLoTasks(module, lo.id, ids.length ? ids : all);
    const row = (val, text) => {
        const used = on.has(_mbNorm(text));
        return `<label class="mb-pick-row${used ? ' is-used' : ''}"><input type="checkbox" value="${escapeHtml(val)}" data-text="${escapeHtml(text)}" ${used ? 'disabled' : ''}>
                <span dir="auto">${escapeHtml(_mbCleanItem(text))}</span>${used ? `<em>${escapeHtml(window.i18n.t('mbPickOnSheet'))}</em>` : ''}</label>`;
    };
    const groups = rank.order.map(tid => {
        const fields = _mbTaskFields(module, tid).map(f => {
            const items = _mbGetFieldItems(module, tid, f);
            if (!items.length) return '';
            return `<div class="mb-pick-field">${escapeHtml(_mbFieldLabel(f))}</div>` + items.map(t => row(f + '|||' + tid, t)).join('');
        }).join('');
        if (!fields) return '';
        const near = rank.near.has(tid) ? ` <span class="mb-pick-near">≈ ${escapeHtml(window.i18n.t('mbTaskNearLo'))}</span>` : '';
        return `<details class="mb-pick-task" ${rank.near.has(tid) || rank.order.length === 1 ? 'open' : ''}><summary>${escapeHtml(_mbTaskLabel(tid))}${near}</summary>${fields}</details>`;
    }).join('');
    const cc = _mbCompCriteria(module).filter(e => e.loIds.includes(lo.id));
    const ccHtml = cc.length ? `<details class="mb-pick-task" open><summary>🎯 ${escapeHtml(_mbCcText('title'))}</summary>${cc.map(e => row('cc|||' + MB_CC_TASK, e.text)).join('')}</details>` : '';
    host.innerHTML = `
        <div class="mb-pick">
            <div class="mb-pick-head" dir="auto">📥 ${escapeHtml(window.i18n.tf('mbPickTitle', { v0: lo.number || '' }))}</div>
            ${(groups + ccHtml) || `<p class="mb-pick-empty">${escapeHtml(window.i18n.t('mbPickNothing'))}</p>`}
            <div class="mb-pick-btns">
                <button type="button" class="btn-add" data-act="mbApplyTaPicker" data-args='["${kind}"]'>➕ ${escapeHtml(window.i18n.t(kind === 'info' ? 'mbPickAddInfo' : 'mbPickAddActivity'))}</button>
                <button type="button" class="btn-add" data-act="mbOpenTaPicker" data-args='["${kind}"]' style="background:#f1f5f9;color:#475569;">${escapeHtml(window.i18n.t('mbPickClose'))}</button>
            </div>
        </div>`;
}

async function mbApplyTaPicker(kind) {
    const host = document.getElementById('mb-ta-pick-' + kind);
    if (!host) return;
    const picked = [...host.querySelectorAll('input[type=checkbox]:checked')].map(cb => {
        const [field, taskId] = cb.value.split('|||');
        return { field, taskId, text: cb.dataset.text };
    });
    if (!picked.length) { showStatus(window.i18n.t('mbSelectAtLeastOneItem'), 'error'); return; }
    const lo = mbState.learningOutcomesData.find(l => l.id === mbState.currentLOId);
    if (!lo) return;
    saveCurrentSheetToLO();
    let n = 0;
    if (kind === 'info') {
        if (!(lo.infoSheets || [])[mbState.currentInfoSheetIndex]) await addNewInfoSheet();
        n = mbFillInfoSheet(lo.infoSheets[mbState.currentInfoSheetIndex], picked.map(p => p.text));
        saveCurrentModuleLOData(); loadInfoSheetAtIndex(lo, mbState.currentInfoSheetIndex);
    } else {
        if (!(lo.activitySheets || [])[mbState.currentActivitySheetIndex]) await addNewActivitySheet();
        n = mbFillActivitySheet(lo.activitySheets[mbState.currentActivitySheetIndex], picked, []);
        saveCurrentModuleLOData(); loadActivitySheetAtIndex(lo, mbState.currentActivitySheetIndex);
    }
    host.innerHTML = '';
    showStatus(window.i18n.tf('mbPickAdded', { v0: n }), 'success');
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
    const lo = (module.learningOutcomes || []).find(l => l.id === _mbItemLoId(module, item));
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
    /* 3.28.0: the selected items become the sheet's content sections. */
    if (newSheet) {
        mbFillInfoSheet(newSheet, (item.sourceSelections || []).map(s => s.itemText));
        mbState.currentInfoSheetIndex = newIndex;
        loadInfoSheetAtIndex(lo, newIndex);   // the screen matches the data before the next save reads it
    }
    if (newSheet) newSheet._aiSource = { learningOutcomeIds: item.learningOutcomeIds, performanceCriteriaIds: item.performanceCriteriaIds, sourceSelections: item.sourceSelections, mappingType: item.mappingType };
    aiMapping.builtTempIds.push(item.tempId);
    if (touchedLOs) { if (!touchedLOs[lo.id]) touchedLOs[lo.id] = {}; touchedLOs[lo.id].infoIndex = newIndex; }
}

async function _mbBuildActivitySheet(module, item, aiMapping, touchedLOs) {
    const lo = (module.learningOutcomes || []).find(l => l.id === _mbItemLoId(module, item));
    if (!lo) return;
    mbState.currentLOId = lo.id;
    await addNewActivitySheet();
    const newIndex = lo.activitySheets.length - 1;
    const newSheet = lo.activitySheets[newIndex];
    if (newSheet && item.title) biPut(newSheet, 'title', item.title);
    /* 3.28.0: steps, resources and criteria from the selected items,
       plus the performance criteria the item is linked to. */
    if (newSheet) {
        const pcTexts = (item.performanceCriteriaIds || [])
            .map(id => (lo.performanceCriteria || []).find(pc => pc && pc.id === id)).filter(Boolean).map(_mbPcText);
        mbFillActivitySheet(newSheet, (item.sourceSelections || []).map(s => ({ field: s.field, taskId: s.taskId, text: s.itemText })), pcTexts);
        mbState.currentActivitySheetIndex = newIndex;
        loadActivitySheetAtIndex(lo, newIndex);
    }
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
    const loId = _mbItemLoId(module, item);
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
        .map(pc => _mbPcText(pc))
        // Granular Task Analysis items the user selected directly for this
        // assessment (Performance Standard, Common Errors, Decisions, …) —
        // section 9 of the mapping spec asks for these to be assessable
        // too, not only PC-linked criteria.
        .concat((item.sourceSelections || []).map(s => s.itemText));

    const existingCriteria = new Set(form.rows.map(r => (r.criteria || '').trim()).filter(Boolean));
    criteriaTexts.forEach(text => {
        text = String(text == null ? '' : (typeof text === 'object' ? _mbPcText({ text }) : text));
        if (!text.trim() || existingCriteria.has(text.trim())) return;
        /* 3.20.0: a competency criterion picked in the browser is also an
           inherited criterion of the item — one row, not two. */
        existingCriteria.add(text.trim());
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
    /* 3.22.0: an item with no outcome is never put under the first one. */
    const noLo = [...p.informationSheets, ...p.activitySheets, ...p.assessmentUnits]
        .filter(it => !_mbItemLoId(module, it)).length;
    if (noLo) { showStatus(window.i18n.tf('mbItemsWithoutLo', { v0: noLo }), 'error'); return; }
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
// mbAddManualProposalItem/mbRemoveProposalItem/mbSetItemTitle/mbUnassignSel
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
//       "requiredKnowledge": [...], "requiredSkills": [...], "workerBehaviours": [...],
//       "performanceSteps": [...], "toolsEquipmentMaterials": [...],
//       "safetyOSH": [...], "conditionsWorkEnvironment": "...",
//       "decisionsCriticalPoints": [...], "performanceCriteria": [...],
//       "performanceStandard": "...", "commonErrorsTroubleshooting": [...]
//     }
//   },
//   "language": "en" | "ar" | "fr",
//   // Added in Module Builder 3.8 — optional, additive; a backend that
//   // ignores them keeps working:
//   //   module.level  (1..N | null), module.track ("CMCN" | "")
//   //   occupationalReference: null | { usage, categories: [ { id, kind,
//   //       name, items: [ { text, percentage, rank } ] } ] }
//   //   Reference evidence ranked by DACUM's verification panel. It may
//   //   inform sheet content and resources; it must NOT produce new
//   //   learning outcomes. A suggestion may cite it in sourceSelections as
//   //   { "taskId": "__occref__", "field": <category id>, "itemIndex": n,
//   //     "itemText": "..." } — the client resolves that like any task.
//   // Added in Module Builder 3.9 — optional, additive (DACUM 3.44+):
//   //   module.moduleCode ("CMCN 1-1" | "")
//   //   performanceCriteria[].sourceTaskIds: the tasks a competency
//   //       criterion traces to (taskId stays null for those criteria)
//   //   sourceTasks: [ { id, code: "TASK B4", text, dutyTitle } ] — every
//   //       source task, including those without Task Analysis
//   // Added in Module Builder 3.26 — optional hints, additive:
//   //   learningOutcomes[].relatedTaskIds: the tasks the outcome traces
//   //       to, the closest to its statement and criteria first
//   //   learningOutcomes[].closestTaskIds: the subset that is a clear
//   //       text match (may be empty). A hint, not a link: use it to put
//   //       each suggestion under the right learningOutcomeIds[0]
//   //   focusLearningOutcomeId: the outcome open in the user's bar (or
//   //       null); suggestions for it may come first
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
