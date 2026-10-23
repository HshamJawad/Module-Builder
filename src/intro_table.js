// ============================================================
// /src/intro_table.js — 3.69.0
// The module overview table of the Introduction Pages tab:
//
//     Title | Subject | Level | Prerequisites | Duration | Purpose |
//     Learning Outcomes | Sources | Activities and Procedures | Assessment
//
// The ten headings are the tool's own, in the export language
// (EN / FR / AR); the author writes only the right-hand column. Each
// box grows downwards with its text (criteria.js mbAutoGrow, also on
// browsers without `field-sizing`).
//
// STATE   mbState.introTable = { title: {en, ar, fr}, subject: …, … }
//         Shared project data, like the work team and the introduction
//         sections (module_library.js mbCollectShared / mbApplyProjectShared).
//         Each box writes its pair on every keystroke (blocks.js rule), so
//         switching the content language never loses a side.
//
// EXPORT  Word: its own page of the introduction, a two-column table
//         16 cm wide (4.5 + 11.5). HTML and PDF: the same table in the
//         introduction section. The table is printed when at least one
//         box has text — then with all ten rows, so the page keeps the
//         shape of the form; a table nobody filled is not printed.
// ============================================================

var MB_INTRO_TABLE_KEYS = ['title', 'subject', 'level', 'prerequisites', 'duration',
                           'purpose', 'outcomes', 'sources', 'activities', 'assessment'];

/* Word widths, in twips: 16 cm = 9072. */
var MB_INTRO_TABLE_DXA = { total: 9072, label: 2551, value: 6521 };

if (window.i18n && window.i18n.extend) window.i18n.extend({
    en: {
        itCard: '📋 Module Overview Table',
        itPh: 'Write here…',
        it_title: 'Title', it_subject: 'Subject', it_level: 'Level', it_prerequisites: 'Prerequisites',
        it_duration: 'Duration', it_purpose: 'Purpose', it_outcomes: 'Learning Outcomes', it_sources: 'Sources',
        it_activities: 'Activities and Procedures', it_assessment: 'Assessment'
    },
    fr: {
        itCard: '📋 Tableau de présentation du module',
        itPh: 'Écrivez ici…',
        it_title: 'Titre', it_subject: 'Matière', it_level: 'Niveau', it_prerequisites: 'Prérequis',
        it_duration: 'Durée', it_purpose: 'Objectif', it_outcomes: 'Résultats d’apprentissage', it_sources: 'Sources',
        it_activities: 'Activités et procédures', it_assessment: 'Évaluation'
    },
    ar: {
        itCard: '📋 جدول التعريف بالوحدة',
        itPh: 'اكتب هنا…',
        it_title: 'العنوان', it_subject: 'الموضوع', it_level: 'المستوى', it_prerequisites: 'المتطلبات السابقة',
        it_duration: 'المدة', it_purpose: 'الغرض', it_outcomes: 'محصلات التعلم', it_sources: 'المصادر',
        it_activities: 'الأنشطة والإجراءات', it_assessment: 'التقييم'
    }
});

function _itT(key) { return window.i18n ? window.i18n.t(key) : key; }
function _itTIn(key, lang) { return (window.i18n && window.i18n.tIn) ? window.i18n.tIn(key, lang) : key; }
function _itEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
}
function _itLang() { return (typeof contentLang === 'function') ? contentLang() : 'en'; }

/** A file, an older project or nothing → ten pairs. Idempotent. */
function mbNormalizeIntroTable(v) {
    var out = {};
    MB_INTRO_TABLE_KEYS.forEach(function (k) {
        var x = v && typeof v === 'object' ? v[k] : null;
        out[k] = (x === null || x === undefined) ? biNew() : biUpgrade(x);
    });
    return out;
}

function _itState() {
    if (!mbState.introTable || typeof mbState.introTable !== 'object') mbState.introTable = mbNormalizeIntroTable(null);
    return mbState.introTable;
}

/** True when some box has text, in any language (raw or flattened state). */
function mbIntroTableFilled(t) {
    if (!t || typeof t !== 'object') return false;
    return MB_INTRO_TABLE_KEYS.some(function (k) {
        var v = t[k];
        if (typeof v === 'string') return !!v.trim();
        if (v && typeof v === 'object') return Object.keys(v).some(function (l) { return typeof v[l] === 'string' && v[l].trim(); });
        return false;
    });
}

/**
 * The rows to print, in one language: [{ key, label, value }] — all ten
 * when anything is filled, [] otherwise. `table` may be the flattened
 * copy (strings) or the raw state (pairs).
 */
function mbIntroTableRows(table, lang) {
    if (!mbIntroTableFilled(table)) return [];
    return MB_INTRO_TABLE_KEYS.map(function (k) {
        var v = table[k];
        var text = (typeof v === 'string') ? v
            : (v && typeof v === 'object' && typeof biGetStrict === 'function') ? biGetStrict(v, lang) : '';
        return { key: k, label: _itTIn('it_' + k, lang), value: String(text || '') };
    });
}

/* ── Editor ─────────────────────────────────────────────────── */

function mbRenderIntroTable(force) {
    var host = document.getElementById('intro-table-section');
    if (!host) return;
    var t = _itState();
    var lang = _itLang();
    var key = lang + '|' + ((window.i18n && window.i18n.getLang) ? window.i18n.getLang() : '');
    var act = document.activeElement;
    /* Not while the author is typing in it: the boxes bind live. */
    if (force !== true && host.getAttribute('data-render-key') === key && act && act !== document.body && host.contains(act)) return;
    host.setAttribute('data-render-key', key);
    var dir = (typeof biIsRtl === 'function' && biIsRtl(lang)) ? 'rtl' : 'ltr';
    var ph = _itEsc(_itT('itPh'));
    var rows = MB_INTRO_TABLE_KEYS.map(function (k) {
        var val = (typeof biGetStrict === 'function') ? biGetStrict(t[k], lang) : '';
        return '<tr data-it-row="' + k + '">' +
            '<th scope="row">' + _itEsc(_itT('it_' + k)) + '</th>' +
            '<td><textarea rows="1" class="mb-content-field mb-autogrow it-field" dir="' + dir + '" data-it-key="' + k + '"' +
                ' data-act="mbIntroTableEdit" data-on="input" data-args=\'["' + k + '"]\'' +
                ' aria-label="' + _itEsc(_itT('it_' + k)) + '" placeholder="' + ph + '">' + _itEsc(val) + '</textarea></td>' +
            '</tr>';
    }).join('');
    host.innerHTML =
        '<div class="mb-blocks-head">' +
          '<label class="mb-blocks-label">' + _itEsc(_itT('itCard')) + '</label>' +
        '</div>' +
        '<table class="it-table"><tbody>' + rows + '</tbody></table>';
    if (typeof mbAutoGrowAll === 'function') mbAutoGrowAll(host);
}

/** One box → its pair, on every keystroke. */
function mbIntroTableEdit(key, el) {
    if (MB_INTRO_TABLE_KEYS.indexOf(key) === -1 || !el) return;
    var t = _itState();
    if (!t[key] || typeof t[key] !== 'object') t[key] = biNew();
    biPut(t, key, el.value);
}

/** DOM → state (before a save or an export): a value set by script, without input. */
function mbSyncIntroTableFromDOM() {
    var host = document.getElementById('intro-table-section');
    if (!host) return;
    host.querySelectorAll('textarea[data-it-key]').forEach(function (el) {
        mbIntroTableEdit(el.getAttribute('data-it-key'), el);
    });
}

window.addEventListener('mb:langchange', function () { try { mbRenderIntroTable(true); } catch (e) { /* not ready */ } });
window.addEventListener('mb:contentlangchange', function () { try { mbRenderIntroTable(true); } catch (e) { /* not ready */ } });
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { mbRenderIntroTable(true); });
else mbRenderIntroTable(true);
