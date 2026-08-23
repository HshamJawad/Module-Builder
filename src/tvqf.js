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
    return null;
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
            var v = _mbTvqfMirrorValue(key);
            return '<div class="mb-tvqf-field mb-tvqf-field--mirror">' +
                     '<label class="mb-tvqf-label" data-i18n="' + key + '">' +
                       _mbTvqfEsc(window.i18n.t(key)) + '</label>' +
                     '<input type="text" class="mb-tvqf-input" dir="auto" readonly tabindex="-1"' +
                       ' value="' + _mbTvqfEsc(v) + '"' +
                       ' placeholder="' + _mbTvqfEsc(window.i18n.t('tqFromCovers')) + '"/>' +
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
