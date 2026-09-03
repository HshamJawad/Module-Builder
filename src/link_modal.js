// ============================================================
// /src/link_modal.js
// The QR/link card, moved off the sheet and into a dialog.
//
// ── WHY THE OLD FIELDS ARE STILL IN THE PAGE ────────────────
// They are hidden, not deleted, and they keep their ids. sheets.js
// reads and writes them by id, and the Word and PDF exporters read what
// sheets.js stored. Rewriting that chain to move three inputs would
// have put both exports at risk for a layout change. This dialog simply
// drives the same inputs, so Word and PDF are untouched — byte for
// byte.
//
// ── LINK TYPE ──────────────────────────────────────────────
// One field, two meanings. A video link is EMBEDDED in the HTML export
// as a player; a page link stays a link. The type is auto-detected from
// the URL and the user can override it, because detection cannot know
// that a self-hosted .mp4 on an unknown domain is a video, and it
// cannot know that a YouTube channel page is not one.
// ============================================================

var _LM_STRINGS = {
    en: {
        btn: 'Link / QR',
        title: 'Video, Link &amp; QR Code',
        subject: 'Video / Resource subject',
        subjectPh: 'e.g. Paintless Dent Removal Tutorial',
        url: 'Video / Resource link',
        type: 'Link type',
        typeVideo: 'Video link',
        typePage: 'Web page',
        typeAuto: 'Detected automatically — change it if this is wrong.',
        videoNote: 'In the HTML export this plays inside the page, with its own play, pause and volume controls. YouTube, Vimeo, Dailymotion and direct .mp4/.webm links are supported.',
        pageNote: 'In the HTML export this appears as a clickable link that opens in a new tab.',
        fileNote: 'If the exported file is opened directly from disk, YouTube may refuse to play it (error 153) — that is a YouTube rule about unknown origins, not a fault in the file. Put the file on a site or a shared drive and it plays. The link below the player always works.',
        blockedNote: 'Some sites refuse to be embedded. If a page will not display, it still works as a link.',
        exportNote: 'Word and PDF are unaffected: they print the QR code and the address exactly as before.',
        qr: 'QR code image',
        upload: '🖼️ Upload QR code (2.5 × 2.5 cm)',
        remove: 'Remove',
        close: 'Close', save: 'Save', saved: 'Saved',
        unsaved: 'You have unsaved changes. Press Close again to discard them.'
    },
    fr: {
        btn: 'Lien / QR',
        title: 'Vidéo, lien et code QR',
        subject: 'Sujet de la vidéo / ressource',
        subjectPh: 'p. ex. Débosselage sans peinture',
        url: 'Lien de la vidéo / ressource',
        type: 'Type de lien',
        typeVideo: 'Lien vidéo',
        typePage: 'Page web',
        typeAuto: 'Détecté automatiquement — corrigez-le si besoin.',
        videoNote: 'Dans l\u2019export HTML, la vidéo se lit dans la page, avec ses propres commandes de lecture, pause et volume. YouTube, Vimeo, Dailymotion et les liens .mp4/.webm directs sont pris en charge.',
        pageNote: 'Dans l\u2019export HTML, ceci apparaît comme un lien cliquable qui s\u2019ouvre dans un nouvel onglet.',
        fileNote: 'Si le fichier export\u00e9 est ouvert directement depuis le disque, YouTube peut refuser de le lire (erreur 153) : c\u2019est une r\u00e8gle de YouTube sur les origines inconnues, pas un d\u00e9faut du fichier. Placez-le sur un site ou un lecteur partag\u00e9 et il se lit. Le lien sous le lecteur fonctionne toujours.',
        blockedNote: 'Certains sites refusent d\u2019être intégrés. Si une page ne s\u2019affiche pas, elle reste utilisable comme lien.',
        exportNote: 'Word et PDF ne changent pas : ils impriment le code QR et l\u2019adresse comme avant.',
        qr: 'Image du code QR',
        upload: '🖼️ Téléverser le code QR (2,5 × 2,5 cm)',
        remove: 'Supprimer',
        close: 'Fermer', save: 'Enregistrer', saved: 'Enregistré',
        unsaved: 'Modifications non enregistrées. Appuyez de nouveau sur Fermer pour les abandonner.'
    },
    ar: {
        btn: 'رابط / QR',
        title: 'الفيديو والرابط ورمز الاستجابة',
        subject: 'موضوع الفيديو / المصدر',
        subjectPh: 'مثال: شرح إزالة الانبعاج دون طلاء',
        url: 'رابط الفيديو / المصدر',
        type: 'نوع الرابط',
        typeVideo: 'رابط فيديو',
        typePage: 'صفحة ويب',
        typeAuto: 'يُحدَّد تلقائياً — غيّره إن كان الاستنتاج خاطئاً.',
        videoNote: 'في تصدير HTML يعمل الفيديو داخل الصفحة نفسها، بأزرار التشغيل والإيقاف والصوت الخاصة به. المدعوم: يوتيوب وVimeo وDailymotion والروابط المباشرة ‎.mp4‎ و‎.webm‎.',
        pageNote: 'في تصدير HTML يظهر هذا رابطاً قابلاً للنقر يُفتح في تبويب جديد.',
        fileNote: 'إن فُتح الملف المُصدَّر من القرص مباشرة فقد يرفض يوتيوب تشغيله (الخطأ 153) — وهي قاعدة من يوتيوب بشأن المصادر المجهولة لا خلل في الملف. ضع الملف على موقع أو قرص مشترك فيعمل. والرابط أسفل المشغّل يعمل دائماً.',
        blockedNote: 'بعض المواقع ترفض التضمين. وإن تعذّر عرض الصفحة يبقى الرابط عاملاً.',
        exportNote: 'Word وPDF لا يتأثّران: يطبعان رمز الاستجابة والعنوان كما كانا تماماً.',
        qr: 'صورة رمز الاستجابة',
        upload: '🖼️ رفع رمز الاستجابة (٢٫٥ × ٢٫٥ سم)',
        remove: 'حذف',
        close: 'إغلاق', save: 'حفظ', saved: 'تم الحفظ',
        unsaved: 'لديك تغييرات غير محفوظة. اضغط «إغلاق» مرة أخرى لتجاهلها.'
    }
};

function _lmT(k) {
    var lang = 'en';
    try {
        if (window.i18n && typeof window.i18n.getLang === 'function') {
            var l = window.i18n.getLang();
            if (_LM_STRINGS[l]) lang = l;
        }
    } catch (e) { /* dictionary not up */ }
    return (_LM_STRINGS[lang] || _LM_STRINGS.en)[k] || _LM_STRINGS.en[k] || k;
}

/* ── Video detection ────────────────────────────────────────
   Returns an embeddable URL, or null when the link is not a video this
   can play. Shared with the HTML exporter so the dialog's promise and
   the exported file cannot disagree. */
function mbVideoEmbed(url) {
    var u = String(url || '').trim();
    if (!u) return null;
    var m;

    /* youtu.be/ID, /watch?v=ID, /embed/ID, /shorts/ID */
    m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/i);
    if (m) {
        var start = (u.match(/[?&]t=(\d+)/) || [])[1];
        /* youtube-nocookie, and `playsinline` so a phone does not hijack
           the whole screen. Error 153 — the black "player settings"
           panel — is YouTube refusing an embed whose referrer it cannot
           verify, which is what happens when the exported file is opened
           straight from disk (file://, no origin). Serving the file over
           http(s), or opening it from a shared drive by URL, resolves
           it; nothing in the markup can. The link under the player is
           the way out when it does not, so it is always rendered. */
        return { kind: 'iframe',
                 src: 'https://www.youtube-nocookie.com/embed/' + m[1] +
                      '?rel=0&playsinline=1' + (start ? '&start=' + start : '') };
    }

    m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
    if (m) return { kind: 'iframe', src: 'https://player.vimeo.com/video/' + m[1] };

    m = u.match(/dailymotion\.com\/(?:video\/|embed\/video\/)([A-Za-z0-9]+)/i);
    if (m) return { kind: 'iframe', src: 'https://www.dailymotion.com/embed/video/' + m[1] };

    /* A direct media file: <video> rather than an iframe, so the
       browser's own controls appear and no third party is involved. */
    if (/\.(mp4|webm|ogg|ogv|m4v)(\?|#|$)/i.test(u)) return { kind: 'video', src: u };

    return null;
}

/** What the export should do with this link, given the stored type and
    the URL. An explicit choice wins; otherwise detection decides. */
function mbLinkIsVideo(url, type) {
    if (type === 'page') return false;
    if (type === 'video') return true;
    return !!mbVideoEmbed(url);
}

/* ── The dialog's own stylesheet ─────────────────────────────
   WHY IT LIVES HERE AND NOT IN index.html
   The page's .ws-check rule was written for the column of checkboxes
   in the export-settings dialog, where a stacked list needs no
   horizontal rhythm. Reused for two radios on ONE line it left the
   control glued to its text and sitting a couple of pixels below it —
   the label and the dot were not on the same optical line, which is
   what the user sees first and trusts least.

   Fixing it in the page stylesheet would have changed the export
   settings dialog at the same time. Scoping every rule under
   #lm-overlay keeps the repair inside this dialog: nothing else in the
   tool can move because of it, in any language.

   Injected once, on first open, so a user who never opens the dialog
   never pays for the rules. */
function _lmEnsureStyle() {
    if (document.getElementById('lm-style')) return;
    var s = document.createElement('style');
    s.id = 'lm-style';
    s.textContent = [
        /* The label and its controls share one baseline. `align-items:
           center` is what puts the dot, the word and the field label on
           the same optical line; the old rule inherited `baseline`,
           which aligns text to text and leaves a form control hanging. */
        '#lm-overlay .ws-row.lm-row-type{display:flex;align-items:center;',
        'flex-wrap:wrap;gap:10px 16px;}',
        '#lm-overlay .ws-row.lm-row-type > label:first-child{margin:0;',
        'line-height:1.35;flex:0 0 auto;}',

        /* The two choices: a row of pills, never touching. */
        '#lm-overlay .lm-radios{display:flex;align-items:center;',
        'flex-wrap:wrap;gap:8px;}',
        '#lm-overlay .lm-radios .ws-check{display:inline-flex;',
        'align-items:center;gap:9px;margin:0;padding:7px 13px;',
        'min-height:38px;border:1px solid #e2e8f0;border-radius:10px;',
        'background:#fff;font-size:.93em;line-height:1;cursor:pointer;',
        '-webkit-user-select:none;user-select:none;',
        'transition:border-color .15s,background .15s,box-shadow .15s;}',
        '#lm-overlay .lm-radios .ws-check:hover{border-color:#c7d2fe;',
        'background:#f8faff;}',

        /* margin:0 on the input is the second half of the alignment
           fix — a browser's default radio carries 3px of its own on
           three sides, which is where the "stuck to the text" look
           came from. The gap above replaces it, and unlike a margin it
           mirrors correctly in Arabic. */
        '#lm-overlay .lm-radios .ws-check > input[type="radio"]{',
        'width:17px;height:17px;margin:0;flex:0 0 auto;',
        'accent-color:#6366f1;cursor:pointer;}',
        '#lm-overlay .lm-radios .ws-check > span{display:block;',
        'line-height:1.15;white-space:nowrap;}',

        /* Selected state. Two selectors for one job: :has() where the
           browser has it, and the .is-on class the dialog sets itself
           where it does not — the checked pill must be obvious on an
           older browser too, not merely on a new one. */
        '#lm-overlay .lm-radios .ws-check.is-on,',
        '#lm-overlay .lm-radios .ws-check:has(input:checked){',
        'border-color:#6366f1;background:#eef2ff;color:#3730a3;',
        'font-weight:600;box-shadow:inset 0 0 0 1px #6366f1;}',

        /* Keyboard users get the ring the pill would otherwise hide. */
        '#lm-overlay .lm-radios .ws-check:focus-within{',
        'outline:3px solid rgba(99,102,241,.35);outline-offset:2px;}',

        /* A narrow phone: the label above its pills rather than a
           cramped two-column squeeze. */
        '@media (max-width:520px){',
        '#lm-overlay .ws-row.lm-row-type{align-items:flex-start;',
        'flex-direction:column;gap:8px;}',
        '#lm-overlay .lm-radios{width:100%;}',
        '#lm-overlay .lm-radios .ws-check{flex:1 1 auto;',
        'justify-content:center;}}'
    ].join('');
    document.head.appendChild(s);
}

/* ── The dialog ─────────────────────────────────────────────
   It edits a DRAFT and writes to the hidden inputs only on Save, so
   opening it to look costs nothing — the same contract as the export
   settings dialog. */
var _lmScope = 'info';
var _lmDraft = null;
var _lmSaved = null;
var _lmArmed = false;
var _lmEsc = null;

function _lmEl(id) { return document.getElementById(_lmScope + '-' + id); }

function _lmRead() {
    var subj = _lmEl('link-subject'), url = _lmEl('link-url'), type = _lmEl('link-type');
    return {
        subject: subj ? subj.value : '',
        url: url ? url.value : '',
        type: type ? (type.value || '') : '',
        qr: (_lmScope === 'info') ? mbState.infoQRImage : mbState.activityQRImage
    };
}

function _lmDirty() { return JSON.stringify(_lmDraft) !== JSON.stringify(_lmSaved); }

function _lmMsg(text, kind) {
    var el = document.getElementById('lm-msg');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'ws-msg' + (kind ? ' ws-msg-' + kind : '');
}

function _lmTouch() {
    _lmArmed = false;
    var save = document.getElementById('lm-save');
    if (save) save.disabled = !_lmDirty();
    _lmMsg('');
    _lmPaintNotes();
}

function _lmPaintNotes() {
    var note = document.getElementById('lm-note');
    if (!note) return;
    var isVid = mbLinkIsVideo(_lmDraft.url, _lmDraft.type);
    var auto = !_lmDraft.type;
    note.innerHTML =
        '<div class="lm-note ' + (isVid ? 'lm-note-video' : 'lm-note-page') + '">' +
          (isVid ? '▶ ' : '🔗 ') + (isVid ? _lmT('videoNote') : _lmT('pageNote')) +
          (isVid ? '<br><span class="lm-dim">' + _lmT('fileNote') + '</span>'
                 : '<br><span class="lm-dim">' + _lmT('blockedNote') + '</span>') +
        '</div>' +
        (auto && _lmDraft.url ? '<div class="lm-dim lm-auto">' + _lmT('typeAuto') + '</div>' : '') +
        '<div class="lm-dim lm-auto">' + _lmT('exportNote') + '</div>';

    var eff = isVid ? 'video' : 'page';
    var radios = document.querySelectorAll('[name="lm-type"]');
    for (var i = 0; i < radios.length; i++) {
        var on = (radios[i].value === eff);
        radios[i].checked = on;
        /* The pill's highlight, for browsers without :has(). Set from
           the same line that sets `checked`, so the two cannot drift
           apart — including when the type is inferred from a pasted
           URL rather than clicked. */
        var pill = radios[i].closest ? radios[i].closest('.ws-check') : radios[i].parentNode;
        if (pill && pill.classList) pill.classList.toggle('is-on', on);
    }
}

function _lmPaintQr() {
    var box = document.getElementById('lm-qr-preview');
    if (!box) return;
    box.innerHTML = _lmDraft.qr
        ? '<img src="' + _lmDraft.qr + '" alt="QR"><button type="button" class="ws-btn ws-btn-ghost" id="lm-qr-remove">' + _lmT('remove') + '</button>'
        : '';
    var rm = document.getElementById('lm-qr-remove');
    if (rm) rm.addEventListener('click', function () { _lmDraft.qr = null; _lmPaintQr(); _lmTouch(); });
}

function mbOpenLinkModal(scope) {
    if (document.getElementById('lm-overlay')) return;
    _lmScope = (scope === 'activity') ? 'activity' : 'info';
    _lmDraft = _lmRead();
    _lmSaved = Object.assign({}, _lmDraft);
    _lmArmed = false;
    _lmEnsureStyle();

    var rtl = !!(window.i18n && window.i18n.isRTL && window.i18n.isRTL());
    var ov = document.createElement('div');
    ov.id = 'lm-overlay';
    ov.className = 'ws-overlay';
    ov.setAttribute('dir', rtl ? 'rtl' : 'ltr');
    ov.innerHTML =
      '<div class="ws-modal" role="dialog" aria-modal="true">' +
        '<div class="ws-head"><span>🔗 ' + _lmT('title') + '</span>' +
          '<button type="button" class="ws-x" id="lm-x">\u00D7</button></div>' +
        '<div class="ws-body">' +
          '<div class="ws-row lm-stack"><label>' + _lmT('subject') + '</label>' +
            '<input type="text" class="lm-input" id="lm-subject" placeholder="' + _lmT('subjectPh') + '"></div>' +
          '<div class="ws-row lm-stack"><label>' + _lmT('url') + '</label>' +
            '<input type="text" class="lm-input" id="lm-url" placeholder="https://..." dir="ltr"></div>' +
          /* role="radiogroup" + aria-label: a screen reader announces
             "Link type, 1 of 2" instead of two loose radios whose
             heading it has no way to associate with them. */
          '<div class="ws-row lm-row-type"><label id="lm-type-label">' + _lmT('type') + '</label>' +
            '<div class="lm-radios" role="radiogroup" aria-labelledby="lm-type-label">' +
              '<label class="ws-check"><input type="radio" name="lm-type" value="video"><span>' + _lmT('typeVideo') + '</span></label>' +
              '<label class="ws-check"><input type="radio" name="lm-type" value="page"><span>' + _lmT('typePage') + '</span></label>' +
            '</div></div>' +
          '<div id="lm-note"></div>' +
          '<h4 class="ws-group">' + _lmT('qr') + '</h4>' +
          '<button type="button" class="ws-btn ws-btn-ghost" id="lm-qr-btn">' + _lmT('upload') + '</button>' +
          '<div id="lm-qr-preview" class="lm-qr"></div>' +
          '<input type="file" accept="image/*" id="lm-qr-file" style="display:none">' +
        '</div>' +
        '<div class="ws-foot">' +
          '<span class="ws-msg" id="lm-msg"></span>' +
          '<span class="ws-foot-right">' +
            '<button type="button" class="ws-btn ws-btn-ghost" id="lm-close">' + _lmT('close') + '</button>' +
            '<button type="button" class="ws-btn ws-btn-primary" id="lm-save" disabled>' + _lmT('save') + '</button>' +
          '</span>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);

    document.getElementById('lm-subject').value = _lmDraft.subject;
    document.getElementById('lm-url').value = _lmDraft.url;
    _lmPaintQr();
    _lmPaintNotes();

    ov.addEventListener('input', function (e) {
        if (e.target.id === 'lm-subject') { _lmDraft.subject = e.target.value; _lmTouch(); }
        if (e.target.id === 'lm-url') {
            _lmDraft.url = e.target.value;
            /* Typing a new URL clears an explicit override, so detection
               gets a fresh say — otherwise a link marked "page" once
               stays "page" after being replaced by a YouTube URL. */
            _lmDraft.type = '';
            _lmTouch();
        }
    });
    ov.addEventListener('change', function (e) {
        if (e.target.name === 'lm-type') { _lmDraft.type = e.target.value; _lmTouch(); }
    });

    document.getElementById('lm-qr-btn').addEventListener('click', function () {
        document.getElementById('lm-qr-file').click();
    });
    document.getElementById('lm-qr-file').addEventListener('change', function (e) {
        var f = e.target.files && e.target.files[0];
        if (!f) return;
        var r = new FileReader();
        r.onload = function (ev) { _lmDraft.qr = ev.target.result; _lmPaintQr(); _lmTouch(); };
        r.readAsDataURL(f);
    });

    document.getElementById('lm-save').addEventListener('click', _lmSave);
    document.getElementById('lm-close').addEventListener('click', mbCloseLinkModal);
    document.getElementById('lm-x').addEventListener('click', mbCloseLinkModal);
    ov.addEventListener('click', function (e) { if (e.target === ov) mbCloseLinkModal(); });
    _lmEsc = function (e) { if (e.key === 'Escape') mbCloseLinkModal(); };
    document.addEventListener('keydown', _lmEsc);
}

function _lmSave() {
    var subj = _lmEl('link-subject'), url = _lmEl('link-url'), type = _lmEl('link-type');
    if (subj) subj.value = _lmDraft.subject;
    if (url) url.value = _lmDraft.url;
    if (type) type.value = _lmDraft.type;
    if (_lmScope === 'info') mbState.infoQRImage = _lmDraft.qr;
    else mbState.activityQRImage = _lmDraft.qr;

    /* Repaint the hidden card's own preview so the legacy upload path
       and this one cannot disagree about what is stored. */
    var prev = document.getElementById(_lmScope + '-qr-preview');
    if (prev) prev.innerHTML = _lmDraft.qr ? '<img src="' + _lmDraft.qr + '" style="max-width:100px;">' : '';

    /* Persist through the tool's own save path. */
    if (typeof saveCurrentSheetToLO === 'function') { try { saveCurrentSheetToLO(); } catch (e) { /* not fatal */ } }
    if (typeof mbTouch === 'function') { try { mbTouch(); } catch (e) { /* autosave absent */ } }

    _lmSaved = Object.assign({}, _lmDraft);
    _lmArmed = false;
    var save = document.getElementById('lm-save');
    if (save) save.disabled = true;
    _lmMsg('\u2713 ' + _lmT('saved'), 'ok');
    _lmPaintButtons();
}

function mbCloseLinkModal() {
    if (_lmDirty() && !_lmArmed && document.getElementById('lm-overlay')) {
        _lmArmed = true;
        _lmMsg(_lmT('unsaved'), 'warn');
        return;
    }
    var ov = document.getElementById('lm-overlay');
    if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
    if (_lmEsc) { document.removeEventListener('keydown', _lmEsc); _lmEsc = null; }
    _lmArmed = false;
}

/** Marks the trigger buttons when the sheet already has a link, so the
    user can see at a glance that something is stored behind them. */
function _lmPaintButtons() {
    ['info', 'activity'].forEach(function (scope) {
        var url = document.getElementById(scope + '-link-url');
        var has = !!(url && url.value.trim()) ||
                  !!(scope === 'info' ? mbState.infoQRImage : mbState.activityQRImage);
        document.querySelectorAll('[data-act="mbOpenLinkModal"][data-args*="' + scope + '"]')
            .forEach(function (b) {
                b.classList.toggle('has-link', has);
                var span = b.querySelector('span:last-child');
                if (span) span.textContent = _lmT('btn');
            });
    });
}

if (typeof window !== 'undefined') {
    window.addEventListener('mb:langchange', _lmPaintButtons);
    document.addEventListener('DOMContentLoaded', _lmPaintButtons);
}
