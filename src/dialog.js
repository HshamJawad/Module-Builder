// ============================================================
// /src/dialog.js
// One translated modal, replacing 42 native alert/confirm/prompt calls.
//
// Native dialogs cannot be part of a translated interface. `alert` and
// `confirm` render their buttons in the BROWSER's locale, not the page's,
// so an Arabic interface on an English Windows shows an Arabic question
// under an "OK / Cancel" pair — and `prompt` cannot be relabelled at all.
// They also block the main thread, so nothing can repaint underneath
// them, and on iOS Safari a page may suppress them outright after
// several in a row.
//
// The replacements are async and return Promises. That is the real cost
// of this change: every caller of a confirm becomes async, because a
// modal cannot block. See DIALOG_ASYNC_CALLERS in REFACTOR_NOTES.
// ============================================================

var _mbDialogOpen = null;

function _mbDialogT(key, fallback) {
    if (window.i18n && window.i18n.has && window.i18n.has(key)) return window.i18n.t(key);
    return fallback;
}

function _mbBuildDialog(opts) {
    var overlay = document.createElement('div');
    overlay.className = 'mb-dialog-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    var box = document.createElement('div');
    box.className = 'mb-dialog';
    /* Direction follows the INTERFACE, not the content: these are the
       tool's own words. A confirmation about an Arabic step is still a
       sentence the tool is speaking. */
    box.setAttribute('dir', (window.i18n && window.i18n.isRTL && window.i18n.isRTL()) ? 'rtl' : 'ltr');

    var msg = document.createElement('div');
    msg.className = 'mb-dialog-msg';
    /* textContent, never innerHTML: several of these messages interpolate
       a sheet title the user typed. */
    /* white-space: pre-line in the stylesheet keeps the \n breaks these
       messages rely on — they were written for native dialogs, which
       honour newlines, and a bullet list collapsed onto one line reads
       as a wall of text right where the user is deciding to delete. */
    msg.textContent = opts.message;
    box.appendChild(msg);

    var input = null;
    if (opts.type === 'prompt') {
        input = document.createElement('input');
        input.type = 'text';
        input.className = 'mb-dialog-input';
        input.value = opts.defaultValue || '';
        /* The prompt is asking for CONTENT, so the field follows
           contentLang while the surrounding dialog follows the interface
           language. This is the one place the two directions meet, and
           getting it wrong means typing Arabic into a left-aligned box. */
        var cl = (typeof contentLang === 'function') ? contentLang() : 'en';
        var rtl = (typeof biIsRtl === 'function') ? biIsRtl(cl) : (cl === 'ar');
        input.setAttribute('dir', rtl ? 'rtl' : 'ltr');
        input.style.textAlign = rtl ? 'right' : 'left';
        box.appendChild(input);
    }

    var row = document.createElement('div');
    row.className = 'mb-dialog-actions';

    var okBtn = document.createElement('button');
    okBtn.type = 'button';
    okBtn.className = 'mb-dialog-btn mb-dialog-ok' + (opts.danger ? ' is-danger' : '');
    okBtn.textContent = opts.okLabel;

    var cancelBtn = null;
    if (opts.type !== 'alert') {
        cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'mb-dialog-btn mb-dialog-cancel';
        cancelBtn.textContent = opts.cancelLabel;
    }

    /* Cancel first in the DOM, confirm second. In an RTL layout the row
       reverses visually, so the confirm button stays on the side the user
       expects in each direction without a second rule. */
    if (cancelBtn) row.appendChild(cancelBtn);
    row.appendChild(okBtn);
    box.appendChild(row);
    overlay.appendChild(box);

    return { overlay: overlay, box: box, input: input, ok: okBtn, cancel: cancelBtn };
}

function _mbDialog(opts) {
    return new Promise(function (resolve) {
        /* Two dialogs at once would stack invisibly and leak a listener.
           The second request wins; the first resolves as cancelled. */
        if (_mbDialogOpen) _mbDialogOpen();

        var d = _mbBuildDialog(opts);
        document.body.appendChild(d.overlay);
        var prevFocus = document.activeElement;

        function close(result) {
            document.removeEventListener('keydown', onKey, true);
            if (d.overlay.parentNode) d.overlay.parentNode.removeChild(d.overlay);
            _mbDialogOpen = null;
            if (prevFocus && prevFocus.focus) prevFocus.focus();
            resolve(result);
        }
        _mbDialogOpen = function () { close(opts.type === 'alert' ? undefined : null); };

        function onKey(e) {
            if (e.key === 'Escape') { e.preventDefault(); close(opts.type === 'alert' ? undefined : null); }
            /* Enter confirms — except in a prompt whose field is empty,
               where confirming would create an untitled module. */
            if (e.key === 'Enter' && opts.type !== 'alert') {
                if (opts.type === 'prompt' && !d.input.value.trim()) return;
                e.preventDefault(); d.ok.click();
            }
        }
        document.addEventListener('keydown', onKey, true);

        d.ok.addEventListener('click', function () {
            if (opts.type === 'alert')   return close(undefined);
            if (opts.type === 'confirm') return close(true);
            close(d.input.value);
        });
        if (d.cancel) d.cancel.addEventListener('click', function () {
            close(opts.type === 'confirm' ? false : null);
        });
        d.overlay.addEventListener('click', function (e) {
            /* Clicking the backdrop cancels — but never on a destructive
               confirm, where a stray click would delete a sheet. */
            if (e.target === d.overlay && !opts.danger) {
                close(opts.type === 'confirm' ? false : (opts.type === 'alert' ? undefined : null));
            }
        });

        setTimeout(function () { (d.input || d.ok).focus(); if (d.input) d.input.select(); }, 0);
    });
}

/* ── Public API — same shapes as the natives, but Promise-returning ── */

function mbAlert(message) {
    return _mbDialog({ type: 'alert', message: message,
                       okLabel: _mbDialogT('dlgOk', 'OK') });
}

function mbConfirm(message, opts) {
    opts = opts || {};
    return _mbDialog({ type: 'confirm', message: message, danger: !!opts.danger,
                       okLabel: opts.okLabel || _mbDialogT(opts.danger ? 'dlgDelete' : 'dlgConfirm',
                                                           opts.danger ? 'Delete' : 'Confirm'),
                       cancelLabel: _mbDialogT('dlgCancel', 'Cancel') });
}

function mbPrompt(message, defaultValue) {
    return _mbDialog({ type: 'prompt', message: message, defaultValue: defaultValue || '',
                       okLabel: _mbDialogT('dlgSave', 'Save'),
                       cancelLabel: _mbDialogT('dlgCancel', 'Cancel') });
}
