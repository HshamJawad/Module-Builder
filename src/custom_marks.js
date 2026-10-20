// ============================================================
// /src/custom_marks.js
// Marks written from the Task Analysis, and the project's own marks (3.62.0)
//
// WHY
// Safety rules, common errors, worker behaviours … were written on the
// sheets as text: a «Safety» section on the information sheet, a step
// «Safety: …» on the job sheet. They are warnings and reminders, and the
// tool already has the box for that — the instructional marks (⛔
// Warning, ⚠️ Attention, ✅ Good practice …). Distribution settings now
// says, per Task Analysis field, which mark its items are written as;
// the suggested-content panel can change it for one item.
//
// WHAT IS STORED (shared project data, module_library.js)
//   mbState.cmMarks      { <field group>: <mark key> }  only the fields
//                        the author set; '' = written as before
//   mbState.customMarks  [{ key, title: pair, icon, color }]
//                        marks the author added, beside the built-in
//                        eleven (resources.js MARK_TYPES)
//   per item, in the content map: row.mark (content_map.js, `mk`)
//
// ONE WAY TO FIND A MARK
// mbFindMarkType(key) answers for built-in and project marks alike, and
// mbMarkLabel(type, lang) gives its header in a language. The editor
// (marks.js), the Word export and the model (HTML, PDF, slides) all ask
// these two, so a project mark prints like any other.
// ============================================================

if (window.i18n && window.i18n.extend) window.i18n.extend({
    en: {
        cmkColHead: 'Mark',
        cmkNone: '— none (as text)',
        cmkCustom: '➕ Custom mark…',
        cmkSuggest: '🏷️ Suggested marks',
        cmkManage: '🏷️ My marks…',
        cmkIntro: 'Mark: the items of a field are written as that mark (⛔ Warning, ⚠️ Attention …) on the information and job sheets, instead of a section or a step. The assessment form is not affected. Applies to what is built from now on.',
        cmkDlgTitle: 'Custom mark',
        cmkDlgName: 'Name of the mark',
        cmkDlgNamePh: 'e.g. Environment, Quality, First aid',
        cmkDlgIcon: 'Icon',
        cmkDlgColor: 'Colour',
        cmkDlgSave: 'Save',
        cmkDlgCancel: 'Cancel',
        cmkDlgDelete: 'Delete',
        cmkManageTitle: 'My marks',
        cmkManageEmpty: 'No custom mark yet.',
        cmkManageAdd: '➕ Add a mark',
        cmkDeleteConfirm: 'Delete the mark «{v0}»?\n\nMarks of this type already written on sheets keep their text and print as a note.',
        cmkItemMark: 'Written as',
        cmkItemDefault: 'Field default: {v0}',
        cmkSaved: 'Mark saved'
    },
    fr: {
        cmkColHead: 'Marque',
        cmkNone: '— aucune (en texte)',
        cmkCustom: '➕ Marque personnalisée…',
        cmkSuggest: '🏷️ Marques suggérées',
        cmkManage: '🏷️ Mes marques…',
        cmkIntro: 'Marque : les éléments d’un champ sont écrits sous cette marque (⛔ Avertissement, ⚠️ Attention …) sur les fiches d’information et de travail, au lieu d’une section ou d’une étape. Le formulaire d’évaluation n’est pas concerné. S’applique à ce qui est construit désormais.',
        cmkDlgTitle: 'Marque personnalisée',
        cmkDlgName: 'Nom de la marque',
        cmkDlgNamePh: 'p. ex. Environnement, Qualité, Premiers secours',
        cmkDlgIcon: 'Icône',
        cmkDlgColor: 'Couleur',
        cmkDlgSave: 'Enregistrer',
        cmkDlgCancel: 'Annuler',
        cmkDlgDelete: 'Supprimer',
        cmkManageTitle: 'Mes marques',
        cmkManageEmpty: 'Aucune marque personnalisée.',
        cmkManageAdd: '➕ Ajouter une marque',
        cmkDeleteConfirm: 'Supprimer la marque « {v0} » ?\n\nLes marques de ce type déjà écrites gardent leur texte et s’impriment comme une note.',
        cmkItemMark: 'Écrit comme',
        cmkItemDefault: 'Par défaut du champ : {v0}',
        cmkSaved: 'Marque enregistrée'
    },
    ar: {
        cmkColHead: 'علامة',
        cmkNone: '— بدون (نص عادي)',
        cmkCustom: '➕ علامة مخصصة…',
        cmkSuggest: '🏷️ العلامات المقترحة',
        cmkManage: '🏷️ علاماتي…',
        cmkIntro: 'العلامة: تُكتب بنود الفقرة على شكل هذه العلامة (⛔ تحذير، ⚠️ انتبه …) في ورقتي المعلومات والعمل، بدل قسم أو خطوة. لا تتأثر استمارة التقييم. يُطبَّق على ما يُبنى من الآن.',
        cmkDlgTitle: 'علامة مخصصة',
        cmkDlgName: 'اسم العلامة',
        cmkDlgNamePh: 'مثل: البيئة، الجودة، الإسعافات الأولية',
        cmkDlgIcon: 'الأيقونة',
        cmkDlgColor: 'اللون',
        cmkDlgSave: 'حفظ',
        cmkDlgCancel: 'إلغاء',
        cmkDlgDelete: 'حذف',
        cmkManageTitle: 'علاماتي',
        cmkManageEmpty: 'لا توجد علامة مخصصة بعد.',
        cmkManageAdd: '➕ إضافة علامة',
        cmkDeleteConfirm: 'حذف العلامة «{v0}»؟\n\nالعلامات من هذا النوع المكتوبة في الأوراق تحتفظ بنصها وتُطبع كملاحظة.',
        cmkItemMark: 'تُكتب كـ',
        cmkItemDefault: 'افتراضي الفقرة: {v0}',
        cmkSaved: 'حُفظت العلامة'
    }
});

/* The Task Analysis fields that can be written as a mark, and the mark
   suggested for each («🏷️ Suggested marks» in Distribution settings). */
var MB_CM_MARK_FIELDS = ['safetyOSH', 'commonErrorsTroubleshooting', 'workerBehaviours', 'decisionsCriticalPoints',
    'conditionsWorkEnvironment', 'basicReading', 'basicWriting', 'basicMath', 'basicScience', 'custom'];
var MB_CM_MARK_SUGGEST = {
    safetyOSH: 'warning', commonErrorsTroubleshooting: 'attention', workerBehaviours: 'goodprac',
    decisionsCriticalPoints: 'important', conditionsWorkEnvironment: 'note',
    basicReading: 'remember', basicWriting: 'remember', basicMath: 'remember', basicScience: 'remember',
    custom: 'note'
};

var MB_CMK_ICONS = ['🏷️', '🌿', '♻️', '🩹', '⚡', '🔥', '🧪', '🔧', '📐', '🧠', '⭐', '🚫'];
var MB_CMK_COLORS = ['#0f766e', '#2563eb', '#7c3aed', '#db2777', '#dc2626', '#ea580c', '#ca8a04', '#16a34a', '#475569'];

function _cmkT(k, vars) { return window.i18n ? (vars ? window.i18n.tf(k, vars) : window.i18n.t(k)) : k; }
function _cmkEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
}
function _cmkHex(c) { return /^#[0-9a-f]{6}$/i.test(String(c || '')) ? c : '#475569'; }
/* A pale tint of a colour, for the body of the mark. */
function _cmkTint(hex) {
    var h = _cmkHex(hex).slice(1);
    var mix = function (i) { var v = parseInt(h.substr(i, 2), 16); return Math.round(v + (255 - v) * 0.9).toString(16).padStart(2, '0'); };
    return '#' + mix(0) + mix(2) + mix(4);
}

/* ── The project's marks ──────────────────────────────────────── */

/** Shared data → state (module_library.js). */
function mbNormalizeCustomMarks(list) {
    if (!Array.isArray(list)) return [];
    return list.filter(function (m) { return m && typeof m.key === 'string' && m.key; }).map(function (m) {
        return { key: m.key, title: (typeof biUpgrade === 'function') ? biUpgrade(m.title) : m.title,
                 icon: MB_CMK_ICONS.indexOf(m.icon) !== -1 ? m.icon : (typeof m.icon === 'string' && m.icon ? m.icon : '🏷️'),
                 color: _cmkHex(m.color) };
    });
}
function mbNormalizeCmMarks(o) {
    var out = {};
    if (o && typeof o === 'object') Object.keys(o).forEach(function (g) {
        if (MB_CM_MARK_FIELDS.indexOf(g) !== -1 && typeof o[g] === 'string') out[g] = o[g];
    });
    return out;
}

/** A project mark as a mark type (the shape of resources.js MARK_TYPES). */
function _cmkType(m) {
    var c = _cmkHex(m.color);
    return { key: m.key, custom: true, title: m.title, icon: m.icon || '🏷️',
             bg: _cmkTint(c), border: c, header: c, headerText: '#ffffff' };
}

/** Every mark type: the eleven built-in, then the project's own. */
function mbMarkTypes() {
    var base = (typeof MARK_TYPES !== 'undefined') ? MARK_TYPES.slice() : [];
    var own = (window.mbState && Array.isArray(mbState.customMarks)) ? mbState.customMarks : [];
    return base.concat(own.map(_cmkType));
}
function mbFindMarkType(key) {
    var all = mbMarkTypes();
    for (var i = 0; i < all.length; i++) if (all[i].key === key) return all[i];
    return null;
}

/** The header of a mark in `lang` (the interface's when omitted). A
 *  project mark answers with its own name, in any language it has. */
function mbMarkLabel(mt, lang) {
    if (!mt) return '';
    if (mt.custom) {
        var t = mt.title;
        if (typeof t === 'string') return t;
        if (t && typeof t === 'object') {
            var L = lang || ((window.i18n && window.i18n.getLang) ? window.i18n.getLang() : 'en');
            if (typeof t[L] === 'string' && t[L].trim()) return t[L];
            var codes = (typeof BILANG_CODES !== 'undefined') ? BILANG_CODES : ['en', 'ar', 'fr'];
            for (var i = 0; i < codes.length; i++) if (typeof t[codes[i]] === 'string' && t[codes[i]].trim()) return t[codes[i]];
        }
        return mt.key;
    }
    if (!window.i18n) return mt.label;
    return lang && window.i18n.tIn ? window.i18n.tIn(mt.label, lang) : window.i18n.t(mt.label);
}

/** The options of a mark <select>: none, the built-in, the project's. */
function mbMarkOptionsHtml(cur, noneLabel) {
    return '<option value="">' + _cmkEsc(noneLabel || _cmkT('cmkNone')) + '</option>' +
        mbMarkTypes().map(function (mt) {
            return '<option value="' + _cmkEsc(mt.key) + '"' + (mt.key === cur ? ' selected' : '') + '>' +
                _cmkEsc(mt.icon + ' ' + mbMarkLabel(mt)) + '</option>';
        }).join('');
}

/* ── The mark of a field, of an item ──────────────────────────── */

/** The mark a field's items are written as, or '' (as text). */
function mbCmFieldMark(group) {
    var own = window.mbState && mbState.cmMarks;
    var k = own && typeof own[group] === 'string' ? own[group] : '';
    return (k && mbFindMarkType(k)) ? k : '';
}
/** The mark one content-map row is written as: its own choice, else its field's. */
function mbCmRowMark(row) {
    if (!row) return '';
    var g = (typeof _cmFieldGroup === 'function') ? _cmFieldGroup(row.field, row.taskId) : row.field;
    if (MB_CM_MARK_FIELDS.indexOf(g) === -1) return '';
    if (typeof row.mark === 'string') return (row.mark && mbFindMarkType(row.mark)) ? row.mark : '';
    return mbCmFieldMark(g);
}

/* ── Adding, renaming, deleting a project mark ────────────────── */

/**
 * The small window. `m` = an existing mark to edit, or null for a new
 * one. Resolves the mark's key, or null when cancelled.
 */
function mbCustomMarkDialog(m) {
    return new Promise(function (resolve) {
        var lang = (typeof contentLang === 'function') ? contentLang() : 'en';
        var rtl = !!(window.i18n && window.i18n.isRTL && window.i18n.isRTL());
        var title = m ? mbMarkLabel(_cmkType(m), lang) : '';
        var icon = m ? m.icon : MB_CMK_ICONS[0];
        var color = m ? _cmkHex(m.color) : MB_CMK_COLORS[0];
        var ov = document.createElement('div');
        ov.className = 'mb-dialog-overlay mb-cmk-overlay';
        ov.setAttribute('role', 'dialog');
        ov.setAttribute('aria-modal', 'true');
        ov.innerHTML =
            '<div class="mb-dialog mb-cmk-dialog" dir="' + (rtl ? 'rtl' : 'ltr') + '">' +
              '<h3 class="mb-cmk-title">🏷️ ' + _cmkEsc(_cmkT('cmkDlgTitle')) + '</h3>' +
              '<label class="mb-cmk-label" for="mb-cmk-name">' + _cmkEsc(_cmkT('cmkDlgName')) + '</label>' +
              '<input id="mb-cmk-name" class="mb-dialog-input" type="text" maxlength="40" dir="auto" value="' + _cmkEsc(title) + '" placeholder="' + _cmkEsc(_cmkT('cmkDlgNamePh')) + '">' +
              '<div class="mb-cmk-label">' + _cmkEsc(_cmkT('cmkDlgIcon')) + '</div>' +
              '<div class="mb-cmk-pick" data-pick="icon">' + MB_CMK_ICONS.map(function (x) {
                  return '<button type="button" class="mb-cmk-opt' + (x === icon ? ' is-on' : '') + '" data-v="' + x + '" aria-pressed="' + (x === icon) + '">' + x + '</button>';
              }).join('') + '</div>' +
              '<div class="mb-cmk-label">' + _cmkEsc(_cmkT('cmkDlgColor')) + '</div>' +
              '<div class="mb-cmk-pick" data-pick="color">' + MB_CMK_COLORS.map(function (x) {
                  return '<button type="button" class="mb-cmk-opt mb-cmk-sw' + (x === color ? ' is-on' : '') + '" data-v="' + x + '" aria-pressed="' + (x === color) + '" aria-label="' + x + '" style="--sw:' + x + '"></button>';
              }).join('') + '</div>' +
              '<div class="mb-cmk-preview" id="mb-cmk-preview"></div>' +
              '<div class="mb-dialog-actions">' +
                '<button type="button" class="mb-dialog-btn mb-dialog-cancel" data-cmk="cancel">' + _cmkEsc(_cmkT('cmkDlgCancel')) + '</button>' +
                '<button type="button" class="mb-dialog-btn mb-dialog-ok" data-cmk="save">' + _cmkEsc(_cmkT('cmkDlgSave')) + '</button>' +
              '</div>' +
            '</div>';
        document.body.appendChild(ov);
        var name = ov.querySelector('#mb-cmk-name');
        var paint = function () {
            var p = ov.querySelector('#mb-cmk-preview');
            p.style.borderColor = color;
            p.innerHTML = '<div style="background:' + color + ';color:#fff;padding:5px 10px;font-weight:700;">' + _cmkEsc(icon + '  ' + (name.value.trim() || _cmkT('cmkDlgNamePh'))) + '</div>' +
                '<div style="background:' + _cmkTint(color) + ';padding:8px 10px;min-height:18px;"></div>';
        };
        paint();
        var done = function (v) {
            document.removeEventListener('keydown', onKey, true);
            if (ov.parentNode) ov.parentNode.removeChild(ov);
            resolve(v);
        };
        var save = function () {
            var t = name.value.trim();
            if (!t) { name.focus(); return; }
            if (!Array.isArray(mbState.customMarks)) mbState.customMarks = [];
            var rec = m ? mbState.customMarks.find(function (x) { return x.key === m.key; }) : null;
            if (!rec) {
                rec = { key: 'cmk_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), title: (typeof biNew === 'function') ? biNew() : {} };
                mbState.customMarks.push(rec);
            }
            if (!rec.title || typeof rec.title !== 'object') rec.title = (typeof biNew === 'function') ? biNew() : {};
            /* Named in the content language; the other languages show
               this name until they are given their own. */
            rec.title[lang] = t;
            rec.icon = icon; rec.color = color;
            if (typeof mbLibrarySave === 'function') mbLibrarySave();
            if (typeof showStatus === 'function') showStatus(_cmkT('cmkSaved'), 'success');
            done(rec.key);
        };
        var onKey = function (e) {
            if (e.key === 'Escape') { e.preventDefault(); done(null); }
            if (e.key === 'Enter' && e.target === name) { e.preventDefault(); save(); }
        };
        document.addEventListener('keydown', onKey, true);
        name.addEventListener('input', paint);
        ov.addEventListener('click', function (e) {
            var opt = e.target.closest && e.target.closest('.mb-cmk-opt');
            if (opt) {
                var pick = opt.parentNode.getAttribute('data-pick');
                if (pick === 'icon') icon = opt.getAttribute('data-v'); else color = opt.getAttribute('data-v');
                opt.parentNode.querySelectorAll('.mb-cmk-opt').forEach(function (b) {
                    var on = b === opt; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', on);
                });
                paint();
                return;
            }
            var act = e.target.closest && e.target.closest('[data-cmk]');
            if (!act) return;
            if (act.getAttribute('data-cmk') === 'save') save(); else done(null);
        });
        setTimeout(function () { name.focus(); }, 0);
    });
}

/** Delete a project mark (after asking). */
function mbDeleteCustomMark(key) {
    var m = (mbState.customMarks || []).find(function (x) { return x.key === key; });
    if (!m) return Promise.resolve(false);
    return mbConfirm(_cmkT('cmkDeleteConfirm', { v0: mbMarkLabel(_cmkType(m)) }), { danger: true }).then(function (ok) {
        if (!ok) return false;
        mbState.customMarks = mbState.customMarks.filter(function (x) { return x.key !== key; });
        Object.keys(mbState.cmMarks || {}).forEach(function (g) { if (mbState.cmMarks[g] === key) delete mbState.cmMarks[g]; });
        if (typeof mbLibrarySave === 'function') mbLibrarySave();
        return true;
    });
}

/** «🏷️ My marks…»: the project's marks, to add, rename or delete. */
function mbManageCustomMarks() {
    var old = document.getElementById('mb-cmk-manage');
    if (old) old.remove();
    var rtl = !!(window.i18n && window.i18n.isRTL && window.i18n.isRTL());
    var ov = document.createElement('div');
    ov.id = 'mb-cmk-manage';
    ov.className = 'mb-dialog-overlay mb-cmk-overlay';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    var paint = function () {
        var list = (mbState.customMarks || []).map(_cmkType);
        ov.innerHTML = '<div class="mb-dialog mb-cmk-dialog" dir="' + (rtl ? 'rtl' : 'ltr') + '">' +
            '<h3 class="mb-cmk-title">🏷️ ' + _cmkEsc(_cmkT('cmkManageTitle')) + '</h3>' +
            (list.length ? '<ul class="mb-cmk-list">' + list.map(function (mt) {
                return '<li><span class="mb-cmk-chip" style="background:' + mt.header + '">' + _cmkEsc(mt.icon + ' ' + mbMarkLabel(mt)) + '</span>' +
                    '<span class="mb-cmk-gap"></span>' +
                    '<button type="button" class="mb-sp-mini" data-cmk-edit="' + _cmkEsc(mt.key) + '">✎</button>' +
                    '<button type="button" class="mb-sp-mini" data-cmk-del="' + _cmkEsc(mt.key) + '" aria-label="' + _cmkEsc(_cmkT('cmkDlgDelete')) + '">🗑</button></li>';
            }).join('') + '</ul>' : '<p class="mb-cmk-empty">' + _cmkEsc(_cmkT('cmkManageEmpty')) + '</p>') +
            '<div class="mb-dialog-actions">' +
              '<button type="button" class="mb-dialog-btn" data-cmk-add>' + _cmkEsc(_cmkT('cmkManageAdd')) + '</button>' +
              '<button type="button" class="mb-dialog-btn mb-dialog-ok" data-cmk-close>' + _cmkEsc(_cmkT('hlpGotIt')) + '</button>' +
            '</div></div>';
    };
    paint();
    document.body.appendChild(ov);
    var refresh = function () { paint(); if (typeof mbCovRepaintMarks === 'function') mbCovRepaintMarks(); };
    ov.addEventListener('click', function (e) {
        var t = e.target.closest ? e.target : null;
        if (!t) return;
        if (t.closest('[data-cmk-close]') || e.target === ov) { ov.remove(); if (typeof mbCovRepaintMarks === 'function') mbCovRepaintMarks(); return; }
        if (t.closest('[data-cmk-add]')) { ov.style.display = 'none'; mbCustomMarkDialog(null).then(function () { ov.style.display = ''; refresh(); }); return; }
        var ed = t.closest('[data-cmk-edit]');
        if (ed) {
            var m = (mbState.customMarks || []).find(function (x) { return x.key === ed.getAttribute('data-cmk-edit'); });
            ov.style.display = 'none';
            mbCustomMarkDialog(m).then(function () { ov.style.display = ''; refresh(); });
            return;
        }
        var del = t.closest('[data-cmk-del]');
        if (del) mbDeleteCustomMark(del.getAttribute('data-cmk-del')).then(refresh);
    });
}
