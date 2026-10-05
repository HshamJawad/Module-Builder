// ============================================================
// /src/module_library_ui.js
// 📚 The library panel: the modules of the open project, and the list
// of projects (3.14.0).
//
//   Modules   every module of the open project — code, title, author,
//             last change, size, completion, "structure only", and
//             "not saved to a file since its last change". Search,
//             filters, sort. Clicking a module saves the open one and
//             opens it (mbSelectModule → mbLibraryOpenModule).
//   Projects  every project in this browser, like DACUM Live Pro's
//             sidebar: open, rename, export as one package, delete; a
//             project being edited in another tab says so.
//
// Painted from the library's light records (heads and project records),
// never from the modules themselves, so drawing a list of 200 modules
// reads nothing heavy from storage.
//
// Built in JS so the feature lives in one file; translated through
// window.i18n and repainted on mb:langchange. Logical CSS properties
// only: the panel opens on the right in English and French and on the
// left in Arabic without a second rule.
// ============================================================

(function () {
    'use strict';

    var ui = {
        root: null, overlay: null, list: null, plist: null,
        view: 'modules',
        query: '', filter: 'all', sort: 'order', pquery: '',
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

    /* ══════════════════════════════════════════════════════════
       MODULES
       ══════════════════════════════════════════════════════════ */
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
                needsBackup: h ? mbModuleNeedsBackup(h) : false,
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
            if (ui.filter === 'backup' && !r.needsBackup) return false;
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
        if (r.needsBackup) meta.push('<span class="mb-lib-warn" title="' + esc(t('mbLibNotBackedUpTip')) + '">⚠️ ' + esc(t('mbLibNotBackedUp')) + '</span>');
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

    function paintList() {
        if (!ui.root) return;
        var all = rows();
        var shown = visible(all);
        ui.list.innerHTML = shown.length ? shown.map(rowHtml).join('')
            : '<li class="mb-lib-none">' + esc(t('mbLibNoMatch')) + '</li>';
        ui.root.querySelector('.mb-lib-count').textContent = t('mbLibCount', { v0: shown.length, v1: all.length });
        var nb = all.filter(function (r) { return r.needsBackup; }).length;
        var chip = ui.root.querySelector('[data-filter="backup"]');
        if (chip) chip.textContent = t('mbLibFilterBackup') + (nb ? ' (' + nb + ')' : '');
        paintCountOnly();
    }

    function paintProjectLine() {
        if (!ui.root) return;
        var el = ui.root.querySelector('.mb-lib-pline');
        var p = mbLib.project || {};
        el.innerHTML = '<span class="mb-lib-pname">🗂 <bdi>' + esc(p.name || t('mbLibNewProjectDefault')) + '</bdi></span>' +
            (mbLib.readOnly ? '<span class="mb-lib-ro">🔒 ' + esc(t('mbTabReadOnlyShort')) + '</span>' : '') +
            (mbLib.enabled ? '<button type="button" class="mb-lib-link" data-lib-do="toProjects">' + esc(t('mbLibChangeProject')) + '</button>' : '');
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

    /* ── 📁 Folder (folder_sync.js) ─────────────────────────────── */
    function paintFolder() {
        if (!ui.root) return;
        var box = ui.root.querySelector('.mb-lib-folder');
        if (!mbLib.enabled || typeof mbFolderSync === 'undefined') { box.hidden = true; return; }
        box.hidden = false;
        if (!mbFolderSync.supported) {
            box.innerHTML = '<div class="mb-fld-note">📁 ' + esc(t('mbFldUnsupported')) + '</div>';
            return;
        }
        var s = mbFolderSync.state();
        if (!s.linked) {
            box.innerHTML = '<div class="mb-fld-text">📁 ' + esc(t('mbFldIntro')) + '</div>' +
                '<div class="mb-lib-btns"><button type="button" class="mb-lib-btn" data-lib-do="fldLink">' + esc(t('mbFldChoose')) + '</button></div>';
            return;
        }
        var status, cls = '';
        if (s.perm !== 'granted') {
            status = '⚠️ ' + esc(t('mbFldNeedsPermission')) + ' <button type="button" class="mb-lib-link" data-lib-do="fldAllow">' + esc(t('mbFldAllow')) + '</button>';
            cls = 'is-warn';
        } else if (s.error) {
            status = '⚠️ ' + esc(t('mbFldError', { v0: s.error })) + ' <button type="button" class="mb-lib-link" data-lib-do="fldRetry">' + esc(t('mbFldRetry')) + '</button>';
            cls = 'is-warn';
        } else if (s.busy || s.pending) {
            status = '⏳ ' + esc(t('mbFldWriting', { v0: s.pending + (s.busy ? 1 : 0) })) + (s.writing ? ' <bdi>' + esc(s.writing) + '</bdi>' : '');
        } else {
            status = '✓ ' + esc(t('mbFldUpToDate', { v0: s.files })) + (s.lastAt ? ' · 🕒 ' + esc(when(s.lastAt)) : '');
            cls = 'is-ok';
        }
        box.innerHTML = '<div class="mb-fld-text">📁 <strong><bdi>' + esc(s.name) + '</bdi></strong></div>' +
            '<div class="mb-fld-status ' + cls + '">' + status + '</div>' +
            '<div class="mb-lib-btns">' +
                '<button type="button" class="mb-lib-btn" data-lib-do="fldWriteAll">' + esc(t('mbFldWriteAll')) + '</button>' +
                '<button type="button" class="mb-lib-btn" data-lib-do="fldImport">' + esc(t('mbFldImport')) + '</button>' +
                '<button type="button" class="mb-lib-btn danger" data-lib-do="fldUnlink">' + esc(t('mbFldUnlink')) + '</button>' +
            '</div>';
    }
    window.addEventListener('mb:folderchanged', function () { if (ui.open) paintFolder(); });

    /* ══════════════════════════════════════════════════════════
       PROJECTS
       ══════════════════════════════════════════════════════════ */
    function paintProjects() {
        if (!ui.root || ui.view !== 'projects' || !mbLib.enabled) return;
        Promise.all([mbLibraryListProjects(), mbTabGuard.heldIds()]).then(function (r) {
            var list = r[0], held = r[1];
            var mine = mbTabGuard.heldPid();
            var cur = mbLib.project && mbLib.project.id;
            var q = norm(ui.pquery.trim());
            var shown = list.filter(function (p) {
                return !q || norm((p.name || '') + ' ' + (p.programName || '') + ' ' + (p.occupation || '')).indexOf(q) !== -1;
            });
            ui.plist.innerHTML = shown.length ? shown.map(function (p) {
                var n = (p.moduleOrder || []).length;
                var busy = held.indexOf(p.id) !== -1 && p.id !== mine;
                var sub = [p.programName && p.programName !== p.name ? p.programName : '', p.occupation].filter(Boolean)
                    .filter(function (x, i, a) { return a.indexOf(x) === i; }).join(' · ');
                return '<li class="mb-prj' + (p.id === cur ? ' is-open' : '') + '" data-pid="' + esc(p.id) + '">' +
                    '<button type="button" class="mb-prj-main" data-pact="open">' +
                        '<span class="mb-prj-name"><bdi>' + esc(p.name || t('mbLibNewProjectDefault')) + '</bdi></span>' +
                        (sub ? '<span class="mb-prj-sub"><bdi>' + esc(sub) + '</bdi></span>' : '') +
                        '<span class="mb-prj-meta"><span>📦 ' + esc(t('mbLibModulesN', { v0: n })) + '</span>' +
                        (p.updatedAt ? '<span>🕒 ' + esc(when(new Date(p.updatedAt).toISOString())) + '</span>' : '') + '</span>' +
                        '<span class="mb-prj-tags">' +
                            (p.id === cur ? '<span class="mb-prj-tag is-here">' + esc(t('mbLibCurrent')) + '</span>' : '') +
                            (busy ? '<span class="mb-prj-tag is-busy">🔒 ' + esc(t('mbPrjBusy')) + '</span>' : '') +
                        '</span>' +
                    '</button>' +
                    '<div class="mb-prj-acts">' +
                        '<button type="button" class="mb-lib-btn" data-pact="rename" title="' + esc(t('mbLibRenameProject')) + '">✏️</button>' +
                        '<button type="button" class="mb-lib-btn" data-pact="export" title="' + esc(t('mbPrgPkgBtn')) + '">🗂</button>' +
                        '<button type="button" class="mb-lib-btn danger" data-pact="delete" title="' + esc(t('mbLibDeleteProject')) + '"' + (busy ? ' disabled' : '') + '>🗑️</button>' +
                    '</div>' +
                '</li>';
            }).join('') : '<li class="mb-lib-none">' + esc(t('mbLibNoMatch')) + '</li>';
            ui.root.querySelector('.mb-prj-count').textContent = t('mbPrjCount', { v0: shown.length, v1: list.length });
        });
    }

    function projectAction(act, pid) {
        if (act === 'open') {
            if (mbLib.project && pid === mbLib.project.id) { setView('modules'); return; }
            mbLibraryOpenProject(pid).then(function () {
                showStatus(t('mbLibProjectOpened', { v0: mbLib.project.name }), 'success');
                setView('modules');
            });
        } else if (act === 'rename') {
            mbStore.getProject(pid).then(function (p) {
                if (!p) return;
                mbPrompt(t('mbLibRenamePrompt'), p.name || '').then(function (name) {
                    name = String(name || '').trim();
                    if (!name) return;
                    if (mbLib.project && pid === mbLib.project.id) return mbLibraryRenameProject(name).then(paintProjects);
                    p.name = name;
                    return mbStore.putProject(p).then(function () {
                        mbTabGuard.post({ type: 'projects' });
                        paintProjects();
                    });
                });
            });
        } else if (act === 'export') {
            close();
            mbExportProgrammePackage(pid);
        } else if (act === 'delete') {
            mbStore.getProject(pid).then(function (p) {
                if (!p) return;
                return mbConfirm(t('mbLibDeleteProjectConfirm', { v0: p.name || '', v1: (p.moduleOrder || []).length }), { danger: true })
                    .then(function (yes) {
                        if (!yes) return;
                        return mbLibraryDeleteProject(pid).then(function (ok) {
                            if (ok !== false) showStatus(t('mbLibProjectDeleted'), 'success');
                            paintProjects();
                        });
                    });
            });
        }
    }

    /* ══════════════════════════════════════════════════════════
       PANEL
       ══════════════════════════════════════════════════════════ */
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
        ui.root.querySelector('.mb-lib-views').hidden = !mbLib.enabled;
    }

    function setView(v) {
        ui.view = v === 'projects' && mbLib.enabled ? 'projects' : 'modules';
        if (!ui.root) return;
        ui.root.querySelectorAll('[data-view]').forEach(function (b) {
            var on = b.getAttribute('data-view') === ui.view;
            b.classList.toggle('is-on', on);
            b.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        ui.root.querySelector('.mb-lib-vmod').hidden = ui.view !== 'modules';
        ui.root.querySelector('.mb-lib-vprj').hidden = ui.view !== 'projects';
        ui.root.querySelector('.mb-lib-foot').hidden = ui.view !== 'modules';
        if (ui.view === 'projects') paintProjects();
        else paintList();
    }

    function paintAll() {
        if (!ui.root || !ui.open) return;
        paintStatic();
        paintProjectLine();
        paintAuthor();
        paintStorage();
        paintFolder();
        setView(ui.view);
    }

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
            '<div class="mb-lib-views" role="tablist">' +
                '<button type="button" role="tab" data-view="modules" data-lib-t="mbLibViewModules"></button>' +
                '<button type="button" role="tab" data-view="projects" data-lib-t="mbLibViewProjects"></button>' +
            '</div>' +
            '<div class="mb-lib-body">' +
                /* ── Modules view ── */
                '<div class="mb-lib-vmod">' +
                    '<div class="mb-lib-pline"></div>' +
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
                    '<div class="mb-lib-folder"></div>' +
                    '<div class="mb-lib-tools">' +
                        '<input type="search" class="mb-lib-search" data-lib-ph="mbLibSearch" data-lib-aria="mbLibSearch" autocomplete="off">' +
                        '<div class="mb-lib-filters" role="group">' +
                            '<button type="button" data-filter="all" data-lib-t="mbLibFilterAll"></button>' +
                            '<button type="button" data-filter="skeleton" data-lib-t="mbLibFilterSkeleton"></button>' +
                            '<button type="button" data-filter="progress" data-lib-t="mbLibFilterProgress"></button>' +
                            '<button type="button" data-filter="done" data-lib-t="mbLibFilterDone"></button>' +
                            '<button type="button" data-filter="backup"></button>' +
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
                /* ── Projects view ── */
                '<div class="mb-lib-vprj" hidden>' +
                    '<div class="mb-lib-tools">' +
                        '<input type="search" class="mb-prj-search" data-lib-ph="mbPrjSearch" data-lib-aria="mbPrjSearch" autocomplete="off">' +
                        '<div class="mb-lib-btns">' +
                            '<button type="button" class="mb-lib-btn" data-lib-do="newProject" data-lib-t="mbLibNewProject"></button>' +
                            '<button type="button" class="mb-lib-btn" data-lib-do="importPkg" data-lib-t="mbLibImportBtn"></button>' +
                            '<button type="button" class="mb-lib-btn" data-lib-do="preview" data-lib-t="mbPrvBtn"></button>' +
                        '</div>' +
                    '</div>' +
                    '<div class="mb-lib-count mb-prj-count" aria-live="polite"></div>' +
                    '<ul class="mb-prj-list"></ul>' +
                '</div>' +
            '</div>' +
            '<div class="mb-lib-foot">' +
                '<details class="mb-lib-more">' +
                    '<summary data-lib-t="mbLibMore"></summary>' +
                    '<div class="mb-lib-pkg">' +
                        '<button type="button" class="mb-lib-btn" data-lib-do="importPkg" data-lib-t="mbLibImportBtn"></button>' +
                        '<button type="button" class="mb-lib-btn" data-lib-do="preview" data-lib-t="mbPrvBtn"></button>' +
                        '<button type="button" class="mb-lib-btn" data-lib-do="exportAll" data-lib-t="mbLibExportAllBtn"></button>' +
                        '<button type="button" class="mb-lib-btn" data-lib-do="exportProgramme" data-lib-t="mbPrgPkgBtn"></button>' +
                        '<button type="button" class="mb-lib-btn wide" data-lib-do="exportWord" data-lib-t="mbPrgWordBtn"></button>' +
                    '</div>' +
                '</details>' +
                '<button type="button" class="mb-lib-btn primary" data-lib-do="addModule" data-lib-t="mbAddModule"></button>' +
            '</div>';

        document.body.appendChild(ui.overlay);
        document.body.appendChild(root);
        ui.root = root;
        ui.list = root.querySelector('.mb-lib-list');
        ui.plist = root.querySelector('.mb-prj-list');

        root.querySelector('.mb-lib-x').addEventListener('click', close);
        root.querySelector('.mb-lib-search').addEventListener('input', function (e) { ui.query = e.target.value; paintList(); });
        root.querySelector('.mb-prj-search').addEventListener('input', function (e) { ui.pquery = e.target.value; paintProjects(); });
        root.querySelector('.mb-lib-sort select').addEventListener('change', function (e) { ui.sort = e.target.value; paintList(); });
        root.querySelector('.mb-lib-filters').addEventListener('click', function (e) {
            var b = e.target.closest('[data-filter]');
            if (!b) return;
            ui.filter = b.getAttribute('data-filter');
            syncFilters();
            paintList();
        });
        root.querySelector('.mb-lib-views').addEventListener('click', function (e) {
            var b = e.target.closest('[data-view]');
            if (b) setView(b.getAttribute('data-view'));
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
        ui.plist.addEventListener('click', function (e) {
            var b = e.target.closest('[data-pact]');
            var li = e.target.closest('[data-pid]');
            if (b && li && !b.disabled) projectAction(b.getAttribute('data-pact'), li.getAttribute('data-pid'));
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
        } else if (what === 'fldLink') {
            mbFolderSync.link();
        } else if (what === 'fldAllow') {
            mbFolderSync.allow();
        } else if (what === 'fldRetry') {
            mbFolderSync.retry();
        } else if (what === 'fldWriteAll') {
            mbFolderSync.writeAll();
        } else if (what === 'fldImport') {
            close();
            mbFolderSync.importFromFolder();
        } else if (what === 'fldUnlink') {
            mbConfirm(t('mbFldUnlinkConfirm', { v0: mbFolderSync.state().name }), { danger: true }).then(function (yes) {
                if (yes) mbFolderSync.unlink();
            });
        } else if (what === 'toProjects') {
            setView('projects');
        } else if (what === 'importPkg') {
            var inp = document.getElementById('load-file-input');
            if (inp) inp.click();
        } else if (what === 'preview') {
            mbPreviewPick();
        } else if (what === 'exportAll') {
            close();
            mbExportAllPackages();
        } else if (what === 'exportProgramme') {
            close();
            mbExportProgrammePackage();
        } else if (what === 'exportWord') {
            close();
            mbExportProgrammeWord();
        } else if (what === 'addModule') {
            Promise.resolve(addNewModule()).then(paintList);
        } else if (what === 'newProject') {
            mbPrompt(t('mbLibNewProjectName'), t('mbLibNewProjectDefault')).then(function (name) {
                if (name === null || name === undefined) return;
                return mbLibraryCreateProject(String(name).trim()).then(function (meta) {
                    showStatus(t('mbLibProjectCreated', { v0: meta.name }), 'success');
                    setView('modules');
                });
            });
        }
    }

    function open(view) {
        build();
        ui.open = true;
        if (view) ui.view = view;
        ui.lastFocus = document.activeElement;
        ui.overlay.hidden = false;
        ui.root.hidden = false;
        document.body.classList.add('mb-lib-is-open');
        /* Fresh figures for the open module before the list is drawn. */
        Promise.resolve(typeof mbLibrarySave === 'function' ? mbLibrarySave() : null).then(paintAll);
        paintAll();
        setTimeout(function () {
            var s = ui.root.querySelector(ui.view === 'projects' ? '.mb-prj-search' : '.mb-lib-search');
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
    window.mbLibraryOpenProjects = function () { open('projects'); };

    window.addEventListener('mb:librarychanged', function () {
        if (ui.open) { paintProjectLine(); paintStorage(); setView(ui.view); }
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
