// ============================================================
// /src/ui.js
// showStatus + docx library load check
// Extracted verbatim from Module_Builder.html lines 7019-7041 (v2.0-legacy).
// ============================================================


function showStatus(message, type) {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';
    
    if (type === 'success') {
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 5000);
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
