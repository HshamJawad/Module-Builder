// ============================================================
// /src/export_menu.js
// One "Export" button with a menu, in place of four toolbar buttons.
//
// ── WHY ─────────────────────────────────────────────────────
// Adding the PPTX button made a bar that was already tight in French
// overflow at 90% zoom, and the adaptive density in toolbar_fit.js
// answered by shrinking — correct, but four export buttons competing
// for room is the wrong shape to optimise. They are four variants of
// ONE action: choose a format. A menu says that; four buttons say the
// tool has four unrelated features.
//
// The bar keeps ☰, Save, Load and Clear All — the things a facilitator
// presses mid-session without wanting to read a menu first.
//
// ── WHY IT SITS OUTSIDE .figma-toolbar-scroll ───────────────
// Same reason the language menu does, and the page already says it: a
// scroll container clips an absolutely positioned panel. A dropdown
// inside the track would open into a 1-pixel sliver.
//
// ── WHY THE ITEM LABELS ARE NOT TRANSLATED HERE ─────────────
// exports_html.js, exports_pdf.js and exports_pptx.js each already
// repaint their own toolbar label on mb:langchange, selecting
// `[data-act="..."] span:not(.figma-btn-icon)`. The menu items are
// built to match that selector exactly, so those three files keep
// translating their own names with no change and no second copy of the
// strings to fall out of date. The Word item uses data-i18n, as its
// button always did. Only the TRIGGER needs strings of its own.
// ============================================================

var _XM_STRINGS = {
    en: { label: 'Export', title: 'Export the module' },
    fr: { label: 'Exporter', title: 'Exporter le module' },
    ar: { label: 'تصدير', title: 'تصدير الوحدة' }
};

function _xmLang() {
    var l = (document.documentElement.getAttribute('lang') || 'en').toLowerCase();
    if (l.indexOf('ar') === 0) return 'ar';
    if (l.indexOf('fr') === 0) return 'fr';
    return 'en';
}

(function ExportMenu() {
    'use strict';

    /* 3.81.6: the menu's CSS moved to mb-styles.css. It used to be injected
       here at DOMContentLoaded, so on a phone the five export buttons sat
       open in the toolbar until every script had loaded. */
    function injectStyle() { /* intentionally empty */ }

    function paint() {
        var s = _XM_STRINGS[_xmLang()] || _XM_STRINGS.en;
        var lab = document.getElementById('mb-exp-label');
        var trg = document.getElementById('mb-exp-trigger');
        if (lab) lab.textContent = s.label;
        if (trg) { trg.title = s.title; trg.setAttribute('aria-label', s.title); }
    }

    function init() {
        var menu = document.getElementById('mb-exp-menu');
        var trigger = document.getElementById('mb-exp-trigger');
        if (!menu || !trigger) return;

        injectStyle();
        paint();

        function close() {
            menu.classList.remove('is-open');
            trigger.setAttribute('aria-expanded', 'false');
        }

        trigger.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            var open = !menu.classList.contains('is-open');
            menu.classList.toggle('is-open', open);
            trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
        });

        /* The items carry data-act, so events.js runs the export. This
           listener only closes the menu — it must NOT call the exporter
           itself, or every press would export twice. */
        menu.addEventListener('click', function (e) {
            if (e.target.closest && e.target.closest('.mb-exp-opt')) close();
        });

        document.addEventListener('click', function (e) {
            if (!menu.contains(e.target)) close();
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') close();
        });

        /* The interface language is written to <html lang> by the i18n
           engine; following the attribute rather than the event means
           this works whatever order the scripts loaded in. */
        new MutationObserver(paint).observe(document.documentElement, {
            attributes: true, attributeFilter: ['lang']
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
