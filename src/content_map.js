// ============================================================
// /src/content_map.js — Content map (3.30.0)
// ------------------------------------------------------------
// WHY
//   One task often serves several Learning Outcomes, and the same
//   knowledge or safety item often appears under several tasks. Built
//   outcome by outcome, the sheets then repeat each other. The map
//   lists every Task Analysis item of the module ONCE, before any
//   sheet is written, and asks two questions per item:
//     • which outcome owns it (it is written there only), and
//     • where it goes: information sheet, activity / job sheet,
//       assessment, or not needed.
//
// SUGGESTIONS (no AI)
//   Destination by the kind of item:
//     knowledge, safety, conditions, decisions, common errors and the
//     sections added in DACUM → information sheet;
//     performance steps, skills, tools → activity / job sheet;
//     performance criteria, standard, worker behaviours and the
//     competency criteria → assessment.
//   Owner outcome: the outcome whose criteria name the task directly,
//   else the one whose statement and criteria share the most words with
//   the task (the same idea as "≈ closest" in the browser below).
//   The same item under a second task (same words) is marked "＝ same
//   as …" and suggested as not needed: it is written once.
//
// WHAT IS STORED
//   module.contentMap = { v: 1, rows: { <selKey>: { t, lo?, dest? } } }
//   Only the choices the user made; everything else is the suggestion,
//   recomputed. `t` is the item's text: when DACUM sends the module
//   again and the item at that place changed, the old choice is ignored.
//
// STATUS
//   Read from the module itself: an item already on a sheet or an
//   assessment form (by its words, or by the selections Approve & Build
//   recorded on the sheet) shows where; on two or more → "⚠ written N
//   times". An item in the draft below shows "📝 draft".
//
// "SEE ALSO" (3.31.0): every other outcome that needs a written item
// points to its sheet — shown on the row (↗ LO2), in the outcome's
// Information / Activity tab, and in the Word, HTML and PDF exports
// ("See also — Information Sheet 1.2 «…» (Learning Outcome 1): …").
//
// "Group into draft sheets" turns the decided items that are not
// written yet into draft items of the Training Structure proposal — one
// per outcome + destination + task (one assessment per outcome) — and
// the existing flow takes over: titles, moves, ✓ Approve & Build.
// ============================================================

var MB_CM_DEST_BY_FIELD = {
    requiredKnowledge: 'info', safetyOSH: 'info', conditionsWorkEnvironment: 'info',
    decisionsCriticalPoints: 'info', commonErrorsTroubleshooting: 'info',
    performanceSteps: 'activity', requiredSkills: 'activity', toolsEquipmentMaterials: 'activity',
    /* 3.32.0: a task's own criteria, its standard and the behaviours
       observed go to the checklist of the task's activity sheet. The
       assessment form takes the OUTCOME's criteria as DACUM sent them
       (see _cmMissingPcs), to be reworded there as assessment criteria. */
    performanceCriteria: 'activity', performanceStandard: 'activity', workerBehaviours: 'activity'
};
var MB_CM_DESTS = ['info', 'activity', 'assessment', 'none'];
var MB_CM_ICON = { info: '📄', activity: '🛠️', assessment: '✅', none: '—' };

function _cmT(k, vars) {
    return vars ? window.i18n.tf(k, vars) : window.i18n.t(k);
}

function _cmLos(module) {
    if (module && module.id === mbState.currentModuleId && Array.isArray(mbState.learningOutcomesData) && mbState.learningOutcomesData.length) {
        return mbState.learningOutcomesData;
    }
    return (module && module.learningOutcomes) || [];
}

function _cmLoLabel(lo) {
    return lo ? String(lo.number || (typeof loTitleText === 'function' ? loTitleText(lo) : lo.id)) : '';
}

function _cmDefaultDest(field, taskId) {
    if (taskId === MB_CC_TASK) return 'assessment';
    if (String(field).indexOf(MB_TA_CUSTOM) === 0) return 'info';
    return MB_CM_DEST_BY_FIELD[field] || 'info';
}

var _CM_STOP = new Set(['the', 'and', 'for', 'are', 'with', 'from', 'that', 'this', 'into', 'all', 'its', 'per', 'any',
    'according', 'procedures', 'procedure', 'requirements', 'standards', 'specifications', 'best', 'practices',
    'les', 'des', 'aux', 'pour', 'dans', 'une', 'selon', 'avec', 'sur', 'par',
    'على', 'في', 'من', 'إلى', 'الى', 'مع', 'وفق', 'حسب', 'التي', 'الذي']);
function _cmWords(s) {
    return new Set(String(s || '').toLowerCase().split(/[^\p{L}\p{N}]+/u)
        .filter(function (w) { return w.length >= 3 && !_CM_STOP.has(w); }));
}

/** taskId → suggested owner outcome id ('' when none traces to it). */
function _cmOwnerByTask(module, taskIds) {
    var los = _cmLos(module);
    var tasks = (module.taskAnalysisSource && module.taskAnalysisSource.sourceTasks) || [];
    var loInfo = los.map(function (lo) {
        var pcs = (lo.performanceCriteria || []).filter(function (pc) { return pc && typeof pc === 'object'; });
        var text = [lo.statement || '', typeof lo.title === 'string' ? lo.title : loTitleText(lo)]
            .concat(pcs.map(_mbPcText)).join(' ');
        return { lo: lo, words: _cmWords(text), traced: _mbLoTaskIds(module, lo.id),
                 direct: new Set(pcs.filter(function (pc) { return pc.taskId; }).map(function (pc) { return pc.taskId; })) };
    });
    var out = {};
    taskIds.forEach(function (tid) {
        var t = tasks.find(function (x) { return x.id === tid; });
        var tw = _cmWords(t && t.text);
        var best = '', bestScore = -1;
        loInfo.forEach(function (li) {
            if (!li.traced.has(tid)) return;
            var n = 0; tw.forEach(function (w) { if (li.words.has(w)) n++; });
            var score = (li.direct.has(tid) ? 1000 : 0) + n;
            if (score > bestScore) { bestScore = score; best = li.lo.id; }
        });
        if (!best && los.length === 1) best = los[0].id;
        out[tid] = best;
    });
    return out;
}

/** A Task Analysis criterion that an outcome lists itself belongs to it. */
function _cmOwnerOfCriterion(module, taskId, text) {
    var n = _mbNorm(text);
    var lo = _cmLos(module).find(function (l) {
        return (l.performanceCriteria || []).some(function (pc) {
            return pc && pc.taskId === taskId && _mbNorm(_mbPcText(pc)) === n;
        });
    });
    return lo ? lo.id : '';
}

/** Where the module's items are already written. */
function _cmWrittenIndex(module) {
    var lang = contentLang();
    var byText = new Map(), byKey = new Map();
    var add = function (map, k, place) {
        if (!k) return;
        var arr = map.get(k);
        if (!arr) { arr = []; map.set(k, arr); }
        if (!arr.some(function (p) { return p.id === place.id; })) arr.push(place);
    };
    var str = function (v) { return (typeof biGetStrict === 'function') ? biGetStrict(v, lang) : (typeof v === 'string' ? v : ''); };
    _cmLos(module).forEach(function (lo) {
        (lo.infoSheets || []).forEach(function (sh, i) {
            var place = { id: 'i|' + lo.id + '|' + i, kind: 'info', lo: lo, n: i + 1, title: biGet(sh.title, lang) || '' };
            (sh.contentSections || []).forEach(function (c) { add(byText, _mbNorm(str(c.heading)), place); });
            ((sh._aiSource && sh._aiSource.sourceSelections) || []).forEach(function (s) { add(byKey, _mbSelKey(s), place); });
        });
        (lo.activitySheets || []).forEach(function (sh, i) {
            var place = { id: 'a|' + lo.id + '|' + i, kind: 'activity', lo: lo, n: i + 1, title: biGet(sh.title, lang) || '' };
            (sh.steps || []).forEach(function (x) { add(byText, _mbNorm(str(x.text)), place); });
            (sh.resources || []).forEach(function (x) { add(byText, _mbNorm(str(x.name)), place); });
            /* The sheet's criteria checklist repeats the outcome's criteria
               on purpose (practice against what is assessed): it is not a
               second writing of them. A criterion sent to this sheet from
               the map is still found, by its selection. */
            ((sh._aiSource && sh._aiSource.sourceSelections) || []).forEach(function (s) { add(byKey, _mbSelKey(s), place); });
        });
        var form = (mbState.assessmentFormsData || {})[lo.id];
        if (form && Array.isArray(form.rows)) {
            var place = { id: 's|' + lo.id, kind: 'assessment', lo: lo, n: 0, title: '' };
            form.rows.forEach(function (r) {
                var c = r && r.criteria;
                add(byText, _mbNorm(typeof c === 'string' ? c : str(c)), place);
            });
            /* 3.32.0: rows reworded in the form are still known by link. */
            ((form._aiSource && form._aiSource.keys) || []).forEach(function (k) { add(byKey, k, place); });
        }
    });
    return { byText: byText, byKey: byKey };
}

/** The outcome's criteria (as DACUM sent them) not in its assessment
 *  form yet — neither recorded there by link nor present in words. */
function _cmMissingPcs(module, lo) {
    var pcs = (lo.performanceCriteria || []).filter(function (pc) { return pc && typeof pc === 'object' && pc.id && _mbPcText(pc); });
    if (!pcs.length) return [];
    var form = (mbState.assessmentFormsData || {})[lo.id];
    var done = new Set((form && form._aiSource && form._aiSource.pcIds) || []);
    var lang = contentLang();
    var words = new Set(((form && form.rows) || []).map(function (r) {
        var c = r && r.criteria;
        return _mbNorm(typeof c === 'string' ? c : (typeof biGetStrict === 'function' ? biGetStrict(c, lang) : ''));
    }));
    return pcs.filter(function (pc) { return !done.has(pc.id) && !words.has(_mbNorm(_mbPcText(pc))); });
}

function _cmStore(module) {
    if (!module.contentMap || typeof module.contentMap !== 'object') module.contentMap = { v: 1, rows: {} };
    if (!module.contentMap.rows || typeof module.contentMap.rows !== 'object') module.contentMap.rows = {};
    return module.contentMap;
}

/** Every row of the map, suggestion and choice applied, in reading order. */
function mbContentMapRows(module) {
    if (!module) return [];
    var src = module.taskAnalysisSource || {};
    var taskIds = (src.sourceTaskIds || []).filter(function (id) { return src.taskAnalysis && src.taskAnalysis[id]; });
    var owner = _cmOwnerByTask(module, taskIds);
    /* 3.31.0: outcomes whose own criteria name a task (Task Analysis
       criteria) — they use that task's items, wherever written. */
    var direct = {};
    _cmLos(module).forEach(function (lo) {
        (lo.performanceCriteria || []).forEach(function (pc) {
            if (!pc || typeof pc !== 'object' || !pc.taskId) return;
            (direct[pc.taskId] = direct[pc.taskId] || []);
            if (direct[pc.taskId].indexOf(lo.id) === -1) direct[pc.taskId].push(lo.id);
        });
    });
    var saved = (module.contentMap && module.contentMap.rows) || {};
    var firstByText = new Map();
    var rows = [];
    var push = function (taskId, field, idx, text, sugLo) {
        var key = _mbSelKey({ taskId: taskId, field: field, itemIndex: idx });
        var norm = _mbNorm(text);
        var same = firstByText.get(norm);
        if (!same && norm) firstByText.set(norm, { key: key, taskId: taskId });
        var sugDest = same ? 'none' : _cmDefaultDest(field, taskId);
        var s = saved[key];
        var mine = !!(s && s.t === text);
        var lo = (mine && s.lo !== undefined) ? s.lo : sugLo;
        var dest = (mine && s.dest) ? s.dest : sugDest;
        var arr = function (v) { return Array.isArray(v) ? v.filter(function (x) { return typeof x === 'string'; }) : []; };
        rows.push({ key: key, taskId: taskId, field: field, itemIndex: idx, text: text,
                    lo: lo, dest: dest, sugLo: sugLo, sugDest: sugDest,
                    taskLo: taskId === MB_CC_TASK ? '' : (owner[taskId] || ''),
                    directLos: direct[taskId] || [],
                    refAdd: mine ? arr(s.ra) : [], refDel: mine ? arr(s.rd) : [],
                    mine: mine && (lo !== sugLo || dest !== sugDest || arr(s.ra).length > 0 || arr(s.rd).length > 0),
                    same: same || null });
    };
    taskIds.forEach(function (tid) {
        _mbTaskFields(module, tid).forEach(function (field) {
            _mbGetFieldItems(module, tid, field).forEach(function (text, idx) {
                var sug = owner[tid] || '';
                if (field === 'performanceCriteria') sug = _cmOwnerOfCriterion(module, tid, text) || sug;
                push(tid, field, idx, text, sug);
            });
        });
    });
    _mbCompGroups(module).forEach(function (list, comp) {
        list.forEach(function (e, idx) { push(MB_CC_TASK, 'cc:' + comp, idx, e.text, e.loIds[0] || ''); });
    });
    /* Status. */
    var idx = _cmWrittenIndex(module);
    var drafts = _mbAllAssignments();
    rows.forEach(function (r) {
        var places = (idx.byKey.get(r.key) || []).slice();
        (idx.byText.get(_mbNorm(r.text)) || []).forEach(function (p) {
            if (!places.some(function (q) { return q.id === p.id; })) places.push(p);
        });
        r.places = places;
        r.draft = drafts[r.key] || null;
        /* 3.32.0: a criterion on its activity sheet's checklist AND in the
           assessment form is one writing of each kind, not a repetition. */
        var nSheets = places.filter(function (p) { return p.kind !== 'assessment'; }).length;
        var nForms = places.length - nSheets;
        r.twice = nSheets > 1 || nForms > 1;
        r.done = r.dest === 'none' || places.some(function (p) { return p.kind === r.dest; });
        r.issue = r.twice || (r.dest !== 'none' && (!r.lo || (r.same && !places.length && !r.draft)));
        _cmRowRefs(r);
    });
    return rows;
}

/* ── "See also" (3.31.0) ───────────────────────────────────────
   An item is written once, in one outcome. Every other outcome that
   needs it points to that sheet instead of repeating it:
     • the outcome the item's task belongs to (the map's suggestion for
       the task), when the item was written elsewhere;
     • the outcomes whose own criteria name the task;
     • for "＝ same as …" items, the outcome of the row itself;
   plus the outcomes the user added on the row, minus those removed.
   Only information and activity sheets are pointed to. */
function _cmRowRefs(r) {
    r.refs = [];
    var sheets = r.places.filter(function (p) { return p.kind === 'info' || p.kind === 'activity'; });
    r.refPossible = sheets.length > 0;
    if (!sheets.length) return;
    var written = new Set(r.places.map(function (p) { return p.lo.id; }));
    var need = [];
    var want = function (id) { if (id && need.indexOf(id) === -1) need.push(id); };
    if (r.dest !== 'none' || r.same) { want(r.lo); want(r.taskLo); r.directLos.forEach(want); }
    r.refAdd.forEach(want);
    need.filter(function (id) { return !written.has(id) && r.refDel.indexOf(id) === -1; }).forEach(function (id) {
        sheets.forEach(function (p) { r.refs.push({ lo: id, place: p }); });
    });
}

/** target outcome id → [{ ownerLoId, kind, index, items: [text] }]
 *  for the module given (normally the one open). */
function mbContentMapRefs(module) {
    var out = {};
    if (!module) return out;
    mbContentMapRows(module).forEach(function (r) {
        r.refs.forEach(function (ref) {
            var list = out[ref.lo] = out[ref.lo] || [];
            var p = ref.place;
            var e = list.find(function (x) { return x.ownerLoId === p.lo.id && x.kind === p.kind && x.index === p.n - 1; });
            if (!e) { e = { ownerLoId: p.lo.id, kind: p.kind, index: p.n - 1, items: [] }; list.push(e); }
            if (e.items.indexOf(r.text) === -1) e.items.push(r.text);
        });
    });
    return out;
}

var _CM_SEE = {
    en: { head: 'See also — written in another outcome', info: 'Information Sheet', activity: 'Activity / Job Sheet', outcome: 'Learning Outcome {v0}' },
    fr: { head: 'Voir aussi — rédigé dans un autre résultat', info: 'Fiche d’information', activity: 'Fiche d’activité / de travail', outcome: 'Résultat d’apprentissage {v0}' },
    ar: { head: 'انظر أيضاً — مكتوب في محصلة أخرى', info: 'ورقة المعلومات', activity: 'ورقة النشاط / العمل', outcome: 'المحصلة {v0}' }
};
function mbSeeAlsoLabel(key, lang, v0) {
    var L = _CM_SEE[lang] || _CM_SEE.en;
    return String(L[key] || _CM_SEE.en[key] || key).replace('{v0}', v0 == null ? '' : v0);
}

/**
 * The "see also" lines of one outcome, ready to print, in `lang`.
 * `los` is the outcome list the exporter prints (flattened to `lang`):
 * the sheet number and title are read there, and a sheet the export
 * leaves out (no title) is not pointed to.
 *   [{ kind, number, title, outcomeIndex, sheetPos, items: [text], line }]
 */
function mbSeeAlsoFor(loId, lang, los, refs) {
    if (!refs) refs = mbContentMapRefs(_mbCurrentModule());
    var list = refs[loId] || [];
    var strOf = function (v) { return typeof v === 'string' ? v : ((typeof biGet === 'function' && v) ? biGet(v, lang) : ''); };
    var out = [];
    list.forEach(function (e) {
        var loIndex = (los || []).findIndex(function (l) { return l && l.id === e.ownerLoId; });
        if (loIndex < 0) return;
        var lo = los[loIndex];
        var sheets = (e.kind === 'info' ? lo.infoSheets : lo.activitySheets) || [];
        var sh = sheets[e.index];
        var title = sh ? strOf(sh.title).trim() : '';
        if (!title) return;
        var number = strOf(sh.sheetNumber) || (typeof getAutoSheetNumber === 'function' ? getAutoSheetNumber(loIndex, e.index) : String(e.index + 1));
        var sheetPos = 0;
        for (var i = 0; i < e.index; i++) if (strOf(sheets[i] && sheets[i].title).trim()) sheetPos++;
        var items = e.items.map(function (t) {
            return _mbCleanItem(typeof mbDacumText === 'function' ? mbDacumText(t, lang) : t);
        }).filter(function (t) { return t && _mbNorm(t) !== _mbNorm(title); });
        /* "3-1" stays "3-1" inside Arabic text (LRM on both sides). */
        var num = (typeof biIsRtl === 'function' ? biIsRtl(lang) : lang === 'ar') ? '\u200E' + number + '\u200E' : number;
        var line = mbSeeAlsoLabel(e.kind, lang) + ' ' + num + ' — «' + title + '» (' +
            mbSeeAlsoLabel('outcome', lang, loIndex + 1) + ')' + (items.length ? ': ' + items.join(lang === 'ar' ? '، ' : '; ') : '');
        out.push({ kind: e.kind, number: number, title: title, outcomeIndex: loIndex + 1, sheetPos: sheetPos, items: items, line: line });
    });
    return out;
}

/* In the Information / Activity tab: what this outcome uses from the
   sheets of other outcomes. */
function mbRenderSeeAlso(kind) {
    var host = document.getElementById('mb-seealso-' + kind);
    if (!host) return;
    var module = _mbCurrentModule();
    var lo = module && _cmLos(module).find(function (l) { return l.id === mbState.currentLOId; });
    if (!lo || !module.taskAnalysisSource) { host.innerHTML = ''; return; }
    var lang = contentLang();
    var lines;
    try { lines = mbSeeAlsoFor(lo.id, lang, _cmLos(module)); } catch (e) { lines = []; }
    if (!lines.length) { host.innerHTML = ''; return; }
    host.innerHTML = '<div class="mb-seealso"><div class="mb-seealso-head" dir="auto">📎 ' + escapeHtml(_cmT('mbSeeAlsoApp')) + '</div><ul>' +
        lines.map(function (l) { return '<li dir="auto">' + escapeHtml(l.line) + '</li>'; }).join('') + '</ul>' +
        '<div class="mb-seealso-note" dir="auto">' + escapeHtml(_cmT('mbSeeAlsoNote')) + '</div></div>';
}

/* ── Rendering ─────────────────────────────────────────────── */

function _cmPlaceText(p) {
    var lo = _cmLoLabel(p.lo);
    if (p.kind === 'assessment') return lo + ' · ' + _cmT('mbCmKindAssessment');
    var k = _cmT(p.kind === 'info' ? 'mbCmKindInfo' : 'mbCmKindActivity', { v0: p.n });
    return lo + ' · ' + k + (p.title ? ' “' + p.title + '”' : '');
}

function _cmStatusHtml(r) {
    var chip = function (cls, txt, tip) {
        return '<span class="mb-cm-st ' + cls + '" dir="auto" title="' + escapeHtml(tip || txt) + '">' + escapeHtml(txt) + '</span>';
    };
    if (r.twice) {
        var all = r.places.map(_cmPlaceText).join(' • ');
        return chip('is-warn', _cmT('mbCmStTwice', { v0: r.places.length }), all) +
            '<span class="mb-cm-where" dir="auto">' + escapeHtml(all) + '</span>';
    }
    if (r.places.length) {
        var more = (!r.done && !r.draft && r.lo)
            ? chip('is-new', '＋ ' + _cmT('mbCmStAddTo', { v0: _cmT('mbCmDest_' + r.dest) })) : '';
        if (!r.done && r.draft) more = chip('is-draft', '📝 ' + _cmT('mbCmStDraft', { v0: r.draft.title }));
        return chip('is-done', '✓ ' + r.places.map(_cmPlaceText).join(' + ')) + more + _cmRefsHtml(r);
    }
    if (r.draft) return chip('is-draft', '📝 ' + _cmT('mbCmStDraft', { v0: r.draft.title }));
    if (r.dest === 'none') {
        return r.same ? chip('is-same', '＝ ' + _cmT('mbCmStSame', { v0: _mbTaskLabel(r.same.taskId) })) : chip('is-none', _cmT('mbCmStNotNeeded'));
    }
    if (!r.lo) return chip('is-warn', '⚠ ' + _cmT('mbCmStNoLo'));
    if (r.same) return chip('is-warn', '⚠ ' + _cmT('mbCmStSameTwice', { v0: _mbTaskLabel(r.same.taskId) }));
    return chip('is-new', _cmT('mbCmStNew'));
}

/* 3.31.0: "↗ LO2" — this outcome points to the sheet; ✕ removes it.
   "＋↗" adds another outcome that should point to it. */
function _cmRefsHtml(r) {
    if (!r.refPossible) return '';
    var los = _cmLos(_mbCurrentModule());
    var label = function (id) { return _cmLoLabel(los.find(function (l) { return l.id === id; })) || id; };
    var shown = [];
    r.refs.forEach(function (x) { if (shown.indexOf(x.lo) === -1) shown.push(x.lo); });
    var written = new Set(r.places.map(function (p) { return p.lo.id; }));
    var chips = shown.map(function (id) {
        return '<span class="mb-cm-ref" title="' + escapeHtml(_cmT('mbCmRefTip', { v0: label(id) })) + '">↗ ' + escapeHtml(label(id)) +
            '<button type="button" data-act="mbCmRef" data-args="' + _cmArgs([r.key, id, 'off']) + '" aria-label="' + escapeHtml(_cmT('mbCmRefRemove')) + '">✕</button></span>';
    }).join('');
    var addable = los.filter(function (l) { return !written.has(l.id) && shown.indexOf(l.id) === -1; });
    var add = addable.length ? '<select class="mb-cm-refadd" data-act="mbCmRef" data-on="change" data-args="' + _cmArgs([r.key, '$value', 'on']) + '" title="' + escapeHtml(_cmT('mbCmRefAdd')) + '">' +
        '<option value="">＋↗</option>' + addable.map(function (l) { return '<option value="' + escapeHtml(l.id) + '">' + escapeHtml(_cmLoLabel(l)) + '</option>'; }).join('') + '</select>' : '';
    return '<span class="mb-cm-refs">' + chips + add + '</span>';
}

function _cmLoOptions(los, cur, withNone) {
    return (withNone ? '<option value=""' + (cur ? '' : ' selected') + '>' + escapeHtml(_cmT('mbCmNoLo')) + '</option>' : '') +
        los.map(function (lo) {
            return '<option value="' + escapeHtml(lo.id) + '"' + (lo.id === cur ? ' selected' : '') + '>' + escapeHtml(_cmLoLabel(lo)) + '</option>';
        }).join('');
}

function _cmArgs(arr) { return escapeHtml(JSON.stringify(arr)); }

function mbRenderContentMap() {
    var host = document.getElementById('mb-content-map');
    if (!host) return;
    var module = _mbCurrentModule();
    var hasTa = !!(module && module.taskAnalysisSource && module.taskAnalysisSource.taskAnalysis &&
        Object.keys(module.taskAnalysisSource.taskAnalysis).length);
    if (!module || (!hasTa && !_mbCompGroups(module).size)) { host.innerHTML = ''; return; }

    var los = _cmLos(module);
    var rows = mbContentMapRows(module);
    if (!rows.length) { host.innerHTML = ''; return; }

    var filter = mbState.cmFilter || '';
    if (filter && filter !== '!' && !los.some(function (l) { return l.id === filter; })) filter = mbState.cmFilter = '';
    var shown = rows.filter(function (r) {
        if (filter === '!') return r.issue;
        if (filter) return r.lo === filter;
        return true;
    });

    var count = { info: 0, activity: 0, assessment: 0, none: 0 }, issues = 0, todo = 0;
    rows.forEach(function (r) {
        count[r.dest] = (count[r.dest] || 0) + 1;
        if (r.issue) issues++;
        /* A competency criterion for the assessment is counted with its
           outcome's criteria below. */
        if (r.dest !== 'none' && r.lo && !r.done && !r.draft && !(r.taskId === MB_CC_TASK && r.dest === 'assessment')) todo++;
    });
    los.forEach(function (lo) { todo += _cmMissingPcs(module, lo).length; });
    var sum = MB_CM_DESTS.map(function (d) {
        return '<span class="mb-cm-sum" title="' + escapeHtml(_cmT('mbCmDest_' + d)) + '">' + MB_CM_ICON[d] + ' ' + count[d] + '</span>';
    }).join('') + (issues ? '<span class="mb-cm-sum is-warn" title="' + escapeHtml(_cmT('mbCmFilterIssues')) + '">⚠ ' + issues + '</span>' : '');

    var byTask = [];
    shown.forEach(function (r) {
        var g = byTask[byTask.length - 1];
        if (!g || g.taskId !== r.taskId) { g = { taskId: r.taskId, rows: [] }; byTask.push(g); }
        g.rows.push(r);
    });
    var tasks = (module.taskAnalysisSource && module.taskAnalysisSource.sourceTasks) || [];

    var groupsHtml = byTask.map(function (g) {
        var t = tasks.find(function (x) { return x.id === g.taskId; });
        var head = g.taskId === MB_CC_TASK ? '🎯 ' + _mbCcText('title') : _mbTaskLabel(g.taskId) + (t && t.text ? ' — ' + t.text : '');
        var loSet = new Set(g.rows.map(function (r) { return r.lo; }));
        var taskLo = loSet.size === 1 ? [...loSet][0] : null;
        var taskSel = g.taskId === MB_CC_TASK ? '' :
            '<label class="mb-cm-tasklo"><span>' + escapeHtml(_cmT('mbCmTaskLo')) + '</span>' +
            '<select data-act="mbCmSetTaskLo" data-on="change" data-args="' + _cmArgs([g.taskId, '$value']) + '">' +
            (taskLo === null ? '<option value="*" selected>' + escapeHtml(_cmT('mbCmMixed')) + '</option>' : '') +
            _cmLoOptions(los, taskLo === null ? '*' : taskLo, true) + '</select></label>';
        var lastField = null;
        var body = g.rows.map(function (r) {
            var fieldHead = r.field !== lastField
                ? '<div class="mb-cm-field" dir="auto">' + escapeHtml(_mbFieldLabel(r.field)) + '</div>' : '';
            lastField = r.field;
            var destOpts = MB_CM_DESTS.map(function (d) {
                return '<option value="' + d + '"' + (d === r.dest ? ' selected' : '') + '>' + MB_CM_ICON[d] + ' ' + escapeHtml(_cmT('mbCmDest_' + d)) + '</option>';
            }).join('');
            var cls = 'mb-cm-row' + (r.issue ? ' is-issue' : '') + (r.places.length ? ' is-written' : '') + (r.dest === 'none' ? ' is-none' : '');
            return fieldHead +
                '<div class="' + cls + '" data-cm-key="' + escapeHtml(r.key) + '">' +
                    '<div class="mb-cm-text" dir="auto">' + escapeHtml(_mbCleanItem(r.text)) +
                        (r.mine ? ' <span class="mb-cm-mine" title="' + escapeHtml(_cmT('mbCmMine')) + '">✎</span>' : '') + '</div>' +
                    '<select class="mb-cm-lo" aria-label="' + escapeHtml(_cmT('mbCmColLo')) + '" data-act="mbCmSet" data-on="change" data-args="' + _cmArgs([r.key, 'lo', '$value']) + '">' +
                        _cmLoOptions(los, r.lo, true) + '</select>' +
                    '<select class="mb-cm-dest" aria-label="' + escapeHtml(_cmT('mbCmColDest')) + '" data-act="mbCmSet" data-on="change" data-args="' + _cmArgs([r.key, 'dest', '$value']) + '">' +
                        destOpts + '</select>' +
                    '<div class="mb-cm-status">' + _cmStatusHtml(r) + '</div>' +
                '</div>';
        }).join('');
        return '<div class="mb-cm-task"><div class="mb-cm-task-head"><span dir="auto">' + escapeHtml(head) + '</span>' + taskSel + '</div>' + body + '</div>';
    }).join('');

    var filterHtml = '<select class="mb-cm-filter" data-act="mbCmFilter" data-on="change" data-args="' + _cmArgs(['$value']) + '">' +
        '<option value=""' + (filter === '' ? ' selected' : '') + '>' + escapeHtml(_cmT('mbCmFilterAll')) + '</option>' +
        los.map(function (lo) { return '<option value="' + escapeHtml(lo.id) + '"' + (filter === lo.id ? ' selected' : '') + '>' + escapeHtml(_cmLoLabel(lo)) + '</option>'; }).join('') +
        '<option value="!"' + (filter === '!' ? ' selected' : '') + '>' + escapeHtml(_cmT('mbCmFilterIssues')) + '</option></select>';

    var open = mbState.cmOpen !== false;
    host.innerHTML =
        '<details class="mb-cm"' + (open ? ' open' : '') + '>' +
            '<summary data-act="mbCmToggle"><span class="mb-cm-title">🗺️ ' + escapeHtml(_cmT('mbCmTitle')) + '</span>' + sum + '</summary>' +
            '<p class="mb-cm-intro" dir="auto">' + escapeHtml(_cmT('mbCmIntro')) + '</p>' +
            '<div class="mb-cm-bar">' + filterHtml +
                '<button type="button" class="mb-cm-btn is-main" data-act="mbCmGroup"' + (todo ? '' : ' disabled') + '>🧩 ' + escapeHtml(_cmT('mbCmGroup', { v0: todo })) + '</button>' +
                '<button type="button" class="mb-cm-btn" data-act="mbCmReset">↺ ' + escapeHtml(_cmT('mbCmReset')) + '</button>' +
            '</div>' +
            '<div class="mb-cm-cols" aria-hidden="true"><span>' + escapeHtml(_cmT('mbCmColItem')) + '</span><span>' + escapeHtml(_cmT('mbCmColLo')) + '</span><span>' +
                escapeHtml(_cmT('mbCmColDest')) + '</span><span>' + escapeHtml(_cmT('mbCmColStatus')) + '</span></div>' +
            (groupsHtml || '<p class="mb-cm-empty">' + escapeHtml(_cmT('mbCmNoneShown')) + '</p>') +
        '</details>';
}

/* ── Actions ───────────────────────────────────────────────── */

function mbCmToggle(el) {
    var d = el && el.parentElement;
    if (d) mbState.cmOpen = !d.open;   // the click's default action toggles it next
}

function mbCmFilter(value) {
    mbState.cmFilter = value || '';
    mbRenderContentMap();
}

function _cmPut(module, row, prop, value) {
    var store = _cmStore(module);
    var s = store.rows[row.key];
    if (!s || s.t !== row.text) s = store.rows[row.key] = { t: row.text };
    s[prop] = value;
    if (prop === 'lo' || prop === 'dest') {
        var sug = prop === 'lo' ? row.sugLo : row.sugDest;
        if (value === sug) delete s[prop];
    } else if (!Array.isArray(value) || !value.length) {
        delete s[prop];
    }
    if (s.lo === undefined && s.dest === undefined && s.ra === undefined && s.rd === undefined) delete store.rows[row.key];
}

function mbCmSet(key, prop, value) {
    var module = _mbCurrentModule();
    if (!module || (prop !== 'lo' && prop !== 'dest')) return;
    if (prop === 'dest' && MB_CM_DESTS.indexOf(value) === -1) return;
    var row = mbContentMapRows(module).find(function (r) { return r.key === key; });
    if (!row) return;
    _cmPut(module, row, prop, String(value || ''));
    mbRenderContentMap();
}

/* 3.31.0: add ('on') or remove ('off') one outcome's "see also". */
function mbCmRef(key, loId, mode) {
    var module = _mbCurrentModule();
    if (!module || !loId) { mbRenderContentMap(); return; }
    var row = mbContentMapRows(module).find(function (r) { return r.key === key; });
    if (!row) return;
    var ra = row.refAdd.filter(function (x) { return x !== loId; });
    var rd = row.refDel.filter(function (x) { return x !== loId; });
    if (mode === 'on') ra.push(loId); else rd.push(loId);
    _cmPut(module, row, 'ra', ra);
    _cmPut(module, row, 'rd', rd);
    mbRenderContentMap();
}

function mbCmSetTaskLo(taskId, value) {
    if (value === '*') return;
    var module = _mbCurrentModule();
    if (!module) return;
    mbContentMapRows(module).filter(function (r) { return r.taskId === taskId; })
        .forEach(function (r) { _cmPut(module, r, 'lo', String(value || '')); });
    mbRenderContentMap();
}

async function mbCmReset() {
    var module = _mbCurrentModule();
    if (!module || !module.contentMap || !Object.keys(module.contentMap.rows || {}).length) {
        showStatus(_cmT('mbCmNothingToReset'), 'info');
        return;
    }
    if (!await mbConfirm(_cmT('mbCmResetConfirm'))) return;
    module.contentMap.rows = {};
    mbRenderContentMap();
}

/** Decided items not written yet → draft items of the proposal. */
function mbCmGroup() {
    var module = _mbCurrentModule();
    if (!module) return;
    var all = mbContentMapRows(module);
    var rows = all.filter(function (r) {
        return r.dest !== 'none' && r.lo && !r.done && !r.draft;
    });
    var los0 = _cmLos(module);
    var missing = {};
    los0.forEach(function (lo) { var m = _cmMissingPcs(module, lo); if (m.length) missing[lo.id] = m; });
    if (!rows.length && !Object.keys(missing).length) { showStatus(_cmT('mbCmNothingToGroup'), 'info'); return; }
    if (!mbState.structureProposal) mbStartManualMapping();
    var p = mbState.structureProposal;
    var listOf = { info: 'informationSheets', activity: 'activitySheets', assessment: 'assessmentUnits' };
    var prefix = { info: 'is', activity: 'as', assessment: 'au' };
    var tasks = (module.taskAnalysisSource && module.taskAnalysisSource.sourceTasks) || [];
    var los = _cmLos(module);
    var groups = new Map();
    rows.forEach(function (r) {
        var gk = r.lo + '|' + r.dest + '|' + (r.dest === 'assessment' ? '' : r.taskId);
        if (!groups.has(gk)) groups.set(gk, { lo: r.lo, dest: r.dest, taskId: r.taskId, rows: [] });
        groups.get(gk).rows.push(r);
    });
    /* 3.32.0: every outcome's assessment takes its criteria as DACUM
       sent them — those not in its form yet. */
    Object.keys(missing).forEach(function (loId) {
        var gk = loId + '|assessment|';
        if (!groups.has(gk)) groups.set(gk, { lo: loId, dest: 'assessment', taskId: '', rows: [] });
        groups.get(gk).pcIds = missing[loId].map(function (pc) { return pc.id; });
    });
    var made = 0, joined = 0, n = 0;
    groups.forEach(function (g, gk) {
        var list = p[listOf[g.dest]];
        var item = list.find(function (it) { return it.cmGroup === gk; });
        var sels = g.rows.map(function (r) { return { taskId: r.taskId, field: r.field, itemIndex: r.itemIndex, itemText: r.text }; });
        /* 3.32.0: the task already has a sheet of this kind in this
           outcome — the items join it instead of starting another. */
        var into = null;
        if (g.dest !== 'assessment') {
            all.some(function (r) {
                if (r.taskId !== g.taskId) return false;
                var pl = r.places.find(function (q) { return q.kind === g.dest && q.lo.id === g.lo; });
                if (pl) into = pl;
                return !!pl;
            });
        }
        if (item) {
            item.sourceSelections = (item.sourceSelections || []).concat(sels);
            joined++;
        } else {
            var title;
            if (g.dest === 'assessment') {
                title = _cmT('mbCmAssessTitle', { v0: _cmLoLabel(los.find(function (l) { return l.id === g.lo; })) });
            } else if (g.taskId === MB_CC_TASK) {
                title = _mbCcText('title');
            } else if (g.rows.every(function (r) { return r.taskLo && r.taskLo !== g.lo; })) {
                /* Items moved here from another outcome's task: the task's
                   statement would name the wrong subject — the first item does. */
                title = _mbCleanItem(String(g.rows[0].text).replace(/\s+/g, ' '));
            } else {
                var t = tasks.find(function (x) { return x.id === g.taskId; });
                title = _mbCleanItem(String((t && t.text) || _mbTaskLabel(g.taskId)).replace(/\s+/g, ' '));
            }
            item = {
                tempId: prefix[g.dest] + '-cm-' + Date.now() + '-' + (n++),
                title: into ? (into.title || title) : title, rationale: '', learningOutcomeIds: [], performanceCriteriaIds: [],
                sourceSelections: sels, mappingType: 'direct', targetLoId: g.lo, cmGroup: gk
            };
            if (into) item.cmSheet = into.n - 1;
            list.push(item);
            made++;
        }
        var inh = _mbInheritedLinksForItem(module, item);
        item.learningOutcomeIds = inh.loIds;
        item.performanceCriteriaIds = g.dest === 'assessment'
            ? [...new Set((item.performanceCriteriaIds || []).concat(g.pcIds || []))]
            : inh.pcIds;
        if (g.dest === 'assessment' && !item.learningOutcomeIds.includes(g.lo)) item.learningOutcomeIds.push(g.lo);
    });
    renderStructureProposal();
    renderSourceBrowser();
    renderAssignedItemsPanel();
    var nPc = Object.keys(missing).reduce(function (a, k) { return a + missing[k].length; }, 0);
    showStatus(_cmT('mbCmGrouped', { v0: made + joined, v1: rows.length + nPc }), 'success');
    var target = document.getElementById('mb-structure-proposal');
    if (target && target.scrollIntoView) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
