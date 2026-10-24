// ============================================================
// /src/tools_resources.js — 3.79.0
// «🧰 Tools & Resources»: the tools, equipment and materials a module
// needs, as ONE list (the way DACUM's Task Analysis keeps them), printed
// on its own page before the suggested resources / references.
//
// DATA
//   module.toolsResources = [{ id, value }]   — per module, plain strings
//   module.additionalInfoTools = ['…']        — DACUM's Additional Info
//                                               tools list (handoff 3.139+)
//   Both live on the module record, so they are saved, packaged and
//   undone with the module (history.js carries toolsResources).
//
// THE LIST
//   add / edit / delete a row · clear all · «Paste text» (one line = one
//   row, bullets and numbers removed, duplicates skipped) · «Insert from
//   DACUM»: the tools, equipment and materials of the module's tasks
//   (grouped by task) and DACUM's Additional Info list, ticked and added.
//
// EXPORT: mbToolsList(state) is what the Word, PDF and HTML exports read.
// ============================================================

if (window.i18n && window.i18n.extend) window.i18n.extend({
    en: { expToolsResources: 'Tools, Equipment and Materials Required', trTab: 'Tools & Resources', trTitle: 'Tools, equipment and materials required for this module',
          trHint: 'One list, printed on its own page before the References. Leave it empty to skip the page.',
          trPh: 'e.g. Screwdriver set', trAdd: 'Add item', trPaste: 'Paste text', trDacum: 'Insert from DACUM', trClear: 'Clear list',
          trClearQ: 'Remove every item from this list?', trEmpty: 'No items yet.',
          trPasteTip: 'One line becomes one item; bullets and numbers are removed',
          trPasteHead: 'Paste the list here', trPasteOk: 'Add to list', trPasteNone: 'No lines to add.',
          trPasted: 'Added {v0} item(s).', trSkipped: '{v0} already on the list.',
          trPickHead: 'Tools, equipment and materials from DACUM', trPickAdd: 'Add the ticked items', trPickClose: 'Close',
          trPickAll: 'Tick all', trPickNothing: 'DACUM sent no tools, equipment or materials for this module.',
          trPickAdditional: 'Additional Info — tools list', trPickOnList: 'on the list',
          trPickNone: 'Tick at least one item.', trAfter: 'Proceed to Tools & Resources →'
          },
    fr: { expToolsResources: 'Outils, équipements et matériaux requis', trTab: 'Outils et ressources', trTitle: 'Outils, équipements et matériaux requis pour ce module',
          trHint: 'Une seule liste, imprimée sur sa propre page avant les références. Laissez-la vide pour ne pas imprimer la page.',
          trPh: 'ex. Jeu de tournevis', trAdd: 'Ajouter un élément', trPaste: 'Coller le texte', trDacum: 'Insérer depuis DACUM', trClear: 'Vider la liste',
          trClearQ: 'Supprimer tous les éléments de cette liste ?', trEmpty: 'Aucun élément pour l’instant.',
          trPasteTip: 'Une ligne devient un élément ; les puces et numéros sont retirés',
          trPasteHead: 'Collez la liste ici', trPasteOk: 'Ajouter à la liste', trPasteNone: 'Aucune ligne à ajouter.',
          trPasted: '{v0} élément(s) ajouté(s).', trSkipped: '{v0} déjà dans la liste.',
          trPickHead: 'Outils, équipements et matériaux de DACUM', trPickAdd: 'Ajouter les éléments cochés', trPickClose: 'Fermer',
          trPickAll: 'Tout cocher', trPickNothing: 'DACUM n’a envoyé ni outils, ni équipements, ni matériaux pour ce module.',
          trPickAdditional: 'Informations complémentaires — liste des outils', trPickOnList: 'dans la liste',
          trPickNone: 'Cochez au moins un élément.', trAfter: 'Continuer vers Outils et ressources →'
          },
    ar: { expToolsResources: 'الأدوات والمعدات والمواد المطلوبة', trTab: 'الأدوات والموارد', trTitle: 'الأدوات والمعدات والمواد المطلوبة لهذه الوحدة',
          trHint: 'قائمة واحدة تُطبع في صفحة مستقلة قبل المراجع. اتركها فارغة لتخطي الصفحة.',
          trPh: 'مثال: طقم مفكات', trAdd: 'إضافة بند', trPaste: 'لصق نص', trDacum: 'إدراج من DACUM', trClear: 'مسح القائمة',
          trClearQ: 'حذف كل البنود من هذه القائمة؟', trEmpty: 'لا توجد بنود بعد.',
          trPasteTip: 'كل سطر يصبح بنداً، وتُزال الرموز والأرقام في بدايته',
          trPasteHead: 'الصق القائمة هنا', trPasteOk: 'إضافة إلى القائمة', trPasteNone: 'لا توجد أسطر للإضافة.',
          trPasted: 'تمت إضافة {v0} بند.', trSkipped: '{v0} موجود مسبقاً في القائمة.',
          trPickHead: 'الأدوات والمعدات والمواد من DACUM', trPickAdd: 'إضافة البنود المحددة', trPickClose: 'إغلاق',
          trPickAll: 'تحديد الكل', trPickNothing: 'لم يرسل DACUM أدوات أو معدات أو مواد لهذه الوحدة.',
          trPickAdditional: 'معلومات إضافية — قائمة الأدوات', trPickOnList: 'في القائمة',
          trPickNone: 'حدّد بنداً واحداً على الأقل.', trAfter: 'المتابعة إلى الأدوات والموارد ←'
          }
});

function _trT(k, v0) {
    var s = window.i18n ? window.i18n.t(k) : k;
    return v0 === undefined ? s : String(s).replace('{v0}', v0);
}

function _trModule() {
    return (mbState.modulesData || []).find(function (m) { return m.id === mbState.currentModuleId; }) || null;
}
function _trRows(module) {
    if (!module) return [];
    if (!Array.isArray(module.toolsResources)) module.toolsResources = [];
    return module.toolsResources;
}
function _trNorm(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase(); }
function _trNextId(rows) { return rows.reduce(function (m, r) { return Math.max(m, r.id || 0); }, 0) + 1; }

/** The items to print (trimmed, empty rows dropped) for a module / state. */
function mbToolsList(state) {
    var st = state || window.mbState || {};
    var mods = Array.isArray(st.modulesData) ? st.modulesData : [];
    var m = mods.find(function (x) { return x.id === st.currentModuleId; });
    var rows = m && Array.isArray(m.toolsResources) ? m.toolsResources : [];
    return rows.map(function (r) { return String((r && r.value) || '').trim(); }).filter(Boolean);
}

/** Lines of pasted text → items: invisible characters removed, the
 *  bullet / number at the start of a line removed (never «2-inch pipe»:
 *  a marker must be followed by a space), empty lines dropped. */
var _TR_MARK = /^\s*(?:[\u2022\u00B7\u25AA\u25CF\u25CB\u25E6\u25A0\u25A1\u27A2\u27A4\u25BA\u2713\u2714*]|[-\u2013\u2014](?=\s)|\(?\d{1,3}\s*[.)\-\u2013](?=\s)|\(?[A-Za-z]\s*[.)](?=\s)|[\u0660-\u0669\u06F0-\u06F9]{1,3}\s*[.)\-](?=\s)|\(?[\u0623-\u064A]\s*[.)\-](?=\s))\s*/;
function mbToolsParse(raw) {
    return String(raw == null ? '' : raw)
        .replace(/\r\n?/g, '\n')
        .replace(/[\u00AD\u200B\u200C\u200D\u2060\uFEFF]/g, '')
        .replace(/\u0640+/g, '')
        .replace(/[\u00A0\u2007\u202F\t\f\v]/g, ' ')
        .replace(/[\u2028\u2029]/g, '\n')
        .split('\n')
        .map(function (l) { return l.replace(_TR_MARK, '').replace(/ {2,}/g, ' ').trim(); })
        .filter(Boolean);
}

/** Add items that are not on the list yet. Returns {added, skipped}. */
function _trAddItems(module, items) {
    var rows = _trRows(module);
    var have = new Set(rows.map(function (r) { return _trNorm(r.value); }));
    var added = 0, skipped = 0;
    /* an empty first row (the one a new list starts with) is filled first */
    items.forEach(function (t) {
        var k = _trNorm(t);
        if (!k) return;
        if (have.has(k)) { skipped++; return; }
        have.add(k);
        var blank = rows.find(function (r) { return !String(r.value || '').trim(); });
        if (blank) blank.value = t; else rows.push({ id: _trNextId(rows), value: t });
        added++;
    });
    return { added: added, skipped: skipped };
}

function _trDelIco() {
    return '<svg class="mb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 7h16"/><path d="M9.5 7V5.6A1.6 1.6 0 0 1 11.1 4h1.8a1.6 1.6 0 0 1 1.6 1.6V7"/><path d="M6.6 7l.75 11.6A1.7 1.7 0 0 0 9.05 20.2h5.9a1.7 1.7 0 0 0 1.7-1.6L17.4 7"/><path d="M10.3 11v5.4M13.7 11v5.4"/></svg>';
}

function mbToolsRender() {
    var list = document.getElementById('tools-list');
    if (!list) return;
    var module = _trModule();
    var rows = _trRows(module);
    var dir = (typeof biIsRtl === 'function' && biIsRtl(contentLang())) ? 'rtl' : 'ltr';
    list.innerHTML = rows.length ? rows.map(function (r, i) {
        return '<div class="tr-entry" data-tr-id="' + r.id + '">' +
            '<span class="tr-num" dir="ltr">' + (i + 1) + '-</span>' +
            '<input type="text" class="mb-content-field tr-input" dir="' + dir + '" placeholder="' + escapeHtml(_trT('trPh')) + '" value="' + escapeHtml(r.value) + '"' +
            ' data-act="mbToolsUpdate" data-on="input" data-args=\'[' + r.id + ',"$value"]\' />' +
            '<button type="button" class="mb-icon-btn danger" data-act="mbToolsDelete" data-args=\'[' + r.id + ']\' title="' + escapeHtml(_trT('mbDelete')) + '" aria-label="' + escapeHtml(_trT('mbDelete')) + '">' + _trDelIco() + '</button>' +
            '</div>';
    }).join('') : '<p class="example-text tr-empty">' + escapeHtml(_trT('trEmpty')) + '</p>';
}

function mbToolsUpdate(id, value) {
    var r = _trRows(_trModule()).find(function (x) { return x.id === id; });
    if (r) r.value = value;
}
function mbToolsAdd() {
    var module = _trModule();
    if (!module) return;
    var rows = _trRows(module);
    rows.push({ id: _trNextId(rows), value: '' });
    mbToolsRender();
    var ins = document.querySelectorAll('#tools-list .tr-input');
    if (ins.length) ins[ins.length - 1].focus();
}
function mbToolsDelete(id) {
    var module = _trModule();
    if (!module) return;
    module.toolsResources = _trRows(module).filter(function (r) { return r.id !== id; });
    mbToolsRender();
}
async function mbToolsClear() {
    var module = _trModule();
    if (!module || !_trRows(module).length) return;
    if (!(await mbConfirm(_trT('trClearQ'), { danger: true }))) return;
    module.toolsResources = [];
    mbToolsRender();
}

/* ── Paste text ──────────────────────────────────────────────── */
function _trAddFromText(raw) {
    var module = _trModule();
    var items = mbToolsParse(raw);
    if (!module || !items.length) { showStatus(_trT('trPasteNone'), 'error'); return false; }
    var r = _trAddItems(module, items);
    mbToolsRender();
    showStatus(_trT('trPasted', r.added) + (r.skipped ? ' ' + _trT('trSkipped', r.skipped) : ''), r.added ? 'success' : 'error');
    return true;
}
async function mbToolsPaste() {
    var raw = '';
    try { raw = await navigator.clipboard.readText(); } catch (e) { raw = ''; }
    if (mbToolsParse(raw).length) { _trAddFromText(raw); return; }
    mbToolsPasteBox();   // the clipboard could not be read (or was empty): paste into a box instead
}
function mbToolsPasteBox() {
    var host = document.getElementById('tools-pick');
    if (!host) return;
    host.innerHTML = '<div class="mb-pick" id="tr-pastebox"><div class="mb-pick-head" dir="auto">📝 ' + escapeHtml(_trT('trPasteHead')) + '</div>' +
        '<textarea id="tr-paste-ta" class="mb-content-field" rows="6" dir="auto" style="width:100%;"></textarea>' +
        '<div class="mb-pick-btns"><button type="button" class="btn-add" data-act="mbToolsPasteApply">➕ ' + escapeHtml(_trT('trPasteOk')) + '</button>' +
        '<button type="button" class="btn-add" data-act="mbToolsClosePick" style="background:#f1f5f9;color:#475569;">' + escapeHtml(_trT('trPickClose')) + '</button></div></div>';
    var ta = document.getElementById('tr-paste-ta');
    if (ta) ta.focus();
}
function mbToolsPasteApply() {
    var ta = document.getElementById('tr-paste-ta');
    if (!ta) return;
    if (_trAddFromText(ta.value)) mbToolsClosePick();
}
function mbToolsClosePick() {
    var host = document.getElementById('tools-pick');
    if (host) host.innerHTML = '';
}

/* ── Insert from DACUM ───────────────────────────────────────── */
function mbToolsDacumGroups(module) {
    var groups = [];
    if (!module) return groups;
    var src = module.taskAnalysisSource || {};
    var ids = (src.sourceTaskIds && src.sourceTaskIds.length) ? src.sourceTaskIds : Object.keys(src.taskAnalysis || {});
    ids.forEach(function (tid) {
        var items = (typeof _mbGetFieldItems === 'function') ? _mbGetFieldItems(module, tid, 'toolsEquipmentMaterials') : [];
        items = items.map(function (x) { return String(x == null ? '' : x).trim(); }).filter(Boolean);
        if (items.length) groups.push({ label: (typeof _mbTaskLabel === 'function') ? _mbTaskLabel(tid) : tid, items: items });
    });
    var extra = (Array.isArray(module.additionalInfoTools) ? module.additionalInfoTools : [])
        .map(function (x) { return String(x == null ? '' : x).trim(); }).filter(Boolean);
    if (extra.length) groups.push({ label: '🧰 ' + _trT('trPickAdditional'), items: extra, additional: true });
    return groups;
}
function mbToolsOpenDacum() {
    var host = document.getElementById('tools-pick');
    if (!host) return;
    if (host.querySelector('#tr-dacum-pick')) { host.innerHTML = ''; return; }   // a second press closes
    var module = _trModule();
    if (!module) return;
    var on = new Set(_trRows(module).map(function (r) { return _trNorm(r.value); }));
    var groups = mbToolsDacumGroups(module);
    var body = groups.map(function (g, gi) {
        var rows = g.items.map(function (t) {
            var used = on.has(_trNorm(t));
            return '<label class="mb-pick-row' + (used ? ' is-used' : '') + '"><input type="checkbox" data-text="' + escapeHtml(t) + '"' + (used ? ' disabled' : '') + '>' +
                '<span dir="auto">' + escapeHtml(t) + '</span>' + (used ? '<em>' + escapeHtml(_trT('trPickOnList')) + '</em>' : '') + '</label>';
        }).join('');
        return '<details class="mb-pick-task" open><summary>' + escapeHtml(g.label) + '</summary>' + rows + '</details>';
    }).join('');
    host.innerHTML = '<div class="mb-pick" id="tr-dacum-pick"><div class="mb-pick-head" dir="auto">📥 ' + escapeHtml(_trT('trPickHead')) + '</div>' +
        (body || '<p class="mb-pick-empty">' + escapeHtml(_trT('trPickNothing')) + '</p>') +
        '<div class="mb-pick-btns">' +
        (body ? '<button type="button" class="btn-add" data-act="mbToolsPickAll" style="background:#f1f5f9;color:#475569;">' + escapeHtml(_trT('trPickAll')) + '</button>' +
                '<button type="button" class="btn-add" data-act="mbToolsApplyPick">➕ ' + escapeHtml(_trT('trPickAdd')) + '</button>' : '') +
        '<button type="button" class="btn-add" data-act="mbToolsClosePick" style="background:#f1f5f9;color:#475569;">' + escapeHtml(_trT('trPickClose')) + '</button></div></div>';
}
function mbToolsPickAll() {
    document.querySelectorAll('#tr-dacum-pick input[type=checkbox]:not(:disabled)').forEach(function (cb) { cb.checked = true; });
}
function mbToolsApplyPick() {
    var module = _trModule();
    var items = Array.prototype.map.call(document.querySelectorAll('#tr-dacum-pick input[type=checkbox]:checked'), function (cb) { return cb.dataset.text; });
    if (!module || !items.length) { showStatus(_trT('trPickNone'), 'error'); return; }
    var r = _trAddItems(module, items);
    mbToolsRender();
    mbToolsClosePick();
    showStatus(_trT('trPasted', r.added), 'success');
}
