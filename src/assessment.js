// ============================================================
// /src/assessment.js
// Assessment forms & rows
// Extracted verbatim from Module_Builder.html lines 2421-2709 (v2.0-legacy).
// ============================================================

/**
 * The outcome title, as text.
 *
 * `lo.title` has been a bilingual pair since Schema v4, and this header
 * interpolated it straight into a template string — which is how the
 * form came to read "Learning Outcome 1: [object Object]". Every other
 * renderer in the tool goes through biGetStrict/biGet; this one was
 * missed because it builds its markup as one long string rather than
 * per field.
 *
 * biGetStrict first, then biGet: show the side being edited, but fall
 * back to the other language rather than printing an empty heading for
 * an outcome that does have a name. The legacy bare-string shape and a
 * genuinely untitled outcome are both handled on the way through.
 */
function _mbAsmTitle(lo) {
    if (!lo) return '';
    var lang = (typeof contentLang === 'function') ? contentLang() : 'en';
    var t = (typeof biGetStrict === 'function') ? biGetStrict(lo.title, lang) : '';
    if (!t && typeof biGet === 'function') t = biGet(lo.title, lang);
    if (!t && typeof lo.title === 'string') t = lo.title;
    return t || window.i18n.t('mbUntitled');
}

function renderAssessmentForms() {
    const container = document.getElementById('assessment-forms-list');
    if (!container) return;
    
    syncLearningOutcomesFromCurrentModule();
    
    if (!mbState.learningOutcomesData || mbState.learningOutcomesData.length === 0) {
        /* Two frozen English strings in the Arabic interface. They were
           invisible to applyTranslations() because they are built by a
           renderer, not present in index.html, so they carried no
           data-i18n and no t() call. */
        container.innerHTML = '<p style="color: #6b7280; text-align: center; padding: 20px;" data-i18n="dgNoLearningOutcomesAvailablePlease">' +
            window.i18n.t('dgNoLearningOutcomesAvailablePlease') + '</p>';
        return;
    }
    
    const loIdsWithForms = Object.keys(mbState.assessmentFormsData);
    if (loIdsWithForms.length === 0) {
        container.innerHTML = '<p style="color: #6b7280; text-align: center; padding: 20px;" data-i18n="dgNoAssessmentFormsYet">' +
            window.i18n.t('dgNoAssessmentFormsYet') + '</p>';
        return;
    }
    
    container.innerHTML = '';
    
    mbState.learningOutcomesData.forEach((lo, index) => {
        if (!mbState.assessmentFormsData[lo.id]) {
            return;
        }
        
        const formData = mbState.assessmentFormsData[lo.id];
        const formDiv = document.createElement('div');
        formDiv.className = 'assessment-form';
        formDiv.style.cssText = 'background: white; border: 2px solid #667eea; border-radius: 8px; padding: 25px; margin-bottom: 30px;';
        
        let formHTML = `
            <div style="background: #667eea; color: white; padding: 15px; border-radius: 6px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h4 style="margin: 0; font-size: 1.2em;"><span data-i18n="expAssessmentUnit">${window.i18n.t('expAssessmentUnit')}</span></h4>
                    <p style="margin: 5px 0 0 0; font-size: 1em; font-weight: 600;" dir="auto">${window.i18n.tf('expLearningOutcomeN', { v0: index + 1, v1: _mbAsmTitle(lo) })}</p>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button data-act="clearAssessmentForm" data-args='["${lo.id}"]' 
                        style="background: #f59e0b; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.9em;">
                        <svg class="mb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 7h16"/><path d="M9.5 7V5.6A1.6 1.6 0 0 1 11.1 4h1.8a1.6 1.6 0 0 1 1.6 1.6V7"/><path d="M6.6 7l.75 11.6A1.7 1.7 0 0 0 9.05 20.2h5.9a1.7 1.7 0 0 0 1.7-1.6L17.4 7"/><path d="M10.3 11v5.4M13.7 11v5.4"/></svg> <span data-i18n="rxClearForm">${window.i18n.t('rxClearForm')}</span>
                    </button>
                    <button data-act="deleteAssessmentForm" data-args='["${lo.id}"]' 
                        style="background: #ef4444; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.9em;">
                        <svg class="mb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg> <span data-i18n="dgDeleteForm">${window.i18n.t('dgDeleteForm')}</span>
                    </button>
                </div>
            </div>
            
            <div style="margin-bottom: 20px;">
                <h5 style="font-weight: 600; color: #374151; margin-bottom: 10px;"><span data-i18n="expPortfolioOfEvidence">${window.i18n.t('expPortfolioOfEvidence')}</span></h5>
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; border: 1px solid #d1d5db;">
                        <thead>
                            <tr style="background: #f3f4f6;">
                                <th style="border: 1px solid #d1d5db; padding: 10px; text-align: left; font-size: 0.9em;"><span data-i18n="expAssessmentCriteria">${window.i18n.t('expAssessmentCriteria')}</span></th>
                                <th style="border: 1px solid #d1d5db; padding: 10px; text-align: left; font-size: 0.9em;"><span data-i18n="expNameNumberActivities">${window.i18n.t('expNameNumberActivities')}</span></th>
                                <th style="border: 1px solid #d1d5db; padding: 10px; text-align: left; font-size: 0.9em;"><span data-i18n="expOutcomesMethod">${window.i18n.t('expOutcomesMethod')}</span></th>
                                <th style="border: 1px solid #d1d5db; padding: 10px; text-align: left; font-size: 0.9em;"><span data-i18n="expEvidenceVerification">${window.i18n.t('expEvidenceVerification')}</span></th>
                                <th style="border: 1px solid #d1d5db; padding: 10px; text-align: left; font-size: 0.9em;"><span data-i18n="expCompletionDateNotes">${window.i18n.t('expCompletionDateNotes')}</span></th>
                                <th style="border: 1px solid #d1d5db; padding: 10px; text-align: center; width: 60px;"><span data-i18n="rxActions">${window.i18n.t('rxActions')}</span></th>
                            </tr>
                        </thead>
                        <tbody id="assessment-tbody-${lo.id}">
        `;
        
        formData.rows.forEach((row, rowIndex) => {
            formHTML += `
                <tr>
                    <td style="border: 1px solid #d1d5db; padding: 8px;">
                        <input type="text" value="${row.criteria || ''}" 
                            data-act="updateAssessmentCell" data-on="change" data-args='["${lo.id}",${rowIndex},"criteria","$value"]'
                            style="width: 100%; border: 1px solid #e5e7eb; padding: 6px; border-radius: 4px; font-size: 0.9em;">
                    </td>
                    <td style="border: 1px solid #d1d5db; padding: 8px;">
                        <input type="text" value="${row.activities || ''}"
                            data-act="updateAssessmentCell" data-on="change" data-args='["${lo.id}",${rowIndex},"activities","$value"]'
                            style="width: 100%; border: 1px solid #e5e7eb; padding: 6px; border-radius: 4px; font-size: 0.9em;">
                    </td>
                    <td style="border: 1px solid #d1d5db; padding: 8px;">
                        <input type="text" value="${row.outcomes || ''}"
                            data-act="updateAssessmentCell" data-on="change" data-args='["${lo.id}",${rowIndex},"outcomes","$value"]'
                            style="width: 100%; border: 1px solid #e5e7eb; padding: 6px; border-radius: 4px; font-size: 0.9em;">
                    </td>
                    <td style="border: 1px solid #d1d5db; padding: 8px;">
                        <input type="text" value="${row.verification || ''}"
                            data-act="updateAssessmentCell" data-on="change" data-args='["${lo.id}",${rowIndex},"verification","$value"]'
                            style="width: 100%; border: 1px solid #e5e7eb; padding: 6px; border-radius: 4px; font-size: 0.9em;">
                    </td>
                    <td style="border: 1px solid #d1d5db; padding: 8px;">
                        <input type="text" value="${row.date || ''}"
                            data-act="updateAssessmentCell" data-on="change" data-args='["${lo.id}",${rowIndex},"date","$value"]'
                            style="width: 100%; border: 1px solid #e5e7eb; padding: 6px; border-radius: 4px; font-size: 0.9em;">
                    </td>
                    <td style="border: 1px solid #d1d5db; padding: 8px; text-align: center;">
                        <button class="mb-icon-btn danger" data-act="deleteAssessmentRow" data-args='["${lo.id}",${rowIndex}]'
                            title="${window.i18n.t('mbDelete')}" data-i18n-title="mbDelete">
                            <svg class="mb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 7h16"/><path d="M9.5 7V5.6A1.6 1.6 0 0 1 11.1 4h1.8a1.6 1.6 0 0 1 1.6 1.6V7"/><path d="M6.6 7l.75 11.6A1.7 1.7 0 0 0 9.05 20.2h5.9a1.7 1.7 0 0 0 1.7-1.6L17.4 7"/><path d="M10.3 11v5.4M13.7 11v5.4"/></svg>
                        </button>
                    </td>
                </tr>
            `;
        });
        
        formHTML += `
                        </tbody>
                    </table>
                </div>
                <div style="display: flex; gap: 10px; margin-top: 10px;">
                    <button data-act="addAssessmentRow" data-args='["${lo.id}"]' 
                        style="background: #10b981; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.9em;">
                        ➕ <span data-i18n="dgAddRowBtn">${window.i18n.t('dgAddRowBtn')}</span>
                    </button>
                    <button data-act="clearAssessmentRows" data-args='["${lo.id}"]' 
                        style="background: #f59e0b; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 0.9em;">
                        <svg class="mb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 7h16"/><path d="M9.5 7V5.6A1.6 1.6 0 0 1 11.1 4h1.8a1.6 1.6 0 0 1 1.6 1.6V7"/><path d="M6.6 7l.75 11.6A1.7 1.7 0 0 0 9.05 20.2h5.9a1.7 1.7 0 0 0 1.7-1.6L17.4 7"/><path d="M10.3 11v5.4M13.7 11v5.4"/></svg> <span data-i18n="rxClearRows">${window.i18n.t('rxClearRows')}</span>
                    </button>
                </div>
            </div>
            
            <div style="margin-bottom: 20px;">
                <h5 style="font-weight: 600; color: #374151; margin-bottom: 10px;"><span data-i18n="expResultPlain">${window.i18n.t('expResultPlain')}</span></h5>
                <div style="display: flex; gap: 20px;">
                    <label style="display: flex; align-items: center; gap: 8px;">
                        <input type="checkbox" ${formData.competent ? 'checked' : ''} 
                            data-act="updateAssessmentResult" data-on="change" data-args='["${lo.id}","competent",this.checked]'
                            style="width: 18px; height: 18px;">
                        <span><span data-i18n="expCompetent">${window.i18n.t('expCompetent')}</span></span>
                    </label>
                    <label style="display: flex; align-items: center; gap: 8px;">
                        <input type="checkbox" ${formData.notYetCompetent ? 'checked' : ''} 
                            data-act="updateAssessmentResult" data-on="change" data-args='["${lo.id}","notYetCompetent",this.checked]'
                            style="width: 18px; height: 18px;">
                        <span><span data-i18n="expNotYetCompetent">${window.i18n.t('expNotYetCompetent')}</span></span>
                    </label>
                </div>
            </div>
            
            <div style="margin-bottom: 15px;">
                <h5 style="font-weight: 600; color: #374151; margin-bottom: 10px;"><span data-i18n="dgSignatures">${window.i18n.t('dgSignatures')}</span></h5>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0; border: 1px solid #d1d5db; border-radius: 4px; overflow: hidden; margin-bottom: 8px;">
                    <div style="padding: 10px 12px; border-right: 1px solid #d1d5db; background: #f9fafb;">
                        <div style="font-size: 0.82em; color: #6b7280; margin-bottom: 2px;"><span data-i18n="expTrainerName">${window.i18n.t('expTrainerName')}</span></div>
                        <div style="font-size: 0.9em; color: #374151; min-height: 22px;">_______________________</div>
                    </div>
                    <div style="padding: 10px 12px; border-right: 1px solid #d1d5db; background: #f9fafb;">
                        <div style="font-size: 0.82em; color: #6b7280; margin-bottom: 2px;"><span data-i18n="dgTrainerSignature">${window.i18n.t('dgTrainerSignature')}</span></div>
                        <div style="font-size: 0.9em; color: #374151; min-height: 22px;">_______________________</div>
                    </div>
                    <div style="padding: 10px 12px; background: #f9fafb;">
                        <div style="font-size: 0.82em; color: #6b7280; margin-bottom: 2px;"><span data-i18n="dgTrainerDate">${window.i18n.t('dgTrainerDate')}</span></div>
                        <div style="font-size: 0.9em; color: #374151; min-height: 22px;">_______________________</div>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0; border: 1px solid #d1d5db; border-radius: 4px; overflow: hidden;">
                    <div style="padding: 10px 12px; border-right: 1px solid #d1d5db; background: #f9fafb;">
                        <div style="font-size: 0.82em; color: #6b7280; margin-bottom: 2px;"><span data-i18n="expLearnerName">${window.i18n.t('expLearnerName')}</span></div>
                        <div style="font-size: 0.9em; color: #374151; min-height: 22px;">_______________________</div>
                    </div>
                    <div style="padding: 10px 12px; border-right: 1px solid #d1d5db; background: #f9fafb;">
                        <div style="font-size: 0.82em; color: #6b7280; margin-bottom: 2px;"><span data-i18n="dgLearnerSignature">${window.i18n.t('dgLearnerSignature')}</span></div>
                        <div style="font-size: 0.9em; color: #374151; min-height: 22px;">_______________________</div>
                    </div>
                    <div style="padding: 10px 12px; background: #f9fafb;">
                        <div style="font-size: 0.82em; color: #6b7280; margin-bottom: 2px;"><span data-i18n="dgLearnerDate">${window.i18n.t('dgLearnerDate')}</span></div>
                        <div style="font-size: 0.9em; color: #374151; min-height: 22px;">_______________________</div>
                    </div>
                </div>
                <p style="font-size: 0.78em; color: #9ca3af; margin-top: 6px; margin-bottom: 0;"><span data-i18n="dgSignaturesManual">${window.i18n.t('dgSignaturesManual')}</span></p>
            </div>
        `;
        
        formDiv.innerHTML = formHTML;
        container.appendChild(formDiv);
    });
}

async function addNewAssessmentForm() {
    syncLearningOutcomesFromCurrentModule();
    
    if (!mbState.learningOutcomesData || mbState.learningOutcomesData.length === 0) {
        await mbAlert(window.i18n.t('dgNoLearningOutcomesAvailablePlease'));
        return;
    }
    
    const loWithoutForm = mbState.learningOutcomesData.find(lo => !mbState.assessmentFormsData[lo.id]);
    
    if (!loWithoutForm) {
        await mbAlert(window.i18n.t('dgAllLearningOutcomesAlreadyHave'));
        return;
    }
    
    mbState.assessmentFormsData[loWithoutForm.id] = {
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
    
    renderAssessmentForms();
}

async function clearAssessmentForm(loId) {
    if (await mbConfirm(window.i18n.t('dgClearAllDataInThis'), { danger: true })) {
        if (mbState.assessmentFormsData[loId]) {
            mbState.assessmentFormsData[loId] = {
                rows: [{ criteria: '', activities: '', outcomes: '', verification: '', date: '' }],
                competent: false,
                notYetCompetent: false,
                teacherName: '',
                teacherSignature: '',
                teacherDate: '',
                learnerName: '',
                learnerSignature: '',
                learnerDate: ''
            };
            renderAssessmentForms();
        }
    }
}

async function deleteAssessmentForm(loId) {
    if (await mbConfirm(window.i18n.t('dgDeleteThisAssessmentFormCompletely'), { danger: true })) {
        delete mbState.assessmentFormsData[loId];
        renderAssessmentForms();
    }
}

function updateAssessmentCell(loId, rowIndex, field, value) {
    if (mbState.assessmentFormsData[loId] && mbState.assessmentFormsData[loId].rows[rowIndex]) {
        mbState.assessmentFormsData[loId].rows[rowIndex][field] = value;
    }
}

function updateAssessmentResult(loId, field, value) {
    if (mbState.assessmentFormsData[loId]) {
        mbState.assessmentFormsData[loId][field] = value;
    }
}

function updateAssessmentSignature(loId, field, value) {
    if (mbState.assessmentFormsData[loId]) {
        mbState.assessmentFormsData[loId][field] = value;
    }
}

function addAssessmentRow(loId) {
    if (!mbState.assessmentFormsData[loId]) {
        mbState.assessmentFormsData[loId] = { rows: [] };
    }
    mbState.assessmentFormsData[loId].rows.push({
        criteria: '',
        activities: '',
        outcomes: '',
        verification: '',
        date: ''
    });
    renderAssessmentForms();
}

async function deleteAssessmentRow(loId, rowIndex) {
    if (mbState.assessmentFormsData[loId] && mbState.assessmentFormsData[loId].rows.length > 1) {
        mbState.assessmentFormsData[loId].rows.splice(rowIndex, 1);
        renderAssessmentForms();
    } else {
        await mbAlert(window.i18n.t('dgCannotDeleteTheLastRow'));
    }
}

async function clearAssessmentRows(loId) {
    if (await mbConfirm(window.i18n.t('dgAreYouSureYouWant'))) {
        if (mbState.assessmentFormsData[loId]) {
            mbState.assessmentFormsData[loId].rows = [{ criteria: '', activities: '', outcomes: '', verification: '', date: '' }];
            renderAssessmentForms();
        }
    }
}


// ── References functions ────────────────────────────────────────
