// ============================================================
// /src/covers.js
// Cover table: rows, labels, values — and, since the framework card
// was folded into it, the qualifications-framework fields too.
//
// ── WHY THERE IS NO TVQF/NQF CARD ANY MORE ──────────────────
// The card used to mirror eight of its eleven visible fields out of
// this table: sector, occupation, job, qualification, unit title,
// code, level, version. Read-only boxes, restated one screen below
// the boxes they were copied from. The reader of that screen had to
// be told, in a note, that half of what they were looking at was not
// editable there — which is the shape of a design that is apologising
// for itself.
//
// So the card is gone and the nine fields that were genuinely ITS OWN
// are rows in this table:
//
//     entry requirements · qualification type · framework name and
//     version · notional hours · awarding body · RPL · accreditation
//     date · review due date · international referencing
//
// One table, one place each fact is stated, one rename mechanism, one
// "add custom row" button, one export path. The five remaining card
// fields (knowledge, skill, competence, progression pathway,
// assessment method) said things the outcomes and assessment tabs
// already say properly, and are retired — see mbMigrateTvqfRows(),
// which still carries any text a user typed into them rather than
// dropping it.
//
// ── TYPED ROWS ──────────────────────────────────────────────
// A cover row was always <input type="text">. Four of the new fields
// are not text: two are closed lists (qualification type, RPL) and
// two are dates. A free-text box for "yes / no" invites «Yes», «yes»,
// «Y» and «نعم» into the same column of the same document, and a
// free-text date invites 03/04/2025 to mean two different days.
//
// The type is carried on the row as `field`, NOT looked up from
// `seedKey`: renaming a row deletes its seedKey (that is how a rename
// is recorded), and a rename is a change of WORDING, not a decision
// to turn a date picker back into a text box.
//
// ── EMPTY MEANS ABSENT ──────────────────────────────────────
// Unchanged, and now inherited by the framework fields for free: the
// export loop already skips a row whose value is blank, so a project
// that never touches accreditation produces a document that never
// mentions it.
// ============================================================

/* The factory rows, and the dictionary keys that name them.
   Order matters only as a fallback: it is how a row that lost BOTH its
   seedKey and its recognisable text is re-identified, by position. */
var MB_COVER_SEED_KEYS = ['cvSector', 'cvOccupation', 'cvJob', 'cvQualification',
                          'cvModuleCode', 'cvLevel', 'cvVersion',
                          /* APPENDED, not inserted after cvQualification where
                             the row actually displays. This array's order is
                             the POSITIONAL fallback for a legacy row that lost
                             both its seedKey and its recognisable text — and
                             every file on disk was written when there were
                             seven rows in the original order. Inserting here
                             would shift index 4 onward and re-key those rows
                             to the wrong fields. Display order lives in
                             mbState.coverRows; this is identity recovery. */
                          'cvUnitTitle',
                          /* Same rule, second time: the framework fields are
                             appended for identity recovery and placed by
                             MB_COVER_ROW_ORDER for display. */
                          'cvEntryReq', 'cvQualType', 'cvFramework', 'cvHours',
                          'cvAwardingBody', 'cvRpl', 'cvAccredited',
                          'cvReviewDue', 'cvAlignment'];

/* DISPLAY order, which is not the same list in the same order — and the
   two must not be collapsed into one. Above is identity recovery, which
   is pinned to how legacy files were written; this is what a new or
   reset project looks like on screen, where the unit title belongs
   beside the qualification it is part of.

   The framework block sits at the BOTTOM, after Version. It is the
   accreditation officer's half of the table and it is answered last —
   putting entry requirements between the unit code and its level would
   split the identification block that everyone else fills in first. */
var MB_COVER_ROW_ORDER = ['cvSector', 'cvOccupation', 'cvJob', 'cvQualification',
                          'cvUnitTitle', 'cvModuleCode', 'cvLevel', 'cvVersion',
                          'cvEntryReq', 'cvQualType', 'cvFramework', 'cvHours',
                          'cvAwardingBody', 'cvRpl', 'cvAccredited',
                          'cvReviewDue', 'cvAlignment'];

/* The rows added by mbEnsureFrameworkRows(), in the order they appear.
   Kept separate from MB_COVER_ROW_ORDER because that list also has to
   describe the eight original rows, which are already guaranteed to
   exist by mb_state.js and by the reset path. */
var MB_COVER_FRAMEWORK_KEYS = ['cvEntryReq', 'cvQualType', 'cvFramework', 'cvHours',
                               'cvAwardingBody', 'cvRpl', 'cvAccredited',
                               'cvReviewDue', 'cvAlignment'];

/* ── Field types ─────────────────────────────────────────────
   Keyed by the row's `field`. A row with no entry here — every original
   cover row, and every custom row the user adds — renders as the plain
   text input it always was, so this table is additive and nothing that
   already worked has to know it exists.

   `neutral: true` means the value is not language-dependent: a date and
   a number read the same in Arabic, English and French. Those are
   written to BOTH sides of the bilingual pair, because a date typed
   while authoring the Arabic side and then exported in English would
   otherwise flatten to an empty cell — the field would silently vanish
   from the document it was entered for.

   `options` store a CODE on the row (`optionCode`) and seed the pair
   with the translated wording, refreshed on every render. That is what
   makes a dropdown answer the export language: the code is identity,
   the pair is text, and the two never have to be reconciled at export
   time by a lookup the export path would have to carry. */
var MB_COVER_FIELD_TYPES = {
    cvEntryReq:     { type: 'textarea', rows: 3 },
    cvQualType:     { type: 'select',
                      options: [['principal', 'tqTypePrincipal'],
                                ['component', 'tqTypeComponent'],
                                ['addendum',  'tqTypeAddendum']] },
    cvFramework:    { type: 'text', hint: 'cvFrameworkHint' },
    cvHours:        { type: 'number', neutral: true },
    cvAwardingBody: { type: 'text' },
    cvRpl:          { type: 'select', options: [['yes', 'tqYes'], ['no', 'tqNo']] },
    cvAccredited:   { type: 'date', neutral: true },
    cvReviewDue:    { type: 'date', neutral: true },
    cvAlignment:    { type: 'textarea', rows: 2, hint: 'cvAlignmentHint' }
};

/** The type configuration for a row, or null for a plain text row. */
function mbCoverFieldType(row) {
    var key = row && (row.field || row.seedKey);
    if (!key) return null;
    return Object.prototype.hasOwnProperty.call(MB_COVER_FIELD_TYPES, key)
        ? MB_COVER_FIELD_TYPES[key] : null;
}

/** Build a factory row. One constructor, so a row created by the reset
 *  path and a row created by the ensure path cannot drift apart — the
 *  `field` marker in particular, whose absence turns a date picker
 *  into a text box without anything reporting an error. */
function mbMakeCoverRow(seedKey, id) {
    var row = { id: id, seedKey: seedKey, label: biNew(), value: biNew() };
    if (Object.prototype.hasOwnProperty.call(MB_COVER_FIELD_TYPES, seedKey)) {
        row.field = seedKey;
    }
    return row;
}

/**
 * Give an older project the unit-title row it was saved without.
 *
 * Without this, a project created before the row existed can never get
 * one: the factory list in mb_state.js only applies to a NEW project,
 * and a loaded file replaces coverRows wholesale. The user would have
 * to add a custom row by hand and it would carry no seedKey, so it
 * would not follow the interface language.
 *
 * Idempotent, and it inserts rather than appends: the row belongs
 * directly after the qualification it names a part of, not at the
 * bottom under Version.
 */
function mbEnsureUnitTitleRow() {
    var rows = mbState.coverRows || [];
    for (var i = 0; i < rows.length; i++) {
        if (rows[i].seedKey === 'cvUnitTitle') return;
    }
    var at = rows.length;
    for (var j = 0; j < rows.length; j++) {
        if (rows[j].seedKey === 'cvQualification') { at = j + 1; break; }
    }
    mbState.coverRowIdCounter = (mbState.coverRowIdCounter || rows.length) + 1;
    rows.splice(at, 0, mbMakeCoverRow('cvUnitTitle', mbState.coverRowIdCounter));
}

/**
 * Give any project — new, loaded or reset — the nine framework rows.
 *
 * Appended, in MB_COVER_FRAMEWORK_KEYS order, and only the ones that
 * are missing. A user who deleted "Review Due Date" because their
 * ministry does not ask for it would find it back on the next render if
 * this rebuilt the whole block, so the check is per row and the row is
 * added at the END rather than at a fixed index: after a delete, a
 * re-add must not push the user's own custom rows around.
 *
 * Runs before mbMigrateTvqfRows(), which needs somewhere to put the old
 * card's values.
 */
function mbEnsureFrameworkRows() {
    var rows = mbState.coverRows || (mbState.coverRows = []);
    var seen = {};
    rows.forEach(function (r) { if (r.seedKey) seen[r.seedKey] = true; });
    /* A row the user RENAMED has no seedKey but still carries `field`.
       Without this second pass the rename would be read as a deletion
       and the row would be silently duplicated. */
    rows.forEach(function (r) { if (r.field) seen[r.field] = true; });

    /* Once seeded, never re-seeded — otherwise a field the user deleted
       because their ministry does not ask for it would reappear on the
       next render, and there would be no way to get rid of it.

       Two tests, because the flag alone is not enough: a project saved
       before the flag existed loads without it, and re-seeding such a
       file would duplicate all nine rows. So the PRESENCE of any
       framework row is also read as "this project has been seeded",
       which is true of every file the flag would have covered. */
    var alreadySeeded = !!mbState.coverFrameworkSeeded;
    if (!alreadySeeded) {
        MB_COVER_FRAMEWORK_KEYS.forEach(function (key) { if (seen[key]) alreadySeeded = true; });
    }

    if (!alreadySeeded) {
        MB_COVER_FRAMEWORK_KEYS.forEach(function (key) {
            if (seen[key]) return;
            mbState.coverRowIdCounter = (mbState.coverRowIdCounter || rows.length) + 1;
            rows.push(mbMakeCoverRow(key, mbState.coverRowIdCounter));
        });
    }
    mbState.coverFrameworkSeeded = true;
}

/* ── Migration off the retired framework card ────────────────
   Fields the card owned and this table now owns. [group, oldName, seedKey]. */
var MB_TVQF_MIGRATE = [
    ['ext',   'entryRequirements', 'cvEntryReq'],
    ['ext',   'qualificationType', 'cvQualType'],
    ['basic', 'frameworkName',     'cvFramework'],
    ['basic', 'notionalHours',     'cvHours'],
    ['basic', 'awardingBody',      'cvAwardingBody'],
    ['ext',   'rpl',               'cvRpl'],
    ['ext',   'accreditationDate', 'cvAccredited'],
    ['ext',   'reviewDate',        'cvReviewDue'],
    ['ext',   'alignmentNote',     'cvAlignment']
];

/* Fields the card owned that nothing owns now. [group, oldName, labelKey].
   They are NOT silently discarded: anything typed into them becomes a
   custom row, labelled with the words the card used, which the user can
   then keep, rename or delete. Deleting a field is a decision about the
   tool; deleting an afternoon of somebody's typing is a different
   decision and is not ours to make on their behalf. */
var MB_TVQF_RETIRED = [
    ['ext', 'knowledge',        'tqKnowledge'],
    ['ext', 'skill',            'tqSkill'],
    ['ext', 'competence',       'tqCompetence'],
    ['ext', 'progression',      'tqProgression'],
    ['ext', 'assessmentMethod', 'tqMethod']
];

function _mbCoverRowByKey(key) {
    var rows = mbState.coverRows || [];
    for (var i = 0; i < rows.length; i++) {
        if (rows[i].seedKey === key || rows[i].field === key) return rows[i];
    }
    return null;
}

/**
 * Carry a pre-existing project's framework card into the cover table.
 *
 * Runs once per project, from mbSeedCoverLabels(), which every load,
 * reset and render path already goes through — so there is no separate
 * hook to remember to call and no ordering question about which module
 * migrates first.
 *
 * Only into an EMPTY row. If the user has already typed something into
 * the new row, that is the newer and more deliberate value and it wins;
 * the old keys are deleted either way, so this never fights the user on
 * a second pass.
 */
function mbMigrateTvqfRows() {
    var basic = mbState.tvqfBasic, ext = mbState.tvqfExtended;
    var haveBasic = basic && typeof basic === 'object';
    var haveExt   = ext   && typeof ext   === 'object';
    if (!haveBasic && !haveExt) return;

    var pick = function (group) { return (group === 'ext' ? ext : basic) || {}; };
    var read = function (v, code) {
        if (typeof v === 'string') return v;
        return (typeof biGetStrict === 'function') ? (biGetStrict(v, code) || '') : '';
    };

    /* The unit title lived in the card for one release before it became
       a cover row. Same rule, carried over from tvqf.js. */
    if (haveBasic && basic.unitTitle !== undefined) {
        var titleRow = _mbCoverRowByKey('cvUnitTitle');
        if (titleRow && biEmpty(titleRow.value)) {
            BILANG_CODES.forEach(function (code) {
                var v = read(basic.unitTitle, code);
                if (v) biSet(titleRow, 'value', code, v);
            });
        }
        delete basic.unitTitle;
    }

    MB_TVQF_MIGRATE.forEach(function (m) {
        var obj = pick(m[0]);
        if (obj[m[1]] === undefined || obj[m[1]] === null) return;
        var row = _mbCoverRowByKey(m[2]);
        var cfg = row ? mbCoverFieldType(row) : null;

        if (row && biEmpty(row.value) && !row.optionCode) {
            if (cfg && cfg.type === 'select') {
                /* The card stored the code, exactly as the row does. */
                var code = String(obj[m[1]] || '').trim();
                if (code) row.optionCode = code;
            } else if (cfg && cfg.neutral) {
                var flat = read(obj[m[1]], contentLang()) ||
                           read(obj[m[1]], BILANG_CODES[0]) || String(obj[m[1]] || '');
                if (flat) BILANG_CODES.forEach(function (c) { biSet(row, 'value', c, flat); });
            } else {
                BILANG_CODES.forEach(function (c) {
                    var v = read(obj[m[1]], c);
                    if (v) biSet(row, 'value', c, v);
                });
            }
        }
        delete obj[m[1]];
    });

    MB_TVQF_RETIRED.forEach(function (m) {
        var obj = pick(m[0]);
        if (obj[m[1]] === undefined || obj[m[1]] === null) { delete obj[m[1]]; return; }
        var any = false;
        BILANG_CODES.forEach(function (c) { if (read(obj[m[1]], c).trim()) any = true; });
        if (any) {
            mbState.coverRowIdCounter = (mbState.coverRowIdCounter || mbState.coverRows.length) + 1;
            /* No seedKey: this is the user's content now, in their table,
               and an interface-language switch must not touch it. */
            var row = { id: mbState.coverRowIdCounter, label: biNew(), value: biNew() };
            BILANG_CODES.forEach(function (c) {
                var lbl = window.i18n.tIn(m[2], c) || window.i18n.tIn(m[2], 'en') || '';
                biSet(row, 'label', c, lbl.replace(/:\s*$/, '') + ':');
                var v = read(obj[m[1]], c);
                if (v) biSet(row, 'value', c, v);
            });
            mbState.coverRows.push(row);
        }
        delete obj[m[1]];
    });

    /* Emptied, not deleted: storage.js and autosave.js still read these
       keys off a saved file, and `undefined` there would be written back
       as a missing key rather than an empty object. */
    mbState.tvqfBasic = {};
    mbState.tvqfExtended = {};
}

/**
 * Give a factory row its `seedKey` back.
 *
 * THIS is why the previous fix changed nothing on screen. Two code paths
 * rebuilt mbState.coverRows from a hard-coded English array with NO
 * seedKey on any row:
 *
 *     { id: 1, label: 'Sector:', value: '' }
 *
 * (storage.js, the reset path — now fixed there too). Every project
 * created or reset since then has rows that are, as far as the seeder is
 * concerned, seven labels the user typed by hand in English. So
 * mbSeedCoverLabels() correctly refused to touch them, mbCoverLabelText()
 * correctly showed them as user content, and the interface stayed
 * English no matter which language was selected.
 *
 * Fixing the source does nothing for the files already on disk, so the
 * row is re-identified by its TEXT: if the stored label matches this
 * key's wording in any locale we ship, it is our boilerplate, not a
 * rename, and the key is restored. A genuine rename matches nothing and
 * is left alone — which is the whole point of doing it by text rather
 * than by blindly re-keying all seven.
 */
function mbRecoverCoverSeedKeys() {
    if (!window.i18n) return;
    var norm = function (s) { return String(s || '').replace(/\s+/g, ' ').replace(/:$/, '').trim().toLowerCase(); };

    mbState.coverRows.forEach(function (row, idx) {
        if (row.seedKey) return;                       // already known
        /* Read both sides plus the legacy bare-string shape. */
        var candidates = [];
        if (typeof row.label === 'string') candidates.push(row.label);
        else if (biIs(row.label)) { candidates.push(row.label.en, row.label.ar); }
        candidates = candidates.filter(function (c) { return norm(c); });
        if (!candidates.length) {
            /* Empty label in one of the first seven rows: it can only be
               a factory row whose text was never written. */
            if (idx < MB_COVER_SEED_KEYS.length) row.seedKey = MB_COVER_SEED_KEYS[idx];
            return;
        }

        for (var k = 0; k < MB_COVER_SEED_KEYS.length; k++) {
            var key = MB_COVER_SEED_KEYS[k];
            for (var c = 0; c < BILANG_CODES.length; c++) {
                var ours = norm(window.i18n.tIn(key, BILANG_CODES[c]));
                if (!ours) continue;
                for (var i = 0; i < candidates.length; i++) {
                    if (norm(candidates[i]) === ours) { row.seedKey = key; return; }
                }
            }
        }
    });
}

/**
 * Keep a dropdown row's bilingual value in step with its code.
 *
 * The code is what the user chose; the pair is what the document prints.
 * Re-seeded on every render rather than written once at selection time,
 * so a wording fix in the dictionary reaches projects already on disk,
 * and so a row selected while only one language existed still exports
 * correctly in the other.
 *
 * A row whose code no longer matches any option — a file from a version
 * that offered a fourth qualification type — keeps whatever text it
 * holds rather than being blanked.
 */
function mbSeedCoverOptionValues() {
    mbState.coverRows.forEach(function (row) {
        var cfg = mbCoverFieldType(row);
        if (!cfg || cfg.type !== 'select') return;
        if (!row.optionCode) { row.value = biNew(); return; }
        var labelKey = null;
        cfg.options.forEach(function (o) { if (o[0] === row.optionCode) labelKey = o[1]; });
        if (!labelKey) return;
        if (!biIs(row.value)) row.value = biNew();
        BILANG_CODES.forEach(function (code) {
            biSet(row, 'value', code, window.i18n.tIn(labelKey, code) ||
                                      window.i18n.tIn(labelKey, 'en') || '');
        });
    });
}

/**
 * Seed factory cover labels in the current CONTENT language.
 *
 * Only rows that still carry a seedKey and have nothing typed on the
 * active side are touched: a row the user renamed has no seedKey left,
 * and a row translated on one side keeps whatever the other side holds.
 * Runs on every render and on both language switches, which is why it
 * must be idempotent and must not clobber.
 */
function mbSeedCoverLabels() {
    mbRecoverCoverSeedKeys();
    /* After recovery, never before: a legacy row whose seedKey is about
       to be restored must not be mistaken for a missing one. */
    mbEnsureUnitTitleRow();
    mbEnsureFrameworkRows();
    /* And after the rows exist, because it needs somewhere to write. */
    mbMigrateTvqfRows();
    mbState.coverRows.forEach(function (row) {
        if (!row.seedKey) return;
        /* A recovered row still holds the old English text on both sides
           (or as a bare string). It is ours, so it is overwritten in
           every language rather than merely filled where empty —
           otherwise "Sector:" sitting in label.ar would survive and the
           Arabic interface would keep showing it. */
        if (!biIs(row.label)) row.label = biNew();
        BILANG_CODES.forEach(function (code) {
            biSet(row, 'label', code, window.i18n.tIn(row.seedKey, code));
        });
    });
    mbSeedCoverOptionValues();
}

/**
 * The text to PRINT for a cover label on screen.
 *
 * A row that still carries `seedKey` has never been renamed: it is
 * interface boilerplate that happens to be stored as content, so it
 * follows the INTERFACE language — an Arabic interface must not show
 * "Sector:" merely because the author is editing the English side.
 * A renamed row is the user's own content and follows contentLang().
 * The DOCX keeps following exportLang(), through the pair seeded above.
 */
function mbCoverLabelText(row) {
    if (row.seedKey) {
        var ui = (window.i18n && window.i18n.getLang) ? window.i18n.getLang() : 'en';
        return window.i18n.tIn(row.seedKey, ui);
    }
    return biGetStrict(row.label, contentLang()) || biGet(row.label, contentLang());
}

// ============================================================
// Cover Table Functions
// ============================================================

function initializeCoverTable() {
    renderCoverTable();
}

/* ── The value control ───────────────────────────────────────
   One function, four shapes, because the alternative is four copies of
   the same id, class, dir and binding attributes and a bug fixed in
   three of them.

   `change` for select and date, `change` for text and textarea too:
   that is what the table has always used, and autosave.js observes the
   same event. Switching the text rows to `input` here would be an
   unrelated behaviour change smuggled in with this one. */
function _mbCoverControl(row) {
    var cfg   = mbCoverFieldType(row);
    var id    = 'cover-value-' + row.id;
    var val   = biGetStrict(row.value, contentLang());
    var place = (cfg && cfg.hint) ? window.i18n.t(cfg.hint) : window.i18n.t('dgEnterValue');
    var placeAttr = (cfg && cfg.hint) ? cfg.hint : 'dgEnterValue';
    var box   = 'padding: 8px; border: 1px solid #d1d5db; border-radius: 6px; width: 100%; text-align: start; font-family: inherit; font-size: inherit;';

    if (cfg && cfg.type === 'select') {
        var opts = '<option value=""></option>' + cfg.options.map(function (o) {
            return '<option value="' + escapeHtml(o[0]) + '"' +
                   (row.optionCode === o[0] ? ' selected' : '') + '>' +
                   escapeHtml(window.i18n.t(o[1])) + '</option>';
        }).join('');
        return '<select id="' + id + '" class="cover-value cover-value--select" dir="auto"' +
               ' data-act="updateCoverValue" data-on="change" data-args=\'[' + row.id + ']\'' +
               ' style="' + box + '">' + opts + '</select>';
    }

    if (cfg && cfg.type === 'textarea') {
        return '<textarea id="' + id + '" class="mb-content-field cover-value" dir="auto"' +
               ' rows="' + (cfg.rows || 2) + '"' +
               ' data-act="updateCoverValue" data-on="change" data-args=\'[' + row.id + ']\'' +
               ' placeholder="' + escapeHtml(place) + '" data-i18n-placeholder="' + placeAttr + '"' +
               ' style="' + box + ' resize: vertical;">' + escapeHtml(val) + '</textarea>';
    }

    /* dir="ltr" and the lock on number and date: digits run
       left-to-right in Arabic too, and flipping them only sends the
       caret to the wrong end — the same decision resources.js made for
       the quantity column. */
    if (cfg && (cfg.type === 'number' || cfg.type === 'date')) {
        return '<input type="' + cfg.type + '" id="' + id + '" class="cover-value"' +
               ' dir="ltr" data-dir-lock="ltr"' + (cfg.type === 'number' ? ' min="0"' : '') +
               ' value="' + escapeHtml(val) + '"' +
               ' data-act="updateCoverValue" data-on="change" data-args=\'[' + row.id + ']\'' +
               ' style="' + box + '">';
    }

    return '<input type="text" id="' + id + '" class="mb-content-field cover-value" dir="auto"' +
           ' value="' + escapeHtml(val) + '"' +
           ' data-act="updateCoverValue" data-on="change" data-args=\'[' + row.id + ']\'' +
           ' placeholder="' + escapeHtml(place) + '" data-i18n-placeholder="' + placeAttr + '"' +
           ' style="' + box + '">';
}

function renderCoverTable() {
    mbSeedCoverLabels();
    const container = document.getElementById('covers-table-container');
    if (!container) return;

    container.innerHTML = mbState.coverRows.map(row => `
        <div class="cover-row" style="display: grid; grid-template-columns: 2fr 3fr auto auto; gap: 10px; align-items: center; padding: 12px; border-bottom: 1px solid #e5e7eb; background: ${mbState.coverRows.indexOf(row) % 2 === 0 ? '#ffffff' : '#f9fafb'};">
            <div class="cover-label" dir="auto" data-dir-auto="1" style="font-weight: 600; color: #374151; word-break: break-word; text-align: start;">
                ${escapeHtml(mbCoverLabelText(row))}
            </div>
            ${_mbCoverControl(row)}
            <button class="mb-has-ico" data-act="renameCoverLabel" data-args='[${row.id}]' 
                    style="padding: 6px 12px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9em; white-space: nowrap;">
                <svg class="mb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4.5 19.5h4l10-10a2.1 2.1 0 0 0-3-3l-10 10z"/><path d="M14.5 6.5l3 3"/><path d="M4.5 19.5l.6-3.4"/></svg><span data-i18n="rxRename">${window.i18n.t('rxRename')}</span>
            </button>
            <button class="mb-icon-btn danger" data-act="deleteCoverRow" data-args='[${row.id}]'
                    title="${window.i18n.t('mbDelete')}" data-i18n-title="mbDelete">
                <svg class="mb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 7h16"/><path d="M9.5 7V5.6A1.6 1.6 0 0 1 11.1 4h1.8a1.6 1.6 0 0 1 1.6 1.6V7"/><path d="M6.6 7l.75 11.6A1.7 1.7 0 0 0 9.05 20.2h5.9a1.7 1.7 0 0 0 1.7-1.6L17.4 7"/><path d="M10.3 11v5.4M13.7 11v5.4"/></svg>
            </button>
        </div>
    `).join('');
}

function updateCoverValue(rowId) {
    const input = document.getElementById(`cover-value-${rowId}`);
    const row = mbState.coverRows.find(r => r.id === rowId);
    if (!row || !input) return;

    const cfg = mbCoverFieldType(row);

    /* A dropdown stores the CODE and lets the seeder write the words, in
       every language. Writing the visible text straight into the pair
       would put the interface language's wording on whichever side
       happened to be active and export it into the other. */
    if (cfg && cfg.type === 'select') {
        row.optionCode = input.value || '';
        mbSeedCoverOptionValues();
        return;
    }

    /* Language-neutral: written to both sides so an export in the other
       language does not lose it. */
    if (cfg && cfg.neutral) {
        if (!biIs(row.value)) row.value = biNew();
        BILANG_CODES.forEach(function (code) { biSet(row, 'value', code, input.value); });
        return;
    }

    /* biPut, not assignment: these rows are bilingual pairs since
       Schema v4, and a plain `row.value = ...` would replace the pair
       object with a bare string, silently deleting the other
       language the moment the field is edited. */
    biPut(row, 'value', input.value);
}

async function renameCoverLabel(rowId) {
    const row = mbState.coverRows.find(r => r.id === rowId);
    if (!row) return;
    
    const cur = biGet(row.label, contentLang()) || '';
    const newLabel = await mbPrompt(window.i18n.t('dgEnterNewLabelName'), cur.replace(':', ''));
    if (newLabel) {
        biPut(row, 'label', newLabel.trim().endsWith(':') ? newLabel.trim() : newLabel.trim() + ':');
        /* Renamed: this row is now the user's, in every language.
           `field` is deliberately NOT deleted — see the header note: a
           rename changes the wording, not the kind of answer the field
           takes. */
        delete row.seedKey;
        renderCoverTable();
    }
}

async function deleteCoverRow(rowId) {
    if (await mbConfirm(window.i18n.t('dgConfirmDeletionthisWillPermanently3'), { danger: true })) {
        mbState.coverRows = mbState.coverRows.filter(r => r.id !== rowId);
        renderCoverTable();
    }
}

async function addCoverRow() {
    const label = await mbPrompt(window.i18n.t('dgEnterLabelForNewRow'), window.i18n.t('dgCustomFieldDefault'));
    if (!label) return;
    
    mbState.coverRowIdCounter++;
    const text = label.trim().endsWith(':') ? label.trim() : label.trim() + ':';
    const newRow = { id: mbState.coverRowIdCounter, label: biNew(), value: biNew() };
    biPut(newRow, 'label', text);
    mbState.coverRows.push(newRow);
    renderCoverTable();
}

function saveCoverData() {
    // Update values from inputs before saving
    mbState.coverRows.forEach(row => {
        const input = document.getElementById(`cover-value-${row.id}`);
        if (input) updateCoverValue(row.id);
    });
}

// Work Team Functions
