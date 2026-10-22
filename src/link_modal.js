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
        paste: '📋 Paste QR code',
        pasteTip: 'Paste a QR code image copied from another program or a web page',
        noQr: 'No QR code yet',
        pasted: 'QR code pasted',
        clipEmpty: 'The button cannot read a file copied from a folder — the browser only hands it over on Ctrl+V. Press Ctrl+V now, or drag the image onto the box.',
        clipDenied: 'The browser did not allow reading the clipboard. Allow clipboard access for this site, or use Upload.',
        clipUrl: 'The clipboard holds an image link, not an image. Use “Copy image” on the QR code instead.',
        edit: 'Edit',
        remove: 'Remove',
        close: 'Close', save: 'Save', saved: 'Saved',
        unsaved: 'You have unsaved changes. Press Close again to discard them.',
        linkN: 'Link {n}',
        addLink: '➕ Add another link',
        removeLink: '🗑 Remove this link',
        linksNote: 'Each link has its own QR code and is printed as its own row on the sheet, in this order. A link left empty is not kept.',
        linksCount: '{n} links'
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
        paste: '📋 Coller le code QR',
        pasteTip: 'Coller une image de code QR copiée depuis un autre programme ou une page web',
        noQr: 'Aucun code QR pour l’instant',
        pasted: 'Code QR collé',
        clipEmpty: 'Le bouton ne peut pas lire un fichier copié depuis un dossier — le navigateur ne le donne qu’avec Ctrl+V. Appuyez sur Ctrl+V maintenant, ou glissez l’image sur le cadre.',
        clipDenied: 'Le navigateur n’a pas autorisé la lecture du presse-papiers. Autorisez-la pour ce site, ou utilisez Téléverser.',
        clipUrl: 'Le presse-papiers contient un lien d’image, pas une image. Utilisez « Copier l’image » sur le code QR.',
        edit: 'Modifier',
        remove: 'Supprimer',
        close: 'Fermer', save: 'Enregistrer', saved: 'Enregistré',
        unsaved: 'Modifications non enregistrées. Appuyez de nouveau sur Fermer pour les abandonner.',
        linkN: 'Lien {n}',
        addLink: '➕ Ajouter un autre lien',
        removeLink: '🗑 Supprimer ce lien',
        linksNote: 'Chaque lien a son propre code QR et s’imprime sur sa propre ligne de la fiche, dans cet ordre. Un lien laissé vide n’est pas conservé.',
        linksCount: '{n} liens'
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
        paste: '📋 لصق رمز الاستجابة',
        pasteTip: 'لصق صورة رمز استجابة منسوخة من برنامج آخر أو صفحة ويب',
        noQr: 'لا يوجد رمز استجابة بعد',
        pasted: 'تم لصق رمز الاستجابة',
        clipEmpty: 'لا يستطيع الزر قراءة ملف منسوخ من مجلد، فالمتصفح لا يسلّمه إلا عند الضغط على Ctrl+V. اضغط Ctrl+V الآن، أو اسحب الصورة إلى المربع.',
        clipDenied: 'لم يسمح المتصفح بقراءة الحافظة. اسمح بالوصول إلى الحافظة لهذا الموقع، أو استخدم «رفع».',
        clipUrl: 'الحافظة تحتوي رابط صورة وليس صورة. استخدم «نسخ الصورة» على رمز الاستجابة.',
        edit: 'تعديل',
        remove: 'حذف',
        close: 'إغلاق', save: 'حفظ', saved: 'تم الحفظ',
        unsaved: 'لديك تغييرات غير محفوظة. اضغط «إغلاق» مرة أخرى لتجاهلها.',
        linkN: 'الرابط {n}',
        addLink: '➕ إضافة رابط آخر',
        removeLink: '🗑 حذف هذا الرابط',
        linksNote: 'لكل رابط رمز استجابة خاص به، ويُطبع كل رابط في صف مستقل على الورقة بهذا الترتيب. الرابط الفارغ لا يُحفظ.',
        linksCount: '{n} روابط'
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

/* ── 3.70.0: several links on one sheet ───────────────────────
   The FIRST link still lives where it always did — the hidden fields
   (linkSubject / linkUrl / linkType) and mbState.infoQRImage /
   activityQRImage — so a project written before this release, and every
   path that reads those, is unchanged. The others are the sheet's
   `extraLinks`: [{ subject, url, linkType, qrImage }], kept for the open
   sheet in mbState.infoExtraLinks / activityExtraLinks. */
function _lmLinkFilled(x) {
    return !!(x && ((x.subject || '').trim() || (x.url || '').trim() || x.qrImage || x.qr));
}
/** A clean copy of a stored list: plain strings, empty entries dropped. */
function mbLinkListCopy(list) {
    if (!Array.isArray(list)) return [];
    return list.filter(_lmLinkFilled).map(function (x) {
        return { subject: String(x.subject || ''), url: String(x.url || ''),
                 linkType: (x.linkType === 'video' || x.linkType === 'page') ? x.linkType : '',
                 qrImage: x.qrImage || null };
    });
}
/** Every link of a sheet, in printed order: [{ subject, url, linkType, image }].
 *  `firstImage` is the first link's QR (the sheet's qrImage). */
function mbSheetLinks(sh, firstImage) {
    if (!sh) return [];
    var str = function (v) { return (typeof v === 'string') ? v : (typeof _mmStr === 'function' ? _mmStr(v) : ''); };
    var out = [];
    var first = { subject: str(sh.linkSubject), url: str(sh.linkUrl), linkType: str(sh.linkType),
                  image: (firstImage !== undefined ? firstImage : sh.qrImage) || null };
    if (first.subject.trim() || first.url.trim() || first.image) out.push(first);
    (Array.isArray(sh.extraLinks) ? sh.extraLinks : []).forEach(function (x) {
        if (!_lmLinkFilled(x)) return;
        out.push({ subject: str(x.subject), url: str(x.url), linkType: str(x.linkType), image: x.qrImage || null });
    });
    return out;
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
        /* 3.54.1: the QR card — a large preview beside its buttons,
           stacked on a phone; the dialog a little taller. */
        '#lm-overlay .ws-modal{max-height:94vh;}',
        '#lm-overlay .lm-qr-card{display:flex;align-items:center;gap:16px;',
        'flex-wrap:wrap;padding:12px;margin:0 0 14px;border:1px solid #e2e8f0;',
        'border-radius:12px;background:#f8fafc;}',
        '#lm-overlay .lm-qr-box{width:168px;height:168px;flex:0 0 auto;',
        'display:flex;align-items:center;justify-content:center;',
        'background:#fff;border:1px solid #e2e8f0;border-radius:10px;',
        'padding:8px;box-sizing:border-box;}',
        '#lm-overlay .lm-qr-box.is-empty{border:2px dashed #cbd5e1;}',
        '#lm-overlay .lm-qr-box.is-over,#lm-overlay .lm-qr-box.is-waiting{',
        'border-color:#6366f1;background:#eef2ff;}',
        '#lm-overlay .lm-qr-box:focus{outline:none;}',
        '#lm-overlay .lm-qr-box:focus-visible{box-shadow:0 0 0 3px rgba(99,102,241,.35);}',
        '#lm-overlay .lm-qr-box img{width:100%;height:100%;object-fit:contain;',
        'image-rendering:pixelated;}',
        '#lm-overlay .lm-qr-empty{display:flex;flex-direction:column;',
        'align-items:center;gap:6px;color:#94a3b8;font-size:.85em;text-align:center;}',
        '#lm-overlay .lm-qr-icon{font-size:2.4em;line-height:1;}',
        '#lm-overlay .lm-qr-side{display:flex;flex-direction:column;gap:8px;',
        'flex:1 1 180px;min-width:0;}',
        '#lm-overlay .lm-qr-side .ws-btn{width:100%;min-height:38px;',
        'padding:8px 12px;border-radius:8px;}',
        '#lm-overlay .lm-qr-remove{color:#b91c1c;}',
        /* 3.70.0: one tab per link, and «add another». */
        '#lm-overlay .lm-links{display:flex;flex-wrap:wrap;align-items:center;gap:8px;',
        'margin:0 0 6px;padding:0 0 12px;border-bottom:1px solid #e2e8f0;}',
        '#lm-overlay .lm-link-tab{display:inline-flex;align-items:center;gap:6px;',
        'padding:7px 12px;min-height:36px;border:1px solid #e2e8f0;border-radius:999px;',
        'background:#fff;font:inherit;font-size:.9em;cursor:pointer;color:#334155;}',
        '#lm-overlay .lm-link-tab img{width:20px;height:20px;object-fit:contain;image-rendering:pixelated;}',
        '#lm-overlay .lm-links .lm-link-tab.is-on{border-color:#6366f1 !important;background:#eef2ff !important;color:#3730a3 !important;',
        'font-weight:700;box-shadow:inset 0 0 0 1px #6366f1;}',
        '#lm-overlay .lm-link-add{border-style:dashed;color:#4f46e5;}',
        '#lm-overlay .lm-links-note{margin:0 0 14px;font-size:.84em;color:#64748b;}',
        '#lm-overlay .lm-link-remove{margin-inline-start:auto;color:#b91c1c;border-color:#fecaca;}',

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
var _lmDraft = null;     // { items: [{ subject, url, type, qr }, …] } — 3.70.0
var _lmIdx = 0;          // the link being edited
var _lmSaved = null;
var _lmArmed = false;
var _lmPaste = null;
var _lmEsc = null;

function _lmEl(id) { return document.getElementById(_lmScope + '-' + id); }

function _lmExtrasKey() { return _lmScope === 'info' ? 'infoExtraLinks' : 'activityExtraLinks'; }

function _lmRead() {
    var subj = _lmEl('link-subject'), url = _lmEl('link-url'), type = _lmEl('link-type');
    var items = [{
        subject: subj ? subj.value : '',
        url: url ? url.value : '',
        type: type ? (type.value || '') : '',
        qr: (_lmScope === 'info') ? mbState.infoQRImage : mbState.activityQRImage
    }];
    mbLinkListCopy(mbState[_lmExtrasKey()]).forEach(function (x) {
        items.push({ subject: x.subject, url: x.url, type: x.linkType, qr: x.qrImage });
    });
    return { items: items };
}

/** The link being edited. */
function _lmCur() {
    if (!_lmDraft.items.length) _lmDraft.items.push({ subject: '', url: '', type: '', qr: null });
    if (_lmIdx >= _lmDraft.items.length) _lmIdx = _lmDraft.items.length - 1;
    if (_lmIdx < 0) _lmIdx = 0;
    return _lmDraft.items[_lmIdx];
}
function _lmClone(d) { return JSON.parse(JSON.stringify(d)); }

/** The tabs above the form: one per link, then «add another». */
function _lmPaintLinks() {
    var host = document.getElementById('lm-links');
    if (!host) return;
    var esc = function (t) { return String(t || '').replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); };
    host.innerHTML = _lmDraft.items.map(function (it, i) {
        var tip = (it.subject || it.url || '').trim();
        return '<button type="button" class="lm-link-tab' + (i === _lmIdx ? ' is-on' : '') + '" data-lm-link="' + i + '"' +
               ' aria-pressed="' + (i === _lmIdx) + '"' + (tip ? ' title="' + esc(tip) + '"' : '') + '>' +
               (it.qr ? '<img src="' + esc(it.qr) + '" alt="">' : '🔗') +
               '<span>' + esc(_lmT('linkN').replace('{n}', i + 1)) + '</span></button>';
    }).join('') +
    '<button type="button" class="lm-link-tab lm-link-add" id="lm-link-add">' + _lmT('addLink') + '</button>' +
    (_lmDraft.items.length > 1
        ? '<button type="button" class="lm-link-tab lm-link-remove" id="lm-link-remove">' + _lmT('removeLink') + '</button>'
        : '');
}

/** The form shows the link chosen in the tabs. */
function _lmPaintForm() {
    var c = _lmCur();
    var subj = document.getElementById('lm-subject'), url = document.getElementById('lm-url');
    if (subj) subj.value = c.subject || '';
    if (url) url.value = c.url || '';
    _lmPaintLinks();
    _lmPaintQr();
    _lmPaintNotes();
}

function _lmTabTip() {
    var tab = document.querySelector('#lm-links [data-lm-link="' + _lmIdx + '"]');
    var c = _lmCur();
    if (tab) tab.title = (c.subject || c.url || '').trim();
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
    var cur = _lmCur();
    var isVid = mbLinkIsVideo(cur.url, cur.type);
    var auto = !cur.type;
    note.innerHTML =
        '<div class="lm-note ' + (isVid ? 'lm-note-video' : 'lm-note-page') + '">' +
          (isVid ? '▶ ' : '🔗 ') + (isVid ? _lmT('videoNote') : _lmT('pageNote')) +
          (isVid ? '<br><span class="lm-dim">' + _lmT('fileNote') + '</span>'
                 : '<br><span class="lm-dim">' + _lmT('blockedNote') + '</span>') +
        '</div>' +
        (auto && cur.url ? '<div class="lm-dim lm-auto">' + _lmT('typeAuto') + '</div>' : '') +
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
    var qr = _lmCur().qr;
    box.classList.toggle('is-empty', !qr);
    if (qr) box.classList.remove('is-waiting');
    box.innerHTML = qr
        ? '<img src="' + qr + '" alt="QR">'
        : '<span class="lm-qr-empty"><span class="lm-qr-icon" aria-hidden="true">▦</span>' + _lmT('noQr') + '</span>';
    var rm = document.getElementById('lm-qr-remove');
    if (rm) rm.style.display = qr ? '' : 'none';
    /* The open link's tab shows its code too. */
    var tab = document.querySelector('#lm-links [data-lm-link="' + _lmIdx + '"]');
    if (tab) tab.innerHTML = (qr ? '<img src="' + qr + '" alt="">' : '🔗') + '<span>' + _lmT('linkN').replace('{n}', _lmIdx + 1) + '</span>';
}

/* 3.54.0: a pasted QR code lands in the dialog's draft, exactly like an
   uploaded one — shown at once, stored on Save (image_paste.js, 'qr'). */
function mbLinkModalSetQr(dataUrl) {
    if (!_lmDraft || !document.getElementById('lm-overlay')) return;
    _lmCur().qr = dataUrl;
    _lmPaintQr();
    _lmTouch();
    _lmMsg('\u2713 ' + _lmT('pasted'), 'ok');
}

/* 3.54.1: why a paste found nothing — said inside the dialog, where the
   user is looking, instead of opening a second "press Ctrl+V" window. */
function mbLinkModalPasteFailed(reason) {
    if (!document.getElementById('lm-overlay')) return;
    _lmMsg(_lmT(reason === 'denied' ? 'clipDenied' : reason === 'url' ? 'clipUrl' : 'clipEmpty'), 'warn');
    /* 3.54.2: a file copied in Explorer / Finder is invisible to
       navigator.clipboard.read() — it carries a file reference, not
       pixels — and a browser hands it to a page only in a real paste
       event. So the box is made ready for that paste: focused, and
       highlighted until it arrives. */
    var box = document.getElementById('lm-qr-preview');
    if (box && reason !== 'url') {
        box.classList.add('is-waiting');
        try { box.focus({ preventScroll: false }); } catch (e) { box.focus(); }
    }
}

function mbOpenLinkModal(scope, index) {
    if (document.getElementById('lm-overlay')) return;
    _lmScope = (scope === 'activity') ? 'activity' : 'info';
    _lmDraft = _lmRead();
    _lmSaved = _lmClone(_lmDraft);
    /* 3.70.0: ✏️ on a link's card opens the dialog at that link. */
    _lmIdx = (typeof index === 'number' && index >= 0 && index < _lmDraft.items.length) ? index : 0;
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
          /* 3.70.0: one tab per link on this sheet, and «add another». */
          '<div class="lm-links" id="lm-links" role="toolbar"></div>' +
          '<p class="lm-links-note">' + _lmT('linksNote') + '</p>' +
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
          /* 3.54.1: the QR code sits right under the link, in a card
             with a preview large enough to check at a glance; the long
             notes come after it. */
          '<h4 class="ws-group">' + _lmT('qr') + '</h4>' +
          '<div class="lm-qr-card">' +
            '<div id="lm-qr-preview" class="lm-qr-box" tabindex="0"></div>' +
            '<div class="lm-qr-side">' +
              '<button type="button" class="ws-btn ws-btn-ghost" id="lm-qr-btn">' + _lmT('upload') + '</button>' +
              /* 3.54.0: paste, beside upload — a QR code is usually made
                 by a generator site or app and copied from there. */
              '<button type="button" class="ws-btn ws-btn-ghost" id="lm-qr-paste" title="' + _lmT('pasteTip') + '">' + _lmT('paste') + '</button>' +
              '<button type="button" class="ws-btn ws-btn-ghost lm-qr-remove" id="lm-qr-remove">' + _lmT('remove') + '</button>' +
            '</div>' +
          '</div>' +
          '<input type="file" accept="image/*" id="lm-qr-file" style="display:none">' +
          '<div id="lm-note"></div>' +
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

    _lmPaintForm();

    ov.addEventListener('click', function (e) {
        var t = e.target.closest ? e.target.closest('[data-lm-link], #lm-link-add, #lm-link-remove') : null;
        if (!t) return;
        if (t.id === 'lm-link-add') {
            _lmDraft.items.push({ subject: '', url: '', type: '', qr: null });
            _lmIdx = _lmDraft.items.length - 1;
            _lmPaintForm(); _lmTouch();
            var f = document.getElementById('lm-subject'); if (f) f.focus();
            return;
        }
        if (t.id === 'lm-link-remove') {
            _lmDraft.items.splice(_lmIdx, 1);
            if (_lmIdx >= _lmDraft.items.length) _lmIdx = _lmDraft.items.length - 1;
            _lmPaintForm(); _lmTouch();
            return;
        }
        _lmIdx = parseInt(t.getAttribute('data-lm-link'), 10) || 0;
        _lmPaintForm();
    });

    ov.addEventListener('input', function (e) {
        if (e.target.id === 'lm-subject') { _lmCur().subject = e.target.value; _lmTouch(); _lmTabTip(); }
        if (e.target.id === 'lm-url') {
            _lmCur().url = e.target.value;
            _lmTabTip();
            /* Typing a new URL clears an explicit override, so detection
               gets a fresh say — otherwise a link marked "page" once
               stays "page" after being replaced by a YouTube URL. */
            _lmCur().type = '';
            _lmTouch();
        }
    });
    ov.addEventListener('change', function (e) {
        if (e.target.name === 'lm-type') { _lmCur().type = e.target.value; _lmTouch(); }
    });

    document.getElementById('lm-qr-btn').addEventListener('click', function () {
        document.getElementById('lm-qr-file').click();
    });
    document.getElementById('lm-qr-file').addEventListener('change', function (e) {
        var f = e.target.files && e.target.files[0];
        if (!f) return;
        var r = new FileReader();
        var target = _lmCur();
        r.onload = function (ev) { target.qr = ev.target.result; _lmPaintQr(); _lmTouch(); };
        r.readAsDataURL(f);
        e.target.value = '';   // the same file can be chosen again for the next link
    });

    document.getElementById('lm-qr-remove').addEventListener('click', function () {
        _lmCur().qr = null; _lmPaintQr(); _lmTouch();
    });
    /* An image file dropped on the preview is taken like an upload. */
    var qrBox = document.getElementById('lm-qr-preview');
    qrBox.addEventListener('dragover', function (e) { e.preventDefault(); qrBox.classList.add('is-over'); });
    qrBox.addEventListener('dragleave', function () { qrBox.classList.remove('is-over'); });
    qrBox.addEventListener('drop', function (e) {
        e.preventDefault();
        qrBox.classList.remove('is-over');
        var blob = (typeof _mbBlobFromDataTransfer === 'function') ? _mbBlobFromDataTransfer(e.dataTransfer) : null;
        if (blob) _mbStorePastedBlob('qr', _lmScope, blob);
    });
    document.getElementById('lm-qr-paste').addEventListener('click', function () {
        if (typeof mbPasteImageInto === 'function') mbPasteImageInto('qr', _lmScope);
    });
    /* Ctrl+V anywhere in the dialog with an IMAGE on the clipboard sets
       the QR code. Text pastes (a URL into the link field) are left
       alone: no image, no preventDefault. */
    /* On the document, not the overlay: a click on a button does not
       focus it in every browser (Safari, Firefox on Mac), and a paste
       then fires on <body>, outside the dialog. Removed on close. */
    _lmPaste = function (e) {
        if (!document.getElementById('lm-overlay')) return;
        if (typeof _mbPasteZoneOpen !== 'undefined' && _mbPasteZoneOpen) return;
        var blob = (typeof _mbBlobFromDataTransfer === 'function') ? _mbBlobFromDataTransfer(e.clipboardData) : null;
        if (!blob) return;
        e.preventDefault();
        e.stopPropagation();
        _mbStorePastedBlob('qr', _lmScope, blob);
    };
    document.addEventListener('paste', _lmPaste, true);

    document.getElementById('lm-save').addEventListener('click', _lmSave);
    document.getElementById('lm-close').addEventListener('click', mbCloseLinkModal);
    document.getElementById('lm-x').addEventListener('click', mbCloseLinkModal);
    ov.addEventListener('click', function (e) { if (e.target === ov) mbCloseLinkModal(); });
    _lmEsc = function (e) {
        /* The paste prompt (image_paste.js) closes on Escape first; that
           Escape must not also close this dialog under it. */
        if (e.key !== 'Escape' || e.defaultPrevented) return;
        mbCloseLinkModal();
    };
    document.addEventListener('keydown', _lmEsc);
}

function _lmSave() {
    /* 3.70.0: empty links are dropped; the first one left goes into the
       sheet's own fields, the rest into its extra links. */
    var kept = _lmDraft.items.filter(function (it) { return _lmLinkFilled(it); });
    var first = kept[0] || { subject: '', url: '', type: '', qr: null };
    var subj = _lmEl('link-subject'), url = _lmEl('link-url'), type = _lmEl('link-type');
    if (subj) subj.value = first.subject || '';
    if (url) url.value = first.url || '';
    if (type) type.value = first.type || '';
    mbState[_lmExtrasKey()] = kept.slice(1).map(function (it) {
        return { subject: it.subject || '', url: it.url || '', linkType: it.type || '', qrImage: it.qr || null };
    });
    if (_lmScope === 'info') mbState.infoQRImage = first.qr || null;
    else mbState.activityQRImage = first.qr || null;

    /* Repaint the hidden card's own preview so the legacy upload path
       and this one cannot disagree about what is stored. */
    var prev = document.getElementById(_lmScope + '-qr-preview');
    if (prev) prev.innerHTML = first.qr ? '<img src="' + first.qr + '" style="max-width:100px;">' : '';

    /* Persist through the tool's own save path. */
    if (typeof saveCurrentSheetToLO === 'function') { try { saveCurrentSheetToLO(); } catch (e) { /* not fatal */ } }
    if (typeof mbTouch === 'function') { try { mbTouch(); } catch (e) { /* autosave absent */ } }

    _lmDraft = { items: kept.length ? _lmClone(kept) : [{ subject: '', url: '', type: '', qr: null }] };
    if (_lmIdx >= _lmDraft.items.length) _lmIdx = _lmDraft.items.length - 1;
    _lmSaved = _lmClone(_lmDraft);
    _lmPaintForm();
    _lmArmed = false;
    var save = document.getElementById('lm-save');
    if (save) save.disabled = true;
    _lmMsg('\u2713 ' + _lmT('saved'), 'ok');
    _lmPaintButtons();
    mbPaintLinkSummary();
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
    if (_lmPaste) { document.removeEventListener('paste', _lmPaste, true); _lmPaste = null; }
    _lmArmed = false;
}

/** Marks the trigger buttons when the sheet already has a link, so the
    user can see at a glance that something is stored behind them. */
function _lmPaintButtons() {
    ['info', 'activity'].forEach(function (scope) {
        var url = document.getElementById(scope + '-link-url');
        var extras = mbState[scope === 'info' ? 'infoExtraLinks' : 'activityExtraLinks'] || [];
        var has = !!(url && url.value.trim()) || extras.length > 0 ||
                  !!(scope === 'info' ? mbState.infoQRImage : mbState.activityQRImage);
        document.querySelectorAll('[data-act="mbOpenLinkModal"][data-args*="' + scope + '"]')
            .forEach(function (b) {
                b.classList.toggle('has-link', has);
                var span = b.querySelector('span:last-child');
                if (span) span.textContent = _lmT('btn');
            });
    });
}

/* 3.54.1: the sheet's link and QR code, shown ON the sheet — under the
   last step (or content section), which is where Word, PDF and HTML
   print them — so what is stored behind the 🔗 buttons is visible at a
   glance, the way a step shows its images. Click ✏️ to edit. */
function mbPaintLinkSummary() {
    ['info', 'activity'].forEach(function (scope) {
        var host = document.getElementById(scope + '-link-summary');
        if (!host) return;
        var subjEl = document.getElementById(scope + '-link-subject');
        var urlEl = document.getElementById(scope + '-link-url');
        /* 3.70.0: every link of the sheet, one card each, in printed order. */
        var links = mbSheetLinks({
            linkSubject: subjEl ? subjEl.value : '', linkUrl: urlEl ? urlEl.value : '',
            extraLinks: mbState[scope === 'info' ? 'infoExtraLinks' : 'activityExtraLinks'] || []
        }, scope === 'info' ? mbState.infoQRImage : mbState.activityQRImage);
        if (!links.length) { host.innerHTML = ''; return; }
        var esc = (typeof escapeHtml === 'function') ? escapeHtml : function (t) {
            return String(t).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; });
        };
        host.innerHTML = links.map(function (l, i) {
            var subj = (l.subject || '').trim(), url = (l.url || '').trim();
            var safeUrl = /^https?:\/\//i.test(url) ? url : '';
            return '<div class="mb-link-summary-card" data-link-index="' + i + '">' +
              (l.image ? '<img class="mb-ls-qr" src="' + esc(l.image) + '" alt="QR">' : '') +
              '<div class="mb-ls-text">' +
                '<div class="mb-ls-title">🔗 ' + esc(subj || _lmT('title').replace('&amp;', '&')) + '</div>' +
                (url ? (safeUrl
                    ? '<a class="mb-ls-url" dir="ltr" href="' + esc(safeUrl) + '" target="_blank" rel="noopener">' + esc(url) + '</a>'
                    : '<div class="mb-ls-url" dir="ltr">' + esc(url) + '</div>') : '') +
              '</div>' +
              '<button type="button" class="mb-ls-edit" data-act="mbOpenLinkModal" data-args=\'["' + scope + '",' + i + ']\'>✏️ ' + _lmT('edit') + '</button>' +
            '</div>';
        }).join('');
    });
}

var _lmSummaryTimer = null;
function _lmScheduleSummary() {
    clearTimeout(_lmSummaryTimer);
    /* After the current task: a loader sets the QR image and the link
       fields one after the other, and the card should show all of them. */
    _lmSummaryTimer = setTimeout(mbPaintLinkSummary, 0);
}

/* Every path that changes a sheet's QR code — a sheet loaded, cleared,
   undone, uploaded through the old card — writes mbState.infoQRImage or
   activityQRImage. Watching those two keys repaints the card from all of
   them without each having to know it exists. */
(function watchQrState() {
    if (typeof mbState !== 'object' || !mbState) return;
    ['infoQRImage', 'activityQRImage'].forEach(function (key) {
        var d = Object.getOwnPropertyDescriptor(mbState, key);
        if (d && (d.get || d.set || d.configurable === false)) return;
        var value = mbState[key];
        Object.defineProperty(mbState, key, {
            enumerable: true, configurable: true,
            get: function () { return value; },
            set: function (v) { value = v; _lmScheduleSummary(); }
        });
    });
})();

if (typeof window !== 'undefined') {
    window.addEventListener('mb:langchange', _lmPaintButtons);
    window.addEventListener('mb:langchange', mbPaintLinkSummary);
    document.addEventListener('DOMContentLoaded', _lmPaintButtons);
    document.addEventListener('DOMContentLoaded', _lmScheduleSummary);
}
