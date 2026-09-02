// ============================================================
// /src/exports_html.js
// Exports the module as ONE self-contained, interactive .html file.
//
// ── WHAT THIS IS FOR ────────────────────────────────────────
// The Word export is a document to print and hand over. This is a
// learning package to open: it has a table of contents that follows you
// down the page, a search box, self-check answers that stay hidden until
// the trainee asks for them, and checklists the trainee can actually
// tick. None of that survives a .docx.
//
// ── SELF-CONTAINED, LITERALLY ───────────────────────────────
// One file. Images are already base64 data URLs in mbState, so they go
// in as they are; the CSS and JS are inlined. No folder of assets, no
// server, no build step. Double-click and it opens; attach it to an
// email and it still opens.
//
// The cost is size. A module with twenty photographs produces a large
// file, because base64 is a third bigger than the bytes it encodes. That
// is the price of "one file that always works", and it is the right
// trade for a training package that gets emailed around.
//
// ── WHAT IT DOES NOT DECIDE ─────────────────────────────────
// Which outcomes, sheets and forms belong in the export is
// module_model.js's job, not this file's. This file receives a model and
// renders it. That is what keeps the HTML and the Word file agreeing
// about what the module contains.
// ============================================================

/* ── Strings ────────────────────────────────────────────────
   Owned here, like word_settings.js owns its own, so a language can
   never be missing from an export because a key was missed in the main
   dictionary. */
var _HX_STRINGS = {
    en: {
        btn: 'Export to HTML', exporting: 'Building HTML…', done: 'HTML exported',
        emptyTitle: 'Nothing to export yet',
        emptyBody: 'This module has no content yet. Add a Learning Outcome, then add an Information Sheet or an Activity Sheet to it.',
        contents: 'Contents', search: 'Search this module…', noResults: 'Nothing found',
        overview: 'Module Overview', team: 'Work Team', intro: 'Introduction',
        outcome: 'Learning Outcome', criteria: 'Performance Criteria',
        infoSheet: 'Information Sheet', activitySheet: 'Activity / Job Sheet',
        objective: 'Objective', duration: 'Duration', minutes: 'min',
        resources: 'Training Resources', material: 'Material / Equipment', qty: 'Quantity',
        steps: 'Steps', step: 'Step',
        selfCheck: 'Self-Check', answersKey: 'Answers Key',
        showAnswers: 'Show answers', hideAnswers: 'Hide answers',
        checklist: 'Performance Criteria Check List', done2: 'Done',
        assessment: 'Assessment Unit', portfolio: 'Portfolio of Evidence',
        colCriteria: 'Assessment Criteria', colActivities: 'Activities',
        colOutcomes: 'Outcomes', colVerification: 'Verification', colDate: 'Date',
        result: 'Result', competent: 'Competent', notYet: 'Not Yet Competent',
        trainer: 'Trainer', learner: 'Learner',
        references: 'References', print: 'Print', progress: 'read',
        name: 'Name', task: 'Task / Role', location: 'Work Location',
        generated: 'Generated', backTop: 'Top'
    },
    fr: {
        btn: 'Exporter en HTML', exporting: 'Création du HTML…', done: 'HTML exporté',
        emptyTitle: 'Rien à exporter pour l\u2019instant',
        emptyBody: 'Ce module n\u2019a pas encore de contenu. Ajoutez un résultat d\u2019apprentissage, puis une fiche d\u2019information ou une fiche d\u2019activité.',
        contents: 'Sommaire', search: 'Rechercher dans ce module…', noResults: 'Aucun résultat',
        overview: 'Aperçu du module', team: 'Équipe de travail', intro: 'Introduction',
        outcome: 'Résultat d\u2019apprentissage', criteria: 'Critères de performance',
        infoSheet: 'Fiche d\u2019information', activitySheet: 'Fiche d\u2019activité',
        objective: 'Objectif', duration: 'Durée', minutes: 'min',
        resources: 'Ressources de formation', material: 'Matériel / Équipement', qty: 'Quantité',
        steps: 'Étapes', step: 'Étape',
        selfCheck: 'Auto-évaluation', answersKey: 'Corrigé',
        showAnswers: 'Afficher les réponses', hideAnswers: 'Masquer les réponses',
        checklist: 'Liste de vérification des critères', done2: 'Fait',
        assessment: 'Unité d\u2019évaluation', portfolio: 'Portfolio de preuves',
        colCriteria: 'Critères d\u2019évaluation', colActivities: 'Activités',
        colOutcomes: 'Résultats', colVerification: 'Vérification', colDate: 'Date',
        result: 'Résultat', competent: 'Compétent', notYet: 'Pas encore compétent',
        trainer: 'Formateur', learner: 'Apprenant',
        references: 'Références', print: 'Imprimer', progress: 'lu',
        name: 'Nom', task: 'Tâche / Rôle', location: 'Lieu de travail',
        generated: 'Généré le', backTop: 'Haut'
    },
    ar: {
        btn: 'تصدير HTML', exporting: 'جارٍ إنشاء ملف HTML…', done: 'تم تصدير HTML',
        emptyTitle: 'لا يوجد ما يُصدَّر بعد',
        emptyBody: 'هذه الوحدة بلا محتوى حتى الآن. أضف ناتج تعلّم، ثم أضف إليه ورقة معلومات أو ورقة نشاط.',
        contents: 'المحتويات', search: 'ابحث في هذه الوحدة…', noResults: 'لا نتائج',
        overview: 'نظرة عامة على الوحدة', team: 'فريق العمل', intro: 'التقديم',
        outcome: 'ناتج التعلّم', criteria: 'معايير الأداء',
        infoSheet: 'ورقة المعلومات', activitySheet: 'ورقة النشاط/العمل',
        objective: 'الهدف', duration: 'المدة', minutes: 'دقيقة',
        resources: 'موارد التدريب', material: 'المادة / التجهيزات', qty: 'الكمية',
        steps: 'الخطوات', step: 'الخطوة',
        selfCheck: 'التحقّق الذاتي', answersKey: 'مفتاح الإجابات',
        showAnswers: 'إظهار الإجابات', hideAnswers: 'إخفاء الإجابات',
        checklist: 'قائمة التحقّق من معايير الأداء', done2: 'منجَز',
        assessment: 'وحدة التقييم', portfolio: 'حقيبة الأدلة',
        colCriteria: 'معايير التقييم', colActivities: 'الأنشطة',
        colOutcomes: 'النواتج', colVerification: 'التحقّق', colDate: 'التاريخ',
        result: 'النتيجة', competent: 'جدير', notYet: 'غير جدير بعد',
        trainer: 'المدرّب', learner: 'المتدرّب',
        references: 'المراجع', print: 'طباعة', progress: 'مقروء',
        name: 'الاسم', task: 'المهمة / الدور', location: 'موقع العمل',
        generated: 'أُنشئ في', backTop: 'الأعلى'
    }
};

function _hxT(key, lang) {
    var table = _HX_STRINGS[lang] || _HX_STRINGS.en;
    return table[key] || _HX_STRINGS.en[key] || key;
}

/* ── Escaping ───────────────────────────────────────────────
   Everything from the model is author text and goes through this. A
   module about HTML would otherwise close its own tags, and a stray
   `<` in a formula would silently swallow the rest of a paragraph. */
function _hxEsc(s) {
    return String(s === null || s === undefined ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Author line breaks are meaningful — objectives and self-checks are
    written as lists. Escaped first, THEN newlines become <br>. */
function _hxText(s) {
    return _hxEsc(s).replace(/\r\n|\r|\n/g, '<br>');
}

function _hxSlug(s, fallback) {
    var out = String(s || '').toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]+/g, '-').replace(/^-|-$/g, '');
    return out || fallback;
}

/* ── Fragments ─────────────────────────────────────────────── */

function _hxImages(images) {
    if (!images || !images.length) return '';
    return '<div class="mx-imgs">' + images.map(function (src) {
        return '<img src="' + _hxEsc(src) + '" alt="" loading="lazy">';
    }).join('') + '</div>';
}

function _hxMarks(marks) {
    if (!marks || !marks.length) return '';
    return marks.map(function (m) {
        return '<div class="mx-mark" style="border-color:' + _hxEsc(m.border) + ';background:' + _hxEsc(m.bg) + '">' +
               '<div class="mx-mark-h" style="background:' + _hxEsc(m.header) + ';color:' + _hxEsc(m.headerText) + '">' +
               _hxEsc(m.icon) + ' ' + _hxEsc(m.label) + '</div>' +
               '<div class="mx-mark-b">' + _hxText(m.text) + '</div></div>';
    }).join('');
}

function _hxTables(tables) {
    if (!tables || !tables.length) return '';
    return tables.map(function (t) {
        return '<table class="mx-utable"><tbody>' + t.cells.map(function (row, ri) {
            return '<tr>' + row.map(function (c) {
                return ri === 0 ? '<th>' + _hxText(c) + '</th>' : '<td>' + _hxText(c) + '</td>';
            }).join('') + '</tr>';
        }).join('') + '</tbody></table>';
    }).join('');
}

function _hxQR(qr, L) {
    if (!qr) return '';

    /* A video link becomes a PLAYER, not a hyperlink. This is the one
       thing the HTML package can do that paper cannot: the trainee
       watches the demonstration where the step is described instead of
       copying a URL into another tab.

       Detection is shared with link_modal.js so the dialog's promise
       and the exported file cannot disagree. */
    var embed = (typeof mbLinkIsVideo === 'function' && mbLinkIsVideo(qr.url, qr.linkType))
        ? (typeof mbVideoEmbed === 'function' ? mbVideoEmbed(qr.url) : null)
        : null;

    if (embed) {
        var player = (embed.kind === 'video')
            ? '<video class="mx-video" controls preload="metadata" src="' + _hxEsc(embed.src) + '"></video>'
            : '<div class="mx-video-frame"><iframe src="' + _hxEsc(embed.src) + '" title="' +
              _hxEsc(qr.subject || 'video') + '" frameborder="0" loading="lazy" ' +
              'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ' +
              'allowfullscreen></iframe></div>';
        return '<div class="mx-media">' +
                 (qr.subject ? '<div class="mx-sub">' + _hxEsc(qr.subject) + '</div>' : '') +
                 player +
                 '<div class="mx-media-foot">' +
                   (qr.image ? '<img class="mx-qr-img sm" src="' + _hxEsc(qr.image) + '" alt="QR">' : '') +
                   '<a class="mx-qr-url" href="' + _hxEsc(qr.url) + '" target="_blank" rel="noopener">' + _hxEsc(qr.url) + '</a>' +
                 '</div>' +
               '</div>';
    }

    var body = '';
    if (qr.image) body += '<img class="mx-qr-img" src="' + _hxEsc(qr.image) + '" alt="QR">';
    var txt = '';
    if (qr.subject) txt += '<div class="mx-qr-sub">' + _hxEsc(qr.subject) + '</div>';
    if (qr.url) txt += '<a class="mx-qr-url" href="' + _hxEsc(qr.url) + '" target="_blank" rel="noopener">' + _hxEsc(qr.url) + '</a>';
    if (!body && !txt) return '';
    return '<div class="mx-qr">' + body + '<div>' + txt + '</div></div>';
}

function _hxSection(id, kicker, title, inner) {
    return '<section class="mx-sec" id="' + _hxEsc(id) + '">' +
           (kicker ? '<div class="mx-kicker">' + _hxEsc(kicker) + '</div>' : '') +
           '<h2>' + _hxEsc(title) + '</h2>' + inner + '</section>';
}

/* ── The document ──────────────────────────────────────────── */

function mbBuildModuleHtml(model, opts) {
    if (!model) return '';
    /* opts.print: the same document, tuned for paper. The reading
       package and the printable one must come from ONE renderer — two
       renderers would drift, and a PDF that disagrees with the HTML is
       the same failure as an HTML that disagrees with the Word file. */
    opts = opts || {};
    var forPrint = !!opts.print;
    var L = model.lang;
    var t = function (k) { return _hxT(k, L); };
    var toc = [];
    var body = '';

    function add(id, navLabel, html) { toc.push({ id: id, label: navLabel }); body += html; }

    /* Section filter from the export settings. Unset means everything,
       so an install that never opens the dialog is unaffected. */
    var inc = function (id) {
        return (typeof wsHtmlIncludes === 'function') ? wsHtmlIncludes(id) : true;
    };

    /* Overview — outcomes and their criteria. Generated, exactly as the
       Word export generates it; the author never types this page. */
    if (model.outcomes.length && inc('overview')) {
        var ov = '<div class="mx-ov">' + model.outcomes.map(function (o) {
            return '<div class="mx-ov-item"><h4>' + t('outcome') + ' ' + o.index + ': ' + _hxEsc(o.title) + '</h4>' +
                   (o.description ? '<p>' + _hxText(o.description) + '</p>' : '') +
                   (o.criteria.length
                      ? '<div class="mx-sub">' + t('criteria') + '</div><ol>' +
                        o.criteria.map(function (c) { return '<li>' + _hxText(c) + '</li>'; }).join('') + '</ol>'
                      : '') + '</div>';
        }).join('') + '</div>';
        add('overview', t('overview'), _hxSection('overview', '', t('overview'), ov));
    }

    /* Cover information and introduction, when the author supplied any. */
    if (inc('overview') && (model.cover.rows.length || model.cover.notesAbove || model.cover.notesBelow)) {
        var cv = '';
        if (model.cover.notesAbove) cv += '<p>' + _hxText(model.cover.notesAbove) + '</p>';
        if (model.cover.rows.length) {
            cv += '<table class="mx-kv"><tbody>' + model.cover.rows.map(function (r) {
                return '<tr><th>' + _hxText(r.label) + '</th><td>' + _hxText(r.value) + '</td></tr>';
            }).join('') + '</tbody></table>';
        }
        if (model.cover.notesBelow) cv += '<p>' + _hxText(model.cover.notesBelow) + '</p>';
        add('module-info', t('overview') + ' · ' + t('contents'), _hxSection('module-info', '', model.title || t('overview'), cv));
        toc.pop(); toc.push({ id: 'module-info', label: model.title || t('overview') });
    }

    if (inc('intro') && (model.intro.team.length || model.intro.blocks.length || model.intro.additional)) {
        var it = '';
        if (model.intro.team.length) {
            it += '<div class="mx-sub">' + t('team') + '</div>' +
                  '<table class="mx-tbl"><thead><tr><th>' + t('name') + '</th><th>' + t('task') +
                  '</th><th>' + t('location') + '</th></tr></thead><tbody>' +
                  model.intro.team.map(function (m) {
                      return '<tr><td>' + _hxText(m.name) + '</td><td>' + _hxText(m.task) +
                             '</td><td>' + _hxText(m.location) + '</td></tr>';
                  }).join('') + '</tbody></table>';
        }
        model.intro.blocks.forEach(function (b) {
            if (b.title) it += '<div class="mx-sub">' + _hxEsc(b.title) + '</div>';
            if (b.body) it += '<p>' + _hxText(b.body) + '</p>';
        });
        if (model.intro.additional) it += '<p>' + _hxText(model.intro.additional) + '</p>';
        add('intro', t('intro'), _hxSection('intro', '', t('intro'), it));
    }

    /* Outcomes, each with its sheets in document order. */
    model.outcomes.forEach(function (o) {
        if (!inc('outcomes') && !inc('infoSheets') && !inc('activitySheets')) return;
        var oid = 'lo-' + o.index;
        var inner = '';
        if (o.description) inner += '<p>' + _hxText(o.description) + '</p>';
        if (o.criteria.length) {
            inner += '<div class="mx-sub">' + t('criteria') + '</div><ol>' +
                     o.criteria.map(function (c) { return '<li>' + _hxText(c) + '</li>'; }).join('') + '</ol>';
        }
        o.blocks.forEach(function (b) {
            if (b.title) inner += '<div class="mx-sub">' + _hxEsc(b.title) + '</div>';
            if (b.body) inner += '<p>' + _hxText(b.body) + '</p>';
        });
        if (inc('outcomes')) {
            add(oid, t('outcome') + ' ' + o.index, _hxSection(oid, t('outcome') + ' ' + o.index, o.title, inner));
        }

        (inc('infoSheets') ? o.infoSheets : []).forEach(function (sh, i) {
            var sid = oid + '-info-' + (i + 1);
            var h = '';
            if (sh.objectiveLead) h += '<p class="mx-lead">' + _hxText(sh.objectiveLead) + '</p>';
            if (sh.objective) h += '<div class="mx-sub">' + t('objective') + '</div><p>' + _hxText(sh.objective) + '</p>';
            sh.sections.forEach(function (cs) {
                h += '<div class="mx-block">';
                if (cs.heading) h += '<div class="mx-sub">' + _hxEsc(cs.heading) + '</div>';
                if (cs.text) h += '<p>' + _hxText(cs.text) + '</p>';
                h += _hxImages(cs.images) + _hxTables(cs.tables) + _hxMarks(cs.marks);
                h += '</div>';
            });
            h += _hxQR(sh.qr, L);

            /* The one thing paper cannot do: the answers stay hidden
               until the trainee has tried. On paper the key is simply
               the next page, and everybody reads ahead. */
            if (sh.selfCheck) {
                h += '<div class="mx-selfcheck"><div class="mx-sub">' + t('selfCheck') + ' ' + _hxEsc(sh.selfCheck.number) + '</div>' +
                     '<p>' + _hxText(sh.selfCheck.content) + '</p>';
                if (sh.answersKey) {
                    h += (forPrint ? '' : '<button type="button" class="mx-reveal" data-reveal="' + sid + '-ans">' + t('showAnswers') + '</button>') +
                         '<div class="mx-answers" id="' + sid + '-ans"' + (forPrint ? '' : ' hidden') + '>' +
                         '<div class="mx-sub">' + t('answersKey') + ' ' + _hxEsc(sh.answersKey.number) + '</div>' +
                         '<p>' + _hxText(sh.answersKey.content) + '</p></div>';
                }
                h += '</div>';
            } else if (sh.answersKey) {
                h += '<div class="mx-sub">' + t('answersKey') + ' ' + _hxEsc(sh.answersKey.number) + '</div><p>' +
                     _hxText(sh.answersKey.content) + '</p>';
            }

            add(sid, t('infoSheet') + ' ' + sh.number,
                _hxSection(sid, t('infoSheet') + ' ' + sh.number, sh.title, h));
        });

        (inc('activitySheets') ? o.activitySheets : []).forEach(function (sh, i) {
            var aid = oid + '-act-' + (i + 1);
            var h = '';
            var meta = [];
            if (sh.duration) meta.push(t('duration') + ': ' + _hxEsc(sh.duration) + ' ' + t('minutes'));
            if (meta.length) h += '<div class="mx-meta">' + meta.join(' · ') + '</div>';
            if (sh.objectiveLead) h += '<p class="mx-lead">' + _hxText(sh.objectiveLead) + '</p>';
            if (sh.objective) h += '<div class="mx-sub">' + t('objective') + '</div><p>' + _hxText(sh.objective) + '</p>';

            if (sh.resources.length) {
                h += '<div class="mx-sub">' + t('resources') + '</div>' +
                     '<table class="mx-tbl"><thead><tr><th>' + t('material') + '</th><th>' + t('qty') +
                     '</th></tr></thead><tbody>' + sh.resources.map(function (r) {
                         return '<tr><td>' + _hxText(r.name) + '</td><td>' + _hxText(r.quantity) + '</td></tr>';
                     }).join('') + '</tbody></table>';
            }

            if (sh.steps.length) {
                h += '<div class="mx-sub">' + t('steps') + '</div><div class="mx-steps">' +
                     sh.steps.map(function (s) {
                         return '<div class="mx-step"><div class="mx-step-n">' + s.index + '</div><div class="mx-step-b">' +
                                (s.text ? '<p>' + _hxText(s.text) + '</p>' : '') +
                                _hxImages(s.images) + _hxMarks(s.marks) + '</div></div>';
                     }).join('') + '</div>';
            }

            h += _hxQR(sh.qr, L);

            /* Tickable, and the ticks persist in the reader's own
               browser. A checklist you cannot tick is just a list. */
            if (sh.criteria.rows.length) {
                h += '<div class="mx-check"><div class="mx-sub">' +
                     _hxEsc(sh.criteria.title || (t('checklist') + ' ' + sh.number)) + '</div>';
                if (sh.criteria.instruction) h += '<p class="mx-lead">' + _hxText(sh.criteria.instruction) + '</p>';
                h += '<ol class="mx-checklist">' + sh.criteria.rows.map(function (c, ci) {
                    var cid = aid + '-c-' + ci;
                    return '<li><label><input type="checkbox" data-check="' + cid + '"><span>' + _hxText(c) + '</span></label></li>';
                }).join('') + '</ol>';
                if (sh.criteria.footer) h += '<p class="mx-lead">' + _hxText(sh.criteria.footer) + '</p>';
                h += '</div>';
            }

            add(aid, t('activitySheet') + ' ' + sh.number,
                _hxSection(aid, t('activitySheet') + ' ' + sh.number, sh.title, h));
        });
    });

    if (model.assessment.length && inc('assessment')) {
        var as = model.assessment.map(function (f) {
            var h = '<div class="mx-block"><div class="mx-sub">' + t('outcome') + ' ' + f.outcomeIndex + ': ' + _hxEsc(f.outcomeTitle) + '</div>';
            if (f.rows.length) {
                h += '<table class="mx-tbl"><thead><tr><th>' + t('colCriteria') + '</th><th>' + t('colActivities') +
                     '</th><th>' + t('colOutcomes') + '</th><th>' + t('colVerification') + '</th><th>' + t('colDate') +
                     '</th></tr></thead><tbody>' + f.rows.map(function (r) {
                         return '<tr><td>' + _hxText(r.criteria) + '</td><td>' + _hxText(r.activities) +
                                '</td><td>' + _hxText(r.outcomes) + '</td><td>' + _hxText(r.verification) +
                                '</td><td>' + _hxText(r.date) + '</td></tr>';
                     }).join('') + '</tbody></table>';
            }
            h += '<p class="mx-result"><strong>' + t('result') + ':</strong> ' +
                 (f.competent ? '☑' : '☐') + ' ' + t('competent') + ' &nbsp; ' +
                 (f.notYetCompetent ? '☑' : '☐') + ' ' + t('notYet') + '</p>';
            var sig = [];
            if (f.teacherName) sig.push(t('trainer') + ': ' + _hxEsc(f.teacherName) + (f.teacherDate ? ' — ' + _hxEsc(f.teacherDate) : ''));
            if (f.learnerName) sig.push(t('learner') + ': ' + _hxEsc(f.learnerName) + (f.learnerDate ? ' — ' + _hxEsc(f.learnerDate) : ''));
            if (sig.length) h += '<p class="mx-lead">' + sig.join('<br>') + '</p>';
            return h + '</div>';
        }).join('');
        add('assessment', t('assessment'), _hxSection('assessment', t('portfolio'), t('assessment'), as));
    }

    if (model.references.items.length && inc('references')) {
        var rf = '<ol class="mx-refs">' + model.references.items.map(function (r) {
            return '<li>' + _hxText(r) + '</li>';
        }).join('') + '</ol>';
        var rTitle = model.references.title || t('references');
        add('references', rTitle, _hxSection('references', '', rTitle, rf));
    }

    var navHtml = toc.map(function (s) {
        return '<a href="#' + _hxEsc(s.id) + '" data-nav="' + _hxEsc(s.id) + '">' + _hxEsc(s.label) + '</a>';
    }).join('');

    var coverHtml = model.cover.frontImage
        ? '<img class="mx-cover" src="' + _hxEsc(model.cover.frontImage) + '" alt="">' : '';
    var backHtml = model.cover.backImage
        ? '<img class="mx-cover" src="' + _hxEsc(model.cover.backImage) + '" alt="">' : '';

    var head = '<!DOCTYPE html>\n<html lang="' + _hxEsc(L) + '" dir="' + (model.rtl ? 'rtl' : 'ltr') + '">\n' +
      '<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
      '<title>' + _hxEsc(model.title) + '</title>\n<style>\n' + _hxCss() +
      (forPrint ? '\n' + _hxPrintCss() : '') + '\n</style>\n</head>\n<body' + (forPrint ? ' class="mx-forprint"' : '') + '>\n';

    var hero = '<header class="mx-hero">' + coverHtml +
        '<h1>' + _hxEsc(model.title) + '</h1>' +
        '<div class="mx-hero-meta">' + t('generated') + ' ' + _hxEsc(model.generatedAt.slice(0, 10)) + '</div>' +
      '</header>\n';

    /* On paper there is no navigation, no search box and no back-to-top
       button — and no script at all, because nothing in it can be
       clicked. Answers are printed rather than hidden: a trainer's copy
       needs the key, and a hidden div in a PDF is simply lost. */
    if (forPrint) {
        return head + hero + '<main class="mx-main">' + body + backHtml + '</main>\n</body>\n</html>';
    }

    return head + hero +
      '<div class="mx-shell">\n' +
        '<nav class="mx-nav" id="mx-nav">' +
          '<div class="mx-nav-h">' + t('contents') + '</div>' +
          '<input type="search" class="mx-search" id="mx-search" placeholder="' + _hxEsc(t('search')) + '" aria-label="' + _hxEsc(t('search')) + '">' +
          '<div class="mx-nav-links" id="mx-nav-links">' + navHtml + '</div>' +
          '<div class="mx-nores" id="mx-nores" hidden>' + t('noResults') + '</div>' +
          '<button type="button" class="mx-print" onclick="window.print()">🖨 ' + t('print') + '</button>' +
        '</nav>\n' +
        '<main class="mx-main" id="mx-main">' + body + backHtml + '</main>\n' +
      '</div>\n' +
      '<button type="button" class="mx-top" id="mx-top">↑ ' + t('backTop') + '</button>\n' +
      '<script>\n' + _hxJs() + '\n<\/script>\n</body>\n</html>';
}

/* ── Readiness, with a floor ────────────────────────────────
   The guard used to read `if (typeof mbCheckExportReadiness ===
   'function')`, which meant that if module_model.js failed to load the
   check was SKIPPED SILENTLY and an empty file downloaded as before —
   the exact failure the check exists to prevent, and invisible because
   nothing said the module was missing.

   Now: the real check when it is there, a minimal one when it is not,
   and a loud console message either way so a missing file is
   diagnosable instead of merely inert. */
function _hxReadiness(lang) {
    if (typeof mbCheckExportReadiness === 'function') return mbCheckExportReadiness(lang);

    console.error(
        '[Module Builder] src/module_model.js did not load. Export checks are ' +
        'running in fallback mode. Check that the file exists in src/ and that ' +
        'index.html has <script src="src/module_model.js"></script>.'
    );

    /* Fallback: crude but honest. Looks straight at the state rather
       than at the model, because the model builder lives in the file
       that is missing. */
    var st = (typeof window !== 'undefined' && window.mbState) ? window.mbState : {};
    var pick = function (v) {
        if (!v) return '';
        if (typeof v === 'string') return v;
        if (typeof v === 'object') return (v.en || '') + (v.fr || '') + (v.ar || '');
        return String(v);
    };
    var anySheet = (st.learningOutcomesData || []).some(function (lo) {
        return ((lo && lo.infoSheets) || []).concat((lo && lo.activitySheets) || [])
            .some(function (sh) { return sh && pick(sh.title).trim(); });
    });
    var anyCover = (st.coverRows || []).some(function (r) { return r && pick(r.value).trim(); });
    var anyRefs  = (st.referencesData || []).some(function (r) { return r && pick(r.value).trim(); });

    if (anySheet || anyCover || anyRefs) return { ok: true, code: 'ok', title: '', message: '' };
    return {
        ok: false, code: 'empty',
        title: _hxT('emptyTitle', lang),
        message: _hxT('emptyBody', lang)
    };
}

/* ── Entry point ───────────────────────────────────────────── */

async function mbExportToHtml() {
    try {
        if (typeof showStatus === 'function') showStatus(_hxT('exporting', _hxLang()), 'info');

        var lang = _hxLang();

        /* Checked BEFORE building anything. Downloading an empty file
           looks like the export worked and the module is at fault; the
           readiness check names which of the three situations the author
           is actually in and what to do next. */
        var ready = _hxReadiness(lang);
        {
            if (!ready.ok) {
                /* mbAlert takes a message and nothing else — a second
                   argument would be silently dropped, so the title is
                   folded into the text rather than lost. */
                var msg = ready.title + '\n\n' + ready.message;
                if (typeof mbAlert === 'function') await mbAlert(msg);
                else alert(msg);
                if (typeof showStatus === 'function') showStatus(ready.title, 'error');
                return;
            }
        }

        var model = mbBuildModuleModel(lang);
        if (!model) {
            if (typeof mbAlert === 'function') await mbAlert(_hxT('empty', lang) || 'No module to export.');
            return;
        }
        var html = mbBuildModuleHtml(model);
        var blob = new Blob([html], { type: 'text/html;charset=utf-8' });

        var name = (typeof getExportFilename === 'function')
            ? getExportFilename('html')
            : 'module.html';

        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = name;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);

        if (typeof showStatus === 'function') showStatus(_hxT('done', lang), 'success');
    } catch (e) {
        console.error('HTML export failed:', e);
        if (typeof showStatus === 'function') showStatus('HTML export failed: ' + e.message, 'error');
    }
}

function _hxLang() {
    try {
        if (typeof exportLang === 'function') {
            var l = exportLang();
            if (_HX_STRINGS[l]) return l;
        }
    } catch (e) { /* fall through */ }
    return 'en';
}

/* The toolbar label carries no data-i18n, for the same reason
   word_settings.js gives: applyTranslations() would overwrite it from a
   dictionary that does not hold these keys. */
function _hxPaintButton() {
    var span = document.querySelector('[data-act="mbExportToHtml"] span:not(.figma-btn-icon)');
    /* The INTERFACE language, not the export language: this is a label
       on the tool's own toolbar. _hxLang() answers a different question
       — which language the FILE comes out in. */
    if (span) {
        var ui = 'en';
        try {
            if (window.i18n && typeof window.i18n.getLang === 'function') {
                var l = window.i18n.getLang();
                if (_HX_STRINGS[l]) ui = l;
            }
        } catch (e) { /* dictionary not up — English is the floor */ }
        span.textContent = _hxT('btn', ui);
    }
}

if (typeof window !== 'undefined') {
    window.addEventListener('mb:langchange', _hxPaintButton);
    /* Painted once at load too, otherwise the button reads "Export to
       HTML" in an Arabic session until the user happens to switch
       language and back. */
    document.addEventListener('DOMContentLoaded', _hxPaintButton);
}

/* ── Inlined stylesheet ─────────────────────────────────────
   Written as a plain string rather than pulled from mb-styles.css: the
   tool's stylesheet is 96 KB of interface, almost none of which a
   reading package needs, and the exported file must not inherit the
   tool's chrome.

   Direction-neutral throughout — logical properties (margin-inline,
   border-inline-start, text-align:start) rather than left/right — so
   `dir="rtl"` on <html> is the only thing Arabic needs. This is the one
   place where HTML is dramatically easier than docx. */
function _hxCss() {
    return [
'*,*::before,*::after{box-sizing:border-box}',
'body{margin:0;background:#f6f7fb;color:#1f2430;line-height:1.75;',
'  font-family:"Cairo","Segoe UI",Tahoma,system-ui,-apple-system,sans-serif;font-size:16px}',
'img{max-width:100%;height:auto}',
'.mx-hero{background:linear-gradient(135deg,#5b6ee1,#8b5cf6);color:#fff;padding:44px 24px;text-align:center}',
'.mx-hero h1{margin:0;font-size:2em;font-weight:800;line-height:1.35}',
'.mx-hero-meta{margin-top:10px;font-size:.85em;opacity:.85}',
'.mx-cover{display:block;max-width:520px;margin:0 auto 22px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.25)}',
'.mx-shell{display:flex;align-items:flex-start;gap:26px;max-width:1180px;margin:0 auto;padding:26px 20px 80px}',
'.mx-nav{position:sticky;top:20px;flex:0 0 258px;background:#fff;border:1px solid #e3e6ef;border-radius:14px;',
'  padding:16px;max-height:calc(100vh - 40px);overflow-y:auto}',
'.mx-nav-h{font-weight:800;font-size:.82em;letter-spacing:.06em;text-transform:uppercase;color:#6b7280;margin-bottom:10px}',
'.mx-search{width:100%;border:1px solid #d7dbe7;border-radius:9px;padding:8px 11px;font:inherit;font-size:.88em;margin-bottom:10px}',
'.mx-nav-links{display:flex;flex-direction:column;gap:1px}',
'.mx-nav a{display:block;padding:7px 10px;border-radius:8px;color:#414a5c;text-decoration:none;font-size:.87em;',
'  border-inline-start:3px solid transparent}',
'.mx-nav a:hover{background:#f2f4fb}',
'.mx-nav a.is-on{background:#eef1fe;color:#4c5fd7;font-weight:700;border-inline-start-color:#5b6ee1}',
'.mx-nores{color:#9aa1ad;font-size:.85em;padding:8px 10px}',
'.mx-print{width:100%;margin-top:12px;border:1px solid #d7dbe7;background:#fafbff;border-radius:9px;',
'  padding:8px;font:inherit;font-size:.85em;cursor:pointer}',
'.mx-print:hover{background:#f0f2fa}',
'.mx-main{flex:1;min-width:0}',
'.mx-sec{background:#fff;border:1px solid #e3e6ef;border-radius:14px;padding:26px 28px;margin-bottom:20px}',
'.mx-sec h2{margin:0 0 16px;font-size:1.4em;font-weight:800;color:#2b3350;line-height:1.4}',
'.mx-kicker{font-size:.76em;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:#8b93a8;margin-bottom:6px}',
'.mx-sub{font-weight:800;color:#39415c;margin:18px 0 8px;font-size:1.02em}',
'.mx-sec p{margin:0 0 12px}',
'.mx-lead{color:#5c6478;font-size:.94em}',
'.mx-meta{display:inline-block;background:#eef1fe;color:#4c5fd7;border-radius:999px;padding:4px 13px;font-size:.83em;font-weight:700;margin-bottom:12px}',
'.mx-block{padding:2px 0}',
'.mx-ov-item{border-inline-start:3px solid #dfe3f3;padding-inline-start:14px;margin-bottom:18px}',
'.mx-ov-item h4{margin:0 0 6px;font-size:1.02em;color:#39415c}',
'.mx-sec ol,.mx-sec ul{margin:0 0 12px;padding-inline-start:22px}',
'.mx-sec li{margin-bottom:5px}',
'.mx-imgs{display:flex;flex-wrap:wrap;gap:12px;margin:12px 0}',
'.mx-imgs img{max-width:340px;border:1px solid #e3e6ef;border-radius:10px}',
'table{border-collapse:collapse;width:100%;margin:12px 0;font-size:.92em}',
'th,td{border:1px solid #dfe3ee;padding:9px 12px;text-align:start;vertical-align:top}',
'th{background:#f4f6fc;font-weight:700}',
'.mx-kv th{width:38%}',
'.mx-mark{border:1px solid;border-radius:10px;overflow:hidden;margin:14px 0}',
'.mx-mark-h{padding:7px 14px;font-weight:800;font-size:.88em}',
'.mx-mark-b{padding:11px 14px;font-size:.94em}',
'.mx-steps{display:flex;flex-direction:column;gap:14px}',
'.mx-step{display:flex;gap:13px;align-items:flex-start}',
'.mx-step-n{flex:0 0 30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#5b6ee1,#8b5cf6);',
'  color:#fff;font-weight:800;font-size:.85em;display:flex;align-items:center;justify-content:center;margin-top:3px}',
'.mx-step-b{flex:1;min-width:0}',
'.mx-selfcheck,.mx-check{background:#fafbff;border:1px solid #e3e6ef;border-radius:12px;padding:16px 18px;margin-top:18px}',
'.mx-reveal{border:none;background:#5b6ee1;color:#fff;border-radius:9px;padding:8px 18px;font:inherit;',
'  font-size:.87em;font-weight:700;cursor:pointer}',
'.mx-reveal:hover{background:#4c5fd7}',
'.mx-answers{margin-top:14px;border-top:1px dashed #cdd3e6;padding-top:12px}',
'.mx-checklist{list-style:none;padding:0;margin:10px 0 0}',
'.mx-checklist li{margin-bottom:8px}',
'.mx-checklist label{display:flex;gap:10px;align-items:flex-start;cursor:pointer}',
'.mx-checklist input{margin-top:6px;width:17px;height:17px;flex-shrink:0;accent-color:#5b6ee1}',
'.mx-checklist input:checked + span{color:#8b93a8;text-decoration:line-through}',
'.mx-qr{display:flex;gap:14px;align-items:center;background:#fafbff;border:1px dashed #cdd3e6;',
'  border-radius:12px;padding:14px;margin-top:16px}',
'.mx-qr-img{width:110px;height:110px;object-fit:contain}',
'.mx-qr-img.sm{width:64px;height:64px}',
'.mx-media{margin:16px 0;border:1px solid #e3e6ef;border-radius:12px;padding:14px;background:#fafbff}',
/* 16:9 without a fixed height, so the player scales on a phone. */
'.mx-video-frame{position:relative;width:100%;padding-top:56.25%;border-radius:10px;overflow:hidden;background:#000}',
'.mx-video-frame iframe{position:absolute;inset:0;width:100%;height:100%;border:0}',
'.mx-video{width:100%;border-radius:10px;background:#000;display:block}',
'.mx-media-foot{display:flex;align-items:center;gap:12px;margin-top:10px;flex-wrap:wrap}',
'.mx-qr-sub{font-weight:700;margin-bottom:4px}',
'.mx-qr-url{color:#4c5fd7;font-size:.88em;word-break:break-all}',
'.mx-result{background:#f4f6fc;border-radius:9px;padding:9px 14px}',
'.mx-top{position:fixed;bottom:22px;inset-inline-end:22px;background:#5b6ee1;color:#fff;border:none;',
'  border-radius:999px;padding:9px 17px;font:inherit;font-size:.82em;font-weight:700;cursor:pointer;',
'  box-shadow:0 6px 20px rgba(91,110,225,.4);opacity:0;pointer-events:none;transition:opacity .2s;z-index:50}',
'.mx-top.show{opacity:1;pointer-events:auto}',
'@media (max-width:900px){',
'  .mx-shell{flex-direction:column;padding:16px 12px 70px}',
'  .mx-nav{position:static;width:100%;flex:none;max-height:none}',
'  .mx-sec{padding:20px 18px}',
'}',
'@media print{',
'  body{background:#fff}',
'  .mx-nav,.mx-top,.mx-reveal{display:none!important}',
/* A player cannot be printed. The address under it can. */
'  .mx-video-frame,.mx-video{display:none!important}',
'  .mx-answers[hidden]{display:block!important}',
'  .mx-sec{break-inside:avoid;border:none;padding:0;margin-bottom:26px}',
'  .mx-hero{background:none;color:#000}',
'}'
    ].join('\n');
}

/* ── Inlined behaviour ──────────────────────────────────────
   Everything the reader can do lives here. Deliberately small and
   dependency-free: this script has to run from a file:// URL, inside an
   email client's preview, and on a phone, years from now, with no
   network. Anything clever would be a liability.

   Storage is wrapped: a file:// page in some browsers throws on
   localStorage access, and a training package must not white-screen
   because a checkbox could not remember itself. */
function _hxJs() {
    return [
'(function(){',
'  "use strict";',
'  var KEY = "mx-progress-" + (document.title || "module");',
'',
'  function load(){ try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch(e){ return {}; } }',
'  function save(o){ try { localStorage.setItem(KEY, JSON.stringify(o)); } catch(e){} }',
'',
'  /* Answers stay hidden until asked for. */',
'  document.addEventListener("click", function(e){',
'    var b = e.target.closest && e.target.closest("[data-reveal]");',
'    if (!b) return;',
'    var box = document.getElementById(b.getAttribute("data-reveal"));',
'    if (!box) return;',
'    var open = !box.hasAttribute("hidden");',
'    if (open) { box.setAttribute("hidden",""); b.textContent = b.dataset.show || b.textContent; }',
'    else { box.removeAttribute("hidden"); b.dataset.show = b.textContent; b.textContent = b.dataset.hide || b.textContent; }',
'  });',
'',
'  /* Checklist ticks persist per reader, in their own browser. */',
'  var state = load();',
'  var boxes = document.querySelectorAll("[data-check]");',
'  Array.prototype.forEach.call(boxes, function(cb){',
'    var id = cb.getAttribute("data-check");',
'    if (state[id]) cb.checked = true;',
'    cb.addEventListener("change", function(){',
'      state[id] = cb.checked; save(state);',
'    });',
'  });',
'',
'  /* Search filters the CONTENTS list, not the page: hiding sections',
'     while someone is reading one is disorienting, and the list is what',
'     they are scanning when they search. */',
'  var search = document.getElementById("mx-search");',
'  var links = document.querySelectorAll("#mx-nav-links a");',
'  var nores = document.getElementById("mx-nores");',
'  if (search) {',
'    search.addEventListener("input", function(){',
'      var q = search.value.trim().toLowerCase();',
'      var shown = 0;',
'      Array.prototype.forEach.call(links, function(a){',
'        var hit = !q || a.textContent.toLowerCase().indexOf(q) !== -1 ||',
'                  (document.getElementById(a.getAttribute("data-nav")) || {textContent:""})',
'                    .textContent.toLowerCase().indexOf(q) !== -1;',
'        a.style.display = hit ? "" : "none";',
'        if (hit) shown++;',
'      });',
'      if (nores) nores.hidden = shown > 0;',
'    });',
'  }',
'',
'  /* Which section am I in. Plain scroll maths rather than',
'     IntersectionObserver, so this works in older viewers too. */',
'  var secs = document.querySelectorAll(".mx-sec");',
'  var top = document.getElementById("mx-top");',
'  function onScroll(){',
'    var here = null;',
'    Array.prototype.forEach.call(secs, function(s){',
'      if (s.getBoundingClientRect().top <= 130) here = s.id;',
'    });',
'    Array.prototype.forEach.call(links, function(a){',
'      a.classList.toggle("is-on", a.getAttribute("data-nav") === here);',
'    });',
'    if (top) top.classList.toggle("show", window.scrollY > 600);',
'  }',
'  window.addEventListener("scroll", onScroll, { passive: true });',
'  onScroll();',
'',
'  if (top) top.addEventListener("click", function(){',
'    window.scrollTo({ top: 0, behavior: "smooth" });',
'  });',
'})();'
    ].join('\n');
}

/* ── Paper ──────────────────────────────────────────────────
   Layered ON TOP of _hxCss() rather than replacing it, so the printed
   document and the on-screen one cannot drift apart: they are the same
   stylesheet with paper rules added. */
function _hxPrintCss() {
    return [
'@page{size:A4;margin:18mm 16mm}',
'body.mx-forprint{background:#fff;font-size:11.5pt;line-height:1.7}',
'body.mx-forprint .mx-main{max-width:none}',
'body.mx-forprint .mx-hero{background:#fff;color:#1f2430;padding:0 0 18px;border-bottom:2px solid #5b6ee1;margin-bottom:22px}',
'body.mx-forprint .mx-hero h1{font-size:22pt}',
'body.mx-forprint .mx-hero-meta{color:#6b7280}',
'body.mx-forprint .mx-cover{max-width:100%;box-shadow:none;border-radius:0;break-after:page}',
/* Each section starts a page: a training package is read sheet by
   sheet, and a self-check that begins halfway down the previous page
   is a self-check the trainee reads the answers to by accident. */
'body.mx-forprint .mx-sec{border:none;border-radius:0;padding:0;margin:0 0 16px;break-inside:auto;break-before:page}',
'body.mx-forprint .mx-sec:first-child{break-before:auto}',
'body.mx-forprint .mx-sec h2{border-bottom:1.5px solid #dfe3ee;padding-bottom:7px}',
'body.mx-forprint h2,body.mx-forprint .mx-sub{break-after:avoid}',
'body.mx-forprint .mx-step,body.mx-forprint .mx-mark,body.mx-forprint tr{break-inside:avoid}',
'body.mx-forprint table{break-inside:auto}',
'body.mx-forprint thead{display:table-header-group}',
'body.mx-forprint .mx-imgs img{max-width:250px}',
'body.mx-forprint .mx-answers{border-top:1px dashed #cdd3e6}',
'body.mx-forprint .mx-selfcheck,body.mx-forprint .mx-check{background:#fff;border:1px solid #dfe3ee}',
'body.mx-forprint .mx-checklist input{-webkit-appearance:none;appearance:none;border:1.4px solid #6b7280;border-radius:3px}',
'@media print{body.mx-forprint .mx-sec{break-before:page}}'
    ].join('\n');
}
