/* ============================================================
   version.js — build number, credit line, and update banner
   ------------------------------------------------------------
   WHY A SEPARATE FILE AND NOT INLINE
   The version has to be readable by something other than a
   human editing markup — a GitHub Action writes it on every
   push. A file that fetches version.json keeps the number in
   exactly one machine-writable place; inlining it in index.html
   would mean the Action rewrites the page itself on every commit
   and every merge conflict lands in the markup.

   WHAT IT OWNS
   1. version.json is the single source of the build number.
      Nothing else in the project states a version — the <h1>,
      the rail and the footer are all written from here, which is
      why "Version 2.0" was removed from the dictionary key.
   2. The credit line, in three languages, so correcting the
      spelling of a name is a one-line edit rather than a hunt
      through three dictionaries.
   3. An update banner. GitHub Pages serves index.html from cache;
      a user with the tab open for a week is running last week's
      build and has no way to know. This polls version.json, and
      when the number moves it offers a reload — it never reloads
      on its own, because unsaved work is not ours to discard.

   LANGUAGE
   Read from <html lang>, which the i18n engine already maintains,
   and re-read on change through a MutationObserver. No coupling
   to the dictionaries: this file carries its own three strings.
   ============================================================ */
(function () {
    'use strict';

    var POLL_MS = 5 * 60 * 1000;          /* five minutes */
    var SRC     = 'version.json';

    var loaded  = null;                   /* build this page is running */
    var latest  = null;                   /* build on the server        */
    var banner  = null;

    /* ── Strings ─────────────────────────────────────────────── */
    var STR = {
        en: {
            app:        'Module Builder',
            credit:     '© 2026 Module Builder | by Husham Jawad Kadhim | {v} | All Rights Reserved',
            version:    'Version {v}',
            newVersion: 'A new version of Module Builder is available',
            update:     'Update now',
            later:      'Later',
            note:       'Your saved work is not affected.'
        },
        ar: {
            app:        'باني الوحدات التدريبية',
            credit:     '© 2026 باني الوحدات التدريبية | إعداد هشام جواد كاظم | {v} | جميع الحقوق محفوظة',
            version:    'الإصدار {v}',
            newVersion: 'يتوفر إصدار جديد من باني الوحدات التدريبية',
            update:     'حدّث الآن',
            later:      'لاحقاً',
            note:       'لن يتأثر عملك المحفوظ.'
        },
        ku: {
            app:        'دروستکەری یەکەی ڕاهێنان',
            credit:     '© ٢٠٢٦ دروستکەری یەکەی ڕاهێنان | ئامادەکردنی هشام جواد کاظم | {v} | هەموو مافەکان پارێزراون',
            version:    'وەشانی {v}',
            newVersion: 'وەشانێکی نوێی دروستکەری یەکەی ڕاهێنان بەردەستە',
            update:     'ئێستا نوێی بکەرەوە',
            later:      'دواتر',
            note:       'کارە پاشەکەوتکراوەکەت کاری لێ ناکرێت.'
        }
    };

    function lang() {
        var l = (document.documentElement.getAttribute('lang') || 'en').toLowerCase();
        if (l.indexOf('ar') === 0) return 'ar';
        if (l.indexOf('ku') === 0 || l.indexOf('ckb') === 0) return 'ku';
        return 'en';
    }

    function t(key) { return STR[lang()][key] || STR.en[key] || ''; }

    /* ── Painting ────────────────────────────────────────────── */
    function paint() {
        var s = STR[lang()];

        var h1 = document.getElementById('mb-app-title');
        if (h1) h1.textContent = s.app;

        var rail = document.getElementById('mb-nav-title');
        if (rail) rail.textContent = s.app;

        var credit = document.getElementById('mb-credit');
        if (credit) {
            /* No build number yet (offline, or version.json missing):
               the credit line still reads correctly without one. */
            var v = loaded ? s.version.replace('{v}', loaded) : '';
            credit.textContent = v
                ? s.credit.replace('{v}', v)
                : s.credit.replace(' | {v}', '').replace('{v} | ', '');
        }

        if (banner) paintBanner();
    }

    /* ── Update banner ───────────────────────────────────────── */
    function paintBanner() {
        banner.querySelector('.mb-update-text').textContent = t('newVersion');
        banner.querySelector('.mb-update-note').textContent = t('note');
        banner.querySelector('.mb-update-go').textContent   = t('update');
        banner.querySelector('.mb-update-later').textContent = t('later');
    }

    function showBanner() {
        if (banner) { banner.classList.add('is-open'); paintBanner(); return; }

        banner = document.createElement('div');
        banner.className = 'mb-update-bar is-open';
        banner.setAttribute('role', 'status');
        banner.innerHTML =
            '<span class="mb-update-icon">⬆️</span>' +
            '<span class="mb-update-copy">' +
                '<span class="mb-update-text"></span>' +
                '<span class="mb-update-note"></span>' +
            '</span>' +
            '<button type="button" class="mb-update-go"></button>' +
            '<button type="button" class="mb-update-later"></button>';

        banner.querySelector('.mb-update-go').addEventListener('click', function () {
            /* Drop any Cache Storage entry first, or a service worker
               would hand back the very build we are trying to leave. */
            var done = function () { location.reload(); };
            if (window.caches && caches.keys) {
                caches.keys()
                    .then(function (keys) { return Promise.all(keys.map(function (k) { return caches.delete(k); })); })
                    .then(done, done);
            } else {
                done();
            }
        });

        banner.querySelector('.mb-update-later').addEventListener('click', function () {
            banner.classList.remove('is-open');
        });

        document.body.appendChild(banner);
        paintBanner();
    }

    /* ── Polling ─────────────────────────────────────────────── */
    function check() {
        /* Cache-busted by hand as well as by header: GitHub Pages
           ignores no-store on some edges. */
        fetch(SRC + '?t=' + Date.now(), { cache: 'no-store' })
            .then(function (r) { return r.ok ? r.json() : null; })
            .then(function (data) {
                if (!data || !data.version) return;
                latest = String(data.version);

                if (loaded === null) {      /* first read: this is us */
                    loaded = latest;
                    paint();
                    return;
                }
                if (latest !== loaded) showBanner();
            })
            .catch(function () { /* offline, or no version.json — stay quiet */ });
    }

    function init() {
        paint();
        check();

        setInterval(check, POLL_MS);

        /* Coming back to the tab is the moment a stale build matters. */
        document.addEventListener('visibilitychange', function () {
            if (!document.hidden) check();
        });

        /* Follow the interface language wherever the i18n engine takes it. */
        new MutationObserver(paint).observe(document.documentElement, {
            attributes: true, attributeFilter: ['lang', 'dir']
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
