// ============================================================
// /src/learner_guide.js
// The «Learner Guide» template (3.59.0) — module_template.js
//
// WHAT THE TEMPLATE IS
// A module written as a learner's guide: each learning outcome is a
// LEARNING UNIT numbered as one sequence —
//     1- Learning unit: <outcome>
//        1-1 Introduction          (lo.lgIntro)
//        1-2 Knowledge: …          (information sheets)
//        1-3 Learning activity: …  (activity sheets, type 'activity')
//        1-4 Worksheet: …          (activity sheets, type 'job')
//        1-5 Reflection            (lo.lgReflection)
// then the Glossary, then an ASSESSMENT UNIT: an introduction, the
// portfolio of evidence, the table of the portfolio's contents (derived
// from the sheets, never typed) and the assessment table of each
// outcome (the existing assessment forms).
//
// WHAT IT LEAVES OUT
// Self-check and answer key, the training resources table, the
// performance criteria checklist and the Learning Guide table. Their
// data stays in the project (the template can be switched back); the
// interface hides them (data-tpl-only) and the exporters skip them.
//
// WHERE THINGS ARE STORED
//   lo.lgIntro       { body: pair, items: pair }      items: one per line
//   lo.lgIncludes    { intro, knowledge, activities, reflection: pair, items: pair }
//                      «Each learning unit includes the following:» — absent until the
//                      author edits the card, then the four paragraphs are the tool's
//                      texts seeded in every language. Printed with the introduction, on
//                      the same page, always (the tool's texts when never edited) (3.79.0)
//   lo.lgReflection  { title: pair, questions: pair, lines: n, contributes: 'yes'|'no'|'' }
//   activity.lgContributes   '' (default: yes) | 'yes' | 'no'
//   activity.lgProduct       pair — '' = the default for its type
//   mbState.lgAsm    { intro: pair|null, portfolio: pair|null }
//                    null = the tool's own text, in the export language
//
// ORDER AND NUMBERS come from lo_sequence.js, which this template turns
// to «interleaved» and «one number sequence», and which lists lgIntro
// and lgReflection in their places.
// ============================================================

if (window.i18n && window.i18n.extend) window.i18n.extend({
    en: {
        lgUnitCard: 'Learning unit (Learner guide)',
        lgReflTab: '🪞 Reflection',
        lgProceedToReflection: 'Proceed to Reflection →',
        lgReflCard: 'Reflection — closes the learning unit',
        lgReflNote: 'For the learning unit chosen in the bar above. Empty parts are not exported.',
        lgReflNoUnit: 'Choose a learning unit in the bar above to write its reflection.',
        lgReflMore: '➕ Add more questions',
        lgClear: 'Clear', lgClearTip: 'Empty this box (Undo brings it back)',
        lgReflMoreHead: 'More questions {v0}',
        lgReflMoreTitlePh: 'Subheading of these questions (optional)…',
        lgReflMoreRemove: 'Remove these questions',
        lgIntroTitle: 'Introduction',
        lgIntroBodyPh: 'Introduce the subject of this learning unit…',
        lgIntroItemsLabel: 'The learning outcomes for this guide are:',
        lgIntroItemsPh: 'One item per line…',
        lgNumber: 'Numbering', lgNumberTip: 'Number the lines (1-, 2-, 3-) — click again to remove the numbers',
        lgIncCard: 'Each learning unit includes the following:',
        lgIncRestore: 'Restore the default text',
        lgIncItemsPh: 'Anything else the learning unit includes…',
        lgIncIntroLbl: 'Introduction:', lgIncIntroTxt: 'Introducing the subject',
        lgIncKnowLbl: 'Knowledge:', lgIncKnowTxt: 'Things you need to know',
        lgIncActLbl: 'Learning Activities:', lgIncActTxt: 'Things to do',
        lgIncReflLbl: 'Reflection:', lgIncReflTxt: 'To reflect on what you have learned',
        lgReflTitle: 'Reflection',
        lgReflTitlePh: 'Reflection on learning unit {v0}',
        lgReflQuestionsLabel: 'Reflection questions (one per line)',
        lgReflQuestionsPh: 'What was the most difficult part of this unit for you, and why?',
        lgReflLines: 'Answer lines per question',
        lgReflContributes: 'The reflection contributes to the assessment',
        lgActRowTitle: 'Portfolio of evidence',
        lgContributes: 'Contributes to the assessment?',
        lgContributesDefault: 'Default (yes)',
        lgpYes: 'Yes',
        lgpNo: 'No',
        lgProduct: 'Learner product:',
        lgAsmCard: 'Assessment unit (Learner guide)',
        lgAsmNote: 'The tool writes these texts; edit them freely. The table of the portfolio’s contents is built from the sheets, and each outcome’s assessment table from its assessment form below.',
        lgAsmIntro: 'Introduction',
        lgAsmPortfolio: 'Portfolio of evidence',
        lgAsmRestore: 'Restore the default text',
        lgAsmContents: 'Contents of the portfolio',
        lgAsmContentsEmpty: 'No learning activity, worksheet or reflection has a title yet.',
        lgUnitHead: '{v0}- Learning unit: {v1}',
        lgUnit: 'Learning unit',
        mbInfoObjectiveLabel: 'Objective:',
        lgObjectives: 'Objectives',
        lgOptional: 'optional',
        lgObjShowTip: 'Add objectives to this knowledge sheet (optional)',
        lgObjHide: 'Remove the objectives from this sheet',
        lgActObjShowTip: 'Add objectives to this sheet (optional)',
        lgSelectUnit: '-- Select learning unit --',
        lgIntroHead: '{v0} Introduction',
        lgYouWillLearn: 'The learning outcomes for this guide are:',
        lgKnowledge: 'Knowledge',
        lgActivity: 'Learning activity',
        lgWorksheet: 'Worksheet',
        lgReflDefault: 'Reflection on learning unit {v0}',
        lgGlossary: 'Glossary',
        lgGlossaryTerm: 'Term',
        lgGlossaryDesc: 'Description',
        lgAsmUnitHead: '{v0}- Assessment unit',
        lgAsmIntroHead: '{v0}-1 Introduction',
        lgAsmPortfolioHead: '{v0}-2 Portfolio of evidence',
        lgAsmContentsHead: '{v0}-3 Contents of the portfolio',
        lgAsmTablesHead: '{v0}-4 Assessment tables for the unit {v1}',
        lgAsmTablesLead: 'Your teacher will keep records of your achievements and will also fill in and sign the tables below, and you will sign them too. The tables are then your record of your results while studying this unit. You must meet all the assessment criteria and achieve all the learning outcomes to be «competent» in this unit.',
        lgColActivity: 'Learning activities',
        lgColCriteria: 'Assessment criteria',
        lgColActNum: 'Name and number of the learning activity',
        lgColOutput: 'Output',
        lgColDate: 'Completion date',
        lgColProduct: 'Learner products',
        lgColContributes: 'Contributes to the assessment?',
        lgProdObservation: 'Direct observation',
        lgProdWorksheet: 'Worksheet',
        lgAsmOutcomeHead: 'Learning outcome {v0}: {v1}',
        lgDefaultAsmIntro: 'The assessment of this unit is based on the assessment of your portfolio of evidence. The portfolio assessment is based on the learning activities you completed during the unit. All worksheets from the learning activities, together with any other evidence of your work (such as photos, drawings and notes), must be submitted to your teacher as a portfolio for assessment. If you wrote any of your answers in this learner guide, write your name on its front cover and put it in the portfolio too. Your teacher will return your portfolio to you.\n\nTo complete this unit successfully, you must achieve all the learning outcomes and meet all the assessment criteria of the unit. The learning outcomes and assessment criteria are shown in the assessment tables below.\n\nOnce you have finished the unit and have had the opportunity to meet all the assessment criteria, the teacher will confirm whether you meet all the criteria, or whether there are one or more criteria you do not yet meet.\n\nIf you meet all the assessment criteria, you and the teacher will sign below the table to acknowledge that you have achieved the learning outcomes (that is, you are competent in them). These tables are then your record of your results while studying this unit.\n\nIf you need more assessment attempts to meet certain criteria, you will need to agree a time and place for another assessment with your teacher. In exceptional circumstances a third assessment attempt will be provided.',
        lgDefaultAsmPortfolio: 'As you progress through the unit and complete the learning activities, you will build up a collection of completed activities. This portfolio may include your learner guide if you wrote your answers in it.\n\nYour portfolio will be a useful resource for you as you develop your professional practice and reflect on your progress. The contents of your portfolio must match the activities and products listed in the table below. These learning activities are designed to help you learn the knowledge and skills needed to complete the unit’s assessments; some of them do not contribute to the assessment of the unit, but completing them is still important and they must be included in your portfolio.\n\nYour portfolio will be available to your teacher, who will use it as the basis for assessing and discussing your progress through the unit and what you need to do to achieve its learning outcomes.'
    },
    fr: {
        lgUnitCard: 'Unité d’apprentissage (Guide de l’apprenant)',
        lgReflTab: '🪞 Réflexion',
        lgProceedToReflection: 'Passer à la réflexion →',
        lgReflCard: 'Réflexion — termine l’unité d’apprentissage',
        lgReflNote: 'Pour l’unité d’apprentissage choisie dans la barre ci-dessus. Les parties vides ne sont pas exportées.',
        lgReflNoUnit: 'Choisissez une unité d’apprentissage dans la barre ci-dessus pour rédiger sa réflexion.',
        lgReflMore: '➕ Ajouter d’autres questions',
        lgClear: 'Vider', lgClearTip: 'Vider ce cadre (Annuler le rétablit)',
        lgReflMoreHead: 'Autres questions {v0}',
        lgReflMoreTitlePh: 'Sous-titre de ces questions (facultatif)…',
        lgReflMoreRemove: 'Supprimer ces questions',
        lgIntroTitle: 'Introduction',
        lgIntroBodyPh: 'Présentez le sujet de cette unité d’apprentissage…',
        lgIntroItemsLabel: 'Les résultats d’apprentissage de ce guide sont :',
        lgIntroItemsPh: 'Un élément par ligne…',
        lgNumber: 'Numérotation', lgNumberTip: 'Numéroter les lignes (1-, 2-, 3-) — cliquer de nouveau pour retirer les numéros',
        lgIncCard: 'Chaque unité d’apprentissage comprend les éléments suivants :',
        lgIncRestore: 'Rétablir le texte par défaut',
        lgIncItemsPh: 'Tout autre élément de l’unité d’apprentissage…',
        lgIncIntroLbl: 'Introduction :', lgIncIntroTxt: 'Présentation du sujet',
        lgIncKnowLbl: 'Connaissances :', lgIncKnowTxt: 'Ce que vous devez savoir',
        lgIncActLbl: 'Activités d’apprentissage :', lgIncActTxt: 'Ce que vous devez faire',
        lgIncReflLbl: 'Réflexion :', lgIncReflTxt: 'Pour réfléchir à ce que vous avez appris',
        lgReflTitle: 'Réflexion',
        lgReflTitlePh: 'Réflexion sur l’unité d’apprentissage {v0}',
        lgReflQuestionsLabel: 'Questions de réflexion (une par ligne)',
        lgReflQuestionsPh: 'Quelle a été la partie la plus difficile de cette unité pour vous, et pourquoi ?',
        lgReflLines: 'Lignes de réponse par question',
        lgReflContributes: 'La réflexion contribue à l’évaluation',
        lgActRowTitle: 'Portfolio de preuves',
        lgContributes: 'Contribue à l’évaluation ?',
        lgContributesDefault: 'Par défaut (oui)',
        lgpYes: 'Oui',
        lgpNo: 'Non',
        lgProduct: 'Production de l’apprenant :',
        lgAsmCard: 'Unité d’évaluation (Guide de l’apprenant)',
        lgAsmNote: 'L’outil rédige ces textes ; modifiez-les librement. Le tableau du contenu du portfolio est construit à partir des fiches, et le tableau d’évaluation de chaque résultat à partir de son formulaire ci-dessous.',
        lgAsmIntro: 'Introduction',
        lgAsmPortfolio: 'Portfolio de preuves',
        lgAsmRestore: 'Rétablir le texte par défaut',
        lgAsmContents: 'Contenu du portfolio',
        lgAsmContentsEmpty: 'Aucune activité, fiche de travail ou réflexion n’a encore de titre.',
        lgUnitHead: '{v0}- Unité d’apprentissage : {v1}',
        lgUnit: 'Unité d’apprentissage',
        mbInfoObjectiveLabel: 'Objectif :',
        lgObjectives: 'Objectifs',
        lgOptional: 'facultatif',
        lgObjShowTip: 'Ajouter des objectifs à cette fiche de connaissances (facultatif)',
        lgObjHide: 'Retirer les objectifs de cette fiche',
        lgActObjShowTip: 'Ajouter des objectifs à cette fiche (facultatif)',
        lgSelectUnit: '-- Choisir une unité d’apprentissage --',
        lgIntroHead: '{v0} Introduction',
        lgYouWillLearn: 'Les résultats d’apprentissage de ce guide sont :',
        lgKnowledge: 'Connaissances',
        lgActivity: 'Activité d’apprentissage',
        lgWorksheet: 'Fiche de travail',
        lgReflDefault: 'Réflexion sur l’unité d’apprentissage {v0}',
        lgGlossary: 'Glossaire',
        lgGlossaryTerm: 'Terme',
        lgGlossaryDesc: 'Description',
        lgAsmUnitHead: '{v0}- Unité d’évaluation',
        lgAsmIntroHead: '{v0}-1 Introduction',
        lgAsmPortfolioHead: '{v0}-2 Portfolio de preuves',
        lgAsmContentsHead: '{v0}-3 Contenu du portfolio',
        lgAsmTablesHead: '{v0}-4 Tableaux d’évaluation de l’unité {v1}',
        lgAsmTablesLead: 'Votre enseignant conservera ses propres relevés de vos acquis et remplira et signera également les tableaux ci-dessous, que vous signerez aussi. Ces tableaux seront ensuite votre relevé de résultats pendant l’étude de cette unité. Vous devez satisfaire à tous les critères d’évaluation et atteindre tous les résultats d’apprentissage pour être « compétent » dans cette unité.',
        lgColActivity: 'Activités d’apprentissage',
        lgColCriteria: 'Critères d’évaluation',
        lgColActNum: 'Intitulé et numéro de l’activité',
        lgColOutput: 'Production',
        lgColDate: 'Date de réalisation',
        lgColProduct: 'Productions de l’apprenant',
        lgColContributes: 'Contribue à l’évaluation ?',
        lgProdObservation: 'Observation directe',
        lgProdWorksheet: 'Fiche de travail',
        lgAsmOutcomeHead: 'Résultat d’apprentissage {v0} : {v1}',
        lgDefaultAsmIntro: 'L’évaluation de cette unité repose sur l’évaluation de votre portfolio de preuves, constitué des activités d’apprentissage réalisées pendant l’unité. Toutes les fiches de travail des activités, avec toute autre preuve de votre travail (photos, dessins, notes), doivent être remises à votre enseignant sous forme de portfolio. Si vous avez écrit des réponses dans ce guide, inscrivez votre nom sur sa couverture et placez-le aussi dans le portfolio. Votre enseignant vous rendra votre portfolio.\n\nPour réussir cette unité, vous devez atteindre tous les résultats d’apprentissage et satisfaire à tous les critères d’évaluation, présentés dans les tableaux d’évaluation ci-dessous.\n\nUne fois l’unité terminée, et après avoir eu l’occasion de satisfaire à tous les critères, l’enseignant confirmera si vous les remplissez tous, ou s’il reste un ou plusieurs critères non satisfaits.\n\nSi vous remplissez tous les critères, vous et l’enseignant signerez sous le tableau pour attester que vous avez atteint les résultats d’apprentissage. Ces tableaux constitueront votre relevé de résultats.\n\nSi vous avez besoin d’autres tentatives pour satisfaire à certains critères, convenez d’un moment et d’un lieu avec votre enseignant. Dans des circonstances exceptionnelles, une troisième tentative sera proposée.',
        lgDefaultAsmPortfolio: 'Au fil de l’unité, en réalisant les activités d’apprentissage, vous rassemblerez un ensemble d’activités terminées. Ce portfolio peut inclure votre guide de l’apprenant si vous y avez écrit vos réponses.\n\nVotre portfolio vous sera utile pour développer votre pratique professionnelle et réfléchir à vos progrès. Son contenu doit correspondre aux activités et productions du tableau ci-dessous. Ces activités vous aident à acquérir les connaissances et les compétences nécessaires aux évaluations de l’unité ; certaines ne contribuent pas à l’évaluation, mais il reste important de les réaliser et de les inclure dans votre portfolio.\n\nVotre portfolio sera à la disposition de votre enseignant, qui s’en servira pour évaluer et discuter vos progrès et ce qu’il vous reste à faire pour atteindre les résultats d’apprentissage.'
    },
    ar: {
        lgUnitCard: 'الوحدة التعلمية (دليل المتعلم)',
        lgReflTab: '🪞 التأمل',
        lgProceedToReflection: 'المتابعة إلى التأمل ←',
        lgReflCard: 'التأمل — خاتمة الوحدة التعلمية',
        lgReflNote: 'للوحدة التعلمية المختارة في الشريط أعلاه. الأجزاء الفارغة لا تُصدَّر.',
        lgReflNoUnit: 'اختر وحدة تعلمية من الشريط أعلاه لكتابة تأملها.',
        lgReflMore: '➕ إضافة أسئلة أخرى',
        lgClear: 'تفريغ المحتوى', lgClearTip: 'تفريغ هذا المربع (التراجع يعيده)',
        lgReflMoreHead: 'أسئلة إضافية {v0}',
        lgReflMoreTitlePh: 'عنوان فرعي لهذه الأسئلة (اختياري)…',
        lgReflMoreRemove: 'حذف هذه الأسئلة',
        lgIntroTitle: 'المقدمة',
        lgIntroBodyPh: 'عرّف بموضوع هذه الوحدة التعلمية…',
        lgIntroItemsLabel: 'محصلات التعلم لهذا الدليل هي:',
        lgIntroItemsPh: 'بند في كل سطر…',
        lgNumber: 'ترقيم', lgNumberTip: 'ترقيم الأسطر (1-، 2-، 3-) — اضغط مرة أخرى لإزالة الأرقام',
        lgIncCard: 'تتضمن كل وحدة تعلمية ما يلي:',
        lgIncRestore: 'استعادة النص الافتراضي',
        lgIncItemsPh: 'أي شيء آخر تتضمنه الوحدة التعلمية…',
        lgIncIntroLbl: 'المقدمة:', lgIncIntroTxt: 'التعريف بالموضوع',
        lgIncKnowLbl: 'المعرفة:', lgIncKnowTxt: 'أشياء تحتاج إلى معرفتها',
        lgIncActLbl: 'الأنشطة التعلمية:', lgIncActTxt: 'أشياء عليك القيام بها',
        lgIncReflLbl: 'التأمل:', lgIncReflTxt: 'للتأمل فيما تعلمته',
        lgReflTitle: 'التأمل',
        lgReflTitlePh: 'التأمل في الوحدة التعلمية {v0}',
        lgReflQuestionsLabel: 'أسئلة التأمل (سؤال في كل سطر)',
        lgReflQuestionsPh: 'ما هو الجزء الأكثر صعوبة في فهمك لهذه الوحدة ولماذا؟',
        lgReflLines: 'أسطر الإجابة لكل سؤال',
        lgReflContributes: 'التأمل يساهم في التقييم',
        lgActRowTitle: 'محفظة الأدلة',
        lgContributes: 'يساهم في التقييم؟',
        lgContributesDefault: 'افتراضي (نعم)',
        lgpYes: 'نعم',
        lgpNo: 'كلا',
        lgProduct: 'منتج الطالب:',
        lgAsmCard: 'وحدة التقييم (دليل المتعلم)',
        lgAsmNote: 'هذه النصوص من الأداة، ويمكنك تعديلها. جدول محتويات المحفظة يُبنى من الأوراق، وجدول التقييم لكل محصلة من استمارة التقييم أدناه.',
        lgAsmIntro: 'المقدمة',
        lgAsmPortfolio: 'سجل الأعمال (محفظة الأدلة)',
        lgAsmRestore: 'استعادة النص الافتراضي',
        lgAsmContents: 'محتويات سجل الأعمال (المحفظة)',
        lgAsmContentsEmpty: 'لا يوجد نشاط تعلمي أو ورقة عمل أو تأمل له عنوان بعد.',
        lgUnitHead: '{v0}- الوحدة التعلمية: {v1}',
        lgUnit: 'الوحدة التعلمية',
        mbInfoObjectiveLabel: 'الهدف:',
        lgObjectives: 'الأهداف',
        lgOptional: 'اختياري',
        lgObjShowTip: 'إضافة أهداف إلى ورقة المعرفة هذه (اختياري)',
        lgObjHide: 'إزالة الأهداف من هذه الورقة',
        lgActObjShowTip: 'إضافة أهداف إلى هذه الورقة (اختياري)',
        lgSelectUnit: '— اختر وحدة تعلمية —',
        lgIntroHead: '{v0} المقدمة',
        lgYouWillLearn: 'محصلات التعلم لهذا الدليل هي:',
        lgKnowledge: 'المعرفة',
        lgActivity: 'النشاط التعلمي',
        lgWorksheet: 'ورقة العمل',
        lgReflDefault: 'التأمل في الوحدة التعلمية {v0}',
        lgGlossary: 'المصطلحات',
        lgGlossaryTerm: 'المصطلح',
        lgGlossaryDesc: 'الوصف',
        lgAsmUnitHead: '{v0}- وحدة التقييم',
        lgAsmIntroHead: '{v0}-1 المقدمة',
        lgAsmPortfolioHead: '{v0}-2 سجل الأعمال (محفظة الأدلة)',
        lgAsmContentsHead: '{v0}-3 محتويات سجل الأعمال (المحفظة)',
        lgAsmTablesHead: '{v0}-4 جداول التقييم للوحدة {v1}',
        lgAsmTablesLead: 'سوف يحتفظ المعلم بسجلاته الخاصة بإنجازاتك وسوف يقوم أيضاً بملء وتوقيع الجداول أدناه، وسوف تعمل أنت أيضاً على التوقيع على هذا الجدول. ستكون هذه الجداول بعد ذلك سجلاً لك للحفاظ على نتائجك أثناء دراسة هذه الوحدة. يجب أن تستوفي جميع معايير التقييم وتحقق جميع محصلات التعلم لكي تكون «كفوءاً» لهذه الوحدة.',
        lgColActivity: 'نشاطات التعلم',
        lgColCriteria: 'معايير التقييم',
        lgColActNum: 'اسم ورقم النشاط التعلمي',
        lgColOutput: 'الناتج',
        lgColDate: 'تأريخ الإنجاز',
        lgColProduct: 'منتجات الطالب',
        lgColContributes: 'المساهمة في التقييم؟',
        lgProdObservation: 'الملاحظة المباشرة',
        lgProdWorksheet: 'ورقة عمل',
        lgAsmOutcomeHead: 'محصلة التعلم {v0}: {v1}',
        lgDefaultAsmIntro: 'يعتمد تقييم هذه الوحدة على تقييم الحافظة (سجل الأعمال). يعتمد تقييم الحافظة على أنشطة التعلم التي أكملتها خلال الوحدة. يجب تقديم جميع أوراق العمل من الأنشطة التعلمية إلى جانب أي دليل آخر على عملك (مثل الصور والرسومات والملاحظات) كمحفظة للتقييم لمعلمك. إذا كنت قد كتبت أياً من إجاباتك في دليل المتعلم، فاكتب اسمك على الغلاف الأمامي لدليل المتعلم وضعه في المحفظة أيضاً. سيعيد معلمك محفظتك إليك.\n\nلإكمال هذه الوحدة بنجاح، يجب عليك تحقيق جميع محصلات التعلم وتلبية جميع معايير التقييم للوحدة. تظهر محصلات التعلم ومعايير التقييم في جداول التقييم أدناه.\n\nبمجرد الانتهاء من الوحدة، وإتاحة الفرصة لك لتلبية جميع معايير التقييم، سيؤكد المعلم ما إذا كنت تستوفي جميع المعايير، أو إذا كان هناك معيار واحد أو أكثر لا تفي به.\n\nإذا كنت تستوفي جميع معايير التقييم، فسوف تقوم أنت والمعلم بالتوقيع أسفل الجدول للإقرار بأنك قد حققت محصلات التعلم (أي أنك مؤهل في محصلات التعلم). ستكون هذه الجداول بعد ذلك سجلاً لك للاحتفاظ بنتائجك أثناء دراسة هذه الوحدة.\n\nإذا كنت بحاجة إلى مزيد من محاولات التقييم للوفاء بمعايير معينة، فستحتاج إلى التفاوض على وقت ومكان لإجراء تقييم آخر مع معلمك. في ظروف استثنائية، سيتم توفير محاولة تقييم ثالثة.',
        lgDefaultAsmPortfolio: 'أثناء تقدمك في الوحدة وإكمال أنشطة التعلم، ستقوم بتجميع مجموعة من الأنشطة المكتملة. قد تتضمن هذه الحافظة دليل المتعلم الخاص بك إذا كنت قد كتبت إجاباتك في هذا الكتيب.\n\nستكون محفظتك مصدراً مفيداً لك أثناء تطوير ممارستك المهنية والتفكير في تقدمك. يجب أن تتطابق محتويات محفظتك مع الأنشطة والمنتجات المدرجة في الجدول أدناه. تم تصميم أنشطة التعلم هذه لمساعدتك على تعلم المعرفة والمهارات المطلوبة لإكمال تقييمات الوحدة، وبعضها لا يساهم في تقييم الوحدة، لكن لا يزال إكمالها مهماً وتحتاج إلى تضمينها في محفظتك.\n\nستكون محفظتك متاحة لمعلمك الذي سيستخدمها كأساس لتقييم ومناقشة كيفية تقدمك خلال الوحدة وما عليك القيام به لتحقيق محصلات تعلم الوحدة.'
    }
});

/* ── Small helpers ────────────────────────────────────────────── */

function _lgT(key, vars) {
    if (!window.i18n) return key;
    return vars ? window.i18n.tf(key, vars) : window.i18n.t(key);
}
/** A word of the tool in an explicit language (the export's). */
function _lgTIn(key, lang, vars) {
    if (!window.i18n || !window.i18n.tIn) return key;
    return vars ? window.i18n.tfIn(key, lang, vars) : window.i18n.tIn(key, lang);
}
function _lgEsc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
}
/* Any language of a pair, or a flattened string — the export hands this
   file flattened outcomes, the editor hands it pairs. */
function _lgStr(v, lang) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'object') {
        if (lang && typeof v[lang] === 'string' && v[lang].trim()) return v[lang];
        var codes = (typeof BILANG_CODES !== 'undefined') ? BILANG_CODES : ['en', 'ar', 'fr'];
        for (var i = 0; i < codes.length; i++) {
            if (typeof v[codes[i]] === 'string' && v[codes[i]].trim()) return v[codes[i]];
        }
    }
    return '';
}
function _lgLines(s) {
    return String(s || '').split('\n').map(function (l) { return l.replace(/^\s*(?:[-•*]|\d+[.)-])\s*/, '').trim(); })
        .filter(function (l) { return l; });
}
function _lgLang() { return (typeof contentLang === 'function') ? contentLang() : 'en'; }
function _lgOn() { return typeof mbIsLearnerGuide === 'function' && mbIsLearnerGuide(); }

/* ── Is it printed? ───────────────────────────────────────────── */

function mbLgIntroFilled(lo) {
    var x = lo && lo.lgIntro;
    return !!(x && (_lgStr(x.body).trim() || _lgStr(x.items).trim())) || mbLgIncludesTouched(lo);
}

/* 3.79.0: «Each learning unit includes the following:» — four fixed
   paragraphs (a label and a text the author can edit in place) and the
   author's own lines. */
var MB_LG_INC_KEYS = ['intro', 'knowledge', 'activities', 'reflection'];
var _LG_INC_I18N = {
    intro:      ['lgIncIntroLbl', 'lgIncIntroTxt'],
    knowledge:  ['lgIncKnowLbl',  'lgIncKnowTxt'],
    activities: ['lgIncActLbl',   'lgIncActTxt'],
    reflection: ['lgIncReflLbl',  'lgIncReflTxt']
};
/** The author has edited the card (a paragraph kept, or lines of their own):
 *  then the unit's introduction page is printed even with no introduction text. */
function mbLgIncludesTouched(lo) {
    var x = lo && lo.lgIncludes;
    if (!x || typeof x !== 'object') return false;
    return MB_LG_INC_KEYS.some(function (k) { return x[k] !== undefined && x[k] !== null; }) || !!_lgStr(x.items).trim();
}
/** One paragraph's text for a language: the author's, or the tool's. */
function _lgIncValue(lo, key, lang) {
    var v = lo && lo.lgIncludes && lo.lgIncludes[key];
    if (v === undefined || v === null) return _lgTIn(_LG_INC_I18N[key][1], lang);
    return _lgStr(v, lang);
}
/** What the exporters print under the introduction, in one language (`lo` may
 *  be flattened): { title, rows: [{ label, text }], extra: [lines] }. */
function mbLgIncludesParts(lo, lang) {
    var rows = [];
    MB_LG_INC_KEYS.forEach(function (k) {
        var text = String(_lgIncValue(lo, k, lang) || '').trim();
        if (text) rows.push({ label: _lgTIn(_LG_INC_I18N[k][0], lang), text: text });
    });
    var extra = _lgStr(lo && lo.lgIncludes && lo.lgIncludes.items, lang).split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    return { title: _lgTIn('lgIncCard', lang), rows: rows, extra: extra };
}
/** The editor's first touch seeds the four texts in every language, so a
 *  language switch later never shows a hole where the default was. */
function _lgIncEnsure(lo) {
    if (!lo.lgIncludes || typeof lo.lgIncludes !== 'object') lo.lgIncludes = {};
    var x = lo.lgIncludes;
    MB_LG_INC_KEYS.forEach(function (k) {
        if (x[k] === undefined || x[k] === null) {
            var tk = _LG_INC_I18N[k][1];
            x[k] = biNew(_lgTIn(tk, 'en'), _lgTIn(tk, 'ar'), _lgTIn(tk, 'fr'));
        }
    });
    if (!x.items || typeof x.items !== 'object') x.items = biNew();
    return x;
}
function mbLgReflectionFilled(lo) {
    var x = lo && lo.lgReflection;
    if (x && _lgStr(x.questions).trim()) return true;
    /* 3.75.0: or any of its added groups of questions. */
    return (Array.isArray(lo && lo.lgReflectionMore) ? lo.lgReflectionMore : [])
        .some(function (g) { return g && _lgStr(g.questions).trim(); });
}

/* 3.75.0: the reflection's groups of questions, in order — the first
   (lo.lgReflection, whose title heads the page) and those added with
   «➕ Add more questions» (lo.lgReflectionMore: [{ uid, title, questions,
   lines }], each title an optional subheading). Empty groups left out.
   [{ title, questions: [..], lines }] in one language. */
function _lgLinesOf(v) {
    var n = parseInt(v, 10);
    return (isFinite(n) && n >= 1 && n <= 12) ? n : 2;
}
function mbLgReflectionGroups(lo, lang) {
    var split = function (v) { return _lgStr(v, lang).split('\n').map(function (q) { return q.trim(); }).filter(Boolean); };
    var out = [];
    var first = lo && lo.lgReflection;
    if (first && split(first.questions).length) out.push({ title: '', questions: split(first.questions), lines: mbLgReflectionLines(lo) });
    (Array.isArray(lo && lo.lgReflectionMore) ? lo.lgReflectionMore : []).forEach(function (g) {
        var qs = split(g && g.questions);
        if (qs.length) out.push({ title: _lgStr(g.title, lang).trim(), questions: qs, lines: _lgLinesOf(g.lines) });
    });
    return out;
}

/* ── Names of the sheets in this template ─────────────────────── */

/* 3.67.0: the template's own names, each renamed per language in
   Settings → Misc → «Learner guide names» (settings.lgLabels, '' = the
   name below). `unit` heads each learning outcome («1- Learning unit:
   …»), `objectives` is the optional objectives part of a knowledge
   sheet; info / activity / job are the three sheets. */
var MB_LG_LABEL_KINDS = ['unit', 'info', 'activity', 'job', 'objectives'];
var _LG_LABEL_KEYS = { unit: 'lgUnit', info: 'lgKnowledge', activity: 'lgActivity', job: 'lgWorksheet', objectives: 'lgObjectives' };

/** The name the user typed for this part in this language, or ''. */
function mbLgLabelCustom(kind, lang) {
    var s = {};
    try { if (typeof _wsGet === 'function') s = _wsGet() || {}; } catch (e) { s = {}; }
    var side = (s.lgLabels && s.lgLabels[lang]) || {};
    return String(side[kind] || '').trim();
}
/** The tool's own name for this part. */
function mbLgLabelDefault(kind, lang) {
    return _LG_LABEL_KEYS[kind] ? _lgTIn(_LG_LABEL_KEYS[kind], lang) : '';
}
/** The name to show and print: the user's, else the tool's. */
function mbLgLabel(kind, lang) {
    return mbLgLabelCustom(kind, lang) || mbLgLabelDefault(kind, lang);
}

/** «1- Learning unit: title» — an outcome's heading in this template. */
function mbLgUnitHeading(num, title, lang) {
    var t = String(title || '').trim();
    return num + '- ' + mbLgLabel('unit', lang) + (t ? ': ' + t : '');
}

/** The template's own name for a sheet type, or '' (sheet_kinds.js asks
 *  this when the user has typed no name in Settings → Misc). */
function mbLgSheetName(kind, lang) {
    if (!_lgOn()) return '';
    if (kind !== 'info' && kind !== 'activity' && kind !== 'job') return '';
    return mbLgLabel(kind, lang);
}
/** sheet_kinds.js: a name typed under «Learner guide names» wins over a
 *  name typed for the standard sheets while this template is on. */
function mbLgSheetNameCustom(kind, lang) {
    if (!_lgOn() || (kind !== 'info' && kind !== 'activity' && kind !== 'job')) return '';
    return mbLgLabelCustom(kind, lang);
}

/* 3.67.0: in this template the interface says «learning unit» where it
   says «learning outcome» (the module bar of each tab), with the name
   from Settings. Called by i18n.t() through sheet_kinds.js. */
var MB_LG_UI_KEYS = { mbLearningOutcome: 'label', mbSelectLearningOutcome: 'select', mbInfoObjectiveLabel: 'objective', mbObjective: 'objective' };   // 3.68.0: mbObjective = the activity sheet's
function mbLgUiOverlay(key, lang) {
    var which = MB_LG_UI_KEYS[key];
    if (!which || !_lgOn()) return '';
    if (which === 'label') return '📚 ' + mbLgLabel('unit', lang) + (lang === 'fr' ? ' :' : ':');
    if (which === 'objective') return mbLgLabel('objectives', lang) + (lang === 'fr' ? ' :' : ':');
    var own = mbLgLabelCustom('unit', lang);
    if (!own) return _lgTIn('lgSelectUnit', lang);
    return lang === 'ar' ? '— اختر: ' + own + ' —' : '-- ' + own + ' --';
}

/** «1-2 Knowledge: title» — the heading of a sheet in this template. */
function mbLgSheetHeading(kind, num, title, lang, sheet) {
    var label = (typeof mbSheetLabel === 'function') ? mbSheetLabel(kind, lang, sheet) : '';   // 3.73.0: sheet → a custom name
    var s = (num ? num + ' ' : '') + label;
    if (title) s += ': ' + title;
    return s;
}

/** Product and contribution of an activity sheet in the portfolio. */
function mbLgActProduct(act, lang) {
    var own = _lgStr(act && act.lgProduct, lang).trim();
    if (own) return own;
    var kind = (typeof mbSheetKind === 'function') ? mbSheetKind(act && act.sheetType) : 'activity';
    return _lgTIn(kind === 'job' ? 'lgProdWorksheet' : 'lgProdObservation', lang);
}
function mbLgActContributes(act) {
    return !(act && act.lgContributes === 'no');
}

/** The reflection's heading text (number not included). */
function mbLgReflectionTitle(lo, loIndex, lang) {
    var own = _lgStr(lo && lo.lgReflection && lo.lgReflection.title, lang).trim();
    return own || _lgTIn('lgReflDefault', lang, { v0: loIndex + 1 });
}
function mbLgReflectionLines(lo) {
    var n = parseInt(lo && lo.lgReflection && lo.lgReflection.lines, 10);
    return (isFinite(n) && n >= 1 && n <= 12) ? n : 2;
}

/**
 * The rows of «Contents of the portfolio», in document order:
 *   [{ number, label, product, contributes }]
 * Activity sheets of every type and filled reflections. `los` may be
 * flattened (export) or not (screen).
 */
function mbLgPortfolioRows(los, lang) {
    var rows = [];
    (los || []).forEach(function (lo, loIndex) {
        var acts = lo.activitySheets || [];
        var seq = (typeof mbLoSequence === 'function') ? mbLoSequence(lo) : [];
        seq.forEach(function (it) {
            if (it.kind === 'activity') {
                var a = acts[it.index];
                var title = _lgStr(a && a.title, lang).trim();
                if (!title) return;
                var kind = (typeof mbSheetKind === 'function') ? mbSheetKind(a.sheetType) : 'activity';
                var num = (typeof mbSeqNumber === 'function') ? mbSeqNumber(lo, loIndex, 'activity', it.index) : '';
                rows.push({ number: num, label: mbLgSheetHeading(kind, num, title, lang, a),
                            product: mbLgActProduct(a, lang), contributes: mbLgActContributes(a) });
            } else if (it.kind === 'lgReflection' && mbLgReflectionFilled(lo)) {
                var n = (typeof mbSeqLgNumber === 'function') ? mbSeqLgNumber(lo, loIndex, 'lgReflection') : '';
                rows.push({ number: n, label: ((n ? n + ' ' : '') + mbLgReflectionTitle(lo, loIndex, lang)),
                            product: _lgTIn('lgProdWorksheet', lang),
                            contributes: !!(lo.lgReflection && lo.lgReflection.contributes === 'yes') });
            }
        });
    });
    return rows;
}

/** The assessment unit's texts in one language: the author's, or the
 *  tool's when never edited (null). '' when the author emptied it. */
function mbLgAsmText(which, lang, state) {
    var st = state || mbState;
    var v = st && st.lgAsm ? st.lgAsm[which] : null;
    var key = which === 'intro' ? 'lgDefaultAsmIntro' : 'lgDefaultAsmPortfolio';
    if (v === null || v === undefined) return _lgTIn(key, lang);
    return (typeof v === 'string') ? v : ((typeof biGetStrict === 'function') ? biGetStrict(v, lang) : _lgStr(v, lang));
}

/** Shared data → state (module_library.js). */
function mbLgNormalizeAsm(v) {
    var out = { intro: null, portfolio: null };
    if (v && typeof v === 'object') {
        if (v.intro !== null && v.intro !== undefined) out.intro = biUpgrade(v.intro);
        if (v.portfolio !== null && v.portfolio !== undefined) out.portfolio = biUpgrade(v.portfolio);
    }
    return out;
}

/* ══════════════════════════════════════════════════════════════
   EDITOR — the learning unit card (Introduction Pages, Reflection) and the activity row
   ══════════════════════════════════════════════════════════════ */

function _lgSave() {
    if (typeof saveCurrentModuleLOData === 'function') saveCurrentModuleLOData();
    if (typeof mbSeqPaintNumberFields === 'function') { try { mbSeqPaintNumberFields(); } catch (e) { /* no sheet */ } }
}

/** 3.69.0: the learning unit card is in two places — its introduction in
 *  the Introduction Pages tab (#lg-unit-section), its reflection in the
 *  Reflection tab (#lg-reflection-section), each for the outcome chosen in
 *  the bar above it. Both write the same outcome (lo.lgIntro /
 *  lo.lgReflection); nothing moved in the data or the export. */
function mbRenderLgUnit(force) {
    _lgRenderPart('intro', force);
    _lgRenderPart('refl', force);
}

function _lgRenderPart(part, force) {
    var host = document.getElementById(part === 'intro' ? 'lg-unit-section' : 'lg-reflection-section');
    if (!host) return;
    var lo = (typeof mbCurrentLOObject === 'function') ? mbCurrentLOObject() : null;
    if (!_lgOn()) { host.style.display = 'none'; host.innerHTML = ''; host.removeAttribute('data-render-key'); return; }
    if (!lo) {
        host.removeAttribute('data-render-key');
        if (part === 'intro') { host.style.display = 'none'; host.innerHTML = ''; return; }
        /* The Reflection tab is never blank: it says what to do. */
        host.style.display = '';
        host.innerHTML = '<p class="lg-refl-empty">' + _lgEsc(_lgT('lgReflNoUnit')) + '</p>';
        return;
    }
    host.style.display = '';
    var lang = _lgLang();
    var loIndex = mbState.learningOutcomesData.indexOf(lo);
    /* Not while the author is typing here (history.js snapshots on every
       focus, which repaints the outcome card): the fields bind live. */
    var key = part + '|' + lo.id + '|' + loIndex + '|' + lang + '|' + ((window.i18n && window.i18n.getLang) ? window.i18n.getLang() : '') +
        (part === 'refl' ? '|' + (lo.lgReflectionMore || []).map(function (x) { return x && x.uid; }).join(',') : '');
    /* 3.75.0: the fields bind live, so a repaint for the same outcome,
       languages and groups changes nothing on screen — and rebuilding it
       between a press and its release (a «change» fired by leaving a
       field) swallowed the click on the button being pressed. */
    if (force !== true && host.getAttribute('data-render-key') === key && host.innerHTML) return;
    host.setAttribute('data-render-key', key);
    var intro = lo.lgIntro || {}, refl = lo.lgReflection || {};
    var g = function (v) { return _lgEsc((typeof biGetStrict === 'function') ? biGetStrict(v, lang) : _lgStr(v, lang)); };
    var dir = (typeof biIsRtl === 'function' && biIsRtl(lang)) ? 'rtl' : 'ltr';
    var field = function (f, kind, ph, val, rows) {
        if (kind === 'textarea') {
            return '<textarea class="mb-block-body lg-field" rows="' + (rows || 4) + '" dir="' + dir + '" data-lg-field="' + f + '"' +
                ' data-act="mbLgEdit" data-on="input" data-args=\'["' + f + '"]\' placeholder="' + _lgEsc(ph) + '">' + val + '</textarea>';
        }
        return '<input class="mb-block-title lg-field" type="text" dir="' + dir + '" data-lg-field="' + f + '"' +
            ' data-act="mbLgEdit" data-on="input" data-args=\'["' + f + '"]\' placeholder="' + _lgEsc(ph) + '" value="' + val + '"/>';
    };
    if (part === 'intro') {
        var inc = lo.lgIncludes || {};
        /* an icon-only square button, like the app's other icon buttons */
        var numBtn = function (f) {
            return '<button type="button" class="mb-icon-btn lg-num-btn" data-act="mbLgNumberLines" data-args=\'["' + f + '"]\'' +
                ' title="' + _lgEsc(_lgT('lgNumberTip')) + '" aria-label="' + _lgEsc(_lgT('lgNumber')) + '">' +
                '<svg class="mb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
                '<path d="M10 6h11M10 12h11M10 18h11"/>' +
                '<g stroke="#2563eb"><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></g></svg></button>';
        };
        var incRows = MB_LG_INC_KEYS.map(function (k) {
            var v = (inc[k] !== undefined && inc[k] !== null)
                ? ((typeof biGetStrict === 'function') ? biGetStrict(inc[k], lang) : _lgStr(inc[k], lang))
                : _lgTIn(_LG_INC_I18N[k][1], lang);
            return '<div class="lg-inc-row" dir="' + dir + '"><span class="lg-inc-lbl">' + _lgEsc(_lgTIn(_LG_INC_I18N[k][0], lang)) + '</span>' +
                '<input class="mb-block-title lg-field lg-inc-input" type="text" dir="' + dir + '" data-lg-field="includes.' + k + '"' +
                ' data-act="mbLgEdit" data-on="input" data-args=\'["includes.' + k + '"]\' value="' + _lgEsc(v) + '"/></div>';
        }).join('');
        host.innerHTML =
            '<div class="mb-blocks-head"><label class="mb-blocks-label">🧭 ' + _lgEsc(_lgT('lgUnitCard')) + '</label></div>' +
            /* 1 — the introduction */
            '<div class="mb-block lg-part">' +
              '<div class="lg-part-head"><span>' + _lgEsc(_lgT('lgIntroTitle')) + '</span></div>' +
              field('intro.body', 'textarea', _lgT('lgIntroBodyPh'), g(intro.body), 4) +
            '</div>' +
            /* 2 — its own card: the learning outcomes, the numbering button at the far end of the title */
            '<div class="mb-block lg-part lg-outcomes-card">' +
              '<div class="lg-part-head"><span>' + _lgEsc(_lgT('lgIntroItemsLabel')) + '</span>' + numBtn('intro.items') + '</div>' +
              field('intro.items', 'textarea', _lgT('lgIntroItemsPh'), g(intro.items), 4) +
            '</div>' +
            /* 3 — what each learning unit includes (3.79.0) */
            '<div class="mb-block lg-part lg-inc-card">' +
              '<div class="lg-part-head"><span>' + _lgEsc(_lgT('lgIncCard')) + '</span></div>' +
              incRows +
              field('includes.items', 'textarea', _lgT('lgIncItemsPh'), g(inc.items), 3) +
              '<button type="button" class="lg-restore lg-inc-restore" data-act="mbLgIncRestore">↺ ' + _lgEsc(_lgT('lgIncRestore')) + '</button>' +
            '</div>';
        return;
    }
    var lines = mbLgReflectionLines(lo);
    host.innerHTML =
        '<div class="mb-blocks-head"><label class="mb-blocks-label">🪞 ' + _lgEsc(_lgT('lgReflCard')) + '</label>' +
          '<span class="mb-blocks-note">' + _lgEsc(_lgT('lgReflNote')) + '</span></div>' +
        '<div class="mb-block lg-part">' +
          /* 3.76.0: «contributes to the assessment» on the heading's line,
             at its far end — it is about the whole reflection. */
          '<div class="lg-part-head"><span>' + _lgEsc(_lgT('lgReflTitle')) + '</span>' +
            '<label class="lg-check lg-refl-contrib"><input type="checkbox"' + (refl.contributes === 'yes' ? ' checked' : '') +
              ' data-act="mbLgEdit" data-on="change" data-args=\'["refl.contributes"]\'/> ' + _lgEsc(_lgT('lgReflContributes')) + '</label>' +
          '</div>' +
          field('refl.title', 'input', _lgT('lgReflTitlePh', { v0: loIndex + 1 }), g(refl.title)) +
          '<label class="lg-sub">' + _lgEsc(_lgT('lgReflQuestionsLabel')) + '</label>' +
          field('refl.questions', 'textarea', _lgT('lgReflQuestionsPh'), g(refl.questions), 5) +
          _lgToolsRow('refl.questions', 'refl.lines', lines) +
        '</div>' +
        /* 3.75.0: more groups of questions, the same card repeated. */
        (Array.isArray(lo.lgReflectionMore) ? lo.lgReflectionMore : []).map(function (gr, gi) {
            var f = function (k, kind, ph, val, rows) {
                var id = 'more.' + gr.uid + '.' + k;
                if (kind === 'textarea') return '<textarea class="mb-block-body lg-field" rows="' + rows + '" dir="' + dir + '" data-lg-field="' + id + '"' +
                    ' data-act="mbLgEdit" data-on="input" data-args=\'["' + id + '"]\' placeholder="' + _lgEsc(ph) + '">' + val + '</textarea>';
                return '<input class="mb-block-title lg-field" type="text" dir="' + dir + '" data-lg-field="' + id + '"' +
                    ' data-act="mbLgEdit" data-on="input" data-args=\'["' + id + '"]\' placeholder="' + _lgEsc(ph) + '" value="' + val + '"/>';
            };
            return '<div class="mb-block lg-part lg-refl-more" data-uid="' + _lgEsc(gr.uid) + '">' +
                '<div class="lg-part-head"><span>' + _lgEsc(_lgT('lgReflMoreHead', { v0: gi + 2 })) + '</span>' +
                  '<button type="button" class="btn-remove mb-icon-btn danger" data-act="mbLgReflMoreRemove" data-args=\'["' + _lgEsc(gr.uid) + '"]\'' +
                  ' title="' + _lgEsc(_lgT('lgReflMoreRemove')) + '" aria-label="' + _lgEsc(_lgT('lgReflMoreRemove')) + '">' +
                  '<svg class="mb-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 7h16"/><path d="M9.5 7V5.6A1.6 1.6 0 0 1 11.1 4h1.8a1.6 1.6 0 0 1 1.6 1.6V7"/><path d="M6.6 7l.75 11.6A1.7 1.7 0 0 0 9.05 20.2h5.9a1.7 1.7 0 0 0 1.7-1.6L17.4 7"/><path d="M10.3 11v5.4M13.7 11v5.4"/></svg></button></div>' +
                f('title', 'input', _lgT('lgReflMoreTitlePh'), g(gr.title)) +
                '<label class="lg-sub">' + _lgEsc(_lgT('lgReflQuestionsLabel')) + '</label>' +
                f('questions', 'textarea', _lgT('lgReflQuestionsPh'), g(gr.questions), 4) +
                _lgToolsRow('more.' + gr.uid + '.questions', 'more.' + gr.uid + '.lines', _lgLinesOf(gr.lines)) +
              '</div>';
        }).join('') +
        '<button type="button" class="mb-block-add lg-refl-add" data-act="mbLgReflMoreAdd">' + _lgEsc(_lgT('lgReflMore')) + '</button>';
}

/* 3.76.0 / 3.77.0: one line under a box of reflection questions —
   📝 Paste text (paste_text.js), ✕ Clear, and the answer lines (a small
   two-digit box with its arrows). */
function _lgToolsRow(field, linesField, lines) {
    return '<div class="lg-tools-row">' +
        ((typeof mbPasteTextBtnHtml === 'function') ? mbPasteTextBtnHtml('lg', field) : '') +
        '<button type="button" class="lg-clear-btn" data-act="mbLgClearField" data-args=\'["' + _lgEsc(field) + '"]\'' +
          ' title="' + _lgEsc(_lgT('lgClearTip')) + '">✕ <span>' + _lgEsc(_lgT('lgClear')) + '</span></button>' +
        '<label class="lg-lines-label">' + _lgEsc(_lgT('lgReflLines')) +
          ' <input type="number" min="1" max="12" step="1" inputmode="numeric" class="lg-lines" value="' + lines + '"' +
          ' data-act="mbLgEdit" data-on="change" data-args=\'["' + _lgEsc(linesField) + '"]\'/></label>' +
      '</div>';
}

/** ✕ Clear: empties a box of the card. A button press, so Undo brings
 *  the text back (history.js records every data-act). */
function mbLgClearField(field) {
    var box = document.querySelector('[data-lg-field="' + String(field).replace(/"/g, '') + '"]');
    if (!box || !box.value) return;
    box.value = '';
    box.dispatchEvent(new Event('input', { bubbles: true }));
    try { box.focus(); } catch (e) { /* hidden */ }
}

/* 3.75.0: add / remove a group of reflection questions. */
function mbLgReflMoreAdd() {
    var lo = (typeof mbCurrentLOObject === 'function') ? mbCurrentLOObject() : null;
    if (!lo) return;
    if (!Array.isArray(lo.lgReflectionMore)) lo.lgReflectionMore = [];
    var uid = 'rq' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    lo.lgReflectionMore.push({ uid: uid, title: biNew(), questions: biNew(), lines: 2 });
    _lgSave();
    _lgRenderPart('refl', true);
    var box = document.querySelector('#lg-reflection-section [data-lg-field="more.' + uid + '.questions"]');
    if (box) { try { box.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { /* old browser */ } box.focus(); }
}
async function mbLgReflMoreRemove(uid) {
    var lo = (typeof mbCurrentLOObject === 'function') ? mbCurrentLOObject() : null;
    if (!lo || !Array.isArray(lo.lgReflectionMore)) return;
    var gr = lo.lgReflectionMore.find(function (x) { return x && x.uid === uid; });
    if (!gr) return;
    var has = gr && (_lgStr(gr.questions).trim() || _lgStr(gr.title).trim());
    if (has && typeof mbConfirm === 'function' && !(await mbConfirm(_lgT('lgReflMoreRemove') + '?', { danger: true }))) return;
    lo.lgReflectionMore = lo.lgReflectionMore.filter(function (x) { return x && x.uid !== uid; });
    _lgSave();
    _lgRenderPart('refl', true);
}

/** Every field of the card writes its pair at once (blocks.js rule). */
function mbLgEdit(field, el) {
    var lo = (typeof mbCurrentLOObject === 'function') ? mbCurrentLOObject() : null;
    if (!lo || !el) return;
    var parts = String(field).split('.');
    if (parts[0] === 'more') {   // 3.75.0: an added group of questions
        var gr = (lo.lgReflectionMore || []).find(function (x) { return x && x.uid === parts[1]; });
        if (!gr) return;
        if (parts[2] === 'lines') gr.lines = _lgLinesOf(el.value);
        else { if (!gr[parts[2]] || typeof gr[parts[2]] !== 'object') gr[parts[2]] = biNew(); biPut(gr, parts[2], el.value); }
        _lgSave();
        return;
    }
    if (parts[0] === 'includes') {   // 3.79.0: «Each learning unit includes the following:»
        if (parts[1] !== 'items' && MB_LG_INC_KEYS.indexOf(parts[1]) < 0) return;
        var inc = _lgIncEnsure(lo);
        biPut(inc, parts[1], el.value);
        _lgSave();
        return;
    }
    var objKey = parts[0] === 'intro' ? 'lgIntro' : 'lgReflection';
    if (!lo[objKey] || typeof lo[objKey] !== 'object') lo[objKey] = {};
    var obj = lo[objKey], k = parts[1];
    if (k === 'lines') {
        var n = parseInt(el.value, 10);
        obj.lines = (isFinite(n) && n >= 1 && n <= 12) ? n : 2;
    } else if (k === 'contributes') {
        obj.contributes = el.checked ? 'yes' : 'no';
    } else {
        biPut(obj, k, el.value);
    }
    _lgSave();
}

/** 🔢 Numbering: puts «1- », «2- », … in front of the lines of a box; when
 *  every line already has its number, takes the numbers off again. A button
 *  press, so Undo brings the old text back (history.js). The exporters read
 *  the lines with or without their numbers. */
function mbLgNumberLines(field) {
    var box = document.querySelector('[data-lg-field="' + String(field).replace(/"/g, '') + '"]');
    if (!box) return;
    var lines = String(box.value || '').split('\n');
    var filled = lines.filter(function (l) { return l.trim(); });
    if (!filled.length) return;
    var numbered = /^\s*\d+\s*[-.)]/;
    var strip = /^\s*(?:\d+\s*[-.)]|[-•*])\s*/;
    var allNumbered = filled.every(function (l) { return numbered.test(l); });
    var n = 0;
    box.value = lines.map(function (l) {
        if (!l.trim()) return l;
        var bare = l.replace(strip, '');
        if (allNumbered) return bare;
        n++;
        return n + '- ' + bare;
    }).join('\n');
    box.dispatchEvent(new Event('input', { bubbles: true }));
    try { box.focus(); } catch (e) { /* hidden */ }
}

/** ↺ The four paragraphs of «Each learning unit includes…» back to the tool's texts. */
function mbLgIncRestore() {
    var lo = (typeof mbCurrentLOObject === 'function') ? mbCurrentLOObject() : null;
    if (!lo || !lo.lgIncludes) return;
    MB_LG_INC_KEYS.forEach(function (k) { delete lo.lgIncludes[k]; });
    _lgSave();
    _lgRenderPart('intro', true);
}

/* The row on the activity sheet: does it count, and what does the learner hand in. */
function mbLgPaintActivityRow(act) {
    var sel = document.getElementById('lg-act-contributes');
    var inp = document.getElementById('lg-act-product');
    if (!sel || !inp) return;
    var lang = _lgLang();
    sel.innerHTML = '<option value="">' + _lgEsc(_lgT('lgContributesDefault')) + '</option>' +
        '<option value="yes">' + _lgEsc(_lgT('lgpYes')) + '</option>' +
        '<option value="no">' + _lgEsc(_lgT('lgpNo')) + '</option>';
    sel.value = (act && (act.lgContributes === 'yes' || act.lgContributes === 'no')) ? act.lgContributes : '';
    inp.value = (act && typeof biGetStrict === 'function') ? biGetStrict(act.lgProduct, lang) : '';
    mbLgPaintProductPlaceholder();
}
function mbLgPaintProductPlaceholder() {
    var inp = document.getElementById('lg-act-product');
    var kindSel = document.getElementById('activity-sheet-type');
    if (!inp) return;
    var kind = (typeof mbSheetKind === 'function') ? mbSheetKind(kindSel && kindSel.value) : 'activity';
    inp.placeholder = _lgT(kind === 'job' ? 'lgProdWorksheet' : 'lgProdObservation');
}
/** sheets.js: the two fields onto the activity being saved. */
function mbLgCollectActivityRow(activityData) {
    var sel = document.getElementById('lg-act-contributes');
    var inp = document.getElementById('lg-act-product');
    if (sel) {
        if (sel.value === 'yes' || sel.value === 'no') activityData.lgContributes = sel.value;
        else delete activityData.lgContributes;
    }
    if (inp && (inp.value || (activityData.lgProduct && typeof biIs === 'function' && biIs(activityData.lgProduct)))) {
        biPut(activityData, 'lgProduct', inp.value);
    }
}

/* ── 3.67.0: the optional objectives of a sheet ───────────────
   In this template a sheet has no objectives unless the author asks
   for them: the objectives part is hidden behind «🎯 Objectives
   (optional)». The knowledge sheet since 3.67.0, the learning activity
   sheet (its tab, either type) since 3.68.0. sheet.lgObjective — true:
   shown, false: hidden (kept, not printed), absent: shown when it has
   text (a sheet written earlier, or in the standard template). The
   standard template ignores the flag. `kind` is 'info' (default) or
   'activity'. */
var _LG_OBJ = {
    info:     { group: 'info-objective-group',     btn: 'lg-obj-toggle',     ta: 'info-objective', tip: 'lgObjShowTip' },
    activity: { group: 'activity-objective-group', btn: 'lg-act-obj-toggle', ta: 'objective',      tip: 'lgActObjShowTip' }
};
function _lgObjKind(kind) { return kind === 'activity' ? 'activity' : 'info'; }
function mbLgObjectiveShown(sh) {
    if (sh && sh.lgObjective === true) return true;
    if (sh && sh.lgObjective === false) return false;
    return !!_lgStr(sh && sh.objective).trim();
}
/** Exporters: whether a (flattened) sheet's objectives print. */
function mbLgObjectivePrinted(sh) {
    return !_lgOn() || !(sh && sh.lgObjective === false);
}
function _lgObjGroup(kind) { return document.getElementById(_LG_OBJ[_lgObjKind(kind)].group); }
/** sheets.js, when a sheet is put on screen (null = none). */
function mbLgLoadObjective(sh, kind) {
    var g = _lgObjGroup(kind);
    if (!g) return;
    g.setAttribute('data-lg-obj', mbLgObjectiveShown(sh || null) ? '1' : '0');
    mbLgPaintObjective(kind);
}
/** sheets.js, when the sheet on screen is saved. */
function mbLgCollectObjective(data, kind) {
    var g = _lgObjGroup(kind);
    if (!g || !_lgOn() || !data) return;
    var v = g.getAttribute('data-lg-obj');
    if (v === '1') data.lgObjective = true;
    else if (v === '0') data.lgObjective = false;
}
/** Paint one sheet's objectives part and button (no kind: both). */
function mbLgPaintObjective(kind) {
    if (kind === undefined) { mbLgPaintObjective('info'); mbLgPaintObjective('activity'); return; }
    var cfg = _LG_OBJ[_lgObjKind(kind)];
    var g = document.getElementById(cfg.group);
    var btn = document.getElementById(cfg.btn);
    if (!g) return;
    if (!_lgOn()) { g.style.display = ''; return; }
    if (g.getAttribute('data-lg-obj') === null) {
        var ta = document.getElementById(cfg.ta);
        g.setAttribute('data-lg-obj', ta && ta.value.trim() ? '1' : '0');
    }
    var shown = g.getAttribute('data-lg-obj') === '1';
    g.style.display = shown ? '' : 'none';
    if (btn) {
        var ui = (window.i18n && window.i18n.getLang) ? window.i18n.getLang() : 'en';
        btn.setAttribute('aria-expanded', shown ? 'true' : 'false');
        btn.classList.toggle('is-on', shown);
        btn.title = _lgT(shown ? 'lgObjHide' : cfg.tip);
        var l = btn.querySelector('.lg-obj-label');
        var o = btn.querySelector('.lg-optional');
        if (l) l.textContent = mbLgLabel('objectives', ui);
        if (o) o.textContent = '(' + _lgT('lgOptional') + ')';
    }
}
/** The button: show the objectives part (and go to it), or hide it. */
function mbLgToggleObjective(kind) {
    var g = _lgObjGroup(kind);
    if (!g) return;
    var show = g.getAttribute('data-lg-obj') !== '1';
    g.setAttribute('data-lg-obj', show ? '1' : '0');
    mbLgPaintObjective(_lgObjKind(kind));
    if (typeof saveCurrentSheetToLO === 'function') { try { saveCurrentSheetToLO(); } catch (e) { /* nothing open */ } }
    if (typeof mbLibrarySave === 'function') { try { mbLibrarySave(); } catch (e) { /* not ready */ } }
    if (show) {
        var ta = document.getElementById(_LG_OBJ[_lgObjKind(kind)].ta);
        if (ta) { try { ta.focus(); } catch (e) { /* hidden */ } }
    }
}

/* ══════════════════════════════════════════════════════════════
   EDITOR — the assessment unit card (Assessment tab)
   ══════════════════════════════════════════════════════════════ */

function mbRenderLgAsm(force) {
    var host = document.getElementById('lg-asm-section');
    if (!host) return;
    if (!_lgOn()) { host.innerHTML = ''; host.removeAttribute('data-render-key'); return; }
    if (!mbState.lgAsm) mbState.lgAsm = { intro: null, portfolio: null };
    var lang = _lgLang();
    var key = lang + '|' + ((window.i18n && window.i18n.getLang) ? window.i18n.getLang() : '');
    var act = document.activeElement;
    if (force !== true && host.getAttribute('data-render-key') === key && act && act !== document.body && host.contains(act)) return;
    host.setAttribute('data-render-key', key);
    var dir = (typeof biIsRtl === 'function' && biIsRtl(lang)) ? 'rtl' : 'ltr';
    var box = function (which, labelKey) {
        return '<div class="mb-block lg-part">' +
            '<div class="lg-part-head">' + _lgEsc(_lgT(labelKey)) +
              ' <button type="button" class="lg-restore" data-act="mbLgAsmRestore" data-args=\'["' + which + '"]\'>↺ ' + _lgEsc(_lgT('lgAsmRestore')) + '</button></div>' +
            '<textarea class="mb-block-body lg-field" rows="8" dir="' + dir + '" data-lg-asm="' + which + '"' +
              ' data-act="mbLgAsmEdit" data-on="input" data-args=\'["' + which + '"]\'>' + _lgEsc(mbLgAsmText(which, lang)) + '</textarea></div>';
    };
    host.innerHTML =
        '<div class="mb-blocks-head"><label class="mb-blocks-label">📁 ' + _lgEsc(_lgT('lgAsmCard')) + '</label>' +
          '<span class="mb-blocks-note">' + _lgEsc(_lgT('lgAsmNote')) + '</span></div>' +
        box('intro', 'lgAsmIntro') + box('portfolio', 'lgAsmPortfolio') +
        '<div class="mb-block lg-part"><div class="lg-part-head">' + _lgEsc(_lgT('lgAsmContents')) + '</div>' +
          '<div id="lg-portfolio-preview">' + mbLgPortfolioPreviewHtml() + '</div></div>';
}

function mbLgPortfolioPreviewHtml() {
    if (typeof saveCurrentSheetToLO === 'function') { try { saveCurrentSheetToLO(); } catch (e) { /* nothing on screen */ } }
    var lang = _lgLang();
    var rows = mbLgPortfolioRows(mbState.learningOutcomesData || [], lang);
    if (!rows.length) return '<p class="lg-empty">' + _lgEsc(_lgT('lgAsmContentsEmpty')) + '</p>';
    return '<table class="lg-preview"><thead><tr><th>' + _lgEsc(_lgT('lgColActivity')) + '</th><th>' + _lgEsc(_lgT('lgColProduct')) +
        '</th><th>' + _lgEsc(_lgT('lgColContributes')) + '</th></tr></thead><tbody>' +
        rows.map(function (r) {
            return '<tr><td dir="auto">' + _lgEsc(r.label) + '</td><td dir="auto">' + _lgEsc(r.product) + '</td><td>' +
                _lgEsc(_lgT(r.contributes ? 'lgpYes' : 'lgpNo')) + '</td></tr>';
        }).join('') + '</tbody></table>';
}

function mbLgAsmEdit(which, el) {
    if (!el) return;
    if (!mbState.lgAsm) mbState.lgAsm = { intro: null, portfolio: null };
    var cur = mbState.lgAsm[which];
    if (cur === null || cur === undefined) {
        /* First edit: every other language keeps the tool's text, so an
           Arabic edit does not empty the English export. */
        var key = which === 'intro' ? 'lgDefaultAsmIntro' : 'lgDefaultAsmPortfolio';
        cur = {};
        (typeof BILANG_CODES !== 'undefined' ? BILANG_CODES : ['en', 'ar', 'fr']).forEach(function (c) { cur[c] = _lgTIn(key, c); });
        mbState.lgAsm[which] = cur;
    }
    biPut(mbState.lgAsm, which, el.value);
}

function mbLgAsmRestore(which) {
    if (!mbState.lgAsm) mbState.lgAsm = { intro: null, portfolio: null };
    mbState.lgAsm[which] = null;
    mbRenderLgAsm(true);
    if (typeof mbLibrarySave === 'function') mbLibrarySave();
}

/* ── Wiring ───────────────────────────────────────────────────── */

function _lgRepaintAll() {
    try { mbRenderLgUnit(); } catch (e) { /* not ready */ }
    try { mbRenderLgAsm(); } catch (e) { /* not ready */ }
    try { if (typeof mbRenderSheetKindSelect === 'function') mbRenderSheetKindSelect(); } catch (e) { /* not ready */ }
    try { if (typeof mbRepaintSheetNames === 'function') mbRepaintSheetNames(); } catch (e) { /* not ready */ }
    try { if (typeof mbSeqPaintNumberFields === 'function') mbSeqPaintNumberFields(); } catch (e) { /* not ready */ }
    try { mbLgPaintObjective(); } catch (e) { /* not ready */ }   // 3.67.0
}
window.addEventListener('mb:settingschange', function () { try { mbLgPaintObjective(); } catch (e) { /* not ready */ } });
window.addEventListener('mb:templatechange', _lgRepaintAll);
/* 3.69.0: the Reflection tab belongs to this template; a switch away
   from it while the tab is open goes back to the Module tab. */
window.addEventListener('mb:templatechange', function () {
    var t = document.getElementById('reflection-tab');
    if (!_lgOn() && t && t.classList.contains('active') && typeof switchTab === 'function') switchTab('basic-info');
});
window.addEventListener('mb:langchange', _lgRepaintAll);
window.addEventListener('mb:contentlangchange', _lgRepaintAll);
document.addEventListener('change', function (e) {
    if (e.target && e.target.id === 'activity-sheet-type') mbLgPaintProductPlaceholder();
});
