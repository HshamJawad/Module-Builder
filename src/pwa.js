// ============================================================
// /src/pwa.js
// Installable app (PWA) behaviour — 3.81.0.
//
//   • Install bar: Android / Windows / ChromeOS / desktop Chrome and Edge
//     offer the browser's own install prompt (beforeinstallprompt);
//     iPhone and iPad (Safari has no prompt) get a short "Share ▸ Add to
//     Home Screen" hint instead. Shown once the tool has started, never
//     while it runs as an installed app, and not again for 14 days after
//     "Not now".
//   • html.mb-standalone while running as an installed app (CSS hook).
//   • Offline / back-online notice — the tool keeps working offline.
//   • navigator.storage.persist(): asks the browser not to evict the
//     saved projects (IndexedDB) under storage pressure. Best effort.
//   • launchQueue: a .mbz double-clicked in the file manager (Windows,
//     ChromeOS, Chrome on desktop) opens the installed app and imports.
//
// Own strings (en / fr / ar), the way version.js does it: this file must
// not depend on the translation dictionary having loaded.
// ============================================================
(function () {
    'use strict';

    var DISMISS_KEY = 'mb_pwa_dismissed';        /* localStorage, ms timestamp */
    var DISMISS_MS  = 14 * 24 * 60 * 60 * 1000;
    var SHOW_AFTER  = 6000;                      /* ms after the tool has started */

    var STR = {
        en: {
            install: 'Install Module Builder', installNote: 'Opens like an app, works offline.',
            installGo: 'Install', notNow: 'Not now',
            iosTitle: 'Add Module Builder to your Home Screen',
            iosStep: 'Tap the Share button, then “Add to Home Screen”.',
            offline: 'You are offline — the tool keeps working and your work is saved on this device.',
            online: 'Back online.'
        },
        fr: {
            install: 'Installer Module Builder', installNote: 'S’ouvre comme une application, fonctionne hors ligne.',
            installGo: 'Installer', notNow: 'Plus tard',
            iosTitle: 'Ajouter Module Builder à l’écran d’accueil',
            iosStep: 'Touchez le bouton Partager, puis « Sur l’écran d’accueil ».',
            offline: 'Vous êtes hors ligne — l’outil continue de fonctionner et votre travail reste sur cet appareil.',
            online: 'De nouveau en ligne.'
        },
        ar: {
            install: 'تثبيت باني الوحدات التدريبية', installNote: 'يُفتح كتطبيق ويعمل دون إنترنت.',
            installGo: 'تثبيت', notNow: 'ليس الآن',
            iosTitle: 'أضِف باني الوحدات التدريبية إلى الشاشة الرئيسية',
            iosStep: 'اضغط زر المشاركة، ثم «إضافة إلى الشاشة الرئيسية».',
            offline: 'أنت غير متصل — الأداة تعمل وعملك محفوظ على هذا الجهاز.',
            online: 'عاد الاتصال.'
        }
    };

    function lang() {
        var l = null;
        try { l = localStorage.getItem('dacum_lang'); } catch (e) {}
        return STR[l] ? l : 'en';
    }
    function t(k) { return STR[lang()][k]; }

    /* ── Environment ──────────────────────────────────────────── */
    function isStandalone() {
        try {
            if (window.matchMedia && (window.matchMedia('(display-mode: standalone)').matches ||
                window.matchMedia('(display-mode: fullscreen)').matches ||
                window.matchMedia('(display-mode: minimal-ui)').matches)) return true;
        } catch (e) {}
        return window.navigator.standalone === true;
    }
    function isIOS() {
        var ua = navigator.userAgent || '';
        if (/iPhone|iPad|iPod/.test(ua)) return true;
        /* iPadOS 13+ reports itself as a Mac with a touch screen. */
        return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    }
    function isIOSSafari() {
        var ua = navigator.userAgent || '';
        /* Chrome/Firefox/Edge on iOS (CriOS/FxiOS/EdgiOS) can add to the
           Home Screen too, but the Share-sheet wording differs; the hint
           is written for Safari, so only show it there. */
        return isIOS() && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua);
    }
    function recentlyDismissed() {
        try {
            var ts = parseInt(localStorage.getItem(DISMISS_KEY), 10);
            return ts && (Date.now() - ts) < DISMISS_MS;
        } catch (e) { return false; }
    }
    function remember() { try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (e) {} }

    function markStandalone() {
        document.documentElement.classList.toggle('mb-standalone', isStandalone());
    }
    markStandalone();
    try {
        var mq = window.matchMedia('(display-mode: standalone)');
        if (mq.addEventListener) mq.addEventListener('change', markStandalone);
    } catch (e) {}

    /* ── Install bar ──────────────────────────────────────────── */
    var deferred = null;      /* the browser's install prompt event */
    var bar = null;
    var timer = null;

    function el(tag, cls, text) {
        var n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text != null) n.textContent = text;
        return n;
    }
    function hideBar() {
        if (timer) { clearTimeout(timer); timer = null; }
        if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
        bar = null;
    }
    function showBar(kind) {
        if (bar || isStandalone() || recentlyDismissed()) return;
        var L = lang();
        bar = el('div', 'mb-pwa-bar');
        bar.setAttribute('role', 'region');
        bar.setAttribute('dir', L === 'ar' ? 'rtl' : 'ltr');
        bar.setAttribute('lang', L);
        bar.setAttribute('aria-label', t('install'));

        var ico = el('img', 'mb-pwa-ico');
        ico.src = 'icons/icon-192.png'; ico.alt = ''; ico.width = 40; ico.height = 40;
        ico.setAttribute('aria-hidden', 'true');

        var copy = el('div', 'mb-pwa-copy');
        copy.appendChild(el('strong', 'mb-pwa-title', kind === 'ios' ? t('iosTitle') : t('install')));
        copy.appendChild(el('span', 'mb-pwa-note', kind === 'ios' ? t('iosStep') : t('installNote')));

        var actions = el('div', 'mb-pwa-actions');
        if (kind !== 'ios') {
            var go = el('button', 'mb-pwa-go', t('installGo'));
            go.type = 'button';
            go.addEventListener('click', function () { install(); });
            actions.appendChild(go);
        }
        var later = el('button', 'mb-pwa-later', t('notNow'));
        later.type = 'button';
        later.addEventListener('click', function () { remember(); hideBar(); });
        actions.appendChild(later);

        bar.appendChild(ico); bar.appendChild(copy); bar.appendChild(actions);
        document.body.appendChild(bar);
    }

    function install() {
        if (!deferred) return Promise.resolve(false);
        var ev = deferred;
        deferred = null;
        hideBar();
        try {
            ev.prompt();
            return ev.userChoice.then(function (c) {
                if (!c || c.outcome !== 'accepted') remember();
                return !!(c && c.outcome === 'accepted');
            }).catch(function () { return false; });
        } catch (e) { return Promise.resolve(false); }
    }

    function whenStarted(fn) {
        var tries = 0;
        (function wait() {
            if (window.mbLib && window.mbLib.booted === true) return fn();
            if (++tries > 120) return fn();         /* 60 s: do not wait forever */
            setTimeout(wait, 500);
        })();
    }
    function scheduleBar(kind) {
        whenStarted(function () {
            if (timer) clearTimeout(timer);
            timer = setTimeout(function () { timer = null; showBar(kind); }, SHOW_AFTER);
        });
    }

    window.addEventListener('beforeinstallprompt', function (e) {
        e.preventDefault();                          /* we show our own, later */
        deferred = e;
        scheduleBar('prompt');
    });
    window.addEventListener('appinstalled', function () {
        deferred = null; hideBar(); markStandalone();
    });
    if (isIOSSafari() && !isStandalone()) scheduleBar('ios');

    /* ── Offline / online notice ──────────────────────────────── */
    var noticeTimer = null;
    function notice(text, cls) {
        var n = document.getElementById('mb-pwa-notice');
        if (!n) {
            n = el('div', 'mb-pwa-notice');
            n.id = 'mb-pwa-notice';
            n.setAttribute('role', 'status');
            n.setAttribute('aria-live', 'polite');
            document.body.appendChild(n);
        }
        n.setAttribute('dir', lang() === 'ar' ? 'rtl' : 'ltr');
        n.className = 'mb-pwa-notice is-open ' + (cls || '');
        n.textContent = text;
        if (noticeTimer) clearTimeout(noticeTimer);
        noticeTimer = setTimeout(function () { n.classList.remove('is-open'); }, cls === 'is-offline' ? 6000 : 2500);
    }
    window.addEventListener('offline', function () { notice(t('offline'), 'is-offline'); });
    window.addEventListener('online',  function () { notice(t('online'),  'is-online'); });

    /* ── Keep the saved projects ──────────────────────────────── */
    function askPersist() {
        try {
            if (!navigator.storage || !navigator.storage.persist) return;
            navigator.storage.persisted().then(function (p) {
                if (!p) return navigator.storage.persist();
            }).catch(function () {});
        } catch (e) {}
    }
    window.addEventListener('load', function () { setTimeout(askPersist, 8000); });

    /* ── Files opened with the installed app ──────────────────── */
    if ('launchQueue' in window && window.launchQueue && window.launchQueue.setConsumer) {
        window.launchQueue.setConsumer(function (params) {
            if (!params || !params.files || !params.files.length) return;
            Promise.all(params.files.map(function (h) { return h.getFile(); })).then(function (files) {
                whenStarted(function () {
                    if (typeof window.mbImportPackages === 'function') window.mbImportPackages(files);
                });
            }).catch(function (e) { console.warn('[PWA] could not open the launched file:', e && e.message); });
        });
    }

    window.mbPwa = {
        install: install,
        canInstall: function () { return !!deferred; },
        isStandalone: isStandalone
    };
})();
