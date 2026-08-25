// ============================================================
// /src/steps.js
// Activity steps & step images
// Extracted verbatim from Module_Builder.html lines 5223-5319 (v2.0-legacy).
// ============================================================

function addStep() {
    mbState.stepCount++;
    const sc = mbState.stepCount;
    const container = document.getElementById('steps-container');
    const stepDiv = document.createElement('div');
    stepDiv.className = 'step-item';
    stepDiv.id = `step-${sc}`;
    /* Stable identity, independent of the DOM counter `sc`. `sc` is
       regenerated from zero on every load, so it can order rows but can
       never say "this is the same step as before". */
    mbNewRowUid(stepDiv);
    stepDiv.innerHTML = `
        <div class="step-header">
            <div class="step-label" data-i18n-num="expStepN" data-i18n-num-v0="${sc}">${window.i18n.tf('expStepN', { v0: sc })}</div>
            <div style="display:flex;gap:5px;align-items:center;">
                <button class="btn-clear-section" data-act="clearStep" data-args='[${sc}]' title="${window.i18n.t('dgClearStep')}" data-i18n-title="dgClearStep">✕</button>
                <button class="btn-remove mb-icon-btn danger" data-act="removeStep" data-args='[${sc}]' title="${window.i18n.t('dgRemoveStep')}" data-i18n-title="dgRemoveStep"><svg class="mb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 7h16"/><path d="M9.5 7V5.6A1.6 1.6 0 0 1 11.1 4h1.8a1.6 1.6 0 0 1 1.6 1.6V7"/><path d="M6.6 7l.75 11.6A1.7 1.7 0 0 0 9.05 20.2h5.9a1.7 1.7 0 0 0 1.7-1.6L17.4 7"/><path d="M10.3 11v5.4M13.7 11v5.4"/></svg></button>
            </div>
        </div>
        <textarea class="mb-content-field" placeholder="${window.i18n.t('dgDescribeThisStep')}" data-i18n-placeholder="dgDescribeThisStep" data-step-id="${sc}"  style="text-align: left;"></textarea>
        <div style="display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap;">
            <button class="btn-add-image" data-act="addImage" data-args='[${sc}]'>🖼️ ${window.i18n.t('dgAddImages')}</button>
            <button class="btn-add-image btn-paste-image" data-act="pasteStepImage" data-args='[${sc}]' title="${window.i18n.t('rxPasteImageTip')}" data-i18n-title="rxPasteImageTip">📋 <span data-i18n="rxPasteImage">${window.i18n.t('rxPasteImage')}</span></button>
            <button data-act="addStep" style="background:#667eea;color:white;border:none;padding:6px 14px;border-radius:5px;font-size:0.85em;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:4px;white-space:nowrap;">➕ <span data-i18n="dgAddStep">${window.i18n.t('dgAddStep')}</span></button>
            ${addMarkBtnHtml(`step-marks-${sc}`)}
        </div>
        <input type="file" id="image-input-${sc}" accept="image/*" multiple style="display:none;" data-act="handleStepImageUpload" data-on="change" data-args='[${sc}]'>
        <div id="step-image-gallery-${sc}" class="content-image-gallery"></div>
        <div id="step-marks-${sc}" class="marks-container"></div>
    `;
    container.appendChild(stepDiv);
}

/* ── Step images ─────────────────────────────────────────────
   Only the UPLOAD path is redefined here, and only to put the picked
   files through image_prep.js before they reach state.

   renderStepImageGallery() and removeStepImage() are deliberately NOT
   redefined. They already exist elsewhere in the project and work; this
   file loads late, so a second definition here would shadow them
   silently and quietly drop whatever the original does that this one
   would not. The upload handler is the only place that has to change,
   because it is the only one that touches the bytes.

   The input's data-act was renamed from handleImageUpload to
   handleStepImageUpload so the two do not compete for the same button:
   the old handler still exists and still works — it just no longer
   receives the click. ---------------------------------------------- */

function handleStepImageUpload(stepId) {
    const input = document.getElementById(`image-input-${stepId}`);
    if (!input || !input.files || !input.files.length) return;

    if (!mbState.stepImages[stepId]) mbState.stepImages[stepId] = [];

    /* Sequential, and downscaled on the way in. A step often carries
       four or five process photos; decoding them in parallel is how a
       phone browser runs out of memory. */
    const files = Array.from(input.files);
    input.value = '';   // reset so the same file can be re-added

    if (typeof mbPrepareImages === 'function') {
        mbPrepareImages(files, 'content').then(results => {
            results.forEach(r => mbState.stepImages[stepId].push(r.dataUrl));
            renderStepImageGallery(stepId);
        });
        return;
    }
    /* image_prep.js missing: fall back to exactly what the original
       handler did. An unoptimised image beats no image. */
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = function (e) {
            mbState.stepImages[stepId].push(e.target.result);
            renderStepImageGallery(stepId);
        };
        reader.readAsDataURL(file);
    });
}

async function removeStep(id) {
    if (await mbConfirm(window.i18n.t('dgConfirmDeletionthisWillPermanently8'), { danger: true })) {
        const element = document.getElementById(`step-${id}`);
        if (element) {
            element.remove();
            delete mbState.stepImages[id];
        }
    }
}

function addImage(stepId) {
    document.getElementById(`image-input-${stepId}`).click();
}


// Objective Formatting Function
function formatObjective(fieldId, action) {
    const textarea = document.getElementById(fieldId);
    if (!textarea) return;
    
    let text = textarea.value.trim();
    if (!text) return;
    
    // Split into lines and filter out empty lines
    let lines = text.split('\n').filter(line => line.trim());
    
    if (action === 'number') {
        // Remove existing numbering or bullets first
        lines = lines.map(line => {
            // Remove numbers like "1. " or "1) " or "1- "
            line = line.replace(/^\d+[\.\)\-]\s*/, '');
            // Remove bullets
            line = line.replace(/^[•●○▪▫◦⦿⦾]\s*/, '');
            return line.trim();
        });
        
        // Add numbering
        lines = lines.map((line, index) => `${index + 1}. ${line}`);
        
    } else if (action === 'bullet') {
        // Remove existing numbering or bullets first
        lines = lines.map(line => {
            // Remove numbers like "1. " or "1) " or "1- "
            line = line.replace(/^\d+[\.\)\-]\s*/, '');
            // Remove bullets
            line = line.replace(/^[•●○▪▫◦⦿⦾]\s*/, '');
            return line.trim();
        });
        
        // Add bullets
        lines = lines.map(line => `• ${line}`);
        
    } else if (action === 'clear') {
        // Remove all numbering and bullets
        lines = lines.map(line => {
            // Remove numbers like "1. " or "1) " or "1- "
            line = line.replace(/^\d+[\.\)\-]\s*/, '');
            // Remove bullets
            line = line.replace(/^[•●○▪▫◦⦿⦾]\s*/, '');
            return line.trim();
        });
    }
    
    // Update textarea with formatted text
    textarea.value = lines.join('\n');
}

// Export UX feedback functions
