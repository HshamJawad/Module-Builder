// ============================================================
// /src/coverage_view.js — Coverage and distribution settings (3.33.0)
// ------------------------------------------------------------
// COVERAGE (🗺️)
//   Read-only. For every task of the open module, each Task Analysis
//   item with three cells — Information, Activity / job, Assessment:
//     —  not meant for that kind      ○  suggested
//     ●  approved                      ✓  on a sheet / form
//   A cell opens its tab on the item's outcome, with the item marked in
//   the tab's "Suggested content" panel. Nothing is edited here: the
//   panels are where items are approved, moved and built.
//   The mapping workspace (AI proposal, source browser) stays one click
//   away at the foot.
//
// DISTRIBUTION SETTINGS (⚙️)
//   Where each Task Analysis field goes by default, for the whole
//   project (mbState.cmDefaults, saved with the shared data). Items
//   already approved keep their sheets; the others follow at once.
// ============================================================

var MB_COV_ID = 'mb-cov-overlay';
var mbCovState = { lo: '', pendingOnly: false };

function _covT(k, vars) { return vars ? window.i18n.tf(k, vars) : window.i18n.t(k); }
function _covEsc(s) { return escapeHtml(String(s == null ? '' : s)); }
function _covArgs(a) { return escapeHtml(JSON.stringify(a)); }
function _covRtl() { return !!(window.i18n && window.i18n.isRTL && window.i18n.isRTL()); }

function _covShell(id, title, inner, foot) {
    var old = document.getElementById(id);
    if (old) old.remove();
    var ov = document.createElement('div');
    ov.id = id;
    ov.className = 'mb-dialog-overlay mb-cov-overlay';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-labelledby', id + '-title');
    ov.innerHTML = '<div class="mb-cov-box" dir="' + (_covRtl() ? 'rtl' : 'ltr') + '">' +
        '<div class="mb-cov-head"><h3 id="' + id + '-title">' + title + '</h3>' +
        '<button type="button" class="mb-cov-x" data-act="mbCovClose" data-args="' + _covArgs([id]) + '" aria-label="' + _covEsc(_covT('mbCovClose')) + '">✕</button></div>' +
        '<div class="mb-cov-body">' + inner + '</div>' +
        (foot ? '<div class="mb-cov-foot">' + foot + '</div>' : '') + '</div>';
    ov.addEventListener('click', function (e) { if (e.target === ov) mbCovClose(id); });
    ov.addEventListener('keydown', function (e) { if (e.key === 'Escape') mbCovClose(id); });
    document.body.appendChild(ov);
    var x = ov.querySelector('.mb-cov-x');
    if (x) x.focus();
    return ov;
}

function mbCovClose(id) {
    var ov = document.getElementById(id || MB_COV_ID);
    if (ov) ov.remove();
}

function _covCell(r, kind) {
    if (r.dests.indexOf(kind) === -1) {
        return '<span class="mb-cov-cell is-off" title="' + _covEsc(_covT('mbCovOff', { v0: _covT('mbSpKind_' + kind) })) + '">—</span>';
    }
    var st = r.built.indexOf(kind) !== -1 ? 'built' : (r.ok.indexOf(kind) !== -1 ? 'ok' : 'new');
    var sym = { built: '✓', ok: '●', new: '○' }[st];
    var tip = _covT('mbSpKind_' + kind) + ' — ' + _covT(st === 'built' ? 'mbSpStBuilt' : st === 'ok' ? 'mbSpStOk' : 'mbSpStNew');
    return '<button type="button" class="mb-cov-cell is-' + st + '" data-act="mbCovGo" data-args="' + _covArgs([kind, r.key]) + '" title="' + _covEsc(tip) + '" aria-label="' + _covEsc(tip) + '">' + sym + '</button>';
}

function _covHtml() {
    var module = _mbCurrentModule();
    if (!module) return '<p class="mb-sp-empty">' + _covEsc(_covT('mbCovNoModule')) + '</p>';
    var rows = mbContentMapRows(module);
    if (!rows.length) return '<p class="mb-sp-empty">' + _covEsc(_covT('mbCovEmpty')) + '</p>';
    var los = _cmLos(module);
    if (mbCovState.lo && !los.some(function (l) { return l.id === mbCovState.lo; })) mbCovState.lo = '';
    var shown = rows.filter(function (r) {
        if (mbCovState.lo && r.lo !== mbCovState.lo) return false;
        if (mbCovState.pendingOnly) return !r.done;
        return true;
    });
    var tot = { built: 0, ok: 0, new: 0 };
    rows.forEach(function (r) {
        r.dests.forEach(function (k) {
            tot[r.built.indexOf(k) !== -1 ? 'built' : (r.ok.indexOf(k) !== -1 ? 'ok' : 'new')]++;
        });
    });
    var all = tot.built + tot.ok + tot.new;
    var pct = all ? Math.round(tot.built * 100 / all) : 0;
    var groups = [], gm = {};
    shown.forEach(function (r) {
        var gk = _spGroupKey(r);
        if (!gm[gk]) { gm[gk] = { head: _spGroupHead(module, r), rows: [] }; groups.push(gm[gk]); }
        gm[gk].rows.push(r);
    });
    var head = '<div class="mb-cov-row is-head" aria-hidden="true"><span></span><span>' +
        MB_CM_KINDS.map(function (k) { return MB_CM_ICON[k] + ' <span class="mb-cov-kl">' + _covEsc(_covT('mbSpKindShort_' + k)) + '</span>'; }).join('</span><span>') + '</span></div>';
    var body = groups.map(function (g) {
        var done = g.rows.filter(function (r) { return r.done; }).length;
        return '<div class="mb-cov-task"><div class="mb-cov-task-head" dir="auto"><span>' + _covEsc(g.head) + '</span>' +
            '<span class="mb-cov-task-n">' + _covEsc(_covT('mbCovTaskDone', { v0: done, v1: g.rows.length })) + '</span></div>' +
            g.rows.map(function (r) {
                var lo = los.find(function (l) { return l.id === r.lo; });
                var meta = (MB_SP_FIELD_ICON[_cmFieldGroup(r.field, r.taskId)] || '•') + ' ' +
                    (r.taskId === MB_LO_PC ? _covT('mbSpSrcLoPc') : _mbFieldLabel(r.field)) +
                    (lo ? ' · ' + _cmLoLabel(lo) : ' · ⚠ ' + _covT('mbSpNeedsLo'));
                return '<div class="mb-cov-row' + (r.dests.length ? '' : ' is-none') + '">' +
                    '<span class="mb-cov-item"><span dir="auto">' + _covEsc(_spShownText(module, r).text) + '</span>' +
                    '<small dir="auto">' + _covEsc(meta) + (r.same ? ' · ＝ ' + _covEsc(_covT('mbCmStSame', { v0: _mbTaskLabel(r.same.taskId) })) : '') +
                    (r.twice ? ' · ⚠ ' + _covEsc(_covT('mbCmStTwice', { v0: r.places.length })) : '') + '</small></span>' +
                    MB_CM_KINDS.map(function (k) { return _covCell(r, k); }).join('') + '</div>';
            }).join('') + '</div>';
    }).join('');
    var loSel = '<select class="mb-cov-lo" aria-label="' + _covEsc(_covT('mbSpLoLabel')) + '" data-act="mbCovSetLo" data-on="change" data-args="' + _covArgs(['$value']) + '">' +
        '<option value="">' + _covEsc(_covT('mbCovAllLos')) + '</option>' +
        los.map(function (l) { return '<option value="' + _covEsc(l.id) + '"' + (l.id === mbCovState.lo ? ' selected' : '') + '>' + _covEsc(_cmLoLabel(l)) + '</option>'; }).join('') + '</select>';
    return '<div class="mb-cov-sum"><div class="mb-cov-bar" role="img" aria-label="' + _covEsc(_covT('mbCovPct', { v0: pct })) + '"><span style="width:' + pct + '%"></span></div>' +
        '<span>' + _covEsc(_covT('mbCovPct', { v0: pct })) + '</span>' +
        '<span class="mb-sp-st is-built">✓ ' + tot.built + '</span><span class="mb-sp-st is-ok">● ' + tot.ok + '</span><span class="mb-sp-st is-new">○ ' + tot.new + '</span></div>' +
        '<div class="mb-cov-tools">' + loSel +
        '<label class="mb-cov-pending"><input type="checkbox" data-act="mbCovPending" data-on="change" data-args="' + _covArgs(['$checked']) + '"' + (mbCovState.pendingOnly ? ' checked' : '') + '> ' +
            _covEsc(_covT('mbCovPendingOnly')) + '</label></div>' +
        '<p class="mb-cov-legend" dir="auto">' + _covEsc(_covT('mbCovLegend')) + '</p>' +
        head + (body || '<p class="mb-sp-empty">' + _covEsc(_covT('mbSpNothingShown')) + '</p>');
}

function mbCovOpen() {
    var foot = '<button type="button" class="mb-sp-btn is-quiet" data-act="mbCovDefaults">⚙️ ' + _covEsc(_covT('mbSpDefaultsTitle')) + '</button>' +
        '<button type="button" class="mb-sp-btn is-quiet" data-act="mbCovWorkspace">🧠 ' + _covEsc(_covT('mbCovWorkspace')) + '</button>';
    _covShell(MB_COV_ID, '🗺️ ' + _covEsc(_covT('mbCovTitle')), _covHtml(), foot);
}

/** Repaint the coverage view when it is open. */
function mbCovRender() {
    var ov = document.getElementById(MB_COV_ID);
    if (!ov) return;
    var body = ov.querySelector('.mb-cov-body');
    if (body) body.innerHTML = _covHtml();
}

function mbCovSetLo(v) { mbCovState.lo = v || ''; mbCovRender(); }
function mbCovPending(on) { mbCovState.pendingOnly = !!on; mbCovRender(); }

/** A cell: its tab, on the item's outcome, the item marked in the panel. */
async function mbCovGo(kind, key) {
    var module = _mbCurrentModule();
    var r = module && mbContentMapRows(module).find(function (x) { return x.key === key; });
    mbCovClose(MB_COV_ID);
    if (!r) return;
    if (r.lo && r.lo !== mbState.currentLOId && typeof _applyLOSwitch === 'function') _applyLOSwitch(r.lo);
    if (mbSpView[kind]) {
        mbSpView[kind].open = true;
        if (mbSpView[kind].filter === 'lo' && r.lo && r.lo !== mbState.currentLOId) mbSpView[kind].filter = 'all';
    }
    await switchTab(kind);
    _spRenderKind(kind);
    var host = document.getElementById(MB_SP_HOSTS[kind]);
    var el = host && host.querySelector('[data-sp-key="' + (window.CSS && CSS.escape ? CSS.escape(key) : key) + '"]');
    if (el) {
        el.classList.add('is-flash');
        try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { /* ignore */ }
        setTimeout(function () { el.classList.remove('is-flash'); }, 2400);
    }
}

function mbCovWorkspace() {
    mbCovClose(MB_COV_ID);
    switchTab('mapping');
}

/* ── Distribution settings ─────────────────────────────────── */

function _covFieldLabel(group) {
    if (group === 'custom') return _covT('mbSpGroup_custom');
    if (group === 'cc') return _covT('mbSpGroup_cc');
    if (group === 'lopc') return _covT('mbSpSrcLoPc');
    return _mbFieldLabel(group);
}

function _covDefaultsHtml(draft) {
    var head = '<div class="mb-cov-def is-head" aria-hidden="true"><span>' + _covEsc(_covT('mbSpDefField')) + '</span>' +
        MB_CM_KINDS.map(function (k) { return '<span title="' + _covEsc(_covT('mbSpKind_' + k)) + '">' + MB_CM_ICON[k] + ' <span class="mb-cov-kl">' + _covEsc(_covT('mbSpKindShort_' + k)) + '</span></span>'; }).join('') + '</div>';
    var rows = MB_CM_DEFAULT_FIELDS.map(function (g) {
        var cur = draft[g];
        var changed = !_cmSameKinds(cur, MB_CM_DEFAULTS[g] || ['info']);
        return '<div class="mb-cov-def' + (changed ? ' is-changed' : '') + '"><span dir="auto">' + (MB_SP_FIELD_ICON[g] || '•') + ' ' + _covEsc(_covFieldLabel(g)) +
            (changed ? ' <em>' + _covEsc(_covT('mbSpDefChanged')) + '</em>' : '') + '</span>' +
            MB_CM_KINDS.map(function (k) {
                var lab = _covFieldLabel(g) + ' → ' + _covT('mbSpKind_' + k);
                return '<span><input type="checkbox" aria-label="' + _covEsc(lab) + '" data-def-group="' + g + '" data-def-kind="' + k + '"' +
                    (cur.indexOf(k) !== -1 ? ' checked' : '') + (g === 'lopc' && k !== 'assessment' ? ' disabled' : '') + '></span>';
            }).join('') + '</div>';
    }).join('');
    return '<p class="mb-cov-legend" dir="auto">' + _covEsc(_covT('mbSpDefIntro')) + '</p>' + head + rows;
}

function _covDraft() {
    var d = {};
    MB_CM_DEFAULT_FIELDS.forEach(function (g) { d[g] = mbCmDefaultKinds(g); });
    return d;
}

function mbCovDefaults() {
    mbCovClose(MB_COV_ID);
    var draft = _covDraft();
    var foot = '<button type="button" class="mb-sp-btn is-quiet" data-act="mbCovDefaultsReset">↺ ' + _covEsc(_covT('mbSpDefReset')) + '</button>' +
        '<span class="mb-sp-gap"></span>' +
        '<button type="button" class="mb-sp-btn" data-act="mbCovClose" data-args="' + _covArgs(['mb-def-overlay']) + '">' + _covEsc(_covT('mbSpCancel')) + '</button>' +
        '<button type="button" class="mb-sp-btn is-main" data-act="mbCovDefaultsSave">💾 ' + _covEsc(_covT('mbSpSave')) + '</button>';
    _covShell('mb-def-overlay', '⚙️ ' + _covEsc(_covT('mbSpDefaultsTitle')), _covDefaultsHtml(draft), foot);
}

function _covReadDraft() {
    var ov = document.getElementById('mb-def-overlay');
    var d = {};
    MB_CM_DEFAULT_FIELDS.forEach(function (g) { d[g] = []; });
    if (!ov) return null;
    ov.querySelectorAll('input[data-def-group]').forEach(function (cb) {
        if (cb.checked) d[cb.getAttribute('data-def-group')].push(cb.getAttribute('data-def-kind'));
    });
    MB_CM_DEFAULT_FIELDS.forEach(function (g) { d[g] = _cmCleanKinds(d[g]); });
    return d;
}

function mbCovDefaultsReset() {
    var ov = document.getElementById('mb-def-overlay');
    if (!ov) return;
    var d = {};
    MB_CM_DEFAULT_FIELDS.forEach(function (g) { d[g] = (MB_CM_DEFAULTS[g] || ['info']).slice(); });
    ov.querySelector('.mb-cov-body').innerHTML = _covDefaultsHtml(d);
}

function mbCovDefaultsSave() {
    var d = _covReadDraft();
    if (!d) return;
    var own = {};
    MB_CM_DEFAULT_FIELDS.forEach(function (g) {
        if (!_cmSameKinds(d[g], MB_CM_DEFAULTS[g] || ['info'])) own[g] = d[g];
    });
    mbState.cmDefaults = own;
    mbCovClose('mb-def-overlay');
    if (typeof mbSpRefresh === 'function') mbSpRefresh();
    if (typeof mbLibrarySave === 'function') mbLibrarySave();
    showStatus(_covT('mbSpDefSaved'), 'success');
}
