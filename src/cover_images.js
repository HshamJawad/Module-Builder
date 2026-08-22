// ============================================================
// /src/cover_images.js
// Front/back cover image upload, drop, preview
// Extracted verbatim from Module_Builder.html lines 2772-2839 (v2.0-legacy).
// ============================================================

function handleFrontCoverUpload(input) {
    if (!input.files || !input.files[0]) return;
    const reader = new FileReader();
    reader.onload = function(e) { mbState.frontCoverImage = e.target.result; _showCoverPreview('front', mbState.frontCoverImage); };
    reader.readAsDataURL(input.files[0]);
}
function handleFrontCoverDrop(event) {
    event.preventDefault();
    document.getElementById('front-cover-upload-area').style.background = 'white';
    const file = event.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = function(e) { mbState.frontCoverImage = e.target.result; _showCoverPreview('front', mbState.frontCoverImage); };
    reader.readAsDataURL(file);
}
function deleteFrontCoverImage() {
    mbState.frontCoverImage = null;
    document.getElementById('front-cover-image-input').value = '';
    document.getElementById('front-cover-preview-wrap').style.display = 'none';
    document.getElementById('front-cover-placeholder').style.display = 'block';
    document.getElementById('front-cover-delete-row').style.display = 'none';
}

// ── Back Cover functions ────────────────────────────────────────
function handleBackCoverUpload(input) {
    if (!input.files || !input.files[0]) return;
    const reader = new FileReader();
    reader.onload = function(e) { mbState.backCoverImage = e.target.result; _showCoverPreview('back', mbState.backCoverImage); };
    reader.readAsDataURL(input.files[0]);
}
function handleBackCoverDrop(event) {
    event.preventDefault();
    document.getElementById('back-cover-upload-area').style.background = 'white';
    const file = event.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = function(e) { mbState.backCoverImage = e.target.result; _showCoverPreview('back', mbState.backCoverImage); };
    reader.readAsDataURL(file);
}
function deleteBackCoverImage() {
    mbState.backCoverImage = null;
    document.getElementById('back-cover-image-input').value = '';
    document.getElementById('back-cover-preview-wrap').style.display = 'none';
    document.getElementById('back-cover-placeholder').style.display = 'block';
    document.getElementById('back-cover-delete-row').style.display = 'none';
}

// ── Shared cover preview helper ──────────────────────────────────
function _showCoverPreview(side, src) {
    document.getElementById(`${side}-cover-preview`).src = src;
    document.getElementById(`${side}-cover-preview-wrap`).style.display = 'block';
    document.getElementById(`${side}-cover-placeholder`).style.display = 'none';
    document.getElementById(`${side}-cover-delete-row`).style.display = 'block';
    const img = new Image();
    img.onload = function() {
        const sizeInfo = document.getElementById(`${side}-cover-size-info`);
        if (sizeInfo) {
            const w = img.naturalWidth, h = img.naturalHeight;
            const ok = (w >= 2400 && h >= 3300) || (w >= 1200 && h >= 1650);
            const badge = ok
                ? '<span style="color:#059669;">✓ Good resolution for A4</span>'
                : '<span style="color:#f59e0b;">⚠ Low resolution — will be stretched to A4. Recommended: 2480 × 3508 px.</span>';
            sizeInfo.innerHTML = `Original size: ${w} × ${h} px &nbsp;|&nbsp; ${badge}`;
        }
    };
    img.src = src;
}
