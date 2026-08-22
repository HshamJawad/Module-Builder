// ============================================================
// /src/uid.js
// Stable per-item identity for the reorderable arrays.
//
// WHY THIS EXISTS
// Steps, activity criteria, resources and content sections are ordered
// arrays. Until now their only identity was their POSITION: the
// collectors merged the DOM back into state by index. That is fine in a
// single-language tool, and quietly corrupting in a bilingual one —
// move step 3 above step 2 while editing Arabic and the English halves
// stay where they were, so `{ en: 'Wear PPE', ar: 'افحص الأسلاك' }`.
// The pairs cross, and nothing warns anyone; it surfaces when a client
// opens the English export and finds the steps scrambled.
//
// Reordering has therefore been disabled in bilingual projects since
// Schema v4. This module is what lifts that restriction.
//
// The ids are opaque strings, not integers, and never reused. An integer
// counter reintroduces the same bug through the back door the moment two
// projects are merged or a module is imported from DACUM: two items
// legitimately hold id 3 and one silently overwrites the other.
// ============================================================

/* Not crypto.randomUUID(): that is unavailable on plain http:// origins
   in Chrome, and this tool is routinely opened from a file:// path or an
   intranet share. Collision resistance needed here is "two items in one
   project", not "two items on earth". */
function mbUid() {
    return 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Item arrays that carry stable ids, and the DOM attribute each uses. */
var UID_ARRAYS = {
    steps:           'data-step-id',
    resources:       'data-resource-id',
    criteria:        'data-criteria-id',
    contentSections: 'data-content-id'
};

/**
 * Ensure every item in an array has a `uid`.
 * Bare strings (activity criteria before v4) are lifted to objects only
 * by biUpgrade; here they are left alone and handled by index, because a
 * string cannot carry an id.
 */
function mbEnsureUids(arr) {
    if (!Array.isArray(arr)) return arr;
    arr.forEach(function (item) {
        if (item && typeof item === 'object' && !item.uid) item.uid = mbUid();
    });
    return arr;
}

/**
 * Stamp ids across a whole loaded project.
 *
 * Runs after biMigrateProject, on load only. Items that already have a
 * uid keep it — this is idempotent, and a project saved by a newer build
 * must not have its identities reshuffled by an older one.
 */
function mbAssignProjectUids(data) {
    if (!data || typeof data !== 'object') return data;

    (data.modules || []).forEach(function (mod) {
        (mod.outcomes || mod.learningOutcomes || []).forEach(function (lo) {
            (lo.infoSheets || []).forEach(function (sh) {
                mbEnsureUids(sh.contentSections);
            });
            (lo.activitySheets || []).forEach(function (act) {
                mbEnsureUids(act.steps);
                mbEnsureUids(act.resources);
                /* act.criteria is an array of bare { en, ar } pairs — a
                   pair is an object, so it can carry a uid without any
                   change to its shape. */
                mbEnsureUids(act.criteria);
            });
        });
    });
    return data;
}

/**
 * Read the uid a rendered row is carrying.
 *
 * The renderers stamp `data-uid` when they build a row from stored data,
 * and `mbNewRowUid()` supplies one for rows the user adds. A row without
 * one is a row built by code that predates this module; the collectors
 * fall back to position for those, which is the old behaviour and no
 * worse than before.
 */
function mbRowUid(el) {
    if (!el) return null;
    if (el.dataset && el.dataset.uid) return el.dataset.uid;
    var host = el.closest ? el.closest('[data-uid]') : null;
    return host ? host.dataset.uid : null;
}

/** Stamp a fresh uid on a row the user just created. */
function mbNewRowUid(el) {
    if (!el) return null;
    var id = mbUid();
    if (el.dataset) el.dataset.uid = id;
    return id;
}

/**
 * Merge DOM rows into stored items BY IDENTITY rather than position.
 *
 * This is the function that makes reordering safe. `incoming` items each
 * carry the uid of the row they came from; the stored pair with that uid
 * is found wherever it now sits, the active language side is overwritten
 * on it, and the result is returned in the DOM's order — so a reorder in
 * Arabic moves the English half with it.
 *
 * Items whose uid is unknown (newly added rows) are appended as new
 * pairs. Items in `stored` whose uid did not come back were deleted in
 * the editor and are dropped — deliberately, since a "keep anything not
 * seen" rule would resurrect deleted steps on every save.
 */
function biMergeArrayById(stored, incoming, fields) {
    stored = Array.isArray(stored) ? stored : [];
    var byId = {};
    stored.forEach(function (item) {
        if (item && typeof item === 'object' && item.uid) byId[item.uid] = item;
    });

    return incoming.map(function (item, i) {
        var prev = (item.uid && byId[item.uid]) ||
                   /* No uid: fall back to position, which is exactly the
                      old behaviour and correct for a project that has not
                      been reordered. */
                   (stored[i] && typeof stored[i] === 'object' ? stored[i] : {});

        var out = {};
        Object.keys(prev).forEach(function (k) { out[k] = prev[k]; });
        Object.keys(item).forEach(function (k) {
            if (fields.indexOf(k) === -1) out[k] = item[k];
        });
        fields.forEach(function (k) {
            if (k in item) biPut(out, k, item[k]);
        });
        if (!out.uid) out.uid = item.uid || mbUid();
        return out;
    });
}

/** The bare-pair version, for activity criteria. */
function biMergeStringsById(stored, incoming) {
    stored = Array.isArray(stored) ? stored : [];
    var lang = contentLang();
    var byId = {};
    stored.forEach(function (p) { if (p && p.uid) byId[p.uid] = p; });

    return incoming.map(function (entry, i) {
        var text = (typeof entry === 'string') ? entry : entry.text;
        var uid  = (typeof entry === 'string') ? null   : entry.uid;
        var pair = (uid && byId[uid]) ||
                   (biIs(stored[i]) ? stored[i] : biUpgrade(stored[i]));
        if (!biIs(pair)) pair = biUpgrade(pair);
        pair[lang] = text;
        if (!pair.uid) pair.uid = uid || mbUid();
        return pair;
    });
}

/**
 * Whether reordering may be offered.
 *
 * Kept as a function rather than a constant because the answer changes
 * during a session: a project loaded from an old file has no uids until
 * it is saved once under the new schema.
 */
function mbReorderSafe(items) {
    if (!Array.isArray(items) || items.length < 2) return true;
    return items.every(function (it) { return it && typeof it === 'object' && it.uid; });
}

/**
 * Put a stored uid back onto a freshly rendered row.
 *
 * The loaders call addStep()/addResource()/... to build rows, and those
 * mint a NEW uid because from their point of view the row is new. The
 * stored identity has to be written back over it, or the collector sees
 * an unrecognised uid on every load and treats the whole array as
 * newly-created — which discards the other language's halves.
 */
function mbRestoreRowUid(el, uid) {
    if (!el || !uid) return;
    var host = (el.dataset && el.dataset.uid) ? el
             : (el.closest ? el.closest('[data-uid]') : null);
    if (host) host.dataset.uid = uid;
}
