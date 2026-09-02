// ============================================================
// /src/exports_pdf.js
// Direct PDF export via jsPDF — a real file, straight to Downloads,
// in English, French and Arabic.
//
// ── HOW ARABIC WORKS HERE ───────────────────────────────────
// It does not work here. It works in two files loaded before this one,
// ported from DACUM Live Pro where they are already correct:
//
//   arabic-font.js  embeds a TTF, reads its cmap so the shaper knows
//                   which glyphs the font can actually draw, applies
//                   contextual joining, and reorders bidi runs.
//   pdf_arabic.js   mirrors the whole document, suspends jsPDF's own
//                   broken Arabic shaper, and neutralises its BiDi
//                   engine — which would otherwise re-reverse finished
//                   visual text and print every line backwards.
//
// Because pdf_arabic.js mirrors at the DOCUMENT level, everything in
// this file is written left-to-right and knows nothing about Arabic.
// That is the whole point of that design and the reason this file stays
// readable.
//
// ── WHY FLOWING LAYOUT, NOT FIXED COORDINATES ───────────────
// The DACUM exporter draws a chart, and fixed millimetre coordinates
// are right for a chart. Its own header states the consequence: font
// size had to stay a Word-only control there, because enlarging text
// makes lines overlap while the per-line advance stays constant, and
// every page break after that point lands wrong.
//
// A training module is flowing prose, tables and images of
// unpredictable length. So this file keeps a cursor, derives every line
// height from the CURRENT font size, and breaks the page when the
// cursor would cross the bottom margin.
//
// That is what makes it safe for the PDF to follow the Word export
// settings for SIZES as well as colours: the constraint that forced the
// reference to refuse does not exist in a flowing layout.
//
// ── CONTENT ────────────────────────────────────────────────
// From mbBuildModuleModel(), the same source as the HTML export, so all
// three exports agree on what the module contains.
// ============================================================

var _PDF_STRINGS = {
    en: {
        btn: 'Export to PDF', working: 'Building PDF…', done: 'PDF exported',
        preparingFont: 'Preparing Arabic font…',
        fontMissing: 'The Arabic font could not be loaded, and without it an Arabic PDF prints as empty boxes.\n\nAdd fonts/Cairo-Regular.ttf to the site. It must be an uncompressed .ttf — the Cairo.woff2 already there cannot be embedded in a PDF.\n\nIn the meantime, Export to Word and Export to HTML both handle Arabic correctly.',
        modulesMissing: 'Arabic PDF support is not installed. Upload src/arabic-font.js and src/pdf_arabic.js to the site, then reload with Ctrl+Shift+R.',
        tried: 'Paths tried:',
        watch: 'Watch:',
        failed: 'PDF export failed',
        overview: 'Module Overview', outcome: 'Learning Outcome', criteria: 'Performance Criteria',
        infoSheet: 'Information Sheet', activitySheet: 'Activity / Job Sheet',
        objective: 'Objective', duration: 'Duration', minutes: 'min',
        resources: 'Training Resources', material: 'Material / Equipment', qty: 'Quantity',
        steps: 'Steps', selfCheck: 'Self-Check', answersKey: 'Answers Key',
        checklist: 'Performance Criteria Check List', yes: 'Yes', no: 'No',
        assessment: 'Assessment Unit', portfolio: 'Portfolio of Evidence',
        colCriteria: 'Assessment Criteria', colActivities: 'Activities',
        colOutcomes: 'Outcomes', colVerification: 'Verification', colDate: 'Date',
        result: 'Result', competent: 'Competent', notYet: 'Not Yet Competent',
        trainer: 'Trainer', learner: 'Learner', signature: 'Signature',
        references: 'References', team: 'Work Team', intro: 'Introduction',
        name: 'Name', task: 'Task / Role', location: 'Work Location'
    },
    fr: {
        btn: 'Exporter en PDF', working: 'Création du PDF…', done: 'PDF exporté',
        preparingFont: 'Préparation de la police arabe…',
        fontMissing: 'La police arabe n\u2019a pas pu être chargée, et sans elle un PDF arabe s\u2019imprime en carrés vides.\n\nAjoutez fonts/Cairo-Regular.ttf au site. Ce doit être un .ttf non compressé — le Cairo.woff2 déjà présent ne peut pas être intégré dans un PDF.\n\nEn attendant, Exporter vers Word et Exporter en HTML gèrent tous deux l\u2019arabe correctement.',
        modulesMissing: 'La prise en charge de l\u2019arabe pour le PDF n\u2019est pas install\u00e9e. Envoyez src/arabic-font.js et src/pdf_arabic.js sur le site, puis rechargez avec Ctrl+Maj+R.',
        tried: 'Chemins essay\u00e9s :',
        watch: 'Regarder :',
        failed: 'Échec de l\u2019export PDF',
        overview: 'Aperçu du module', outcome: 'Résultat d\u2019apprentissage', criteria: 'Critères de performance',
        infoSheet: 'Fiche d\u2019information', activitySheet: 'Fiche d\u2019activité',
        objective: 'Objectif', duration: 'Durée', minutes: 'min',
        resources: 'Ressources de formation', material: 'Matériel / Équipement', qty: 'Quantité',
        steps: 'Étapes', selfCheck: 'Auto-évaluation', answersKey: 'Corrigé',
        checklist: 'Liste de vérification des critères', yes: 'Oui', no: 'Non',
        assessment: 'Unité d\u2019évaluation', portfolio: 'Portfolio de preuves',
        colCriteria: 'Critères d\u2019évaluation', colActivities: 'Activités',
        colOutcomes: 'Résultats', colVerification: 'Vérification', colDate: 'Date',
        result: 'Résultat', competent: 'Compétent', notYet: 'Pas encore compétent',
        trainer: 'Formateur', learner: 'Apprenant', signature: 'Signature',
        references: 'Références', team: 'Équipe de travail', intro: 'Introduction',
        name: 'Nom', task: 'Tâche / Rôle', location: 'Lieu de travail'
    },
    ar: {
        btn: 'تصدير PDF', working: 'جارٍ إنشاء ملف PDF…', done: 'تم تصدير PDF',
        preparingFont: 'جارٍ تجهيز الخط العربي…',
        fontMissing: 'تعذّر تحميل الخط العربي، وبدونه يخرج ملف PDF العربي مربّعات فارغة.\n\nأضف الملف fonts/Cairo-Regular.ttf إلى الموقع، بصيغة ‎.ttf‎ غير مضغوطة — فملف Cairo.woff2 الموجود لا يمكن تضمينه في PDF.\n\nوإلى حين ذلك، «تصدير إلى Word» و«تصدير HTML» كلاهما يعالج العربية بشكل صحيح.',
        modulesMissing: 'دعم العربية في PDF غير مثبَّت. ارفع الملفّين src/arabic-font.js و src/pdf_arabic.js إلى الموقع، ثم أعد التحميل بـ Ctrl+Shift+R.',
        tried: 'المسارات التي جُرِّبت:',
        watch: 'شاهد:',
        failed: 'فشل تصدير PDF',
        overview: 'نظرة عامة على الوحدة', outcome: 'ناتج التعلّم', criteria: 'معايير الأداء',
        infoSheet: 'ورقة المعلومات', activitySheet: 'ورقة النشاط/العمل',
        objective: 'الهدف', duration: 'المدة', minutes: 'دقيقة',
        resources: 'موارد التدريب', material: 'المادة / التجهيزات', qty: 'الكمية',
        steps: 'الخطوات', selfCheck: 'التحقّق الذاتي', answersKey: 'مفتاح الإجابات',
        checklist: 'قائمة التحقّق من معايير الأداء', yes: 'نعم', no: 'لا',
        assessment: 'وحدة التقييم', portfolio: 'حقيبة الأدلة',
        colCriteria: 'معايير التقييم', colActivities: 'الأنشطة',
        colOutcomes: 'النواتج', colVerification: 'التحقّق', colDate: 'التاريخ',
        result: 'النتيجة', competent: 'جدير', notYet: 'غير جدير بعد',
        trainer: 'المدرّب', learner: 'المتدرّب', signature: 'التوقيع',
        references: 'المراجع', team: 'فريق العمل', intro: 'التقديم',
        name: 'الاسم', task: 'المهمة / الدور', location: 'موقع العمل'
    }
};

function _pdfT(key, lang) {
    var tb = _PDF_STRINGS[lang] || _PDF_STRINGS.en;
    return tb[key] || _PDF_STRINGS.en[key] || key;
}

function _pdfLang() {
    try {
        if (typeof exportLang === 'function') {
            var l = exportLang();
            if (_PDF_STRINGS[l]) return l;
        }
    } catch (e) { /* fall through */ }
    return 'en';
}

/* ── Appearance, from the Word export settings ──────────────
   Colours AND sizes, safe here for the reason in the header.

   word_settings.js returns HALF-points, because that is what OOXML
   stores in w:sz. jsPDF wants points, so everything is halved on the
   way in. Getting this backwards doubles every size in the document —
   the kind of unit bug that looks like a design decision. */
function _pdfStyle() {
    var pt = function (fn, fallback) {
        try { return (typeof fn === 'function') ? fn() / 2 : fallback; }
        catch (e) { return fallback; }
    };
    var col = function (fn, fallback) {
        try { return (typeof fn === 'function') ? fn() : fallback; }
        catch (e) { return fallback; }
    };
    return {
        title:   pt(typeof _wsTitle     === 'function' ? _wsTitle     : null, 16),
        section: pt(typeof _wsSection   === 'function' ? _wsSection   : null, 14),
        sub:     pt(typeof _wsSub       === 'function' ? _wsSub       : null, 13),
        body:    pt(typeof _wsBody      === 'function' ? _wsBody      : null, 12),
        table:   pt(typeof _wsTable     === 'function' ? _wsTable     : null, 14),
        utable:  pt(typeof _wsUserTable === 'function' ? _wsUserTable : null, 11),
        heading: col(typeof _wsHeadColor === 'function' ? _wsHeadColor : null, '0070C0'),
        thFill:  col(typeof _wsTblFill   === 'function' ? _wsTblFill   : null, '0070C0'),
        thText:  col(typeof _wsTblText   === 'function' ? _wsTblText   : null, 'FFFFFF')
    };
}

/* pdf_arabic.js mirrors addImage with the signature
   (img, FORMAT, x, y, w, h). Calling it with five arguments — no format
   — shifted every coordinate one place along, which is why the QR
   landed on top of the text in Arabic exports. Always pass the format. */
function _pdfImgFormat(dataUrl) {
    var m = /^data:image\/([a-z0-9+]+)/i.exec(String(dataUrl || ''));
    var f = m ? m[1].toUpperCase() : 'PNG';
    if (f === 'JPG') f = 'JPEG';
    if (f === 'SVG+XML') f = 'PNG';
    return f;
}

function _pdfRgb(hex) {
    var h = String(hex || '000000').replace('#', '');
    return [parseInt(h.substr(0, 2), 16) || 0,
            parseInt(h.substr(2, 2), 16) || 0,
            parseInt(h.substr(4, 2), 16) || 0];
}

/* ── The flowing writer ─────────────────────────────────────
   A cursor and a few primitives. Every one of them measures BEFORE it
   draws and asks for a page when the next piece would not fit — which
   is what lets font size be a live setting rather than a constant baked
   into the geometry.

   All coordinates are left-anchored. pdf_arabic.js mirrors the document
   for Arabic, so nothing here needs a right-margin variant. */
function _pdfWriter(pdf, style, lang) {
    var W = pdf.internal.pageSize.getWidth();
    var H = pdf.internal.pageSize.getHeight();
    var M = 18;                 // page margin, mm
    var CW = W - M * 2;         // content width
    var BOTTOM = H - M;

    var w = {
        pdf: pdf, style: style, lang: lang,
        x: M, y: M, M: M, W: W, H: H, CW: CW, BOTTOM: BOTTOM,
        page: 1
    };

    /* mm per line for a given point size. 1 pt = 0.3528 mm; 1.35 is the
       leading that keeps Arabic descenders clear of the next line. */
    w.lineH = function (sizePt) { return sizePt * 0.3528 * 1.35; };

    w.newPage = function () {
        pdf.addPage();
        w.page++;
        w.y = M;
    };

    w.need = function (mm) {
        if (w.y + mm > BOTTOM) { w.newPage(); return true; }
        return false;
    };

    w.gap = function (mm) { w.y += mm; };

    /** Draws wrapped text and advances the cursor. Splits across pages
        line by line rather than moving the whole block, so a long
        paragraph never leaves most of a page blank. */
    w.text = function (str, opts) {
        opts = opts || {};
        str = String(str === null || str === undefined ? '' : str);
        if (!str.trim()) return;

        var size = opts.size || style.body;
        var indent = opts.indent || 0;
        var width = (opts.width || CW) - indent;

        pdf.setFontSize(size);
        pdf.setFont(undefined, opts.bold ? 'bold' : 'normal');
        var rgb = _pdfRgb(opts.color || '1F2430');
        pdf.setTextColor(rgb[0], rgb[1], rgb[2]);

        var lh = w.lineH(size);
        /* Author newlines are meaningful — objectives and self-checks are
           written as lists — so each is wrapped separately instead of
           being collapsed into one paragraph. */
        var paras = str.split(/\r\n|\r|\n/);
        for (var p = 0; p < paras.length; p++) {
            var lines = pdf.splitTextToSize(paras[p], width);
            if (!lines.length) { w.y += lh; continue; }
            for (var i = 0; i < lines.length; i++) {
                w.need(lh);
                pdf.text(lines[i], M + indent, w.y + lh * 0.72);
                w.y += lh;
            }
        }
        if (opts.after !== 0) w.y += (opts.after || lh * 0.35);
    };

    /** Section heading. Keeps itself with the text below by demanding
        room for a couple of lines, not just for itself — a heading alone
        at the foot of a page is the classic flowing-layout failure. */
    w.heading = function (str, level) {
        if (!String(str || '').trim()) return;
        var size = level === 1 ? style.title : (level === 2 ? style.section : style.sub);
        var lh = w.lineH(size);
        w.need(lh + w.lineH(style.body) * 2);
        w.gap(level <= 2 ? 3 : 2);
        w.text(str, { size: size, bold: true, color: style.heading, after: lh * 0.3 });
        if (level <= 2) {
            var rgb = _pdfRgb(style.heading);
            pdf.setDrawColor(rgb[0], rgb[1], rgb[2]);
            pdf.setLineWidth(level === 1 ? 0.6 : 0.3);
            pdf.line(M, w.y, M + CW, w.y);
            w.y += 2.5;
        }
    };

    /** Inline heading — "Objective:", "Step 3". Body size, bold, in the
        heading colour, exactly as the Word export renders them. */
    w.label = function (str) {
        if (!String(str || '').trim()) return;
        w.gap(1.5);
        w.text(str, { size: style.body, bold: true, color: style.heading, after: 1 });
    };

    /** A table that paginates: the header row is redrawn at the top of
        every page it continues onto, which is what makes a long
        assessment grid readable. */
    w.table = function (head, rows, colW, opts) {
        opts = opts || {};
        var size = opts.size || style.table;
        var lh = w.lineH(size);
        var padX = 2, padY = 1.6;

        var cellLines = function (cells) {
            pdf.setFontSize(size);
            return cells.map(function (c, i) {
                return pdf.splitTextToSize(String(c === null || c === undefined ? '' : c), colW[i] - padX * 2);
            });
        };
        var rowHeight = function (lines) {
            var max = 1;
            lines.forEach(function (l) { max = Math.max(max, l.length); });
            return max * lh + padY * 2;
        };

        var drawRow = function (cells, isHead) {
            pdf.setFont(undefined, isHead ? 'bold' : 'normal');
            var lines = cellLines(cells);
            var h = rowHeight(lines);
            if (w.y + h > BOTTOM) {
                w.newPage();
                if (!isHead && head) drawRow(head, true);
            }
            var cx = M;
            for (var i = 0; i < cells.length; i++) {
                if (isHead) {
                    var f = _pdfRgb(style.thFill);
                    pdf.setFillColor(f[0], f[1], f[2]);
                    pdf.rect(cx, w.y, colW[i], h, 'F');
                }
                pdf.setDrawColor(190, 195, 210);
                pdf.setLineWidth(0.2);
                pdf.rect(cx, w.y, colW[i], h, 'S');

                var tc = _pdfRgb(isHead ? style.thText : '1F2430');
                pdf.setTextColor(tc[0], tc[1], tc[2]);
                pdf.setFontSize(size);
                for (var j = 0; j < lines[i].length; j++) {
                    pdf.text(lines[i][j], cx + padX, w.y + padY + lh * (j + 0.72));
                }
                cx += colW[i];
            }
            w.y += h;
        };

        w.need(w.lineH(size) * 3);
        if (head) drawRow(head, true);
        rows.forEach(function (r) { drawRow(r, false); });
        pdf.setFont(undefined, 'normal');
        w.y += 2;
    };

    /** Images are base64 data URLs already. Scaled to fit the content
        width, and never taller than most of a page — a full-page
        photograph pushes everything after it onto a page of its own. */
    w.image = function (dataUrl, maxWmm) {
        if (!dataUrl) return;
        try {
            var props = pdf.getImageProperties(dataUrl);
            var maxW = Math.min(maxWmm || CW * 0.62, CW);
            var maxH = (BOTTOM - M) * 0.55;
            var ww = maxW;
            var hh = props.height * (ww / props.width);
            if (hh > maxH) { hh = maxH; ww = props.width * (hh / props.height); }
            w.need(hh + 2);
            pdf.addImage(dataUrl, _pdfImgFormat(dataUrl), M, w.y, ww, hh);
            w.y += hh + 3;
        } catch (e) {
            /* One unreadable image must not take the whole export down. */
            console.warn('[PDF] image skipped:', e && e.message);
        }
    };

    /** Mark box — header bar in the mark's own theme colour, then the
        text. The mark theme is the author's choice per note, so it is
        NOT overridden by the Word heading colour. */
    w.mark = function (m) {
        var size = style.body;
        var lh = w.lineH(size);
        pdf.setFontSize(size);
        var lines = pdf.splitTextToSize(String(m.text || ''), CW - 6);
        var hdrH = lh + 2;
        var bodyH = lines.length * lh + 3;
        w.need(hdrH + bodyH + 2);

        var hb = _pdfRgb(m.header);
        pdf.setFillColor(hb[0], hb[1], hb[2]);
        pdf.rect(M, w.y, CW, hdrH, 'F');
        var ht = _pdfRgb(m.headerText || 'FFFFFF');
        pdf.setTextColor(ht[0], ht[1], ht[2]);
        pdf.setFont(undefined, 'bold');
        pdf.text(String((m.icon ? m.icon + ' ' : '') + (m.label || '')), M + 3, w.y + lh * 0.82);
        w.y += hdrH;

        var bb = _pdfRgb(m.bg || 'F5F5F5');
        pdf.setFillColor(bb[0], bb[1], bb[2]);
        pdf.rect(M, w.y, CW, bodyH, 'F');
        var br = _pdfRgb(m.border || m.header);
        pdf.setDrawColor(br[0], br[1], br[2]);
        pdf.setLineWidth(0.3);
        pdf.rect(M, w.y - hdrH, CW, hdrH + bodyH, 'S');

        pdf.setTextColor(31, 36, 48);
        pdf.setFont(undefined, 'normal');
        for (var i = 0; i < lines.length; i++) {
            pdf.text(lines[i], M + 3, w.y + 1.5 + lh * (i + 0.72));
        }
        w.y += bodyH + 3;
    };

    return w;
}

/* ── The document ───────────────────────────────────────────
   Same order as the Word and HTML exports, from the same model. */
function _pdfBuild(pdf, model, lang) {
    var style = _pdfStyle();
    var w = _pdfWriter(pdf, style, lang);
    var t = function (k) { return _pdfT(k, lang); };
    var S = style;

    /* Front cover, when there is one: full page, then break. */
    if (model.cover.frontImage) {
        try {
            var p = pdf.getImageProperties(model.cover.frontImage);
            var cw = w.CW, ch = p.height * (cw / p.width);
            var maxH = w.BOTTOM - w.M;
            if (ch > maxH) { ch = maxH; cw = p.width * (ch / p.height); }
            pdf.addImage(model.cover.frontImage, _pdfImgFormat(model.cover.frontImage), w.M, w.M, cw, ch);
            w.newPage();
        } catch (e) { console.warn('[PDF] front cover skipped:', e && e.message); }
    }

    w.heading(model.title, 1);

    if (model.cover.notesAbove) w.text(model.cover.notesAbove);
    if (model.cover.rows.length) {
        w.table(null,
            model.cover.rows.map(function (r) { return [r.label, r.value]; }),
            [w.CW * 0.38, w.CW * 0.62], { size: S.body });
    }
    if (model.cover.notesBelow) w.text(model.cover.notesBelow);

    /* Introduction */
    if (model.intro.team.length || model.intro.blocks.length || model.intro.additional) {
        w.heading(t('intro'), 2);
        if (model.intro.team.length) {
            w.label(t('team'));
            w.table([t('name'), t('task'), t('location')],
                model.intro.team.map(function (m) { return [m.name, m.task, m.location]; }),
                [w.CW * 0.34, w.CW * 0.4, w.CW * 0.26], { size: S.body });
        }
        model.intro.blocks.forEach(function (b) {
            if (b.title) w.label(b.title);
            if (b.body) w.text(b.body);
        });
        if (model.intro.additional) w.text(model.intro.additional);
    }

    /* Overview — generated, never typed by the author. */
    if (model.outcomes.length) {
        w.heading(t('overview'), 2);
        model.outcomes.forEach(function (o) {
            w.label(t('outcome') + ' ' + o.index + ': ' + o.title);
            if (o.description) w.text(o.description, { indent: 4 });
            if (o.criteria.length) {
                w.text(t('criteria') + ':', { indent: 4, bold: true, size: S.body });
                o.criteria.forEach(function (c, i) {
                    w.text((i + 1) + '. ' + c, { indent: 9 });
                });
            }
            w.gap(2);
        });
    }

    /* Outcomes and their sheets */
    model.outcomes.forEach(function (o) {
        w.newPage();
        w.heading(t('outcome') + ' ' + o.index + ': ' + o.title, 2);
        if (o.description) w.text(o.description);
        if (o.criteria.length) {
            w.label(t('criteria'));
            o.criteria.forEach(function (c, i) { w.text((i + 1) + '. ' + c, { indent: 5 }); });
        }
        o.blocks.forEach(function (b) {
            if (b.title) w.label(b.title);
            if (b.body) w.text(b.body);
        });

        o.infoSheets.forEach(function (sh) {
            w.newPage();
            w.heading(t('infoSheet') + ' ' + sh.number + ': ' + sh.title, 3);
            if (sh.objectiveLead) w.text(sh.objectiveLead);
            if (sh.objective) { w.label(t('objective')); w.text(sh.objective, { indent: 4 }); }

            sh.sections.forEach(function (cs) {
                if (cs.heading) w.label(cs.heading);
                if (cs.text) w.text(cs.text);
                cs.images.forEach(function (im) { w.image(im); });
                cs.tables.forEach(function (tb) {
                    if (!tb.cells.length) return;
                    var cols = tb.cells[0].length || 1;
                    var cw = [];
                    for (var i = 0; i < cols; i++) cw.push(w.CW / cols);
                    w.table(tb.cells[0], tb.cells.slice(1), cw, { size: S.utable });
                });
                cs.marks.forEach(function (m) { w.mark(m); });
            });

            if (sh.qr) _pdfQR(w, sh.qr);

            /* Self-check and the key each start a page, as in Word: a
               key that begins halfway down the question page is a key
               the trainee reads by accident. */
            if (sh.selfCheck) {
                w.newPage();
                w.heading(t('selfCheck') + ' ' + sh.selfCheck.number, 3);
                w.text(sh.selfCheck.content);
            }
            if (sh.answersKey) {
                w.newPage();
                w.heading(t('answersKey') + ' ' + sh.answersKey.number, 3);
                w.text(sh.answersKey.content);
            }
        });

        o.activitySheets.forEach(function (sh) {
            w.newPage();
            w.heading(t('activitySheet') + ' ' + sh.number + ': ' + sh.title, 3);
            if (sh.objectiveLead) w.text(sh.objectiveLead);
            if (sh.objective) { w.label(t('objective')); w.text(sh.objective, { indent: 4 }); }
            if (sh.duration) w.text(t('duration') + ': ' + sh.duration + ' ' + t('minutes'), { bold: true });

            if (sh.resources.length) {
                w.label(t('resources'));
                w.table([t('material'), t('qty')],
                    sh.resources.map(function (r) { return [r.name, r.quantity]; }),
                    [w.CW * 0.72, w.CW * 0.28], { size: S.table });
            }

            if (sh.steps.length) {
                w.label(t('steps'));
                sh.steps.forEach(function (s) {
                    w.text(s.index + '. ' + s.text, { indent: 4 });
                    s.images.forEach(function (im) { w.image(im); });
                    (s.tables || []).forEach(function (tb) {
                        if (!tb.cells.length) return;
                        var cols = tb.cells[0].length || 1;
                        var cw = [];
                        for (var i = 0; i < cols; i++) cw.push(w.CW / cols);
                        w.table(tb.cells[0], tb.cells.slice(1), cw, { size: S.utable });
                    });
                    s.marks.forEach(function (m) { w.mark(m); });
                });
            }

            if (sh.qr) _pdfQR(w, sh.qr);

            if (sh.criteria.rows.length) {
                w.newPage();
                w.heading(sh.criteria.title || (t('checklist') + ' ' + sh.number), 3);
                if (sh.criteria.instruction) w.text(sh.criteria.instruction);
                w.table(['#', t('criteria'), t('yes'), t('no')],
                    sh.criteria.rows.map(function (c, i) { return [String(i + 1), c, '', '']; }),
                    [w.CW * 0.08, w.CW * 0.62, w.CW * 0.15, w.CW * 0.15], { size: S.table });
                if (sh.criteria.footer) w.text(sh.criteria.footer);
            }
        });
    });

    /* Assessment */
    if (model.assessment.length) {
        w.newPage();
        w.heading(t('assessment'), 2);
        model.assessment.forEach(function (f, idx) {
            if (idx) w.newPage();
            w.label(t('portfolio') + ' — ' + t('outcome') + ' ' + f.outcomeIndex + ': ' + f.outcomeTitle);
            if (f.rows.length) {
                w.table([t('colCriteria'), t('colActivities'), t('colOutcomes'), t('colVerification'), t('colDate')],
                    f.rows.map(function (r) {
                        return [r.criteria, r.activities, r.outcomes, r.verification, r.date];
                    }),
                    [w.CW * 0.28, w.CW * 0.2, w.CW * 0.2, w.CW * 0.19, w.CW * 0.13],
                    { size: S.body });
            }
            w.text(t('result') + ':  ' + (f.competent ? '[X] ' : '[  ] ') + t('competent') +
                   '     ' + (f.notYetCompetent ? '[X] ' : '[  ] ') + t('notYet'), { bold: true });
            w.table(null, [
                [t('trainer'), f.teacherName, t('signature') + ': ______________', f.teacherDate],
                [t('learner'), f.learnerName, t('signature') + ': ______________', f.learnerDate]
            ], [w.CW * 0.16, w.CW * 0.3, w.CW * 0.36, w.CW * 0.18], { size: S.body });
        });
    }

    /* References */
    if (model.references.items.length) {
        w.newPage();
        w.heading(model.references.title || t('references'), 2);
        model.references.items.forEach(function (r, i) {
            w.text((i + 1) + '. ' + r, { indent: 3 });
        });
    }

    if (model.cover.backImage) {
        try {
            w.newPage();
            var p2 = pdf.getImageProperties(model.cover.backImage);
            var bw = w.CW, bh = p2.height * (bw / p2.width);
            var mh = w.BOTTOM - w.M;
            if (bh > mh) { bh = mh; bw = p2.width * (bh / p2.height); }
            pdf.addImage(model.cover.backImage, _pdfImgFormat(model.cover.backImage), w.M, w.M, bw, bh);
        } catch (e) { console.warn('[PDF] back cover skipped:', e && e.message); }
    }

    return w;
}

/* One bordered row, full content width: the caption and address in a
   wide cell, the QR in a narrow one beside it — the same shape the Word
   export produces, so the two documents match. It was a vertical stack,
   which matched nothing. */
function _pdfQR(w, qr) {
    const pdf = w.pdf, S = w.style;
    const size = S.body;
    const lh = w.lineH(size);
    /* Two EQUAL cells, as the Word table has. The QR cell was 2.5 cm
       wide holding a 2.5 cm image, so once cell padding was subtracted
       the code spilled across the divider into the text. */
    /* Matches the Word table: a narrow cell for the code, the rest for
       the address, which is the long content. */
    const qrCellW = 32;
    const textW = w.CW - qrCellW;
    const padX = 3, padY = 2.5;

    const watch = _pdfT('watch', w.lang);
    const caption = (qr.subject || '').trim()
        ? watch + ' ' + qr.subject
        : ((qr.url || '').trim() ? watch : '');

    pdf.setFontSize(size);
    const capLines = caption ? pdf.splitTextToSize(caption, textW - padX * 2) : [];
    const urlLines = qr.url ? pdf.splitTextToSize(qr.url, textW - padX * 2) : [];
    const textH = (capLines.length + urlLines.length) * lh + padY * 2;
    /* The image drives the row height when it is the taller of the two,
       so it always fits inside its own cell. */
    const qrSide = qr.image ? Math.min(25, qrCellW - padX * 2) : 0;
    const rowH = Math.max(textH, qrSide + padY * 2, lh * 2);

    w.need(rowH + 6);
    w.gap(3);
    const top = w.y;

    pdf.setDrawColor(120, 128, 145);
    pdf.setLineWidth(0.25);
    pdf.rect(w.M, top, textW, rowH, 'S');
    pdf.rect(w.M + textW, top, qrCellW, rowH, 'S');

    let ty = top + padY;
    pdf.setFont(undefined, 'normal');
    pdf.setTextColor(31, 36, 48);
    capLines.forEach(function (l) { pdf.text(l, w.M + padX, ty + lh * 0.72); ty += lh; });
    const link = _pdfRgb('0563C1');
    pdf.setTextColor(link[0], link[1], link[2]);
    urlLines.forEach(function (l) { pdf.text(l, w.M + padX, ty + lh * 0.72); ty += lh; });
    pdf.setTextColor(31, 36, 48);

    if (qr.image) {
        try {
            pdf.addImage(qr.image, _pdfImgFormat(qr.image),
                w.M + textW + (qrCellW - qrSide) / 2,
                top + (rowH - qrSide) / 2,
                qrSide, qrSide);
        } catch (e) { console.warn('[PDF] QR skipped:', e && e.message); }
    }

    w.y = top + rowH + 4;
}

/* Page numbers last, when the total is finally known. Drawn OUTSIDE the
   mirror: a page number is chrome, not content, and mirroring it would
   put it under the opposite corner from the one the reader expects. */
function _pdfPageNumbers(pdf, lang) {
    var total = pdf.internal.getNumberOfPages();
    var W = pdf.internal.pageSize.getWidth();
    var H = pdf.internal.pageSize.getHeight();
    for (var i = 1; i <= total; i++) {
        pdf.setPage(i);
        pdf.setFontSize(9);
        pdf.setFont(undefined, 'normal');
        pdf.setTextColor(140, 146, 160);
        pdf.text(i + ' / ' + total, W / 2, H - 8, { align: 'center' });
    }
}

/* ── Entry point ───────────────────────────────────────────── */

async function mbExportToPdf() {
    var lang = _pdfLang();
    var restoreParser = null;
    var pdf = null;
    try {
        /* Same gate as the other two exporters, reached through the same
           helper, so an empty module gives one message wherever the user
           pressed. */
        var ready = (typeof _hxReadiness === 'function')
            ? _hxReadiness(lang)
            : (typeof mbCheckExportReadiness === 'function'
                ? mbCheckExportReadiness(lang) : { ok: true });
        if (!ready.ok) {
            var rmsg = ready.title + '\n\n' + ready.message;
            if (typeof mbAlert === 'function') await mbAlert(rmsg); else alert(rmsg);
            if (typeof showStatus === 'function') showStatus(ready.title, 'error');
            return;
        }

        if (!window.jspdf || !window.jspdf.jsPDF) {
            throw new Error('jsPDF did not load. Check the <script> tag for jspdf in index.html.');
        }
        var jsPDF = window.jspdf.jsPDF;

        /* Word appearance settings are re-read per export, exactly as the
           Word exporter does, so a change in the dialog reaches the very
           next PDF with no reload. */
        if (typeof _wsBeginExport === 'function') _wsBeginExport();

        var isArabic = (lang === 'ar');

        /* The chosen face, from the Word-export settings dialog. */
        if (isArabic && typeof setPreferredArabicFont === 'function' && typeof _wsPdfFont === 'function') {
            setPreferredArabicFont(_wsPdfFont());
        }

        /* The font is a fetch, and it must be in the cache BEFORE the
           document is built — installArabicRTL registers it on the
           instance from the module-level cache. Awaiting here rather
           than inside the layout keeps the drawing code synchronous. */
        if (isArabic) {
            if (typeof showStatus === 'function') showStatus(_pdfT('preparingFont', lang), 'info');
            var fontName = null, loadErr = null;
            try {
                if (typeof ensureArabicFont !== 'function') {
                    throw new Error('src/arabic-font.js and src/pdf_arabic.js are not loaded.');
                }
                fontName = await ensureArabicFont(jsPDF);
            } catch (e) {
                loadErr = e;
                console.error('[PDF] Arabic font load failed:', e);
            }
            if (!fontName) {
                /* Refuse rather than produce a document of empty boxes.
                   jsPDF drops unmapped characters silently, so without
                   this the export would "succeed" and the file would be
                   blank — the worst possible outcome. */
                /* Say WHAT failed, not just THAT it failed. The first
                   version reported a missing font file even when the
                   real cause was that the Arabic modules themselves had
                   not been uploaded — sending the user to look in the
                   wrong place. */
                var fmsg = _pdfT('fontMissing', lang);
                if (loadErr && /not loaded/.test(String(loadErr.message))) {
                    fmsg = _pdfT('modulesMissing', lang);
                } else if (typeof getArabicFontAttempts === 'function') {
                    var tried = getArabicFontAttempts();
                    if (tried.length) fmsg += '\n\n' + _pdfT('tried', lang) + '\n• ' + tried.join('\n• ');
                }
                if (typeof mbAlert === 'function') await mbAlert(fmsg); else alert(fmsg);
                if (typeof showStatus === 'function') showStatus(_pdfT('failed', lang), 'error');
                return;
            }
        }

        if (typeof showStatus === 'function') showStatus(_pdfT('working', lang), 'info');

        var model = mbBuildModuleModel(lang);
        pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });

        /* Order matters and is taken from the reference exporter:
           suspend jsPDF's own shaper FIRST, then install the mirror.
           Installing first would let the suspended-parser patch wrap
           already-wrapped methods. */
        if (isArabic) {
            restoreParser = suspendJsPdfArabicParser(pdf, jsPDF);
            installArabicRTL(pdf);
        }

        _pdfBuild(pdf, model, lang);

        /* Page numbers after the mirror is torn down — see the note on
           _pdfPageNumbers. */
        if (restoreParser) { restoreParser(); restoreParser = null; }
        _pdfPageNumbers(pdf, lang);

        var name = (typeof getExportFilename === 'function')
            ? getExportFilename('pdf') : 'module.pdf';
        pdf.save(name);

        if (typeof showStatus === 'function') showStatus(_pdfT('done', lang), 'success');

    } catch (e) {
        console.error('PDF export failed:', e);
        var msg = _pdfT('failed', lang) + ': ' + (e && e.message ? e.message : e);
        if (typeof mbAlert === 'function') await mbAlert(msg); else alert(msg);
        if (typeof showStatus === 'function') showStatus(_pdfT('failed', lang), 'error');
    } finally {
        /* ALWAYS restore. Leaving jsPDF's shaper suspended would corrupt
           the next Arabic export in the same session. */
        if (restoreParser) { try { restoreParser(); } catch (e) { /* nothing to do */ } }
    }
}

function _pdfPaintButton() {
    var span = document.querySelector('[data-act="mbExportToPdf"] span:not(.figma-btn-icon)');
    if (!span) return;
    /* Interface language, not export language: this is a toolbar label. */
    var ui = 'en';
    try {
        if (window.i18n && typeof window.i18n.getLang === 'function') {
            var l = window.i18n.getLang();
            if (_PDF_STRINGS[l]) ui = l;
        }
    } catch (e) { /* dictionary not up yet */ }
    span.textContent = _pdfT('btn', ui);
}

if (typeof window !== 'undefined') {
    window.addEventListener('mb:langchange', _pdfPaintButton);
    document.addEventListener('DOMContentLoaded', _pdfPaintButton);
}
