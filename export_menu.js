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

    function injectStyle() {
        if (document.getElementById('xm-style')) return;
        var s = document.createElement('style');
        s.id = 'xm-style';
        s.textContent = [
            '.mb-exp-menu{position:relative;flex:0 0 auto;}',
            '.mb-exp-caret{font-size:.7em;opacity:.6;margin-inline-start:2px;}',

            /* inset-inline-start rather than left: the panel hangs from
               the same edge as its trigger in both directions, with no
               second rule for Arabic. */
            '.mb-exp-panel{position:absolute;inset-inline-start:0;top:calc(100% + 6px);',
            'min-width:230px;padding:6px;border:1px solid #e2e8f0;border-radius:12px;',
            'background:#fff;box-shadow:0 12px 32px rgba(15,23,42,.16);',
            'z-index:6000;display:none;}',
            '.mb-exp-menu.is-open .mb-exp-panel{display:block;}',

            '.mb-exp-opt{display:flex;align-items:center;gap:10px;width:100%;',
            'padding:9px 11px;border:none;border-radius:9px;background:transparent;',
            'font:inherit;font-size:.93em;color:#334155;text-align:start;cursor:pointer;',
            'transition:background .12s;}',
            '.mb-exp-opt:hover,.mb-exp-opt:focus-visible{background:#eef2ff;outline:none;}',
            '.mb-exp-opt .figma-btn-icon{flex:0 0 auto;}',

            /* The panel is the last thing in the bar in reading order,
               so on a narrow window it can hang past the edge. Flipping
               it to the other side there costs one rule and saves a
               menu the user cannot reach. */
            '@media (max-width:560px){',
            '.mb-exp-panel{inset-inline-start:auto;inset-inline-end:0;}}'
        ].join('');
        document.head.appendChild(s);
    }

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
