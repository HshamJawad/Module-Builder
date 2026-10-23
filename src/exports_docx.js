// ============================================================
// /src/exports_docx.js
// DOCX generation
// Extracted verbatim from Module_Builder.html lines 5435-7018 (v2.0-legacy).
// ============================================================

/* ── Sheet pictures, ready for Word (3.54.3) ─────────────────
   Walks the learning outcomes for every picture on an information or
   activity sheet and resolves, per data URL, { data, w, h }: the bytes
   Word will embed and the picture's real size in pixels. A picture the
   browser cannot decode maps to nothing, so the caller can say so. */
const MB_DOCX_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/bmp'];

function _mbDocxCollectImages(los) {
    const out = new Set();
    const add = (v) => [].concat(v || []).forEach(src => {
        if (typeof src === 'string' && src.indexOf('data:image/') === 0) out.add(src);
    });
    (los || []).forEach(lo => {
        (lo.infoSheets || []).forEach(sh => Object.values((sh && sh.contentSectionImages) || {}).forEach(add));
        (lo.activitySheets || []).forEach(sh => Object.values((sh && sh.images) || {}).forEach(add));
        /* 3.56.0: attached pictures (attachments.js). */
        (lo.infoSheets || []).concat(lo.activitySheets || []).forEach(sh =>
            ((sh && sh.attachments) || []).forEach(a => { if (a && a.type === 'image') add(a.image); }));
    });
    return [...out];
}

function _mbDocxB64Bytes(dataUrl) {
    const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

function _mbDocxPrepareOne(src) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            try {
                let w = img.naturalWidth, h = img.naturalHeight;
                const mime = src.slice(5, src.search(/[;,]/)).toLowerCase();
                if (MB_DOCX_IMAGE_TYPES.indexOf(mime) !== -1 && /;base64,/.test(src.slice(0, 64))) {
                    resolve({ data: _mbDocxB64Bytes(src), w, h });
                    return;
                }
                /* WebP, SVG, AVIF …: drawn once and kept as PNG. An SVG
                   with no size of its own gets a sensible one. */
                if (!w || !h) { w = 600; h = 400; }
                const canvas = document.createElement('canvas');
                canvas.width = w; canvas.height = h;
                canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                resolve({ data: _mbDocxB64Bytes(canvas.toDataURL('image/png')), w, h });
            } catch (e) {
                console.warn('[DOCX] picture could not be prepared:', e);
                resolve(null);
            }
        };
        img.onerror = () => resolve(null);
        img.src = src;
    });
}

async function _mbDocxPrepareImages(los) {
    const map = new Map();
    for (const src of _mbDocxCollectImages(los)) {
        const prep = await _mbDocxPrepareOne(src);
        if (prep) map.set(src, prep);
    }
    return map;
}

/* 3.62.0: a mark's type, built-in or the project's own; a deleted type
   prints as a note rather than not at all (custom_marks.js). */
function _mbDocxMarkType(key) {
    var f = (typeof mbFindMarkType === 'function') ? mbFindMarkType(key) : MARK_TYPES.find(function (x) { return x.key === key; });
    return f || MARK_TYPES.find(function (x) { return x.key === 'note'; });
}

async function exportToDocx() {
    /* 3.14.0 — a programme compile (package_ui.js) sets mbExportSink to
       receive each module's document instead of a download, and to be
       told — without a dialog — when a module has nothing to export. */
    const _sink = window.mbExportSink || null;

    /* ── Single-language projection ────────────────────────────────
       Shadows the global mbState for the whole of this function with a
       deep copy in which every { en, ar } pair has collapsed to one
       string. Everything below reads plain strings, unchanged from v2.

       The screen is flushed into state first, and after that the export
       reads state only. The single remaining getElementById below fetches
       the status banner, which is interface, not content. */
    /* window.mbState, not the bare name: `const mbState` below is
       hoisted into this function's temporal dead zone, so a bare
       reference here throws ReferenceError before the export starts. */
    if (typeof syncProjectTextFromDOM === 'function') syncProjectTextFromDOM();
    if (typeof mbCollectGlossary === 'function') mbCollectGlossary();   // 3.42.0
    if (window.mbState.currentLOId && typeof saveCurrentSheetToLO === 'function') saveCurrentSheetToLO();
    /* Resolve the document language BEFORE flattening, because the
       flatten side and the direction must be the same decision. An
       explicit export-switch choice is obeyed; otherwise the dominant
       script in the project decides, rather than contentLang() — which
       is about which side is being EDITED and says nothing about which
       script the author actually typed. */
    /* Word appearance settings are re-read HERE, once per export, and
       not at page load. That is what lets a change made in the dialog
       reach the very next export without a reload — and it is a single
       storage read, not one per run, because the accessors below share
       the snapshot this call installs. */
    if (typeof _wsBeginExport === 'function') _wsBeginExport();

    const _exportLang = _mbBeginExport(window.mbState);

    /* Refuse to produce an empty document. This runs AFTER the DOM syncs
       above so it judges what the author has actually typed, and BEFORE
       any building, so nothing here can affect a document that does have
       content — the readiness check either passes and changes nothing,
       or stops and produces no file at all. */
    {
        /* Not `if (typeof … === 'function')`. That form skipped the check
           SILENTLY whenever module_model.js failed to load, which is the
           precise failure this check exists to prevent — and it did so
           invisibly, so an empty document still downloaded and nothing
           said why. The floor below runs when the module is absent, and
           the console says so. */
        let _ready;
        if (typeof mbCheckExportReadiness === 'function') {
            _ready = mbCheckExportReadiness(_exportLang);
        } else {
            console.error(
                '[Module Builder] src/module_model.js did not load. Export checks are ' +
                'running in fallback mode. Check that the file exists in src/ and that ' +
                'index.html has <script src="src/module_model.js"></script>.'
            );
            const _pick = function (v) {
                if (!v) return '';
                if (typeof v === 'string') return v;
                if (typeof v === 'object') return (v.en || '') + (v.fr || '') + (v.ar || '');
                return String(v);
            };
            const _raw = window.mbState || {};
            const _anySheet = (_raw.learningOutcomesData || []).some(function (lo) {
                return ((lo && lo.infoSheets) || []).concat((lo && lo.activitySheets) || [])
                    .some(function (sh) { return sh && _pick(sh.title).trim(); });
            });
            const _anyCover = (_raw.coverRows || []).some(function (r) { return r && _pick(r.value).trim(); });
            const _anyRefs  = (_raw.referencesData || []).some(function (r) { return r && _pick(r.value).trim(); });
            _ready = (_anySheet || _anyCover || _anyRefs)
                ? { ok: true, title: '', message: '' }
                : { ok: false,
                    title: 'Nothing to export yet',
                    message: 'This module has no content yet. Add a Learning Outcome, then add an Information Sheet or an Activity Sheet to it.' };
        }
        if (!_ready.ok) {
            if (_sink) {
                _sink.skip(_ready.title);
                if (typeof setExportButtonState === 'function') setExportButtonState(false);
                if (typeof hideExportInfo === 'function') hideExportInfo();
                _mbEndExport();
                return;
            }
            const _msg = _ready.title + '\n\n' + _ready.message;
            if (typeof mbAlert === 'function') await mbAlert(_msg); else alert(_msg);
            if (typeof showStatus === 'function') showStatus(_ready.title, 'error');
            if (typeof setExportButtonState === 'function') setExportButtonState(false);
            if (typeof hideExportInfo === 'function') hideExportInfo();
            return;
        }
    }
    // 3.16.0: DACUM texts in the export language (dacum_i18n.js).
    const _flat = biFlattenDeep(window.mbState, _exportLang);
    const mbState = (typeof mbLocalizeDacum === 'function') ? mbLocalizeDacum(_flat, _exportLang) : _flat;
    /* 3.56.0: numbered captions of figures and tables, on this copy only. */
    if (typeof mbFigPrepare === 'function' && _flat !== window.mbState) mbFigPrepare(mbState, _exportLang);

    console.log('Export function started');
    
    // Hide any previous export info
    hideExportInfo();
    
    // Save current sheet to LO before exporting
    if (mbState.currentLOId) {
        saveCurrentSheetToLO();
    }
    
    /* ── Current sheets, read from state ───────────────────────────
       v2 read these six values straight off the screen. That made the
       export a function of what happened to be open in the editor, which
       is exactly wrong once the editor shows one language and the export
       emits another. The flush above has already written the screen into
       state; from here the export never looks at the editor again. */
    const _lo       = mbState.learningOutcomesData.find(l => l.id === mbState.currentLOId) || {};
    const _activity = (_lo.activitySheets || [])[window.mbState.currentActivitySheetIndex] || {};
    const _info     = (_lo.infoSheets     || [])[window.mbState.currentInfoSheetIndex]     || {};

    const sheetNumber = _activity.sheetNumber || '';
    const title       = _activity.title       || '';
    const objective   = _activity.objective   || '';
    const duration    = _activity.duration    || '0';
    const statusDiv   = document.getElementById('status');   // UI only, not content

    // Check if docx library is loaded
    if (typeof window.docx === 'undefined') {
        console.error('docx library not loaded');
        showStatus(window.i18n.t('dgDocumentLibraryIsStillLoading'), 'error');
        return;
    }
    
    console.log('docx library loaded successfully');
    
    // Validation - check if at least one tab has content
    const coversAdditionalInfo  = mbState.coversAdditionalInfo  || '';
    const coversAdditionalNotes = mbState.coversAdditionalNotes || '';
    const hasCoversContent = coversAdditionalInfo.trim() || coversAdditionalNotes.trim() || mbState.coverRows.some(row => (row.value || '').trim());
    const hasWorkTeam = mbState.teamMembers.some(member => (member.name || '').trim() || (member.task || '').trim() || (member.workLocation || '').trim());
    const introAdditionalDetails = mbState.introAdditionalDetails || '';
    const hasIntroBlocks  = !(typeof mbIsLearnerGuide === 'function' && mbIsLearnerGuide()) && mbBlocksAnyFilled(mbState.introBlocks);
    /* The qualifications-framework card used to count as intro content
       of its own. Its fields are rows of the module information table
       now, so they are already covered by hasCoversContent. */
    const hasIntroTable   = typeof mbIntroTableFilled === 'function' && mbIntroTableFilled(mbState.introTable);   // 3.69.0
    const hasIntroContent = hasWorkTeam || introAdditionalDetails.trim() || hasIntroBlocks || hasIntroTable;
    const infoTitle = _info.title || '';
    const contentSections = (_info.contentSections || []);
    let hasInfoContent = false;
    contentSections.forEach(content => {
        if ((content.text || '').trim()) hasInfoContent = true;
    });
    const assessmentSimpleContent = mbState.assessmentContent || '';
    const hasAssessmentData = assessmentSimpleContent.trim() || mbState.learningOutcomesData.length > 0;
    
    if (!hasCoversContent && !hasIntroContent && !infoTitle.trim() && !hasInfoContent && !title.trim() && !objective.trim() && !hasAssessmentData) {
        console.log('Validation failed: No content found');
        if (_sink) { _sink.skip(window.i18n.t('dgPleaseFillInAtLeast')); _mbEndExport(); return; }
        showStatus(window.i18n.t('dgPleaseFillInAtLeast'), 'error');
        return;
    }
    
    // Check export complexity and show warning if needed
    const complexity = countExportComplexity();
    if (complexity.imageCount > 10 || complexity.sectionCount > 15) {
        const warningMsg = `Your module contains ${complexity.imageCount} image${complexity.imageCount !== 1 ? 's' : ''} and ${complexity.sectionCount} section${complexity.sectionCount !== 1 ? 's' : ''}. Export may take longer than usual. Please be patient.`;
        showExportInfo(warningMsg, true);
    } else if (complexity.imageCount > 5 || complexity.sectionCount > 8) {
        showExportInfo('Exporting modules with multiple sections and images may take some time. Please wait...', false);
    }
    
    console.log('Validation passed, starting export...');
    
    // Disable export button and show progress
    setExportButtonState(true);
    showStatus(window.i18n.t('dgExportInProgressProcessingContent'), 'info');

    try {
        console.log('Destructuring docx components...');
        /* mbDocxLib(), not window.docx: TextRun and Paragraph come back
           subclassed so any run holding Arabic is tagged with <w:lang>
           and <w:rtl> at construction. Doing it at the source means a run
           added later cannot be forgotten. */
        const { Document, Paragraph, TextRun, AlignmentType, Packer, PageBreak } = mbDocxLib();

        /* Section-level `bidi` was hard-coded false in 12 places. This is the
       SECTION's base direction — distinct again from the paragraph's and
       the table's. Word uses it for the page itself: margins, the gutter,
       and which side page numbers and headers sit on. Left false, an
       otherwise-correct Arabic document still binds on the wrong edge.

       60 paragraphs said AlignmentType.LEFT. In an Arabic document
           LEFT is not "the start of the line", it is the far end — the
           same mistake as the CSS text-align that had to become `start`.
           _mbStart resolves it from the export language. */

        const children = [];

        // Module Title and Performance Criteria are intentionally excluded from Activity/Job Sheet export
        // Activity/Job Sheets should start directly with their own title for clean, self-contained pages

        // Title with sheet number - New format: Activity/Job Sheet 1-1 / Title
        if (sheetNumber.trim() && title.trim()) {
            const titleText = _mbTf('expActivitySheetTitled', { v0: sheetNumber, v1: title });
            children.push(new Paragraph({
                children: [
                    new TextRun({
                        text: titleText,
                        size: _wsBody(),
                        bold: true,
                        color: _wsHeadColor(), // Blue color
                        rightToLeft: _mbRtl(),
                    }),
                ],
                alignment: _mbStart(AlignmentType),
                bidirectional: _mbRtl(),
                spacing: { after: 400 },
            }));
        } else if (title.trim()) {
            // If only title without number
            children.push(new Paragraph({
                children: [
                    new TextRun({
                        text: _mbTf('expActivitySheetUntitled', { v0: title }),
                        size: _wsBody(),
                        bold: true,
                        color: _wsHeadColor(), // Blue color
                        rightToLeft: _mbRtl(),
                    }),
                ],
                alignment: _mbStart(AlignmentType),
                bidirectional: _mbRtl(),
                spacing: { after: 400 },
            }));
        }

        // Objective - Blue and Bold heading
        if (objective.trim()) {
            children.push(new Paragraph({
                children: [
                    new TextRun({
                        text: _mbT('expObjective'),
                        bold: true,
                        size: _wsBody(),
                        color: _wsHeadColor(), // Blue color
                        rightToLeft: _mbRtl(),
                    }),
                ],
                alignment: _mbStart(AlignmentType),
                bidirectional: _mbRtl(),
                spacing: { after: 200 },
            }));
            
            // Split objective by lines
            const objectiveLines = objective.split('\n');
            objectiveLines.forEach(line => {
                if (line.trim()) {
                    children.push(new Paragraph({
                        children: [
                            new TextRun({
                                text: line,
                                size: _wsBody(),
                                rightToLeft: _mbRtl(),
                            }),
                        ],
                        alignment: _mbStart(AlignmentType),
                        bidirectional: _mbRtl(),
                        spacing: { after: 150 },
                    }));
                }
            });
            
            // Add extra spacing after objective section
            children.push(new Paragraph({
                children: [new TextRun({ text: '', size: _wsBody() })],
                spacing: { after: 150 },
            }));
        }

        // Duration - Blue and Bold heading
        if (duration && duration > 0) {
            children.push(new Paragraph({
                children: [
                    new TextRun({
                        text: _mbT('expDuration'),
                        bold: true,
                        size: _wsBody(),
                        color: _wsHeadColor(), // Blue color
                        rightToLeft: _mbRtl(),
                    }),
                    new TextRun({
                        text: _mbTf('expMinutes', { v0: duration }),
                        size: _wsBody(),
                        rightToLeft: _mbRtl(),
                    }),
                ],
                alignment: _mbStart(AlignmentType),
                bidirectional: _mbRtl(),
                spacing: { after: 300 },
            }));
        }

        // Training Resources as Table
        {
            const resourcesData = (_activity.resources || [])
                .filter(r => (r.name || '').trim())
                .map(r => ({ name: r.name, quantity: r.quantity || '1' }));

            if (resourcesData.length > 0) {
                const { Table, TableRow, TableCell, WidthType, BorderStyle, Shading } = mbDocxLib();
                const tableRows = [];

                // Header row with blue background - repeated columns
                tableRows.push(new TableRow({
                    children: [
                        new TableCell({
                            children: [new Paragraph({ children: [new TextRun({ text: _mbT('expMaterialEquipment'), bold: true, size: _wsTable(), color: _wsTblText(), rightToLeft: _mbRtl() })], alignment: AlignmentType.CENTER, bidirectional: _mbRtl() })],
                            shading: { fill: _wsTblFill(), type: 'clear' },
                            width: { size: 37, type: WidthType.PERCENTAGE },
                        }),
                        new TableCell({
                            children: [new Paragraph({ children: [new TextRun({ text: _mbT('expQuantityNumber'), bold: true, size: _wsTable(), color: _wsTblText(), rightToLeft: _mbRtl() })], alignment: AlignmentType.CENTER, bidirectional: _mbRtl() })],
                            shading: { fill: _wsTblFill(), type: 'clear' },
                            width: { size: 13, type: WidthType.PERCENTAGE },
                        }),
                        new TableCell({
                            children: [new Paragraph({ children: [new TextRun({ text: _mbT('expMaterialEquipment'), bold: true, size: _wsTable(), color: _wsTblText(), rightToLeft: _mbRtl() })], alignment: AlignmentType.CENTER, bidirectional: _mbRtl() })],
                            shading: { fill: _wsTblFill(), type: 'clear' },
                            width: { size: 37, type: WidthType.PERCENTAGE },
                        }),
                        new TableCell({
                            children: [new Paragraph({ children: [new TextRun({ text: _mbT('expQuantityNumber'), bold: true, size: _wsTable(), color: _wsTblText(), rightToLeft: _mbRtl() })], alignment: AlignmentType.CENTER, bidirectional: _mbRtl() })],
                            shading: { fill: _wsTblFill(), type: 'clear' },
                            width: { size: 13, type: WidthType.PERCENTAGE },
                        }),
                    ],
                }));

                // Data rows - 2 items per row
                for (let i = 0; i < resourcesData.length; i += 2) {
                    const leftItem  = resourcesData[i];
                    const rightItem = resourcesData[i + 1];
                    tableRows.push(new TableRow({
                        children: [
                            new TableCell({
                                children: [new Paragraph({ children: [new TextRun({ text: leftItem.name, size: _wsResources(), rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl() })],
                                width: { size: 37, type: WidthType.PERCENTAGE },
                                margins: { top: 100, bottom: 100, left: 100, right: 100 },
                            }),
                            new TableCell({
                                children: [new Paragraph({ children: [new TextRun({ text: leftItem.quantity, size: _wsResources(), rightToLeft: _mbRtl() })], alignment: AlignmentType.CENTER, bidirectional: _mbRtl() })],
                                width: { size: 13, type: WidthType.PERCENTAGE },
                                margins: { top: 100, bottom: 100, left: 100, right: 100 },
                            }),
                            new TableCell({
                                children: [new Paragraph({ children: [new TextRun({ text: rightItem ? rightItem.name : '', size: _wsResources(), rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl() })],
                                width: { size: 37, type: WidthType.PERCENTAGE },
                                margins: { top: 100, bottom: 100, left: 100, right: 100 },
                            }),
                            new TableCell({
                                children: [new Paragraph({ children: [new TextRun({ text: rightItem ? rightItem.quantity : '', size: _wsResources(), rightToLeft: _mbRtl() })], alignment: AlignmentType.CENTER, bidirectional: _mbRtl() })],
                                width: { size: 13, type: WidthType.PERCENTAGE },
                                margins: { top: 100, bottom: 100, left: 100, right: 100 },
                            }),
                        ],
                    }));
                }

                const resourcesTable = new Table({
                    rows: tableRows,
                    width: { size: 9072, type: WidthType.DXA },
                    layout: 'fixed',
                    borders: {
                        top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                        bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                        left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                        right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                    },
                    columnWidths: [3356, 1178, 3356, 1178],
                });

                children.push(resourcesTable);
                children.push(new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 200 } }));
            }
        } // end resources block

        // Activity Steps - TABLE-BASED LAYOUT
        /* Steps carry per-step images keyed by stepId, so the id has to
           survive the move off the DOM; it is stored on each step. */
        const steps = (_activity.steps || []).filter(s => (s.text || '').trim());
        if (steps.length > 0) {
            children.push(new Paragraph({
                children: [
                    new TextRun({
                        text: _mbT('expActivitySteps'),
                        bold: true,
                        size: _wsBody(),
                        color: _wsHeadColor(), // Blue color
                        rightToLeft: _mbRtl(),
                    }),
                ],
                alignment: _mbStart(AlignmentType),
                bidirectional: _mbRtl(),
                spacing: { after: 200 },
            }));

            for (let index = 0; index < steps.length; index++) {
                const step = steps[index];
                const stepId = step.stepId;

                if ((step.text || '').trim()) {
                    const { Table, TableRow, TableCell, WidthType, BorderStyle, ImageRun } = mbDocxLib();
                    
                    // Process text to handle long words
                    const processedText = processTextForWordExport(step.text);
                    
                    // Step number heading
                    children.push(new Paragraph({
                        children: [
                            new TextRun({
                                text: _mbTf('expStepN', { v0: index + 1 }),
                                bold: true,
                                size: _wsBody(),
                                color: _wsHeadColor(), // Blue color
                                rightToLeft: _mbRtl(),
                            }),
                        ],
                        alignment: _mbStart(AlignmentType),
                        bidirectional: _mbRtl(),
                        spacing: { after: 100 },
                    }));

                    // Create a table row for this step
                    const stepRow = [];
                    
                    // Left cell: Text content (8cm = 4536 DXA)
                    stepRow.push(new TableCell({
                        children: [new Paragraph({
                            children: [new TextRun({
                                text: processedText,
                                size: _wsBody(),
                                rightToLeft: _mbRtl(),
                            })],
                            alignment: _mbStart(AlignmentType),
                            bidirectional: _mbRtl(),
                        })],
                        width: { size: 4536, type: WidthType.DXA }, // 8cm
                        margins: { top: 150, bottom: 150, left: 150, right: 150 },
                        verticalAlign: 'center',
                    }));
                    
                    // Normalise images: support both old string and new array format
                    let stepImgs = mbState.stepImages[stepId];
                    if (!stepImgs) stepImgs = [];
                    else if (!Array.isArray(stepImgs)) stepImgs = [stepImgs];

                    // Helper: build ImageRun from base64 src
                    const makeStepImgRun = (src) => {
                        const b64 = src.split(',')[1];
                        const imgEl = new Image();
                        imgEl.src = src;
                        const maxW = 280, maxH = 400;
                        const ar = imgEl.height / imgEl.width || 1;
                        let w = Math.min(maxW, imgEl.width || maxW);
                        let h = Math.round(w * ar);
                        if (h > maxH) { h = maxH; w = Math.round(h / ar); }
                        return new ImageRun({
                            data: Uint8Array.from(atob(b64), c => c.charCodeAt(0)),
                            transformation: { width: w, height: h },
                        });
                    };

                    // Row 1: text left (8cm) + first image right (8cm) or empty
                    if (stepImgs.length > 0) {
                        try {
                            stepRow.push(new TableCell({
                                children: [new Paragraph({ children: [makeStepImgRun(stepImgs[0])], alignment: AlignmentType.CENTER })],
                                width: { size: 4536, type: WidthType.DXA },
                                margins: { top: 150, bottom: 150, left: 150, right: 150 },
                                verticalAlign: 'center',
                            }));
                        } catch(e) {
                            stepRow.push(new TableCell({ children: [new Paragraph({ text: '' })], width: { size: 4536, type: WidthType.DXA }, margins: { top: 150, bottom: 150, left: 150, right: 150 } }));
                        }
                    } else {
                        stepRow.push(new TableCell({ children: [new Paragraph({ text: '' })], width: { size: 4536, type: WidthType.DXA }, margins: { top: 150, bottom: 150, left: 150, right: 150 } }));
                    }

                    // Build table rows: first row = text+img1, extra rows = empty+imgN
                    const stepTableRows = [new TableRow({ children: stepRow })];
                    for (let ii = 1; ii < stepImgs.length; ii++) {
                        try {
                            stepTableRows.push(new TableRow({ children: [
                                new TableCell({ children: [new Paragraph({ text: '' })], width: { size: 4536, type: WidthType.DXA }, margins: { top: 100, bottom: 100, left: 150, right: 150 } }),
                                new TableCell({
                                    children: [new Paragraph({ children: [makeStepImgRun(stepImgs[ii])], alignment: AlignmentType.CENTER })],
                                    width: { size: 4536, type: WidthType.DXA },
                                    margins: { top: 100, bottom: 100, left: 150, right: 150 },
                                    verticalAlign: 'center',
                                }),
                            ]}));
                        } catch(e) { /* skip broken image */ }
                    }

                    // Create table
                    const stepTable = new Table({
                        rows: stepTableRows,
                        width: { size: 9072, type: WidthType.DXA }, // 16cm
                        borders: {
                            top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                            bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                            left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                            right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                            insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                            insideVertical: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                        },
                    });
                    
                    children.push(stepTable);
                    
                    // Export marks attached to this step
                    const sMarks = collectMarks(`step-marks-${stepId}`);
                    sMarks.forEach(m => {
                        if (m.text && m.text.trim()) {
                            const mt = _mbDocxMarkType(m.key);
                            if (mt) {
                                children.push(new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 80 } }));
                                children.push(buildMarkDocxTable(mt, m.text));
                            }
                        }
                    });

                    // Add spacing after each table
                    children.push(new Paragraph({
                        children: [new TextRun({ text: '', size: _wsBody() })],
                        spacing: { after: 200 },
                    }));
                }
            }
        }

        // QR Code and Link Table for Activity Sheet
        const activityLinkSubject = _activity.linkSubject || '';
        const activityLinkUrl     = _activity.linkUrl     || '';
        
        if (mbState.activityQRImage || activityLinkSubject.trim() || activityLinkUrl.trim()) {
            const { Table, TableRow, TableCell, WidthType, BorderStyle, ImageRun } = mbDocxLib();
            
            const qrTableRows = [];
            const qrCells = [];
            
            // QR Code Cell (2.5cm x 2.5cm = 94 pixels at 96 DPI)
            if (mbState.activityQRImage) {
                try {
                    const base64Data = mbState.activityQRImage.split(',')[1];
                    const qrImageRun = new ImageRun({
                        data: Uint8Array.from(atob(base64Data), c => c.charCodeAt(0)),
                        transformation: {
                            width: 94, // 2.5cm at 96 DPI
                            height: 94,
                        },
                    });
                    
                    qrCells.push(new TableCell({
                        children: [new Paragraph({
                            children: [qrImageRun],
                            alignment: AlignmentType.CENTER,
                        })],
                        width: { size: 1417, type: WidthType.DXA }, // 2.5cm
                        verticalAlign: 'center',
                        margins: { top: 100, bottom: 100, left: 100, right: 100 },
                    }));
                } catch (error) {
                    console.error('Error adding QR image:', error);
                    qrCells.push(new TableCell({
                        children: [new Paragraph({ text: '' })],
                        width: { size: 1417, type: WidthType.DXA },
                    }));
                }
            } else {
                qrCells.push(new TableCell({
                    children: [new Paragraph({ text: '' })],
                    width: { size: 1417, type: WidthType.DXA },
                }));
            }
            
            // Link Cell (no spacer cell)
            /* Was a hard-coded English caption sitting next to the QR
               code in every Arabic export. */
            const _watch = _mbT('expWatchVideo');
            const linkText = activityLinkSubject.trim() 
                ? `${_watch} ${activityLinkSubject}` 
                : (activityLinkUrl.trim() ? _watch : '');
            
            qrCells.push(new TableCell({
                children: [
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: linkText,
                                size: _wsBody(),
                                rightToLeft: _mbRtl(),
                            }),
                        ],
                        alignment: _mbStart(AlignmentType),
                        bidirectional: _mbRtl(),
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: activityLinkUrl || '',
                                size: _wsBody(),
                                color: '0563C1',
                                underline: {},
                                rightToLeft: _mbRtl(),
                            }),
                        ],
                        alignment: _mbStart(AlignmentType),
                        bidirectional: _mbRtl(),
                        wordWrap: true,
                    }),
                ],
                width: { size: 7655, type: WidthType.DXA },
                verticalAlign: 'center',
                margins: { top: 100, bottom: 100, left: 200, right: 200 },
            }));
            
            qrTableRows.push(new TableRow({ children: qrCells }));
            
            const qrTable = new Table({
                rows: qrTableRows,
                width: { size: 9072, type: WidthType.DXA }, // 16cm
                borders: {
                    top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                    bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                    left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                    right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                    insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                    insideVertical: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                },
            });
            
            // Add spacing before table to prevent overlap with floating images
            children.push(new Paragraph({
                children: [new TextRun({ text: '', size: _wsBody() })],
                spacing: { before: 600, after: 300 },
            }));
            
            children.push(qrTable);
            children.push(new Paragraph({
                children: [new TextRun({ text: '', size: _wsBody() })],
                spacing: { after: 300 },
            }));
        }

        // Prepare sections array
        const sections = [];

        // ── Shared helper: export a cover image as a full A4 page ────
        const _exportCoverPage = async (imgSrc, sectionsArr, docxLib, AlignType) => {
            const { ImageRun: CvImageRun } = docxLib;
            await new Promise((resolve) => {
                const img = new Image();
                img.onload = function () {
                    const base64Data = imgSrc.split(',')[1];
                    const ext = imgSrc.startsWith('data:image/png') ? 'png' : 'jpg';
                    sectionsArr.push({
                        properties: {
                            bidi: _mbRtl(),
                            page: {
                                size:   { width: 11906, height: 16838 },
                                margin: { top: 0, right: 0, bottom: 0, left: 0, header: 0, footer: 0, gutter: 0 },
                            },
                        },
                        children: [
                            new Paragraph({
                                children: [
                                    new CvImageRun({
                                        data: Uint8Array.from(atob(base64Data), c => c.charCodeAt(0)),
                                        transformation: { width: 794, height: 1123 },
                                        type: ext,
                                    }),
                                ],
                                alignment: AlignType.CENTER,
                                spacing: { before: 0, after: 0 },
                            }),
                        ],
                    });
                    resolve();
                };
                img.onerror = () => resolve();
                img.src = imgSrc;
            });
        };

        // ── Front Cover page (very first page) ───────────────────────
        if (mbState.frontCoverImage) {
            await _exportCoverPage(mbState.frontCoverImage, sections, mbDocxLib(), AlignmentType);
        }

        // Covers Section
        const coversAdditionalInfo = mbState.coversAdditionalInfo || '';
        const hasCoversContent = coversAdditionalInfo.trim() || mbState.coverRows.some(row => row.value.trim());
        
        if (hasCoversContent) {
            const coversChildren = [];
            const { Table, TableRow, TableCell, WidthType, BorderStyle } = mbDocxLib();
            
            // Save cover data before exporting
            saveCoverData();
            
            // Add additional info if exists
            if (coversAdditionalInfo.trim()) {
                const additionalLines = coversAdditionalInfo.split('\n');
                additionalLines.forEach(line => {
                    if (line.trim()) {
                        coversChildren.push(new Paragraph({
                            children: [
                                new TextRun({
                                    text: line,
                                    size: _wsBody(),
                                    rightToLeft: _mbRtl(),
                                }),
                            ],
                            alignment: _mbStart(AlignmentType),
                            bidirectional: _mbRtl(),
                            spacing: { after: 150 },
                        }));
                    }
                });
                
                // Add spacing after additional info
                coversChildren.push(new Paragraph({
                    children: [new TextRun({ text: '', size: _wsBody() })],
                    spacing: { after: 400 },
                }));
            }
            
            // Create cover table (16cm width, bold 18pt font)
            const tableRows = [];
            
            mbState.coverRows.forEach(row => {
                if (row.value.trim()) {  // Only include rows with values
                    const cells = [];
                    
                    // Label cell
                    cells.push(new TableCell({
                        children: [new Paragraph({
                            children: [new TextRun({
                                text: row.label,
                                bold: true,
                                size: _wsCover(),
                                rightToLeft: _mbRtl(),
                            })],
                            alignment: _mbStart(AlignmentType),
                            bidirectional: _mbRtl(),
                        })],
                        width: { size: 35, type: WidthType.PERCENTAGE },
                        margins: { top: 150, bottom: 150, left: 150, right: 150 },
                    }));
                    
                    /* Value cell.
                       Split on newlines rather than emitted as one run:
                       entry requirements is a textarea and people list
                       prerequisites one per line. A single run would
                       print those as one unreadable paragraph, with the
                       breaks silently swallowed by Word. */
                    const valueLines = String(row.value).split('\n').filter(function (l, i, all) {
                        /* Trailing blank lines only — an intentional gap
                           between two paragraphs is kept. */
                        return l.trim() || all.slice(i).some(function (r) { return r.trim(); });
                    });
                    cells.push(new TableCell({
                        children: (valueLines.length ? valueLines : ['']).map(function (line) {
                            return new Paragraph({
                                children: [new TextRun({
                                    text: line,
                                    bold: true,
                                    size: _wsCover(),
                                    rightToLeft: _mbRtl(),
                                })],
                                alignment: _mbStart(AlignmentType),
                                bidirectional: _mbRtl(),
                            });
                        }),
                        width: { size: 65, type: WidthType.PERCENTAGE },
                        margins: { top: 150, bottom: 150, left: 150, right: 150 },
                    }));
                    
                    tableRows.push(new TableRow({ children: cells }));
                }
            });
            
            // Only add table if there are rows
            if (tableRows.length > 0) {
                const coverTable = new Table({
                    rows: tableRows,
                    width: { size: 9072, type: WidthType.DXA }, // 16cm (9072 DXA)
                    borders: {
                        top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                        bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                        left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                        right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                    },
                });
                
                coversChildren.push(coverTable);
            }
            
            // Add additional notes if exists (below table)
            const coversAdditionalNotes = mbState.coversAdditionalNotes || '';
            if (coversAdditionalNotes.trim()) {
                const notesLines = coversAdditionalNotes.split('\n');
                notesLines.forEach(line => {
                    if (line.trim()) {
                        coversChildren.push(new Paragraph({
                            children: [
                                new TextRun({
                                    text: line,
                                    size: _wsBody(),
                                    rightToLeft: _mbRtl(),
                                }),
                            ],
                            alignment: _mbStart(AlignmentType),
                            bidirectional: _mbRtl(),
                            spacing: { after: 150 },
                        }));
                    }
                });
            }
            
            sections.push({
                properties: {
                    bidi: _mbRtl()
                },
                children: coversChildren,
            });
        }
        
        // Work Team Section (Introduction Pages)
        saveWorkTeamData();
        const hasWorkTeam = mbState.teamMembers.some(member => member.name.trim() || member.task.trim() || member.workLocation.trim());
        const introAdditionalDetails = mbState.introAdditionalDetails || '';
        
        /* Only the filled sections exist as far as the document is
           concerned; an empty one must not create a blank page. */
        const introBlocks = (typeof mbIsLearnerGuide === 'function' && mbIsLearnerGuide()) ? [] : mbBlocksFilled(mbState.introBlocks);
        /* 3.69.0: the module overview table (intro_table.js) — all ten rows
           when any box has text, none otherwise. */
        const introTableRows = (typeof mbIntroTableRows === 'function') ? mbIntroTableRows(mbState.introTable, _mbLang()) : [];

        if (hasWorkTeam || introAdditionalDetails.trim() || introBlocks.length || introTableRows.length) {
            const { Table, TableRow, TableCell, WidthType, BorderStyle } = mbDocxLib();
            const introChildren = [];
            
            // Add page break (new page for introduction)
            const coversAdditionalInfo = mbState.coversAdditionalInfo || '';
            const coversAdditionalNotes = mbState.coversAdditionalNotes || '';
            const hasAnyCoverContent = coversAdditionalInfo.trim() || coversAdditionalNotes.trim() || mbState.coverRows.some(row => row.value.trim());
            
            // No page break needed - intro section already starts on new section
            
            // Work Team Table (if has team members)
            if (hasWorkTeam) {
                // Title
                introChildren.push(new Paragraph({
                    children: [
                        new TextRun({
                            text: _mbT('expWorkTeam'),
                            size: _wsBody(), // 12pt
                            bold: true,
                            rightToLeft: _mbRtl(),
                        }),
                    ],
                    alignment: _mbStart(AlignmentType),
                    bidirectional: _mbRtl(),
                    spacing: { after: 300, before: 200 },
                }));
                
                // Table rows
                const teamTableRows = [];
                
                // Header row
                const headerCells = [];
                headerCells.push(new TableCell({
                    children: [new Paragraph({
                        children: [new TextRun({
                            text: _mbT('expName'),
                            bold: true,
                            size: _wsBody(), // 12pt
                            rightToLeft: _mbRtl(),
                        })],
                        alignment: _mbStart(AlignmentType),
                        bidirectional: _mbRtl(),
                    })],
                    width: { size: 33, type: WidthType.PERCENTAGE },
                    margins: { top: 100, bottom: 100, left: 100, right: 100 },
                }));
                
                headerCells.push(new TableCell({
                    children: [new Paragraph({
                        children: [new TextRun({
                            text: _mbT('expTask'),
                            bold: true,
                            size: _wsBody(), // 12pt
                            rightToLeft: _mbRtl(),
                        })],
                        alignment: _mbStart(AlignmentType),
                        bidirectional: _mbRtl(),
                    })],
                    width: { size: 33, type: WidthType.PERCENTAGE },
                    margins: { top: 100, bottom: 100, left: 100, right: 100 },
                }));
                
                headerCells.push(new TableCell({
                    children: [new Paragraph({
                        children: [new TextRun({
                            text: _mbT('expWorkLocation'),
                            bold: true,
                            size: _wsBody(), // 12pt
                            rightToLeft: _mbRtl(),
                        })],
                        alignment: _mbStart(AlignmentType),
                        bidirectional: _mbRtl(),
                    })],
                    width: { size: 34, type: WidthType.PERCENTAGE },
                    margins: { top: 100, bottom: 100, left: 100, right: 100 },
                }));
                
                teamTableRows.push(new TableRow({ children: headerCells }));
                
                // Data rows
                mbState.teamMembers.forEach(member => {
                    if (member.name.trim() || member.task.trim() || member.workLocation.trim()) {
                        const dataCells = [];
                        
                        dataCells.push(new TableCell({
                            children: [new Paragraph({
                                children: [new TextRun({
                                    text: member.name,
                                    size: _wsBody(), // 12pt
                                    rightToLeft: _mbRtl(),
                                })],
                                alignment: _mbStart(AlignmentType),
                                bidirectional: _mbRtl(),
                            })],
                            margins: { top: 100, bottom: 100, left: 100, right: 100 },
                        }));
                        
                        dataCells.push(new TableCell({
                            children: [new Paragraph({
                                children: [new TextRun({
                                    text: member.task,
                                    size: _wsBody(), // 12pt
                                    rightToLeft: _mbRtl(),
                                })],
                                alignment: _mbStart(AlignmentType),
                                bidirectional: _mbRtl(),
                            })],
                            margins: { top: 100, bottom: 100, left: 100, right: 100 },
                        }));
                        
                        dataCells.push(new TableCell({
                            children: [new Paragraph({
                                children: [new TextRun({
                                    text: member.workLocation,
                                    size: _wsBody(), // 12pt
                                    rightToLeft: _mbRtl(),
                                })],
                                alignment: _mbStart(AlignmentType),
                                bidirectional: _mbRtl(),
                            })],
                            margins: { top: 100, bottom: 100, left: 100, right: 100 },
                        }));
                        
                        teamTableRows.push(new TableRow({ children: dataCells }));
                    }
                });
                
                const workTeamTable = new Table({
                    rows: teamTableRows,
                    width: { size: 9072, type: WidthType.DXA }, // 16cm
                    borders: {
                        top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                        bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                        left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                        right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                    },
                });
                
                introChildren.push(workTeamTable);
            }
            
            /* 3.69.0: the module overview table — its own page, 16 cm wide:
               the fixed heading on the start side (4.5 cm, bold, shaded),
               the author's text beside it (11.5 cm), one paragraph per line. */
            if (introTableRows.length) {
                if (hasWorkTeam) introChildren.push(new Paragraph({ children: [new PageBreak()] }));
                const W = (typeof MB_INTRO_TABLE_DXA !== 'undefined') ? MB_INTRO_TABLE_DXA : { total: 9072, label: 2551, value: 6521 };
                const line = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
                const para = (text, head) => new Paragraph({
                    children: [new TextRun(Object.assign({ text: text, bold: !!head, size: _wsBody(), rightToLeft: _mbRtl() },
                        head ? { color: _wsTblText() } : {}))],
                    alignment: _mbStart(AlignmentType),
                    bidirectional: _mbRtl(),
                    spacing: { after: 60 },
                });
                const cellOpts = { margins: { top: 100, bottom: 100, left: 120, right: 120 } };
                const rows = introTableRows.map(r => {
                    const lines = String(r.value || '').split('\n');
                    const valueParas = lines.map(l => para(l));
                    const labelCell = new TableCell(Object.assign({
                        children: [para(r.label, true)],
                        width: { size: W.label, type: WidthType.DXA },
                        shading: { fill: _wsTblFill(), type: 'clear' },   // the header fill of Export settings
                    }, cellOpts));
                    const valueCell = new TableCell(Object.assign({
                        children: valueParas.length ? valueParas : [para('')],
                        width: { size: W.value, type: WidthType.DXA },
                    }, cellOpts));
                    /* The start side comes first in reading order: on an
                       RTL page the heading stays on the right. */
                    return new TableRow({ children: [labelCell, valueCell], cantSplit: true });
                });
                introChildren.push(new Table({
                    rows: rows,
                    width: { size: W.total, type: WidthType.DXA },   // 16 cm
                    columnWidths: [W.label, W.value],
                    layout: 'fixed',
                    borders: { top: line, bottom: line, left: line, right: line, insideHorizontal: line, insideVertical: line },
                }));
            }

            // Additional Introduction Details (on new page if filled)
            if (introAdditionalDetails.trim()) {
                // Add page break if there was work team content
                if (hasWorkTeam || introTableRows.length) {
                    introChildren.push(new Paragraph({
                        children: [new PageBreak()],
                    }));
                }
                
                const detailsLines = introAdditionalDetails.split('\n');
                detailsLines.forEach(line => {
                    if (line.trim()) {
                        introChildren.push(new Paragraph({
                            children: [
                                new TextRun({
                                    text: line,
                                    size: _wsBody(),
                                    rightToLeft: _mbRtl(),
                                }),
                            ],
                            alignment: _mbStart(AlignmentType),
                            bidirectional: _mbRtl(),
                            spacing: { after: 150 },
                        }));
                    }
                });
            }
            
            /* Extra introduction sections. Each is its own page, so a
               page break goes BEFORE every section that has something in
               front of it — the first one breaks only if the work team or
               the additional details already wrote onto the page. */
            let introPageUsed = !!(hasWorkTeam || introAdditionalDetails.trim() || introTableRows.length);

            introBlocks.forEach(block => {
                if (introPageUsed) {
                    introChildren.push(new Paragraph({ children: [new PageBreak()] }));
                }
                introPageUsed = true;

                const blockTitle = (block.title || '').trim();
                if (blockTitle) {
                    introChildren.push(new Paragraph({
                        children: [new TextRun({
                            text: blockTitle,
                            size: _wsSection(),            // 14pt — a page heading
                            bold: true,
                            color: _wsHeadColor(),
                            rightToLeft: _mbRtl(),
                        })],
                        alignment: _mbStart(AlignmentType),
                        bidirectional: _mbRtl(),
                        spacing: { after: 300, before: 200 },
                    }));
                }

                (block.body || '').split('\n').forEach(line => {
                    if (!line.trim()) return;
                    introChildren.push(new Paragraph({
                        children: [new TextRun({ text: line, size: _wsBody(), rightToLeft: _mbRtl() })],
                        alignment: _mbStart(AlignmentType),
                        bidirectional: _mbRtl(),
                        spacing: { after: 150 },
                    }));
                });

                /* Tables come after the prose, in the order the card
                   shows them on screen. A section with a table and no
                   prose reaches here too — mbBlocksFilled keeps it. */
                (block.tables || []).forEach(t => _pushUserTable(t, introChildren));
            });

            sections.push({
                properties: {
                    bidi: _mbRtl()
                },
                children: introChildren,
            });
        }
        
        // Module & Learning Outcomes Overview Section (NEW - separate page)
        // This section appears after Introduction and before Information Sheets
        if (mbState.currentModuleId && mbState.learningOutcomesData.length > 0) {
            const overviewChildren = [];
            const currentModule = mbState.modulesData.find(m => m.id === mbState.currentModuleId);
            
            // No page break needed here - sections automatically start on new pages
            
            // Module Title - Large heading
            /* 3.58.0: the full title when the module has one (module_identity.js). */
            const _modTitle = currentModule ? (String(currentModule.fullTitle || '').trim() || currentModule.title || '') : '';
            if (currentModule && _modTitle && _modTitle.trim()) {
                overviewChildren.push(new Paragraph({
                    children: [
                        new TextRun({
                            text: _modTitle,
                            size: _wsTitle(), // module title
                            bold: true,
                            color: _wsHeadColor(), // Blue color
                            rightToLeft: _mbRtl(),
                        }),
                    ],
                    alignment: _mbStart(AlignmentType),
                    bidirectional: _mbRtl(),
                    spacing: { after: 600, before: 200 },
                }));
            }
            
            // Learning Outcomes - loop through all LOs
            mbState.learningOutcomesData.forEach((lo, index) => {
                // Learning Outcome number and title
                const loNumber = index + 1;
                const loTitle = mbLoPlainTitle(lo.title || '');
                /* Same guard the assessment forms already used, applied
                   here too. It matters far more in French than it ever
                   did in English: the DEFAULT outcome name and the
                   export PREFIX are the same words — dgDefaultLOName is
                   «Résultat d'apprentissage {v0}» and expLearningOutcomeN
                   opens with «Résultat d'apprentissage {v0} :» — so an
                   outcome the author never renamed printed its own name
                   twice in a row. In English the two happened to differ
                   enough ("Learning Outcome 1" vs "Learning Outcome 1:")
                   that nobody noticed the guard was missing from two of
                   the three call sites. */
                /* 3.67.0: the Learner guide calls an outcome a learning
                   unit here too («1- Learning unit: …»). */
                const loHeadingText = (typeof mbIsLearnerGuide === 'function' && mbIsLearnerGuide() && typeof mbLgUnitHeading === 'function')
                    ? mbLgUnitHeading(loNumber, loTitle, _mbLang())
                    : _mbTitledAlready(loTitle, 'expLearningOutcomeN')
                    ? loTitle
                    : _mbTf('expLearningOutcomeN', { v0: loNumber, v1: loTitle });
                
                overviewChildren.push(new Paragraph({
                    children: [
                        new TextRun({
                            text: loHeadingText,
                            size: _wsSub(), // 13pt
                            bold: true,
                            color: '1F4E78', // Darker blue
                            rightToLeft: _mbRtl(),
                        }),
                    ],
                    alignment: _mbStart(AlignmentType),
                    bidirectional: _mbRtl(),
                    spacing: { after: 200, before: 300 },
                }));
                
                // Learning Outcome description (if available)
                if (lo.description && lo.description.trim()) {
                    const descLines = lo.description.split('\n').filter(line => line.trim());
                    descLines.forEach((line, lineIndex) => {
                        overviewChildren.push(new Paragraph({
                            children: [
                                new TextRun({
                                    text: line,
                                    size: _wsBody(), // 12pt
                                    rightToLeft: _mbRtl(),
                                }),
                            ],
                            alignment: _mbStart(AlignmentType),
                            bidirectional: _mbRtl(),
                            spacing: { 
                                after: 150
                            },
                        }));
                    });
                }
                
                /* Author-defined sections for this outcome. They sit
                   between the description and the performance criteria —
                   the same order the card shows on screen. */
                /* 3.43.0: sections placed at the start or the end of the
                   outcome print there instead (lo_sequence.js). */
                mbBlocksFilled(lo.blocks).filter(b => typeof mbBlockPlace !== 'function' || mbBlockPlace(b) === 'overview').forEach(block => {
                    const blockTitle = (block.title || '').trim();
                    if (blockTitle) {
                        overviewChildren.push(new Paragraph({
                            children: [new TextRun({
                                text: blockTitle,
                                size: _wsBody(),        // 12pt — matches expPerformanceCriteria
                                bold: true,
                                rightToLeft: _mbRtl(),
                            })],
                            alignment: _mbStart(AlignmentType),
                            bidirectional: _mbRtl(),
                            spacing: { after: 200, before: 250 },
                        }));
                    }
                    (block.body || '').split('\n').forEach(line => {
                        if (!line.trim()) return;
                        overviewChildren.push(new Paragraph({
                            children: [new TextRun({ text: line, size: _wsBody(), rightToLeft: _mbRtl() })],
                            alignment: _mbStart(AlignmentType),
                            bidirectional: _mbRtl(),
                            spacing: { after: 150 },
                        }));
                    });
                    (block.tables || []).forEach(t => _pushUserTable(t, overviewChildren));
                });

                // Performance Criteria (if available)
                if (lo.performanceCriteria && lo.performanceCriteria.length > 0) {
                    // Performance Criteria heading
                    overviewChildren.push(new Paragraph({
                        children: [
                            new TextRun({
                                text: _mbT('expPerformanceCriteria'),
                                size: _wsBody(), // 12pt
                                bold: true,
                                rightToLeft: _mbRtl(),
                            }),
                        ],
                        alignment: _mbStart(AlignmentType),
                        bidirectional: _mbRtl(),
                        spacing: { after: 200, before: 250 },
                    }));
                    
                    // Performance Criteria list - numbered
                    lo.performanceCriteria.forEach((pc, pcIndex) => {
                        const criteriaText = pc.text || pc.id || pc;
                        overviewChildren.push(new Paragraph({
                            children: [
                                new TextRun({
                                    text: `${pcIndex + 1}. ${criteriaText}`,
                                    size: _wsBody(), // 12pt
                                    rightToLeft: _mbRtl(),
                                }),
                            ],
                            alignment: _mbStart(AlignmentType),
                            bidirectional: _mbRtl(),
                            spacing: { after: 150 },
                        }));
                    });
                    
                    // Add extra spacing after performance criteria section
                    overviewChildren.push(new Paragraph({
                        children: [new TextRun({ text: '', size: _wsBody() })],
                        spacing: { after: 300 },
                    }));
                }
            });
            
            // Add Module Overview section to document
            sections.push({
                properties: {
                    bidi: _mbRtl()
                },
                children: overviewChildren,
            });
        }
        
        // ── COMPREHENSIVE EXPORT: All LOs → Info Sheets → Activity Sheets ──
        // Flush current UI state into data store
        if (mbState.currentLOId) saveCurrentSheetToLO();
        if (mbState.currentModuleId) saveCurrentModuleLOData();

        /* 3.54.3: every sheet picture is decoded once, up front, so its
           real size is known (an Image read synchronously often still
           says 0 × 0, and the picture came out a stretched square) and a
           format Word cannot show — WebP, SVG, AVIF — is turned into PNG
           instead of becoming an empty frame. */
        const _imgPrep = await _mbDocxPrepareImages(mbState.learningOutcomesData);
        let _imgFailed = 0;

        // Helper: build ImageRun
        const _mkImgRun = (src) => {
            const { ImageRun } = mbDocxLib();
            const prep = _imgPrep.get(src);
            if (!prep) {
                /* Not a picture this export could read. Counted, and the
                   author told once the file is made, rather than left to
                   find an empty cell in Word. */
                _imgFailed++;
                throw new Error('image could not be exported');
            }
            const ar = prep.h / prep.w || 1;
            let w = Math.min(280, prep.w || 280), h = Math.round(w * ar);
            if (h > 400) { h = 400; w = Math.round(h / ar); }
            return new ImageRun({ data: prep.data, transformation: { width: w, height: h } });
        };

        /* 3.56.0 — attachments.js. A picture of an attached item uses the
           width of the page, not of the half cell beside a step. */
        const _mkFigRun = (src) => {
            const { ImageRun } = mbDocxLib();
            const prep = _imgPrep.get(src);
            if (!prep) { _imgFailed++; throw new Error('image could not be exported'); }
            const ar = prep.h / prep.w || 1;
            let w = Math.min(520, prep.w || 520), h = Math.round(w * ar);
            if (h > 560) { h = 560; w = Math.round(h / ar); }
            return new ImageRun({ data: prep.data, transformation: { width: w, height: h } });
        };
        /* A picture in a step or section cell, with its caption under it. */
        const _imgCellCh = (src, cap) => {
            const out = [new Paragraph({ children: [_mkImgRun(src)], alignment: AlignmentType.CENTER })];
            if (cap && String(cap).trim()) {
                out.push(new Paragraph({ children: [new TextRun({ text: String(cap), bold: true, size: _wsBody() - 2, color: _wsHeadColor(), rightToLeft: _mbRtl() })],
                    alignment: AlignmentType.CENTER, bidirectional: _mbRtl(), spacing: { before: 60 } }));
            }
            return out;
        };
        const _srcPara = (a, center) => {
            const line = (typeof mbFigSourceLine === 'function') ? mbFigSourceLine(a, _mbLang()) : '';
            if (!line) return null;
            return new Paragraph({ children: [new TextRun({ text: line, italics: true, size: _wsBody() - 4, color: '555555', rightToLeft: _mbRtl() })],
                alignment: center ? AlignmentType.CENTER : _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { after: 200 } });
        };
        /* One attached item, where the plan puts it (mbAttPlan). */
        const _pushAttachment = (a, ch) => {
            if (!a) return;
            if (a.type === 'image') {
                try {
                    ch.push(new Paragraph({ children: [_mkFigRun(a.image)], alignment: AlignmentType.CENTER, spacing: { before: 200, after: 80 } }));
                } catch (e) { return; }
                const src = _srcPara(a, true);
                if (a.__caption) {
                    ch.push(new Paragraph({ children: [new TextRun({ text: a.__caption, bold: true, size: _wsBody(), color: _wsHeadColor(), rightToLeft: _mbRtl() })],
                        alignment: AlignmentType.CENTER, bidirectional: _mbRtl(), spacing: { after: src ? 40 : 200 } }));
                }
                if (src) ch.push(src);
                else if (!a.__caption) ch.push(new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 120 } }));
                return;
            }
            if (a.type === 'table' && a.table) {
                const before = ch.length;
                _pushUserTable(a.table, ch);
                const src = _srcPara(a, false);
                /* Under the table, before the spacer _pushUserTable adds. */
                if (src && ch.length > before) ch.splice(ch.length - 1, 0, src);
            }
        };

        // Helper: build a user-created table from saved data
        /* Function declarations, not const arrows.
           ------------------------------------------------------------
           The author-defined sections of the introduction and of each
           learning outcome are rendered EARLIER in this function than
           this line, and they now push tables too. A `const` arrow is in
           its temporal dead zone until execution reaches it, so those
           earlier calls would throw «Cannot access before
           initialization» — the same class of mistake as the
           `Table is not defined` this helper caused when it was first
           written, and invisible until a user happens to put a table in
           an early section. A declaration is hoisted to the top of the
           enclosing function and has neither problem. */
        function _buildUserTable(t, Table, TableRow, TableCell, WidthType, BorderStyle) {
            if (!t || !t.cells || !t.rows || !t.cols) return null;
            const colW = Math.floor(9072 / t.cols);
            const borders = { top:{style:BorderStyle.SINGLE,size:1,color:'000000'}, bottom:{style:BorderStyle.SINGLE,size:1,color:'000000'}, left:{style:BorderStyle.SINGLE,size:1,color:'000000'}, right:{style:BorderStyle.SINGLE,size:1,color:'000000'}, insideHorizontal:{style:BorderStyle.SINGLE,size:1,color:'000000'}, insideVertical:{style:BorderStyle.SINGLE,size:1,color:'000000'} };
            const rows = [];
            for (let r = 0; r < t.rows; r++) {
                const cells = [];
                for (let c = 0; c < t.cols; c++) {
                    const txt = (t.cells[r] && t.cells[r][c]) ? t.cells[r][c] : '';
                    cells.push(new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: txt, size: _wsUserTable(), rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl() })], width: { size: colW, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 100, right: 100 } }));
                }
                rows.push(new TableRow({ children: cells }));
            }
            return new Table({ rows, width: { size: 9072, type: WidthType.DXA }, borders });
        }

        /* Table with its captions, pushed into a children array.
           ------------------------------------------------------------
           The three call sites below used to repeat "build it, push it,
           push a spacer" verbatim, which is how the first two would
           have gained captions and the third would have been forgotten.
           They call this instead.

           The title takes the same blue bold as «Objective:» — the
           heading style this document already uses for a label that
           introduces what follows — because that is what the author
           asked for when they typed it into the field marked title. The
           sub-title is body weight: a second line at heading weight
           competes with the first and the reader cannot tell which one
           names the table. */
        function _pushUserTable(t, ch) {
            if (!t) return;
            /* The classes are fetched HERE, not closed over.
               ------------------------------------------------------------
               _buildUserTable takes Table, TableRow, TableCell, WidthType
               and BorderStyle as PARAMETERS, and every call site
               destructures its own copy from mbDocxLib() first — which is
               why this helper, written beside it but called from three
               different scopes, threw `Table is not defined` on the first
               table it met. It was reading names that exist at each call
               site and nowhere near its own definition.

               mbDocxLib() is the same source those call sites use, so the
               classes are identical; asking for them here makes the
               helper independent of whatever happens to be in scope
               wherever it is called from, which is the property it needed
               and did not have. */
            const { Table, TableRow, TableCell, WidthType, BorderStyle } = mbDocxLib();
            if (t.title && t.title.trim()) {
                ch.push(new Paragraph({
                    children: [new TextRun({ text: t.title, bold: true, size: _wsBody(),
                                            color: _wsHeadColor(), rightToLeft: _mbRtl() })],
                    alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(),
                    spacing: { before: 200, after: t.subtitle ? 40 : 100 }
                }));
            }
            if (t.subtitle && t.subtitle.trim()) {
                ch.push(new Paragraph({
                    children: [new TextRun({ text: t.subtitle, size: _wsBody(), rightToLeft: _mbRtl() })],
                    alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(),
                    spacing: { after: 100 }
                }));
            }
            const tbl = _buildUserTable(t, Table, TableRow, TableCell, WidthType, BorderStyle);
            if (tbl) {
                ch.push(tbl);
                ch.push(new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 200 } }));
            }
        }

        /* Helper: render a Learning Guide MODEL as docx children.
           The model comes from learning_guide.js and is the same object
           the on-screen preview renders, which is the only way the two
           can be guaranteed to agree. This function knows about docx and
           nothing about learning guides; that file knows about learning
           guides and nothing about docx. */
        const _buildLearningGuideDocx = (model) => {
            if (!model || !model.sections || !model.sections.length) return null;
            const { Table, TableRow, TableCell, WidthType, BorderStyle, VerticalMergeType } = mbDocxLib();

            const bdr = {
                top:    { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                left:   { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                right:  { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                insideVertical:   { style: BorderStyle.SINGLE, size: 1, color: '000000' }
            };
            const mgn = { top: 120, bottom: 120, left: 150, right: 150 };
            /* Fixed DXA on the table AND on every cell — percentage widths
               survive Word but collapse in Google Docs, which is where
               half of these modules get reviewed. */
            const COL_A = 4536, COL_B = 4536;

            const para = (text, opts) => new Paragraph({
                children: [new TextRun(Object.assign(
                    { text: text, size: _wsBody(), rightToLeft: _mbRtl() },
                    opts || {}
                ))],
                alignment: _mbStart(AlignmentType),
                bidirectional: _mbRtl(),
                spacing: { after: 60 }
            });
            const cellA = (children) => new TableCell({
                children: children.length ? children : [new Paragraph({ text: '' })],
                width: { size: COL_A, type: WidthType.DXA },
                margins: mgn
            });

            const rows = [];

            // Column headers — a plain two-cell row, nothing to merge yet.
            rows.push(new TableRow({ children: [
                cellA([para(model.colActivities, { bold: true, size: _wsSub(), color: '1F4788' })]),
                new TableCell({
                    children: [para(model.colInstructions, { bold: true, size: _wsSub(), color: '1F4788' })],
                    width: { size: COL_B, type: WidthType.DXA }, margins: mgn
                })
            ] }));

            model.sections.forEach((sec) => {
                /* ONE instructions cell per section, spanning from the
                   header row down through every sheet-item row below it —
                   a vertical merge, not a cell repeated or left blank.
                   The instructions describe the KIND of activity, not any
                   one sheet, so they belong beside the section once, not
                   copied next to every title in it. RESTART carries the
                   real content; every CONTINUE cell below it must still be
                   present in the row (docx tables are a strict grid) but
                   carries none — Word discards a continued cell's own
                   content and renders the RESTART cell's instead. */
                const instrChildren = sec.instructions.map(t => para('•  ' + t));
                rows.push(new TableRow({ children: [
                    cellA([para(sec.header, { bold: true })]),
                    new TableCell({
                        verticalMerge: VerticalMergeType.RESTART,
                        children: instrChildren.length ? instrChildren : [new Paragraph({ text: '' })],
                        width: { size: COL_B, type: WidthType.DXA }, margins: mgn,
                        verticalAlign: 'center'
                    })
                ] }));

                const itemRows = sec.groupItems ? [sec.items] : sec.items.map(t => [t]);
                itemRows.forEach((group) => {
                    rows.push(new TableRow({ children: [
                        cellA(group.map(t => para(t))),
                        new TableCell({
                            verticalMerge: VerticalMergeType.CONTINUE,
                            children: [],
                            width: { size: COL_B, type: WidthType.DXA }
                        })
                    ] }));
                });
            });

            return [
                new Paragraph({
                    children: [new TextRun({ text: model.title, size: _wsSection(), bold: true, color: _wsHeadColor(), rightToLeft: _mbRtl() })],
                    alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { after: 300, before: 200 }
                }),
                new Table({ rows, width: { size: 9072, type: WidthType.DXA }, layout: 'fixed', columnWidths: [COL_A, COL_B], borders: bdr })
            ];
        };

        // Helper: build info sheet children from stored data
        /* ── QR / link table ────────────────────────────────────
           Two cells in one 16 cm row: the QR image on one side, the
           subject and address on the other. This existed only in a
           legacy single-sheet path, so neither the Information Sheet nor
           the Activity Sheet has been exporting it since those builders
           took over — the card was filled in and nothing came out. */
        const buildQrTable = (subject, url, qrImage) => {
            const subj = (subject || '').trim();
            const link = (url || '').trim();
            if (!qrImage && !subj && !link) return null;

            const { Table, TableRow, TableCell, WidthType, BorderStyle, ImageRun } = mbDocxLib();
            const cells = [];

            /* 2.5 cm at 96 DPI, matching the button's own promise. */
            let qrCell = new TableCell({
                children: [new Paragraph({ text: '' })],
                width: { size: 2268, type: WidthType.DXA },
                verticalAlign: 'center',
                margins: { top: 100, bottom: 100, left: 100, right: 100 }
            });
            if (qrImage) {
                try {
                    const b64 = String(qrImage).split(',')[1];
                    qrCell = new TableCell({
                        children: [new Paragraph({
                            children: [new ImageRun({
                                data: Uint8Array.from(atob(b64), c => c.charCodeAt(0)),
                                transformation: { width: 94, height: 94 }
                            })],
                            alignment: AlignmentType.CENTER
                        })],
                        /* 4 cm: wide enough for a 2.5 cm code plus cell
                           margins, and no wider. The first attempt gave
                           it 2.5 cm exactly and the code spilled into the
                           text; the second split the row in half and left
                           a long URL wrapping in a needlessly narrow
                           cell. The address is the long content here, so
                           it gets the 12 cm. */
                        width: { size: 2268, type: WidthType.DXA },
                        verticalAlign: 'center',
                        margins: { top: 100, bottom: 100, left: 100, right: 100 }
                    });
                } catch (e) {
                    /* A corrupt QR must not lose the address beside it. */
                    console.error('QR image skipped:', e);
                }
            }

            const watch = _mbT('expWatchVideo');
            const caption = subj ? (watch + ' ' + subj) : (link ? watch : '');
            const textCell = new TableCell({
                children: [
                    new Paragraph({
                        children: [new TextRun({ text: caption, size: _wsBody(), rightToLeft: _mbRtl() })],
                        alignment: _mbStart(AlignmentType), bidirectional: _mbRtl()
                    }),
                    new Paragraph({
                        children: [new TextRun({ text: link, size: _wsBody(), color: '0563C1',
                                                underline: {}, rightToLeft: _mbRtl() })],
                        alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(), wordWrap: true
                    })
                ],
                width: { size: 6804, type: WidthType.DXA },
                verticalAlign: 'center',
                margins: { top: 100, bottom: 100, left: 200, right: 200 }
            });

            /* Text first, QR second. docx_bidi mirrors the row for
               Arabic, so this order puts the QR on the outer edge in
               both directions. */
            cells.push(textCell, qrCell);

            const border = { style: BorderStyle.SINGLE, size: 1, color: '000000' };
            return new Table({
                rows: [new TableRow({ children: cells })],
                width: { size: 9072, type: WidthType.DXA },
                borders: { top: border, bottom: border, left: border, right: border,
                           insideHorizontal: border, insideVertical: border }
            });
        };

        /* 3.59.0: the project's module template (module_template.js).
           The Learner guide prints «1-2 Knowledge: …», leaves out the
           self-check, the answer key, the resources table, the checklist
           and the Learning Guide table, and adds the introduction, the
           reflection and its own assessment unit (learner_guide.js). */
        const _lgDoc = (typeof mbIsLearnerGuide === 'function') && mbIsLearnerGuide();
        const _lgPara = (text, o) => new Paragraph({
            children: [new TextRun({ text: text, size: (o && o.size) || _wsBody(), bold: !!(o && o.bold),
                                     color: (o && o.color) || undefined, rightToLeft: _mbRtl() })],
            alignment: (o && o.center) ? AlignmentType.CENTER : _mbStart(AlignmentType), bidirectional: _mbRtl(),
            spacing: { before: (o && o.before) || 0, after: (o && o.after !== undefined) ? o.after : 150 }
        });
        const _lgHead = (text, big) => _lgPara(text, { size: big ? _wsSection() : _wsSub(), bold: true, color: _wsHeadColor(), before: big ? 200 : 240, after: big ? 400 : 200 });
        const _lgTextCh = (text, ch) => String(text || '').split('\n').forEach(line => { if (line.trim()) ch.push(_lgPara(line)); });

        /* 3.42.0: sheet headings follow the type and the names set in
           Settings → Misc; untouched, they are today's templates. */
        const _sheetHeadText = (kind, num, title, tplKey, sheet) => {
            if (_lgDoc && typeof mbLgSheetHeading === 'function') return mbLgSheetHeading(kind, num, title, _mbLang(), sheet);
            const own = (typeof mbSheetLabelExplicit === 'function') ? mbSheetLabelExplicit(kind, _mbLang(), sheet) : '';
            return own ? mbSheetHeading(own, num, title) : _mbTf(tplKey, { v0: num, v1: title });
        };
        const buildInfoCh = (info, loIndex, sheetIndex) => {
            const { Table, TableRow, TableCell, WidthType, BorderStyle } = mbDocxLib();
            const ch = [];
            const _loSeq = mbState.learningOutcomesData[loIndex];   // 3.43.0
            const num = (typeof mbSeqNumber === 'function') ? mbSeqNumber(_loSeq, loIndex, 'info', sheetIndex)
                : (info.sheetNumber || getAutoSheetNumber(loIndex, sheetIndex));
            if (info.title && info.title.trim()) {
                ch.push(new Paragraph({ children: [new TextRun({ text: _sheetHeadText('info', num, info.title, 'expInfoSheetTitled'), size: _wsBody(), bold: true, color: _wsHeadColor(), rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { after: 400 } }));
            }
            /* 3.67.0: the Learner guide prints a knowledge sheet's
               objectives only when they are shown, under its own name. */
            const _objOn = !_lgDoc || typeof mbLgObjectivePrinted !== 'function' || mbLgObjectivePrinted(info);
            const _objLbl = (_lgDoc && typeof mbLgLabel === 'function') ? mbLgLabel('objectives', _mbLang()) + (_mbLang() === 'fr' ? ' :' : ':') : _mbT('expObjective');
            if (_objOn && info.objective && info.objective.trim()) {
                ch.push(new Paragraph({ children: [new TextRun({ text: _objLbl, bold: true, size: _wsBody(), color: _wsHeadColor(), rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { after: 200 } }));
                /* Same blue bold heading style as «Objective:» itself, by
                   request: it reads as part of the heading block, not as
                   the first item of the list. Skipped when empty — a user
                   who deleted the line meant to delete it. */
                if (info.objectiveLead && info.objectiveLead.trim()) {
                    ch.push(new Paragraph({ children: [new TextRun({ text: info.objectiveLead, bold: true, size: _wsBody(), color: _wsHeadColor(), rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { after: 200 } }));
                }
                info.objective.split('\n').forEach(line => { if (line.trim()) ch.push(new Paragraph({ children: [new TextRun({ text: line, size: _wsBody(), rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { after: 150 } })); });
            }
            if (info.contentSections || info.attachments) {   // 3.56.0: a sheet of attached items only
                /* The card's name, when the author gave it one. Printed in
                   the same blue bold as «Objective:» so a renamed section
                   reads as a real heading and not as body text. An
                   untouched card has no heading at all: «Content 3:» is
                   editor scaffolding and must never reach the page. */
                const _pushCsHeading = (cs) => {
                    const h = (cs.heading || '').trim();
                    const sub = (cs.subheading || '').trim();   // 3.72.0
                    if (h) ch.push(new Paragraph({
                        children: [new TextRun({ text: h, bold: true, size: _wsBody(), color: _wsHeadColor(), rightToLeft: _mbRtl() })],
                        alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { before: 120, after: sub ? 80 : 150 }
                    }));
                    if (sub) ch.push(new Paragraph({
                        children: [new TextRun({ text: sub, bold: true, size: _wsBody(), rightToLeft: _mbRtl() })],
                        alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { after: 150 }
                    }));
                };
                /* 3.56.0: in printed order, with the attached items in the
                   places chosen for them (attachments.js). */
                const _plan = (typeof mbAttPlan === 'function') ? mbAttPlan('info', info)
                    : { items: info.contentSections, slots: info.contentSections.map(() => []).concat([[]]) };
                _plan.items.forEach((cs, k) => {
                    (_plan.slots[k] || []).forEach(a => _pushAttachment(a, ch));
                    let imgs = (info.contentSectionImages && info.contentSectionImages[cs.contentId]) || [];
                    if (!Array.isArray(imgs)) imgs = [imgs];
                    /* 3.54.3: pictures with no text yet are printed too. */
                    if ((!cs.text || !cs.text.trim()) && !imgs.length) {
                        /* 3.35.0: a section with a heading and no text yet
                           is a topic of the sheet (a knowledge item sent by
                           DACUM): its heading is printed. Only a section with
                           neither heading, text nor table is left out. */
                        _pushCsHeading(cs);
                        if (cs.tables && cs.tables.length) cs.tables.forEach(t => _pushUserTable(t, ch));
                        return;
                    }
                    _pushCsHeading(cs);
                    const pt = processTextForWordExport(cs.text || '');
                    /* 3.71.0: a section with no picture is printed as plain
                       paragraphs, justified — no table, no empty picture
                       cell beside it. */
                    if (!imgs.length) {
                        String(pt).split('\n').forEach(l => {
                            if (!l.trim()) return;
                            ch.push(new Paragraph({ children: [new TextRun({ text: l, size: _wsBody(), rightToLeft: _mbRtl() })],
                                alignment: AlignmentType.JUSTIFIED, bidirectional: _mbRtl(), spacing: { after: 120, line: 300 } }));
                        });
                        ch.push(new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 120 } }));
                        if (cs.marks) { cs.marks.forEach(m => { if (m.text && m.text.trim()) { const mt = _mbDocxMarkType(m.key); if (mt) { ch.push(buildMarkDocxTable(mt, m.text)); } } }); }
                        if (cs.tables && cs.tables.length) cs.tables.forEach(t => _pushUserTable(t, ch));
                        return;
                    }
                    const row1 = [new TableCell({ children: String(pt).split('\n').filter((l, i, a) => l.trim() || a.length === 1).map(l => new Paragraph({ children: [new TextRun({ text: l, size: _wsBody(), rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { after: 80 } })), width: { size: 4536, type: WidthType.DXA }, margins: { top: 150, bottom: 150, left: 150, right: 150 }, verticalAlign: 'center' })];
                    if (imgs.length > 0) { try { row1.push(new TableCell({ children: _imgCellCh(imgs[0], (cs.__imgCaps || [])[0]), width: { size: 4536, type: WidthType.DXA }, margins: { top: 150, bottom: 150, left: 150, right: 150 }, verticalAlign: 'center' })); } catch(e) { row1.push(new TableCell({ children: [new Paragraph({ text: '' })], width: { size: 4536, type: WidthType.DXA } })); } }
                    else { row1.push(new TableCell({ children: [new Paragraph({ text: '' })], width: { size: 4536, type: WidthType.DXA } })); }
                    const tRows = [new TableRow({ children: row1 })];
                    for (let ii = 1; ii < imgs.length; ii++) { try { tRows.push(new TableRow({ children: [new TableCell({ children: [new Paragraph({ text: '' })], width: { size: 4536, type: WidthType.DXA } }), new TableCell({ children: _imgCellCh(imgs[ii], (cs.__imgCaps || [])[ii]), width: { size: 4536, type: WidthType.DXA }, margins: { top: 100, bottom: 100, left: 150, right: 150 } })] })); } catch(e) {} }
                    const borders = { top: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, left: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, right: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, insideVertical: { style: BorderStyle.SINGLE, size: 1, color: '000000' } };
                    ch.push(new Table({ rows: tRows, width: { size: 9072, type: WidthType.DXA }, borders }));
                    ch.push(new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 200 } }));
                    if (cs.marks) { cs.marks.forEach(m => { if (m.text && m.text.trim()) { const mt = _mbDocxMarkType(m.key); if (mt) { ch.push(buildMarkDocxTable(mt, m.text)); } } }); }
                    // Export user-created tables
                    if (cs.tables && cs.tables.length) {
                        cs.tables.forEach(t => _pushUserTable(t, ch));
                    }
                });
                (_plan.slots[_plan.items.length] || []).forEach(a => _pushAttachment(a, ch));
            }
            {
                /* 3.70.0: every link of the sheet, one row each, in order —
                   and each sheet's OWN QR code (info.qrImage; it used to
                   print the open sheet's code on every sheet). */
                const links = (typeof mbSheetLinks === 'function')
                    ? mbSheetLinks(info, info.qrImage !== undefined ? info.qrImage : mbState.infoQRImage)
                    : [{ subject: info.linkSubject, url: info.linkUrl, image: mbState.infoQRImage }];
                const tables = links.map(l => buildQrTable(l.subject, l.url, l.image)).filter(Boolean);
                tables.forEach((qrT, i) => {
                    ch.push(new Paragraph({ children: [new TextRun({ text: '', size: _wsBody() })], spacing: i ? { after: 120 } : { before: 300, after: 200 } }));
                    ch.push(qrT);
                });
                if (tables.length) ch.push(new Paragraph({ children: [new TextRun({ text: '', size: _wsBody() })], spacing: { after: 200 } }));
            }
            if (!_lgDoc && info.selfCheckContent && info.selfCheckContent.trim()) {
                const scNum = (typeof mbSeqSubNumber === 'function') ? mbSeqSubNumber(_loSeq, loIndex, sheetIndex, info.selfCheckNumber) : (info.selfCheckNumber || num);
                const scCh = [];
                scCh.push(new Paragraph({ children: [new TextRun({ text: _mbTf('expSelfCheck', { v0: scNum }), bold: true, size: _wsBody(), color: _wsHeadColor(), rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { after: 400 } }));
                info.selfCheckContent.split('\n').forEach(line => { if (line.trim()) scCh.push(new Paragraph({ children: [new TextRun({ text: line, size: _wsBody(), rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { after: 150 } })); });
                ch.__selfCheckSection = scCh;
            }
            if (!_lgDoc && info.answersKeyContent && info.answersKeyContent.trim()) {
                const akNum = (typeof mbSeqSubNumber === 'function') ? mbSeqSubNumber(_loSeq, loIndex, sheetIndex, info.answersKeyNumber) : (info.answersKeyNumber || num);
                const akCh = [];
                akCh.push(new Paragraph({ children: [new TextRun({ text: _mbTf('expAnswersKey', { v0: akNum }), bold: true, size: _wsBody(), color: _wsHeadColor(), rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { after: 400 } }));
                info.answersKeyContent.split('\n').forEach(line => { if (line.trim()) akCh.push(new Paragraph({ children: [new TextRun({ text: line, size: _wsBody(), rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { after: 150 } })); });
                ch.__answersKeySection = akCh;
            }
            return ch;
        };

        // Helper: build activity sheet children from stored data
        const buildActCh = (activity, loIndex, sheetIndex) => {
            const { Table, TableRow, TableCell, WidthType, BorderStyle } = mbDocxLib();
            const ch = [];
            const num = (typeof mbSeqNumber === 'function') ? mbSeqNumber(mbState.learningOutcomesData[loIndex], loIndex, 'activity', sheetIndex)
                : (activity.sheetNumber || getAutoSheetNumber(loIndex, sheetIndex));   // 3.43.0
            if (activity.title && activity.title.trim()) {
                ch.push(new Paragraph({ children: [new TextRun({ text: _sheetHeadText((typeof mbSheetKind === 'function') ? mbSheetKind(activity.sheetType) : 'activity', num, activity.title, 'expActivitySheetTitled', activity), size: _wsBody(), bold: true, color: _wsHeadColor(), rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { after: 400 } }));
            }
            /* 3.68.0: the Learner guide prints an activity sheet's
               objectives only when they are shown, under its own name. */
            const _aObjOn = !_lgDoc || typeof mbLgObjectivePrinted !== 'function' || mbLgObjectivePrinted(activity);
            const _aObjLbl = (_lgDoc && typeof mbLgLabel === 'function') ? mbLgLabel('objectives', _mbLang()) + (_mbLang() === 'fr' ? ' :' : ':') : _mbT('expObjective');
            if (_aObjOn && activity.objective && activity.objective.trim()) {
                ch.push(new Paragraph({ children: [new TextRun({ text: _aObjLbl, bold: true, size: _wsBody(), color: _wsHeadColor(), rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { after: 200 } }));
                /* Same blue bold heading style as «Objective:» itself, by
                   request: it reads as part of the heading block, not as
                   the first item of the list. Skipped when empty — a user
                   who deleted the line meant to delete it. */
                if (activity.objectiveLead && activity.objectiveLead.trim()) {
                    ch.push(new Paragraph({ children: [new TextRun({ text: activity.objectiveLead, bold: true, size: _wsBody(), color: _wsHeadColor(), rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { after: 200 } }));
                }
                activity.objective.split('\n').forEach(line => { if (line.trim()) ch.push(new Paragraph({ children: [new TextRun({ text: line, size: _wsBody(), rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { after: 150 } })); });
            }
            if (activity.duration && parseInt(activity.duration) > 0) {
                ch.push(new Paragraph({ children: [new TextRun({ text: _mbT('expDuration'), bold: true, size: _wsBody(), color: _wsHeadColor(), rightToLeft: _mbRtl() }), new TextRun({ text: _mbTf('expMinutes', { v0: activity.duration }), size: _wsBody(), rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { after: 300 } }));
            }
            const validRes = (activity.resources || []).filter(r => r.name && r.name.trim());
            if (!_lgDoc && validRes.length > 0) {
                ch.push(new Paragraph({ children: [new TextRun({ text: _mbT('expTrainingResources'), bold: true, size: _wsBody(), color: _wsHeadColor(), rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { after: 200, before: 200 } }));
                const bdr = { top:{style:BorderStyle.SINGLE,size:1,color:'000000'}, bottom:{style:BorderStyle.SINGLE,size:1,color:'000000'}, left:{style:BorderStyle.SINGLE,size:1,color:'000000'}, right:{style:BorderStyle.SINGLE,size:1,color:'000000'}, insideHorizontal:{style:BorderStyle.SINGLE,size:1,color:'000000'}, insideVertical:{style:BorderStyle.SINGLE,size:1,color:'000000'} };
                /* `wide` replaces the old `t.includes('Mat')` check, which
                   sized the column by testing for the English substring
                   "Mat" — a check that silently stops working the moment
                   the header is translated, since the Arabic word for
                   "Material" doesn't contain "Mat". The width is now the
                   caller's decision, not a guess from the label text. */
                const mkHdr = (t, wide) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: t, bold: true, size: _wsTable(), color: _wsTblText(), rightToLeft: _mbRtl() })], alignment: AlignmentType.CENTER, bidirectional: _mbRtl() })], shading: { fill: _wsTblFill(), type: 'clear' }, width: { size: wide ? 37 : 13, type: WidthType.PERCENTAGE } });
                const hdrMat = _mbT('expMaterialEquipment'), hdrQty = _mbT('expQuantityNumber');
                const resRows = [new TableRow({ children: [mkHdr(hdrMat, true), mkHdr(hdrQty, false), mkHdr(hdrMat, true), mkHdr(hdrQty, false)] })];
                for (let ri = 0; ri < validRes.length; ri += 2) {
                    const l = validRes[ri], r2 = validRes[ri+1];
                    const mkC = (txt, pct, align) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: txt||'', size: _wsResources(), rightToLeft: _mbRtl() })], alignment: align, bidirectional: _mbRtl() })], width: { size: pct, type: WidthType.PERCENTAGE }, margins: { top: 100, bottom: 100, left: 100, right: 100 } });
                    resRows.push(new TableRow({ children: [mkC(l.name,37,_mbStart(AlignmentType)), mkC(l.quantity||'1',13,AlignmentType.CENTER), mkC(r2?r2.name:'',37,_mbStart(AlignmentType)), mkC(r2?r2.quantity:'',13,AlignmentType.CENTER)] }));
                }
                ch.push(new Table({ rows: resRows, width: { size: 9072, type: WidthType.DXA }, layout: 'fixed', borders: bdr, columnWidths: [3356,1178,3356,1178] }));
                ch.push(new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 200 } }));
            }
            /* 3.54.3: a step holding only pictures is printed too.
               3.56.0: so is one holding only a table or a note, as in the
               PDF and HTML; and the attached items take the places chosen
               for them, with no step number (attachments.js). */
            const _plan = (typeof mbAttPlan === 'function') ? mbAttPlan('activity', activity)
                : (function () {
                    const it = (activity.steps || []).filter(s => (s.text && s.text.trim()) ||
                        [].concat((activity.images && activity.images[s.stepId]) || []).length);
                    return { items: it, slots: it.map(() => []).concat([[]]) };
                })();
            const validSteps = _plan.items;
            const _anyAtt = _plan.slots.some(l => l.length);
            if (validSteps.length > 0 || _anyAtt) {
                if (validSteps.length > 0) ch.push(new Paragraph({ children: [new TextRun({ text: _mbT('expActivitySteps'), bold: true, size: _wsBody(), color: _wsHeadColor(), rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { after: 200 } }));
                validSteps.forEach((step, si) => {
                    (_plan.slots[si] || []).forEach(a => _pushAttachment(a, ch));
                    ch.push(new Paragraph({ children: [new TextRun({ text: _mbTf('expStepN', { v0: si + 1 }), bold: true, size: _wsBody(), color: _wsHeadColor(), rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { after: 100 } }));
                    const pt = processTextForWordExport(step.text || '');
                    let sImgs = (activity.images && activity.images[step.stepId]) || [];
                    if (!Array.isArray(sImgs)) sImgs = [sImgs];
                    /* 3.71.0: a step with no picture is ONE cell across the
                       table's width — no empty picture cell — with one empty
                       line under its text. */
                    const sr1 = sImgs.length ? [new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: pt, size: _wsBody(), rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl() })], width: { size: 4536, type: WidthType.DXA }, margins: { top: 150, bottom: 150, left: 150, right: 150 }, verticalAlign: 'center' })]
                        : [new TableCell({ children: String(pt).split('\n').filter((l, i, a) => l.trim() || a.length === 1)
                                .map(l => new Paragraph({ children: [new TextRun({ text: l, size: _wsBody(), rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { after: 60 } }))
                                .concat([new Paragraph({ children: [new TextRun({ text: '', size: _wsBody() })] })]),
                            width: { size: 9072, type: WidthType.DXA }, margins: { top: 150, bottom: 150, left: 150, right: 150 } })];
                    if (sImgs.length > 0) { try { sr1.push(new TableCell({ children: _imgCellCh(sImgs[0], (step.__imgCaps || [])[0]), width: { size: 4536, type: WidthType.DXA }, margins: { top: 150, bottom: 150, left: 150, right: 150 }, verticalAlign: 'center' })); } catch(e) { sr1.push(new TableCell({ children: [new Paragraph({ text: '' })], width: { size: 4536, type: WidthType.DXA } })); } }
                    const sRows = [new TableRow({ children: sr1 })];
                    for (let ii=1;ii<sImgs.length;ii++){try{sRows.push(new TableRow({children:[new TableCell({children:[new Paragraph({text:''})],width:{size:4536,type:WidthType.DXA}}),new TableCell({children:_imgCellCh(sImgs[ii], (step.__imgCaps || [])[ii]),width:{size:4536,type:WidthType.DXA},margins:{top:100,bottom:100,left:150,right:150}})]}))}catch(e){}}
                    const bdr2 = { top:{style:BorderStyle.SINGLE,size:1,color:'000000'}, bottom:{style:BorderStyle.SINGLE,size:1,color:'000000'}, left:{style:BorderStyle.SINGLE,size:1,color:'000000'}, right:{style:BorderStyle.SINGLE,size:1,color:'000000'}, insideHorizontal:{style:BorderStyle.SINGLE,size:1,color:'000000'}, insideVertical:{style:BorderStyle.SINGLE,size:1,color:'000000'} };
                    /* A step of a table or a note only has no text box to print. */
                    if ((step.text && step.text.trim()) || sImgs.length) {
                        ch.push(new Table(Object.assign({ rows: sRows, width: { size: 9072, type: WidthType.DXA }, borders: bdr2 },
                            sImgs.length ? {} : { columnWidths: [9072], layout: 'fixed' })));
                        ch.push(new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 200 } }));
                    }
                    if (step.marks) { step.marks.forEach(m => { if (m.text && m.text.trim()) { const mt = _mbDocxMarkType(m.key); if (mt) { ch.push(buildMarkDocxTable(mt, m.text)); } } }); }
                    /* Steps can carry tables now, the same as content
                       cards, and through the same builder. */
                    if (step.tables && step.tables.length) {
                        step.tables.forEach(t => _pushUserTable(t, ch));
                    }
                });
                (_plan.slots[validSteps.length] || []).forEach(a => _pushAttachment(a, ch));
            }

            // ── Performance Criteria — as separate section (new page) ──
            const validCriteria = (activity.criteria || []).filter(c => c && c.trim());
            /* 3.42.0: «within the required time», after the author's rows
               (sheet_kinds.js). Never on its own: an empty checklist stays
               absent. */
            if (validCriteria.length && typeof mbTimeCriterion === 'function') {
                const timeRow = mbTimeCriterion(activity.duration, _mbLang());
                if (timeRow) validCriteria.push(timeRow);
            }
            if (!_lgDoc && validCriteria.length > 0) {
                /* The user's own wording wins; our own boilerplate — even
                   when an older build stored it as a value — is re-emitted
                   in the EXPORT language. `|| _mbT(...)` alone only helped
                   projects whose fields were genuinely empty, which is why
                   this table kept coming out English in Arabic exports of
                   existing modules. See _mbBoilerplate in docx_bidi.js. */
                const ctTitle  = _mbBoilerplate(activity.criteriaTitle, 'expCriteriaCheckList', { v0: num });
                const ctInstr  = _mbBoilerplate(activity.criteriaInstruction, 'expCriteriaInstructionDefault');
                /* 3.51.0: with the rating scale, levels instead of Yes / No,
                   and the passing standard as the footer (the default
                   footer speaks of «yes»). */
                const _scLv = (activity.useScale && typeof mbScaleLevels === 'function') ? mbScaleLevels(_mbLang()) : null;
                const ctFooter = _scLv ? mbScalePass(_mbLang()) : _mbBoilerplate(activity.criteriaFooter, 'expCriteriaFooterDefault');
                const _ctSpan = _scLv ? 2 + _scLv.length : 4;
                const ctBdr = { top:{style:BorderStyle.SINGLE,size:1,color:'000000'}, bottom:{style:BorderStyle.SINGLE,size:1,color:'000000'}, left:{style:BorderStyle.SINGLE,size:1,color:'000000'}, right:{style:BorderStyle.SINGLE,size:1,color:'000000'}, insideHorizontal:{style:BorderStyle.SINGLE,size:1,color:'000000'}, insideVertical:{style:BorderStyle.SINGLE,size:1,color:'000000'} };
                const cellMgn = { top: 120, bottom: 120, left: 150, right: 150 };
                const ctRows = [];
                // Title row
                ctRows.push(new TableRow({ children: [new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: ctTitle, bold: true, size: _wsTable(), color: '1F4788', rightToLeft: _mbRtl() })], alignment: AlignmentType.CENTER, bidirectional: _mbRtl() })], columnSpan: _ctSpan, margins: cellMgn })] }));
                // Instruction row
                if (ctInstr.trim()) ctRows.push(new TableRow({ children: [new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: ctInstr, bold: true, size: _wsBody(), rightToLeft: _mbRtl() })], alignment: AlignmentType.CENTER, bidirectional: _mbRtl() })], columnSpan: _ctSpan, margins: cellMgn })] }));
                // Header row
                const mkH = (t, w) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: t, bold: true, size: _wsTable(), color: _wsHeadColor(), rightToLeft: _mbRtl() })], alignment: AlignmentType.CENTER, bidirectional: _mbRtl() })], width: { size: w, type: WidthType.PERCENTAGE }, margins: cellMgn });
                if (_scLv) {
                    const lw = Math.max(8, Math.floor(42 / _scLv.length));
                    ctRows.push(new TableRow({ children: [mkH('#',8), mkH(_mbT('expDidYou'), 92 - lw * _scLv.length)].concat(_scLv.map(l => mkH(l, lw))) }));
                } else ctRows.push(new TableRow({ children: [mkH('#',8), mkH(_mbT('expDidYou'),62), mkH(_mbT('expYes'),15), mkH(_mbT('expNo'),15)] }));
                // Criteria rows
                validCriteria.forEach((c, i) => {
                    const mkD = (t, align) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: t, size: _wsChecklist(), rightToLeft: _mbRtl() })], alignment: align, bidirectional: _mbRtl() })], margins: cellMgn });
                    const _blank = (_scLv ? _scLv : [0, 0]).map(() => mkD(' ', AlignmentType.CENTER));
                    ctRows.push(new TableRow({ children: [mkD(String(i+1), AlignmentType.CENTER), mkD(c, _mbStart(AlignmentType))].concat(_blank) }));
                });
                // Footer row
                if (ctFooter.trim()) ctRows.push(new TableRow({ children: [new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: ctFooter, size: _wsBody(), bold: !!_scLv, rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl() })], columnSpan: _ctSpan, margins: cellMgn })] }));
                const ctTable = new Table({ rows: ctRows, width: { size: 9072, type: WidthType.DXA }, borders: ctBdr });
                // Store as separate section (new page — same as self-check)
                ch.__criteriaSection = [ctTable];
            }

            {
                /* 3.70.0: every link of the sheet, one row each, in order —
                   and each sheet's OWN QR code (activity.qrImage; it used to
                   print the open sheet's code on every sheet). */
                const links = (typeof mbSheetLinks === 'function')
                    ? mbSheetLinks(activity, activity.qrImage !== undefined ? activity.qrImage : mbState.activityQRImage)
                    : [{ subject: activity.linkSubject, url: activity.linkUrl, image: mbState.activityQRImage }];
                const tables = links.map(l => buildQrTable(l.subject, l.url, l.image)).filter(Boolean);
                tables.forEach((qrT, i) => {
                    ch.push(new Paragraph({ children: [new TextRun({ text: '', size: _wsBody() })], spacing: i ? { after: 120 } : { before: 300, after: 200 } }));
                    ch.push(qrT);
                });
                if (tables.length) ch.push(new Paragraph({ children: [new TextRun({ text: '', size: _wsBody() })], spacing: { after: 200 } }));
            }

            return ch;
        };

        // Loop ALL LOs in order: LO heading → all info sheets → all activity sheets
        let _lgUnits = 0;   // 3.59.0: the number of the last learning unit printed
        let _seeRefs = null;
        if (typeof mbContentMapRefs === 'function') { try { _seeRefs = mbContentMapRefs(_mbCurrentModule()); } catch (e) { _seeRefs = null; } }
        mbState.learningOutcomesData.forEach((lo, loIndex) => {
            /* An outcome with no sheets gets no heading page.
               The loops below skip an untitled info or activity sheet,
               so an outcome that has none — or only untitled ones —
               produced a page carrying its name and nothing else. In a
               four-outcome module where the author had filled in one,
               that was three orphan pages, and they read as sections the
               export had failed to finish rather than as sections that
               were never started. Same rule as the assessment forms and
               the cover rows: presence is not content. */
            const loHasSheets =
                (lo.infoSheets     || []).some(sh => (sh.title || '').trim()) ||
                (lo.activitySheets || []).some(sh => (sh.title || '').trim()) ||
                (_lgDoc && (mbLgIntroFilled(lo) || mbLgReflectionFilled(lo)));   // 3.59.0
            /* 3.31.0: items of this outcome written in another one ("see
               also", content map). An outcome whose items all live in
               other outcomes' sheets still gets its page, with those lines. */
            let seeAlso = [];
            if (_seeRefs) { try { seeAlso = mbSeeAlsoFor(lo.id, _exportLang, mbState.learningOutcomesData, _seeRefs); } catch (e) { seeAlso = []; } }
            if (!loHasSheets && !seeAlso.length) return;

            const loHdTitle = mbLoPlainTitle(lo.title || '');
            const loHdText = _lgDoc ? mbLgUnitHeading(loIndex + 1, loHdTitle, _mbLang())   // 3.59.0; 3.67.0 named in Settings
                : _mbTitledAlready(loHdTitle, 'expLearningOutcomeN')
                ? loHdTitle
                : _mbTf('expLearningOutcomeN', { v0: loIndex + 1, v1: loHdTitle });
            if (_lgDoc) _lgUnits = Math.max(_lgUnits, loIndex + 1);
            const loHdCh = [new Paragraph({ children: [new TextRun({ text: loHdText, size: _wsSection(), bold: true, color: _wsHeadColor(), rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { after: 400, before: 200 } })];
            if (seeAlso.length) {
                loHdCh.push(new Paragraph({ children: [new TextRun({ text: mbSeeAlsoLabel('head', _exportLang), size: _wsBody(), bold: true, rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { before: 120, after: 120 } }));
                seeAlso.forEach(x => {
                    loHdCh.push(new Paragraph({ children: [new TextRun({ text: '• ' + x.line, size: _wsBody(), rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { after: 80 } }));
                });
            }
            /* 3.59.0: the learning unit's introduction, on its page. */
            if (_lgDoc && mbLgIntroFilled(lo)) {
                const n = mbSeqLgNumber(lo, loIndex, 'lgIntro');
                loHdCh.push(_lgHead(_mbTf('lgIntroHead', { v0: n }).trim()));
                _lgTextCh(lo.lgIntro && lo.lgIntro.body, loHdCh);
                const items = String((lo.lgIntro && lo.lgIntro.items) || '').split('\n').map(l => l.replace(/^\s*(?:[-•*]|\d+[.)-])\s*/, '').trim()).filter(Boolean);
                if (items.length) {
                    loHdCh.push(_lgPara(_mbT('lgYouWillLearn'), { bold: true, before: 120 }));
                    items.forEach((it, i) => loHdCh.push(_lgPara((i + 1) + '. ' + it, { after: 100 })));
                }
                /* 3.79.0: «Each learning unit includes the following:» — its paragraphs and the author's lines. */
                const inc = (typeof mbLgIncludesParts === 'function') ? mbLgIncludesParts(lo, _mbLang()) : null;
                if (inc) {
                    loHdCh.push(_lgPara(inc.title, { bold: true, before: 200 }));
                    inc.rows.forEach(r => loHdCh.push(new Paragraph({
                        children: [new TextRun({ text: r.label + ' ', size: _wsBody(), bold: true, rightToLeft: _mbRtl() }),
                                   new TextRun({ text: r.text, size: _wsBody(), rightToLeft: _mbRtl() })],
                        alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { after: 100 }
                    })));
                    inc.extra.forEach(line => loHdCh.push(_lgPara(line, { after: 100 })));
                }
            }
            /* 3.43.0: sections placed at the start of the outcome, on its page. */
            if (typeof mbLoSequence === 'function') {
                mbLoSequence(lo).forEach(it => {
                    if (it.kind !== 'block' || it.place !== 'before' || !mbBlocksFilled([it.block]).length) return;
                    const n = (typeof mbSeqBlockNumber === 'function') ? mbSeqBlockNumber(lo, loIndex, it.block) : '';
                    const head = ((n ? n + ' ' : '') + (it.block.title || '')).trim();
                    if (head) loHdCh.push(new Paragraph({ children: [new TextRun({ text: head, size: _wsBody(), bold: true, color: _wsHeadColor(), rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { after: 300, before: 300 } }));
                    (it.block.body || '').split('\n').forEach(line => {
                        if (!line.trim()) return;
                        loHdCh.push(new Paragraph({ children: [new TextRun({ text: line, size: _wsBody(), rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { after: 150 } }));
                    });
                    (it.block.tables || []).forEach(t => _pushUserTable(t, loHdCh));
                });
            }
            sections.push({ properties: { bidi: _mbRtl() }, children: loHdCh });

            if (!_lgDoc && mbState.includeLearningGuide) {
                if (typeof mbBuildLearningGuideModel !== 'function') {
                    console.warn('Learning Guide is enabled but src/learning_guide.js is not loaded — no guide will be exported.');
                    if (typeof showStatus === 'function') showStatus('learning_guide.js not loaded — Learning Guide skipped', 'error');
                } else {
                    const lgCh = _buildLearningGuideDocx(mbBuildLearningGuideModel(lo, loIndex, _mbLang()));
                    if (lgCh) sections.push({ properties: { bidi: _mbRtl() }, children: lgCh });
                }
            }

            /* 3.43.0: the outcome in document order (lo_sequence.js). With
               the default settings this is every information sheet, then
               every activity sheet — the order this export always had. */
            const _seqItems = (typeof mbLoSequence === 'function') ? mbLoSequence(lo)
                : (lo.infoSheets || []).map((x, i) => ({ kind: 'info', index: i }))
                    .concat((lo.activitySheets || []).map((x, i) => ({ kind: 'activity', index: i })));
            const _blockCh = (block) => {
                const ch = [];
                const n = (typeof mbSeqBlockNumber === 'function') ? mbSeqBlockNumber(lo, loIndex, block) : '';
                const head = ((n ? n + ' ' : '') + (block.title || '')).trim();
                if (head) ch.push(new Paragraph({ children: [new TextRun({ text: head, size: _wsBody(), bold: true, color: _wsHeadColor(), rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { after: 300, before: 200 } }));
                (block.body || '').split('\n').forEach(line => {
                    if (!line.trim()) return;
                    ch.push(new Paragraph({ children: [new TextRun({ text: line, size: _wsBody(), rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { after: 150 } }));
                });
                (block.tables || []).forEach(t => _pushUserTable(t, ch));
                return ch;
            };
            const _infoOut = (si) => {
                const info = (lo.infoSheets || [])[si];
                if (!info || !info.title || !info.title.trim()) return;
                const ch = buildInfoCh(info, loIndex, si);
                if (ch.length > 0) sections.push({ properties: { bidi: _mbRtl() }, children: ch });
                // Self-check AFTER info sheet
                if (ch.__selfCheckSection) sections.push({ properties: { bidi: _mbRtl() }, children: ch.__selfCheckSection });
                // Answers-Key AFTER self-check
                if (ch.__answersKeySection) sections.push({ properties: { bidi: _mbRtl() }, children: ch.__answersKeySection });
            };
            const _actOut = (si) => {
                const activity = (lo.activitySheets || [])[si];
                if (!activity || !activity.title || !activity.title.trim()) return;
                const ch = buildActCh(activity, loIndex, si);
                if (ch.length > 0) sections.push({ properties: { bidi: _mbRtl() }, children: ch });
                // Criteria as separate page AFTER activity sheet
                if (ch.__criteriaSection) sections.push({ properties: { bidi: _mbRtl() }, children: ch.__criteriaSection });
            };
            /* 3.59.0: the reflection that closes a learning unit — its
               questions, each followed by lines to write on. */
            const _reflOut = () => {
                if (!_lgDoc || !mbLgReflectionFilled(lo)) return;
                const ch = [];
                const n = mbSeqLgNumber(lo, loIndex, 'lgReflection');
                ch.push(_lgHead(((n ? n + ' ' : '') + mbLgReflectionTitle(lo, loIndex, _mbLang())).trim()));
                /* 3.75.0: every group of questions on this one page — an
                   added group under its own subheading, when it has one. */
                mbLgReflectionGroups(lo, _mbLang()).forEach(gr => {
                    if (gr.title) ch.push(_lgPara(gr.title, { bold: true, color: _wsHeadColor(), before: 300, after: 120 }));
                    gr.questions.forEach(q => {
                        ch.push(_lgPara(q, { bold: true, before: 200, after: 120 }));
                        for (let k = 0; k < gr.lines; k++) ch.push(_lgPara('.'.repeat(110), { color: '808080', after: 160 }));
                    });
                });
                sections.push({ properties: { bidi: _mbRtl() }, children: ch });
            };
            _seqItems.forEach(it => {
                if (it.kind === 'info') _infoOut(it.index);
                else if (it.kind === 'activity') _actOut(it.index);
                else if (it.kind === 'lgReflection') _reflOut();
                else if (it.kind === 'lgIntro') { /* on the unit's page, above */ }
                else if (it.place === 'after' && mbBlocksFilled([it.block]).length) {
                    sections.push({ properties: { bidi: _mbRtl() }, children: _blockCh(it.block) });
                }
            });
        });

        function _pushGlossary() {
            if (!(typeof mbGlossaryHasContent === 'function' && mbGlossaryHasContent(mbState.glossary))) return;
            const glCh = [];
            glCh.push(new Paragraph({
                children: [new TextRun({
                    text: (mbState.glossary.title || _mbT('expGlossary')),
                    size: _wsSection(), bold: true, color: _wsHeadColor(), rightToLeft: _mbRtl()
                })],
                alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(),
                spacing: { after: 400 }
            }));
            (mbState.glossary.tables || []).forEach(t => _pushUserTable(t, glCh));
            sections.push({ properties: { bidi: _mbRtl() }, children: glCh });
        }
        if (_lgDoc) _pushGlossary();   // 3.59.0

        /* 3.59.0: the Learner guide's assessment unit —
             N- Assessment unit
             N-1 Introduction, N-2 Portfolio of evidence (the tool's text
                 or the author's, learner_guide.js), any assessment content
             N-3 Contents of the portfolio (derived from the sheets)
             N-4 Assessment tables: one per outcome, from its form.
           N follows the last learning unit printed. */
        function _lgAssessmentUnit() {
            const { Table, TableRow, TableCell, WidthType, BorderStyle } = mbDocxLib();
            const L = _mbLang();
            const rows = mbLgPortfolioRows(mbState.learningOutcomesData, L);
            const _filled = (typeof mbAssessmentFormFilled === 'function') ? mbAssessmentFormFilled : (f => !!f);
            const formLos = mbState.learningOutcomesData.filter(lo => _filled(mbState.assessmentFormsData[lo.id]));
            const intro = mbLgAsmText('intro', L, mbState);
            const portfolio = mbLgAsmText('portfolio', L, mbState);
            const asmText = String(mbState.assessmentContent || '');
            const asmBlk = (typeof mbBlocksFilled === 'function') ? mbBlocksFilled(mbState.assessmentBlocks) : [];
            if (!rows.length && !formLos.length && !asmText.trim() && !asmBlk.length) return;

            const N = (_lgUnits || mbState.learningOutcomesData.length) + 1;
            const bd = { style: BorderStyle.SINGLE, size: 1, color: '000000' };
            const borders = { top: bd, bottom: bd, left: bd, right: bd, insideHorizontal: bd, insideVertical: bd };
            const cell = (t, o) => new TableCell({
                children: String(t || '').split('\n').map(line => new Paragraph({
                    children: [new TextRun({ text: line, bold: !!(o && o.bold), size: _wsTable(), color: (o && o.head) ? _wsTblText() : undefined, rightToLeft: _mbRtl() })],
                    alignment: (o && o.center) ? AlignmentType.CENTER : _mbStart(AlignmentType), bidirectional: _mbRtl()
                })),
                shading: (o && o.head) ? { fill: _wsTblFill(), type: 'clear' } : undefined,
                width: (o && o.w) ? { size: o.w, type: WidthType.PERCENTAGE } : undefined,
                margins: { top: 100, bottom: 100, left: 100, right: 100 }
            });

            const ch = [];
            ch.push(_lgHead(_mbTf('lgAsmUnitHead', { v0: N }), true));
            if (intro.trim()) { ch.push(_lgHead(_mbTf('lgAsmIntroHead', { v0: N }))); _lgTextCh(intro, ch); }
            if (portfolio.trim()) { ch.push(_lgHead(_mbTf('lgAsmPortfolioHead', { v0: N }))); _lgTextCh(portfolio, ch); }
            if (asmText.trim()) _lgTextCh(asmText, ch);
            asmBlk.forEach(block => {
                const bt = (block.title || '').trim();
                if (bt) ch.push(_lgPara(bt, { bold: true, color: _wsHeadColor(), before: 240 }));
                _lgTextCh(block.body, ch);
                (block.tables || []).forEach(t => _pushUserTable(t, ch));
            });
            if (rows.length) {
                ch.push(_lgHead(_mbTf('lgAsmContentsHead', { v0: N })));
                const tr = [new TableRow({ tableHeader: true, children: [
                    cell(_mbT('lgColActivity'), { bold: true, head: true, center: true, w: 50 }),
                    cell(_mbT('lgColProduct'), { bold: true, head: true, center: true, w: 30 }),
                    cell(_mbT('lgColContributes'), { bold: true, head: true, center: true, w: 20 })] })];
                rows.forEach(r => tr.push(new TableRow({ children: [
                    cell(r.label), cell(r.product), cell(_mbT(r.contributes ? 'lgpYes' : 'lgpNo'), { center: true })] })));
                ch.push(new Table({ rows: tr, width: { size: 9072, type: WidthType.DXA }, borders }));
            }
            sections.push({ properties: { bidi: _mbRtl() }, children: ch });

            if (!formLos.length) return;
            const m = (mbState.modulesData || []).find(x => x.id === mbState.currentModuleId) || {};
            const code = String(m.moduleCode || m.moduleNumber || '').trim();
            const fc = [];
            fc.push(_lgHead(_mbTf('lgAsmTablesHead', { v0: N, v1: code }).trim()));
            fc.push(_lgPara(_mbT('lgAsmTablesLead'), { after: 300 }));
            formLos.forEach((lo, k) => {
                const idx = mbState.learningOutcomesData.indexOf(lo);
                const f = mbState.assessmentFormsData[lo.id];
                fc.push(_lgPara(_mbTf('lgAsmOutcomeHead', { v0: idx + 1, v1: mbLoPlainTitle(lo.title || '') }),
                                { bold: true, color: _wsHeadColor(), before: k ? 400 : 120, after: 200 }));
                const tr = [new TableRow({ tableHeader: true, children: [
                    cell(_mbT('lgColCriteria'), { bold: true, head: true, center: true, w: 34 }),
                    cell(_mbT('lgColActNum'), { bold: true, head: true, center: true, w: 30 }),
                    cell(_mbT('lgColOutput'), { bold: true, head: true, center: true, w: 18 }),
                    cell(_mbT('lgColDate'), { bold: true, head: true, center: true, w: 18 })] })];
                (f.rows || []).filter(r => r && ((r.criteria || '').trim() || (r.activities || '').trim() || (r.outcomes || '').trim() || (r.date || '').trim()))
                    .forEach(r => tr.push(new TableRow({ children: [cell(r.criteria), cell(r.activities), cell(r.outcomes), cell(r.date)] })));
                fc.push(new Table({ rows: tr, width: { size: 9072, type: WidthType.DXA }, borders }));
                const res = (typeof mbAsmResultLabels === 'function') ? mbAsmResultLabels(L) : [_mbT('expCompetent'), _mbT('expNotYetCompetent')];
                fc.push(_lgPara(_mbT('expResult'), { bold: true, before: 240, after: 120 }));
                res.forEach(lab => fc.push(_lgPara('☐ ' + lab, { after: 100 })));
                fc.push(_lgPara(_mbTf('expSignatureLine', { v0: _mbT('expTrainerName'), v1: f.teacherName || '_______________________',
                    v2: f.teacherSignature || '_______________________', v3: f.teacherDate || '_______________________' }), { before: 240, after: 200 }));
                fc.push(_lgPara(_mbTf('expSignatureLine', { v0: _mbT('expLearnerName'), v1: f.learnerName || '_______________________',
                    v2: f.learnerSignature || '_______________________', v3: f.learnerDate || '_______________________' }), { after: 200 }));
            });
            sections.push({ properties: { bidi: _mbRtl() }, children: fc });
        }

        // Assessment Unit Section (Simple)
        console.log('Preparing Assessment Unit section...');
        const assessmentSimpleContent = mbState.assessmentContent || '';
        /* 3.57.0: the more content added under the first (blocks.js). */
        const asmBlocks = (typeof mbBlocksFilled === 'function') ? mbBlocksFilled(mbState.assessmentBlocks) : [];
        const hasAssessmentContent = assessmentSimpleContent.trim() !== '' || asmBlocks.length > 0;
        /* mbAssessmentFormFilled, not `!!formsData[lo.id]`: opening the
           Assessment tab creates a blank form for EVERY outcome in the
           module, so presence proved only that the tab had been opened.
           A module with four outcomes and one real assessment exported
           four forms, three of them empty grids. See the function's own
           note in assessment.js for what counts as filled. */
        const _asmFilled = (typeof mbAssessmentFormFilled === 'function')
            ? mbAssessmentFormFilled
            : function (f) { return !!f; };
        const hasAssessmentForms = mbState.learningOutcomesData.some(lo => _asmFilled(mbState.assessmentFormsData[lo.id]));
        console.log('Assessment content:', hasAssessmentContent, 'Assessment forms:', hasAssessmentForms);
        
        if (_lgDoc) {
            _lgAssessmentUnit();
        } else if (hasAssessmentContent || hasAssessmentForms) {
            console.log('Creating assessment section...');
            const { Table, TableRow, TableCell, WidthType, BorderStyle } = mbDocxLib();
            const assessmentChildren = [];
            
            // No page break needed before assessment section - it's already a new section
            
            // Assessment Unit Title
            assessmentChildren.push(new Paragraph({
                children: [
                    new TextRun({
                        text: _mbT('expAssessmentUnitCaps'),
                        size: _wsSection(),
                        bold: true,
                        color: _wsHeadColor(),
                        rightToLeft: _mbRtl(),
                    }),
                ],
                alignment: AlignmentType.CENTER,
                bidirectional: _mbRtl(),
                spacing: { after: 400 },
            }));
            
            // Assessment Content (Simple textarea content)
            if (hasAssessmentContent) {
                const contentLines = assessmentSimpleContent.trim() ? assessmentSimpleContent.split('\n') : [];
                contentLines.forEach(line => {
                    assessmentChildren.push(new Paragraph({
                        children: [
                            new TextRun({
                                text: line,
                                size: _wsBody(),
                                rightToLeft: _mbRtl(),
                            }),
                        ],
                        alignment: _mbStart(AlignmentType),
                        bidirectional: _mbRtl(),
                        spacing: { after: 150 },
                    }));
                });
                /* 3.57.0: each further content — its title in the heading
                   style, its text, its tables. */
                asmBlocks.forEach(block => {
                    const bt = (block.title || '').trim();
                    if (bt) {
                        assessmentChildren.push(new Paragraph({
                            children: [new TextRun({ text: bt, bold: true, size: _wsBody(), color: _wsHeadColor(), rightToLeft: _mbRtl() })],
                            alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(),
                            spacing: { before: 240, after: 150 },
                        }));
                    }
                    (block.body || '').split('\n').forEach(line => {
                        if (!line.trim()) return;
                        assessmentChildren.push(new Paragraph({
                            children: [new TextRun({ text: line, size: _wsBody(), rightToLeft: _mbRtl() })],
                            alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(),
                            spacing: { after: 150 },
                        }));
                    });
                    (block.tables || []).forEach(t => _pushUserTable(t, assessmentChildren));
                });
            }
            
            // Add assessment content as first section if exists
            if (hasAssessmentContent) {
                sections.push({
                    properties: {
                        bidi: _mbRtl()
                    },
                    children: assessmentChildren,
                });
            }
            
            // Assessment Forms for Each Learning Outcome
            if (hasAssessmentForms) {
                mbState.learningOutcomesData.forEach((lo, loIndex) => {
                    // Skip LOs whose form was never filled in
                    if (!_asmFilled(mbState.assessmentFormsData[lo.id])) return;

                    console.log(`Creating assessment form for LO ${loIndex + 1}:`, lo.title);
                    const formChildren = [];
                    const formData = mbState.assessmentFormsData[lo.id];
                    
                    // Assessment Unit Header
                    formChildren.push(new Paragraph({
                        children: [
                            new TextRun({
                                text: _mbT('expAssessmentUnit'),
                                size: _wsSection(),
                                bold: true,
                                color: _wsHeadColor(),
                                rightToLeft: _mbRtl(),
                            }),
                        ],
                        alignment: _mbStart(AlignmentType),
                        bidirectional: _mbRtl(),
                        spacing: { after: 200, before: 200 },
                    }));
                    
                    // Learning Outcome Title - prevent duplication
                    const loTitle = mbLoPlainTitle(lo.title || '');
                    /* The duplication guard only knew the ENGLISH prefix, so
                       an Arabic title that already begins with «محصلة التعلم 1:»
                       was not recognised and got the prefix a second time.
                       _mbTitledAlready checks every locale we ship. */
                    const loTitleText = _mbTitledAlready(loTitle, 'expLearningOutcomeN')
                        ? loTitle 
                        : _mbTf('expLearningOutcomeN', { v0: loIndex + 1, v1: loTitle });
                    
                    formChildren.push(new Paragraph({
                        children: [
                            new TextRun({
                                text: loTitleText,
                                size: _wsSub(),
                                bold: true,
                                rightToLeft: _mbRtl(),
                            }),
                        ],
                        alignment: _mbStart(AlignmentType),
                        bidirectional: _mbRtl(),
                        spacing: { after: 300 },
                    }));
                    
                    // Portfolio of Evidence Table Heading
                    formChildren.push(new Paragraph({
                        children: [
                            new TextRun({
                                text: _mbT('expPortfolioOfEvidence'),
                                size: _wsBody(),
                                bold: true,
                                rightToLeft: _mbRtl(),
                            }),
                        ],
                        alignment: _mbStart(AlignmentType),
                        bidirectional: _mbRtl(),
                        spacing: { after: 200 },
                    }));
                    
                    // Portfolio of Evidence Table
                    const tableRows = [];
                    
                    // Header Row
                    /* A FOURTH literal shape the earlier sweeps never caught:
                       a bare array of strings, later .map()'d into cells.
                       Not `text: '...'`, not a positional function argument
                       — an array element. These five keys (expAssessmentCriteria
                       etc.) were already sitting in the dictionary, unused,
                       since the very first translation pass: they were added
                       to the dictionary but never wired to this table. */
                    const headerCells = [
                        _mbT('expAssessmentCriteria'),
                        _mbT('expNameNumberActivities'),
                        _mbT('expOutcomesMethod'),
                        _mbT('expEvidenceVerification'),
                        _mbT('expCompletionDateNotes')
                    ].map(headerText => new TableCell({
                        children: [new Paragraph({
                            children: [new TextRun({
                                text: headerText,
                                bold: true,
                                size: _wsBody(),
                                rightToLeft: _mbRtl(),
                            })],
                            alignment: AlignmentType.CENTER,
                            bidirectional: _mbRtl(),
                        })],
                        width: { size: 20, type: WidthType.PERCENTAGE },
                        margins: { top: 100, bottom: 100, left: 100, right: 100 },
                    }));
                    
                    tableRows.push(new TableRow({ children: headerCells, tableHeader: true }));
                    
                    // Data Rows from stored assessment forms data
                    if (formData.rows && formData.rows.length > 0) {
                        formData.rows.forEach(row => {
                            const dataCells = [
                                row.criteria || '',
                                row.activities || '',
                                row.outcomes || '',
                                row.verification || '',
                                row.date || ''
                            ].map(cellText => new TableCell({
                                children: [new Paragraph({
                                    children: [new TextRun({
                                        text: cellText,
                                        size: _wsBody(),
                                        rightToLeft: _mbRtl(),
                                    })],
                                    alignment: _mbStart(AlignmentType),
                                    bidirectional: _mbRtl(),
                                })],
                                margins: { top: 150, bottom: 150, left: 100, right: 100 },
                            }));
                            
                            tableRows.push(new TableRow({ children: dataCells }));
                        });
                    }
                    
                    const portfolioTable = new Table({
                        rows: tableRows,
                        width: { size: 9072, type: WidthType.DXA },
                        borders: {
                            top: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                            bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                            left: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                            right: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                            insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                            insideVertical: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                        },
                    });
                    
                    formChildren.push(portfolioTable);

                    /* 3.51.0: the trainer's rating of each criterion, and the
                       passing standard, when the form uses the scale. */
                    if (formData.useScale && typeof mbScaleLevels === 'function') {
                        const lv = mbScaleLevels(_mbLang());
                        const crit = (formData.rows || []).map(r => String(r.criteria || '').trim()).filter(Boolean);
                        if (crit.length) {
                            const bd = { style: BorderStyle.SINGLE, size: 1, color: '000000' };
                            const lw = Math.max(8, Math.floor(42 / lv.length));
                            const cell = (t, w, bold, center) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: t, bold: !!bold, size: _wsTable(), rightToLeft: _mbRtl() })], alignment: center ? AlignmentType.CENTER : _mbStart(AlignmentType), bidirectional: _mbRtl() })], width: w ? { size: w, type: WidthType.PERCENTAGE } : undefined, margins: { top: 100, bottom: 100, left: 100, right: 100 } });
                            const rr = [new TableRow({ tableHeader: true, children: [cell('#', 8, true, true), cell(_mbT('expAssessmentCriteria'), 92 - lw * lv.length, true, false)].concat(lv.map(l => cell(l, lw, true, true))) })];
                            crit.forEach((c, i) => rr.push(new TableRow({ children: [cell(String(i + 1), 0, false, true), cell(c, 0, false, false)].concat(lv.map(() => cell(' ', 0, false, true))) })));
                            formChildren.push(new Paragraph({ children: [new TextRun({ text: _scT('rating', null, _mbLang()), bold: true, size: _wsBody(), rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { before: 300, after: 150 } }));
                            formChildren.push(new Table({ rows: rr, width: { size: 9072, type: WidthType.DXA }, borders: { top: bd, bottom: bd, left: bd, right: bd, insideHorizontal: bd, insideVertical: bd } }));
                        }
                        formChildren.push(new Paragraph({ children: [new TextRun({ text: mbScalePass(_mbLang()), bold: true, size: _wsBody(), rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { before: 200 } }));
                    }
                    
                    // Result Section
                    formChildren.push(new Paragraph({
                        children: [new TextRun({ text: '', size: _wsBody() })],
                        spacing: { after: 300 },
                    }));
                    
                    formChildren.push(new Paragraph({
                        children: [
                            new TextRun({
                                text: _mbT('expResult'),
                                bold: true,
                                size: _wsBody(),
                                rightToLeft: _mbRtl(),
                            }),
                        ],
                        alignment: _mbStart(AlignmentType),
                        bidirectional: _mbRtl(),
                        spacing: { after: 200 },
                    }));
                    
                    // Result options - always empty boxes for paper printout (3.50.0: the project's options)
                    const _resLabels = (typeof mbAsmResultLabels === 'function')
                        ? mbAsmResultLabels(_mbLang()) : [_mbT('expCompetent'), _mbT('expNotYetCompetent')];
                    _resLabels.forEach((lab, ri) => {
                        formChildren.push(new Paragraph({
                            children: [
                                new TextRun({
                                    text: '☐ ' + lab,
                                    size: _wsBody(),
                                    rightToLeft: _mbRtl(),
                                }),
                            ],
                            alignment: _mbStart(AlignmentType),
                            bidirectional: _mbRtl(),
                            spacing: { after: ri === _resLabels.length - 1 ? 400 : 150 },
                        }));
                    });
                    
                    // Signature Section with stored data
                    const teacherLine = _mbTf('expSignatureLine', {
                        v0: _mbT('expTrainerName'),
                        v1: formData.teacherName      || '_______________________',
                        v2: formData.teacherSignature || '_______________________',
                        v3: formData.teacherDate      || '_______________________' });
                    const learnerLine = _mbTf('expSignatureLine', {
                        v0: _mbT('expLearnerName'),
                        v1: formData.learnerName      || '_______________________',
                        v2: formData.learnerSignature || '_______________________',
                        v3: formData.learnerDate      || '_______________________' });
                    
                    formChildren.push(new Paragraph({
                        children: [
                            new TextRun({
                                text: teacherLine,
                                size: _wsBody(),
                                rightToLeft: _mbRtl(),
                            }),
                        ],
                        alignment: _mbStart(AlignmentType),
                        bidirectional: _mbRtl(),
                        spacing: { after: 300 },
                    }));
                    
                    formChildren.push(new Paragraph({
                        children: [
                            new TextRun({
                                text: learnerLine,
                                size: _wsBody(),
                                rightToLeft: _mbRtl(),
                            }),
                        ],
                        alignment: _mbStart(AlignmentType),
                        bidirectional: _mbRtl(),
                        spacing: { after: 300 },
                    }));
                    
                    sections.push({
                        properties: {
                            bidi: _mbRtl()
                        },
                        children: formChildren,
                    });
                });
            }
        }


        // ── Glossary of Terms (3.42.0) — its own page, before the references ──
        /* 3.59.0: the Learner guide prints it after the last learning
           unit, before the assessment unit (see above). */
        if (!_lgDoc) _pushGlossary();

        // ── References page ──────────────────────────────────────────
        syncReferencesFromDOM();
        const hasRefs = mbState.referencesData.some(r => r.value.trim());
        if (hasRefs) {
            const refChildren = [];

            // Section heading
            refChildren.push(new Paragraph({
                children: [
                    new TextRun({
                        text: mbState.referencesTitle,
                        size: _wsSection(),
                        bold: true,
                        color: _wsHeadColor(),
                        rightToLeft: _mbRtl(),
                    }),
                ],
                alignment: _mbStart(AlignmentType),
                bidirectional: _mbRtl(),
                spacing: { after: 400 },
            }));

            // Each reference entry
            mbState.referencesData.forEach((ref, idx) => {
                if (!ref.value.trim()) return;
                refChildren.push(new Paragraph({
                    children: [
                        new TextRun({
                            text: `${idx + 1}. ${ref.value}`,
                            size: _wsBody(),
                            rightToLeft: _mbRtl(),
                        }),
                    ],
                    alignment: _mbStart(AlignmentType),
                    bidirectional: _mbRtl(),
                    spacing: { after: 200 },
                }));
            });

            sections.push({
                properties: { bidi: _mbRtl() },
                children: refChildren,
            });
        }

        // ── Back Cover page (full A4, image only) ────────────────────
        if (mbState.backCoverImage) {
            await _exportCoverPage(mbState.backCoverImage, sections, mbDocxLib(), AlignmentType);
        }

        // Create document
        console.log('Creating document with ' + sections.length + ' sections...');
        const doc = new Document({
            /* No font is specified anywhere in this export, so Word uses
               its own default — which on a non-Arabic system may not
               carry Arabic glyphs and silently falls back, producing
               boxes. Arial is not the prettiest face but it ships
               everywhere with full Arabic coverage. */
            styles: {
                default: {
                    document: { run: { font: _mbFont() } }
                }
            },
            sections: sections,
        });
        /* Document-level <w:lang>, for anything the wrappers did not
           build and for text the user types into the file afterwards. */
        _mbApplyDocDefaultsLang(doc);
        console.log('Document created successfully');

        // Generate and download
        console.log('Generating blob...');
        const blob = await Packer.toBlob(doc);
        console.log('Blob generated, size: ' + blob.size);
        if (_sink) {
            await _sink.take(blob, getExportFilename('docx'));
            setExportButtonState(false);
            hideExportInfo();
            if (_imgFailed) showStatus(window.i18n.tf('dgImagesNotExported', { v0: _imgFailed }), 'error');
            return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const filename = getExportFilename('docx');
        link.download = filename;
        console.log('Downloading file: ' + filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        // Re-enable export button
        setExportButtonState(false);
        
        // Hide export info
        hideExportInfo();
        
        // Show success message with document details
        const fileSizeMB = (blob.size / (1024 * 1024)).toFixed(2);
        /* The language the document was actually written in, named in the
           success message. The export language is a THIRD switch, stored
           separately from the interface and content ones, and it is
           perfectly possible — and was in practice common — to set the
           whole tool to one language and leave this one on a value chosen
           weeks earlier. Nothing on screen said so, and the mismatch was
           only discovered after opening the file in Word. Naming it here
           costs a few words and closes that gap for good. */
        const docLangLabel = (typeof _mbLang === 'function' && typeof biLangLabel === 'function')
            ? biLangLabel(_mbLang()) : '';
        showStatus(window.i18n.tf('dgDocumentExportedSuccessfullyFileMb', { v0: filename, v1: fileSizeMB }) +
                   (docLangLabel ? '  ·  ' + docLangLabel : ''), 'success');
        /* After the success line, not instead of it: the file is made
           and usable, but the author has to know a picture is missing. */
        if (_imgFailed) showStatus(window.i18n.tf('dgImagesNotExported', { v0: _imgFailed }), 'error');

    } catch (error) {
        console.error('Error:', error);
        
        // Re-enable export button
        setExportButtonState(false);
        
        // Hide export info
        hideExportInfo();
        
        if (_sink) _sink.fail(error);
        else showStatus(window.i18n.t('dgExportFailed') + error.message, 'error');

        /* Route to error handler with EXPORT context */
        if (window.onerror) window.onerror('[EXPORT] ' + error.message, 'exportToDocx', 0, 0, error);
    } finally {
        /* Release the pinned document language. Without this a failed
           Arabic export would leave 'ar' latched, and the next export —
           of a different, English module — would silently inherit it. */
        _mbEndExport();
    }
}
