// ============================================================
// sw.js — Module Builder service worker (3.13.0; list updated in 3.14.0 and 3.15.0)
//
// Makes the tool work offline once it has been opened online.
//
// STRATEGY (the same as DACUM Live Pro's):
//   • HTML, JS, CSS, JSON from this site → network first, cache as
//     fallback. Online, a new release is picked up on the next load
//     with no special step; offline, the last copy is served.
//   • Everything else from this site (fonts, images) → cache first,
//     refreshed in the background.
//   • Other sites (the AI backend) → not touched at all.
//
// The cache key is the URL WITHOUT its query string, so the ?v=3.13.0 on
// every <script> tag and the ?t=… version.js adds to version.json all
// land on one entry.
//
// version.js clears every cache when the user accepts an update. The
// page then asks this worker to re-precache (message PRECACHE, sent by
// src/sw_register.js after load), so the offline copy is complete again
// without waiting for each file to be requested.
//
// RELEASE CHECKLIST: bump CACHE_VERSION with every release, and keep
// PRECACHE_URLS in step with the <script>/<link> tags of index.html (the
// Playwright suite checks that every tag is listed here).
// ============================================================

const CACHE_VERSION = 'mb-3.19.0';
const CACHE_NAME    = 'module-builder-' + CACHE_VERSION;
const BASE          = self.registration ? self.registration.scope : '/';
const OFFLINE_URL   = BASE + 'index.html';
const NETWORK_FIRST_EXT = /\.(html|js|css|json)$/i;

const PRECACHE_URLS = [
  BASE,
  BASE + 'index.html',
  BASE + 'mb-styles.css',
  BASE + 'error-handler2.js',
  BASE + 'version.js',
  BASE + 'version.json',
  BASE + 'module-builder-guide.html',
  BASE + 'qr-code_Module_Builder.png',

  // ── Third-party libraries, self-hosted (vendor/README.md) ──
  BASE + 'vendor/docx-7.8.2/index.js',
  BASE + 'vendor/jspdf-2.5.1/jspdf.umd.min.js',
  BASE + 'vendor/fflate-0.8.3/fflate.umd.js',
  // Loaded on first PPTX export, precached so that export works offline.
  BASE + 'vendor/pptxgenjs-3.12.0/pptxgen.bundle.js',

  // ── Fonts used by the interface and the Arabic PDF ──────
  BASE + 'fonts/Cairo.woff2',
  BASE + 'fonts/Cairo-Regular.ttf',

  // ── Every script index.html loads, in its order ─────────
  BASE + 'src/persistence.js',
  BASE + 'src/project_store.js',
  BASE + 'src/image_store.js',
  BASE + 'src/mb-translations.js',
  BASE + 'src/mb_state.js',
  BASE + 'src/bilang.js',
  BASE + 'src/dacum_i18n.js',
  BASE + 'src/uid.js',
  BASE + 'src/image_prep.js',
  BASE + 'src/image_paste.js',
  BASE + 'src/dialog.js',
  BASE + 'src/docx_bidi.js',
  BASE + 'src/ui.js',
  BASE + 'src/tabs.js',
  BASE + 'src/covers.js',
  BASE + 'src/cover_images.js',
  BASE + 'src/workteam.js',
  BASE + 'src/modules.js',
  BASE + 'src/outcomes.js',
  BASE + 'src/blocks.js',
  BASE + 'src/learning_guide.js',
  BASE + 'src/sheets.js',
  BASE + 'src/content.js',
  BASE + 'src/criteria.js',
  BASE + 'src/assessment.js',
  BASE + 'src/module-ai.js',
  BASE + 'src/ta_finder.js',
  BASE + 'src/references.js',
  BASE + 'src/resources.js',
  BASE + 'src/marks.js',
  BASE + 'src/steps.js',
  BASE + 'src/storage.js',
  BASE + 'src/module_card.js',
  BASE + 'src/module_library.js',
  BASE + 'src/tab_guard.js',
  BASE + 'src/package_mbz.js',
  BASE + 'src/package_ui.js',
  BASE + 'src/package_preview.js',
  BASE + 'src/folder_sync.js',
  BASE + 'src/module_library_ui.js',
  BASE + 'src/module_model.js',
  BASE + 'src/exports_html.js',
  BASE + 'src/font_cairo.js',
  BASE + 'src/arabic-font.js',
  BASE + 'src/pdf_arabic.js',
  BASE + 'src/exports_pdf.js',
  BASE + 'src/link_modal.js',
  BASE + 'src/export_menu.js',
  BASE + 'src/shortcuts.js',
  BASE + 'src/exports_pptx.js',
  BASE + 'src/word_settings.js',
  BASE + 'src/export_ui.js',
  BASE + 'src/exports_docx.js',
  BASE + 'src/contentlang_ui.js',
  BASE + 'src/events.js',
  BASE + 'src/toolbar_fit.js',
  BASE + 'src/sw_register.js',
  BASE + 'src/app.js',
  BASE + 'src/autosave.js'
  // Not precached, cached on first use instead: the Arial and Calibri
  // PDF fonts (src/font_arial.js, src/font_calibri.js, fonts/*.ttf —
  // about 6 MB together, needed only for a PDF in one of those faces).
];

function precache() {
  return caches.open(CACHE_NAME).then(function (cache) {
    return Promise.allSettled(PRECACHE_URLS.map(function (url) {
      return cache.match(url).then(function (hit) {
        if (hit) return null;
        return fetch(url, { cache: 'no-store' }).then(function (res) {
          if (res && res.status === 200) return cache.put(url, res);
        });
      }).catch(function (err) { console.warn('[SW] precache skipped:', url, err && err.message); });
    }));
  });
}

self.addEventListener('install', function (event) {
  self.skipWaiting();
  event.waitUntil(precache());
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys
        .filter(function (k) { return k.indexOf('module-builder-') === 0 && k !== CACHE_NAME; })
        .map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('message', function (event) {
  var d = event.data || {};
  if (d.type === 'PRECACHE') event.waitUntil(precache());
  if (d.type === 'GET_VERSION' && event.source) event.source.postMessage({ type: 'VERSION_REPLY', version: CACHE_VERSION });
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;          // AI backend etc.: untouched
  if (url.pathname.indexOf(new URL(BASE).pathname) !== 0) return;
  if (req.mode === 'navigate' || NETWORK_FIRST_EXT.test(url.pathname)) {
    event.respondWith(networkFirst(req));
  } else {
    event.respondWith(cacheFirst(req));
  }
});

function canonical(req) {
  var u = new URL(req.url);
  u.search = '';
  u.hash = '';
  return u.href;
}

async function networkFirst(request) {
  var key = canonical(request);
  try {
    var res = await fetch(key, { cache: 'no-cache' });
    if (res && res.status === 200 && res.type === 'basic') {
      var cache = await caches.open(CACHE_NAME);
      cache.put(key, res.clone());
    }
    return res;
  } catch (_) {
    var cached = await caches.match(key);
    if (cached) return cached;
    if (request.mode === 'navigate') {
      var page = await caches.match(OFFLINE_URL) || await caches.match(BASE);
      if (page) return page;
    }
    return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}

async function cacheFirst(request) {
  var key = canonical(request);
  var cached = await caches.match(key);
  if (cached) {
    fetch(key).then(function (res) {
      if (res && res.status === 200 && res.type === 'basic') {
        caches.open(CACHE_NAME).then(function (c) { c.put(key, res); });
      }
    }).catch(function () {});
    return cached;
  }
  try {
    var res = await fetch(request);
    if (res && res.status === 200 && res.type === 'basic') {
      var cache = await caches.open(CACHE_NAME);
      cache.put(key, res.clone());
    }
    return res;
  } catch (_) {
    return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}
