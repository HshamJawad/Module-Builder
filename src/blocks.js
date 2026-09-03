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
// TABLES ARE NOT BILINGUAL, AND ARE NOT WRITTEN ON EVERY KEYSTROKE
// A block can now carry tables, the same widget the information sheet
// uses — training conditions are often a table, not a paragraph. They
// are stored on the block as a plain array, NOT as a { en, fr, ar }
// pair: a table's cells are the same numbers and part names whichever
// language the module is written in, and the content sections' tables
// have never been bilingual either.
//
// They also cannot bind live the way the title and body do, because the
// widget's cells are built and rebuilt by content.js and carry no
// data-act of their own. So they are COLLECTED — before any rebuild of
// the rows, and again in mbSyncBlocksFromDOM() before every save and
// every export. The rule that follows from that: mbRenderBlocks() must
// collect before it wipes, or a content-language switch would throw
// away every table on screen.
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
        /* Not biUpgrade: tables are not a bilingual pair. A file written
           before this feature has no key at all, which is why the array
           is created here rather than assumed anywhere downstream. */
        if (!Array.isArray(out.tables)) out.tables = [];
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

/** The sections that will actually be exported.
    Body non-empty OR at least one table — «training conditions» is
    often a table and no prose at all, and dropping such a section for
    having an empty body would delete the only thing in it. The rule the
    header states is unchanged for prose: an empty body still keeps the
    section out of the file. */
function mbBlocksFilled(list) {
    return (Array.isArray(list) ? list : []).filter(function (b) {
        if (!b) return false;
        if (mbBlockText(b.body).trim()) return true;
        return Array.isArray(b.tables) && b.tables.length > 0;
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
        /* The same widget the information sheet uses, reached the same
           way: addContentTable renders into #content-tables-<id>, so the
           id given here is all that connects them. No second table
           implementation, and no copy of ctAddRow to keep in step. */
        '<button type="button" class="mb-block-table mb-icon-btn"' +
               ' data-act="addContentTable" data-args=\'' + _mbBlockEscape(JSON.stringify(['block-' + block.uid])) + '\'' +
               ' data-i18n="dgAddTable" data-i18n-attr="title"' +
               ' title="' + _mbBlockEscape(window.i18n.t('dgAddTable')) + '">\uD83D\uDCCB</button>' +
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
      '<div class="mb-block-tables" id="content-tables-block-' + _mbBlockEscape(block.uid) + '"></div>' +
    '</div>';
}

/** Read every table widget in a host's rows back onto its block.
    Called before any rebuild and from mbSyncBlocksFromDOM. Silent when
    content.js is absent — blocks must keep working without it. */
function mbCollectBlockTables(host) {
    if (typeof collectContentTables !== 'function') return;
    var cfg = MB_BLOCK_HOSTS[host];
    var box = cfg && document.getElementById(cfg.container);
    var list = mbBlockList(host);
    if (!box || !list) return;

    box.querySelectorAll('.mb-block').forEach(function (row) {
        var uid = row.dataset ? row.dataset.uid : null;
        if (!uid) return;
        /* Only rows that actually carry the widget host are read. A row
           rendered by an older build has no such div, and reading it
           would replace a saved array with an empty one. */
        if (!row.querySelector('#content-tables-block-' + uid)) return;
        for (var i = 0; i < list.length; i++) {
            if (list[i].uid === uid) {
                list[i].tables = collectContentTables('block-' + uid);
                break;
            }
        }
    });
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

    /* Collect BEFORE the wipe. innerHTML below destroys every widget on
       screen, and a content-language switch calls this function — so
       without this line, changing the editing language would silently
       delete every table the author had just built. */
    mbCollectBlockTables(host);

    var lang = contentLang();
    box.innerHTML = list.map(function (b) {
        return _mbBlockRowHtml(host, b, lang);
    }).join('');

    /* Rebuild the widgets from the blocks. restoreContentTables appends,
       so it must run against the freshly emptied hosts above and never
       twice for one render. */
    if (typeof restoreContentTables === 'function') {
        list.forEach(function (b) {
            if (Array.isArray(b.tables) && b.tables.length) {
                restoreContentTables('block-' + b.uid, b.tables);
            }
        });
    }
}

function mbRenderAllBlocks() {
    mbRenderBlocks('intro');
    mbRenderBlocks('lo');
}

/* ── Live capture for the table widget ───────────────────────
   The title and body write themselves into state on every keystroke.
   The table cells cannot: they are built by content.js and carry no
   data-act, so nothing tells this file that anything changed.

   Collecting only at save time is not enough, and the case that proves
   it is ordinary use: build a table under an outcome, then select a
   DIFFERENT outcome. mbRenderBlocks() collects first, but by then
   mbBlockList('lo') already answers with the new outcome's blocks —
   whose uids do not match the rows on screen, so nothing matches,
   nothing is written, and the table is gone with no error and no
   warning.

   So the widget is watched where it lives. One delegated listener,
   debounced for typing and immediate for the buttons that add or delete
   rows, columns and whole tables. */
var _mbBlockTableTimer = null;

function _mbBlockHostOf(el) {
    var box = el.closest ? el.closest('#intro-blocks-container, #lo-blocks-container') : null;
    if (!box) return null;
    return (box.id === MB_BLOCK_HOSTS.intro.container) ? 'intro' : 'lo';
}

function _mbBlockTablesTouched(el, immediate) {
    var host = _mbBlockHostOf(el);
    if (!host) return;
    var run = function () {
        mbCollectBlockTables(host);
        if (host === 'lo' && typeof saveCurrentModuleLOData === 'function') {
            saveCurrentModuleLOData();
        }
        if (typeof mbTouch === 'function') { try { mbTouch(); } catch (e) { /* autosave absent */ } }
    };
    /* A click is collected on the NEXT task, not on this one. Both this
       listener and the dispatcher in events.js are on the document, and
       index.html loads blocks.js before events.js — so this handler
       runs FIRST and would read the grid as it was before ctAddRow or
       ctRemove touched it. A zero timeout puts the read after every
       handler for this click has finished, whatever their order. */
    if (immediate) { clearTimeout(_mbBlockTableTimer); setTimeout(run, 0); return; }
    clearTimeout(_mbBlockTableTimer);
    _mbBlockTableTimer = setTimeout(run, 400);
}

if (typeof document !== 'undefined') {
    document.addEventListener('input', function (e) {
        if (!e.target.closest) return;
        if (!e.target.closest('.mb-block-tables')) return;
        _mbBlockTablesTouched(e.target, false);
    });
    /* addContentTable sits on the row's header, outside the widget
       host, so it is matched by its own class rather than by
       containment. */
    document.addEventListener('click', function (e) {
        if (!e.target.closest) return;
        var inWidget = e.target.closest('.mb-block-tables');
        var addBtn   = e.target.closest('.mb-block-table');
        if (!inWidget && !addBtn) return;
        _mbBlockTablesTouched(e.target, true);
    });
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

        /* Tables are not bound live — see the header — so for them this
           is not belt-and-braces at all: it is the only collection that
           happens before a save or an export. */
        mbCollectBlockTables(host);
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

    var block = { uid: mbUid(), title: biNew(), body: biNew(), tables: [] };

    /* Seeded in both languages, once, at creation — see the header note
       on titles being data. Only the FIRST intro section is seeded: the
       second one is whatever the author needs next, and guessing would
       just be a label they have to clear. */
    if (cfg.seedKey && list.length === 0) {
        /* Every language, from the code list — a two-argument biNew()
           call left the French side of a seeded title empty, so a
           French export printed a heading the author never removed
           because they never saw it. */
        block.title = biNew();
        BILANG_CODES.forEach(function (code) {
            biSet(block, 'title', code, window.i18n.tIn(cfg.seedKey, code));
        });
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
