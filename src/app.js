// ============================================================
// /src/app.js
// Application entry point. Loaded last; wires initial render.
// Extracted from Module_Builder.html lines 4542-4569.
// ============================================================


// Toggle edit mode for instruction and footer
document.addEventListener('DOMContentLoaded', function() {
    const editInstructionCheckbox = document.getElementById('edit-instruction');
    const editFooterCheckbox = document.getElementById('edit-footer');
    const instructionTextarea = document.getElementById('criteria-instruction');
    const footerTextarea = document.getElementById('criteria-footer');

/* edit checkbox listeners removed */
    
    /* Not awaited, and it does not need to be: the boot sequence below
       does not read the outcome list, and awaiting here would mean making
       the DOMContentLoaded handler async — which delays every later
       initializer behind a microtask for no gain. */
    initializeLearningOutcomes();
    
    // Initialize Cover Table
    initializeCoverTable();
    
    // Initialize Work Team
    initializeWorkTeam();
    
    // Initialize Assessment Content
    // DISABLED: Let HTML display as-is without JavaScript overwriting it
    // initializeAssessmentContent();
    
    // Initialize with first resource and step
    addResource(); addResource();
    addStep();
    addContentSection(); // Add first content section
});

/* Content-language switch: painted last, after every renderer exists. */
if (typeof renderContentLangSwitch === 'function') {
    renderContentLangSwitch();
    renderExportLangSwitch();
    applyContentDirection();
}

/* Boot complete: language-change repaints may now run. */
if (typeof mbMarkBooted === 'function') mbMarkBooted();
