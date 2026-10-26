// ============================================================
// /src/helper.js — 3.80.11
// The step-by-step helper: a small panel that walks an author through
// the tabs in the order the document is exported, shows what is done
// and what is not, and takes them to the tab with one click.
//
// WHY IT IS BUILT THIS WAY
//   • Classic script, one IIFE, ONE global (window.mbHelper). Buttons use
//     data-act="mbHelperAct" with the action name as the first argument;
//     events.js resolves it. Nothing is registered anywhere else.
//   • No CSS in this file. Every rule lives in mb-styles.css (.mb-hw-*),
//     so the panel follows the same styles, RTL rules and offline cache
//     as the rest of the interface.
//   • Strings come from the dictionary (window.i18n.extend below, EN / FR / AR).
//     The title of a step is the label the tab itself carries on screen, so
//     the helper can never name a tab differently from the interface.
//   • State is READ from mbState, never written. The helper changes
//     nothing in a project; it only remembers the last step per project
//     and whether its button is shown, in the browser's small settings.
//   • The steps follow the template: Standard, or Learner guide (which adds
//     the Learning unit and Reflection tabs).
//   • No AI and no server: the status is counted from what is on screen.
//
// WHAT THE STATUS MEANS
//   done     everything the step asks for exists (all outcomes have a sheet…)
//   partial  some of it exists
//   todo     none of it yet
//   none     an optional step with nothing in it — it is not a gap
// ============================================================
(function () {
    'use strict';

    if (window.mbHelper) return;

    var KEY_CHIP = 'mb_helper_chip';            // 'always' (default) | 'hidden'
    var KEY_STEP = 'mb_helper_step:';           // + project id → step id

    /* ── The steps ───────────────────────────────────────────────
       tab     the tab-content id without «-tab» (null = no tab)
       icon    shown in the card and on the dot
       opt     optional: an empty step is not a gap
       target  what to spotlight once the tab is open
       guide   the tab has a «?» guide (help_modal.js)            */
    var STEPS = {
        modules:    { tab: 'basic-info', icon: '🏠', target: '[data-act="addNewModule"]' },
        cover:      { tab: 'covers',     icon: '🖼️', opt: true, target: '#front-cover-upload-area' },
        intro:      { tab: 'intro',      icon: '📄', opt: true, target: '[data-act="addTeamMember"]' },
        unit:       { tab: 'unit',       icon: '🧭' },
        info:       { tab: 'info',       icon: '📘', target: '[data-act="addNewInfoSheet"]', guide: true },
        activity:   { tab: 'activity',   icon: '🛠️', target: '[data-act="addNewActivitySheet"]', guide: true },
        reflection: { tab: 'reflection', icon: '🪞', opt: true },
        assessment: { tab: 'assessment', icon: '✅', guide: true },
        tools:      { tab: 'tools',      icon: '🧰', opt: true },
        refs:       { tab: 'references', icon: '📚', opt: true, target: '[data-act="addReference"]' },
        back:       { tab: 'back-cover', icon: '🔙', opt: true, target: '#back-cover-upload-area' },
        finish:     { tab: null,         icon: '📤' }
    };
    var ORDER_STANDARD = ['modules', 'cover', 'intro', 'info', 'activity', 'assessment', 'tools', 'refs', 'back', 'finish'];
    var ORDER_LEARNER  = ['modules', 'cover', 'intro', 'unit', 'info', 'activity', 'reflection', 'assessment', 'tools', 'refs', 'back', 'finish'];

    var open = false;
    var current = 'modules';
    var observer = null;
    var refreshTimer = null;

    /* ── Small helpers ─────────────────────────────────────────── */
    function t(key, vars) {
        try {
            if (vars && window.i18n && window.i18n.tf) return window.i18n.tf(key, vars);
            return window.i18n ? window.i18n.t(key) : key;
        } catch (e) { return key; }
    }
    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }
    function isRtl() {
        try { return !!(window.i18n && window.i18n.isRTL && window.i18n.isRTL()); } catch (e) { return false; }
    }
    /* Text anywhere in a value: a string, a {en, ar, fr} pair, or a list of them. */
    function anyText(v) {
        if (v == null) return false;
        if (typeof v === 'string') return v.trim().length > 0;
        if (Array.isArray(v)) return v.some(anyText);
        if (typeof v === 'object') return Object.keys(v).some(function (k) { return anyText(v[k]); });
        return false;
    }
    function getSetting(k) { try { return typeof mbGetSetting === 'function' ? mbGetSetting(k, null) : null; } catch (e) { return null; } }
    function setSetting(k, v) { try { if (typeof mbSetSetting === 'function') mbSetSetting(k, v); } catch (e) { /* storage refused */ } }
    function projectId() {
        try { return getSetting(window.MB_KEYS && MB_KEYS.activeProject) || 'none'; } catch (e) { return 'none'; }
    }
    function order() {
        var lg = false;
        try { lg = typeof mbIsLearnerGuide === 'function' && mbIsLearnerGuide(); } catch (e) { /* not ready */ }
        return lg ? ORDER_LEARNER : ORDER_STANDARD;
    }
    function indexOf(id) { return order().indexOf(id); }
    function chipMode() { return getSetting(KEY_CHIP) === 'hidden' ? 'hidden' : 'always'; }

    /* ── What is in the open module ────────────────────────────── */
    function module_() {
        try {
            return (mbState.modulesData || []).find(function (m) { return m.id === mbState.currentModuleId; }) || null;
        } catch (e) { return null; }
    }
    function outcomes() { try { return mbState.learningOutcomesData || []; } catch (e) { return []; } }

    function ratio(done, total) {
        var state = total === 0 ? 'todo' : done === total ? 'done' : done > 0 ? 'partial' : 'todo';
        return { state: state, metric: total === 0 ? t('hwzMetNoOutcomes') : t('hwzMetOutcomes', { v0: done, v1: total }) };
    }
    function sheetFilled(s) { return !!s && (anyText(s.title) || anyText(s.objective)); }
    function optional(has, metric) {
        return { state: has ? 'done' : 'none', metric: metric };
    }

    var STATUS = {
        modules: function () {
            var mods = (mbState.modulesData || []).length, los = outcomes().length;
            return { state: mods && los ? 'done' : mods ? 'partial' : 'todo', metric: t('hwzMetModules', { v0: mods, v1: los }) };
        },
        cover: function () { return optional(!!mbState.frontCoverImage, t(mbState.frontCoverImage ? 'hwzMetImage' : 'hwzMetNoImage')); },
        back: function () { return optional(!!mbState.backCoverImage, t(mbState.backCoverImage ? 'hwzMetImage' : 'hwzMetNoImage')); },
        intro: function () {
            var n = (mbState.teamMembers || []).filter(function (m) { return anyText(m && (m.name || m.value)); }).length;
            var tbl = anyText(mbState.introTable);
            return optional(n > 0 || tbl, t('hwzMetTeam', { v0: n }));
        },
        unit: function () {
            var los = outcomes();
            return ratio(los.filter(function (lo) { return anyText(lo.lgUnit); }).length, los.length);
        },
        info: function () {
            var los = outcomes();
            return ratio(los.filter(function (lo) { return (lo.infoSheets || []).some(sheetFilled); }).length, los.length);
        },
        activity: function () {
            var los = outcomes();
            return ratio(los.filter(function (lo) { return (lo.activitySheets || []).some(sheetFilled); }).length, los.length);
        },
        reflection: function () { return { state: 'none', metric: '' }; },
        assessment: function () {
            var los = outcomes(), forms = mbState.assessmentFormsData || {};
            return ratio(los.filter(function (lo) {
                var f = forms[lo.id];
                return f && (f.rows || []).some(function (r) { return anyText(r); });
            }).length, los.length);
        },
        tools: function () {
            var m = module_(), n = 0;
            try { if (m && typeof mbToolsParse === 'function') n = mbToolsParse(m.toolsText).length; } catch (e) { n = 0; }
            return optional(n > 0, t('hwzMetItems', { v0: n }));
        },
        refs: function () {
            var n = (mbState.referencesData || []).filter(function (r) { return anyText(r && r.value); }).length;
            return optional(n > 0, t('hwzMetItems', { v0: n }));
        },
        finish: function () { return { state: 'none', metric: '' }; }
    };

    function statusOf(id) {
        try { return STATUS[id] ? STATUS[id]() : { state: 'none', metric: '' }; }
        catch (e) { return { state: 'none', metric: '' }; }
    }

    /* The label the tab carries on screen, so the helper never renames it. */
    function tabLabel(id) {
        var st = STEPS[id];
        if (!st || !st.tab) return t('hwzFinishTitle');
        var b = document.querySelector('#mb-sidenav .tab[data-args=\'["' + st.tab + '"]\']');
        var label = b ? (b.textContent || '').replace(/\s+/g, ' ').trim() : '';
        return label || t('hwz_' + id + '_title');
    }

    /* ── Persistence of the step ───────────────────────────────── */
    function restoreStep() {
        var saved = getSetting(KEY_STEP + projectId());
        current = saved && indexOf(saved) !== -1 ? saved : order()[0];
    }
    function saveStep() { setSetting(KEY_STEP + projectId(), current); }

    /* ── The chip ──────────────────────────────────────────────── */
    function chipEl() { return document.getElementById('mb-hw-chip'); }
    function paintChip() {
        var chip = chipEl();
        if (!chip) {
            chip = document.createElement('button');
            chip.type = 'button';
            chip.id = 'mb-hw-chip';
            chip.className = 'mb-hw-chip';
            chip.setAttribute('data-act', 'mbHelperAct');
            chip.setAttribute('data-args', '["toggle"]');
            document.body.appendChild(chip);
        }
        var ord = order(), n = ord.indexOf(current) + 1;
        chip.innerHTML = '<span aria-hidden="true">🧭</span><span class="mb-hw-chip-t">' + esc(t('hwzChip')) +
            '</span><small>' + n + '/' + ord.length + '</small>';
        chip.title = t('hwzChipTip');
        chip.setAttribute('aria-label', t('hwzChipTip'));
        chip.hidden = open || chipMode() === 'hidden';
    }

    /* ── The panel ─────────────────────────────────────────────── */
    function panelEl() { return document.getElementById('mb-hw'); }

    function badge(state) {
        var key = { done: 'hwzDone', partial: 'hwzPartial', todo: 'hwzTodo', none: 'hwzOptional' }[state] || 'hwzOptional';
        return '<span class="mb-hw-badge is-' + state + '">' + esc(t(key)) + '</span>';
    }

    function render() {
        var ord = order();
        if (ord.indexOf(current) === -1) current = ord[0];
        var idx = ord.indexOf(current), st = STEPS[current], status = statusOf(current);
        var panel = panelEl();
        if (!panel) {
            panel = document.createElement('section');
            panel.id = 'mb-hw';
            panel.className = 'mb-hw';
            panel.setAttribute('role', 'dialog');
            panel.setAttribute('aria-modal', 'false');
            panel.setAttribute('aria-labelledby', 'mb-hw-title');
            document.body.appendChild(panel);
        }
        panel.setAttribute('dir', isRtl() ? 'rtl' : 'ltr');
        panel.hidden = !open;

        var dots = ord.map(function (id, i) {
            var s = statusOf(id).state;
            return '<button type="button" class="mb-hw-dot is-' + s + (id === current ? ' is-on' : '') +
                '" data-act="mbHelperAct" data-args=\'["goto","' + id + '"]\' title="' + esc(tabLabel(id)) +
                '" aria-label="' + esc(t('hwzStepOf', { v0: i + 1, v1: ord.length }) + ' — ' + tabLabel(id)) +
                '"' + (id === current ? ' aria-current="step"' : '') + '>' + STEPS[id].icon + '</button>';
        }).join('');

        var done = ord.filter(function (id) { var s = statusOf(id).state; return s === 'done'; }).length;
        var pct = Math.round(done / ord.length * 100);

        var buttons = '';
        if (st.tab) {
            buttons += '<button type="button" class="mb-hw-btn is-primary" data-act="mbHelperAct" data-args=\'["tab"]\'>' +
                esc(t('hwzGo')) + '</button>';
            if (st.guide) {
                buttons += '<button type="button" class="mb-hw-btn" data-act="mbHelperAct" data-args=\'["guide"]\'>' +
                    esc(t('hwzGuide')) + '</button>';
            }
        } else {
            buttons += '<button type="button" class="mb-hw-btn is-primary" data-act="saveWork">💾 ' + esc(t('hwzSave')) + '</button>' +
                '<button type="button" class="mb-hw-btn" data-act="exportToDocx">📄 ' + esc(t('hwzExportWord')) + '</button>';
        }

        panel.innerHTML =
            '<div class="mb-hw-head">' +
              '<span class="mb-hw-ico" aria-hidden="true">🧭</span>' +
              '<strong id="mb-hw-title">' + esc(t('hwzTitle')) + '</strong>' +
              '<button type="button" class="mb-hw-x" data-act="mbHelperAct" data-args=\'["close"]\' aria-label="' + esc(t('hwzClose')) + '">✕</button>' +
            '</div>' +
            '<div class="mb-hw-dots" role="group" aria-label="' + esc(t('hwzTitle')) + '">' + dots + '</div>' +
            '<div class="mb-hw-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '"><i style="width:' + pct + '%"></i></div>' +
            '<div class="mb-hw-body">' +
              '<div class="mb-hw-meta"><span>' + esc(t('hwzStepOf', { v0: idx + 1, v1: ord.length })) + '</span>' + badge(status.state) + '</div>' +
              '<h3 class="mb-hw-h"><span aria-hidden="true">' + st.icon + '</span> ' + esc(tabLabel(current)) + '</h3>' +
              '<p class="mb-hw-sum">' + esc(t('hwz_' + current + '_sum')) + '</p>' +
              (status.metric ? '<div class="mb-hw-metric">' + esc(status.metric) + '</div>' : '') +
              '<div class="mb-hw-tip"><span aria-hidden="true">💡</span> ' + esc(t('hwz_' + current + '_tip')) + '</div>' +
            '</div>' +
            '<div class="mb-hw-acts">' + buttons + '</div>' +
            '<div class="mb-hw-nav">' +
              '<button type="button" class="mb-hw-btn" data-act="mbHelperAct" data-args=\'["prev"]\'' + (idx === 0 ? ' disabled' : '') + '>' + (isRtl() ? '→ ' : '← ') + esc(t('hwzBack')) + '</button>' +
              '<button type="button" class="mb-hw-btn" data-act="mbHelperAct" data-args=\'["next"]\'' + (idx === ord.length - 1 ? ' disabled' : '') + '>' + esc(t('hwzNext')) + (isRtl() ? ' ←' : ' →') + '</button>' +
            '</div>' +
            '<button type="button" class="mb-hw-hide" data-act="mbHelperAct" data-args=\'["hideChip"]\'>' + esc(t('hwzHide')) + '</button>';
        paintChip();
    }

    /* ── Going to a tab, with a short spotlight ─────────────────── */
    function spot(el) {
        if (!el) return;
        el.classList.add('mb-hw-spot');
        setTimeout(function () { el.classList.remove('mb-hw-spot'); }, 2600);
    }
    function goToTab() {
        var st = STEPS[current];
        if (!st || !st.tab || typeof switchTab !== 'function') return;
        var tabName = st.tab, target = st.target;
        Promise.resolve(switchTab(tabName)).then(function () {
            spot(document.querySelector('#mb-sidenav .tab[data-args=\'["' + tabName + '"]\']'));
            setTimeout(function () {
                var el = target ? document.querySelector('#' + tabName + '-tab ' + target) || document.querySelector(target) : null;
                if (el && el.offsetParent !== null) {
                    try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { /* old browser */ }
                    spot(el);
                }
            }, 140);
        }).catch(function () { /* the tab refused (no outcome chosen): its own message is shown */ });
    }

    /* ── Actions (the only global) ─────────────────────────────── */
    function setStep(id) {
        if (indexOf(id) === -1) return;
        current = id;
        saveStep();
        render();
    }
    function openPanel(id) {
        open = true;
        if (id && indexOf(id) !== -1) current = id;
        render();
        saveStep();
        var first = panelEl() && panelEl().querySelector('.mb-hw-btn.is-primary');
        if (first) { try { first.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    }
    function closePanel() {
        open = false;
        render();
        var chip = chipEl();
        if (chip && !chip.hidden) { try { chip.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }
    }

    function act(name, arg) {
        var ord = order(), i = ord.indexOf(current);
        switch (name) {
            case 'toggle':   if (open) closePanel(); else openPanel(); break;
            case 'open':
                setSetting(KEY_CHIP, 'always');
                openPanel();
                break;
            case 'close':    closePanel(); break;
            case 'next':     if (i < ord.length - 1) setStep(ord[i + 1]); break;
            case 'prev':     if (i > 0) setStep(ord[i - 1]); break;
            case 'goto':     setStep(arg); break;
            case 'tab':      goToTab(); break;
            case 'guide':
                if (STEPS[current] && STEPS[current].tab && typeof mbOpenTabHelp === 'function') {
                    Promise.resolve(typeof switchTab === 'function' ? switchTab(STEPS[current].tab) : null)
                        .then(function () { mbOpenTabHelp(STEPS[current].tab); }).catch(function () { /* see goToTab */ });
                }
                break;
            case 'hideChip':
                setSetting(KEY_CHIP, 'hidden');
                open = false;
                render();
                try { if (typeof showStatus === 'function') showStatus(t('hwzHiddenMsg'), 'success'); } catch (e) { /* no toast */ }
                break;
            case 'showChip':
                setSetting(KEY_CHIP, 'always');
                paintChip();
                break;
        }
    }
    window.mbHelper = {
        open: function (id) { setSetting(KEY_CHIP, 'always'); openPanel(id); },
        close: closePanel,
        isOpen: function () { return open; },
        step: function () { return current; },
        steps: function () { return order().slice(); },
        refresh: function () { render(); },
        act: act
    };
    /* events.js: data-act="mbHelperAct" data-args='["next"]' → mbHelperAct('next', el, ev) */
    window.mbHelperAct = function (name, arg) { act(name, typeof arg === 'string' ? arg : undefined); };

    /* ── Staying in step with the app ──────────────────────────── */
    function syncToActiveTab() {
        if (!open) return;
        var active = document.querySelector('.tab-content.active');
        if (!active) return;
        var name = (active.id || '').replace(/-tab$/, '');
        if (STEPS[current] && STEPS[current].tab === name) { render(); return; }
        var hit = order().filter(function (id) { return STEPS[id].tab === name; })[0];
        if (hit) { current = hit; saveStep(); }
        render();
    }
    function scheduleRefresh(ms) {
        if (!open) return;
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(render, ms || 600);
    }
    function projectChanged() {
        restoreStep();
        render();
    }

    document.addEventListener('keydown', function (e) {
        if (!open) return;
        var el = e.target, inField = el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
        if (document.getElementById('mb-help-modal') || document.querySelector('.mb-dialog-overlay')) return;
        var p = panelEl();
        if (e.key === 'Escape' && (!inField || (p && p.contains(el)))) { e.preventDefault(); closePanel(); return; }
        if (inField || e.ctrlKey || e.metaKey || e.altKey) return;
        if (!p || !(p.contains(el) || el === document.body)) return;
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            var forward = (e.key === 'ArrowRight') !== isRtl();
            e.preventDefault();
            act(forward ? 'next' : 'prev');
            var b = panelEl() && panelEl().querySelector('.mb-hw-btn.is-primary');
            if (b) { try { b.focus({ preventScroll: true }); } catch (x) { /* ignore */ } }
        }
    });
    document.addEventListener('input', function () { scheduleRefresh(700); });
    document.addEventListener('change', function () { scheduleRefresh(300); });
    ['mb:langchange', 'mb:templatechange', 'mb:settingschange'].forEach(function (n) {
        window.addEventListener(n, function () { restoreStepIfInvalid(); render(); });
    });
    ['mb:libraryready', 'mb:librarychanged', 'mb:projectcleared'].forEach(function (n) {
        window.addEventListener(n, projectChanged);
    });
    function restoreStepIfInvalid() { if (indexOf(current) === -1) current = order()[0]; }

    function init() {
        restoreStep();
        render();
        try {
            observer = new MutationObserver(syncToActiveTab);
            document.querySelectorAll('.tab-content').forEach(function (n) {
                observer.observe(n, { attributes: true, attributeFilter: ['class'] });
            });
        } catch (e) { /* no observer: the step follows the buttons only */ }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();

    /* ── Strings: EN / FR / AR ─────────────────────────────────── */
    if (window.i18n && window.i18n.extend) window.i18n.extend({
        en: {
            hwzTitle: 'Step-by-step helper',
            hwzChip: 'Helper',
            hwzChipTip: 'Open the step-by-step helper',
            hwzStepOf: 'Step {v0} of {v1}',
            hwzClose: 'Close',
            hwzBack: 'Back',
            hwzNext: 'Next',
            hwzGo: 'Go to this tab',
            hwzGuide: 'Open the ? guide',
            hwzHide: 'Hide the helper button',
            hwzHiddenMsg: 'The helper button is hidden. Start it again from the Help tab.',
            hwzDone: 'Done',
            hwzPartial: 'In progress',
            hwzTodo: 'To do',
            hwzOptional: 'Optional',
            hwzSave: 'Save module',
            hwzExportWord: 'Export to Word',
            hwzMetNoOutcomes: 'No learning outcome yet',
            hwzMetOutcomes: '{v0} of {v1} learning outcomes',
            hwzMetModules: '{v0} module(s), {v1} learning outcome(s) in the open module',
            hwzMetImage: 'Image added',
            hwzMetNoImage: 'No image yet',
            hwzMetTeam: '{v0} team member(s)',
            hwzMetItems: '{v0} item(s)',
            hwzFinishTitle: 'Save and export',
            hwzHelpCardTitle: 'Step-by-step helper',
            hwzHelpCardText: 'A short walk through the tabs in the order of the exported document, showing what is done and taking you to each tab.',
            hwzHelpCardStart: 'Start the helper',
            hwz_modules_title: 'Module Information',
            hwz_modules_sum: 'Create your module, then add its Learning Outcomes. Everything else hangs from them. Received a DACUM chart? Import it instead of retyping.',
            hwz_modules_tip: 'Name each outcome as what the learner will be able to do.',
            hwz_cover_title: 'Front Cover',
            hwz_cover_sum: 'Upload the front cover image. It becomes the first page of the exported document.',
            hwz_cover_tip: 'An image of 2480 × 3508 px gives a sharp A4 page. The cover information table is in the Module Information tab.',
            hwz_intro_title: 'Introduction Pages',
            hwz_intro_sum: 'Add the work team and fill the module overview table. These pages are shared by every module of the project.',
            hwz_intro_tip: 'Rows with no name or text are not exported.',
            hwz_unit_title: 'Learning unit',
            hwz_unit_sum: 'Give each learning unit its introduction and its knowledge content.',
            hwz_unit_tip: 'Short, concrete sections work better than long text.',
            hwz_info_title: 'Information Sheet',
            hwz_info_sum: 'Write what the learner must KNOW: sections with text, images and tables, then a self-check and its answer key.',
            hwz_info_tip: 'End each sheet with self-check questions that test its objective.',
            hwz_activity_title: 'Activity / Job Sheet',
            hwz_activity_sum: 'Write what the learner must DO: the resources, the steps (each starting with a verb) and the performance criteria checklist.',
            hwz_activity_tip: 'Put each safety warning at the step where it applies.',
            hwz_reflection_title: 'Reflection',
            hwz_reflection_sum: 'Add the reflection questions that close the learning unit.',
            hwz_reflection_tip: 'Choose how many answer lines each question gets.',
            hwz_assessment_title: 'Assessment Unit',
            hwz_assessment_sum: 'Complete one Portfolio of Evidence form per Learning Outcome: the criteria, the evidence and the result.',
            hwz_assessment_tip: 'Competent only when every criterion is met.',
            hwz_tools_title: 'Tools & Resources',
            hwz_tools_sum: 'List the tools, equipment and materials of the module, one per line. Pick them from DACUM if you received a task analysis.',
            hwz_tools_tip: 'Leave the list empty to skip the page.',
            hwz_refs_title: 'References',
            hwz_refs_sum: 'Add the books, standards and sources you used.',
            hwz_refs_tip: 'Empty entries are not exported.',
            hwz_back_title: 'Back Cover',
            hwz_back_sum: 'Optionally add the back cover image, the last page of the document.',
            hwz_back_tip: 'You can skip this step.',
            hwz_finish_title: 'Save and export',
            hwz_finish_sum: 'Save a copy of the module to a file, then export it in the language you need.',
            hwz_finish_tip: 'Check the export language first: it can differ from the language you write in.'
        },
        fr: {
            hwzTitle: 'Assistant pas à pas',
            hwzChip: 'Assistant',
            hwzChipTip: 'Ouvrir l’assistant pas à pas',
            hwzStepOf: 'Étape {v0} sur {v1}',
            hwzClose: 'Fermer',
            hwzBack: 'Précédent',
            hwzNext: 'Suivant',
            hwzGo: 'Aller à cet onglet',
            hwzGuide: 'Ouvrir le guide ?',
            hwzHide: 'Masquer le bouton de l’assistant',
            hwzHiddenMsg: 'Le bouton de l’assistant est masqué. Relancez-le depuis l’onglet Aide.',
            hwzDone: 'Terminé',
            hwzPartial: 'En cours',
            hwzTodo: 'À faire',
            hwzOptional: 'Facultatif',
            hwzSave: 'Enregistrer le module',
            hwzExportWord: 'Exporter vers Word',
            hwzMetNoOutcomes: 'Aucun résultat d’apprentissage pour l’instant',
            hwzMetOutcomes: '{v0} résultat(s) d’apprentissage sur {v1}',
            hwzMetModules: '{v0} module(s), {v1} résultat(s) d’apprentissage dans le module ouvert',
            hwzMetImage: 'Image ajoutée',
            hwzMetNoImage: 'Pas encore d’image',
            hwzMetTeam: '{v0} membre(s) d’équipe',
            hwzMetItems: '{v0} élément(s)',
            hwzFinishTitle: 'Enregistrer et exporter',
            hwzHelpCardTitle: 'Assistant pas à pas',
            hwzHelpCardText: 'Un parcours court des onglets dans l’ordre du document exporté, qui montre ce qui est fait et vous mène à chaque onglet.',
            hwzHelpCardStart: 'Lancer l’assistant',
            hwz_modules_title: 'Informations du module',
            hwz_modules_sum: 'Créez votre module, puis ajoutez ses résultats d’apprentissage : tout le reste en dépend. Vous avez un tableau DACUM ? Importez-le au lieu de le ressaisir.',
            hwz_modules_tip: 'Nommez chaque résultat par ce que l’apprenant saura faire.',
            hwz_cover_title: 'Couverture',
            hwz_cover_sum: 'Importez l’image de couverture. Elle devient la première page du document exporté.',
            hwz_cover_tip: 'Une image de 2480 × 3508 px donne une page A4 nette. Le tableau d’informations de couverture est dans l’onglet Informations du module.',
            hwz_intro_title: 'Pages d’introduction',
            hwz_intro_sum: 'Ajoutez l’équipe de travail et remplissez le tableau de présentation du module. Ces pages sont communes à tous les modules du projet.',
            hwz_intro_tip: 'Les lignes sans nom ni texte ne sont pas exportées.',
            hwz_unit_title: 'Unité d’apprentissage',
            hwz_unit_sum: 'Donnez à chaque unité d’apprentissage son introduction et ses connaissances.',
            hwz_unit_tip: 'Des sections courtes et concrètes valent mieux qu’un long texte.',
            hwz_info_title: 'Fiche d’information',
            hwz_info_sum: 'Rédigez ce que l’apprenant doit SAVOIR : sections avec texte, images et tableaux, puis une auto-évaluation et son corrigé.',
            hwz_info_tip: 'Terminez chaque fiche par des questions d’auto-évaluation qui testent son objectif.',
            hwz_activity_title: 'Fiche d’activité / de travail',
            hwz_activity_sum: 'Rédigez ce que l’apprenant doit FAIRE : les ressources, les étapes (chacune commençant par un verbe) et la liste de vérification des critères de performance.',
            hwz_activity_tip: 'Placez chaque avertissement de sécurité à l’étape concernée.',
            hwz_reflection_title: 'Réflexion',
            hwz_reflection_sum: 'Ajoutez les questions de réflexion qui terminent l’unité d’apprentissage.',
            hwz_reflection_tip: 'Choisissez le nombre de lignes de réponse de chaque question.',
            hwz_assessment_title: 'Unité d’évaluation',
            hwz_assessment_sum: 'Complétez un formulaire de portfolio de preuves par résultat d’apprentissage : les critères, les preuves et le résultat.',
            hwz_assessment_tip: 'Compétent seulement si tous les critères sont satisfaits.',
            hwz_tools_title: 'Outils et ressources',
            hwz_tools_sum: 'Listez les outils, équipements et matériaux du module, un par ligne. Reprenez-les de DACUM si vous avez reçu une analyse des tâches.',
            hwz_tools_tip: 'Laissez la liste vide pour ne pas imprimer la page.',
            hwz_refs_title: 'Références',
            hwz_refs_sum: 'Ajoutez les livres, normes et sources utilisés.',
            hwz_refs_tip: 'Les entrées vides ne sont pas exportées.',
            hwz_back_title: 'Quatrième de couverture',
            hwz_back_sum: 'Ajoutez, si vous le souhaitez, l’image de quatrième de couverture, dernière page du document.',
            hwz_back_tip: 'Vous pouvez ignorer cette étape.',
            hwz_finish_title: 'Enregistrer et exporter',
            hwz_finish_sum: 'Enregistrez une copie du module dans un fichier, puis exportez-le dans la langue voulue.',
            hwz_finish_tip: 'Vérifiez d’abord la langue d’export : elle peut différer de votre langue de rédaction.'
        },
        ar: {
            hwzTitle: 'المساعد خطوة بخطوة',
            hwzChip: 'المساعد',
            hwzChipTip: 'افتح المساعد خطوة بخطوة',
            hwzStepOf: 'الخطوة {v0} من {v1}',
            hwzClose: 'إغلاق',
            hwzBack: 'السابق',
            hwzNext: 'التالي',
            hwzGo: 'اذهب إلى هذا التبويب',
            hwzGuide: 'افتح إرشادات ؟',
            hwzHide: 'إخفاء زر المساعد',
            hwzHiddenMsg: 'أُخفي زر المساعد. يمكنك تشغيله من تبويب المساعدة.',
            hwzDone: 'مكتمل',
            hwzPartial: 'قيد الإنجاز',
            hwzTodo: 'لم يبدأ',
            hwzOptional: 'اختياري',
            hwzSave: 'حفظ الوحدة',
            hwzExportWord: 'تصدير إلى Word',
            hwzMetNoOutcomes: 'لا توجد محصلة تعلم بعد',
            hwzMetOutcomes: 'محصلات التعلم المنجزة: {v0} من {v1}',
            hwzMetModules: '{v0} وحدة، و{v1} محصلة تعلم في الوحدة المفتوحة',
            hwzMetImage: 'أُضيفت الصورة',
            hwzMetNoImage: 'لا توجد صورة بعد',
            hwzMetTeam: '{v0} من أعضاء الفريق',
            hwzMetItems: '{v0} من العناصر',
            hwzFinishTitle: 'الحفظ والتصدير',
            hwzHelpCardTitle: 'المساعد خطوة بخطوة',
            hwzHelpCardText: 'جولة قصيرة بين التبويبات بترتيب المستند المُصدَّر، تُظهر ما أُنجز وتنقلك إلى كل تبويب.',
            hwzHelpCardStart: 'ابدأ المساعد',
            hwz_modules_title: 'معلومات الوحدة',
            hwz_modules_sum: 'أنشئ وحدتك ثم أضف محصلات تعلمها؛ فكل ما عدا ذلك يتفرع منها. استلمت مخطط DACUM؟ استورده بدل إعادة الكتابة.',
            hwz_modules_tip: 'سمِّ كل محصلة بما سيكون المتعلم قادراً على فعله.',
            hwz_cover_title: 'الغلاف الأمامي',
            hwz_cover_sum: 'ارفع صورة الغلاف الأمامي؛ تصبح الصفحة الأولى من المستند المُصدَّر.',
            hwz_cover_tip: 'صورة بقياس 2480 × 3508 بكسل تعطي صفحة A4 واضحة. وجدول معلومات الغلاف في تبويب معلومات الوحدة.',
            hwz_intro_title: 'صفحات التقديم',
            hwz_intro_sum: 'أضف فريق العمل واملأ جدول نظرة عامة على الوحدة. هذه الصفحات مشتركة بين كل وحدات المشروع.',
            hwz_intro_tip: 'الصفوف التي بلا اسم أو نص لا تُصدَّر.',
            hwz_unit_title: 'الوحدة التعلمية',
            hwz_unit_sum: 'أعطِ كل وحدة تعلمية مقدمتها ومحتوى معارفها.',
            hwz_unit_tip: 'الأقسام القصيرة والملموسة أنفع من النص الطويل.',
            hwz_info_title: 'ورقة المعلومات',
            hwz_info_sum: 'اكتب ما يجب أن يعرفه المتعلم: أقساماً بنص وصور وجداول، ثم تقييماً ذاتياً وأجوبته النموذجية.',
            hwz_info_tip: 'اختم كل ورقة بأسئلة تقييم ذاتي تختبر هدفها.',
            hwz_activity_title: 'ورقة النشاط/العمل',
            hwz_activity_sum: 'اكتب ما يجب أن يؤديه المتعلم: الموارد والخطوات (كل خطوة تبدأ بفعل) وقائمة تدقيق معايير الأداء.',
            hwz_activity_tip: 'ضع كل تحذير للسلامة عند الخطوة التي ينطبق عليها.',
            hwz_reflection_title: 'التأمل',
            hwz_reflection_sum: 'أضف أسئلة التأمل التي تختم الوحدة التعلمية.',
            hwz_reflection_tip: 'اختر عدد أسطر الإجابة لكل سؤال.',
            hwz_assessment_title: 'وحدة التقييم',
            hwz_assessment_sum: 'أكمل استمارة حافظة أدلة لكل محصلة تعلم: المعايير والأدلة والنتيجة.',
            hwz_assessment_tip: 'كفؤ فقط عند تحقق كل المعايير.',
            hwz_tools_title: 'الأدوات والموارد',
            hwz_tools_sum: 'اسرد أدوات الوحدة ومعداتها ومواردها، عنصراً في كل سطر. وخذها من DACUM إن استلمت تحليل مهام.',
            hwz_tools_tip: 'اترك القائمة فارغة لتجاوز الصفحة.',
            hwz_refs_title: 'المراجع',
            hwz_refs_sum: 'أضف الكتب والمعايير والمصادر التي استخدمتها.',
            hwz_refs_tip: 'المدخلات الفارغة لا تُصدَّر.',
            hwz_back_title: 'الغلاف الخلفي',
            hwz_back_sum: 'أضف اختيارياً صورة الغلاف الخلفي، وهي الصفحة الأخيرة من المستند.',
            hwz_back_tip: 'يمكنك تجاوز هذه الخطوة.',
            hwz_finish_title: 'الحفظ والتصدير',
            hwz_finish_sum: 'احفظ نسخة من الوحدة في ملف، ثم صدّرها باللغة التي تحتاجها.',
            hwz_finish_tip: 'تحقق أولاً من لغة التصدير؛ فقد تختلف عن لغة كتابتك.'
        }
    });
})();
