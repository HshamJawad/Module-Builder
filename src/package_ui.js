// ============================================================
// /src/package_ui.js
// Module packages in the interface (3.13.0):
//
//   💾 Save          → the open module as one .mbz file
//   📦 per module    → every module of the project, one .mbz each
//                      (the coordinator's handout), with a progress bar
//   📂 Import / drop → any number of .mbz files at once
//
// THE IMPORT, one file at a time — read, store, let go, next — so forty
// packages cost the memory of one. For each package, by its identity
// card:
//
//   a module the project does not have      → added
//   a module that is still a DACUM structure → its content fills it
//   the same version (author, date, revision) → nothing to do
//   another version                          → the user compares and
//        chooses: replace, keep both, skip — "apply to all" available
//   another programme                        → a separate project, or skip
//
// What modules share with their programme travels with each package:
// references and team members are merged without duplicates; a
// different cover is asked about once per import.
//
// The whole import runs as ONE job of the library queue: no autosave can
// slip in between a package being written and the screen being redrawn.
// ============================================================

(function () {
    'use strict';

    function t(k, v) { return v ? window.i18n.tf(k, v) : window.i18n.t(k); }
    function esc(s) {
        return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
            return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
        });
    }
    function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
    function lang() { return (window.i18n && window.i18n.getLang) ? window.i18n.getLang() : 'en'; }
    function when(iso) {
        if (!iso) return '—';
        var d = new Date(iso);
        if (isNaN(d)) return '—';
        try {
            return new Intl.DateTimeFormat(({ ar: 'ar', fr: 'fr-FR' })[lang()] || 'en-GB',
                { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
        } catch (e) { return d.toLocaleString(); }
    }
    var UNITS = { en: ['B', 'KB', 'MB', 'GB'], fr: ['o', 'Ko', 'Mo', 'Go'], ar: ['بايت', 'ك.ب', 'م.ب', 'غ.ب'] };
    function bytes(n) {
        var u = UNITS[lang()] || UNITS.en, i = 0;
        n = Math.max(0, n || 0);
        while (n >= 1024 && i < 3) { n /= 1024; i++; }
        var s = i === 0 ? String(Math.round(n)) : (n < 10 ? n.toFixed(1) : String(Math.round(n)));
        if (lang() === 'fr') s = s.replace('.', ',');
        return s + ' ' + u[i];
    }

    function download(blob, name) {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = name;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 15000);
    }

    /* ── Modal ────────────────────────────────────────────────── */
    function modal(cls) {
        var ov = document.createElement('div');
        ov.className = 'mb-pk-overlay';
        var box = document.createElement('div');
        box.className = 'mb-pk-box ' + (cls || '');
        box.setAttribute('role', 'dialog');
        box.setAttribute('aria-modal', 'true');
        box.setAttribute('dir', window.i18n.isRTL() ? 'rtl' : 'ltr');
        ov.appendChild(box);
        document.body.appendChild(ov);
        return { ov: ov, box: box, close: function () { if (ov.parentNode) ov.parentNode.removeChild(ov); } };
    }

    function progress(title) {
        var m = modal('mb-pk-progress');
        var stop = false;
        m.box.innerHTML =
            '<h3 class="mb-pk-title">' + esc(title) + '</h3>' +
            '<div class="mb-pk-pbar"><i></i></div>' +
            '<div class="mb-pk-ptext" aria-live="polite"></div>' +
            '<div class="mb-pk-btns"><button type="button" class="mb-pk-btn" data-x="stop">' + esc(t('mbPkgCancel')) + '</button></div>';
        var bar = m.box.querySelector('.mb-pk-pbar i'), text = m.box.querySelector('.mb-pk-ptext');
        var btn = m.box.querySelector('[data-x="stop"]');
        btn.addEventListener('click', function () {
            stop = true;
            btn.disabled = true;
            btn.textContent = t('mbPkgStopping');
        });
        return {
            set: function (i, n, label) {
                bar.style.width = Math.round(i * 100 / Math.max(1, n)) + '%';
                text.innerHTML = '<bdi>' + (i + (i < n ? 1 : 0)) + ' / ' + n + '</bdi>' + (label ? ' — <bdi>' + esc(label) + '</bdi>' : '');
            },
            stopped: function () { return stop; },
            close: m.close,
            hide: function (yes) { m.ov.style.display = yes ? 'none' : ''; }
        };
    }

    /**
     * A question with several answers and, optionally, "apply to all".
     * Resolves { choice, all }.
     */
    function choose(o) {
        return new Promise(function (resolve) {
            var m = modal('mb-pk-choose');
            m.box.innerHTML =
                '<h3 class="mb-pk-title">' + esc(o.title) + '</h3>' +
                (o.message ? '<p class="mb-pk-msg">' + esc(o.message) + '</p>' : '') +
                (o.html || '') +
                (o.allLabel ? '<label class="mb-pk-all"><input type="checkbox"> <span>' + esc(o.allLabel) + '</span></label>' : '') +
                '<div class="mb-pk-btns">' + o.buttons.map(function (b) {
                    return '<button type="button" class="mb-pk-btn' + (b.primary ? ' primary' : '') + '" data-c="' + esc(b.id) + '">' + esc(b.label) + '</button>';
                }).join('') + '</div>';
            var first = m.box.querySelector('.mb-pk-btn.primary') || m.box.querySelector('.mb-pk-btn');
            setTimeout(function () { if (first) first.focus(); }, 30);
            m.box.addEventListener('click', function (e) {
                var b = e.target.closest('[data-c]');
                if (!b) return;
                var all = m.box.querySelector('.mb-pk-all input');
                m.close();
                resolve({ choice: b.getAttribute('data-c'), all: !!(all && all.checked) });
            });
        });
    }

    function errText(e) {
        var code = e && e.mbCode;
        if (code) return t('mbPkgErr_' + code);
        return (e && e.message) || String(e);
    }

    /* ══════════════════════════════════════════════════════════
       SAVE / EXPORT
       ══════════════════════════════════════════════════════════ */

    /** 💾 — the open module as a .mbz. */
    function mbSaveModulePackage(mid) {
        mid = (typeof mid === 'string' && mid) || mbLib.openId || mbState.currentModuleId;
        if (!mid) return Promise.resolve(false);
        return mbBuildModulePackage(mid).then(function (p) {
            download(p.blob, p.name);
            if (mbLib.project) mbLibraryMarkBackedUp(mbLib.project.id, [mid]);
            showStatus(t('mbPkgSaved', { v0: p.name, v1: bytes(p.bytes) }), 'success');
            return true;
        }).catch(function (e) {
            console.error('[Package] save failed:', e);
            showStatus(t('mbPkgSaveFailed') + ' ' + errText(e), 'error');
            if (window.onerror) window.onerror('[SAVE] ' + (e && e.message), 'mbSaveModulePackage', 0, 0, e);
            return false;
        });
    }

    /** 📦 — every module of the project, one file each, one after another. */
    function mbExportAllPackages() {
        var ids = (mbState.modulesData || []).map(function (m) { return m.id; });
        if (!ids.length) return Promise.resolve(0);
        var prog = progress(t('mbPkgExportAllTitle'));
        var done = 0, total = 0;
        var chain = Promise.resolve();
        ids.forEach(function (id, i) {
            chain = chain.then(function () {
                if (prog.stopped()) return null;
                var m = mbState.modulesData.find(function (x) { return x.id === id; }) || {};
                prog.set(i, ids.length, (m.moduleCode ? m.moduleCode + ' — ' : '') + mbPlainText(m.title));
                return mbBuildModulePackage(id).then(function (p) {
                    download(p.blob, p.name);
                    if (mbLib.project) mbLibraryMarkBackedUp(mbLib.project.id, [id]);
                    done++; total += p.bytes;
                    /* Browsers drop downloads fired in the same instant. */
                    return sleep(450);
                });
            });
        });
        return chain.then(function () {
            prog.set(ids.length, ids.length);
            prog.close();
            showStatus(t('mbPkgExportAllDone', { v0: done, v1: bytes(total) }), 'success');
            return done;
        }, function (e) {
            prog.close();
            showStatus(t('mbPkgSaveFailed') + ' ' + errText(e), 'error');
            return done;
        });
    }

    /** 🗂 — the whole programme as ONE package, module after module. */
    function mbExportProgrammePackage(pid) {
        pid = (typeof pid === 'string' && pid) || (mbLib.project && mbLib.project.id);
        if (!pid) return Promise.resolve(null);
        var prog = progress(t('mbPrgPkgTitle'));
        return mbBuildProgrammePackage(pid, function (i, n, label) { prog.set(i, n, label); }, prog.stopped)
            .then(function (r) {
                prog.close();
                if (!r) { showStatus(t('mbPrgCancelled'), 'error'); return null; }
                download(r.blob, r.name);
                return mbStore.getHeads(pid).then(function (hs) {
                    return mbLibraryMarkBackedUp(pid, hs.map(function (h) { return h.mid; }));
                }).then(function () {
                    showStatus(t('mbPrgPkgDone', { v0: r.count, v1: bytes(r.bytes), v2: r.name }), 'success');
                    return r;
                });
            }, function (e) {
                prog.close();
                console.error('[Package] programme package failed:', e);
                showStatus(t('mbPkgSaveFailed') + ' ' + errText(e), 'error');
                return null;
            });
    }

    /** 📚 — the whole programme in Word: one document per module, all in
     *  one ZIP. Each module is opened, exported and let go before the
     *  next, so the memory used is one module's, however long the
     *  programme. Modules with nothing to export are listed, not failed. */
    async function mbExportProgrammeWord() {
        if (!mbLib.project) return null;
        if (typeof exportToDocx !== 'function') return null;
        var ids = (mbState.modulesData || []).map(function (m) { return m.id; });
        var startId = mbLib.openId;
        var prog = progress(t('mbPrgWordTitle'));
        var w = mbZipWriter(), done = 0, skipped = [], failed = [];
        var safe = function (s) { return String(s || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '').replace(/\s+/g, '_').slice(0, 70); };
        try {
            for (var i = 0; i < ids.length; i++) {
                if (prog.stopped()) break;
                var m0 = mbState.modulesData.find(function (x) { return x.id === ids[i]; }) || {};
                var label = (m0.moduleCode ? m0.moduleCode + ' — ' : '') + mbPlainText(m0.title);
                prog.set(i, ids.length, label);
                await mbLibraryOpenModule(ids[i]);
                var res = null;
                window.mbExportSink = {
                    take: function (blob, name) { res = { blob: blob, name: name }; return Promise.resolve(); },
                    skip: function (why) { res = { skip: why }; },
                    fail: function (e) { res = { fail: e }; }
                };
                try { await exportToDocx(); }
                catch (e) { res = { fail: e }; }
                finally { window.mbExportSink = null; }
                if (res && res.blob) {
                    var bytesU8 = new Uint8Array(await res.blob.arrayBuffer());
                    var nm = String(i + 1).padStart(2, '0') + '_' + (m0.moduleCode ? safe(m0.moduleCode) + '_' : '') + safe(res.name);
                    w.add(nm, bytesU8, true);       // a .docx is compressed already
                    done++;
                } else if (res && res.fail) {
                    failed.push(label + ' — ' + ((res.fail && res.fail.message) || res.fail));
                } else {
                    skipped.push(label);
                }
                res = null;
                await sleep(0);
            }
            prog.set(ids.length, ids.length);
        } finally {
            prog.close();
            window.mbExportSink = null;
        }
        var stopped = prog.stopped();
        var zipBlob = w.finish();
        if (startId && startId !== mbLib.openId) await mbLibraryOpenModule(startId);
        if (done) {
            var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); };
            download(zipBlob, safe(mbLib.project.name || 'programme') + '_Word_' + d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '.zip');
        }
        var L = [t('mbPrgWordSum', { v0: done, v1: ids.length })];
        if (skipped.length) {
            L.push(t('mbPrgWordSkipped', { v0: skipped.length }));
            skipped.slice(0, 15).forEach(function (x) { L.push('   • ' + x); });
            if (skipped.length > 15) L.push('   …');
        }
        if (failed.length) {
            L.push(t('mbPkgSumFailed', { v0: failed.length }));
            failed.slice(0, 10).forEach(function (x) { L.push('   • ' + x); });
        }
        if (stopped) L.push(t('mbPrgCancelled'));
        await mbAlert(L.join('\n'));
        return { done: done, skipped: skipped.length, failed: failed.length, bytes: zipBlob.size };
    }

    /* ══════════════════════════════════════════════════════════
       IMPORT
       ══════════════════════════════════════════════════════════ */

    function progKey(programId, projectId) { return programId || ('local:' + (projectId || '')); }

    function sameVersion(a, b) {
        if (!a || !b) return false;
        return (a.revision || 0) === (b.revision || 0) && String(a.savedAt || '') === String(b.savedAt || '') &&
               String(a.author || '') === String(b.author || '');
    }

    function textOf(v) {
        if (v === null || v === undefined) return '';
        if (typeof v === 'string') return v;
        /* A pair: its non-empty sides, by language — so { en, ar } and
           { en, ar, fr } holding the same text compare equal. */
        if (typeof v === 'object') return Object.keys(v).sort().filter(function (k) {
            return typeof v[k] === 'string' && v[k].trim();
        }).map(function (k) { return k + '=' + v[k]; }).join('\u0001');
        return String(v);
    }
    function norm(v) { return textOf(v).replace(/\s+/g, ' ').trim().toLowerCase(); }

    /* ── Cover: what is compared and taken ────────────────────── */
    function coverSig(c) {
        c = c || {};
        var rows = (c.coverRows || []).filter(function (r) {
            return MB_MODULE_COVER_KEYS.indexOf(r.seedKey) === -1 && MB_MODULE_COVER_KEYS.indexOf(r.field) === -1;
        /* Values only: the labels are filled in automatically in each
           author's interface language, so they differ between two copies
           of the same cover. A row is known by its seedKey (or field). */
        }).map(function (r) { return [r.seedKey || r.field || norm(r.label), norm(r.value)]; })
          .filter(function (x) { return x[1].replace(/\u0001/g, '').trim(); })
          .sort(function (a, b) { return String(a[0]).localeCompare(String(b[0])); });
        return mbFingerprint([norm(c.coversAdditionalInfo), norm(c.coversAdditionalNotes),
                              c.frontCoverImage || '', c.backCoverImage || '', rows]).fp;
    }
    function coverEmpty(c) {
        c = c || {};
        if (c.frontCoverImage || c.backCoverImage) return false;
        if (norm(c.coversAdditionalInfo).replace(/\u0001/g, '') || norm(c.coversAdditionalNotes).replace(/\u0001/g, '')) return false;
        return !(c.coverRows || []).some(function (r) {
            if (MB_MODULE_COVER_KEYS.indexOf(r.seedKey) !== -1 || MB_MODULE_COVER_KEYS.indexOf(r.field) !== -1) return false;
            return norm(r.value).replace(/\u0001/g, '');
        });
    }

    /** References and team members not already there, appended. Returns
     *  how many were added. Works on any shared object (state or record). */
    function mergeLists(dst, part) {
        var added = 0;
        var refs = (part.references && part.references.referencesData) || [];
        if (!Array.isArray(dst.referencesData)) dst.referencesData = [];
        var have = new Set(dst.referencesData.map(function (r) { return norm(r && r.value).replace(/\u0001/g, ' ').trim(); }));
        refs.forEach(function (r) {
            var k = norm(r && r.value).replace(/\u0001/g, ' ').trim();
            if (!k || have.has(k)) return;
            have.add(k);
            /* An empty first row (a new project) is filled, not followed. */
            var blank = dst.referencesData.length === 1 && !norm(dst.referencesData[0].value).replace(/\u0001/g, '').trim();
            if (blank) { dst.referencesData[0].value = JSON.parse(JSON.stringify(r.value)); }
            else {
                dst.refIdCounter = Math.max(dst.refIdCounter || 0, dst.referencesData.length) + 1;
                dst.referencesData.push({ id: dst.refIdCounter, value: JSON.parse(JSON.stringify(r.value)) });
            }
            added++;
        });
        var team = (part.team && part.team.teamMembers) || [];
        if (!Array.isArray(dst.teamMembers)) dst.teamMembers = [];
        var names = new Set(dst.teamMembers.map(function (m) { return norm(m && m.name); }));
        team.forEach(function (m) {
            var k = norm(m && m.name);
            if (!k.replace(/\u0001/g, '') || names.has(k)) return;
            names.add(k);
            var copy = JSON.parse(JSON.stringify(m));
            /* The empty row every new project starts with is filled, not
               followed by the imported one. */
            var emptyAt = dst.teamMembers.findIndex(function (x) {
                return !norm(x && x.name).replace(/\u0001/g, '').trim() && !norm(x && x.task).replace(/\u0001/g, '').trim();
            });
            if (emptyAt !== -1) {
                copy.id = dst.teamMembers[emptyAt].id;
                dst.teamMembers[emptyAt] = copy;
            } else {
                dst.teamMemberIdCounter = (dst.teamMemberIdCounter || 0) + 1;
                copy.id = dst.teamMemberIdCounter;
                dst.teamMembers.push(copy);
            }
            added++;
        });
        return added;
    }

    function takeCover(dst, cover) {
        ['coversAdditionalInfo', 'coversAdditionalNotes', 'frontCoverImage', 'backCoverImage',
         'coverRows', 'coverRowIdCounter', 'coverFrameworkSeeded'].forEach(function (k) {
            dst[k] = JSON.parse(JSON.stringify(cover[k] === undefined ? null : cover[k]));
        });
        if (!dst.coverRows) dst.coverRows = [];
    }

    /** Is the open project a blank one, ready to take a programme from the
     *  first package? No programme, and nothing written in any module. */
    function isBlankProject() {
        var p = mbLib.project;
        if (!p || p.programId) return false;
        return (mbState.modulesData || []).every(function (m) {
            var h = mbLib.heads[m.id];
            return h && h.stats && h.stats.skeleton && !h.fromDacum;
        });
    }

    function conflictHtml(head, card, stats) {
        var a = head.card || {}, sa = head.stats || {};
        var aT = Date.parse(a.savedAt || 0) || 0, bT = Date.parse(card.savedAt || 0) || 0;
        var newer = function (mine) {
            return (mine ? aT > bT : bT > aT) ? ' <span class="mb-pk-newer">' + esc(t('mbPkgNewer')) + '</span>' : '';
        };
        var row = function (label, x, y) {
            return '<tr><th scope="row">' + esc(label) + '</th><td><bdi>' + x + '</bdi></td><td><bdi>' + y + '</bdi></td></tr>';
        };
        return '<div class="mb-pk-mod"><bdi>' + esc((card.moduleCode ? card.moduleCode + ' — ' : '') + (card.moduleTitle || '')) + '</bdi></div>' +
            '<div class="mb-pk-tablewrap"><table class="mb-pk-cmp"><thead><tr><th></th>' +
            '<th scope="col">' + esc(t('mbPkgMine')) + newer(true) + '</th>' +
            '<th scope="col">' + esc(t('mbPkgTheirs')) + newer(false) + '</th></tr></thead><tbody>' +
            row(t('mbLibAuthor').replace(/\s*:\s*$/, ''), esc(a.author || '—'), esc(card.author || '—')) +
            row(t('mbPkgSavedAt'), esc(when(a.savedAt)), esc(when(card.savedAt))) +
            row(t('mbPkgRevision'), esc(a.revision || 0), esc(card.revision || 0)) +
            row(t('mbPkgCompletion'), esc((sa.completion || 0) + '%'), esc((stats.completion || 0) + '%')) +
            '</tbody></table></div>';
    }

    /* The batch. Everything below runs inside ONE library job. */
    async function importBatch(files) {
        await _mbSaveNow(false);

        var S = { added: 0, filled: 0, replaced: 0, copies: 0, same: 0, skipped: 0, other: 0,
                  otherNames: [], badImages: 0, failed: [], refs: 0, cover: false };
        var D = { conflict: null, programme: null, cover: null };
        var open = { meta: mbLib.project, heads: mbLib.heads, isOpen: true };
        var others = {};
        var blank = isBlankProject() ? { emptyIds: (mbState.modulesData || []).map(function (m) { return m.id; }), adopted: false } : null;
        var reloadOpen = false, sharedChanged = false, firstImported = null;
        var maxLo = 0, maxMod = 0;

        var prog = progress(t('mbPkgImportTitle'));

        async function otherProject(pkg) {
            var card = pkg.card, mp = pkg.manifest.project || {};
            var key = progKey(card.programId, card.projectId);
            if (others[key]) return others[key];
            var list = await mbStore.listProjects();
            var meta = list.find(function (p) {
                return (p.id !== mbLib.project.id) &&
                       (progKey(p.programId, p.id) === key || p.id === card.projectId ||
                        (card.programId && p.programId === card.programId));
            });
            var heads = {};
            /* A project another tab is editing is never written from here. */
            if (meta && typeof mbTabGuard !== 'undefined' && await mbTabGuard.heldElsewhere(meta.id)) {
                var busy = new Error('busy'); busy.mbCode = 'busy'; throw busy;
            }
            if (!meta) {
                meta = _mbNewProjectRecord({
                    name: mp.name || card.programName || t('mbLibNewProjectDefault'),
                    programId: card.programId || ('local:' + card.projectId),
                    programName: card.programName || mp.programName || '',
                    occupation: mp.occupation || ''
                });
                var shared = _mbDefaultShared();
                if (pkg.project) {
                    if (pkg.project.cover) takeCover(shared, pkg.project.cover);
                    mergeLists(shared, pkg.project);
                }
                await mbStore.putProject(meta);
                await mbStore.putShared(meta.id, shared, mbImages.refsIn(shared));
            } else {
                (await mbStore.getHeads(meta.id)).forEach(function (h) { heads[h.mid] = h; });
                if (pkg.project) {
                    var rec = await mbStore.getSharedRecord(meta.id);
                    var data = (rec && rec.data) || _mbDefaultShared();
                    var n = mergeLists(data, pkg.project);
                    var took = false;
                    if (pkg.project.cover && coverEmpty(data) && !coverEmpty(pkg.project.cover)) { takeCover(data, pkg.project.cover); took = true; }
                    if (n || took) await mbStore.putShared(meta.id, data, mbImages.refsIn(data));
                }
            }
            if (S.otherNames.indexOf(meta.name) === -1) S.otherNames.push(meta.name);
            others[key] = { meta: meta, heads: heads, isOpen: false, changed: false };
            return others[key];
        }

        async function writeInto(ctx, modS, forms, card, action) {
            var hashes = mbImages.refsIn([modS, forms]);
            var head = await _mbWriteStored(modS, forms, hashes, mbImages.sizeOf(hashes), card, ctx.meta);
            var isNew = !ctx.heads[modS.id];
            ctx.heads[modS.id] = head;
            (modS.learningOutcomes || []).forEach(function (lo) {
                var n = /^lo-(\d+)$/.exec(String(lo.id || '')); if (n) maxLo = Math.max(maxLo, +n[1]);
            });
            var mm = /^module-(\d+)$/.exec(String(modS.id)); if (mm) maxMod = Math.max(maxMod, +mm[1]);
            if (ctx.isOpen) {
                var list = mbState.modulesData;
                var i = list.findIndex(function (m) { return m.id === modS.id; });
                if (i === -1) list.push(mbModuleSkeleton(modS));
                else if (modS.id === mbLib.openId) reloadOpen = true;
                else list[i] = mbModuleSkeleton(modS);
                if (!firstImported) firstImported = modS.id;
            } else {
                ctx.changed = true;
                if (isNew) ctx.meta.moduleOrder = (ctx.meta.moduleOrder || []).concat([modS.id]);
            }
        }

        async function importOne(pkg) {
            var card = pkg.card || {};
            var ctx = open;
            if (progKey(card.programId, card.projectId) !== progKey(open.meta.programId, open.meta.id)) {
                if (blank && !blank.adopted) {
                    /* A blank project takes the programme of its first package. */
                    var mp = pkg.manifest.project || {};
                    open.meta.programId = card.programId || ('local:' + card.projectId);
                    open.meta.programName = card.programName || mp.programName || '';
                    if (!open.meta.occupation && mp.occupation) open.meta.occupation = mp.occupation;
                    if (open.meta.name === t('mbLibNewProjectDefault') || !open.meta.name) {
                        open.meta.name = mp.name || open.meta.programName || open.meta.name;
                    }
                    blank.adopted = true;
                } else {
                    var dec = D.programme ? { choice: D.programme } : null;
                    if (!dec) {
                        prog.hide(true);
                        dec = await choose({
                            title: t('mbPkgOtherTitle'),
                            message: t('mbPkgOtherMsg', {
                                v0: (pkg.manifest.project && pkg.manifest.project.name) || card.programName || '—',
                                v1: open.meta.name || '—',
                                v2: (card.moduleCode ? card.moduleCode + ' — ' : '') + (card.moduleTitle || '')
                            }),
                            buttons: [{ id: 'separate', label: t('mbPkgOtherSeparate'), primary: true },
                                      { id: 'skip', label: t('mbPkgSkip') }],
                            allLabel: t('mbPkgApplyAll')
                        });
                        prog.hide(false);
                        if (dec.all) D.programme = dec.choice;
                    }
                    if (dec.choice === 'skip') { S.skipped++; return; }
                    ctx = await otherProject(pkg);
                }
            }

            /* Pictures first, each checked against its name. */
            for (var h in pkg.images) {
                var ok = await mbImages.putVerified(h, pkg.images[h].bytes, pkg.images[h].type);
                if (!ok) S.badImages++;
            }

            var modS = pkg.module, forms = pkg.forms || {};
            var head = ctx.heads[modS.id];
            var action;
            if (!head) action = 'add';
            else if (sameVersion(head.card, card)) action = 'same';
            else if (head.stats && head.stats.skeleton) action = 'fill';
            else {
                var c = D.conflict ? { choice: D.conflict } : null;
                if (!c) {
                    prog.hide(true);
                    var theirStats = mbModuleStats(modS, forms);
                    var aT = Date.parse((head.card || {}).savedAt || 0) || 0, bT = Date.parse(card.savedAt || 0) || 0;
                    c = await choose({
                        title: t('mbPkgConflictTitle'),
                        html: conflictHtml(head, card, theirStats),
                        buttons: [{ id: 'replace', label: t('mbPkgReplace'), primary: bT >= aT },
                                  { id: 'both', label: t('mbPkgKeepBoth') },
                                  { id: 'skip', label: t('mbPkgSkip'), primary: bT < aT }],
                        allLabel: t('mbPkgApplyAll')
                    });
                    prog.hide(false);
                    if (c.all) D.conflict = c.choice;
                }
                action = c.choice;
            }

            if (action === 'same') { S.same++; }
            else if (action === 'skip') { S.skipped++; }
            else if (action === 'both') {
                var copy = JSON.parse(JSON.stringify(modS));
                var suffix = ' ' + t('mbPkgCopySuffix', { v0: card.author || '—' });
                copy.id = modS.id + '~' + Math.random().toString(36).slice(2, 7);
                if (typeof copy.title === 'string') copy.title += suffix;
                else if (copy.title && typeof copy.title === 'object') {
                    Object.keys(copy.title).forEach(function (k) { if (String(copy.title[k] || '').trim()) copy.title[k] += suffix; });
                }
                var cc = Object.assign({}, card, { moduleId: copy.id, moduleTitle: mbPlainText(copy.title) });
                await writeInto(ctx, copy, forms, cc, 'both');
                S.copies++;
            } else {
                await writeInto(ctx, modS, forms, card, action);
                if (ctx !== open) S.other++;
                else if (action === 'add') S.added++;
                else if (action === 'fill') S.filled++;
                else S.replaced++;
            }

            /* References, team and cover of the open project. */
            if (ctx === open && pkg.project && action !== 'skip') {
                _mbLibFlush();
                var changedHere = false;
                var n = mergeLists(mbState, pkg.project);
                if (n) { S.refs += n; sharedChanged = true; changedHere = true; }
                var theirs = pkg.project.cover;
                if (theirs && !coverEmpty(theirs) && D.cover !== 'mine') {
                    var mine = (await mbImages.dehydrate(mbCollectShared())).value;
                    if (coverSig(mine) !== coverSig(theirs)) {
                        var take = coverEmpty(mine) || D.cover === 'theirs';
                        if (!take && !D.cover) {
                            prog.hide(true);
                            var r = await choose({
                                title: t('mbPkgCoverTitle'),
                                message: t('mbPkgCoverMsg'),
                                buttons: [{ id: 'mine', label: t('mbPkgCoverMine'), primary: true },
                                          { id: 'theirs', label: t('mbPkgCoverTheirs') }]
                            });
                            prog.hide(false);
                            D.cover = r.choice;
                            take = r.choice === 'theirs';
                        }
                        if (take) {
                            var cov = JSON.parse(JSON.stringify(theirs));
                            await mbImages.hydrate(cov);
                            takeCover(mbState, cov);
                            sharedChanged = true; changedHere = true;
                            S.cover = true;
                        }
                    }
                }
                /* Drawn at once: the forms are read back into state before
                   every comparison and save, and a form still showing the
                   old cover or team would write it over what was merged. */
                if (changedHere) {
                    mbApplyProjectShared(mbCollectShared());
                    if (mbLib.openId) _mbApplyModuleCover(_mbOpenModuleObj());
                }
            }
        }

        try {
            for (var i = 0; i < files.length; i++) {
                if (prog.stopped()) break;
                var f = files[i];
                prog.set(i, files.length, f.name);
                var pk = null;
                try { pk = await mbOpenPackage(f); }
                catch (e) {
                    console.warn('[Package] cannot open:', f.name, e);
                    S.failed.push({ name: f.name, reason: errText(e) });
                    continue;
                }
                /* A module package holds one module, a programme bundle
                   many: either way they come out one at a time, each with
                   only its own pictures — plus the covers' pictures, read
                   once per file. */
                var coverImgs = {};
                try { coverImgs = await pk.readImages(mbImages.refsIn((pk.project && pk.project.cover) || {})); }
                catch (e) { coverImgs = {}; }
                for (var j = 0; j < pk.count; j++) {
                    if (prog.stopped()) break;
                    var m = null;
                    try {
                        m = await pk.readModule(j);
                        var cd = m.card || {};
                        prog.set(i, files.length, (pk.count > 1 ? '[' + (j + 1) + '/' + pk.count + '] ' : '') +
                                 (cd.moduleCode ? cd.moduleCode + ' — ' : '') + (cd.moduleTitle || f.name));
                        await importOne({ manifest: pk.manifest, card: cd, module: m.module, forms: m.forms,
                                          project: pk.project, images: Object.assign({}, coverImgs, m.images) });
                    } catch (e) {
                        console.warn('[Package] import failed:', f.name, j, e);
                        S.failed.push({ name: f.name + (pk.count > 1 ? ' #' + (j + 1) : ''), reason: errText(e) });
                    }
                    m = null;               // let the bytes go before the next module
                    await sleep(0);
                }
                pk = null;
            }
            prog.set(files.length, files.length);
        } finally {
            prog.close();
        }

        /* ── Finish: counters, the blank project's empty modules, screen ── */
        if (maxLo > (mbState.loIdCounter || 0)) mbState.loIdCounter = maxLo;
        if (maxMod > (mbState.moduleIdCounter || 0)) mbState.moduleIdCounter = maxMod;

        var target = mbLib.openId;
        if (blank && blank.adopted && firstImported) {
            /* The empty default module(s) the blank project started with. */
            for (var k = 0; k < blank.emptyIds.length; k++) {
                var id = blank.emptyIds[k];
                if (open.heads[id] && open.heads[id].stats && open.heads[id].stats.skeleton && id !== firstImported) {
                    await mbStore.deleteModule(open.meta.id, id);
                    delete mbLib.heads[id]; delete mbLib.cards[id]; delete mbLib.fps.modules[id];
                    mbState.modulesData = mbState.modulesData.filter(function (m) { return m.id !== id; });
                    if (id === target) { target = null; mbLib.openId = null; }
                }
            }
        }
        if (sharedChanged) {
            mbApplyProjectShared(mbCollectShared());
            if (mbLib.openId) _mbApplyModuleCover(_mbOpenModuleObj());
        }
        if (reloadOpen && target) {
            await _mbOpenNow(target, { noSave: true });
        } else if (!target && (firstImported || mbState.modulesData[0])) {
            await _mbOpenNow(firstImported || mbState.modulesData[0].id, { noSave: true });
        } else {
            if (typeof renderModuleSelector === 'function') renderModuleSelector();
            if (typeof mbRenderTaskAnalysisIndex === 'function') mbRenderTaskAnalysisIndex();
        }
        await _mbSaveNow(false);

        for (var key in others) {
            var o = others[key];
            if (o.changed) { o.meta.updatedAt = Date.now(); await mbStore.putProject(o.meta); }
        }
        _mbLibEmit();
        _mbCollectSoon(5000);
        return S;
    }

    function summaryText(S) {
        var L = [];
        var line = function (n, key, v) { if (n) L.push(t(key, Object.assign({ v0: n }, v || {}))); };
        line(S.added, 'mbPkgSumAdded');
        line(S.filled, 'mbPkgSumFilled');
        line(S.replaced, 'mbPkgSumReplaced');
        line(S.copies, 'mbPkgSumCopies');
        line(S.same, 'mbPkgSumSame');
        line(S.skipped, 'mbPkgSumSkipped');
        line(S.other, 'mbPkgSumOther', { v1: S.otherNames.join('، ') });
        line(S.refs, 'mbPkgSumRefs');
        if (S.cover) L.push(t('mbPkgSumCover'));
        line(S.badImages, 'mbPkgSumBadImages');
        if (S.failed.length) {
            L.push(t('mbPkgSumFailed', { v0: S.failed.length }));
            S.failed.slice(0, 12).forEach(function (f) { L.push('   • ' + f.name + ' — ' + f.reason); });
            if (S.failed.length > 12) L.push('   …');
        }
        if (!L.length) L.push(t('mbPkgSumNothing'));
        return L.join('\n');
    }

    /** 📂 / drop — any number of .mbz files. */
    async function mbImportPackages(fileList) {
        var files = Array.prototype.slice.call(fileList || []).filter(function (f) { return /\.mbz$/i.test(f.name || ''); });
        if (!files.length) { showStatus(t('mbPkgNoFiles'), 'error'); return null; }
        if (!mbLib.enabled) { await mbAlert(t('mbPkgNeedsStorage')); return null; }
        if (typeof mbIsReadOnly === 'function' && mbIsReadOnly()) return null;

        var total = files.reduce(function (n, f) { return n + (f.size || 0); }, 0);
        var est = await mbStorageEstimate();
        if (est.exact && est.quota) {
            var free = Math.max(0, est.quota - est.usage);
            if (free < total * 1.15 &&
                !(await mbConfirm(t('mbPkgSpaceLow', { v0: bytes(total), v1: bytes(free) }), { danger: true }))) return null;
        }
        if (typeof mbLibraryClosePanel === 'function') mbLibraryClosePanel();
        var S = await _mbLibQueue(function () { return importBatch(files); });
        await mbAlert(t('mbPkgSumTitle', { v0: files.length }) + '\n\n' + summaryText(S));
        return S;
    }

    /* ── Drop anywhere ────────────────────────────────────────── */
    var hint = null, depth = 0;
    function showHint(on) {
        if (!hint) {
            hint = document.createElement('div');
            hint.className = 'mb-pk-drophint';
            document.body.appendChild(hint);
        }
        hint.textContent = t('mbPkgDropHint');
        hint.classList.toggle('is-on', on);
    }
    function hasFiles(e) {
        var types = e.dataTransfer && e.dataTransfer.types;
        return types && Array.prototype.indexOf.call(types, 'Files') !== -1;
    }
    window.addEventListener('dragenter', function (e) { if (hasFiles(e)) { depth++; showHint(true); } });
    window.addEventListener('dragleave', function (e) { if (hasFiles(e)) { depth = Math.max(0, depth - 1); if (!depth) showHint(false); } });
    window.addEventListener('dragover', function (e) { if (hasFiles(e)) e.preventDefault(); });
    window.addEventListener('drop', function (e) {
        depth = 0; showHint(false);
        if (!hasFiles(e)) return;
        /* A cover or picture drop zone took it already. */
        if (e.defaultPrevented) return;
        e.preventDefault();
        var files = Array.prototype.filter.call(e.dataTransfer.files || [], function (f) { return /\.mbz$/i.test(f.name); });
        if (files.length) mbImportPackages(files);
    });

    window.mbSaveModulePackage = mbSaveModulePackage;
    window.mbExportProgrammePackage = mbExportProgrammePackage;
    window.mbExportProgrammeWord = mbExportProgrammeWord;
    window.mbExportAllPackages = mbExportAllPackages;
    window.mbImportPackages = mbImportPackages;
})();
