// ============================================================
// /src/tabs.js
// Tab switching & guards
// Extracted verbatim from Module_Builder.html lines 2840-2931 (v2.0-legacy).
// ============================================================

async function switchTab(tabName) {
    // Hide all tab contents dynamically
    const allTabContents = document.querySelectorAll('.tab-content');
    allTabContents.forEach(tabContent => {
        tabContent.classList.remove('active');
    });
    
    // Remove active class from all tab buttons
    const allTabButtons = document.querySelectorAll('.tab');
    allTabButtons.forEach(tab => tab.classList.remove('active'));
    
    // Show selected tab content using dynamic ID
    const selectedTabContent = document.getElementById(tabName + '-tab');
    if (selectedTabContent) {
        selectedTabContent.classList.add('active');
        selectedTabContent.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }
    
    // Activate the corresponding tab button by matching onclick attribute
    allTabButtons.forEach(tab => {
        const onclickAttr = tab.getAttribute('onclick');
        if (onclickAttr && onclickAttr.includes(`'${tabName}'`)) {
            tab.classList.add('active');
        }
    });
    
    // Check learning outcome selection for info and activity tabs
    if (tabName === 'info' || tabName === 'activity') {
        /* MUST be awaited. checkLearningOutcomeSelected is async now, and
           a Promise is always truthy — `!promise` is permanently false, so
           without the await this guard silently stops guarding and the
           info/activity tabs open with no outcome selected. */
        if (!(await checkLearningOutcomeSelected())) return;
        if (tabName === 'info') ensureFirstInfoSheet();
        if (tabName === 'activity') ensureFirstActivitySheet();
    }
    
    if (tabName === 'assessment') {
        // Auto-create a form for every LO that doesn't have one yet
        syncLearningOutcomesFromCurrentModule();
        if (mbState.learningOutcomesData && mbState.learningOutcomesData.length > 0) {
            mbState.learningOutcomesData.forEach(lo => {
                if (!mbState.assessmentFormsData[lo.id]) {
                    mbState.assessmentFormsData[lo.id] = {
                        rows: [
                            { criteria: '', activities: '', outcomes: '', verification: '', date: '' },
                            { criteria: '', activities: '', outcomes: '', verification: '', date: '' },
                            { criteria: '', activities: '', outcomes: '', verification: '', date: '' },
                            { criteria: '', activities: '', outcomes: '', verification: '', date: '' },
                            { criteria: '', activities: '', outcomes: '', verification: '', date: '' },
                        ],
                        competent: false,
                        notYetCompetent: false,
                        teacherName: '',
                        teacherSignature: '',
                        teacherDate: '',
                        learnerName: '',
                        learnerSignature: '',
                        learnerDate: ''
                    };
                }
            });
        }
        renderAssessmentForms();
    }
}

async function checkLearningOutcomeSelected() {
    if (!mbState.currentLOId) {
        await mbAlert(window.i18n.t('dgPleaseSelectALearningOutcome'));
        await switchTab('basic-info');
        return false;
    }
    return true;
}

async function proceedToTab(tabName) {
    // Smart navigation for "Proceed to..." buttons
    // Check prerequisites before allowing navigation
    
    // For Info and Activity tabs, ensure a Learning Outcome is selected
    if (tabName === 'info' || tabName === 'activity') {
        if (!mbState.currentLOId) {
            await mbAlert(window.i18n.t('dgPleaseSelectALearningOutcome2'));
            await switchTab('basic-info');
            return; // Don't navigate
        }
    }
    
    // All prerequisites met - proceed to the tab
    await switchTab(tabName);
}
