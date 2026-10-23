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

/* 3.81.0: 📋 Paste Image in each cover's header, and a 🗑 beside it once a
   picture is there. Labels live in a table THIS FILE owns, matched to the
   interface language and repainted on every language change (same reason
   as steps.js / content.js: a stale dictionary must not leave a raw key
   on the button). */
var _MB_COVER_LABELS = {
    ar: { paste: 'لصق صورة', pasteTip: 'لصق صورة منسوخة من الحافظة أو من صفحة ويب (Ctrl+V)',
          removeTip: 'حذف صورة الغلاف', pasted: 'تم لصق الصورة' },
    en: { paste: 'Paste Image', pasteTip: 'Paste an image copied from the clipboard or a web page (Ctrl+V)',
          removeTip: 'Remove the cover image', pasted: 'Image pasted' },
    fr: { paste: 'Coller une image', pasteTip: 'Coller une image copiée depuis le presse-papiers ou une page web (Ctrl+V)',
          removeTip: 'Supprimer l’image de couverture', pasted: 'Image collée' }
};
function _mbCoverT(key) {
    var lang = (window.i18n && window.i18n.getLang) ? window.i18n.getLang() : 'en';
    var table = _MB_COVER_LABELS[lang] || _MB_COVER_LABELS.en;
    return table[key] || _MB_COVER_LABELS.en[key] || key;
}
function mbPaintCoverButtons() {
    document.querySelectorAll('[data-cover-lbl]').forEach(function (el) {
        el.textContent = _mbCoverT(el.getAttribute('data-cover-lbl'));
    });
    document.querySelectorAll('[data-cover-tip]').forEach(function (el) {
        var tip = _mbCoverT(el.getAttribute('data-cover-tip'));
        el.title = tip;
        el.setAttribute('aria-label', tip);
    });
}
window.addEventListener('mb:langchange', mbPaintCoverButtons);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mbPaintCoverButtons);
else mbPaintCoverButtons();

/** The one place a cover picture is stored: upload, drop and paste all end
 *  here. It records its own Undo step (the picture arrives asynchronously,
 *  after the action dispatcher has already looked), shows the preview and
 *  tells autosave. */
function _mbApplyCoverImage(side, dataUrl, announce) {
    var hist = (typeof mbHistBegin === 'function') ? mbHistBegin('coverImage') : null;
    if (side === 'front') mbState.frontCoverImage = dataUrl;
    else                  mbState.backCoverImage  = dataUrl;
    _showCoverPreview(side, dataUrl);
    if (hist && typeof mbHistEnd === 'function') mbHistEnd(hist);
    _mbCoverNotifyChanged(side);
    if (announce && typeof showStatus === 'function') showStatus(_mbCoverT('pasted'), 'success');
}

/* Autosave listens for input/change bubbling out of the tab; a paste, a
   drop or an Undo fires neither. */
function _mbCoverNotifyChanged(side) {
    var tab = document.getElementById(side === 'front' ? 'covers-tab' : 'back-cover-tab');
    if (tab) tab.dispatchEvent(new Event('change', { bubbles: true }));
}

/** Both previews repainted from the state (Undo / Redo). */
function mbRefreshCoverPreviews() {
    if (!document.getElementById('front-cover-preview')) return;
    if (mbState.frontCoverImage) _showCoverPreview('front', mbState.frontCoverImage);
    else deleteFrontCoverImage();
    if (mbState.backCoverImage) _showCoverPreview('back', mbState.backCoverImage);
    else deleteBackCoverImage();
}

/** 📋 in the cover header (data-act). */
function mbCoverPasteImage(side) {
    mbPasteImageInto('cover', side === 'back' ? 'back' : 'front');
}

/**
 * One path for both covers and both ways of supplying a file.
 *
 * If image_prep.js has not loaded, this falls back to the original
 * FileReader behaviour rather than failing: an unoptimised cover is a
 * degraded outcome, no cover at all is a broken one.
 */
function _mbSetCoverImage(side, file) {
    if (!file || !file.type || file.type.indexOf('image/') !== 0) return;

    var apply = function (dataUrl) { _mbApplyCoverImage(side, dataUrl, false); };

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
    var rt = document.getElementById('front-cover-remove-top'); if (rt) rt.style.display = 'none';
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
    var rt = document.getElementById('back-cover-remove-top'); if (rt) rt.style.display = 'none';
}

// ── Shared cover preview helper ──────────────────────────────────
function _showCoverPreview(side, src) {
    document.getElementById(`${side}-cover-preview`).src = src;
    document.getElementById(`${side}-cover-preview-wrap`).style.display = 'block';
    document.getElementById(`${side}-cover-placeholder`).style.display = 'none';
    const rt = document.getElementById(`${side}-cover-remove-top`); if (rt) rt.style.display = 'inline-flex';
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
