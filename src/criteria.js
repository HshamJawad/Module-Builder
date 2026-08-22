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
        <td><input type="text" class="mb-content-field criteria-text" placeholder="${window.i18n.t('dgEnterCriterion')}" data-i18n-placeholder="dgEnterCriterion" data-criteria-id="${mbState.criteriaCount}" ></td>
        <td style="text-align: center;"></td>
        <td style="text-align: center;"></td>
    `;
    tbody.appendChild(row);
}

async function removeCriteria(id) {
    if (await mbConfirm(window.i18n.t('dgConfirmDeletionthisWillPermanently4'), { danger: true })) {
        const element = document.getElementById(`criteria-row-${id}`);
        if (element) {
            element.remove();
        }
    }
}
