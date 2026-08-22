// ============================================================
// /src/workteam.js
// Work team members
// Extracted verbatim from Module_Builder.html lines 2336-2420 (v2.0-legacy).
// ============================================================

function initializeWorkTeam() {
    renderWorkTeam();
}

function renderWorkTeam() {
    const container = document.getElementById('work-team-container');
    if (!container) return;
    
    if (mbState.teamMembers.length === 0) {
        container.innerHTML = '<p style="color: #9ca3af; text-align: center; padding: 20px;">' +
            window.i18n.t('dgNoTeamMembersYet') + '</p>';
        return;
    }
    
    container.innerHTML = mbState.teamMembers.map((member, index) => `
        <div class="team-member-row" style="display: grid; grid-template-columns: 2fr 2fr 2fr auto; gap: 10px; align-items: center; padding: 12px; border-bottom: 1px solid #e5e7eb; background: ${index % 2 === 0 ? '#ffffff' : '#f9fafb'};">
            <input type="text" 
                   id="team-name-${member.id}" 
                   value="${escapeHtml(biGetStrict(member.name, contentLang()))}" 
                   data-act="updateTeamMember" data-on="change" data-args='[${member.id},"name"]'
                   placeholder="${window.i18n.t('dgTeamName')}" data-i18n-placeholder="dgTeamName" 
                   style="padding: 8px; border: 1px solid #d1d5db; border-radius: 6px;"
                   class="mb-content-field">
            <input type="text" 
                   id="team-task-${member.id}" 
                   value="${escapeHtml(biGetStrict(member.task, contentLang()))}" 
                   data-act="updateTeamMember" data-on="change" data-args='[${member.id},"task"]'
                   placeholder="${window.i18n.t('dgTeamTask')}" data-i18n-placeholder="dgTeamTask" 
                   style="padding: 8px; border: 1px solid #d1d5db; border-radius: 6px;"
                   class="mb-content-field">
            <input type="text" 
                   id="team-location-${member.id}" 
                   value="${escapeHtml(biGetStrict(member.workLocation, contentLang()))}" 
                   data-act="updateTeamMember" data-on="change" data-args='[${member.id},"workLocation"]'
                   placeholder="${window.i18n.t('dgTeamLocation')}" data-i18n-placeholder="dgTeamLocation" 
                   style="padding: 8px; border: 1px solid #d1d5db; border-radius: 6px;"
                   class="mb-content-field">
            <button data-act="deleteTeamMember" data-args='[${member.id}]' 
                    style="padding: 6px 12px; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer;">
                🗑️
            </button>
        </div>
    `).join('');
}

function updateTeamMember(memberId, field) {
    const member = mbState.teamMembers.find(m => m.id === memberId);
    if (!member) return;
    
    /* The DOM id uses the field name directly, and `workLocation` is the
       field but `team-location-…` is the id. */
    const domField = field === 'workLocation' ? 'location' : field;
    const input = document.getElementById(`team-${domField}-${memberId}`);
    if (input) biPut(member, field, input.value);
}

function addTeamMember() {
    mbState.teamMemberIdCounter++;
    mbState.teamMembers.push({
        id: mbState.teamMemberIdCounter,
        name: '',
        task: '',
        workLocation: ''
    });
    renderWorkTeam();
}

async function deleteTeamMember(memberId) {
    if (await mbConfirm(window.i18n.t('dgConfirmDeletionthisWillPermanently9'), { danger: true })) {
        mbState.teamMembers = mbState.teamMembers.filter(m => m.id !== memberId);
        renderWorkTeam();
    }
}

function saveWorkTeamData() {
    // Update values from inputs before saving
    mbState.teamMembers.forEach(member => {
        const nameInput = document.getElementById(`team-name-${member.id}`);
        const taskInput = document.getElementById(`team-task-${member.id}`);
        const locationInput = document.getElementById(`team-location-${member.id}`);
        
        /* Bilingual pairs since v4 — see the note in covers.js. */
        if (nameInput)     biPut(member, 'name', nameInput.value);
        if (taskInput)     biPut(member, 'task', taskInput.value);
        if (locationInput) biPut(member, 'workLocation', locationInput.value);
    });
}
