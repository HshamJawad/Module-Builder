// ============================================================
// /src/export_ui.js
// Export progress info, button state, complexity counter
// Extracted verbatim from Module_Builder.html lines 5320-5434 (v2.0-legacy).
// ============================================================

function showExportInfo(message, isWarning = false) {
    const infoDiv = document.getElementById('export-info');
    const infoText = document.getElementById('export-info-text');
    if (infoDiv && infoText) {
        infoText.textContent = message;
        infoDiv.classList.add('show');
        if (isWarning) {
            infoDiv.classList.add('export-warning');
        } else {
            infoDiv.classList.remove('export-warning');
        }
    }
}

function hideExportInfo() {
    const infoDiv = document.getElementById('export-info');
    if (infoDiv) {
        infoDiv.classList.remove('show');
        infoDiv.classList.remove('export-warning');
    }
}

function setExportButtonState(disabled) {
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
        exportBtn.disabled = disabled;
    }
}

function countExportComplexity() {
    // Count images
    let imageCount = 0;
    
    // Content section images
    imageCount += Object.keys(mbState.contentSectionImages).length;
    
    // Step images
    imageCount += Object.keys(mbState.stepImages).length;
    
    // QR images
    if (mbState.activityQRImage) imageCount++;
    if (mbState.infoQRImage) imageCount++;
    
    // Count sections
    let sectionCount = 0;
    sectionCount += mbState.learningOutcomesData.length;
    sectionCount += mbState.coverRows.length;
    sectionCount += mbState.teamMembers.length;
    
    mbState.learningOutcomesData.forEach(lo => {
        if (lo.infoSheets) sectionCount += lo.infoSheets.length;
        if (lo.activitySheets) sectionCount += lo.activitySheets.length;
    });
    
    return { imageCount, sectionCount };
}

function handleImageUpload(stepId) {
    const input = document.getElementById(`image-input-${stepId}`);
    if (!input.files || !input.files.length) return;

    if (!mbState.stepImages[stepId]) mbState.stepImages[stepId] = [];

    Array.from(input.files).forEach(file => {
        const reader = new FileReader();
        reader.onload = function(e) {
            mbState.stepImages[stepId].push(e.target.result);
            renderStepImageGallery(stepId);
        };
        reader.readAsDataURL(file);
    });
    input.value = ''; // reset so same file can be re-added
}

function removeStepImage(stepId, imgIndex) {
    if (!mbState.stepImages[stepId]) return;
    mbState.stepImages[stepId].splice(imgIndex, 1);
    renderStepImageGallery(stepId);
}

function renderStepImageGallery(stepId) {
    const gallery = document.getElementById(`step-image-gallery-${stepId}`);
    if (!gallery) return;
    const images = mbState.stepImages[stepId] || [];
    if (images.length === 0) { gallery.innerHTML = ''; return; }
    gallery.innerHTML = images.map((src, i) => `
        <div class="content-img-thumb">
            <img src="${src}" alt="Image ${i+1}">
            <button class="content-img-delete" data-act="removeStepImage" data-args='[${stepId},${i}]' title="${window.i18n.t('dgRemoveImage')}" data-i18n-title="dgRemoveImage">×</button>
        </div>
    `).join('');
}

// Helper function to process text and insert soft breaks for long words
function processTextForWordExport(text) {
    if (!text) return text;
    
    // Split text into words
    const words = text.split(/(\s+)/); // Keep whitespace in the split
    
    const processedWords = words.map(word => {
        // Skip whitespace
        if (/^\s+$/.test(word)) return word;
        
        // If word exceeds 25 characters without spaces, insert soft breaks
        if (word.length > 25) {
            // Insert a zero-width space every 25 characters to allow breaking
            return word.match(/.{1,25}/g).join('\u200B');
        }
        return word;
    });
    
    return processedWords.join('');
}
