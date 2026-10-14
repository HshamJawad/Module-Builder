// ============================================================
// /src/glossary.js
// «Glossary of Terms / مسرد المصطلحات / Glossaire» (3.42.0)
//
// WHAT IT IS
// A project-level section in the References tab, made of one or more
// tables the author builds with the SAME table widget every other part
// of the tool uses (content.js: addContentTable, ctAddRow …). Nothing
// here draws a grid; this file only owns where the tables live, the
// heading, and the default first table.
//
// WHERE IT LIVES
// mbState.glossary = { title: <multilingual pair> | null, tables: [] }
// Shared project data, beside the references (module_library.js:
// mbCollectShared / mbApplyProjectShared), so one glossary serves every
// module of the project, is saved with it, travels in packages and is
// cleared by Clear All.
//
// LANGUAGES
// The heading is a multilingual pair, seeded from the dictionary in
// every language (the same rule as the References heading) and renamed
// per content language. The tables are shared across languages, exactly
// like every other table in the tool: a glossary is often ONE table
// with a column per language, and the author decides the columns.
//
// EXPORT
// Word, PDF and HTML put it on its own page immediately BEFORE the
// References. PowerPoint leaves it out, as it leaves out the references.
// ============================================================

/** The glossary object, created on first use. Never null. */
function mbGlossary() {
    if (!mbState.glossary || typeof mbState.glossary !== 'object') {
        mbState.glossary = { title: null, tables: [] };
    }
    if (!Array.isArray(mbState.glossary.tables)) mbState.glossary.tables = [];
    return mbState.glossary;
}

/** Normalise whatever a saved project holds into a glossary object. */
function mbNormalizeGlossary(g) {
    var out = { title: null, tables: [] };
    if (!g || typeof g !== 'object') return out;
    out.title = g.title ? ((typeof biUpgrade === 'function') ? biUpgrade(g.title) : g.title) : null;
    out.tables = Array.isArray(g.tables) ? JSON.parse(JSON.stringify(g.tables)) : [];
    return out;
}

/** True when any glossary table has a caption or a filled cell. */
function mbGlossaryHasContent(g) {
    g = g || mbState.glossary;
    if (!g || !Array.isArray(g.tables)) return false;
    return g.tables.some(function (t) {
        if (!t) return false;
        if (String(t.title || '').trim() || String(t.subtitle || '').trim()) return true;
        return (t.cells || []).some(function (r) {
            return (r || []).some(function (c) { return String(c == null ? '' : c).trim(); });
        });
    });
}

/** Seed the heading in every language while it is empty — see
    mbSeedReferencesTitle() for why both sides are seeded. */
function mbSeedGlossaryTitle() {
    var g = mbGlossary();
    if (!g.title || typeof g.title !== 'object') g.title = biNew();
    BILANG_CODES.forEach(function (code) {
        if (biGetStrict(g.title, code).trim()) return;
        biSet(g, 'title', code, window.i18n.tIn('expGlossary', code));
    });
}

function _mbGlossaryPaintTitle() {
    var el = document.getElementById('glossary-title-display');
    if (el) el.textContent = '📖 ' + biGetStrict(mbGlossary().title, contentLang());
}

function _mbGlossaryPaintEmpty() {
    var hint = document.getElementById('glossary-empty');
    var host = document.getElementById('content-tables-glossary');
    if (!hint || !host) return;
    hint.hidden = host.querySelector('.content-table-widget') !== null;
}

/** State → screen. Rebuilds the table widgets from the saved tables. */
function renderGlossary() {
    mbSeedGlossaryTitle();
    _mbGlossaryPaintTitle();
    var host = document.getElementById('content-tables-glossary');
    if (!host) return;
    host.innerHTML = '';
    var g = mbGlossary();
    if (g.tables.length && typeof restoreContentTables === 'function') {
        restoreContentTables('glossary', g.tables);
    }
    _mbGlossaryPaintEmpty();
}

/** Screen → state. Silent when the tab is not in the page. */
function mbCollectGlossary() {
    var host = document.getElementById('content-tables-glossary');
    if (!host || typeof collectContentTables !== 'function') return;
    mbGlossary().tables = collectContentTables('glossary');
}

/** «➕ Add table». The first table starts as Term | Definition with a
    few empty rows, headed in the CONTENT language; later ones are the
    widget's ordinary blank grid, since the author has already chosen a
    shape for the first. */
function addGlossaryTable() {
    mbCollectGlossary();
    var g = mbGlossary();
    var lang = contentLang();
    var data = null;
    if (!g.tables.length) {
        data = {
            rows: 5, cols: 2,
            cells: [[window.i18n.tIn('glTermHead', lang), window.i18n.tIn('glDefHead', lang)],
                    ['', ''], ['', ''], ['', ''], ['', '']]
        };
    }
    addContentTable('glossary', data);
    mbCollectGlossary();
    _mbGlossaryPaintEmpty();
    _mbGlossaryTouch();
}

async function renameGlossaryTitle() {
    var g = mbGlossary();
    var cur = biGetStrict(g.title, contentLang());
    var next = await mbPrompt(window.i18n.t('dgEnterNewSectionTitle'), cur);
    if (next && next.trim()) {
        biSet(g, 'title', contentLang(), next.trim());
        _mbGlossaryPaintTitle();
        _mbGlossaryTouch();
    }
}

function _mbGlossaryTouch() {
    if (typeof mbTouch === 'function') { try { mbTouch(); } catch (e) { /* autosave absent */ } }
}

/* ── Live capture ─────────────────────────────────────────────
   The widget's cells carry no data-act, so nothing tells this file that
   a cell changed. Watched where it lives, the same arrangement blocks.js
   uses: debounced for typing, and on the next task for the buttons
   (the dispatcher in events.js may run after this listener). */
var _mbGlossaryTimer = null;
function _mbGlossaryWatched(el) {
    return !!(el && el.closest && el.closest('#content-tables-glossary'));
}
if (typeof document !== 'undefined') {
    document.addEventListener('input', function (e) {
        if (!_mbGlossaryWatched(e.target)) return;
        clearTimeout(_mbGlossaryTimer);
        _mbGlossaryTimer = setTimeout(function () { mbCollectGlossary(); _mbGlossaryTouch(); }, 300);
    });
    document.addEventListener('click', function (e) {
        if (!_mbGlossaryWatched(e.target)) return;
        if (!(e.target.closest && e.target.closest('button'))) return;
        setTimeout(function () { mbCollectGlossary(); _mbGlossaryPaintEmpty(); _mbGlossaryTouch(); }, 0);
    });
}
if (typeof window !== 'undefined') {
    /* The heading follows the content language; the tables are shared. */
    window.addEventListener('mb:langchange', function () { _mbGlossaryPaintTitle(); });
}
