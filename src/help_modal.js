// ============================================================
// /src/help_modal.js
// «?» help for the Information, Activity and Assessment tabs (3.60.0)
//
// WHY
// The guidance of these tabs was a folding card above the fields
// (<details class="mb-guide">): open, it pushed the sheet down; folded,
// it was forgotten. As in DACUM Live Pro, it is now a round «?» button
// at the far end of the tab's title, and the guidance opens in a modal.
//
// WHAT IS SHOWN
// The same dictionary lines the cards held (mbGuideInfo*, mbGuideAct*,
// mbGuideAsm*), in the INTERFACE language, plus, for the Assessment
// Unit, three new parts: types of assessment, assessment criteria and
// assessment methods. Lines that speak of what one module template does
// not have (the self-check, the checklist) are left out of the other
// (module_template.js); the Learner guide adds a line of its own.
//
// The button lives in the title bar (index.html, #mb-tab-help) and is
// shown only on the three tabs that have a guide — mbSyncHelpButton()
// follows the open tab through the same observer as the title (tabs.js).
// ============================================================

if (window.i18n && window.i18n.extend) window.i18n.extend({
    en: {
        hlpButton: 'Help',
        hlpGotIt: 'Got it',
        hlpInfoTitle: 'Information sheet — guidance',
        hlpActTitle: 'Activity / job sheet — guidance',
        hlpAsmTitle: 'Assessment unit — guidance',
        hlpAsmFormHead: 'Filling in the assessment form',
        hlpLgAct: 'Learner guide: choose whether the sheet contributes to the assessment and what the learner hands in (direct observation, a worksheet, a photo…). It is listed in «Contents of the portfolio».',
        hlpLgAsm: 'Learner guide: the assessment unit prints its introduction and the portfolio of evidence (texts you can edit above), the contents of the portfolio built from the sheets, and each outcome’s table from its form below (criteria, activity, output, date).',
        hlpTypesHead: 'Types of assessment',
        hlpTypeDiag: 'Diagnostic (initial) — before the training: what the learner already knows and can do, to plan the training or to start recognition of prior learning.',
        hlpTypeForm: 'Formative — during the training, to guide learning and give feedback: self-checks, checklists, worksheets, reflections. It does not decide competence.',
        hlpTypeSum: 'Summative — at the end of the learning outcome or the module: decides Competent / Not yet competent against every criterion.',
        hlpTypeRpl: 'Recognition of prior learning (RPL) — competence gained at work or elsewhere is assessed against the same criteria, with the same evidence rules, without repeating the training.',
        hlpCritHead: 'Assessment criteria',
        hlpCrit1: 'Where they come from — the performance criteria of the learning outcome (DACUM / occupational standard). One row of the form per criterion.',
        hlpCrit2: 'How to write one — one observable result: a verb, what is done, and the standard or condition — e.g. «Tightens the screws to the manufacturer’s torque without damaging the thread».',
        hlpCrit3: 'Principles of assessment — valid (assesses what the criterion says), reliable (two assessors reach the same decision), fair (no hidden barrier for the learner), flexible (the method fits the learner and the workplace).',
        hlpCrit4: 'Rules of evidence — valid, authentic (the learner’s own work), sufficient (enough to judge every criterion) and current (shows competence now).',
        hlpMethHead: 'Assessment methods',
        hlpMeth1: 'Direct observation — of the work being done, with a checklist — for skills and procedures.',
        hlpMeth2: 'Product or work sample — the finished part, report or service is checked against the criteria.',
        hlpMeth3: 'Oral or written questions — for the knowledge behind the performance: why, what if, which standard.',
        hlpMeth4: 'Portfolio of evidence — the completed activities, worksheets, photos and records collected during the training.',
        hlpMeth5: 'Project, simulation or role play — when the real work cannot be observed safely or in the time available.',
        hlpMeth6: 'Third-party report — a supervisor’s statement about performance at the workplace — supporting evidence, not alone.',
        hlpMethNote: 'Match the method to the criterion: knowledge → questions; skills → observation or product; attitudes and safety → observation over time. Use more than one method for each outcome.'
    },
    fr: {
        hlpButton: 'Aide',
        hlpGotIt: 'Compris',
        hlpInfoTitle: 'Fiche d’information — conseils',
        hlpActTitle: 'Fiche d’activité / de travail — conseils',
        hlpAsmTitle: 'Unité d’évaluation — conseils',
        hlpAsmFormHead: 'Remplir le formulaire d’évaluation',
        hlpLgAct: 'Guide de l’apprenant : indiquez si la fiche contribue à l’évaluation et ce que l’apprenant remet (observation directe, fiche de travail, photo…). Elle figure dans « Contenu du portfolio ».',
        hlpLgAsm: 'Guide de l’apprenant : l’unité d’évaluation imprime son introduction et le portfolio de preuves (textes modifiables ci-dessus), le contenu du portfolio construit à partir des fiches, et le tableau de chaque résultat à partir de son formulaire ci-dessous (critères, activité, production, date).',
        hlpTypesHead: 'Types d’évaluation',
        hlpTypeDiag: 'Diagnostique (initiale) — avant la formation : ce que l’apprenant sait et sait faire déjà, pour planifier la formation ou engager une reconnaissance des acquis.',
        hlpTypeForm: 'Formative — pendant la formation, pour guider l’apprentissage et donner un retour : auto-évaluations, listes de vérification, fiches de travail, réflexions. Elle ne décide pas de la compétence.',
        hlpTypeSum: 'Sommative — à la fin du résultat d’apprentissage ou du module : décide Compétent / Pas encore compétent pour chaque critère.',
        hlpTypeRpl: 'Reconnaissance des acquis (RAC) — la compétence acquise au travail ou ailleurs est évaluée selon les mêmes critères et les mêmes règles de preuve, sans refaire la formation.',
        hlpCritHead: 'Critères d’évaluation',
        hlpCrit1: 'D’où ils viennent — des critères de performance du résultat d’apprentissage (DACUM / norme professionnelle). Une ligne du formulaire par critère.',
        hlpCrit2: 'Comment en écrire un — un résultat observable : un verbe, ce qui est fait, et la norme ou la condition — p. ex. « Serre les vis au couple du fabricant sans abîmer le filetage ».',
        hlpCrit3: 'Principes de l’évaluation — valide (évalue ce que dit le critère), fiable (deux évaluateurs arrivent à la même décision), équitable (aucun obstacle caché pour l’apprenant), souple (la méthode convient à l’apprenant et au lieu de travail).',
        hlpCrit4: 'Règles de la preuve — valide, authentique (le travail de l’apprenant), suffisante (assez pour juger chaque critère) et actuelle (montre la compétence aujourd’hui).',
        hlpMethHead: 'Méthodes d’évaluation',
        hlpMeth1: 'Observation directe — du travail en cours, avec une liste de vérification — pour les savoir-faire et les procédures.',
        hlpMeth2: 'Produit ou échantillon de travail — la pièce, le rapport ou le service réalisé est vérifié selon les critères.',
        hlpMeth3: 'Questions orales ou écrites — pour les savoirs derrière la performance : pourquoi, et si…, quelle norme.',
        hlpMeth4: 'Portfolio de preuves — les activités, fiches de travail, photos et relevés réunis pendant la formation.',
        hlpMeth5: 'Projet, simulation ou jeu de rôle — quand le travail réel ne peut pas être observé en sécurité ou dans le temps disponible.',
        hlpMeth6: 'Rapport d’un tiers — l’attestation d’un responsable sur la performance au travail — une preuve d’appui, pas seule.',
        hlpMethNote: 'Adaptez la méthode au critère : savoirs → questions ; savoir-faire → observation ou produit ; attitudes et sécurité → observation dans la durée. Utilisez plus d’une méthode par résultat.'
    },
    ar: {
        hlpButton: 'مساعدة',
        hlpGotIt: 'فهمت',
        hlpInfoTitle: 'ورقة المعلومات — إرشادات',
        hlpActTitle: 'ورقة النشاط/العمل — إرشادات',
        hlpAsmTitle: 'وحدة التقييم — إرشادات',
        hlpAsmFormHead: 'تعبئة استمارة التقييم',
        hlpLgAct: 'في دليل المتعلم: حدّد هل تساهم الورقة في التقييم، وما الذي يسلّمه المتعلم (الملاحظة المباشرة، ورقة عمل، صورة…). تظهر الورقة في «محتويات سجل الأعمال (المحفظة)».',
        hlpLgAsm: 'في دليل المتعلم: تطبع وحدة التقييم مقدمتها وسجل الأعمال (نصان يمكنك تعديلهما في الأعلى)، ومحتويات المحفظة المبنية من الأوراق، وجدول كل محصلة من استمارتها أدناه (المعيار، النشاط، الناتج، التاريخ).',
        hlpTypesHead: 'أنواع التقييم',
        hlpTypeDiag: 'التشخيصي (القبلي) — قبل التدريب: ما يعرفه المتعلم وما يستطيع فعله مسبقاً، لتخطيط التدريب أو للبدء بالاعتراف بالتعلم السابق.',
        hlpTypeForm: 'التكويني (البنائي) — أثناء التدريب، لتوجيه التعلم وتقديم التغذية الراجعة: التقييم الذاتي، وقوائم التدقيق، وأوراق العمل، والتأمل. لا يُحكم به على الكفاءة.',
        hlpTypeSum: 'الختامي — في نهاية محصلة التعلم أو الوحدة: يُحكم فيه «كفء / غير كفء بعد» مقابل كل معيار.',
        hlpTypeRpl: 'الاعتراف بالتعلم السابق (RPL) — تُقيَّم الكفاءة المكتسبة في العمل أو خارجه مقابل المعايير نفسها، وبقواعد الأدلة نفسها، دون إعادة التدريب.',
        hlpCritHead: 'معايير التقييم',
        hlpCrit1: 'مصدرها — معايير الأداء الخاصة بمحصلة التعلم (DACUM / المعيار المهني). صف واحد في الاستمارة لكل معيار.',
        hlpCrit2: 'كيف تُكتب — نتيجة واحدة قابلة للملاحظة: فعل، وما يُنجز، والمستوى أو الشرط — مثل: «يشدّ البراغي بعزم الشركة المصنعة دون إتلاف السن».',
        hlpCrit3: 'مبادئ التقييم — الصدق (يقيس ما يقوله المعيار)، والثبات (يصل مقيّمان إلى القرار نفسه)، والعدالة (لا عائق خفي أمام المتعلم)، والمرونة (تناسب الطريقة المتعلم وموقع العمل).',
        hlpCrit4: 'قواعد الأدلة — صادقة، وأصيلة (من عمل المتعلم نفسه)، وكافية (تكفي للحكم على كل معيار)، وحديثة (تُظهر الكفاءة الآن).',
        hlpMethHead: 'طرق التقييم',
        hlpMeth1: 'الملاحظة المباشرة — لأداء العمل، مع قائمة تدقيق — للمهارات والإجراءات.',
        hlpMeth2: 'تقييم المنتج أو عينة العمل — تُفحص القطعة أو التقرير أو الخدمة المنجزة مقابل المعايير.',
        hlpMeth3: 'الأسئلة الشفهية أو التحريرية — للمعارف التي يقوم عليها الأداء: لماذا، وماذا لو، وأي معيار.',
        hlpMeth4: 'محفظة الأدلة (سجل الأعمال) — الأنشطة وأوراق العمل والصور والسجلات المكتملة التي تُجمع أثناء التدريب.',
        hlpMeth5: 'المشروع أو المحاكاة أو لعب الأدوار — عندما لا يمكن ملاحظة العمل الحقيقي بأمان أو في الوقت المتاح.',
        hlpMeth6: 'تقرير طرف ثالث — إفادة المشرف عن الأداء في موقع العمل — دليل داعم لا يُعتمد وحده.',
        hlpMethNote: 'اختر الطريقة المناسبة للمعيار: المعارف ← الأسئلة؛ المهارات ← الملاحظة أو المنتج؛ الاتجاهات والسلامة ← الملاحظة على مدى زمني. واستخدم أكثر من طريقة لكل محصلة.'
    }
});

/* ── The guides ─────────────────────────────────────────────────
   Each line is a dictionary key; in an hlp* line the words before
   « — » are printed in bold. `only` keeps a line to one
   template. */
var MB_HELP_GUIDES = {
    info: {
        icon: '📄', title: 'hlpInfoTitle',
        parts: [{ lines: ['mbGuideInfo1', 'mbGuideInfo2', 'mbGuideInfo3',
                          { key: 'mbGuideInfo4', only: 'standard' }, 'mbGuideInfo5'] }]
    },
    activity: {
        icon: '⚡', title: 'hlpActTitle',
        parts: [{ lines: ['mbGuideAct1', 'mbGuideAct2', { key: 'mbGuideAct3', only: 'standard' },
                          { key: 'mbGuideAct5', only: 'standard' }, { key: 'mbGuideAct6', only: 'standard' },
                          'mbGuideAct4', 'mbGuideAct7', { key: 'hlpLgAct', only: 'learnerGuide' }] }]
    },
    assessment: {
        icon: '📋', title: 'hlpAsmTitle', wide: true,
        parts: [
            { head: 'hlpAsmFormHead', lines: ['mbGuideAsm1', 'mbGuideAsm2', 'mbGuideAsm3', 'mbGuideAsm4',
                                              'mbGuideAsm5', 'mbGuideAsm6', { key: 'hlpLgAsm', only: 'learnerGuide' }] },
            { head: 'hlpTypesHead', lines: ['hlpTypeDiag', 'hlpTypeForm', 'hlpTypeSum', 'hlpTypeRpl'] },
            { head: 'hlpCritHead', lines: ['hlpCrit1', 'hlpCrit2', 'hlpCrit3', 'hlpCrit4'] },
            { head: 'hlpMethHead', lines: ['hlpMeth1', 'hlpMeth2', 'hlpMeth3', 'hlpMeth4', 'hlpMeth5', 'hlpMeth6'],
              note: 'hlpMethNote' }
        ]
    }
};

function _hlpEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
}
function _hlpT(key) { return window.i18n ? window.i18n.t(key) : key; }

/** The open tab's guide name, or '' on a tab without one. */
function mbHelpTabName() {
    var p = document.querySelector('.tab-content.active');
    var id = p ? p.id : '';
    if (id === 'info-tab') return 'info';
    if (id === 'activity-tab') return 'activity';
    if (id === 'assessment-tab') return 'assessment';
    return '';
}

/** The guide's body, as HTML — the lines of the open template only. */
function mbHelpBodyHtml(name) {
    var g = MB_HELP_GUIDES[name];
    if (!g) return '';
    var tpl = (typeof mbTemplate === 'function') ? mbTemplate() : 'standard';
    return g.parts.map(function (part) {
        var rows = part.lines.map(function (ln) {
            var key = typeof ln === 'string' ? ln : ln.key;
            if (ln.only && ln.only !== tpl) return '';
            /* «Lead — rest»: the lead in bold (the hlp* lines only; the
               mbGuide* lines are sentences that may contain a dash). */
            var v = String(_hlpT(key)), cut = v.indexOf(' — ');
            var body = (key.indexOf('hlp') === 0 && cut > 0)
                ? '<strong>' + _hlpEsc(v.slice(0, cut)) + '</strong>' + _hlpEsc(v.slice(cut))
                : _hlpEsc(v);
            return '<li class="mb-hlp-row"><span class="mb-hlp-dot" aria-hidden="true">•</span><span>' + body + '</span></li>';
        }).join('');
        return (part.head ? '<h3 class="mb-hlp-head">' + _hlpEsc(_hlpT(part.head)) + '</h3>' : '') +
            '<ul class="mb-hlp-list">' + rows + '</ul>' +
            (part.note ? '<div class="mb-hlp-note">' + _hlpEsc(_hlpT(part.note)) + '</div>' : '');
    }).join('');
}

/** Open the guide of the open tab (or of `name`). A second click closes it. */
function mbOpenTabHelp(name) {
    if (typeof name !== 'string' || !MB_HELP_GUIDES[name]) name = mbHelpTabName();
    var g = MB_HELP_GUIDES[name];
    if (!g) return;
    var old = document.getElementById('mb-help-modal');
    if (old) { old.remove(); return; }

    var ov = document.createElement('div');
    ov.id = 'mb-help-modal';
    ov.className = 'mb-hlp-overlay';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-labelledby', 'mb-hlp-title');
    ov.setAttribute('dir', (window.i18n && window.i18n.isRTL && window.i18n.isRTL()) ? 'rtl' : 'ltr');
    ov.innerHTML =
        '<div class="mb-hlp-box' + (g.wide ? ' is-wide' : '') + '" tabindex="-1">' +
          '<div class="mb-hlp-top"><span class="mb-hlp-ico" aria-hidden="true">' + g.icon + '</span>' +
            '<h2 class="mb-hlp-title" id="mb-hlp-title">' + _hlpEsc(_hlpT(g.title)) + '</h2></div>' +
          '<div class="mb-hlp-body">' + mbHelpBodyHtml(name) +
            '<div class="mb-hlp-foot"><button type="button" class="mb-hlp-ok" data-hlp-close>' + _hlpEsc(_hlpT('hlpGotIt')) + '</button></div>' +
          '</div>' +
        '</div>';
    document.body.appendChild(ov);

    var prev = document.activeElement;
    var close = function () {
        document.removeEventListener('keydown', onKey, true);
        if (ov.parentNode) ov.parentNode.removeChild(ov);
        if (prev && prev.focus) prev.focus();
    };
    var onKey = function (e) { if (e.key === 'Escape') { e.preventDefault(); close(); } };
    document.addEventListener('keydown', onKey, true);
    ov.addEventListener('click', function (e) {
        if (e.target === ov || (e.target.closest && e.target.closest('[data-hlp-close]'))) close();
    });
    /* The box, not «Got it»: focusing the button at the foot would
       scroll a long guide to its end before it is read. */
    setTimeout(function () { var b = ov.querySelector('.mb-hlp-box'); if (b) b.focus({ preventScroll: true }); }, 0);
}

/** Shown on the three tabs that have a guide, hidden elsewhere. */
function mbSyncHelpButton() {
    var b = document.getElementById('mb-tab-help');
    if (!b) return;
    var name = mbHelpTabName();
    b.hidden = !name;
    var label = name ? _hlpT(MB_HELP_GUIDES[name].title) : _hlpT('hlpButton');
    b.setAttribute('title', label);
    b.setAttribute('aria-label', label);
    /* 3.64.0: 🗺️ Coverage beside it, on the same three tabs (coverage_view.js). */
    var c = document.getElementById('mb-tab-cov');
    if (c) {
        c.hidden = !name;
        var ct = (window.i18n ? window.i18n.t('mbCovTitle') : 'Coverage');
        c.setAttribute('title', ct);
        c.setAttribute('aria-label', ct);
    }
}

(function watchHelpButton() {
    function start() {
        mbSyncHelpButton();
        if (!window.MutationObserver) return;
        document.querySelectorAll('.tab-content').forEach(function (p) {
            new MutationObserver(mbSyncHelpButton).observe(p, { attributes: true, attributeFilter: ['class'] });
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
    window.addEventListener('mb:langchange', mbSyncHelpButton);
})();
