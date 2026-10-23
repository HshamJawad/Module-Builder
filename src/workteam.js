// ============================================================
// /src/workteam.js
// Work team members
// Extracted verbatim from Module_Builder.html lines 2336-2420 (v2.0-legacy).
// ============================================================

function initializeWorkTeam() {
    renderWorkTeam();
}

/**
 * One empty row, always.
 *
 * The card used to open on the sentence "no team members yet", which
 * reads as a status report rather than an invitation: several users
 * took the card for a display of something filled in elsewhere and
 * never found the button. A visible row of empty fields says what the
 * card is for without a word of instruction. "Add member" keeps its
 * job — every member after the first.
 *
 * Called from renderWorkTeam rather than seeded in mb_state.js, because
 * the state is replaced wholesale on three other paths (new project,
 * reset, and opening a file that has an empty team) and each of them
 * ends in a render. Putting it here covers all four with one line;
 * seeding the initial value would cover only the first.
 *
 * Pairs, not bare strings: the row is v4-shaped from the moment it
 * exists, so nothing downstream depends on biPut's legacy-string
 * upgrade to make it so.
 */
function mbEnsureTeamMemberRow() {
    if (mbState.teamMembers.length) return;
    mbState.teamMemberIdCounter++;
    mbState.teamMembers.push({
        id: mbState.teamMemberIdCounter,
        name: biNew(),
        task: biNew(),
        workLocation: biNew()
    });
}

function renderWorkTeam() {
    const container = document.getElementById('work-team-container');
    if (!container) return;

    mbEnsureTeamMemberRow();

    
    /* 3.78.0: a table — a header row (Name, Task, Work location, in the
       interface language) and boxes that grow downwards with long text
       (criteria.js mbAutoGrow, also on browsers without field-sizing). */
    const cell = (member, field, domField, key) => `
            <textarea rows="1"
                   id="team-${domField}-${member.id}"
                   data-act="updateTeamMember" data-on="input" data-args='[${member.id},"${field}"]'
                   placeholder="${window.i18n.t(key)}" data-i18n-placeholder="${key}" aria-label="${window.i18n.t(key)}"
                   dir="auto" class="mb-content-field mb-autogrow team-field">${escapeHtml(biGetStrict(member[field], contentLang()))}</textarea>`;
    container.innerHTML =
        `<div class="team-member-row team-head-row" role="row">
            <div class="team-head" role="columnheader" data-i18n="dgTeamName">${window.i18n.t('dgTeamName')}</div>
            <div class="team-head" role="columnheader" data-i18n="dgTeamTask">${window.i18n.t('dgTeamTask')}</div>
            <div class="team-head" role="columnheader" data-i18n="dgTeamLocation">${window.i18n.t('dgTeamLocation')}</div>
            <div aria-hidden="true"></div>
        </div>` +
        mbState.teamMembers.map((member, index) => `
        <div class="team-member-row" role="row" style="background: ${index % 2 === 0 ? '#ffffff' : '#f9fafb'};">
            ${cell(member, 'name', 'name', 'dgTeamName')}
            ${cell(member, 'task', 'task', 'dgTeamTask')}
            ${cell(member, 'workLocation', 'location', 'dgTeamLocation')}
            <button class="mb-icon-btn danger" data-act="deleteTeamMember" data-args='[${member.id}]'
                    title="${window.i18n.t('mbDelete')}" data-i18n-title="mbDelete">
                <svg class="mb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 7h16"/><path d="M9.5 7V5.6A1.6 1.6 0 0 1 11.1 4h1.8a1.6 1.6 0 0 1 1.6 1.6V7"/><path d="M6.6 7l.75 11.6A1.7 1.7 0 0 0 9.05 20.2h5.9a1.7 1.7 0 0 0 1.7-1.6L17.4 7"/><path d="M10.3 11v5.4M13.7 11v5.4"/></svg>
            </button>
        </div>
    `).join('');
    if (typeof mbAutoGrowAll === 'function') mbAutoGrowAll(container);
}

/* One line per field: Enter does not break a name, task or place into
   lines (the text still wraps to the width of its box). */
document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target && e.target.matches && e.target.matches('textarea.team-field')) e.preventDefault();
});

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
        name: biNew(),
        task: biNew(),
        workLocation: biNew()
    });
    renderWorkTeam();
}

async function deleteTeamMember(memberId) {
    /* The last row is CLEARED, not removed. Removing it would land in
       mbEnsureTeamMemberRow on the next render and come straight back
       with a new id, which looks like the delete button is broken. The
       row keeps its id so nothing that referenced it goes stale, and
       BOTH languages are wiped: the user asked for the member to be
       gone, not for the side they happen to be editing to be gone.

       The two cases get two different confirm texts. A prompt that
       promises permanent removal before an action that visibly leaves
       the row on screen teaches the user to distrust every other
       confirm dialog in the app. */
    const isLast = mbState.teamMembers.length === 1;
    const msgKey = isLast ? 'dgConfirmClearLastTeamMember'
                          : 'dgConfirmDeletionthisWillPermanently9';
    if (!await mbConfirm(window.i18n.t(msgKey), { danger: true })) return;

    if (isLast) {
        const member = mbState.teamMembers[0];
        member.name         = biNew();
        member.task         = biNew();
        member.workLocation = biNew();
    } else {
        mbState.teamMembers = mbState.teamMembers.filter(m => m.id !== memberId);
    }
    renderWorkTeam();
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
