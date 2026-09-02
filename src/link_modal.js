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
        return { kind: 'iframe',
                 src: 'https://www.youtube.com/embed/' + m[1] + (start ? '?start=' + start : '') };
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
          (isVid ? '' : '<br><span class="lm-dim">' + _lmT('blockedNote') + '</span>') +
        '</div>' +
        (auto && _lmDraft.url ? '<div class="lm-dim lm-auto">' + _lmT('typeAuto') + '</div>' : '') +
        '<div class="lm-dim lm-auto">' + _lmT('exportNote') + '</div>';

    var eff = isVid ? 'video' : 'page';
    var radios = document.querySelectorAll('[name="lm-type"]');
    for (var i = 0; i < radios.length; i++) radios[i].checked = (radios[i].value === eff);
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
          '<div class="ws-row"><label>' + _lmT('type') + '</label>' +
            '<div class="lm-radios">' +
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
