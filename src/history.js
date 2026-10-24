// ============================================================
// /src/history.js — Undo / Redo for the open module (3.29.0)
// ------------------------------------------------------------
// WHAT IS RECORDED
//   A copy of the open module's Learning Outcomes (with every
//   information and activity sheet) and its assessment forms, taken
//   just BEFORE a change:
//     • every toolbar / card action (data-act) — delete a content
//       section, a step, a sheet, an assessment row, Approve & Build,
//       "From Task Analysis"… An action that changed nothing (it only
//       navigated, or its confirm was cancelled) leaves no step;
//     • typing: one step per field visit (focus → leave), not one per
//       key.
//
// WHY ONLY THE OPEN MODULE
//   The library keeps one module complete in memory and writes each
//   module on its own (module_library.js). A step that spanned two
//   modules could write an older copy over saved work, so the history
//   starts again whenever another module or project is opened.
//
// Ctrl+Z / Ctrl+Y (Ctrl+Shift+Z) work outside text fields; inside a
// field the browser's own text undo stays in charge.
// ============================================================

var MB_HIST_MAX = 40;
var mbHist = { undo: [], redo: [], moduleId: null, field: null, imgs: [null], imgIds: null };

/* 3.81.0: the front / back cover pictures are part of every step, so a
   pasted, replaced or removed cover is undone like any other change.
   A picture is a large string and a step is a JSON text, so a step holds
   only a small number; the pictures themselves are kept once each here
   (the same picture in forty steps is stored once). Reset with the steps
   when another module is opened. */
function _mbHistImgRef(src) {
    if (!src) return 0;
    if (!mbHist.imgIds) mbHist.imgIds = new Map();
    var id = mbHist.imgIds.get(src);
    if (!id) { id = mbHist.imgs.length; mbHist.imgs.push(src); mbHist.imgIds.set(src, id); }
    return id;
}
function _mbHistImgGet(id) { return (id && mbHist.imgs[id]) || null; }

/* Actions that never change the module — no snapshot taken for them. */
var MB_HIST_SKIP = /^(switch|prev|next|mbSwitch|mbToggle|mbOpen|mbJump|mbUndo|mbRedo|export|saveWork|loadWork|mbLibrary|toggle|show|mbExp|mbLang|setLang|clearAll|mbAnalyze|mbAddManual|mbRemoveProposal|mbCreateFromSelection|mbAddSelectionTo|mbSetItem|mbUnassign|mbStartManual|mbCmToggle|mbCmFilter|mbSpView|mbSpCheck|mbSpOpen|mbCov|handle(Front|Back)CoverUpload|_mb)/;
/* 3.33.0: the suggested-content panels (mbSp…) and the distribution of
   the items (module.contentMap) are part of every step, so approving,
   editing, moving or building an item is undone like any other change. */

function _mbHistLabels() {
    var lang = (window.i18n && window.i18n.getLang) ? window.i18n.getLang() : 'en';
    var L = {
        en: { typing: 'typing', removeContentSection: 'delete a content section', coverImage: 'change a cover image', deleteFrontCoverImage: 'remove the front cover image', deleteBackCoverImage: 'remove the back cover image', addContentSection: 'add a content section', insertContentAfter: 'add a content section', moveContentUp: 'move a content section', moveContentDown: 'move a content section', moveContent: 'move a content section',
              removeStep: 'delete a step', addStep: 'add a step', insertStepAfter: 'add a step', moveStepUp: 'move a step', moveStepDown: 'move a step', moveStep: 'move a step', addResource: 'add a resource', removeResource: 'delete a resource',
              addCriteria: 'add a criterion', removeCurrentInfoSheet: 'delete an information sheet', removeCurrentActivitySheet: 'delete an activity sheet',
              addNewInfoSheet: 'add an information sheet', addNewActivitySheet: 'add an activity sheet',
              deleteAssessmentRow: 'delete an assessment row', addAssessmentRow: 'add an assessment row', clearAssessmentRows: 'clear the assessment rows',
              clearAssessmentForm: 'clear an assessment form', deleteAssessmentForm: 'delete an assessment form', addNewAssessmentForm: 'add an assessment form',
              mbSpApprove: 'approve an item', mbSpUnapprove: 'withdraw an approval', mbSpEdit: 'edit an item', mbSpRemove: 'remove an item', mbSpMove: 'move an item', mbSpAlso: 'send an item to another sheet', mbSpSetLo: 'change an item’s outcome', mbSpBuild: 'build sheets', mbSpAddToOpen: 'add to the open sheet', mbSpApproveAll: 'approve the items', mbApproveAndBuild: 'Approve & Build', mbApplyTaPicker: 'add from Task Analysis', mbToolsStyle: 'change the numbering of the tools list', mbToolsClear: 'clear the tools list', mbToolsPaste: 'paste tools', mbToolsPasteApply: 'paste tools', mbToolsApplyPick: 'insert tools from DACUM', other: 'the last change',
              undone: 'Undone: {v0}', redone: 'Redone: {v0}', nothingUndo: 'Nothing to undo', nothingRedo: 'Nothing to redo',
              undoTip: 'Undo (Ctrl+Z)', redoTip: 'Redo (Ctrl+Y)', undo: 'Undo', redo: 'Redo' },
        fr: { typing: 'saisie', removeContentSection: 'supprimer une section', coverImage: 'changer une image de couverture', deleteFrontCoverImage: 'supprimer l’image de la première de couverture', deleteBackCoverImage: 'supprimer l’image de la quatrième de couverture', addContentSection: 'ajouter une section', insertContentAfter: 'ajouter une section', moveContentUp: 'déplacer une section', moveContentDown: 'déplacer une section', moveContent: 'déplacer une section',
              removeStep: 'supprimer une étape', addStep: 'ajouter une étape', insertStepAfter: 'ajouter une étape', moveStepUp: 'déplacer une étape', moveStepDown: 'déplacer une étape', moveStep: 'déplacer une étape', addResource: 'ajouter une ressource', removeResource: 'supprimer une ressource',
              addCriteria: 'ajouter un critère', removeCurrentInfoSheet: 'supprimer une fiche d’information', removeCurrentActivitySheet: 'supprimer une fiche d’activité',
              addNewInfoSheet: 'ajouter une fiche d’information', addNewActivitySheet: 'ajouter une fiche d’activité',
              deleteAssessmentRow: 'supprimer une ligne d’évaluation', addAssessmentRow: 'ajouter une ligne d’évaluation', clearAssessmentRows: 'vider les lignes d’évaluation',
              clearAssessmentForm: 'vider un formulaire d’évaluation', deleteAssessmentForm: 'supprimer un formulaire d’évaluation', addNewAssessmentForm: 'ajouter un formulaire d’évaluation',
              mbSpApprove: 'approuver un élément', mbSpUnapprove: 'retirer une approbation', mbSpEdit: 'modifier un élément', mbSpRemove: 'retirer un élément', mbSpMove: 'déplacer un élément', mbSpAlso: 'envoyer un élément vers une autre fiche', mbSpSetLo: 'changer le résultat d’un élément', mbSpBuild: 'construire des fiches', mbSpAddToOpen: 'ajouter à la fiche ouverte', mbSpApproveAll: 'approuver les éléments', mbApproveAndBuild: 'Approuver et construire', mbApplyTaPicker: 'ajout depuis l’analyse des tâches', mbToolsStyle: 'changer la numérotation de la liste des outils', mbToolsClear: 'vider la liste des outils', mbToolsPaste: 'coller des outils', mbToolsPasteApply: 'coller des outils', mbToolsApplyPick: 'insérer des outils depuis DACUM', other: 'la dernière modification',
              undone: 'Annulé : {v0}', redone: 'Rétabli : {v0}', nothingUndo: 'Rien à annuler', nothingRedo: 'Rien à rétablir',
              undoTip: 'Annuler (Ctrl+Z)', redoTip: 'Rétablir (Ctrl+Y)', undo: 'Annuler', redo: 'Rétablir' },
        ar: { typing: 'الكتابة', removeContentSection: 'حذف قسم محتوى', coverImage: 'تغيير صورة غلاف', deleteFrontCoverImage: 'حذف صورة الغلاف الأمامي', deleteBackCoverImage: 'حذف صورة الغلاف الخلفي', addContentSection: 'إضافة قسم محتوى', insertContentAfter: 'إضافة قسم محتوى', moveContentUp: 'نقل قسم محتوى', moveContentDown: 'نقل قسم محتوى', moveContent: 'نقل قسم محتوى',
              removeStep: 'حذف خطوة', addStep: 'إضافة خطوة', insertStepAfter: 'إضافة خطوة', moveStepUp: 'نقل خطوة', moveStepDown: 'نقل خطوة', moveStep: 'نقل خطوة', addResource: 'إضافة مورد', removeResource: 'حذف مورد',
              addCriteria: 'إضافة معيار', removeCurrentInfoSheet: 'حذف ورقة معلومات', removeCurrentActivitySheet: 'حذف ورقة نشاط',
              addNewInfoSheet: 'إضافة ورقة معلومات', addNewActivitySheet: 'إضافة ورقة نشاط',
              deleteAssessmentRow: 'حذف صف تقييم', addAssessmentRow: 'إضافة صف تقييم', clearAssessmentRows: 'مسح صفوف التقييم',
              clearAssessmentForm: 'مسح استمارة تقييم', deleteAssessmentForm: 'حذف استمارة تقييم', addNewAssessmentForm: 'إضافة استمارة تقييم',
              mbSpApprove: 'المصادقة على بند', mbSpUnapprove: 'سحب مصادقة', mbSpEdit: 'تعديل بند', mbSpRemove: 'حذف بند', mbSpMove: 'نقل بند', mbSpAlso: 'إرسال بند إلى ورقة أخرى', mbSpSetLo: 'تغيير محصلة بند', mbSpBuild: 'بناء الأوراق', mbSpAddToOpen: 'الإضافة إلى الورقة المفتوحة', mbSpApproveAll: 'المصادقة على البنود', mbApproveAndBuild: 'الاعتماد والبناء', mbApplyTaPicker: 'الإضافة من تحليل المهام', mbToolsStyle: 'تغيير ترقيم قائمة الأدوات', mbToolsClear: 'مسح قائمة الأدوات', mbToolsPaste: 'لصق أدوات', mbToolsPasteApply: 'لصق أدوات', mbToolsApplyPick: 'إدراج أدوات من DACUM', other: 'آخر تغيير',
              undone: 'تم التراجع: {v0}', redone: 'تمت الإعادة: {v0}', nothingUndo: 'لا شيء للتراجع عنه', nothingRedo: 'لا شيء لإعادته',
              undoTip: 'تراجع (Ctrl+Z)', redoTip: 'إعادة (Ctrl+Y)', undo: 'تراجع', redo: 'إعادة' }
    };
    return L[lang] || L.en;
}
function _mbHistT(key, v0) {
    var L = _mbHistLabels();
    var s = L[key] || L.other;
    return v0 === undefined ? s : s.replace('{v0}', v0);
}

function _mbHistSameModule() {
    if (mbHist.moduleId !== mbState.currentModuleId) {
        mbHist.undo = []; mbHist.redo = []; mbHist.field = null;
        mbHist.imgs = [null]; mbHist.imgIds = null;
        mbHist.moduleId = mbState.currentModuleId;
    }
}

/** The module's data as a string, after the screen has been written
 *  into it — so a step always holds what the user saw. */
function _mbHistData() {
    try { if (typeof saveCurrentSheetToLO === 'function') saveCurrentSheetToLO(); } catch (e) { /* ignore */ }
    try { if (typeof saveCurrentModuleLOData === 'function') saveCurrentModuleLOData(); } catch (e) { /* ignore */ }
    /* 3.83.0: the assessment cards' texts are read off the screen first. */
    try { if (typeof syncProjectTextFromDOM === 'function') syncProjectTextFromDOM(); } catch (e) { /* ignore */ }
    var m = (mbState.modulesData || []).find(function (x) { return x.id === mbState.currentModuleId; });
    return JSON.stringify({ los: mbState.learningOutcomesData || [], forms: mbState.assessmentFormsData || {},
                            map: (m && m.contentMap) || null,
                            asm: { c: mbState.assessmentContent === undefined ? null : mbState.assessmentContent,
                                   b: mbState.assessmentBlocks || [], l: mbState.lgAsm || null },
                            covers: [_mbHistImgRef(mbState.frontCoverImage), _mbHistImgRef(mbState.backCoverImage)],
                            tools: (m && m.toolsText) || '' });
}
function _mbHistView() {
    return { lo: mbState.currentLOId, is: mbState.currentInfoSheetIndex || 0, as: mbState.currentActivitySheetIndex || 0 };
}

function _mbHistPush(stack, step) {
    stack.push(step);
    if (stack.length > MB_HIST_MAX) stack.shift();
}

/* ── Recording around an action ─────────────────────────────── */
function mbHistBegin(name) {
    if (!name || MB_HIST_SKIP.test(name) || !mbState.currentModuleId) return null;
    _mbHistSameModule();
    return { name: name, data: _mbHistData(), view: _mbHistView() };
}
function mbHistEnd(begin, out) {
    if (!begin) return;
    var finish = function () {
        setTimeout(function () {
            if (mbHist.moduleId !== mbState.currentModuleId) return;
            if (_mbHistData() === begin.data) return;          // nothing changed
            _mbHistPush(mbHist.undo, { label: begin.name, data: begin.data, view: begin.view });
            mbHist.redo = [];
            mbHistUI();
        }, 0);
    };
    if (out && typeof out.then === 'function') out.then(finish, finish); else finish();
}

/* ── Typing: one step per field visit ───────────────────────── */
function _mbHistIsField(el) {
    if (!el || !el.closest || el.closest('.mb-dialog, #mb-sidenav, .figma-toolbar')) return false;
    /* 3.77.0: + the Learner guide's reflection and learning unit card. */
    if (!el.closest('#info-tab, #activity-tab, #assessment-tab, #basic-info-tab, #reflection-tab, #tools-tab, #lg-unit-wrap')) return false;
    return el.matches('input[type=text], input:not([type]), input[type=number], textarea, select, [contenteditable="true"]');
}
document.addEventListener('focusin', function (e) {
    if (!_mbHistIsField(e.target) || !mbState.currentModuleId) return;
    _mbHistSameModule();
    mbHist.field = { el: e.target, data: _mbHistData(), view: _mbHistView() };
});
document.addEventListener('focusout', function (e) {
    var f = mbHist.field;
    if (!f || f.el !== e.target) return;
    mbHist.field = null;
    setTimeout(function () {
        if (mbHist.moduleId !== mbState.currentModuleId) return;
        if (_mbHistData() === f.data) return;
        _mbHistPush(mbHist.undo, { label: 'typing', data: f.data, view: f.view });
        mbHist.redo = [];
        mbHistUI();
    }, 0);
});

/* ── Restoring ──────────────────────────────────────────────── */
function _mbHistApply(step) {
    var d = JSON.parse(step.data);
    var v = step.view || {};
    mbState.learningOutcomesData = d.los || [];
    if (typeof saveCurrentModuleLOData === 'function') saveCurrentModuleLOData();
    mbState.assessmentFormsData = d.forms || {};
    var mod = (mbState.modulesData || []).find(function (x) { return x.id === mbState.currentModuleId; });
    if (mod) { if (d.map) mod.contentMap = d.map; else delete mod.contentMap; }
    /* 3.81.0: a step from before covers were recorded has none: leave them. */
    if (d.covers) {
        mbState.frontCoverImage = _mbHistImgGet(d.covers[0]);
        mbState.backCoverImage  = _mbHistImgGet(d.covers[1]);
        if (typeof mbRefreshCoverPreviews === 'function') mbRefreshCoverPreviews();
        if (typeof _mbCoverNotifyChanged === 'function') { _mbCoverNotifyChanged('front'); _mbCoverNotifyChanged('back'); }
    }
    /* 3.79.0: the Tools & Resources list; a step from before has none. */
    if (mod && typeof d.tools === 'string') {
        if (d.tools) mod.toolsText = d.tools; else delete mod.toolsText;
        if (typeof mbToolsRender === 'function') mbToolsRender();
    }
    /* 3.83.0: a step from before the assessment cards were recorded has none. */
    if (d.asm) {
        mbState.assessmentContent = d.asm.c;
        mbState.assessmentBlocks = d.asm.b || [];
        mbState.lgAsm = d.asm.l;
        if (typeof applyProjectTextToDOM === 'function') { try { applyProjectTextToDOM(); } catch (e) { /* not ready */ } }
        if (typeof mbRenderLgAsm === 'function') { try { mbRenderLgAsm(true); } catch (e) { /* not ready */ } }
    }
    var los = mbState.learningOutcomesData;
    mbState.currentLOId = los.some(function (l) { return l.id === v.lo; }) ? v.lo : (los[0] ? los[0].id : null);
    if (typeof renderLOSelector === 'function') renderLOSelector();
    var lo = los.find(function (l) { return l.id === mbState.currentLOId; });
    if (lo) {
        var ni = (lo.infoSheets || []).length, na = (lo.activitySheets || []).length;
        mbState.currentInfoSheetIndex = Math.max(0, Math.min(v.is || 0, ni - 1));
        mbState.currentActivitySheetIndex = Math.max(0, Math.min(v.as || 0, na - 1));
        if (typeof loadInfoSheetAtIndex === 'function') loadInfoSheetAtIndex(lo, mbState.currentInfoSheetIndex);
        if (typeof loadActivitySheetAtIndex === 'function') loadActivitySheetAtIndex(lo, mbState.currentActivitySheetIndex);
    } else if (typeof clearAllForms === 'function') {
        clearAllForms();
    }
    if (typeof updateLOSummary === 'function') updateLOSummary();
    if (typeof renderAssessmentForms === 'function') renderAssessmentForms();
    if (typeof renderSourceBrowser === 'function') renderSourceBrowser();
    if (typeof updateModuleSummary === 'function') updateModuleSummary();
    if (typeof mbSpRefresh === 'function') mbSpRefresh();
    /* 3.77.0: the Learner guide's cards bind live and skip a repaint that
       looks unchanged — after a restore they must be painted again. */
    if (typeof mbRenderLgUnit === 'function') { try { mbRenderLgUnit(true); } catch (e) { /* not ready */ } }
}

function mbUndo() {
    if (document.activeElement && _mbHistIsField(document.activeElement)) document.activeElement.blur();
    setTimeout(function () {
        _mbHistSameModule();
        var step = mbHist.undo.pop();
        if (!step) { showStatus(_mbHistT('nothingUndo'), 'info'); mbHistUI(); return; }
        _mbHistPush(mbHist.redo, { label: step.label, data: _mbHistData(), view: _mbHistView() });
        _mbHistApply(step);
        mbHistUI();
        showStatus('↶ ' + _mbHistT('undone', _mbHistT(step.label)), 'success');
    }, 0);
}

function mbRedo() {
    if (document.activeElement && _mbHistIsField(document.activeElement)) document.activeElement.blur();
    setTimeout(function () {
        _mbHistSameModule();
        var step = mbHist.redo.pop();
        if (!step) { showStatus(_mbHistT('nothingRedo'), 'info'); mbHistUI(); return; }
        _mbHistPush(mbHist.undo, { label: step.label, data: _mbHistData(), view: _mbHistView() });
        _mbHistApply(step);
        mbHistUI();
        showStatus('↷ ' + _mbHistT('redone', _mbHistT(step.label)), 'success');
    }, 0);
}

/** Buttons: dimmed when there is nothing to undo / redo; the tooltip
 *  names the step. */
function mbHistUI() {
    if (mbHist.moduleId !== mbState.currentModuleId) { mbHist.undo = []; mbHist.redo = []; mbHist.moduleId = mbState.currentModuleId; }
    var u = document.getElementById('mb-undo-btn'), r = document.getElementById('mb-redo-btn');
    var lu = mbHist.undo[mbHist.undo.length - 1], lr = mbHist.redo[mbHist.redo.length - 1];
    if (u) { u.classList.toggle('is-off', !lu); u.title = _mbHistT('undoTip') + (lu ? ' — ' + _mbHistT(lu.label) : ''); }
    if (r) { r.classList.toggle('is-off', !lr); r.title = _mbHistT('redoTip') + (lr ? ' — ' + _mbHistT(lr.label) : ''); }
    /* 3.80.0: the Undo / Redo buttons of the Learner guide's cards. */
    document.querySelectorAll('.lg-undo-btn').forEach(function (b) { b.classList.toggle('is-off', !lu); b.title = _mbHistT('undoTip') + (lu ? ' — ' + _mbHistT(lu.label) : ''); b.setAttribute('aria-label', b.title); });
    document.querySelectorAll('.lg-redo-btn').forEach(function (b) { b.classList.toggle('is-off', !lr); b.title = _mbHistT('redoTip') + (lr ? ' — ' + _mbHistT(lr.label) : ''); b.setAttribute('aria-label', b.title); });
    var lu2 = document.querySelector('#mb-undo-btn .mb-hist-label'), lr2 = document.querySelector('#mb-redo-btn .mb-hist-label');
    if (lu2) lu2.textContent = _mbHistT('undo');
    if (lr2) lr2.textContent = _mbHistT('redo');
}

document.addEventListener('keydown', function (e) {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    var k = (e.key || '').toLowerCase();
    if (k !== 'z' && k !== 'y') return;
    var t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;   // the field's own undo
    if (document.querySelector('.mb-dialog-overlay')) return;
    e.preventDefault();
    if (k === 'y' || (k === 'z' && e.shiftKey)) mbRedo(); else mbUndo();
});

window.addEventListener('mb:libraryready', function () { mbHistUI(); });
window.addEventListener('mb:langchange', function () { mbHistUI(); });
window.addEventListener('mb:librarychanged', function () { mbHistUI(); });
