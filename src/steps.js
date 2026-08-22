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
                <button class="btn-remove" data-act="removeStep" data-args='[${sc}]' title="${window.i18n.t('dgRemoveStep')}" data-i18n-title="dgRemoveStep">🗑</button>
            </div>
        </div>
        <textarea class="mb-content-field" placeholder="${window.i18n.t('dgDescribeThisStep')}" data-i18n-placeholder="dgDescribeThisStep" data-step-id="${sc}"  style="text-align: left;"></textarea>
        <div style="display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap;">
            <button class="btn-add-image" data-act="addImage" data-args='[${sc}]'>🖼️ ${window.i18n.t('dgAddImages')}</button>
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
   THESE THREE FUNCTIONS WERE MISSING.
   The file input above declared data-act="handleImageUpload", and no
   file in the project defines that name — so picking an image did
   nothing but log "No handler registered" to the console. Worse,
   sheets.js line ~312 calls renderStepImageGallery() when it loads an
   activity sheet that has images, which threw a ReferenceError and
   aborted the rest of the load. Both are implemented here, mirroring
   the content-section equivalents in content.js so the two galleries
   behave identically, and routed through image_prep.js on the way in.

   The input's data-act was renamed to handleStepImageUpload: the old
   name says "images" without saying whose, and if a definition of it
   does turn up in a file not yet reviewed, the two would silently
   compete for the same button. ------------------------------------ */

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
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = function (e) {
            mbState.stepImages[stepId].push(e.target.result);
            renderStepImageGallery(stepId);
        };
        reader.readAsDataURL(file);
    });
}

function removeStepImage(stepId, imgIndex) {
    if (!mbState.stepImages[stepId]) return;
    mbState.stepImages[stepId].splice(imgIndex, 1);
    renderStepImageGallery(stepId);
}

function renderStepImageGallery(stepId) {
    const gallery = document.getElementById(`step-image-gallery-${stepId}`);
    /* Called by sheets.js for every stored stepId, including ones whose
       row is not on screen yet. A missing gallery is normal, not an
       error — hence the quiet return rather than a throw. */
    if (!gallery) return;

    const images = mbState.stepImages[stepId] || [];
    if (images.length === 0) { gallery.innerHTML = ''; return; }

    gallery.innerHTML = images.map((src, i) => `
        <div class="content-img-thumb">
            <img src="${src}" alt="Image ${i + 1}">
            <button class="content-img-delete" data-act="removeStepImage" data-args='[${stepId},${i}]' title="${window.i18n.t('dgRemoveImage')}" data-i18n-title="dgRemoveImage">×</button>
        </div>
    `).join('');
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
