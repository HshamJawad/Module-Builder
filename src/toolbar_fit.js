/* ============================================================
   src/toolbar_fit.js — the toolbar fits the window, in every language
   ------------------------------------------------------------
   THE PROBLEM

   The toolbar is sized for English. French says the same things in more
   letters — "Exporter vers Word" against "Export to Word", "Enregistrer
   le travail" against "Save Work" — and at 100% browser zoom the last
   buttons fall off the end of the bar. The workaround was to zoom the
   whole page to 80%, which fixes the toolbar by shrinking the module
   the user is actually writing.

   WHY NOT SIMPLY MAKE THE BUTTONS SMALLER

   Because the width that matters is not the language. It is
   (window width ÷ zoom ÷ text length). A single smaller size chosen for
   French at 1366px is needlessly small for English at 1920px and still
   too big for French on a 1280px laptop. A fixed number does not solve
   the problem; it moves it to different users.

   WHAT THIS DOES INSTEAD

   It measures. Once the fonts have loaded, the bar's natural width is
   compared with the space available, and the SMALLEST reduction that
   makes it fit is applied — nothing more. Four steps, in order:

     0  comfortable   the bar as designed; nothing is touched
     1  compact       tighter padding and gaps, text size unchanged
     2  dense         smaller text and icons as well
     3  icons only    labels drop to tooltips, icons stay

   French windows usually settle at 1 or 2 and never reach 3. English at
   a normal width stays at 0, so nothing changes for anyone who did not
   have the problem.

   ── WHY IT MEASURES ONE ELEMENT AND STYLES ANOTHER ──────────

   The markup has two: `.figma-toolbar` is the bar, and inside it
   `.figma-toolbar-scroll` is the track holding the buttons. The
   language menu sits OUTSIDE the track on purpose — a scroll container
   clips its absolutely positioned dropdown, as the page's own comment
   says.

   So overflow is measured on the TRACK, because that is the element
   that runs out of room, while the density class goes on the BAR, so
   the language trigger — a `.figma-btn` like the others, merely not in
   the track — shrinks in step with everything else. A bar whose seven
   buttons went dense while the eighth stayed full size would read as a
   rendering fault rather than a deliberate density.

   ── HOW IT AVOIDS FIGHTING ITS OWN MEASUREMENT ──────────────

   Shrinking the bar changes its width, which wakes the observer, which
   shrinks it again: a loop ending in an icons-only bar on a 4K screen.
   Two guards. Every pass restarts from step 0, so the question asked is
   always "what does the FULL bar need?" and never "does the shrunken
   bar fit?"; and the observer is disconnected for the duration of a
   pass, so the writes it makes cannot re-enter it.

   ── WHAT IT DOES NOT TOUCH ──────────────────────────────────

   No markup is rewritten, no button is moved, no handler is rebound —
   which matters, because every one of these buttons is dispatched by
   data-act through events.js and nothing here may come between them.
   This module reads widths and sets one class on one element.

   The language control keeps its label at every step, step 3 included.
   "EN" is two characters, and hiding the control that changes the
   language would be the cruellest possible answer to a problem caused
   by a language.
   ============================================================ */
(function ToolbarFit() {
    'use strict';

    var BAR_SEL   = '.figma-toolbar';
    var TRACK_SEL = '.figma-toolbar-scroll';
    var LEVELS    = ['', 'tb-compact', 'tb-dense', 'tb-icons'];

    var bar = null, track = null, ro = null, raf = 0;

    /* ── CSS ─────────────────────────────────────────────────
       Scoped to the bar and, apart from the base block, to a density
       class this module sets. With no class present, mb-styles.css is
       untouched — the property that lets this file be added to the
       build rather than merged into the stylesheet. */
    function injectStyle() {
        if (document.getElementById('tb-fit-style')) return;
        var s = document.createElement('style');
        s.id = 'tb-fit-style';
        s.textContent = [
            /* flex-shrink:0 on the track's children is what makes the
               measurement honest. Buttons that squeeze themselves make
               scrollWidth equal clientWidth, so the bar reports that it
               fits while its labels are visibly clipped — exactly the
               state in the screenshot. Held at their natural width, the
               overflow becomes measurable, and only then fixable. */
            '.figma-toolbar-scroll > *{flex:0 0 auto;}',

            /* The track already scrolls; this only makes its scrollbar
               thin and quiet, so the bar does not grow a permanent grey
               strip beneath it. */
            '.figma-toolbar-scroll{scrollbar-width:thin;',
            '-webkit-overflow-scrolling:touch;}',
            '.figma-toolbar-scroll::-webkit-scrollbar{height:6px;}',
            '.figma-toolbar-scroll::-webkit-scrollbar-thumb{',
            'background:rgba(100,116,139,.35);border-radius:3px;}',
            '.figma-toolbar-scroll::-webkit-scrollbar-track{background:transparent;}',

            /* Step 1 — compact. Padding and gaps only. Text size is
               left alone because the bar usually already fits here, and
               unchanged type is worth more than the few pixels a
               smaller font would buy. */
            '.figma-toolbar.tb-compact .figma-toolbar-scroll{gap:6px;}',
            '.figma-toolbar.tb-compact .figma-btn{padding:6px 11px;gap:7px;}',
            '.figma-toolbar.tb-compact .figma-divider{margin:0 2px;}',

            /* Step 2 — dense. Now the type and the icons come down.
               .88em reads as "tighter"; below about .8em the bar starts
               to look like a different application, which is why step 3
               exists rather than a step that keeps shrinking. */
            '.figma-toolbar.tb-dense .figma-toolbar-scroll{gap:5px;}',
            '.figma-toolbar.tb-dense .figma-btn{padding:5px 9px;gap:6px;',
            'font-size:.88em;}',
            '.figma-toolbar.tb-dense .figma-btn-icon{transform:scale(.86);',
            'transform-origin:center;}',
            '.figma-toolbar.tb-dense .figma-divider{margin:0 1px;}',

            /* Step 3 — icons only. The label is hidden, not removed: a
               screen reader still reaches it through the aria-label set
               below, and a mouse still gets it as a tooltip. The clip
               pattern is used rather than display:none because a
               display:none label cannot be read out at all. */
            '.figma-toolbar.tb-icons .figma-toolbar-scroll{gap:4px;}',
            '.figma-toolbar.tb-icons .figma-btn{padding:6px 8px;gap:0;}',
            '.figma-toolbar.tb-icons .figma-toolbar-scroll .figma-btn',
            ' > span:not(.figma-btn-icon){',
            'position:absolute;width:1px;height:1px;padding:0;margin:-1px;',
            'overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0;}',
            /* The selector above is confined to the track, which is
               where the language trigger is NOT. Restated here so that a
               later edit widening that selector cannot silently take
               the language label with it. */
            '.figma-toolbar.tb-icons .mb-lang-trigger > span{',
            'position:static;width:auto;height:auto;margin:0;',
            'clip:auto;overflow:visible;}',

            /* The floor: still overflowing after step 3 — a phone, or a
               narrow split screen. A fade at the trailing edge is the
               only honest signal that the bar continues past the
               window; without it a clipped button and a scrollable
               button look identical. Two rules rather than one logical
               property, because mask-image has no logical form. */
            '.figma-toolbar-scroll.tb-scroll{',
            '-webkit-mask-image:linear-gradient(to right,#000 calc(100% - 34px),transparent);',
            'mask-image:linear-gradient(to right,#000 calc(100% - 34px),transparent);}',
            '[dir="rtl"] .figma-toolbar-scroll.tb-scroll{',
            '-webkit-mask-image:linear-gradient(to left,#000 calc(100% - 34px),transparent);',
            'mask-image:linear-gradient(to left,#000 calc(100% - 34px),transparent);}',

            /* Someone who has asked for less motion gets no animation on
               a bar that resizes itself while they type. */
            '@media (prefers-reduced-motion:no-preference){',
            '.figma-toolbar .figma-btn{transition:padding .12s,font-size .12s;}}'
        ].join('');
        document.head.appendChild(s);
    }

    /* ── Tooltips ────────────────────────────────────────────
       Copied from the label BEFORE it can be hidden, and refreshed on
       every language change, so an icons-only bar stays usable and
       stays in the interface language. aria-label as well as title:
       a title is a mouse affordance and answers nothing for a keyboard
       or a screen reader.

       Buttons with no label span — the sidenav toggle is icon-only by
       design and carries its own hand-written title — fall out at the
       `if (!text)` line and keep what the markup gave them. */
    function keepLabelsReadable() {
        if (!track) return;
        track.querySelectorAll('.figma-btn').forEach(function (b) {
            var span = b.querySelector('span:not(.figma-btn-icon)');
            var text = span ? span.textContent.trim() : '';
            if (!text) return;
            b.title = text;
            b.setAttribute('aria-label', text);
        });
    }

    /* ── Measurement ─────────────────────────────────────────
       One question, asked at most four times: with this level applied,
       does the track's content still run past its box? Reading
       scrollWidth forces layout, which is why a pass happens inside one
       animation frame and stops at the first level that fits rather
       than testing all of them. */
    function overflows() {
        return track.scrollWidth > track.clientWidth + 1;
    }

    function applyLevel(i) {
        LEVELS.forEach(function (c, n) {
            if (c) bar.classList.toggle(c, n === i);
        });
    }

    function fit() {
        if (!bar || !bar.isConnected) return;

        /* The observer watches the elements this function resizes. Left
           connected, every write below would schedule another pass, and
           since each pass restarts at level 0 the bar would visibly
           flash through its four states on every resize. */
        if (ro) ro.disconnect();

        var i = 0;
        for (; i < LEVELS.length; i++) {
            applyLevel(i);
            if (!overflows()) break;
        }
        var atFloor = (i >= LEVELS.length);
        if (atFloor) applyLevel(LEVELS.length - 1);
        track.classList.toggle('tb-scroll', atFloor && overflows());

        if (ro) { ro.observe(bar); if (track !== bar) ro.observe(track); }
    }

    function schedule() {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(fit);
    }

    /* ── Wiring ──────────────────────────────────────────────
       Five triggers, each a real cause of a change in the width
       required — not a timer hoping to catch one:

         resize / zoom      the space available changed
         mb:langchange      the labels changed length (the whole point)
         fonts.ready        the first pass measured the fallback font
         DOM change         version.js appends an update badge to this bar
         orientation        a tablet turned
    */
    function init() {
        bar   = document.querySelector(BAR_SEL);
        if (!bar) return;
        track = bar.querySelector(TRACK_SEL) || bar;

        injectStyle();
        keepLabelsReadable();

        if (window.ResizeObserver) {
            ro = new ResizeObserver(schedule);
            ro.observe(bar);
            if (track !== bar) ro.observe(track);
        }
        window.addEventListener('resize', schedule);
        window.addEventListener('orientationchange', schedule);

        window.addEventListener('mb:langchange', function () {
            /* Other modules repaint their toolbar labels in their own
               listeners for this event — exports_html.js, exports_pdf.js
               and word_settings.js each own one. Two frames is enough
               for those writes to land before the bar is measured
               against them. */
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

        /* A vertical wheel over the bar scrolls it sideways. This is
           one of the few places in the tool where a wheel has nothing
           else to do, and a horizontal strip that ignores it feels
           stuck. ctrl+wheel is left alone — that is the browser's zoom,
           and this module's whole purpose is to make reaching for it
           unnecessary. */
        track.addEventListener('wheel', function (e) {
            if (!track.classList.contains('tb-scroll')) return;
            if (e.deltaY === 0 || e.ctrlKey) return;
            track.scrollLeft += e.deltaY;
            e.preventDefault();
        }, { passive: false });

        fit();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    /* Exposed for the console, and for any module that rebuilds the bar
       and wants it re-measured at once rather than a frame later. */
    window.mbFitToolbar = schedule;
})();
