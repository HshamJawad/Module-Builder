// ============================================================
// /src/suggest_panel.js — Suggested content (3.33.0)
// ------------------------------------------------------------
// WHY
//   The Training Structure Mapping tab used to be where every Task
//   Analysis item was given a sheet, approved, and only then built — in
//   another tab. The user went back and forth between the map and the
//   three sheet tabs. Now each sheet tab carries, at its top, the items
//   meant for it: Information sheets, Activity / job sheets, Assessment.
//
// ONE SOURCE
//   The panels are views of the content map (content_map.js,
//   mbContentMapRows). Each row lists the kinds of sheet it goes to
//   (`dests`); a panel shows the rows whose list holds its kind. Moving
//   an item, sending it to a second kind, approving it or editing it
//   writes the row once (module.contentMap), so the three tabs and the
//   coverage view can never disagree.
//
// STATE OF AN ITEM, PER KIND
//   suggested → approved (stored: row.ok) → built (read from the sheets
//   and forms, never stored). A sheet deleted later brings its items
//   back to "approved".
//
// BUILDING
//   Information / activity: one sheet per outcome and task — the task's
//   sheet in that outcome when there is one, else the outcome's empty
//   sheet, else a new one titled with the task. Assessment: the
//   outcome's form, empty rows first. What a sheet received is recorded
//   on it (_aiSource), so a reworded line is still known as built.
//   How each field is written depends on the kind (see _spEntry):
//   a decision is explained (cue, consequence) on the information sheet,
//   becomes a checkpoint in the activity and a critical row of the
//   assessment.
//
// Undo / redo: every action here is a data-act, and history.js keeps
// the content map with the module — one step per action.
// ============================================================

var MB_SP_HOSTS = { info: 'mb-sp-info', activity: 'mb-sp-activity', assessment: 'mb-sp-assessment' };
var MB_SP_FIELD_ICON = {
    performanceSteps: '👣', requiredSkills: '🛠️', requiredKnowledge: '📘', decisionsCriticalPoints: '🔀',
    basicReading: '📖', basicWriting: '✍️', basicMath: '🔢', basicScience: '🔬',
    safetyOSH: '⛑️', toolsEquipmentMaterials: '🧰', commonErrorsTroubleshooting: '⚠️',
    workerBehaviours: '🤝', performanceCriteria: '🎯', performanceStandard: '📏',
    conditionsWorkEnvironment: '🏭', custom: '📝', cc: '🧩', lopc: '🎓'
};

/* View state, per session (not saved with the project). */
var mbSpView = {
    info:       { filter: 'lo', open: true },
    activity:   { filter: 'lo', open: true },
    assessment: { filter: 'lo', open: true }
};
var _spChecked = new Set();      // kind + '\n' + row key
var _spEditing = null;           // kind + '\n' + row key

function _spT(k, vars) { return vars ? window.i18n.tf(k, vars) : window.i18n.t(k); }
/* A label written INTO the content: in the content language. */
function _spC(k) {
    var lang = (typeof contentLang === 'function') ? contentLang() : 'en';
    return (window.i18n && window.i18n.tIn) ? window.i18n.tIn(k, lang) : _spT(k);
}
function _spEsc(s) { return escapeHtml(String(s == null ? '' : s)); }
function _spArgs(arr) { return escapeHtml(JSON.stringify(arr)); }
function _spKindLabel(k) { return _spT('mbSpKind_' + k); }

function _spModule() { return (typeof _mbCurrentModule === 'function') ? _mbCurrentModule() : null; }
function _spRows(module) {
    try { return module ? mbContentMapRows(module) : []; } catch (e) { console.warn('[Suggested]', e); return []; }
}
function _spRow(module, key) { return _spRows(module).find(function (r) { return r.key === key; }) || null; }

function _spState(r, kind) {
    if (r.built.indexOf(kind) !== -1) return 'built';
    if (r.ok.indexOf(kind) !== -1) return 'ok';
    return 'new';
}

/* What the panel of `kind` lists, in the view chosen. */
function _spShown(rows, kind) {
    var view = mbSpView[kind] || { filter: 'lo' };
    var lo = mbState.currentLOId;
    return rows.filter(function (r) {
        if (r.dests.indexOf(kind) === -1) return false;
        if (view.filter === 'all') return true;
        if (view.filter === 'pending') return _spState(r, kind) !== 'built';
        return !r.lo || r.lo === lo;                       // this outcome (and items with none)
    });
}

function _spCounts(rows, kind) {
    var c = { new: 0, ok: 0, built: 0 };
    rows.forEach(function (r) { if (r.dests.indexOf(kind) !== -1) c[_spState(r, kind)]++; });
    return c;
}

function _spGroupKey(r) { return r.taskId === MB_LO_PC ? 'lopc|' + r.lo : r.taskId; }
function _spGroupHead(module, r) {
    if (r.taskId === MB_LO_PC) {
        var lo = _cmLos(module).find(function (l) { return l.id === r.lo; });
        return MB_SP_FIELD_ICON.lopc + ' ' + _spT('mbSpLoCriteria', { v0: _cmLoLabel(lo) });
    }
    if (r.taskId === MB_CC_TASK) return '🧩 ' + _mbCcText('title');
    var tasks = (module.taskAnalysisSource && module.taskAnalysisSource.sourceTasks) || [];
    var t = tasks.find(function (x) { return x.id === r.taskId; });
    return _mbTaskLabel(r.taskId) + (t && t.text ? ' — ' + String(t.text).replace(/\s+/g, ' ') : '');
}

function _spSourceChip(r) {
    var g = _cmFieldGroup(r.field, r.taskId);
    var icon = MB_SP_FIELD_ICON[g] || '•';
    var label = r.taskId === MB_LO_PC ? _spT('mbSpSrcLoPc') : _mbFieldLabel(r.field);
    var task = (r.taskId === MB_LO_PC || r.taskId === MB_CC_TASK) ? '' : ' · ' + _mbTaskLabel(r.taskId);
    return '<span class="mb-sp-src" title="' + _spEsc(_spT('mbSpSourceTip', { v0: label + task })) + '" aria-label="' +
        _spEsc(_spT('mbSpSourceTip', { v0: label + task })) + '">' + icon + '</span>';
}

function _spStateChip(r, kind) {
    var st = _spState(r, kind);
    var txt = st === 'built' ? '✓ ' + _spT('mbSpStBuilt') : st === 'ok' ? '● ' + _spT('mbSpStOk') : '○ ' + _spT('mbSpStNew');
    return '<span class="mb-sp-st is-' + st + '">' + _spEsc(txt) + '</span>';
}

/** The extra line under a decision: its cue and consequence (DACUM 3.100). */
function _spDecisionNote(module, r) {
    if (r.field !== 'decisionsCriticalPoints') return '';
    var d = mbTaDecision(module, r.taskId, r.itemIndex);
    if (!d || !(d.cue || d.error)) return '';
    var parts = [];
    if (d.cue) parts.push(_spT('mbSpCue') + ': ' + d.cue);
    if (d.error) parts.push(_spT('mbSpConsequence') + ': ' + d.error);
    return '<div class="mb-sp-note" dir="auto">' + _spEsc(parts.join(' · ')) + '</div>';
}

function _spRowHtml(module, r, kind, los) {
    var id = kind + '\n' + r.key;
    var st = _spState(r, kind);
    var editing = _spEditing === id;
    var checked = _spChecked.has(id);
    var others = MB_CM_KINDS.filter(function (k) { return k !== kind && r.dests.indexOf(k) === -1; });
    var text = editing
        ? '<div class="mb-sp-edit"><textarea id="mb-sp-edit-' + kind + '" rows="2" dir="auto" aria-label="' + _spEsc(_spT('mbSpEditLabel')) + '">' +
              _spEsc(_mbCleanItem(r.useText)) + '</textarea>' +
          '<button type="button" class="mb-sp-mini is-main" data-act="mbSpSaveEdit" data-args="' + _spArgs([kind, r.key]) + '">✓ ' + _spEsc(_spT('mbSpSave')) + '</button>' +
          '<button type="button" class="mb-sp-mini" data-act="mbSpEdit" data-args="' + _spArgs([kind, '']) + '">' + _spEsc(_spT('mbSpCancel')) + '</button></div>'
        : '<div class="mb-sp-text" dir="auto">' + _spEsc(_mbCleanItem(r.useText)) +
              (r.edited ? ' <span class="mb-sp-edited" title="' + _spEsc(_spT('mbSpEditedTip', { v0: _mbCleanItem(r.text) })) + '">✎</span>' : '') +
          '</div>' + _spDecisionNote(module, r);
    var loSel = '';
    if (r.taskId !== MB_LO_PC && (!r.lo || (mbSpView[kind] || {}).filter !== 'lo')) {
        loSel = '<select class="mb-sp-lo' + (r.lo ? '' : ' is-missing') + '" aria-label="' + _spEsc(_spT('mbSpLoLabel')) + '" data-act="mbSpSetLo" data-on="change" data-args="' +
            _spArgs([kind, r.key, '$value']) + '"' + (st === 'built' ? ' disabled' : '') + '>' + _cmLoOptions(los, r.lo, true) + '</select>';
    }
    var built = st === 'built';
    var acts = '';
    if (!editing) {
        acts += built ? '' : (st === 'ok'
            ? '<button type="button" class="mb-sp-ico is-on" data-act="mbSpUnapprove" data-args="' + _spArgs([kind, r.key]) + '" title="' + _spEsc(_spT('mbSpUnapproveTip')) + '" aria-label="' + _spEsc(_spT('mbSpUnapproveTip')) + '">✓</button>'
            : '<button type="button" class="mb-sp-ico" data-act="mbSpApprove" data-args="' + _spArgs([kind, r.key]) + '" title="' + _spEsc(_spT('mbSpApproveTip')) + '" aria-label="' + _spEsc(_spT('mbSpApproveTip')) + '">✓</button>');
        acts += built ? '' : '<button type="button" class="mb-sp-ico" data-act="mbSpEdit" data-args="' + _spArgs([kind, r.key]) + '" title="' + _spEsc(_spT('mbSpEditTip')) + '" aria-label="' + _spEsc(_spT('mbSpEditTip')) + '">✎</button>';
        if (!built && kind !== 'assessment') {
            acts += '<button type="button" class="mb-sp-ico" data-act="mbSpAddToOpen" data-args="' + _spArgs([kind, r.key]) + '" title="' + _spEsc(_spT('mbSpAddOpenTip')) + '" aria-label="' + _spEsc(_spT('mbSpAddOpenTip')) + '">⤵</button>';
        }
        /* One menu: "Move to…" and "Also send to…" the other kinds. */
        if (others.length && r.taskId !== MB_LO_PC) {
            var optv = function (verb, k) { return '<option value="' + verb + ':' + k + '">' + MB_CM_ICON[k] + ' ' + _spEsc(_spKindLabel(k)) + '</option>'; };
            acts += '<select class="mb-sp-act" data-act="mbSpSend" data-on="change" data-args="' + _spArgs([kind, r.key, '$value']) + '" title="' + _spEsc(_spT('mbSpSendTip')) + '" aria-label="' + _spEsc(_spT('mbSpSendTip')) + '">' +
                '<option value="">⇄ ' + _spEsc(_spT('mbSpSend')) + '</option>' +
                (built ? '' : '<optgroup label="' + _spEsc(_spT('mbSpMove')) + '">' + others.map(function (k) { return optv('move', k); }).join('') + '</optgroup>') +
                '<optgroup label="' + _spEsc(_spT('mbSpAlso')) + '">' + others.map(function (k) { return optv('also', k); }).join('') + '</optgroup></select>';
        }
        if (!built) {
            acts += '<button type="button" class="mb-sp-ico is-del" data-act="mbSpRemove" data-args="' + _spArgs([kind, r.key]) + '" title="' + _spEsc(_spT('mbSpRemoveTip')) + '" aria-label="' + _spEsc(_spT('mbSpRemoveTip')) + '">✕</button>';
        }
    }
    var also = r.dests.filter(function (k) { return k !== kind; });
    var alsoHtml = also.length ? '<span class="mb-sp-also" title="' + _spEsc(_spT('mbSpAlsoIn')) + '">' +
        also.map(function (k) { return MB_CM_ICON[k]; }).join('') + '</span>' : '';
    return '<div class="mb-sp-row is-' + st + (r.issue ? ' is-issue' : '') + '" data-sp-key="' + _spEsc(r.key) + '">' +
        '<input type="checkbox" class="mb-sp-check" aria-label="' + _spEsc(_spT('mbSpSelect')) + '" data-act="mbSpCheck" data-on="change" data-args="' +
            _spArgs([kind, r.key, '$checked']) + '"' + (checked ? ' checked' : '') + (built ? ' disabled' : '') + '>' +
        _spSourceChip(r) +
        '<div class="mb-sp-body">' + text + '</div>' +
        '<div class="mb-sp-side">' + _spStateChip(r, kind) + alsoHtml + loSel + '<span class="mb-sp-acts">' + acts + '</span></div>' +
    '</div>';
}

function _spRenderKind(kind) {
    var host = document.getElementById(MB_SP_HOSTS[kind]);
    if (!host) return;
    var module = _spModule();
    var hasSource = !!(module && ((module.taskAnalysisSource && Object.keys(module.taskAnalysisSource.taskAnalysis || {}).length) ||
        (module.learningOutcomes || []).some(function (lo) { return (lo.performanceCriteria || []).length; })));
    if (!module || !hasSource) { host.innerHTML = ''; _spBadges(); return; }
    var rows = _spRows(module);
    var mine = rows.filter(function (r) { return r.dests.indexOf(kind) !== -1; });
    if (!mine.length) { host.innerHTML = ''; _spBadges(rows); return; }
    var los = _cmLos(module);
    var view = mbSpView[kind];
    var shown = _spShown(rows, kind);
    var c = _spCounts(rows, kind);
    var groups = [], byKey = {};
    shown.forEach(function (r) {
        var gk = !r.lo && r.taskId !== MB_LO_PC ? '!nolo' : _spGroupKey(r);
        if (!byKey[gk]) { byKey[gk] = { key: gk, rows: [], head: gk === '!nolo' ? '⚠ ' + _spT('mbSpNeedsLo') : _spGroupHead(module, r) }; groups.push(byKey[gk]); }
        byKey[gk].rows.push(r);
    });
    var body = groups.map(function (g) {
        return '<div class="mb-sp-group"><div class="mb-sp-group-head" dir="auto">' + _spEsc(g.head) + '</div>' +
            g.rows.map(function (r) { return _spRowHtml(module, r, kind, los); }).join('') + '</div>';
    }).join('');
    var nSel = shown.filter(function (r) { return _spChecked.has(kind + '\n' + r.key) && _spState(r, kind) !== 'built'; }).length;
    var nOk = shown.filter(function (r) { return _spState(r, kind) === 'ok'; }).length;
    var nNew = shown.filter(function (r) { return _spState(r, kind) === 'new'; }).length;
    var filterHtml = '<select class="mb-sp-filter" aria-label="' + _spEsc(_spT('mbSpShow')) + '" data-act="mbSpViewFilter" data-on="change" data-args="' + _spArgs([kind, '$value']) + '">' +
        ['lo', 'pending', 'all'].map(function (f) {
            return '<option value="' + f + '"' + (view.filter === f ? ' selected' : '') + '>' + _spEsc(_spT('mbSpView_' + f)) + '</option>';
        }).join('') + '</select>';
    host.innerHTML =
        '<details class="mb-sp"' + (view.open ? ' open' : '') + '>' +
            '<summary data-act="mbSpViewToggle" data-args="' + _spArgs([kind]) + '">' +
                '<span class="mb-sp-title">✨ ' + _spEsc(_spT('mbSpTitle')) + '</span>' +
                (c.new ? '<span class="mb-sp-count is-new">' + _spEsc(_spT('mbSpCountNew', { v0: c.new })) + '</span>' : '') +
                (c.ok ? '<span class="mb-sp-count is-ok">' + _spEsc(_spT('mbSpCountOk', { v0: c.ok })) + '</span>' : '') +
                '<span class="mb-sp-count is-built">' + _spEsc(_spT('mbSpCountBuilt', { v0: c.built })) + '</span>' +
            '</summary>' +
            '<p class="mb-sp-intro" dir="auto">' + _spEsc(_spT('mbSpIntro_' + kind)) + '</p>' +
            '<div class="mb-sp-bar">' + filterHtml +
                '<button type="button" class="mb-sp-btn" data-act="mbSpApproveMany" data-args="' + _spArgs([kind, nSel ? 'selected' : 'shown']) + '"' + ((nSel || nNew) ? '' : ' disabled') + '>✓ ' +
                    _spEsc(_spT(nSel ? 'mbSpApproveSel' : 'mbSpApproveAll', { v0: nSel || nNew })) + '</button>' +
                '<button type="button" class="mb-sp-btn is-main" data-act="mbSpBuild" data-args="' + _spArgs([kind, 'selected']) + '"' + (nSel ? '' : ' disabled') + '>🔨 ' +
                    _spEsc(_spT('mbSpBuildSel', { v0: nSel })) + '</button>' +
                '<button type="button" class="mb-sp-btn is-main" data-act="mbSpBuild" data-args="' + _spArgs([kind, 'all']) + '"' + (nOk ? '' : ' disabled') +
                    ' title="' + _spEsc(_spT('mbSpBuildAllTip')) + '">🔨 ' + _spEsc(_spT('mbSpBuildAll', { v0: nOk })) + '</button>' +
                '<span class="mb-sp-gap"></span>' +
                '<button type="button" class="mb-sp-btn is-quiet" data-act="mbCovOpen">🗺️ ' + _spEsc(_spT('mbCovTitle')) + '</button>' +
                '<button type="button" class="mb-sp-btn is-quiet" data-act="mbCovDefaults">⚙️ ' + _spEsc(_spT('mbSpDefaultsTitle')) + '</button>' +
            '</div>' +
            (body || '<p class="mb-sp-empty" dir="auto">' + _spEsc(_spT('mbSpNothingShown')) + '</p>') +
        '</details>';
    var ta = document.getElementById('mb-sp-edit-' + kind);
    if (ta) {
        ta.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') { e.preventDefault(); _spEditing = null; _spRenderKind(kind); }
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); var b = ta.parentElement.querySelector('[data-act="mbSpSaveEdit"]'); if (b) b.click(); }
        });
        try { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } catch (e) { /* ignore */ }
    }
    _spBadges(rows);
}

/* "3" on the Information / Activity / Assessment tab buttons: items
   waiting for approval in that kind (the whole module). */
function _spBadges(rows) {
    var module = _spModule();
    if (!rows) rows = _spRows(module);
    MB_CM_KINDS.forEach(function (kind) {
        var btn = document.querySelector('#mb-sidenav .tab[data-args=\'["' + kind + '"]\']');
        if (!btn) return;
        var n = _spCounts(rows, kind).new;
        if (n) {
            btn.setAttribute('data-sp-count', String(n));
            btn.setAttribute('title', _spT('mbSpBadgeTip', { v0: n }));
        } else {
            btn.removeAttribute('data-sp-count');
            btn.removeAttribute('title');
        }
    });
}

/** Repaint the three panels, the counters and the coverage view. */
function mbSpRefresh() {
    MB_CM_KINDS.forEach(_spRenderKind);
    if (typeof mbCovRender === 'function') mbCovRender();
}

/* ── Writing a row ─────────────────────────────────────────── */

function _spPut(key, prop, value) {
    var module = _spModule();
    if (!module) return null;
    var row = _spRow(module, key);
    if (!row) return null;
    _cmPut(module, row, prop, value);
    return row;
}

function mbSpViewToggle(kind, el) {
    var d = el && el.parentElement;
    if (d && mbSpView[kind]) mbSpView[kind].open = !d.open;
}
function mbSpViewFilter(kind, value) {
    if (mbSpView[kind]) mbSpView[kind].filter = value || 'lo';
    _spRenderKind(kind);
}
function mbSpCheck(kind, key, on) {
    var id = kind + '\n' + key;
    if (on) _spChecked.add(id); else _spChecked.delete(id);
    _spRenderKind(kind);
}

function mbSpApprove(kind, key) {
    var module = _spModule(); var r = module && _spRow(module, key);
    if (!r) return;
    _cmPut(module, r, 'ok', r.ok.concat([kind]));
    mbSpRefresh();
}
function mbSpUnapprove(kind, key) {
    var module = _spModule(); var r = module && _spRow(module, key);
    if (!r) return;
    _cmPut(module, r, 'ok', r.ok.filter(function (k) { return k !== kind; }));
    mbSpRefresh();
}
function mbSpApproveMany(kind, which) {
    var module = _spModule();
    if (!module) return;
    var rows = _spRows(module);
    var list = _spShown(rows, kind).filter(function (r) {
        if (_spState(r, kind) !== 'new') return false;
        return which === 'selected' ? _spChecked.has(kind + '\n' + r.key) : true;
    });
    list.forEach(function (r) { _cmPut(module, r, 'ok', r.ok.concat([kind])); });
    if (list.length) showStatus(_spT('mbSpApproved', { v0: list.length }), 'success');
    mbSpRefresh();
}

function mbSpEdit(kind, key) {
    _spEditing = key ? kind + '\n' + key : null;
    _spRenderKind(kind);
}
function mbSpSaveEdit(kind, key) {
    var ta = document.getElementById('mb-sp-edit-' + kind);
    var v = ta ? String(ta.value || '').replace(/\s+/g, ' ').trim() : '';
    _spEditing = null;
    if (!v) { showStatus(_spT('mbSpEditEmpty'), 'error'); _spRenderKind(kind); return; }
    _spPut(key, 'x', v);
    mbSpRefresh();
}

function mbSpRemove(kind, key) {
    var module = _spModule(); var r = module && _spRow(module, key);
    if (!r) return;
    _cmPut(module, r, 'd', r.dests.filter(function (k) { return k !== kind; }));
    _spChecked.delete(kind + '\n' + key);
    showStatus(_spT('mbSpRemoved', { v0: _spKindLabel(kind) }), 'info');
    mbSpRefresh();
}
function mbSpMove(kind, key, to) {
    if (MB_CM_KINDS.indexOf(to) === -1 || to === kind) { _spRenderKind(kind); return; }
    var module = _spModule(); var r = module && _spRow(module, key);
    if (!r) return;
    var d = r.dests.filter(function (k) { return k !== kind; });
    if (d.indexOf(to) === -1) d.push(to);
    var ok = r.ok.indexOf(kind) !== -1 ? r.ok.filter(function (k) { return k !== kind; }).concat([to]) : r.ok;
    _cmPut(module, r, 'd', d);
    r.dests = d;
    if (ok !== r.ok) _cmPut(module, r, 'ok', ok);
    _spChecked.delete(kind + '\n' + key);
    showStatus(_spT('mbSpMoved', { v0: _spKindLabel(to) }), 'success');
    mbSpRefresh();
}
function mbSpAlso(kind, key, to) {
    if (MB_CM_KINDS.indexOf(to) === -1) { _spRenderKind(kind); return; }
    var module = _spModule(); var r = module && _spRow(module, key);
    if (!r) return;
    if (r.dests.indexOf(to) === -1) _cmPut(module, r, 'd', r.dests.concat([to]));
    showStatus(_spT('mbSpSentAlso', { v0: _spKindLabel(to) }), 'success');
    mbSpRefresh();
}
/** The row menu: "move:<kind>" or "also:<kind>". */
function mbSpSend(kind, key, value) {
    var m = /^(move|also):(\w+)$/.exec(String(value || ''));
    if (!m) { _spRenderKind(kind); return; }
    return m[1] === 'move' ? mbSpMove(kind, key, m[2]) : mbSpAlso(kind, key, m[2]);
}
function mbSpSetLo(kind, key, loId) {
    _spPut(key, 'lo', String(loId || ''));
    mbSpRefresh();
}

/* ── How an item is written, by kind ───────────────────────── */

/**
 * { place, text, heading?, body?, merge?, top? } for one row in `kind`.
 *   info:       place 'section' — a content section (heading + body);
 *               merge: the four basic skills share one "Supporting
 *               skills" section per sheet, one line each.
 *   activity:   place 'steps' | 'resources' | 'criteria'; top: put
 *               before the work steps (conditions, safety warnings).
 *   assessment: place 'row' — the criterion of a form row.
 */
function _spEntry(module, r, kind) {
    var text = _mbCleanItem(r.edited ? r.edited : (typeof mbDacumText === 'function' ? mbDacumText(r.text) : r.text));
    var g = _cmFieldGroup(r.field, r.taskId);
    var dec = g === 'decisionsCriticalPoints' && !r.edited ? mbTaDecision(module, r.taskId, r.itemIndex) : null;
    var tag = function (k, t) { return _spC(k) + ': ' + t; };
    if (kind === 'info') {
        if (MB_CM_BASIC.indexOf(g) !== -1) {
            return { place: 'section', heading: _spC('mbSpSupportSkills'), body: tag('mbSpBasic_' + g, text), merge: true };
        }
        if (dec) {
            var lines = [];
            if (dec.cue) lines.push(tag('mbSpCue', dec.cue));
            if (dec.error) lines.push(tag('mbSpConsequence', dec.error));
            if (dec.expert) lines.push(tag('mbSpExpert', dec.expert));
            return { place: 'section', heading: text, body: lines.join('\n') };
        }
        return { place: 'section', heading: text, body: '' };
    }
    if (kind === 'activity') {
        switch (g) {
            case 'toolsEquipmentMaterials': return { place: 'resources', text: text };
            case 'safetyOSH': return { place: 'steps', text: tag('mbSpSafety', text), top: true };
            case 'conditionsWorkEnvironment': return { place: 'steps', text: tag('mbSpConditions', text), top: true };
            case 'decisionsCriticalPoints':
                return { place: 'steps', text: tag('mbSpCheckpoint', text) + (dec && dec.cue ? ' — ' + tag('mbSpCue', dec.cue) : '') };
            case 'basicMath': return { place: 'steps', text: tag('mbSpCalc', text) };
            case 'basicReading': case 'basicWriting': case 'basicScience':
                return { place: 'steps', text: tag('mbSpBasic_' + g, text) };
            case 'commonErrorsTroubleshooting': return { place: 'steps', text: tag('mbSpWatch', text) };
            case 'requiredKnowledge': return { place: 'steps', text: text };
            case 'performanceCriteria': case 'performanceStandard': case 'workerBehaviours': case 'cc': case 'lopc':
                return { place: 'criteria', text: text };
            default: return { place: 'steps', text: text };
        }
    }
    switch (g) {
        case 'decisionsCriticalPoints': return { place: 'row', text: tag('mbSpCritical', text) };
        case 'safetyOSH': return { place: 'row', text: tag('mbSpMandatory', text) };
        case 'workerBehaviours': return { place: 'row', text: tag('mbSpObserve', text) };
        case 'conditionsWorkEnvironment': return { place: 'row', text: tag('mbSpConditions', text) };
        default: return { place: 'row', text: text };
    }
}

function _spSel(r) { return { taskId: r.taskId, field: r.field, itemIndex: r.itemIndex, itemText: r.text }; }

function _spFillInfo(sheet, entries) {
    var lang = contentLang();
    if (!Array.isArray(sheet.contentSections)) sheet.contentSections = [];
    var find = function (h) {
        var n = _mbNorm(h);
        return sheet.contentSections.find(function (c) { return _mbNorm(biGetStrict(c.heading, lang)) === n; });
    };
    var n = 0;
    entries.forEach(function (e) {
        var have = find(e.heading);
        if (have) {
            if (!e.merge || !e.body) return;
            var cur = biGetStrict(have.text, lang) || '';
            if (cur.split('\n').some(function (l) { return _mbNorm(l) === _mbNorm(e.body); })) return;
            biPut(have, 'text', cur ? cur + '\n' + e.body : e.body);
            n++;
            return;
        }
        var sec = { contentId: '', marks: [], tables: [], uid: mbUid() };
        biPut(sec, 'heading', e.heading); biPut(sec, 'text', e.body || '');
        sheet.contentSections.push(sec);
        n++;
    });
    return n;
}

function _spFillActivity(sheet, entries) {
    var lang = contentLang();
    ['steps', 'resources', 'criteria'].forEach(function (k) { if (!Array.isArray(sheet[k])) sheet[k] = []; });
    var has = {
        steps: new Set(sheet.steps.map(function (x) { return _mbNorm(biGetStrict(x.text, lang)); })),
        resources: new Set(sheet.resources.map(function (x) { return _mbNorm(biGetStrict(x.name, lang)); })),
        criteria: new Set(sheet.criteria.map(function (x) { return _mbNorm(biGetStrict(x, lang)); }))
    };
    /* Conditions and safety warnings go before the work steps, after
       the ones already put there. */
    var topCount = 0;
    while (topCount < sheet.steps.length && sheet.steps[topCount] && sheet.steps[topCount]._spTop) topCount++;
    var n = 0;
    entries.forEach(function (e) {
        var t = e.text;
        if (!t || has[e.place].has(_mbNorm(t))) return;
        has[e.place].add(_mbNorm(t)); n++;
        if (e.place === 'steps') {
            var o = { stepId: '', marks: [], tables: [], uid: mbUid() };
            biPut(o, 'text', t);
            if (e.top) { o._spTop = true; sheet.steps.splice(topCount++, 0, o); } else sheet.steps.push(o);
        } else if (e.place === 'resources') {
            var res = { quantity: '', uid: mbUid() }; biPut(res, 'name', t); sheet.resources.push(res);
        } else {
            var c = biNew(); c[lang] = t; c.uid = mbUid(); sheet.criteria.push(c); sheet.includeCriteria = true;
        }
    });
    return n;
}

function _spEnsureForm(loId) {
    if (!mbState.assessmentFormsData[loId]) {
        mbState.assessmentFormsData[loId] = {
            rows: [], competent: false, notYetCompetent: false,
            teacherName: '', teacherSignature: '', teacherDate: '',
            learnerName: '', learnerSignature: '', learnerDate: ''
        };
    }
    var form = mbState.assessmentFormsData[loId];
    if (!Array.isArray(form.rows)) form.rows = [];
    if (!form._aiSource || typeof form._aiSource !== 'object') form._aiSource = { pcIds: [], keys: [] };
    if (!Array.isArray(form._aiSource.pcIds)) form._aiSource.pcIds = [];
    if (!Array.isArray(form._aiSource.keys)) form._aiSource.keys = [];
    return form;
}
function _spRowText(row) {
    var c = row && row.criteria;
    return typeof c === 'string' ? c : (c && typeof biGetStrict === 'function' ? biGetStrict(c, contentLang()) : '');
}
function _spFillForm(form, texts) {
    var have = new Set(form.rows.map(function (r) { return _mbNorm(_spRowText(r)); }).filter(Boolean));
    var n = 0;
    texts.forEach(function (t) {
        if (!t || have.has(_mbNorm(t))) return;
        have.add(_mbNorm(t)); n++;
        var empty = form.rows.find(function (r) { return !String(_spRowText(r) || '').trim() && !r.activities && !r.outcomes && !r.verification; });
        if (empty) empty.criteria = t;
        else form.rows.push({ criteria: t, activities: '', outcomes: '', verification: '', date: '' });
    });
    return n;
}

function _spNewSheet(lo, kind) {
    var los = mbState.learningOutcomesData;
    var loIndex = los.indexOf(lo);
    if (kind === 'info') {
        if (!Array.isArray(lo.infoSheets)) lo.infoSheets = [];
        lo.infoSheets.push({
            sheetNumber: getAutoSheetNumber(loIndex, lo.infoSheets.length), title: '', objective: '',
            linkSubject: '', linkUrl: '', qrImage: null,
            selfCheckNumber: '', selfCheckContent: '', answersKeyNumber: '', answersKeyContent: '',
            contentSections: [], contentSectionImages: {}
        });
        return lo.infoSheets.length - 1;
    }
    if (!Array.isArray(lo.activitySheets)) lo.activitySheets = [];
    lo.activitySheets.push({
        sheetNumber: getAutoSheetNumber(loIndex, lo.activitySheets.length), title: '', objective: '', duration: '0',
        linkSubject: '', linkUrl: '', qrImage: null, resources: [], steps: [], images: {},
        includeCriteria: false, criteria: []
    });
    return lo.activitySheets.length - 1;
}

function _spTitleFor(module, r) {
    if (r.taskId === MB_CC_TASK) return _mbCcText('title');
    if (String(r.field).indexOf(MB_TA_CUSTOM) === 0) return String(r.field).slice(MB_TA_CUSTOM.length);
    var tasks = (module.taskAnalysisSource && module.taskAnalysisSource.sourceTasks) || [];
    var t = tasks.find(function (x) { return x.id === r.taskId; });
    var txt = String((t && t.text) || _mbTaskLabel(r.taskId)).replace(/\s+/g, ' ');
    return _mbCleanItem(typeof mbDacumText === 'function' ? mbDacumText(txt) : txt);
}

/**
 * Write `rows` into sheets of `kind`. `into` (optional) = { loId, index }
 * puts everything on that sheet instead (the "⤵ add to the open sheet").
 * Returns { sheets, items, focus: { loId, index } }.
 */
function _spWrite(module, rows, kind, into) {
    var los = mbState.learningOutcomesData;
    var out = { sheets: 0, items: 0, focus: null };
    if (kind === 'assessment') {
        var byLo = {};
        rows.forEach(function (r) { (byLo[r.lo] = byLo[r.lo] || []).push(r); });
        Object.keys(byLo).forEach(function (loId) {
            if (!los.some(function (l) { return l.id === loId; })) return;
            var form = _spEnsureForm(loId);
            /* The outcome's own criteria first, then the competency
               criteria, then what the Task Analysis adds. */
            var rank = function (r) { return r.taskId === MB_LO_PC ? 0 : r.taskId === MB_CC_TASK ? 1 : 2; };
            var list = byLo[loId].map(function (r, i) { return { r: r, i: i }; })
                .sort(function (a, b) { return rank(a.r) - rank(b.r) || a.i - b.i; }).map(function (x) { return x.r; });
            out.items += _spFillForm(form, list.map(function (r) { return _spEntry(module, r, kind).text; }));
            list.forEach(function (r) {
                if (r.taskId === MB_LO_PC) { if (form._aiSource.pcIds.indexOf(r.pcId) === -1) form._aiSource.pcIds.push(r.pcId); }
                else { var k = _mbSelKey(r); if (form._aiSource.keys.indexOf(k) === -1) form._aiSource.keys.push(k); }
            });
            out.sheets++;
            out.focus = { loId: loId, index: 0 };
        });
        return out;
    }
    var listKey = kind === 'info' ? 'infoSheets' : 'activitySheets';
    var hasContent = kind === 'info' ? _mbInfoSheetHasContent : _mbActivitySheetHasContent;
    var groups = [], gmap = {};
    rows.forEach(function (r) {
        var gk = into ? 'into' : r.lo + '|' + r.taskId;
        if (!gmap[gk]) { gmap[gk] = { lo: into ? into.loId : r.lo, taskId: r.taskId, rows: [] }; groups.push(gmap[gk]); }
        gmap[gk].rows.push(r);
    });
    var all = _spRows(module);
    groups.forEach(function (g) {
        var lo = los.find(function (l) { return l.id === g.lo; });
        if (!lo) return;
        if (!Array.isArray(lo[listKey])) lo[listKey] = [];
        var index = -1;
        if (into) index = into.index;
        if (index < 0) {
            /* The task already has its sheet of this kind in this outcome. */
            all.some(function (r) {
                if (r.taskId !== g.taskId) return false;
                var p = r.places.find(function (q) { return q.kind === kind && q.lo.id === g.lo; });
                if (p) index = p.n - 1;
                return !!p;
            });
        }
        if (index < 0) index = lo[listKey].findIndex(function (sh) { return !hasContent(sh); });
        var fresh = index < 0;
        if (fresh) index = _spNewSheet(lo, kind);
        var sheet = lo[listKey][index];
        if (!sheet) return;
        if (!_mbBiHasAny(sheet.title)) biPut(sheet, 'title', _spTitleFor(module, g.rows[0]));
        var entries = g.rows.map(function (r) { return _spEntry(module, r, kind); });
        out.items += kind === 'info' ? _spFillInfo(sheet, entries) : _spFillActivity(sheet, entries);
        sheet._aiSource = sheet._aiSource || {};
        sheet._aiSource.sourceSelections = (sheet._aiSource.sourceSelections || []).concat(g.rows.map(_spSel));
        out.sheets++;
        out.focus = { loId: g.lo, index: index };
    });
    return out;
}

/** After writing: the outcome and sheet written last are on screen,
 *  right under the panel. */
function _spShow(kind, focus) {
    if (typeof saveCurrentModuleLOData === 'function') saveCurrentModuleLOData();
    if (focus && focus.loId && focus.loId !== mbState.currentLOId && typeof _applyLOSwitch === 'function') {
        _applyLOSwitch(focus.loId);
    }
    var lo = mbState.learningOutcomesData.find(function (l) { return l.id === mbState.currentLOId; });
    if (lo && focus && kind === 'info') { mbState.currentInfoSheetIndex = focus.index; loadInfoSheetAtIndex(lo, focus.index); }
    if (lo && focus && kind === 'activity') { mbState.currentActivitySheetIndex = focus.index; loadActivitySheetAtIndex(lo, focus.index); }
    if (typeof updateLOSummary === 'function') updateLOSummary();
    if (kind === 'assessment' && typeof renderAssessmentForms === 'function') renderAssessmentForms();
    if (typeof updateModuleSummary === 'function') updateModuleSummary();
    mbSpRefresh();
    var host = document.getElementById(MB_SP_HOSTS[kind]);
    var next = host && host.nextElementSibling;
    if (next && next.scrollIntoView) {
        try { next.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { /* ignore */ }
    }
    if (typeof mbLibrarySave === 'function') mbLibrarySave();
}

/** 🔨 Build — the items ticked ('selected') or every approved item
 *  shown ('all'). An item with no outcome cannot be built. */
function mbSpBuild(kind, which) {
    var module = _spModule();
    if (!module) return;
    if (typeof saveCurrentSheetToLO === 'function') saveCurrentSheetToLO();
    var rows = _spShown(_spRows(module), kind).filter(function (r) {
        var st = _spState(r, kind);
        if (st === 'built') return false;
        return which === 'selected' ? _spChecked.has(kind + '\n' + r.key) : st === 'ok';
    });
    if (!rows.length) { showStatus(_spT(which === 'selected' ? 'mbSpSelectFirst' : 'mbSpApproveFirst'), 'info'); return; }
    var noLo = rows.filter(function (r) { return !r.lo; });
    rows = rows.filter(function (r) { return r.lo; });
    if (!rows.length) { showStatus(_spT('mbSpNoLoAll', { v0: noLo.length }), 'error'); return; }
    rows.forEach(function (r) { if (r.ok.indexOf(kind) === -1) _cmPut(module, r, 'ok', r.ok.concat([kind])); });
    var res = _spWrite(module, rows, kind, null);
    rows.forEach(function (r) { _spChecked.delete(kind + '\n' + r.key); });
    _spShow(kind, res.focus);
    var msg = _spT(kind === 'assessment' ? 'mbSpBuiltForms' : 'mbSpBuiltSheets', { v0: rows.length, v1: res.sheets });
    if (noLo.length) msg += ' ' + _spT('mbSpNoLoSome', { v0: noLo.length });
    showStatus(msg, noLo.length ? 'info' : 'success');
}

/** ⤵ — this item on the sheet open in the tab, now. */
function mbSpAddToOpen(kind, key) {
    var module = _spModule(); var r = module && _spRow(module, key);
    if (!r || kind === 'assessment') return;
    if (!mbState.currentLOId) { showStatus(_spT('mbSpNoOpenLo'), 'error'); return; }
    if (typeof saveCurrentSheetToLO === 'function') saveCurrentSheetToLO();
    var lo = mbState.learningOutcomesData.find(function (l) { return l.id === mbState.currentLOId; });
    if (!lo) return;
    var listKey = kind === 'info' ? 'infoSheets' : 'activitySheets';
    var index = kind === 'info' ? mbState.currentInfoSheetIndex : mbState.currentActivitySheetIndex;
    if (!(lo[listKey] || [])[index]) index = _spNewSheet(lo, kind);
    if (r.ok.indexOf(kind) === -1) _cmPut(module, r, 'ok', r.ok.concat([kind]));
    if (!r.lo) _cmPut(module, r, 'lo', lo.id);
    var res = _spWrite(module, [r], kind, { loId: lo.id, index: index });
    _spShow(kind, res.focus);
    showStatus(_spT('mbSpAddedOpen'), 'success');
}

/* ── Hooks ─────────────────────────────────────────────────── */

/* Entering a sheet tab repaints its panel (sheets may have been
   deleted elsewhere). switchTab is a global of tabs.js. */
(function () {
    var wrap = function () {
        var orig = window.switchTab;
        if (typeof orig !== 'function' || orig._spWrapped) return;
        var w = async function (name) {
            var out = await orig.apply(this, arguments);
            if (MB_CM_KINDS.indexOf(name) !== -1) _spRenderKind(name);
            return out;
        };
        w._spWrapped = true;
        window.switchTab = w;
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wrap); else wrap();
})();
window.addEventListener('mb:langchange', function () { mbSpRefresh(); });
window.addEventListener('mb:libraryready', function () { mbSpRefresh(); });
window.addEventListener('mb:librarychanged', function () { _spBadges(); });
