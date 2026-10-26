// ============================================================
// /src/content.js
// Content sections, content tables, images, QR
// Extracted verbatim from Module_Builder.html lines 4153-4501 (v2.0-legacy).
// ============================================================

/* This button's label has now been reported broken three times running,
   each time traced to the SAME root cause: the mb-translations.js that
   is actually loaded on the live page does not match the one reviewed
   locally — a stale deploy or an old cached file, not a defect in this
   code. Every fix attempt that still asked window.i18n.t() to look the
   key up first was therefore still hostage to that mismatch: an English
   fallback is progress over the raw key, but it is still the wrong
   language on an Arabic screen.

   So these two strings are resolved from a small table THIS FILE OWNS —
   window.i18n.t() is not consulted for them at all — matched to the
   CURRENT INTERFACE LANGUAGE. Same fix as the Learning Guide card hit
   the identical failure and was given its own string table for the same
   reason. Whatever mb-translations.js does or does not contain from now
   on, this button reads correctly in Arabic on an Arabic screen. */
var _MB_PASTE_LABELS = {
    ar: { rxPasteImage: 'لصق صورة', rxPasteImageTip: 'لصق صورة منسوخة من الحافظة أو من صفحة ويب' },
    en: { rxPasteImage: 'Paste Image', rxPasteImageTip: 'Paste an image copied from the clipboard or a web page' },
    fr: { rxPasteImage: 'Coller une image', rxPasteImageTip: 'Coller une image copiée depuis le presse-papiers ou une page web' }
};
/* Which sheet the content card belongs to. The Information Sheet and
   the Activity Sheet render through the same content component, so the
   scope has to come from the visible tab rather than be hard-coded. */
function _mbLinkScope() {
    var t = document.querySelector('.tab-content.active');
    return (t && /activity/.test(t.id)) ? 'activity' : 'info';
}

function _mbLinkLabel() {
    return (typeof _lmT === 'function') ? _lmT('btn') : 'Link / QR';
}

function _mbContentLabelT(key) {
    var lang = (window.i18n && window.i18n.getLang) ? window.i18n.getLang() : 'en';
    var table = _MB_PASTE_LABELS[lang] || _MB_PASTE_LABELS.en;
    return table[key] || _MB_PASTE_LABELS.en[key] || key;
}

/* NO data-i18n / data-i18n-title on the paste button, deliberately (see
   the markup below). Leaving them on would let applyTranslations()'s
   normal sweep re-overwrite this text from mb-translations.js on the
   very next language switch — undoing the fix the moment the failure
   mode it exists for (a stale dictionary) actually occurs. This
   listener repaints every paste button already on the page instead,
   from the same local table, every time the interface language
   changes. Scoped to `[data-act="pasteContentImage"]` so it repaints
   only the buttons THIS file renders; steps.js does the identical thing
   for its own. */
window.addEventListener('mb:langchange', function () {
    document.querySelectorAll('[data-act="pasteContentImage"]').forEach(function (btn) {
        var span = btn.querySelector('span');
        if (span) span.textContent = _mbContentLabelT('rxPasteImage');
        btn.title = _mbContentLabelT('rxPasteImageTip');
    });
});

/* 3.79.0: a content card can be inserted BELOW any card and the cards
   reordered — ▲ / ▼ on each card, or drag by the ⠿ handle — exactly as
   the activity steps (steps.js, 3.52.0). Same rule as the paste button
   above: this file owns the labels, matched to the interface language, so
   a stale dictionary cannot leave a raw key on the card. */
var _MB_CONTENT_ORDER_LABELS = {
    ar: { insertBelow: 'إضافة محتوى أسفله', insertBelowTip: 'إدراج بطاقة محتوى جديدة أسفل هذه البطاقة مباشرة',
          moveUp: 'نقل المحتوى إلى الأعلى', moveDown: 'نقل المحتوى إلى الأسفل',
          dragTip: 'اسحب لإعادة ترتيب المحتوى' },
    en: { insertBelow: 'Add content below', insertBelowTip: 'Insert a new content card directly below this one',
          moveUp: 'Move content up', moveDown: 'Move content down',
          dragTip: 'Drag to reorder the content' },
    fr: { insertBelow: 'Ajouter du contenu en dessous', insertBelowTip: 'Insérer une nouvelle carte de contenu juste en dessous de celle-ci',
          moveUp: 'Monter le contenu', moveDown: 'Descendre le contenu',
          dragTip: 'Glisser pour réordonner le contenu' }
};
function _mbContentOrderT(key) {
    var lang = (window.i18n && window.i18n.getLang) ? window.i18n.getLang() : 'en';
    var table = _MB_CONTENT_ORDER_LABELS[lang] || _MB_CONTENT_ORDER_LABELS.en;
    return table[key] || _MB_CONTENT_ORDER_LABELS.en[key] || key;
}

window.addEventListener('mb:langchange', function () {
    document.querySelectorAll('#content-sections-container [data-cs-tip]').forEach(function (el) {
        var key = el.getAttribute('data-cs-tip');
        el.title = _mbContentOrderT(key);
        el.setAttribute('aria-label', _mbContentOrderT(key));
    });
    document.querySelectorAll('#content-sections-container [data-cs-text]').forEach(function (el) {
        el.textContent = _mbContentOrderT(el.getAttribute('data-cs-text'));
    });
    if (typeof mbRenumberContent === 'function') mbRenumberContent();
});

function clearAllForms() {
    mbState.currentInfoSheetIndex = 0;
    mbState.currentActivitySheetIndex = 0;
    updateInfoSheetNav(null);
    updateActivitySheetNav(null);
    document.getElementById('info-sheet-number').value = '';
    document.getElementById('info-title').value = '';
    document.getElementById('info-objective').value = '';
    document.getElementById('info-link-subject').value = '';
    document.getElementById('info-link-url').value = '';
    document.getElementById('info-qr-preview').innerHTML = '';
    mbState.infoQRImage = null;
    mbState.infoExtraLinks = [];   // 3.70.0
    document.getElementById('self-check-number').value = '';
    document.getElementById('self-check-content').value = '';
    document.getElementById('answers-key-number').value = '';
    document.getElementById('answers-key-content').value = '';
    document.getElementById('content-sections-container').innerHTML = '';
    if (typeof mbAttReset === 'function') { mbAttReset('info'); mbImgCapsReset('info'); }   // 3.56.0
    mbState.contentSectionCount = 0;
    addContentSection();
    
    document.getElementById('sheet-number').value = '';
    document.getElementById('title').value = '';
    document.getElementById('objective').value = '';
    document.getElementById('duration').value = '0';
    if (typeof mbRenderSheetKindSelect === 'function') mbRenderSheetKindSelect(mbDefaultSheetKind());   // 3.42.0
    document.getElementById('activity-link-subject').value = '';
    document.getElementById('activity-link-url').value = '';
    document.getElementById('activity-qr-preview').innerHTML = '';
    mbState.activityQRImage = null;
    mbState.activityExtraLinks = [];   // 3.70.0
    document.getElementById('resources-container').innerHTML = '';
    document.getElementById('steps-container').innerHTML = '';
    if (typeof mbAttReset === 'function') { mbAttReset('activity'); mbImgCapsReset('activity'); }   // 3.56.0
    document.getElementById('criteria-tbody').innerHTML = '';
    /* include-criteria removed */
    mbState.resourceCount = 0;
    mbState.stepCount = 0;
    mbState.criteriaCount = 0;
    addResource(); addResource();
    addStep();
    toggleCriteriaSection();
}


function clearContentSection(id) {
    const ta = document.querySelector(`[data-content-id="${id}"]`);
    if (ta) ta.value = '';
    const gallery = document.getElementById(`content-image-gallery-${id}`);
    if (gallery) gallery.innerHTML = '';
    delete mbState.contentSectionImages[id];
    if (typeof mbImgCapsSet === 'function') mbImgCapsSet('info', id, null);   // 3.56.0
    const marks = document.getElementById(`content-marks-${id}`);
    if (marks) marks.innerHTML = '';
    const tables = document.getElementById(`content-tables-${id}`);
    if (tables) tables.innerHTML = '';
}

function clearStep(id) {
    const ta = document.querySelector(`[data-step-id="${id}"]`);
    if (ta) ta.value = '';
    const gallery = document.getElementById(`step-image-gallery-${id}`);
    if (gallery) gallery.innerHTML = '';
    delete mbState.stepImages[id];
    if (typeof mbImgCapsSet === 'function') mbImgCapsSet('activity', id, null);   // 3.56.0
    const marks = document.getElementById(`step-marks-${id}`);
    if (marks) marks.innerHTML = '';
}

function clearSelfCheckSection() {
    document.getElementById('self-check-number').value = '';
    document.getElementById('self-check-content').value = '';
}

function clearAnswersKeySection() {
    document.getElementById('answers-key-number').value = '';
    document.getElementById('answers-key-content').value = '';
}

// ── Content Table Widget ───────────────────────────────────────
let contentTableCount = 0;

/* ── Table caption strings ──────────────────────────────────
   Local, for the same reason the paste labels above are local: these
   three keys are not in the main dictionary, and a caption that came
   out untranslated would be visible on every exported table. */
var _MB_CT_LABELS = {
    en: { title: 'Table title (optional)', sub: 'Sub-title (optional)',
          add: 'Add a sub-title', del: 'Remove the sub-title' },
    fr: { title: 'Titre du tableau (facultatif)', sub: 'Sous-titre (facultatif)',
          add: 'Ajouter un sous-titre', del: 'Supprimer le sous-titre' },
    ar: { title: 'عنوان الجدول (اختياري)', sub: 'عنوان فرعي (اختياري)',
          add: 'إضافة عنوان فرعي', del: 'حذف العنوان الفرعي' }
};

function _mbCtT(key) {
    var lang = 'en';
    try {
        if (window.i18n && typeof window.i18n.getLang === 'function') {
            var l = window.i18n.getLang();
            if (_MB_CT_LABELS[l]) lang = l;
        }
    } catch (e) { /* dictionary not up */ }
    return (_MB_CT_LABELS[lang] || _MB_CT_LABELS.en)[key] || _MB_CT_LABELS.en[key] || key;
}

/* The caption fields' own geometry. Injected rather than added to
   mb-styles.css so the widget carries its own appearance, and so this
   feature cannot move anything else in the tool. */
function _mbCtEnsureStyle() {
    if (document.getElementById('ct-caption-style')) return;
    var s = document.createElement('style');
    s.id = 'ct-caption-style';
    s.textContent = [
        '.ct-captions{display:flex;flex-direction:column;gap:6px;padding:10px 12px 4px;}',
        '.ct-cap-row{display:flex;align-items:center;gap:8px;}',
        '.ct-cap{flex:1;min-width:0;padding:8px 11px;border:1px solid #e2e8f0;',
        'border-radius:9px;font:inherit;background:#fff;color:#1e293b;}',
        '.ct-cap:focus{outline:none;border-color:#6366f1;',
        'box-shadow:0 0 0 3px rgba(99,102,241,.16);}',
        /* The main title reads as a title in the field itself, so what
           the author types looks like what the export will print. */
        '.ct-cap-main{font-weight:600;}',
        '.ct-cap-sub{font-size:.93em;color:#475569;}',
        '.ct-cap-plus{flex:0 0 auto;width:34px;height:34px;display:inline-flex;',
        'align-items:center;justify-content:center;border:1px solid #e2e8f0;',
        'border-radius:9px;background:#fff;color:#4f46e5;font-size:1.05em;',
        'line-height:1;cursor:pointer;}',
        '.ct-cap-plus:hover{background:#eef2ff;border-color:#c7d2fe;}',
        '.ct-cap-plus.is-on{background:#eef2ff;border-color:#6366f1;}',
        '.ct-cap-sub[hidden]{display:none;}'
    ].join('');
    document.head.appendChild(s);
}

function addContentTable(contentId, initialData) {
    contentTableCount++;
    const tid = contentTableCount;
    const rows = (initialData && initialData.rows) || 2;
    const cols = (initialData && initialData.cols) || 2;
    const cells = (initialData && initialData.cells) || [];
    const container = document.getElementById(`content-tables-${contentId}`);
    if (!container) return;

    const title = (initialData && initialData.title) || '';
    const subtitle = (initialData && initialData.subtitle) || '';

    _mbCtEnsureStyle();

    const wrapper = document.createElement('div');
    wrapper.className = 'content-table-widget';
    wrapper.id = `ctw-${tid}`;
    wrapper.dataset.ctOwner = String(contentId);
    wrapper.innerHTML = `
        <div class="content-table-toolbar">
            <div class="ctb-left">
                <span>📋 Table:</span>
                <button class="ctb ctb-add" data-act="ctAddRow" data-args='[${tid}]' title="${window.i18n.t('dgAddRow')}" data-i18n-title="dgAddRow">➕ <span data-i18n="rxRow">${window.i18n.t('rxRow')}</span></button>
                <button class="ctb ctb-add" data-act="ctAddCol" data-args='[${tid}]' title="${window.i18n.t('dgAddColumn')}" data-i18n-title="dgAddColumn">➕ <span data-i18n="rxCol">${window.i18n.t('rxCol')}</span></button>
            </div>
            <div class="ctb-right">
                <button class="ctb ctb-del mb-has-ico" data-act="ctDelRow" data-args='[${tid}]' title="${window.i18n.t('dgDeleteLastRow')}" data-i18n-title="dgDeleteLastRow"><svg class="mb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 7h16"/><path d="M9.5 7V5.6A1.6 1.6 0 0 1 11.1 4h1.8a1.6 1.6 0 0 1 1.6 1.6V7"/><path d="M6.6 7l.75 11.6A1.7 1.7 0 0 0 9.05 20.2h5.9a1.7 1.7 0 0 0 1.7-1.6L17.4 7"/><path d="M10.3 11v5.4M13.7 11v5.4"/></svg><span data-i18n="rxRow">${window.i18n.t('rxRow')}</span></button>
                <button class="ctb ctb-del mb-has-ico" data-act="ctDelCol" data-args='[${tid}]' title="${window.i18n.t('dgDeleteLastColumn')}" data-i18n-title="dgDeleteLastColumn"><svg class="mb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 7h16"/><path d="M9.5 7V5.6A1.6 1.6 0 0 1 11.1 4h1.8a1.6 1.6 0 0 1 1.6 1.6V7"/><path d="M6.6 7l.75 11.6A1.7 1.7 0 0 0 9.05 20.2h5.9a1.7 1.7 0 0 0 1.7-1.6L17.4 7"/><path d="M10.3 11v5.4M13.7 11v5.4"/></svg><span data-i18n="rxCol">${window.i18n.t('rxCol')}</span></button>
                <button class="ctb ctb-close" data-act="ctRemove" data-args='[${tid}]' title="${window.i18n.t('dgRemoveTable')}" data-i18n-title="dgRemoveTable">✕ <span data-i18n="rxRemove">${window.i18n.t('rxRemove')}</span></button>
            </div>
        </div>
        <!-- Captions. Present from the moment the table is created — an
             optional field the author has to go and find is a field
             most authors never find. Empty is the normal state and
             costs nothing: neither caption is exported unless it has
             text, so a table with no title comes out exactly as tables
             always have.

             The sub-title starts hidden behind the + rather than being
             a second empty box: two blank fields above every table
             would read as work the author owes the tool. -->
        <div class="ct-captions">
            <div class="ct-cap-row">
                <input type="text" class="ct-cap ct-cap-main" id="ctt-${tid}"
                       placeholder="${_mbCtT('title')}" value="${_mbCtEsc(title)}">
                <button type="button" class="ct-cap-plus${subtitle ? ' is-on' : ''}"
                        data-act="ctToggleSubtitle" data-args='[${tid}]'
                        title="${_mbCtT('add')}" aria-label="${_mbCtT('add')}">+</button>
            </div>
            <input type="text" class="ct-cap ct-cap-sub" id="ctst-${tid}"
                   placeholder="${_mbCtT('sub')}" value="${_mbCtEsc(subtitle)}"${subtitle ? '' : ' hidden'}>
        </div>
        <div class="content-table-grid" id="ctg-${tid}"></div>
    `;
    container.appendChild(wrapper);
    ctRender(tid, rows, cols, cells);
}

function ctRender(tid, rows, cols, cells) {
    const grid = document.getElementById(`ctg-${tid}`);
    if (!grid) return;
    const table = document.createElement('table');
    for (let r = 0; r < rows; r++) {
        const tr = document.createElement('tr');
        for (let c = 0; c < cols; c++) {
            const td = document.createElement('td');
            const ta = document.createElement('textarea');
            ta.dataset.row = r;
            ta.dataset.col = c;
            ta.placeholder = `R${r+1}C${c+1}`;
            ta.dir = 'ltr';
            if (cells && cells[r] && cells[r][c] !== undefined) {
                ta.value = cells[r][c];
            }
            td.appendChild(ta);
            tr.appendChild(td);
        }
        table.appendChild(tr);
    }
    grid.innerHTML = '';
    grid.appendChild(table);
}

/* Attribute-safe. The captions go into an HTML string with `value="…"`,
   so a quotation mark in a title would end the attribute and the rest
   of the title would be parsed as markup. */
function _mbCtEsc(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
        .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** The + beside the title. Shows the sub-title and puts the caret in
    it; pressing it again on an EMPTY sub-title hides it, so the button
    that opened the field is also the way to change your mind. A
    sub-title with text is never hidden by a stray press — that would
    be silent data loss dressed as a toggle. */
function ctToggleSubtitle(tid) {
    const sub = document.getElementById(`ctst-${tid}`);
    if (!sub) return;
    const btn = document.querySelector(`[data-act="ctToggleSubtitle"][data-args='[${tid}]']`);
    if (sub.hidden) {
        sub.hidden = false;
        if (btn) { btn.classList.add('is-on'); btn.title = _mbCtT('del'); btn.setAttribute('aria-label', _mbCtT('del')); }
        sub.focus();
    } else if (!sub.value.trim()) {
        sub.hidden = true;
        if (btn) { btn.classList.remove('is-on'); btn.title = _mbCtT('add'); btn.setAttribute('aria-label', _mbCtT('add')); }
    } else {
        sub.focus();
    }
    if (typeof mbTouch === 'function') { try { mbTouch(); } catch (e) { /* autosave absent */ } }
}

/* Placeholders live in this file's own table, so applyTranslations()
   never sees them. Repainted here on a language change, the same
   arrangement the toolbar labels use — otherwise a table created in
   Arabic keeps prompting in Arabic after the user switches to French. */
if (typeof window !== 'undefined') {
    window.addEventListener('mb:langchange', function () {
        document.querySelectorAll('.ct-cap-main').forEach(function (el) {
            el.placeholder = _mbCtT('title');
        });
        document.querySelectorAll('.ct-cap-sub').forEach(function (el) {
            el.placeholder = _mbCtT('sub');
        });
        document.querySelectorAll('.ct-cap-plus').forEach(function (b) {
            var k = b.classList.contains('is-on') ? 'del' : 'add';
            b.title = _mbCtT(k);
            b.setAttribute('aria-label', _mbCtT(k));
        });
    });
}

function ctGetData(tid) {
    const grid = document.getElementById(`ctg-${tid}`);
    if (!grid) return null;
    const rows = Array.from(grid.querySelectorAll('tr'));
    const cells = rows.map(tr =>
        Array.from(tr.querySelectorAll('textarea')).map(ta => ta.value)
    );
    const titleEl = document.getElementById(`ctt-${tid}`);
    const subEl   = document.getElementById(`ctst-${tid}`);
    /* Trimmed here, once. Every exporter then only has to ask "is this
       empty" rather than each deciding for itself what whitespace
       means. */
    return {
        rows: rows.length,
        cols: rows[0] ? rows[0].querySelectorAll('textarea').length : 0,
        cells: cells,
        title: titleEl ? titleEl.value.trim() : '',
        subtitle: (subEl && !subEl.hidden) ? subEl.value.trim() : ''
    };
}

function ctAddRow(tid) {
    const d = ctGetData(tid);
    if (!d) return;
    ctRender(tid, d.rows + 1, d.cols, d.cells);
}

function ctAddCol(tid) {
    const d = ctGetData(tid);
    if (!d) return;
    ctRender(tid, d.rows, d.cols + 1, d.cells);
}

function ctDelRow(tid) {
    const d = ctGetData(tid);
    if (!d || d.rows <= 1) return;
    d.cells.pop();
    ctRender(tid, d.rows - 1, d.cols, d.cells);
}

function ctDelCol(tid) {
    const d = ctGetData(tid);
    if (!d || d.cols <= 1) return;
    d.cells.forEach(row => row.pop());
    ctRender(tid, d.rows, d.cols - 1, d.cells);
}

function ctRemove(tid) {
    const el = document.getElementById(`ctw-${tid}`);
    if (el) el.remove();
}

function collectContentTables(contentId) {
    const container = document.getElementById(`content-tables-${contentId}`);
    if (!container) return [];
    const tables = [];
    container.querySelectorAll('.content-table-widget').forEach(w => {
        const tid = w.id.replace('ctw-', '');
        const d = ctGetData(tid);
        if (d && d.rows > 0 && d.cols > 0) tables.push(d);
    });
    return tables;
}

function restoreContentTables(contentId, tablesData) {
    if (!tablesData || !tablesData.length) return;
    tablesData.forEach(t => addContentTable(contentId, t));
}

/* ── Content section headings ───────────────────────────────
   A content card is born as «Content 1:» — a NUMBER, produced by the
   dictionary through data-i18n-num, so an interface-language switch can
   repaint it without rebuilding the card and losing what is typed in it.

   The moment the author renames it to «Introduction» that text is THEIR
   content, not interface, and the same rule the cover table and the
   free-text blocks already follow applies: the i18n attributes come off,
   the name is stored as a bilingual pair beside the section's text, and a
   language switch must never overwrite it. It is exported as the
   section's heading, so a renamed card prints its name in the DOCX and an
   untouched one prints nothing — «Content 3:» is scaffolding for the
   editor, never something a ministry should read in a deliverable.

   The name lives in the DOM (data-heading on the card) for exactly as
   long as the older content fields do: sheets.js collects it at save time
   alongside the textarea and merges it into the stored pair. */

/* 3.72.0: the heading is typed straight into the card — no Rename
   dialog — and a card may also carry a subheading (➕ Subheading). Both
   live on the card as data-heading / data-subheading, which is what
   sheets.js collects and what attachments.js reads, exactly as before. */
if (window.i18n && window.i18n.extend) window.i18n.extend({
    en: { csHeadingPh: 'Main heading of this paragraph (optional)…', csSubPh: 'Subheading…',
          csAddSub: '➕ Subheading', csAddSubTip: 'Add a subheading under the main heading', csRemoveSubTip: 'Remove the subheading' },
    fr: { csHeadingPh: 'Titre principal de ce paragraphe (facultatif)…', csSubPh: 'Sous-titre…',
          csAddSub: '➕ Sous-titre', csAddSubTip: 'Ajouter un sous-titre sous le titre principal', csRemoveSubTip: 'Supprimer le sous-titre' },
    ar: { csHeadingPh: 'العنوان الرئيسي لهذه الفقرة (اختياري)…', csSubPh: 'العنوان الثانوي…',
          csAddSub: '➕ عنوان ثانوي', csAddSubTip: 'إضافة عنوان ثانوي تحت العنوان الرئيسي', csRemoveSubTip: 'حذف العنوان الثانوي' }
});

function mbContentHeading(id) {
    const sec = document.getElementById(`content-section-${id}`);
    return (sec && sec.dataset.heading) ? sec.dataset.heading : '';
}
function mbContentSubheading(id) {
    const sec = document.getElementById(`content-section-${id}`);
    return (sec && sec.dataset.subheading) ? sec.dataset.subheading : '';
}

/** Put a stored heading on a card (its box and data-heading). */
function mbApplyContentHeading(id, heading) {
    const sec = document.getElementById(`content-section-${id}`);
    if (!sec) return;
    const text = String(heading || '');
    if (text.trim()) sec.dataset.heading = text.trim(); else delete sec.dataset.heading;
    const box = sec.querySelector('[data-cs-heading]');
    if (box && box.value !== text) box.value = text;
}

/** Put a stored subheading on a card, showing its box when it has text. */
function mbApplyContentSubheading(id, sub) {
    const sec = document.getElementById(`content-section-${id}`);
    if (!sec) return;
    const text = String(sub || '');
    if (text.trim()) sec.dataset.subheading = text.trim(); else delete sec.dataset.subheading;
    const box = sec.querySelector('[data-cs-sub]');
    if (box && box.value !== text) box.value = text;
    if (text.trim()) _mbShowSubBox(sec, true);
}

function _mbShowSubBox(sec, on) {
    const row = sec.querySelector('.cs-sub-row');
    const btn = sec.querySelector('.btn-cs-sub');
    if (row) row.hidden = !on;
    if (btn) btn.classList.toggle('is-on', !!on);
}

/** Typed in a heading box → the card's data (bound on every keystroke). */
function mbContentHeadingInput(id, el) {
    const sec = document.getElementById(`content-section-${id}`);
    if (!sec || !el) return;
    const key = el.hasAttribute('data-cs-sub') ? 'subheading' : 'heading';
    if (el.value.trim()) sec.dataset[key] = el.value.trim(); else delete sec.dataset[key];
}

/** ➕ Subheading: shows the box (focused); pressed again with the box
 *  shown, removes the subheading. */
function mbToggleContentSubheading(id) {
    const sec = document.getElementById(`content-section-${id}`);
    if (!sec) return;
    const row = sec.querySelector('.cs-sub-row');
    if (row && row.hidden) {
        _mbShowSubBox(sec, true);
        const box = sec.querySelector('[data-cs-sub]');
        if (box) box.focus();
    } else {
        mbApplyContentSubheading(id, '');
        _mbShowSubBox(sec, false);
    }
}

/* Kept for anything still calling it (an older page, a shortcut): the
   heading is typed in the card now, so «rename» just puts the cursor
   there. */
function renameContentSection(id) {
    const box = document.querySelector(`#content-section-${id} [data-cs-heading]`);
    if (box) { box.focus(); if (box.select) box.select(); }
}

function addContentSection(heading, subheading) {
    mbState.contentSectionCount++;
    const csc = mbState.contentSectionCount;
    const container = document.getElementById('content-sections-container');
    const sectionDiv = document.createElement('div');
    sectionDiv.className = 'content-section-item';
    mbNewRowUid(sectionDiv);
    sectionDiv.id = `content-section-${csc}`;
    const ot = _mbContentOrderT;
    sectionDiv.innerHTML = `
        <div class="step-header cs-head">
            <span class="mb-step-handle" data-cs-tip="dragTip" title="${ot('dragTip')}" aria-label="${ot('dragTip')}" role="img">⠿</span>
            <span class="cs-num" id="content-label-${csc}" title="${window.i18n.tf('dgContentN', { v0: csc })}" aria-hidden="true">${csc}</span>
            <input type="text" class="cs-heading" dir="auto" data-cs-heading="${csc}" data-act="mbContentHeadingInput" data-on="input" data-args='[${csc}]'
                   placeholder="${window.i18n.t('csHeadingPh')}" data-i18n-placeholder="csHeadingPh" aria-label="${window.i18n.t('csHeadingPh')}">
            <div style="display:flex;gap:5px;align-items:center;flex:0 0 auto;">
                <button type="button" class="mb-step-move" data-act="moveContentUp" data-args='[${csc}]' data-cs-tip="moveUp" title="${ot('moveUp')}" aria-label="${ot('moveUp')}">▲</button>
                <button type="button" class="mb-step-move" data-act="moveContentDown" data-args='[${csc}]' data-cs-tip="moveDown" title="${ot('moveDown')}" aria-label="${ot('moveDown')}">▼</button>
                <button type="button" class="btn-rename-section btn-cs-sub" data-act="mbToggleContentSubheading" data-args='[${csc}]' title="${window.i18n.t('csAddSubTip')}" data-i18n-title="csAddSubTip"><span data-i18n="csAddSub">${window.i18n.t('csAddSub')}</span></button>
                <button class="btn-clear-section" data-act="clearContentSection" data-args='[${csc}]' title="${window.i18n.t('dgClearContent')}" data-i18n-title="dgClearContent">✕</button>
                <button class="btn-remove mb-icon-btn danger" data-act="removeContentSection" data-args='[${csc}]' title="${window.i18n.t('dgRemoveContent')}" data-i18n-title="dgRemoveContent"><svg class="mb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 7h16"/><path d="M9.5 7V5.6A1.6 1.6 0 0 1 11.1 4h1.8a1.6 1.6 0 0 1 1.6 1.6V7"/><path d="M6.6 7l.75 11.6A1.7 1.7 0 0 0 9.05 20.2h5.9a1.7 1.7 0 0 0 1.7-1.6L17.4 7"/><path d="M10.3 11v5.4M13.7 11v5.4"/></svg></button>
            </div>
        </div>
        <div class="cs-sub-row" hidden>
            <input type="text" class="cs-subheading" dir="auto" data-cs-sub="${csc}" data-act="mbContentHeadingInput" data-on="input" data-args='[${csc}]'
                   placeholder="${window.i18n.t('csSubPh')}" data-i18n-placeholder="csSubPh" aria-label="${window.i18n.t('csSubPh')}">
        </div>
        <textarea class="mb-content-field" placeholder="${window.i18n.t('dgEnterContent')}" data-i18n-placeholder="dgEnterContent" data-content-id="${csc}"  style="text-align: left;"></textarea>
        <div style="display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap;">
            <button class="btn-add-image" data-act="addContentImage" data-args='[${csc}]'>🖼️ <span data-i18n="rxAddImageS">${window.i18n.t('rxAddImageS')}</span></button>
            <button class="btn-add-image btn-paste-image" data-act="pasteContentImage" data-args='[${csc}]' title="${_mbContentLabelT('rxPasteImageTip')}">📋 <span>${_mbContentLabelT('rxPasteImage')}</span></button>
            ${typeof mbPasteTextBtnHtml === 'function' ? mbPasteTextBtnHtml('content', csc) : ''}
            <!-- Was data-act="addContentSection", which always appended at
                 the END of the sheet. It now inserts directly below its own
                 card; the buttons outside the list still append. -->
            <button class="mb-step-insert" data-act="insertContentAfter" data-args='[${csc}]' data-cs-tip="insertBelowTip" title="${ot('insertBelowTip')}" aria-label="${ot('insertBelowTip')}" style="background:#667eea;color:white;border:none;padding:6px 14px;border-radius:5px;font-size:0.85em;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:4px;white-space:nowrap;">➕ <span data-cs-text="insertBelow">${ot('insertBelow')}</span></button>
            ${addMarkBtnHtml(`content-marks-${csc}`)}
            <button class="btn-add-mark" data-act="addContentTable" data-args='[${csc}]' style="background:#0ea5e9;" title="${window.i18n.t('dgAddTable')}" data-i18n-title="dgAddTable">📋 <span data-i18n="dgAddTableBtn">${window.i18n.t('dgAddTableBtn')}</span></button>
            <!-- The QR/link fields used to be a card of their own on every
                 sheet. One button here replaces it; the fields live in a
                 modal. Scope is the SHEET, not this content block — the
                 link belongs to the sheet, and there is one per sheet. -->
            <button class="btn-add-mark btn-link-modal" data-act="mbOpenLinkModal" data-args='["${_mbLinkScope()}"]' style="background:#7c3aed;" title="${_mbLinkLabel()}">🔗 <span>${_mbLinkLabel()}</span></button>
        </div>
        <input type="file" id="content-image-input-${csc}" accept="image/*" multiple style="display:none;" data-act="handleContentImageUpload" data-on="change" data-args='[${csc}]'>
        <div id="content-image-gallery-${csc}" class="content-image-gallery"></div>
        <div id="content-tables-${csc}"></div>
        <div id="content-marks-${csc}" class="marks-container"></div>
    `;
    container.appendChild(sectionDiv);
    /* After the append: mbApplyContentHeading looks the card up by id, so
       it has to be in the document first.

       `typeof === 'string'` is not defensive noise. This function is also
       a data-act, and events.js appends the element and the event after
       whatever data-args declares — the ➕ button carries none, so a click
       calls addContentSection(buttonElement, event). Anything looser here
       would name every hand-added card "[object HTMLButtonElement]". */
    if (typeof heading === 'string' && heading.trim()) mbApplyContentHeading(csc, heading);
    if (typeof subheading === 'string' && subheading.trim()) mbApplyContentSubheading(csc, subheading);   // 3.72.0
    /* 3.48.0: pressed by the user (events.js passes the button), the new
       card is brought into view and its text box focused — it is added
       at the END of the sheet, often far below the button, and used to
       look as if nothing had happened. Loading a sheet passes a string
       or nothing, and does not scroll. */
    if (heading && typeof heading === 'object' && heading.nodeType === 1) _mbShowNewContent(sectionDiv);
}

function _mbShowNewContent(card) {
    if (!card) return;
    card.classList.add('mb-just-added');
    setTimeout(function () { card.classList.remove('mb-just-added'); }, 1700);
    try { card.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) { /* old browser */ }
    var ta = card.querySelector('textarea');
    if (ta) { try { ta.focus({ preventScroll: true }); } catch (e) { ta.focus(); } }
}

/** ➕ at the top of the content (3.48.0): same as the card buttons. */
function mbAddContentSectionTop(btn) {
    addContentSection(btn && btn.nodeType === 1 ? btn : document.body);
}

/* ── 3.79.0: insert below, ▲ / ▼, drag by the ⠿ handle ──────────
   Mirrors steps.js. A card's id never changes once given; the number the
   author SEES is its position, repainted by mbRenumberContent() whenever
   the list changes. The card carries its images (keyed by id), marks,
   tables and uid with it, and the save reads the cards in DOM order, so
   the new order is what is stored and exported. */

/** Inserts a new, empty card directly below card `id` and puts the cursor
 *  in it. Falls back to the end of the list when that card is gone. */
function insertContentAfter(id) {
    const container = document.getElementById('content-sections-container');
    if (!container) return;
    const ref = document.getElementById(`content-section-${id}`);
    addContentSection();                       // built and appended at the end, silently
    const card = container.lastElementChild;
    if (!card || card === ref) return;
    if (ref && ref.parentNode === container) container.insertBefore(card, ref.nextSibling);
    mbRenumberContent();
    /* Same direction as its neighbour: contentLang sets `dir` on the
       fields it knows about, and a card born between two of them should
       not read the other way round. */
    const ta = card.querySelector('textarea');
    const near = ref && ref.querySelector('textarea');
    if (ta && near && near.getAttribute('dir')) ta.setAttribute('dir', near.getAttribute('dir'));
    _mbShowNewContent(card);
}

function _mbMoveContent(id, dir) {
    const el = document.getElementById(`content-section-${id}`);
    if (!el || !el.parentNode) return;
    const box = el.parentNode;
    /* Store the sheet as it stands BEFORE the move, so every card is on
       record under its own uid; the save after the move then matches by
       uid, never by position (uid.js, biMergeArrayById). */
    if (typeof saveCurrentSheetToLO === 'function') {
        try { saveCurrentSheetToLO(); } catch (e) { /* ignore */ }
    }
    if (dir < 0) {
        const prev = el.previousElementSibling;
        if (!prev) return;
        box.insertBefore(el, prev);
    } else {
        const next = el.nextElementSibling;
        if (!next) return;
        box.insertBefore(el, next.nextSibling);
    }
    mbRenumberContent();
    const btn = el.querySelector(dir < 0 ? '[data-act="moveContentUp"]' : '[data-act="moveContentDown"]');
    if (btn && !btn.disabled) btn.focus();
    if (el.scrollIntoView) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
function moveContentUp(id)   { _mbMoveContent(id, -1); }
function moveContentDown(id) { _mbMoveContent(id, +1); }

/* The badge shows the card's POSITION, not its id: after a move, an
   insert or a delete the cards read 1, 2, 3 … again. The first card
   cannot go up and the last cannot go down. */
function mbRenumberContent() {
    const box = document.getElementById('content-sections-container');
    if (!box) return;
    const items = Array.prototype.filter.call(box.children, function (c) { return c.classList.contains('content-section-item'); });
    items.forEach(function (item, i) {
        const num = item.querySelector('.cs-head .cs-num');
        if (num) {
            num.textContent = String(i + 1);
            num.title = window.i18n.tf('dgContentN', { v0: i + 1 });
        }
        const up = item.querySelector('[data-act="moveContentUp"]');
        const down = item.querySelector('[data-act="moveContentDown"]');
        if (up) up.disabled = (i === 0);
        if (down) down.disabled = (i === items.length - 1);
    });
}

/* Deletes, loads and resets empty and refill the container from several
   files; an observer keeps the numbers right without each of them having
   to know this function exists (same reasoning as watchEmptyContainers
   below and steps.js's watchStepOrder). */
(function watchContentOrder() {
    function start() {
        const box = document.getElementById('content-sections-container');
        if (!box || !window.MutationObserver) return;
        new MutationObserver(mbRenumberContent).observe(box, { childList: true });
        mbRenumberContent();
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();

/* Drag to reorder, by the ⠿ handle only — see steps.js mbStepDrag for the
   reasoning. The card moves live under the pointer; the drop is one undo
   step and one autosave. Touch screens, where HTML drag-and-drop is
   unreliable, have the ▲ / ▼ buttons. */
(function mbContentDrag() {
    var SEL = '#content-sections-container > .content-section-item';
    var dragEl = null, hist = null;

    function release() {
        document.querySelectorAll(SEL + '[draggable="true"]').forEach(function (el) {
            if (el !== dragEl) el.removeAttribute('draggable');
        });
    }
    document.addEventListener('pointerdown', function (e) {
        var h = e.target && e.target.closest && e.target.closest('#content-sections-container .mb-step-handle');
        if (!h) return;
        var item = h.closest('.content-section-item');
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
        hist = (typeof mbHistBegin === 'function') ? mbHistBegin('moveContent') : null;
    });

    document.addEventListener('dragover', function (e) {
        if (!dragEl) return;
        var box = document.getElementById('content-sections-container');
        var target = e.target && e.target.closest && e.target.closest(SEL);
        if (!box || !box.contains(e.target)) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        if (!target || target === dragEl) return;
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
        mbRenumberContent();
        if (hist && typeof mbHistEnd === 'function') mbHistEnd(hist);
        hist = null;
        /* Autosave listens for input/change on the main container; a drag
           produces neither. */
        (el.parentNode || document).dispatchEvent(new Event('change', { bubbles: true }));
    });
})();

async function removeContentSection(id) {
    if (await mbConfirm(window.i18n.t('dgConfirmDeletionthisWillPermanently'), { danger: true })) {
        const element = document.getElementById(`content-section-${id}`);
        if (element) {
            element.remove();
            delete mbState.contentSectionImages[id];
            if (typeof mbImgCapsSet === 'function') mbImgCapsSet('info', id, null);   // 3.56.0
        }
    }
}

function addContentImage(contentId) {
    document.getElementById(`content-image-input-${contentId}`).click();
}

function handleContentImageUpload(contentId) {
    const input = document.getElementById(`content-image-input-${contentId}`);
    if (!input.files || !input.files.length) return;

    if (!mbState.contentSectionImages[contentId]) mbState.contentSectionImages[contentId] = [];

    /* Sequential, and downscaled on the way in — see image_prep.js.
       forEach with a FileReader each also meant the images could land in
       any order, since whichever decoded first pushed first; a chain
       keeps the order the user picked them in. */
    const files = Array.from(input.files);
    input.value = ''; // reset so same file can be re-added

    if (typeof mbPrepareImages === 'function') {
        mbPrepareImages(files, 'content').then(results => {
            results.forEach(r => mbState.contentSectionImages[contentId].push(r.dataUrl));
            renderContentImageGallery(contentId);
        });
        return;
    }
    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = function(e) {
            mbState.contentSectionImages[contentId].push(e.target.result);
            renderContentImageGallery(contentId);
        };
        reader.readAsDataURL(file);
    });
}

function removeContentImage(contentId, imgIndex) {
    if (!mbState.contentSectionImages[contentId]) return;
    mbState.contentSectionImages[contentId].splice(imgIndex, 1);
    if (typeof mbImgCapsSplice === 'function') mbImgCapsSplice('info', contentId, imgIndex);
    renderContentImageGallery(contentId);
}

function renderContentImageGallery(contentId) {
    const gallery = document.getElementById(`content-image-gallery-${contentId}`);
    if (!gallery) return;
    const images = mbState.contentSectionImages[contentId] || [];
    if (images.length === 0) { gallery.innerHTML = ''; return; }
    /* 3.56.0: each picture has an optional caption under it
       (attachments.js), printed — and numbered when numbering is on. */
    gallery.innerHTML = images.map((src, i) => `
        <div class="mb-img-cell">
        <div class="content-img-thumb">
            <img src="${src}" alt="Image ${i+1}">
            <button class="content-img-delete" data-act="removeContentImage" data-args='[${contentId},${i}]' title="${window.i18n.t('dgRemoveImage')}" data-i18n-title="dgRemoveImage">×</button>
        </div>
        ${(typeof mbImgCapsHtml === 'function') ? mbImgCapsHtml('info', contentId, i) : ''}
        </div>
    `).join('');
}

function addInfoQRImage() {
    document.getElementById('info-qr-input').click();
}

/* QR codes take the 'qr' profile: capped in size but kept as PNG and
   never JPEG-compressed. They are read by a phone camera at 2.5 cm, and
   JPEG ringing around the finder patterns is a scan that fails, not a
   picture that looks slightly worse. */
function _mbSetQRImage(which, file) {
    if (!file) return;
    const preview = document.getElementById(`${which}-qr-preview`);

    const apply = function (dataUrl) {
        if (preview) preview.innerHTML = `<img src="${dataUrl}" alt="QR Code" style="width: 100px; height: 100px;">`;
        if (which === 'info') mbState.infoQRImage = dataUrl;
        else                  mbState.activityQRImage = dataUrl;
    };

    if (typeof mbPrepareImage === 'function') {
        mbPrepareImage(file, 'qr').then(out => apply(out.dataUrl));
        return;
    }
    const reader = new FileReader();
    reader.onload = function(e) { apply(e.target.result); };
    reader.readAsDataURL(file);
}

function handleInfoQRUpload() {
    const input = document.getElementById('info-qr-input');
    if (input.files && input.files[0]) _mbSetQRImage('info', input.files[0]);
}

function addActivityQRImage() {
    document.getElementById('activity-qr-input').click();
}

function handleActivityQRUpload() {
    const input = document.getElementById('activity-qr-input');
    if (input.files && input.files[0]) _mbSetQRImage('activity', input.files[0]);
}

async function clearInfoSheet() {
    if (await mbConfirm(window.i18n.t('dgConfirmDeletionthisWillPermanently2'), { danger: true })) {
        document.getElementById('info-sheet-number').value = '';
        document.getElementById('info-title').value = '';
        document.getElementById('info-objective').value = '';
        document.getElementById('content-sections-container').innerHTML = '';
        if (typeof mbAttReset === 'function') { mbAttReset('info'); mbImgCapsReset('info'); }   // 3.56.0
        document.getElementById('info-link-subject').value = '';
        document.getElementById('info-link-url').value = '';
        document.getElementById('info-qr-preview').innerHTML = '';
        mbState.infoQRImage = null;
        mbState.infoExtraLinks = [];   // 3.70.0
        document.getElementById('self-check-number').value = '';
        document.getElementById('self-check-content').value = '';
        document.getElementById('answers-key-number').value = '';
        document.getElementById('answers-key-content').value = '';
        mbState.contentSectionCount = 0;
        // Clear stored images
        for (let key in mbState.contentSectionImages) {
            delete mbState.contentSectionImages[key];
        }
        addContentSection(); // Add first content section
        showStatus(window.i18n.t('dgInformationSheetCleared'), 'success');
    }
}

function addInfoImage() {
    document.getElementById('info-image-input').click();
}

function handleInfoImageUpload() {
    const input = document.getElementById('info-image-input');
    const preview = document.getElementById('info-image-preview');
    if (!input.files || !input.files[0]) return;

    const apply = function (dataUrl) {
        if (preview) preview.innerHTML = `<img src="${dataUrl}" alt="Info image">`;
    };

    if (typeof mbPrepareImageAndReport === 'function') {
        mbPrepareImageAndReport(input.files[0], 'content').then(out => apply(out.dataUrl));
        return;
    }
    const reader = new FileReader();
    reader.onload = function(e) { apply(e.target.result); };
    reader.readAsDataURL(input.files[0]);
}

/* ── Empty containers are not dead ends ──────────────────────
   The «Add Content» and «Add Step» buttons used to live INSIDE each
   card. Delete the last card — or run Clear All, which empties the
   container without re-seeding it — and the button went with it: the
   section was left blank with no control anywhere on the page that could
   bring a card back. The only way out was reloading the project.

   index.html now carries an add button BELOW each container, outside the
   cards, the way the resources table and the criteria table already did.
   The in-card buttons stay: they are the convenient ones while you are
   working down a long sheet. This file's job is only the hint that
   appears when a container is empty, so a blank area reads as "add one"
   rather than as something broken.

   A MutationObserver rather than a call at each site: the two containers
   are emptied from six places across three files (the two loaders, the
   two clear-sheet handlers, removeInfoSheet and clearAll), and a
   seventh will be added the day someone writes another reset. An
   observer cannot be forgotten by code that does not know it exists. */

var MB_EMPTY_HINTS = [
    { container: 'content-sections-container', hint: 'content-sections-empty', counter: 'contentSectionCount' },
    { container: 'steps-container',            hint: 'steps-empty',            counter: 'stepCount' }
];

function mbUpdateEmptyHints() {
    MB_EMPTY_HINTS.forEach(function (cfg) {
        var box  = document.getElementById(cfg.container);
        var hint = document.getElementById(cfg.hint);
        if (!box || !hint) return;

        var empty = box.children.length === 0;
        hint.style.display = empty ? '' : 'none';

        /* Numbering restarts at 1 for a container the user has emptied.
           The counter only ever went up, so clearing three cards and
           adding one produced «Content 4:» with nothing above it.

           Read from the LIVE DOM, which is the whole reason this is safe
           to do here: loadInfoSheetAtIndex empties the container and
           refills it synchronously, and by the time this callback runs
           the cards are already back — so `empty` is false and the
           counter it just set is left alone. Resetting eagerly at the
           moment of removal would instead hand the next card an id that
           collides with one already on screen. */
        if (empty && mbState[cfg.counter]) mbState[cfg.counter] = 0;
    });
}

(function watchEmptyContainers() {
    function start() {
        mbUpdateEmptyHints();
        if (!window.MutationObserver) return;
        var obs = new MutationObserver(mbUpdateEmptyHints);
        MB_EMPTY_HINTS.forEach(function (cfg) {
            var box = document.getElementById(cfg.container);
            if (box) obs.observe(box, { childList: true });
        });
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
