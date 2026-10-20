// ============================================================
// /src/criteria.js
// Assessment criteria rows
// Extracted verbatim from Module_Builder.html lines 4502-4541 (v2.0-legacy).
// ============================================================

function toggleCriteriaSection() {
    // Criteria section is always visible — no checkbox needed
    const section = document.getElementById('criteria-section');
    if (section) section.style.display = 'block';
    const tbody = document.getElementById('criteria-tbody');
    if (mbState.criteriaCount === 0 && tbody) addCriteria();
}

function clearCriteriaRows() {
    document.getElementById('criteria-tbody').innerHTML = '';
    mbState.criteriaCount = 0;
}

function addCriteria() {
    const tbody = document.getElementById('criteria-tbody');
    if (!tbody) {
        console.error('Criteria table body not found');
        return;
    }
    
    mbState.criteriaCount++;
    const row = document.createElement('tr');
    row.id = `criteria-row-${mbState.criteriaCount}`;
    mbNewRowUid(row);
    row.innerHTML = `
        <td class="criteria-row-number">${mbState.criteriaCount}</td>
        <td><textarea rows="1" class="mb-content-field criteria-text mb-autogrow" placeholder="${window.i18n.t('dgEnterCriterion')}" data-i18n-placeholder="dgEnterCriterion" data-criteria-id="${mbState.criteriaCount}"></textarea></td>
        <td style="text-align: center;"></td>
        <td style="text-align: center;"></td>
    `;
    tbody.appendChild(row);
}

/* ── 3.61.0: boxes that grow with their text ──────────────────
   A criterion was a one-line <input>: a long one ran out of sight. It is
   a one-row <textarea> now that grows to show the whole text, and so do
   the cells of the assessment form. The stylesheet asks for that with
   `field-sizing: content`, which Chrome learned in version 123; Chrome
   on Windows 7 stops at 109, so the height is also set here, from the
   text, on every keystroke and whenever the boxes are filled or shown. */
var MB_AUTOGROW_SEL = 'textarea.mb-autogrow, textarea.mb-asm-cell';

function mbAutoGrow(el) {
    if (!el || el.offsetParent === null) return;   // hidden: measured when shown
    el.style.height = 'auto';
    var cs = window.getComputedStyle(el);
    var extra = (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
    var max = parseFloat(cs.maxHeight);
    var h = el.scrollHeight + extra;
    el.style.height = (isFinite(max) && max > 0 ? Math.min(h, max) : h) + 'px';
}

function mbAutoGrowAll(root) {
    (root || document).querySelectorAll(MB_AUTOGROW_SEL).forEach(mbAutoGrow);
}

if (typeof document !== 'undefined') {
    document.addEventListener('input', function (e) {
        if (e.target && e.target.matches && e.target.matches(MB_AUTOGROW_SEL)) mbAutoGrow(e.target);
    });
    /* One criterion per row: Enter does not break it into lines (the
       text still wraps to the width of the cell). */
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey && e.target && e.target.matches && e.target.matches('textarea.criteria-text')) e.preventDefault();
    });
    window.addEventListener('resize', function () { mbAutoGrowAll(); });
}

async function removeCriteria(id) {
    if (await mbConfirm(window.i18n.t('dgConfirmDeletionthisWillPermanently4'), { danger: true })) {
        const element = document.getElementById(`criteria-row-${id}`);
        if (element) {
            element.remove();
        }
    }
}
