// ============================================================
// /src/docx_bidi.js
// Arabic proofing language (w:lang) and RTL direction for DOCX export.
//
// Ported from DACUM Live Pro's exports_docx.js, where this problem was
// already solved. The red underlines under Arabic in the exported file
// are Word spell-checking Arabic against an English dictionary, because
// docx@7.8.2 has NO `language` option on a run: RunProperties never
// emits <w:lang>, so every run inherits Word's UI language.
//
// Direction and dictionary are two separate concerns and both are
// required:
//   bidirectional / rightToLeft  → READING ORDER
//   w:lang                       → DICTIONARY
// Fixing only the first gives correctly-ordered Arabic that is still
// underlined in red; fixing only the second gives clean Arabic running
// the wrong way.
//
// ONE ADAPTATION from DACUM: there, direction follows the interface
// language, because interface and document are the same language. Here
// they are not — the export language is chosen independently of both
// interfaceLang and contentLang — so `_rtl()` asks exportLang().
// ============================================================

/* OOXML splits the proofing language in two:
     w:val  → language of the Latin ("low ANSI") text in the run
     w:bidi → language of the complex-script (Arabic) text in the run
   Arabic runs get ar-IQ on both. The document default keeps en-US for
   w:val, because otherwise Word checks the English fragments that live
   inside Arabic modules — "NQF", "TVQF", ISO codes, tool names — against
   an Arabic dictionary and simply moves the red underlines elsewhere. */
var _MB_LANG_AR    = 'ar-IQ';
var _MB_LANG_LATIN = 'en-US';

/* Arabic + Arabic Supplement/Extended + Presentation Forms A/B. */
var _MB_ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
function _mbHasArabic(s) { return _MB_ARABIC_RE.test(String(s === null || s === undefined ? '' : s)); }

/* ── Which language is this DOCUMENT? ───────────────────────
   `exportLang()` answers "which side did the author ask for", and when
   they have never touched the export switch it answers by falling back
   to contentLang() — the side being EDITED. That fallback is what left
   Arabic modules exporting left-to-right: the author types Arabic into
   the English side of the pair (which is normal, and which the editor
   now handles correctly), so contentLang() says 'en', so exportLang()
   says 'en', so _mbRtl() said false, so every paragraph, table and
   margin in the file was built LTR — around text that is entirely
   Arabic. Nothing in that chain ever looked at the text.

   So the chain now ends at the text. An EXPLICIT choice on the export
   switch is still obeyed without question — that is the user telling us
   directly. Only the fallback changes: instead of inheriting an unrelated
   setting, it counts the scripts actually present in the project and
   goes with the dominant one. */

var _MB_DOC_LANG = null;

/* True once ANY run or paragraph holding Arabic has been constructed in
   this export. Diagnostic only.

   It used to decide table direction, and could not: it is a fact about
   the whole document, and a table needs a fact about ITSELF. One Arabic
   paragraph anywhere — a heading, a single bilingual field that fell
   back to its Arabic side — latched this to true and every table built
   afterwards came out mirrored, including the all-English ones. That is
   the LTR export whose marks carried a right-hand table handle.

   Table direction is now decided per table, from the Arabic actually
   inside it: see __mbAr below. Reset per export. */
var _mbSawArabic = false;

/* Keys whose values are never prose: base64 images alone would swamp
   the Latin count and force every Arabic module to LTR. */
var _MB_NON_PROSE = /^(id|uid|.*IdCounter|image|images|.*Image|qrImage|mime|mimeType|fileName|url|linkUrl|href|src|data|schemaVersion|duration|quantity|sheetNumber|level|version|seedKey)$/i;

function _mbCountScripts(value, acc, key) {
    if (value === null || value === undefined) return;
    if (typeof value === 'string') {
        if (key && _MB_NON_PROSE.test(key)) return;
        if (/^data:/.test(value)) return;               // embedded image
        if (value.length > 400 && !/\s/.test(value)) return;  // blob-ish
        var ar  = value.match(_MB_ARABIC_RE_G);
        var lat = value.match(/[A-Za-z]/g);
        if (ar)  acc.ar    += ar.length;
        if (lat) acc.latin += lat.length;
        return;
    }
    if (typeof value !== 'object') return;
    if (Array.isArray(value)) {
        for (var i = 0; i < value.length; i++) _mbCountScripts(value[i], acc, key);
        return;
    }
    Object.keys(value).forEach(function (k) {
        if (_MB_NON_PROSE.test(k)) return;
        _mbCountScripts(value[k], acc, k);
    });
}
var _MB_ARABIC_RE_G = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;

/**
 * Decide the document language once, at the top of the export, and hold
 * it for the whole run so every paragraph agrees with every other one.
 * Returns the language code, which is also the code to flatten with.
 */
function _mbBeginExport(rawState) {
    _mbSawArabic = false;
    var stored = null;
    try {
        if (typeof mbGetSetting === 'function' && typeof MB_KEYS === 'object') {
            stored = mbGetSetting(MB_KEYS.exportLang);
        }
    } catch (e) { /* settings unavailable — fall through to detection */ }

    /* Any language the tool actually ships wins outright. Tested against
       BILANG_CODES rather than a two-name list: with French added, the
       old `=== 'ar' || === 'en'` silently ignored an explicit choice of
       French and fell through to script DETECTION — which counts Latin
       letters and would have answered "English" for every French module
       ever written. */
    if (typeof BILANG_CODES !== 'undefined' && BILANG_CODES.indexOf(stored) !== -1) {
        _MB_DOC_LANG = stored;
        return _MB_DOC_LANG;
    }

    /* Script detection, for a project whose export language was never
       chosen. It can only answer "Arabic or Latin" — French and English
       share an alphabet and no amount of letter counting separates them.
       So a Latin-majority project falls to contentLang() when that is a
       Latin language, and to English otherwise: the side the author is
       editing is a far better guess than a coin flip between the two. */
    var acc = { ar: 0, latin: 0 };
    _mbCountScripts(rawState, acc);
    if (acc.ar || acc.latin) {
        if (acc.ar > acc.latin) {
            _MB_DOC_LANG = 'ar';
        } else {
            var cl = (typeof contentLang === 'function') ? contentLang() : 'en';
            _MB_DOC_LANG = (cl === 'ar') ? 'en' : cl;
        }
    } else {
        _MB_DOC_LANG = (typeof contentLang === 'function') ? contentLang() : 'en';
    }
    return _MB_DOC_LANG;
}

/* Cleared in a finally, so a failed export cannot leave a stale language
   pinned for the next one. */
function _mbEndExport() { _MB_DOC_LANG = null; _mbSawArabic = false; }

/** The language of the document currently being built. */
function _mbLang() {
    if (_MB_DOC_LANG) return _MB_DOC_LANG;
    return (typeof exportLang === 'function') ? exportLang() : 'en';
}

/** Direction of the DOCUMENT — see the note above. */
function _mbRtl() {
    return (typeof biIsRtl === 'function')
        ? biIsRtl(_mbLang())
        : _mbLang() === 'ar';
}

/**
 * Logical start alignment.
 *
 * This used to return `A.RIGHT` for Arabic, which reads as obviously
 * correct and is the single reason the exported tables looked wrong for
 * so long. Inside a paragraph carrying <w:bidi/>, w:jc is resolved
 * LOGICALLY, not geometrically: "left" means START (the right edge in
 * RTL) and "right" means END (the left edge). Asking for RIGHT in an
 * Arabic paragraph therefore pins the text to the LEFT — mirrored
 * columns wrapped around left-hugging text, exactly as reported.
 *
 * Verified by packing all five values and rendering them: no-jc, "left"
 * and "start" land on the right; "right" and "end" land on the left.
 *
 * AlignmentType.START does exist in docx 7.8.2 (a comment elsewhere in
 * this codebase claims otherwise) and is the honest way to say it: start
 * is the right edge in RTL and the left edge in LTR, so one value is
 * correct in both directions and there is nothing left to get backwards.
 */
function _mbStart(A) {
    if (A && A.START !== undefined) return A.START;
    return A.LEFT;          // "left" == start; correct in both directions
}

/* Arabic needs a face that actually carries the glyphs. Word falls back
   silently when it cannot find one, which is how a document ends up full
   of boxes on a machine without the original font. Arial ships
   everywhere and has full Arabic coverage, so it is the safe default
   rather than the pretty one. */
function _mbFont() { return _mbRtl() ? 'Arial' : 'Calibri'; }

/* The library exposes no class for <w:lang>, but its serializer passes
   any non-XmlComponent child straight through to the XML writer, so a
   plain node in the writer's own shape is a supported escape hatch and
   needs no fork of the library. */
function _mbLangNode(val, bidi) {
    return { 'w:lang': { _attr: { 'w:val': val, 'w:bidi': bidi } } };
}

/* Text carried by a run, given either as `text` or as string children. */
function _mbRunText(o) {
    var kids = Array.isArray(o.children) ? o.children.filter(function (c) { return typeof c === 'string'; }) : [];
    return [o.text || ''].concat(kids).join(' ');
}

/**
 * Wraps TextRun so every run holding Arabic is tagged at the source.
 * Doing it here rather than at ~150 call sites means a run added later
 * is covered automatically and cannot be forgotten.
 */
function _mbWithArabicLang(BaseRun) {
    return class extends BaseRun {
        constructor(options) {
            var o = (typeof options === 'string') ? { text: options } : (options || {});
            var txt = _mbRunText(o);
            /* NOT `_mbRtl() && ...` any more.
               Whether THIS run is Arabic is a fact about the characters
               in it. It is not a question the document-level flag is
               entitled to answer, and making it one is what produced a
               file whose columns were mirrored but whose text was still
               left-to-right: the Table asked the flag and got true, the
               paragraphs asked it and got false, and the two halves of
               the same document disagreed. A run holding Arabic is a
               complex-script run, full stop. */
            var isAr = _mbHasArabic(txt);
            if (isAr) _mbSawArabic = true;
            /* w:rtl marks the run as complex script, which is what makes
               Word read w:bidi (not w:val) as the proofing language and
               apply the complex-script font. Without it the tag is easy
               for Word to ignore. */
            super(isAr ? Object.assign({}, o, { rightToLeft: true }) : o);
            /* Stashed so the Paragraph wrapper can ask "do any of my runs
               hold Arabic?" — by then the runs are constructed objects
               and their text is no longer reachable any other way. */
            try { this.__mbText = txt; } catch (e) { /* frozen instance */ }
            /* And the answer itself, so a cell, a row and finally a
               Table can ask their own children rather than a global. */
            try { this.__mbAr = isAr; } catch (e) { /* frozen instance */ }
            if (isAr) {
                try {
                    /* Appended last, which is also where <w:lang> belongs
                       in the EG_RPrBase sequence — after w:rtl and w:cs. */
                    /* w:val stays en-US even on an Arabic run — a
                       DELIBERATE divergence from DACUM, which sets both
                       to ar-IQ. w:val governs the LATIN text inside the
                       run, and Arabic training modules are full of Latin
                       fragments: NQF, TVQF, ISO codes, equipment names.
                       Tagging the whole run ar-IQ makes Word check those
                       against an Arabic dictionary and simply relocates
                       the red underlines from the Arabic to the English.
                       w:bidi carries the Arabic. */
                    this.properties.addChildElement(_mbLangNode(_MB_LANG_LATIN, _MB_LANG_AR));
                } catch (e) {
                    console.warn('w:lang not applied to run:', e);
                }
            }
        }
    };
}

/**
 * `new Paragraph({ text: '...' })` builds its run internally with the
 * library's own TextRun, bypassing the wrapper above. Rewriting the
 * shorthand into an explicit child keeps those paragraphs from being the
 * one gap.
 */
function _mbWithArabicLangParagraph(BaseParagraph, WrappedRun) {
    return class extends BaseParagraph {
        constructor(options) {
            var o = (typeof options === 'string') ? { text: options } : (options || {});

            /* Does THIS paragraph hold Arabic? Its own `text`, or any run
               already handed to it — WrappedRun stashed each run's text on
               the instance precisely so this question is answerable here. */
            var own = String(o.text || '');
            var kids = Array.isArray(o.children) ? o.children : [];
            var hasAr = _mbHasArabic(own);
            for (var i = 0; i < kids.length && !hasAr; i++) {
                var k = kids[i];
                if (typeof k === 'string') { hasAr = _mbHasArabic(k); }
                else if (k && k.__mbText) { hasAr = _mbHasArabic(k.__mbText); }
            }
            if (hasAr) _mbSawArabic = true;

            /* Base direction. An Arabic paragraph is RTL because it is
               Arabic, not because a document-level flag says so — that
               flag is exactly what disagreed with itself and produced
               mirrored columns wrapped around left-aligned text.

               Note this overrides an explicit `bidirectional: false`,
               which looks wrong until you see where that false comes
               from: every call site writes `bidirectional: _mbRtl()`, so
               a mis-resolved flag arrives here as a deliberate-looking
               instruction to render Arabic left-to-right. Nobody ever
               means that. Honouring it was why the packed file contained
               zero <w:bidi/> elements even after the alignment was
               corrected. For paragraphs with no strong script of their
               own (blank spacers, bare numbers) the flag still decides,
               so an Arabic document stays internally consistent. */
            if (hasAr) {
                o = Object.assign({}, o, { bidirectional: true });
            } else if (_mbRtl() && o.bidirectional === undefined) {
                o = Object.assign({}, o, { bidirectional: true });
            }

            /* Alignment. THIS is the half that was missing from the
               exported file: <w:bidiVisual/> mirrored the columns, but
               every cell paragraph was aligned to the wrong edge, so the
               text sat against the left of a right-hand column — exactly
               the screenshot.

               The trap is that w:jc is LOGICAL inside a bidi paragraph:
               "right" means END, which in Arabic is the LEFT edge. Call
               sites that asked for RIGHT believed they were asking for
               the right-hand side, and were in fact asking for the left.
               RIGHT and END are therefore rewritten to START whenever the
               paragraph is RTL, as is a bare LEFT or no value at all.
               CENTER and BOTH are real typographic choices and are left
               untouched. */
            if (hasAr || _mbRtl()) {
                var A = (window.docx && window.docx.AlignmentType) || {};
                var START = (A.START !== undefined) ? A.START : 'left';
                var al = o.alignment;
                if (al === undefined || al === A.LEFT || al === 'left' ||
                    al === A.RIGHT || al === 'right' || al === A.END || al === 'end') {
                    o = Object.assign({}, o, { alignment: START });
                }
            }

            if (hasAr && o.text) {
                /* Route the shorthand through WrappedRun so the run gets
                   w:rtl and w:lang; `new Paragraph({ text })` would
                   otherwise build it with the library's own TextRun and
                   bypass every tag above. */
                var rest = Object.assign({}, o);
                delete rest.text;
                rest.children = [new WrappedRun({ text: o.text })].concat(o.children || []);
                super(rest);
            } else {
                super(o);
            }
            try { this.__mbAr = hasAr; } catch (e) { /* frozen instance */ }
        }
    };
}

/* ── Does this subtree hold Arabic? ─────────────────────────
   Each wrapper stamps `__mbAr` on itself as it is built, so by the time
   a Table is constructed its rows can be asked directly. The walk is one
   level per wrapper — cell asks its paragraphs, row asks its cells,
   table asks its rows — because the library's objects are opaque once
   constructed and their text is not reachable again from outside. */
function _mbNodeHasArabic(n) {
    if (!n) return false;
    if (typeof n === 'string') return _mbHasArabic(n);
    return n.__mbAr === true;
}

function _mbAnyArabic(list) {
    return Array.isArray(list) && list.some(_mbNodeHasArabic);
}

/** Wraps TableCell / TableRow purely to carry the flag upward. */
function _mbWithArabicFlag(Base) {
    return class extends Base {
        constructor(options) {
            var o = options || {};
            var ar = _mbAnyArabic(o.children);
            super(o);
            try { this.__mbAr = ar; } catch (e) { /* frozen instance */ }
        }
    };
}

/**
 * Document-level fallback: <w:lang> inside docDefaults/rPrDefault, so
 * anything not produced through the wrappers — and any text the user
 * types into the exported file afterwards — still gets the right
 * dictionary. docx@7.8.2 builds docDefaults from
 * `styles.default.document.run`, which also has no language option, so
 * the node is added to the tree the library already built. The walk is
 * by rootKey and tolerates the structure moving in a future version.
 */
function _mbApplyDocDefaultsLang(doc) {
    if (!_mbRtl()) return;
    try {
        var find = function (node, key) {
            if (!node || typeof node !== 'object') return null;
            if (node.rootKey === key) return node;
            if (!Array.isArray(node.root)) return null;
            for (var i = 0; i < node.root.length; i++) {
                var hit = find(node.root[i], key);
                if (hit) return hit;
            }
            return null;
        };
        var defaults = find(doc.Styles, 'w:docDefaults');
        var rPr = defaults && find(defaults, 'w:rPr');
        if (rPr) rPr.addChildElement(_mbLangNode(_MB_LANG_LATIN, _MB_LANG_AR));
    } catch (e) {
        /* Per-run tags already carry the fix; a missed default is cosmetic. */
        console.warn('w:lang not applied to docDefaults:', e);
    }
}

/**
 * Wraps Table so an Arabic export gets <w:bidiVisual/>.
 *
 * This is the table-level counterpart of paragraph `bidirectional`, and
 * it is what actually mirrors the COLUMN ORDER. Without it an Arabic
 * table renders its first column on the far left — so a checklist reads
 * from the wrong end even though every cell inside it is correct Arabic.
 * Word calls this "table direction"; it is separate from the direction
 * of the paragraphs in the cells, and both are needed.
 */
function _mbWithRtlTable(BaseTable) {
    return class extends BaseTable {
        constructor(options) {
            var o = options || {};
            /* THIS table's own rows, not a document-wide flag. A table
               mirrors its columns if the document is Arabic, or if the
               text inside this particular table is. An English table in
               a mixed project stays LTR, which the old sticky flag could
               not express: it went true on the first Arabic paragraph
               anywhere and stayed true for the rest of the export. */
            var rtl = _mbRtl() || _mbAnyArabic(o.rows);
            super(rtl ? Object.assign({}, o, { visuallyRightToLeft: true }) : o);
            /* Propagate, so a table nested in a cell reaches the outer
               table the same way a paragraph does. */
            try { this.__mbAr = _mbAnyArabic(o.rows); } catch (e) { /* frozen instance */ }
        }
    };
}

/**
 * Export-language string lookup.
 *
 * NOT window.i18n.t(): that follows the INTERFACE language. The document
 * must follow the EXPORT language. Someone working in an English
 * interface exporting an Arabic module would otherwise get English table
 * headers inside an Arabic deliverable — which is exactly what the
 * exported sample showed.
 */
function _mbT(key) {
    /* _mbLang(), not exportLang(): the boilerplate must be in the same
       language as the document it sits in. With the old call, a project
       detected as Arabic still got English table headers, because
       exportLang() was answering from contentLang(). */
    return window.i18n ? window.i18n.tIn(key, _mbLang()) : key;
}
function _mbTf(key, vars) {
    return window.i18n ? window.i18n.tfIn(key, _mbLang(), vars) : key;
}

/**
 * True when `text` already opens with this key's prefix in ANY locale.
 *
 * Used by the "do not prefix the title twice" guard, which previously
 * tested a hard-coded English regex and therefore never fired on an
 * Arabic title — producing «محصلة التعلم 1: محصلة التعلم 1: …».
 * The prefix is taken as everything before the first placeholder that
 * carries the user's own text.
 */
function _mbTitledAlready(text, key) {
    var s = String(text === null || text === undefined ? '' : text).trim();
    if (!s || !window.i18n) return false;
    if (/^\s*\d+\s*:/.test(s)) return true;              // bare "1: …"
    /* Every locale the tool ships, not a hard-coded pair: a title
       prefixed in French, or a criteria heading left at the French
       default, has to be recognised as ours too. */
    var locales = (typeof BILANG_CODES !== 'undefined') ? BILANG_CODES : ['en', 'ar'];
    for (var i = 0; i < locales.length; i++) {
        var pattern = window.i18n.tIn(key, locales[i]);
        if (typeof pattern !== 'string') continue;
        var head = pattern.split('{')[0].trim();           // "Learning Outcome"
        if (head && s.indexOf(head) === 0) return true;
    }
    return false;
}

/**
 * Export-language lookup for a field whose stored value MAY STILL BE
 * OUR OWN BOILERPLATE.
 *
 * `stored || _mbT(key)` is not enough on its own, and this is the second
 * half of the Performance-Criteria bug. Older builds wrote the English
 * default into the criteria title / instruction / footer as a real
 * value, so every project file made before the fix carries English text
 * in those fields — text the author never typed and cannot be expected
 * to find and delete in each activity sheet. The `||` fallback sees a
 * non-empty string and dutifully prints English into an Arabic module.
 *
 * So: compare the stored text against this key's wording in EVERY
 * locale we ship. If it matches one, it is ours, not theirs, and it is
 * re-emitted in the export language. Anything else is the author's
 * wording and is printed untouched — a rename must always survive.
 *
 * Placeholders ({v0} — the sheet number) are matched as wildcards, so
 * "Performance Criteria Check List/ 2-3" is recognised too.
 */
function _mbBoilerplate(stored, key, vars) {
    var out = vars ? _mbTf(key, vars) : _mbT(key);
    var s = String(stored === null || stored === undefined ? '' : stored).trim();
    if (!s) return out;
    if (!window.i18n) return s;

    /* Every locale the tool ships, not a hard-coded pair: a title
       prefixed in French, or a criteria heading left at the French
       default, has to be recognised as ours too. */
    var locales = (typeof BILANG_CODES !== 'undefined') ? BILANG_CODES : ['en', 'ar'];
    for (var i = 0; i < locales.length; i++) {
        var pattern = window.i18n.tIn(key, locales[i]);
        if (typeof pattern !== 'string' || !pattern) continue;
        if (pattern.trim() === s) return out;
        var rx = pattern
            .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')      // escape first
            .replace(/\\\{[\s\S]*?\\\}/g, '[\\s\\S]*');  // then re-open {v0}
        try {
            if (new RegExp('^' + rx + '$').test(s)) return out;
        } catch (e) { /* a pattern that will not compile is simply not ours */ }
    }
    return s;   // the author's own wording — untouched
}

/**
 * Returns the docx namespace with TextRun and Paragraph replaced by the
 * Arabic-aware subclasses. The export destructures from this instead of
 * `window.docx`, so no call site changes.
 */
function mbDocxLib() {
    var lib = window.docx;
    var WrappedRun = _mbWithArabicLang(lib.TextRun);
    return Object.assign({}, lib, {
        TextRun: WrappedRun,
        Paragraph: _mbWithArabicLangParagraph(lib.Paragraph, WrappedRun),
        /* TableCell and TableRow do nothing to the XML — they only carry
           `__mbAr` up from the paragraphs so Table can read it. They must
           come from here for that chain to be unbroken: a cell built from
           raw window.docx is a gap, and its table falls back to the
           document flag. */
        TableCell: _mbWithArabicFlag(lib.TableCell),
        TableRow:  _mbWithArabicFlag(lib.TableRow),
        Table: _mbWithRtlTable(lib.Table)
    });
}
