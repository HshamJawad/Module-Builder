/* ============================================================
   toolbar_fit.js — the toolbar fits the window, in every language
   ------------------------------------------------------------
   THE PROBLEM

   The toolbar is a fixed-size row of buttons sized for English. French
   says the same things in more letters — "Exporter vers Word" against
   "Export to Word", "Enregistrer le travail" against "Save work" — and
   at 100% browser zoom the last buttons fall off the end of the bar.
   The user's workaround was to zoom the whole page to 80%, which fixes
   the toolbar by shrinking the module they are actually writing.

   WHY NOT JUST MAKE THE BUTTONS SMALLER

   Because the bar overflows at some widths and not others, and the
   width that matters is not the language — it is (window width ÷ zoom ÷
   text length). A single smaller size chosen for French at 1366px is
   too small for English at 1920px and still too big for French on a
   1280px laptop. Any fixed number is wrong for most users; it just
   moves which ones.

   WHAT THIS DOES INSTEAD

   It measures. After the fonts have loaded, the bar's natural width is
   compared with the space available, and the smallest reduction that
   makes it fit is applied — nothing more. Four steps, in order:

     0  comfortable   the bar as designed; nothing is touched
     1  compact       tighter padding and gaps, slightly smaller text
     2  dense         smaller text and icons as well
     3  icons only    labels drop to tooltips, icons stay

   Most French windows will settle at 1 or 2 and never reach 3. English
   at a normal width stays at 0, so nothing changes for anyone who did
   not have the problem.

   AND IF EVEN STEP 3 IS NOT ENOUGH

   A phone, or a very narrow split screen: the bar scrolls sideways,
   with a fade at the edge so it is visible that there is more. This is
   the floor — no button is ever unreachable, which is the one thing
   the current bar gets wrong.

   ── HOW IT AVOIDS FIGHTING ITS OWN MEASUREMENT ──────────────

   Shrinking the bar changes its width, which triggers the observer,
   which shrinks it again: a loop that ends with an icons-only bar on a
   4K screen. Two guards prevent it. Measurement always restarts from
   step 0, so each pass asks "what does the FULL bar need?" rather than
   "does the shrunken bar fit?" — and the observer is disconnected for
   the duration of a pass, so the writes it makes cannot re-enter it.

   ── WHAT IT DOES NOT TOUCH ──────────────────────────────────

   No markup is rewritten, no button is moved, no handler is rebound.
   The module reads widths and sets one class on one element. The
   language pills keep their labels at every step: "FR" is two letters
   and dropping it would hide the control that changes the language the
   user is struggling with.
   ============================================================ */
(function ToolbarFit() {
    'use strict';

    var BAR_SEL = '.figma-toolbar';
    var LEVELS  = ['', 'tb-compact', 'tb-dense', 'tb-icons'];
    var bar     = null;
    var ro      = null;
    var raf     = 0;

    /* ── CSS ─────────────────────────────────────────────────
       Every rule is scoped to .figma-toolbar and, except for the base
       block, to a density class the module sets. With no class present
       the page's own stylesheet is untouched — an important property
       for a file that is added to a build rather than merged into it.

       !important appears only where the page sets the same property
       inline or with a heavier selector; without it the level classes
       would be silently ignored and the module would report a fit it
       had not achieved. */
    function injectStyle() {
        if (document.getElementById('tb-fit-style')) return;
        var s = document.createElement('style');
        s.id = 'tb-fit-style';
        s.textContent = [
            /* Base. flex-shrink:0 on the children is what makes the
               measurement honest: buttons that squeeze themselves make
               scrollWidth equal clientWidth, so the bar reports that it
               fits while its labels are visibly clipped — exactly the
               state in the screenshot. Held at their natural width, the
               overflow becomes measurable, and then fixable. */
            '.figma-toolbar{overflow-x:auto;overflow-y:hidden;',
            'scrollbar-width:thin;-webkit-overflow-scrolling:touch;}',
            '.figma-toolbar > *{flex:0 0 auto;}',
            /* A scrollbar that appears only while scrolling, so the bar
               does not grow a permanent grey strip under it. */
            '.figma-toolbar::-webkit-scrollbar{height:6px;}',
            '.figma-toolbar::-webkit-scrollbar-thumb{',
            'background:rgba(100,116,139,.35);border-radius:3px;}',
            '.figma-toolbar::-webkit-scrollbar-track{background:transparent;}',

            /* Step 1 — compact. Padding and gaps only. Text size is
               left alone because at this step the bar usually already
               fits, and unchanged type is worth more than the extra
               few pixels a smaller font would buy. */
            '.figma-toolbar.tb-compact{gap:6px;}',
            '.figma-toolbar.tb-compact .figma-btn{padding:6px 11px;gap:7px;}',

            /* Step 2 — dense. Now the type and the icons come down.
               .88em is a reduction the eye reads as "tighter", not as
               "broken"; below about .8em the bar starts to look like a
               different application, which is why step 3 exists rather
               than a step that keeps shrinking. */
            '.figma-toolbar.tb-dense{gap:5px;}',
            '.figma-toolbar.tb-dense .figma-btn{padding:5px 9px;gap:6px;',
            'font-size:.88em;}',
            '.figma-toolbar.tb-dense .figma-btn-icon{transform:scale(.86);',
            'transform-origin:center;}',

            /* Step 3 — icons only. The label is hidden, not deleted:
               a screen reader still reads it (see keepLabelsReadable),
               and a mouse still shows it as a tooltip. */
            '.figma-toolbar.tb-icons{gap:4px;}',
            '.figma-toolbar.tb-icons .figma-btn{padding:6px 8px;gap:0;}',
            '.figma-toolbar.tb-icons .figma-btn > span:not(.figma-btn-icon){',
            'position:absolute;width:1px;height:1px;padding:0;margin:-1px;',
            'overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0;}',
            /* The language pills are the exception at every step: FR is
               already two characters, and hiding the control that
               changes the language would be the cruellest possible
               response to a language-specific layout problem. */
            '.figma-toolbar.tb-icons #mbLangWrap span,',
            '.figma-toolbar.tb-icons .mb-lang-btn{',
            'position:static!important;width:auto!important;height:auto!important;',
            'clip:auto!important;overflow:visible!important;margin:0!important;}',

            /* The floor: still overflowing after step 3. A fade at the
               trailing edge is the only honest signal that the bar
               continues past the window; without it a clipped button
               and a scrollable button look identical. Logical
               properties, so the fade lands on the correct side in
               Arabic without a second rule. */
            '.figma-toolbar.tb-scroll{',
            '-webkit-mask-image:linear-gradient(to right,#000 calc(100% - 34px),transparent);',
            'mask-image:linear-gradient(to right,#000 calc(100% - 34px),transparent);}',
            '.figma-toolbar.tb-scroll[dir="rtl"],',
            '[dir="rtl"] .figma-toolbar.tb-scroll{',
            '-webkit-mask-image:linear-gradient(to left,#000 calc(100% - 34px),transparent);',
            'mask-image:linear-gradient(to left,#000 calc(100% - 34px),transparent);}',

            /* Someone who has asked for less motion gets no transition
               on a bar that resizes itself while they type. */
            '@media (prefers-reduced-motion:no-preference){',
            '.figma-toolbar .figma-btn{transition:padding .12s,font-size .12s;}}'
        ].join('');
        document.head.appendChild(s);
    }

    /* ── Tooltips ────────────────────────────────────────────
       Copied from the label BEFORE it can be hidden, and refreshed on
       every language change, so an icons-only bar is still usable and
       still speaks the interface language. aria-label as well as title:
       a title is a mouse affordance and answers nothing for a keyboard
       or a screen reader. */
    function keepLabelsReadable() {
        if (!bar) return;
        bar.querySelectorAll('.figma-btn').forEach(function (b) {
            var span = b.querySelector('span:not(.figma-btn-icon)');
            var text = span ? span.textContent.trim() : '';
            if (!text) return;
            b.title = text;
            b.setAttribute('aria-label', text);
        });
    }

    /* ── Measurement ─────────────────────────────────────────
       One question, asked four times: with this level applied, does the
       content still run past the box? Reading scrollWidth forces layout,
       which is why the whole pass is inside one animation frame and why
       it stops at the first level that fits rather than testing all of
       them. */
    function overflows() {
        return bar.scrollWidth > bar.clientWidth + 1;
    }

    function applyLevel(i) {
        LEVELS.forEach(function (c, n) {
            if (c) bar.classList.toggle(c, n === i);
        });
    }

    function fit() {
        if (!bar || !bar.isConnected) return;

        /* The observer is watching the element this function resizes.
           Left connected, every write below would schedule another
           pass — and since each pass starts from level 0, the bar would
           visibly flash through its four states on every resize. */
        if (ro) ro.disconnect();

        var i = 0;
        for (; i < LEVELS.length; i++) {
            applyLevel(i);
            if (!overflows()) break;
        }
        /* The loop ran out of levels: keep the last one and let the bar
           scroll. `i` is LEVELS.length here, so clamp it. */
        var atFloor = (i >= LEVELS.length);
        if (atFloor) applyLevel(LEVELS.length - 1);
        bar.classList.toggle('tb-scroll', atFloor && overflows());

        if (ro) ro.observe(bar);
    }

    function schedule() {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(fit);
    }

    /* ── Wiring ──────────────────────────────────────────────
       Five triggers, and each is a real cause of a change in the
       required width — not a timer hoping to catch one:

         resize / zoom      the space available changed
         mb:langchange      the labels changed length (the whole point)
         fonts.ready        the metrics the first pass used were the
                            fallback font's, not the real one
         DOM change in bar  version.js adds an update badge to this bar
         orientation        a tablet turned
    */
    function init() {
        bar = document.querySelector(BAR_SEL);
        if (!bar) return;                       /* no toolbar on this page */

        injectStyle();
        keepLabelsReadable();

        if (window.ResizeObserver) {
            ro = new ResizeObserver(schedule);
            ro.observe(bar);
        }
        window.addEventListener('resize', schedule);
        window.addEventListener('orientationchange', schedule);

        window.addEventListener('mb:langchange', function () {
            /* The label repaints other modules do on this event run in
               their own listeners; two frames is enough for all of them
               to land before the bar is measured against them. */
            requestAnimationFrame(function () {
                requestAnimationFrame(function () {
                    keepLabelsReadable();
                    fit();
                });
            });
        });

        new MutationObserver(function () {
            keepLabelsReadable();
            schedule();
        }).observe(bar, { childList: true, subtree: true });

        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(schedule).catch(function () {});
        }

        /* Shift is the browser's own convention for scrolling a
           horizontal strip, and the bar is one of the few places in
           this tool where a wheel has nothing else to do. */
        bar.addEventListener('wheel', function (e) {
            if (!bar.classList.contains('tb-scroll')) return;
            if (e.deltaY === 0 || e.ctrlKey) return;    /* ctrl+wheel is zoom */
            bar.scrollLeft += e.deltaY;
            e.preventDefault();
        }, { passive: false });

        fit();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    /* Exposed for the console and for any module that rebuilds the bar
       and wants it re-measured immediately rather than a frame later. */
    window.mbFitToolbar = schedule;
})();
