// ============================================================
// /src/bilang.js
// Bilingual content primitive — Schema v4.
//
// A multilingual value is a plain object: { en: '', ar: '', fr: '' }.
// The name «bilang» is historical — the primitive carried two sides when
// it was written and carries three now. Renaming it would have meant
// touching 341 call sites to say the same thing, so the file keeps its
// name and the CODE LIST is the single source of truth: every loop below
// walks BILANG_CODES, and adding a fourth language is one entry here
// plus one dictionary in mb-translations.js.
// Everything the user TYPES is a bilingual value. Everything the
// INTERFACE says is an i18n key and lives in translations.js. These are
// two different problems and must never share a mechanism: interface
// text is translated once by us for everyone, content is authored twice
// by the user for one module.
//
// Two independent switches result, and the distinction has to survive
// into the UI or it will confuse every user:
//   interfaceLang  — which language the buttons and labels are in.
//   contentLang    — which side of every { en, ar } pair the inputs are
//                    currently bound to.
// A curriculum developer routinely writes Arabic content while working
// in an English interface, or the reverse. Tying the two together would
// force them to relearn the tool every time they switch side.
// ============================================================

/* ── The pair ──────────────────────────────────────────────── */

/* ORDER IS MEANINGFUL. It is the fallback order used by biGet() when the
   requested side is empty, so English sits first as the language most
   likely to be readable by whoever opens a half-finished module. It is
   also the order the two language switches render their buttons in. */
var BILANG_CODES = ['en', 'ar', 'fr'];

/** A fresh empty value, one empty string per language. */
function biNew(en, ar, fr) {
    return { en: en || '', ar: ar || '', fr: fr || '' };
}

/** True for anything shaped like a multilingual value.

    Tests every code, but a value carrying ANY of them counts: files
    written before French existed hold { en, ar } and nothing else, and
    demanding all three would make every one of them unrecognisable —
    which is to say, would flatten every existing project to nothing. */
function biIs(v) {
    if (v === null || typeof v !== 'object' || Array.isArray(v)) return false;
    for (var i = 0; i < BILANG_CODES.length; i++) {
        if (BILANG_CODES[i] in v) return true;
    }
    return false;
}

/**
 * Read one side.
 *
 * Falls back to the other language when the requested side is empty,
 * because a half-translated module is the normal state of an in-progress
 * one — and a preview or an export that silently drops every untranslated
 * field looks like data loss to the person who typed it. `biGetStrict`
 * exists for the places that must NOT fall back: the completeness meter
 * and the bilingual side-by-side export, where an English string sitting
 * in the Arabic column is worse than a visible blank.
 */
function biGet(v, lang) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string') return v;          // legacy v3 value
    if (!biIs(v)) return String(v);
    var want = v[lang] || '';
    if (want.trim()) return want;
    /* Walk the code list rather than naming "the other one": with three
       languages there is no single other, and an author who has written
       only the Arabic side must not get an empty French export. */
    for (var i = 0; i < BILANG_CODES.length; i++) {
        var alt = v[BILANG_CODES[i]];
        if (typeof alt === 'string' && alt.trim()) return alt;
    }
    return '';
}

function biGetStrict(v, lang) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'string') return lang === 'en' ? v : '';
    return (biIs(v) && v[lang]) || '';
}

/** Write one side, upgrading a legacy string in place. */
function biSet(obj, key, lang, value) {
    var cur = obj[key];
    if (!biIs(cur)) cur = biNew(typeof cur === 'string' ? cur : '');
    cur[lang] = value;
    obj[key] = cur;
    return cur;
}

/** True when EVERY language carries text. */
function biComplete(v) {
    for (var i = 0; i < BILANG_CODES.length; i++) {
        if (!biGetStrict(v, BILANG_CODES[i]).trim()) return false;
    }
    return true;
}

/** True when no language does. */
function biEmpty(v) {
    for (var i = 0; i < BILANG_CODES.length; i++) {
        if (biGetStrict(v, BILANG_CODES[i]).trim()) return false;
    }
    return true;
}

/* Which languages are written right-to-left. A list, not `=== 'ar'`,
   for the same reason the interface engine keeps RTL_LANGS: the test is
   asked in five files and each one that hard-codes Arabic is a file that
   has to be found again when Kurdish or Farsi is added. */
var BILANG_RTL = ['ar'];

function biIsRtl(code) {
    return BILANG_RTL.indexOf(code || contentLang()) !== -1;
}

/* The name of a language, written in that language. Used by both
   switches; kept here so the two cannot disagree about what to call
   French. */
var BILANG_LABELS = { en: 'English', ar: '\u0627\u0644\u0639\u0631\u0628\u064a\u0629', fr: 'Fran\u00e7ais' };

function biLangLabel(code) {
    return BILANG_LABELS[code] || String(code || '').toUpperCase();
}

/* ── Which fields are bilingual ─────────────────────────────
   Listed explicitly rather than "upgrade every string found", because
   several fields must stay single-valued and upgrading them would be a
   silent data bug:

     sheetNumber, duration, version, level, id, *IdCounter
        — numbers and codes. «1.2» is «1.2» in both languages.
     image data URLs, mime types, file names.
     referencesData values
        — a bibliographic citation is reproduced in the script it was
          published in. Translating «Bloom, B.S. (1956)» into Arabic
          letters makes the source unfindable. The references TITLE is
          bilingual; the entries are not.

   Everything else the user types is a pair. ------------------------ */

var BILANG_FIELDS = {
    project:    ['coversAdditionalInfo', 'coversAdditionalNotes',
                 'introAdditionalDetails', 'assessmentContent',
                 'referencesTitle'],
    /* The framework card. Only the PROSE fields are pairs — an author
       writing an Arabic module still submits it to a body whose name
       has an Arabic and an English form. The rest are single-valued for
       the reason given above: `notionalHours` is a number, the two
       dates are ISO strings, and `qualificationType` and `rpl` store a
       CODE ('principal', 'yes') that the interface and the export each
       resolve to a word in their own language. Translating a code would
       break both. */
    /* 'unitTitle' stays listed even though the card no longer offers the
       field: a project file written while it did still carries the key,
       and it has to arrive as a PAIR for _mbTvqfAdoptUnitTitle() to read
       both sides off it. It is deleted from state on the first render
       after that; this line is only about how it is read in. */
    tvqfBasic:  ['unitTitle', 'frameworkName', 'awardingBody'],
    tvqfExt:    ['knowledge', 'skill', 'competence', 'entryRequirements',
                 'progression', 'assessmentMethod', 'alignmentNote'],
    coverRow:   ['label', 'value'],
    teamMember: ['name', 'role', 'organization'],
    module:     ['title', 'code', 'description'],
    outcome:    ['title', 'performanceCriteria'],   // PC is an array of pairs
    infoSheet:  ['title', 'objective'],
    contentSec: ['heading', 'text'],
    activity:   ['title', 'objective', 'criteriaTitle',
                 'criteriaInstruction', 'criteriaFooter'],
    step:       ['text'],
    resource:   ['text'],
    criterion:  null,        // bare array of strings → array of pairs
    assessment: ['criteria', 'method', 'evidence', 'remarks']
};

/* ── Migration v3 → v4 ──────────────────────────────────────
   Runs on load, never on save. Every project file a user already has on
   disk is v3, where each of these fields is a bare string authored in
   whichever language they were working in.

   That last part is the trap: we cannot know which. A v3 file made by an
   Iraqi developer is Arabic content sitting in fields we would otherwise
   default into `.en`. So the side is chosen by INSPECTING THE TEXT —
   presence of Arabic-block codepoints — per field, not per project,
   because mixed files are common (English headings, Arabic body).

   Migration is idempotent: a v4 file passed through it is unchanged. */

var _ARABIC_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

function biDetectLang(s) {
    return _ARABIC_RE.test(String(s || '')) ? 'ar' : 'en';
}

/** Upgrade one bare value to a pair, guessing its side. */
function biUpgrade(v) {
    if (biIs(v)) return v;                       // already v4
    var s = (v === null || v === undefined) ? '' : String(v);
    return biDetectLang(s) === 'ar' ? biNew('', s) : biNew(s, '');
}

/** Upgrade the listed keys of one object, in place. */
function biUpgradeFields(obj, fields) {
    if (!obj || !fields) return obj;
    fields.forEach(function (k) {
        if (k in obj) {
            if (Array.isArray(obj[k])) obj[k] = obj[k].map(biUpgrade);
            else obj[k] = biUpgrade(obj[k]);
        }
    });
    return obj;
}

/**
 * Migrate a whole loaded project object from v3 to v4.
 * Returns the same object, mutated, with schemaVersion set.
 */
function biMigrateProject(data) {
    if (!data || typeof data !== 'object') return data;
    if (data.schemaVersion === 4) return data;               // idempotent

    biUpgradeFields(data, BILANG_FIELDS.project);
    if (data.tvqfBasic)    biUpgradeFields(data.tvqfBasic,    BILANG_FIELDS.tvqfBasic);
    if (data.tvqfExtended) biUpgradeFields(data.tvqfExtended, BILANG_FIELDS.tvqfExt);
    (data.coverRows   || []).forEach(function (r) { biUpgradeFields(r, BILANG_FIELDS.coverRow); });
    (data.teamMembers || []).forEach(function (m) { biUpgradeFields(m, BILANG_FIELDS.teamMember); });

    (data.modules || []).forEach(function (mod) {
        biUpgradeFields(mod, BILANG_FIELDS.module);
        (mod.outcomes || mod.learningOutcomes || []).forEach(function (lo) {
            biUpgradeFields(lo, BILANG_FIELDS.outcome);
            (lo.infoSheets || []).forEach(function (sh) {
                biUpgradeFields(sh, BILANG_FIELDS.infoSheet);
                (sh.contentSections || []).forEach(function (cs) {
                    biUpgradeFields(cs, BILANG_FIELDS.contentSec);
                });
            });
            (lo.activitySheets || []).forEach(function (act) {
                biUpgradeFields(act, BILANG_FIELDS.activity);
                (act.steps     || []).forEach(function (s) { biUpgradeFields(s, BILANG_FIELDS.step); });
                (act.resources || []).forEach(function (r) { biUpgradeFields(r, BILANG_FIELDS.resource); });
                if (Array.isArray(act.criteria)) act.criteria = act.criteria.map(biUpgrade);
            });
        });
    });

    Object.keys(data.assessmentFormsData || {}).forEach(function (loId) {
        var form = data.assessmentFormsData[loId];
        (form.rows || []).forEach(function (row) {
            biUpgradeFields(row, BILANG_FIELDS.assessment);
        });
    });

    data.schemaVersion = 4;
    return data;
}

/* ── Content language switch ────────────────────────────────
   Kept out of mbState on purpose: it is a view setting, not project
   data. A module authored by one person and opened by another must not
   force the second person into the first person's editing side. */

/* Key lives in MB_KEYS now; persistence.js owns the backend. */

function contentLang() {
    var v = mbGetSetting(MB_KEYS.contentLang);
    if (BILANG_CODES.indexOf(v) !== -1) return v;
    /* No stored choice yet: follow the interface language rather than
       defaulting to English. Someone who has just set the interface to
       Arabic is about to type Arabic, and starting them in a
       left-aligned field where Home/End and the arrow keys run the wrong
       way is a bad first minute. The moment they touch the switch their
       choice is stored and the two go independent again — which is the
       point of having two settings. */
    var ui = (window.i18n && window.i18n.getLang) ? window.i18n.getLang() : 'en';
    return BILANG_CODES.indexOf(ui) !== -1 ? ui : 'en';
}

function setContentLang(code) {
    if (BILANG_CODES.indexOf(code) === -1) return;
    /* Flush the DOM into state BEFORE the swap. Every bilingual input is
       still read from the DOM at save time in this build (341 call sites),
       so switching sides without this would write the English text into
       the Arabic slot on the next save. This single line is why the
       switch must not be wired until the bound-field pass is done. */
    if (typeof saveCurrentSheetToLO === 'function' && mbState.currentLOId) saveCurrentSheetToLO();
    mbSetSetting(MB_KEYS.contentLang, code);
    window.dispatchEvent(new CustomEvent('mb:contentlangchange', { detail: { lang: code } }));
}

/* ── Merge helpers for the DOM→state collectors ─────────────
   The v2 collectors REBUILD each sheet object from the DOM and replace
   the stored one. Under a bilingual schema that is destructive: the DOM
   holds one side only, so a rebuild silently wipes whatever was typed in
   the other language. Every collector therefore has to MERGE — keep the
   stored pair, overwrite only the active side. ------------------------ */

/** Write the active side of `key` on `target` from a DOM value. */
function biPut(target, key, value) {
    return biSet(target, key, contentLang(), value);
}

/**
 * Merge a rebuilt array of items into the stored one, by position.
 *
 * Position is the only identity these items have — steps, criteria and
 * content sections are ordered lists with no stable id across a reload.
 * That makes reordering in one language a real hazard: move step 3 above
 * step 2 while editing in Arabic and the English halves stay put, so the
 * pairs cross. Until the sheets carry per-item ids (Phase 3), the
 * bilingual editor must not offer reordering — the drag handles stay off
 * in dual-language projects.
 *
 * `fields` are the bilingual keys on each item; everything else on the
 * incoming item (marks, tables, ids, quantities) overwrites wholesale,
 * since it is language-neutral by construction.
 */
function biMergeArray(stored, incoming, fields) {
    stored = Array.isArray(stored) ? stored : [];
    return incoming.map(function (item, i) {
        var prev = stored[i] && typeof stored[i] === 'object' ? stored[i] : {};
        var out  = {};
        Object.keys(prev).forEach(function (k) { out[k] = prev[k]; });
        Object.keys(item).forEach(function (k) {
            if (fields.indexOf(k) === -1) out[k] = item[k];
        });
        fields.forEach(function (k) {
            if (k in item) biPut(out, k, item[k]);
        });
        return out;
    });
}

/** The same, for a bare array of strings (activity criteria). */
function biMergeStrings(stored, incoming) {
    stored = Array.isArray(stored) ? stored : [];
    var lang = contentLang();
    return incoming.map(function (text, i) {
        var pair = biIs(stored[i]) ? stored[i] : biUpgrade(stored[i]);
        pair[lang] = text;
        return pair;
    });
}

/** True when a bilingual field has text on the ACTIVE side. */
function biHasActive(v) {
    return !!biGetStrict(v, contentLang()).trim();
}

/* ── Flatten for export ─────────────────────────────────────
   The DOCX generator is 1,590 lines that read `sheet.title` and
   `step.text` as plain strings, in roughly sixty places. Teaching each
   of them about pairs would mean sixty chances to miss one — and a
   missed one prints "[object Object]" into a client's module.

   Instead the whole state is projected down to ONE language once, at the
   top of the export, and the generator keeps reading plain strings
   exactly as before. Since the export is single-language by design, this
   is not a workaround; it is the correct shape for the job.

   biGet (not biGetStrict) is used deliberately: a field the author only
   ever filled in on one side still appears, rather than leaving a hole
   in a deliverable. */
function biFlattenDeep(value, lang) {
    if (value === null || value === undefined) return value;
    if (biIs(value)) return biGet(value, lang);
    if (Array.isArray(value)) return value.map(function (v) { return biFlattenDeep(v, lang); });
    if (typeof value === 'object') {
        var out = {};
        Object.keys(value).forEach(function (k) { out[k] = biFlattenDeep(value[k], lang); });
        return out;
    }
    return value;
}

/* Export language. Defaults to whichever side the author is editing,
   which is the one they can see and check. */


function exportLang() {
    var v = mbGetSetting(MB_KEYS.exportLang);
    return BILANG_CODES.indexOf(v) !== -1 ? v : contentLang();
}

function setExportLang(code) {
    if (BILANG_CODES.indexOf(code) !== -1) mbSetSetting(MB_KEYS.exportLang, code);
}

/* ── Which side of a project file holds the content ──────────
   A v4 project is not "an Arabic file". Every text is a triple
   { en, ar, fr } and an Arabic-authored module is one where `ar` is
   filled and the other two are empty. So the question on import is not
   what language the letters are in — it is which SIDE has anything at
   all. English technical terms inside an Arabic sentence live in
   `ar`, so a module full of "PDR" and "GPR" still reads as Arabic here;
   nothing inspects the characters.

   This matters because contentLang() is a per-BROWSER setting, not part
   of the project. Open an Arabic module in a browser last used for an
   English one and every field renders from the empty `en` side: the
   whole module looks lost. Worse, typing anything then saves onto `en`
   while the Arabic sits untouched in the file, invisible.

   Primary source is the explicit `contentLang` that saveWork now writes.
   The scan below is only for files saved before that field existed —
   the ones already on your disk from testing. */

function mbProjectContentLang(data) {
    if (!data) return null;
    if (BILANG_CODES.indexOf(data.contentLang) !== -1) return data.contentLang;

    /* Flatten the whole project onto each side in turn and measure what
       is there. Length, not a boolean: a side may carry a word or two
       left behind by an experiment with the switch, and the winner
       should be the side that actually holds the module. */
    var best = null, bestLen = 0;
    BILANG_CODES.forEach(function (code) {
        var len = 0;
        try {
            var flat = biFlattenDeep(data, code);
            len = JSON.stringify(flat, function (k, v) {
                /* Base64 cover and step images would swamp the count and
                   are identical on every side anyway. */
                return (typeof v === 'string' && v.lastIndexOf('data:', 0) === 0) ? '' : v;
            }).length;
        } catch (e) { len = 0; }
        if (len > bestLen) { bestLen = len; best = code; }
    });
    return best;
}

/**
 * Adopt a project's language WITHOUT the normal switch machinery.
 *
 * setContentLang() flushes the screen into state first, and the
 * mb:contentlangchange listeners reload the sheets. Both are correct for
 * a user-initiated switch and both are wrong here: at import time the
 * screen still holds the PREVIOUS project, so flushing would write its
 * leftovers into the file being opened. This writes the setting and
 * nothing else; the import that follows repaints everything anyway.
 */
function mbAdoptProjectLang(code) {
    if (BILANG_CODES.indexOf(code) === -1) return;
    mbSetSetting(MB_KEYS.contentLang, code);
    if (window.i18n && typeof window.i18n.setLang === 'function' &&
        window.i18n.getLang() !== code) {
        window.i18n.setLang(code);
    }
}
