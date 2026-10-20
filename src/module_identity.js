// ============================================================
// /src/module_identity.js
// Module category and full title, in the Module Management card (3.58.0)
//
// WHY
// DACUM Live Pro gives each module a category — Basic, Common, Core,
// Elective, or the programme's own — and (3.131+) a full title beside its
// working title. Module Builder received the category but showed it only
// in the module list, and had nowhere to keep a full title. Both are now
// fields of the Module Management card, editable here as in DACUM's
// Module Mapping card.
//
// WHAT IS STORED WHERE
//   mbState.moduleCategories   [{ id, label }] — the project's list
//                              (shared record, module_library.js); null
//                              = the four defaults. A default with an
//                              empty label shows its translated name.
//   module.category            { id, label }  — as DACUM sends it; the
//                              label is refreshed from the list here
//   module.fullTitle           the full title; absent = the title
//
// The same ids as DACUM Live Pro (basic, common, core, elective, cat_N),
// so a module sent again keeps its category, and a category DACUM uses
// that this project does not list yet is added to the list.
//
// The full title is what the exports print as the module's title (the
// overview heading, the HTML / PDF title) and what an untouched «Unit
// title» row of the cover shows. The short title stays the module's
// name in the lists and selectors.
// ============================================================

var MB_DEFAULT_MODULE_CATEGORIES = ['basic', 'common', 'core', 'elective'];

var _MB_MI_STR = {
    en: {
        category: 'Category', none: '— Unclassified —', edit: '✎ Edit categories…',
        fullTitle: 'Full module title', fullTitlePh: 'As printed — leave empty to use the module name',
        basic: 'Basic', common: 'Common', core: 'Core', elective: 'Elective',
        editTitle: 'Module categories',
        editHint: 'One category per line, in the order you want. Renaming a line keeps the modules that use it; a module whose category is removed becomes unclassified. Use the same names as in DACUM Live Pro’s Module Mapping.',
        reset: 'Default categories', cancel: 'Cancel', save: 'Save'
    },
    fr: {
        category: 'Catégorie', none: '— Non classé —', edit: '✎ Modifier les catégories…',
        fullTitle: 'Titre complet du module', fullTitlePh: 'Tel qu’imprimé — vide pour utiliser le nom du module',
        basic: 'De base', common: 'Commun', core: 'Spécialisé', elective: 'Optionnel',
        editTitle: 'Catégories de modules',
        editHint: 'Une catégorie par ligne, dans l’ordre voulu. Renommer une ligne garde les modules qui l’utilisent ; un module dont la catégorie est supprimée devient non classé. Utilisez les mêmes noms que dans la cartographie des modules de DACUM Live Pro.',
        reset: 'Catégories par défaut', cancel: 'Annuler', save: 'Enregistrer'
    },
    ar: {
        category: 'التصنيف', none: '— غير مصنّفة —', edit: '✎ تعديل التصنيفات…',
        fullTitle: 'العنوان الكامل للوحدة', fullTitlePh: 'كما يُطبع — اتركه فارغاً لاستخدام اسم الوحدة',
        basic: 'أساسية', common: 'مشتركة', core: 'تخصصية', elective: 'اختيارية',
        editTitle: 'تصنيفات الوحدات',
        editHint: 'تصنيف في كل سطر، بالترتيب الذي تريده. تغيير اسم سطر يُبقي الوحدات التي تستخدمه، والوحدة التي يُحذف تصنيفها تصبح غير مصنّفة. استخدم الأسماء نفسها التي في مواءمة الوحدات في DACUM Live Pro.',
        reset: 'التصنيفات الافتراضية', cancel: 'إلغاء', save: 'حفظ'
    }
};

function _mbMiLang() {
    var l = (window.i18n && window.i18n.getLang) ? window.i18n.getLang() : 'en';
    return _MB_MI_STR[l] ? l : 'en';
}
function _mbMiT(key) {
    return (_MB_MI_STR[_mbMiLang()] || _MB_MI_STR.en)[key] || _MB_MI_STR.en[key] || key;
}
function _mbMiEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
}

/* ── The project's list ──────────────────────────────────────── */
function mbModuleCategories() {
    var c = window.mbState && mbState.moduleCategories;
    if (Array.isArray(c) && c.length) {
        return c.filter(function (x) { return x && x.id; })
                .map(function (x) { return { id: String(x.id), label: String(x.label || '') }; });
    }
    return MB_DEFAULT_MODULE_CATEGORIES.map(function (id) { return { id: id, label: '' }; });
}

/** A default category's name in a language (DACUM's labels are the same words). */
function _mbCatDefaultName(id, lang) {
    var t = _MB_MI_STR[lang] || _MB_MI_STR.en;
    return MB_DEFAULT_MODULE_CATEGORIES.indexOf(id) !== -1 ? t[id] : '';
}

function mbCategoryLabel(cat) {
    if (!cat) return '';
    if (cat.label && String(cat.label).trim()) return String(cat.label).trim();
    return _mbCatDefaultName(cat.id, _mbMiLang()) || String(cat.id || '');
}

/** The label to show for a module's category, from the project's list. */
function mbModuleCategoryLabel(m) {
    var c = m && m.category;
    if (!c || !c.id) return '';
    var hit = mbModuleCategories().filter(function (x) { return x.id === c.id; })[0];
    return hit ? mbCategoryLabel(hit) : String(c.label || c.id);
}

/** A category DACUM sends that the list does not have yet is added. */
function mbEnsureModuleCategory(cat) {
    if (!cat || !cat.id || !window.mbState) return;
    var list = mbModuleCategories();
    if (list.some(function (x) { return x.id === cat.id; })) return;
    var label = String(cat.label || '').trim();
    /* A default id under its own default name stays "default", so it
       follows the interface language. */
    if (MB_DEFAULT_MODULE_CATEGORIES.indexOf(cat.id) !== -1 &&
        Object.keys(_MB_MI_STR).some(function (l) { return _MB_MI_STR[l][cat.id] === label; })) label = '';
    list.push({ id: String(cat.id), label: label.slice(0, 40) });
    mbState.moduleCategories = list;
}

/* ── The full title ────────────────────────────────────────────── */
function mbModuleFullTitle(m) {
    var f = m && typeof m.fullTitle === 'string' ? m.fullTitle.trim() : '';
    if (f) return f;
    return (typeof mbPlainText === 'function') ? mbPlainText(m && m.title) : String((m && m.title) || '');
}

/** The cover's «Unit title» row follows the full title while nobody has
    typed in it: every filled side still holds the previous title. */
function _mbMiSyncCoverTitle(oldTitle, newTitle) {
    var row = (typeof _mbCoverRowByKey === 'function') ? _mbCoverRowByKey('cvUnitTitle') : null;
    if (!row || oldTitle === newTitle) return;
    if (typeof saveCoverData === 'function') { try { saveCoverData(); } catch (e) { /* table absent */ } }
    var v = row.value || {};
    var codes = (typeof BILANG_CODES !== 'undefined') ? BILANG_CODES : ['en', 'ar', 'fr'];
    var sides = codes.map(function (c) { return String(v[c] || '').trim(); }).filter(Boolean);
    if (!sides.length || !sides.every(function (s) { return s === oldTitle; })) return;
    if (!row.value || typeof row.value !== 'object') row.value = {};
    codes.forEach(function (c) { row.value[c] = newTitle; });
    if (typeof renderCoverTable === 'function') renderCoverTable();
}

/* ── The card ─────────────────────────────────────────────────── */
function _mbMiCurrent() {
    if (!window.mbState) return null;
    return (mbState.modulesData || []).find(function (m) { return m.id === mbState.currentModuleId; }) || null;
}

function mbRenderModuleIdentity() {
    var summary = document.getElementById('module-summary');
    if (!summary) return;
    var box = document.getElementById('module-identity');
    var m = _mbMiCurrent();
    if (!m) { if (box) box.remove(); return; }
    if (!box) {
        box = document.createElement('div');
        box.id = 'module-identity';
        box.className = 'mb-mi-row';
        summary.insertBefore(box, summary.firstChild);
    }
    var cur = m.category && m.category.id ? m.category.id : '';
    var opts = mbModuleCategories().map(function (c) {
        return '<option value="' + _mbMiEsc(c.id) + '"' + (c.id === cur ? ' selected' : '') + '>' + _mbMiEsc(mbCategoryLabel(c)) + '</option>';
    }).join('');
    var ro = (typeof mbIsReadOnly === 'function' && mbIsReadOnly()) ? ' disabled' : '';
    box.innerHTML =
        '<label class="mb-mi-field mb-mi-full"><span>' + _mbMiEsc(_mbMiT('fullTitle')) + '</span>' +
          '<input type="text" id="module-full-title" dir="auto" maxlength="300"' + ro +
          ' value="' + _mbMiEsc(m.fullTitle || '') + '" placeholder="' + _mbMiEsc(mbPlainTextSafe(m.title) || _mbMiT('fullTitlePh')) + '"></label>' +
        '<label class="mb-mi-field"><span>' + _mbMiEsc(_mbMiT('category')) + '</span>' +
          '<select id="module-category"' + ro + '>' +
            '<option value="">' + _mbMiEsc(_mbMiT('none')) + '</option>' + opts +
            '<option value="__edit">' + _mbMiEsc(_mbMiT('edit')) + '</option>' +
          '</select></label>';
}
function mbPlainTextSafe(v) {
    return (typeof mbPlainText === 'function') ? mbPlainText(v) : String(v || '');
}

function mbSetModuleCategory(id) {
    var m = _mbMiCurrent();
    if (!m) return;
    var hit = mbModuleCategories().filter(function (x) { return x.id === id; })[0];
    if (hit) m.category = { id: hit.id, label: mbCategoryLabel(hit) };
    else delete m.category;
    if (typeof renderModuleSelector === 'function') renderModuleSelector();
    if (typeof mbLibrarySave === 'function') mbLibrarySave();
}

function mbSetModuleFullTitle(value) {
    var m = _mbMiCurrent();
    if (!m) return;
    var before = mbModuleFullTitle(m);
    var v = String(value || '').replace(/\s+/g, ' ').trim().slice(0, 300);
    if (!v || v === mbPlainTextSafe(m.title).trim()) delete m.fullTitle; else m.fullTitle = v;
    _mbMiSyncCoverTitle(before, mbModuleFullTitle(m));
    if (typeof mbLibrarySave === 'function') mbLibrarySave();
}

/* ── The categories editor ─────────────────────────────────────
   One line per category, as in DACUM: a line keeps the id of the
   category at its position, so renaming keeps every module's choice. */
function _mbSaveCategoryLines(lines) {
    var cur = mbModuleCategories();
    var clean = lines.map(function (l) { return String(l || '').replace(/\s+/g, ' ').trim().slice(0, 40); })
                     .filter(Boolean);
    var used = {};
    var next = clean.map(function (label, i) {
        var id = cur[i] ? cur[i].id : '';
        if (!id || used[id]) {
            var n = i + 1;
            do { id = 'cat_' + n++; } while (used[id] || cur.some(function (c, j) { return c.id === id && j !== i; }));
        }
        used[id] = true;
        var isDefault = MB_DEFAULT_MODULE_CATEGORIES.indexOf(id) !== -1 &&
            Object.keys(_MB_MI_STR).some(function (l) { return _MB_MI_STR[l][id] === label; });
        return { id: id, label: isDefault ? '' : label };
    });
    mbState.moduleCategories = next;
    (mbState.modulesData || []).forEach(function (m) {
        if (!m.category || !m.category.id) return;
        var hit = next.filter(function (c) { return c.id === m.category.id; })[0];
        if (hit) m.category = { id: hit.id, label: mbCategoryLabel(hit) };
        else delete m.category;
    });
    mbRenderModuleIdentity();
    if (typeof renderModuleSelector === 'function') renderModuleSelector();
    if (typeof mbLibrarySave === 'function') mbLibrarySave();
}

function mbOpenModuleCategoriesEditor() {
    var old = document.getElementById('mb-cat-modal');
    if (old) old.remove();
    var rtl = _mbMiLang() === 'ar';
    var ov = document.createElement('div');
    ov.id = 'mb-cat-modal';
    ov.className = 'mb-cat-overlay';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('dir', rtl ? 'rtl' : 'ltr');
    var lines = mbModuleCategories().map(mbCategoryLabel).join('\n');
    ov.innerHTML =
        '<div class="mb-cat-box">' +
          '<div class="mb-cat-head">🏷️ ' + _mbMiEsc(_mbMiT('editTitle')) + '</div>' +
          '<div class="mb-cat-body">' +
            '<p class="mb-cat-hint">' + _mbMiEsc(_mbMiT('editHint')) + '</p>' +
            '<textarea id="mb-cat-lines" dir="auto" rows="6">' + _mbMiEsc(lines) + '</textarea>' +
            '<div class="mb-cat-foot">' +
              '<button type="button" data-cat="reset">↺ ' + _mbMiEsc(_mbMiT('reset')) + '</button>' +
              '<span><button type="button" data-cat="cancel">' + _mbMiEsc(_mbMiT('cancel')) + '</button>' +
              '<button type="button" data-cat="save" class="is-primary">' + _mbMiEsc(_mbMiT('save')) + '</button></span>' +
            '</div>' +
          '</div>' +
        '</div>';
    document.body.appendChild(ov);
    var ta = ov.querySelector('#mb-cat-lines');
    ta.focus();
    var close = function () { ov.remove(); };
    ov.addEventListener('click', function (e) {
        if (e.target === ov) { close(); return; }
        var b = e.target.closest ? e.target.closest('[data-cat]') : null;
        if (!b) return;
        var k = b.getAttribute('data-cat');
        if (k === 'cancel') close();
        else if (k === 'reset') ta.value = MB_DEFAULT_MODULE_CATEGORIES.map(function (id) { return _mbCatDefaultName(id, _mbMiLang()); }).join('\n');
        else if (k === 'save') { _mbSaveCategoryLines(ta.value.split('\n')); close(); }
    });
    ov.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
}

/* ── Wiring ───────────────────────────────────────────────────── */
document.addEventListener('change', function (e) {
    var t = e.target;
    if (!t || !t.id) return;
    if (t.id === 'module-category') {
        if (t.value === '__edit') {
            var m = _mbMiCurrent();
            t.value = (m && m.category && m.category.id) || '';
            mbOpenModuleCategoriesEditor();
        } else mbSetModuleCategory(t.value);
    } else if (t.id === 'module-full-title') {
        mbSetModuleFullTitle(t.value);
    }
});
document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target && e.target.id === 'module-full-title') { e.preventDefault(); e.target.blur(); }
});
window.addEventListener('mb:langchange', function () {
    mbRenderModuleIdentity();
    if (typeof renderModuleSelector === 'function') { try { renderModuleSelector(); } catch (err) { /* not booted */ } }
});
