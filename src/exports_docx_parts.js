// ============================================================
// /src/exports_docx_parts.js
// The big sections of the Word export, taken out of exportToDocx()
// (exports_docx.js) so that function reads as an outline. Each part
// receives, in one object, exactly the values it reads — nothing here
// reaches into exportToDocx's scope. Same code, same order of output.
// ============================================================

function _mbDocxSteps({ children, Paragraph, TextRun, AlignmentType, steps, mbState }) {
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

function _mbDocxActivityLink({ mbState, activityLinkSubject, activityLinkUrl, Paragraph, TextRun, AlignmentType, children }) {
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

function _mbDocxFrontMatter({ coversAdditionalInfo, mbState, sections, Paragraph, TextRun, AlignmentType }) {
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

function _mbDocxIntro({ mbState, hasWorkTeam, introTableRows, introAdditionalDetails, introBlocks, sections, Paragraph, TextRun, AlignmentType, PageBreak, _pushUserTable }) {
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

function _mbDocxContents({ mbState, sections, Paragraph, TextRun, AlignmentType, _pushUserTable }) {
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

function _mbDocxBuildLearningGuide({ Paragraph, TextRun, AlignmentType }, model) {
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
}

function _mbDocxBuildQrTable({ Paragraph, TextRun, AlignmentType }, subject, url, qrImage) {
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
}

function _mbDocxBuildInfoSheet({ mbState, _lgDoc, Paragraph, TextRun, _sheetHeadText, AlignmentType, _lgPara, _pushAttachment, _pushUserTable, _imgCellCh, buildQrTable }, info, loIndex, sheetIndex) {
    const { Table, TableRow, TableCell, WidthType, BorderStyle } = mbDocxLib();
    const ch = [];
    const _loSeq = mbState.learningOutcomesData[loIndex];   // 3.43.0
    const num = (typeof mbSeqNumber === 'function') ? mbSeqNumber(_loSeq, loIndex, 'info', sheetIndex)
        : (info.sheetNumber || getAutoSheetNumber(loIndex, sheetIndex));
    if (info.title && info.title.trim()) {
        ch.push(new Paragraph({ children: [new TextRun({ text: _sheetHeadText('info', num, info.title, 'expInfoSheetTitled'), size: _wsBody(), bold: true, color: _wsHeadColor(), rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { after: 400 } }));
    }
    /* 3.80.0: the Learner guide's list box — title, then its lines as typed. */
    if (_lgDoc && typeof mbLgListLines === 'function') {
        const _lt = typeof mbLgListTitle === 'function' ? mbLgListTitle(info, _mbLang()) : '';
        const _ll = mbLgListLines(info, _mbLang());
        if (_lt) ch.push(_lgPara(_lt, { bold: true, color: _wsHeadColor(), after: 200 }));
        _ll.forEach(l => ch.push(_lgPara(l, { after: 100 })));
        if (_ll.length) ch.push(_lgPara('', { after: 200 }));
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
}

function _mbDocxBuildActivitySheet({ mbState, _lgDoc, Paragraph, TextRun, _sheetHeadText, AlignmentType, _pushAttachment, _imgCellCh, _pushUserTable, buildQrTable }, activity, loIndex, sheetIndex) {
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
}

function _mbDocxLgAssessmentUnit({ mbState, _lgUnits, _lgHead, sections, _lgTextCh, Paragraph, TextRun, AlignmentType, _lgPara, _pushUserTable }) {
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
    if (portfolio.trim()) { ch.push(_lgHead(N + '-2 ' + mbLgAsmPortfolioTitle(L, mbState))); _lgTextCh(portfolio, ch); }
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

    if (!formLos.length && !asmText.trim() && !asmBlk.length) return;
    /* 3.83.0: «N-4 Assessment Tables of (code)» — the Assessment
       Content card's text and sections, then the tables. */
    const fc = [];
    fc.push(_lgHead(N + '-4 ' + mbLgAsmTablesTitle(L, mbState)));
    if (asmText.trim()) _lgTextCh(asmText, fc);
    asmBlk.forEach(block => {
        const bt = (block.title || '').trim();
        if (bt) fc.push(_lgPara(bt, { bold: true, color: _wsHeadColor(), before: 240 }));
        _lgTextCh(block.body, fc);
        (block.tables || []).forEach(t => _pushUserTable(t, fc));
    });
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

function _mbDocxAssessment({ Paragraph, TextRun, AlignmentType, hasAssessmentContent, hasAssessmentForms, assessmentSimpleContent, asmBlocks, _pushUserTable, sections, mbState, _asmFilled }) {
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

function _mbDocxReferences({ Paragraph, TextRun, mbState, AlignmentType, sections }) {
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
