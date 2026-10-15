// ============================================================
// /src/source_ai.js
// 📚 Draft from sources — an information sheet written by the AI from
// pages the trainer chooses in a book or document (3.45.0, phase 1).
//
// WHAT IT DOES
// The trainer adds a source (a PDF, a text / Markdown / HTML file, or
// text pasted from a web page), chooses the pages that cover the sheet's
// topic, and presses ✨ Generate. Only those pages are sent to the AI,
// marked [[Page n]], with the outcome and its criteria. The answer is a
// DRAFT shown in the dialog: the trainer ticks the sections to keep and
// adds them to the information sheet open in the tab. Each section ends
// with the pages it came from, and the source goes into References.
//
// WHY PAGES AND NOT RAG
// No index, no embeddings, no server storage: the trainer knows which
// chapter covers the topic, and a model given those pages whole writes
// from them rather than from fragments. Cost stays proportional to the
// pages chosen (shown before sending).
//
// WHERE THINGS LIVE
//   Sources        IndexedDB "mb-sources", on this device, for every
//                  project — a book serves many modules. Not in the
//                  project file or the .mbz package. Only the text is
//                  kept, page by page; the PDF itself is not stored.
//   The setting    settings.sourceDrafts (Settings → Misc), OFF by
//                  default: the button does not appear until it is on.
//   The AI         the same backend as the rest of Module Builder
//                  (/api/generate-dacum), so the key stays on the server.
//
// Off by default, and nothing here runs until the dialog is opened: the
// PDF reader (vendor/pdfjs-3.11.174) is loaded on the first PDF.
// ============================================================

var SRC_PDF_LIB = 'vendor/pdfjs-3.11.174/pdf.min.js';
var SRC_PDF_WORKER = 'vendor/pdfjs-3.11.174/pdf.worker.min.js';
var SRC_MAX_PAGES = 40;          // pages per request
var SRC_MAX_CHARS = 120000;      // characters per request (≈ 30–60k tokens)
var SRC_PAGE_CHARS = 3000;       // a "page" of a text file or pasted text
var SRC_OUT_TOKENS = 4000;       // the backend's max_tokens for this endpoint
var SRC_RATE_IN = 3, SRC_RATE_OUT = 15;   // USD per million tokens (Claude Sonnet, approximate)

/* ── Strings ────────────────────────────────────────────────
   Own table, like link_modal.js and exports_pptx.js: a dialog that only
   exists here cannot come out untranslated because a key was missed in
   the main dictionary. */
var _SRC_STRINGS = {
    en: {
        btn: 'Draft from sources',
        title: 'Draft from sources',
        intro: 'The AI writes a draft of this information sheet from the pages you choose — only those pages are sent. Review every section before you keep it.',
        sources: 'Sources on this device',
        none: 'No sources yet. Add a PDF or a text file, or paste text from a web page.',
        addFile: '➕ PDF or text file',
        paste: '📋 Paste text',
        pasteName: 'Name',
        pasteNamePh: 'e.g. Electrical safety — web page',
        pasteText: 'Text',
        pasteAdd: 'Add',
        pages: 'pages',
        del: 'Delete',
        delAsk: 'Delete «{v0}» from this device?',
        ref: 'In References as',
        refPh: 'Author (year). Title. Publisher.',
        range: 'Pages to use',
        from: 'from', to: 'to', of: 'of {v0}',
        preview: 'Check the extracted text (page {v0})',
        emptyPage: '(no text on this page)',
        scanned: 'Most pages of this PDF have no text — it looks scanned. Text must be recognised (OCR) before it can be used.',
        sheet: 'The sheet',
        topic: 'Topic of the information sheet',
        topicPh: 'e.g. Measuring voltage with a multimeter',
        optSelf: 'Also draft a self-check and its answer key (only if the sheet has none)',
        optCite: 'End each section with its source and pages',
        estimate: '≈ {v0} tokens sent, up to {v1} returned · ≈ ${v2} at Claude Sonnet rates (approximate)',
        tooMany: 'Choose at most {v0} pages, or fewer pages of text, per request.',
        needSource: 'Choose a source first.',
        needTopic: 'Write the topic of the sheet.',
        needLo: 'Open a learning outcome first (Basic Info tab).',
        generate: '✨ Generate',
        cancel: 'Cancel',
        close: 'Close',
        back: '◀ Back',
        reading: 'Reading page {v0} of {v1}…',
        added: '«{v0}» added — {v1} pages.',
        noText: 'No text could be read from this file.',
        badFile: 'This file type is not supported. Use PDF, TXT, MD or HTML.',
        working: 'Writing the draft… this can take up to a minute.',
        failed: 'The AI service did not answer. Check the connection and try again.',
        rate: 'The AI service is busy (rate limit). Wait a minute and try again.',
        badReply: 'The answer could not be read. Try again, or choose fewer pages.',
        result: 'Draft — tick what to keep',
        objective: 'Objective',
        selfCheck: 'Self-check',
        answers: 'Answer key',
        notCovered: 'Not found in these pages',
        keep: '⤵ Add to the sheet',
        keepNone: 'Tick at least one part.',
        done: 'Added to the sheet: {v0} section(s). Source added to References.',
        offline: 'You are offline. The AI needs a connection.',
        privacy: 'Sources stay in this browser. The pages you choose are sent to the AI service when you press Generate.',
        copyNote: 'Use sources you may use for training. The draft paraphrases; check quotations and figures against the book.'
    },
    fr: {
        btn: 'Rédiger depuis les sources',
        title: 'Rédiger depuis les sources',
        intro: 'L’IA rédige un brouillon de cette fiche d’information à partir des pages que vous choisissez — seules ces pages sont envoyées. Relisez chaque section avant de la garder.',
        sources: 'Sources sur cet appareil',
        none: 'Aucune source. Ajoutez un PDF ou un fichier texte, ou collez le texte d’une page web.',
        addFile: '➕ PDF ou fichier texte',
        paste: '📋 Coller du texte',
        pasteName: 'Nom',
        pasteNamePh: 'ex. Sécurité électrique — page web',
        pasteText: 'Texte',
        pasteAdd: 'Ajouter',
        pages: 'pages',
        del: 'Supprimer',
        delAsk: 'Supprimer « {v0} » de cet appareil ?',
        ref: 'Dans les références',
        refPh: 'Auteur (année). Titre. Éditeur.',
        range: 'Pages à utiliser',
        from: 'de', to: 'à', of: 'sur {v0}',
        preview: 'Vérifier le texte extrait (page {v0})',
        emptyPage: '(pas de texte sur cette page)',
        scanned: 'La plupart des pages de ce PDF n’ont pas de texte — il semble numérisé. Le texte doit être reconnu (OCR) avant de pouvoir servir.',
        sheet: 'La fiche',
        topic: 'Sujet de la fiche d’information',
        topicPh: 'ex. Mesurer une tension au multimètre',
        optSelf: 'Rédiger aussi une auto-évaluation et son corrigé (si la fiche n’en a pas)',
        optCite: 'Terminer chaque section par sa source et ses pages',
        estimate: '≈ {v0} jetons envoyés, jusqu’à {v1} reçus · ≈ {v2} $ au tarif Claude Sonnet (approximatif)',
        tooMany: 'Choisissez au plus {v0} pages, ou moins de texte, par demande.',
        needSource: 'Choisissez d’abord une source.',
        needTopic: 'Indiquez le sujet de la fiche.',
        needLo: 'Ouvrez d’abord un résultat d’apprentissage (onglet Informations).',
        generate: '✨ Générer',
        cancel: 'Annuler',
        close: 'Fermer',
        back: '◀ Retour',
        reading: 'Lecture de la page {v0} sur {v1}…',
        added: '« {v0} » ajouté — {v1} pages.',
        noText: 'Aucun texte n’a pu être lu dans ce fichier.',
        badFile: 'Type de fichier non pris en charge. Utilisez PDF, TXT, MD ou HTML.',
        working: 'Rédaction du brouillon… cela peut prendre une minute.',
        failed: 'Le service d’IA n’a pas répondu. Vérifiez la connexion et réessayez.',
        rate: 'Le service d’IA est saturé. Attendez une minute et réessayez.',
        badReply: 'La réponse n’a pas pu être lue. Réessayez ou choisissez moins de pages.',
        result: 'Brouillon — cochez ce que vous gardez',
        objective: 'Objectif',
        selfCheck: 'Auto-évaluation',
        answers: 'Corrigé',
        notCovered: 'Absent de ces pages',
        keep: '⤵ Ajouter à la fiche',
        keepNone: 'Cochez au moins une partie.',
        done: 'Ajouté à la fiche : {v0} section(s). Source ajoutée aux références.',
        offline: 'Vous êtes hors ligne. L’IA a besoin d’une connexion.',
        privacy: 'Les sources restent dans ce navigateur. Les pages choisies sont envoyées au service d’IA quand vous cliquez sur Générer.',
        copyNote: 'Utilisez des sources autorisées pour la formation. Le brouillon reformule ; vérifiez citations et valeurs dans l’ouvrage.'
    },
    ar: {
        btn: 'صياغة من المصادر',
        title: 'صياغة من المصادر',
        intro: 'يكتب الذكاء الاصطناعي مسودة لورقة المعلومات هذه من الصفحات التي تختارها، ولا يُرسل غيرها. راجع كل فقرة قبل اعتمادها.',
        sources: 'المصادر على هذا الجهاز',
        none: 'لا توجد مصادر بعد. أضف ملف PDF أو ملفاً نصياً، أو الصق نصاً من صفحة ويب.',
        addFile: '➕ ملف PDF أو نص',
        paste: '📋 لصق نص',
        pasteName: 'الاسم',
        pasteNamePh: 'مثال: السلامة الكهربائية — صفحة ويب',
        pasteText: 'النص',
        pasteAdd: 'إضافة',
        pages: 'صفحة',
        del: 'حذف',
        delAsk: 'حذف «{v0}» من هذا الجهاز؟',
        ref: 'يظهر في المراجع هكذا',
        refPh: 'المؤلف (السنة). العنوان. الناشر.',
        range: 'الصفحات المستخدمة',
        from: 'من', to: 'إلى', of: 'من أصل {v0}',
        preview: 'تحقق من النص المستخرج (صفحة {v0})',
        emptyPage: '(لا يوجد نص في هذه الصفحة)',
        scanned: 'معظم صفحات هذا الملف بلا نص، ويبدو أنه مصوَّر ضوئياً. يلزم تحويله إلى نص (OCR) قبل استخدامه.',
        sheet: 'الورقة',
        topic: 'موضوع ورقة المعلومات',
        topicPh: 'مثال: قياس الجهد بجهاز الملتيميتر',
        optSelf: 'صياغة اختبار ذاتي ومفتاح إجاباته أيضاً (إن لم يكن في الورقة)',
        optCite: 'إنهاء كل فقرة بمصدرها وصفحاتها',
        estimate: '≈ {v0} وحدة نصية تُرسل، وحتى {v1} تُستلم · ≈ {v2} دولار بأسعار Claude Sonnet (تقريبي)',
        tooMany: 'اختر {v0} صفحة كحد أقصى، أو نصاً أقل، في الطلب الواحد.',
        needSource: 'اختر مصدراً أولاً.',
        needTopic: 'اكتب موضوع الورقة.',
        needLo: 'افتح محصلة تعلم أولاً (تبويب المعلومات الأساسية).',
        generate: '✨ توليد',
        cancel: 'إلغاء',
        close: 'إغلاق',
        back: 'رجوع ▶',
        reading: 'قراءة الصفحة {v0} من {v1}…',
        added: 'أُضيف «{v0}» — {v1} صفحة.',
        noText: 'تعذّر استخراج نص من هذا الملف.',
        badFile: 'نوع الملف غير مدعوم. استخدم PDF أو TXT أو MD أو HTML.',
        working: 'تجري كتابة المسودة… قد يستغرق ذلك دقيقة.',
        failed: 'لم تستجب خدمة الذكاء الاصطناعي. تحقق من الاتصال وأعد المحاولة.',
        rate: 'خدمة الذكاء الاصطناعي مشغولة الآن. انتظر دقيقة وأعد المحاولة.',
        badReply: 'تعذّرت قراءة الإجابة. أعد المحاولة أو اختر صفحات أقل.',
        result: 'المسودة — حدّد ما تريد الاحتفاظ به',
        objective: 'الهدف',
        selfCheck: 'الاختبار الذاتي',
        answers: 'مفتاح الإجابات',
        notCovered: 'غير موجود في هذه الصفحات',
        keep: '⤵ إضافة إلى الورقة',
        keepNone: 'حدّد جزءاً واحداً على الأقل.',
        done: 'أُضيف إلى الورقة: {v0} فقرة. وأُضيف المصدر إلى المراجع.',
        offline: 'أنت غير متصل. يحتاج الذكاء الاصطناعي إلى اتصال.',
        privacy: 'تبقى المصادر في هذا المتصفح، ولا تُرسل إلا الصفحات المختارة عند الضغط على «توليد».',
        copyNote: 'استخدم مصادر مسموحاً استخدامها في التدريب. المسودة تعيد الصياغة؛ تحقق من الاقتباسات والقيم في الكتاب.'
    }
};

/* The line that ends a section, in the CONTENT language. */
var _SRC_CITE = {
    en: '(Source: {s}, p. {p})',
    fr: '(Source : {s}, p. {p})',
    ar: '(المصدر: {s}، ص {p})'
};
var _SRC_LANG_NAMES = { en: 'English', ar: 'Arabic', fr: 'French' };
var _SRC_STYLE = {
    ar: 'Write Modern Standard Arabic in a clear, formal register suited to vocational trainees. Keep technical terms, units, codes and standards in their usual form; Western digits.',
    fr: 'Write clear professional French suited to vocational trainees. Use the typographic apostrophe (’).',
    en: 'Write clear, plain professional English suited to vocational trainees.'
};

function _srcUiLang() {
    try {
        var l = window.i18n && window.i18n.getLang && window.i18n.getLang();
        if (_SRC_STRINGS[l]) return l;
    } catch (e) { /* dictionary not up */ }
    return 'en';
}
function _srcT(k, vars) {
    var s = (_SRC_STRINGS[_srcUiLang()] || _SRC_STRINGS.en)[k] || _SRC_STRINGS.en[k] || k;
    if (vars) Object.keys(vars).forEach(function (n) { s = s.split('{' + n + '}').join(String(vars[n])); });
    return s;
}
function _srcEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
}
function _srcContentLang() {
    return (typeof contentLang === 'function') ? contentLang() : 'en';
}

/* ── The setting ───────────────────────────────────────────── */
function mbSrcEnabled() {
    try { if (typeof _wsGet === 'function') return (_wsGet() || {}).sourceDrafts === true; } catch (e) { /* fall through */ }
    return false;
}

/** Show or hide the button on the information sheet, in the UI language. */
function mbSrcPaintButton() {
    var b = document.getElementById('mb-src-btn');
    if (!b) return;
    b.hidden = !mbSrcEnabled();
    var l = document.getElementById('mb-src-btn-label');
    if (l) l.textContent = _srcT('btn');
}
if (typeof window !== 'undefined') {
    window.addEventListener('mb:settingschange', mbSrcPaintButton);
    window.addEventListener('mb:langchange', mbSrcPaintButton);
    document.addEventListener('DOMContentLoaded', mbSrcPaintButton);
}

/* ── The library (IndexedDB) ──────────────────────────────────
   { id, name, ref, kind: 'pdf' | 'text', pages: [string], added } */
var mbSources = (function () {
    var DB = 'mb-sources', STORE = 'sources';
    var _db = null;
    function open() {
        if (_db) return Promise.resolve(_db);
        return new Promise(function (resolve, reject) {
            var rq = indexedDB.open(DB, 1);
            rq.onupgradeneeded = function () {
                var db = rq.result;
                if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
            };
            rq.onsuccess = function () { _db = rq.result; resolve(_db); };
            rq.onerror = function () { reject(rq.error); };
        });
    }
    function tx(mode, fn) {
        return open().then(function (db) {
            return new Promise(function (resolve, reject) {
                var t = db.transaction(STORE, mode);
                var out = fn(t.objectStore(STORE));
                t.oncomplete = function () { resolve(out && out.result !== undefined ? out.result : out); };
                t.onerror = function () { reject(t.error); };
                t.onabort = function () { reject(t.error); };
            });
        });
    }
    return {
        list: function () {
            return tx('readonly', function (s) { return s.getAll(); }).then(function (all) {
                return (all || []).sort(function (a, b) { return String(a.added).localeCompare(String(b.added)); });
            });
        },
        get: function (id) { return tx('readonly', function (s) { return s.get(id); }); },
        put: function (rec) { return tx('readwrite', function (s) { s.put(rec); return null; }).then(function () { return rec; }); },
        remove: function (id) { return tx('readwrite', function (s) { s.delete(id); return null; }); }
    };
})();

function _srcNewId() {
    return 'src_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ── Reading files ─────────────────────────────────────────── */
var _srcPdfPromise = null;
function _srcLoadPdfLib() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    if (_srcPdfPromise) return _srcPdfPromise;
    _srcPdfPromise = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = SRC_PDF_LIB;
        s.onload = function () {
            var lib = window.pdfjsLib;
            if (!lib) { _srcPdfPromise = null; reject(new Error('library loaded but absent')); return; }
            lib.GlobalWorkerOptions.workerSrc = SRC_PDF_WORKER;
            resolve(lib);
        };
        s.onerror = function () { _srcPdfPromise = null; reject(new Error('network')); };
        document.head.appendChild(s);
    });
    return _srcPdfPromise;
}

/** Text as the AI should read it: compatibility forms folded (Arabic
    presentation forms, ligatures), spaces tidied, blank runs collapsed. */
function _srcClean(t) {
    var s = String(t || '');
    try { s = s.normalize('NFKC'); } catch (e) { /* old browser */ }
    return s.replace(/ /g, ' ').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n')
            .replace(/\n{3,}/g, '\n\n').trim();
}

/** One string per PDF page. */
async function mbSrcReadPdf(bytes, onPage) {
    var lib = await _srcLoadPdfLib();
    /* Text only: no rendering, no font faces, no eval — the parts of the
       library a hostile PDF could reach are not used. */
    var doc = await lib.getDocument({ data: bytes, isEvalSupported: false, disableFontFace: true, useSystemFonts: false }).promise;
    var pages = [];
    for (var i = 1; i <= doc.numPages; i++) {
        if (onPage) onPage(i, doc.numPages);
        var page = await doc.getPage(i);
        var tc = await page.getTextContent();
        var out = '';
        tc.items.forEach(function (it) {
            if (typeof it.str !== 'string') return;
            out += it.str;
            out += it.hasEOL ? '\n' : (it.str && !/\s$/.test(it.str) ? ' ' : '');
        });
        pages.push(_srcClean(out));
        if (page.cleanup) page.cleanup();
    }
    try { await doc.destroy(); } catch (e) { /* ignore */ }
    return pages;
}

/** A long text cut into "pages" of about SRC_PAGE_CHARS, at paragraph ends. */
function mbSrcSplitText(text) {
    var paras = _srcClean(text).split(/\n\s*\n/);
    var pages = [], cur = '';
    paras.forEach(function (p) {
        if (cur && (cur.length + p.length + 2) > SRC_PAGE_CHARS) { pages.push(cur); cur = ''; }
        while (p.length > SRC_PAGE_CHARS * 1.5) {      // one huge paragraph
            var cut = p.lastIndexOf(' ', SRC_PAGE_CHARS);
            if (cut < SRC_PAGE_CHARS / 2) cut = SRC_PAGE_CHARS;
            pages.push((cur ? cur + '\n\n' : '') + p.slice(0, cut).trim());
            cur = ''; p = p.slice(cut).trim();
        }
        cur = cur ? cur + '\n\n' + p : p;
    });
    if (cur.trim()) pages.push(cur);
    return pages;
}

function _srcHtmlToText(html) {
    var marked = String(html).replace(/<\/(p|div|h[1-6]|li|tr|section|article|blockquote|pre)>/gi, '$&\n\n')
                             .replace(/<br\s*\/?>/gi, '\n');
    var doc = new DOMParser().parseFromString(marked, 'text/html');
    doc.querySelectorAll('script,style,noscript,nav,header,footer,aside,form,svg').forEach(function (n) { n.remove(); });
    return (doc.body && doc.body.textContent) || '';
}

/** A file → a stored source. Resolves to the record, or rejects with a
    message key of _SRC_STRINGS. */
async function mbSrcAddFile(file, onPage) {
    var name = String(file.name || 'source');
    var ext = (name.match(/\.([a-z0-9]+)$/i) || [, ''])[1].toLowerCase();
    var base = name.replace(/\.[a-z0-9]+$/i, '');
    var pages, kind;
    if (ext === 'pdf' || file.type === 'application/pdf') {
        pages = await mbSrcReadPdf(new Uint8Array(await file.arrayBuffer()), onPage);
        kind = 'pdf';
    } else if (['txt', 'md', 'markdown', 'text', 'html', 'htm'].indexOf(ext) !== -1) {
        var raw = await file.text();
        pages = mbSrcSplitText((ext === 'html' || ext === 'htm') ? _srcHtmlToText(raw) : raw);
        kind = 'text';
    } else {
        throw new Error('badFile');
    }
    if (!pages.some(function (p) { return p.trim(); })) throw new Error('noText');
    return mbSources.put({ id: _srcNewId(), name: base, ref: base, kind: kind, pages: pages, added: new Date().toISOString() });
}

async function mbSrcAddText(name, text) {
    var pages = mbSrcSplitText(text);
    if (!pages.length) throw new Error('noText');
    var n = String(name || '').trim() || 'Text';
    return mbSources.put({ id: _srcNewId(), name: n, ref: n, kind: 'text', pages: pages, added: new Date().toISOString() });
}

/** True when most pages hold (almost) no text: a scanned PDF. */
function _srcLooksScanned(rec) {
    if (!rec || rec.kind !== 'pdf' || !rec.pages.length) return false;
    var empty = rec.pages.filter(function (p) { return p.replace(/\s/g, '').length < 30; }).length;
    return empty / rec.pages.length > 0.5;
}

/* ── Estimates ─────────────────────────────────────────────── */
function mbSrcTokens(s) {
    s = String(s || '');
    var ar = (s.match(/[؀-ۿ]/g) || []).length;
    return Math.ceil(ar / 2 + (s.length - ar) / 4);
}

/* ── The request ───────────────────────────────────────────── */
function _srcPagesText(rec, from, to) {
    var out = [];
    for (var i = from; i <= to; i++) out.push('[[Page ' + i + ']]\n' + (rec.pages[i - 1] || ''));
    return out.join('\n\n');
}

/** What the sheet belongs to: the open outcome, its criteria, the
    sections the sheet already has. */
function _srcContext() {
    var lang = _srcContentLang();
    var lo = (typeof mbCurrentLOObject === 'function') ? mbCurrentLOObject() : null;
    var g = function (v) { return (typeof biGet === 'function') ? biGet(v, lang) : (typeof v === 'string' ? v : ''); };
    var ctx = { lang: lang, lo: '', criteria: [], headings: [], title: '' };
    if (!lo) return ctx;
    var mod = (mbState.modulesData || []).find(function (m) { return m.id === mbState.currentModuleId; });
    var modLo = mod && (mod.learningOutcomes || []).find(function (l) { return l.id === lo.id; });
    ctx.lo = g((modLo && modLo.statement) || lo.statement || lo.text || '');
    ctx.criteria = ((modLo && modLo.performanceCriteria) || []).map(function (pc) {
        return g(pc && (pc.text || pc)) || '';
    }).filter(Boolean);
    var sh = (lo.infoSheets || [])[mbState.currentInfoSheetIndex];
    if (sh) {
        ctx.title = g(sh.title);
        ctx.headings = (sh.contentSections || []).map(function (c) { return g(c.heading); }).filter(Boolean);
    }
    return ctx;
}

function mbSrcPrompt(o) {
    var L = _SRC_LANG_NAMES[o.lang] || 'English';
    return 'You are an instructional designer writing an INFORMATION SHEET for a competency-based TVET training module ' +
        '(technical and vocational education and training). The trainees are vocational learners.\n\n' +
        'TOPIC OF THE SHEET: ' + o.topic + '\n' +
        (o.lo ? 'LEARNING OUTCOME: ' + o.lo + '\n' : '') +
        (o.criteria && o.criteria.length ? 'PERFORMANCE CRITERIA:\n' + o.criteria.map(function (c) { return '- ' + c; }).join('\n') + '\n' : '') +
        (o.headings && o.headings.length ? 'SECTIONS THE SHEET ALREADY HAS (do not repeat them):\n' + o.headings.map(function (c) { return '- ' + c; }).join('\n') + '\n' : '') +
        '\nSOURCE: ' + o.source + '\n' +
        'The source pages follow, each starting with a [[Page n]] marker.\n\n' +
        '<source_pages>\n' + o.pagesText + '\n</source_pages>\n\n' +
        'RULES\n' +
        '- Use ONLY information found in the source pages. Do not add facts, figures or advice from your own knowledge.\n' +
        '- If the pages do not cover part of the topic, do not fill the gap: name it in "notCovered".\n' +
        '- Explain in your own words, simply and accurately. Do not copy passages; a short definition, a formula, ' +
        'a value or a safety rule may be kept exact.\n' +
        '- Keep numbers, units, codes, standards and part names exactly as in the source.\n' +
        '- Write 3 to 7 sections that teach the topic in a logical order. Each section has a short heading and a text of ' +
        '60 to 250 words, and the whole answer stays under 1,300 words (the reply has a fixed length limit). ' +
        'A list is written as lines beginning with "• "; the steps of a procedure as lines "1. ", "2. ".\n' +
        '- "pages" lists the page numbers (from the [[Page n]] markers) each section is based on.\n' +
        '- "objective": one to three lines completing "After studying this information sheet, you will be able to:", ' +
        'each line starting with an action verb.\n' +
        (o.selfCheck
            ? '- "selfCheck": 5 numbered questions on the sections (short answer, true/false or multiple choice), and ' +
              '"answerKey": the answers, numbered the same way.\n'
            : '- "selfCheck" and "answerKey" are empty strings.\n') +
        '- Write everything in ' + L + '. ' + (_SRC_STYLE[o.lang] || '') + '\n\n' +
        'OUTPUT FORMAT\nReturn ONLY a JSON object, no other text:\n' +
        '{"objective":"...","sections":[{"heading":"...","text":"...","pages":[12,13]}],' +
        '"selfCheck":"...","answerKey":"...","notCovered":"..."}';
}

function _srcParseReply(data) {
    var raw = '';
    if (data && Array.isArray(data.content)) raw = data.content.map(function (b) { return (b && b.text) || ''; }).join('');
    else if (data && typeof data.text === 'string') raw = data.text;
    else if (data && Array.isArray(data.sections)) return data;
    var body = String(raw).trim().replace(/```json\s*/gi, '').replace(/```/g, '').trim();
    var obj;
    try { obj = JSON.parse(body); } catch (e) {
        var a = body.indexOf('{'), b = body.lastIndexOf('}');
        if (a === -1 || b <= a) throw new Error('badReply');
        obj = JSON.parse(body.slice(a, b + 1));
    }
    if (!obj || !Array.isArray(obj.sections)) throw new Error('badReply');
    return obj;
}

/** Normalised draft: never a crash on a missing field. */
function mbSrcNormalise(obj, maxPage) {
    var str = function (v) { return typeof v === 'string' ? v.trim() : ''; };
    return {
        objective: str(obj.objective),
        sections: (obj.sections || []).map(function (s) {
            var pages = (Array.isArray(s && s.pages) ? s.pages : []).map(function (p) { return parseInt(p, 10); })
                .filter(function (p) { return isFinite(p) && p >= 1 && (!maxPage || p <= maxPage); });
            pages = pages.filter(function (p, i) { return pages.indexOf(p) === i; }).sort(function (a, b) { return a - b; });
            return { heading: str(s && s.heading), text: str(s && s.text), pages: pages };
        }).filter(function (s) { return s.heading || s.text; }),
        selfCheck: str(obj.selfCheck),
        answerKey: str(obj.answerKey),
        notCovered: str(obj.notCovered)
    };
}

/** [12,13,14,18] → "12–14, 18" */
function mbSrcPageList(pages, lang) {
    var out = [], i = 0;
    while (i < pages.length) {
        var j = i;
        while (j + 1 < pages.length && pages[j + 1] === pages[j] + 1) j++;
        out.push(j > i ? pages[i] + '–' + pages[j] : String(pages[i]));
        i = j + 1;
    }
    return out.join(lang === 'ar' ? '\u060C ' : ', ');
}

function mbSrcCiteLine(name, pages, lang) {
    if (!pages || !pages.length) return '';
    return (_SRC_CITE[lang] || _SRC_CITE.en).replace('{s}', name).replace('{p}', mbSrcPageList(pages, lang));
}

var _srcAbort = null;
async function _srcCallAI(prompt) {
    var base = (typeof MB_AI_BACKEND_BASE !== 'undefined') ? MB_AI_BACKEND_BASE : 'https://dacum-ai-backend-production.up.railway.app';
    _srcAbort = new AbortController();
    var timer = setTimeout(function () { if (_srcAbort) _srcAbort.abort(); }, 180000);
    var res;
    try {
        res = await fetch(base + '/api/generate-dacum', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: prompt }), signal: _srcAbort.signal
        });
    } catch (e) {
        throw new Error(e && e.name === 'AbortError' ? 'aborted' : 'failed');
    } finally { clearTimeout(timer); _srcAbort = null; }
    if (res.status === 429) throw new Error('rate');
    if (!res.ok) throw new Error('failed');
    return _srcParseReply(await res.json());
}

/* ── Writing into the sheet ───────────────────────────────────
   Into the information sheet open in the tab; a new one when the
   outcome has none. Empty sections (the blank card a new sheet shows)
   are dropped first. Title, objective, self-check and answer key are
   written only where the sheet has none. */
function mbSrcApply(draft, pick, rec) {
    var lang = _srcContentLang();
    if (typeof saveCurrentSheetToLO === 'function') saveCurrentSheetToLO();
    var lo = (typeof mbCurrentLOObject === 'function') ? mbCurrentLOObject() : null;
    if (!lo) return 0;
    if (!Array.isArray(lo.infoSheets)) lo.infoSheets = [];
    var idx = mbState.currentInfoSheetIndex || 0;
    if (!lo.infoSheets[idx]) {
        var loIndex = mbState.learningOutcomesData.indexOf(lo);
        lo.infoSheets.push({
            sheetNumber: getAutoSheetNumber(loIndex, lo.infoSheets.length), title: '', objective: '',
            linkSubject: '', linkUrl: '', qrImage: null,
            selfCheckNumber: '', selfCheckContent: '', answersKeyNumber: '', answersKeyContent: '',
            contentSections: [], contentSectionImages: {}
        });
        idx = lo.infoSheets.length - 1;
        mbState.currentInfoSheetIndex = idx;
    }
    var sh = lo.infoSheets[idx];
    var has = function (v) {
        if (typeof v === 'string') return !!v.trim();
        return !!(v && typeof v === 'object' && Object.keys(v).some(function (k) { return typeof v[k] === 'string' && v[k].trim(); }));
    };
    var put = function (key, text) { if (typeof biSet === 'function') biSet(sh, key, lang, text); else sh[key] = text; };
    if (!Array.isArray(sh.contentSections)) sh.contentSections = [];
    sh.contentSections = sh.contentSections.filter(function (c) {
        return has(c.heading) || has(c.text) || (c.tables && c.tables.length) || (c.marks && c.marks.length);
    });
    var n = 0;
    draft.sections.forEach(function (s, i) {
        if (!pick.sections[i]) return;
        var text = s.text;
        if (pick.cite) {
            var cite = mbSrcCiteLine(rec.name, s.pages, lang);
            if (cite) text = text ? text + '\n' + cite : cite;
        }
        var sec = { contentId: '', marks: [], tables: [], uid: (typeof mbUid === 'function') ? mbUid() : _srcNewId() };
        if (typeof biSet === 'function') { biSet(sec, 'heading', lang, s.heading); biSet(sec, 'text', lang, text); }
        else { sec.heading = s.heading; sec.text = text; }
        sh.contentSections.push(sec);
        n++;
    });
    if (pick.topic && !has(sh.title) && pick.title) put('title', pick.topic);
    if (pick.objective && draft.objective && !(typeof biGetStrict === 'function' ? biGetStrict(sh.objective, lang).trim() : has(sh.objective))) put('objective', draft.objective);
    if (pick.selfCheck && draft.selfCheck && !(typeof biGetStrict === 'function' ? biGetStrict(sh.selfCheckContent, lang).trim() : has(sh.selfCheckContent))) {
        put('selfCheckContent', draft.selfCheck);
        if (draft.answerKey) put('answersKeyContent', draft.answerKey);
    }
    _srcAddReference(rec.ref || rec.name);

    if (typeof saveCurrentModuleLOData === 'function') saveCurrentModuleLOData();
    if (typeof loadInfoSheetAtIndex === 'function') loadInfoSheetAtIndex(lo, idx);
    if (typeof updateLOSummary === 'function') updateLOSummary();
    if (typeof updateModuleSummary === 'function') updateModuleSummary();
    if (typeof mbLibrarySave === 'function') { try { mbLibrarySave(); } catch (e) { /* autosave absent */ } }
    return n;
}

function _srcAddReference(text) {
    var t = String(text || '').trim();
    if (!t || !Array.isArray(mbState.referencesData)) return;
    var norm = function (s) { return String(s || '').trim().toLowerCase(); };
    if (mbState.referencesData.some(function (r) { return norm(r.value) === norm(t); })) return;
    var empty = mbState.referencesData.find(function (r) { return !String(r.value || '').trim(); });
    if (empty) empty.value = t;
    else {
        mbState.refIdCounter = (mbState.refIdCounter || mbState.referencesData.length) + 1;
        mbState.referencesData.push({ id: mbState.refIdCounter, value: t });
    }
    if (typeof renderReferences === 'function') renderReferences();
}

/* ── The dialog ─────────────────────────────────────────────── */
var _src = null;   // { list, sel, from, to, topic, selfCheck, cite, draft, busy }

function _srcEnsureStyle() {
    if (document.getElementById('src-style')) return;
    var s = document.createElement('style');
    s.id = 'src-style';
    s.textContent = [
        '#src-overlay .ws-modal{width:min(720px,100%);max-height:92vh;}',
        '#src-overlay .src-list{display:flex;flex-direction:column;gap:6px;margin:0 0 10px;}',
        '#src-overlay .src-item{display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid #e2e8f0;',
        'border-radius:10px;background:#fff;cursor:pointer;}',
        '#src-overlay .src-item.is-on{border-color:#6366f1;background:#eef2ff;box-shadow:inset 0 0 0 1px #6366f1;}',
        '#src-overlay .src-item input{margin:0;accent-color:#6366f1;flex:0 0 auto;}',
        '#src-overlay .src-name{flex:1 1 auto;min-width:0;overflow-wrap:anywhere;font-weight:600;color:#1f2937;}',
        '#src-overlay .src-meta{color:#64748b;font-size:.85em;white-space:nowrap;}',
        '#src-overlay .src-del{background:none;border:none;color:#b91c1c;cursor:pointer;font-size:1.05em;padding:2px 6px;border-radius:6px;}',
        '#src-overlay .src-del:hover{background:#fee2e2;}',
        '#src-overlay .src-btns{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 14px;}',
        '#src-overlay .src-btn{padding:7px 12px;border:1px solid #cbd5e1;border-radius:8px;background:#f1f5f9;color:#475569;',
        'font:inherit;font-size:.9em;font-weight:600;cursor:pointer;}',
        '#src-overlay .src-btn:hover{background:#e2e8f0;}',
        '#src-overlay .src-input,#src-overlay .src-area{width:100%;box-sizing:border-box;padding:7px 9px;border:1.5px solid #d1d5db;',
        'border-radius:7px;font:inherit;background:#fff;}',
        '#src-overlay .src-area{min-height:120px;resize:vertical;}',
        '#src-overlay .src-num{width:5.5em;padding:6px 8px;border:1.5px solid #d1d5db;border-radius:7px;font:inherit;}',
        '#src-overlay .src-range{display:flex;flex-wrap:wrap;align-items:center;gap:8px;}',
        '#src-overlay .src-stack{display:flex;flex-direction:column;gap:5px;margin:0 0 12px;}',
        '#src-overlay .src-stack > label{color:#374151;font-weight:600;font-size:.92em;}',
        '#src-overlay .src-paste{border:1px dashed #cbd5e1;border-radius:10px;padding:10px;margin:0 0 10px;background:#f8fafc;}',
        '#src-overlay details.src-pv{margin:8px 0 0;}',
        '#src-overlay details.src-pv summary{cursor:pointer;color:#475569;font-size:.88em;}',
        '#src-overlay .src-pv-text{white-space:pre-wrap;max-height:180px;overflow:auto;background:#f8fafc;border:1px solid #e2e8f0;',
        'border-radius:8px;padding:8px 10px;font-size:.85em;margin-top:6px;unicode-bidi:plaintext;}',
        '#src-overlay .src-warn{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:8px;padding:8px 10px;font-size:.88em;margin:8px 0 0;}',
        '#src-overlay .src-est{color:#475569;font-size:.86em;margin:4px 0 0;}',
        '#src-overlay .src-est.is-bad{color:#b91c1c;font-weight:600;}',
        '#src-overlay .src-part{border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;margin:0 0 10px;background:#fff;}',
        '#src-overlay .src-part > label{display:flex;gap:9px;align-items:flex-start;font-weight:700;color:#1f2937;cursor:pointer;}',
        '#src-overlay .src-part > label input{margin:3px 0 0;accent-color:#6366f1;flex:0 0 auto;}',
        '#src-overlay .src-part-text{white-space:pre-wrap;margin:6px 0 0;color:#334155;font-size:.92em;line-height:1.5;unicode-bidi:plaintext;}',
        '#src-overlay .src-part-cite{color:#6366f1;font-size:.84em;margin-top:4px;}',
        '#src-overlay .src-gap{background:#fefce8;border:1px solid #fde68a;color:#854d0e;border-radius:8px;padding:8px 10px;font-size:.88em;margin:0 0 10px;white-space:pre-wrap;}',
        '@media (max-width:520px){#src-overlay .ws-overlay{padding:8px;}#src-overlay .src-meta{white-space:normal;}}'
    ].join('');
    document.head.appendChild(s);
}

async function mbSrcOpen() {
    if (document.getElementById('src-overlay')) return;
    if (!mbState.currentLOId) { if (typeof showStatus === 'function') showStatus(_srcT('needLo'), 'error'); return; }
    if (typeof saveCurrentSheetToLO === 'function') saveCurrentSheetToLO();
    _srcEnsureStyle();
    var ctx = _srcContext();
    _src = { list: [], sel: null, from: 1, to: 1, topic: ctx.title || '', title: !ctx.title, selfCheck: true, cite: true,
             draft: null, busy: false, paste: false };
    try { _src.list = await mbSources.list(); } catch (e) { _src.list = []; }
    if (_src.list.length) _srcSelect(_src.list[_src.list.length - 1].id, true);

    var rtl = !!(window.i18n && window.i18n.isRTL && window.i18n.isRTL());
    var ov = document.createElement('div');
    ov.id = 'src-overlay';
    ov.className = 'ws-overlay';
    ov.setAttribute('dir', rtl ? 'rtl' : 'ltr');
    ov.innerHTML =
      '<div class="ws-modal" role="dialog" aria-modal="true" aria-labelledby="src-title">' +
        '<div class="ws-head"><span id="src-title">📚 ' + _srcEsc(_srcT('title')) + '</span>' +
          '<button type="button" class="ws-x" id="src-x" aria-label="' + _srcEsc(_srcT('close')) + '">×</button></div>' +
        '<div class="ws-body" id="src-body"></div>' +
        '<div class="ws-foot">' +
          '<span class="ws-msg" id="src-msg" role="status" aria-live="polite"></span>' +
          '<span class="ws-foot-right" id="src-foot"></span>' +
        '</div>' +
        '<input type="file" id="src-file" accept=".pdf,.txt,.md,.markdown,.html,.htm,application/pdf,text/plain,text/markdown,text/html" hidden>' +
      '</div>';
    document.body.appendChild(ov);
    _srcPaint();

    ov.addEventListener('click', _srcOnClick);
    ov.addEventListener('input', _srcOnInput);
    ov.addEventListener('change', _srcOnChange);
    document.getElementById('src-file').addEventListener('change', _srcOnFile);
    _srcKey = function (e) { if (e.key === 'Escape') mbSrcClose(); };
    document.addEventListener('keydown', _srcKey);
}
var _srcKey = null;

function mbSrcClose() {
    if (_srcAbort) { try { _srcAbort.abort(); } catch (e) { /* ignore */ } }
    var ov = document.getElementById('src-overlay');
    if (ov) ov.remove();
    if (_srcKey) document.removeEventListener('keydown', _srcKey);
    _srcKey = null;
    _src = null;
}

function _srcRec() {
    return _src && _src.list.find(function (r) { return r.id === _src.sel; }) || null;
}
function _srcSelect(id, quiet) {
    _src.sel = id;
    var rec = _srcRec();
    var n = rec ? rec.pages.length : 1;
    _src.from = 1;
    _src.to = Math.min(n, SRC_MAX_PAGES);
    if (!quiet) _srcPaint();
}

function _srcMsg(text, kind) {
    var m = document.getElementById('src-msg');
    if (!m) return;
    m.textContent = text || '';
    m.style.color = kind === 'error' ? '#b91c1c' : kind === 'ok' ? '#15803d' : '#475569';
}

/** The numbers under the page range: tokens, cost, and whether the
    request is within the limits. Returns true when it can be sent. */
function _srcPaintEstimate() {
    var el = document.getElementById('src-est');
    var rec = _srcRec();
    if (!el) return false;
    if (!rec) { el.textContent = ''; return false; }
    var from = _src.from, to = _src.to;
    var ok = from >= 1 && to >= from && to <= rec.pages.length;
    var text = ok ? _srcPagesText(rec, from, to) : '';
    var pages = ok ? (to - from + 1) : 0;
    var within = ok && pages <= SRC_MAX_PAGES && text.length <= SRC_MAX_CHARS;
    var tin = mbSrcTokens(text) + 900;
    var cost = (tin * SRC_RATE_IN + SRC_OUT_TOKENS * 0.75 * SRC_RATE_OUT) / 1e6;
    el.className = 'src-est' + (within ? '' : ' is-bad');
    el.textContent = within
        ? _srcT('estimate', { v0: tin.toLocaleString(), v1: SRC_OUT_TOKENS.toLocaleString(), v2: cost.toFixed(2) })
        : _srcT('tooMany', { v0: SRC_MAX_PAGES });
    var pv = document.getElementById('src-pv');
    if (pv && ok) {
        var first = rec.pages[from - 1] || '';
        pv.querySelector('summary').textContent = _srcT('preview', { v0: from });
        pv.querySelector('.src-pv-text').textContent = first.trim() ? first.slice(0, 1500) : _srcT('emptyPage');
    }
    var gen = document.getElementById('src-gen');
    if (gen) gen.disabled = !within || _src.busy;
    return within;
}

function _srcPaint() {
    var body = document.getElementById('src-body');
    var foot = document.getElementById('src-foot');
    if (!body || !_src) return;
    if (_src.draft) { _srcPaintDraft(body, foot); return; }
    var rec = _srcRec();
    var items = _src.list.map(function (r) {
        var on = r.id === _src.sel;
        return '<label class="src-item' + (on ? ' is-on' : '') + '">' +
            '<input type="radio" name="src-pick" value="' + _srcEsc(r.id) + '"' + (on ? ' checked' : '') + '>' +
            '<span class="src-name" dir="auto">' + _srcEsc(r.name) + '</span>' +
            '<span class="src-meta">' + r.pages.length + ' ' + _srcEsc(_srcT('pages')) + (r.kind === 'pdf' ? ' · PDF' : '') + '</span>' +
            '<button type="button" class="src-del" data-src="del" data-id="' + _srcEsc(r.id) + '" title="' + _srcEsc(_srcT('del')) +
              '" aria-label="' + _srcEsc(_srcT('del') + ' — ' + r.name) + '">🗑</button>' +
        '</label>';
    }).join('');
    var n = rec ? rec.pages.length : 0;
    body.innerHTML =
        '<p class="ws-note ws-note-sm">ℹ️ ' + _srcEsc(_srcT('intro')) + '</p>' +
        '<h4 class="ws-group">' + _srcEsc(_srcT('sources')) + '</h4>' +
        (items ? '<div class="src-list" role="radiogroup">' + items + '</div>' : '<p class="src-est">' + _srcEsc(_srcT('none')) + '</p>') +
        '<div class="src-btns">' +
          '<button type="button" class="src-btn" data-src="file">' + _srcEsc(_srcT('addFile')) + '</button>' +
          '<button type="button" class="src-btn" data-src="paste" aria-expanded="' + (_src.paste ? 'true' : 'false') + '">' + _srcEsc(_srcT('paste')) + '</button>' +
        '</div>' +
        (_src.paste
          ? '<div class="src-paste">' +
              '<div class="src-stack"><label for="src-paste-name">' + _srcEsc(_srcT('pasteName')) + '</label>' +
                '<input type="text" class="src-input" id="src-paste-name" dir="auto" placeholder="' + _srcEsc(_srcT('pasteNamePh')) + '"></div>' +
              '<div class="src-stack"><label for="src-paste-text">' + _srcEsc(_srcT('pasteText')) + '</label>' +
                '<textarea class="src-area" id="src-paste-text" dir="auto"></textarea></div>' +
              '<button type="button" class="src-btn" data-src="paste-add">' + _srcEsc(_srcT('pasteAdd')) + '</button>' +
            '</div>'
          : '') +
        (rec
          ? '<div class="src-stack"><label for="src-ref">' + _srcEsc(_srcT('ref')) + '</label>' +
              '<input type="text" class="src-input" id="src-ref" dir="auto" maxlength="400" value="' + _srcEsc(rec.ref || '') +
              '" placeholder="' + _srcEsc(_srcT('refPh')) + '"></div>' +
            '<h4 class="ws-group">' + _srcEsc(_srcT('range')) + '</h4>' +
            '<div class="src-range">' +
              '<label for="src-from">' + _srcEsc(_srcT('from')) + '</label>' +
              '<input type="number" class="src-num" id="src-from" min="1" max="' + n + '" value="' + _src.from + '">' +
              '<label for="src-to">' + _srcEsc(_srcT('to')) + '</label>' +
              '<input type="number" class="src-num" id="src-to" min="1" max="' + n + '" value="' + _src.to + '">' +
              '<span class="src-meta">' + _srcEsc(_srcT('of', { v0: n })) + '</span>' +
            '</div>' +
            (_srcLooksScanned(rec) ? '<p class="src-warn">⚠️ ' + _srcEsc(_srcT('scanned')) + '</p>' : '') +
            '<details class="src-pv" id="src-pv"><summary></summary><div class="src-pv-text" dir="auto"></div></details>' +
            '<p class="src-est" id="src-est"></p>'
          : '') +
        '<h4 class="ws-group">' + _srcEsc(_srcT('sheet')) + '</h4>' +
        '<div class="src-stack"><label for="src-topic">' + _srcEsc(_srcT('topic')) + '</label>' +
          '<input type="text" class="src-input" id="src-topic" dir="auto" maxlength="300" value="' + _srcEsc(_src.topic) +
          '" placeholder="' + _srcEsc(_srcT('topicPh')) + '"></div>' +
        '<div class="ws-checks">' +
          '<label class="ws-check"><input type="checkbox" id="src-self"' + (_src.selfCheck ? ' checked' : '') + '><span>' + _srcEsc(_srcT('optSelf')) + '</span></label>' +
          '<label class="ws-check"><input type="checkbox" id="src-cite"' + (_src.cite ? ' checked' : '') + '><span>' + _srcEsc(_srcT('optCite')) + '</span></label>' +
        '</div>' +
        '<p class="src-est">🔒 ' + _srcEsc(_srcT('privacy')) + '</p>' +
        '<p class="src-est">©️ ' + _srcEsc(_srcT('copyNote')) + '</p>';
    foot.innerHTML =
        '<button type="button" class="ws-btn ws-btn-ghost" data-src="close">' + _srcEsc(_srcT('close')) + '</button>' +
        '<button type="button" class="ws-btn ws-btn-primary" id="src-gen" data-src="gen">' + _srcEsc(_srcT('generate')) + '</button>';
    if (rec) _srcPaintEstimate();
    else document.getElementById('src-gen').disabled = true;
}

function _srcPaintDraft(body, foot) {
    var d = _src.draft, rec = _srcRec(), lang = _srcContentLang();
    var part = function (id, title, text, extra) {
        return '<div class="src-part"><label><input type="checkbox" data-part="' + id + '" checked>' +
               '<span dir="auto">' + _srcEsc(title) + '</span></label>' +
               (text ? '<div class="src-part-text" dir="auto">' + _srcEsc(text) + '</div>' : '') + (extra || '') + '</div>';
    };
    var html = '<h4 class="ws-group">' + _srcEsc(_srcT('result')) + '</h4>';
    if (d.notCovered) html += '<div class="src-gap" dir="auto">⚠️ ' + _srcEsc(_srcT('notCovered')) + ': ' + _srcEsc(d.notCovered) + '</div>';
    if (d.objective) html += part('objective', '🎯 ' + _srcT('objective'), d.objective);
    d.sections.forEach(function (s, i) {
        var cite = _src.cite ? mbSrcCiteLine(rec ? rec.name : '', s.pages, lang) : '';
        html += part('s' + i, s.heading || '—', s.text, cite ? '<div class="src-part-cite" dir="auto">' + _srcEsc(cite) + '</div>' : '');
    });
    if (d.selfCheck) html += part('selfCheck', '✅ ' + _srcT('selfCheck') + ' + ' + _srcT('answers'), d.selfCheck + (d.answerKey ? '\n\n— ' + _srcT('answers') + ' —\n' + d.answerKey : ''));
    body.innerHTML = html;
    foot.innerHTML =
        '<button type="button" class="ws-btn ws-btn-ghost" data-src="back">' + _srcEsc(_srcT('back')) + '</button>' +
        '<button type="button" class="ws-btn ws-btn-primary" data-src="keep">' + _srcEsc(_srcT('keep')) + '</button>';
}

function _srcOnInput(e) {
    if (!_src) return;
    var id = e.target.id;
    if (id === 'src-topic') { _src.topic = e.target.value; return; }
    if (id === 'src-from' || id === 'src-to') {
        var v = parseInt(e.target.value, 10);
        if (!isFinite(v)) return;
        if (id === 'src-from') _src.from = v; else _src.to = v;
        _srcPaintEstimate();
    }
}

function _srcOnChange(e) {
    if (!_src) return;
    var t = e.target;
    if (t.name === 'src-pick') { _srcSelect(t.value); return; }
    if (t.id === 'src-self') { _src.selfCheck = !!t.checked; return; }
    if (t.id === 'src-cite') { _src.cite = !!t.checked; return; }
    if (t.id === 'src-ref') {
        var rec = _srcRec();
        if (rec) { rec.ref = t.value.trim() || rec.name; mbSources.put(rec).catch(function () {}); }
    }
}

async function _srcOnFile(e) {
    var f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f || !_src) return;
    _src.busy = true;
    try {
        var rec = await mbSrcAddFile(f, function (i, n) { _srcMsg(_srcT('reading', { v0: i, v1: n })); });
        _src.list.push(rec);
        _srcSelect(rec.id);
        _srcMsg(_srcT('added', { v0: rec.name, v1: rec.pages.length }), 'ok');
    } catch (err) {
        var k = err && err.message;
        _srcMsg(_srcT(k === 'badFile' || k === 'noText' ? k : 'noText'), 'error');
    } finally {
        if (_src) _src.busy = false;
        _srcPaintEstimate();
    }
}

async function _srcOnClick(e) {
    if (!_src) return;
    var ov = document.getElementById('src-overlay');
    if (e.target.id === 'src-x') { mbSrcClose(); return; }
    /* The backdrop closes only when nothing would be lost: not while
       the AI is writing, not over a draft that has not been added. */
    if (e.target === ov) { if (!_src.busy && !_src.draft) mbSrcClose(); return; }
    var b = e.target.closest && e.target.closest('[data-src]');
    if (!b) return;
    var act = b.getAttribute('data-src');
    if (act === 'close') { mbSrcClose(); return; }
    if (act === 'file') { document.getElementById('src-file').click(); return; }
    if (act === 'paste') { _src.paste = !_src.paste; _srcPaint(); return; }
    if (act === 'paste-add') {
        var name = document.getElementById('src-paste-name').value;
        var text = document.getElementById('src-paste-text').value;
        try {
            var rec = await mbSrcAddText(name, text);
            _src.list.push(rec);
            _src.paste = false;
            _srcSelect(rec.id);
            _srcMsg(_srcT('added', { v0: rec.name, v1: rec.pages.length }), 'ok');
        } catch (err) { _srcMsg(_srcT('noText'), 'error'); }
        return;
    }
    if (act === 'del') {
        e.preventDefault();
        var id = b.getAttribute('data-id');
        var r = _src.list.find(function (x) { return x.id === id; });
        if (!r) return;
        var yes = (typeof mbConfirm === 'function') ? await mbConfirm(_srcT('delAsk', { v0: r.name })) : window.confirm(_srcT('delAsk', { v0: r.name }));
        if (!yes || !_src) return;
        await mbSources.remove(id);
        _src.list = _src.list.filter(function (x) { return x.id !== id; });
        if (_src.sel === id) { _src.sel = null; if (_src.list.length) _srcSelect(_src.list[0].id, true); }
        _srcPaint();
        return;
    }
    if (act === 'gen') { _srcGenerate(); return; }
    if (act === 'back') { _src.draft = null; _srcPaint(); _srcMsg(''); return; }
    if (act === 'keep') {
        var pick = { sections: {}, objective: false, selfCheck: false, cite: _src.cite, topic: _src.topic.trim(), title: true };
        var any = false;
        document.querySelectorAll('#src-overlay [data-part]').forEach(function (c) {
            var p = c.getAttribute('data-part');
            if (!c.checked) return;
            any = true;
            if (p === 'objective') pick.objective = true;
            else if (p === 'selfCheck') pick.selfCheck = true;
            else pick.sections[parseInt(p.slice(1), 10)] = true;
        });
        if (!any) { _srcMsg(_srcT('keepNone'), 'error'); return; }
        var n = mbSrcApply(_src.draft, pick, _srcRec());
        var msg = _srcT('done', { v0: n });
        mbSrcClose();
        if (typeof showStatus === 'function') showStatus(msg, 'success');
    }
}

async function _srcGenerate() {
    var rec = _srcRec();
    if (!rec) { _srcMsg(_srcT('needSource'), 'error'); return; }
    var topic = (_src.topic || '').trim();
    if (!topic) { _srcMsg(_srcT('needTopic'), 'error'); var tp = document.getElementById('src-topic'); if (tp) tp.focus(); return; }
    if (!_srcPaintEstimate()) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { _srcMsg(_srcT('offline'), 'error'); return; }
    var ctx = _srcContext();
    var prompt = mbSrcPrompt({
        lang: ctx.lang, topic: topic, lo: ctx.lo, criteria: ctx.criteria, headings: ctx.headings,
        source: rec.ref || rec.name, pagesText: _srcPagesText(rec, _src.from, _src.to), selfCheck: _src.selfCheck
    });
    _src.busy = true;
    var gen = document.getElementById('src-gen');
    if (gen) { gen.disabled = true; }
    var foot = document.getElementById('src-foot');
    var cancel = document.createElement('button');
    cancel.type = 'button'; cancel.className = 'ws-btn ws-btn-ghost'; cancel.textContent = _srcT('cancel');
    cancel.addEventListener('click', function () { if (_srcAbort) _srcAbort.abort(); });
    if (foot) foot.insertBefore(cancel, foot.firstChild);
    _srcMsg(_srcT('working'));
    try {
        var obj = await _srcCallAI(prompt);
        if (!_src) return;
        var draft = mbSrcNormalise(obj, rec.pages.length);
        if (!draft.sections.length && !draft.objective) throw new Error('badReply');
        _src.draft = draft;
        _src.busy = false;
        _srcPaint();
        _srcMsg('');
    } catch (err) {
        if (!_src) return;
        _src.busy = false;
        var k = err && err.message;
        if (cancel.parentNode) cancel.remove();
        if (k === 'aborted') { _srcMsg(''); _srcPaintEstimate(); return; }
        _srcMsg(_srcT(k === 'rate' || k === 'badReply' ? k : 'failed'), 'error');
        _srcPaintEstimate();
    }
}
