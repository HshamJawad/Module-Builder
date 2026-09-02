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
      the rail, the toolbar badge and the footer are all written
      from here.
   2. The credit line, in three languages, so correcting the
      spelling of a name is a one-line edit rather than a hunt
      through three dictionaries.
   3. The update offer: a bar, a toolbar badge, and the reload.

   ── HOW THIS DIFFERS FROM DACUM LITE ────────────────────────
   The behaviour is ported from DACUM Lite's update-notifier.js,
   but ONE of its two halves cannot come with it, and it matters
   that the difference is understood rather than discovered.

   There, a service worker installs the new build into a cache
   and waits. The bar is offered only once the new version is
   already on disk, so "Update now" is a switch between two local
   copies: instant, and correct even on a bad connection.

   Module Builder is not a PWA — deliberately, for now — so there
   is no local copy and no worker. What survives the port is
   everything the user actually sees and every safeguard around
   it: the same bar, the same "Later means the offer moves to the
   toolbar badge, not that it disappears", the same reload guard,
   the same never-reload-on-its-own rule. What is replaced is the
   mechanism underneath "Update now": instead of activating a
   waiting worker, the shell files are re-fetched past the HTTP
   cache and only then is the page reloaded — see applyUpdate().

   The one behaviour that cannot be reproduced without a worker
   is offline update readiness. With no connection there is
   nothing to offer, which is the honest outcome: an update that
   has not been downloaded cannot be applied.

   ── THE RULE THIS FILE WILL NOT BREAK ───────────────────────
   It never reloads the page on its own. This tool is used while
   people are typing a module; a surprise reload costs far more
   than running last week's build for another ten minutes. The
   user picks the moment, always.

   LANGUAGE
   Read from <html lang>, which the i18n engine already maintains,
   and re-read on change through a MutationObserver. No coupling
   to the dictionaries: this file carries its own strings, in the
   same three languages the interface offers — EN, FR, AR.
   ============================================================ */
(function () {
    'use strict';

    var SRC = 'version.json';

    /* Poll cadence. The old file asked every 90 seconds, forever, which
       is both more traffic than a build number deserves and less useful
       than it sounds: a tab left open all day is not looking at the
       screen for most of it. So — one early check once the app has
       settled, a slow interval after that, and a check at each of the
       three moments a stale build actually starts to matter: coming
       back to the tab, refocusing the window, regaining a connection. */
    var POLL_FIRST_MS = 8 * 1000;
    var POLL_EVERY_MS = 5 * 60 * 1000;

    var BANNER_ID  = 'mb-update-bar';
    var BADGE_ID   = 'mb-version-badge';
    var RELOAD_KEY = 'mb_update_reload';      /* sessionStorage */
    var RELOAD_GUARD_MS = 20 * 1000;

    var loaded  = null;    /* build this page is running   */
    var latest  = null;    /* newest build seen on server  */
    var built   = null;    /* release date of `loaded`     */
    var banner  = null;
    var badge   = null;

    var updateReady   = false;   /* an update is on offer right now */
    var userTriggered = false;   /* the user pressed "Update now"   */
    var pollTimer     = null;
    var stuckTimer    = null;

    /* ── Strings ─────────────────────────────────────────────── */
    var STR = {
        en: {
            app:        'Module Builder',
            credit:     '© 2026 Module Builder | by Husham Jawad Kadhim | {v} | All Rights Reserved',
            version:    'Version {v}',
            newVersion: 'A new version of Module Builder is available',
            update:     'Update now',
            updating:   'Updating…',
            stuck:      'The update did not complete — reload the page manually',
            later:      'Later',
            note:       'Your saved work is not affected.',
            badge:      '⟳ Update',
            badgeTitle: 'Version {v} · Released {d}'
        },
        ar: {
            app:        'باني الوحدات التدريبية',
            credit:     '© 2026 باني الوحدات التدريبية | إعداد هشام جواد كاظم | {v} | جميع الحقوق محفوظة',
            version:    'الإصدار {v}',
            newVersion: 'يتوفر إصدار جديد من باني الوحدات التدريبية',
            update:     'حدّث الآن',
            updating:   'جارٍ التحديث…',
            stuck:      'لم يكتمل التحديث — أعد تحميل الصفحة يدوياً',
            later:      'لاحقاً',
            note:       'لن يتأثر عملك المحفوظ.',
            badge:      '⟳ تحديث',
            badgeTitle: 'الإصدار {v} · تاريخ الإصدار {d}'
        },
        fr: {
            app:        'Constructeur de Modules',
            credit:     '© 2026 Constructeur de Modules | par Husham Jawad Kadhim | {v} | Tous droits réservés',
            version:    'Version {v}',
            newVersion: 'Une nouvelle version du Constructeur de Modules est disponible',
            update:     'Mettre à jour',
            updating:   'Mise à jour…',
            stuck:      "La mise à jour n'a pas abouti — rechargez la page",
            later:      'Plus tard',
            note:       'Votre travail enregistré n\'est pas affecté.',
            badge:      '⟳ Mettre à jour',
            badgeTitle: 'Version {v} · Publiée le {d}'
        }
    };

    function lang() {
        var l = (document.documentElement.getAttribute('lang') || 'en').toLowerCase();
        if (l.indexOf('ar') === 0) return 'ar';
        if (l.indexOf('fr') === 0) return 'fr';
        return 'en';
    }

    function isRtl() { return lang() === 'ar'; }
    function t(key) { return STR[lang()][key] || STR.en[key] || ''; }

    /* ── Version comparison ──────────────────────────────────────
       Semantic, not `!==`. The old file offered an update whenever the
       two strings differed, which also fires on a ROLLBACK: revert a
       bad deploy and every open tab is invited to "update" to the
       older build it is already newer than. Compared part by part,
       2.1.10 is correctly newer than 2.1.9 — which string comparison
       gets backwards. */
    function isNewer(remote, local) {
        var a = String(remote).split('.').map(Number);
        var b = String(local).split('.').map(Number);
        for (var i = 0; i < 3; i++) {
            var x = a[i] || 0, y = b[i] || 0;
            if (x !== y) return x > y;
        }
        return false;
    }

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

        paintBadge();
        if (banner) paintBanner();
    }

    /* ── Toolbar badge ───────────────────────────────────────────
       Built here rather than in index.html so the whole feature stays
       in one file. Two states, and the second is the reason it exists:
       once an update is offered, "Later" has to lead somewhere. A
       dismissed bar that cannot be recalled means the only way back to
       an update the user postponed is to reopen the tool — so the
       badge turns into the button that brings the bar back. */
    function paintBadge() {
        /* The idle badge — a disabled chip reading "v3.1.0" — is gone.
           It occupied a full button's width in a toolbar that had run
           out of room, and it told the user nothing they could act on;
           the version is in the Help tab and in the footer.

           The badge is still built the moment an update IS available,
           because then it is the only way back to a banner the user
           dismissed with "Later". */
        if (!updateReady && !badge) return;

        if (!badge) {
            var bar = document.querySelector('.figma-toolbar');
            if (!bar) return;
            badge = document.createElement('button');
            badge.type = 'button';
            badge.id = BADGE_ID;
            badge.className = 'figma-btn';
            badge.style.cssText = 'margin-inline-start:auto;font-size:.82em;opacity:.75;';
            badge.addEventListener('click', function () {
                if (updateReady) showBanner();
            });
            bar.appendChild(badge);
        }

        badge.dir = isRtl() ? 'rtl' : 'ltr';

        if (updateReady) {
            badge.disabled = false;
            badge.textContent = t('badge');
            badge.title = t('newVersion');
            badge.setAttribute('aria-label', t('newVersion'));
            badge.style.opacity = '1';
            badge.style.fontWeight = '700';
            badge.style.color = '#4f46e5';
        } else if (badge) {
            /* An update that was applied, or a banner shown then
               cancelled: remove the chip rather than parking a dead
               button in the bar. */
            if (badge.parentNode) badge.parentNode.removeChild(badge);
            badge = null;
            return;
        } else {
            badge.disabled = true;
            badge.textContent = loaded ? 'v' + loaded : '';
            badge.title = loaded
                ? t('badgeTitle').replace('{v}', loaded).replace('{d}', built || '—')
                : '';
            badge.setAttribute('aria-label', badge.textContent);
            badge.style.opacity = '.75';
            badge.style.fontWeight = '';
            badge.style.color = '';
        }
    }

    /* ── Update banner ───────────────────────────────────────── */
    function paintBanner() {
        if (!banner) return;
        banner.dir = isRtl() ? 'rtl' : 'ltr';

        var msg = banner.querySelector('.mb-update-text');
        /* The build number is appended outside the translated string:
           it needs no translation, and it turns a vague notice into a
           checkable one. */
        if (msg) msg.textContent = t('newVersion') + (latest ? ' · v' + latest : '');

        banner.querySelector('.mb-update-note').textContent  = t('note');
        banner.querySelector('.mb-update-go').textContent    = userTriggered ? t('updating') : t('update');
        banner.querySelector('.mb-update-later').textContent = t('later');
        banner.querySelector('.mb-update-later').setAttribute('aria-label', t('later'));
    }

    function prefersReducedMotion() {
        return window.matchMedia &&
               window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    function showBanner() {
        if (banner) { banner.classList.add('is-open'); paintBanner(); return; }

        banner = document.createElement('div');
        banner.className = 'mb-update-bar is-open';
        /* 'status' + polite: announced to a screen reader at the next
           pause, never interrupting mid-sentence. An update offer is
           not an alert. */
        banner.setAttribute('role', 'status');
        banner.setAttribute('aria-live', 'polite');
        banner.style.cssText = [
            'position:fixed',
            'left:50%',
            'bottom:18px',
            'transform:translateX(-50%)',
            'z-index:5000',
            'display:flex',
            'align-items:center',
            'gap:14px',
            'max-width:calc(100vw - 24px)',
            'padding:12px 18px',
            'border-radius:14px',
            'background:linear-gradient(135deg,#6366f1,#8b5cf6)',
            'color:#fff',
            'box-shadow:0 10px 32px rgba(15,23,42,.34)',
            'font-family:inherit',
            'font-size:.92em',
            'line-height:1.4'
        ].join(';');

        banner.innerHTML =
            '<span class="mb-update-icon" aria-hidden="true" style="font-size:1.15em;flex-shrink:0;">⬆️</span>' +
            '<span class="mb-update-copy" style="flex:1;min-width:0;display:flex;flex-direction:column;">' +
                '<span class="mb-update-text" style="font-weight:600;"></span>' +
                '<span class="mb-update-note" style="opacity:.85;font-size:.88em;"></span>' +
            '</span>' +
            '<button type="button" class="mb-update-go" style="' +
                'flex-shrink:0;border:none;border-radius:9px;padding:8px 16px;' +
                'background:#fff;color:#4f46e5;font-family:inherit;font-size:.95em;' +
                'font-weight:700;cursor:pointer;"></button>' +
            '<button type="button" class="mb-update-later" style="' +
                'flex-shrink:0;border:none;border-radius:9px;padding:8px 12px;' +
                'background:transparent;color:#e9e6ff;font-family:inherit;' +
                'font-size:.92em;font-weight:600;cursor:pointer;' +
                'text-decoration:underline;"></button>';

        if (!prefersReducedMotion()) banner.style.animation = 'fadeIn .28s ease-out';

        var go    = banner.querySelector('.mb-update-go');
        var later = banner.querySelector('.mb-update-later');

        [go, later].forEach(function (b) {
            b.addEventListener('focus', function () {
                b.style.outline = '3px solid #fde047';
                b.style.outlineOffset = '2px';
            });
            b.addEventListener('blur', function () { b.style.outline = 'none'; });
        });

        go.addEventListener('click', applyUpdate);
        later.addEventListener('click', function () {
            /* Postponed, not cancelled — the offer moves to the badge. */
            hideBanner();
            paintBadge();
        });

        document.body.appendChild(banner);
        paintBanner();

        /* Focus the primary action for keyboard users — but never take
           the caret away from someone in the middle of a sentence. */
        var active = document.activeElement;
        var typing = active && /^(INPUT|TEXTAREA)$/.test(active.tagName);
        if (!typing) go.focus({ preventScroll: true });
    }

    function hideBanner() {
        if (banner) { banner.remove(); banner = null; }
    }

    /* Put the bar back into a usable state after a failed or suppressed
       update, so a stuck switch leaves a button the user can press
       again rather than a permanently disabled one. */
    function restoreBanner(messageKey) {
        userTriggered = false;
        if (!banner) return;
        var go = banner.querySelector('.mb-update-go');
        if (go) {
            go.disabled = false;
            go.style.opacity = '';
            go.style.cursor = 'pointer';
        }
        paintBanner();
        if (messageKey) {
            var msg = banner.querySelector('.mb-update-text');
            if (msg) msg.textContent = t(messageKey);
        }
    }

    /* ── Reload guard ────────────────────────────────────────────
       Counts attempts inside a short window rather than comparing
       version numbers. Comparing versions gets it backwards in both
       directions: after a SUCCESSFUL update the running version has
       changed, so the guard lets another one through; after a FAILED
       one it has not, so the guard blocks the retry the user just
       asked for. Counting has neither failure. An explicit press gets
       a higher allowance than an automatic path, because it is a
       stated intention — but still a hard ceiling, so a broken deploy
       cannot spin a tab forever. */
    function readGuard() {
        try {
            var raw = sessionStorage.getItem(RELOAD_KEY);
            var rec = raw ? JSON.parse(raw) : null;
            if (rec && (Date.now() - rec.ts) < RELOAD_GUARD_MS) return rec;
        } catch (e) { /* sessionStorage unavailable */ }
        return null;
    }

    function canReload(userInitiated) {
        var rec = readGuard();
        if (!rec) return true;
        var limit = userInitiated ? 3 : 1;
        if ((rec.count || 1) >= limit) {
            console.warn('[Version] reload suppressed — ' + rec.count +
                         ' attempts inside the guard window.');
            return false;
        }
        return true;
    }

    function markReloaded() {
        try {
            var rec = readGuard();
            sessionStorage.setItem(RELOAD_KEY, JSON.stringify({
                version: loaded,
                ts:      rec ? rec.ts : Date.now(),   /* window starts at the first try */
                count:   ((rec && rec.count) || 0) + 1
            }));
        } catch (e) { /* ignore */ }
    }

    /* ── Applying the update ─────────────────────────────────────
       This is the half that a service worker would otherwise do, and
       the half a plain location.reload() does NOT do.

       GitHub Pages serves the scripts and stylesheets with an HTTP
       cache lifetime of its own. A reload re-requests index.html, but
       every <script src> inside it can still come from the browser's
       cache, so the page comes back looking updated while running the
       previous build's code — which is precisely the failure the old
       banner produced and the reason it felt untrustworthy.

       fetch(url, { cache: 'reload' }) is the fix: it bypasses the HTTP
       cache AND writes the fresh response into it. Re-fetching every
       same-origin script and stylesheet first means the reload that
       follows is served entirely from freshly downloaded files.

       Cache Storage is cleared too. Nothing writes to it today, but a
       service worker may be added later, and a stale entry left behind
       by an earlier experiment would silently outrank all of this. */
    function applyUpdate() {
        userTriggered = true;

        if (banner) {
            var go = banner.querySelector('.mb-update-go');
            if (go) {
                go.disabled = true;
                go.style.opacity = '.7';
                go.style.cursor = 'default';
            }
            paintBanner();
        }

        if (!canReload(true)) { restoreBanner('stuck'); return; }

        /* If anything below hangs — a dead connection mid-press — the
           bar comes back rather than sitting on "Updating…" forever. */
        clearTimeout(stuckTimer);
        stuckTimer = setTimeout(function () { restoreBanner('stuck'); }, 12000);

        var urls = [];
        document.querySelectorAll('script[src], link[rel="stylesheet"][href]')
            .forEach(function (el) {
                var raw = el.getAttribute('src') || el.getAttribute('href');
                if (!raw) return;
                var u;
                try { u = new URL(raw, location.href); } catch (e) { return; }
                if (u.origin !== location.origin) return;   /* CDN — never ours to bust */
                urls.push(u.href);
            });

        var refetch = Promise.all(urls.map(function (u) {
            return fetch(u, { cache: 'reload' }).catch(function () { /* one miss is not fatal */ });
        }));

        var clearCaches = (window.caches && caches.keys)
            ? caches.keys().then(function (keys) {
                  return Promise.all(keys.map(function (k) { return caches.delete(k); }));
              }).catch(function () {})
            : Promise.resolve();

        Promise.all([refetch, clearCaches]).then(function () {
            clearTimeout(stuckTimer);
            markReloaded();
            location.reload();
        }, function () {
            clearTimeout(stuckTimer);
            markReloaded();
            location.reload();      /* refetch failed — reload anyway */
        });
    }

    /* ── Offering the update ─────────────────────────────────── */
    function onUpdateAvailable(remote) {
        if (updateReady) { showBanner(); return; }     /* no duplicates */
        updateReady = true;
        stopPolling();                                 /* the offer is on screen */
        console.info('[Version] ' + loaded + ' → ' + remote + ' available');
        paintBadge();
        showBanner();
    }

    /* ── Polling ─────────────────────────────────────────────── */
    var warned = false;

    function check() {
        if (updateReady) return;                     /* already offered */
        if (document.hidden) return;                 /* nobody is looking */
        if (navigator.onLine === false) return;      /* nothing to find */

        /* Cache-busted by hand as well as by header: GitHub Pages
           ignores no-store on some edges. */
        fetch(SRC + '?t=' + Date.now(), { cache: 'no-store' })
            .then(function (r) {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            })
            .then(function (data) {
                if (!data || !data.version) throw new Error('no version field');
                var remote = String(data.version);

                if (loaded === null) {      /* first read: this is us */
                    loaded = remote;
                    built  = data.build || null;
                    paint();
                    console.info('[Version] running build ' + loaded +
                                 ' — watching ' + SRC);
                    return;
                }
                if (isNewer(remote, loaded)) {
                    latest = remote;
                    onUpdateAvailable(remote);
                }
            })
            .catch(function (err) {
                /* Silent for the user, loud enough in the console to
                   diagnose: a missing version.json is the single most
                   likely reason the update banner never appears. */
                if (!warned) {
                    warned = true;
                    console.warn('[Version] could not read ' + SRC + ' (' + err.message +
                                 '). The version number and the update banner stay off ' +
                                 'until that file is reachable.');
                }
            });
    }

    function startPolling() {
        if (pollTimer) return;
        setTimeout(check, POLL_FIRST_MS);
        pollTimer = setInterval(check, POLL_EVERY_MS);

        document.addEventListener('visibilitychange', function () {
            if (!document.hidden) check();
        });
        window.addEventListener('focus',  check);
        window.addEventListener('online', check);
    }

    function stopPolling() {
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    }

    function init() {
        paint();
        check();                /* first read establishes `loaded` */
        startPolling();

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
