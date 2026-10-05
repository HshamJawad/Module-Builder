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
// Not on file:// or plain http other than localhost — browsers refuse
// service workers there, and trying only prints an error.
// ============================================================
(function () {
    'use strict';
    if (!('serviceWorker' in navigator)) return;
    if (!window.isSecureContext) return;

    function askPrecache(reg) {
        var w = (reg && (reg.active || reg.waiting || reg.installing)) || navigator.serviceWorker.controller;
        if (w) w.postMessage({ type: 'PRECACHE' });
    }

    window.addEventListener('load', function () {
        navigator.serviceWorker.register('sw.js').then(function (reg) {
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
