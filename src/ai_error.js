// ============================================================
// /src/ai_error.js — the AI service warning (3.65.0)
// ------------------------------------------------------------
// When the AI service cannot do what was asked — the server is off or
// unreachable, its credit ran out, too many requests, a server error,
// a missing key, a cut-off reply — a modal says which, what to do, and
// that nothing in the project changed. The same card as DACUM Live Pro
// (ai_client.js showAIServiceError), so a user of both tools reads one
// message.
//
//   throw await mbAIErrorFromResponse(res)   a failed response, classified
//   mbShowAIError(err, { safeKey, tipKeys }) the modal; returns the kind
// ============================================================

if (window.i18n && window.i18n.extend) window.i18n.extend({
    en: {
        aiSvcOfflineTitle: 'AI service is not reachable',
        aiSvcOfflineBody: 'The tool could not reach the AI server. Check your internet connection and try again in a moment. If the problem continues, the AI server may be offline — contact the tool administrator.',
        aiSvcCreditTitle: 'AI service credit has run out',
        aiSvcCreditBody: 'The AI account used by this tool has no remaining credit, so generation is paused. Please contact the tool administrator to top up the account. You can continue working manually in the meantime.',
        aiSvcRateTitle: 'Too many requests — please wait',
        aiSvcRateBody: 'The AI service received too many requests in a short time. Wait about a minute, then try again.',
        aiSvcBusyTitle: 'AI service is temporarily busy',
        aiSvcBusyBody: 'The AI service is overloaded, had a temporary server error, or took too long to answer. Try again in a few minutes.',
        aiSvcAuthTitle: 'AI service is not configured',
        aiSvcAuthBody: 'The AI server rejected the request because its access key is missing or invalid. This is a server setting — please report it to the tool administrator.',
        aiSvcIncompleteTitle: 'The AI reply was incomplete',
        aiSvcIncompleteBody: 'A reply arrived but it was cut off or not in the expected format, so nothing was applied. Try again; if it repeats, work on a smaller part at a time.',
        aiSvcFailedTitle: 'The AI request failed',
        aiSvcFailedBody: 'An unexpected error stopped the request. Try again; if it repeats, report the technical details below to the tool administrator.',
        aiSvcDetails: 'Technical details',
        aiSvcSafeGeneric: 'Nothing in your project was changed.',
        aiSvcWhatInstead: 'What you can do instead:',
        aiSvcGotIt: 'Got it'
    },
    fr: {
        aiSvcOfflineTitle: 'Service d’IA injoignable',
        aiSvcOfflineBody: 'L’outil n’a pas pu joindre le serveur d’IA. Vérifiez votre connexion Internet et réessayez dans un instant. Si le problème persiste, le serveur est peut-être hors ligne — contactez l’administrateur de l’outil.',
        aiSvcCreditTitle: 'Crédit du service d’IA épuisé',
        aiSvcCreditBody: 'Le compte d’IA utilisé par cet outil n’a plus de crédit : la génération est suspendue. Contactez l’administrateur de l’outil pour recharger le compte. En attendant, vous pouvez continuer manuellement.',
        aiSvcRateTitle: 'Trop de requêtes — veuillez patienter',
        aiSvcRateBody: 'Le service d’IA a reçu trop de requêtes en peu de temps. Attendez environ une minute puis réessayez.',
        aiSvcBusyTitle: 'Service d’IA momentanément surchargé',
        aiSvcBusyBody: 'Le service d’IA est surchargé, a rencontré une erreur temporaire ou a mis trop de temps à répondre. Réessayez dans quelques minutes.',
        aiSvcAuthTitle: 'Service d’IA non configuré',
        aiSvcAuthBody: 'Le serveur d’IA a refusé la requête car sa clé d’accès est absente ou invalide. Il s’agit d’un réglage du serveur — signalez-le à l’administrateur de l’outil.',
        aiSvcIncompleteTitle: 'Réponse de l’IA incomplète',
        aiSvcIncompleteBody: 'Une réponse est arrivée mais elle était tronquée ou dans un format inattendu ; rien n’a été appliqué. Réessayez ; si cela se répète, travaillez sur une plus petite partie à la fois.',
        aiSvcFailedTitle: 'La requête à l’IA a échoué',
        aiSvcFailedBody: 'Une erreur inattendue a interrompu la requête. Réessayez ; si cela se répète, transmettez les détails techniques ci-dessous à l’administrateur de l’outil.',
        aiSvcDetails: 'Détails techniques',
        aiSvcSafeGeneric: 'Rien n’a été modifié dans votre projet.',
        aiSvcWhatInstead: 'Ce que vous pouvez faire à la place :',
        aiSvcGotIt: 'Compris'
    },
    ar: {
        aiSvcOfflineTitle: 'تعذّر الوصول إلى خدمة الذكاء الاصطناعي',
        aiSvcOfflineBody: 'لم تتمكن الأداة من الوصول إلى خادم الذكاء الاصطناعي. تحقّق من اتصالك بالإنترنت وأعد المحاولة بعد قليل. إذا استمرت المشكلة فقد يكون الخادم متوقفاً — تواصل مع مسؤول الأداة.',
        aiSvcCreditTitle: 'نفد رصيد خدمة الذكاء الاصطناعي',
        aiSvcCreditBody: 'لم يعد في حساب الذكاء الاصطناعي الذي تستخدمه الأداة رصيد متبقٍ، لذا توقف التوليد مؤقتاً. يُرجى التواصل مع مسؤول الأداة لإعادة شحن الحساب. يمكنك متابعة العمل يدوياً في الأثناء.',
        aiSvcRateTitle: 'طلبات كثيرة — يُرجى الانتظار',
        aiSvcRateBody: 'تلقّت خدمة الذكاء الاصطناعي طلبات كثيرة خلال وقت قصير. انتظر نحو دقيقة ثم أعد المحاولة.',
        aiSvcBusyTitle: 'خدمة الذكاء الاصطناعي مشغولة مؤقتاً',
        aiSvcBusyBody: 'الخدمة مثقلة بالطلبات، أو واجهت خطأً مؤقتاً في الخادم، أو تأخرت كثيراً في الرد. أعد المحاولة بعد بضع دقائق.',
        aiSvcAuthTitle: 'خدمة الذكاء الاصطناعي غير مهيّأة',
        aiSvcAuthBody: 'رفض خادم الذكاء الاصطناعي الطلب لأن مفتاح الوصول مفقود أو غير صالح. هذا إعداد في الخادم — يُرجى إبلاغ مسؤول الأداة.',
        aiSvcIncompleteTitle: 'رد الذكاء الاصطناعي غير مكتمل',
        aiSvcIncompleteBody: 'وصل رد لكنه كان مقطوعاً أو بصيغة غير متوقعة، فلم يُطبَّق شيء. أعد المحاولة؛ وإذا تكرر ذلك فاعمل على جزء أصغر في كل مرة.',
        aiSvcFailedTitle: 'تعذّر طلب الذكاء الاصطناعي',
        aiSvcFailedBody: 'أوقف خطأ غير متوقع الطلب. أعد المحاولة؛ وإذا تكرر ذلك فأرسل التفاصيل التقنية أدناه إلى مسؤول الأداة.',
        aiSvcDetails: 'تفاصيل تقنية',
        aiSvcSafeGeneric: 'لم يتغير شيء في مشروعك.',
        aiSvcWhatInstead: 'ما يمكنك فعله بدلاً من ذلك:',
        aiSvcGotIt: 'فهمت'
    }
});

function MbAIError(kind, message, detail) {
    var e = new Error(message || kind);
    e.name = 'MbAIError';
    e.aiKind = kind;
    e.detail = detail || '';
    return e;
}

/** A failed backend response, read and classified (as DACUM Live Pro). */
async function mbAIErrorFromResponse(res) {
    var body = '';
    try { body = await res.text(); } catch (e) { /* no body */ }
    var s = res.status, b = body.toLowerCase();
    var kind = 'failed';
    if (b.indexOf('credit balance') !== -1 || b.indexOf('billing') !== -1 || b.indexOf('insufficient') !== -1 || s === 402) kind = 'credit';
    else if (b.indexOf('api key not configured') !== -1 || b.indexOf('authentication') !== -1 || b.indexOf('invalid x-api-key') !== -1 || s === 401 || s === 403) kind = 'auth';
    else if (s === 429 || b.indexOf('rate_limit') !== -1 || b.indexOf('rate limit') !== -1) kind = 'rate';
    else if (s >= 500) kind = 'busy';
    else if (s === 404) kind = 'offline';
    return MbAIError(kind, 'HTTP ' + s, body.slice(0, 300));
}

/** Any error thrown on the way: a fetch that never reached the server,
 *  a timeout, a reply that would not parse. */
function mbClassifyAIError(err) {
    if (err && err.aiKind) return err.aiKind;
    if (err && err.name === 'AbortError') return 'busy';
    var m = String((err && err.message) || err || '');
    if (/Failed to fetch|NetworkError|Load failed|network|ECONNREFUSED|ERR_CONNECTION|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED/i.test(m)) return 'offline';
    if (err instanceof SyntaxError || /JSON|parse|Unexpected token|badReply/i.test(m)) return 'incomplete';
    if (/\b429\b/.test(m)) return 'rate';
    if (/\b5\d\d\b/.test(m)) return 'busy';
    return 'failed';
}

var MB_AI_ERR_KINDS = {
    offline:    { icon: '\u{1F50C}', title: 'aiSvcOfflineTitle',    body: 'aiSvcOfflineBody',    red: false },
    credit:     { icon: '\u{1F4B3}', title: 'aiSvcCreditTitle',     body: 'aiSvcCreditBody',     red: true },
    rate:       { icon: '⏳',        title: 'aiSvcRateTitle',       body: 'aiSvcRateBody',       red: false },
    busy:       { icon: '\u{1F6A7}', title: 'aiSvcBusyTitle',       body: 'aiSvcBusyBody',       red: false },
    auth:       { icon: '\u{1F511}', title: 'aiSvcAuthTitle',       body: 'aiSvcAuthBody',       red: true },
    incomplete: { icon: '✂️',        title: 'aiSvcIncompleteTitle', body: 'aiSvcIncompleteBody', red: false },
    failed:     { icon: '⚠️',        title: 'aiSvcFailedTitle',     body: 'aiSvcFailedBody',     red: true }
};

/** The warning. opts.safeKey — the "nothing changed" line (default the
 *  generic one); opts.tipKeys — "what you can do instead" lines. */
function mbShowAIError(err, opts) {
    opts = opts || {};
    var kind = mbClassifyAIError(err);
    var k = MB_AI_ERR_KINDS[kind] || MB_AI_ERR_KINDS.failed;
    var t = function (key) { return window.i18n ? window.i18n.t(key) : key; };
    var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
    console.error('[ai-service]', kind, err);

    var old = document.getElementById('mb-ai-err');
    if (old) old.remove();
    var detail = [err && err.message, err && err.detail].filter(Boolean).join(' — ');
    var tips = (opts.tipKeys || []).filter(Boolean);
    var safe = opts.safeKey === null ? '' : (opts.safeKey || 'aiSvcSafeGeneric');

    var ov = document.createElement('div');
    ov.id = 'mb-ai-err';
    ov.className = 'mb-ai-err' + (k.red ? ' is-red' : '');
    ov.setAttribute('role', 'alertdialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-labelledby', 'mb-ai-err-title');
    ov.setAttribute('data-kind', kind);
    ov.setAttribute('dir', (window.i18n && window.i18n.isRTL && window.i18n.isRTL()) ? 'rtl' : 'ltr');
    ov.innerHTML =
        '<div class="mb-ai-err-box" tabindex="-1">' +
            '<div class="mb-ai-err-head"><span class="mb-ai-err-icon" aria-hidden="true">' + k.icon + '</span>' +
                '<p id="mb-ai-err-title">' + esc(t(k.title)) + '</p></div>' +
            '<div class="mb-ai-err-body">' +
                '<p>' + esc(t(k.body)) + '</p>' +
                (safe ? '<p class="mb-ai-err-safe">✅ ' + esc(t(safe)) + '</p>' : '') +
                (tips.length ? '<p class="mb-ai-err-tips-h">' + esc(t('aiSvcWhatInstead')) + '</p><ul>' +
                    tips.map(function (tk) { return '<li>' + esc(t(tk)) + '</li>'; }).join('') + '</ul>' : '') +
                (detail ? '<details><summary>' + esc(t('aiSvcDetails')) + '</summary><code>' + esc(detail) + '</code></details>' : '') +
            '</div>' +
            '<div class="mb-ai-err-foot"><button type="button" class="mb-ai-err-ok">' + esc(t('aiSvcGotIt')) + '</button></div>' +
        '</div>';
    document.body.appendChild(ov);
    var back = document.activeElement;
    var close = function () {
        ov.remove();
        document.removeEventListener('keydown', onKey, true);
        if (back && back.isConnected && back.focus) back.focus();
    };
    var onKey = function (e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    document.addEventListener('keydown', onKey, true);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    var ok = ov.querySelector('.mb-ai-err-ok');
    ok.addEventListener('click', close);
    ok.focus();
    return kind;
}
