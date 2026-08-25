// ============================================================
// /src/contentlang_ui.js
// The content-language switch.
//
// Deliberately NOT the interface-language switch. This one changes which
// side of every { en, ar, fr } value the editor is bound to; it does not
// translate a single button. The two are separate controls because a
// curriculum developer in Baghdad commonly authors Arabic content in an
// English interface — the tool's own labels are not what they are
// writing.
//
// It became safe to wire only once the export stopped reading the DOM.
// Before that, switching sides mid-session meant the next export could
// emit whatever happened to be on screen.
// ============================================================

/* Export language. Distinct from both other switches: the module is
   bilingual internally but the DOCX is single-language by design, so the
   author has to say which side to emit. Defaults to the side being
   edited, which is the one they can see and check. */
function renderExportLangSwitch() {
    var host = document.getElementById('export-lang-switch');
    if (!host) return;
    var cur = exportLang();
    host.innerHTML =
        '<span class="cls-label">' + window.i18n.t('mbExportLanguage') + '</span>' +
        BILANG_CODES.map(function (c) {
            return '<button type="button" class="cls-btn' + (c === cur ? ' active' : '') +
                   '" data-lang="' + c + '">' + biLangLabel(c) + '</button>';
        }).join('');
    host.querySelectorAll('.cls-btn').forEach(function (b) {
        b.addEventListener('click', function () {
            setExportLang(b.dataset.lang);
            renderExportLangSwitch();
        });
    });
}

function renderContentLangSwitch() {
    var host = document.getElementById('content-lang-switch');
    if (!host) return;
    var cur = contentLang();
    host.innerHTML =
        '<span class="cls-label">' + window.i18n.t('mbContentLanguage') + '</span>' +
        BILANG_CODES.map(function (c) {
            return '<button type="button" class="cls-btn' + (c === cur ? ' active' : '') +
                   '" data-lang="' + c + '">' + biLangLabel(c) + '</button>';
        }).join('') +
        '<span class="cls-hint" id="cls-hint"></span>';

    host.querySelectorAll('.cls-btn').forEach(function (b) {
        b.addEventListener('click', function () { switchContentLang(b.dataset.lang); });
    });
    updateContentLangHint();
}

/**
 * Switch sides.
 *
 * Order matters and is not interchangeable: flush the screen into the
 * side being LEFT, then change the side, then repaint from the side
 * being ENTERED. Repainting before flushing loses the last edit; the
 * user would see it vanish and rightly stop trusting the switch.
 */
function switchContentLang(code) {
    if (code === contentLang()) return;

    syncProjectTextFromDOM();
    if (mbState.currentLOId && typeof saveCurrentSheetToLO === 'function') saveCurrentSheetToLO();
    if (typeof saveCoverData    === 'function') saveCoverData();
    if (typeof saveWorkTeamData === 'function') saveWorkTeamData();

    setContentLang(code);

    applyProjectTextToDOM();
    if (typeof renderCoverTable   === 'function') renderCoverTable();
    if (typeof renderWorkTeam     === 'function') renderWorkTeam();
    if (typeof renderModuleSelector === 'function') renderModuleSelector();
    if (typeof renderLOSelector     === 'function') renderLOSelector();
    if (typeof updatePerformanceCriteriaPanel === 'function') updatePerformanceCriteriaPanel();
    if (mbState.currentLOId && typeof loadCurrentLOSheets === 'function') loadCurrentLOSheets();

    applyContentDirection();
    renderContentLangSwitch();
    renderExportLangSwitch();
    /* Announced in the language just switched TO, not in the interface
       language: the message confirms which side the editor is now bound
       to, and saying so in that language is the shortest possible proof
       that the switch did what it said. */
    showStatus(window.i18n.tfIn('dgSwitchedTo', code, { v0: biLangLabel(code) }), 'success');
}

/**
 * Direction of the EDITOR fields only.
 *
 * The page chrome keeps the interface direction. Flipping the whole
 * document to RTL because the content is Arabic would move every button
 * the user just learned the position of, on a switch they may make
 * dozens of times a day.
 */
function applyContentDirection() {
    var rtl = biIsRtl(contentLang());
    /* `.mb-content-field` is stamped on every editor input in the markup;
       the rest are rows built at runtime by the renderers, which is why
       this has to run again after every re-render, not once at boot.

       The `dir` ATTRIBUTE is what matters here, not text-align. Aligning
       text right without setting dir moves the glyphs but leaves the
       caret, Home/End and the arrow keys running left-to-right — a field
       that looks Arabic and behaves English. That is the exact symptom of
       "keyboard navigation doesn't work".

       WHICH direction, though, cannot come from contentLang() alone.
       That was the second half of "the Arabic still comes out backwards":
       a field holding Arabic text sat there in dir="ltr" — glyphs shoved
       to the left edge, punctuation at the wrong end — for the entirely
       mechanical reason that the content-language switch happened to say
       English. The setting describes which SIDE of the pair is being
       edited; it is not a promise about the script the author types.
       People type Arabic into the English side constantly, which is
       exactly what the screenshots showed.

       So the text decides when there IS text, and the setting decides
       only for an empty field, where there is nothing to inspect and the
       setting is the best guess available for where the caret should
       start. */
    var AR = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
    var LAT = /[A-Za-z\u00C0-\u024F]/;

    var dirFor = function (el) {
        var txt = ('value' in el && typeof el.value === 'string')
            ? el.value
            : (el.textContent || '');
        if (AR.test(txt)) return 'rtl';            // any Arabic wins
        if (LAT.test(txt)) return 'ltr';           // Latin only
        return rtl ? 'rtl' : 'ltr';                // empty / digits only
    };

    document.querySelectorAll('.mb-content-field, [data-content-id], [data-step-id], ' +
                              '.criteria-text, .resource-name, .cover-value, .cover-label, ' +
                              '.objective-lead, ' +
                              '.ref-input, .team-member-input, .reference-input, ' +
                              '#criteria-title, #criteria-instruction, #criteria-footer')
        .forEach(function (el) {
            if (el.getAttribute('data-dir-lock') === 'ltr') return;   // numeric fields
            /* data-dir-auto: a DISPLAY element (not an input) whose text
               may be in either language regardless of the editing side —
               the seeded cover labels, which follow the interface. Forcing
               dir="rtl" on a div holding "Sector:" is what rendered it as
               ":Sector": in an RTL paragraph the trailing colon is
               neutral, so bidi resolution puts it at the visual left end.
               dir="auto" lets the first strong character decide, per row,
               and both languages then read correctly. */
            if (el.hasAttribute('data-dir-auto')) { el.setAttribute('dir', 'auto'); el.style.textAlign = 'start'; return; }
            el.setAttribute('dir', dirFor(el));
            /* start/end, not right/left: they follow the element's own dir,
               so this stays correct if a field is ever locked the other way. */
            el.style.textAlign = 'start';
        });
}

/* Re-evaluate one field as the user types.
   Without this, a field that starts empty is stamped from the setting and
   then never reconsidered: type Arabic into an "English" field and it
   stays left-to-right until some unrelated re-render happens to sweep it.
   Delegated from the document so it covers every row any renderer will
   ever create, including ones added later. */
['input', 'focusout'].forEach(function (evt) {
    document.addEventListener(evt, function (e) {
        var el = e.target;
        if (!el || !el.matches) return;
        if (!el.matches('.mb-content-field, [data-content-id], [data-step-id], .criteria-text, ' +
                        '.resource-name, .cover-value, .ref-input, .team-member-input, ' +
                        '.reference-input, #criteria-title, #criteria-instruction, #criteria-footer')) return;
        if (el.getAttribute('data-dir-lock') === 'ltr') return;
        var txt = ('value' in el && typeof el.value === 'string') ? el.value : (el.textContent || '');
        var d = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(txt) ? 'rtl'
              : (/[A-Za-z\u00C0-\u024F]/.test(txt) ? 'ltr'
              : (biIsRtl(contentLang()) ? 'rtl' : 'ltr'));
        if (el.getAttribute('dir') !== d) { el.setAttribute('dir', d); el.style.textAlign = 'start'; }
    }, true);
});

/**
 * Completeness of the OTHER side, so a half-translated module is visible
 * before it is exported rather than after a client opens it.
 * biGetStrict, not biGet: the whole point is to count what is missing,
 * and a fallback would report a fully translated module.
 */
function updateContentLangHint() {
    var hint = document.getElementById('cls-hint');
    if (!hint) return;
    /* With two languages there was exactly one "other side" to report on.
       With three there are two, and collapsing them into a single number
       would hide the case this meter exists for: a module fully authored
       in English and Arabic and not started in French would read as
       almost complete. One count per other language, side by side. */
    var cur = contentLang();
    var others = BILANG_CODES.filter(function (c) { return c !== cur; });
    var total = 0, filled = {};
    others.forEach(function (c) { filled[c] = 0; });

    function walk(v) {
        if (v === null || typeof v !== 'object') return;
        if (biIs(v)) {
            /* biEmpty, so a field nobody has filled in ANY language is
               not counted as missing work — an untouched optional field
               is not a translation debt. */
            if (!biEmpty(v)) {
                total++;
                others.forEach(function (c) {
                    if (biGetStrict(v, c).trim()) filled[c]++;
                });
            }
            return;
        }
        Object.keys(v).forEach(function (k) { walk(v[k]); });
    }
    walk(mbState.modulesData);
    walk(mbState.coverRows);
    walk(mbState.teamMembers);

    hint.textContent = total === 0 ? '' : others.map(function (c) {
        return biLangLabel(c) + ': ' + filled[c] + '/' + total;
    }).join('  ·  ');
}

window.addEventListener('mb:contentlangchange', function () {
    applyContentDirection();
    updateContentLangHint();
});

/* ── Catch-all for rows created after boot ──────────────────────────
   A dozen renderers build their rows with innerHTML on demand: steps,
   resources, criteria, content sections, cover rows, team members,
   marks, image galleries. Those elements do not exist when
   applyContentDirection() runs at boot, and wrapping every renderer by
   hand means the next renderer somebody adds is born wrong.

   A MutationObserver stamps them as they appear. It is deliberately
   cheap: it only looks at added element subtrees, and only for the
   handful of selectors that carry content. */
(function observeNewFields() {
    if (!window.MutationObserver) return;
    var SEL = '.mb-content-field, [data-content-id], [data-step-id], .criteria-text, ' +
              '.resource-name, .cover-value, .cover-label, .ref-input, ' +
              '#criteria-title, #criteria-instruction, #criteria-footer';
    var pending = false;
    new MutationObserver(function (records) {
        if (pending) return;
        for (var i = 0; i < records.length; i++) {
            if (records[i].addedNodes.length) {
                /* Batched to one pass per frame: a renderer that appends
                   twenty rows would otherwise trigger twenty sweeps. */
                pending = true;
                /* requestAnimationFrame is absent in some embedded and
                   test environments; setTimeout is the honest fallback. */
                var next = window.requestAnimationFrame ||
                           function (fn) { return setTimeout(fn, 16); };
                next(function () { pending = false; applyContentDirection(); });
                return;
            }
        }
    }).observe(document.body, { childList: true, subtree: true });
    void SEL;
})();

/* The interface-language switch repaints translated labels and several
   renderers rebuild their rows in response. Those new rows are born with
   no dir attribute, so content direction has to be re-stamped afterwards
   — otherwise Arabic content in a freshly rebuilt table renders LTR
   until the next unrelated re-render. */
/* The i18n engine initialises from the FIRST script on the page and
   fires mb:langchange there, long before the feature modules have run.
   Repainting then is both pointless and dangerous — it reaches into
   state and renderers that do not exist yet. app.js sets this once the
   boot sequence is complete. */
var _mbBooted = false;
function mbMarkBooted() { _mbBooted = true; }

window.addEventListener('mb:langchange', function () {
    if (!_mbBooted) return;
    /* applyTranslations only reaches elements carrying data-i18n — that
       is, the ones present in index.html. Rows the renderers built call
       t() at construction time, so their labels freeze in whichever
       language was active when the row was created. Re-running the
       renderers is the only way to refresh them. */
    /* Steps, resources, criteria and content sections are built by
       innerHTML at boot, before any language switch. They call t() at
       construction, so their labels freeze in whatever language was
       active then. Rebuilding them from state is the only refresh —
       flush first, exactly as the content-language switch does, or the
       rebuild discards whatever is on screen. */
    if (mbState.currentLOId && typeof saveCurrentSheetToLO === 'function') {
        saveCurrentSheetToLO();
        if (typeof loadCurrentLOSheets === 'function') loadCurrentLOSheets();
    }
    renderContentLangSwitch();
    renderExportLangSwitch();
    if (typeof renderWorkTeam    === 'function') renderWorkTeam();
    if (typeof renderCoverTable  === 'function') renderCoverTable();
    if (typeof renderReferences  === 'function') renderReferences();
    if (typeof updatePerformanceCriteriaPanel === 'function') updatePerformanceCriteriaPanel();
    setTimeout(applyContentDirection, 0);
});
