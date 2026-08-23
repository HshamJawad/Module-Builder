// ============================================================
// /src/exports_docx.js
// DOCX generation
// Extracted verbatim from Module_Builder.html lines 5435-7018 (v2.0-legacy).
// ============================================================

async function exportToDocx() {

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
    if (window.mbState.currentLOId && typeof saveCurrentSheetToLO === 'function') saveCurrentSheetToLO();
    /* Resolve the document language BEFORE flattening, because the
       flatten side and the direction must be the same decision. An
       explicit export-switch choice is obeyed; otherwise the dominant
       script in the project decides, rather than contentLang() — which
       is about which side is being EDITED and says nothing about which
       script the author actually typed. */
    const _exportLang = _mbBeginExport(window.mbState);
    const mbState = biFlattenDeep(window.mbState, _exportLang);

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
    const hasIntroBlocks  = mbBlocksAnyFilled(mbState.introBlocks);
    const hasTvqf = (typeof mbTvqfHasContent === 'function') && mbTvqfHasContent(mbState);
    const hasIntroContent = hasWorkTeam || introAdditionalDetails.trim() || hasIntroBlocks || hasTvqf;
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

        // Title with sheet number - New format: Activity/Job Sheet 1-1 \ Title
        if (sheetNumber.trim() && title.trim()) {
            const titleText = _mbTf('expActivitySheetTitled', { v0: sheetNumber, v1: title });
            children.push(new Paragraph({
                children: [
                    new TextRun({
                        text: titleText,
                        size: 24,
                        bold: true,
                        color: '0070C0', // Blue color
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
                        size: 24,
                        bold: true,
                        color: '0070C0', // Blue color
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
                        size: 24,
                        color: '0070C0', // Blue color
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
                                size: 24,
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
                children: [new TextRun({ text: '', size: 24 })],
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
                        size: 24,
                        color: '0070C0', // Blue color
                        rightToLeft: _mbRtl(),
                    }),
                    new TextRun({
                        text: _mbTf('expMinutes', { v0: duration }),
                        size: 24,
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
                            children: [new Paragraph({ children: [new TextRun({ text: _mbT('expMaterialEquipment'), bold: true, size: 28, color: 'FFFFFF', rightToLeft: _mbRtl() })], alignment: AlignmentType.CENTER, bidirectional: _mbRtl() })],
                            shading: { fill: '0070C0', type: 'clear' },
                            width: { size: 37, type: WidthType.PERCENTAGE },
                        }),
                        new TableCell({
                            children: [new Paragraph({ children: [new TextRun({ text: _mbT('expQuantityNumber'), bold: true, size: 28, color: 'FFFFFF', rightToLeft: _mbRtl() })], alignment: AlignmentType.CENTER, bidirectional: _mbRtl() })],
                            shading: { fill: '0070C0', type: 'clear' },
                            width: { size: 13, type: WidthType.PERCENTAGE },
                        }),
                        new TableCell({
                            children: [new Paragraph({ children: [new TextRun({ text: _mbT('expMaterialEquipment'), bold: true, size: 28, color: 'FFFFFF', rightToLeft: _mbRtl() })], alignment: AlignmentType.CENTER, bidirectional: _mbRtl() })],
                            shading: { fill: '0070C0', type: 'clear' },
                            width: { size: 37, type: WidthType.PERCENTAGE },
                        }),
                        new TableCell({
                            children: [new Paragraph({ children: [new TextRun({ text: _mbT('expQuantityNumber'), bold: true, size: 28, color: 'FFFFFF', rightToLeft: _mbRtl() })], alignment: AlignmentType.CENTER, bidirectional: _mbRtl() })],
                            shading: { fill: '0070C0', type: 'clear' },
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
                                children: [new Paragraph({ children: [new TextRun({ text: leftItem.name, size: 28, rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl() })],
                                width: { size: 37, type: WidthType.PERCENTAGE },
                                margins: { top: 100, bottom: 100, left: 100, right: 100 },
                            }),
                            new TableCell({
                                children: [new Paragraph({ children: [new TextRun({ text: leftItem.quantity, size: 28, rightToLeft: _mbRtl() })], alignment: AlignmentType.CENTER, bidirectional: _mbRtl() })],
                                width: { size: 13, type: WidthType.PERCENTAGE },
                                margins: { top: 100, bottom: 100, left: 100, right: 100 },
                            }),
                            new TableCell({
                                children: [new Paragraph({ children: [new TextRun({ text: rightItem ? rightItem.name : '', size: 28, rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl() })],
                                width: { size: 37, type: WidthType.PERCENTAGE },
                                margins: { top: 100, bottom: 100, left: 100, right: 100 },
                            }),
                            new TableCell({
                                children: [new Paragraph({ children: [new TextRun({ text: rightItem ? rightItem.quantity : '', size: 28, rightToLeft: _mbRtl() })], alignment: AlignmentType.CENTER, bidirectional: _mbRtl() })],
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
                        size: 24,
                        color: '0070C0', // Blue color
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
                                size: 24,
                                color: '0070C0', // Blue color
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
                                size: 24,
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
                            const mt = MARK_TYPES.find(x => x.key === m.key);
                            if (mt) {
                                children.push(new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 80 } }));
                                children.push(buildMarkDocxTable(mt, m.text));
                            }
                        }
                    });

                    // Add spacing after each table
                    children.push(new Paragraph({
                        children: [new TextRun({ text: '', size: 24 })],
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
                                size: 24,
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
                                size: 24,
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
                children: [new TextRun({ text: '', size: 24 })],
                spacing: { before: 600, after: 300 },
            }));
            
            children.push(qrTable);
            children.push(new Paragraph({
                children: [new TextRun({ text: '', size: 24 })],
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
                                    size: 24,
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
                    children: [new TextRun({ text: '', size: 24 })],
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
                                size: 36, // 18pt
                                rightToLeft: _mbRtl(),
                            })],
                            alignment: _mbStart(AlignmentType),
                            bidirectional: _mbRtl(),
                        })],
                        width: { size: 35, type: WidthType.PERCENTAGE },
                        margins: { top: 150, bottom: 150, left: 150, right: 150 },
                    }));
                    
                    // Value cell
                    cells.push(new TableCell({
                        children: [new Paragraph({
                            children: [new TextRun({
                                text: row.value,
                                bold: true,
                                size: 36, // 18pt
                                rightToLeft: _mbRtl(),
                            })],
                            alignment: _mbStart(AlignmentType),
                            bidirectional: _mbRtl(),
                        })],
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
                                    size: 24,
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
        const introBlocks = mbBlocksFilled(mbState.introBlocks);

        /* The framework card counts as intro content in its own right:
           a project may carry nothing else on these pages and still
           need to state where its qualification sits. */
        const tvqfOnPage = (typeof mbTvqfHasContent === 'function') && mbTvqfHasContent(mbState);

        if (hasWorkTeam || introAdditionalDetails.trim() || introBlocks.length || tvqfOnPage) {
            const { Table, TableRow, TableCell, WidthType, BorderStyle } = mbDocxLib();
            const introChildren = [];
            
            // Add page break (new page for introduction)
            const coversAdditionalInfo = mbState.coversAdditionalInfo || '';
            const coversAdditionalNotes = mbState.coversAdditionalNotes || '';
            const hasAnyCoverContent = coversAdditionalInfo.trim() || coversAdditionalNotes.trim() || mbState.coverRows.some(row => row.value.trim());
            
            // No page break needed - intro section already starts on new section
            
            /* ── Qualifications-framework card ──────────────────────
               First on the introduction pages, before the work team:
               an accreditation reader opens the document looking for
               the level and the awarding body, not for who wrote it.

               Built as a two-column label/value table rather than a
               heading-and-paragraph run, because that is what makes it
               scannable — and because a card is what the ministry form
               it will be copied into looks like.

               mbTvqfExportRows() has already dropped every empty field,
               so there is no `if (value)` in this loop: a row that
               reached here has something to say. The extended block is
               emitted only when it produced rows of its own, which is
               why the two calls are separate rather than concatenated. */
            if (tvqfOnPage) {
                const tvqfTable = function (headingKey, rows) {
                    if (!rows.length) return;

                    introChildren.push(new Paragraph({
                        children: [new TextRun({
                            text: _mbT(headingKey),
                            size: 24,
                            bold: true,
                            rightToLeft: _mbRtl(),
                        })],
                        alignment: _mbStart(AlignmentType),
                        bidirectional: _mbRtl(),
                        spacing: { after: 200, before: 200 },
                    }));

                    const cell = function (text, bold, pct) {
                        return new TableCell({
                            children: [new Paragraph({
                                children: [new TextRun({
                                    text: String(text),
                                    size: 22,          // 11pt — a card, not body copy
                                    bold: !!bold,
                                    rightToLeft: _mbRtl(),
                                })],
                                alignment: _mbStart(AlignmentType),
                                bidirectional: _mbRtl(),
                            })],
                            width: { size: pct, type: WidthType.PERCENTAGE },
                            margins: { top: 80, bottom: 80, left: 100, right: 100 },
                        });
                    };

                    introChildren.push(new Table({
                        rows: rows.map(function (r) {
                            return new TableRow({
                                children: [cell(r.label, true, 38), cell(r.value, false, 62)],
                            });
                        }),
                        width: { size: 9072, type: WidthType.DXA },   // 16cm
                        borders: {
                            top:              { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                            bottom:           { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                            left:             { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                            right:            { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                            insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                            insideVertical:   { style: BorderStyle.SINGLE, size: 1, color: '000000' },
                        },
                    }));
                };

                tvqfTable('tqCardHeading', mbTvqfExportRows(mbState, 'basic', _mbT));
                tvqfTable('tqExtHeading',  mbTvqfExportRows(mbState, 'ext',   _mbT));

                /* Anything after the card starts a fresh page. Without
                   this the work-team table runs on directly underneath
                   it and the two read as one table. */
                if (hasWorkTeam || introAdditionalDetails.trim() || introBlocks.length) {
                    introChildren.push(new Paragraph({ children: [new PageBreak()] }));
                }
            }

            // Work Team Table (if has team members)
            if (hasWorkTeam) {
                // Title
                introChildren.push(new Paragraph({
                    children: [
                        new TextRun({
                            text: _mbT('expWorkTeam'),
                            size: 24, // 12pt
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
                            size: 24, // 12pt
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
                            size: 24, // 12pt
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
                            size: 24, // 12pt
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
                                    size: 24, // 12pt
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
                                    size: 24, // 12pt
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
                                    size: 24, // 12pt
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
            
            // Additional Introduction Details (on new page if filled)
            if (introAdditionalDetails.trim()) {
                // Add page break if there was work team content
                if (hasWorkTeam) {
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
                                    size: 24,
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
            /* tvqfOnPage included: the card writes onto this page too,
               so a following section needs its own break — otherwise
               the first extra section lands underneath the card. */
            let introPageUsed = !!(hasWorkTeam || introAdditionalDetails.trim() || tvqfOnPage);

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
                            size: 28,            // 14pt — a page heading
                            bold: true,
                            color: '0070C0',
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
                        children: [new TextRun({ text: line, size: 24, rightToLeft: _mbRtl() })],
                        alignment: _mbStart(AlignmentType),
                        bidirectional: _mbRtl(),
                        spacing: { after: 150 },
                    }));
                });
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
            if (currentModule && currentModule.title && currentModule.title.trim()) {
                overviewChildren.push(new Paragraph({
                    children: [
                        new TextRun({
                            text: currentModule.title,
                            size: 32, // 16pt - Large heading
                            bold: true,
                            color: '0070C0', // Blue color
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
                const loTitle = lo.title || '';
                const loHeadingText = _mbTf('expLearningOutcomeN', { v0: loNumber, v1: loTitle });
                
                overviewChildren.push(new Paragraph({
                    children: [
                        new TextRun({
                            text: loHeadingText,
                            size: 26, // 13pt
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
                                    size: 24, // 12pt
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
                mbBlocksFilled(lo.blocks).forEach(block => {
                    const blockTitle = (block.title || '').trim();
                    if (blockTitle) {
                        overviewChildren.push(new Paragraph({
                            children: [new TextRun({
                                text: blockTitle,
                                size: 24,        // 12pt — matches expPerformanceCriteria
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
                            children: [new TextRun({ text: line, size: 24, rightToLeft: _mbRtl() })],
                            alignment: _mbStart(AlignmentType),
                            bidirectional: _mbRtl(),
                            spacing: { after: 150 },
                        }));
                    });
                });

                // Performance Criteria (if available)
                if (lo.performanceCriteria && lo.performanceCriteria.length > 0) {
                    // Performance Criteria heading
                    overviewChildren.push(new Paragraph({
                        children: [
                            new TextRun({
                                text: _mbT('expPerformanceCriteria'),
                                size: 24, // 12pt
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
                                    size: 24, // 12pt
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
                        children: [new TextRun({ text: '', size: 24 })],
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

        // Helper: build ImageRun
        const _mkImgRun = (src) => {
            const { ImageRun } = mbDocxLib();
            const b64 = src.split(',')[1];
            const el = new Image(); el.src = src;
            const ar = el.height / el.width || 1;
            let w = Math.min(280, el.width || 280), h = Math.round(w * ar);
            if (h > 400) { h = 400; w = Math.round(h / ar); }
            return new ImageRun({ data: Uint8Array.from(atob(b64), c => c.charCodeAt(0)), transformation: { width: w, height: h } });
        };

        // Helper: build a user-created table from saved data
        const _buildUserTable = (t, Table, TableRow, TableCell, WidthType, BorderStyle) => {
            if (!t || !t.cells || !t.rows || !t.cols) return null;
            const colW = Math.floor(9072 / t.cols);
            const borders = { top:{style:BorderStyle.SINGLE,size:1,color:'000000'}, bottom:{style:BorderStyle.SINGLE,size:1,color:'000000'}, left:{style:BorderStyle.SINGLE,size:1,color:'000000'}, right:{style:BorderStyle.SINGLE,size:1,color:'000000'}, insideHorizontal:{style:BorderStyle.SINGLE,size:1,color:'000000'}, insideVertical:{style:BorderStyle.SINGLE,size:1,color:'000000'} };
            const rows = [];
            for (let r = 0; r < t.rows; r++) {
                const cells = [];
                for (let c = 0; c < t.cols; c++) {
                    const txt = (t.cells[r] && t.cells[r][c]) ? t.cells[r][c] : '';
                    cells.push(new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: txt, size: 22, rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl() })], width: { size: colW, type: WidthType.DXA }, margins: { top: 80, bottom: 80, left: 100, right: 100 } }));
                }
                rows.push(new TableRow({ children: cells }));
            }
            return new Table({ rows, width: { size: 9072, type: WidthType.DXA }, borders });
        };

        // Helper: build info sheet children from stored data
        const buildInfoCh = (info, loIndex, sheetIndex) => {
            const { Table, TableRow, TableCell, WidthType, BorderStyle } = mbDocxLib();
            const ch = [];
            const num = info.sheetNumber || getAutoSheetNumber(loIndex, sheetIndex);
            if (info.title && info.title.trim()) {
                ch.push(new Paragraph({ children: [new TextRun({ text: _mbTf('expInfoSheetTitled', { v0: num, v1: info.title }), size: 24, bold: true, color: '0070C0', rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { after: 400 } }));
            }
            if (info.objective && info.objective.trim()) {
                ch.push(new Paragraph({ children: [new TextRun({ text: _mbT('expObjective'), bold: true, size: 24, color: '0070C0', rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { after: 200 } }));
                info.objective.split('\n').forEach(line => { if (line.trim()) ch.push(new Paragraph({ children: [new TextRun({ text: line, size: 24, rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { after: 150 } })); });
            }
            if (info.contentSections) {
                info.contentSections.forEach((cs) => {
                    if (!cs.text || !cs.text.trim()) {
                        // still export tables even if text is empty
                        if (cs.tables && cs.tables.length) {
                            cs.tables.forEach(t => {
                                const tbl = _buildUserTable(t, Table, TableRow, TableCell, WidthType, BorderStyle);
                                if (tbl) { ch.push(tbl); ch.push(new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 200 } })); }
                            });
                        }
                        return;
                    }
                    const pt = processTextForWordExport(cs.text);
                    const csid = cs.contentId;
                    let imgs = (info.contentSectionImages && info.contentSectionImages[csid]) || [];
                    if (!Array.isArray(imgs)) imgs = [imgs];
                    const row1 = [new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: pt, size: 24, rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl() })], width: { size: 4536, type: WidthType.DXA }, margins: { top: 150, bottom: 150, left: 150, right: 150 }, verticalAlign: 'center' })];
                    if (imgs.length > 0) { try { row1.push(new TableCell({ children: [new Paragraph({ children: [_mkImgRun(imgs[0])], alignment: AlignmentType.CENTER })], width: { size: 4536, type: WidthType.DXA }, margins: { top: 150, bottom: 150, left: 150, right: 150 }, verticalAlign: 'center' })); } catch(e) { row1.push(new TableCell({ children: [new Paragraph({ text: '' })], width: { size: 4536, type: WidthType.DXA } })); } }
                    else { row1.push(new TableCell({ children: [new Paragraph({ text: '' })], width: { size: 4536, type: WidthType.DXA } })); }
                    const tRows = [new TableRow({ children: row1 })];
                    for (let ii = 1; ii < imgs.length; ii++) { try { tRows.push(new TableRow({ children: [new TableCell({ children: [new Paragraph({ text: '' })], width: { size: 4536, type: WidthType.DXA } }), new TableCell({ children: [new Paragraph({ children: [_mkImgRun(imgs[ii])], alignment: AlignmentType.CENTER })], width: { size: 4536, type: WidthType.DXA }, margins: { top: 100, bottom: 100, left: 150, right: 150 } })] })); } catch(e) {} }
                    const borders = { top: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, left: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, right: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: '000000' }, insideVertical: { style: BorderStyle.SINGLE, size: 1, color: '000000' } };
                    ch.push(new Table({ rows: tRows, width: { size: 9072, type: WidthType.DXA }, borders }));
                    ch.push(new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 200 } }));
                    if (cs.marks) { cs.marks.forEach(m => { if (m.text && m.text.trim()) { const mt = MARK_TYPES.find(x => x.key === m.key); if (mt) { ch.push(buildMarkDocxTable(mt, m.text)); } } }); }
                    // Export user-created tables
                    if (cs.tables && cs.tables.length) {
                        cs.tables.forEach(t => {
                            const tbl = _buildUserTable(t, Table, TableRow, TableCell, WidthType, BorderStyle);
                            if (tbl) { ch.push(tbl); ch.push(new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 200 } })); }
                        });
                    }
                });
            }
            if (info.selfCheckContent && info.selfCheckContent.trim()) {
                const scNum = info.selfCheckNumber || num;
                const scCh = [];
                scCh.push(new Paragraph({ children: [new TextRun({ text: _mbTf('expSelfCheck', { v0: scNum }), bold: true, size: 24, color: '0070C0', rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { after: 400 } }));
                info.selfCheckContent.split('\n').forEach(line => { if (line.trim()) scCh.push(new Paragraph({ children: [new TextRun({ text: line, size: 24, rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { after: 150 } })); });
                ch.__selfCheckSection = scCh;
            }
            if (info.answersKeyContent && info.answersKeyContent.trim()) {
                const akNum = info.answersKeyNumber || num;
                const akCh = [];
                akCh.push(new Paragraph({ children: [new TextRun({ text: _mbTf('expAnswersKey', { v0: akNum }), bold: true, size: 24, color: '0070C0', rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { after: 400 } }));
                info.answersKeyContent.split('\n').forEach(line => { if (line.trim()) akCh.push(new Paragraph({ children: [new TextRun({ text: line, size: 24, rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { after: 150 } })); });
                ch.__answersKeySection = akCh;
            }
            return ch;
        };

        // Helper: build activity sheet children from stored data
        const buildActCh = (activity, loIndex, sheetIndex) => {
            const { Table, TableRow, TableCell, WidthType, BorderStyle } = mbDocxLib();
            const ch = [];
            const num = activity.sheetNumber || getAutoSheetNumber(loIndex, sheetIndex);
            if (activity.title && activity.title.trim()) {
                ch.push(new Paragraph({ children: [new TextRun({ text: _mbTf('expActivitySheetTitled', { v0: num, v1: activity.title }), size: 24, bold: true, color: '0070C0', rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { after: 400 } }));
            }
            if (activity.objective && activity.objective.trim()) {
                ch.push(new Paragraph({ children: [new TextRun({ text: _mbT('expObjective'), bold: true, size: 24, color: '0070C0', rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { after: 200 } }));
                activity.objective.split('\n').forEach(line => { if (line.trim()) ch.push(new Paragraph({ children: [new TextRun({ text: line, size: 24, rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { after: 150 } })); });
            }
            if (activity.duration && parseInt(activity.duration) > 0) {
                ch.push(new Paragraph({ children: [new TextRun({ text: _mbT('expDuration'), bold: true, size: 24, color: '0070C0', rightToLeft: _mbRtl() }), new TextRun({ text: _mbTf('expMinutes', { v0: activity.duration }), size: 24, rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { after: 300 } }));
            }
            const validRes = (activity.resources || []).filter(r => r.name && r.name.trim());
            if (validRes.length > 0) {
                ch.push(new Paragraph({ children: [new TextRun({ text: _mbT('expTrainingResources'), bold: true, size: 24, color: '0070C0', rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { after: 200, before: 200 } }));
                const bdr = { top:{style:BorderStyle.SINGLE,size:1,color:'000000'}, bottom:{style:BorderStyle.SINGLE,size:1,color:'000000'}, left:{style:BorderStyle.SINGLE,size:1,color:'000000'}, right:{style:BorderStyle.SINGLE,size:1,color:'000000'}, insideHorizontal:{style:BorderStyle.SINGLE,size:1,color:'000000'}, insideVertical:{style:BorderStyle.SINGLE,size:1,color:'000000'} };
                /* `wide` replaces the old `t.includes('Mat')` check, which
                   sized the column by testing for the English substring
                   "Mat" — a check that silently stops working the moment
                   the header is translated, since the Arabic word for
                   "Material" doesn't contain "Mat". The width is now the
                   caller's decision, not a guess from the label text. */
                const mkHdr = (t, wide) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: t, bold: true, size: 28, color: 'FFFFFF', rightToLeft: _mbRtl() })], alignment: AlignmentType.CENTER, bidirectional: _mbRtl() })], shading: { fill: '0070C0', type: 'clear' }, width: { size: wide ? 37 : 13, type: WidthType.PERCENTAGE } });
                const hdrMat = _mbT('expMaterialEquipment'), hdrQty = _mbT('expQuantityNumber');
                const resRows = [new TableRow({ children: [mkHdr(hdrMat, true), mkHdr(hdrQty, false), mkHdr(hdrMat, true), mkHdr(hdrQty, false)] })];
                for (let ri = 0; ri < validRes.length; ri += 2) {
                    const l = validRes[ri], r2 = validRes[ri+1];
                    const mkC = (txt, pct, align) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: txt||'', size: 28, rightToLeft: _mbRtl() })], alignment: align, bidirectional: _mbRtl() })], width: { size: pct, type: WidthType.PERCENTAGE }, margins: { top: 100, bottom: 100, left: 100, right: 100 } });
                    resRows.push(new TableRow({ children: [mkC(l.name,37,_mbStart(AlignmentType)), mkC(l.quantity||'1',13,AlignmentType.CENTER), mkC(r2?r2.name:'',37,_mbStart(AlignmentType)), mkC(r2?r2.quantity:'',13,AlignmentType.CENTER)] }));
                }
                ch.push(new Table({ rows: resRows, width: { size: 9072, type: WidthType.DXA }, layout: 'fixed', borders: bdr, columnWidths: [3356,1178,3356,1178] }));
                ch.push(new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 200 } }));
            }
            const validSteps = (activity.steps || []).filter(s => s.text && s.text.trim());
            if (validSteps.length > 0) {
                ch.push(new Paragraph({ children: [new TextRun({ text: _mbT('expActivitySteps'), bold: true, size: 24, color: '0070C0', rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { after: 200 } }));
                validSteps.forEach((step, si) => {
                    ch.push(new Paragraph({ children: [new TextRun({ text: _mbTf('expStepN', { v0: si + 1 }), bold: true, size: 24, color: '0070C0', rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { after: 100 } }));
                    const pt = processTextForWordExport(step.text);
                    let sImgs = (activity.images && activity.images[step.stepId]) || [];
                    if (!Array.isArray(sImgs)) sImgs = [sImgs];
                    const sr1 = [new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: pt, size: 24, rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl() })], width: { size: 4536, type: WidthType.DXA }, margins: { top: 150, bottom: 150, left: 150, right: 150 }, verticalAlign: 'center' })];
                    if (sImgs.length > 0) { try { sr1.push(new TableCell({ children: [new Paragraph({ children: [_mkImgRun(sImgs[0])], alignment: AlignmentType.CENTER })], width: { size: 4536, type: WidthType.DXA }, margins: { top: 150, bottom: 150, left: 150, right: 150 }, verticalAlign: 'center' })); } catch(e) { sr1.push(new TableCell({ children: [new Paragraph({ text: '' })], width: { size: 4536, type: WidthType.DXA } })); } }
                    else { sr1.push(new TableCell({ children: [new Paragraph({ text: '' })], width: { size: 4536, type: WidthType.DXA } })); }
                    const sRows = [new TableRow({ children: sr1 })];
                    for (let ii=1;ii<sImgs.length;ii++){try{sRows.push(new TableRow({children:[new TableCell({children:[new Paragraph({text:''})],width:{size:4536,type:WidthType.DXA}}),new TableCell({children:[new Paragraph({children:[_mkImgRun(sImgs[ii])],alignment:AlignmentType.CENTER})],width:{size:4536,type:WidthType.DXA},margins:{top:100,bottom:100,left:150,right:150}})]}))}catch(e){}}
                    const bdr2 = { top:{style:BorderStyle.SINGLE,size:1,color:'000000'}, bottom:{style:BorderStyle.SINGLE,size:1,color:'000000'}, left:{style:BorderStyle.SINGLE,size:1,color:'000000'}, right:{style:BorderStyle.SINGLE,size:1,color:'000000'}, insideHorizontal:{style:BorderStyle.SINGLE,size:1,color:'000000'}, insideVertical:{style:BorderStyle.SINGLE,size:1,color:'000000'} };
                    ch.push(new Table({ rows: sRows, width: { size: 9072, type: WidthType.DXA }, borders: bdr2 }));
                    ch.push(new Paragraph({ children: [new TextRun({ text: '' })], spacing: { after: 200 } }));
                    if (step.marks) { step.marks.forEach(m => { if (m.text && m.text.trim()) { const mt = MARK_TYPES.find(x => x.key === m.key); if (mt) { ch.push(buildMarkDocxTable(mt, m.text)); } } }); }
                });
            }

            // ── Performance Criteria — as separate section (new page) ──
            const validCriteria = (activity.criteria || []).filter(c => c && c.trim());
            if (validCriteria.length > 0) {
                /* The user's own wording wins; our own boilerplate — even
                   when an older build stored it as a value — is re-emitted
                   in the EXPORT language. `|| _mbT(...)` alone only helped
                   projects whose fields were genuinely empty, which is why
                   this table kept coming out English in Arabic exports of
                   existing modules. See _mbBoilerplate in docx_bidi.js. */
                const ctTitle  = _mbBoilerplate(activity.criteriaTitle, 'expCriteriaCheckList', { v0: num });
                const ctInstr  = _mbBoilerplate(activity.criteriaInstruction, 'expCriteriaInstructionDefault');
                const ctFooter = _mbBoilerplate(activity.criteriaFooter,      'expCriteriaFooterDefault');
                const ctBdr = { top:{style:BorderStyle.SINGLE,size:1,color:'000000'}, bottom:{style:BorderStyle.SINGLE,size:1,color:'000000'}, left:{style:BorderStyle.SINGLE,size:1,color:'000000'}, right:{style:BorderStyle.SINGLE,size:1,color:'000000'}, insideHorizontal:{style:BorderStyle.SINGLE,size:1,color:'000000'}, insideVertical:{style:BorderStyle.SINGLE,size:1,color:'000000'} };
                const cellMgn = { top: 120, bottom: 120, left: 150, right: 150 };
                const ctRows = [];
                // Title row
                ctRows.push(new TableRow({ children: [new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: ctTitle, bold: true, size: 28, color: '1F4788', rightToLeft: _mbRtl() })], alignment: AlignmentType.CENTER, bidirectional: _mbRtl() })], columnSpan: 4, margins: cellMgn })] }));
                // Instruction row
                if (ctInstr.trim()) ctRows.push(new TableRow({ children: [new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: ctInstr, bold: true, size: 24, rightToLeft: _mbRtl() })], alignment: AlignmentType.CENTER, bidirectional: _mbRtl() })], columnSpan: 4, margins: cellMgn })] }));
                // Header row
                const mkH = (t, w) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: t, bold: true, size: 28, color: '0070C0', rightToLeft: _mbRtl() })], alignment: AlignmentType.CENTER, bidirectional: _mbRtl() })], width: { size: w, type: WidthType.PERCENTAGE }, margins: cellMgn });
                ctRows.push(new TableRow({ children: [mkH('#',8), mkH(_mbT('expDidYou'),62), mkH(_mbT('expYes'),15), mkH(_mbT('expNo'),15)] }));
                // Criteria rows
                validCriteria.forEach((c, i) => {
                    const mkD = (t, align) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: t, size: 28, rightToLeft: _mbRtl() })], alignment: align, bidirectional: _mbRtl() })], margins: cellMgn });
                    ctRows.push(new TableRow({ children: [mkD(String(i+1), AlignmentType.CENTER), mkD(c, _mbStart(AlignmentType)), mkD(' ', AlignmentType.CENTER), mkD(' ', AlignmentType.CENTER)] }));
                });
                // Footer row
                if (ctFooter.trim()) ctRows.push(new TableRow({ children: [new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: ctFooter, size: 24, rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl() })], columnSpan: 4, margins: cellMgn })] }));
                const ctTable = new Table({ rows: ctRows, width: { size: 9072, type: WidthType.DXA }, borders: ctBdr });
                // Store as separate section (new page — same as self-check)
                ch.__criteriaSection = [ctTable];
            }

            return ch;
        };

        // Loop ALL LOs in order: LO heading → all info sheets → all activity sheets
        mbState.learningOutcomesData.forEach((lo, loIndex) => {
            const loHdCh = [new Paragraph({ children: [new TextRun({ text: _mbTf('expLearningOutcomeN', { v0: loIndex + 1, v1: lo.title || '' }), size: 28, bold: true, color: '0070C0', rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { after: 400, before: 200 } })];
            sections.push({ properties: { bidi: _mbRtl() }, children: loHdCh });

            (lo.infoSheets || []).forEach((info, si) => {
                if (!info.title || !info.title.trim()) return;
                const ch = buildInfoCh(info, loIndex, si);
                if (ch.length > 0) sections.push({ properties: { bidi: _mbRtl() }, children: ch });
                // Self-check AFTER info sheet
                if (ch.__selfCheckSection) sections.push({ properties: { bidi: _mbRtl() }, children: ch.__selfCheckSection });
                // Answers-Key AFTER self-check
                if (ch.__answersKeySection) sections.push({ properties: { bidi: _mbRtl() }, children: ch.__answersKeySection });
            });

            (lo.activitySheets || []).forEach((activity, si) => {
                if (!activity.title || !activity.title.trim()) return;
                const ch = buildActCh(activity, loIndex, si);
                if (ch.length > 0) sections.push({ properties: { bidi: _mbRtl() }, children: ch });
                // Criteria as separate page AFTER activity sheet
                if (ch.__criteriaSection) sections.push({ properties: { bidi: _mbRtl() }, children: ch.__criteriaSection });
            });
        });

        // Assessment Unit Section (Simple)
        console.log('Preparing Assessment Unit section...');
        const assessmentSimpleContent = mbState.assessmentContent || '';
        const hasAssessmentContent = assessmentSimpleContent.trim() !== '';
        const hasAssessmentForms = mbState.learningOutcomesData.some(lo => mbState.assessmentFormsData[lo.id]);
        console.log('Assessment content:', hasAssessmentContent, 'Assessment forms:', hasAssessmentForms);
        
        if (hasAssessmentContent || hasAssessmentForms) {
            console.log('Creating assessment section...');
            const { Table, TableRow, TableCell, WidthType, BorderStyle } = mbDocxLib();
            const assessmentChildren = [];
            
            // No page break needed before assessment section - it's already a new section
            
            // Assessment Unit Title
            assessmentChildren.push(new Paragraph({
                children: [
                    new TextRun({
                        text: _mbT('expAssessmentUnitCaps'),
                        size: 28,
                        bold: true,
                        color: '0070C0',
                        rightToLeft: _mbRtl(),
                    }),
                ],
                alignment: AlignmentType.CENTER,
                bidirectional: _mbRtl(),
                spacing: { after: 400 },
            }));
            
            // Assessment Content (Simple textarea content)
            if (hasAssessmentContent) {
                const contentLines = assessmentSimpleContent.split('\n');
                contentLines.forEach(line => {
                    assessmentChildren.push(new Paragraph({
                        children: [
                            new TextRun({
                                text: line,
                                size: 24,
                                rightToLeft: _mbRtl(),
                            }),
                        ],
                        alignment: _mbStart(AlignmentType),
                        bidirectional: _mbRtl(),
                        spacing: { after: 150 },
                    }));
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
                    // Skip LOs that have no form created
                    if (!mbState.assessmentFormsData[lo.id]) return;

                    console.log(`Creating assessment form for LO ${loIndex + 1}:`, lo.title);
                    const formChildren = [];
                    const formData = mbState.assessmentFormsData[lo.id];
                    
                    // Assessment Unit Header
                    formChildren.push(new Paragraph({
                        children: [
                            new TextRun({
                                text: _mbT('expAssessmentUnit'),
                                size: 28,
                                bold: true,
                                color: '0070C0',
                                rightToLeft: _mbRtl(),
                            }),
                        ],
                        alignment: _mbStart(AlignmentType),
                        bidirectional: _mbRtl(),
                        spacing: { after: 200, before: 200 },
                    }));
                    
                    // Learning Outcome Title - prevent duplication
                    const loTitle = lo.title || '';
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
                                size: 26,
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
                                size: 24,
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
                                size: 24,
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
                                        size: 24,
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
                    
                    // Result Section
                    formChildren.push(new Paragraph({
                        children: [new TextRun({ text: '', size: 24 })],
                        spacing: { after: 300 },
                    }));
                    
                    formChildren.push(new Paragraph({
                        children: [
                            new TextRun({
                                text: _mbT('expResult'),
                                bold: true,
                                size: 24,
                                rightToLeft: _mbRtl(),
                            }),
                        ],
                        alignment: _mbStart(AlignmentType),
                        bidirectional: _mbRtl(),
                        spacing: { after: 200 },
                    }));
                    
                    // Result checkboxes - always empty for paper printout
                    const competentSymbol = '☐';
                    const notCompetentSymbol = '☐';
                    
                    formChildren.push(new Paragraph({
                        children: [
                            new TextRun({
                                text: `${competentSymbol} ` + _mbT('expCompetent'),
                                size: 24,
                                rightToLeft: _mbRtl(),
                            }),
                        ],
                        alignment: _mbStart(AlignmentType),
                        bidirectional: _mbRtl(),
                        spacing: { after: 150 },
                    }));
                    
                    formChildren.push(new Paragraph({
                        children: [
                            new TextRun({
                                text: `${notCompetentSymbol} ` + _mbT('expNotYetCompetent'),
                                size: 24,
                                rightToLeft: _mbRtl(),
                            }),
                        ],
                        alignment: _mbStart(AlignmentType),
                        bidirectional: _mbRtl(),
                        spacing: { after: 400 },
                    }));
                    
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
                                size: 24,
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
                                size: 24,
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
                        size: 28,
                        bold: true,
                        color: '0070C0',
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
                            size: 24,
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
        showStatus(window.i18n.tf('dgDocumentExportedSuccessfullyFileMb', { v0: filename, v1: fileSizeMB }), 'success');

    } catch (error) {
        console.error('Error:', error);
        
        // Re-enable export button
        setExportButtonState(false);
        
        // Hide export info
        hideExportInfo();
        
        showStatus(window.i18n.t('dgExportFailed') + error.message, 'error');

        /* Route to error handler with EXPORT context */
        if (window.onerror) window.onerror('[EXPORT] ' + error.message, 'exportToDocx', 0, 0, error);
    } finally {
        /* Release the pinned document language. Without this a failed
           Arabic export would leave 'ar' latched, and the next export —
           of a different, English module — would silently inherit it. */
        _mbEndExport();
    }
}
