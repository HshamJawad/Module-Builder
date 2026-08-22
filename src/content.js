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
                <button class="ctb ctb-del" data-act="ctDelRow" data-args='[${tid}]' title="${window.i18n.t('dgDeleteLastRow')}" data-i18n-title="dgDeleteLastRow">🗑 <span data-i18n="rxRow">${window.i18n.t('rxRow')}</span></button>
                <button class="ctb ctb-del" data-act="ctDelCol" data-args='[${tid}]' title="${window.i18n.t('dgDeleteLastColumn')}" data-i18n-title="dgDeleteLastColumn">🗑 <span data-i18n="rxCol">${window.i18n.t('rxCol')}</span></button>
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

function addContentSection() {
    mbState.contentSectionCount++;
    const csc = mbState.contentSectionCount;
    const container = document.getElementById('content-sections-container');
    const sectionDiv = document.createElement('div');
    sectionDiv.className = 'content-section-item';
    mbNewRowUid(sectionDiv);
    sectionDiv.id = `content-section-${csc}`;
    sectionDiv.innerHTML = `
        <div class="step-header">
            <div class="step-label" data-i18n-num="dgContentN" data-i18n-num-v0="${csc}">${window.i18n.tf('dgContentN', { v0: csc })}</div>
            <div style="display:flex;gap:5px;align-items:center;">
                <button class="btn-clear-section" data-act="clearContentSection" data-args='[${csc}]' title="${window.i18n.t('dgClearContent')}" data-i18n-title="dgClearContent">✕</button>
                <button class="btn-remove" data-act="removeContentSection" data-args='[${csc}]' title="${window.i18n.t('dgRemoveContent')}" data-i18n-title="dgRemoveContent">🗑</button>
            </div>
        </div>
        <textarea class="mb-content-field" placeholder="${window.i18n.t('dgEnterContent')}" data-i18n-placeholder="dgEnterContent" data-content-id="${csc}"  style="text-align: left;"></textarea>
        <div style="display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap;">
            <button class="btn-add-image" data-act="addContentImage" data-args='[${csc}]'>🖼️ <span data-i18n="rxAddImageS">${window.i18n.t('rxAddImageS')}</span></button>
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
