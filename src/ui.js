// ============================================================
// /src/ui.js
// showStatus + docx library load check
// Extracted verbatim from Module_Builder.html lines 7019-7041 (v2.0-legacy).
// ============================================================


/* 3.66.0: `ms` keeps a success message longer than the usual 5 s. */
var _mbStatusTimer = null;
function showStatus(message, type, ms) {
    const statusDiv = document.getElementById('status');
    if (!statusDiv) return;
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.setAttribute('role', type === 'error' ? 'alert' : 'status');
    statusDiv.style.display = 'block';
    if (!statusDiv.__mbDismiss) {
        statusDiv.__mbDismiss = true;
        statusDiv.addEventListener('click', function () { statusDiv.style.display = 'none'; });
    }

    /* One timer: a newer message must not be hidden by an older one's. */
    clearTimeout(_mbStatusTimer);
    if (type === 'success' || type === 'error') {
        _mbStatusTimer = setTimeout(() => {
            statusDiv.style.display = 'none';
        }, ms || (type === 'error' ? 10000 : 5000));
    }
}

// Check if docx library loaded successfully
window.addEventListener('load', function() {
    setTimeout(function() {
        if (typeof window.docx === 'undefined') {
            showStatus(window.i18n.t('dgWarningDocxLibraryFailedTo'), 'error');
        }
    }, 2000);
});
