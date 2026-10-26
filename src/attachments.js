// ============================================================
// /src/attachments.js
// Attached figures and tables, and figure / table numbering (3.56.0)
//
// WHY
// A picture, a diagram or a table that belongs to no single step or
// content section had nowhere to go: put in a step, it was printed as
// that step; on the information sheet it sat in a content card beside
// text it had nothing to do with. Each sheet now has a card «Attached
// figures and tables». Each item in it is a picture or a table, with an
// optional caption and source, and a place in the PRINTED sheet: at the
// start, at the end, or before / after a chosen step or content section.
// On screen the items stay in the card; the place is shown on each one.
//
// NUMBERING (optional, Settings → Misc)
// «Figure 1-2-1», «Table 1-2-1» … for every picture and table of the
// sheets — those inside steps and content sections and the attached ones
// alike, in the order they are printed. Off by default, so an untouched
// install exports exactly what it did. Per sheet (sheet number - n) or
// one sequence for the whole module; the words are editable per
// language. Pictures inside steps and sections get an optional caption
// field of their own (stored as row.imageCaptions, parallel to the
// pictures).
//
// WHAT IS STORED WHERE
//   sheet.attachments   [{ uid, type: 'image'|'table', image, table,
//                          caption, source,       ← bilingual pairs
//                          place: { at: 'start'|'end'|'before'|'after',
//                                   ref: <uid of the step / section> } }]
//   row.imageCaptions   ['…', '…']   one per picture of a step / section
//   settings.figNumbering / figScope / figWords   (word_settings.js)
//
// A place points at the step's or section's uid, not at its number, so
// moving the steps keeps an item with its step. When that step is
// deleted the item prints at the end, and its card says so.
//
// EXPORTERS
// mbFigPrepare(flatState, lang) runs once on the flattened copy each
// exporter makes: it writes the numbered captions (row.__imgCaps,
// att.__caption, table.title). mbAttPlan(kind, sheet) gives the printed
// rows and, for each gap between them, the attached items printed there.
// ============================================================

/* ── Strings ─────────────────────────────────────────────────
   Owned here, matched to the interface language, as content.js and
   steps.js do for their own labels: a stale dictionary cannot leave a
   raw key on the card. */
var _MB_ATT_STR = {
    en: {
        cardTitle: 'Attached figures and tables',
        cardHintInfo: 'A picture, diagram or table that belongs to no single content section. Choose for each one where it is printed in the sheet.',
        cardHintAct: 'A picture, diagram or table that belongs to no single step. Choose for each one where it is printed in the sheet — it takes no step number.',
        add: 'Add attached item',
        chooseImage: 'Picture or diagram',
        chooseTable: 'Table',
        typeImage: 'Picture or diagram',
        typeTable: 'Table',
        pickImage: 'Choose picture',
        pasteImage: 'Paste picture',
        replaceImage: 'Replace picture',
        removeImage: 'Remove the picture',
        addTable: 'Add table',
        caption: 'Caption (optional)',
        source: 'Source (optional)',
        printed: 'Printed:',
        atEnd: 'At the end of the sheet',
        atStart: 'At the start of the sheet',
        atBefore: 'Before',
        atAfter: 'After',
        endInfo: 'At the end of the content',
        startInfo: 'Before the first content section',
        endAct: 'After the last step',
        startAct: 'Before the first step',
        missing: '(deleted)',
        warnMissing: 'The step or section this item was placed by no longer exists — it is printed at the end.',
        moveUp: 'Move this item up',
        moveDown: 'Move this item down',
        dragTip: 'Drag to reorder the items',
        remove: 'Remove this item',
        confirmRemove: 'Remove this attached item?',
        stepN: 'Step {n}',
        contentN: 'Content {n}',
        imgCaption: 'Caption (optional)',
        tableCaptionNote: 'The table’s title is its caption.',
        pasted: 'Picture pasted'
    },
    fr: {
        cardTitle: 'Figures et tableaux joints',
        cardHintInfo: 'Une image, un schéma ou un tableau qui n’appartient à aucune section de contenu. Choisissez pour chacun où il est imprimé dans la fiche.',
        cardHintAct: 'Une image, un schéma ou un tableau qui n’appartient à aucune étape. Choisissez pour chacun où il est imprimé dans la fiche — il ne prend pas de numéro d’étape.',
        add: 'Ajouter un élément joint',
        chooseImage: 'Image ou schéma',
        chooseTable: 'Tableau',
        typeImage: 'Image ou schéma',
        typeTable: 'Tableau',
        pickImage: 'Choisir une image',
        pasteImage: 'Coller une image',
        replaceImage: 'Remplacer l’image',
        removeImage: 'Retirer l’image',
        addTable: 'Ajouter un tableau',
        caption: 'Légende (facultatif)',
        source: 'Source (facultatif)',
        printed: 'Imprimé :',
        atEnd: 'À la fin de la fiche',
        atStart: 'Au début de la fiche',
        atBefore: 'Avant',
        atAfter: 'Après',
        endInfo: 'À la fin du contenu',
        startInfo: 'Avant la première section',
        endAct: 'Après la dernière étape',
        startAct: 'Avant la première étape',
        missing: '(supprimé)',
        warnMissing: 'L’étape ou la section près de laquelle cet élément était placé n’existe plus — il est imprimé à la fin.',
        moveUp: 'Monter cet élément',
        moveDown: 'Descendre cet élément',
        dragTip: 'Glisser pour réordonner les éléments',
        remove: 'Supprimer cet élément',
        confirmRemove: 'Supprimer cet élément joint ?',
        stepN: 'Étape {n}',
        contentN: 'Contenu {n}',
        imgCaption: 'Légende (facultatif)',
        tableCaptionNote: 'Le titre du tableau lui sert de légende.',
        pasted: 'Image collée'
    },
    ar: {
        cardTitle: 'أشكال وجداول ملحقة',
        cardHintInfo: 'صورة أو مخطط أو جدول لا يخص قسم محتوى بعينه. اختر لكل عنصر موضعه في الورقة المطبوعة.',
        cardHintAct: 'صورة أو مخطط أو جدول لا يخص خطوة بعينها. اختر لكل عنصر موضعه في الورقة المطبوعة، ولا يأخذ رقم خطوة.',
        add: 'إضافة عنصر ملحق',
        chooseImage: 'صورة أو مخطط',
        chooseTable: 'جدول',
        typeImage: 'صورة أو مخطط',
        typeTable: 'جدول',
        pickImage: 'اختيار صورة',
        pasteImage: 'لصق صورة',
        replaceImage: 'استبدال الصورة',
        removeImage: 'حذف الصورة',
        addTable: 'إضافة جدول',
        caption: 'عنوان الشكل (اختياري)',
        source: 'المصدر (اختياري)',
        printed: 'يُطبع:',
        atEnd: 'في نهاية الورقة',
        atStart: 'في بداية الورقة',
        atBefore: 'قبل',
        atAfter: 'بعد',
        endInfo: 'في نهاية المحتوى',
        startInfo: 'قبل أول قسم محتوى',
        endAct: 'بعد آخر خطوة',
        startAct: 'قبل أول خطوة',
        missing: '(محذوف)',
        warnMissing: 'الخطوة أو القسم الذي رُبط به هذا العنصر لم يعد موجوداً، فسيُطبع في النهاية.',
        moveUp: 'نقل هذا العنصر إلى الأعلى',
        moveDown: 'نقل هذا العنصر إلى الأسفل',
        dragTip: 'اسحب لإعادة ترتيب العناصر',
        remove: 'حذف هذا العنصر',
        confirmRemove: 'حذف هذا العنصر الملحق؟',
        stepN: 'الخطوة {n}',
        contentN: 'المحتوى {n}',
        imgCaption: 'عنوان الصورة (اختياري)',
        tableCaptionNote: 'عنوان الجدول هو تسميته.',
        pasted: 'تم لصق الصورة'
    }
};

/* The words printed before the numbers, per EXPORT language. The user's
   own words (Settings → Misc) win. */
var MB_FIG_WORDS = {
    en: { fig: 'Figure',  tab: 'Table',   src: 'Source' },
    fr: { fig: 'Figure',  tab: 'Tableau', src: 'Source' },
    ar: { fig: 'الشكل',   tab: 'الجدول',  src: 'المصدر' }
};

function _mbAttLang() {
    var l = (window.i18n && window.i18n.getLang) ? window.i18n.getLang() : 'en';
    return _MB_ATT_STR[l] ? l : 'en';
}
function _mbAttT(key, vars) {
    var s = (_MB_ATT_STR[_mbAttLang()] || _MB_ATT_STR.en)[key] || _MB_ATT_STR.en[key] || key;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.split('{' + k + '}').join(vars[k]); });
    return s;
}
function _mbAttEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
}
function _mbAttStr(v) { return (typeof v === 'string') ? v : (v == null ? '' : String(v)); }

/* ── Settings ────────────────────────────────────────────────── */
function _mbFigCfg() {
    var s = {};
    /* Read fresh, not from the export cache: a change saved in Settings
       applies to the very next export. */
    try {
        if (typeof wsReadSettings === 'function') s = wsReadSettings() || {};
        else if (typeof _wsGet === 'function') s = _wsGet() || {};
    } catch (e) { s = {}; }
    return {
        on: s.figNumbering === true,
        scope: s.figScope === 'module' ? 'module' : 'sheet',
        words: s.figWords || null
    };
}

/** The word for 'fig' | 'tab' | 'src' in `lang`: the user's, else ours. */
function mbFigWord(kind, lang, words) {
    var own = words || _mbFigCfg().words;
    var side = (own && own[lang]) || {};
    var v = _mbAttStr(side[kind]).trim();
    if (v) return v;
    return ((MB_FIG_WORDS[lang] || MB_FIG_WORDS.en)[kind]) || MB_FIG_WORDS.en[kind];
}

/** «Figure 1-2-3» — what the settings preview and the exports print. */
function mbFigLabel(kind, sheetNumber, n, lang, cfg) {
    cfg = cfg || _mbFigCfg();
    var no = (cfg.scope === 'sheet' && _mbAttStr(sheetNumber).trim())
        ? _mbAttStr(sheetNumber).trim() + '-' + n : String(n);
    return mbFigWord(kind, lang, cfg.words) + ' ' + no;
}

/* ── The printed order of a sheet ──────────────────────────────
   Shared by every exporter, so a picture is «Figure 3» in Word, PDF and
   HTML alike, and an attached item lands in the same place in each. */
function _mbAttRows(kind, sheet) {
    var rows = kind === 'info' ? (sheet && sheet.contentSections) : (sheet && sheet.steps);
    return Array.isArray(rows) ? rows : [];
}

/** The pictures of one step / content section, always an array. */
function mbAttRowImages(kind, sheet, row) {
    if (!sheet || !row) return [];
    var bag = kind === 'info' ? sheet.contentSectionImages : (sheet.images || sheet.stepImages);
    var id = kind === 'info' ? row.contentId : row.stepId;
    if (!bag || id === undefined || id === null || id === '') return [];
    var v = bag[id];
    if (!v) return [];
    return [].concat(v).filter(function (s) { return typeof s === 'string' && s; });
}

function _mbAttTableHasContent(t) {
    if (!t) return false;
    if (_mbAttStr(t.title).trim() || _mbAttStr(t.subtitle).trim()) return true;
    return (Array.isArray(t.cells) ? t.cells : []).some(function (r) {
        return (Array.isArray(r) ? r : []).some(function (c) { return _mbAttStr(c).trim(); });
    });
}

/** Is this step / section printed at all? */
function mbAttRowPrinted(kind, sheet, row) {
    if (!row) return false;
    if (_mbAttStr(row.text).trim()) return true;
    if (kind === 'info' && _mbAttStr(row.heading).trim()) return true;
    if (mbAttRowImages(kind, sheet, row).length) return true;
    if ((row.tables || []).some(function (t) { return t && t.rows && t.cols; })) return true;
    return (row.marks || []).some(function (m) { return m && _mbAttStr(m.text).trim(); });
}

function mbAttItemHasContent(a) {
    if (!a) return false;
    if (a.type === 'image') return typeof a.image === 'string' && !!a.image;
    if (a.type === 'table') return !!(a.table && a.table.rows && a.table.cols && _mbAttTableHasContent(a.table));
    return false;
}

/**
 * { items: [printed rows], slots: [[att…] × (items.length + 1)] }
 * slots[k] is printed just before items[k]; the last slot after them all.
 */
function mbAttPlan(kind, sheet) {
    var rows = _mbAttRows(kind, sheet);
    var printed = rows.map(function (r) { return mbAttRowPrinted(kind, sheet, r); });
    var items = rows.filter(function (r, i) { return printed[i]; });
    var slots = [];
    for (var i = 0; i <= items.length; i++) slots.push([]);
    (Array.isArray(sheet && sheet.attachments) ? sheet.attachments : []).forEach(function (a) {
        if (!mbAttItemHasContent(a)) return;
        slots[mbAttSlot(rows, printed, items.length, a.place)].push(a);
    });
    return { items: items, slots: slots };
}

function mbAttSlot(rows, printed, count, place) {
    var at = place && place.at;
    if (at === 'start') return 0;
    if ((at === 'before' || at === 'after') && place.ref) {
        var idx = -1;
        for (var i = 0; i < rows.length; i++) { if (rows[i] && rows[i].uid === place.ref) { idx = i; break; } }
        if (idx === -1) return count;               // the row was deleted: at the end
        var before = 0;
        for (var j = 0; j < idx; j++) if (printed[j]) before++;
        return at === 'before' ? before : before + (printed[idx] ? 1 : 0);
    }
    return count;
}

/* ── Numbering ─────────────────────────────────────────────────
   On the exporter's flattened copy, once. Writes:
     row.__imgCaps[i]  the caption line under picture i ('' = none)
     table.title       numbered, when numbering is on
     att.__caption     the caption line of an attached picture
   With numbering off the captions are the author's text alone, so an
   untouched project prints exactly what it did. */
function mbFigPrepare(st, lang) {
    if (!st || st.__mbFigDone) return st;
    try { Object.defineProperty(st, '__mbFigDone', { value: true, enumerable: false }); }
    catch (e) { st.__mbFigDone = true; }
    var cfg = _mbFigCfg();
    var count = { fig: 0, tab: 0 };
    var cap = function (kind, num, text) {
        text = _mbAttStr(text).trim();
        if (!cfg.on) return text;
        count[kind]++;
        var label = mbFigLabel(kind, num, count[kind], lang, cfg);
        return text ? label + ': ' + text : label;
    };
    var doTables = function (tables, num) {
        (tables || []).forEach(function (t) {
            if (!t || !t.rows || !t.cols || !_mbAttTableHasContent(t)) return;
            if (cfg.on) t.title = cap('tab', num, t.title);
        });
    };

    (st.learningOutcomesData || []).forEach(function (lo, loIndex) {
        var seq = (typeof mbLoSequence === 'function') ? mbLoSequence(lo)
            : (lo.infoSheets || []).map(function (x, i) { return { kind: 'info', index: i }; })
                .concat((lo.activitySheets || []).map(function (x, i) { return { kind: 'activity', index: i }; }));
        seq.forEach(function (it) {
            if (it.kind !== 'info' && it.kind !== 'activity') return;
            var sh = ((it.kind === 'info' ? lo.infoSheets : lo.activitySheets) || [])[it.index];
            if (!sh || !_mbAttStr(sh.title).trim()) return;          // not printed
            var num = (typeof mbSeqNumber === 'function') ? mbSeqNumber(lo, loIndex, it.kind, it.index)
                : _mbAttStr(sh.sheetNumber);
            if (cfg.scope === 'sheet') count = { fig: 0, tab: 0 };
            var plan = mbAttPlan(it.kind, sh);
            var doAtts = function (list) {
                list.forEach(function (a) {
                    if (a.type === 'image') a.__caption = cap('fig', num, a.caption);
                    else doTables([a.table], num);
                });
            };
            plan.items.forEach(function (row, k) {
                doAtts(plan.slots[k]);
                var caps = Array.isArray(row.imageCaptions) ? row.imageCaptions : [];
                row.__imgCaps = mbAttRowImages(it.kind, sh, row).map(function (im, i) { return cap('fig', num, caps[i]); });
                doTables(row.tables, num);
            });
            doAtts(plan.slots[plan.items.length]);
        });
    });
    return st;
}

/** «Source: …» in the export language, or '' when the author gave none. */
function mbFigSourceLine(a, lang) {
    var s = _mbAttStr(a && a.source).trim();
    return s ? mbFigWord('src', lang) + ': ' + s : '';
}

/* ═══════════════════════════════════════════════════════════════
   The editor
   ═══════════════════════════════════════════════════════════════ */

var MB_ATT_KINDS = {
    info:     { list: 'info-attachments',     card: 'info-attachments-card',     rows: '#content-sections-container > .content-section-item' },
    activity: { list: 'activity-attachments', card: 'activity-attachments-card', rows: '#steps-container > .step-item' }
};

/* 3.67.0: the card is closed behind its title while it holds no item.
   The title is a button: on an empty card it opens it with a first
   item ready (one click, not two); on a card with items it folds and
   unfolds the list, the count shown beside the title. Removing the last
   item closes it again. Nothing here is stored — the items are. */
function _mbAttSync(kind, open) {
    var k = MB_ATT_KINDS[kind];
    var card = k && document.getElementById(k.card);
    var list = k && document.getElementById(k.list);
    if (!card || !list) return;
    var n = list.querySelectorAll('.mb-att-item').length;
    var collapsed = n === 0 ? true : (open === undefined ? card.classList.contains('is-collapsed') : !open);
    card.classList.toggle('is-collapsed', collapsed);
    card.classList.toggle('has-items', n > 0);
    var btn = card.querySelector('.mb-att-toggle');
    if (btn) btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    var c = card.querySelector('.mb-att-count');
    if (c) c.textContent = n ? '(' + n + ')' : '';
}
function mbAttToggle(kind) {
    var k = MB_ATT_KINDS[kind];
    var card = k && document.getElementById(k.card);
    var list = k && document.getElementById(k.list);
    if (!card || !list) return;
    if (!list.querySelector('.mb-att-item')) { mbAttAdd(kind); return; }
    _mbAttSync(kind, card.classList.contains('is-collapsed'));
}
var _mbAttCount = 0;

function _mbAttImages() {
    if (!window.mbState) return {};
    if (!mbState.attachImages) mbState.attachImages = {};
    return mbState.attachImages;
}
function _mbImgCaps() {
    if (!window.mbState) return {};
    if (!mbState.imageCaptions) mbState.imageCaptions = {};
    return mbState.imageCaptions;
}

/* The rows a place can point at, as the author sees them now. */
function _mbAttRowChoices(kind) {
    var cfg = MB_ATT_KINDS[kind];
    var out = [];
    document.querySelectorAll(cfg.rows).forEach(function (el, i) {
        var uid = el.dataset ? el.dataset.uid : '';
        if (!uid) return;
        var ta = el.querySelector(kind === 'info' ? 'textarea[data-content-id]' : 'textarea[data-step-id]');
        var first = ta ? _mbAttStr(ta.value).replace(/\s+/g, ' ').trim() : '';
        if (first.length > 40) first = first.slice(0, 40) + '…';
        var name;
        if (kind === 'info') {
            var h = (el.dataset && el.dataset.heading) ? el.dataset.heading : '';
            name = h || _mbAttT('contentN', { n: i + 1 });
        } else {
            name = _mbAttT('stepN', { n: i + 1 });
        }
        out.push({ uid: uid, label: name + (first && !(kind === 'info' && el.dataset.heading) ? ' — ' + first : '') });
    });
    return out;
}

function _mbAttPaintPlace(card) {
    if (!card) return;
    var kind = card.getAttribute('data-att-kind');
    var atSel = card.querySelector('.mb-att-at');
    var refSel = card.querySelector('.mb-att-ref');
    var warn = card.querySelector('.mb-att-warn');
    if (!atSel || !refSel) return;
    var at = atSel.value;
    var want = refSel.getAttribute('data-ref') || refSel.value || '';
    var choices = _mbAttRowChoices(kind);
    var found = choices.some(function (c) { return c.uid === want; });
    var html = choices.map(function (c) {
        return '<option value="' + _mbAttEsc(c.uid) + '"' + (c.uid === want ? ' selected' : '') + '>' + _mbAttEsc(c.label) + '</option>';
    }).join('');
    if (want && !found) html = '<option value="' + _mbAttEsc(want) + '" selected>' + _mbAttEsc(_mbAttT('missing')) + '</option>' + html;
    refSel.innerHTML = html;
    if (!want && choices.length) refSel.value = choices[0].uid;
    refSel.setAttribute('data-ref', refSel.value || '');
    var needsRef = at === 'before' || at === 'after';
    refSel.hidden = !needsRef;
    if (warn) warn.hidden = !(needsRef && want && !found);
}

function mbAttRefreshPlaces(kind) {
    var kinds = kind ? [kind] : Object.keys(MB_ATT_KINDS);
    kinds.forEach(function (k) {
        var list = document.getElementById(MB_ATT_KINDS[k].list);
        if (list) list.querySelectorAll('.mb-att-item').forEach(_mbAttPaintPlace);
    });
}

function _mbAttAtOptions(kind, at) {
    var start = kind === 'info' ? 'startInfo' : 'startAct';
    var end = kind === 'info' ? 'endInfo' : 'endAct';
    return [['end', end], ['start', start], ['before', 'atBefore'], ['after', 'atAfter']].map(function (o) {
        return '<option value="' + o[0] + '"' + (o[0] === at ? ' selected' : '') + ' data-att-t="' + o[1] + '">' +
               _mbAttEsc(_mbAttT(o[1])) + '</option>';
    }).join('');
}

var _MB_ATT_TRASH = '<svg class="mb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 7h16"/><path d="M9.5 7V5.6A1.6 1.6 0 0 1 11.1 4h1.8a1.6 1.6 0 0 1 1.6 1.6V7"/><path d="M6.6 7l.75 11.6A1.7 1.7 0 0 0 9.05 20.2h5.9a1.7 1.7 0 0 0 1.7-1.6L17.4 7"/><path d="M10.3 11v5.4M13.7 11v5.4"/></svg>';

function _mbAttBuild(kind, data) {
    _mbAttCount++;
    var aid = _mbAttCount;
    data = data || {};
    var type = (data.type === 'image' || data.type === 'table') ? data.type : '';
    var place = data.place || {};
    var at = ['start', 'end', 'before', 'after'].indexOf(place.at) !== -1 ? place.at : 'end';
    var cl = (typeof contentLang === 'function') ? contentLang() : 'en';
    var get = function (v) {
        if (typeof biGetStrict === 'function') return biGetStrict(v, cl) || '';
        return _mbAttStr(v);
    };

    var card = document.createElement('div');
    card.className = 'mb-att-item';
    card.id = 'att-item-' + aid;
    card.setAttribute('data-att-id', String(aid));
    card.setAttribute('data-att-kind', kind);
    card.setAttribute('data-att-type', type);
    if (data.uid && typeof mbRestoreRowUid === 'function') { card.dataset.uid = data.uid; }
    else if (typeof mbNewRowUid === 'function') mbNewRowUid(card);

    card.innerHTML =
        '<div class="mb-att-head">' +
          '<span class="mb-step-handle" data-att-tip="dragTip" title="' + _mbAttEsc(_mbAttT('dragTip')) + '" aria-label="' + _mbAttEsc(_mbAttT('dragTip')) + '" role="img">⠿</span>' +
          '<span class="mb-att-title" data-att-type-label>' + _mbAttEsc(type ? _mbAttT(type === 'image' ? 'typeImage' : 'typeTable') : _mbAttT('add')) + '</span>' +
          '<span class="mb-att-move">' +
            '<button type="button" class="mb-step-move" data-act="mbAttMoveUp" data-args=\'[' + aid + ']\' data-att-tip="moveUp" title="' + _mbAttEsc(_mbAttT('moveUp')) + '" aria-label="' + _mbAttEsc(_mbAttT('moveUp')) + '">▲</button>' +
            '<button type="button" class="mb-step-move" data-act="mbAttMoveDown" data-args=\'[' + aid + ']\' data-att-tip="moveDown" title="' + _mbAttEsc(_mbAttT('moveDown')) + '" aria-label="' + _mbAttEsc(_mbAttT('moveDown')) + '">▼</button>' +
          '</span>' +
          '<button type="button" class="btn-remove mb-icon-btn danger" data-act="mbAttRemove" data-args=\'[' + aid + ']\' data-att-tip="remove" title="' + _mbAttEsc(_mbAttT('remove')) + '" aria-label="' + _mbAttEsc(_mbAttT('remove')) + '">' + _MB_ATT_TRASH + '</button>' +
        '</div>' +
        '<div class="mb-att-choose"' + (type ? ' hidden' : '') + '>' +
          '<button type="button" class="btn-add-image" data-act="mbAttSetType" data-args=\'[' + aid + ',"image"]\'>🖼️ <span data-att-t="chooseImage">' + _mbAttEsc(_mbAttT('chooseImage')) + '</span></button>' +
          '<button type="button" class="btn-add-mark" style="background:#0ea5e9;" data-act="mbAttSetType" data-args=\'[' + aid + ',"table"]\'>📊 <span data-att-t="chooseTable">' + _mbAttEsc(_mbAttT('chooseTable')) + '</span></button>' +
        '</div>' +
        '<div class="mb-att-body mb-att-body-image"' + (type === 'image' ? '' : ' hidden') + '>' +
          '<div class="mb-att-img" id="att-img-' + aid + '" data-att-id="' + aid + '"></div>' +
          '<div class="mb-att-btns">' +
            '<button type="button" class="btn-add-image" data-act="mbAttPickImage" data-args=\'[' + aid + ']\'>🖼️ <span data-att-t="pickImage">' + _mbAttEsc(_mbAttT('pickImage')) + '</span></button>' +
            '<button type="button" class="btn-add-image btn-paste-image" data-act="mbAttPasteImage" data-args=\'[' + aid + ']\'>📋 <span data-att-t="pasteImage">' + _mbAttEsc(_mbAttT('pasteImage')) + '</span></button>' +
          '</div>' +
          '<input type="file" accept="image/*" style="display:none;" id="att-file-' + aid + '" data-act="mbAttImageFile" data-on="change" data-args=\'[' + aid + ']\'>' +
          '<input type="text" class="mb-att-caption mb-content-field" dir="auto" data-att-ph="caption" placeholder="' + _mbAttEsc(_mbAttT('caption')) + '" value="' + _mbAttEsc(get(data.caption)) + '">' +
        '</div>' +
        '<div class="mb-att-body mb-att-body-table"' + (type === 'table' ? '' : ' hidden') + '>' +
          '<p class="mb-att-note" data-att-t="tableCaptionNote">' + _mbAttEsc(_mbAttT('tableCaptionNote')) + '</p>' +
          '<div class="mb-att-tablebox" id="content-tables-att-' + aid + '"></div>' +
          '<button type="button" class="btn-add-mark mb-att-addtable" style="background:#0ea5e9;" data-act="mbAttAddTable" data-args=\'[' + aid + ']\'>➕ <span data-att-t="addTable">' + _mbAttEsc(_mbAttT('addTable')) + '</span></button>' +
        '</div>' +
        '<div class="mb-att-fields"' + (type ? '' : ' hidden') + '>' +
          '<input type="text" class="mb-att-source mb-content-field" dir="auto" data-att-ph="source" placeholder="' + _mbAttEsc(_mbAttT('source')) + '" value="' + _mbAttEsc(get(data.source)) + '">' +
          '<div class="mb-att-place">' +
            '<label data-att-t="printed">' + _mbAttEsc(_mbAttT('printed')) + '</label>' +
            '<select class="mb-att-at">' + _mbAttAtOptions(kind, at) + '</select>' +
            '<select class="mb-att-ref" data-ref="' + _mbAttEsc(place.ref || '') + '"></select>' +
          '</div>' +
          '<div class="mb-att-warn" data-att-t="warnMissing" hidden>⚠️ ' + _mbAttEsc(_mbAttT('warnMissing')) + '</div>' +
        '</div>';

    if (type === 'image' && data.image) _mbAttImages()[aid] = data.image;
    return card;
}

function _mbAttRenderImage(aid) {
    var box = document.getElementById('att-img-' + aid);
    if (!box) return;
    var src = _mbAttImages()[aid];
    var card = document.getElementById('att-item-' + aid);
    var pick = card && card.querySelector('[data-act="mbAttPickImage"] span');
    if (pick) { pick.setAttribute('data-att-t', src ? 'replaceImage' : 'pickImage'); pick.textContent = _mbAttT(src ? 'replaceImage' : 'pickImage'); }
    box.innerHTML = src
        ? '<div class="content-img-thumb mb-att-thumb"><img src="' + _mbAttEsc(src) + '" alt="">' +
          '<button type="button" class="content-img-delete" data-act="mbAttClearImage" data-args=\'[' + aid + ']\' title="' + _mbAttEsc(_mbAttT('removeImage')) + '">×</button></div>'
        : '';
}

function _mbAttTouch(el) {
    if (el) el.dispatchEvent(new Event('change', { bubbles: true }));
}

/** ➕ under the list. */
function mbAttAdd(kind) {
    if (!MB_ATT_KINDS[kind]) return;
    var list = document.getElementById(MB_ATT_KINDS[kind].list);
    if (!list) return;
    var card = _mbAttBuild(kind, {});
    list.appendChild(card);
    _mbAttSync(kind, true);   // 3.67.0
    _mbAttPaintPlace(card);
    try { card.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { /* old browser */ }
}

function mbAttSetType(aid, type) {
    var card = document.getElementById('att-item-' + aid);
    if (!card || (type !== 'image' && type !== 'table')) return;
    card.setAttribute('data-att-type', type);
    card.querySelector('.mb-att-choose').hidden = true;
    card.querySelector('.mb-att-body-image').hidden = type !== 'image';
    card.querySelector('.mb-att-body-table').hidden = type !== 'table';
    card.querySelector('.mb-att-fields').hidden = false;
    var lbl = card.querySelector('[data-att-type-label]');
    if (lbl) lbl.textContent = _mbAttT(type === 'image' ? 'typeImage' : 'typeTable');
    if (type === 'table' && typeof addContentTable === 'function') addContentTable('att-' + aid);
    _mbAttPaintPlace(card);
    _mbAttTouch(card);
}

function mbAttAddTable(aid) {
    var box = document.getElementById('content-tables-att-' + aid);
    if (box && !box.querySelector('.content-table-widget') && typeof addContentTable === 'function') addContentTable('att-' + aid);
}

async function mbAttRemove(aid) {
    var card = document.getElementById('att-item-' + aid);
    if (!card) return;
    var ok = (typeof mbConfirm === 'function') ? await mbConfirm(_mbAttT('confirmRemove'), { danger: true }) : confirm(_mbAttT('confirmRemove'));
    if (!ok) return;
    var parent = card.parentNode;
    var kind = card.getAttribute('data-att-kind');
    card.remove();
    delete _mbAttImages()[aid];
    _mbAttSync(kind);   // 3.67.0: the last one closes the card
    _mbAttTouch(parent);
}

/* ── 3.80.3: reorder the items — ▲ / ▼ and the ⠿ handle ─────────
   The same controls as the content cards and the steps. The items print
   in list order within the place chosen for them, so the order on screen
   is the order in the document. As there, the sheet is stored BEFORE the
   move so every item is on record under its uid; the save after the move
   then matches by uid, never by position (uid.js, biMergeArrayById). */
function _mbAttMove(aid, dir) {
    var el = document.getElementById('att-item-' + aid);
    if (!el || !el.parentNode) return;
    var box = el.parentNode;
    if (typeof saveCurrentSheetToLO === 'function') {
        try { saveCurrentSheetToLO(); } catch (e) { /* ignore */ }
    }
    if (dir < 0) {
        var prev = el.previousElementSibling;
        if (!prev) return;
        box.insertBefore(el, prev);
    } else {
        var next = el.nextElementSibling;
        if (!next) return;
        box.insertBefore(el, next.nextSibling);
    }
    mbAttRenumber();
    var btn = el.querySelector(dir < 0 ? '[data-act="mbAttMoveUp"]' : '[data-act="mbAttMoveDown"]');
    if (btn && !btn.disabled) btn.focus();
    if (el.scrollIntoView) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    _mbAttTouch(box);
}
function mbAttMoveUp(aid)   { _mbAttMove(aid, -1); }
function mbAttMoveDown(aid) { _mbAttMove(aid, +1); }

/** The first item cannot go up and the last cannot go down. */
function mbAttRenumber() {
    document.querySelectorAll('.mb-att-list').forEach(function (list) {
        var items = Array.prototype.filter.call(list.children, function (c) { return c.classList.contains('mb-att-item'); });
        items.forEach(function (item, i) {
            var up = item.querySelector('[data-act="mbAttMoveUp"]');
            var down = item.querySelector('[data-act="mbAttMoveDown"]');
            if (up) up.disabled = (i === 0);
            if (down) down.disabled = (i === items.length - 1);
        });
    });
}

/* Drag by the ⠿ handle only — see content.js mbContentDrag for the
   reasoning. Touch screens have the ▲ / ▼ buttons. */
(function mbAttDrag() {
    var SEL = '.mb-att-list > .mb-att-item';
    var dragEl = null, hist = null;

    function release() {
        document.querySelectorAll(SEL + '[draggable="true"]').forEach(function (el) {
            if (el !== dragEl) el.removeAttribute('draggable');
        });
    }
    document.addEventListener('pointerdown', function (e) {
        var h = e.target && e.target.closest && e.target.closest('.mb-att-list .mb-step-handle');
        if (!h) return;
        var item = h.closest('.mb-att-item');
        if (item) item.setAttribute('draggable', 'true');
    });
    document.addEventListener('pointerup', release);

    document.addEventListener('dragstart', function (e) {
        var item = e.target && e.target.closest && e.target.closest(SEL);
        if (!item || item.getAttribute('draggable') !== 'true') return;
        if (typeof saveCurrentSheetToLO === 'function') {
            try { saveCurrentSheetToLO(); } catch (err) { /* ignore */ }
        }
        dragEl = item;
        item.classList.add('is-dragging');
        try {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', '');
        } catch (err) { /* ignore */ }
        hist = (typeof mbHistBegin === 'function') ? mbHistBegin('moveAttachment') : null;
    });

    document.addEventListener('dragover', function (e) {
        if (!dragEl) return;
        var box = dragEl.parentNode;
        var target = e.target && e.target.closest && e.target.closest(SEL);
        if (!box || !box.contains(e.target)) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        if (!target || target === dragEl || target.parentNode !== box) return;
        var r = target.getBoundingClientRect();
        var before = e.clientY < r.top + r.height / 2;
        var ref = before ? target : target.nextSibling;
        if (ref !== dragEl && ref !== dragEl.nextSibling) box.insertBefore(dragEl, ref);
    });

    document.addEventListener('drop', function (e) {
        if (dragEl) e.preventDefault();
    });

    document.addEventListener('dragend', function () {
        if (!dragEl) return;
        var el = dragEl;
        dragEl = null;
        el.classList.remove('is-dragging');
        el.removeAttribute('draggable');
        mbAttRenumber();
        if (hist && typeof mbHistEnd === 'function') mbHistEnd(hist);
        hist = null;
        (el.parentNode || document).dispatchEvent(new Event('change', { bubbles: true }));
    });
})();

function mbAttPickImage(aid) {
    var input = document.getElementById('att-file-' + aid);
    if (input) input.click();
}

function mbAttImageFile(aid) {
    var input = document.getElementById('att-file-' + aid);
    if (!input || !input.files || !input.files[0]) return;
    var file = input.files[0];
    input.value = '';
    var put = function (dataUrl) {
        _mbAttImages()[aid] = dataUrl;
        _mbAttRenderImage(aid);
        _mbAttTouch(document.getElementById('att-item-' + aid));
    };
    if (typeof mbPrepareImages === 'function') {
        mbPrepareImages([file], 'content').then(function (res) { if (res && res[0]) put(res[0].dataUrl); });
        return;
    }
    var r = new FileReader();
    r.onload = function (e) { put(e.target.result); };
    r.readAsDataURL(file);
}

function mbAttPasteImage(aid) {
    if (typeof mbPasteImageInto === 'function') mbPasteImageInto('attach', String(aid));
}

function mbAttClearImage(aid) {
    delete _mbAttImages()[aid];
    _mbAttRenderImage(aid);
    _mbAttTouch(document.getElementById('att-item-' + aid));
}

/* The paste target: one picture per item, replaced rather than added. */
if (typeof MB_PASTE_TARGETS === 'object' && MB_PASTE_TARGETS) {
    MB_PASTE_TARGETS.attach = {
        put: function (id, dataUrl) {
            _mbAttImages()[id] = dataUrl;
            _mbAttRenderImage(id);
            _mbAttTouch(document.getElementById('att-item-' + id));
            if (typeof showStatus === 'function') showStatus(_mbAttT('pasted'), 'success');
        },
        cardSelector: '.mb-att-item[data-att-type="image"]',
        idAttr: 'data-att-id'
    };
}

/* ── Save / load ──────────────────────────────────────────────── */

/** The items on screen, for saveCurrentSheetToLO. */
function mbAttCollect(kind, stored) {
    var list = MB_ATT_KINDS[kind] && document.getElementById(MB_ATT_KINDS[kind].list);
    if (!list) return Array.isArray(stored) ? stored : [];
    var incoming = [];
    list.querySelectorAll('.mb-att-item').forEach(function (card) {
        var aid = card.getAttribute('data-att-id');
        var type = card.getAttribute('data-att-type');
        if (type !== 'image' && type !== 'table') return;
        var atSel = card.querySelector('.mb-att-at');
        var refSel = card.querySelector('.mb-att-ref');
        var at = atSel ? atSel.value : 'end';
        var ref = (at === 'before' || at === 'after') && refSel ? (refSel.value || refSel.getAttribute('data-ref') || '') : '';
        var tables = (typeof collectContentTables === 'function') ? collectContentTables('att-' + aid) : [];
        incoming.push({
            uid: card.dataset.uid || undefined,
            type: type,
            image: type === 'image' ? (_mbAttImages()[aid] || null) : null,
            table: type === 'table' ? (tables[0] || null) : null,
            caption: type === 'image' ? ((card.querySelector('.mb-att-caption') || {}).value || '') : '',
            source: (card.querySelector('.mb-att-source') || {}).value || '',
            place: { at: at, ref: ref }
        });
    });
    if (typeof biMergeArrayById === 'function') return biMergeArrayById(stored, incoming, ['caption', 'source']);
    return incoming;
}

/** Empty the card (any sheet change or reset). */
function mbAttReset(kind) {
    var list = MB_ATT_KINDS[kind] && document.getElementById(MB_ATT_KINDS[kind].list);
    if (!list) return;
    list.querySelectorAll('.mb-att-item').forEach(function (card) {
        delete _mbAttImages()[card.getAttribute('data-att-id')];
    });
    list.innerHTML = '';
    _mbAttSync(kind);   // 3.67.0
}

/** Paint the stored items of `sheet` (null = none). */
function mbAttLoad(kind, sheet) {
    mbAttReset(kind);
    var list = MB_ATT_KINDS[kind] && document.getElementById(MB_ATT_KINDS[kind].list);
    if (!list) return;
    (Array.isArray(sheet && sheet.attachments) ? sheet.attachments : []).forEach(function (a) {
        if (!a || (a.type !== 'image' && a.type !== 'table')) return;
        var card = _mbAttBuild(kind, a);
        list.appendChild(card);
        var aid = card.getAttribute('data-att-id');
        if (a.type === 'image') _mbAttRenderImage(aid);
        if (a.type === 'table' && a.table && typeof addContentTable === 'function') addContentTable('att-' + aid, a.table);
    });
    _mbAttSync(kind, list.querySelector('.mb-att-item') ? true : false);   // 3.67.0: open when it holds items
    mbAttRefreshPlaces(kind);
}

/* ── Captions of the pictures inside steps and sections ─────────
   Keyed like the picture bags ('s:<stepId>' / 'c:<contentId>'), kept in
   mbState.imageCaptions while the sheet is open, and stored on the row
   itself (row.imageCaptions) — so they travel with the row, never with
   a DOM number. */
function _mbCapKey(kind, id) { return (kind === 'info' ? 'c:' : 's:') + id; }

function mbImgCapsHtml(kind, id, i) {
    var caps = _mbImgCaps()[_mbCapKey(kind, id)] || [];
    return '<input type="text" class="mb-img-cap" dir="auto" data-cap-kind="' + kind + '" data-cap-id="' + _mbAttEsc(id) +
           '" data-cap-i="' + i + '" data-att-ph="imgCaption" placeholder="' + _mbAttEsc(_mbAttT('imgCaption')) +
           '" value="' + _mbAttEsc(caps[i] || '') + '">';
}

function mbImgCapsGet(kind, id, count) {
    var caps = (_mbImgCaps()[_mbCapKey(kind, id)] || []).slice(0, count);
    while (caps.length && !_mbAttStr(caps[caps.length - 1]).trim()) caps.pop();
    return caps;
}

function mbImgCapsSet(kind, id, caps) {
    var map = _mbImgCaps();
    if (Array.isArray(caps) && caps.length) map[_mbCapKey(kind, id)] = caps.slice();
    else delete map[_mbCapKey(kind, id)];
}

/** A picture removed: its caption goes with it. */
function mbImgCapsSplice(kind, id, index) {
    var arr = _mbImgCaps()[_mbCapKey(kind, id)];
    if (Array.isArray(arr)) arr.splice(index, 1);
}

function mbImgCapsReset(kind) {
    var map = _mbImgCaps();
    var pre = kind === 'info' ? 'c:' : 's:';
    Object.keys(map).forEach(function (k) { if (k.indexOf(pre) === 0) delete map[k]; });
}

/* ── Wiring ───────────────────────────────────────────────────── */
document.addEventListener('input', function (e) {
    var el = e.target;
    if (el && el.classList && el.classList.contains('mb-img-cap')) {
        var key = _mbCapKey(el.getAttribute('data-cap-kind'), el.getAttribute('data-cap-id'));
        var map = _mbImgCaps();
        var arr = map[key] || (map[key] = []);
        arr[parseInt(el.getAttribute('data-cap-i'), 10) || 0] = el.value;
        for (var i = 0; i < arr.length; i++) if (arr[i] === undefined) arr[i] = '';
    }
});

document.addEventListener('change', function (e) {
    var el = e.target;
    if (!el || !el.classList) return;
    if (el.classList.contains('mb-att-at')) _mbAttPaintPlace(el.closest('.mb-att-item'));
    if (el.classList.contains('mb-att-ref')) el.setAttribute('data-ref', el.value || '');
});

/* The step names in the lists follow edits, moves and deletes. */
document.addEventListener('focusin', function (e) {
    var el = e.target;
    if (el && el.classList && el.classList.contains('mb-att-ref')) _mbAttPaintPlace(el.closest('.mb-att-item'));
});

function _mbAttPaintStatic() {
    document.querySelectorAll('[data-att-t]').forEach(function (el) {
        var k = el.getAttribute('data-att-t');
        if (el.tagName === 'OPTION' || !el.children.length) el.textContent = (k === 'warnMissing' ? '⚠️ ' : '') + _mbAttT(k);
    });
    document.querySelectorAll('[data-att-ph]').forEach(function (el) {
        el.placeholder = _mbAttT(el.getAttribute('data-att-ph'));
    });
    document.querySelectorAll('[data-att-tip]').forEach(function (el) {
        el.title = _mbAttT(el.getAttribute('data-att-tip'));
        el.setAttribute('aria-label', el.title);
    });
    document.querySelectorAll('.mb-att-item').forEach(function (card) {
        var type = card.getAttribute('data-att-type');
        var lbl = card.querySelector('[data-att-type-label]');
        if (lbl) lbl.textContent = _mbAttT(type === 'image' ? 'typeImage' : type === 'table' ? 'typeTable' : 'add');
    });
    mbAttRefreshPlaces();
}
window.addEventListener('mb:langchange', _mbAttPaintStatic);

(function mbAttStart() {
    function start() {
        _mbAttPaintStatic();
        if (!window.MutationObserver) return;
        var timer = null;
        var obs = new MutationObserver(function () {
            clearTimeout(timer);
            timer = setTimeout(function () { mbAttRefreshPlaces(); }, 60);
        });
        ['content-sections-container', 'steps-container'].forEach(function (id) {
            var box = document.getElementById(id);
            if (box) obs.observe(box, { childList: true });
        });
        /* 3.80.3: the ▲ / ▼ follow the items as they come and go. */
        var renum = new MutationObserver(mbAttRenumber);
        Object.keys(MB_ATT_KINDS).forEach(function (k) {
            var list = document.getElementById(MB_ATT_KINDS[k].list);
            if (list) renum.observe(list, { childList: true });
        });
        mbAttRenumber();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
