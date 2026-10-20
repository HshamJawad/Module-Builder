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
//   3.64.0: the distribution method — default, manual (tick the cells)
//   or AI (one button: choose it and ask). 3.65.0: opened from the
//   «Suggested content» card only.
//
// DISTRIBUTION SETTINGS (⚙️)
//   Where each Task Analysis field goes by default, for the whole
//   project (mbState.cmDefaults, saved with the shared data). Items
//   already approved keep their sheets; the others follow at once.
// ============================================================

if (window.i18n && window.i18n.extend) window.i18n.extend({
    en: {
        cvmHead: 'Distribution method',
        cvmDefault: 'Default',
        cvmManual: 'Manual',
        cvmAi: '🤖 AI',
        cvmDefaultTip: 'Each Task Analysis field goes to the sheets set in ⚙️ Distribution settings.',
        cvmManualTip: 'Nothing is sent anywhere by itself: click the cells of an item (📄 🛠️ ✅) to choose where it goes. The outcome criteria still go to the assessment form.',
        cvmAiTip: 'The AI suggests where each item goes; the suggestions appear in the cells and in Suggested content, to review and approve. Items already approved or built are not changed. Click a cell to change it.',
        cvmAiRun: '🤖 Suggest the distribution with AI',
        cvmAiPartial: 'The items distributed before the error keep the AI suggestion; the others were not changed.',
        cvmAiTipManual: 'Choose «Manual» and tick the cells yourself',
        cvmAiTipDefault: 'Choose «Default» to follow the distribution settings',
        cvmAiBusy: 'The AI is working…',
        cvmAiDone: 'AI suggestion: {v0} items distributed — review them, then approve in Suggested content.',
        cvmAiNone: 'Nothing to distribute: every item is approved or built.',
        cvmAiFail: 'The AI suggestion failed ({v0}). Nothing was changed.',
        cvmCellAdd: 'Send to {v0}',
        cvmCellRemove: 'Remove from {v0}'
    },
    fr: {
        cvmHead: 'Méthode de répartition',
        cvmDefault: 'Par défaut',
        cvmManual: 'Manuelle',
        cvmAi: '🤖 IA',
        cvmDefaultTip: 'Chaque champ de l’analyse des tâches va aux fiches fixées dans ⚙️ Paramètres de répartition.',
        cvmManualTip: 'Rien n’est envoyé de soi-même : cliquez les cases d’un élément (📄 🛠️ ✅) pour choisir où il va. Les critères du résultat vont toujours au formulaire d’évaluation.',
        cvmAiTip: 'L’IA propose où va chaque élément ; les propositions apparaissent dans les cases et dans le Contenu suggéré, à revoir et à valider. Les éléments déjà validés ou construits ne changent pas. Cliquez une case pour la changer.',
        cvmAiRun: '🤖 Proposer la répartition par l’IA',
        cvmAiPartial: 'Les éléments répartis avant l’erreur gardent la proposition de l’IA ; les autres n’ont pas changé.',
        cvmAiTipManual: 'Choisissez « Manuelle » et cochez les cases vous-même',
        cvmAiTipDefault: 'Choisissez « Par défaut » pour suivre les réglages de répartition',
        cvmAiBusy: 'L’IA travaille…',
        cvmAiDone: 'Proposition de l’IA : {v0} éléments répartis — revoyez-les, puis validez dans le Contenu suggéré.',
        cvmAiNone: 'Rien à répartir : chaque élément est validé ou construit.',
        cvmAiFail: 'La proposition de l’IA a échoué ({v0}). Rien n’a changé.',
        cvmCellAdd: 'Envoyer vers {v0}',
        cvmCellRemove: 'Retirer de {v0}'
    },
    ar: {
        cvmHead: 'طريقة التوزيع',
        cvmDefault: 'افتراضي',
        cvmManual: 'يدوي',
        cvmAi: '🤖 الذكاء الاصطناعي',
        cvmDefaultTip: 'كل فقرة من تحليل المهام تذهب إلى الأوراق المحددة في ⚙️ إعداد التوزيع.',
        cvmManualTip: 'لا يُوزَّع شيء تلقائياً: انقر خانات البند (📄 🛠️ ✅) لتختار أين يذهب. معايير المحصلة تذهب دائماً إلى استمارة التقييم.',
        cvmAiTip: 'يقترح الذكاء الاصطناعي أين يذهب كل بند؛ تظهر الاقتراحات في الخانات وفي «المحتوى المقترح» لتراجعها وتصادق عليها. البنود المصادق عليها أو المبنية لا تتغير. انقر خانة لتغييرها.',
        cvmAiRun: '🤖 اقتراح التوزيع بالذكاء الاصطناعي',
        cvmAiPartial: 'البنود التي وُزِّعت قبل الخطأ تبقى على اقتراح الذكاء الاصطناعي، والبقية لم تتغير.',
        cvmAiTipManual: 'اختر «يدوي» وانقر الخانات بنفسك',
        cvmAiTipDefault: 'اختر «افتراضي» ليتبع التوزيع «إعداد التوزيع»',
        cvmAiBusy: 'الذكاء الاصطناعي يعمل…',
        cvmAiDone: 'اقتراح الذكاء الاصطناعي: وُزِّع {v0} بنداً — راجعها ثم صادق عليها في «المحتوى المقترح».',
        cvmAiNone: 'لا يوجد ما يُوزَّع: كل البنود مصادق عليها أو مبنية.',
        cvmAiFail: 'تعذّر اقتراح الذكاء الاصطناعي ({v0}). لم يتغير شيء.',
        cvmCellAdd: 'إرسال إلى {v0}',
        cvmCellRemove: 'إزالة من {v0}'
    }
});

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
    /* 3.64.0: manual and AI distribution — the cells are the choice. A
       built cell still opens its item; the outcome criteria (lopc) go to
       the form only. */
    var pick = mbCmMode() !== 'default' && r.taskId !== MB_LO_PC && r.built.indexOf(kind) === -1;
    if (pick) {
        var on = r.dests.indexOf(kind) !== -1;
        var name = _covT('mbSpKind_' + kind);
        var lab = _covT(on ? 'cvmCellRemove' : 'cvmCellAdd', { v0: name });
        var sym = on ? (r.ok.indexOf(kind) !== -1 ? '●' : '○') : '＋';
        return '<button type="button" class="mb-cov-cell is-pick' + (on ? ' is-on' : '') + '" data-act="mbCovToggle" data-args="' + _covArgs([kind, r.key]) + '"' +
            ' aria-pressed="' + on + '" title="' + _covEsc(lab) + '" aria-label="' + _covEsc(lab) + '">' + sym + '</button>';
    }
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
    /* 3.64.0: the distribution method of the project. */
    var mode = mbCmMode();
    var modes = '<div class="mb-cov-modes" role="radiogroup" aria-label="' + _covEsc(_covT('cvmHead')) + '"><span class="mb-cov-modes-h">' + _covEsc(_covT('cvmHead')) + '</span>' +
        ['default', 'manual', 'ai'].map(function (m) {
            /* 3.65.0: «AI» and «Suggest the distribution» are one button —
               it chooses the method and asks at once; pressed again, it
               asks again. */
            var k = m === 'default' ? 'cvmDefault' : m === 'manual' ? 'cvmManual' : 'cvmAiRun';
            return '<button type="button" role="radio" class="mb-cov-mode' + (m === 'ai' ? ' is-ai' : '') + (m === mode ? ' is-on' : '') + '" aria-checked="' + (m === mode) + '"' +
                (m === 'ai' ? ' id="mb-cov-ai-btn" data-act="mbCovAiRun"' : ' data-act="mbCovSetMode" data-args="' + _covArgs([m]) + '"') + '>' + _covEsc(_covT(k)) + '</button>';
        }).join('') +
        '</div><p class="mb-cov-legend" dir="auto">' + _covEsc(_covT(mode === 'default' ? 'cvmDefaultTip' : mode === 'manual' ? 'cvmManualTip' : 'cvmAiTip')) + '</p>';
    return modes + '<div class="mb-cov-sum"><div class="mb-cov-bar" role="img" aria-label="' + _covEsc(_covT('mbCovPct', { v0: pct })) + '"><span style="width:' + pct + '%"></span></div>' +
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
        '';   /* 3.64.0: the mapping workspace is gone — its AI now suggests the distribution here */
    _covShell(MB_COV_ID, '🗺️ ' + _covEsc(_covT('mbCovTitle')), _covHtml(), foot);
}

/** Repaint the coverage view when it is open. */
function mbCovRender() {
    var ov = document.getElementById(MB_COV_ID);
    if (!ov) return;
    var body = ov.querySelector('.mb-cov-body');
    if (!body) return;
    /* 3.65.1: the pressed button is replaced, which dropped the focus to
       the page — and Escape no longer closed the window. The same
       button (by its data-act and args) takes the focus back. */
    var a = document.activeElement, sel = '';
    if (a && body.contains(a) && a.getAttribute('data-act')) {
        sel = '[data-act="' + a.getAttribute('data-act') + '"]' + (a.getAttribute('data-args') ? '[data-args="' + CSS.escape(a.getAttribute('data-args')) + '"]' : '');
    }
    body.innerHTML = _covHtml();
    if (!sel && !(a && a.isConnected)) sel = '.mb-cov-mode.is-on';
    if (sel) {
        var b = body.querySelector(sel) || ov.querySelector('.mb-cov-box');
        if (b && b.focus) b.focus({ preventScroll: true });
    }
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

/* ── 3.64.0: the distribution method, and choosing by hand ───── */

function _covAfterChange() {
    mbCovRender();
    if (typeof mbSpRefresh === 'function') mbSpRefresh();
    if (typeof mbLibrarySave === 'function') mbLibrarySave();
}

function mbCovSetMode(mode) {
    if (MB_CM_MODES.indexOf(mode) === -1 || mode === mbCmMode()) return;
    mbState.cmMode = mode;
    _covAfterChange();
}

/** 3.65.0: the AI method — chosen and asked in one press. */
function mbCovAiRun() {
    if (mbCmMode() !== 'ai') { mbState.cmMode = 'ai'; _covAfterChange(); }
    return mbCovAiSuggest();
}

/** A cell of Coverage in manual / AI mode: this item goes there, or not. */
function mbCovToggle(kind, key) {
    var module = _mbCurrentModule();
    var r = module && mbContentMapRows(module).find(function (x) { return x.key === key; });
    if (!r || r.built.indexOf(kind) !== -1) return;
    var d = r.dests.indexOf(kind) !== -1 ? r.dests.filter(function (k) { return k !== kind; }) : r.dests.concat([kind]);
    _cmPut(module, r, 'd', d);
    _covAfterChange();
}

/* «🤖 Suggest the distribution»: the items that are neither approved nor
   built, with their field and task, go to the AI service the translation
   already uses (suggest_panel.js _spCallAI); its answer becomes each
   item's destinations — suggestions, still to be approved in the panels. */
function _covAiPrompt(items) {
    var src = {};
    items.forEach(function (it, i) { src[String(i + 1)] = { field: it.field, task: it.task, item: it.text }; });
    return 'You are an expert in competency-based TVET curriculum design (DACUM, CBT).\n' +
        'For each Task Analysis item below, choose where it belongs in a training module:\n' +
        '- "info": knowledge the learner must understand — the information sheet.\n' +
        '- "activity": something the learner does or practises — the activity / job sheet (steps, tools, safety while working).\n' +
        '- "assessment": a criterion or standard the trainer judges competence against — the assessment form.\n' +
        'An item may belong to more than one, or to none ([]) when it adds nothing to the training. Do not rewrite the items.\n\n' +
        'ITEMS\n' + JSON.stringify(src) + '\n\n' +
        'OUTPUT FORMAT\nReturn ONLY a JSON object with exactly the same ids: {"d":{"1":["info","activity"],"2":["assessment"]}}';
}

async function mbCovAiSuggest() {
    var module = _mbCurrentModule();
    if (!module) return;
    var rows = mbContentMapRows(module).filter(function (r) {
        return r.taskId !== MB_LO_PC && !r.ok.length && !r.built.length;
    });
    if (!rows.length) { showStatus(_covT('cvmAiNone'), 'info'); return; }
    var btn = document.getElementById('mb-cov-ai-btn');
    if (btn) { btn.disabled = true; btn.textContent = _covT('cvmAiBusy'); }
    var done = 0;
    try {
        for (var i = 0; i < rows.length; i += 80) {
            var batch = rows.slice(i, i + 80);
            var items = batch.map(function (r) {
                return { field: _mbFieldLabel(r.field), task: _mbTaskLabel(r.taskId), text: _mbCleanItem(r.edited || r.text) };
            });
            var out = await _spCallAI(_covAiPrompt(items));
            var d = (out && out.d) || {};
            batch.forEach(function (r, j) {
                var kinds = _cmCleanKinds(d[String(j + 1)]);
                if (!kinds) return;
                _cmPut(module, r, 'd', kinds);
                done++;
            });
        }
        showStatus(_covT('cvmAiDone', { v0: done }), 'success');
    } catch (e) {
        console.warn('[Coverage] AI distribution failed:', e);
        /* 3.65.0: the AI service warning, as in DACUM Live Pro. Batches
           already applied stay; the line says so. */
        if (typeof mbShowAIError === 'function') mbShowAIError(e, { safeKey: done ? 'cvmAiPartial' : 'aiSvcSafeGeneric', tipKeys: ['cvmAiTipManual', 'cvmAiTipDefault'] });
        else showStatus(_covT('cvmAiFail', { v0: (e && e.message) || e }), 'error');
    } finally {
        _covAfterChange();
    }
}

/* ── Distribution settings ─────────────────────────────────── */

function _covFieldLabel(group) {
    if (group === 'custom') return _covT('mbSpGroup_custom');
    if (group === 'cc') return _covT('mbSpGroup_cc');
    if (group === 'lopc') return _covT('mbSpSrcLoPc');
    return _mbFieldLabel(group);
}

/* 3.62.0: the mark a field is written as (custom_marks.js) — the column
   beside the information sheet's. */
function _covMarkCell(g, cur) {
    if (typeof MB_CM_MARK_FIELDS === 'undefined' || MB_CM_MARK_FIELDS.indexOf(g) === -1) return '<span></span>';
    return '<span><select class="mb-cov-mark" data-def-mark="' + g + '" aria-label="' + _covEsc(_covFieldLabel(g) + ' → ' + _covT('cmkColHead')) + '">' +
        mbMarkOptionsHtml(cur || '') + '<option value="__custom">' + _covEsc(_covT('cmkCustom')) + '</option></select></span>';
}

function _covDefaultsHtml(draft, marks) {
    marks = marks || {};
    var head = '<div class="mb-cov-def is-head" aria-hidden="true"><span>' + _covEsc(_covT('mbSpDefField')) + '</span>' +
        '<span>🏷️ <span class="mb-cov-kl">' + _covEsc(_covT('cmkColHead')) + '</span></span>' +
        MB_CM_KINDS.map(function (k) { return '<span title="' + _covEsc(_covT('mbSpKind_' + k)) + '">' + MB_CM_ICON[k] + ' <span class="mb-cov-kl">' + _covEsc(_covT('mbSpKindShort_' + k)) + '</span></span>'; }).join('') + '</div>';
    var rows = MB_CM_DEFAULT_FIELDS.map(function (g) {
        var cur = draft[g];
        var changed = !_cmSameKinds(cur, MB_CM_DEFAULTS[g] || ['info']);
        return '<div class="mb-cov-def' + (changed ? ' is-changed' : '') + '"><span dir="auto">' + (MB_SP_FIELD_ICON[g] || '•') + ' ' + _covEsc(_covFieldLabel(g)) +
            (changed ? ' <em>' + _covEsc(_covT('mbSpDefChanged')) + '</em>' : '') + '</span>' +
            _covMarkCell(g, marks[g]) +
            MB_CM_KINDS.map(function (k) {
                var lab = _covFieldLabel(g) + ' → ' + _covT('mbSpKind_' + k);
                return '<span><input type="checkbox" aria-label="' + _covEsc(lab) + '" data-def-group="' + g + '" data-def-kind="' + k + '"' +
                    (cur.indexOf(k) !== -1 ? ' checked' : '') + (g === 'lopc' && k !== 'assessment' ? ' disabled' : '') + '></span>';
            }).join('') + '</div>';
    }).join('');
    return '<p class="mb-cov-legend" dir="auto">' + _covEsc(_covT('mbSpDefIntro')) + '</p>' +
        '<p class="mb-cov-legend" dir="auto">🏷️ ' + _covEsc(_covT('cmkIntro')) + '</p>' + head + rows;
}

function _covDraft() {
    var d = {};
    MB_CM_DEFAULT_FIELDS.forEach(function (g) { d[g] = mbCmFieldKinds(g); });
    return d;
}

function mbCovDefaults() {
    mbCovClose(MB_COV_ID);
    var draft = _covDraft();
    var marks = {};
    if (typeof MB_CM_MARK_FIELDS !== 'undefined') MB_CM_MARK_FIELDS.forEach(function (g) { marks[g] = mbCmFieldMark(g); });
    var foot = '<button type="button" class="mb-sp-btn is-quiet" data-act="mbCovDefaultsReset">↺ ' + _covEsc(_covT('mbSpDefReset')) + '</button>' +
        /* 3.62.0 */
        '<button type="button" class="mb-sp-btn is-quiet" data-act="mbCovMarksSuggest">' + _covEsc(_covT('cmkSuggest')) + '</button>' +
        '<button type="button" class="mb-sp-btn is-quiet" data-act="mbManageCustomMarks">' + _covEsc(_covT('cmkManage')) + '</button>' +
        '<span class="mb-sp-gap"></span>' +
        '<button type="button" class="mb-sp-btn" data-act="mbCovClose" data-args="' + _covArgs(['mb-def-overlay']) + '">' + _covEsc(_covT('mbSpCancel')) + '</button>' +
        '<button type="button" class="mb-sp-btn is-main" data-act="mbCovDefaultsSave">💾 ' + _covEsc(_covT('mbSpSave')) + '</button>';
    _covShell('mb-def-overlay', '⚙️ ' + _covEsc(_covT('mbSpDefaultsTitle')), _covDefaultsHtml(draft, marks), foot);
}

/* 3.62.0 — the marks column. */
function _covReadMarks() {
    var ov = document.getElementById('mb-def-overlay');
    var m = {};
    if (!ov) return m;
    ov.querySelectorAll('select[data-def-mark]').forEach(function (s) {
        m[s.getAttribute('data-def-mark')] = s.value === '__custom' ? '' : s.value;
    });
    return m;
}
/** Repaint the options of every mark select (a mark was added, renamed
 *  or deleted), keeping what each one shows. */
function mbCovRepaintMarks() {
    var ov = document.getElementById('mb-def-overlay');
    if (!ov) return;
    ov.querySelectorAll('select[data-def-mark]').forEach(function (s) {
        var v = s.value;
        s.innerHTML = mbMarkOptionsHtml('') + '<option value="__custom">' + _covEsc(_covT('cmkCustom')) + '</option>';
        s.value = (v && v !== '__custom' && mbFindMarkType(v)) ? v : '';
    });
}
/** «🏷️ Suggested marks»: the column filled with the suggested marks. */
function mbCovMarksSuggest() {
    var ov = document.getElementById('mb-def-overlay');
    if (!ov) return;
    ov.querySelectorAll('select[data-def-mark]').forEach(function (s) {
        var k = MB_CM_MARK_SUGGEST[s.getAttribute('data-def-mark')];
        if (k) s.value = k;
    });
}
if (typeof document !== 'undefined') {
    /* «➕ Custom mark…» in a select opens the window, then picks the new mark. */
    document.addEventListener('change', function (e) {
        var s = e.target;
        if (!s || !s.matches || !s.matches('select[data-def-mark]') || s.value !== '__custom') return;
        s.value = '';
        mbCustomMarkDialog(null).then(function (key) {
            mbCovRepaintMarks();
            if (key) s.value = key;
        });
    });
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
    ov.querySelector('.mb-cov-body').innerHTML = _covDefaultsHtml(d, {});   // 3.62.0: no marks either
}

function mbCovDefaultsSave() {
    var d = _covReadDraft();
    if (!d) return;
    var own = {};
    MB_CM_DEFAULT_FIELDS.forEach(function (g) {
        if (!_cmSameKinds(d[g], MB_CM_DEFAULTS[g] || ['info'])) own[g] = d[g];
    });
    mbState.cmDefaults = own;
    /* 3.62.0: the marks column — only the fields given a mark. */
    var mk = _covReadMarks(), cm = {};
    Object.keys(mk).forEach(function (g) { if (mk[g]) cm[g] = mk[g]; });
    mbState.cmMarks = cm;
    mbCovClose('mb-def-overlay');
    if (typeof mbSpRefresh === 'function') mbSpRefresh();
    if (typeof mbLibrarySave === 'function') mbLibrarySave();
    showStatus(_covT('mbSpDefSaved'), 'success');
}
