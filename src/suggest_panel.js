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
    var cl = contentLang();
    var inCl = function (t) { var x = _spIn(module, t, cl); return x == null ? t : x; };
    var parts = [];
    if (d.cue) parts.push(_spT('mbSpCue') + ': ' + inCl(d.cue));
    if (d.error) parts.push(_spT('mbSpConsequence') + ': ' + inCl(d.error));
    return '<div class="mb-sp-note" dir="auto">' + _spEsc(parts.join(' · ')) + '</div>';
}

function _spRowHtml(module, r, kind, los) {
    var id = kind + '\n' + r.key;
    var st = _spState(r, kind);
    var editing = _spEditing === id;
    var checked = _spChecked.has(id);
    var others = MB_CM_KINDS.filter(function (k) { return k !== kind && r.dests.indexOf(k) === -1; });
    var shown = _spShownText(module, r);
    /* 3.34.0: an item with no text in the content language yet says so —
       "EN" — and is written on its own language's side only. */
    var langChip = shown.missing
        ? ' <span class="mb-sp-lang" title="' + _spEsc(_spT('mbSpNoLangTip', { v0: _spLangName(contentLang()), v1: _spLangName(shown.from) })) + '">' +
              _spEsc(String(shown.from).toUpperCase()) + '</span>' : '';
    var text = editing
        ? '<div class="mb-sp-edit"><textarea id="mb-sp-edit-' + kind + '" rows="2" dir="auto" aria-label="' + _spEsc(_spT('mbSpEditLabel')) + '"' +
              (shown.missing ? ' placeholder="' + _spEsc(shown.text) + '">' : '>' + _spEsc(shown.text)) + '</textarea>' +
          '<button type="button" class="mb-sp-mini is-main" data-act="mbSpSaveEdit" data-args="' + _spArgs([kind, r.key]) + '">✓ ' + _spEsc(_spT('mbSpSave')) + '</button>' +
          '<button type="button" class="mb-sp-mini" data-act="mbSpEdit" data-args="' + _spArgs([kind, '']) + '">' + _spEsc(_spT('mbSpCancel')) + '</button></div>'
        : '<div class="mb-sp-text' + (shown.missing ? ' is-other-lang' : '') + '" dir="auto">' + _spEsc(shown.text) + langChip +
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
            _spLangBanner(module, mine) +
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

/* 3.34.0: items of this panel with no text in the content language. */
function _spLangBanner(module, rows) {
    var cl = contentLang();
    var miss = rows.filter(function (r) { return _spTextIn(module, r, cl) == null; });
    if (!miss.length) return '';
    var src = _spSrcLang(module);
    return '<div class="mb-sp-langbar" role="status"><p dir="auto">⚠ ' +
        _spEsc(_spT('mbSpLangMissing', { v0: miss.length, v1: _spLangName(cl), v2: _spLangName(src) })) + '</p>' +
        '<div class="mb-sp-langbar-acts"><button type="button" class="mb-sp-btn is-main" data-act="mbSpTranslate">✨ ' +
            _spEsc(_spT('mbSpTranslate', { v0: _spLangName(cl) })) + '</button>' +
        '<span dir="auto">' + _spEsc(_spT('mbSpLangOr')) + '</span></div></div>';
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
    var module = _spModule(); var r = module && _spRow(module, key);
    if (!r) return;
    _cmPut(module, r, 'x', v);
    _cmPut(module, _spRow(module, key) || r, 'xl', contentLang());   // 3.34.0
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

/* ── Languages (3.34.0) ────────────────────────────────────────
   DACUM sends its texts in one language (module.dacumLang) and, when the
   project was translated there, their versions in the others. Each text
   is written on the side of its own language, with labels ("Safety:",
   "Cue:" …) in that language — never an English text on the Arabic side
   or an Arabic label in front of an English text. A side with no text
   yet stays empty (the content-language meter counts it) until it is
   translated: in DACUM and sent again, here with "✨ Translate", or by
   editing the item. */

var MB_SP_LABEL_KEYS = ['mbSpSafety', 'mbSpConditions', 'mbSpCheckpoint', 'mbSpCalc', 'mbSpWatch', 'mbSpCritical',
    'mbSpMandatory', 'mbSpObserve', 'mbSpCue', 'mbSpConsequence', 'mbSpExpert', 'mbSpSupportSkills',
    'mbSpBasic_basicReading', 'mbSpBasic_basicWriting', 'mbSpBasic_basicMath', 'mbSpBasic_basicScience'];
function _spCodes() { return (typeof BILANG_CODES !== 'undefined') ? BILANG_CODES : ['en', 'ar', 'fr']; }
function _spL(k, lang) { return (window.i18n && window.i18n.tIn) ? window.i18n.tIn(k, lang) : _spT(k); }

/** A label written by this panel ("Safety", "Supporting skills" …), in
 *  any language → the same label in `lang`; null when it is not one. */
function mbSpLabelIn(label, lang) {
    var t = String(label || '').trim();
    if (!t) return null;
    for (var i = 0; i < MB_SP_LABEL_KEYS.length; i++) {
        var k = MB_SP_LABEL_KEYS[i];
        var codes = _spCodes();
        for (var j = 0; j < codes.length; j++) {
            if (_spL(k, codes[j]) === t) return _spL(k, lang);
        }
    }
    return null;
}

/* Language names in the interface language ("Arabic", "arabe", "العربية"). */
var MB_SP_LANG_UI = {
    en: { en: 'English', ar: 'Arabic', fr: 'French' },
    fr: { en: 'anglais', ar: 'arabe', fr: 'français' },
    ar: { en: 'الإنجليزية', ar: 'العربية', fr: 'الفرنسية' }
};
function _spLangName(code) {
    var ui = (window.i18n && window.i18n.getLang) ? window.i18n.getLang() : 'en';
    return (MB_SP_LANG_UI[ui] || MB_SP_LANG_UI.en)[code] || String(code || '').toUpperCase();
}

function _spSrcLang(module) { return (typeof mbDacumLang === 'function') ? mbDacumLang(module) : 'en'; }

/** One DACUM text in `lang`, or null when it has no version there. */
function _spIn(module, text, lang) {
    if (!text) return text;
    if (typeof mbDacumTextIn === 'function') return mbDacumTextIn(module, text, lang);
    return lang === _spSrcLang(module) ? text : null;
}

/** The item itself in `lang` — the edit when it was written in that
 *  language, else DACUM's text or its translation; null when none. */
function _spTextIn(module, r, lang) {
    if (r.edited && (r.editLang || _spSrcLang(module)) === lang) return _mbCleanItem(r.edited);
    var t = _spIn(module, r.text, lang);
    return t == null ? null : _mbCleanItem(t);
}

/** What the panels show: the item in the content language, or as DACUM
 *  sent it, flagged, when it has no version in that language yet. */
function _spShownText(module, r) {
    var cl = contentLang();
    var t = _spTextIn(module, r, cl);
    if (t != null) return { text: t, missing: false };
    return { text: _mbCleanItem(r.edited || r.text), missing: true, from: r.edited ? (r.editLang || _spSrcLang(module)) : _spSrcLang(module) };
}

/**
 * How one row is written in `kind`, in `lang` — or null when the item
 * has no text in that language.
 *   info:       { place: 'section', heading, body, merge? } — the four
 *               basic skills share one "Supporting skills" section.
 *   activity:   { place: 'steps' | 'resources' | 'criteria', text, top? }
 *               top: before the work steps (conditions, safety).
 *   assessment: { place: 'row', text }
 */
function _spEntryIn(module, r, kind, lang) {
    var text = _spTextIn(module, r, lang);
    if (text == null || text === '') return null;
    var g = _cmFieldGroup(r.field, r.taskId);
    var tag = function (k, t) { return _spL(k, lang) + ': ' + t; };
    var dec = null;
    if (g === 'decisionsCriticalPoints' && !r.edited) {
        var d = mbTaDecision(module, r.taskId, r.itemIndex);
        if (d) dec = { cue: _spIn(module, d.cue, lang), error: _spIn(module, d.error, lang), expert: _spIn(module, d.expert, lang) };
    }
    if (kind === 'info') {
        if (MB_CM_BASIC.indexOf(g) !== -1) {
            return { place: 'section', heading: _spL('mbSpSupportSkills', lang), body: tag('mbSpBasic_' + g, text), merge: true };
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

/** { place, top, merge, sides: { lang: entry } } — every language the
 *  item has text in. */
function _spEntry(module, r, kind) {
    var out = { sides: {} };
    _spCodes().forEach(function (c) {
        var e = _spEntryIn(module, r, kind, c);
        if (!e) return;
        out.sides[c] = e;
        out.place = e.place; out.top = !!e.top; out.merge = !!e.merge;
    });
    return out;
}

function _spSel(r) { return { taskId: r.taskId, field: r.field, itemIndex: r.itemIndex, itemText: r.text }; }

/* Every non-empty side of a value, normalised (string = one side). */
function _spSides(v) {
    if (typeof v === 'string') return v.trim() ? [_mbNorm(v)] : [];
    if (!v || typeof v !== 'object') return [];
    return _spCodes().filter(function (c) { return typeof v[c] === 'string' && v[c].trim(); }).map(function (c) { return _mbNorm(v[c]); });
}
function _spMatches(v, e, key) {
    var mine = _spCodes().filter(function (c) { return e.sides[c]; }).map(function (c) { return _mbNorm(e.sides[c][key]); });
    var have = _spSides(v);
    return mine.some(function (t) { return have.indexOf(t) !== -1; });
}
function _spBi(e, key) {
    var v = biNew();
    _spCodes().forEach(function (c) { if (e.sides[c]) v[c] = e.sides[c][key] || ''; });
    return v;
}

function _spFillInfo(sheet, entries) {
    if (!Array.isArray(sheet.contentSections)) sheet.contentSections = [];
    var n = 0;
    entries.forEach(function (e) {
        if (!Object.keys(e.sides).length) return;
        var have = sheet.contentSections.find(function (c) { return _spMatches(c.heading, e, 'heading'); });
        if (have) {
            if (!e.merge) return;
            var added = false;
            if (!have.text || typeof have.text !== 'object') have.text = biNew(typeof have.text === 'string' ? have.text : '');
            if (!have.heading || typeof have.heading !== 'object') have.heading = biNew(typeof have.heading === 'string' ? have.heading : '');
            _spCodes().forEach(function (c) {
                var side = e.sides[c];
                if (!side || !side.body) return;
                if (!have.heading[c]) have.heading[c] = side.heading;
                var cur = have.text[c] || '';
                if (cur.split('\n').some(function (l) { return _mbNorm(l) === _mbNorm(side.body); })) return;
                have.text[c] = cur ? cur + '\n' + side.body : side.body;
                added = true;
            });
            if (added) n++;
            return;
        }
        sheet.contentSections.push({ contentId: '', marks: [], tables: [], uid: mbUid(), heading: _spBi(e, 'heading'), text: _spBi(e, 'body') });
        n++;
    });
    return n;
}

function _spFillActivity(sheet, entries) {
    ['steps', 'resources', 'criteria'].forEach(function (k) { if (!Array.isArray(sheet[k])) sheet[k] = []; });
    var holder = { steps: function (x) { return x.text; }, resources: function (x) { return x.name; }, criteria: function (x) { return x; } };
    /* Conditions and safety warnings go before the work steps, after
       the ones already put there. */
    var topCount = 0;
    while (topCount < sheet.steps.length && sheet.steps[topCount] && sheet.steps[topCount]._spTop) topCount++;
    var n = 0;
    entries.forEach(function (e) {
        if (!e.place || !Object.keys(e.sides).length) return;
        var list = sheet[e.place];
        if (list.some(function (x) { return _spMatches(holder[e.place](x), e, 'text'); })) return;
        n++;
        if (e.place === 'steps') {
            var o = { stepId: '', marks: [], tables: [], uid: mbUid(), text: _spBi(e, 'text') };
            if (e.top) { o._spTop = true; sheet.steps.splice(topCount++, 0, o); } else sheet.steps.push(o);
        } else if (e.place === 'resources') {
            sheet.resources.push({ quantity: '', uid: mbUid(), name: _spBi(e, 'text') });
        } else {
            var c = _spBi(e, 'text'); c.uid = mbUid(); sheet.criteria.push(c); sheet.includeCriteria = true;
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
    return typeof c === 'string' ? c : (c && typeof biGet === 'function' ? biGet(c, contentLang()) : '');
}
/* 3.34.0: a criterion written from here is a { en, ar, fr } value, like
   the sheets — the form shows the side of the content language. */
function _spFillForm(form, entries) {
    var n = 0;
    entries.forEach(function (e) {
        if (!Object.keys(e.sides).length) return;
        if (form.rows.some(function (r) { return _spMatches(r.criteria, e, 'text'); })) return;
        n++;
        var v = _spBi(e, 'text');
        var empty = form.rows.find(function (r) { return !String(_spRowText(r) || '').trim() && !r.activities && !r.outcomes && !r.verification; });
        if (empty) empty.criteria = v;
        else form.rows.push({ criteria: v, activities: '', outcomes: '', verification: '', date: '' });
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

/** The title of a new sheet: the task statement, in every language it has. */
function _spTitleFor(module, r) {
    var v = biNew();
    if (r.taskId === MB_CC_TASK) { _spCodes().forEach(function (c) { v[c] = _spL('mbSpGroup_cc', c); }); return v; }
    var src = '';
    if (String(r.field).indexOf(MB_TA_CUSTOM) === 0) src = String(r.field).slice(MB_TA_CUSTOM.length);
    else {
        var tasks = (module.taskAnalysisSource && module.taskAnalysisSource.sourceTasks) || [];
        var t = tasks.find(function (x) { return x.id === r.taskId; });
        src = String((t && t.text) || _mbTaskLabel(r.taskId)).replace(/\s+/g, ' ');
    }
    _spCodes().forEach(function (c) {
        var x = _spIn(module, src, c);
        if (x) v[c] = _mbCleanItem(x);
    });
    return v;
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
            out.items += _spFillForm(form, list.map(function (r) { return _spEntry(module, r, kind); }));
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
        if (!_mbBiHasAny(sheet.title)) sheet.title = _spTitleFor(module, g.rows[0]);
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
    var cl = contentLang();
    var noLang = rows.filter(function (r) { return _spTextIn(module, r, cl) == null; }).length;
    if (noLang) msg += ' ' + _spT('mbSpBuiltNoLang', { v0: noLang, v1: _spLangName(cl), v2: _spLangName(_spSrcLang(module)) });
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

/* ── ✨ Translate (3.34.0) ──────────────────────────────────────
   The items, cues and task statements DACUM did not translate into the
   content language are translated with the AI service the mapping
   workspace already uses, and kept on the module (module.mbI18n), next
   to DACUM's own translations: every panel, sheet and export then finds
   them. A later DACUM translation of the same text wins. Sheets already
   built get their empty side filled. */

var MB_SP_LANG_NAMES = { en: 'English', ar: 'Arabic', fr: 'French' };
var MB_SP_STYLE = {
    ar: 'Write Modern Standard Arabic in a formal, professional register. Steps and tasks start with a verbal noun (مصدر). Performance criteria stay passive statements of a result.',
    fr: 'Write professional French. Steps and tasks start with an infinitive verb. Performance criteria stay statements of a result. Use the typographic apostrophe (’).',
    en: 'Write clear professional English. Steps and tasks start with an action verb. Performance criteria stay passive statements of a result.'
};

function _spNeedTranslation(module, lang) {
    var need = [], seen = new Set();
    var want = function (t) {
        t = String(t || '').trim();
        if (!t || seen.has(t)) return;
        seen.add(t);
        if (_spIn(module, t, lang) == null) need.push(t);
    };
    _spRows(module).forEach(function (r) {
        if (!r.dests.length) return;
        if (!(r.edited && r.editLang === lang)) want(r.text);
        if (r.field === 'decisionsCriticalPoints') {
            var d = mbTaDecision(module, r.taskId, r.itemIndex);
            if (d) { want(d.cue); want(d.error); want(d.expert); }
        }
        if (String(r.field).indexOf(MB_TA_CUSTOM) === 0) want(String(r.field).slice(MB_TA_CUSTOM.length));
    });
    ((module.taskAnalysisSource && module.taskAnalysisSource.sourceTasks) || []).forEach(function (t) {
        want(String(t.text || '').replace(/\s+/g, ' '));
    });
    return need;
}

function _spBatches(items) {
    var out = [], cur = [], chars = 0;
    items.forEach(function (t) {
        if (cur.length && (cur.length >= 40 || chars + t.length > 3000)) { out.push(cur); cur = []; chars = 0; }
        cur.push(t); chars += t.length;
    });
    if (cur.length) out.push(cur);
    return out;
}

function _spPrompt(from, to, batch) {
    var src = {};
    batch.forEach(function (t, i) { src[String(i + 1)] = t; });
    return 'You are a professional translator specialised in TVET (technical and vocational education and training) and DACUM occupational analysis.\n' +
        'Translate each value of the SOURCE object from ' + MB_SP_LANG_NAMES[from] + ' into ' + MB_SP_LANG_NAMES[to] + '.\n\n' +
        'RULES\n' +
        '- Translate the meaning faithfully and completely. Do not add, drop, explain, merge or summarise anything.\n' +
        '- Keep numbers, units, codes, standards, abbreviations, brand and model names unchanged, in Latin script with Western digits.\n' +
        '- One line stays one line.\n' +
        '- ' + (MB_SP_STYLE[to] || '') + '\n' +
        '- A value that is a proper name or is already in ' + MB_SP_LANG_NAMES[to] + ' is returned unchanged.\n\n' +
        'SOURCE\n' + JSON.stringify(src) + '\n\n' +
        'OUTPUT FORMAT\nReturn ONLY a JSON object with exactly the same ids: {"t":{"1":"<translation>","2":"<translation>"}}';
}

async function _spCallAI(prompt) {
    var base = (typeof MB_AI_BACKEND_BASE !== 'undefined') ? MB_AI_BACKEND_BASE : 'https://dacum-ai-backend-production.up.railway.app';
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 60000);
    var res;
    try {
        res = await fetch(base + '/api/generate-dacum', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: prompt }), signal: controller.signal
        });
    } finally { clearTimeout(timer); }
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var data = await res.json();
    var raw = '';
    if (data && Array.isArray(data.content)) raw = data.content.map(function (b) { return (b && b.text) || ''; }).join('');
    else if (data && typeof data.text === 'string') raw = data.text;
    else if (data && typeof data === 'object' && data.t) return data;
    var body = raw.trim().replace(/```json\s*/gi, '').replace(/```/g, '').trim();
    try { return JSON.parse(body); } catch (e) {
        var a = body.indexOf('{'), b = body.lastIndexOf('}');
        if (a !== -1 && b > a) return JSON.parse(body.slice(a, b + 1));
        throw e;
    }
}

/** One line of a sheet in `lang`: a panel label, a DACUM text, "Label:
 *  text", or two of those joined by " — "; null when any part has no
 *  version in `lang`. */
function _spLineIn(module, line, lang) {
    var t = String(line || '');
    if (!t.trim()) return t;
    var lab = mbSpLabelIn(t, lang);
    if (lab !== null) return lab;
    var direct = _spIn(module, t, lang);
    if (direct != null) return direct;
    if (t.indexOf(' — ') !== -1) {
        var parts = t.split(' — ').map(function (p) { return _spLineIn(module, p, lang); });
        return parts.every(function (p) { return p != null; }) ? parts.join(' — ') : null;
    }
    return null;
}
function _spValueIn(module, text, lang) {
    var lines = String(text).split('\n').map(function (l) { return _spLineIn(module, l, lang); });
    return lines.every(function (l) { return l != null; }) ? lines.join('\n') : null;
}

/** Sides left empty when a sheet was built and filled now that the text
 *  has a version in `lang`. Returns how many values were filled. */
function _spFillGaps(module, lang) {
    var src = _spSrcLang(module);
    var n = 0;
    var fill = function (v) {
        if (!v || typeof v !== 'object' || !biIs(v)) return;
        if (!String(v[src] || '').trim() || String(v[lang] || '').trim()) return;
        var t = _spValueIn(module, v[src], lang);
        if (t != null) { v[lang] = t; n++; }
    };
    (mbState.learningOutcomesData || []).forEach(function (lo) {
        (lo.infoSheets || []).forEach(function (sh) {
            fill(sh.title);
            (sh.contentSections || []).forEach(function (c) { fill(c.heading); fill(c.text); });
        });
        (lo.activitySheets || []).forEach(function (sh) {
            fill(sh.title);
            (sh.steps || []).forEach(function (x) { fill(x.text); });
            (sh.resources || []).forEach(function (x) { fill(x.name); });
            (sh.criteria || []).forEach(function (x) { fill(x); });
        });
        var form = (mbState.assessmentFormsData || {})[lo.id];
        ((form && form.rows) || []).forEach(function (r) { fill(r.criteria); });
    });
    return n;
}

async function mbSpTranslate(el) {
    var module = _spModule();
    if (!module) return;
    var lang = contentLang(), src = _spSrcLang(module);
    if (lang === src) return;
    if (typeof saveCurrentSheetToLO === 'function') saveCurrentSheetToLO();
    var need = _spNeedTranslation(module, lang);
    var btns = document.querySelectorAll('[data-act="mbSpTranslate"]');
    var setBusy = function (on, txt) {
        btns.forEach(function (b) { b.disabled = on; if (txt) b.textContent = txt; });
    };
    var done = 0;
    if (need.length) {
        setBusy(true, '⏳ ' + _spT('mbSpTranslating', { v0: 0, v1: need.length }));
        try {
            var batches = _spBatches(need);
            for (var i = 0; i < batches.length; i++) {
                var reply = await _spCallAI(_spPrompt(src, lang, batches[i]));
                var t = (reply && (reply.t || reply.translations)) || {};
                if (!module.mbI18n || typeof module.mbI18n !== 'object') module.mbI18n = {};
                if (!module.mbI18n[lang]) module.mbI18n[lang] = {};
                batches[i].forEach(function (orig, k) {
                    var v = t[String(k + 1)];
                    if (typeof v !== 'string' || !v.trim()) return;
                    v = v.trim();
                    if (orig.indexOf('\n') === -1) v = v.replace(/\s*\n\s*/g, ' ');
                    module.mbI18n[lang][orig] = v;
                    done++;
                });
                setBusy(true, '⏳ ' + _spT('mbSpTranslating', { v0: done, v1: need.length }));
            }
        } catch (e) {
            console.warn('[Suggested] translation failed:', e);
            showStatus(_spT('mbSpTranslateFailed'), 'error');
            setBusy(false);
            mbSpRefresh();
            return;
        }
    }
    var filled = _spFillGaps(module, lang);
    if (typeof saveCurrentModuleLOData === 'function') saveCurrentModuleLOData();
    var lo = (mbState.learningOutcomesData || []).find(function (l) { return l.id === mbState.currentLOId; });
    if (lo) {
        if (typeof loadInfoSheetAtIndex === 'function') loadInfoSheetAtIndex(lo, mbState.currentInfoSheetIndex || 0);
        if (typeof loadActivitySheetAtIndex === 'function') loadActivitySheetAtIndex(lo, mbState.currentActivitySheetIndex || 0);
    }
    if (typeof renderAssessmentForms === 'function') renderAssessmentForms();
    mbSpRefresh();
    if (typeof mbLibrarySave === 'function') mbLibrarySave();
    showStatus(_spT('mbSpTranslated', { v0: done, v1: filled }), 'success');
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
/* 3.34.0: the panels and the forms show the side of the content language. */
window.addEventListener('mb:contentlangchange', function () {
    if (typeof renderAssessmentForms === 'function' && document.getElementById('assessment-forms-list')) renderAssessmentForms();
    mbSpRefresh();
});
window.addEventListener('mb:libraryready', function () { mbSpRefresh(); });
window.addEventListener('mb:librarychanged', function () { _spBadges(); });
