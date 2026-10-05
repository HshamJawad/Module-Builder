// ============================================================
// /src/package_preview.js
// 👁 Preview a package without importing it (3.14.0).
//
// A colleague's .mbz is opened read-only: nothing is written to the
// library, no picture is stored, the open project is not touched. The
// module is shown the way the HTML export shows it — the preview IS the
// HTML export (mbBuildModuleModel + mbBuildModuleHtml), drawn in a
// sandboxed frame from a state object built for the occasion, so what
// is previewed is exactly what an export of that module would contain.
//
// A programme bundle lists its modules; each one is read only when it is
// chosen. "Import this package" hands the same file to the normal import.
// ============================================================

(function () {
    'use strict';

    function t(k, v) { return v ? window.i18n.tf(k, v) : window.i18n.t(k); }
    function esc(s) {
        return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
            return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
        });
    }
    function lang() { return (window.i18n && window.i18n.getLang) ? window.i18n.getLang() : 'en'; }
    function exportLanguage() {
        try { if (typeof exportLang === 'function') return exportLang(); } catch (e) {}
        return lang();
    }
    function when(iso) {
        if (!iso) return '—';
        var d = new Date(iso);
        if (isNaN(d)) return '—';
        try {
            return new Intl.DateTimeFormat(({ ar: 'ar', fr: 'fr-FR' })[lang()] || 'en-GB',
                { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
        } catch (e) { return d.toLocaleString(); }
    }

    function toBase64(u8) {
        var s = '', CH = 0x8000;
        for (var i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
        return btoa(s);
    }

    /** Replace every picture reference in `value` with a data URL. */
    function inline(value, images) {
        var urls = {};
        Object.keys(images || {}).forEach(function (h) {
            urls[h] = 'data:' + (images[h].type || 'image/jpeg') + ';base64,' + toBase64(images[h].bytes);
        });
        var MISSING = {};      // a picture not in the package: dropped from its list
        return (function copy(v) {
            if (typeof v === 'string') return mbImages.isRef(v) ? (urls[v.slice(mbImages.PREFIX.length)] || MISSING) : v;
            if (!v || typeof v !== 'object') return v;
            if (Array.isArray(v)) return v.map(copy).filter(function (x) { return x !== MISSING; });
            var o = {};
            for (var k in v) if (Object.prototype.hasOwnProperty.call(v, k)) { var c = copy(v[k]); o[k] = c === MISSING ? null : c; }
            return o;
        })(value);
    }

    /** A state object the model builder can read — this module only. */
    function previewState(pk, m, coverImages) {
        var shared = _mbDefaultShared();
        var part = pk.project || {};
        if (part.cover) Object.keys(part.cover).forEach(function (k) { if (part.cover[k] !== undefined) shared[k] = JSON.parse(JSON.stringify(part.cover[k])); });
        if (part.references) Object.keys(part.references).forEach(function (k) { shared[k] = JSON.parse(JSON.stringify(part.references[k])); });
        if (part.team) Object.keys(part.team).forEach(function (k) { shared[k] = JSON.parse(JSON.stringify(part.team[k])); });
        shared = inline(shared, coverImages);
        var all = Object.assign({}, coverImages || {}, m.images || {});
        var module = inline(m.module, all);
        var forms = inline(m.forms || {}, all);
        /* The module's own cover rows (title, code, hours…). */
        var own = module.coverValues || {};
        (shared.coverRows || []).forEach(function (r) {
            var key = MB_MODULE_COVER_KEYS.indexOf(r.seedKey) !== -1 ? r.seedKey : (MB_MODULE_COVER_KEYS.indexOf(r.field) !== -1 ? r.field : null);
            if (key && own[key]) r.value = JSON.parse(JSON.stringify(own[key]));
        });
        return Object.assign(shared, {
            modulesData: [module],
            currentModuleId: module.id,
            learningOutcomesData: module.learningOutcomes || [],
            currentLOId: null,
            assessmentFormsData: forms,
            introAdditionalDetails: biNew(),
            introBlocks: [],
            includeLearningGuide: false,
            assessmentContent: biNew(),
            infoQRImage: null,
            activityQRImage: null
        });
    }

    /* ── The window ───────────────────────────────────────────── */
    var view = null;

    function close() {
        if (!view) return;
        if (view.ov.parentNode) view.ov.parentNode.removeChild(view.ov);
        document.removeEventListener('keydown', view.onKey, true);
        view = null;
    }

    function cardLine(card, stats) {
        var parts = [];
        if (card.author) parts.push('✍️ <bdi>' + esc(card.author) + '</bdi>');
        if (card.savedAt) parts.push('🕒 ' + esc(when(card.savedAt)));
        if (card.revision) parts.push(esc(t('mbPkgRevision')) + ' <bdi>' + esc(card.revision) + '</bdi>');
        if (stats) parts.push(esc(t('mbPkgCompletion')) + ' <bdi>' + esc(stats.completion + '%') + '</bdi>');
        return parts.join(' · ');
    }

    function showModule(i) {
        if (!view) return;
        var pk = view.pk;
        view.frame.removeAttribute('srcdoc');
        view.status.textContent = t('mbPrvLoading');
        view.box.querySelectorAll('.mb-prv-mod').forEach(function (b) { b.classList.toggle('is-on', +b.getAttribute('data-i') === i); });
        var coverHashes = mbImages.refsIn((pk.project && pk.project.cover) || {});
        Promise.all([pk.readModule(i), pk.readImages(coverHashes)]).then(function (r) {
            if (!view) return;
            var m = r[0], coverImgs = r[1];
            var card = m.card || {};
            var stats = mbModuleStats(m.module, m.forms || {});
            view.head.innerHTML = '<div class="mb-prv-mt"><bdi>' + esc((card.moduleCode ? card.moduleCode + ' — ' : '') + (card.moduleTitle || mbPlainText(m.module.title))) + '</bdi></div>' +
                '<div class="mb-prv-ml">' + cardLine(card, stats) + '</div>';
            var lg = exportLanguage();
            var model = mbBuildModuleModel(lg, previewState(pk, m, coverImgs));
            var html = model ? mbBuildModuleHtml(model) : '';
            view.frame.srcdoc = html;
            view.status.textContent = '';
        }).catch(function (e) {
            console.error('[Preview]', e);
            if (view) view.status.textContent = t('mbPrvFailed') + ' ' + ((e && e.mbCode) ? t('mbPkgErr_' + e.mbCode) : (e && e.message) || e);
        });
    }

    function open(file) {
        close();
        return mbOpenPackage(file).then(function (pk) {
            var ov = document.createElement('div');
            ov.className = 'mb-pk-overlay mb-prv-overlay';
            var box = document.createElement('div');
            box.className = 'mb-prv-box';
            box.setAttribute('role', 'dialog');
            box.setAttribute('aria-modal', 'true');
            box.setAttribute('dir', window.i18n.isRTL() ? 'rtl' : 'ltr');
            var mp = pk.manifest.project || {};
            var list = pk.kind === 'programme'
                ? '<nav class="mb-prv-list">' + pk.entries.map(function (e, i) {
                      return '<button type="button" class="mb-prv-mod" data-i="' + i + '"><bdi>' +
                          esc((e.code ? e.code + ' — ' : '') + (e.title || '')) + '</bdi>' +
                          (e.card && e.card.author ? '<small>✍️ <bdi>' + esc(e.card.author) + '</bdi></small>' : '') + '</button>';
                  }).join('') + '</nav>'
                : '';
            box.innerHTML =
                '<div class="mb-prv-top">' +
                    '<div class="mb-prv-title">👁 ' + esc(t('mbPrvTitle')) + '</div>' +
                    '<div class="mb-prv-sub"><bdi>' + esc(pk.name) + '</bdi> · ' +
                        esc(t(pk.kind === 'programme' ? 'mbPrvKindProgramme' : 'mbPrvKindModule', { v0: pk.count })) +
                        (mp.name ? ' · <bdi>' + esc(mp.name) + '</bdi>' : '') + '</div>' +
                    '<div class="mb-prv-note">' + esc(t('mbPrvNote')) + '</div>' +
                '</div>' +
                '<div class="mb-prv-main">' + list +
                    '<div class="mb-prv-doc">' +
                        '<div class="mb-prv-head"></div>' +
                        '<div class="mb-prv-status" aria-live="polite"></div>' +
                        '<iframe class="mb-prv-frame" sandbox="allow-scripts" title="preview"></iframe>' +
                    '</div>' +
                '</div>' +
                '<div class="mb-pk-btns mb-prv-btns">' +
                    '<button type="button" class="mb-pk-btn primary" data-p="import">' + esc(t('mbPrvImport')) + '</button>' +
                    '<button type="button" class="mb-pk-btn" data-p="close">' + esc(t('mbLibClose')) + '</button>' +
                '</div>';
            ov.appendChild(box);
            document.body.appendChild(ov);
            view = {
                ov: ov, box: box, pk: pk, file: file,
                frame: box.querySelector('.mb-prv-frame'),
                head: box.querySelector('.mb-prv-head'),
                status: box.querySelector('.mb-prv-status'),
                onKey: function (e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } }
            };
            document.addEventListener('keydown', view.onKey, true);
            box.addEventListener('click', function (e) {
                var b = e.target.closest('[data-p], .mb-prv-mod');
                if (!b) return;
                if (b.classList.contains('mb-prv-mod')) { showModule(+b.getAttribute('data-i')); return; }
                if (b.getAttribute('data-p') === 'close') close();
                if (b.getAttribute('data-p') === 'import') {
                    var f = view.file;
                    close();
                    mbImportPackages([f]);
                }
            });
            showModule(0);
            return true;
        }).catch(function (e) {
            console.error('[Preview] cannot open:', e);
            showStatus(t('mbPrvFailed') + ' ' + ((e && e.mbCode) ? t('mbPkgErr_' + e.mbCode) : (e && e.message) || e), 'error');
            return false;
        });
    }

    /** 👁 — choose a package and preview it. */
    function pick() {
        var inp = document.getElementById('mb-preview-input');
        if (!inp) {
            inp = document.createElement('input');
            inp.type = 'file';
            inp.accept = '.mbz';
            inp.id = 'mb-preview-input';
            inp.style.display = 'none';
            inp.addEventListener('change', function () {
                var f = inp.files && inp.files[0];
                inp.value = '';
                if (f) open(f);
            });
            document.body.appendChild(inp);
        }
        inp.click();
    }

    window.mbPreviewPackage = open;
    window.mbPreviewPick = pick;
    window.mbPreviewClose = close;
})();
