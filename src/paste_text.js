// ============================================================
// /src/paste_text.js — 3.74.0
// «📝 Paste text»: the clipboard's text into a content box in one press,
// CLEANED on the way in — which is what Ctrl+V does not do.
//
// WHAT THE CLEANING DOES (mbCleanPastedText)
// Text copied from a PDF arrives as lines cut at the page's width, with
// words hyphenated across lines, hard spaces, soft hyphens, tabs and
// runs of spaces. The cleaning:
//   • joins the lines of a paragraph back into one line (a blank line
//     still separates paragraphs);
//   • keeps a list item, a heading-like short line ending with «:», and a
//     line ending a sentence on its own line;
//   • rejoins a Latin word hyphenated at the end of a line («electri-
//     cal» → «electrical»);
//   • removes soft hyphens, zero-width characters and BOMs, turns hard
//     spaces and tabs into spaces, collapses runs of spaces;
//   • leaves at most one empty line between paragraphs.
// Arabic is handled the same way: Arabic sentence marks (؟ ؛ ۔) end a
// sentence, and tatweel used to justify text in a PDF (ـ) is removed.
//
// WHERE IT GOES
// Into the box at the cursor when the box has text (with a line break
// before it if needed), or as the box's text when it is empty. Never
// over what was typed. An `input` event follows, so every binding that
// listens (autosave, blocks.js, the autogrow) sees the change.
//
// TARGETS (data-args of the button)
//   ["content", N]  the information sheet's content card N
//   ["step", N]     the activity sheet's step N
//   ["id", "x"]     the textarea with id x
//   ["block"]       the body of the section the button sits in
// ============================================================

if (window.i18n && window.i18n.extend) window.i18n.extend({
    en: { ptBtn: 'Paste text', ptTip: 'Paste copied text here, cleaned: lines cut by a PDF joined again, extra spaces removed',
          ptDone: 'Text pasted and cleaned.', ptEmpty: 'The clipboard has no text. Copy the text first, then press Paste text.',
          ptDenied: 'The browser did not allow reading the clipboard. Click in the box and press Ctrl+V, or allow clipboard access for this site.' },
    fr: { ptBtn: 'Coller le texte', ptTip: 'Coller ici le texte copié, nettoyé : lignes coupées par un PDF rejointes, espaces en trop supprimés',
          ptDone: 'Texte collé et nettoyé.', ptEmpty: 'Le presse-papiers ne contient pas de texte. Copiez d’abord le texte, puis appuyez sur Coller le texte.',
          ptDenied: 'Le navigateur n’a pas autorisé la lecture du presse-papiers. Cliquez dans le cadre et appuyez sur Ctrl+V, ou autorisez le presse-papiers pour ce site.' },
    ar: { ptBtn: 'لصق نص', ptTip: 'لصق النص المنسوخ هنا بعد تنظيفه: وصل الأسطر التي قطعها ملف PDF وحذف الفراغات الزائدة',
          ptDone: 'تم لصق النص وتنظيفه.', ptEmpty: 'لا يوجد نص في الحافظة. انسخ النص أولاً ثم اضغط «لصق نص».',
          ptDenied: 'لم يسمح المتصفح بقراءة الحافظة. انقر داخل المربع واضغط Ctrl+V، أو اسمح بالوصول إلى الحافظة لهذا الموقع.' }
});

var _PT_LIST = /^\s*(?:[-\u2013\u2014\u2022\u25AA\u25E6\u25CF\u25CB\u25A0\u25A1\u27A2\u27A4\u25BA\u2713\u2714*\u00B7]|\(?\d{1,3}[.)\-]|\(?[a-zA-Z][.)]|\(?[\u0623-\u064A][.)\-]|[\u0660-\u0669\u06F0-\u06F9]{1,3}[.)\-])\s*/;

/** Clean text copied from a PDF, a web page or a document. */
function mbCleanPastedText(raw) {
    var s = String(raw == null ? '' : raw)
        .replace(/\r\n?/g, '\n')
        .replace(/[\u00AD\u200B\u200C\u200D\u2060\uFEFF]/g, '')   // soft hyphen, zero-width, BOM
        .replace(/\u0640+/g, '')                                   // tatweel
        .replace(/[\u00A0\u2007\u202F\t\f\v]/g, ' ')               // hard spaces, tabs
        .replace(/[\u2028\u2029]/g, '\n');
    var paras = s.split(/\n\s*\n+/);
    var out = paras.map(function (p) {
        var lines = p.split('\n').map(function (l) { return l.replace(/ {2,}/g, ' ').trim(); }).filter(Boolean);
        var res = [];
        var maxLen = lines.reduce(function (m, l) { return Math.max(m, l.length); }, 0);
        lines.forEach(function (line) {
            if (!res.length) { res.push(line); return; }
            var prev = res[res.length - 1];
            /* A new line is kept when it starts a list item, follows a
               line ending with «:», or follows a SHORT line that ends a
               sentence (a heading or the end of a list item). Otherwise
               it continues the line above — what a PDF cut. */
            var keep = _PT_LIST.test(line) || /:$/.test(prev) ||
                       (prev.length < 45 && /[.!?\u061F\u061B\u06D4\u2026]$/.test(prev)) ||
                       /* a heading: a short line with no sentence mark, the next starting a new sentence */
                       (prev.length < 60 && /^[A-Z]/.test(line) && !/[,;(\-\u2013.!?]$/.test(prev)) ||
                       /* much shorter than the paragraph's lines: it ended where the author ended it */
                       (maxLen >= 50 && prev.length < maxLen * 0.6);
            if (keep) { res.push(line); return; }
            if (/[A-Za-z]-$/.test(prev) && /^[a-z]/.test(line)) res[res.length - 1] = prev.slice(0, -1) + line;   // electri- cal
            else res[res.length - 1] = prev + ' ' + line;
        });
        return res.join('\n');
    }).filter(function (p) { return p.trim(); });
    return out.join('\n\n').replace(/ {2,}/g, ' ').trim();
}

function _ptT(k) { return window.i18n ? window.i18n.t(k) : k; }

function _ptTarget(kind, ref, btn) {
    if (kind === 'content') return document.querySelector('textarea[data-content-id="' + ref + '"]');
    if (kind === 'step') return document.querySelector('textarea[data-step-id="' + ref + '"]');
    if (kind === 'id') return document.getElementById(String(ref));
    if (kind === 'block') {
        var row = btn && btn.closest ? btn.closest('.mb-block') : null;
        return row ? row.querySelector('textarea.mb-block-body') : null;
    }
    return null;
}

/** Put `text` (already cleaned) into the box: at the cursor, or as its text. */
function mbInsertCleanText(ta, text) {
    if (!ta || !text) return;
    var cur = ta.value || '';
    if (!cur.trim()) {
        ta.value = text;
    } else {
        /* The cursor where the author left it: pressing the button takes
           the focus away, so the position saved on blur is used. */
        var saved = ta.__ptSel;
        var focused = document.activeElement === ta;
        var at = focused ? ta.selectionStart : (saved ? saved[0] : cur.length);
        var end = focused ? ta.selectionEnd : (saved ? saved[1] : at);
        if (!(at >= 0 && at <= cur.length)) at = cur.length;
        if (!(end >= at && end <= cur.length)) end = at;
        var before = cur.slice(0, at), after = cur.slice(end);
        var sepB = before && !/\n$/.test(before) ? '\n' : '';
        var sepA = after && !/^\n/.test(after) ? '\n' : '';
        ta.value = before + sepB + text + sepA + after;
        var pos = (before + sepB + text).length;
        try { ta.setSelectionRange(pos, pos); } catch (e) { /* not focusable */ }
    }
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    ta.dispatchEvent(new Event('change', { bubbles: true }));
    if (typeof mbAutoGrow === 'function') { try { mbAutoGrow(ta); } catch (e) { /* not a growing box */ } }
}

/* Where the cursor was when a box lost the focus (to the button). */
document.addEventListener('focusout', function (e) {
    var t = e.target;
    if (t && t.tagName === 'TEXTAREA' && typeof t.selectionStart === 'number') t.__ptSel = [t.selectionStart, t.selectionEnd];
}, true);
document.addEventListener('input', function (e) {
    if (e.target && e.target.tagName === 'TEXTAREA') e.target.__ptSel = null;   // typed since: the position is stale
}, true);

/** 📝 Paste text — events.js passes (kind, ref?, button, event). */
async function mbPasteText(kind, ref, btn) {
    if (ref && ref.nodeType === 1) { btn = ref; ref = null; }
    var ta = _ptTarget(kind, ref, btn);
    if (!ta) return;
    var raw = '';
    try {
        if (!navigator.clipboard || typeof navigator.clipboard.readText !== 'function') throw new Error('no-api');
        raw = await navigator.clipboard.readText();
    } catch (e) {
        if (typeof showStatus === 'function') showStatus(_ptT('ptDenied'), 'warning', 9000);
        try { ta.focus(); } catch (e2) { /* hidden */ }
        return;
    }
    var clean = mbCleanPastedText(raw);
    if (!clean) {
        if (typeof showStatus === 'function') showStatus(_ptT('ptEmpty'), 'warning', 7000);
        try { ta.focus(); } catch (e3) { /* hidden */ }
        return;
    }
    mbInsertCleanText(ta, clean);
    try { ta.focus(); } catch (e4) { /* hidden */ }
    if (typeof showStatus === 'function') showStatus(_ptT('ptDone'), 'success');
}

/** The button's markup, for the templates that build cards. */
function mbPasteTextBtnHtml(kind, ref, cls) {
    var args = JSON.stringify(ref === undefined ? [kind] : [kind, ref]).replace(/"/g, '&quot;');
    var tip = String(_ptT('ptTip')).replace(/"/g, '&quot;');
    return '<button type="button" class="' + (cls || 'btn-add-image btn-paste-text') + '" data-act="mbPasteText" data-args="' + args + '"' +
           ' title="' + tip + '" data-i18n-title="ptTip">📝 <span data-i18n="ptBtn">' + _ptT('ptBtn') + '</span></button>';
}
