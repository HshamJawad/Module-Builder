// ============================================================
// /src/content_translate.js
// AI translation of the module's content — Settings → Language.
//
// The same idea as DACUM Live Pro's "Translate content" (original
// language, languages with Original / Shown badges, From → To, re-translate
// AI texts but keep manual edits), built on what Module Builder already
// has: every text the author types is a pair { en, ar, fr } (bilang.js).
// So a translation is simply the EMPTY side of each pair being filled:
//
//   • nothing new is stored in the module's texts — the translated side is
//     an ordinary side of the pair, so editing, saving, .mbz packages,
//     the content-language switch and every export (Word, PDF, HTML,
//     PowerPoint) already work on it, with no change;
//   • the "shown" version is the content language, which is also what
//     the exports use (the card sets both);
//   • which sides were written by the AI is remembered on the module as
//     module.mbTr = { to_<lang>: { <hash of the translated text>: <hash
//     of its source> } }. A text the author edited no longer matches its
//     hash, so "re-translate" leaves it alone — no edit flags to keep in
//     step. (Keys are "to_fr", not "fr": an object keyed by a language
//     code is read as a pair by biIs().)
//
// What is translated: the open module and its assessment forms, and the
// project's shared pages (covers, team, introduction, references,
// glossary, TVQF card …) — the same objects the library saves.
// Only texts with no translation yet are sent, each distinct text once,
// in batches small enough that a reply is never cut off. Each batch is
// stored as soon as it arrives, so a stopped or failed run keeps what it did.
// ============================================================

if (window.i18n && window.i18n.extend) window.i18n.extend({
    en: {
        mbTrTitle: 'Translation',
        mbTrOriginalLabel: 'Original language of the content',
        mbTrOriginalNote: 'The language the module is written in. It is detected from the texts and can be changed until a translation exists.',
        mbTrBadgeOriginal: 'Original',
        mbTrBadgeShown: 'Shown',
        mbTrCoverage: '{v0} of {v1} texts',
        mbTrShowNote: 'The language shown is the one you edit and the one the exports use. Click a language to show it.',
        mbTrTranslateTitle: 'Translate content',
        mbTrFrom: 'From',
        mbTrTo: 'To',
        mbTrRetranslate: 'Re-translate all AI-translated texts (your manual edits are kept)',
        mbTrScopeNote: 'Only texts without a translation are sent, each once. The open module and the project’s shared pages (covers, introduction, references…) are translated; open another module and run it again to translate that one.',
        mbTrButton: 'Translate',
        mbTrStop: 'Stop',
        mbTrAI: 'AI',
        mbTrProgress: 'Translating… {v0} of {v1} texts',
        mbTrDone: 'Translated {v0} texts into {v1}.',
        mbTrDoneMissing: 'Translated {v0} of {v1} texts into {v2}; the rest can be retried.',
        mbTrNothing: 'Nothing to translate: every text already has a {v0} version.',
        mbTrNoSource: 'There is no {v0} text to translate from.',
        mbTrSame: 'Choose two different languages.',
        mbTrStopped: 'Stopped after {v0} of {v1} texts. What was translated is kept.',
        mbTrShowTranslated: 'Show the translated version',
        mbTrSafe: 'What was already translated is kept.',
        mbTrNoModule: 'Open a module first.',
        mbTrReset: 'Reset to default',
        mbTrResetNote: 'Removes the AI translations of this module and shows the original language again. Texts you edited by hand are kept.',
        mbTrResetConfirm: 'Remove the AI translations of this module?\nTexts you edited by hand are kept.',
        mbTrResetOk: 'Remove translations',
        mbTrResetDone: 'AI translations removed ({v0} texts). The original language is shown.'
    },
    fr: {
        mbTrTitle: 'Traduction',
        mbTrOriginalLabel: 'Langue d’origine du contenu',
        mbTrOriginalNote: 'La langue dans laquelle le module est rédigé. Elle est détectée d’après les textes et peut être modifiée tant qu’il n’existe pas de traduction.',
        mbTrBadgeOriginal: 'Origine',
        mbTrBadgeShown: 'Affichée',
        mbTrCoverage: '{v0} textes sur {v1}',
        mbTrShowNote: 'La langue affichée est celle que vous modifiez et celle qu’utilisent les exports. Cliquez sur une langue pour l’afficher.',
        mbTrTranslateTitle: 'Traduire le contenu',
        mbTrFrom: 'De',
        mbTrTo: 'Vers',
        mbTrRetranslate: 'Retraduire tous les textes traduits par l’IA (vos modifications manuelles sont conservées)',
        mbTrScopeNote: 'Seuls les textes sans traduction sont envoyés, une seule fois chacun. Le module ouvert et les pages communes du projet (couvertures, introduction, références…) sont traduits ; ouvrez un autre module et relancez pour le traduire.',
        mbTrButton: 'Traduire',
        mbTrStop: 'Arrêter',
        mbTrAI: 'IA',
        mbTrProgress: 'Traduction… {v0} textes sur {v1}',
        mbTrDone: '{v0} textes traduits vers {v1}.',
        mbTrDoneMissing: '{v0} textes sur {v1} traduits vers {v2} ; le reste peut être relancé.',
        mbTrNothing: 'Rien à traduire : chaque texte a déjà une version en {v0}.',
        mbTrNoSource: 'Il n’y a aucun texte en {v0} à traduire.',
        mbTrSame: 'Choisissez deux langues différentes.',
        mbTrStopped: 'Arrêté après {v0} textes sur {v1}. Ce qui est traduit est conservé.',
        mbTrShowTranslated: 'Afficher la version traduite',
        mbTrSafe: 'Ce qui a déjà été traduit est conservé.',
        mbTrNoModule: 'Ouvrez d’abord un module.',
        mbTrReset: 'Rétablir par défaut',
        mbTrResetNote: 'Supprime les traductions IA de ce module et réaffiche la langue d’origine. Les textes modifiés à la main sont conservés.',
        mbTrResetConfirm: 'Supprimer les traductions IA de ce module ?\nLes textes modifiés à la main sont conservés.',
        mbTrResetOk: 'Supprimer les traductions',
        mbTrResetDone: 'Traductions IA supprimées ({v0} textes). La langue d’origine est affichée.'
    },
    ar: {
        mbTrTitle: 'الترجمة',
        mbTrOriginalLabel: 'اللغة الأصلية للمحتوى',
        mbTrOriginalNote: 'اللغة التي كُتبت بها الوحدة. تُكتشف تلقائياً من النصوص، ويمكن تغييرها ما لم توجد ترجمة.',
        mbTrBadgeOriginal: 'الأصل',
        mbTrBadgeShown: 'معروضة',
        mbTrCoverage: '{v0} من {v1} نصاً',
        mbTrShowNote: 'اللغة المعروضة هي التي تحرّرها وهي التي تعتمدها عمليات التصدير. اضغط على لغة لعرضها.',
        mbTrTranslateTitle: 'ترجمة المحتوى',
        mbTrFrom: 'من',
        mbTrTo: 'إلى',
        mbTrRetranslate: 'إعادة ترجمة كل النصوص المترجمة آلياً (تعديلاتك اليدوية محفوظة)',
        mbTrScopeNote: 'تُرسل فقط النصوص التي لا ترجمة لها، كلٌّ منها مرة واحدة. تُترجم الوحدة المفتوحة وصفحات المشروع المشتركة (الأغلفة والمقدمة والمراجع…)؛ افتح وحدة أخرى وأعد التشغيل لترجمتها.',
        mbTrButton: 'ترجمة',
        mbTrStop: 'إيقاف',
        mbTrAI: 'ذكاء اصطناعي',
        mbTrProgress: 'جارٍ الترجمة… {v0} من {v1} نصاً',
        mbTrDone: 'تمت ترجمة {v0} نصاً إلى {v1}.',
        mbTrDoneMissing: 'تمت ترجمة {v0} من {v1} نصاً إلى {v2}؛ ويمكن إعادة المحاولة للباقي.',
        mbTrNothing: 'لا شيء يحتاج إلى ترجمة: لكل نص نسخة بلغة {v0}.',
        mbTrNoSource: 'لا توجد نصوص بلغة {v0} للترجمة منها.',
        mbTrSame: 'اختر لغتين مختلفتين.',
        mbTrStopped: 'توقفت الترجمة بعد {v0} من {v1} نصاً. وما تُرجم محفوظ.',
        mbTrShowTranslated: 'عرض النسخة المترجمة',
        mbTrSafe: 'ما تُرجم سابقاً محفوظ.',
        mbTrNoModule: 'افتح وحدة أولاً.',
        mbTrReset: 'إعادة إلى الوضع الافتراضي',
        mbTrResetNote: 'يحذف الترجمات الآلية لهذه الوحدة ويعيد عرض اللغة الأصلية. النصوص التي عدّلتها يدوياً تبقى كما هي.',
        mbTrResetConfirm: 'هل تريد حذف الترجمات الآلية لهذه الوحدة؟\nالنصوص التي عدّلتها يدوياً تبقى كما هي.',
        mbTrResetOk: 'حذف الترجمات',
        mbTrResetDone: 'تم حذف الترجمات الآلية ({v0} نصاً). تُعرض اللغة الأصلية.'
    }
});

/* ── Constants ─────────────────────────────────────────────── */

var MB_TR_BATCH_ITEMS = 40;
var MB_TR_BATCH_CHARS = 3000;
var MB_TR_NAMES = { en: 'English', ar: 'Arabic', fr: 'French' };
var MB_TR_STYLE = {
    ar: 'Write Modern Standard Arabic (الفصحى) in a formal, professional register. Objectives, steps and tasks start with a verbal noun (مصدر) or an imperative suited to a training manual, as the source does. Performance criteria stay passive statements of a result.',
    fr: 'Write professional French. Steps and tasks start with an infinitive verb. Performance criteria stay statements of a result. Use the typographic apostrophe (’) and French spacing before : ; ? !',
    en: 'Write clear professional English. Steps and tasks start with an action verb. Performance criteria stay passive statements of a result.'
};

/* Never walked: the DACUM texts and the AI translation memory are not
   the module's own texts (and mbI18n / mbTr are keyed by language). */
var MB_TR_SKIP_KEYS = /^(mbTr|mbI18n|taskAnalysisSource|occupationalReference|sourceTasks)$/;

/* Module-level run state, so a reopened dialog shows the run in progress. */
var _mbTr = { running: false, cancel: false, from: null, to: null, retr: false, msg: '', msgKind: '', done: 0, total: 0, last: null };

/* ── Small helpers ─────────────────────────────────────────── */

function _mbTrT(key, vars) {
    var i = window.i18n;
    if (!i) return key;
    if (vars && i.tf) return i.tf(key, vars);
    var s = i.t(key);
    if (vars) Object.keys(vars).forEach(function (k) { s = String(s).split('{' + k + '}').join(vars[k]); });
    return s;
}

function _mbTrEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
}

/** Short stable hash of a text (FNV-1a 32-bit + length). */
function mbTrHash(s) {
    s = String(s);
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(36) + '.' + s.length.toString(36);
}

function _mbTrTranslatable(s) { return /\p{L}/u.test(String(s)); }

function mbTrModule() {
    var id = (typeof mbLib !== 'undefined' && mbLib && mbLib.openId) || mbState.currentModuleId;
    return (mbState.modulesData || []).find(function (m) { return m.id === id; }) || null;
}

function _mbTrMap(m, lang, create) {
    if (!m) return null;
    var k = 'to_' + lang;
    if (!m.mbTr || typeof m.mbTr !== 'object') { if (!create) return null; m.mbTr = {}; }
    if (!m.mbTr[k] || typeof m.mbTr[k] !== 'object') { if (!create) return null; m.mbTr[k] = {}; }
    return m.mbTr[k];
}

/** What the library saves: the open module, its assessment forms, the shared pages. */
function _mbTrRoots(m) {
    var roots = [];
    if (m) {
        roots.push(m);
        if (typeof _mbFormsOf === 'function') roots.push(_mbFormsOf(m));
    }
    if (typeof mbCollectShared === 'function') roots.push(mbCollectShared());
    return roots;
}

/** Every pair worth translating: { pair, key }. */
function mbTrCollect(m) {
    var out = [], seen = new Set();
    function walk(v, key, parent) {
        if (v === null || typeof v !== 'object' || seen.has(v)) return;
        seen.add(v);
        if (biIs(v)) {
            if (key === 'code' || key === 'id' || key === 'uid') return;
            /* A factory label (cover rows) is seeded in every language by
               the app itself, not written by the author. */
            if (parent && parent.seedKey && key === 'label') return;
            out.push({ pair: v, key: key });
            return;
        }
        if (!Array.isArray(v) && Object.prototype.toString.call(v) !== '[object Object]') return;
        Object.keys(v).forEach(function (k) {
            if (MB_TR_SKIP_KEYS.test(k)) return;
            walk(v[k], k, v);
        });
    }
    _mbTrRoots(m).forEach(function (r) { walk(r, '', null); });
    return out;
}

function _mbTrSide(pair, lang) {
    var s = pair[lang];
    return (typeof s === 'string') ? s : '';
}

/** Per language: texts written, and which language the author wrote in. */
function mbTrStats(m, pairs) {
    pairs = pairs || mbTrCollect(m);
    var filled = {}, authored = {}, total = 0;
    BILANG_CODES.forEach(function (c) { filled[c] = 0; authored[c] = 0; });
    pairs.forEach(function (p) {
        var any = false;
        BILANG_CODES.forEach(function (c) {
            var t = _mbTrSide(p.pair, c);
            if (!t.trim()) return;
            any = true;
            filled[c]++;
            var map = _mbTrMap(m, c, false);
            if (!(map && map[mbTrHash(t)] !== undefined)) authored[c]++;
        });
        if (any) total++;
    });
    return { total: total, filled: filled, authored: authored };
}

function mbTrHasTranslations(m) {
    if (!m || !m.mbTr) return false;
    return Object.keys(m.mbTr).some(function (k) {
        return m.mbTr[k] && typeof m.mbTr[k] === 'object' && Object.keys(m.mbTr[k]).length > 0;
    });
}

function mbTrOriginal(m, stats) {
    if (m && BILANG_CODES.indexOf(m.contentOriginal) !== -1) return m.contentOriginal;
    stats = stats || mbTrStats(m);
    var best = null;
    BILANG_CODES.forEach(function (c) {
        if (stats.authored[c] > 0 && (best === null || stats.authored[c] > stats.authored[best])) best = c;
    });
    return best || contentLang();
}

/* ── Plan: what has to be sent ─────────────────────────────── */

/** { items: [{ src, holders: [pair…] }], matched } — each distinct source text once. */
function mbTrPlan(m, from, to, retranslate, pairs) {
    pairs = pairs || mbTrCollect(m);
    var map = _mbTrMap(m, to, false) || {};
    var byText = new Map(), items = [], hasSource = 0;
    pairs.forEach(function (p) {
        var src = _mbTrSide(p.pair, from);
        if (!src.trim() || !_mbTrTranslatable(src)) return;
        hasSource++;
        var tgt = _mbTrSide(p.pair, to);
        var empty = !tgt.trim();
        var ai = !empty && map[mbTrHash(tgt)] !== undefined;
        if (!(empty || (retranslate && ai))) return;
        var it = byText.get(src);
        if (!it) { it = { src: src, holders: [] }; byText.set(src, it); items.push(it); }
        it.holders.push(p.pair);
    });
    return { items: items, hasSource: hasSource };
}

function mbTrBatches(items) {
    var out = [], cur = [], chars = 0;
    items.forEach(function (it) {
        var n = it.src.length;
        if (cur.length && (cur.length >= MB_TR_BATCH_ITEMS || chars + n > MB_TR_BATCH_CHARS)) { out.push(cur); cur = []; chars = 0; }
        cur.push(it); chars += n;
    });
    if (cur.length) out.push(cur);
    return out;
}

function mbTrPrompt(from, to, batch, context) {
    var src = {};
    batch.forEach(function (it, i) { src[String(i + 1)] = it.src; });
    return 'You are a professional translator specialised in TVET (technical and vocational education and training) and competency-based training manuals.\n' +
        'Translate each value of the SOURCE object from ' + MB_TR_NAMES[from] + ' into ' + MB_TR_NAMES[to] + '.\n\n' +
        'RULES\n' +
        '- Translate the meaning faithfully and completely. Do not add, drop, explain, merge or summarise anything.\n' +
        '- Keep numbers, units, codes, standards (e.g. ISO 9001), abbreviations (e.g. PLC, CNC), brand and model names unchanged, in Latin script with Western digits.\n' +
        '- Keep line breaks, bullets and list numbering exactly as in the source.\n' +
        '- ' + (MB_TR_STYLE[to] || '') + '\n' +
        '- A value that is a proper name or is already in ' + MB_TR_NAMES[to] + ' is returned unchanged.\n\n' +
        (context ? 'CONTEXT (for meaning only — do not translate): ' + context + '\n\n' : '') +
        'SOURCE\n' + JSON.stringify(src) + '\n\n' +
        'OUTPUT FORMAT\nReturn ONLY a JSON object with exactly the same ids: {"t":{"1":"<translation>","2":"<translation>"}}';
}

/** A one-line source stays one line; the model's own line breaks would split it. */
function mbTrTidy(src, t) {
    var v = String(t).trim();
    if (String(src).indexOf('\n') === -1) v = v.replace(/\s*\n\s*/g, ' ');
    return v;
}

/* ── AI call ───────────────────────────────────────────────── */

async function _mbTrCallAI(prompt) {
    var base = (typeof MB_AI_BACKEND_BASE !== 'undefined') ? MB_AI_BACKEND_BASE : 'https://dacum-ai-backend-production.up.railway.app';
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 90000);
    var res;
    try {
        res = await fetch(base + '/api/generate-dacum', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: prompt }), signal: controller.signal
        });
    } finally { clearTimeout(timer); }
    if (!res.ok) throw (typeof mbAIErrorFromResponse === 'function' ? await mbAIErrorFromResponse(res) : new Error('HTTP ' + res.status));
    var data = await res.json();
    if (data && typeof data === 'object' && data.t && typeof data.t === 'object') return data;
    var raw = '';
    if (data && Array.isArray(data.content)) raw = data.content.map(function (b) { return (b && b.type !== 'tool_use' && b.text) || ''; }).join('');
    else if (data && typeof data.text === 'string') raw = data.text;
    var body = raw.trim().replace(/```json\s*/gi, '').replace(/```/g, '').trim();
    var bad = function (why) {
        var err = new Error('badReply: ' + why);
        err.detail = body.slice(0, 300);          // shown under "Technical details"
        return err;
    };
    if (!body) throw bad('empty AI reply');
    try { return JSON.parse(body); } catch (e) {
        var a = body.indexOf('{'), b = body.lastIndexOf('}');
        if (a !== -1 && b > a) { try { return JSON.parse(body.slice(a, b + 1)); } catch (_) {} }
        throw bad(data && data.stop_reason === 'max_tokens' ? 'AI reply was cut off' : 'not JSON');
    }
}

/** The { "1": text, … } object of a reply, whichever of the usual shapes the model chose:
 *  {t:{…}}, {translations:{…}}, the bare object, or an array in the order sent. */
function _mbTrAnswers(reply) {
    var t = reply && (reply.t || reply.translations || reply.translation || reply);
    if (Array.isArray(t)) { var o = {}; t.forEach(function (v, i) { o[String(i + 1)] = v; }); t = o; }
    return (t && typeof t === 'object') ? t : {};
}

/** Write the answers of one batch into the pairs; returns how many texts were stored. */
function _mbTrApply(m, batch, reply, to) {
    var t = _mbTrAnswers(reply);
    var map = _mbTrMap(m, to, true), n = 0;
    batch.forEach(function (it, i) {
        var v = t[String(i + 1)];
        if (v && typeof v === 'object') v = v.t || v.text || v.translation;
        if (typeof v !== 'string' || !v.trim()) return;
        var tr = mbTrTidy(it.src, v);
        if (!tr) return;
        it.holders.forEach(function (pair) { pair[to] = tr; });
        map[mbTrHash(tr)] = mbTrHash(it.src);
        n++;
    });
    return n;
}

/* ── Run ───────────────────────────────────────────────────── */

function _mbTrSay(text, kind) {
    _mbTr.msg = text || '';
    _mbTr.msgKind = kind || '';
    var el = document.getElementById('mbtr-msg');
    if (el) { el.textContent = _mbTr.msg; el.className = 'mbtr-msg' + (kind ? ' is-' + kind : ''); }
}

function _mbTrSetBusy(busy) {
    var go = document.querySelector('#ws-overlay [data-mbtr="go"]');
    var stop = document.querySelector('#ws-overlay [data-mbtr="stop"]');
    if (go) go.disabled = !!busy;
    if (stop) stop.hidden = !busy;
    document.querySelectorAll('#ws-overlay [data-mbtr="from"], #ws-overlay [data-mbtr="to"], #ws-overlay [data-mbtr="retr"]')
        .forEach(function (el) { el.disabled = !!busy; });
}

async function mbTrRun(from, to, retranslate) {
    if (_mbTr.running) return;
    var m = mbTrModule();
    if (!m) { _mbTrSay(_mbTrT('mbTrNoModule'), 'error'); return; }
    if (from === to) { _mbTrSay(_mbTrT('mbTrSame'), 'error'); return; }

    /* Whatever is typed on screen goes into the state first, exactly as a save does. */
    if (typeof _mbLibFlush === 'function') _mbLibFlush();

    var pairs = mbTrCollect(m);
    var plan = mbTrPlan(m, from, to, retranslate, pairs);
    if (!plan.hasSource) { _mbTrSay(_mbTrT('mbTrNoSource', { v0: biLangLabel(from) }), 'error'); return; }
    if (!plan.items.length) { _mbTrSay(_mbTrT('mbTrNothing', { v0: biLangLabel(to) }), 'ok'); return; }

    var queue = mbTrBatches(plan.items);
    var context = biGet(m.title, from) || '';
    var total = plan.items.length, done = 0, failed = 0, lastError = null, stopped = false, fatal = false;
    _mbTr.running = true; _mbTr.cancel = false; _mbTr.done = 0; _mbTr.total = total;
    _mbTrSetBusy(true);

    try {
        while (queue.length) {
            if (_mbTr.cancel) { stopped = true; break; }
            var batch = queue.shift();
            _mbTrSay(_mbTrT('mbTrProgress', { v0: done, v1: total }), 'busy');
            try {
                var reply = await _mbTrCallAI(mbTrPrompt(from, to, batch, context));
                var n = _mbTrApply(m, batch, reply, to);
                if (!n) throw new Error('badReply: no translations in the reply');
                done += n;
                _mbTr.done = done;
                /* Stored and shown at once: a stopped or failed run keeps what it did,
                   and the fields never hold a stale copy of a side the run just filled. */
                if (to === contentLang() && typeof mbRepaintContent === 'function') mbRepaintContent();
                if (typeof updateContentLangHint === 'function') updateContentLangHint();
            } catch (err) {
                var kind = (typeof mbClassifyAIError === 'function') ? mbClassifyAIError(err) : 'failed';
                if (kind === 'offline' || kind === 'credit' || kind === 'auth' || kind === 'rate') { lastError = err; fatal = true; break; }
                if (batch.length > 1) {
                    /* One bad text (a stray quote, a long line) must not lose its neighbours:
                       retry the two halves on their own. */
                    var half = Math.ceil(batch.length / 2);
                    queue.unshift(batch.slice(0, half), batch.slice(half));
                } else {
                    failed++;
                    lastError = err;
                }
            }
        }
    } finally {
        _mbTr.running = false;
        _mbTrSetBusy(false);
    }

    if (typeof mbLibrarySave === 'function') { try { mbLibrarySave(); } catch (e) { console.warn('[translate] save', e); } }

    var counts = { v0: done, v1: total, v2: biLangLabel(to) };
    if (stopped) _mbTrSay(_mbTrT('mbTrStopped', counts), 'warn');
    else if (done >= total) _mbTrSay(_mbTrT('mbTrDone', { v0: done, v1: biLangLabel(to) }), 'ok');
    else _mbTrSay(_mbTrT('mbTrDoneMissing', counts), 'warn');
    _mbTr.last = { to: to, done: done };
    _mbTrRefresh();
    if (lastError && typeof mbShowAIError === 'function') {
        mbShowAIError(lastError, { safeKey: 'mbTrSafe' });
    }
}

/* ── Reset to default ──────────────────────────────────────── */

/** Remove the AI translations of the open module (texts edited by hand stay),
 *  show the original language again. */
async function mbTrReset() {
    var m = mbTrModule();
    if (!m || _mbTr.running || !mbTrHasTranslations(m)) return;
    if (typeof mbConfirm === 'function' &&
        !(await mbConfirm(_mbTrT('mbTrResetConfirm'), { danger: true, okLabel: _mbTrT('mbTrResetOk') }))) return;

    if (typeof _mbLibFlush === 'function') _mbLibFlush();
    var original = mbTrOriginal(m);
    /* Back to the original first (flushes the screen into the side being left). */
    if (contentLang() !== original && typeof switchContentLang === 'function') switchContentLang(original);
    if (typeof setExportLang === 'function') setExportLang(original);

    var n = 0;
    mbTrCollect(m).forEach(function (p) {
        BILANG_CODES.forEach(function (c) {
            var map = _mbTrMap(m, c, false);
            var t = _mbTrSide(p.pair, c);
            if (map && t && map[mbTrHash(t)] !== undefined) { p.pair[c] = ''; n++; }
        });
    });
    delete m.mbTr;
    if (typeof mbRepaintContent === 'function') mbRepaintContent();
    if (typeof mbLibrarySave === 'function') { try { mbLibrarySave(); } catch (e) { console.warn('[translate] save', e); } }

    _mbTr.last = null; _mbTr.from = null; _mbTr.to = null;
    _mbTrSay(_mbTrT('mbTrResetDone', { v0: n }), 'ok');
    _mbTrRefresh();
}

/* ── The Language pane section ─────────────────────────────── */

function _mbTrSection() {
    var m = mbTrModule();
    var pairs = m ? mbTrCollect(m) : [];
    var stats = mbTrStats(m, pairs);
    var original = mbTrOriginal(m, stats);
    var shown = contentLang();
    var locked = mbTrHasTranslations(m);

    if (BILANG_CODES.indexOf(_mbTr.from) === -1) _mbTr.from = original;
    if (BILANG_CODES.indexOf(_mbTr.to) === -1 || _mbTr.to === _mbTr.from) {
        var others = BILANG_CODES.filter(function (c) { return c !== _mbTr.from; });
        others.sort(function (a, b) { return stats.filled[a] - stats.filled[b]; });
        _mbTr.to = others[0];
    }

    var opts = function (sel, skip) {
        return BILANG_CODES.map(function (c) {
            return '<option value="' + c + '"' + (c === sel ? ' selected' : '') + (c === skip ? ' disabled' : '') + '>' +
                _mbTrEsc(biLangLabel(c)) + '</option>';
        }).join('');
    };

    /* Only the versions that exist, as in DACUM Live Pro: the original, the
       languages holding an AI translation, and the one on screen. A language
       nobody has translated into is not a version yet — it appears when it is. */
    var versions = BILANG_CODES.filter(function (c) {
        var map = _mbTrMap(m, c, false);
        return c === original || c === shown || (map && Object.keys(map).length > 0);
    });
    var cards = versions.map(function (c) {
        return '<button type="button" class="mbtr-lang' + (c === shown ? ' is-on' : '') + '" data-mbtr="show" data-lang="' + c +
               '" role="radio" aria-checked="' + (c === shown ? 'true' : 'false') + '">' +
            '<span class="mbtr-dot" aria-hidden="true"></span>' +
            '<span class="mbtr-lname">' + _mbTrEsc(biLangLabel(c)) + '</span>' +
            (c === original ? '<span class="mbtr-pill">' + _mbTrEsc(_mbTrT('mbTrBadgeOriginal')) + '</span>' : '') +
            (c === shown ? '<span class="mbtr-pill is-shown">' + _mbTrEsc(_mbTrT('mbTrBadgeShown')) + '</span>' : '') +
            '<span class="mbtr-cov">' + _mbTrEsc(_mbTrT('mbTrCoverage', { v0: stats.filled[c], v1: stats.total })) + '</span>' +
            '</button>';
    }).join('');

    var showBtn = (_mbTr.last && !_mbTr.running && _mbTr.last.done > 0 && _mbTr.last.to !== shown)
        ? ' <button type="button" class="mbtr-link" data-mbtr="show" data-lang="' + _mbTr.last.to + '">' +
          _mbTrEsc(_mbTrT('mbTrShowTranslated')) + '</button>' : '';

    return '' +
        '<h4 class="ws-group">📚 ' + _mbTrEsc(_mbTrT('mbTrTitle')) + '</h4>' +
        '<div class="mbtr-card">' +
            '<label class="mbtr-label" for="mbtr-original">' + _mbTrEsc(_mbTrT('mbTrOriginalLabel')) + '</label>' +
            '<select id="mbtr-original" class="mbtr-select" data-mbtr="original"' + (locked || !m ? ' disabled' : '') + '>' + opts(original) + '</select>' +
            '<p class="mbtr-note">' + _mbTrEsc(_mbTrT('mbTrOriginalNote')) + '</p>' +
            '<div class="mbtr-langs" role="radiogroup">' + cards + '</div>' +
            '<button type="button" class="mbtr-reset" data-mbtr="reset"' + (locked && !_mbTr.running ? '' : ' disabled') + '>\u21BA ' +
                _mbTrEsc(_mbTrT('mbTrReset')) + '</button>' +
            '<p class="mbtr-note">' + _mbTrEsc(_mbTrT('mbTrResetNote')) + '</p>' +
            (versions.length > 1 ? '<p class="mbtr-note">' + _mbTrEsc(_mbTrT('mbTrShowNote')) + '</p>' : '') +
        '</div>' +
        '<div class="mbtr-card">' +
            '<div class="mbtr-head"><span class="mbtr-title">🤖 ' + _mbTrEsc(_mbTrT('mbTrTranslateTitle')) + '</span>' +
            '<span class="mbtr-ai">' + _mbTrEsc(_mbTrT('mbTrAI')) + '</span></div>' +
            '<div class="mbtr-row">' +
                '<label class="mbtr-label" for="mbtr-from">' + _mbTrEsc(_mbTrT('mbTrFrom')) + '</label>' +
                '<select id="mbtr-from" class="mbtr-select" data-mbtr="from">' + opts(_mbTr.from) + '</select>' +
                '<span class="mbtr-arrow" aria-hidden="true">→</span>' +
                '<label class="mbtr-label" for="mbtr-to">' + _mbTrEsc(_mbTrT('mbTrTo')) + '</label>' +
                '<select id="mbtr-to" class="mbtr-select" data-mbtr="to">' + opts(_mbTr.to, _mbTr.from) + '</select>' +
            '</div>' +
            '<label class="mbtr-check"><input type="checkbox" data-mbtr="retr"' + (_mbTr.retr ? ' checked' : '') + '> ' +
                '<span>' + _mbTrEsc(_mbTrT('mbTrRetranslate')) + '</span></label>' +
            '<p class="mbtr-note">' + _mbTrEsc(_mbTrT('mbTrScopeNote')) + '</p>' +
            '<div class="mbtr-actions">' +
                '<button type="button" class="ws-btn ws-btn-primary mbtr-go" data-mbtr="go"' + (_mbTr.running || !m ? ' disabled' : '') + '>🌐 ' + _mbTrEsc(_mbTrT('mbTrButton')) + '</button>' +
                '<button type="button" class="ws-btn ws-btn-ghost" data-mbtr="stop"' + (_mbTr.running ? '' : ' hidden') + '>' + _mbTrEsc(_mbTrT('mbTrStop')) + '</button>' +
                '<span id="mbtr-msg" class="mbtr-msg' + (_mbTr.msgKind ? ' is-' + _mbTr.msgKind : '') + '" role="status" aria-live="polite">' + _mbTrEsc(_mbTr.msg) + '</span>' +
                showBtn +
            '</div>' +
        '</div>';
}

/** Markup for Settings → Language (word_settings.js _wsPaneLang). */
function mbTranslatePaneHTML() {
    _mbTrEnsureStyle();
    var html;
    try { html = _mbTrSection(); } catch (e) { console.warn('[translate] pane', e); html = ''; }
    return '<div id="mbtr-root">' + html + '</div>';
}

function _mbTrRefresh() {
    var root = document.getElementById('mbtr-root');
    if (!root) return;
    try { root.innerHTML = _mbTrSection(); } catch (e) { console.warn('[translate] refresh', e); }
}

function _mbTrEnsureStyle() {
    if (document.getElementById('mbtr-style')) return;
    var s = document.createElement('style');
    s.id = 'mbtr-style';
    s.textContent = [
        '#ws-overlay .mbtr-card{margin:0 0 16px;padding:14px 16px;border:1px solid #e2e8f0;border-radius:12px;background:#fff;}',
        '#ws-overlay .mbtr-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 12px;}',
        '#ws-overlay .mbtr-title{font-weight:700;color:#0f172a;}',
        '#ws-overlay .mbtr-ai{font-size:.75em;font-weight:700;padding:3px 10px;border-radius:999px;background:#f1f5f9;color:#475569;}',
        '#ws-overlay .mbtr-label{font-weight:600;color:#334155;}',
        '#ws-overlay .mbtr-row{display:flex;align-items:center;flex-wrap:wrap;gap:8px 10px;margin:0 0 12px;}',
        '#ws-overlay .mbtr-arrow{color:#64748b;}',
        '#ws-overlay .mbtr-select{padding:7px 10px;border:1.5px solid #d1d5db;border-radius:8px;background:#fff;font:inherit;min-width:150px;}',
        '#ws-overlay .mbtr-card > .mbtr-label{display:block;margin:0 0 6px;}',
        '#ws-overlay .mbtr-note{margin:8px 0 0;color:#64748b;font-size:.88em;line-height:1.5;}',
        '#ws-overlay .mbtr-langs{display:flex;flex-direction:column;gap:8px;margin:14px 0 0;}',
        '#ws-overlay .mbtr-lang{display:flex;align-items:center;flex-wrap:wrap;gap:8px 10px;width:100%;padding:12px 14px;border:1px solid #e2e8f0;border-radius:10px;background:#fff;font:inherit;text-align:start;cursor:pointer;}',
        '#ws-overlay .mbtr-lang:hover{border-color:#c7d2fe;background:#f8faff;}',
        '#ws-overlay .mbtr-lang.is-on{border-color:#0e7490;box-shadow:inset 0 0 0 1px #0e7490;}',
        '#ws-overlay .mbtr-dot{flex:0 0 auto;width:16px;height:16px;border-radius:50%;border:2px solid #94a3b8;box-sizing:border-box;}',
        '#ws-overlay .mbtr-lang.is-on .mbtr-dot{border-color:#0e7490;background:radial-gradient(#0e7490 45%,transparent 50%);}',
        '#ws-overlay .mbtr-lname{font-weight:700;font-size:1.05em;min-width:110px;}',
        '#ws-overlay .mbtr-pill{font-size:.75em;font-weight:700;padding:3px 10px;border-radius:999px;background:#eef2f7;color:#334155;border:1px solid #d9e0ea;}',
        '#ws-overlay .mbtr-pill.is-shown{background:#0284c7;border-color:#0284c7;color:#fff;}',
        '#ws-overlay .mbtr-cov{margin-inline-start:auto;color:#64748b;font-size:.85em;}',
        '#ws-overlay .mbtr-check{display:flex;align-items:flex-start;gap:9px;margin:0;color:#334155;font-weight:600;cursor:pointer;}',
        '#ws-overlay .mbtr-check input{margin-top:4px;width:16px;height:16px;accent-color:#0284c7;}',
        '#ws-overlay .mbtr-actions{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin:14px 0 0;}',
        '#ws-overlay .mbtr-actions .mbtr-go{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:50px;',
        'padding:12px 34px;border:none;border-radius:12px;color:#fff;font:inherit;font-size:1.1em;font-weight:700;letter-spacing:.01em;',
        'background:linear-gradient(135deg,#0ea5e9,#0369a1);box-shadow:0 4px 14px rgba(3,105,161,.32);cursor:pointer;',
        'transition:transform .12s,box-shadow .12s,filter .12s;}',
        '#ws-overlay .mbtr-actions .mbtr-go:hover:not(:disabled){transform:translateY(-1px);box-shadow:0 6px 18px rgba(3,105,161,.4);filter:brightness(1.05);}',
        '#ws-overlay .mbtr-actions .mbtr-go:focus-visible{outline:3px solid #7dd3fc;outline-offset:2px;}',
        '#ws-overlay .mbtr-actions .mbtr-go:disabled{opacity:.6;box-shadow:none;cursor:progress;}',
        '#ws-overlay .mbtr-go-ico{font-size:1.25em;line-height:1;}',
        '#ws-overlay .mbtr-stop{min-height:50px;padding:10px 22px;border:1.5px solid #cbd5e1;border-radius:12px;background:#fff;color:#334155;font:inherit;font-weight:600;cursor:pointer;}',
        '#ws-overlay .mbtr-stop:hover{border-color:#94a3b8;background:#f8fafc;}',
        '#ws-overlay .mbtr-reset{margin:14px 0 0;padding:9px 16px;border:1.5px solid #cbd5e1;border-radius:10px;background:#fff;color:#334155;font:inherit;font-weight:600;cursor:pointer;}',
        '#ws-overlay .mbtr-reset:hover:not(:disabled){border-color:#94a3b8;background:#f8fafc;}',
        '#ws-overlay .mbtr-reset:disabled{opacity:.5;cursor:not-allowed;}',
        '#ws-overlay .mbtr-msg{flex:1 1 100%;}',
        '@media (max-width:700px){#ws-overlay .mbtr-actions .mbtr-go{width:100%;}}',
        '#ws-overlay .mbtr-msg{font-size:.9em;color:#475569;}',
        '#ws-overlay .mbtr-msg.is-ok{color:#047857;}',
        '#ws-overlay .mbtr-msg.is-warn{color:#b45309;}',
        '#ws-overlay .mbtr-msg.is-error{color:#b91c1c;}',
        '#ws-overlay .mbtr-link{border:none;background:none;color:#0369a1;font:inherit;font-weight:600;text-decoration:underline;cursor:pointer;padding:0;}',
        '#ws-overlay [hidden]{display:none !important;}'
    ].join('');
    document.head.appendChild(s);
}

/* ── Events (delegated: the dialog is built on demand) ─────── */

document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest ? e.target.closest('#ws-overlay [data-mbtr]') : null;
    if (!b) return;
    var act = b.getAttribute('data-mbtr');
    if (act === 'show') {
        var code = b.getAttribute('data-lang');
        if (BILANG_CODES.indexOf(code) === -1) return;
        /* One choice for both: the version shown is the one the exports use. */
        if (typeof switchContentLang === 'function') switchContentLang(code);
        if (typeof setExportLang === 'function') setExportLang(code);
        if (typeof renderExportLangSwitch === 'function') renderExportLangSwitch();
        _mbTrRefresh();
    } else if (act === 'go') {
        mbTrRun(_mbTr.from, _mbTr.to, !!_mbTr.retr);
    } else if (act === 'stop') {
        _mbTr.cancel = true;
    } else if (act === 'reset') {
        mbTrReset();
    }
});

document.addEventListener('change', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('#ws-overlay [data-mbtr]') : null;
    if (!el) return;
    var act = el.getAttribute('data-mbtr');
    if (act === 'from') { _mbTr.from = el.value; if (_mbTr.to === _mbTr.from) _mbTr.to = null; _mbTrRefresh(); }
    else if (act === 'to') { _mbTr.to = el.value; }
    else if (act === 'retr') { _mbTr.retr = !!el.checked; }
    else if (act === 'original') {
        var m = mbTrModule();
        if (m && BILANG_CODES.indexOf(el.value) !== -1 && !mbTrHasTranslations(m)) {
            m.contentOriginal = el.value;
            _mbTr.from = el.value; _mbTr.to = null;
            if (typeof mbLibrarySave === 'function') { try { mbLibrarySave(); } catch (err) { console.warn('[translate] save', err); } }
            _mbTrRefresh();
        }
    }
});
