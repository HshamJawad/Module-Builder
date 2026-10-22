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
        mbScrollToTabTop(selectedTabContent);
        /* 3.61.0: boxes filled while the tab was hidden take their height now. */
        if (typeof mbAutoGrowAll === 'function') mbAutoGrowAll(selectedTabContent);
    }
    
    /* Activate the corresponding tab button.
       This used to match on the button's `onclick` attribute. events.js
       replaced every inline handler with `data-act` / `data-args`, so
       getAttribute('onclick') has returned null for every button since
       that conversion and NO tab has been highlighted at all — the panel
       switched correctly, the highlight simply never moved. Matched on
       data-args now, which is what the markup actually carries. The
       fallback keeps any legacy inline handler working. */
    allTabButtons.forEach(tab => {
        let matches = false;
        const args = tab.getAttribute('data-args');
        if (args) {
            try { matches = JSON.parse(args)[0] === tabName; }
            catch (e) { matches = args.includes(`"${tabName}"`); }
        }
        if (!matches) {
            const onclickAttr = tab.getAttribute('onclick');
            matches = !!(onclickAttr && onclickAttr.includes(`'${tabName}'`));
        }
        if (matches) tab.classList.add('active');
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
    
    /* 3.69.0: the learning unit card (Introduction Pages) and the
       reflection (Reflection tab) paint for the outcome open now. */
    if ((tabName === 'intro' || tabName === 'reflection') && typeof mbRenderLgUnit === 'function') {
        try { mbRenderLgUnit(true); } catch (e) { /* not ready */ }
    }

    if (tabName === 'mapping') {
        /* Sheets can be removed, and mapped items returned to Available,
           from the Information / Activity / Assessment tabs — repaint the
           Available and Assigned lists from current state on entry. */
        if (typeof renderSourceBrowser === 'function') renderSourceBrowser();
        if (typeof renderAssignedItemsPanel === 'function') renderAssignedItemsPanel();
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
        /* 3.59.0: the Learner guide's portfolio follows the sheets. */
        if (typeof mbRenderLgAsm === 'function') mbRenderLgAsm();
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


/* 3.53.0: the heading above the tabs names the OPEN TAB, word for word
   as the side navigation does (as in DACUM Live Pro), instead of
   repeating the tool's name, which already heads the side navigation.

   Read from the active button rather than from a table of keys: the
   button is already translated, and renamed by Settings → Misc (sheet
   names), so the heading follows both without knowing about either.
   An observer on the navigation repaints it whenever the active button
   or its text changes — a tab switch, a language switch, a rename. A
   button that opens a dialog (Coverage, Settings) never becomes active,
   so the heading keeps naming the tab underneath. */
function mbSyncTabTitle() {
    var h = document.getElementById('mb-tab-title');
    var btn = document.querySelector('#mb-sidenav .tabs .tab.active');
    if (!h || !btn) return;
    var text = (btn.textContent || '').replace(/\s+/g, ' ').trim();
    if (text && h.textContent !== text) h.textContent = text;
}

(function watchTabTitle() {
    function start() {
        mbSyncTabTitle();
        var nav = document.querySelector('#mb-sidenav .tabs');
        if (!nav || !window.MutationObserver) return;
        new MutationObserver(mbSyncTabTitle).observe(nav, {
            subtree: true, childList: true, characterData: true,
            attributes: true, attributeFilter: ['class']
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();


/* 3.53.1: a tab opens at its TITLE, not at its first field.
   This used to be selectedTabContent.scrollIntoView({ block: 'start' }),
   which put the panel's first line at the very top of the window — under
   the fixed toolbar, and with the tab's title (mbSyncTabTitle, above
   the panel) scrolled out of sight a moment after it appeared. The page
   now scrolls so the title sits just below the toolbar. When the title
   bar is not above the panel (a narrow layout that stacks the side
   navigation in between), the panel itself is the target, with the
   same toolbar offset. */
function mbScrollToTabTop(panel) {
    var bar = document.querySelector('.mb-tab-title-bar');
    var target = panel;
    if (bar && bar.offsetParent !== null && panel &&
        bar.getBoundingClientRect().bottom <= panel.getBoundingClientRect().top + 1) {
        var between = panel.getBoundingClientRect().top - bar.getBoundingClientRect().bottom;
        if (between < 200) target = bar;
    }
    if (!target) return;
    var tb = document.querySelector('.figma-toolbar');
    var offset = 0;
    if (tb) {
        var pos = getComputedStyle(tb).position;
        if (pos === 'fixed' || pos === 'sticky') offset = Math.max(0, tb.getBoundingClientRect().bottom);
    }
    var y = target.getBoundingClientRect().top + window.pageYOffset - offset - 12;
    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
}
