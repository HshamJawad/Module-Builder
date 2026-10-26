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

function _mbDocxPrepareOne(src, vectorScale) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            try {
                let w = img.naturalWidth, h = img.naturalHeight;
                const mime = src.slice(5, src.search(/[;,]/)).toLowerCase();
                if (MB_DOCX_IMAGE_TYPES.indexOf(mime) !== -1 && /;base64,/.test(src.slice(0, 64))) {
                    const type = mime === 'image/png' ? 'png' : (mime === 'image/gif' ? 'gif' : (mime === 'image/bmp' ? 'bmp' : 'jpg'));
                    resolve({ data: _mbDocxB64Bytes(src), w, h, type });
                    return;
                }
                /* WebP, SVG, AVIF …: drawn once and kept as PNG. An SVG
                   with no size of its own gets a sensible one. */
                if (!w || !h) { w = 600; h = 400; }
                const k = vectorScale || 1;
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(w * k); canvas.height = Math.round(h * k);
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve({ data: _mbDocxB64Bytes(canvas.toDataURL('image/png')), w, h, type: 'png' });
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
            _mbDocxSteps({ children, Paragraph, TextRun, AlignmentType, steps, mbState });
        }

        // QR Code and Link Table for Activity Sheet
        const activityLinkSubject = _activity.linkSubject || '';
        const activityLinkUrl     = _activity.linkUrl     || '';
        
        if (mbState.activityQRImage || activityLinkSubject.trim() || activityLinkUrl.trim()) {
            _mbDocxActivityLink({ mbState, activityLinkSubject, activityLinkUrl, Paragraph, TextRun, AlignmentType, children });
        }

        // Prepare sections array
        const sections = [];

        // ── Shared helper: export a cover image as a full A4 page ────
        const _exportCoverPage = async (imgSrc, sectionsArr, docxLib, AlignType) => {
            const { ImageRun: CvImageRun } = docxLib;
            /* 3.81.1: the cover goes through the same preparation as the
               sheet pictures. It used to take the base64 text as it was and
               call everything but PNG a JPEG — so an SVG cover (what Word
               puts on the clipboard) became an empty frame. Vector covers
               are drawn at twice their size so the printed page stays
               sharp. */
            const prep = await _mbDocxPrepareOne(imgSrc, 2);
            if (!prep) {
                console.warn('[DOCX] cover picture could not be prepared');
                if (typeof showStatus === 'function') showStatus('Cover image could not be exported', 'error');
                return;
            }
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
                                data: prep.data,
                                transformation: { width: 794, height: 1123 },
                                type: prep.type,
                            }),
                        ],
                        alignment: AlignType.CENTER,
                        spacing: { before: 0, after: 0 },
                    }),
                ],
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
            _mbDocxFrontMatter({ coversAdditionalInfo, mbState, sections, Paragraph, TextRun, AlignmentType });
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
            _mbDocxIntro({ mbState, hasWorkTeam, introTableRows, introAdditionalDetails, introBlocks, sections, Paragraph, TextRun, AlignmentType, PageBreak, _pushUserTable });
        }
        
        // Module & Learning Outcomes Overview Section (NEW - separate page)
        // This section appears after Introduction and before Information Sheets
        if (mbState.currentModuleId && mbState.learningOutcomesData.length > 0) {
            _mbDocxContents({ mbState, sections, Paragraph, TextRun, AlignmentType, _pushUserTable });
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
        const _buildLearningGuideDocx = (...args) => _mbDocxBuildLearningGuide({ Paragraph, TextRun, AlignmentType }, ...args);

        // Helper: build info sheet children from stored data
        /* ── QR / link table ────────────────────────────────────
           Two cells in one 16 cm row: the QR image on one side, the
           subject and address on the other. This existed only in a
           legacy single-sheet path, so neither the Information Sheet nor
           the Activity Sheet has been exporting it since those builders
           took over — the card was filled in and nothing came out. */
        const buildQrTable = (...args) => _mbDocxBuildQrTable({ Paragraph, TextRun, AlignmentType }, ...args);

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
        const buildInfoCh = (...args) => _mbDocxBuildInfoSheet({ mbState, _lgDoc, Paragraph, TextRun, _sheetHeadText, AlignmentType, _lgPara, _pushAttachment, _pushUserTable, _imgCellCh, buildQrTable }, ...args);

        // Helper: build activity sheet children from stored data
        const buildActCh = (...args) => _mbDocxBuildActivitySheet({ mbState, _lgDoc, Paragraph, TextRun, _sheetHeadText, AlignmentType, _pushAttachment, _imgCellCh, _pushUserTable, buildQrTable }, ...args);

        // Loop ALL LOs in order: LO heading → all info sheets → all activity sheets
        let _lgUnits = 0;   // 3.59.0: the number of the last learning unit printed
        let _seeRefs = null;
        if (typeof mbContentMapRefs === 'function') { try { _seeRefs = mbContentMapRefs(_mbCurrentModule()); } catch (e) { _seeRefs = null; } }
        /* 3.80.6: the Learner guide's module introduction — its own page, headed by the module's
           title, before the first learning unit. */
        if (_lgDoc && typeof mbLgModuleOf === 'function') {
            const _lm = mbLgModuleOf(mbState);
            if (_lm && mbLgIntroFilled(_lm)) {
                const _lmTitle = String(_lm.fullTitle || '').trim() || String(_lm.title || '').trim();
                const lmCh = [];
                if (_lmTitle) lmCh.push(new Paragraph({ children: [new TextRun({ text: _lmTitle, size: _wsSection(), bold: true, color: _wsHeadColor(), rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { after: 400, before: 200 } }));
                _lgTextCh(_lm.lgIntro && _lm.lgIntro.body, lmCh);
                const lmItems = String((_lm.lgIntro && _lm.lgIntro.items) || '').split('\n').map(l => l.replace(/^\s*(?:[-•*]|\d+[.)-])\s*/, '').trim()).filter(Boolean);
                if (lmItems.length) {
                    lmCh.push(_lgPara(_mbT('lgYouWillLearn'), { bold: true, before: 120 }));
                    lmItems.forEach((it, i) => lmCh.push(_lgPara((i + 1) + '. ' + it, { after: 100 })));
                }
                const lmInc = (typeof mbLgIncludesParts === 'function') ? mbLgIncludesParts(_lm, _mbLang()) : null;
                if (lmInc) {
                    lmCh.push(_lgPara(lmInc.title, { bold: true, before: 200 }));
                    lmInc.rows.forEach(r => lmCh.push(new Paragraph({
                        children: [new TextRun({ text: r.label + ' ', size: _wsBody(), bold: true, rightToLeft: _mbRtl() }),
                                   new TextRun({ text: r.text, size: _wsBody(), rightToLeft: _mbRtl() })],
                        alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { after: 100 }
                    })));
                    lmInc.extra.forEach(line => lmCh.push(_lgPara(line, { after: 100 })));
                }
                sections.push({ properties: { bidi: _mbRtl() }, children: lmCh });
            }
        }
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
                (_lgDoc && (mbLgUnitFilled(lo) || mbLgReflectionFilled(lo)));   // 3.59.0; 3.80.6
            /* 3.31.0: items of this outcome written in another one ("see
               also", content map). An outcome whose items all live in
               other outcomes' sheets still gets its page, with those lines. */
            let seeAlso = [];
            if (_seeRefs) { try { seeAlso = mbSeeAlsoFor(lo.id, _exportLang, mbState.learningOutcomesData, _seeRefs); } catch (e) { seeAlso = []; } }
            if (!loHasSheets && !seeAlso.length) return;

            const loHdTitle = mbLoPlainTitle(lo.title || '');
            /* 3.80.6: the unit's own title (its card in the Knowledge tab), else the outcome's. */
            const _lgU = _lgDoc ? mbLgUnitParts(lo, _mbLang()) : null;
            const loHdText = _lgDoc ? mbLgUnitHeading(loIndex + 1, (_lgU && _lgU.title) || loHdTitle, _mbLang())   // 3.59.0; 3.67.0 named in Settings
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
            if (_lgDoc && mbLgUnitFilled(lo)) {
                const n = mbSeqLgNumber(lo, loIndex, 'lgIntro');
                /* 3.80.6: «N-1 Introduction: title», its lines as typed, then «you will learn how to:» and its lines. */
                loHdCh.push(_lgHead((_mbTf('lgIntroHead', { v0: n }).trim() + (_lgU.introTitle ? ': ' + _lgU.introTitle : '')).trim()));
                _lgU.intro.forEach(line => loHdCh.push(_lgPara(line, { after: 100 })));
                if (_lgU.learn.length) {
                    loHdCh.push(_lgPara(_lgU.learnLead, { bold: true, before: 120 }));
                    _lgU.learn.forEach(line => loHdCh.push(_lgPara(line, { after: 100 })));
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
        function _lgAssessmentUnit(...args) { return _mbDocxLgAssessmentUnit({ mbState, _lgUnits, _lgHead, sections, _lgTextCh, Paragraph, TextRun, AlignmentType, _lgPara, _pushUserTable }, ...args); }

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
            _mbDocxAssessment({ Paragraph, TextRun, AlignmentType, hasAssessmentContent, hasAssessmentForms, assessmentSimpleContent, asmBlocks, _pushUserTable, sections, mbState, _asmFilled });
        }


        // ── Glossary of Terms (3.42.0) — its own page, before the references ──
        /* 3.59.0: the Learner guide prints it after the last learning
           unit, before the assessment unit (see above). */
        if (!_lgDoc) _pushGlossary();

        // ── Tools & Resources page (3.79.0) ──────────────────────────
        /* One list for the module: a shaded heading row and the items
           numbered «1- …», on its own page before the references. Empty
           list, no page. */
        const _toolsItems = (typeof mbToolsList === 'function') ? mbToolsList(window.mbState) : [];
        if (_toolsItems.length) {
            const { Table, TableRow, TableCell, WidthType } = mbDocxLib();
            const _tCell = (text, head) => new TableCell({
                children: [new Paragraph({
                    children: [new TextRun({ text: text, bold: !!head, size: _wsTable(), color: head ? _wsTblText() : undefined, rightToLeft: _mbRtl() })],
                    alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { before: 60, after: 60 } })],
                shading: head ? { fill: _wsTblFill(), type: 'clear' } : undefined,
                width: { size: 100, type: WidthType.PERCENTAGE }
            });
            const _tRows = [new TableRow({ children: [_tCell(_mbT('expToolsResources'), true)], tableHeader: true })];
            _toolsItems.forEach((x, i) => _tRows.push(new TableRow({ children: [_tCell((i + 1) + '- ' + x, false)] })));
            sections.push({ properties: { bidi: _mbRtl() }, children: [
                new Table({ rows: _tRows, width: { size: 100, type: WidthType.PERCENTAGE }, visuallyRightToLeft: _mbRtl() })
            ] });
        }

        // ── References page ──────────────────────────────────────────
        syncReferencesFromDOM();
        const hasRefs = mbState.referencesData.some(r => r.value.trim());
        /* 3.81.0: the Learner guide prints its suggested resources and its
           material facilities as ONE table — a heading row, a row per
           resource (a web address becomes a link), then the facilities
           with their numbers. */
        const _facRows = _lgDoc ? (mbState.facilitiesData || []).filter(f => f && String(f.value || '').trim()) : [];
        if (_lgDoc && (hasRefs || _facRows.length)) {
            const { Table, TableRow, TableCell, WidthType } = mbDocxLib();
            const _lib = mbDocxLib();
            const _storedTitle = (typeof mbState.referencesTitle === 'string') ? mbState.referencesTitle : '';
            const _refsHead = (typeof mbLgRefsTitle === 'function') ? mbLgRefsTitle(_storedTitle, _mbLang()) : _storedTitle;
            const _facHead = (typeof mbLgFacTitle === 'function') ? mbLgFacTitle(typeof mbState.facilitiesTitle === 'string' ? mbState.facilitiesTitle : '', _mbLang()) : '';
            const _numHead = (typeof _lgTIn === 'function') ? _lgTIn('lgFacNumber', _mbLang()) : 'Number';
            const _headCell = (text, span, w, center) => new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text: text, bold: true, size: _wsTable(), color: _wsTblText(), rightToLeft: _mbRtl() })],
                    alignment: center ? AlignmentType.CENTER : _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { before: 60, after: 60 } })],
                shading: { fill: _wsTblFill(), type: 'clear' }, columnSpan: span, width: { size: w, type: WidthType.PERCENTAGE }
            });
            const _isUrl = (t) => /^(https?:\/\/|www\.)\S+$/i.test(t);
            const _refCell = (t) => {
                const kids = [];
                if (_isUrl(t) && _lib.ExternalHyperlink) {
                    kids.push(new _lib.ExternalHyperlink({ link: /^www\./i.test(t) ? 'https://' + t : t,
                        children: [new TextRun({ text: t, size: _wsTable(), color: '0000FF', underline: {} })] }));
                } else {
                    kids.push(new TextRun({ text: t, size: _wsTable(), rightToLeft: _mbRtl() }));
                }
                return new TableCell({ children: [new Paragraph({ children: kids, alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { before: 60, after: 60 } })],
                    columnSpan: 2, width: { size: 100, type: WidthType.PERCENTAGE } });
            };
            const _rows = [];
            if (hasRefs) {
                _rows.push(new TableRow({ children: [_headCell(_refsHead, 2, 100, false)], tableHeader: true }));
                mbState.referencesData.forEach(r => { const t = String(r.value || '').trim(); if (t) _rows.push(new TableRow({ children: [_refCell(t)] })); });
            }
            if (_facRows.length) {
                _rows.push(new TableRow({ children: [_headCell(_numHead, 1, 13, true), _headCell(_facHead, 1, 87, false)], tableHeader: !hasRefs }));
                _facRows.forEach(f => _rows.push(new TableRow({ children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(f.qty || '').trim(), size: _wsTable(), rightToLeft: _mbRtl() })], alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60 } })], width: { size: 13, type: WidthType.PERCENTAGE } }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(f.value).trim(), size: _wsTable(), rightToLeft: _mbRtl() })], alignment: _mbStart(AlignmentType), bidirectional: _mbRtl(), spacing: { before: 60, after: 60 } })], width: { size: 87, type: WidthType.PERCENTAGE } })
                ] })));
            }
            sections.push({ properties: { bidi: _mbRtl() }, children: [
                new Table({ rows: _rows, width: { size: 100, type: WidthType.PERCENTAGE }, visuallyRightToLeft: _mbRtl() })
            ] });
        } else if (hasRefs) {
            _mbDocxReferences({ Paragraph, TextRun, mbState, AlignmentType, sections });
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
