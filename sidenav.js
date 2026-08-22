/* ============================================================
   sidenav.js — show / hide the silver section rail
   ------------------------------------------------------------
   Self-contained on purpose. It binds its own listener to one
   button instead of registering an action in events.js, so the
   dispatch registry and every existing data-act stay untouched.

   State lives in localStorage under a key of its own; the rail
   is a view preference, not project data, so it deliberately
   does not travel inside the saved/exported work file.

   Only the class on <body> is toggled. Everything visual is in
   mb-styles.css, which keeps the RTL flip a CSS concern.
   ============================================================ */
(function () {
    'use strict';

    var KEY = 'mb_nav_collapsed';
    var CLASS = 'mb-nav-collapsed';

    function read() {
        try { return localStorage.getItem(KEY) === '1'; }
        catch (e) { return false; }   /* private mode / blocked storage */
    }

    function write(collapsed) {
        try { localStorage.setItem(KEY, collapsed ? '1' : '0'); }
        catch (e) { /* preference simply will not persist */ }
    }

    function apply(collapsed, btn) {
        document.body.classList.toggle(CLASS, collapsed);
        if (btn) btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    }

    function init() {
        var btn = document.getElementById('mb-nav-toggle');
        if (!btn) return;

        /* Restore before the first paint the user can notice. The
           transition is suppressed for that first application so the
           rail does not slide in on every page load. */
        document.body.classList.add('mb-nav-no-anim');
        apply(read(), btn);
        window.requestAnimationFrame(function () {
            window.requestAnimationFrame(function () {
                document.body.classList.remove('mb-nav-no-anim');
            });
        });

        btn.addEventListener('click', function (e) {
            e.preventDefault();
            var collapsed = !document.body.classList.contains(CLASS);
            apply(collapsed, btn);
            write(collapsed);
        });

        /* Keyboard escape closes the rail while it is overlaying the
           page on narrow desktops. Harmless when it is already shut. */
        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') return;
            if (document.body.classList.contains(CLASS)) return;
            if (window.innerWidth > 1280) return;
            apply(true, btn);
            write(true);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
