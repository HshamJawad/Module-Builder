// ============================================================
// /src/module_template.js
// The module template of a project (3.59.0)
//
// WHY
// Programmes write their modules to different structures. The tool's
// own structure — information sheets with a self-check and an answer
// key, activity sheets with a resources table and a performance
// criteria checklist, the Learning Guide table — is now ONE template of
// three:
//
//   standard      the tool as it always was (the default)
//   learnerGuide  «Learner Guide»: each learning outcome is a learning
//                 unit numbered as one sequence (Introduction,
//                 Knowledge, Learning Activity, Worksheet, Reflection),
//                 then the Glossary and an Assessment Unit with the
//                 portfolio of evidence (learner_guide.js)
//   lowLiteracy   announced, not built yet
//
// WHERE IT LIVES
//   mbState.moduleTemplate   shared project data (module_library.js),
//                            so it is saved with the project, travels in
//                            every package and is kept by Clear All
//   project.template         a copy on the project record, so the
//                            library can find «the last project of this
//                            template» without opening every project
//   settings.templateChooser the startup window (Settings → Misc)
//   settings.templateConvert switching CONVERTS the open project instead
//                            of opening another one (Settings → Misc)
//
// SWITCHING
// Each template is its own workspace: switching saves the project on
// screen and opens the most recent project of the other template, or a
// new empty one. With «Allow converting» on, the project itself changes
// template; nothing is deleted — what the new template has no place for
// is hidden and not exported, and comes back on the way back.
//
// HIDING
// The interface marks what belongs to one template with
// data-tpl-only="standard" (or a space-separated list); <body> carries
// mb-tpl-<template>, and the stylesheet hides the rest. No element is
// removed, so no handler ever finds its field missing.
// ============================================================

var MB_TEMPLATES = ['standard', 'learnerGuide', 'lowLiteracy'];
var MB_TEMPLATE_READY = { standard: true, learnerGuide: true, lowLiteracy: false };
var MB_TEMPLATE_KEYS = { standard: 'tplStandard', learnerGuide: 'tplLearnerGuide', lowLiteracy: 'tplLowLiteracy' };
var MB_TEMPLATE_ICONS = { standard: '📘', learnerGuide: '🧭', lowLiteracy: '🖼️' };

if (window.i18n && window.i18n.extend) window.i18n.extend({
    en: {
        tplStandard: 'Standard template',
        tplLearnerGuide: 'Learner guide',
        tplLowLiteracy: 'Low literacy',
        tplStandardDesc: 'Information sheets with self-check and answer key, activity sheets with resources and a performance criteria checklist.',
        tplLearnerGuideDesc: 'Learning units numbered as one sequence: introduction, knowledge, learning activities, worksheets and reflection; glossary; assessment unit with a portfolio of evidence.',
        tplLowLiteracyDesc: 'Short steps, pictures and symbols for learners with limited reading and writing.',
        tplSoon: 'Coming soon',
        tplRailLabel: 'Module template',
        tplChooserTitle: 'Choose the module template',
        tplChooserLead: 'Each template has its own projects. You can switch at any time from the side bar or from Settings.',
        tplContinue: 'Continue: {v0}',
        tplContinueOf: '{v0} — {v1}',
        tplCurrent: 'Current',
        tplLastProject: 'Opens: {v0}',
        tplNewProject: 'Opens a new project',
        tplDontShow: 'Do not show this window at startup',
        tplSwitchConfirm: 'Your project «{v0}» is saved as it is.\n\nThe last project of the template «{v1}» opens, or a new empty one.',
        tplConvertConfirm: 'Convert the project «{v0}» to the template «{v1}»?\n\nNothing is deleted. What the new template has no place for is hidden and not exported, and comes back if you convert the project back.',
        tplSwitchOk: 'Switch',
        tplConvertOk: 'Convert',
        tplSwitched: 'Template: {v0}',
        tplSoonMsg: 'The «{v0}» template is not ready yet.',
        tplNewProjectName: 'New project — {v0}',
        tplSettingsTitle: 'Module template',
        tplSettingsNote: 'The template of the project on screen. Each template has its own projects; switching saves the open project and opens the last project of the other template, or a new one.',
        tplSettingsChooser: 'Show the template window when the tool starts',
        tplSettingsConvert: 'Allow converting a project between templates (switching keeps the data: what the other template has no place for is hidden, not deleted)',
        tplPkgOther: 'The package was made with the template «{v0}»; it is shown here with «{v1}».'
    },
    fr: {
        tplStandard: 'Modèle standard',
        tplLearnerGuide: 'Guide de l’apprenant',
        tplLowLiteracy: 'Faible littératie',
        tplStandardDesc: 'Fiches d’information avec auto-évaluation et corrigé, fiches d’activité avec ressources et liste de vérification des critères de performance.',
        tplLearnerGuideDesc: 'Unités d’apprentissage numérotées en une seule suite : introduction, connaissances, activités, fiches de travail et réflexion ; glossaire ; unité d’évaluation avec portfolio de preuves.',
        tplLowLiteracyDesc: 'Étapes courtes, images et symboles pour les apprenants qui lisent et écrivent peu.',
        tplSoon: 'Bientôt',
        tplRailLabel: 'Modèle du module',
        tplChooserTitle: 'Choisissez le modèle du module',
        tplChooserLead: 'Chaque modèle a ses propres projets. Vous pouvez changer à tout moment depuis la barre latérale ou les Paramètres.',
        tplContinue: 'Continuer : {v0}',
        tplContinueOf: '{v0} — {v1}',
        tplCurrent: 'Actuel',
        tplLastProject: 'Ouvre : {v0}',
        tplNewProject: 'Ouvre un nouveau projet',
        tplDontShow: 'Ne plus afficher cette fenêtre au démarrage',
        tplSwitchConfirm: 'Votre projet « {v0} » est enregistré tel quel.\n\nLe dernier projet du modèle « {v1} » s’ouvre, ou un nouveau projet vide.',
        tplConvertConfirm: 'Convertir le projet « {v0} » au modèle « {v1} » ?\n\nRien n’est supprimé. Ce que le nouveau modèle ne prévoit pas est masqué et non exporté, et revient si vous reconvertissez le projet.',
        tplSwitchOk: 'Changer',
        tplConvertOk: 'Convertir',
        tplSwitched: 'Modèle : {v0}',
        tplSoonMsg: 'Le modèle « {v0} » n’est pas encore prêt.',
        tplNewProjectName: 'Nouveau projet — {v0}',
        tplSettingsTitle: 'Modèle du module',
        tplSettingsNote: 'Le modèle du projet à l’écran. Chaque modèle a ses propres projets ; changer enregistre le projet ouvert et ouvre le dernier projet de l’autre modèle, ou un nouveau.',
        tplSettingsChooser: 'Afficher la fenêtre des modèles au démarrage de l’outil',
        tplSettingsConvert: 'Autoriser la conversion d’un projet entre modèles (le changement garde les données : ce que l’autre modèle ne prévoit pas est masqué, pas supprimé)',
        tplPkgOther: 'Le paquet a été créé avec le modèle « {v0} » ; il est affiché ici avec « {v1} ».'
    },
    ar: {
        tplStandard: 'النموذج القياسي',
        tplLearnerGuide: 'دليل المتعلم',
        tplLowLiteracy: 'محو الأمية',
        tplStandardDesc: 'أوراق معلومات مع التقييم الذاتي ومفتاح الإجابات، وأوراق نشاط مع جدول الموارد وقائمة تدقيق معايير الأداء.',
        tplLearnerGuideDesc: 'وحدات تعلمية بترقيم متصل: المقدمة، والمعرفة، والأنشطة التعلمية، وأوراق العمل، والتأمل؛ ثم المصطلحات، ووحدة التقييم مع محفظة الأدلة.',
        tplLowLiteracyDesc: 'خطوات قصيرة وصور ورموز للمتعلمين محدودي القراءة والكتابة.',
        tplSoon: 'قريباً',
        tplRailLabel: 'نموذج الوحدة',
        tplChooserTitle: 'اختر نموذج الوحدة',
        tplChooserLead: 'لكل نموذج مشاريعه الخاصة. يمكنك التبديل في أي وقت من الشريط الجانبي أو من الإعدادات.',
        tplContinue: 'متابعة: {v0}',
        tplContinueOf: '{v0} — {v1}',
        tplCurrent: 'الحالي',
        tplLastProject: 'يفتح: {v0}',
        tplNewProject: 'يفتح مشروعاً جديداً',
        tplDontShow: 'عدم إظهار هذه النافذة عند بدء التشغيل',
        tplSwitchConfirm: 'سيُحفظ مشروعك «{v0}» كما هو.\n\nسيُفتح آخر مشروع من نموذج «{v1}»، أو مشروع جديد فارغ.',
        tplConvertConfirm: 'هل تريد تحويل المشروع «{v0}» إلى نموذج «{v1}»؟\n\nلن يُحذف شيء. ما لا مكان له في النموذج الجديد يُخفى ولا يُصدَّر، ويعود إذا أعدت تحويل المشروع.',
        tplSwitchOk: 'تبديل',
        tplConvertOk: 'تحويل',
        tplSwitched: 'النموذج: {v0}',
        tplSoonMsg: 'نموذج «{v0}» غير جاهز بعد.',
        tplNewProjectName: 'مشروع جديد — {v0}',
        tplSettingsTitle: 'نموذج الوحدة',
        tplSettingsNote: 'نموذج المشروع المفتوح. لكل نموذج مشاريعه الخاصة؛ التبديل يحفظ المشروع المفتوح ويفتح آخر مشروع من النموذج الآخر، أو مشروعاً جديداً.',
        tplSettingsChooser: 'إظهار نافذة النماذج عند بدء تشغيل الأداة',
        tplSettingsConvert: 'السماح بتحويل المشروع بين النماذج (التبديل يُبقي البيانات: ما لا مكان له في النموذج الآخر يُخفى ولا يُحذف)',
        tplPkgOther: 'أُنشئت الحزمة بنموذج «{v0}»؛ وتُعرض هنا بنموذج «{v1}».'
    }
});

function _tplT(key, vars) {
    if (!window.i18n) return key;
    return vars ? window.i18n.tf(key, vars) : window.i18n.t(key);
}
function _tplEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
}

/** A valid template id, 'standard' for anything else. */
function mbTemplateId(v) {
    return MB_TEMPLATES.indexOf(v) !== -1 ? v : 'standard';
}

/** The template of the open project. */
function mbTemplate() {
    return mbTemplateId(window.mbState && mbState.moduleTemplate);
}

function mbIsLearnerGuide() { return mbTemplate() === 'learnerGuide'; }

function mbTemplateName(t, lang) {
    var key = MB_TEMPLATE_KEYS[mbTemplateId(t)];
    return (lang && window.i18n && window.i18n.tIn) ? window.i18n.tIn(key, lang) : _tplT(key);
}

function _tplSettings() {
    try { if (typeof _wsGet === 'function') return _wsGet() || {}; } catch (e) { /* not ready */ }
    return {};
}
function mbTemplateChooserOn() { return _tplSettings().templateChooser !== false; }
function mbTemplateConvertOn() { return _tplSettings().templateConvert === true; }

/* ── Paint ────────────────────────────────────────────────────── */

/** The body class, the rail buttons and anything listening. Called on
 *  every project open (mbApplyProjectShared) and every switch. */
function mbApplyTemplateUI() {
    var t = mbTemplate();
    if (document.body) {
        MB_TEMPLATES.forEach(function (x) { document.body.classList.toggle('mb-tpl-' + x, x === t); });
    }
    mbRenderTemplateRail();
    try { window.dispatchEvent(new CustomEvent('mb:templatechange', { detail: { template: t } })); } catch (e) { /* old browser */ }
}

/** The three buttons under the rail header. */
function mbRenderTemplateRail() {
    var host = document.getElementById('mb-tpl-rail');
    if (!host) return;
    var t = mbTemplate();
    host.setAttribute('aria-label', _tplT('tplRailLabel'));
    host.innerHTML = '<div class="mb-tpl-rail-label">' + _tplEsc(_tplT('tplRailLabel')) + '</div>' +
        MB_TEMPLATES.map(function (x) {
            var ready = MB_TEMPLATE_READY[x];
            return '<button type="button" class="mb-tpl-btn' + (x === t ? ' is-active' : '') + (ready ? '' : ' is-soon') + '"' +
                ' data-act="mbSwitchTemplate" data-args=\'["' + x + '"]\' data-tpl="' + x + '"' +
                ' aria-pressed="' + (x === t ? 'true' : 'false') + '"' +
                (ready ? '' : ' title="' + _tplEsc(_tplT('tplSoon')) + '"') + '>' +
                '<span class="mb-tpl-ico" aria-hidden="true">' + MB_TEMPLATE_ICONS[x] + '</span>' +
                '<span class="mb-tpl-name">' + _tplEsc(_tplT(MB_TEMPLATE_KEYS[x])) + '</span>' +
                (ready ? '' : '<span class="mb-tpl-soon">' + _tplEsc(_tplT('tplSoon')) + '</span>') +
                '</button>';
        }).join('');
}

/* ── Switch ───────────────────────────────────────────────────── */

/** The most recent project of a template, other than the open one. */
function _tplLastProjectOf(t) {
    if (!window.mbLib || !mbLib.enabled || typeof mbLibraryListProjects !== 'function') return Promise.resolve(null);
    var openId = mbLib.project && mbLib.project.id;
    return mbLibraryListProjects().then(function (list) {
        return (list || []).find(function (p) { return p.id !== openId && mbTemplateId(p.template) === t; }) || null;
    }).catch(function () { return null; });
}

/** Change the open project's template in place (conversion, or a
 *  library that cannot hold a second project). */
function _tplConvertTo(t) {
    mbState.moduleTemplate = t;
    if (window.mbLib && mbLib.project) mbLib.project.template = t;
    mbApplyTemplateUI();
    if (typeof mbTouch === 'function') { try { mbTouch(); } catch (e) { /* autosave absent */ } }
    var p = (typeof mbLibrarySave === 'function') ? mbLibrarySave({ force: true }) : Promise.resolve();
    return p.then(function () {
        if (typeof showStatus === 'function') showStatus(_tplT('tplSwitched', { v0: mbTemplateName(t) }), 'success');
        return true;
    });
}

/** Save the open project and open the last project of `t`, or a new one. */
function _tplOpenWorkspace(t) {
    return _tplLastProjectOf(t).then(function (p) {
        if (p) return mbLibraryOpenProject(p.id);
        return mbLibraryCreateProject(_tplT('tplNewProjectName', { v0: mbTemplateName(t) }), { template: t });
    }).then(function () {
        mbApplyTemplateUI();
        if (typeof showStatus === 'function') showStatus(_tplT('tplSwitched', { v0: mbTemplateName(t) }), 'success');
        return true;
    });
}

/**
 * The rail buttons, the startup window and Settings come here.
 *   opts.ask   confirm first (default true)
 */
function mbSwitchTemplate(t, opts) {
    /* events.js passes the clicked element after the arguments. */
    opts = (opts && opts.nodeType) ? {} : (opts || {});
    t = mbTemplateId(t);
    if (!MB_TEMPLATE_READY[t]) {
        if (typeof mbAlert === 'function') mbAlert(_tplT('tplSoonMsg', { v0: mbTemplateName(t) }));
        return Promise.resolve(false);
    }
    if (t === mbTemplate()) return Promise.resolve(false);
    if (typeof mbIsReadOnly === 'function' && mbIsReadOnly()) return Promise.resolve(false);

    var convert = mbTemplateConvertOn() || !(window.mbLib && mbLib.enabled);
    var name = (window.mbLib && mbLib.project && mbLib.project.name) || '';
    var ask = (opts.ask === false || typeof mbConfirm !== 'function') ? Promise.resolve(true)
        : mbConfirm(_tplT(convert ? 'tplConvertConfirm' : 'tplSwitchConfirm', { v0: name, v1: mbTemplateName(t) }),
                    { okLabel: _tplT(convert ? 'tplConvertOk' : 'tplSwitchOk') });
    return ask.then(function (ok) {
        if (!ok) return false;
        return convert ? _tplConvertTo(t) : _tplOpenWorkspace(t);
    });
}

/* ── Startup window ───────────────────────────────────────────── */

var _tplChooserOpen = false;

/**
 * Asked once per start, after the library has opened a project and
 * before the author's name is asked. Resolves when the choice is done.
 * Not shown on a DACUM handoff: that start already says what to work on.
 */
function mbTemplateStartup() {
    if (!mbTemplateChooserOn() || _tplChooserOpen) return Promise.resolve();
    if (window.mbLib && mbLib.bootedFromDacum) return Promise.resolve();
    /* 3.62.1: once per tab. A reload — «Update now» above all — is not a
       new start, and asking again after it read as a fault. */
    try {
        if (sessionStorage.getItem('mb_tpl_asked')) return Promise.resolve();
        sessionStorage.setItem('mb_tpl_asked', '1');
    } catch (e) { /* sessionStorage unavailable: ask, as before */ }
    return mbOpenTemplateChooser();
}

function mbOpenTemplateChooser() {
    var cur = mbTemplate();
    var proj = (window.mbLib && mbLib.project) || null;
    var lasts = {};
    var chain = Promise.all(MB_TEMPLATES.map(function (x) {
        return _tplLastProjectOf(x).then(function (p) { lasts[x] = p; });
    }));
    return chain.then(function () {
        return new Promise(function (resolve) {
            _tplChooserOpen = true;
            var rtl = !!(window.i18n && window.i18n.isRTL && window.i18n.isRTL());
            var ov = document.createElement('div');
            ov.className = 'mb-dialog-overlay mb-tpl-overlay';
            ov.setAttribute('role', 'dialog');
            ov.setAttribute('aria-modal', 'true');
            ov.setAttribute('aria-labelledby', 'mb-tpl-title');
            var cards = MB_TEMPLATES.map(function (x) {
                var ready = MB_TEMPLATE_READY[x];
                var sub = !ready ? _tplT('tplSoon')
                    : (x === cur ? _tplT('tplCurrent')
                        : (lasts[x] ? _tplT('tplLastProject', { v0: lasts[x].name || '—' }) : _tplT('tplNewProject')));
                return '<button type="button" class="mb-tpl-card' + (x === cur ? ' is-current' : '') + (ready ? '' : ' is-soon') + '"' +
                    ' data-tpl-pick="' + x + '"' + (ready ? '' : ' disabled aria-disabled="true"') + '>' +
                    '<span class="mb-tpl-card-ico" aria-hidden="true">' + MB_TEMPLATE_ICONS[x] + '</span>' +
                    '<span class="mb-tpl-card-name">' + _tplEsc(_tplT(MB_TEMPLATE_KEYS[x])) + '</span>' +
                    '<span class="mb-tpl-card-desc">' + _tplEsc(_tplT(MB_TEMPLATE_KEYS[x] + 'Desc')) + '</span>' +
                    '<span class="mb-tpl-card-sub"><bdi>' + _tplEsc(sub) + '</bdi></span>' +
                    '</button>';
            }).join('');
            ov.innerHTML =
                '<div class="mb-dialog mb-tpl-dialog" dir="' + (rtl ? 'rtl' : 'ltr') + '">' +
                  '<h2 class="mb-tpl-title" id="mb-tpl-title">' + _tplEsc(_tplT('tplChooserTitle')) + '</h2>' +
                  '<p class="mb-tpl-lead">' + _tplEsc(_tplT('tplChooserLead')) + '</p>' +
                  (proj ? '<button type="button" class="mb-tpl-continue" data-tpl-pick="' + cur + '">↪ ' +
                      _tplEsc(_tplT('tplContinue', { v0: '' })) + '<bdi>' +
                      _tplEsc(_tplT('tplContinueOf', { v0: proj.name || '—', v1: mbTemplateName(cur) })) + '</bdi></button>' : '') +
                  '<div class="mb-tpl-cards">' + cards + '</div>' +
                  '<label class="mb-tpl-dontshow"><input type="checkbox" id="mb-tpl-dontshow"> ' + _tplEsc(_tplT('tplDontShow')) + '</label>' +
                '</div>';
            document.body.appendChild(ov);

            function finish(pick) {
                document.removeEventListener('keydown', onKey, true);
                var box = ov.querySelector('#mb-tpl-dontshow');
                if (box && box.checked) _tplSetSetting('templateChooser', false);
                if (ov.parentNode) ov.parentNode.removeChild(ov);
                _tplChooserOpen = false;
                var p = (pick && pick !== mbTemplate()) ? _tplOpenOrConvertNoAsk(pick) : Promise.resolve();
                p.then(resolve, resolve);
            }
            function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); finish(null); } }
            document.addEventListener('keydown', onKey, true);
            ov.addEventListener('click', function (e) {
                var b = e.target.closest && e.target.closest('[data-tpl-pick]');
                if (b && !b.disabled) finish(b.getAttribute('data-tpl-pick'));
            });
            setTimeout(function () {
                var f = ov.querySelector('.mb-tpl-continue') || ov.querySelector('.mb-tpl-card:not([disabled])');
                if (f) f.focus();
            }, 0);
        });
    });
}

function _tplOpenOrConvertNoAsk(t) {
    return mbSwitchTemplate(t, { ask: false });
}

/** Write one of the two template settings outside the Settings dialog. */
function _tplSetSetting(field, value) {
    try {
        if (typeof wsReadSettings === 'function' && typeof wsWriteSettings === 'function') {
            var s = wsReadSettings();
            s[field] = value;
            wsWriteSettings(s);
        }
    } catch (e) { /* storage unavailable */ }
}

/* ── Settings → Misc ──────────────────────────────────────────── */

/** The group at the top of Settings → Misc. `draft` is the dialog's. */
function mbTemplateSettingsHtml(draft) {
    var t = mbTemplate();
    var btns = MB_TEMPLATES.map(function (x) {
        var ready = MB_TEMPLATE_READY[x];
        return '<button type="button" class="mb-tpl-btn mb-tpl-btn-inline' + (x === t ? ' is-active' : '') + (ready ? '' : ' is-soon') + '"' +
            ' data-act="mbSwitchTemplate" data-args=\'["' + x + '"]\' aria-pressed="' + (x === t ? 'true' : 'false') + '">' +
            '<span class="mb-tpl-ico" aria-hidden="true">' + MB_TEMPLATE_ICONS[x] + '</span>' +
            '<span class="mb-tpl-name">' + _tplEsc(_tplT(MB_TEMPLATE_KEYS[x])) + '</span>' +
            (ready ? '' : '<span class="mb-tpl-soon">' + _tplEsc(_tplT('tplSoon')) + '</span>') + '</button>';
    }).join('');
    draft = draft || {};
    return '' +
        '<h4 class="ws-group">📐 ' + _tplEsc(_tplT('tplSettingsTitle')) + '</h4>' +
        '<p class="ws-note ws-note-sm">ℹ️ ' + _tplEsc(_tplT('tplSettingsNote')) + '</p>' +
        '<div class="mb-tpl-settings-row" id="ws-tpl-buttons">' + btns + '</div>' +
        '<div class="ws-checks">' +
          '<label class="ws-check"><input type="checkbox" data-ws-misc="templateChooser"' + (draft.templateChooser !== false ? ' checked' : '') + '><span>' + _tplEsc(_tplT('tplSettingsChooser')) + '</span></label>' +
          '<label class="ws-check"><input type="checkbox" data-ws-misc="templateConvert"' + (draft.templateConvert === true ? ' checked' : '') + '><span>' + _tplEsc(_tplT('tplSettingsConvert')) + '</span></label>' +
        '</div>';
}

/* The buttons in Settings follow a switch made anywhere. */
function _tplRepaintSettingsButtons() {
    var host = document.getElementById('ws-tpl-buttons');
    if (!host) return;
    var t = mbTemplate();
    host.querySelectorAll('.mb-tpl-btn').forEach(function (b) {
        var args = b.getAttribute('data-args') || '';
        var on = args.indexOf('"' + t + '"') !== -1;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
}

window.addEventListener('mb:templatechange', _tplRepaintSettingsButtons);
window.addEventListener('mb:langchange', function () { try { mbRenderTemplateRail(); } catch (e) { /* not ready */ } });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mbApplyTemplateUI);
else mbApplyTemplateUI();
