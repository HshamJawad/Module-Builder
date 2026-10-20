// ============================================================
// /src/steps.js
// Activity steps & step images
// Extracted verbatim from Module_Builder.html lines 5223-5319 (v2.0-legacy).
// ============================================================

/* This button's label has now been reported broken three times running,
   each time traced to the SAME root cause: the mb-translations.js that
   is actually loaded on the live page does not match the one reviewed
   locally — a stale deploy or an old cached file, not a defect in this
   code. Every fix attempt that still asked window.i18n.t() to look the
   key up first was therefore still hostage to that mismatch: an English
   fallback is progress over the raw key, but it is still the wrong
   language on an Arabic screen.

   So these two strings are resolved from a small table THIS FILE OWNS —
   window.i18n.t() is not consulted for them at all — matched to the
   CURRENT INTERFACE LANGUAGE. Same fix as the Learning Guide card hit
   the identical failure and was given its own string table for the same
   reason. Whatever mb-translations.js does or does not contain from now
   on, this button reads correctly in Arabic on an Arabic screen. */
var _MB_PASTE_LABELS = {
    ar: { rxPasteImage: 'لصق صورة', rxPasteImageTip: 'لصق صورة منسوخة من الحافظة أو من صفحة ويب' },
    en: { rxPasteImage: 'Paste Image', rxPasteImageTip: 'Paste an image copied from the clipboard or a web page' },
    fr: { rxPasteImage: 'Coller une image', rxPasteImageTip: 'Coller une image copiée depuis le presse-papiers ou une page web' }
};
function _mbStepLabelT(key) {
    var lang = (window.i18n && window.i18n.getLang) ? window.i18n.getLang() : 'en';
    var table = _MB_PASTE_LABELS[lang] || _MB_PASTE_LABELS.en;
    return table[key] || _MB_PASTE_LABELS.en[key] || key;
}

/* NO data-i18n / data-i18n-title on the paste button, deliberately (see
   the markup below). Leaving them on would let applyTranslations()'s
   normal sweep re-overwrite this text from mb-translations.js on the
   very next language switch — undoing the fix the moment the failure
   mode it exists for (a stale dictionary) actually occurs. This
   listener repaints every paste button already on the page instead,
   from the same local table, every time the interface language
   changes. Scoped to `[data-act="pasteStepImage"]` so it repaints only
   the buttons THIS file renders; content.js does the identical thing
   for its own. */
window.addEventListener('mb:langchange', function () {
    document.querySelectorAll('[data-act="pasteStepImage"]').forEach(function (btn) {
        var span = btn.querySelector('span');
        if (span) span.textContent = _mbStepLabelT('rxPasteImage');
        btn.title = _mbStepLabelT('rxPasteImageTip');
    });
});

/* 3.52.0: a step can be inserted BELOW any step, and the steps can be
   reordered — ↑ / ↓ on each card, or drag by the ⠿ handle. The labels
   below follow the same rule as the paste button above: this file owns
   them, matched to the interface language, so a stale dictionary cannot
   leave a raw key on the card. */
var _MB_STEP_ORDER_LABELS = {
    ar: { insertBelow: 'إضافة خطوة أسفلها', insertBelowTip: 'إدراج خطوة جديدة أسفل هذه الخطوة مباشرة',
          moveUp: 'نقل الخطوة إلى الأعلى', moveDown: 'نقل الخطوة إلى الأسفل',
          dragTip: 'اسحب لإعادة ترتيب الخطوات' },
    en: { insertBelow: 'Add step below', insertBelowTip: 'Insert a new step directly below this one',
          moveUp: 'Move step up', moveDown: 'Move step down',
          dragTip: 'Drag to reorder the steps' },
    fr: { insertBelow: 'Ajouter une étape en dessous', insertBelowTip: 'Insérer une nouvelle étape juste en dessous de celle-ci',
          moveUp: 'Monter l’étape', moveDown: 'Descendre l’étape',
          dragTip: 'Glisser pour réordonner les étapes' }
};
function _mbStepOrderT(key) {
    var lang = (window.i18n && window.i18n.getLang) ? window.i18n.getLang() : 'en';
    var table = _MB_STEP_ORDER_LABELS[lang] || _MB_STEP_ORDER_LABELS.en;
    return table[key] || _MB_STEP_ORDER_LABELS.en[key] || key;
}

window.addEventListener('mb:langchange', function () {
    document.querySelectorAll('#steps-container [data-step-tip]').forEach(function (el) {
        var key = el.getAttribute('data-step-tip');
        el.title = _mbStepOrderT(key);
        el.setAttribute('aria-label', _mbStepOrderT(key));
    });
    document.querySelectorAll('#steps-container [data-step-text]').forEach(function (el) {
        el.textContent = _mbStepOrderT(el.getAttribute('data-step-text'));
    });
});

/* Builds one step card, not yet attached. `sc` is the card's DOM id and
   never changes once given; the number the author SEES is its position,
   repainted by mbRenumberSteps() whenever the list changes — the same
   number the Word export prints (exports_docx.js uses index + 1). */
function _mbBuildStep() {
    mbState.stepCount++;
    const sc = mbState.stepCount;
    const stepDiv = document.createElement('div');
    stepDiv.className = 'step-item';
    stepDiv.id = `step-${sc}`;
    /* Stable identity, independent of the DOM counter `sc`. `sc` is
       regenerated from zero on every load, so it can order rows but can
       never say "this is the same step as before". */
    mbNewRowUid(stepDiv);
    const t = _mbStepOrderT;
    stepDiv.innerHTML = `
        <div class="step-header">
            <div class="mb-step-title">
                <span class="mb-step-handle" data-step-tip="dragTip" title="${t('dragTip')}" aria-label="${t('dragTip')}" role="img">⠿</span>
                <div class="step-label" data-i18n-num="expStepN" data-i18n-num-v0="${sc}">${window.i18n.tf('expStepN', { v0: sc })}</div>
            </div>
            <div style="display:flex;gap:5px;align-items:center;">
                <button class="mb-step-move" data-act="moveStepUp" data-args='[${sc}]' data-step-tip="moveUp" title="${t('moveUp')}" aria-label="${t('moveUp')}">▲</button>
                <button class="mb-step-move" data-act="moveStepDown" data-args='[${sc}]' data-step-tip="moveDown" title="${t('moveDown')}" aria-label="${t('moveDown')}">▼</button>
                <button class="btn-clear-section" data-act="clearStep" data-args='[${sc}]' title="${window.i18n.t('dgClearStep')}" data-i18n-title="dgClearStep">✕</button>
                <button class="btn-remove mb-icon-btn danger" data-act="removeStep" data-args='[${sc}]' title="${window.i18n.t('dgRemoveStep')}" data-i18n-title="dgRemoveStep"><svg class="mb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 7h16"/><path d="M9.5 7V5.6A1.6 1.6 0 0 1 11.1 4h1.8a1.6 1.6 0 0 1 1.6 1.6V7"/><path d="M6.6 7l.75 11.6A1.7 1.7 0 0 0 9.05 20.2h5.9a1.7 1.7 0 0 0 1.7-1.6L17.4 7"/><path d="M10.3 11v5.4M13.7 11v5.4"/></svg></button>
            </div>
        </div>
        <textarea class="mb-content-field" placeholder="${window.i18n.t('dgDescribeThisStep')}" data-i18n-placeholder="dgDescribeThisStep" data-step-id="${sc}"  style="text-align: left;"></textarea>
        <div style="display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap;">
            <button class="btn-add-image" data-act="addImage" data-args='[${sc}]'>🖼️ ${window.i18n.t('dgAddImages')}</button>
            <button class="btn-add-image btn-paste-image" data-act="pasteStepImage" data-args='[${sc}]' title="${_mbStepLabelT('rxPasteImageTip')}">📋 <span>${_mbStepLabelT('rxPasteImage')}</span></button>
            <!-- Was data-act="addStep", which always appended at the END of
                 the list — a button on step 2 that put the new step after
                 step 9. It now inserts directly below its own card; the
                 "Add Step" button under the list still appends. -->
            <button class="mb-step-insert" data-act="insertStepAfter" data-args='[${sc}]' data-step-tip="insertBelowTip" title="${t('insertBelowTip')}" aria-label="${t('insertBelowTip')}" style="background:#667eea;color:white;border:none;padding:6px 14px;border-radius:5px;font-size:0.85em;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:4px;white-space:nowrap;">➕ <span data-step-text="insertBelow">${t('insertBelow')}</span></button>
            <!-- The Activity tab had no table and no link button; both
                 existed only on the Information Sheet. addContentTable
                 is reused unchanged: it looks up a container whose id is
                 content-tables- plus the id it is given, so the step
                 simply passes step-N. -->
            <button class="btn-add-mark" data-act="addContentTable" data-args='["step-${sc}"]' style="background:#0ea5e9;" title="${window.i18n.t('dgAddTable')}">📋 <span>${window.i18n.t('dgAddTableBtn')}</span></button>
            <button class="btn-add-mark btn-link-modal" data-act="mbOpenLinkModal" data-args='["activity"]' style="background:#7c3aed;" title="${(typeof _lmT === 'function') ? _lmT('btn') : 'Link / QR'}">🔗 <span>${(typeof _lmT === 'function') ? _lmT('btn') : 'Link / QR'}</span></button>
            ${addMarkBtnHtml(`step-marks-${sc}`)}
        </div>
        <input type="file" id="image-input-${sc}" accept="image/*" multiple style="display:none;" data-act="handleStepImageUpload" data-on="change" data-args='[${sc}]'>
        <div id="step-image-gallery-${sc}" class="content-image-gallery"></div>
        <div id="content-tables-step-${sc}"></div>
        <div id="step-marks-${sc}" class="marks-container"></div>
    `;
    return stepDiv;
}

function addStep() {
    const container = document.getElementById('steps-container');
    container.appendChild(_mbBuildStep());
    mbRenumberSteps();
}

/* Inserts a new, empty step directly below step `id` and puts the
   cursor in it. Falls back to appending when that step is gone. */
function insertStepAfter(id) {
    const container = document.getElementById('steps-container');
    const ref = document.getElementById(`step-${id}`);
    const stepDiv = _mbBuildStep();
    if (ref && ref.parentNode === container) container.insertBefore(stepDiv, ref.nextSibling);
    else container.appendChild(stepDiv);
    mbRenumberSteps();
    const ta = stepDiv.querySelector('textarea');
    if (ta) {
        /* Same direction as its neighbours: contentLang sets `dir` on the
           fields it knows about, and a card born between two of them
           should not read the other way round. */
        const near = ref && ref.querySelector('textarea');
        if (near && near.getAttribute('dir')) ta.setAttribute('dir', near.getAttribute('dir'));
        try { ta.focus({ preventScroll: true }); } catch (e) { ta.focus(); }
        if (stepDiv.scrollIntoView) stepDiv.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
}

/* ↑ / ↓. Only the card moves: its id, images (keyed by id), marks and
   tables travel with it. The save reads the steps in DOM order, so the
   new order is what gets stored and exported. Undo and autosave come
   from the data-act dispatcher, as for every other button. */
function _mbMoveStep(id, dir) {
    const el = document.getElementById(`step-${id}`);
    if (!el || !el.parentNode) return;
    const box = el.parentNode;
    /* Store the sheet as it stands BEFORE the move, so every row is on
       record under its own uid; the save after the move then matches by
       uid, never by position (uid.js, biMergeArrayById). */
    if (typeof saveCurrentSheetToLO === 'function') {
        try { saveCurrentSheetToLO(); } catch (e) { /* ignore */ }
    }
    if (dir < 0) {
        const prev = el.previousElementSibling;
        if (!prev) return;
        box.insertBefore(el, prev);
    } else {
        const next = el.nextElementSibling;
        if (!next) return;
        box.insertBefore(el, next.nextSibling);
    }
    mbRenumberSteps();
    const btn = el.querySelector(dir < 0 ? '[data-act="moveStepUp"]' : '[data-act="moveStepDown"]');
    if (btn && !btn.disabled) btn.focus();
    if (el.scrollIntoView) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
function moveStepUp(id)   { _mbMoveStep(id, -1); }
function moveStepDown(id) { _mbMoveStep(id, +1); }

/* The label shows the card's POSITION, not its id: after a move, an
   insert or a delete the cards read Step 1, 2, 3 … again. The id stays
   in data-i18n-num-v0's place only as the value the language switch
   repaints from, so it is updated here too. The first card cannot go
   up and the last cannot go down. */
function mbRenumberSteps() {
    const box = document.getElementById('steps-container');
    if (!box) return;
    const items = Array.prototype.filter.call(box.children, function (c) { return c.classList.contains('step-item'); });
    items.forEach(function (item, i) {
        const label = item.querySelector('.step-header .step-label');
        if (label && label.hasAttribute('data-i18n-num')) {
            label.setAttribute('data-i18n-num-v0', String(i + 1));
            label.textContent = window.i18n.tf('expStepN', { v0: i + 1 });
        }
        const up = item.querySelector('[data-act="moveStepUp"]');
        const down = item.querySelector('[data-act="moveStepDown"]');
        if (up) up.disabled = (i === 0);
        if (down) down.disabled = (i === items.length - 1);
    });
}

/* Deletes, loads and resets empty and refill the container from several
   files; an observer keeps the numbers right without each of them having
   to know this function exists (same reasoning as content.js's
   watchEmptyContainers). */
(function watchStepOrder() {
    function start() {
        const box = document.getElementById('steps-container');
        if (!box || !window.MutationObserver) return;
        new MutationObserver(mbRenumberSteps).observe(box, { childList: true });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();

/* Drag to reorder, by the ⠿ handle only. The card becomes draggable
   while the pointer is down on the handle and stops being draggable the
   moment it is released, so selecting text in a step still selects text.
   The card moves live under the pointer; the drop is one undo step and
   one autosave. Touch screens, where HTML drag-and-drop is unreliable,
   have the ↑ / ↓ buttons. */
(function mbStepDrag() {
    var dragEl = null, hist = null;

    function release() {
        document.querySelectorAll('#steps-container > .step-item[draggable="true"]').forEach(function (el) {
            if (el !== dragEl) el.removeAttribute('draggable');
        });
    }
    document.addEventListener('pointerdown', function (e) {
        var h = e.target && e.target.closest && e.target.closest('#steps-container .mb-step-handle');
        if (!h) return;
        var item = h.closest('.step-item');
        if (item) item.setAttribute('draggable', 'true');
    });
    document.addEventListener('pointerup', release);

    document.addEventListener('dragstart', function (e) {
        var item = e.target && e.target.closest && e.target.closest('#steps-container > .step-item');
        if (!item || item.getAttribute('draggable') !== 'true') return;
        if (typeof saveCurrentSheetToLO === 'function') {
            try { saveCurrentSheetToLO(); } catch (err) { /* ignore */ }
        }
        dragEl = item;
        item.classList.add('is-dragging');
        try {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', '');
        } catch (err) { /* ignore */ }
        hist = (typeof mbHistBegin === 'function') ? mbHistBegin('moveStep') : null;
    });

    document.addEventListener('dragover', function (e) {
        if (!dragEl) return;
        var box = document.getElementById('steps-container');
        var target = e.target && e.target.closest && e.target.closest('#steps-container > .step-item');
        if (!box || !box.contains(e.target)) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        if (!target || target === dragEl) return;
        var r = target.getBoundingClientRect();
        var before = e.clientY < r.top + r.height / 2;
        var ref = before ? target : target.nextSibling;
        if (ref !== dragEl && ref !== dragEl.nextSibling) box.insertBefore(dragEl, ref);
    });

    document.addEventListener('drop', function (e) {
        if (dragEl) e.preventDefault();
    });

    document.addEventListener('dragend', function () {
        if (!dragEl) return;
        var el = dragEl;
        dragEl = null;
        el.classList.remove('is-dragging');
        el.removeAttribute('draggable');
        mbRenumberSteps();
        if (hist && typeof mbHistEnd === 'function') mbHistEnd(hist);
        hist = null;
        /* Autosave listens for input/change on the main container; a
           drag produces neither. */
        (el.parentNode || document).dispatchEvent(new Event('change', { bubbles: true }));
    });
})();

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
            if (typeof mbImgCapsSet === 'function') mbImgCapsSet('activity', id, null);   // 3.56.0
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
