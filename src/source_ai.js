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
//   The setting    settings.hideSourceDrafts (Settings → Misc). Since
//                  3.48.0 the button is SHOWN by default, at the top of
//                  the sheet's content (nothing is sent before Generate);
//                  hidden, a line says where to turn it back on.
//   The AI         the same backend as the rest of Module Builder
//                  (/api/generate-dacum), so the key stays on the server.
//
// SEVERAL SHEETS (3.46.0, phase 2)
// «📚 Several sheets» lists every information sheet of the outcome or the
// module — built from DACUM's suggestions or by hand, the same way: its
// title is the topic (an untitled sheet asks for one), its headings with
// no text are what gets written (each sent as H1, H2 … and written back
// into that heading), sections already written are named so they are not
// repeated. 🔎 Suggest pages sends only the contents of the sources (PDF
// bookmarks, else a line or two per page) and the sheet titles; the
// trainer checks the pages, then ✨ Generate writes the sheets one after
// another. Rows, pages and progress are kept per module in localStorage:
// a stop, a busy service or a closed page leaves the rest for the next
// Generate.
//
// CONTEXT, NO SOURCE, MIXED (3.47.0)
// Every prompt starts with the programme, as DACUM Live Pro's do: the
// JOB (the focus), the occupation (context), sector, country / context
// and scope of work (DACUM 3.118 sends them; the country can be typed in
// the dialog and is kept on the module), the module's full title (its
// short name only when there is none) and the level. A sheet can be
// written with no source («🧠 AI knowledge»: flagged in the dialog, no
// page lines, no reference, doubtful points listed «to check»), or from
// a source completed from general knowledge (each such section ends with
// a line saying so). Invented standards, codes and references are
// forbidden in every mode.
//
// 📖 EXCERPTS, OFFLINE (3.49.0)
// A second method: no AI, no network, no cost. The book is cut into
// passages and searched with BM25 (word statistics) for each heading of
// the sheet, or its topic; the best passages go on the sheet as the book
// wrote them, each with «(Excerpt — book, p. N)», for the trainer to
// rewrite. «Suggest pages» works the same way on the device. Words are
// matched, not meanings: the book and the sheet must share a language.
// See ROADMAP.md for RAG and the other options left for later.
//
// Nothing here runs until the dialog is opened: the
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
        failed: 'The AI service did not answer — it may be stopped, or the connection is down. Try again later.',
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
        copyNote: 'Use sources you may use for training. The draft paraphrases; check quotations and figures against the book.',
        hint: 'Drafting from sources (AI) can be turned on in Settings → Misc.',
        svcDown: 'The AI service cannot be reached right now (it may be stopped or offline). You can add sources and choose pages; generating works once the service is back.',
        methodTitle: 'How',
        methodAi: '✨ The AI writes the sheet',
        methodEx: '📖 Excerpts from the book — offline, free',
        exNote: 'The tool finds, in the pages you choose, the passages that best match the sheet\u2019s topic and headings, and puts them on the sheet with their page. Nothing is sent and there is no cost. The text is the book\u2019s own: rewrite it in your own words and mind the copyright. Works when the book and the sheet are in the same language.',
        exEst: 'Offline — nothing is sent, no cost.',
        exGen: '📖 Extract',
        exNone: 'No passage of these pages matches the topic. Choose other pages, or check that the book and the sheet are in the same language.',
        exNeedBook: 'Excerpts need a book or a text source.',
        exMapDone: 'Pages found on this device for {v0} of {v1} sheets. Check them, then extract.',
        exTag: 'Excerpt from the book',
        clearAsk: 'Also delete the {v0} source(s) (books, texts) kept on this device for «Draft from sources»? They serve every project.',
        cleared: 'Sources deleted from this device.',
        modeOne: '📄 This sheet',
        modeMany: '📚 Several sheets',
        useSources: 'Use these sources',
        scope: 'Sheets',
        scopeLo: 'This learning outcome',
        scopeAll: 'The whole module',
        mapBtn: '🔎 Suggest pages',
        mapNote: 'The AI reads only the contents (the PDF bookmarks, or the first lines of each page) to suggest the pages of each sheet. Check them before generating.',
        mapEst: '≈ {v0} tokens · ≈ ${v1}',
        mapping: 'Matching the sheets to the pages…',
        mapDone: 'Pages suggested for {v0} of {v1} sheets. Check them, then generate.',
        noSheets: 'No information sheets here yet. Build them from the suggested content, or add them by hand, then come back.',
        noTitle: 'No title — write the topic',
        none2: '—',
        pagesShort: 'p.',
        batchNote: 'Each sheet is written from its own pages. Text goes into the sections that are empty (the headings from DACUM or your own); new sections are added after them; nothing already written is replaced.',
        totalEst: '{v0} sheets · ≈ {v1} tokens · ≈ ${v2} (approximate)',
        needRows: 'Tick at least one sheet with a source and pages.',
        genMany: '✨ Generate',
        stop: '⏹ Stop',
        progress: 'Sheet {v0} of {v1}: {v2}',
        stopped: 'Stopped. Press Generate to continue with the sheets left.',
        resume: 'An earlier run stopped with {v0} sheet(s) left. Press Generate to continue.',
        doneMany: 'Done: {v0} sheet(s) written.',
        failedSome: '{v0} sheet(s) failed — press Generate to try them again.',
        stDone: 'Written', stErr: 'Failed', stRun: 'Writing…', stWait: 'Waiting',
        outcome: 'LO {v0}',
        aiSource: '🧠 Without a source — AI knowledge',
        aiOpt: '🧠 AI knowledge',
        aiNote: 'Written from the AI’s general professional knowledge for this job, level and country. No page citations and no reference are added. Check every technical fact, value and safety rule before use.',
        mixed: 'Complete what the pages do not cover from general knowledge (marked in the sheet)',
        country: 'Country / context',
        countryPh: 'e.g. Iraq',
        toVerify: 'To check',
        generalTag: 'General knowledge',
        ctxLine: 'Written for: {v0}'
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
        failed: 'Le service d’IA n’a pas répondu — il est peut-être arrêté, ou la connexion est coupée. Réessayez plus tard.',
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
        copyNote: 'Utilisez des sources autorisées pour la formation. Le brouillon reformule ; vérifiez citations et valeurs dans l’ouvrage.',
        hint: 'La rédaction depuis les sources (IA) s’active dans Paramètres → Divers.',
        svcDown: 'Le service d’IA est injoignable pour le moment (arrêté ou hors ligne). Vous pouvez ajouter des sources et choisir les pages ; la génération fonctionnera quand le service sera rétabli.',
        methodTitle: 'Méthode',
        methodAi: '✨ L’IA rédige la fiche',
        methodEx: '📖 Extraits du livre — hors ligne, gratuit',
        exNote: 'L’outil trouve, dans les pages choisies, les passages qui correspondent le mieux au sujet et aux titres de la fiche, et les place sur la fiche avec leur page. Rien n’est envoyé, sans coût. Le texte est celui du livre : reformulez-le et respectez le droit d’auteur. Fonctionne quand le livre et la fiche sont dans la même langue.',
        exEst: 'Hors ligne — rien n’est envoyé, sans coût.',
        exGen: '📖 Extraire',
        exNone: 'Aucun passage de ces pages ne correspond au sujet. Choisissez d’autres pages, ou vérifiez que le livre et la fiche sont dans la même langue.',
        exNeedBook: 'Les extraits ont besoin d’un livre ou d’un texte source.',
        exMapDone: 'Pages trouvées sur cet appareil pour {v0} fiche(s) sur {v1}. Vérifiez-les, puis extrayez.',
        exTag: 'Extrait du livre',
        clearAsk: 'Supprimer aussi les {v0} source(s) (livres, textes) gardées sur cet appareil pour « Rédiger depuis les sources » ? Elles servent à tous les projets.',
        cleared: 'Sources supprimées de cet appareil.',
        modeOne: '📄 Cette fiche',
        modeMany: '📚 Plusieurs fiches',
        useSources: 'Utiliser ces sources',
        scope: 'Fiches',
        scopeLo: 'Ce résultat d’apprentissage',
        scopeAll: 'Tout le module',
        mapBtn: '🔎 Proposer les pages',
        mapNote: 'L’IA ne lit que le sommaire (les signets du PDF, ou les premières lignes de chaque page) pour proposer les pages de chaque fiche. Vérifiez-les avant de générer.',
        mapEst: '≈ {v0} jetons · ≈ {v1} $',
        mapping: 'Correspondance des fiches et des pages…',
        mapDone: 'Pages proposées pour {v0} fiche(s) sur {v1}. Vérifiez-les, puis générez.',
        noSheets: 'Aucune fiche d’information ici. Créez-les depuis le contenu suggéré ou à la main, puis revenez.',
        noTitle: 'Sans titre — indiquez le sujet',
        none2: '—',
        pagesShort: 'p.',
        batchNote: 'Chaque fiche est rédigée à partir de ses propres pages. Le texte va dans les sections vides (titres venus de DACUM ou les vôtres) ; les nouvelles sections sont ajoutées après ; rien de déjà écrit n’est remplacé.',
        totalEst: '{v0} fiche(s) · ≈ {v1} jetons · ≈ {v2} $ (approximatif)',
        needRows: 'Cochez au moins une fiche avec une source et des pages.',
        genMany: '✨ Générer',
        stop: '⏹ Arrêter',
        progress: 'Fiche {v0} sur {v1} : {v2}',
        stopped: 'Arrêté. Cliquez sur Générer pour continuer avec les fiches restantes.',
        resume: 'Une exécution précédente s’est arrêtée ; il reste {v0} fiche(s). Cliquez sur Générer pour continuer.',
        doneMany: 'Terminé : {v0} fiche(s) rédigée(s).',
        failedSome: '{v0} fiche(s) en échec — cliquez sur Générer pour réessayer.',
        stDone: 'Rédigée', stErr: 'Échec', stRun: 'Rédaction…', stWait: 'En attente',
        outcome: 'RA {v0}',
        aiSource: '🧠 Sans source — connaissances de l’IA',
        aiOpt: '🧠 Connaissances de l’IA',
        aiNote: 'Rédigé à partir des connaissances professionnelles générales de l’IA pour cet emploi, ce niveau et ce pays. Aucune page ni référence n’est ajoutée. Vérifiez chaque donnée technique, valeur et règle de sécurité avant usage.',
        mixed: 'Compléter ce que les pages ne couvrent pas par des connaissances générales (signalé dans la fiche)',
        country: 'Pays / contexte',
        countryPh: 'ex. Irak',
        toVerify: 'À vérifier',
        generalTag: 'Connaissances générales',
        ctxLine: 'Rédigé pour : {v0}'
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
        failed: 'لم تستجب خدمة الذكاء الاصطناعي — قد تكون متوقفة أو الاتصال مقطوع. أعد المحاولة لاحقاً.',
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
        copyNote: 'استخدم مصادر مسموحاً استخدامها في التدريب. المسودة تعيد الصياغة؛ تحقق من الاقتباسات والقيم في الكتاب.',
        hint: 'يمكن تفعيل الصياغة من المصادر (ذكاء اصطناعي) من الإعدادات ← متنوع.',
        svcDown: 'خدمة الذكاء الاصطناعي غير متاحة الآن (قد تكون متوقفة أو لا يوجد اتصال). يمكنك إضافة المصادر واختيار الصفحات، ويعمل التوليد عند عودة الخدمة.',
        methodTitle: 'الطريقة',
        methodAi: '✨ يكتب الذكاء الاصطناعي الورقة',
        methodEx: '📖 مقتطفات من الكتاب — دون إنترنت ومجاناً',
        exNote: 'تبحث الأداة في الصفحات التي تختارها عن الفقرات الأقرب إلى موضوع الورقة وعناوينها، وتضعها في الورقة مع رقم صفحتها. لا يُرسل شيء ولا كلفة. النص هو نص الكتاب نفسه: أعد صياغته بأسلوبك وراعِ حقوق النشر. تعمل حين يكون الكتاب والورقة بلغة واحدة.',
        exEst: 'دون إنترنت — لا يُرسل شيء ولا كلفة.',
        exGen: '📖 استخراج',
        exNone: 'لا توجد فقرة في هذه الصفحات تطابق الموضوع. اختر صفحات أخرى، أو تأكد أن الكتاب والورقة بلغة واحدة.',
        exNeedBook: 'المقتطفات تحتاج كتاباً أو نصاً مصدراً.',
        exMapDone: 'وُجدت الصفحات على هذا الجهاز لـ {v0} من {v1} ورقة. راجعها ثم استخرج.',
        exTag: 'مقتطف من الكتاب',
        clearAsk: 'هل تحذف أيضاً المصادر ({v0}) (كتب ونصوص) المحفوظة على هذا الجهاز لـ«صياغة من المصادر»؟ هي مشتركة بين كل المشاريع.',
        cleared: 'حُذفت المصادر من هذا الجهاز.',
        modeOne: '📄 هذه الورقة',
        modeMany: '📚 عدة أوراق',
        useSources: 'المصادر المستخدمة',
        scope: 'الأوراق',
        scopeLo: 'محصلة التعلم هذه',
        scopeAll: 'الوحدة كاملة',
        mapBtn: '🔎 اقتراح الصفحات',
        mapNote: 'يقرأ الذكاء الاصطناعي الفهرس فقط (إشارات ملف PDF، أو الأسطر الأولى من كل صفحة) ليقترح صفحات كل ورقة. راجعها قبل التوليد.',
        mapEst: '≈ {v0} وحدة نصية · ≈ {v1} دولار',
        mapping: 'تجري مطابقة الأوراق مع الصفحات…',
        mapDone: 'اقتُرحت الصفحات لـ {v0} من {v1} ورقة. راجعها ثم ولّد.',
        noSheets: 'لا توجد أوراق معلومات هنا بعد. ابنِها من المحتوى المقترح أو أضفها يدوياً، ثم عُد.',
        noTitle: 'بلا عنوان — اكتب الموضوع',
        none2: '—',
        pagesShort: 'ص',
        batchNote: 'تُكتب كل ورقة من صفحاتها هي. يُكتب النص في الفقرات الفارغة (العناوين القادمة من DACUM أو التي كتبتها)، وتُضاف الفقرات الجديدة بعدها، ولا يُستبدل شيء مكتوب.',
        totalEst: '{v0} ورقة · ≈ {v1} وحدة نصية · ≈ {v2} دولار (تقريبي)',
        needRows: 'حدّد ورقة واحدة على الأقل لها مصدر وصفحات.',
        genMany: '✨ توليد',
        stop: '⏹ إيقاف',
        progress: 'الورقة {v0} من {v1}: {v2}',
        stopped: 'توقّف التوليد. اضغط «توليد» لإكمال الأوراق المتبقية.',
        resume: 'توقّف توليد سابق وبقيت {v0} ورقة. اضغط «توليد» للإكمال.',
        doneMany: 'اكتمل: كُتبت {v0} ورقة.',
        failedSome: 'تعذّرت {v0} ورقة — اضغط «توليد» لإعادة المحاولة.',
        stDone: 'كُتبت', stErr: 'تعذّرت', stRun: 'تُكتب…', stWait: 'بالانتظار',
        outcome: 'المحصلة {v0}',
        aiSource: '🧠 بلا مصدر — معرفة الذكاء الاصطناعي',
        aiOpt: '🧠 معرفة الذكاء الاصطناعي',
        aiNote: 'يُكتب من المعرفة المهنية العامة للذكاء الاصطناعي بما يناسب هذا العمل والمستوى والدولة. لا تُضاف صفحات ولا مرجع. تحقّق من كل معلومة فنية وقيمة وقاعدة سلامة قبل الاستخدام.',
        mixed: 'إكمال ما لا تغطيه الصفحات من المعرفة العامة (مع تمييزه في الورقة)',
        country: 'الدولة / السياق',
        countryPh: 'مثال: العراق',
        toVerify: 'يحتاج تحققاً',
        generalTag: 'معرفة عامة',
        ctxLine: 'يُكتب لـ: {v0}'
    }
};

/* The line that ends a section, in the CONTENT language. */
var _SRC_CITE = {
    en: '(Source: {s}, p. {p})',
    fr: '(Source : {s}, p. {p})',
    ar: '(المصدر: {s}، ص {p})'
};
/* 3.47.0: the line that ends a section NOT drawn from the source, in a
   sheet completed from general knowledge. */
var _SRC_GENERAL = {
    en: '(General knowledge — not from the source; check it)',
    fr: '(Connaissances générales — hors de la source ; à vérifier)',
    ar: '(معرفة عامة — ليست من المصدر؛ تحقّق منها)'
};
var SRC_AI = '__ai__';
/* 3.49.0: the line that ends an excerpt copied from the book. */
var _SRC_EXCERPT = {
    en: '(Excerpt — {s}, p. {p})',
    fr: '(Extrait — {s}, p. {p})',
    ar: '(مقتطف — {s}، ص {p})'
};            // the «no source» choice
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
    try { if (typeof _wsGet === 'function') return (_wsGet() || {}).hideSourceDrafts !== true; } catch (e) { /* fall through */ }
    return true;
}

/** Show or hide the button on the information sheet, in the UI language. */
function mbSrcPaintButton() {
    var b = document.getElementById('mb-src-btn');
    if (!b) return;
    b.hidden = !mbSrcEnabled();
    var l = document.getElementById('mb-src-btn-label');
    if (l) l.textContent = _srcT('btn');
    /* Hidden in Settings: one quiet line says where to turn it back on. */
    var h = document.getElementById('mb-src-hint');
    if (h) { h.hidden = mbSrcEnabled(); h.textContent = _srcT('hint'); }
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

/** After Clear All (storage.js): the sources are the device's, not the
    project's, so they are kept unless the user says otherwise (3.50.0). */
async function mbSrcOfferClear() {
    var list = [];
    try { list = await mbSources.list(); } catch (e) { return; }
    if (!list.length) return;
    var ask = _srcT('clearAsk', { v0: list.length });
    var yes = (typeof mbConfirm === 'function') ? await mbConfirm(ask, { danger: true }) : window.confirm(ask);
    if (!yes) return;
    for (var i = 0; i < list.length; i++) { try { await mbSources.remove(list[i].id); } catch (e) { /* ignore */ } }
    try { Object.keys(localStorage).forEach(function (k) { if (k.indexOf(SRC_JOB_KEY) === 0) localStorage.removeItem(k); }); } catch (e) { /* ignore */ }
    if (typeof showStatus === 'function') showStatus(_srcT('cleared'), 'success');
}

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
    var toc = await _srcPdfOutline(doc);
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
    pages.toc = toc;
    return pages;
}

/** The PDF's own table of contents (its bookmarks), two levels deep:
    [{ title, page }]. Empty when the file has none. 3.46.0: used to match
    sheets to pages without sending the book. */
async function _srcPdfOutline(doc) {
    var out = [];
    try {
        var items = await doc.getOutline();
        var walk = async function (list, depth) {
            for (var i = 0; i < (list || []).length && out.length < 400; i++) {
                var it = list[i], page = 0;
                try {
                    var dest = typeof it.dest === 'string' ? await doc.getDestination(it.dest) : it.dest;
                    if (Array.isArray(dest) && dest[0]) page = (await doc.getPageIndex(dest[0])) + 1;
                } catch (e) { page = 0; }
                var title = _srcClean(it.title || '');
                if (title && page) out.push({ title: title.slice(0, 120), page: page, level: depth });
                if (depth < 2 && it.items && it.items.length) await walk(it.items, depth + 1);
            }
        };
        await walk(items, 1);
    } catch (e) { /* no outline */ }
    return out;
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
    var pages, kind, toc = null;
    if (ext === 'pdf' || file.type === 'application/pdf') {
        pages = await mbSrcReadPdf(new Uint8Array(await file.arrayBuffer()), onPage);
        toc = pages.toc || [];
        kind = 'pdf';
    } else if (['txt', 'md', 'markdown', 'text', 'html', 'htm'].indexOf(ext) !== -1) {
        var raw = await file.text();
        pages = mbSrcSplitText((ext === 'html' || ext === 'htm') ? _srcHtmlToText(raw) : raw);
        kind = 'text';
    } else {
        throw new Error('badFile');
    }
    if (!pages.some(function (p) { return p.trim(); })) throw new Error('noText');
    return mbSources.put({ id: _srcNewId(), name: base, ref: base, kind: kind, pages: Array.from(pages),
                           toc: toc || [], added: new Date().toISOString() });
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
function _srcCost(tin, tout) { return (tin * SRC_RATE_IN + tout * SRC_RATE_OUT) / 1e6; }
var SRC_OUT_EST = Math.round(SRC_OUT_TOKENS * 0.75);   // a typical answer, for the estimate

/* ── Texts sent ────────────────────────────────────────────── */
function _srcPagesText(rec, from, to) {
    var out = [];
    for (var i = from; i <= to; i++) out.push('[[Page ' + i + ']]\n' + (rec.pages[i - 1] || ''));
    return out.join('\n\n');
}

/** What the AI reads to match sheets to pages: the PDF bookmarks when
    there are enough, else a line or two from the top of each page. */
function mbSrcDigest(rec, maxChars) {
    maxChars = maxChars || 20000;
    if (rec.toc && rec.toc.length >= 3) {
        var t = rec.toc.map(function (x) { return (x.level > 1 ? '  ' : '') + 'p.' + x.page + ' ' + x.title; }).join('\n');
        return t.slice(0, maxChars);
    }
    var perPage = function (p, lines, width) {
        var cand = String(p || '').split('\n').map(function (l) { return l.trim(); })
            .filter(function (l) { return l.length >= 3 && !/^\d+$/.test(l); });
        var heads = cand.filter(function (l) { return l.length <= 80 && !/[.;,]$/.test(l); });
        var pick = (heads.length ? heads : cand).slice(0, lines);
        return pick.map(function (l) { return l.slice(0, width); }).join(' | ');
    };
    var build = function (lines, width) {
        return rec.pages.map(function (p, i) { var x = perPage(p, lines, width); return x ? 'p.' + (i + 1) + ': ' + x : ''; })
            .filter(Boolean).join('\n');
    };
    var d = build(2, 80);
    if (d.length > maxChars) d = build(1, 60);
    if (d.length > maxChars) d = build(1, 35);
    return d.slice(0, maxChars);
}

/* ── A sheet and what it belongs to ───────────────────────── */
function _srcModule() {
    return (mbState.modulesData || []).find(function (m) { return m.id === mbState.currentModuleId; }) || null;
}
function _srcTr(v, lang) {
    if (typeof v === 'string') {
        var mod = _srcModule();
        if (mod && mod.dacumI18n && typeof mbDacumText === 'function') return mbDacumText(v, lang) || v;
        return v;
    }
    return (typeof biGet === 'function') ? biGet(v, lang) : '';
}
function _srcHas(v) {
    if (typeof v === 'string') return !!v.trim();
    return !!(v && typeof v === 'object' && Object.keys(v).some(function (k) { return typeof v[k] === 'string' && v[k].trim(); }));
}
function _srcStrict(v, lang) {
    return (typeof biGetStrict === 'function') ? biGetStrict(v, lang) : (typeof v === 'string' ? v : '');
}

/** The outcome's statement and criteria, the sheet's title, and its
    sections: H1, H2 … with whether each still needs its text. A sheet
    built from DACUM's suggestions has headings with no text (the
    knowledge items) — those are the ones written. */
function mbSrcSheetContext(lo, sh, lang) {
    var ctx = { lang: lang, lo: '', loNo: '', criteria: [], title: '', headings: [] };
    if (!lo) return ctx;
    var idx = mbState.learningOutcomesData.indexOf(lo);
    ctx.loNo = String(lo.number || (idx + 1));
    ctx.lo = _srcTr(lo.statement || lo.text || '', lang);
    ctx.criteria = (lo.performanceCriteria || []).map(function (pc) {
        return _srcTr((pc && typeof pc === 'object' && !('en' in pc) && !('ar' in pc)) ? (pc.text || '') : pc, lang);
    }).filter(Boolean);
    if (sh) {
        ctx.title = _srcTr(sh.title, lang);
        (sh.contentSections || []).forEach(function (c, i) {
            var h = _srcTr(c.heading, lang);
            if (!h) return;
            ctx.headings.push({ ref: 'H' + (i + 1), index: i, text: h, written: !!_srcStrict(c.text, lang).trim() });
        });
    }
    return ctx;
}

/* ── The programme around the sheet (3.47.0) ───────────────────
   As in DACUM Live Pro's prompts: the JOB is the focus, the occupation
   context only; sector, country and scope of work; the module (its full
   title, the short name only when there is no title) and its level.
   Read from what both ways of working fill: the cover table (pre-filled
   by DACUM, or typed), the module, DACUM's handoff when there was one,
   and the country typed in this dialog. */
function _srcCover(key, lang) {
    var r = (mbState.coverRows || []).find(function (x) { return x.seedKey === key || x.field === key; });
    return r ? String(_srcTr(r.value, lang) || '').trim() : '';
}
function mbSrcProgramContext(lang) {
    var mod = _srcModule() || {};
    var dc = mod.dacumContext || {};
    var title = String(_srcTr(mod.title, lang) || '').trim() || _srcCover('cvUnitTitle', lang) || String(mod.shortName || '').trim();
    var level = '';
    if (mod.nqfLevel) level = 'NQF/TVQF level ' + mod.nqfLevel;
    else if (mod.level) level = 'programme level ' + mod.level;
    else level = _srcCover('cvLevel', lang);
    var fw = _srcCover('cvFramework', lang);
    return {
        job: _srcCover('cvJob', lang), occupation: _srcCover('cvOccupation', lang), sector: _srcCover('cvSector', lang),
        country: String(mod.srcCountry != null ? mod.srcCountry : (dc.country || '')).trim(),
        scope: String(dc.scopeOfWork || '').trim(),
        module: title, level: level ? level + (fw ? ' (' + fw + ')' : '') : ''
    };
}
function _srcContextLines(c) {
    if (!c) return '';
    var same = c.job && c.occupation && c.job.toLowerCase() === c.occupation.toLowerCase();
    var out = [];
    out.push('JOB (the focus — write for the holder of this job): ' + (c.job || c.occupation || '(not specified)'));
    if (c.occupation && !same) out.push('OCCUPATION (context only): ' + c.occupation);
    if (c.sector) out.push('SECTOR: ' + c.sector);
    if (c.country) out.push('COUNTRY / CONTEXT: ' + c.country);
    if (c.scope) out.push('SCOPE OF WORK (boundary): ' + c.scope);
    if (c.module) out.push('TRAINING MODULE: ' + c.module);
    if (c.level) out.push('LEVEL OF THE TRAINEES: ' + c.level);
    return out.join('\n') + '\n';
}

/* ── 📖 Excerpts from the book, offline (3.49.0) ──────────────
   No AI and no network: the pages are cut into passages, and a BM25
   search (word statistics, the way search engines rank text) finds for
   each heading of the sheet — or for its topic — the passages that match
   best. They go on the sheet as the book wrote them, with their page;
   the trainer rewrites them. Arabic letters are normalised (أ إ آ → ا,
   ة → ه, ى → ي, diacritics and tatweel removed) and common prefixes and
   endings trimmed, so «الصيانة» finds «وصيانة». The book and the sheet
   must share a language: words are matched, not meanings. */
var _SRC_STOP = (function () {
    var w = ('the a an and or of to in on for with by from as at is are was were be been this that these those it its ' +
        'into than then so such can may must should will not no also which who what when where how all any each ' +
        'le la les un une des et ou de du au aux en dans par pour sur avec est sont ce cette ces il elle ils qui que ' +
        'ne pas plus se sa son ses leur leurs ' +
        'في من على الى إلى عن مع او أو و ثم هذا هذه ذلك تلك التي الذي الذين هو هي هم كان كانت يكون تكون ما لا ان أن إن قد كل بين عند حتى لم لن اي أي ' +
        'كما بعد قبل حيث ايضا أيضا غير اذا إذا ف ب ل').split(/\s+/);
    var set = {};
    w.forEach(function (x) { set[_srcNorm(x)] = 1; });
    return set;
})();
function _srcNorm(s) {
    s = String(s || '').toLowerCase()
        .replace(/[ً-ٰٟـ]/g, '')
        .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي');
    try { s = s.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) { /* old browser */ }
    return s;
}
function _srcStem(t) {
    if (/[؀-ۿ]/.test(t)) {
        if (t.length > 5) t = t.replace(/^(وال|بال|كال|فال|لل)/, '');
        if (t.length > 4) t = t.replace(/^ال/, '');
        if (t.length > 4) t = t.replace(/^[وفب]/, '');
        if (t.length > 4) t = t.replace(/(ات|ون|ين|ها|هم|ية|يه)$/, '');
        return t;
    }
    if (t.length > 4 && /ies$/.test(t)) return t.slice(0, -3) + 'y';
    if (t.length > 3 && /s$/.test(t) && !/ss$/.test(t)) return t.slice(0, -1);
    return t;
}
function mbSrcTokens2(text) {
    return _srcNorm(text).split(/[^\p{L}\p{N}]+/u).filter(function (t) {
        return t.length >= 2 && !_SRC_STOP[t];
    }).map(_srcStem).filter(function (t) { return t.length >= 2; });
}

/** Passages of a source: { page, text, toks, tf, len }. A page with no
    blank lines (most PDFs) is cut at sentence ends into pieces of about
    a short paragraph; a short line ending without a full stop is kept
    with what follows (a heading with its text). */
function _srcPassages(rec) {
    var out = [];
    rec.pages.forEach(function (p, i) {
        var txt = String(p || '').trim();
        if (!txt) return;
        var blocks = txt.split(/\n\s*\n/);
        var chunks = [];
        blocks.forEach(function (b) {
            var flat = b.replace(/\n(?!\s*(?:[•\-–▪◦]|\d+[.)]))/g, ' ').replace(/[ \t]+/g, ' ').trim();
            if (flat.length <= 900) { if (flat) chunks.push(flat); return; }
            var sentences = flat.match(/[^.!?؟。\n]+[.!?؟。]+["»”)]*\s*|[^.!?؟。\n]+$/g) || [flat];
            var cur = '';
            sentences.forEach(function (x) {
                if (cur && (cur.length + x.length) > 650) { chunks.push(cur.trim()); cur = ''; }
                cur += x;
            });
            if (cur.trim()) chunks.push(cur.trim());
        });
        /* A tiny piece (a heading) joins the next one. */
        for (var k = 0; k < chunks.length; k++) {
            if (chunks[k].length < 120 && k + 1 < chunks.length) { chunks[k + 1] = chunks[k] + '\n' + chunks[k + 1]; continue; }
            out.push({ page: i + 1, text: chunks[k] });
        }
    });
    out.forEach(function (ps) {
        ps.toks = mbSrcTokens2(ps.text);
        ps.len = ps.toks.length || 1;
        ps.tf = {};
        ps.toks.forEach(function (t) { ps.tf[t] = (ps.tf[t] || 0) + 1; });
    });
    return out;
}

var _srcIndexCache = {};
function _srcIndex(rec) {
    if (_srcIndexCache[rec.id] && _srcIndexCache[rec.id].n === rec.pages.length) return _srcIndexCache[rec.id];
    var ps = _srcPassages(rec);
    var df = {}, total = 0;
    ps.forEach(function (p) { total += p.len; Object.keys(p.tf).forEach(function (t) { df[t] = (df[t] || 0) + 1; }); });
    var idx = { n: rec.pages.length, ps: ps, df: df, avg: ps.length ? total / ps.length : 1, N: ps.length };
    _srcIndexCache[rec.id] = idx;
    return idx;
}

/** BM25 score of one passage for weighted query terms { term: weight }. */
function _srcScore(idx, p, q) {
    var k1 = 1.2, b = 0.75, sc = 0;
    Object.keys(q).forEach(function (t) {
        var f = p.tf[t];
        if (!f) return;
        var idf = Math.log(1 + (idx.N - idx.df[t] + 0.5) / (idx.df[t] + 0.5));
        sc += q[t] * idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * p.len / idx.avg));
    });
    return sc;
}
function _srcQuery(parts) {
    var q = {};
    parts.forEach(function (x) {
        mbSrcTokens2(x.text).forEach(function (t) { q[t] = Math.max(q[t] || 0, x.w); });
    });
    return q;
}
function _srcCut(t, max) {
    t = String(t || '').trim();
    if (t.length <= max) return t;
    var cut = t.slice(0, max);
    var end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('؟ '), cut.lastIndexOf('! '), cut.lastIndexOf('.\n'));
    return (end > max * 0.5 ? cut.slice(0, end + 1) : cut) + ' …';
}
/** A heading for a passage on a sheet with no headings: its own first
    line when that reads like one, else the topic and a number. */
function _srcPassageHead(text, topic, k) {
    var first = String(text).split('\n')[0].trim();
    if (first && first.length <= 80 && !/[.:;,،]$/.test(first) && first.split(/\s+/).length <= 10 && first.length < String(text).length) return first;
    return topic + ' (' + k + ')';
}

/**
 * The draft for one sheet, from the book alone: the same shape as the
 * AI's (mode 'excerpt'), so the dialog and the sheet writer need nothing
 * else. Headings waiting for text get their best one or two passages;
 * a sheet with none gets up to five sections for its topic.
 */
function mbSrcExcerpts(rec, from, to, ctx, topic) {
    var idx = _srcIndex(rec);
    var pool = idx.ps.filter(function (p) { return p.page >= from && p.page <= to; });
    var used = {};
    var topicQ = [{ text: topic, w: 0.4 }].concat(ctx && ctx.lo ? [{ text: ctx.lo, w: 0.15 }] : []);
    var rank = function (q) {
        return pool.map(function (p, i) { return { p: p, i: i, s: _srcScore(idx, p, q) }; })
            .filter(function (x) { return x.s > 0 && !used[x.p.page + ':' + x.i]; })
            .sort(function (a, b) { return b.s - a.s; });
    };
    var sections = [], missing = [];
    var heads = ((ctx && ctx.headings) || []).filter(function (h) { return !h.written; });
    if (heads.length) {
        heads.forEach(function (h) {
            var r = rank(_srcQuery([{ text: h.text, w: 1 }].concat(topicQ)));
            if (!r.length || r[0].s < 1) { missing.push(h.text); return; }
            var pick = r.filter(function (x, j) { return j < 2 && x.s >= r[0].s * 0.45; });
            pick.forEach(function (x) { used[x.p.page + ':' + x.i] = 1; });
            pick.sort(function (a, b) { return a.p.page - b.p.page || a.i - b.i; });
            sections.push({
                ref: h.ref, heading: h.text, origin: 'source',
                text: _srcCut(pick.map(function (x) { return x.p.text; }).join('\n\n'), 1500),
                pages: pick.map(function (x) { return x.p.page; }).filter(function (v, k, a) { return a.indexOf(v) === k; })
            });
        });
    } else {
        var r2 = rank(_srcQuery([{ text: topic, w: 1 }].concat(ctx && ctx.lo ? [{ text: ctx.lo, w: 0.3 }] : [])));
        var best = r2.length ? r2[0].s : 0;
        r2.filter(function (x) { return x.s >= best * 0.35; }).slice(0, 5)
          .sort(function (a, b) { return a.p.page - b.p.page || a.i - b.i; })
          .forEach(function (x, k) {
              sections.push({ ref: '', heading: _srcPassageHead(x.p.text, topic, k + 1), origin: 'source',
                              text: _srcCut(x.p.text, 1500), pages: [x.p.page] });
          });
    }
    return { mode: 'excerpt', objective: '', sections: sections, selfCheck: '', answerKey: '',
             notCovered: missing.join('; '), toVerify: '' };
}

/** 🔎 on this device: for each row, the source and the few pages that
    match its topic and headings best. { rowIndex: { src, from, to } } */
function mbSrcMapLocal(rows, recs) {
    var out = {};
    rows.forEach(function (r, ri) {
        var q = _srcQuery([{ text: r.topic, w: 1 }].concat((r.heads || []).map(function (h) { return { text: h, w: 0.6 }; })));
        var bestRec = null, bestScore = 0, bestPages = null;
        recs.forEach(function (rec) {
            var idx = _srcIndex(rec);
            var byPage = {};
            idx.ps.forEach(function (p) {
                var sc = _srcScore(idx, p, q);
                if (sc > 0) (byPage[p.page] = byPage[p.page] || []).push(sc);
            });
            var pageScore = {};
            Object.keys(byPage).forEach(function (pg) {
                var a = byPage[pg].sort(function (x, y) { return y - x; });
                pageScore[pg] = a[0] + (a[1] || 0) * 0.5;
            });
            var top = 0, topPage = 0;
            Object.keys(pageScore).forEach(function (pg) { if (pageScore[pg] > top) { top = pageScore[pg]; topPage = +pg; } });
            if (top > bestScore) { bestScore = top; bestRec = rec; bestPages = { score: pageScore, top: topPage, best: top }; }
        });
        if (!bestRec || bestScore < 1) return;
        var from = bestPages.top, to = bestPages.top;
        var good = function (pg) { return (bestPages.score[pg] || 0) >= bestPages.best * 0.4; };
        while ((to - from + 1) < 6 && good(to + 1)) to++;
        while ((to - from + 1) < 6 && from > 1 && good(from - 1)) from--;
        out[ri] = { src: bestRec.id, from: from, to: to };
    });
    return out;
}

/* ── The request for one sheet ─────────────────────────────── */
function mbSrcPrompt(o) {
    var L = _SRC_LANG_NAMES[o.lang] || 'English';
    var mode = o.mode || 'book';                // 'book' | 'mixed' | 'ai'
    var heads = o.headings || [];
    var toWrite = heads.filter(function (h) { return !h.written; });
    var done = heads.filter(function (h) { return h.written; });
    var hasSrc = mode !== 'ai';
    return 'You are an instructional designer writing an INFORMATION SHEET for a competency-based TVET training module ' +
        '(technical and vocational education and training). The trainees are vocational learners.\n\n' +
        _srcContextLines(o.ctx) +
        'TOPIC OF THE SHEET: ' + o.topic + '\n' +
        (o.lo ? 'LEARNING OUTCOME: ' + o.lo + '\n' : '') +
        (o.criteria && o.criteria.length ? 'PERFORMANCE CRITERIA:\n' + o.criteria.map(function (c) { return '- ' + c; }).join('\n') + '\n' : '') +
        (toWrite.length ? 'HEADINGS ALREADY ON THE SHEET, WAITING FOR THEIR TEXT (write each one):\n' +
            toWrite.map(function (h) { return h.ref + ': ' + h.text; }).join('\n') + '\n' : '') +
        (done.length ? 'SECTIONS ALREADY WRITTEN (do not repeat them):\n' +
            done.map(function (h) { return '- ' + h.text; }).join('\n') + '\n' : '') +
        (hasSrc
            ? '\nSOURCE: ' + o.source + '\n' +
              'The source pages follow, each starting with a [[Page n]] marker.\n\n' +
              '<source_pages>\n' + o.pagesText + '\n</source_pages>\n\n'
            : '\nNO SOURCE IS GIVEN for this sheet.\n\n') +
        'RULES\n' +
        (mode === 'book'
            ? '- Use ONLY information found in the source pages. Do not add facts, figures or advice from your own knowledge.\n' +
              '- If the pages do not cover part of the topic or a heading, do not fill the gap: name it in "notCovered".\n'
            : mode === 'mixed'
            ? '- Base the sheet on the source pages first. Where the pages do not cover something the topic or a heading needs, ' +
              'you may complete it from well-established professional knowledge. Such a section gets "origin": "general" and ' +
              '"pages": []; a section from the pages gets "origin": "source". Never mix both in one section.\n' +
              '- Name in "notCovered" what the pages do not cover.\n'
            : '- Write from well-established professional knowledge of this job: only what competent practitioners and ' +
              'trainers would agree on, as practised in the country given (or in general when none is given). Every section has ' +
              '"origin": "general" and "pages": [].\n') +
        (hasSrc ? '- Explain in your own words, simply and accurately. Do not copy passages; a short definition, a formula, ' +
              'a value or a safety rule may be kept exact.\n' +
              '- Keep numbers, units, codes, standards and part names exactly as in the source.\n' : '') +
        '- NEVER invent standard numbers, regulation names, codes, statistics, prices or references. Where a standard or a ' +
        'local rule matters, write it generically (e.g. "the national wiring regulations").\n' +
        (mode !== 'book' ? '- A fact, value or rule you are not sure of, or that depends on local regulation, goes in "toVerify" ' +
              '(short items) instead of being stated as certain.\n' : '') +
        '- Pitch depth, vocabulary and examples to the level of the trainees; use the conditions, tools, units and practices ' +
        'usual for the job in the country given.\n' +
        (toWrite.length
            ? '- Write the text of every heading waiting for its text, in the order given, and return it with its "ref" ' +
              '(e.g. "H2") and its heading (in ' + L + ').' +
              (mode === 'book' ? ' A heading the pages say nothing about is left out and named in "notCovered".' : '') +
              ' Then add new sections ("ref": "") only for what the topic needs that those headings do not cover — at most 3.\n'
            : '- Write 3 to 7 sections that teach the topic in a logical order ("ref": "").\n') +
        '- Each section text is 60 to 250 words, and the whole answer stays under 1,300 words (the reply has a fixed length limit). ' +
        'A list is written as lines beginning with "• "; the steps of a procedure as lines "1. ", "2. ".\n' +
        (hasSrc ? '- "pages" lists the page numbers (from the [[Page n]] markers) each section is based on.\n' : '') +
        '- "objective": one to three lines completing "After studying this information sheet, you will be able to:", ' +
        'each line starting with an action verb.\n' +
        (o.selfCheck
            ? '- "selfCheck": 5 numbered questions on the sections (short answer, true/false or multiple choice), and ' +
              '"answerKey": the answers, numbered the same way.\n'
            : '- "selfCheck" and "answerKey" are empty strings.\n') +
        '- Write everything in ' + L + '. ' + (_SRC_STYLE[o.lang] || '') + '\n\n' +
        'OUTPUT FORMAT\nReturn ONLY a JSON object, no other text:\n' +
        '{"objective":"...","sections":[{"ref":"H1","heading":"...","text":"...","origin":"' + (hasSrc ? 'source' : 'general') + '","pages":[' + (hasSrc ? '12,13' : '') + ']}],' +
        '"selfCheck":"...","answerKey":"...","notCovered":"...","toVerify":"..."}';
}

/* ── The request that matches sheets to pages ───────────────── */
function mbSrcMapPrompt(rows, recs, lang) {
    var sheets = rows.map(function (r, i) {
        var line = 'S' + (i + 1) + ' [' + (/^\d/.test(r.loNo) ? 'LO ' + r.loNo : r.loNo) + '] ' + r.topic;
        if (r.heads && r.heads.length) line += ' — covers: ' + r.heads.slice(0, 8).map(function (h) { return h.slice(0, 80); }).join('; ');
        return line;
    }).join('\n');
    var books = recs.map(function (rec, i) {
        return 'B' + (i + 1) + ': ' + (rec.ref || rec.name) + ' (' + rec.pages.length + ' pages)\n' + mbSrcDigest(rec, Math.floor(60000 / recs.length));
    }).join('\n\n');
    return 'You match the INFORMATION SHEETS of a TVET training module to the pages of source documents that cover them.\n\n' +
        'SHEETS (topic, and the sections each one must cover):\n' + sheets + '\n\n' +
        'SOURCES (contents: page number, then the heading or first lines on that page):\n' + books + '\n\n' +
        'RULES\n' +
        '- For each sheet choose the ONE source and the tightest page range that covers its topic: at most 15 pages.\n' +
        '- Page numbers are those shown as p.N above.\n' +
        '- When no source covers a sheet, give "source": null.\n' +
        '- Sheets and sources may be in different languages (' + (_SRC_LANG_NAMES[lang] || 'English') + ' or another); match by meaning.\n\n' +
        'OUTPUT FORMAT\nReturn ONLY a JSON object, no other text:\n' +
        '{"map":[{"sheet":"S1","source":"B1","from":12,"to":18},{"sheet":"S2","source":null}]}';
}

function _srcJson(data) {
    var raw = '';
    if (data && Array.isArray(data.content)) raw = data.content.map(function (b) { return (b && b.text) || ''; }).join('');
    else if (data && typeof data.text === 'string') raw = data.text;
    else if (data && typeof data === 'object') return data;
    var body = String(raw).trim().replace(/```json\s*/gi, '').replace(/```/g, '').trim();
    try { return JSON.parse(body); } catch (e) {
        var a = body.indexOf('{'), b = body.lastIndexOf('}');
        if (a === -1 || b <= a) throw new Error('badReply');
        try { return JSON.parse(body.slice(a, b + 1)); } catch (e2) { throw new Error('badReply'); }
    }
}

/** Normalised draft: never a crash on a missing field. */
function mbSrcNormalise(obj, maxPage, mode) {
    var str = function (v) { return typeof v === 'string' ? v.trim() : (Array.isArray(v) ? v.filter(function (x) { return typeof x === 'string'; }).join('\n').trim() : ''); };
    if (!obj || !Array.isArray(obj.sections)) throw new Error('badReply');
    return {
        mode: mode || 'book',
        objective: str(obj.objective),
        sections: (obj.sections || []).map(function (s) {
            var pages = (Array.isArray(s && s.pages) ? s.pages : []).map(function (p) { return parseInt(p, 10); })
                .filter(function (p) { return isFinite(p) && p >= 1 && (!maxPage || p <= maxPage); });
            pages = pages.filter(function (p, i) { return pages.indexOf(p) === i; }).sort(function (a, b) { return a - b; });
            var ref = str(s && s.ref);
            /* What a section stands on: always «general» with no source;
               with one, «general» only when the AI says so — a section
               with pages is from the source whatever it claims. */
            var origin = mode === 'ai' ? 'general'
                : (mode === 'mixed' && str(s && s.origin) === 'general' && !pages.length) ? 'general' : 'source';
            return { ref: /^H\d+$/.test(ref) ? ref : '', heading: str(s && s.heading), text: str(s && s.text), pages: mode === 'ai' ? [] : pages, origin: origin };
        }).filter(function (s) { return s.text && (s.heading || s.ref); }),
        selfCheck: str(obj.selfCheck),
        answerKey: str(obj.answerKey),
        notCovered: mode === 'ai' ? '' : str(obj.notCovered),
        toVerify: mode === 'book' ? '' : str(obj.toVerify)
    };
}

/** { S-index: { src, from, to } } from the mapping answer, checked
    against the real page counts. */
function mbSrcNormaliseMap(obj, rowCount, recs) {
    var out = {};
    (obj && Array.isArray(obj.map) ? obj.map : []).forEach(function (m) {
        var si = parseInt(String(m && m.sheet || '').replace(/^S/i, ''), 10) - 1;
        var bi = parseInt(String(m && m.source || '').replace(/^B/i, ''), 10) - 1;
        if (!(si >= 0 && si < rowCount) || !(bi >= 0 && bi < recs.length)) return;
        var n = recs[bi].pages.length;
        var from = Math.max(1, Math.min(n, parseInt(m.from, 10) || 1));
        var to = Math.max(from, Math.min(n, parseInt(m.to, 10) || from));
        if (to - from + 1 > SRC_MAX_PAGES) to = from + SRC_MAX_PAGES - 1;
        out[si] = { src: recs[bi].id, from: from, to: to };
    });
    return out;
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
    return out.join(lang === 'ar' ? '، ' : ', ');
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
    var data;
    try { data = await res.json(); } catch (e) { throw new Error('badReply'); }
    return _srcJson(data);
}

/* ── Writing into a sheet ─────────────────────────────────────
   Shared by «this sheet» and «several sheets». A section with a ref
   (H2) goes into that heading's empty text; the others are added after
   the sheet's sections. Nothing written is replaced: a heading that
   already has text in the content language keeps it, and the title,
   objective and self-check are written only where empty. Blank cards
   (no heading, no text) are dropped first. Returns the sections written. */
function _srcWriteSheet(sh, draft, pick, rec, lang) {
    var setL = function (o, key, text) { if (typeof biSet === 'function') biSet(o, key, lang, text); else o[key] = text; };
    if (!Array.isArray(sh.contentSections)) sh.contentSections = [];
    var byRef = {};
    sh.contentSections.forEach(function (c, i) { byRef['H' + (i + 1)] = c; });
    var n = 0, added = [];
    draft.sections.forEach(function (s, i) {
        if (pick.sections && !pick.sections[i]) return;
        var text = s.text;
        if (pick.cite && rec) {
            /* From the source: its pages. Completed from general
               knowledge in a sheet that has a source: said so, so the two
               never read alike. A sheet with no source at all carries no
               line; the dialog warns instead. */
            var cite = s.origin === 'general' ? (_SRC_GENERAL[lang] || _SRC_GENERAL.en)
                : draft.mode === 'excerpt'
                ? (s.pages && s.pages.length ? (_SRC_EXCERPT[lang] || _SRC_EXCERPT.en).replace('{s}', rec.name).replace('{p}', mbSrcPageList(s.pages, lang)) : '')
                : mbSrcCiteLine(rec.name, s.pages, lang);
            if (cite) text = text ? text + '\n' + cite : cite;
        }
        var target = s.ref ? byRef[s.ref] : null;
        if (target) {
            if (_srcStrict(target.text, lang).trim()) return;          // already written
            if (!_srcStrict(target.heading, lang).trim() && s.heading) setL(target, 'heading', s.heading);
            setL(target, 'text', text);
            n++;
            return;
        }
        var sec = { contentId: '', marks: [], tables: [], uid: (typeof mbUid === 'function') ? mbUid() : _srcNewId() };
        setL(sec, 'heading', s.heading);
        setL(sec, 'text', text);
        added.push(sec);
        n++;
    });
    sh.contentSections = sh.contentSections.filter(function (c) {
        return _srcHas(c.heading) || _srcHas(c.text) || (c.tables && c.tables.length) || (c.marks && c.marks.length);
    }).concat(added);
    if (pick.topic && !_srcHas(sh.title)) setL(sh, 'title', pick.topic);
    if (pick.objective && draft.objective && !_srcStrict(sh.objective, lang).trim()) setL(sh, 'objective', draft.objective);
    if (pick.selfCheck && draft.selfCheck && !_srcStrict(sh.selfCheckContent, lang).trim()) {
        setL(sh, 'selfCheckContent', draft.selfCheck);
        if (draft.answerKey && !_srcStrict(sh.answersKeyContent, lang).trim()) setL(sh, 'answersKeyContent', draft.answerKey);
    }
    if (rec) _srcAddReference(rec.ref || rec.name);
    return n;
}

/** After writing: the module keeps the data, the sheet on screen shows it. */
function _srcAfterWrite() {
    if (typeof saveCurrentModuleLOData === 'function') saveCurrentModuleLOData();
    var lo = (typeof mbCurrentLOObject === 'function') ? mbCurrentLOObject() : null;
    if (lo && lo.infoSheets && lo.infoSheets[mbState.currentInfoSheetIndex] && typeof loadInfoSheetAtIndex === 'function') {
        loadInfoSheetAtIndex(lo, mbState.currentInfoSheetIndex);
    }
    if (typeof updateLOSummary === 'function') updateLOSummary();
    if (typeof updateModuleSummary === 'function') updateModuleSummary();
    if (typeof mbLibrarySave === 'function') { try { mbLibrarySave(); } catch (e) { /* autosave absent */ } }
}

/** «This sheet»: into the information sheet open in the tab; a new one
    when the outcome has none. */
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
    var n = _srcWriteSheet(lo.infoSheets[idx], draft, pick, rec, lang);
    _srcAfterWrite();
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
        mbState.refIdCounter = Math.max(mbState.refIdCounter || 0, mbState.referencesData.reduce(function (m, r) { return Math.max(m, +r.id || 0); }, 0)) + 1;
        mbState.referencesData.push({ id: mbState.refIdCounter, value: t });
    }
    if (typeof renderReferences === 'function') renderReferences();
}

/* ── Several sheets (3.46.0) ──────────────────────────────────
   One row per information sheet in the scope — built from DACUM's
   suggestions or by hand, it makes no difference: the title is the
   topic (a sheet with no title asks for one), its empty headings are
   what gets written. The rows, their pages and what is done are kept
   per module in localStorage, so a run stopped by closing the page goes
   on from the next sheet. */
var SRC_JOB_KEY = 'mb_src_job:';

function _srcJobLoad(moduleId) {
    try { var j = JSON.parse(localStorage.getItem(SRC_JOB_KEY + moduleId) || 'null'); return (j && Array.isArray(j.rows)) ? j : null; }
    catch (e) { return null; }
}
function _srcJobSave() {
    if (!_src || !_src.moduleId) return;
    try {
        localStorage.setItem(SRC_JOB_KEY + _src.moduleId, JSON.stringify({
            scope: _src.scope, use: _src.use, rows: _src.rows.map(function (r) {
                return { loId: r.loId, uid: r.uid, topic: r.topic, src: r.src, from: r.from, to: r.to, on: r.on, status: r.status === 'run' ? 'wait' : r.status };
            })
        }));
    } catch (e) { /* storage full or blocked */ }
}

/** The rows of the scope, merged with what was saved for this module. */
function mbSrcBuildRows(scope) {
    var lang = _srcContentLang();
    var saved = _srcJobLoad(mbState.currentModuleId);
    var keep = {};
    (saved ? saved.rows : []).forEach(function (r) { keep[r.loId + '\n' + r.uid] = r; });
    var los = (scope === 'all') ? (mbState.learningOutcomesData || []) : [(typeof mbCurrentLOObject === 'function') ? mbCurrentLOObject() : null];
    var rows = [];
    los.forEach(function (lo) {
        if (!lo) return;
        var loIndex = mbState.learningOutcomesData.indexOf(lo);
        (lo.infoSheets || []).forEach(function (sh, i) {
            var uid = (typeof mbInfoSheetKey === 'function') ? mbInfoSheetKey(sh) : (sh.uid || (sh.uid = _srcNewId()));
            var ctx = mbSrcSheetContext(lo, sh, lang);
            var num = (typeof mbSeqNumber === 'function') ? mbSeqNumber(lo, loIndex, 'info', i) : (sh.sheetNumber || (loIndex + 1) + '-' + (i + 1));
            var old = keep[lo.id + '\n' + uid];
            rows.push({
                loId: lo.id, uid: uid, loNo: ctx.loNo, num: num,
                topic: (old && old.topic) || ctx.title || '',
                heads: ctx.headings.filter(function (h) { return !h.written; }).map(function (h) { return h.text; }),
                src: old ? old.src : '', from: old ? old.from : 0, to: old ? old.to : 0,
                status: old ? old.status : 'wait',
                on: old ? (old.on !== false && old.status !== 'done') : true
            });
        });
    });
    return rows;
}

function _srcRowSheet(r) {
    var lo = (mbState.learningOutcomesData || []).find(function (l) { return l.id === r.loId; });
    var sh = lo && (lo.infoSheets || []).find(function (s) { return s.uid === r.uid; });
    return sh ? { lo: lo, sh: sh } : null;
}
function _srcRowRec(r) { return _src.list.find(function (x) { return x.id === r.src; }) || null; }
function _srcRowReady(r) {
    if (!r.on || !r.topic.trim()) return false;
    var ex = !!(_src && _src.method === 'excerpt');
    if (r.src === SRC_AI) return !ex;
    var rec = _srcRowRec(r);
    return !!(rec && r.from >= 1 && r.to >= r.from && r.to <= rec.pages.length && (ex || (r.to - r.from + 1) <= SRC_MAX_PAGES));
}

/* ── The dialog ─────────────────────────────────────────────── */
var _src = null;

function _srcEnsureStyle() {
    if (document.getElementById('src-style')) return;
    var s = document.createElement('style');
    s.id = 'src-style';
    s.textContent = [
        '#src-overlay .ws-modal{width:min(780px,100%);max-height:92vh;}',
        '#src-overlay .src-modes{display:flex;gap:6px;margin:0 0 14px;flex-wrap:wrap;}',
        '#src-overlay .src-mode{flex:1 1 auto;padding:8px 12px;border:1px solid #cbd5e1;border-radius:9px;background:#f8fafc;',
        'color:#475569;font:inherit;font-weight:600;cursor:pointer;}',
        '#src-overlay .src-mode.is-on{background:#e0e7ff;border-color:#6366f1;color:#3730a3;box-shadow:inset 0 0 0 1px #6366f1;}',
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
        '#src-overlay .src-btn:disabled{opacity:.55;cursor:default;}',
        '#src-overlay .src-input,#src-overlay .src-area,#src-overlay .src-sel{width:100%;box-sizing:border-box;padding:7px 9px;border:1.5px solid #d1d5db;',
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
        '#src-overlay fieldset.src-fs{border:none;margin:0;padding:0;min-width:0;}',
        '#src-overlay .src-refs{display:flex;flex-direction:column;gap:6px;margin:0 0 12px;}',
        '#src-overlay .src-refrow{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,2fr);gap:8px;align-items:center;}',
        '#src-overlay .src-rows{display:flex;flex-direction:column;gap:8px;margin:8px 0 10px;}',
        '#src-overlay .src-row{border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;background:#fff;display:grid;',
        'grid-template-columns:auto minmax(0,1fr);gap:6px 10px;align-items:center;}',
        '#src-overlay .src-row.is-done{background:#f0fdf4;border-color:#bbf7d0;}',
        '#src-overlay .src-row.is-err{background:#fef2f2;border-color:#fecaca;}',
        '#src-overlay .src-row.is-run{border-color:#6366f1;box-shadow:inset 0 0 0 1px #6366f1;}',
        '#src-overlay .src-row > input[type=checkbox]{margin:0;accent-color:#6366f1;}',
        '#src-overlay .src-row-head{display:flex;gap:8px;align-items:center;min-width:0;}',
        '#src-overlay .src-tag{flex:0 0 auto;font-size:.78em;font-weight:700;color:#475569;background:#f1f5f9;border-radius:6px;padding:2px 7px;}',
        '#src-overlay .src-st{flex:0 0 auto;font-size:.78em;font-weight:700;border-radius:6px;padding:2px 7px;margin-inline-start:auto;}',
        '#src-overlay .src-st.st-done{color:#15803d;background:#dcfce7;}',
        '#src-overlay .src-st.st-err{color:#b91c1c;background:#fee2e2;}',
        '#src-overlay .src-st.st-run{color:#3730a3;background:#e0e7ff;}',
        '#src-overlay .src-row-body{grid-column:2;display:flex;flex-wrap:wrap;gap:6px 8px;align-items:center;}',
        '#src-overlay .src-row-body .src-input{flex:1 1 220px;}',
        '#src-overlay .src-row-body .src-sel{flex:1 1 160px;width:auto;}',
        '#src-overlay .src-row-body .src-num{width:4.6em;}',
        '#src-overlay progress.src-prog{width:100%;height:10px;margin:6px 0 0;accent-color:#6366f1;}',
        '@media (max-width:520px){#src-overlay .src-meta{white-space:normal;}#src-overlay .src-refrow{grid-template-columns:1fr;}}'
    ].join('');
    document.head.appendChild(s);
}

async function mbSrcOpen() {
    if (document.getElementById('src-overlay')) return;
    if (!mbState.currentLOId) { if (typeof showStatus === 'function') showStatus(_srcT('needLo'), 'error'); return; }
    if (typeof saveCurrentSheetToLO === 'function') saveCurrentSheetToLO();
    _srcEnsureStyle();
    var lang = _srcContentLang();
    var lo = mbCurrentLOObject();
    var ctx = mbSrcSheetContext(lo, (lo.infoSheets || [])[mbState.currentInfoSheetIndex], lang);
    var saved = _srcJobLoad(mbState.currentModuleId);
    _src = { mode: 'one', list: [], sel: null, from: 1, to: 1, topic: ctx.title || '', selfCheck: true, cite: true,
             draft: null, busy: false, paste: false,
             moduleId: mbState.currentModuleId, scope: (saved && saved.scope) || 'lo', use: (saved && saved.use) || null,
             rows: [], running: false, stop: false, note: '', mixed: false, method: 'ai',
             country: mbSrcProgramContext(lang).country };
    try { _src.list = await mbSources.list(); } catch (e) { _src.list = []; }
    /* No source on this device: «without a source» is the choice. */
    if (_src.list.length) _srcSelect(_src.list[_src.list.length - 1].id, true);
    else _srcSelect(SRC_AI, true);
    if (!_src.use) _src.use = _src.list.slice(-3).map(function (r) { return r.id; });
    _src.use = _src.use.filter(function (id) { return _src.list.some(function (r) { return r.id === id; }); });
    /* A run left unfinished on this module opens where it stopped. */
    if (saved && saved.rows.some(function (r) { return r.status === 'done'; }) &&
        saved.rows.some(function (r) { return r.on !== false && r.status !== 'done' && r.src; })) {
        _src.mode = 'many';
        _src.rows = _srcDefaultRows(mbSrcBuildRows(_src.scope));
        _src.note = _srcT('resume', { v0: _src.rows.filter(function (r) { return r.on && r.status !== 'done'; }).length });
    }

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
    if (_src.note) _srcMsg(_src.note);
    _srcCheckService();

    ov.addEventListener('click', _srcOnClick);
    ov.addEventListener('input', _srcOnInput);
    ov.addEventListener('change', _srcOnChange);
    document.getElementById('src-file').addEventListener('change', _srcOnFile);
    _srcKey = function (e) { if (e.key === 'Escape') mbSrcClose(); };
    document.addEventListener('keydown', _srcKey);
}
var _srcKey = null;

/** 3.48.0: is the AI service there? Asked once when the dialog opens,
    quietly; when it is not, a line says so at the top of the dialog
    (sources and pages can still be prepared). */
async function _srcCheckService() {
    var base = (typeof MB_AI_BACKEND_BASE !== 'undefined') ? MB_AI_BACKEND_BASE : 'https://dacum-ai-backend-production.up.railway.app';
    var ok = false;
    if (typeof navigator === 'undefined' || navigator.onLine !== false) {
        var ctl = new AbortController();
        var t = setTimeout(function () { ctl.abort(); }, 8000);
        try {
            var r = await fetch(base + '/', { method: 'GET', signal: ctl.signal, cache: 'no-store' });
            ok = r.ok;
        } catch (e) { ok = false; } finally { clearTimeout(t); }
    }
    if (!_src) return;
    _src.svcDown = !ok;
    var ov = document.getElementById('src-overlay');
    var old = document.getElementById('src-svc');
    if (old) old.remove();
    if (!ok && ov) {
        var p = document.createElement('p');
        p.id = 'src-svc'; p.className = 'src-warn'; p.setAttribute('role', 'alert');
        p.style.margin = '12px 20px 0';
        p.textContent = '⚠️ ' + _srcT('svcDown');
        var body = document.getElementById('src-body');
        body.parentNode.insertBefore(p, body);
    }
}

function mbSrcClose() {
    if (_src) { _src.stop = true; _srcJobSave(); }
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
function _srcIsAI() { return !!_src && _src.sel === SRC_AI; }
/** Rows with no source chosen use «AI knowledge» when the device has no source at all. */
function _srcDefaultRows(rows) {
    if (!_src.list.length) rows.forEach(function (r) { if (!r.src) r.src = SRC_AI; });
    return rows;
}
/** «Written for: job · level · module · country» under the country field. */
function _srcCtxSummary() {
    var c = mbSrcProgramContext(_srcContentLang());
    var parts = [c.job || c.occupation, c.level, c.module, c.country].filter(Boolean);
    return parts.length ? _srcT('ctxLine', { v0: parts.join(' · ') }) : '';
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

/** «This sheet»: tokens, cost, limits. True when it can be sent. */
function _srcPaintEstimate() {
    var el = document.getElementById('src-est');
    var rec = _srcRec();
    if (!el) return false;
    if (_src.method === 'excerpt') {
        var okx = !!rec && _src.from >= 1 && _src.to >= _src.from && _src.to <= rec.pages.length;
        el.className = 'src-est' + (okx ? '' : ' is-bad');
        el.textContent = rec ? _srcT('exEst') : _srcT('exNeedBook');
        var gx = document.getElementById('src-gen'); if (gx) gx.disabled = !okx || _src.busy;
        return okx;
    }
    if (_srcIsAI()) {
        var ta = 1600;
        el.className = 'src-est';
        el.textContent = _srcT('estimate', { v0: ta.toLocaleString(), v1: SRC_OUT_TOKENS.toLocaleString(), v2: _srcCost(ta, SRC_OUT_EST).toFixed(2) });
        var g0 = document.getElementById('src-gen'); if (g0) g0.disabled = _src.busy;
        return true;
    }
    if (!rec) { el.textContent = ''; return false; }
    var from = _src.from, to = _src.to;
    var ok = from >= 1 && to >= from && to <= rec.pages.length;
    var text = ok ? _srcPagesText(rec, from, to) : '';
    var pages = ok ? (to - from + 1) : 0;
    var within = ok && pages <= SRC_MAX_PAGES && text.length <= SRC_MAX_CHARS;
    var tin = mbSrcTokens(text) + 900;
    el.className = 'src-est' + (within ? '' : ' is-bad');
    el.textContent = within
        ? _srcT('estimate', { v0: tin.toLocaleString(), v1: SRC_OUT_TOKENS.toLocaleString(), v2: _srcCost(tin, SRC_OUT_EST).toFixed(2) })
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

/** «Several sheets»: the total for the ticked rows, and the mapping. */
function _srcPaintBatchEstimate() {
    var el = document.getElementById('src-total');
    var ready = _src.rows.filter(_srcRowReady);
    if (_src.method === 'excerpt') {
        if (el) { el.className = 'src-est' + (ready.length ? '' : ' is-bad'); el.textContent = ready.length ? _srcT('exEst') : _srcT('needRows'); }
        var mex = document.getElementById('src-map-est'); if (mex) mex.textContent = _srcT('exEst');
        var mbx = document.getElementById('src-map'); if (mbx) mbx.disabled = _src.running || !_srcUsedRecs().length;
        var gx2 = document.getElementById('src-gen'); if (gx2) gx2.disabled = _src.running || !ready.length;
        return ready.length;
    }
    var tin = 0;
    ready.forEach(function (r) { tin += r.src === SRC_AI ? 1600 : mbSrcTokens(_srcPagesText(_srcRowRec(r), r.from, r.to)) + 1400; });
    if (el) {
        el.className = 'src-est' + (ready.length ? '' : ' is-bad');
        el.textContent = ready.length
            ? _srcT('totalEst', { v0: ready.length, v1: tin.toLocaleString(), v2: _srcCost(tin, SRC_OUT_EST * ready.length).toFixed(2) })
            : _srcT('needRows');
    }
    var me = document.getElementById('src-map-est');
    var recs = _srcUsedRecs();
    var mapRows = _src.rows.filter(function (r) { return r.on && r.status !== 'done' && r.topic.trim() && r.src !== SRC_AI; });
    if (me) {
        if (recs.length && mapRows.length) {
            var mt = mbSrcTokens(mbSrcMapPrompt(mapRows, recs, _srcContentLang()));
            me.textContent = _srcT('mapEst', { v0: mt.toLocaleString(), v1: _srcCost(mt, 60 * mapRows.length).toFixed(2) });
        } else me.textContent = '';
    }
    var mb = document.getElementById('src-map');
    if (mb) mb.disabled = _src.running || !recs.length || !mapRows.length;
    var gen = document.getElementById('src-gen');
    if (gen) gen.disabled = _src.running || !ready.length;
    return ready.length;
}
function _srcUsedRecs() {
    return _src.list.filter(function (r) { return _src.use.indexOf(r.id) !== -1; });
}

function _srcPaint() {
    var body = document.getElementById('src-body');
    var foot = document.getElementById('src-foot');
    if (!body || !_src) return;
    if (_src.draft) { _srcPaintDraft(body, foot); return; }
    var many = _src.mode === 'many';
    var rec = _srcRec();
    var items = _src.list.map(function (r) {
        var on = many ? _src.use.indexOf(r.id) !== -1 : r.id === _src.sel;
        return '<label class="src-item' + (on ? ' is-on' : '') + '">' +
            (many
              ? '<input type="checkbox" name="src-use" value="' + _srcEsc(r.id) + '"' + (on ? ' checked' : '') + '>'
              : '<input type="radio" name="src-pick" value="' + _srcEsc(r.id) + '"' + (on ? ' checked' : '') + '>') +
            '<span class="src-name" dir="auto">' + _srcEsc(r.name) + '</span>' +
            '<span class="src-meta">' + r.pages.length + ' ' + _srcEsc(_srcT('pages')) + (r.kind === 'pdf' ? ' · PDF' : '') + '</span>' +
            '<button type="button" class="src-del" data-src="del" data-id="' + _srcEsc(r.id) + '" title="' + _srcEsc(_srcT('del')) +
              '" aria-label="' + _srcEsc(_srcT('del') + ' — ' + r.name) + '">🗑</button>' +
        '</label>';
    }).join('');
    var ex = _src.method === 'excerpt';
    if (!many && !ex) {
        var aiOn = _srcIsAI();
        items = '<label class="src-item' + (aiOn ? ' is-on' : '') + '">' +
            '<input type="radio" name="src-pick" value="' + SRC_AI + '"' + (aiOn ? ' checked' : '') + '>' +
            '<span class="src-name">' + _srcEsc(_srcT('aiSource')) + '</span></label>' + items;
    }
    var html =
        '<div class="src-modes" role="tablist">' +
          '<button type="button" class="src-mode' + (many ? '' : ' is-on') + '" role="tab" aria-selected="' + !many + '" data-src="mode-one">' + _srcEsc(_srcT('modeOne')) + '</button>' +
          '<button type="button" class="src-mode' + (many ? ' is-on' : '') + '" role="tab" aria-selected="' + many + '" data-src="mode-many">' + _srcEsc(_srcT('modeMany')) + '</button>' +
        '</div>' +
        '<fieldset class="src-fs" id="src-fs"' + (_src.running ? ' disabled' : '') + '>' +
        ((ex && !many) ? '' : '<p class="ws-note ws-note-sm">ℹ️ ' + _srcEsc(_srcT(many ? 'batchNote' : 'intro')) + '</p>') +
        '<h4 class="ws-group">' + _srcEsc(_srcT(many ? 'useSources' : 'sources')) + '</h4>' +
        (items ? '<div class="src-list" role="' + (many ? 'group' : 'radiogroup') + '">' + items + '</div>' : '<p class="src-est">' + _srcEsc(_srcT('none')) + '</p>') +
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
          : '');
    html += '<h4 class="ws-group">' + _srcEsc(_srcT('methodTitle')) + '</h4>' +
        '<div class="src-list" role="radiogroup">' +
          ['ai', 'excerpt'].map(function (m) {
              var on = (_src.method === m);
              return '<label class="src-item' + (on ? ' is-on' : '') + '"><input type="radio" name="src-method" value="' + m + '"' + (on ? ' checked' : '') + '>' +
                  '<span class="src-name">' + _srcEsc(_srcT(m === 'ai' ? 'methodAi' : 'methodEx')) + '</span></label>';
          }).join('') +
        '</div>' +
        (ex ? '<p class="ws-note ws-note-sm">📖 ' + _srcEsc(_srcT('exNote')) + '</p>' : '');
    html += many ? _srcBatchHtml() : _srcOneHtml(rec);
    html += ex ? '' : '<div class="src-stack"><label for="src-country">' + _srcEsc(_srcT('country')) + '</label>' +
          '<input type="text" class="src-input" id="src-country" dir="auto" maxlength="120" value="' + _srcEsc(_src.country || '') +
          '" placeholder="' + _srcEsc(_srcT('countryPh')) + '"><span class="src-est" id="src-ctxline">' + _srcEsc(_srcCtxSummary()) + '</span></div>';
    html += ex ? '' : '<h4 class="ws-group"></h4><div class="ws-checks">' +
          ((many || (!_srcIsAI() && rec)) ? '<label class="ws-check"><input type="checkbox" id="src-mixed"' + (_src.mixed ? ' checked' : '') + '><span>' + _srcEsc(_srcT('mixed')) + '</span></label>' : '') +
          '<label class="ws-check"><input type="checkbox" id="src-self"' + (_src.selfCheck ? ' checked' : '') + '><span>' + _srcEsc(_srcT('optSelf')) + '</span></label>' +
          '<label class="ws-check"><input type="checkbox" id="src-cite"' + (_src.cite ? ' checked' : '') + '><span>' + _srcEsc(_srcT('optCite')) + '</span></label>' +
        '</div>';
    html += (many ? '<p class="src-est" id="src-total"></p><progress class="src-prog" id="src-prog" max="1" value="0"' + (_src.running ? '' : ' hidden') + '></progress>' : '') +
        '<p class="src-est">🔒 ' + _srcEsc(_srcT('privacy')) + '</p>' +
        '<p class="src-est">©️ ' + _srcEsc(_srcT('copyNote')) + '</p>' +
        '</fieldset>';
    body.innerHTML = html;
    foot.innerHTML =
        '<button type="button" class="ws-btn ws-btn-ghost" data-src="close">' + _srcEsc(_srcT('close')) + '</button>' +
        (many && _src.running ? '<button type="button" class="ws-btn ws-btn-ghost" data-src="stop">' + _srcEsc(_srcT('stop')) + '</button>' : '') +
        '<button type="button" class="ws-btn ws-btn-primary" id="src-gen" data-src="' + (many ? 'gen-many' : 'gen') + '">' +
          _srcEsc(_srcT(ex ? 'exGen' : many ? 'genMany' : 'generate')) + '</button>';
    if (many) _srcPaintBatchEstimate();
    else if (rec || _srcIsAI()) _srcPaintEstimate();
    else document.getElementById('src-gen').disabled = true;
}

function _srcOneHtml(rec) {
    var n = rec ? rec.pages.length : 0;
    if (_srcIsAI()) rec = null;
    return (_srcIsAI() ? '<p class="src-warn">⚠️ ' + _srcEsc(_srcT('aiNote')) + '</p><p class="src-est" id="src-est"></p>' : '') +
        (rec
          ? '<div class="src-stack"><label for="src-ref">' + _srcEsc(_srcT('ref')) + '</label>' +
              '<input type="text" class="src-input" id="src-ref" data-ref="' + _srcEsc(rec.id) + '" dir="auto" maxlength="400" value="' + _srcEsc(rec.ref || '') +
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
          '" placeholder="' + _srcEsc(_srcT('topicPh')) + '"></div>';
}

function _srcBatchHtml() {
    var recs = _srcUsedRecs();
    var refs = recs.map(function (r) {
        return '<div class="src-refrow"><span class="src-name" dir="auto">' + _srcEsc(r.name) + '</span>' +
            '<input type="text" class="src-input" data-ref="' + _srcEsc(r.id) + '" dir="auto" maxlength="400" value="' + _srcEsc(r.ref || '') +
            '" placeholder="' + _srcEsc(_srcT('refPh')) + '" aria-label="' + _srcEsc(_srcT('ref') + ' — ' + r.name) + '"></div>';
    }).join('');
    var scanned = recs.filter(_srcLooksScanned).map(function (r) { return r.name; });
    var opts = function (cur) {
        return '<option value="">' + _srcEsc(_srcT('none2')) + '</option>' +
            (_src.method === 'excerpt' ? '' : '<option value="' + SRC_AI + '"' + (cur === SRC_AI ? ' selected' : '') + '>' + _srcEsc(_srcT('aiOpt')) + '</option>') + recs.map(function (r) {
            return '<option value="' + _srcEsc(r.id) + '"' + (r.id === cur ? ' selected' : '') + '>' + _srcEsc(r.name) + '</option>';
        }).join('');
    };
    var stTxt = { done: 'stDone', err: 'stErr', run: 'stRun' };
    var rows = _src.rows.map(function (r, i) {
        var rec = _srcRowRec(r);
        var n = rec ? rec.pages.length : 0;
        return '<div class="src-row' + (r.status === 'done' ? ' is-done' : r.status === 'err' ? ' is-err' : r.status === 'run' ? ' is-run' : '') + '" data-row="' + i + '">' +
            '<input type="checkbox" data-rf="on" data-i="' + i + '"' + (r.on ? ' checked' : '') + ' aria-label="' + _srcEsc(r.num + ' ' + r.topic) + '">' +
            '<div class="src-row-head"><span class="src-tag">' + _srcEsc(/^\d/.test(r.loNo) ? _srcT('outcome', { v0: r.loNo }) : r.loNo) + ' · ' + _srcEsc(r.num) + '</span>' +
              (stTxt[r.status] ? '<span class="src-st st-' + r.status + '">' + _srcEsc(_srcT(stTxt[r.status])) + '</span>' : '') + '</div>' +
            '<div class="src-row-body">' +
              '<input type="text" class="src-input" data-rf="topic" data-i="' + i + '" dir="auto" maxlength="300" value="' + _srcEsc(r.topic) +
                '" placeholder="' + _srcEsc(_srcT('noTitle')) + '" aria-label="' + _srcEsc(_srcT('topic')) + '">' +
              '<select class="src-sel" data-rf="src" data-i="' + i + '" aria-label="' + _srcEsc(_srcT('sources')) + '">' + opts(r.src) + '</select>' +
              (r.src === SRC_AI ? '' :
              '<span class="src-meta">' + _srcEsc(_srcT('pagesShort')) + '</span>' +
              '<input type="number" class="src-num" data-rf="from" data-i="' + i + '" min="1" max="' + n + '" value="' + (r.from || '') + '" aria-label="' + _srcEsc(_srcT('from')) + '">' +
              '<span class="src-meta">–</span>' +
              '<input type="number" class="src-num" data-rf="to" data-i="' + i + '" min="1" max="' + n + '" value="' + (r.to || '') + '" aria-label="' + _srcEsc(_srcT('to')) + '">') +
            '</div>' +
        '</div>';
    }).join('');
    return (refs ? '<div class="src-refs"><span class="src-est">' + _srcEsc(_srcT('ref')) + '</span>' + refs + '</div>' : '') +
        (scanned.length ? '<p class="src-warn">⚠️ ' + _srcEsc(scanned.join('، ')) + ' — ' + _srcEsc(_srcT('scanned')) + '</p>' : '') +
        '<h4 class="ws-group">' + _srcEsc(_srcT('scope')) + '</h4>' +
        '<div class="src-range">' +
          '<select class="src-sel" id="src-scope" style="width:auto">' +
            '<option value="lo"' + (_src.scope !== 'all' ? ' selected' : '') + '>' + _srcEsc(_srcT('scopeLo')) + '</option>' +
            '<option value="all"' + (_src.scope === 'all' ? ' selected' : '') + '>' + _srcEsc(_srcT('scopeAll')) + '</option>' +
          '</select>' +
          '<button type="button" class="src-btn" id="src-map" data-src="map">' + _srcEsc(_srcT('mapBtn')) + '</button>' +
          '<span class="src-est" id="src-map-est"></span>' +
        '</div>' +
        '<p class="src-est">' + _srcEsc(_srcT('mapNote')) + '</p>' +
        (_src.rows.length ? '<div class="src-rows">' + rows + '</div>' : '<p class="src-warn">' + _srcEsc(_srcT('noSheets')) + '</p>');
}

function _srcPaintDraft(body, foot) {
    var d = _src.draft, rec = _srcRec(), lang = _srcContentLang();
    var part = function (id, title, text, extra) {
        return '<div class="src-part"><label><input type="checkbox" data-part="' + id + '" checked>' +
               '<span dir="auto">' + _srcEsc(title) + '</span></label>' +
               (text ? '<div class="src-part-text" dir="auto">' + _srcEsc(text) + '</div>' : '') + (extra || '') + '</div>';
    };
    var heads = {};
    (_src.draftCtx ? _src.draftCtx.headings : []).forEach(function (h) { heads[h.ref] = h.text; });
    var html = '<h4 class="ws-group">' + _srcEsc(_srcT('result')) + '</h4>';
    if (d.mode === 'ai') html += '<div class="src-gap">⚠️ ' + _srcEsc(_srcT('aiNote')) + '</div>';
    if (d.mode === 'excerpt') html += '<div class="src-gap">📖 ' + _srcEsc(_srcT('exNote')) + '</div>';
    if (d.notCovered) html += '<div class="src-gap" dir="auto">⚠️ ' + _srcEsc(_srcT('notCovered')) + ': ' + _srcEsc(d.notCovered) + '</div>';
    if (d.toVerify) html += '<div class="src-gap" dir="auto">🔎 ' + _srcEsc(_srcT('toVerify')) + ':\n' + _srcEsc(d.toVerify) + '</div>';
    if (d.objective) html += part('objective', '🎯 ' + _srcT('objective'), d.objective);
    d.sections.forEach(function (s, i) {
        var cite = d.mode === 'excerpt' ? (_SRC_EXCERPT[lang] || _SRC_EXCERPT.en).replace('{s}', rec ? rec.name : '').replace('{p}', mbSrcPageList(s.pages, lang))
            : s.origin === 'general' ? (d.mode === 'ai' ? '🧠 ' + _srcT('generalTag') : (_SRC_GENERAL[lang] || _SRC_GENERAL.en))
            : (_src.cite ? mbSrcCiteLine(rec ? rec.name : '', s.pages, lang) : '');
        html += part('s' + i, s.heading || heads[s.ref] || '—', s.text, cite ? '<div class="src-part-cite" dir="auto">' + _srcEsc(cite) + '</div>' : '');
    });
    if (d.selfCheck) html += part('selfCheck', '✅ ' + _srcT('selfCheck') + ' + ' + _srcT('answers'), d.selfCheck + (d.answerKey ? '\n\n— ' + _srcT('answers') + ' —\n' + d.answerKey : ''));
    body.innerHTML = html;
    foot.innerHTML =
        '<button type="button" class="ws-btn ws-btn-ghost" data-src="back">' + _srcEsc(_srcT('back')) + '</button>' +
        '<button type="button" class="ws-btn ws-btn-primary" data-src="keep">' + _srcEsc(_srcT('keep')) + '</button>';
}

function _srcOnInput(e) {
    if (!_src) return;
    var t = e.target, id = t.id;
    if (id === 'src-topic') { _src.topic = t.value; return; }
    if (id === 'src-from' || id === 'src-to') {
        var v = parseInt(t.value, 10);
        if (!isFinite(v)) return;
        if (id === 'src-from') _src.from = v; else _src.to = v;
        _srcPaintEstimate();
        return;
    }
    var rf = t.getAttribute && t.getAttribute('data-rf');
    if (rf === 'topic' || rf === 'from' || rf === 'to') {
        var r = _src.rows[+t.getAttribute('data-i')];
        if (!r) return;
        if (rf === 'topic') r.topic = t.value;
        else r[rf] = parseInt(t.value, 10) || 0;
        _srcJobSave();
        _srcPaintBatchEstimate();
    }
}

function _srcOnChange(e) {
    if (!_src) return;
    var t = e.target;
    if (t.name === 'src-pick') { _srcSelect(t.value); return; }
    if (t.name === 'src-use') {
        if (t.checked) { if (_src.use.indexOf(t.value) === -1) _src.use.push(t.value); }
        else _src.use = _src.use.filter(function (x) { return x !== t.value; });
        _srcJobSave(); _srcPaint(); return;
    }
    if (t.id === 'src-self') { _src.selfCheck = !!t.checked; return; }
    if (t.id === 'src-cite') { _src.cite = !!t.checked; return; }
    if (t.id === 'src-scope') { _src.scope = t.value === 'all' ? 'all' : 'lo'; _srcJobSave(); _src.rows = _srcDefaultRows(mbSrcBuildRows(_src.scope)); _srcPaint(); return; }
    if (t.id === 'src-mixed') { _src.mixed = !!t.checked; return; }
    if (t.name === 'src-method') {
        _src.method = t.value === 'excerpt' ? 'excerpt' : 'ai';
        if (_src.method === 'excerpt') {
            /* Excerpts need a book: leave «no source», and search the
               whole book by default (no page limit, nothing is sent). */
            if (_srcIsAI() && _src.list.length) _src.sel = _src.list[_src.list.length - 1].id;
            var rx = _srcRec(); if (rx) { _src.from = 1; _src.to = rx.pages.length; }
        } else {
            var ra = _srcRec(); if (ra && (_src.to - _src.from + 1) > SRC_MAX_PAGES) _src.to = _src.from + SRC_MAX_PAGES - 1;
        }
        _srcPaint(); _srcMsg('');
        return;
    }
    if (t.id === 'src-country') {
        /* Kept on the module, like DACUM's own value it overrides. */
        _src.country = t.value.trim();
        var mod = _srcModule();
        if (mod) { mod.srcCountry = _src.country; if (typeof mbLibrarySave === 'function') { try { mbLibrarySave(); } catch (err) { /* autosave absent */ } } }
        var cl = document.getElementById('src-ctxline'); if (cl) cl.textContent = _srcCtxSummary();
        return;
    }
    var refId = t.getAttribute && t.getAttribute('data-ref');
    if (refId) {
        var rec = _src.list.find(function (x) { return x.id === refId; });
        if (rec) { rec.ref = t.value.trim() || rec.name; mbSources.put(rec).catch(function () {}); }
        return;
    }
    var rf = t.getAttribute && t.getAttribute('data-rf');
    if (rf === 'on' || rf === 'src') {
        var r = _src.rows[+t.getAttribute('data-i')];
        if (!r) return;
        if (rf === 'on') { r.on = !!t.checked; if (r.on && r.status === 'done') r.status = 'wait'; }
        else {
            var wasAI = r.src === SRC_AI;
            r.src = t.value;
            var rr = _srcRowRec(r);
            if (rr && !r.from) { r.from = 1; r.to = Math.min(rr.pages.length, 15); _srcPaint(); }
            else if (wasAI !== (r.src === SRC_AI)) _srcPaint();
        }
        _srcJobSave();
        _srcPaintBatchEstimate();
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
        if (_src.use.indexOf(rec.id) === -1) _src.use.push(rec.id);
        _srcSelect(rec.id);
        _srcMsg(_srcT('added', { v0: rec.name, v1: rec.pages.length }), 'ok');
    } catch (err) {
        var k = err && err.message;
        _srcMsg(_srcT(k === 'badFile' || k === 'noText' ? k : 'noText'), 'error');
    } finally {
        if (_src) { _src.busy = false; if (_src.mode === 'one') _srcPaintEstimate(); }
    }
}

async function _srcOnClick(e) {
    if (!_src) return;
    var ov = document.getElementById('src-overlay');
    if (e.target.id === 'src-x') { mbSrcClose(); return; }
    /* The backdrop closes only when nothing would be lost: not while
       the AI is writing, not over a draft that has not been added. */
    if (e.target === ov) { if (!_src.busy && !_src.running && !_src.draft) mbSrcClose(); return; }
    var b = e.target.closest && e.target.closest('[data-src]');
    if (!b) return;
    var act = b.getAttribute('data-src');
    if (act === 'close') { mbSrcClose(); return; }
    if (act === 'mode-one' || act === 'mode-many') {
        if (_src.running) return;
        _src.mode = act === 'mode-many' ? 'many' : 'one';
        if (_src.mode === 'many') _src.rows = _srcDefaultRows(mbSrcBuildRows(_src.scope));
        _srcPaint(); _srcMsg(''); return;
    }
    if (act === 'file') { document.getElementById('src-file').click(); return; }
    if (act === 'paste') { _src.paste = !_src.paste; _srcPaint(); return; }
    if (act === 'paste-add') {
        var name = document.getElementById('src-paste-name').value;
        var text = document.getElementById('src-paste-text').value;
        try {
            var rec = await mbSrcAddText(name, text);
            _src.list.push(rec);
            if (_src.use.indexOf(rec.id) === -1) _src.use.push(rec.id);
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
        _src.use = _src.use.filter(function (x) { return x !== id; });
        _src.rows.forEach(function (row) { if (row.src === id) { row.src = ''; row.from = 0; row.to = 0; } });
        if (_src.sel === id) { _src.sel = null; if (_src.list.length) _srcSelect(_src.list[0].id, true); }
        _srcJobSave();
        _srcPaint();
        return;
    }
    if (act === 'gen') { if (_src.method === 'excerpt') _srcExtractOne(); else _srcGenerate(); return; }
    if (act === 'map') { if (_src.method === 'excerpt') _srcMapLocal(); else _srcMap(); return; }
    if (act === 'gen-many') { _srcRunMany(); return; }
    if (act === 'stop') { _src.stop = true; if (_srcAbort) _srcAbort.abort(); return; }
    if (act === 'back') { _src.draft = null; _srcPaint(); _srcMsg(''); return; }
    if (act === 'keep') {
        var pick = { sections: {}, objective: false, selfCheck: false, cite: _src.cite, topic: _src.topic.trim() };
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

/* «This sheet» */
async function _srcGenerate() {
    var rec = _srcRec();
    var ai = _srcIsAI();
    if (!rec && !ai) { _srcMsg(_srcT('needSource'), 'error'); return; }
    var mode = ai ? 'ai' : (_src.mixed ? 'mixed' : 'book');
    var topic = (_src.topic || '').trim();
    if (!topic) { _srcMsg(_srcT('needTopic'), 'error'); var tp = document.getElementById('src-topic'); if (tp) tp.focus(); return; }
    if (!_srcPaintEstimate()) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { _srcMsg(_srcT('offline'), 'error'); return; }
    var lang = _srcContentLang();
    var lo = mbCurrentLOObject();
    var ctx = mbSrcSheetContext(lo, (lo.infoSheets || [])[mbState.currentInfoSheetIndex], lang);
    var prompt = mbSrcPrompt({
        lang: lang, topic: topic, lo: ctx.lo, criteria: ctx.criteria, headings: ctx.headings, mode: mode,
        ctx: mbSrcProgramContext(lang),
        source: rec ? (rec.ref || rec.name) : '', pagesText: rec ? _srcPagesText(rec, _src.from, _src.to) : '', selfCheck: _src.selfCheck
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
        var draft = mbSrcNormalise(await _srcCallAI(prompt), rec ? rec.pages.length : 0, mode);
        if (!_src) return;
        if (!draft.sections.length && !draft.objective) throw new Error('badReply');
        _src.draft = draft;
        _src.draftCtx = ctx;
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

/* «This sheet», 📖: the draft from the book, on this device. */
function _srcExtractOne() {
    var rec = _srcRec();
    if (!rec) { _srcMsg(_srcT('exNeedBook'), 'error'); return; }
    var topic = (_src.topic || '').trim();
    if (!topic) { _srcMsg(_srcT('needTopic'), 'error'); var tp = document.getElementById('src-topic'); if (tp) tp.focus(); return; }
    if (!_srcPaintEstimate()) return;
    var lang = _srcContentLang();
    var lo = mbCurrentLOObject();
    var ctx = mbSrcSheetContext(lo, (lo.infoSheets || [])[mbState.currentInfoSheetIndex], lang);
    var draft = mbSrcExcerpts(rec, _src.from, _src.to, ctx, topic);
    if (!draft.sections.length) { _srcMsg(_srcT('exNone'), 'error'); return; }
    _src.draft = draft;
    _src.draftCtx = ctx;
    _srcPaint();
    _srcMsg('');
}

/* «Several sheets», 📖: 🔎 pages found on this device. */
function _srcMapLocal() {
    var recs = _srcUsedRecs();
    var idx = [];
    _src.rows.forEach(function (r, i) { if (r.on && r.status !== 'done' && r.topic.trim()) idx.push(i); });
    if (!recs.length || !idx.length) return;
    var rows = idx.map(function (i) { return _src.rows[i]; });
    var m = mbSrcMapLocal(rows, recs);
    var n = 0;
    Object.keys(m).forEach(function (k) { var r = rows[+k]; r.src = m[k].src; r.from = m[k].from; r.to = m[k].to; n++; });
    _srcJobSave();
    _srcPaint();
    _srcMsg(_srcT('exMapDone', { v0: n, v1: rows.length }), n ? 'ok' : 'error');
}

/* «Several sheets»: 🔎 the pages of each ticked sheet. */
async function _srcMap() {
    var recs = _srcUsedRecs();
    var idx = [];
    _src.rows.forEach(function (r, i) { if (r.on && r.status !== 'done' && r.topic.trim() && r.src !== SRC_AI) idx.push(i); });
    if (!recs.length || !idx.length) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { _srcMsg(_srcT('offline'), 'error'); return; }
    var rows = idx.map(function (i) { return _src.rows[i]; });
    _src.running = true;
    _srcPaint();
    _srcMsg(_srcT('mapping'));
    try {
        var m = mbSrcNormaliseMap(await _srcCallAI(mbSrcMapPrompt(rows, recs, _srcContentLang())), rows.length, recs);
        if (!_src) return;
        var n = 0;
        Object.keys(m).forEach(function (k) { var r = rows[+k]; r.src = m[k].src; r.from = m[k].from; r.to = m[k].to; n++; });
        _src.running = false;
        _srcJobSave();
        _srcPaint();
        _srcMsg(_srcT('mapDone', { v0: n, v1: rows.length }), 'ok');
    } catch (err) {
        if (!_src) return;
        _src.running = false;
        _srcPaint();
        var k = err && err.message;
        _srcMsg(k === 'aborted' ? '' : _srcT(k === 'rate' || k === 'badReply' ? k : 'failed'), 'error');
    }
}

/* «Several sheets»: ✨ one sheet after another. A stop, a closed dialog,
   a busy or unreachable service ends the run; the rows left keep their
   pages and the next Generate goes on from there. */
async function _srcRunMany() {
    var queue = _src.rows.filter(_srcRowReady);
    if (!queue.length) { _srcMsg(_srcT('needRows'), 'error'); return; }
    if (_src.method !== 'excerpt' && typeof navigator !== 'undefined' && navigator.onLine === false) { _srcMsg(_srcT('offline'), 'error'); return; }
    if (typeof saveCurrentSheetToLO === 'function') saveCurrentSheetToLO();
    var S = _src, lang = _srcContentLang();
    S.running = true; S.stop = false;
    _srcPaint();
    var prog = function (i) { var p = document.getElementById('src-prog'); if (p) { p.hidden = false; p.max = queue.length; p.value = i; } };
    var done = 0, failed = 0, halted = null;
    for (var i = 0; i < queue.length; i++) {
        if (S.stop || _src !== S) { halted = 'stopped'; break; }
        var r = queue[i];
        var found = _srcRowSheet(r);
        var rec = _srcRowRec(r);
        var rowAI = r.src === SRC_AI;
        if (!found || (!rec && !rowAI)) { r.status = 'err'; failed++; continue; }
        if (S.method === 'excerpt') {
            /* 📖 on this device: no request, nothing to wait for. */
            var exd = mbSrcExcerpts(rec, r.from, r.to, mbSrcSheetContext(found.lo, found.sh, lang), r.topic.trim());
            if (!exd.sections.length) { r.status = 'err'; failed++; _srcJobSave(); continue; }
            _srcWriteSheet(found.sh, exd, { cite: true, topic: r.topic.trim() }, rec, lang);
            _srcAfterWrite();
            r.status = 'done'; r.on = false; done++;
            _srcJobSave();
            continue;
        }
        var rowMode = rowAI ? 'ai' : (S.mixed ? 'mixed' : 'book');
        r.status = 'run';
        _srcPaint(); prog(i);
        _srcMsg(_srcT('progress', { v0: i + 1, v1: queue.length, v2: r.topic }));
        var ctx = mbSrcSheetContext(found.lo, found.sh, lang);
        try {
            var draft = mbSrcNormalise(await _srcCallAI(mbSrcPrompt({
                lang: lang, topic: r.topic.trim(), lo: ctx.lo, criteria: ctx.criteria, headings: ctx.headings,
                mode: rowMode, ctx: mbSrcProgramContext(lang),
                source: rec ? (rec.ref || rec.name) : '', pagesText: rec ? _srcPagesText(rec, r.from, r.to) : '', selfCheck: S.selfCheck
            })), rec ? rec.pages.length : 0, rowMode);
            found = _srcRowSheet(r) || found;
            _srcWriteSheet(found.sh, draft, { objective: true, selfCheck: S.selfCheck, cite: S.cite, topic: r.topic.trim() }, rec, lang);
            _srcAfterWrite();
            r.status = 'done'; r.on = false; done++;
        } catch (err) {
            var k = err && err.message;
            if (k === 'aborted') { r.status = 'wait'; halted = 'stopped'; break; }
            r.status = 'err'; failed++;
            if (k === 'rate' || k === 'failed') { halted = k; break; }
        }
        _srcJobSave();
    }
    if (_src !== S) { S.running = false; return; }
    S.running = false;
    _srcJobSave();
    _srcPaint(); prog(done);
    var msg = halted === 'stopped' ? _srcT('stopped')
        : halted ? _srcT(halted) + ' ' + _srcT('stopped')
        : _srcT('doneMany', { v0: done }) + (failed ? ' ' + _srcT('failedSome', { v0: failed }) : '');
    _srcMsg(msg, halted || failed ? 'error' : 'ok');
    if (!halted && typeof showStatus === 'function') showStatus(_srcT('doneMany', { v0: done }), failed ? 'info' : 'success');
}
