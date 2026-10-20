// ============================================================
// /src/sw_register.js
// Registers sw.js — the service worker that lets the tool open and
// export offline once it has been opened online (3.13.0).
//
// After every load the worker is asked to fill in anything missing from
// its cache (PRECACHE). That matters because version.js clears all
// caches when an update is accepted: without this, the offline copy
// would come back only file by file as each one happened to be used.
//
// 3.55.0: also offers the update bar when a new build arrives (below).
//
// Not on file:// or plain http other than localhost — browsers refuse
// service workers there, and trying only prints an error.
// ============================================================
(function () {
    'use strict';
    if (!('serviceWorker' in navigator)) return;
    if (!window.isSecureContext) return;

    /* 3.55.0 — the update bar, the way DACUM Live Pro does it.
       Before, a new build was installed silently (sw.js skips waiting
       and claims the page), and the bar depended on version.js seeing
       version.json change while the tab was open. Opened after a merge,
       the page and version.json were both new already, so nothing was
       offered. Now: a page that was running under a worker and sees a
       new worker take over says so — on every open after a release.
       The very first visit (no worker yet) has nothing to update. */
    var hadController = !!navigator.serviceWorker.controller;
    var announced = false;

    function announce() {
        if (announced || !hadController) return;
        announced = true;
        window.__mbSwUpdated = true;            /* read by version.js if it starts later */
        try { window.dispatchEvent(new CustomEvent('mb:sw-updated')); } catch (e) {}
    }

    navigator.serviceWorker.addEventListener('controllerchange', announce);

    function askPrecache(reg) {
        var w = (reg && (reg.active || reg.waiting || reg.installing)) || navigator.serviceWorker.controller;
        if (w) w.postMessage({ type: 'PRECACHE' });
    }

    window.addEventListener('load', function () {
        /* updateViaCache 'none': sw.js itself is never taken from the
           HTTP cache, so a changed CACHE_VERSION is seen at once. */
        navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(function (reg) {
            /* A worker that finished installing while this page has one
               already is a new build — say so even before it takes over. */
            reg.addEventListener('updatefound', function () {
                var nw = reg.installing;
                if (!nw) return;
                nw.addEventListener('statechange', function () {
                    if (nw.state === 'installed' && navigator.serviceWorker.controller) announce();
                });
            });

            /* Look for a new build now, then every 30 s while the tab is
               visible, and on coming back to it. */
            function update() {
                if (document.hidden || navigator.onLine === false) return;
                reg.update().catch(function () {});
            }
            update();
            setInterval(update, 30000);
            document.addEventListener('visibilitychange', function () { if (!document.hidden) update(); });

            /* Idle time, not boot time: the precache downloads ~2 MB the
               first time and must not compete with the module opening. */
            setTimeout(function () {
                navigator.serviceWorker.ready.then(askPrecache).catch(function () {});
            }, 4000);
            return reg;
        }).catch(function (e) {
            console.warn('[SW] registration failed:', e && e.message);
        });
    });
})();
