/* The seven factory rows, and the dictionary keys that name them.
   Order matters only as a fallback: it is how a row that lost BOTH its
   seedKey and its recognisable text is re-identified, by position. */
var MB_COVER_SEED_KEYS = ['cvSector', 'cvOccupation', 'cvJob', 'cvQualification',
                          'cvModuleCode', 'cvLevel', 'cvVersion'];

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
// /src/covers.js
// Cover table: rows, labels, values
// Extracted verbatim from Module_Builder.html lines 2253-2335 (v2.0-legacy).
// ============================================================

// Cover Table Functions
function initializeCoverTable() {
    renderCoverTable();
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
            <input type="text" 
                   id="cover-value-${row.id}" 
                   class="mb-content-field cover-value"
                   dir="auto"
                   value="${escapeHtml(biGetStrict(row.value, contentLang()))}" 
                   data-act="updateCoverValue" data-on="change" data-args='[${row.id}]'
                   placeholder="${window.i18n.t('dgEnterValue')}" data-i18n-placeholder="dgEnterValue" 
                   style="padding: 8px; border: 1px solid #d1d5db; border-radius: 6px; width: 100%; text-align: start;"
                   >
            <button data-act="renameCoverLabel" data-args='[${row.id}]' 
                    style="padding: 6px 12px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9em; white-space: nowrap;">
                ✏️ <span data-i18n="rxRename">${window.i18n.t('rxRename')}</span>
            </button>
            <button data-act="deleteCoverRow" data-args='[${row.id}]' 
                    style="padding: 6px 12px; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9em;">
                🗑️
            </button>
        </div>
    `).join('');
}

function updateCoverValue(rowId) {
    const input = document.getElementById(`cover-value-${rowId}`);
    const row = mbState.coverRows.find(r => r.id === rowId);
    if (row && input) {
        /* biPut, not assignment: these rows are bilingual pairs since
           Schema v4, and a plain `row.value = ...` would replace the pair
           object with a bare string, silently deleting the other
           language the moment the field is edited. */
        biPut(row, 'value', input.value);
    }
}

async function renameCoverLabel(rowId) {
    const row = mbState.coverRows.find(r => r.id === rowId);
    if (!row) return;
    
    const cur = biGet(row.label, contentLang()) || '';
    const newLabel = await mbPrompt(window.i18n.t('dgEnterNewLabelName'), cur.replace(':', ''));
    if (newLabel) {
        biPut(row, 'label', newLabel.trim().endsWith(':') ? newLabel.trim() : newLabel.trim() + ':');
        /* Renamed: this row is now the user's, in every language. */
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
        if (input) biPut(row, 'value', input.value);
    });
}

// Work Team Functions
