// ============================================================
// /src/module_library_ui.js
// 📚 Project modules — the side panel listing every module of the open
// project.
//
// Painted from the library's light records (mbLib.heads), never from
// the modules themselves, so drawing a list of 200 modules reads nothing
// from storage. Clicking a module saves the open one and opens it
// (mbSelectModule → mbLibraryOpenModule).
//
// Built in JS rather than in index.html so the feature lives in one
// file; translated through window.i18n and repainted on mb:langchange.
// Logical CSS properties only, so the panel opens on the right in
// English and French and on the left in Arabic without a second rule.
// ============================================================

(function () {
    'use strict';

    var ui = {
        root: null, overlay: null, list: null,
        query: '', filter: 'all', sort: 'order',
        open: false, lastFocus: null
    };

    function t(k, v) { return v ? window.i18n.tf(k, v) : window.i18n.t(k); }
    function esc(s) {
        return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
            return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
        });
    }
    function lang() { return (window.i18n && window.i18n.getLang) ? window.i18n.getLang() : 'en'; }

    /* Sizes in the interface language — "KB" is not a word in Arabic. */
    var UNITS = {
        en: ['B', 'KB', 'MB', 'GB'],
        fr: ['o', 'Ko', 'Mo', 'Go'],
        ar: ['بايت', 'ك.ب', 'م.ب', 'غ.ب']
    };
    function bytes(n) {
        var u = UNITS[lang()] || UNITS.en;
        n = Math.max(0, n || 0);
        var i = 0;
        while (n >= 1024 && i < 3) { n /= 1024; i++; }
        var num = i === 0 ? String(Math.round(n)) : (n < 10 ? n.toFixed(1) : String(Math.round(n)));
        if (lang() === 'fr') num = num.replace('.', ',');
        return num + ' ' + u[i];
    }
    function when(iso) {
        if (!iso) return '';
        var d = new Date(iso);
        if (isNaN(d)) return '';
        var loc = ({ ar: 'ar', fr: 'fr-FR' })[lang()] || 'en-GB';
        try {
            return new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
        } catch (e) { return d.toLocaleString(); }
    }

    /* ── Rows ─────────────────────────────────────────────────── */
    function rows() {
        var out = [];
        (mbState.modulesData || []).forEach(function (m, i) {
            var h = mbLib.heads[m.id] || null;
            var card = (h && h.card) || mbLib.cards[m.id] || {};
            var stats = (h && h.stats) || null;
            if (!stats || m.id === mbLib.openId) {
                /* The open module is measured live: its head may be one
                   keystroke behind. Cheap — one module. */
                var forms = {};
                if (m.id === mbLib.openId) {
                    (m.learningOutcomes || []).forEach(function (lo) {
                        if ((mbState.assessmentFormsData || {})[lo.id]) forms[lo.id] = mbState.assessmentFormsData[lo.id];
                    });
                }
                var live = mbModuleStats(m, forms);
                live.bytes = stats ? stats.bytes : 0;
                stats = live;
            }
            var fromDacum = h ? h.fromDacum : !!(m.taskAnalysisSource || m.moduleCode || m.source === 'dacum');
            out.push({
                id: m.id,
                order: i,
                code: m.moduleCode || m.moduleNumber || '',
                title: mbPlainText(m.title) || t('mbUntitled'),
                shortName: m.shortName || '',
                author: card.author || card.createdBy || '',
                savedAt: card.savedAt || '',
                stats: stats,
                fromDacum: fromDacum,
                isOpen: m.id === mbLib.openId
            });
        });
        return out;
    }

    function norm(s) {
        return String(s || '').toLowerCase()
            .replace(/[ً-ٰٟ]/g, '')      // Arabic diacritics
            .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
            .normalize('NFD').replace(/[̀-ͯ]/g, '');   // French accents
    }

    function visible(all) {
        var q = norm(ui.query.trim());
        var list = all.filter(function (r) {
            if (ui.filter === 'skeleton' && !r.stats.skeleton) return false;
            if (ui.filter === 'progress' && (r.stats.skeleton || r.stats.completion >= 100)) return false;
            if (ui.filter === 'done' && !(r.stats.completion >= 100)) return false;
            if (!q) return true;
            return norm(r.code + ' ' + r.title + ' ' + r.shortName + ' ' + r.author).indexOf(q) !== -1;
        });
        var coll = new Intl.Collator(lang(), { numeric: true, sensitivity: 'base' });
        if (ui.sort === 'code') list.sort(function (a, b) { return coll.compare(a.code || a.title, b.code || b.title); });
        else if (ui.sort === 'title') list.sort(function (a, b) { return coll.compare(a.title, b.title); });
        else if (ui.sort === 'recent') list.sort(function (a, b) { return String(b.savedAt).localeCompare(String(a.savedAt)); });
        else list.sort(function (a, b) { return a.order - b.order; });
        return list;
    }

    function rowHtml(r) {
        var s = r.stats;
        var status;
        if (s.skeleton) {
            status = '<span class="mb-lib-badge">' + esc(t(r.fromDacum ? 'mbLibSkeletonDacum' : 'mbLibEmpty')) + '</span>';
        } else {
            status = '<span class="mb-lib-prog" title="' + esc(t('mbLibProgressTitle', { v0: s.done, v1: s.total })) + '">' +
                '<span class="mb-lib-bar"><i style="width:' + Math.min(100, s.completion) + '%"></i></span>' +
                '<span class="mb-lib-pct"><bdi>' + s.completion + '%</bdi></span></span>';
        }
        var meta = [];
        if (r.author) meta.push('<span>✍️ <bdi>' + esc(r.author) + '</bdi></span>');
        if (r.savedAt) meta.push('<span>🕒 ' + esc(when(r.savedAt)) + '</span>');
        if (s.bytes) meta.push('<span>💾 <bdi>' + esc(bytes(s.bytes)) + '</bdi></span>');
        return '<li><button type="button" class="mb-lib-item' + (r.isOpen ? ' is-open' : '') + '" data-mid="' + esc(r.id) + '"' +
            (r.isOpen ? ' aria-current="true"' : '') + '>' +
            '<span class="mb-lib-line1">' +
                (r.code ? '<span class="mb-lib-code"><bdi>' + esc(r.code) + '</bdi></span>' : '') +
                '<span class="mb-lib-name">' + esc(r.title) + '</span>' +
                (r.isOpen ? '<span class="mb-lib-here">' + esc(t('mbLibCurrent')) + '</span>' : '') +
            '</span>' +
            (meta.length ? '<span class="mb-lib-meta">' + meta.join('') + '</span>' : '') +
            '<span class="mb-lib-line3">' + status + '</span>' +
            '</button></li>';
    }

    /* ── Painting ─────────────────────────────────────────────── */
    function paintList() {
        if (!ui.root) return;
        var all = rows();
        var shown = visible(all);
        ui.list.innerHTML = shown.length ? shown.map(rowHtml).join('')
            : '<li class="mb-lib-none">' + esc(t('mbLibNoMatch')) + '</li>';
        ui.root.querySelector('.mb-lib-count').textContent = t('mbLibCount', { v0: shown.length, v1: all.length });
        var btn = document.querySelectorAll('.mb-lib-open-count');
        btn.forEach(function (b) { b.textContent = all.length ? ' (' + all.length + ')' : ''; });
    }

    function paintProjects() {
        if (!ui.root || !mbLib.enabled) return;
        var sel = ui.root.querySelector('#mb-lib-project-sel');
        mbLibraryListProjects().then(function (list) {
            var cur = mbLib.project && mbLib.project.id;
            sel.innerHTML = list.map(function (p) {
                var n = (p.moduleOrder || []).length;
                return '<option value="' + esc(p.id) + '"' + (p.id === cur ? ' selected' : '') + '>' +
                    esc(p.name || t('mbLibNewProjectDefault')) + ' — ' + esc(t('mbLibModulesN', { v0: n })) + '</option>';
            }).join('');
        });
    }

    function paintAuthor() {
        if (!ui.root) return;
        var name = mbAuthorName();
        ui.root.querySelector('.mb-lib-author-name').innerHTML = name
            ? '<bdi>' + esc(name) + '</bdi>'
            : '<em>' + esc(t('mbLibAuthorNone')) + '</em>';
    }

    function paintStorage() {
        if (!ui.root) return;
        var box = ui.root.querySelector('.mb-lib-storage');
        var text = box.querySelector('.mb-lib-st-text');
        var bar = box.querySelector('.mb-lib-st-bar i');
        var prot = box.querySelector('.mb-lib-st-prot');
        var btn = box.querySelector('.mb-lib-st-btn');
        mbStorageEstimate().then(function (e) {
            if (!e.exact || !e.quota) {
                text.textContent = t('mbLibStorageUnknown');
                bar.style.width = '0';
                return;
            }
            var pct = Math.min(100, e.usage * 100 / e.quota);
            bar.style.width = Math.max(pct, 0.5) + '%';
            box.classList.toggle('is-high', pct > 80);
            text.textContent = t('mbLibStorageUsed', { v0: bytes(e.usage), v1: bytes(e.quota) });
        });
        var has = navigator.storage && navigator.storage.persisted;
        if (!has) { prot.textContent = ''; btn.hidden = true; return; }
        navigator.storage.persisted().then(function (yes) {
            prot.textContent = t(yes ? 'mbLibStoragePersisted' : 'mbLibStorageNotPersisted');
            prot.classList.toggle('is-ok', !!yes);
            btn.hidden = !!yes;
        }).catch(function () { btn.hidden = true; });
    }

    function paintStatic() {
        if (!ui.root) return;
        ui.root.querySelectorAll('[data-lib-t]').forEach(function (el) {
            el.textContent = t(el.getAttribute('data-lib-t'));
        });
        ui.root.querySelectorAll('[data-lib-ph]').forEach(function (el) {
            el.setAttribute('placeholder', t(el.getAttribute('data-lib-ph')));
        });
        ui.root.querySelectorAll('[data-lib-aria]').forEach(function (el) {
            var s = t(el.getAttribute('data-lib-aria'));
            el.setAttribute('aria-label', s);
            el.setAttribute('title', s);
        });
        ui.root.querySelector('.mb-lib-project').hidden = !mbLib.enabled;
    }

    function paintAll() {
        if (!ui.root || !ui.open) return;
        paintStatic();
        paintProjects();
        paintAuthor();
        paintStorage();
        paintList();
    }

    /* ── Build ────────────────────────────────────────────────── */
    function build() {
        if (ui.root) return;
        ui.overlay = document.createElement('div');
        ui.overlay.className = 'mb-lib-overlay';
        ui.overlay.hidden = true;
        ui.overlay.addEventListener('click', close);

        var root = document.createElement('aside');
        root.id = 'mb-lib-panel';
        root.className = 'mb-lib-panel';
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-labelledby', 'mb-lib-title');
        root.hidden = true;
        root.innerHTML =
            '<div class="mb-lib-head">' +
                '<h2 id="mb-lib-title" data-lib-t="mbLibTitle"></h2>' +
                '<button type="button" class="mb-lib-x" data-lib-aria="mbLibClose">✕</button>' +
            '</div>' +
            '<div class="mb-lib-body">' +
                '<section class="mb-lib-project">' +
                    '<label for="mb-lib-project-sel" data-lib-t="mbLibProject"></label>' +
                    '<select id="mb-lib-project-sel"></select>' +
                    '<div class="mb-lib-btns">' +
                        '<button type="button" class="mb-lib-btn" data-lib-do="newProject" data-lib-t="mbLibNewProject"></button>' +
                        '<button type="button" class="mb-lib-btn" data-lib-do="renameProject" data-lib-t="mbLibRenameProject"></button>' +
                        '<button type="button" class="mb-lib-btn danger" data-lib-do="deleteProject" data-lib-t="mbLibDeleteProject"></button>' +
                    '</div>' +
                '</section>' +
                '<div class="mb-lib-author">' +
                    '<span>✍️ <span data-lib-t="mbLibAuthor"></span> <span class="mb-lib-author-name"></span></span>' +
                    '<button type="button" class="mb-lib-link" data-lib-do="author" data-lib-t="mbLibAuthorChange"></button>' +
                '</div>' +
                '<div class="mb-lib-storage">' +
                    '<div class="mb-lib-st-bar"><i></i></div>' +
                    '<div class="mb-lib-st-text"></div>' +
                    '<div class="mb-lib-st-row"><span class="mb-lib-st-prot"></span>' +
                    '<button type="button" class="mb-lib-link mb-lib-st-btn" data-lib-do="persist" data-lib-t="mbLibStoragePersistBtn" hidden></button></div>' +
                '</div>' +
                '<div class="mb-lib-tools">' +
                    '<input type="search" class="mb-lib-search" data-lib-ph="mbLibSearch" data-lib-aria="mbLibSearch" autocomplete="off">' +
                    '<div class="mb-lib-filters" role="group">' +
                        '<button type="button" data-filter="all" data-lib-t="mbLibFilterAll"></button>' +
                        '<button type="button" data-filter="skeleton" data-lib-t="mbLibFilterSkeleton"></button>' +
                        '<button type="button" data-filter="progress" data-lib-t="mbLibFilterProgress"></button>' +
                        '<button type="button" data-filter="done" data-lib-t="mbLibFilterDone"></button>' +
                    '</div>' +
                    '<label class="mb-lib-sort"><span data-lib-t="mbLibSort"></span> ' +
                    '<select>' +
                        '<option value="order" data-lib-t="mbLibSortOrder"></option>' +
                        '<option value="code" data-lib-t="mbLibSortCode"></option>' +
                        '<option value="recent" data-lib-t="mbLibSortRecent"></option>' +
                        '<option value="title" data-lib-t="mbLibSortTitle"></option>' +
                    '</select></label>' +
                '</div>' +
                '<div class="mb-lib-count" aria-live="polite"></div>' +
                '<ul class="mb-lib-list"></ul>' +
            '</div>' +
            '<div class="mb-lib-foot">' +
                '<div class="mb-lib-pkg">' +
                    '<button type="button" class="mb-lib-btn" data-lib-do="importPkg" data-lib-t="mbLibImportBtn"></button>' +
                    '<button type="button" class="mb-lib-btn" data-lib-do="exportAll" data-lib-t="mbLibExportAllBtn"></button>' +
                '</div>' +
                '<button type="button" class="mb-lib-btn primary" data-lib-do="addModule" data-lib-t="mbAddModule"></button>' +
            '</div>';

        document.body.appendChild(ui.overlay);
        document.body.appendChild(root);
        ui.root = root;
        ui.list = root.querySelector('.mb-lib-list');

        root.querySelector('.mb-lib-x').addEventListener('click', close);
        root.querySelector('.mb-lib-search').addEventListener('input', function (e) { ui.query = e.target.value; paintList(); });
        root.querySelector('.mb-lib-sort select').addEventListener('change', function (e) { ui.sort = e.target.value; paintList(); });
        root.querySelector('.mb-lib-filters').addEventListener('click', function (e) {
            var b = e.target.closest('[data-filter]');
            if (!b) return;
            ui.filter = b.getAttribute('data-filter');
            syncFilters();
            paintList();
        });
        root.querySelector('#mb-lib-project-sel').addEventListener('change', function (e) {
            var pid = e.target.value;
            if (!pid || (mbLib.project && pid === mbLib.project.id)) return;
            mbLibraryOpenProject(pid).then(function () {
                showStatus(t('mbLibProjectOpened', { v0: mbLib.project.name }), 'success');
            });
        });
        ui.list.addEventListener('click', function (e) {
            var b = e.target.closest('.mb-lib-item');
            if (!b) return;
            var mid = b.getAttribute('data-mid');
            if (mid === mbLib.openId) { close(); return; }
            b.classList.add('is-loading');
            mbSelectModule(mid).then(function () {
                /* On a phone the panel covers the module: get out of the way. */
                if (window.matchMedia('(max-width: 720px)').matches) close();
            });
        });
        root.addEventListener('click', function (e) {
            var b = e.target.closest('[data-lib-do]');
            if (b) act(b.getAttribute('data-lib-do'));
        });
        root.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') { e.stopPropagation(); close(); }
        });
        syncFilters();
    }

    function syncFilters() {
        ui.root.querySelectorAll('[data-filter]').forEach(function (b) {
            var on = b.getAttribute('data-filter') === ui.filter;
            b.classList.toggle('is-on', on);
            b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        var s = ui.root.querySelector('.mb-lib-sort select');
        if (s) s.value = ui.sort;
    }

    /* ── Actions ──────────────────────────────────────────────── */
    function act(what) {
        if (what === 'author') {
            mbLibraryAskAuthor(true).then(paintAuthor);
        } else if (what === 'persist') {
            if (navigator.storage && navigator.storage.persist) {
                navigator.storage.persist().then(function (ok) {
                    if (!ok) showStatus(t('mbLibStoragePersistDenied'), 'error');
                    paintStorage();
                });
            }
        } else if (what === 'importPkg') {
            var inp = document.getElementById('load-file-input');
            if (inp) inp.click();
        } else if (what === 'exportAll') {
            close();
            mbExportAllPackages();
        } else if (what === 'addModule') {
            Promise.resolve(addNewModule()).then(paintList);
        } else if (what === 'newProject') {
            mbPrompt(t('mbLibNewProjectName'), t('mbLibNewProjectDefault')).then(function (name) {
                if (name === null || name === undefined) return;
                return mbLibraryCreateProject(String(name).trim()).then(function (meta) {
                    showStatus(t('mbLibProjectCreated', { v0: meta.name }), 'success');
                });
            });
        } else if (what === 'renameProject') {
            if (!mbLib.project) return;
            mbPrompt(t('mbLibRenamePrompt'), mbLib.project.name || '').then(function (name) {
                if (name) mbLibraryRenameProject(name);
            });
        } else if (what === 'deleteProject') {
            if (!mbLib.project) return;
            var p = mbLib.project;
            mbConfirm(t('mbLibDeleteProjectConfirm', { v0: p.name || '', v1: (mbState.modulesData || []).length }), { danger: true })
                .then(function (yes) {
                    if (!yes) return;
                    return mbLibraryDeleteProject(p.id).then(function () {
                        showStatus(t('mbLibProjectDeleted'), 'success');
                    });
                });
        }
    }

    /* ── Open / close ─────────────────────────────────────────── */
    function open() {
        build();
        ui.open = true;
        ui.lastFocus = document.activeElement;
        ui.overlay.hidden = false;
        ui.root.hidden = false;
        document.body.classList.add('mb-lib-is-open');
        /* Fresh figures for the open module before the list is drawn. */
        Promise.resolve(typeof mbLibrarySave === 'function' ? mbLibrarySave() : null).then(paintAll);
        paintAll();
        setTimeout(function () {
            var s = ui.root.querySelector('.mb-lib-search');
            /* No keyboard pop-up on a phone just for opening the list. */
            if (s && !window.matchMedia('(pointer: coarse)').matches) s.focus();
        }, 50);
    }
    function close() {
        if (!ui.root || !ui.open) return;
        ui.open = false;
        ui.root.hidden = true;
        ui.overlay.hidden = true;
        document.body.classList.remove('mb-lib-is-open');
        if (ui.lastFocus && ui.lastFocus.focus) { try { ui.lastFocus.focus(); } catch (e) {} }
    }

    window.mbLibraryTogglePanel = function () { if (ui.open) close(); else open(); };
    window.mbLibraryOpenPanel = open;
    window.mbLibraryClosePanel = close;

    window.addEventListener('mb:librarychanged', function () {
        if (ui.open) { paintProjects(); paintList(); paintStorage(); }
        else paintCountOnly();
    });
    window.addEventListener('mb:langchange', function () { if (ui.open) paintAll(); paintCountOnly(); });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && ui.open) close();
    });

    function paintCountOnly() {
        var n = (mbState.modulesData || []).length;
        document.querySelectorAll('.mb-lib-open-count').forEach(function (b) { b.textContent = n ? ' (' + n + ')' : ''; });
    }

    /* Ask once for durable storage. Chrome and Edge decide silently;
       Firefox would show a permission prompt at boot, so there it waits
       for the button in the panel. */
    window.addEventListener('mb:libraryready', function () {
        paintCountOnly();
        if (!mbLib.enabled || !navigator.storage || !navigator.storage.persist) return;
        if (/firefox/i.test(navigator.userAgent)) return;
        navigator.storage.persisted().then(function (yes) {
            if (!yes) return navigator.storage.persist();
        }).catch(function () {});
    });
})();
