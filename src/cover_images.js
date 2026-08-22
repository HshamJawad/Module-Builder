// ============================================================
// /src/cover_images.js
// Front/back cover image upload, drop, preview
// Extracted verbatim from Module_Builder.html lines 2772-2839 (v2.0-legacy).
//
// The four handlers below used to be four copies of the same six lines
// of FileReader. They are one function now, and it goes through
// mbPrepareImage() so a 12-megapixel phone photo is downscaled to A4 at
// 300 dpi BEFORE it is ever held in state — see image_prep.js for why
// that is the difference between a 100 MB module and a 6 MB one.
// ============================================================

/**
 * One path for both covers and both ways of supplying a file.
 *
 * If image_prep.js has not loaded, this falls back to the original
 * FileReader behaviour rather than failing: an unoptimised cover is a
 * degraded outcome, no cover at all is a broken one.
 */
function _mbSetCoverImage(side, file) {
    if (!file || !file.type || file.type.indexOf('image/') !== 0) return;

    var apply = function (dataUrl) {
        if (side === 'front') mbState.frontCoverImage = dataUrl;
        else                  mbState.backCoverImage  = dataUrl;
        _showCoverPreview(side, dataUrl);
    };

    if (typeof mbPrepareImageAndReport === 'function') {
        mbPrepareImageAndReport(file, 'cover').then(function (out) { apply(out.dataUrl); });
        return;
    }
    var reader = new FileReader();
    reader.onload = function (e) { apply(e.target.result); };
    reader.readAsDataURL(file);
}

function handleFrontCoverUpload(input) {
    if (!input.files || !input.files[0]) return;
    _mbSetCoverImage('front', input.files[0]);
}
function handleFrontCoverDrop(event) {
    event.preventDefault();
    document.getElementById('front-cover-upload-area').style.background = 'white';
    _mbSetCoverImage('front', event.dataTransfer.files[0]);
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
    _mbSetCoverImage('back', input.files[0]);
}
function handleBackCoverDrop(event) {
    event.preventDefault();
    document.getElementById('back-cover-upload-area').style.background = 'white';
    _mbSetCoverImage('back', event.dataTransfer.files[0]);
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
