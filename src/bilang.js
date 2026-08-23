// ============================================================
// /src/bilang.js
// Bilingual content primitive — Schema v4.
//
// A bilingual value is a plain object: { en: '', ar: '' }.
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

var BILANG_CODES = ['en', 'ar'];

/** A fresh empty pair. */
function biNew(en, ar) {
    return { en: en || '', ar: ar || '' };
}

/** True for anything shaped like a bilingual pair. */
function biIs(v) {
    return v !== null && typeof v === 'object' && !Array.isArray(v) &&
           ('en' in v || 'ar' in v);
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
    var want  = v[lang] || '';
    if (want.trim()) return want;
    var other = lang === 'ar' ? v.en : v.ar;
    return other || '';
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

/** True when both sides carry text. */
function biComplete(v) {
    return !!(biGetStrict(v, 'en').trim() && biGetStrict(v, 'ar').trim());
}

/** True when at least one side does. */
function biEmpty(v) {
    return !biGetStrict(v, 'en').trim() && !biGetStrict(v, 'ar').trim();
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
