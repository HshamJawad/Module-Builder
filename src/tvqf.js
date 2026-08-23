// ============================================================
// /src/tvqf.js
// The qualifications-framework card (TVQF / NQF).
//
// WHAT THIS IS FOR
// A module that will be submitted for accreditation has to state where
// it sits in a national qualifications framework: which level, under
// which framework and version, worth how many notional hours, awarded
// by whom. That is a different audience from the rest of the tool — an
// accreditation officer, not a trainer — which is why it is a card of
// its own rather than more fields in the cover table.
//
// DELIBERATELY GENERIC
// No country, no fixed number of levels, no fixed level names. The
// level is a free-text field precisely so «Level 4 of 10» and
// «Level 5 (EQF-referenced)» and «المستوى الثالث» are all sayable. A
// dropdown of eight levels would have hard-coded one country's
// framework into a tool meant for any of them.
//
// ── WHY HALF THE FIELDS ARE READ-ONLY HERE ──────────────────
// Six of the fields an NQF card needs already exist in this tool, as
// the factory rows of the cover table: sector, occupation, job,
// qualification, module code, level, version. Asking for them again
// would give the project two places to state the same fact, and the
// first time a user edited one and not the other the document would
// contradict itself — with nothing to say which side was right.
//
// So they are MIRRORED: shown in the card, read from coverRows, and
// edited where they have always been edited. The card owns only what
// is genuinely new — the framework's own name and version, notional
// hours, the awarding body, and the extended block.
//
// ── EMPTY MEANS ABSENT ──────────────────────────────────────
// Same rule as blocks.js: a field the user never filled does not
// appear in the DOCX. Not as a blank row, not as a dash. An
// accreditation card listing eleven empty labels says less than one
// listing the four facts that are known.
// ============================================================

/* ── Field configuration ─────────────────────────────────────
   Declared as data rather than written out as markup, because three
   different things have to walk the same list and stay in step: the
   renderer, the live-binding handler, and the export. A field added
   here appears in all three. */

/* Mirrors. `key` is the cover row's seedKey; the label comes from the
   SAME dictionary entry the cover table uses, so a rename of that
   wording happens once. */
var MB_TVQF_MIRROR = ['cvSector', 'cvOccupation', 'cvJob', 'cvQualification',
                      'cvModuleCode', 'cvLevel', 'cvVersion'];

var MB_TVQF_BASIC = [
    { name: 'unitTitle',     label: 'tqUnitTitle',     type: 'text',   bi: true  },
    { name: 'frameworkName', label: 'tqFramework',     type: 'text',   bi: true,
      hint: 'tqFrameworkHint' },
    { name: 'notionalHours', label: 'tqHours',         type: 'number', bi: false },
    { name: 'awardingBody',  label: 'tqAwardingBody',  type: 'text',   bi: true  }
];

var MB_TVQF_EXTENDED = [
    { name: 'knowledge',         label: 'tqKnowledge',   type: 'textarea', bi: true },
    { name: 'skill',             label: 'tqSkill',       type: 'textarea', bi: true },
    { name: 'competence',        label: 'tqCompetence',  type: 'textarea', bi: true },
    { name: 'entryRequirements', label: 'tqEntry',       type: 'textarea', bi: true },
    { name: 'progression',       label: 'tqProgression', type: 'text',     bi: true },
    { name: 'qualificationType', label: 'tqType',        type: 'select',   bi: false,
      options: [['principal', 'tqTypePrincipal'],
                ['component', 'tqTypeComponent'],
                ['addendum',  'tqTypeAddendum']] },
    { name: 'assessmentMethod',  label: 'tqMethod',      type: 'textarea', bi: true },
    { name: 'rpl',               label: 'tqRpl',         type: 'select',   bi: false,
      options: [['yes', 'tqYes'], ['no', 'tqNo']] },
    { name: 'accreditationDate', label: 'tqAccredited',  type: 'date',     bi: false },
    { name: 'reviewDate',        label: 'tqReviewDue',   type: 'date',     bi: false },
    { name: 'alignmentNote',     label: 'tqAlignment',   type: 'textarea', bi: true,
      hint: 'tqAlignmentHint' }
];

function _mbTvqfGroup(group) {
    if (group === 'ext') {
        if (!mbState.tvqfExtended || typeof mbState.tvqfExtended !== 'object') mbState.tvqfExtended = {};
        return mbState.tvqfExtended;
    }
    if (!mbState.tvqfBasic || typeof mbState.tvqfBasic !== 'object') mbState.tvqfBasic = {};
    return mbState.tvqfBasic;
}

function _mbTvqfFields(group) {
    return group === 'ext' ? MB_TVQF_EXTENDED : MB_TVQF_BASIC;
}

/* ── Reading a value ─────────────────────────────────────────
   biGetStrict for the editor, exactly as blocks.js does: the box shows
   the side being edited and nothing else, so the author can see which
   half is still missing. The fallback belongs in the export, not here. */
function _mbTvqfValue(group, field) {
    var obj = _mbTvqfGroup(group);
    if (field.bi) return biGetStrict(obj[field.name], contentLang());
    return obj[field.name] === undefined || obj[field.name] === null ? '' : String(obj[field.name]);
}

/* ── The mirrored cover values ───────────────────────────────
   Read through the same helpers the cover table uses, so a row the
   user renamed still resolves and a row that lost its seedKey is
   recovered by mbRecoverCoverSeedKeys() before we look. */
function _mbTvqfMirrorRow(seedKey) {
    var rows = (mbState.coverRows || []);
    for (var i = 0; i < rows.length; i++) {
        if (rows[i].seedKey === seedKey) return rows[i];
    }
    /* No row carries the key: the user RENAMED that row, which deletes
       the seedKey (covers.js). The value is still theirs and still the
       one this mirror is about, so fall back to the factory position —
       but only if the row there has no key of its own, which would mean
       it is a different field that merely happens to sit at that index. */
    var idx = MB_TVQF_MIRROR.indexOf(seedKey);
    if (idx !== -1 && rows[idx] && !rows[idx].seedKey) return rows[idx];
    return null;
}

/* The label to show beside a mirrored value.

   Not window.i18n.t(seedKey) unconditionally: a row the user renamed
   is their content, and the card must call it what the table calls it.
   mbCoverLabelText() already encodes that rule for the cover table —
   reusing it is how the two stay in agreement instead of drifting. */
function _mbTvqfMirrorLabel(seedKey, row) {
    if (row && !row.seedKey && typeof mbCoverLabelText === 'function') {
        return mbCoverLabelText(row).replace(/:\s*$/, '');
    }
    return window.i18n.t(seedKey).replace(/:\s*$/, '');
}

function _mbTvqfMirrorValue(seedKey) {
    var row = _mbTvqfMirrorRow(seedKey);
    if (!row) return '';
    return biGetStrict(row.value, contentLang()) || biGet(row.value, contentLang());
}

/* ── Rendering ───────────────────────────────────────────────
   innerHTML, and rebuilt on a content-language switch — the same
   approach and the same reasoning as blocks.js: every control is a
   data-act that events.js delegates from the document, so a rebuild
   loses no listeners. */

function _mbTvqfEsc(s) {
    return String(s === null || s === undefined ? '' : s)
        .replace(/[&<>"]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
        });
}

function _mbTvqfControl(group, field) {
    var val  = _mbTvqfEsc(_mbTvqfValue(group, field));
    var args = _mbTvqfEsc(JSON.stringify([group, field.name, '$value']));
    /* input for free text so a value is never lost to a switch that
       happens before blur; change for select and date, which have no
       meaningful intermediate state. */
    var on   = (field.type === 'select' || field.type === 'date') ? 'change' : 'input';
    var bind = ' data-act="mbTvqfEdit" data-on="' + on + '" data-args=\'' + args + '\'';

    if (field.type === 'select') {
        var opts = '<option value=""></option>' + field.options.map(function (o) {
            return '<option value="' + o[0] + '"' + (val === o[0] ? ' selected' : '') + '>' +
                   _mbTvqfEsc(window.i18n.t(o[1])) + '</option>';
        }).join('');
        return '<select class="mb-tvqf-input"' + bind + '>' + opts + '</select>';
    }

    if (field.type === 'textarea') {
        return '<textarea class="mb-tvqf-input mb-content-field" rows="2" dir="auto"' + bind + '>' + val + '</textarea>';
    }

    /* dir="ltr" and data-dir-lock on the numeric and date fields:
       digits run left-to-right in Arabic too, and flipping them only
       sends the caret to the wrong end — the same decision resources.js
       made for the quantity column. */
    if (field.type === 'number' || field.type === 'date') {
        return '<input type="' + field.type + '" class="mb-tvqf-input" dir="ltr" data-dir-lock="ltr"' +
               (field.type === 'number' ? ' min="0"' : '') +
               ' value="' + val + '"' + bind + '/>';
    }

    return '<input type="text" class="mb-tvqf-input mb-content-field" dir="auto" value="' + val + '"' + bind + '/>';
}

function _mbTvqfFieldHtml(group, field) {
    var hint = field.hint
        ? '<span class="mb-tvqf-hint" data-i18n="' + field.hint + '">' +
          _mbTvqfEsc(window.i18n.t(field.hint)) + '</span>'
        : '';
    return '<div class="mb-tvqf-field">' +
             '<label class="mb-tvqf-label" data-i18n="' + field.label + '">' +
               _mbTvqfEsc(window.i18n.t(field.label)) + '</label>' +
             _mbTvqfControl(group, field) + hint +
           '</div>';
}

function mbRenderTvqf() {
    var basic = document.getElementById('tvqf-basic-fields');
    var ext   = document.getElementById('tvqf-ext-fields');

    if (basic) {
        /* The mirrors first: they are what the reader of an NQF card
           looks for, and putting the two new fields above them would
           bury the level and the code under the framework's name. */
        var mirrorHtml = MB_TVQF_MIRROR.map(function (key) {
            var row = _mbTvqfMirrorRow(key);
            var v   = _mbTvqfMirrorValue(key);
            /* No data-i18n on the label: a renamed row's label is the
               user's own words, and applyTranslations() would overwrite
               it with the dictionary's on the next interface switch.
               The whole card is re-rendered on mb:langchange instead,
               which repaints the un-renamed ones correctly. */
            return '<div class="mb-tvqf-field mb-tvqf-field--mirror">' +
                     '<label class="mb-tvqf-label">' +
                       _mbTvqfEsc(_mbTvqfMirrorLabel(key, row)) + '</label>' +
                     '<input type="text" class="mb-tvqf-input" dir="auto" readonly tabindex="-1"' +
                       ' value="' + _mbTvqfEsc(v) + '"' +
                       ' placeholder="' + _mbTvqfEsc(window.i18n.t('tqFromUnitTable')) + '"/>' +
                   '</div>';
        }).join('');

        basic.innerHTML = mirrorHtml + MB_TVQF_BASIC.map(function (f) {
            return _mbTvqfFieldHtml('basic', f);
        }).join('');
    }

    if (ext) {
        ext.innerHTML = MB_TVQF_EXTENDED.map(function (f) {
            return _mbTvqfFieldHtml('ext', f);
        }).join('');
    }
}

/* ── Editing ─────────────────────────────────────────────────
   Live binding, for the reason blocks.js gives: a collector that runs
   at save time can be beaten by a content-language switch, and then
   one side of the pair is written into the other. A field bound to
   state on every keystroke cannot lose a side that way. */
function mbTvqfEdit(group, name, value) {
    var fields = _mbTvqfFields(group);
    var field  = null;
    for (var i = 0; i < fields.length; i++) {
        if (fields[i].name === name) { field = fields[i]; break; }
    }
    if (!field) return;

    var obj = _mbTvqfGroup(group);
    if (field.bi) biPut(obj, name, value);
    else          obj[name] = value;
}

/* ── Is there anything to export? ────────────────────────────
   The mirrors do NOT count. They are already on the cover page, so a
   project with a sector and nothing else must not produce a framework
   card that repeats one line the reader has just seen. The card
   appears when the card's OWN fields say something. */
function _mbTvqfFilled(state, group) {
    var obj = (group === 'ext' ? state.tvqfExtended : state.tvqfBasic) || {};
    var fields = _mbTvqfFields(group);
    for (var i = 0; i < fields.length; i++) {
        var v = obj[fields[i].name];
        /* Flattened to a plain string by biFlattenDeep before export;
           still a pair if something calls this earlier. */
        if (typeof v !== 'string') v = (typeof biGet === 'function') ? biGet(v, exportLang()) : '';
        if (String(v || '').trim()) return true;
    }
    return false;
}

function mbTvqfHasContent(state) {
    state = state || mbState;
    return _mbTvqfFilled(state, 'basic') || _mbTvqfFilled(state, 'ext');
}

/**
 * The rows to print, already filtered.
 *
 * Returns [{ label, value }] with the labels resolved in the DOCUMENT
 * language — not the interface language — through the caller's `t`,
 * which is _mbT in exports_docx.js. Empty fields are dropped here
 * rather than in the export loop, so "no empty rows" is one rule in
 * one place instead of a condition repeated at every call site.
 *
 * The mirrors ARE included in the export even though they are excluded
 * from the has-content test above: once the card is printed at all, a
 * framework card without the level and the code is not usable by the
 * person it is written for.
 */
function mbTvqfExportRows(state, group, t) {
    var rows = [];
    var read = function (v) {
        if (typeof v === 'string') return v;
        return (typeof biGet === 'function') ? biGet(v, exportLang()) : '';
    };

    if (group === 'basic') {
        MB_TVQF_MIRROR.forEach(function (key) {
            var row = null, list = state.coverRows || [];
            for (var i = 0; i < list.length; i++) if (list[i].seedKey === key) { row = list[i]; break; }
            if (!row) return;
            var v = read(row.value).trim();
            if (v) rows.push({ label: t(key).replace(/:\s*$/, ''), value: v });
        });
    }

    var obj = (group === 'ext' ? state.tvqfExtended : state.tvqfBasic) || {};
    _mbTvqfFields(group).forEach(function (f) {
        var v = read(obj[f.name]).trim();
        if (!v) return;
        /* A select stores a code; the document needs the word, in the
           document's language. */
        if (f.type === 'select') {
            for (var i = 0; i < f.options.length; i++) {
                if (f.options[i][0] === v) { v = t(f.options[i][1]); break; }
            }
        }
        rows.push({ label: t(f.label), value: v });
    });

    return rows;
}

/* ── Keeping the mirrors current ─────────────────────────────
   The mirrors are a VIEW of the cover table, and a view that only
   refreshes when its own tab is rebuilt is a view that lies. Typing a
   level into the table and seeing the card still show the old one is
   worse than showing nothing: the user has no way to tell which of the
   two the export will use.

   A refresh button was the alternative and it is the wrong shape for
   this: a button that must be pressed for the screen to stop being
   wrong puts the correctness of the display in the user's hands, and
   the one time they forget is the time it matters.

   So it is delegated from the document, in the capture phase, for the
   same reason events.js binds that way: the cover rows are rebuilt by
   renderCoverTable() whenever a row is added, renamed or deleted, and
   a listener attached to the inputs themselves would be thrown away
   with them.

   Only the mirror INPUTS are rewritten, not the whole card. Re-rendering
   would rebuild the editable fields too, and a rebuild while the user is
   typing in one of them loses the caret. */
function mbTvqfSyncMirrors() {
    var box = document.getElementById('tvqf-basic-fields');
    if (!box) return;
    var inputs = box.querySelectorAll('.mb-tvqf-field--mirror .mb-tvqf-input');
    /* Positional, and safe to be: the renderer emits exactly one input
       per entry of MB_TVQF_MIRROR, in that order, in the same pass. */
    for (var i = 0; i < inputs.length && i < MB_TVQF_MIRROR.length; i++) {
        var key = MB_TVQF_MIRROR[i];
        var v   = _mbTvqfMirrorValue(key);
        if (inputs[i].value !== v) inputs[i].value = v;
        var label = inputs[i].parentNode.querySelector('.mb-tvqf-label');
        if (label) {
            var text = _mbTvqfMirrorLabel(key, _mbTvqfMirrorRow(key));
            if (label.textContent !== text) label.textContent = text;
        }
    }
}

/* `input`, not `change`: change waits for the field to lose focus, so
   the card would stay stale for as long as the user kept typing — which
   is precisely the window in which they are looking at both. */
['input', 'change'].forEach(function (evt) {
    document.addEventListener(evt, function (e) {
        var el = e.target;
        if (!el || !el.classList || !el.classList.contains('cover-value')) return;

        /* Write through BEFORE reading. The cover inputs are bound with
           data-on="change", so mid-typing the state still holds the
           previous value — a mirror refreshed on `input` alone would
           faithfully redisplay the stale one and look broken in exactly
           the way it was meant to fix. updateCoverValue() is the same
           function the change handler calls, and calling it early is
           harmless: it writes the active side of the pair and nothing
           else. */
        var m = /^cover-value-(\d+)$/.exec(el.id || '');
        if (m && typeof updateCoverValue === 'function') updateCoverValue(Number(m[1]));

        mbTvqfSyncMirrors();
    }, true);
});

/* A row added, renamed or deleted replaces the table wholesale, and
   those paths call renderCoverTable() rather than firing an input
   event. Wrapping it is how the card hears about them without
   renderCoverTable having to know the card exists. */
(function wrapCoverRender() {
    if (typeof window.renderCoverTable !== 'function') return;
    var original = window.renderCoverTable;
    window.renderCoverTable = function () {
        var out = original.apply(this, arguments);
        mbTvqfSyncMirrors();
        return out;
    };
})();

/* ── Emptying the card ───────────────────────────────────────
   Both halves at once, and in BOTH languages. A clear that wiped only
   the side being edited would leave the other one intact and invisible
   — the user would see empty boxes, save, and find the old Arabic text
   back in the export. Replacing the objects outright is the only
   version of "clear" that means what the button says.

   Confirmed first: this is the one control in the card that destroys
   work, and an accreditation block can represent an afternoon of
   looking things up. */
async function mbTvqfClear() {
    if (!mbTvqfHasContent(mbState)) return;      /* nothing to lose, nothing to ask */

    var ok = (typeof mbConfirm === 'function')
        ? await mbConfirm(window.i18n.t('tqClearConfirm'), { danger: true })
        : true;
    if (!ok) return;

    mbState.tvqfBasic = {};
    mbState.tvqfExtended = {};
    mbRenderTvqf();
    if (typeof showStatus === 'function') showStatus(window.i18n.t('tqCleared'), 'success');
}

/* ── Wiring ──────────────────────────────────────────────────
   Rebuilt on a content-language switch (the state holds both sides;
   the boxes just re-bind to the other one) and on an interface-language
   switch (the labels of rows built by innerHTML froze at construction
   — the same reason contentlang_ui.js re-runs the other renderers). */
window.addEventListener('mb:contentlangchange', mbRenderTvqf);
window.addEventListener('mb:langchange', function () {
    if (document.getElementById('tvqf-basic-fields')) mbRenderTvqf();
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mbRenderTvqf);
} else {
    mbRenderTvqf();
}
