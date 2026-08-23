// ============================================================
// /src/blocks.js
// Free-text sections — one component, two hosts.
//
// WHY ONE FILE FOR TWO FEATURES
// The introduction tab needed a user-added box that starts its own page
// («Module Contents»), and the learning-outcome card needed user-added
// boxes for whatever that curriculum calls its parts — LO contents,
// assessment criteria, assessment methods, training conditions. Those
// are the same object: a TITLE the user writes and a BODY the user
// writes, both optional, both bilingual. Building them twice would mean
// two renderers, two collectors and two chances to get the { en, ar }
// merge wrong. They differ in exactly two ways — where the array lives,
// and whether the export breaks a page before it — so those are the two
// things the host config holds and nothing else.
//
// EMPTY MEANS ABSENT, NOT DELETED
// A section with no body text is not exported. That is the whole point
// of the feature: an author can leave a heading in place as a reminder
// of what still has to be written without it appearing in a deliverable
// they hand to a ministry the same afternoon. The interface marks such a
// section with a dashed border and says nothing else about it — it is a
// draft, not an error.
//
// TITLES ARE DATA, NOT INTERFACE
// The seeded title «Module Contents» is written into BOTH sides of the
// pair at creation, the way mbSeedCoverLabels() seeds the cover rows,
// rather than being carried as an i18n key. Two reasons, both learned
// from the cover table: once the user renames it the name is theirs and
// an interface-language switch must never overwrite it; and a title
// seeded on the editing side only would fall back — through biGet — into
// the other language's export, putting an Arabic heading in an English
// module.
//
// STATE IS WRITTEN ON EVERY KEYSTROKE
// Not collected from the DOM at save time, which is how the older fields
// work. A collector has to run before the content language switches, and
// setContentLang() flushes exactly one thing (saveCurrentSheetToLO). A
// field that binds live cannot lose a side to a mistimed switch, and the
// merge-by-position hazard that uid.js exists to solve never arises.
// mbSyncBlocksFromDOM() remains as a belt-and-braces flush before export.
// ============================================================

/* ── Hosts ───────────────────────────────────────────────────
   `pageBreak` is about the DOCX, not the screen: intro sections are
   standalone pages, LO sections are paragraphs inside the outcome. */
var MB_BLOCK_HOSTS = {
    intro: {
        section:   'intro-blocks-section',
        container: 'intro-blocks-container',
        remove:    'removeIntroBlock',
        titleList: null,
        seedKey:   'mbModuleContents',   // first block only
        pageBreak: true
    },
    lo: {
        section:   'lo-blocks-section',
        container: 'lo-blocks-container',
        remove:    'removeLoBlock',
        titleList: 'lo-block-titles',
        seedKey:   null,
        pageBreak: false
    }
};

/* Bilingual keys on a block. Named here so a future collector can be
   handed the same list biMergeArrayById expects. */
var MB_BLOCK_FIELDS = ['title', 'body'];

/* ── State access ────────────────────────────────────────────
   Returns null — not [] — when there is no host to write to. An LO
   section with no outcome selected has nowhere to put a block, and an
   empty array would let the caller add one to nothing. */
function mbCurrentLOObject() {
    if (!mbState.currentLOId) return null;
    return mbState.learningOutcomesData.find(function (l) {
        return l.id === mbState.currentLOId;
    }) || null;
}

function mbBlockList(host) {
    if (host === 'intro') {
        if (!Array.isArray(mbState.introBlocks)) mbState.introBlocks = [];
        return mbState.introBlocks;
    }
    var lo = mbCurrentLOObject();
    if (!lo) return null;
    if (!Array.isArray(lo.blocks)) lo.blocks = [];
    return lo.blocks;
}

/**
 * Repair a list loaded from a file.
 *
 * Idempotent, like biMigrateProject and mbAssignProjectUids: a project
 * saved by this build passes through unchanged. Files written before
 * this feature simply have no `blocks` key and get an empty array.
 */
function mbNormalizeBlocks(list) {
    if (!Array.isArray(list)) return [];
    return list.map(function (b) {
        var out = (b && typeof b === 'object') ? b : {};
        out.title = biUpgrade(out.title);
        out.body  = biUpgrade(out.body);
        if (!out.uid) out.uid = mbUid();
        return out;
    });
}

/* ── Export-side helpers ─────────────────────────────────────
   Called from exportToDocx, where mbState has already been flattened by
   biFlattenDeep, so `body` is a plain string there. They also survive
   being handed unflattened data — biGet on a pair, a string left alone —
   because the validation pass runs early and the cost of being wrong
   here is a missing page in someone's module. */
function mbBlockText(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string') return v;
    return (typeof biGet === 'function') ? biGet(v, exportLang()) : '';
}

/** The sections that will actually be exported: body non-empty. */
function mbBlocksFilled(list) {
    return (Array.isArray(list) ? list : []).filter(function (b) {
        return b && mbBlockText(b.body).trim();
    });
}

function mbBlocksAnyFilled(list) {
    return mbBlocksFilled(list).length > 0;
}

/* ── Rendering ───────────────────────────────────────────────
   innerHTML rather than createElement: these rows carry no listeners of
   their own — every control is a data-act that events.js already
   delegates from the document — so there is nothing to lose on a
   rebuild, and a rebuild is what a content-language switch needs. */

function _mbBlockEscape(s) {
    return String(s === null || s === undefined ? '' : s)
        .replace(/[&<>"]/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
        });
}

function _mbBlockRowHtml(host, block, lang) {
    var cfg   = MB_BLOCK_HOSTS[host];
    var title = biGetStrict(block.title, lang);
    var body  = biGetStrict(block.body,  lang);
    var args  = _mbBlockEscape(JSON.stringify([host, block.uid]));
    var list  = cfg.titleList ? ' list="' + cfg.titleList + '"' : '';

    return '' +
    '<div class="mb-block' + (body.trim() ? '' : ' is-empty') + '" data-uid="' + _mbBlockEscape(block.uid) + '">' +
      '<div class="mb-block-head">' +
        '<input class="mb-block-title" type="text" dir="auto"' + list +
               ' value="' + _mbBlockEscape(title) + '"' +
               ' data-act="mbBlockEdit" data-on="input"' +
               ' data-args=\'' + _mbBlockEscape(JSON.stringify([host, block.uid, 'title'])) + '\'' +
               ' data-i18n="mbSectionTitlePlaceholder" data-i18n-attr="placeholder"' +
               ' placeholder="' + _mbBlockEscape(window.i18n.t('mbSectionTitlePlaceholder')) + '"/>' +
        '<button type="button" class="btn-remove mb-block-remove mb-icon-btn danger"' +
               ' data-act="' + cfg.remove + '" data-args=\'' + args + '\'' +
               ' data-i18n="mbRemoveSection" data-i18n-attr="title"' +
               ' title="' + _mbBlockEscape(window.i18n.t('mbRemoveSection')) + '">' +
               '<svg class="mb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 7h16"/><path d="M9.5 7V5.6A1.6 1.6 0 0 1 11.1 4h1.8a1.6 1.6 0 0 1 1.6 1.6V7"/><path d="M6.6 7l.75 11.6A1.7 1.7 0 0 0 9.05 20.2h5.9a1.7 1.7 0 0 0 1.7-1.6L17.4 7"/><path d="M10.3 11v5.4M13.7 11v5.4"/></svg></button>' +
      '</div>' +
      '<textarea class="mb-block-body" rows="6" dir="auto"' +
               ' data-act="mbBlockEdit" data-on="input"' +
               ' data-args=\'' + _mbBlockEscape(JSON.stringify([host, block.uid, 'body'])) + '\'' +
               ' data-i18n="mbSectionBodyPlaceholder" data-i18n-attr="placeholder"' +
               ' placeholder="' + _mbBlockEscape(window.i18n.t('mbSectionBodyPlaceholder')) + '"' +
               '>' + _mbBlockEscape(body) + '</textarea>' +
    '</div>';
}

function mbRenderBlocks(host) {
    var cfg = MB_BLOCK_HOSTS[host];
    if (!cfg) return;

    var box     = document.getElementById(cfg.container);
    var section = document.getElementById(cfg.section);
    if (!box) return;

    var list = mbBlockList(host);

    /* No outcome selected: the LO card hides its whole section rather
       than showing an Add button that would have nowhere to add to. */
    if (list === null) {
        box.innerHTML = '';
        if (section) section.style.display = 'none';
        return;
    }
    if (section) section.style.display = '';

    var lang = contentLang();
    box.innerHTML = list.map(function (b) {
        return _mbBlockRowHtml(host, b, lang);
    }).join('');
}

function mbRenderAllBlocks() {
    mbRenderBlocks('intro');
    mbRenderBlocks('lo');
}

/* ── Editing ─────────────────────────────────────────────────
   One handler for four fields. events.js appends the element and the
   event after whatever data-args declares, so the signature ends with
   (el, ev) exactly as the dispatcher supplies them. */

var _mbBlockSaveTimer = null;

function mbBlockEdit(host, uid, field, el) {
    var list = mbBlockList(host);
    if (!list || !el) return;

    var block = null;
    for (var i = 0; i < list.length; i++) {
        if (list[i].uid === uid) { block = list[i]; break; }
    }
    if (!block) return;

    biPut(block, field, el.value);

    if (field === 'body') {
        var row = el.closest ? el.closest('.mb-block') : null;
        if (row) row.classList.toggle('is-empty', !el.value.trim());
    }

    /* LO blocks live inside the outcome objects, which are copied into
       modulesData by saveCurrentModuleLOData(). Debounced: this runs on
       every keystroke and that function walks the module. */
    if (host === 'lo') {
        clearTimeout(_mbBlockSaveTimer);
        _mbBlockSaveTimer = setTimeout(function () {
            if (typeof saveCurrentModuleLOData === 'function') saveCurrentModuleLOData();
        }, 400);
    }
}

/**
 * Belt-and-braces flush.
 *
 * The fields bind live, so in normal operation this finds nothing to do.
 * It exists for the one case live binding cannot cover: a value pasted
 * or set by another script without an input event. Called from
 * syncProjectTextFromDOM(), which every save and every export already
 * runs first.
 */
function mbSyncBlocksFromDOM() {
    Object.keys(MB_BLOCK_HOSTS).forEach(function (host) {
        var box  = document.getElementById(MB_BLOCK_HOSTS[host].container);
        var list = mbBlockList(host);
        if (!box || !list) return;

        var lang = contentLang();
        box.querySelectorAll('.mb-block').forEach(function (row) {
            var uid = row.dataset ? row.dataset.uid : null;
            var block = null;
            for (var i = 0; i < list.length; i++) {
                if (list[i].uid === uid) { block = list[i]; break; }
            }
            if (!block) return;

            var t = row.querySelector('.mb-block-title');
            var b = row.querySelector('.mb-block-body');
            if (t && t.value !== biGetStrict(block.title, lang)) biPut(block, 'title', t.value);
            if (b && b.value !== biGetStrict(block.body,  lang)) biPut(block, 'body',  b.value);
        });
    });
}

/* ── Actions ─────────────────────────────────────────────────
   Declared as globals on purpose: events.js resolves an unknown data-act
   through window[name], which is how every other action in this build is
   reached. Nothing to register. */

function _mbAddBlock(host) {
    var cfg  = MB_BLOCK_HOSTS[host];
    var list = mbBlockList(host);
    if (!list) return null;

    var block = { uid: mbUid(), title: biNew(), body: biNew() };

    /* Seeded in both languages, once, at creation — see the header note
       on titles being data. Only the FIRST intro section is seeded: the
       second one is whatever the author needs next, and guessing would
       just be a label they have to clear. */
    if (cfg.seedKey && list.length === 0) {
        block.title = biNew(window.i18n.tIn(cfg.seedKey, 'en'),
                            window.i18n.tIn(cfg.seedKey, 'ar'));
    }

    list.push(block);
    mbRenderBlocks(host);

    /* Put the caret where the author is going to type. A new empty box
       that does not take focus reads as a button that did nothing. */
    var box = document.getElementById(cfg.container);
    var rows = box ? box.querySelectorAll('.mb-block') : [];
    var last = rows[rows.length - 1];
    if (last) {
        var field = last.querySelector(block.title && biGetStrict(block.title, contentLang()).trim()
            ? '.mb-block-body' : '.mb-block-title');
        if (field) field.focus();
    }
    return block;
}

async function addIntroBlock() {
    _mbAddBlock('intro');
    showStatus(window.i18n.t('dgSectionAdded'), 'success');
}

async function addLoBlock() {
    if (!mbState.currentLOId) {
        await mbAlert(window.i18n.t('dgPleaseSelectALearningOutcome'));
        return;
    }
    _mbAddBlock('lo');
    if (typeof saveCurrentModuleLOData === 'function') saveCurrentModuleLOData();
    showStatus(window.i18n.t('dgSectionAdded'), 'success');
}

async function _mbRemoveBlock(host, uid) {
    var list = mbBlockList(host);
    if (!list) return;

    var idx = -1;
    for (var i = 0; i < list.length; i++) {
        if (list[i].uid === uid) { idx = i; break; }
    }
    if (idx === -1) return;

    /* Confirm only when there is something to lose. An empty box the
       author just added and thought better of should close on one
       click — a dialog there is friction, not safety. */
    var hasText = !biEmpty(list[idx].title) || !biEmpty(list[idx].body);
    if (hasText && !await mbConfirm(window.i18n.t('dgConfirmDeleteSection'), { danger: true })) return;

    list.splice(idx, 1);
    mbRenderBlocks(host);
    if (host === 'lo' && typeof saveCurrentModuleLOData === 'function') saveCurrentModuleLOData();
    showStatus(window.i18n.t('dgSectionDeleted'), 'success');
}

function removeIntroBlock(host, uid) { return _mbRemoveBlock('intro', uid); }
function removeLoBlock(host, uid)    { return _mbRemoveBlock('lo',    uid); }

/* ── Wiring ──────────────────────────────────────────────────
   Re-render on a content-language switch, which is a view change: the
   state already holds both sides, the boxes just have to be re-bound to
   the other one. */
window.addEventListener('mb:contentlangchange', function () {
    mbRenderAllBlocks();
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mbRenderAllBlocks);
} else {
    mbRenderAllBlocks();
}
