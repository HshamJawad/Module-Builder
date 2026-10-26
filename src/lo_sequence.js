// ============================================================
// /src/lo_sequence.js
// The order and numbering of what is inside a learning outcome (3.43.0)
//
// WHY
// Some programmes write a learning outcome as ONE sequence, numbered as
// one: 1-1 Introduction, 1-2 Knowledge, 1-3 Learning Activity,
// 1-4 Knowledge, 1-5 Learning Activity, 1-6 Reflection. The tool printed
// every information sheet first and then every activity sheet, each
// numbered on its own, and the outcome's own sections went to the
// module overview page.
//
// WHAT IS SET WHERE
//   settings.sheetOrder        'byType' (as before) | 'interleaved' —
//                              each information sheet followed by its
//                              activity sheets          (Settings → Misc)
//   settings.unifiedNumbering  one number sequence per outcome, counting
//                              the outcome's placed sections too
//   activity.afterInfo         the information sheet an activity follows
//                              (its uid); absent = the one at its own position
//   block.place                'overview' (as before) | 'before' — start
//                              of the outcome | 'after' — end of it
//
// UNCHANGED BY DEFAULT
// With the defaults every function here returns what the tool did
// before: stored sheet numbers, information sheets then activity sheets,
// the outcome's sections on the overview page.
//
// One function decides the order (mbLoSequence) and one the number
// (mbSeqNumber); the editor, the Learning Guide and every exporter ask
// them, so a number on screen and in the file cannot disagree.
// ============================================================

function _seqSettings() {
    var s = {};
    try { if (typeof _wsGet === 'function') s = _wsGet() || {}; } catch (e) { s = {}; }
    /* 3.59.0: the Learner guide template is written as one sequence. 3.80.8: in the order of
       its tabs — every knowledge sheet, then every activity sheet, of each unit (no «Comes
       after» on the activity sheet). */
    if (typeof mbIsLearnerGuide === 'function' && mbIsLearnerGuide()) return { interleaved: false, unified: true };
    return {
        interleaved: s.sheetOrder === 'interleaved',
        unified: s.unifiedNumbering === true
    };
}

function mbSeqInterleaved() { return _seqSettings().interleaved; }
function mbSeqUnified()     { return _seqSettings().unified; }

/** Where an outcome section is printed. */
function mbBlockPlace(b) {
    var p = b && b.place;
    return (p === 'before' || p === 'after') ? p : 'overview';
}

/* Any language, raw pair or flattened string. */
function _seqStr(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'object') {
        var codes = (typeof BILANG_CODES !== 'undefined') ? BILANG_CODES : ['en', 'ar', 'fr'];
        for (var i = 0; i < codes.length; i++) {
            if (typeof v[codes[i]] === 'string' && v[codes[i]].trim()) return v[codes[i]];
        }
    }
    return '';
}

/** A sheet is exported, and so numbered, when it has a title. */
function _seqSheetCounts(sh) { return !!(sh && _seqStr(sh.title).trim()); }

function _seqBlockCounts(b) {
    if (!b) return false;
    if (_seqStr(b.title).trim() || _seqStr(b.body).trim()) return true;
    return Array.isArray(b.tables) && b.tables.length > 0;
}

/** A stable key for an information sheet, created on first use. */
function mbInfoSheetKey(sh) {
    if (!sh) return '';
    if (!sh.uid) sh.uid = (typeof mbUid === 'function') ? mbUid() : ('is_' + Math.random().toString(36).slice(2, 10));
    return sh.uid;
}

/**
 * The outcome in document order:
 *   [{ kind: 'block', block, place }, { kind: 'info', index }, { kind: 'activity', index }, …]
 * Every sheet and every placed section is listed, filled or not;
 * callers skip what they do not print.
 */
function mbLoSequence(lo) {
    var out = [];
    if (!lo) return out;
    var blocks = Array.isArray(lo.blocks) ? lo.blocks : [];
    var infos  = Array.isArray(lo.infoSheets) ? lo.infoSheets : [];
    var acts   = Array.isArray(lo.activitySheets) ? lo.activitySheets : [];

    /* 3.59.0: the Learner guide opens each unit with its introduction
       and closes it with its reflection (learner_guide.js). */
    var lg = typeof mbIsLearnerGuide === 'function' && mbIsLearnerGuide();
    if (lg) out.push({ kind: 'lgIntro' });

    blocks.forEach(function (b) { if (mbBlockPlace(b) === 'before') out.push({ kind: 'block', block: b, place: 'before' }); });

    if (!mbSeqInterleaved()) {
        infos.forEach(function (s, i) { out.push({ kind: 'info', index: i }); });
        acts.forEach(function (s, i) { out.push({ kind: 'activity', index: i }); });
    } else {
        /* Which information sheet each activity follows: the one it names,
           else the one at its own position (activity 2 after information
           sheet 2). By its OWN position, so linking one activity never
           moves the others. Activities beyond the last sheet go last. */
        var keyAt = {};
        infos.forEach(function (s, i) { if (s && s.uid) keyAt[s.uid] = i; });
        var target = [];
        acts.forEach(function (a, j) {
            var k = (a && a.afterInfo && keyAt.hasOwnProperty(a.afterInfo)) ? keyAt[a.afterInfo] : null;
            target[j] = (k === null) ? (j < infos.length ? j : infos.length) : k;
        });
        infos.forEach(function (s, i) {
            out.push({ kind: 'info', index: i });
            acts.forEach(function (a, j) { if (target[j] === i) out.push({ kind: 'activity', index: j }); });
        });
        acts.forEach(function (a, j) { if (target[j] >= infos.length) out.push({ kind: 'activity', index: j }); });
    }

    blocks.forEach(function (b) { if (mbBlockPlace(b) === 'after') out.push({ kind: 'block', block: b, place: 'after' }); });
    if (lg) out.push({ kind: 'lgReflection' });
    return out;
}

/** Position (1-based) of an item among those that are printed, or 0. */
function _seqPosition(lo, kind, ref) {
    var seq = mbLoSequence(lo), pos = 0;
    var infos = lo.infoSheets || [], acts = lo.activitySheets || [];
    for (var i = 0; i < seq.length; i++) {
        var it = seq[i], counts;
        if (it.kind === 'block') counts = _seqBlockCounts(it.block);
        else if (it.kind === 'lgIntro') counts = typeof mbLgUnitFilled === 'function' && mbLgUnitFilled(lo);   // 3.80.6
        else if (it.kind === 'lgReflection') counts = typeof mbLgReflectionFilled === 'function' && mbLgReflectionFilled(lo);
        else counts = _seqSheetCounts(it.kind === 'info' ? infos[it.index] : acts[it.index]);
        if (!counts) continue;
        pos++;
        if (it.kind === kind && (kind === 'block' ? it.block === ref
            : (kind === 'lgIntro' || kind === 'lgReflection') ? true : it.index === ref)) return pos;
    }
    return 0;
}

/**
 * The number printed for a sheet: the unified number when that setting
 * is on and the sheet is printed, otherwise the stored number, otherwise
 * the automatic one (LO-index).
 */
function mbSeqNumber(lo, loIndex, kind, index) {
    var sheets = (kind === 'info' ? (lo && lo.infoSheets) : (lo && lo.activitySheets)) || [];
    var sh = sheets[index];
    if (mbSeqUnified() && lo) {
        var p = _seqPosition(lo, kind, index);
        if (p) return (loIndex + 1) + '-' + p;
    }
    var stored = _seqStr(sh && sh.sheetNumber).trim();
    if (stored) return stored;
    return (typeof getAutoSheetNumber === 'function') ? getAutoSheetNumber(loIndex, index) : (loIndex + 1) + '-' + (index + 1);
}

/** 3.59.0: the number of a Learner guide introduction or reflection. */
function mbSeqLgNumber(lo, loIndex, kind) {
    if (!lo) return '';
    var p = _seqPosition(lo, kind, null);
    return p ? (loIndex + 1) + '-' + p : '';
}

/** The number of a placed outcome section: only with unified numbering. */
function mbSeqBlockNumber(lo, loIndex, block) {
    if (!mbSeqUnified() || !lo || mbBlockPlace(block) === 'overview') return '';
    var p = _seqPosition(lo, 'block', block);
    return p ? (loIndex + 1) + '-' + p : '';
}

/** A self-check or answer-key number: the one typed when it differs
    from the stored sheet number, else the sheet's printed number. */
function mbSeqSubNumber(lo, loIndex, index, typed) {
    var sh = ((lo && lo.infoSheets) || [])[index];
    var t = _seqStr(typed).trim();
    var stored = _seqStr(sh && sh.sheetNumber).trim();
    if (t && !(mbSeqUnified() && t === stored)) return t;
    return mbSeqNumber(lo, loIndex, 'info', index);
}

/* ── Editor ───────────────────────────────────────────────────
   With unified numbering the number field shows the computed number and
   is read-only: a typed number would be ignored by every export. */
function mbSeqPaintNumberFields() {
    var lo = (typeof mbCurrentLOObject === 'function') ? mbCurrentLOObject() : null;
    var loIndex = lo ? mbState.learningOutcomesData.indexOf(lo) : -1;
    var on = mbSeqUnified() && !!lo;
    var hint = (window.i18n && window.i18n.t) ? window.i18n.t('mbSeqNumberAuto') : '';
    [['info-sheet-number', 'info', mbState.currentInfoSheetIndex],
     ['sheet-number', 'activity', mbState.currentActivitySheetIndex]].forEach(function (x) {
        var el = document.getElementById(x[0]);
        if (!el) return;
        if (on) {
            el.readOnly = true;
            el.title = hint;
            el.classList.add('mb-seq-auto');
            el.value = mbSeqNumber(lo, loIndex, x[1], x[2] || 0);
        } else if (el.readOnly) {
            el.readOnly = false;
            el.title = '';
            el.classList.remove('mb-seq-auto');
        }
    });
    mbRenderAfterInfoSelect();
}

/* «Comes after» on the activity sheet — shown only for the interleaved
   order, where it means something. */
function mbRenderAfterInfoSelect() {
    var row = document.getElementById('activity-after-row');
    var sel = document.getElementById('activity-after-info');
    if (!row || !sel) return;
    var lo = (typeof mbCurrentLOObject === 'function') ? mbCurrentLOObject() : null;
    if (!mbSeqInterleaved() || !lo) { row.hidden = true; return; }
    row.hidden = false;
    var act = (lo.activitySheets || [])[mbState.currentActivitySheetIndex] || {};
    var lang = (typeof contentLang === 'function') ? contentLang() : 'en';
    var loIndex = mbState.learningOutcomesData.indexOf(lo);
    var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    var opts = '<option value="">' + esc(window.i18n.t('mbAfterInfoAuto')) + '</option>';
    (lo.infoSheets || []).forEach(function (s, i) {
        var key = mbInfoSheetKey(s);
        var title = (typeof biGet === 'function') ? biGet(s.title, lang) : _seqStr(s.title);
        opts += '<option value="' + esc(key) + '">' + esc(mbSeqNumber(lo, loIndex, 'info', i) + (title ? ' — ' + title : '')) + '</option>';
    });
    sel.innerHTML = opts;
    sel.value = act.afterInfo || '';
    if (sel.value !== (act.afterInfo || '')) sel.value = '';
}

/** Change handler for «Comes after». */
function mbSetAfterInfo(value) {
    var lo = (typeof mbCurrentLOObject === 'function') ? mbCurrentLOObject() : null;
    if (!lo) return;
    var act = (lo.activitySheets || [])[mbState.currentActivitySheetIndex];
    if (!act) return;
    if (value) act.afterInfo = String(value); else delete act.afterInfo;
    if (typeof saveCurrentModuleLOData === 'function') saveCurrentModuleLOData();
    mbSeqPaintNumberFields();
    if (typeof mbTouch === 'function') { try { mbTouch(); } catch (e) { /* autosave absent */ } }
}

if (typeof window !== 'undefined') {
    window.addEventListener('mb:settingschange', function () { try { mbSeqPaintNumberFields(); } catch (e) {} });
    window.addEventListener('mb:langchange', function () { try { mbSeqPaintNumberFields(); } catch (e) {} });
}
