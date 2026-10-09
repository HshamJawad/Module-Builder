// ============================================================
// /src/ta_finder.js — "Where is the Task Analysis?" (3.10.0)
//
// DACUM Live Pro links every module to its source tasks (a competency
// criterion traces to the tasks of its competency), and sends each
// task's Task Analysis with every module that uses it. Nothing on screen
// said which module that was, so a user who had analysed the tasks of
// duty A had to open the modules one by one to find them. This file
// only READS what each module already holds
// (module.taskAnalysisSource) and shows it in three places:
//
//   • the module lists: "CMCN 1-2 — Storage 1-2 · 🔬 3"
//     (count of this module's tasks that carry Task Analysis);
//   • a folding index at the top of Training Structure Mapping: every
//     analysed task, and the modules that use it, each one a button
//     that switches to that module;
//   • one line above "Browse Task Analysis": how many of this module's
//     tasks are analysed, and which — or, when none is, where the
//     analysed tasks are.
//
// Nothing is stored. Older projects (no taskAnalysisSource) show
// nothing new.
// ============================================================

/* Task Analysis sections whose content counts — taskCode is a label. */
function _mbTaHasContent(rec) {
    if (!rec || typeof rec !== 'object') return false;
    return Object.keys(rec).some(k => {
        if (k === 'taskCode') return false;
        const v = rec[k];
        if (Array.isArray(v)) return v.some(x => String(x == null ? '' : x).trim());
        return !!String(v == null ? '' : v).trim();
    });
}

/** Ids of this module's source tasks that carry Task Analysis. */
function mbAnalysedTaskIds(module) {
    const src = module && module.taskAnalysisSource;
    if (!src || !src.taskAnalysis) return [];
    const ids = src.sourceTaskIds && src.sourceTaskIds.length ? src.sourceTaskIds : Object.keys(src.taskAnalysis);
    return ids.filter(id => _mbTaHasContent(src.taskAnalysis[id]));
}

function _mbTaskInfo(module, taskId) {
    const src = (module && module.taskAnalysisSource) || {};
    const st = (src.sourceTasks || []).find(t => t.id === taskId) || {};
    const ta = (src.taskAnalysis || {})[taskId] || {};
    /* DACUM sends the label in its interface language: "TASK B4",
       "TÂCHE B4", "المهمة ب4". The short code is the last word when it
       carries a digit; anything else ("ADDED TASK") is kept whole. */
    const label = String(ta.taskCode || st.code || taskId).trim();
    const parts = label.split(/\s+/);
    const last = parts[parts.length - 1];
    return { code: parts.length > 1 && /\d/.test(last) ? last : label, text: st.text || '' };
}

/* "A10" after "A9", letters first. */
function _mbCodeCompare(a, b) {
    const pa = /^([A-Za-z]*)\s*(\d*)/.exec(a) || [], pb = /^([A-Za-z]*)\s*(\d*)/.exec(b) || [];
    if ((pa[1] || '') !== (pb[1] || '')) return (pa[1] || '').localeCompare(pb[1] || '');
    const na = parseInt(pa[2], 10), nb = parseInt(pb[2], 10);
    if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
    return a.localeCompare(b);
}

/** Every analysed task in the project, with the modules that use it. */
function mbTaskAnalysisIndex() {
    const byTask = new Map();
    (mbState.modulesData || []).forEach(m => {
        mbAnalysedTaskIds(m).forEach(id => {
            if (!byTask.has(id)) byTask.set(id, Object.assign({ id, modules: [] }, _mbTaskInfo(m, id)));
            byTask.get(id).modules.push(m);
        });
    });
    return [...byTask.values()].sort((a, b) => _mbCodeCompare(a.code, b.code));
}

function _mbListSep() {
    const lang = (window.i18n && window.i18n.getLang) ? window.i18n.getLang() : 'en';
    return lang === 'ar' ? '، ' : ', ';
}

/** Short module reference for chips: the code, else "M1", else the title. */
function _mbModuleRef(m) {
    return m.moduleCode || m.moduleNumber || m.title || m.id;
}

const _mbEsc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function _mbModuleChip(m, current) {
    const isCur = current && m.id === current.id;
    const title = _mbEsc(typeof mbModuleLabel === 'function' ? mbModuleLabel(m) : m.title);
    return `<button type="button" class="mb-ta-chip${isCur ? ' is-current' : ''}" data-act="mbJumpToModule" data-args='${_mbEsc(JSON.stringify([m.id]))}'
                title="${title}"${isCur ? ' aria-current="true"' : ''}><bdi>${_mbEsc(_mbModuleRef(m))}</bdi></button>`;
}

/** Switches every module selector to this module (same path as choosing
 *  it in the Training Structure Mapping bar). */
function mbJumpToModule(moduleId) {
    const sel = document.getElementById('mapping-module-selector');
    if (!sel || !mbState.modulesData.some(m => m.id === moduleId)) return;
    sel.value = moduleId;
    if (typeof switchModuleFromTab === 'function') switchModuleFromTab('mapping');
}

let _mbTaIndexOpen = null;   // remembered for this page load

/* ── Tasks left out of training in DACUM (3.17.0) ─────────────────
   DACUM Live Pro 3.84+ sends, with each transfer, the tasks the panel
   left out in Task Verification → Select Tasks, with their reasons
   (module.dacumTaskSelection). The newest transfer wins: the current
   module first, else any module that has it. Display only. */
function mbDacumTaskSelection() {
    const mods = mbState.modulesData || [];
    const cur = mods.find(m => m.id === mbState.currentModuleId);
    if (cur && cur.dacumTaskSelection) return cur.dacumTaskSelection;
    const any = mods.find(m => m && m.dacumTaskSelection);
    return any ? any.dacumTaskSelection : null;
}

/** True when DACUM marked this task as left out of training. */
function mbTaskLeftOut(module, taskId) {
    const st = ((module && module.taskAnalysisSource && module.taskAnalysisSource.sourceTasks) || []).find(t => t.id === taskId);
    if (st && st.selected === false) return true;
    const ts = mbDacumTaskSelection();
    return !!(ts && (ts.excluded || []).some(x => x.taskId === taskId));
}

let _mbTselOpen = false;

function _mbTaskSelectionHtml() {
    const ts = mbDacumTaskSelection();
    if (!ts || !(ts.excluded || []).length) return '';
    return `
        <details class="mb-tsel"${_mbTselOpen ? ' open' : ''}>
            <summary>
                <span class="mb-tsel-title">🚫 ${_mbEsc(window.i18n.t('mbTselTitle'))}</span>
                <span class="mb-tsel-sum">${_mbEsc(window.i18n.tf('mbTselSummary', { v0: ts.excluded.length, v1: ts.total || '' }))}</span>
            </summary>
            <p class="mb-ta-index-hint">${_mbEsc(window.i18n.t('mbTselHint'))}</p>
            <div class="mb-ta-index-list">
                ${ts.excluded.map(x => `
                    <div class="mb-ta-row">
                        <div class="mb-ta-task"><bdi class="mb-ta-code">${_mbEsc(x.code || '')}</bdi> <span dir="auto">${_mbEsc(x.text || '')}</span></div>
                        <div class="mb-tsel-reason" dir="auto">${_mbEsc(x.reason || window.i18n.t('mbTselNoReason'))}</div>
                    </div>`).join('')}
            </div>
        </details>`;
}

function mbRenderTaskAnalysisIndex() {
    const host = document.getElementById('mb-ta-index');
    if (!host) return;
    _mbInjectTaFinderStyles();
    const rows = mbTaskAnalysisIndex();
    const tselHtml = _mbTaskSelectionHtml();
    if (!rows.length) {
        host.innerHTML = tselHtml;
        const d = host.querySelector('details.mb-tsel');
        if (d) d.addEventListener('toggle', function () { _mbTselOpen = this.open; });
        return;
    }
    const current = (mbState.modulesData || []).find(m => m.id === mbState.currentModuleId) || null;
    const moduleCount = new Set(rows.flatMap(r => r.modules.map(m => m.id))).size;
    const open = _mbTaIndexOpen === null ? false : _mbTaIndexOpen;
    host.innerHTML = `
        <details class="mb-ta-index"${open ? ' open' : ''}>
            <summary>
                <span class="mb-ta-index-title">🔬 ${_mbEsc(window.i18n.t('mbTaIndexTitle'))}</span>
                <span class="mb-ta-index-sum">${_mbEsc(window.i18n.tf('mbTaIndexSummary', { v0: rows.length, v1: moduleCount }))}</span>
            </summary>
            <p class="mb-ta-index-hint">${_mbEsc(window.i18n.t('mbTaIndexHint'))}</p>
            <div class="mb-ta-index-list">
                ${rows.map(r => `
                    <div class="mb-ta-row">
                        <div class="mb-ta-task"><bdi class="mb-ta-code">${_mbEsc(r.code)}</bdi> <span dir="auto">${_mbEsc(r.text)}</span>${
                            mbTaskLeftOut(r.modules[0], r.id) ? ` <span class="mb-tsel-badge">${_mbEsc(window.i18n.t('mbTselBadge'))}</span>` : ''}</div>
                        <div class="mb-ta-mods">${r.modules.map(m => _mbModuleChip(m, current)).join('')}</div>
                    </div>`).join('')}
            </div>
        </details>` + tselHtml;
    host.querySelector('details.mb-ta-index').addEventListener('toggle', function () { _mbTaIndexOpen = this.open; });
    const d = host.querySelector('details.mb-tsel');
    if (d) d.addEventListener('toggle', function () { _mbTselOpen = this.open; });
}

/** The line above "Browse Task Analysis" for the current module. */
function mbTaskAnalysisModuleLine(module) {
    const src = (module && module.taskAnalysisSource) || {};
    const total = (src.sourceTaskIds || []).length;
    if (!total) return '';
    const ids = mbAnalysedTaskIds(module);
    /* 3.17.0: this module's tasks that DACUM left out of training. */
    const out = (src.sourceTaskIds || []).filter(id => mbTaskLeftOut(module, id));
    const outLine = out.length ? `<p class="mb-ta-line is-left-out">🚫 ${_mbEsc(window.i18n.tf('mbTselModuleLine', { v0: out.length }))}
                <bdi>${_mbEsc(out.map(id => _mbTaskInfo(module, id).code).sort(_mbCodeCompare).join(_mbListSep()))}</bdi></p>` : '';
    /* 3.21.0: tasks of this module (selected for training) with no Task
       Analysis yet — and where to do it. Task Analysis is kept in DACUM
       Live Pro (SCID), the one place it is edited; sending the module
       again brings it here. */
    const pending = (src.sourceTaskIds || []).filter(id => !ids.includes(id) && !out.includes(id));
    const pendingLine = pending.length ? `<p class="mb-ta-line is-pending">⏳ ${_mbEsc(window.i18n.tf('mbTaNotAnalysed', { v0: pending.length }))}
                <bdi>${_mbEsc(pending.map(id => _mbTaskInfo(module, id).code).sort(_mbCodeCompare).join(_mbListSep()))}</bdi>
                <span class="mb-ta-line-how">${_mbEsc(window.i18n.t('mbTaNotAnalysedHow'))}</span></p>` : '';
    if (ids.length) {
        const codes = ids.map(id => _mbTaskInfo(module, id).code).sort(_mbCodeCompare);
        return `<p class="mb-ta-line">🔬 ${_mbEsc(window.i18n.tf('mbTaLineSome', { v0: total, v1: ids.length }))}
                <bdi>${_mbEsc(codes.join(_mbListSep()))}</bdi></p>` + pendingLine + outLine;
    }
    const elsewhere = (mbState.modulesData || []).filter(m => m.id !== module.id && mbAnalysedTaskIds(m).length);
    return `<p class="mb-ta-line is-empty">🔬 ${_mbEsc(window.i18n.tf('mbTaLineNone', { v0: total }))}
            ${elsewhere.length ? `<span class="mb-ta-line-where">${_mbEsc(window.i18n.t('mbTaLineElsewhere'))}</span> ${elsewhere.map(m => _mbModuleChip(m, null)).join('')}` : ''}</p>` + pendingLine + outLine;
}

/** " · 🔬 3" after a module name in the selectors (nothing when 0). */
function mbModuleTaSuffix(m) {
    const n = mbAnalysedTaskIds(m).length;
    return n ? ` · 🔬 ${n}` : '';
}

function _mbInjectTaFinderStyles() {
    if (document.getElementById('mb-ta-finder-styles')) return;
    const st = document.createElement('style');
    st.id = 'mb-ta-finder-styles';
    st.textContent = `
        .mb-ta-index { background:#fefce8; border:1px solid #fde68a; border-radius:10px; margin-bottom:18px; }
        .mb-ta-index > summary { cursor:pointer; padding:10px 14px; display:flex; flex-wrap:wrap; align-items:center; gap:4px 12px; list-style:none; }
        .mb-ta-index > summary::-webkit-details-marker { display:none; }
        .mb-ta-index > summary::after { content:'▾'; margin-inline-start:auto; color:#92400e; }
        .mb-ta-index[open] > summary::after { content:'▴'; }
        .mb-ta-index-title { font-weight:700; color:#92400e; }
        .mb-ta-index-sum { color:#a16207; font-size:0.88em; }
        .mb-ta-index-hint { margin:0 14px 8px; color:#78716c; font-size:0.84em; }
        .mb-ta-index-list { padding:0 14px 12px; max-height:340px; overflow-y:auto; }
        .mb-ta-row { display:flex; flex-wrap:wrap; align-items:baseline; gap:6px 12px; padding:7px 0; border-top:1px solid #fef3c7; }
        .mb-ta-task { flex:1 1 260px; min-width:0; font-size:0.9em; color:#374151; overflow-wrap:anywhere; }
        .mb-ta-code { font-weight:700; color:#0369a1; }
        .mb-ta-mods { display:flex; flex-wrap:wrap; gap:6px; }
        /* Chips follow the house style (mb-styles.css paints every button
           silver, by design); only the shape is set here. The module on
           screen is marked by a blue outline — the one override, so it
           can be told apart. */
        button.mb-ta-chip { border-radius:999px; padding:3px 10px; margin:0; font-size:0.82em; font-weight:600; line-height:1.5; cursor:pointer; white-space:nowrap; min-height:0; width:auto; }
        #mb-ta-index button.mb-ta-chip.is-current { border:2px solid #0284c7 !important; color:#075985 !important; background:#e0f2fe !important; cursor:default; }
        .mb-ta-line { margin:0 0 10px; padding:7px 10px; background:#ecfdf5; border:1px solid #a7f3d0; border-radius:8px; color:#065f46; font-size:0.86em; display:flex; flex-wrap:wrap; align-items:center; gap:6px; }
        .mb-ta-line.is-empty { background:#fff7ed; border-color:#fed7aa; color:#9a3412; }
        .mb-ta-line-where { font-weight:600; }
        .mb-ta-line.is-pending { background:#fffbeb; border-color:#fde68a; color:#92400e; }
        .mb-ta-line-how { flex-basis:100%; font-size:0.95em; color:#78350f; }
        /* 3.17.0: tasks left out of training in DACUM. */
        .mb-tsel { background:#f8fafc; border:1px dashed #cbd5e1; border-radius:10px; margin-bottom:18px; }
        .mb-tsel > summary { cursor:pointer; padding:10px 14px; display:flex; flex-wrap:wrap; align-items:center; gap:4px 12px; list-style:none; }
        .mb-tsel > summary::-webkit-details-marker { display:none; }
        .mb-tsel > summary::after { content:'▾'; margin-inline-start:auto; color:#475569; }
        .mb-tsel[open] > summary::after { content:'▴'; }
        .mb-tsel-title { font-weight:700; color:#475569; }
        .mb-tsel-sum { color:#64748b; font-size:0.88em; }
        .mb-tsel-reason { color:#92400e; font-size:0.84em; font-style:italic; }
        .mb-tsel-badge { display:inline-block; padding:1px 8px; border-radius:999px; background:#fffbeb; border:1px solid #fcd34d; color:#92400e; font-size:0.78em; font-weight:600; white-space:nowrap; }
        .mb-ta-line.is-left-out { background:#fffbeb; border-color:#fcd34d; color:#92400e; }
    `;
    document.head.appendChild(st);
}

window.addEventListener('mb:langchange', function () {
    mbRenderTaskAnalysisIndex();
    if (typeof renderSourceBrowser === 'function') renderSourceBrowser();
});
