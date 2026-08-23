// ============================================================
// /src/resources.js
// Resources list
// Extracted verbatim from Module_Builder.html lines 5004-5057 (v2.0-legacy).
// ============================================================

/* The quantity input keeps dir="ltr" on purpose: digits run
   left-to-right in Arabic too, and flipping a number field only moves the
   caret to the wrong end. */
function addResource() {
    mbState.resourceCount++;
    const rc = mbState.resourceCount;
    const tbody = document.getElementById('resources-container');
    const tr = document.createElement('tr');
    tr.id = `resource-${rc}`;
    mbNewRowUid(tr);
    tr.style.background = rc % 2 === 0 ? '#f9fafb' : '#ffffff';
    tr.innerHTML = `
        <td style="border:1px solid #d1d5db;padding:6px 8px;">
            <input type="text" class="resource-name" data-resource-id="${rc}"
                placeholder="${window.i18n.t('dgMaterialOrEquipmentName')}" data-i18n-placeholder="dgMaterialOrEquipmentName"
                
                style="width:100%;border:1px solid #e5e7eb;padding:6px 8px;border-radius:4px;font-size:0.9em;font-family:inherit;">
        </td>
        <td style="border:1px solid #d1d5db;padding:6px 8px;text-align:center;">
            <input type="number" class="resource-quantity" data-quantity-id="${rc}"
                value="1" min="1" dir="ltr"
                style="width:70px;border:1px solid #e5e7eb;padding:6px;border-radius:4px;font-size:0.9em;text-align:center;font-family:inherit;">
        </td>
        <td style="border:1px solid #d1d5db;padding:6px 8px;text-align:center;">
            <button class="btn-remove mb-icon-btn danger" data-act="removeResource" data-args='[${rc}]' title="${window.i18n.t('dgRemoveRow')}" data-i18n-title="dgRemoveRow"><svg class="mb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 7h16"/><path d="M9.5 7V5.6A1.6 1.6 0 0 1 11.1 4h1.8a1.6 1.6 0 0 1 1.6 1.6V7"/><path d="M6.6 7l.75 11.6A1.7 1.7 0 0 0 9.05 20.2h5.9a1.7 1.7 0 0 0 1.7-1.6L17.4 7"/><path d="M10.3 11v5.4M13.7 11v5.4"/></svg></button>
        </td>
    `;
    tbody.appendChild(tr);
}

function removeResource(id) {
    const element = document.getElementById(`resource-${id}`);
    if (element) element.remove();
}

async function clearAllResources() {
    if (await mbConfirm(window.i18n.t('dgClearAllResourceRows'))) {
        document.getElementById('resources-container').innerHTML = '';
        mbState.resourceCount = 0;
        addResource(); addResource();
    }
}

/* ── Instructional Marks Configuration ─────────────────────────────
   `label` is now an i18n KEY, not display text. It has to be resolved at
   the point of use rather than here, because the two consumers need two
   different languages: the editor menu follows the interface, the DOCX
   header follows the export language. A pre-resolved string could only
   ever satisfy one of them. */
const MARK_TYPES = [
    { key: 'attention', label: 'mkAttention',      icon: '⚠️',  bg: '#fff3cd', border: '#ffc107', header: '#ffc107', headerText: '#5c3600' },
    { key: 'review',    label: 'mkReview',         icon: '🔍',  bg: '#e8f4fd', border: '#1a78c2', header: '#1a78c2', headerText: '#ffffff' },
    { key: 'question',  label: 'mkQuestion',       icon: '❓',  bg: '#f0e6ff', border: '#7c3aed', header: '#7c3aed', headerText: '#ffffff' },
    { key: 'reflect',   label: 'mkReflect',        icon: '💭',  bg: '#e6f9f5', border: '#0d9488', header: '#0d9488', headerText: '#ffffff' },
    { key: 'note',      label: 'mkNote',           icon: '📝',  bg: '#f0f4ff', border: '#4f46e5', header: '#4f46e5', headerText: '#ffffff' },
    { key: 'tip',       label: 'mkTip',            icon: '💡',  bg: '#fffbeb', border: '#d97706', header: '#d97706', headerText: '#ffffff' },
    { key: 'important', label: 'mkImportant',      icon: '❗',  bg: '#fff0f0', border: '#dc2626', header: '#dc2626', headerText: '#ffffff' },
    { key: 'remember',  label: 'mkRemember',       icon: '🔔',  bg: '#fff5f0', border: '#ea580c', header: '#ea580c', headerText: '#ffffff' },
    { key: 'warning',   label: 'mkWarning',        icon: '⛔',  bg: '#fdf0f0', border: '#b91c1c', header: '#b91c1c', headerText: '#ffffff' },
    { key: 'example',   label: 'mkExample',        icon: '📌',  bg: '#f0f9f0', border: '#16a34a', header: '#16a34a', headerText: '#ffffff' },
    { key: 'goodprac',  label: 'mkGoodPractice',  icon: '✅',  bg: '#f0fdf4', border: '#059669', header: '#059669', headerText: '#ffffff' },
];
