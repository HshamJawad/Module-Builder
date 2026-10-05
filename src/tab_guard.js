// ============================================================
// /src/tab_guard.js
// One project, one writer (3.14.0).
//
// THE FAILURE THIS PREVENTS
// The tool open in two tabs on the same project: each tab autosaves what
// IT has on screen, and the last one to save silently undoes the other's
// work. Nothing ever said so.
//
// HOW
// A tab that edits a project holds a Web Lock named after it
// ("mb-project:<id>") for as long as the project is open. A second tab
// that opens the same project finds the lock taken and asks:
//
//   ✏️ Move editing here   the first tab saves, lets go of the lock and
//                          becomes read-only; this tab takes the lock
//   👁 Open read-only       this tab shows the project but never writes
//
// The tabs talk over a BroadcastChannel: "let go of this project",
// "I saved module X" (a read-only tab offers to refresh), "the list of
// projects changed" (every open panel repaints).
//
// A lock is released by the browser when its tab closes or crashes, so a
// project can never stay locked by a tab that no longer exists.
//
// Browsers without Web Locks (very old Safari) are not guarded — the
// tool behaves as before rather than refusing to work.
// ============================================================

var mbTabGuard = (function () {
    'use strict';

    var TAB = 'tab-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    var channel = (typeof BroadcastChannel !== 'undefined') ? new BroadcastChannel('module-builder') : null;
    var supported = !!(navigator.locks && navigator.locks.request);
    var held = null;          // { pid, release }
    var banner = null;
    var stale = false;        // another tab saved the project we are reading

    function name(pid) { return 'mb-project:' + pid; }
    function t(k, v) { return v ? window.i18n.tf(k, v) : window.i18n.t(k); }

    function post(msg) {
        if (!channel) return;
        msg.from = TAB;
        try { channel.postMessage(msg); } catch (e) { /* closed */ }
    }

    /* ── Locks ────────────────────────────────────────────────── */
    function release() {
        if (held) { var r = held.release; held = null; r(); }
    }

    /** Take the lock if it is free. Resolves true/false at once. */
    function tryAcquire(pid) {
        if (!supported) return Promise.resolve(true);
        if (held && held.pid === pid) return Promise.resolve(true);
        release();
        return new Promise(function (resolve) {
            navigator.locks.request(name(pid), { ifAvailable: true }, function (lock) {
                if (!lock) { resolve(false); return null; }
                return new Promise(function (rel) { held = { pid: pid, release: rel }; resolve(true); });
            }).catch(function () { resolve(false); });
        });
    }

    /** Wait for the lock, at most `ms`. */
    function waitAcquire(pid, ms) {
        if (!supported) return Promise.resolve(true);
        release();
        return new Promise(function (resolve) {
            var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
            var timer = setTimeout(function () { if (ctrl) ctrl.abort(); resolve(false); }, ms);
            navigator.locks.request(name(pid), ctrl ? { signal: ctrl.signal } : {}, function () {
                clearTimeout(timer);
                return new Promise(function (rel) { held = { pid: pid, release: rel }; resolve(true); });
            }).catch(function () { clearTimeout(timer); resolve(false); });
        });
    }

    /** Is this project being edited in ANOTHER tab right now? */
    function heldElsewhere(pid) {
        if (!supported || !navigator.locks.query) return Promise.resolve(false);
        if (held && held.pid === pid) return Promise.resolve(false);
        return navigator.locks.query().then(function (q) {
            return (q.held || []).some(function (l) { return l.name === name(pid); });
        }).catch(function () { return false; });
    }

    /** Ids of every project being edited in some tab (this one included). */
    function heldIds() {
        if (!supported || !navigator.locks.query) return Promise.resolve([]);
        return navigator.locks.query().then(function (q) {
            return (q.held || []).map(function (l) { return l.name; })
                .filter(function (n) { return n.indexOf('mb-project:') === 0; })
                .map(function (n) { return n.slice('mb-project:'.length); });
        }).catch(function () { return []; });
    }

    /**
     * Open `pid` for editing if possible. Resolves 'edit' or 'readonly'.
     * opts.ask === false: never ask — take it if free, else read-only.
     * opts.take === true: ask the other tab to let go without asking here.
     */
    function claim(pid, opts) {
        opts = opts || {};
        return tryAcquire(pid).then(function (ok) {
            if (ok) return 'edit';
            if (opts.ask === false) return 'readonly';
            var ask = opts.take ? Promise.resolve(true) : _mbDialog({
                type: 'confirm',
                message: t('mbTabBusy'),
                okLabel: t('mbTabMoveHere'),
                cancelLabel: t('mbTabReadOnly'),
                noBackdrop: true
            });
            return ask.then(function (move) {
                if (!move) return 'readonly';
                post({ type: 'yield', pid: pid });
                return waitAcquire(pid, 8000).then(function (got) {
                    if (!got) showStatus(t('mbTabNoAnswer'), 'error');
                    return got ? 'edit' : 'readonly';
                });
            });
        });
    }

    /* ── Read-only mode ───────────────────────────────────────── */
    function paintBanner() {
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'mb-ro-banner';
            banner.className = 'mb-ro-banner';
            banner.setAttribute('role', 'status');
            document.body.appendChild(banner);
            banner.addEventListener('click', function (e) {
                var b = e.target.closest('[data-ro]');
                if (!b) return;
                if (b.getAttribute('data-ro') === 'take') takeBack();
                if (b.getAttribute('data-ro') === 'refresh') refresh();
            });
        }
        var on = !!(window.mbLib && mbLib.readOnly);
        document.body.classList.toggle('mb-readonly', on);
        banner.hidden = !on;
        if (!on) return;
        banner.innerHTML = '<span>🔒 ' + t('mbTabBanner') + '</span>' +
            (stale ? '<button type="button" data-ro="refresh">' + t('mbTabRefresh') + '</button>' : '') +
            '<button type="button" data-ro="take">' + t('mbTabTakeBack') + '</button>';
    }

    function setReadOnly(on) {
        if (!window.mbLib) return;
        mbLib.readOnly = !!on;
        if (!on) stale = false;
        lockFields();
        paintBanner();
        if (typeof _mbLibEmit === 'function') _mbLibEmit();
    }

    /** Text fields cannot be typed into while read-only; drawn again on
     *  every render, so a watcher re-applies it. */
    var ro = null;
    function lockFields() {
        var on = !!(window.mbLib && mbLib.readOnly);
        var root = document.getElementById('main-container') || document.body;
        root.querySelectorAll('input[type="text"], input:not([type]), input[type="number"], input[type="url"], input[type="date"], textarea')
            .forEach(function (el) {
                if (on) { if (!el.readOnly) { el.readOnly = true; el.dataset.mbRo = '1'; } }
                else if (el.dataset.mbRo) { el.readOnly = false; delete el.dataset.mbRo; }
            });
        if (on && !ro && typeof MutationObserver !== 'undefined') {
            ro = new MutationObserver(function () { if (mbLib.readOnly) lockFields(); });
            ro.observe(root, { childList: true, subtree: true });
        } else if (!on && ro) { ro.disconnect(); ro = null; }
    }

    /* Actions that only look or move around are allowed; anything else
       is stopped before it reaches its handler. */
    var VIEW_ACTS = /^(switch|mbSelectModule|mbJump|prev|next|navigate|goTo|show|toggle|open|close|scroll|mbLibrary(Toggle|Open|Close)Panel|exportToDocx|mbExportTo|saveWork|mbSaveModulePackage|mbExportProgramme|mbExportAll|mbPreview|print|copy)/i;
    function blockEdits(e) {
        if (!window.mbLib || !mbLib.readOnly) return;
        var el = e.target && e.target.closest ? e.target.closest('[data-act]') : null;
        if (!el) {
            if (e.type === 'drop' || e.type === 'paste') { e.preventDefault(); e.stopImmediatePropagation(); flash(); }
            return;
        }
        if (el.closest('#mb-lib-panel, .mb-pk-overlay, .mb-dialog-overlay, #mb-ro-banner, .figma-toolbar')) return;
        var act = el.getAttribute('data-act') || '';
        if (VIEW_ACTS.test(act)) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        flash();
    }
    ['click', 'change', 'input', 'drop', 'paste'].forEach(function (type) {
        document.addEventListener(type, blockEdits, true);
    });

    var flashTimer = null;
    function flash() {
        if (!banner) return;
        banner.classList.add('is-flash');
        clearTimeout(flashTimer);
        flashTimer = setTimeout(function () { banner.classList.remove('is-flash'); }, 900);
    }

    /** "Edit here": take the project back from the other tab, then read
     *  it fresh from storage — the other tab may have changed it. */
    function takeBack() {
        if (!window.mbLib || !mbLib.project) return;
        var pid = mbLib.project.id, mid = mbLib.openId;
        claim(pid, { take: true }).then(function (r) {
            if (r !== 'edit') return;
            setReadOnly(false);
            mbLibraryReload(mid);
        });
    }
    function refresh() {
        if (!window.mbLib || !mbLib.project) return;
        stale = false;
        paintBanner();
        mbLibraryReload(mbLib.openId);
    }

    /* ── Messages from other tabs ─────────────────────────────── */
    if (channel) channel.onmessage = function (ev) {
        var m = ev.data || {};
        if (m.from === TAB || !window.mbLib) return;
        if (m.type === 'yield' && held && held.pid === m.pid) {
            /* Save what is on screen, THEN let go — the other tab reads
               the project the moment it gets the lock. */
            Promise.resolve(typeof mbLibrarySave === 'function' ? mbLibrarySave() : null).then(function () {
                setReadOnly(true);
                release();
                showStatus(t('mbTabMovedAway'), 'info');
            });
        } else if (m.type === 'saved' && mbLib.readOnly && mbLib.project && m.pid === mbLib.project.id) {
            stale = true;
            paintBanner();
        } else if (m.type === 'projects') {
            if (typeof _mbLibEmit === 'function') _mbLibEmit();
        }
    };

    window.addEventListener('mb:langchange', function () { if (banner && !banner.hidden) paintBanner(); });

    return {
        supported: supported,
        claim: claim,
        release: release,
        heldElsewhere: heldElsewhere,
        heldIds: heldIds,
        heldPid: function () { return held ? held.pid : null; },
        setReadOnly: setReadOnly,
        post: post,
        flash: flash
    };
})();

/** Read-only check for the editing functions: says why, and stops them. */
function mbIsReadOnly() {
    if (window.mbLib && mbLib.readOnly) {
        mbTabGuard.flash();
        showStatus(window.i18n.t('mbTabBlocked'), 'error');
        return true;
    }
    return false;
}
