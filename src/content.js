// ============================================================
// /src/content.js
// Content sections, content tables, images, QR
// Extracted verbatim from Module_Builder.html lines 4153-4501 (v2.0-legacy).
// ============================================================

function clearAllForms() {
    mbState.currentInfoSheetIndex = 0;
    mbState.currentActivitySheetIndex = 0;
    updateInfoSheetNav(null);
    updateActivitySheetNav(null);
    document.getElementById('info-sheet-number').value = '';
    document.getElementById('info-title').value = '';
    document.getElementById('info-objective').value = '';
    document.getElementById('info-link-subject').value = '';
    document.getElementById('info-link-url').value = '';
    document.getElementById('info-qr-preview').innerHTML = '';
    mbState.infoQRImage = null;
    document.getElementById('self-check-number').value = '';
    document.getElementById('self-check-content').value = '';
    document.getElementById('answers-key-number').value = '';
    document.getElementById('answers-key-content').value = '';
    document.getElementById('content-sections-container').innerHTML = '';
    mbState.contentSectionCount = 0;
    addContentSection();
    
    document.getElementById('sheet-number').value = '';
    document.getElementById('title').value = '';
    document.getElementById('objective').value = '';
    document.getElementById('duration').value = '0';
    document.getElementById('activity-link-subject').value = '';
    document.getElementById('activity-link-url').value = '';
    document.getElementById('activity-qr-preview').innerHTML = '';
    mbState.activityQRImage = null;
    document.getElementById('resources-container').innerHTML = '';
    document.getElementById('steps-container').innerHTML = '';
    document.getElementById('criteria-tbody').innerHTML = '';
    /* include-criteria removed */
    mbState.resourceCount = 0;
    mbState.stepCount = 0;
    mbState.criteriaCount = 0;
    addResource(); addResource();
    addStep();
    toggleCriteriaSection();
}


function clearContentSection(id) {
    const ta = document.querySelector(`[data-content-id="${id}"]`);
    if (ta) ta.value = '';
    const gallery = document.getElementById(`content-image-gallery-${id}`);
    if (gallery) gallery.innerHTML = '';
    delete mbState.contentSectionImages[id];
    const marks = document.getElementById(`content-marks-${id}`);
    if (marks) marks.innerHTML = '';
    const tables = document.getElementById(`content-tables-${id}`);
    if (tables) tables.innerHTML = '';
}

function clearStep(id) {
    const ta = document.querySelector(`[data-step-id="${id}"]`);
    if (ta) ta.value = '';
    const gallery = document.getElementById(`step-image-gallery-${id}`);
    if (gallery) gallery.innerHTML = '';
    delete mbState.stepImages[id];
    const marks = document.getElementById(`step-marks-${id}`);
    if (marks) marks.innerHTML = '';
}

function clearSelfCheckSection() {
    document.getElementById('self-check-number').value = '';
    document.getElementById('self-check-content').value = '';
}

function clearAnswersKeySection() {
    document.getElementById('answers-key-number').value = '';
    document.getElementById('answers-key-content').value = '';
}

// ── Content Table Widget ───────────────────────────────────────
let contentTableCount = 0;

function addContentTable(contentId, initialData) {
    contentTableCount++;
    const tid = contentTableCount;
    const rows = (initialData && initialData.rows) || 2;
    const cols = (initialData && initialData.cols) || 2;
    const cells = (initialData && initialData.cells) || [];
    const container = document.getElementById(`content-tables-${contentId}`);
    if (!container) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'content-table-widget';
    wrapper.id = `ctw-${tid}`;
    wrapper.dataset.ctOwner = String(contentId);
    wrapper.innerHTML = `
        <div class="content-table-toolbar">
            <div class="ctb-left">
                <span>📋 Table:</span>
                <button class="ctb ctb-add" data-act="ctAddRow" data-args='[${tid}]' title="${window.i18n.t('dgAddRow')}" data-i18n-title="dgAddRow">➕ <span data-i18n="rxRow">${window.i18n.t('rxRow')}</span></button>
                <button class="ctb ctb-add" data-act="ctAddCol" data-args='[${tid}]' title="${window.i18n.t('dgAddColumn')}" data-i18n-title="dgAddColumn">➕ <span data-i18n="rxCol">${window.i18n.t('rxCol')}</span></button>
            </div>
            <div class="ctb-right">
                <button class="ctb ctb-del mb-has-ico" data-act="ctDelRow" data-args='[${tid}]' title="${window.i18n.t('dgDeleteLastRow')}" data-i18n-title="dgDeleteLastRow"><svg class="mb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 7h16"/><path d="M9.5 7V5.6A1.6 1.6 0 0 1 11.1 4h1.8a1.6 1.6 0 0 1 1.6 1.6V7"/><path d="M6.6 7l.75 11.6A1.7 1.7 0 0 0 9.05 20.2h5.9a1.7 1.7 0 0 0 1.7-1.6L17.4 7"/><path d="M10.3 11v5.4M13.7 11v5.4"/></svg><span data-i18n="rxRow">${window.i18n.t('rxRow')}</span></button>
                <button class="ctb ctb-del mb-has-ico" data-act="ctDelCol" data-args='[${tid}]' title="${window.i18n.t('dgDeleteLastColumn')}" data-i18n-title="dgDeleteLastColumn"><svg class="mb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 7h16"/><path d="M9.5 7V5.6A1.6 1.6 0 0 1 11.1 4h1.8a1.6 1.6 0 0 1 1.6 1.6V7"/><path d="M6.6 7l.75 11.6A1.7 1.7 0 0 0 9.05 20.2h5.9a1.7 1.7 0 0 0 1.7-1.6L17.4 7"/><path d="M10.3 11v5.4M13.7 11v5.4"/></svg><span data-i18n="rxCol">${window.i18n.t('rxCol')}</span></button>
                <button class="ctb ctb-close" data-act="ctRemove" data-args='[${tid}]' title="${window.i18n.t('dgRemoveTable')}" data-i18n-title="dgRemoveTable">✕ <span data-i18n="rxRemove">${window.i18n.t('rxRemove')}</span></button>
            </div>
        </div>
        <div class="content-table-grid" id="ctg-${tid}"></div>
    `;
    container.appendChild(wrapper);
    ctRender(tid, rows, cols, cells);
}

function ctRender(tid, rows, cols, cells) {
    const grid = document.getElementById(`ctg-${tid}`);
    if (!grid) return;
    const table = document.createElement('table');
    for (let r = 0; r < rows; r++) {
        const tr = document.createElement('tr');
        for (let c = 0; c < cols; c++) {
            const td = document.createElement('td');
            const ta = document.createElement('textarea');
            ta.dataset.row = r;
            ta.dataset.col = c;
            ta.placeholder = `R${r+1}C${c+1}`;
            ta.dir = 'ltr';
            if (cells && cells[r] && cells[r][c] !== undefined) {
                ta.value = cells[r][c];
            }
            td.appendChild(ta);
            tr.appendChild(td);
        }
        table.appendChild(tr);
    }
    grid.innerHTML = '';
    grid.appendChild(table);
}

function ctGetData(tid) {
    const grid = document.getElementById(`ctg-${tid}`);
    if (!grid) return null;
    const rows = Array.from(grid.querySelectorAll('tr'));
    const cells = rows.map(tr =>
        Array.from(tr.querySelectorAll('textarea')).map(ta => ta.value)
    );
    return { rows: rows.length, cols: rows[0] ? rows[0].querySelectorAll('textarea').length : 0, cells };
}

function ctAddRow(tid) {
    const d = ctGetData(tid);
    if (!d) return;
    ctRender(tid, d.rows + 1, d.cols, d.cells);
}

function ctAddCol(tid) {
    const d = ctGetData(tid);
    if (!d) return;
    ctRender(tid, d.rows, d.cols + 1, d.cells);
}

function ctDelRow(tid) {
    const d = ctGetData(tid);
    if (!d || d.rows <= 1) return;
    d.cells.pop();
    ctRender(tid, d.rows - 1, d.cols, d.cells);
}

function ctDelCol(tid) {
    const d = ctGetData(tid);
    if (!d || d.cols <= 1) return;
    d.cells.forEach(row => row.pop());
    ctRender(tid, d.rows, d.cols - 1, d.cells);
}

function ctRemove(tid) {
    const el = document.getElementById(`ctw-${tid}`);
    if (el) el.remove();
}

function collectContentTables(contentId) {
    const container = document.getElementById(`content-tables-${contentId}`);
    if (!container) return [];
    const tables = [];
    container.querySelectorAll('.content-table-widget').forEach(w => {
        const tid = w.id.replace('ctw-', '');
        const d = ctGetData(tid);
        if (d && d.rows > 0 && d.cols > 0) tables.push(d);
    });
    return tables;
}

function restoreContentTables(contentId, tablesData) {
    if (!tablesData || !tablesData.length) return;
    tablesData.forEach(t => addContentTable(contentId, t));
}

/* ── Content section headings ───────────────────────────────
   A content card is born as «Content 1:» — a NUMBER, produced by the
   dictionary through data-i18n-num, so an interface-language switch can
   repaint it without rebuilding the card and losing what is typed in it.

   The moment the author renames it to «Introduction» that text is THEIR
   content, not interface, and the same rule the cover table and the
   free-text blocks already follow applies: the i18n attributes come off,
   the name is stored as a bilingual pair beside the section's text, and a
   language switch must never overwrite it. It is exported as the
   section's heading, so a renamed card prints its name in the DOCX and an
   untouched one prints nothing — «Content 3:» is scaffolding for the
   editor, never something a ministry should read in a deliverable.

   The name lives in the DOM (data-heading on the card) for exactly as
   long as the older content fields do: sheets.js collects it at save time
   alongside the textarea and merges it into the stored pair. */

function mbContentHeading(id) {
    const sec = document.getElementById(`content-section-${id}`);
    return (sec && sec.dataset.heading) ? sec.dataset.heading : '';
}

/** Repaint one card's label from its stored name, or back to the number. */
function mbApplyContentHeading(id, heading) {
    const sec   = document.getElementById(`content-section-${id}`);
    const label = document.getElementById(`content-label-${id}`);
    if (!sec || !label) return;

    const text = (heading || '').trim();
    if (text) {
        sec.dataset.heading = text;
        /* Off, not just overwritten: applyTranslations() sweeps every
           [data-i18n-num] on a language switch and would put «Content 1:»
           straight back over the author's own words. */
        label.removeAttribute('data-i18n-num');
        label.removeAttribute('data-i18n-num-v0');
        label.textContent = text;
        label.setAttribute('dir', 'auto');
        label.style.textAlign = 'start';
        label.classList.add('is-renamed');
    } else {
        delete sec.dataset.heading;
        label.setAttribute('data-i18n-num', 'dgContentN');
        label.setAttribute('data-i18n-num-v0', String(id));
        label.textContent = window.i18n.tf('dgContentN', { v0: id });
        label.removeAttribute('dir');
        label.classList.remove('is-renamed');
    }
}

/**
 * Rename one content card.
 *
 * An empty answer RESTORES the default number rather than leaving a
 * blank heading — a card with no label at all is unreadable in the
 * editor, and clearing the box is the only way back that a user would
 * think to try. Cancel (null) changes nothing.
 */
async function renameContentSection(id) {
    const cur = mbContentHeading(id);
    const newName = await mbPrompt(
        window.i18n.t('dgEnterContentHeading'),
        cur || window.i18n.tf('dgContentN', { v0: id }).replace(/:$/, '').trim()
    );
    if (newName === null || newName === undefined) return;   // cancelled

    const text = newName.trim();
    /* Typing the default number back in is a request for the default, not
       for a hard-coded copy of it that would then stop following the
       interface language. */
    const isDefault = text === '' ||
        BILANG_CODES.some(function (code) {
            return text === window.i18n.tIn('dgContentN', code).replace('{v0}', String(id)).replace(/:$/, '').trim();
        });

    mbApplyContentHeading(id, isDefault ? '' : text);
    if (typeof showStatus === 'function') {
        showStatus(window.i18n.t(isDefault ? 'dgContentHeadingReset' : 'dgContentRenamed'), 'success');
    }
}

function addContentSection(heading) {
    mbState.contentSectionCount++;
    const csc = mbState.contentSectionCount;
    const container = document.getElementById('content-sections-container');
    const sectionDiv = document.createElement('div');
    sectionDiv.className = 'content-section-item';
    mbNewRowUid(sectionDiv);
    sectionDiv.id = `content-section-${csc}`;
    sectionDiv.innerHTML = `
        <div class="step-header">
            <div class="step-label" id="content-label-${csc}" data-i18n-num="dgContentN" data-i18n-num-v0="${csc}">${window.i18n.tf('dgContentN', { v0: csc })}</div>
            <div style="display:flex;gap:5px;align-items:center;">
                <button class="btn-rename-section mb-has-ico" data-act="renameContentSection" data-args='[${csc}]' title="${window.i18n.t('dgRenameContent')}" data-i18n-title="dgRenameContent"><svg class="mb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4.5 19.5h4l10-10a2.1 2.1 0 0 0-3-3l-10 10z"/><path d="M14.5 6.5l3 3"/><path d="M4.5 19.5l.6-3.4"/></svg><span data-i18n="rxRename">${window.i18n.t('rxRename')}</span></button>
                <button class="btn-clear-section" data-act="clearContentSection" data-args='[${csc}]' title="${window.i18n.t('dgClearContent')}" data-i18n-title="dgClearContent">✕</button>
                <button class="btn-remove mb-icon-btn danger" data-act="removeContentSection" data-args='[${csc}]' title="${window.i18n.t('dgRemoveContent')}" data-i18n-title="dgRemoveContent"><svg class="mb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 7h16"/><path d="M9.5 7V5.6A1.6 1.6 0 0 1 11.1 4h1.8a1.6 1.6 0 0 1 1.6 1.6V7"/><path d="M6.6 7l.75 11.6A1.7 1.7 0 0 0 9.05 20.2h5.9a1.7 1.7 0 0 0 1.7-1.6L17.4 7"/><path d="M10.3 11v5.4M13.7 11v5.4"/></svg></button>
            </div>
        </div>
        <textarea class="mb-content-field" placeholder="${window.i18n.t('dgEnterContent')}" data-i18n-placeholder="dgEnterContent" data-content-id="${csc}"  style="text-align: left;"></textarea>
        <div style="display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap;">
            <button class="btn-add-image" data-act="addContentImage" data-args='[${csc}]'>🖼️ <span data-i18n="rxAddImageS">${window.i18n.t('rxAddImageS')}</span></button>
            <button class="btn-add-image btn-paste-image" data-act="pasteContentImage" data-args='[${csc}]' title="${window.i18n.t('rxPasteImageTip')}" data-i18n-title="rxPasteImageTip">📋 <span data-i18n="rxPasteImage">${window.i18n.t('rxPasteImage')}</span></button>
            <button data-act="addContentSection" style="background:#667eea;color:white;border:none;padding:6px 14px;border-radius:5px;font-size:0.85em;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:4px;white-space:nowrap;">➕ <span data-i18n="dgAddContent">${window.i18n.t('dgAddContent')}</span></button>
            ${addMarkBtnHtml(`content-marks-${csc}`)}
            <button class="btn-add-mark" data-act="addContentTable" data-args='[${csc}]' style="background:#0ea5e9;" title="${window.i18n.t('dgAddTable')}" data-i18n-title="dgAddTable">📋 <span data-i18n="dgAddTableBtn">${window.i18n.t('dgAddTableBtn')}</span></button>
        </div>
        <input type="file" id="content-image-input-${csc}" accept="image/*" multiple style="display:none;" data-act="handleContentImageUpload" data-on="change" data-args='[${csc}]'>
        <div id="content-image-gallery-${csc}" class="content-image-gallery"></div>
        <div id="content-tables-${csc}"></div>
        <div id="content-marks-${csc}" class="marks-container"></div>
    `;
    container.appendChild(sectionDiv);
    /* After the append: mbApplyContentHeading looks the card up by id, so
       it has to be in the document first.

       `typeof === 'string'` is not defensive noise. This function is also
       a data-act, and events.js appends the element and the event after
       whatever data-args declares — the ➕ button carries none, so a click
       calls addContentSection(buttonElement, event). Anything looser here
       would name every hand-added card "[object HTMLButtonElement]". */
    if (typeof heading === 'string' && heading.trim()) mbApplyContentHeading(csc, heading);
}

async function removeContentSection(id) {
    if (await mbConfirm(window.i18n.t('dgConfirmDeletionthisWillPermanently'), { danger: true })) {
        const element = document.getElementById(`content-section-${id}`);
        if (element) {
            element.remove();
            delete mbState.contentSectionImages[id];
        }
    }
}

function addContentImage(contentId) {
    document.getElementById(`content-image-input-${contentId}`).click();
}

function handleContentImageUpload(contentId) {
    const input = document.getElementById(`content-image-input-${contentId}`);
    if (!input.files || !input.files.length) return;

    if (!mbState.contentSectionImages[contentId]) mbState.contentSectionImages[contentId] = [];

    /* Sequential, and downscaled on the way in — see image_prep.js.
       forEach with a FileReader each also meant the images could land in
       any order, since whichever decoded first pushed first; a chain
       keeps the order the user picked them in. */
    const files = Array.from(input.files);
    input.value = ''; // reset so same file can be re-added

    if (typeof mbPrepareImages === 'function') {
        mbPrepareImages(files, 'content').then(results => {
            results.forEach(r => mbState.contentSectionImages[contentId].push(r.dataUrl));
            renderContentImageGallery(contentId);
        });
        return;
    }
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = function(e) {
            mbState.contentSectionImages[contentId].push(e.target.result);
            renderContentImageGallery(contentId);
        };
        reader.readAsDataURL(file);
    });
}

function removeContentImage(contentId, imgIndex) {
    if (!mbState.contentSectionImages[contentId]) return;
    mbState.contentSectionImages[contentId].splice(imgIndex, 1);
    renderContentImageGallery(contentId);
}

function renderContentImageGallery(contentId) {
    const gallery = document.getElementById(`content-image-gallery-${contentId}`);
    if (!gallery) return;
    const images = mbState.contentSectionImages[contentId] || [];
    if (images.length === 0) { gallery.innerHTML = ''; return; }
    gallery.innerHTML = images.map((src, i) => `
        <div class="content-img-thumb">
            <img src="${src}" alt="Image ${i+1}">
            <button class="content-img-delete" data-act="removeContentImage" data-args='[${contentId},${i}]' title="${window.i18n.t('dgRemoveImage')}" data-i18n-title="dgRemoveImage">×</button>
        </div>
    `).join('');
}

function addInfoQRImage() {
    document.getElementById('info-qr-input').click();
}

/* QR codes take the 'qr' profile: capped in size but kept as PNG and
   never JPEG-compressed. They are read by a phone camera at 2.5 cm, and
   JPEG ringing around the finder patterns is a scan that fails, not a
   picture that looks slightly worse. */
function _mbSetQRImage(which, file) {
    if (!file) return;
    const preview = document.getElementById(`${which}-qr-preview`);

    const apply = function (dataUrl) {
        if (preview) preview.innerHTML = `<img src="${dataUrl}" alt="QR Code" style="width: 100px; height: 100px;">`;
        if (which === 'info') mbState.infoQRImage = dataUrl;
        else                  mbState.activityQRImage = dataUrl;
    };

    if (typeof mbPrepareImage === 'function') {
        mbPrepareImage(file, 'qr').then(out => apply(out.dataUrl));
        return;
    }
    const reader = new FileReader();
    reader.onload = function(e) { apply(e.target.result); };
    reader.readAsDataURL(file);
}

function handleInfoQRUpload() {
    const input = document.getElementById('info-qr-input');
    if (input.files && input.files[0]) _mbSetQRImage('info', input.files[0]);
}

function addActivityQRImage() {
    document.getElementById('activity-qr-input').click();
}

function handleActivityQRUpload() {
    const input = document.getElementById('activity-qr-input');
    if (input.files && input.files[0]) _mbSetQRImage('activity', input.files[0]);
}

async function clearInfoSheet() {
    if (await mbConfirm(window.i18n.t('dgConfirmDeletionthisWillPermanently2'), { danger: true })) {
        document.getElementById('info-sheet-number').value = '';
        document.getElementById('info-title').value = '';
        document.getElementById('info-objective').value = '';
        document.getElementById('content-sections-container').innerHTML = '';
        document.getElementById('info-link-subject').value = '';
        document.getElementById('info-link-url').value = '';
        document.getElementById('info-qr-preview').innerHTML = '';
        mbState.infoQRImage = null;
        document.getElementById('self-check-number').value = '';
        document.getElementById('self-check-content').value = '';
        document.getElementById('answers-key-number').value = '';
        document.getElementById('answers-key-content').value = '';
        mbState.contentSectionCount = 0;
        // Clear stored images
        for (let key in mbState.contentSectionImages) {
            delete mbState.contentSectionImages[key];
        }
        addContentSection(); // Add first content section
        showStatus(window.i18n.t('dgInformationSheetCleared'), 'success');
    }
}

function addInfoImage() {
    document.getElementById('info-image-input').click();
}

function handleInfoImageUpload() {
    const input = document.getElementById('info-image-input');
    const preview = document.getElementById('info-image-preview');
    if (!input.files || !input.files[0]) return;

    const apply = function (dataUrl) {
        if (preview) preview.innerHTML = `<img src="${dataUrl}" alt="Info image">`;
        infoImageData = dataUrl;
    };

    if (typeof mbPrepareImageAndReport === 'function') {
        mbPrepareImageAndReport(input.files[0], 'content').then(out => apply(out.dataUrl));
        return;
    }
    const reader = new FileReader();
    reader.onload = function(e) { apply(e.target.result); };
    reader.readAsDataURL(input.files[0]);
}

/* ── Empty containers are not dead ends ──────────────────────
   The «Add Content» and «Add Step» buttons used to live INSIDE each
   card. Delete the last card — or run Clear All, which empties the
   container without re-seeding it — and the button went with it: the
   section was left blank with no control anywhere on the page that could
   bring a card back. The only way out was reloading the project.

   index.html now carries an add button BELOW each container, outside the
   cards, the way the resources table and the criteria table already did.
   The in-card buttons stay: they are the convenient ones while you are
   working down a long sheet. This file's job is only the hint that
   appears when a container is empty, so a blank area reads as "add one"
   rather than as something broken.

   A MutationObserver rather than a call at each site: the two containers
   are emptied from six places across three files (the two loaders, the
   two clear-sheet handlers, removeInfoSheet and clearAll), and a
   seventh will be added the day someone writes another reset. An
   observer cannot be forgotten by code that does not know it exists. */

var MB_EMPTY_HINTS = [
    { container: 'content-sections-container', hint: 'content-sections-empty', counter: 'contentSectionCount' },
    { container: 'steps-container',            hint: 'steps-empty',            counter: 'stepCount' }
];

function mbUpdateEmptyHints() {
    MB_EMPTY_HINTS.forEach(function (cfg) {
        var box  = document.getElementById(cfg.container);
        var hint = document.getElementById(cfg.hint);
        if (!box || !hint) return;

        var empty = box.children.length === 0;
        hint.style.display = empty ? '' : 'none';

        /* Numbering restarts at 1 for a container the user has emptied.
           The counter only ever went up, so clearing three cards and
           adding one produced «Content 4:» with nothing above it.

           Read from the LIVE DOM, which is the whole reason this is safe
           to do here: loadInfoSheetAtIndex empties the container and
           refills it synchronously, and by the time this callback runs
           the cards are already back — so `empty` is false and the
           counter it just set is left alone. Resetting eagerly at the
           moment of removal would instead hand the next card an id that
           collides with one already on screen. */
        if (empty && mbState[cfg.counter]) mbState[cfg.counter] = 0;
    });
}

(function watchEmptyContainers() {
    function start() {
        mbUpdateEmptyHints();
        if (!window.MutationObserver) return;
        var obs = new MutationObserver(mbUpdateEmptyHints);
        MB_EMPTY_HINTS.forEach(function (cfg) {
            var box = document.getElementById(cfg.container);
            if (box) obs.observe(box, { childList: true });
        });
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
