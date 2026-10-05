// ============================================================
// /src/module_library.js
// The module library: projects of any number of modules, with only ONE
// module open — and in memory — at a time.
//
// WHAT CHANGES FOR THE REST OF THE TOOL
// Almost nothing, on purpose. mbState keeps its shape:
//
//   mbState.modulesData   still lists every module of the project, but
//                         only the open one is complete. The others are
//                         light copies (mbModuleSkeleton): title, code,
//                         level, Task Analysis, outcomes and criteria —
//                         what the module selectors, ta_finder.js and
//                         module-ai.js read about modules that are not
//                         open — and no sheets.
//   mbState.assessmentFormsData   holds the open module's forms only.
//
// Every exporter already works on the open module alone, so the
// exports need no change. What changed is what is FETCHED and WRITTEN:
// opening a module reads one record, and autosave writes the open
// module's record (plus the shared project data or the project record
// only when those changed). The cost of a keystroke no longer depends on
// how many modules the project has.
//
// THE ONE RULE
// A module is opened through mbLibraryOpenModule() and nowhere else. It
// saves the module being left, swaps it for its light copy, reads the
// chosen one and paints it. Every module selector in the interface goes
// through it.
//
// Storage is project_store.js; the identity card and measurements are
// module_card.js; the list the user sees is module_library_ui.js.
// ============================================================

var mbLib = {
    enabled: false,      // IndexedDB available — false keeps everything in memory
    booted: false,
    project: null,       // the open project's record
    openId: null,        // the module that is complete in memory
    heads: {},           // mid → head record (skeleton, card, stats)
    cards: {},           // mid → last saved card
    fps: { modules: {}, shared: null, meta: null },  // what was last written
    openHashes: [],      // pictures of the open module (object URLs alive)
    sharedHashes: []     // pictures of the shared data (the covers)
};

/* All reads and writes run one after another. Two module switches in a
   quick double click must not interleave: the second would demote a
   module the first had not finished loading. */
var _mbLibChain = Promise.resolve();
function _mbLibQueue(fn) {
    var run = _mbLibChain.then(fn, fn);
    _mbLibChain = run.catch(function (e) { console.error('[Library]', e); });
    return run;
}

function _mbLibEmit() {
    window.dispatchEvent(new CustomEvent('mb:librarychanged'));
}

function _mbLibT(key, vars) {
    if (!window.i18n) return key;
    return vars ? window.i18n.tf(key, vars) : window.i18n.t(key);
}

function _mbNewProjectId() {
    return 'prj_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
}

/* ══════════════════════════════════════════════════════════════
   SHARED PROJECT DATA — cover, team, introduction, references
   ══════════════════════════════════════════════════════════════ */

/** The shared half of the project, read from state. The caller flushes
 *  the forms into state first (_mbLibFlush). */
function mbCollectShared() {
    return {
        coversAdditionalInfo:   mbState.coversAdditionalInfo,
        coversAdditionalNotes:  mbState.coversAdditionalNotes,
        frontCoverImage:        mbState.frontCoverImage  || null,
        backCoverImage:         mbState.backCoverImage   || null,
        coverRows:              mbState.coverRows        || [],
        coverRowIdCounter:      mbState.coverRowIdCounter || 8,
        coverFrameworkSeeded:   !!mbState.coverFrameworkSeeded,
        teamMembers:            mbState.teamMembers      || [],
        teamMemberIdCounter:    mbState.teamMemberIdCounter || 0,
        introAdditionalDetails: mbState.introAdditionalDetails,
        introBlocks:            mbState.introBlocks      || [],
        includeLearningGuide:   !!mbState.includeLearningGuide,
        assessmentContent:      mbState.assessmentContent,
        referencesTitle:        mbState.referencesTitle  || null,
        referencesData:         mbState.referencesData   || [],
        refIdCounter:           mbState.refIdCounter     || 1,
        tvqfBasic:              mbState.tvqfBasic        || {},
        tvqfExtended:           mbState.tvqfExtended     || {}
    };
}

/** What a project that nobody has written in yet holds. Same values
 *  Clear All resets to (storage.js). */
function _mbDefaultShared() {
    var order = (typeof MB_COVER_ROW_ORDER !== 'undefined') ? MB_COVER_ROW_ORDER : [];
    return {
        coversAdditionalInfo: biNew(), coversAdditionalNotes: biNew(),
        frontCoverImage: null, backCoverImage: null,
        coverRows: order.map(function (key, i) { return mbMakeCoverRow(key, i + 1); }),
        coverRowIdCounter: order.length,
        coverFrameworkSeeded: true,
        teamMembers: [], teamMemberIdCounter: 0,
        introAdditionalDetails: biNew(), introBlocks: [], includeLearningGuide: false,
        assessmentContent: biNew(),
        referencesTitle: null, referencesData: [{ id: 1, value: '' }], refIdCounter: 1,
        tvqfBasic: {}, tvqfExtended: {}
    };
}

/**
 * Shared data → state → screen. Was autosave.js's restore listener; the
 * module half of that listener is mbLibraryOpenModule now.
 */
function mbApplyProjectShared(data) {
    data = data || _mbDefaultShared();
    try {
        mbState.coversAdditionalInfo  = biUpgrade(data.coversAdditionalInfo);
        mbState.coversAdditionalNotes = biUpgrade(data.coversAdditionalNotes);

        mbState.frontCoverImage = data.frontCoverImage || null;
        mbState.backCoverImage  = data.backCoverImage  || null;
        if (typeof _showCoverPreview === 'function' && document.getElementById('front-cover-preview')) {
            if (mbState.frontCoverImage) _showCoverPreview('front', mbState.frontCoverImage);
            else deleteFrontCoverImage();
            if (mbState.backCoverImage) _showCoverPreview('back', mbState.backCoverImage);
            else deleteBackCoverImage();
        }
        mbState.coverRows            = data.coverRows || _mbDefaultShared().coverRows;
        mbState.coverRowIdCounter    = data.coverRowIdCounter || mbState.coverRows.length;
        mbState.coverFrameworkSeeded = !!data.coverFrameworkSeeded;

        mbState.teamMembers         = data.teamMembers || [];
        mbState.teamMemberIdCounter = data.teamMemberIdCounter || 0;
        if (typeof renderWorkTeam === 'function') renderWorkTeam();

        mbState.introAdditionalDetails = biUpgrade(data.introAdditionalDetails);
        mbState.introBlocks = (typeof mbNormalizeBlocks === 'function') ? mbNormalizeBlocks(data.introBlocks) : (data.introBlocks || []);
        mbState.includeLearningGuide = !!data.includeLearningGuide;
        if (typeof mbRenderLearningGuideToggle === 'function') mbRenderLearningGuideToggle();

        mbState.assessmentContent = biUpgrade(data.assessmentContent);
        if (typeof applyProjectTextToDOM === 'function') applyProjectTextToDOM();

        /* null, never a literal: null is what mbSeedReferencesTitle()
           waits for to fill both sides from the dictionary. */
        mbState.referencesTitle = data.referencesTitle ? biUpgrade(data.referencesTitle) : null;
        mbState.referencesData  = data.referencesData || [{ id: 1, value: '' }];
        mbState.refIdCounter    = data.refIdCounter || 1;
        if (typeof mbSeedReferencesTitle === 'function') mbSeedReferencesTitle();
        if (typeof renderReferences === 'function') renderReferences();

        /* Read before the cover table is drawn: renderCoverTable() is
           what migrates a retired framework card onto the rows. */
        mbState.tvqfBasic    = data.tvqfBasic    || {};
        mbState.tvqfExtended = data.tvqfExtended || {};
        if (typeof renderCoverTable === 'function') renderCoverTable();
    } catch (err) {
        console.warn('[Library] shared data apply error:', err);
    }
}

/* ══════════════════════════════════════════════════════════════
   MODULE-SPECIFIC COVER ROWS
   Unit title, module code, level, hours and entry requirements describe
   ONE module. They used to be project rows, so the cover of module 5
   showed whatever had been typed for module 1. Now each module keeps its
   own values (module.coverValues) and they are put on the table when the
   module is opened; a module that never had any gets DACUM's.
   ══════════════════════════════════════════════════════════════ */

function _mbCoverRow(key) {
    if (typeof _mbCoverRowByKey === 'function') return _mbCoverRowByKey(key);
    return (mbState.coverRows || []).find(function (r) { return r.seedKey === key || r.field === key; }) || null;
}

function _mbClone(v) {
    return (v === undefined) ? undefined : JSON.parse(JSON.stringify(v));
}

/** Table → module. Called before every save of the open module. */
function _mbStashModuleCover(module) {
    if (!module) return;
    var vals = {};
    MB_MODULE_COVER_KEYS.forEach(function (key) {
        var row = _mbCoverRow(key);
        if (row) vals[key] = _mbClone(row.value);
    });
    module.coverValues = vals;
}

/** What DACUM says about a module, for a module that has no own values yet. */
function _mbModuleCoverDefaults(module) {
    var cur = module.curriculum || {};
    return {
        cvUnitTitle:  mbPlainText(module.title),
        cvModuleCode: module.moduleCode || '',
        cvLevel:      module.level ? String(module.level) : '',
        cvHours:      cur.totalHours ? String(cur.totalHours) : '',
        cvEntryReq:   Array.isArray(cur.prerequisites) ? cur.prerequisites.join('\n') : ''
    };
}

/** Module → table. */
function _mbApplyModuleCover(module) {
    if (!module || !Array.isArray(mbState.coverRows)) return;
    var codes = (typeof BILANG_CODES !== 'undefined' && BILANG_CODES.length) ? BILANG_CODES : ['en', 'ar', 'fr'];
    var own = module.coverValues || null;
    var dflt = own ? null : _mbModuleCoverDefaults(module);
    MB_MODULE_COVER_KEYS.forEach(function (key) {
        var row = _mbCoverRow(key);
        if (!row) return;
        if (own && Object.prototype.hasOwnProperty.call(own, key)) {
            row.value = _mbClone(own[key]) || biNew();
            return;
        }
        row.value = biNew();
        var text = String((dflt || {})[key] || '').trim();
        if (text) codes.forEach(function (c) { row.value[c] = text; });
    });
    if (typeof renderCoverTable === 'function') renderCoverTable();
}

/* ══════════════════════════════════════════════════════════════
   SAVE
   ══════════════════════════════════════════════════════════════ */

/** Forms on screen → state. The same list autosave always flushed. */
function _mbLibFlush() {
    try {
        if (mbState.currentLOId && typeof saveCurrentSheetToLO === 'function') saveCurrentSheetToLO();
        if (typeof saveCurrentModuleLOData === 'function') saveCurrentModuleLOData();
        if (typeof saveCoverData === 'function') saveCoverData();
        if (typeof saveWorkTeamData === 'function') saveWorkTeamData();
        if (typeof syncProjectTextFromDOM === 'function') syncProjectTextFromDOM();
    } catch (e) { console.warn('[Library] flush error:', e); }
}

function _mbOpenModuleObj() {
    if (!mbLib.openId) return null;
    return (mbState.modulesData || []).find(function (m) { return m.id === mbLib.openId; }) || null;
}

/** The open module's assessment forms — the ones keyed by its outcomes. */
function _mbFormsOf(module) {
    var out = {};
    var all = mbState.assessmentFormsData || {};
    (module.learningOutcomes || []).forEach(function (lo) {
        if (all[lo.id]) out[lo.id] = all[lo.id];
    });
    return out;
}

function _mbFromDacum(module) {
    return !!(module.taskAnalysisSource || module.moduleCode || module.source === 'dacum');
}

/**
 * Write a module that is ALREADY in stored form (pictures as references)
 * — head and body in one transaction. `project` defaults to the open one;
 * the package import also writes into projects that are not open.
 */
function _mbWriteStored(modS, formsS, hashes, imgBytes, card, project, fp) {
    project = project || mbLib.project;
    var f = fp || mbFingerprint([modS, formsS]);
    var stats = mbModuleStats(modS, formsS);
    stats.bytes = f.bytes + (imgBytes || 0);
    stats.images = (hashes || []).length;
    var head = {
        pid: project.id, mid: modS.id,
        skeleton: mbModuleSkeleton(modS),
        card: card, stats: stats,
        images: hashes || [],
        fromDacum: _mbFromDacum(modS)
    };
    var body = { pid: project.id, mid: modS.id, module: modS, assessmentForms: formsS, card: card };
    return mbStore.putModule(head, body).then(function () {
        if (mbLib.project && project.id === mbLib.project.id) {
            mbLib.heads[modS.id] = head;
            mbLib.cards[modS.id] = card;
            mbLib.fps.modules[modS.id] = f.fp;
        }
        return head;
    });
}

/**
 * Writes one complete module as it is in memory: its pictures become
 * Blobs and references on the way. Used for modules written without
 * being opened (DACUM import, the 3.11 snapshot).
 *   opts.keepCard  write `prevCard` unchanged (a migration, not an edit)
 *   opts.project   another project than the open one
 */
function _mbWriteModule(module, forms, prevCard, opts) {
    opts = opts || {};
    var project = opts.project || mbLib.project;
    return mbImages.dehydrate([module, forms]).then(function (d) {
        var card = (opts.keepCard && prevCard) ? prevCard : mbMakeModuleCard(project, module, prevCard);
        return _mbWriteStored(d.value[0], d.value[1], d.hashes, d.bytes, card, project);
    });
}

function _mbMetaSnapshot() {
    var p = mbLib.project;
    p.moduleOrder     = (mbState.modulesData || []).map(function (m) { return m.id; });
    p.currentModuleId = mbLib.openId || null;
    p.moduleIdCounter = mbState.moduleIdCounter || 0;
    p.loIdCounter     = mbState.loIdCounter || 0;
    return p;
}

async function _mbSaveNow(force) {
    if (!mbLib.enabled || !mbLib.project) return { changed: false };
    _mbLibFlush();
    var changed = false;
    var project = mbLib.project;

    /* The open module — only if something in it changed. The comparison
       is made on the STORED form (pictures as references), so a picture
       shown from a Blob, or turned back into a data URL for an export,
       does not count as a change. */
    var mod = _mbOpenModuleObj();
    if (mod) {
        _mbStashModuleCover(mod);
        var forms = _mbFormsOf(mod);
        var d = await mbImages.dehydrate([mod, forms]);
        var f = mbFingerprint(d.value);
        if (force || f.fp !== mbLib.fps.modules[mod.id]) {
            changed = true;
            var card = mbMakeModuleCard(project, mod, mbLib.cards[mod.id]);
            await _mbWriteStored(d.value[0], d.value[1], d.hashes, d.bytes, card, project, f);
        }
        mbLib.openHashes = d.hashes;
    }

    /* Shared data, the covers' pictures as references too. */
    var ds = await mbImages.dehydrate(mbCollectShared());
    var fs = mbFingerprint(ds.value);
    if (force || fs.fp !== mbLib.fps.shared) {
        changed = true;
        await mbStore.putShared(project.id, ds.value, ds.hashes);
        mbLib.fps.shared = fs.fp;
    }
    mbLib.sharedHashes = ds.hashes;

    /* Project record: order, open module, counters. */
    var meta = _mbMetaSnapshot();
    var fm = mbFingerprint([meta.moduleOrder, meta.currentModuleId, meta.moduleIdCounter, meta.loIdCounter,
                            meta.name, meta.programId, meta.programName]).fp;
    if (force || changed || fm !== mbLib.fps.meta) {
        meta.updatedAt = changed ? Date.now() : (meta.updatedAt || Date.now());
        await mbStore.putProject(meta);
        mbLib.fps.meta = fm;
    }
    if (changed) _mbLibEmit();
    return { changed: changed };
}

/**
 * Save what is open. Cheap when nothing changed: one walk of the open
 * module and of the shared data, no write.
 */
function mbLibrarySave(opts) {
    var force = !!(opts && opts.force);
    return _mbLibQueue(function () { return _mbSaveNow(force); });
}

/* ══════════════════════════════════════════════════════════════
   OPEN A MODULE
   ══════════════════════════════════════════════════════════════ */

/** Paint the open module: outcomes, sheets, assessment, summaries. */
function _mbRenderOpenModule() {
    if (typeof syncLearningOutcomesFromCurrentModule === 'function') syncLearningOutcomesFromCurrentModule();
    mbState.currentLOId = null;
    mbState.currentInfoSheetIndex = 0;
    mbState.currentActivitySheetIndex = 0;
    if (mbState.learningOutcomesData.length > 0) {
        mbState.currentLOId = mbState.learningOutcomesData[0].id;
    }
    if (typeof renderModuleSelector === 'function') renderModuleSelector();
    if (typeof renderLOSelector === 'function') renderLOSelector();
    ['current-lo-selector', 'info-lo-selector', 'activity-lo-selector'].forEach(function (id) {
        var s = document.getElementById(id);
        if (s && mbState.currentLOId) s.value = mbState.currentLOId;
    });
    if (mbState.currentLOId) {
        if (typeof loadCurrentLOSheets === 'function') loadCurrentLOSheets();
    } else if (typeof clearAllForms === 'function') {
        clearAllForms();
    }
    if (typeof updateModuleSummary === 'function') updateModuleSummary();
    if (typeof renderAssessmentForms === 'function') renderAssessmentForms();
    /* A pending Training Structure Mapping proposal belongs to the module
       it was built for. */
    mbState.structureProposal = null;
    if (typeof renderStructureProposal === 'function') renderStructureProposal();
    if (typeof renderSourceBrowser === 'function') renderSourceBrowser();
    if (typeof renderAssignedItemsPanel === 'function') renderAssignedItemsPanel();
    if (typeof mbRenderTaskAnalysisIndex === 'function') mbRenderTaskAnalysisIndex();
}

/** Swap the open module for its light copy. Its record is already saved. */
function _mbDemoteOpen() {
    /* In memory (no IndexedDB) there is nowhere to read it back from. */
    if (!mbLib.openId || !mbLib.enabled) return;
    var list = mbState.modulesData || [];
    var i = list.findIndex(function (m) { return m.id === mbLib.openId; });
    if (i !== -1) list[i] = mbModuleSkeleton(list[i]);
    mbLib.openId = null;
    mbState.assessmentFormsData = {};
}

/**
 * opts.noSave  do not save the open module first — it was just replaced
 *              in storage (a package import) and memory is the stale copy.
 */
async function _mbOpenNow(mid, opts) {
    opts = opts || {};
    var list = mbState.modulesData || [];
    if (list.findIndex(function (m) { return m.id === mid; }) === -1) return false;

    if (!mbLib.enabled) {
        /* In memory every module is complete: the old switch. */
        mbLib.openId = mid;
        mbState.currentModuleId = mid;
        _mbApplyModuleCover(list.find(function (m) { return m.id === mid; }));
        _mbRenderOpenModule();
        return true;
    }

    if (!opts.noSave) await _mbSaveNow(false);
    if (mbLib.openId === mid && !opts.noSave) { _mbRenderOpenModule(); return true; }
    if (opts.noSave && mbLib.openId) {
        var j = list.findIndex(function (m) { return m.id === mbLib.openId; });
        if (j !== -1) list[j] = mbModuleSkeleton(list[j]);
        mbLib.openId = null;
        mbState.assessmentFormsData = {};
    } else {
        _mbDemoteOpen();
    }

    var rec = await mbStore.getModule(mbLib.project.id, mid);
    var idx = list.findIndex(function (m) { return m.id === mid; });
    if (idx === -1) return false;
    var full, forms;
    if (rec && rec.module) {
        full = rec.module;
        forms = rec.assessmentForms || {};
        mbLib.cards[mid] = rec.card || mbLib.cards[mid] || null;
        mbLib.openHashes = await mbImages.hydrate([full, forms]);
    } else {
        /* Not in storage yet (a module created this instant): what is
           in memory is all there is. */
        full = list[idx];
        forms = {};
        mbLib.openHashes = [];
    }
    /* Pictures of the module just left are released — never one the
       shared data (the covers) is showing, read from state as it is now:
       an import may have just replaced the cover. */
    mbLib.sharedHashes = mbImages.hashesIn(mbCollectShared());
    mbImages.release(mbLib.openHashes.concat(mbLib.sharedHashes));
    list[idx] = full;
    mbState.assessmentFormsData = forms;
    mbLib.openId = mid;
    mbState.currentModuleId = mid;
    _mbApplyModuleCover(full);
    _mbRenderOpenModule();
    /* The baseline for "did the author change anything" is taken AFTER
       the module has been drawn and read back from the forms. Drawing
       normalises a module written elsewhere — another author's content
       language seeds a few default phrases, a sheet number is filled in —
       and that must not count as an edit, or merely opening a colleague's
       module would make the opener its author. */
    _mbLibFlush();
    _mbStashModuleCover(full);
    var base = await mbImages.dehydrate([full, _mbFormsOf(full)]);
    mbLib.fps.modules[mid] = mbFingerprint(base.value).fp;
    /* Remember which module is open (project record only). */
    await _mbSaveNow(false);
    _mbLibEmit();
    return true;
}

/** Open a module of the current project. The only way modules are opened. */
function mbLibraryOpenModule(mid) {
    return _mbLibQueue(function () { return _mbOpenNow(mid); });
}

/* ══════════════════════════════════════════════════════════════
   PROJECTS
   ══════════════════════════════════════════════════════════════ */

function _mbNewProjectRecord(fields) {
    var now = Date.now();
    return Object.assign({
        id: _mbNewProjectId(),
        name: '',
        programId: null,
        programName: '',
        occupation: '',
        createdAt: now,
        updatedAt: now,
        moduleOrder: [],
        currentModuleId: null,
        moduleIdCounter: 0,
        loIdCounter: 0
    }, fields || {});
}

/** The default first module of an empty project (was the tail of
 *  initializeLearningOutcomes): one module, one outcome. */
function _mbCreateDefaultModule() {
    mbState.moduleIdCounter = (mbState.moduleIdCounter || 0) + 1;
    var m = {
        id: 'module-' + mbState.moduleIdCounter,
        title: _mbLibT('dgDefaultModuleName', { v0: (mbState.modulesData || []).length + 1 }),
        learningOutcomes: []
    };
    mbState.modulesData.push(m);
    mbState.currentModuleId = m.id;
    mbLib.openId = m.id;
    mbState.assessmentFormsData = {};
    if (typeof syncLearningOutcomesFromCurrentModule === 'function') syncLearningOutcomesFromCurrentModule();
    var p = (typeof addNewLearningOutcome === 'function')
        ? Promise.resolve(addNewLearningOutcome(_mbLibT('dgDefaultLOName', { v0: 1 })))
        : Promise.resolve();
    return p.then(function () {
        _mbApplyModuleCover(m);
        _mbRenderOpenModule();
        return m;
    });
}

/**
 * Load a project: its shared data, the light copies of all its modules,
 * and the module that was open last.
 *   opts.createDefault  an empty project gets one module (default true)
 *   opts.openModule     which module to open (default: the last one)
 */
function _mbOpenProjectNow(pid, opts) {
    opts = opts || {};
    return Promise.all([mbStore.getProject(pid), mbStore.getShared(pid), mbStore.getHeads(pid)])
        .then(function (r) {
            var meta = r[0], shared = r[1], heads = r[2] || [];
            if (!meta) return false;

            mbLib.project = meta;
            mbLib.openId = null;
            mbLib.heads = {}; mbLib.cards = {};
            mbLib.fps = { modules: {}, shared: null, meta: null };
            mbSetSetting(MB_KEYS.activeProject, pid);

            mbState.moduleIdCounter = meta.moduleIdCounter || 0;
            mbState.loIdCounter     = meta.loIdCounter || 0;
            mbState.assessmentFormsData = {};
            return (shared ? mbImages.hydrate(shared) : Promise.resolve([])).then(function (sh) {
            mbLib.sharedHashes = sh;
            mbImages.release(sh);
            mbLib.openHashes = [];
            mbApplyProjectShared(shared);

            var byId = {};
            heads.forEach(function (h) { byId[h.mid] = h; mbLib.heads[h.mid] = h; mbLib.cards[h.mid] = h.card; });
            var order = (meta.moduleOrder || []).filter(function (id) { return byId[id]; });
            heads.forEach(function (h) { if (order.indexOf(h.mid) === -1) order.push(h.mid); });
            mbState.modulesData = order.map(function (id) { return byId[id].skeleton; });
            mbState.learningOutcomesData = [];
            mbState.currentModuleId = null;
            mbState.currentLOId = null;

            /* Nothing on screen differs from what is stored: the shared
               fingerprint starts from what was just applied. */
            _mbLibFlush();
            return mbImages.dehydrate(mbCollectShared()).then(function (ds) {
                mbLib.fps.shared = mbFingerprint(ds.value).fp;
                var target = opts.openModule && byId[opts.openModule] ? opts.openModule
                    : (meta.currentModuleId && byId[meta.currentModuleId] ? meta.currentModuleId : order[0]);
                if (target) return _mbOpenNow(target);
                if (opts.createDefault === false) {
                    _mbRenderOpenModule();
                    return _mbSaveNow(true);
                }
                return _mbCreateDefaultModule().then(function () { return _mbSaveNow(true); });
            });
            });
        })
        .then(function () { _mbLibEmit(); return true; });
}

function mbLibraryOpenProject(pid, opts) {
    return _mbLibQueue(function () {
        return _mbSaveNow(false).then(function () { return _mbOpenProjectNow(pid, opts); });
    });
}

/** A new empty project, opened. */
function _mbCreateProjectNow(fields, opts) {
    var meta = _mbNewProjectRecord(fields);
    if (!meta.name) meta.name = _mbLibT('mbLibNewProjectDefault');
    return mbStore.putProject(meta)
        .then(function () { return mbStore.putShared(meta.id, _mbDefaultShared()); })
        .then(function () { return _mbOpenProjectNow(meta.id, opts); })
        .then(function () { return meta; });
}

function mbLibraryCreateProject(name) {
    return _mbLibQueue(function () {
        return _mbSaveNow(false).then(function () { return _mbCreateProjectNow({ name: name || '' }); });
    });
}

function mbLibraryRenameProject(name) {
    name = String(name || '').trim();
    if (!name || !mbLib.project) return Promise.resolve(false);
    return _mbLibQueue(function () {
        mbLib.project.name = name;
        return mbStore.putProject(mbLib.project).then(function () { _mbLibEmit(); return true; });
    });
}

/** Delete a project and everything in it. The open project is replaced
 *  by the most recent other one, or a new empty one. */
function mbLibraryDeleteProject(pid) {
    _mbCollectSoon();
    return _mbLibQueue(function () {
        var wasOpen = mbLib.project && mbLib.project.id === pid;
        return mbStore.deleteProject(pid).then(function () {
            if (!wasOpen) { _mbLibEmit(); return true; }
            mbLib.project = null; mbLib.openId = null;
            mbState.modulesData = [];
            return mbStore.listProjects().then(function (list) {
                list.sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
                if (list.length) return _mbOpenProjectNow(list[0].id);
                return _mbCreateProjectNow({});
            }).then(function () { return true; });
        });
    });
}

function mbLibraryListProjects() {
    return mbStore.listProjects().then(function (list) {
        return list.sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
    });
}

/* ══════════════════════════════════════════════════════════════
   MODULES: ADD, DELETE, CLEAR
   ══════════════════════════════════════════════════════════════ */

/** A new module, appended and opened. `module` is complete. */
function mbLibraryAddModule(module) {
    return _mbLibQueue(function () {
        return _mbSaveNow(false).then(function () {
            _mbDemoteOpen();
            mbState.modulesData.push(module);
            mbLib.openId = module.id;
            mbState.currentModuleId = module.id;
            mbState.assessmentFormsData = {};
            _mbApplyModuleCover(module);
            _mbRenderOpenModule();
            return _mbSaveNow(true);
        });
    });
}

/** Remove a module from the project and from storage, then open another
 *  (or a new default one when it was the last). */
function mbLibraryDeleteModule(mid) {
    _mbCollectSoon();
    return _mbLibQueue(function () {
        var drop = function () {
            mbState.modulesData = (mbState.modulesData || []).filter(function (m) { return m.id !== mid; });
            delete mbLib.heads[mid]; delete mbLib.cards[mid]; delete mbLib.fps.modules[mid];
            if (mbLib.openId === mid) { mbLib.openId = null; mbState.assessmentFormsData = {}; }
            mbState.currentModuleId = null;
            var next = mbState.modulesData[0];
            if (next) return _mbOpenNow(next.id);
            return _mbCreateDefaultModule().then(function () { return _mbSaveNow(true); });
        };
        if (!mbLib.enabled || !mbLib.project) return drop();
        return mbStore.deleteModule(mbLib.project.id, mid).then(drop).then(function () { _mbLibEmit(); return true; });
    });
}

/** Every module of the open project removed from storage — for Clear All
 *  and "Start manual authoring". State is the caller's to reset. */
function mbLibraryClearModules() {
    _mbCollectSoon();
    return _mbLibQueue(function () {
        mbLib.openId = null;
        mbLib.heads = {}; mbLib.cards = {}; mbLib.fps.modules = {};
        if (!mbLib.enabled || !mbLib.project) return true;
        return mbStore.clearModules(mbLib.project.id).then(function () { _mbLibEmit(); return true; });
    });
}

/** After Clear All: one default module, everything written fresh. */
function mbLibraryAfterClear() {
    return _mbLibQueue(function () {
        mbState.modulesData = [];
        mbLib.openId = null;
        return _mbCreateDefaultModule().then(function () {
            mbLib.fps.shared = null;
            return _mbSaveNow(true);
        });
    });
}

/* ══════════════════════════════════════════════════════════════
   WHOLE PROJECTS IN AND OUT (project JSON files, the legacy snapshot)
   ══════════════════════════════════════════════════════════════ */

/**
 * Store a whole project object (the shape saveWork() writes) as a new
 * library project, module by module, without opening it. Returns its id.
 */
function _mbStoreProjectData(data, fields) {
    data = mbAssignProjectUids(biMigrateProject(data));
    var meta = _mbNewProjectRecord(Object.assign({
        moduleIdCounter: data.moduleIdCounter || 0,
        loIdCounter: data.loIdCounter || 0
    }, fields || {}));
    var modules = Array.isArray(data.modules) ? data.modules : [];
    var allForms = data.assessmentFormsData || {};
    meta.moduleOrder = modules.map(function (m) { return m.id; });
    meta.currentModuleId = data.currentModuleId || (modules[0] && modules[0].id) || null;

    var shared = _mbDefaultShared();
    Object.keys(shared).forEach(function (k) { if (data[k] !== undefined) shared[k] = data[k]; });

    var chain = mbStore.putProject(meta)
        .then(function () { return mbImages.dehydrate(shared); })
        .then(function (ds) { return mbStore.putShared(meta.id, ds.value, ds.hashes); });
    modules.forEach(function (m) {
        var forms = {};
        (m.learningOutcomes || []).forEach(function (lo) { if (allForms[lo.id]) forms[lo.id] = allForms[lo.id]; });
        chain = chain.then(function () { return _mbWriteModule(m, forms, null, { project: meta }); });
    });
    return chain.then(function () { return meta.id; });
}

/* ══════════════════════════════════════════════════════════════
   PICTURES: one-time move of 3.12 records, and the collector
   ══════════════════════════════════════════════════════════════ */

/** 3.12 kept pictures as data URLs inside module and shared records. Each
 *  such record is rewritten once with Blobs and references — its card
 *  untouched, since nobody edited it. Recognised by a head (or shared
 *  record) without an `images` list. */
function _mbMigrateImagesNow() {
    var moved = 0;
    return mbStore.allHeads().then(function (heads) {
        var todo = heads.filter(function (h) { return !Array.isArray(h.images); });
        var chain = Promise.resolve();
        todo.forEach(function (h) {
            chain = chain.then(function () {
                return mbStore.getModule(h.pid, h.mid).then(function (rec) {
                    if (!rec || !rec.module) return null;
                    return mbImages.dehydrate([rec.module, rec.assessmentForms || {}]).then(function (d) {
                        moved++;
                        return _mbWriteStored(d.value[0], d.value[1], d.hashes, d.bytes, rec.card || h.card,
                                              { id: h.pid });
                    });
                });
            });
        });
        return chain;
    }).then(function () {
        return mbStore.allShared();
    }).then(function (all) {
        var chain = Promise.resolve();
        all.filter(function (r) { return !Array.isArray(r.images); }).forEach(function (r) {
            chain = chain.then(function () {
                return mbImages.dehydrate(r.data || {}).then(function (ds) {
                    moved++;
                    return mbStore.putShared(r.pid, ds.value, ds.hashes);
                });
            });
        });
        return chain;
    }).then(function () {
        if (moved) console.info('[Library] pictures moved out of', moved, 'record(s)');
        return moved;
    }).catch(function (e) { console.warn('[Library] picture migration:', e); return 0; });
}

/** The collector a little later, once — after a delete, a clear or an
 *  import, and a while after boot. */
var _mbCollectTimer = null;
function _mbCollectSoon(ms) {
    clearTimeout(_mbCollectTimer);
    _mbCollectTimer = setTimeout(mbLibraryCollectImages, ms || 3000);
}

/** Delete pictures nothing points at any more. Queued, so it never runs
 *  between a picture being stored and the record that uses it. */
function mbLibraryCollectImages() {
    if (!mbLib.enabled) return Promise.resolve(0);
    return _mbLibQueue(function () {
        var mod = _mbOpenModuleObj();
        return mbImages.collect([mod, mod ? _mbFormsOf(mod) : null, mbCollectShared(),
                                 mbState.contentSectionImages, mbState.stepImages,
                                 mbState.infoQRImage, mbState.activityQRImage]).then(function (n) {
            if (n) console.info('[Library] unused pictures deleted:', n);
            return n;
        });
    });
}

/** 3.11 and earlier kept the session as one snapshot. Moved into the
 *  library once, as a project, when the library is still empty. */
function _mbMigrateLegacySnapshot() {
    return mbLoadDoc(MB_KEYS.autosave).then(function (snap) {
        if (!snap || snap.__corrupt) return null;
        if (typeof snap === 'string') { try { snap = JSON.parse(snap); } catch (e) { return null; } }
        if (!snap.modules) return null;
        var hasWork = (typeof window.mbSnapshotHasWork === 'function') ? window.mbSnapshotHasWork(snap) : true;
        return mbStore.listProjects().then(function (list) {
            if (list.length || !hasWork) {
                /* Stale (the library already exists) or empty: nothing
                   worth moving. Removed so it is never offered again. */
                if (!hasWork) return mbRemoveDoc(MB_KEYS.autosave).then(function () { return null; });
                return null;
            }
            var name = _mbLibT('mbLibMigratedName');
            return _mbStoreProjectData(snap, { name: name }).then(function (pid) {
                return mbRemoveDoc(MB_KEYS.autosave).then(function () {
                    console.info('[Library] previous session moved into the library as', pid);
                    return { pid: pid, name: name };
                });
            });
        });
    }).catch(function (e) { console.warn('[Library] legacy snapshot not migrated:', e); return null; });
}

/* ══════════════════════════════════════════════════════════════
   DACUM LIVE PRO HANDOFF
   ══════════════════════════════════════════════════════════════ */

function _mbProgrammeName(exportData) {
    return String(exportData.programName || exportData.occupationTitle || exportData.occupation || '').trim()
        || _mbLibT('mbLibNewProjectDefault');
}

/** Which project the received modules belong to. DACUM 3.49+ names its
 *  project (programId); an older DACUM does not, and then a project for
 *  the same occupation is offered. */
function _mbPickProjectForDacum(exportData) {
    var progId = exportData.programId || null;
    var occ = String(exportData.occupation || '').trim();
    return mbStore.listProjects().then(function (list) {
        if (progId) {
            var hit = list.find(function (p) { return p.programId === progId; });
            if (hit) return { project: hit };
        }
        var cand = occ && occ !== 'Unknown Occupation'
            ? list.filter(function (p) { return p.occupation === occ && (!progId || !p.programId); })
                  .sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); })[0]
            : null;
        if (!cand) return { project: null };
        return _mbDialog({
            type: 'confirm',
            message: _mbLibT('mbLibAskAttach', { v0: (exportData.modules || []).length, v1: _mbProgrammeName(exportData), v2: cand.name }),
            okLabel: _mbLibT('mbLibAddHere'),
            cancelLabel: _mbLibT('mbLibNewHere'),
            noBackdrop: true
        }).then(function (yes) { return { project: yes ? cand : null }; });
    });
}

function _mbDacumImportNow(exportData) {
    var received = exportData.modules || [];
    var added = 0, updated = 0, isNew = false;

    return _mbSaveNow(false).then(function () {
        return _mbPickProjectForDacum(exportData);
    }).then(function (pick) {
        if (pick.project) {
            return _mbOpenProjectNow(pick.project.id, { createDefault: false });
        }
        isNew = true;
        var name = _mbProgrammeName(exportData);
        var meta = _mbNewProjectRecord({ name: name });
        return mbStore.putProject(meta)
            .then(function () { return mbStore.putShared(meta.id, _mbDefaultShared()); })
            .then(function () { return _mbOpenProjectNow(meta.id, { createDefault: false }); });
    }).then(function () {
        var p = mbLib.project;
        if (exportData.programId) p.programId = exportData.programId;
        if (exportData.programName) p.programName = exportData.programName;
        if (!p.occupation && exportData.occupation && exportData.occupation !== 'Unknown Occupation') p.occupation = exportData.occupation;

        /* One module at a time: read it, merge, write it, let it go. */
        var chain = Promise.resolve();
        received.forEach(function (dm) {
            chain = chain.then(function () {
                var mid = dm.moduleId;
                var idx = mid ? mbState.modulesData.findIndex(function (m) { return m.id === mid; }) : -1;
                if (idx === -1) {
                    var fresh = _mbModuleFromDacum(dm, exportData);
                    fresh.source = 'dacum';
                    mbState.modulesData.push(mbModuleSkeleton(fresh));
                    added++;
                    return _mbWriteModule(fresh, {}, null);
                }
                updated++;
                if (mid === mbLib.openId) {
                    _mbMergeDacumModule(mbState.modulesData[idx], dm, exportData);
                    return null;   // written by the save below
                }
                return mbStore.getModule(p.id, mid).then(function (rec) {
                    var full = (rec && rec.module) || mbState.modulesData[idx];
                    var forms = (rec && rec.assessmentForms) || {};
                    _mbMergeDacumModule(full, dm, exportData);
                    mbState.modulesData[idx] = mbModuleSkeleton(full);
                    return _mbWriteModule(full, forms, (rec && rec.card) || mbLib.cards[mid]);
                });
            });
        });
        return chain;
    }).then(function () {
        try { _mbPrefillCoverFromDacum(exportData); }
        catch (e) { console.warn('[ModuleBuilder←DACUM] cover prefill skipped:', e); }
        var first = received[0] && received[0].moduleId;
        var target = mbState.modulesData.some(function (m) { return m.id === first; }) ? first
            : (mbState.modulesData[0] && mbState.modulesData[0].id);
        if (target && target === mbLib.openId) {
            _mbApplyModuleCover(_mbOpenModuleObj());
            _mbRenderOpenModule();
            return _mbSaveNow(false);
        }
        return target ? _mbOpenNow(target) : null;
    }).then(function () {
        var loCount = received.reduce(function (n, m) { return n + (m.learningOutcomes || []).length; }, 0);
        if (isNew) showStatus(_mbLibT('mbLibDacumNewProject', { v0: mbLib.project.name, v1: received.length, v2: loCount }), 'success');
        else showStatus(_mbLibT('mbLibDacumAdded', { v0: added, v1: updated, v2: mbLib.project.name }), 'success');
        _mbLibEmit();
        return true;
    });
}

/* ══════════════════════════════════════════════════════════════
   BOOT
   ══════════════════════════════════════════════════════════════ */

/**
 * Called once from initializeLearningOutcomes(). `exportData` is a DACUM
 * handoff already read (and removed) from localStorage, or null.
 */
function mbLibraryBoot(exportData) {
    return _mbLibQueue(function () {
        return mbStore.available().then(function (ok) {
            mbLib.enabled = ok;
            if (!ok) return _mbBootInMemory(exportData);
            var migrated = null;
            return _mbMigrateLegacySnapshot().then(function (m) {
                migrated = m;
                return _mbMigrateImagesNow();
            }).then(function () {
                if (exportData && exportData.modules && exportData.modules.length) {
                    return _mbDacumImportNow(exportData);
                }
                return mbStore.listProjects().then(function (list) {
                    var want = (migrated && migrated.pid) || mbGetSetting(MB_KEYS.activeProject, null);
                    var p = list.find(function (x) { return x.id === want; });
                    if (!p && list.length) {
                        list.sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
                        p = list[0];
                    }
                    if (p) return _mbOpenProjectNow(p.id);
                    return _mbCreateProjectNow({});
                });
            }).then(function () {
                if (migrated) showStatus(_mbLibT('mbLibMigrated', { v0: migrated.name }), 'success');
            });
        }).then(function () {
            mbLib.booted = true;
            _mbCollectSoon(20000);
            _mbLibEmit();
            window.dispatchEvent(new CustomEvent('mb:libraryready'));
        });
    });
}

/** No IndexedDB (Safari private mode and the like): one project, in memory. */
function _mbBootInMemory(exportData) {
    mbLib.project = _mbNewProjectRecord({ name: _mbLibT('mbLibNewProjectDefault') });
    showStatus(_mbLibT('mbLibUnavailable'), 'error');
    if (exportData && exportData.modules && exportData.modules.length) {
        mbState.modulesData = [];
        exportData.modules.forEach(function (dm) {
            var m = _mbModuleFromDacum(dm, exportData);
            m.source = 'dacum';
            mbState.modulesData.push(m);
        });
        try { _mbPrefillCoverFromDacum(exportData); } catch (e) { /* cosmetic */ }
        return _mbOpenNow(mbState.modulesData[0].id);
    }
    if (!mbState.modulesData.length) return _mbCreateDefaultModule();
    return _mbOpenNow(mbState.modulesData[0].id);
}

/* ══════════════════════════════════════════════════════════════
   AUTHOR NAME — asked once
   ══════════════════════════════════════════════════════════════ */

function mbLibraryAskAuthor(force) {
    if (!force && (mbAuthorName() || mbGetSetting(MB_KEYS.authorAsked, null))) return Promise.resolve(mbAuthorName());
    return mbPrompt(_mbLibT('mbLibAskAuthor'), mbAuthorName()).then(function (name) {
        mbSetSetting(MB_KEYS.authorAsked, '1');
        if (name === null || name === undefined) return mbAuthorName();
        name = mbSetAuthorName(name);
        if (name) showStatus(_mbLibT('mbLibAuthorSaved', { v0: name }), 'success');
        _mbLibEmit();
        return name;
    });
}

window.addEventListener('mb:libraryready', function () {
    /* After boot, never during: a DACUM import may be asking its own
       question, and two dialogs cannot be open at once. */
    setTimeout(function () { mbLibraryAskAuthor(false); }, 400);
});
