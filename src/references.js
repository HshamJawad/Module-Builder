// ============================================================
// /src/references.js
// References list
// Extracted verbatim from Module_Builder.html lines 2710-2771 (v2.0-legacy).
// ============================================================

/**
 * Seed the References heading from the dictionary, in the CONTENT
 * language, the same way mbSeedCoverLabels() seeds cover-row labels.
 *
 * Same reasoning: the heading is data the user can rename, so it must
 * not be swept by applyTranslations() on an interface-language switch —
 * that would silently overwrite a rename. It is seeded only while empty,
 * via mbState.referencesTitle being a bilingual pair like everything else
 * the user types.
 */
function mbSeedReferencesTitle() {
    /* Both sides, for the same reason as mbSeedCoverLabels(): seeding
       only the active side left the other one empty forever, so an
       Arabic export of a module authored in English printed the English
       heading through biGet's fallback. Our own text exists in both
       languages; a rename replaces both and this stops applying. */
    BILANG_CODES.forEach(function (code) {
        if (biGetStrict(mbState.referencesTitle, code).trim()) return;
        biSet(mbState, 'referencesTitle', code, window.i18n.tIn('expReferences', code));
    });
}

function renderReferences() {
    mbSeedReferencesTitle();
    const display = document.getElementById('references-title-display');
    if (display) display.textContent = '📚 ' + _refsTitleNow();

    const list = document.getElementById('references-list');
    if (!list) return;
    list.innerHTML = '';
    mbState.referencesData.forEach((ref, idx) => {
        const row = document.createElement('div');
        row.className = 'ref-entry';
        row.dataset.refId = ref.id;
        row.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:12px;';
        row.innerHTML = `
            <span style="color:#6b7280;font-weight:600;min-width:22px;text-align:right;">${idx + 1}.</span>
            <input type="text" class="mb-content-field ref-input" placeholder="${escapeHtml(_refPlaceholder())}" data-i18n-placeholder="mbEGSmithJ2020Vocational" 
                style="flex:1;padding:9px 12px;border:2px solid #d1d5db;border-radius:6px;font-size:0.97em;background:white;"
                value="${escapeHtml(ref.value)}"
                data-act="updateReferenceValue" data-on="input" data-args='[${ref.id},"$value"]' />
            ${mbState.referencesData.length > 1 ? `<button class="mb-icon-btn danger" data-act="deleteReference" data-args='[${ref.id}]'
                    title="${window.i18n.t('mbDelete')}" data-i18n-title="mbDelete"><svg class="mb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 7h16"/><path d="M9.5 7V5.6A1.6 1.6 0 0 1 11.1 4h1.8a1.6 1.6 0 0 1 1.6 1.6V7"/><path d="M6.6 7l.75 11.6A1.7 1.7 0 0 0 9.05 20.2h5.9a1.7 1.7 0 0 0 1.7-1.6L17.4 7"/><path d="M10.3 11v5.4M13.7 11v5.4"/></svg></button>` : ''}
        `;
        list.appendChild(row);
    });
    renderFacilities();
}

/* 3.81.0: in the Learner guide the page is headed «Suggested resources…»
   (a name from Settings, unless the author renamed the section) and an
   entry may be a web address, so the example says so. */
function _refsTitleNow() {
    const stored = biGetStrict(mbState.referencesTitle, contentLang());
    return (typeof mbLgRefsTitle === 'function') ? mbLgRefsTitle(stored, contentLang()) : stored;
}
function _refPlaceholder() {
    const lg = (typeof mbIsLearnerGuide === 'function') && mbIsLearnerGuide();
    return window.i18n.t(lg ? 'lgRefPh' : 'mbEGSmithJ2020Vocational');
}

/* ── Material facilities (Learner guide) ─────────────────────────
   Rows of «number · item», printed under the suggested resources in the
   same table. Plain strings, like the references: kept as typed. */
function renderFacilities() {
    const card = document.getElementById('facilities-card');
    if (!card) return;
    const lg = (typeof mbIsLearnerGuide === 'function') && mbIsLearnerGuide();
    if (!lg) { card.innerHTML = ''; return; }
    if (!Array.isArray(mbState.facilitiesData) || !mbState.facilitiesData.length) mbState.facilitiesData = [{ id: 1, qty: '', value: '' }];
    const lang = contentLang();
    const ico = '<svg class="mb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 7h16"/><path d="M9.5 7V5.6A1.6 1.6 0 0 1 11.1 4h1.8a1.6 1.6 0 0 1 1.6 1.6V7"/><path d="M6.6 7l.75 11.6A1.7 1.7 0 0 0 9.05 20.2h5.9a1.7 1.7 0 0 0 1.7-1.6L17.4 7"/><path d="M10.3 11v5.4M13.7 11v5.4"/></svg>';
    const dir = (typeof biIsRtl === 'function' && biIsRtl(lang)) ? 'rtl' : 'ltr';
    const rows = mbState.facilitiesData.map((f) =>
        '<div class="fac-entry" data-fac-id="' + f.id + '">' +
          '<input type="text" inputmode="numeric" class="mb-content-field fac-qty" dir="ltr" aria-label="' + escapeHtml(window.i18n.t('lgFacNumber')) + '" placeholder="' + escapeHtml(window.i18n.t('lgFacNumber')) + '" value="' + escapeHtml(f.qty) + '" data-act="updateFacilityValue" data-on="input" data-args=\'[' + f.id + ',"qty","$value"]\' />' +
          '<input type="text" class="mb-content-field fac-input" dir="' + dir + '" placeholder="' + escapeHtml(window.i18n.t('lgFacItemPh')) + '" value="' + escapeHtml(f.value) + '" data-act="updateFacilityValue" data-on="input" data-args=\'[' + f.id + ',"value","$value"]\' />' +
          (mbState.facilitiesData.length > 1 ? '<button type="button" class="mb-icon-btn danger" data-act="deleteFacility" data-args=\'[' + f.id + ']\' title="' + escapeHtml(window.i18n.t('mbDelete')) + '" aria-label="' + escapeHtml(window.i18n.t('mbDelete')) + '">' + ico + '</button>' : '') +
        '</div>').join('');
    card.innerHTML =
        '<div class="fac-head">' + escapeHtml('🧰 ' + ((typeof mbLgLabel === 'function') ? mbLgLabel('facilities', lang) : '')) + '</div>' +
        '<div id="facilities-list">' + rows + '</div>' +
        '<div style="margin-top:8px;"><button type="button" class="fac-add" data-act="addFacility">➕ ' + escapeHtml(window.i18n.t('lgFacAdd')) + '</button></div>';
}
function updateFacilityValue(id, field, value) {
    const f = (mbState.facilitiesData || []).find(r => r.id === id);
    if (f && (field === 'qty' || field === 'value')) f[field] = value;
}
function addFacility() {
    mbState.facIdCounter = (mbState.facIdCounter || 1) + 1;
    mbState.facilitiesData.push({ id: mbState.facIdCounter, qty: '', value: '' });
    renderFacilities();
    const ins = document.querySelectorAll('#facilities-list .fac-input');
    if (ins.length) ins[ins.length - 1].focus();
}
function deleteFacility(id) {
    if (mbState.facilitiesData.length <= 1) return;
    mbState.facilitiesData = mbState.facilitiesData.filter(r => r.id !== id);
    renderFacilities();
}

function escapeHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function updateReferenceValue(id, value) {
    const ref = mbState.referencesData.find(r => r.id === id);
    if (ref) ref.value = value;
}

function addReference() {
    mbState.refIdCounter++;
    mbState.referencesData.push({ id: mbState.refIdCounter, value: '' });
    renderReferences();
    // Focus the new input
    const inputs = document.querySelectorAll('#references-list .ref-input');
    if (inputs.length) inputs[inputs.length - 1].focus();
}

function deleteReference(id) {
    if (mbState.referencesData.length <= 1) return;
    mbState.referencesData = mbState.referencesData.filter(r => r.id !== id);
    renderReferences();
}

async function renameReferencesTitle() {
    const cur = _refsTitleNow();
    const newTitle = await mbPrompt(window.i18n.t('dgEnterNewSectionTitle'), cur);
    if (newTitle && newTitle.trim()) {
        /* biPut/biSet, not assignment — see the note in covers.js. A bare
           assignment here replaces the pair with a string and destroys
           whatever the other language held. */
        biSet(mbState, 'referencesTitle', contentLang(), newTitle.trim());
        const display = document.getElementById('references-title-display');
        if (display) display.textContent = '📚 ' + _refsTitleNow();
    }
}

function syncReferencesFromDOM() {
    document.querySelectorAll('#references-list .ref-input').forEach((input, idx) => {
        if (mbState.referencesData[idx]) mbState.referencesData[idx].value = input.value;
    });
}

// ── Front Cover functions ────────────────────────────────────────
