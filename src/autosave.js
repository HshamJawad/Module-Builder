// ============================================================
// /src/autosave.js
// Autosave + backup reminder. Self-contained IIFE; touches no
// other module's variables except through window/global reads.
// Extracted from Module_Builder.html lines 7058-EOF (v2.0-legacy).
// ============================================================

(function AutoSaveModule() {
        'use strict';

        const LS_KEY        = 'module_builder_autosave';
        const DEBOUNCE_MS   = 900;
        const REMINDER_MS   = 8 * 60 * 1000;   // 8 minutes
        const TOAST_HIDE_MS = 7000;

        let _debounceTimer   = null;
        let _reminderTimer   = null;
        let _toastEl         = null;
        let _sessionBannerEl = null;
        let _initialized     = false;

        /* ── CSS ──────────────────────────────────────────────────── */
        const style = document.createElement('style');
        style.textContent = `
            #as-session-banner {
                position: fixed;
                bottom: 80px;
                right: 20px;
                background: #1e293b;
                color: #e2e8f0;
                padding: 10px 16px;
                border-radius: 10px;
                font-size: 0.82em;
                font-weight: 500;
                box-shadow: 0 4px 16px rgba(0,0,0,0.25);
                z-index: 99990;
                display: flex;
                align-items: center;
                gap: 10px;
                opacity: 0;
                transform: translateY(8px);
                transition: opacity 0.3s, transform 0.3s;
                max-width: 300px;
            }
            #as-session-banner.as-visible {
                opacity: 1;
                transform: translateY(0);
            }
            #as-session-banner .as-dismiss {
                background: transparent;
                border: none;
                color: #94a3b8;
                cursor: pointer;
                font-size: 1em;
                padding: 0 2px;
                line-height: 1;
            }
            #as-session-banner .as-dismiss:hover { color: #e2e8f0; }

            #as-reminder-toast {
                position: fixed;
                bottom: 24px;
                right: 20px;
                background: #0f172a;
                color: #e2e8f0;
                padding: 12px 16px;
                border-radius: 12px;
                font-size: 0.83em;
                font-weight: 500;
                box-shadow: 0 6px 24px rgba(0,0,0,0.3);
                z-index: 99991;
                display: flex;
                align-items: center;
                gap: 12px;
                opacity: 0;
                transform: translateY(12px);
                transition: opacity 0.3s, transform 0.3s;
                pointer-events: none;
                max-width: 320px;
            }
            #as-reminder-toast.as-visible {
                opacity: 1;
                transform: translateY(0);
                pointer-events: auto;
            }
            #as-reminder-toast .as-save-now {
                background: #667eea;
                color: white;
                border: none;
                padding: 5px 13px;
                border-radius: 6px;
                font-size: 0.9em;
                font-weight: 700;
                cursor: pointer;
                white-space: nowrap;
                transition: background 0.15s;
            }
            #as-reminder-toast .as-save-now:hover { background: #4f46e5; }
            #as-reminder-toast .as-close-toast {
                background: transparent;
                border: none;
                color: #64748b;
                cursor: pointer;
                font-size: 1.1em;
                padding: 0 2px;
                line-height: 1;
                margin-left: 2px;
            }
            #as-reminder-toast .as-close-toast:hover { color: #e2e8f0; }
            #as-autosave-dot {
                position: fixed;
                bottom: 8px;
                right: 10px;
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: #10b981;
                opacity: 0;
                transition: opacity 0.4s;
                z-index: 99989;
                pointer-events: none;
            }
            #as-autosave-dot.as-flash { opacity: 1; }
        `;
        document.head.appendChild(style);

        /* ── DOM Elements ─────────────────────────────────────────── */
        function buildUI() {
            // Session restored banner
            _sessionBannerEl = document.createElement('div');
            _sessionBannerEl.id = 'as-session-banner';
            _sessionBannerEl.innerHTML = `
                <span>✅ <span data-i18n="asRestored">${window.i18n.t('asRestored')}</span></span>
                <button class="as-dismiss" title="${window.i18n.t('dgDismiss')}" data-i18n-title="dgDismiss">✕</button>
            `;
            _sessionBannerEl.querySelector('.as-dismiss').onclick = hideBanner;
            document.body.appendChild(_sessionBannerEl);

            // Backup reminder toast
            _toastEl = document.createElement('div');
            _toastEl.id = 'as-reminder-toast';
            _toastEl.innerHTML = `
                <span>💾 <span data-i18n="asBackupReminder">${window.i18n.t('asBackupReminder')}</span></span>
                <button class="as-save-now" data-i18n="asSaveNow">${window.i18n.t('asSaveNow')}</button>
                <button class="as-close-toast" title="${window.i18n.t('dgDismiss')}" data-i18n-title="dgDismiss">✕</button>
            `;
            _toastEl.querySelector('.as-save-now').onclick = function() {
                hideToast();
                if (typeof saveWork === 'function') saveWork();
                resetReminderTimer();
            };
            _toastEl.querySelector('.as-close-toast').onclick = function() {
                hideToast();
                resetReminderTimer();
            };
            document.body.appendChild(_toastEl);

            // Autosave activity dot
            const dot = document.createElement('div');
            dot.id = 'as-autosave-dot';
            document.body.appendChild(dot);
        }

        /* ── Snapshot ─────────────────────────────────────────────── */
        function collectSnapshot() {
            try {
                /* Flush current form state into data structures.
                   syncProjectTextFromDOM() joined this list: without it
                   the four free-text fields below would be read from
                   state the editor has not been written into yet. It
                   also flushes the section boxes (blocks.js). */
                if (typeof saveCurrentSheetToLO  === 'function') saveCurrentSheetToLO();
                if (typeof saveCurrentModuleLOData=== 'function') saveCurrentModuleLOData();
                if (typeof saveCoverData          === 'function') saveCoverData();
                if (typeof saveWorkTeamData       === 'function') saveWorkTeamData();
                if (typeof syncProjectTextFromDOM === 'function') syncProjectTextFromDOM();

                /* ── Pairs, not .value ──────────────────────────────
                   These four were read straight off the textareas:
                       (document.getElementById('...') || {}).value || ''
                   A textarea holds ONE side of an { en, ar } pair — the
                   side currently being edited. So every autosave wrote a
                   half-project, and a crash after a content-language
                   switch restored the visible half and dropped the other
                   one, silently, with no file to fall back on. That is
                   the exact failure autosave exists to prevent. State
                   already holds both sides; the flush above makes it
                   current. */
                return {
                    version:              '3.0',
                    schemaVersion:        4,        // matches saveWork()
                    _autosave:            true,
                    _savedAt:             Date.now(),
                    coversAdditionalInfo:   mbState.coversAdditionalInfo,
                    coversAdditionalNotes:  mbState.coversAdditionalNotes,
                    frontCoverImage:      mbState.frontCoverImage  || null,
                    backCoverImage:       mbState.backCoverImage   || null,
                    coverRows:            mbState.coverRows        || [],
                    coverRowIdCounter:    mbState.coverRowIdCounter|| 7,
                    teamMembers:          mbState.teamMembers      || [],
                    teamMemberIdCounter:  mbState.teamMemberIdCounter || 0,
                    introAdditionalDetails: mbState.introAdditionalDetails,
                    introBlocks:          mbState.introBlocks      || [],
                    modules:              mbState.modulesData      || [],
                    currentModuleId:      mbState.currentModuleId  || null,
                    moduleIdCounter:      mbState.moduleIdCounter  || 0,
                    currentLOId:          mbState.currentLOId      || null,
                    loIdCounter:          mbState.loIdCounter      || 0,
                    assessmentContent:    mbState.assessmentContent,
                    assessmentFormsData:  mbState.assessmentFormsData || {},
                    /* null, never 'References' — see the restore note.
                       The literal here put the English heading into
                       storage on the first autosave of a new project,
                       so it came back through the restore path even
                       after that path was fixed. */
                    referencesTitle:      mbState.referencesTitle  || null,
                    referencesData:       mbState.referencesData   || [],
                    refIdCounter:         mbState.refIdCounter     || 1,
                    /* The framework card is project-level state like the
                       cover rows, so it belongs in the crash snapshot for
                       the same reason they do: a browser that dies with
                       an hour of accreditation detail typed into it and
                       never saved to a file has lost it otherwise. */
                    tvqfBasic:            mbState.tvqfBasic        || {},
                    tvqfExtended:         mbState.tvqfExtended     || {},
                };
            } catch(e) {
                console.warn('[AutoSave] snapshot error:', e);
                return null;
            }
        }

        /* ── Save through the persistence layer ───────────────────── */
        function persistSnapshot() {
            const snap = collectSnapshot();
            if (!snap) return;
            mbSaveDoc(MB_KEYS.autosave, snap)
                .then(flashDot)
                .catch(function (e) {
                    /* Autosave degrades quietly by design — it fires every
                       few seconds and a modal on each failure would make
                       the tool unusable exactly when storage is full. The
                       DELIBERATE save in storage.js does surface it. */
                    console.warn('[AutoSave] write failed:', e.message);
                });
        }

        function flashDot() {
            const dot = document.getElementById('as-autosave-dot');
            if (!dot) return;
            dot.classList.add('as-flash');
            setTimeout(() => dot.classList.remove('as-flash'), 1200);
        }

        /* ── Debounced trigger ────────────────────────────────────── */
        function scheduleSave() {
            clearTimeout(_debounceTimer);
            _debounceTimer = setTimeout(persistSnapshot, DEBOUNCE_MS);
        }

        /* ── Restore on load ──────────────────────────────────────── */
        /**
         * THE call site the old comment here flagged as "the one to
         * convert first". It is converted.
         *
         * It used to read the snapshot with mbGetSetting — the SETTINGS
         * accessor, synchronous, localStorage-only — which worked only
         * because both APIs happened to sit on the same backend. Now
         * that documents live in IndexedDB, a synchronous read cannot
         * exist: IndexedDB has no such operation at all. So this returns
         * a Promise, and its one caller awaits it.
         *
         * The snapshot also arrives as an OBJECT now, not a JSON string
         * — structured clone stores the shape itself. The JSON.parse
         * branch is kept for a snapshot still coming from the
         * localStorage fallback on a browser that refused IndexedDB.
         */
        function tryRestore() {
            return mbLoadDoc(MB_KEYS.autosave).then(function (snap) {
                if (!snap) return false;

                if (snap.__corrupt) {
                    console.warn('[AutoSave] stored snapshot is unreadable; leaving it in place');
                    return false;
                }
                if (typeof snap === 'string') {
                    try { snap = JSON.parse(snap); } catch (e) { return false; }
                }
                if (!snap._autosave || !snap.version) return false;

                // Re-use the existing handleLoadFile logic by dispatching
                // data into the same path as manual JSON load
                if (typeof restoreFromData === 'function') {
                    restoreFromData(snap);
                } else {
                    // Fallback: fire the internal load pipeline directly
                    _applySnapshot(snap);
                }
                return true;
            }).catch(function (e) {
                console.warn('[AutoSave] restore error:', e);
                return false;
            });
        }

        function _applySnapshot(data) {
            // This mirrors handleLoadFile logic for v3.0
            // We call the same branch used by the existing load system
            const evt = new CustomEvent('autosave:restore', { detail: data });
            document.dispatchEvent(evt);
        }

        /* ── Banner ───────────────────────────────────────────────── */
        function showBanner() {
            if (!_sessionBannerEl) return;
            _sessionBannerEl.classList.add('as-visible');
            setTimeout(hideBanner, 6000);
        }
        function hideBanner() {
            if (_sessionBannerEl) _sessionBannerEl.classList.remove('as-visible');
        }

        /* ── Reminder toast ───────────────────────────────────────── */
        function showToast() {
            if (!_toastEl) return;
            _toastEl.classList.add('as-visible');
            setTimeout(hideToast, TOAST_HIDE_MS);
        }
        function hideToast() {
            if (_toastEl) _toastEl.classList.remove('as-visible');
        }
        function resetReminderTimer() {
            clearTimeout(_reminderTimer);
            _reminderTimer = setTimeout(showToast, REMINDER_MS);
        }

        /* ── Attach input listeners ───────────────────────────────── */
        function attachListeners() {
            // All input/change/click events on the main container
            const root = document.getElementById('main-container') || document.body;
            ['input', 'change'].forEach(evt => {
                root.addEventListener(evt, scheduleSave, { passive: true });
            });

            // Also hook into the existing saveWork button to reset reminder timer
            document.querySelectorAll('[onclick*="saveWork"]').forEach(btn => {
                btn.addEventListener('click', function() {
                    resetReminderTimer();
                    // Clear autosave after manual save (optional — keeps it for safety)
                }, { passive: true });
            });
        }

        /* ── Listen for restore event (from _applySnapshot) ──────── */
        document.addEventListener('autosave:restore', function(e) {
            const data = e.detail;
            if (!data || typeof data !== 'object') return;

            // Mirror the existing v3.0 load path from handleLoadFile
            try {
                /* Into state, then onto the screen through the one
                   function that knows which side to show. Assigning
                   .value directly printed "[object Object]" the moment
                   the snapshot started carrying pairs. biUpgrade keeps
                   older snapshots working: a bare string is lifted to a
                   pair, its side guessed from its script, exactly as
                   biMigrateProject does for old project files. */
                mbState.coversAdditionalInfo  = biUpgrade(data.coversAdditionalInfo);
                mbState.coversAdditionalNotes = biUpgrade(data.coversAdditionalNotes);

                mbState.frontCoverImage = data.frontCoverImage || null;
                mbState.backCoverImage  = data.backCoverImage  || null;
                if (typeof _showCoverPreview === 'function') {
                    if (mbState.frontCoverImage) _showCoverPreview('front', mbState.frontCoverImage);
                    else if (typeof deleteFrontCoverImage === 'function') deleteFrontCoverImage();
                    if (mbState.backCoverImage)  _showCoverPreview('back',  mbState.backCoverImage);
                    else if (typeof deleteBackCoverImage  === 'function') deleteBackCoverImage();
                }
                if (data.coverRows && typeof renderCoverTable === 'function') {
                    mbState.coverRows         = data.coverRows;
                    mbState.coverRowIdCounter = data.coverRowIdCounter || 7;
                    renderCoverTable();
                }
                if (data.teamMembers && typeof renderWorkTeam === 'function') {
                    mbState.teamMembers          = data.teamMembers;
                    mbState.teamMemberIdCounter  = data.teamMemberIdCounter || 0;
                    renderWorkTeam();
                }
                mbState.introAdditionalDetails = biUpgrade(data.introAdditionalDetails);
                /* mbNormalizeBlocks is idempotent and tolerates the key
                   being absent — every snapshot written before this
                   feature existed. */
                if (typeof mbNormalizeBlocks === 'function') {
                    mbState.introBlocks = mbNormalizeBlocks(data.introBlocks);
                }

                mbState.assessmentContent = biUpgrade(data.assessmentContent);
                if (data.assessmentFormsData)
                    mbState.assessmentFormsData = data.assessmentFormsData;

                /* One call paints all four textareas and every section
                   box, on the side the author is editing. */
                if (typeof applyProjectTextToDOM === 'function') applyProjectTextToDOM();

                /* `|| 'References'` is what overwrote the seeded Arabic
                   heading on every restore. mb_state.js leaves this null
                   deliberately: null is the signal mbSeedReferencesTitle()
                   waits for, and it fills BOTH sides from the dictionary.
                   A literal here is a translation the dictionary has no
                   say over — the same mistake the cover-row labels used
                   to carry. */
                mbState.referencesTitle = data.referencesTitle
                    ? biUpgrade(data.referencesTitle)
                    : null;
                mbState.referencesData  = data.referencesData  || [];
                mbState.refIdCounter    = data.refIdCounter    || 1;
                if (typeof mbSeedReferencesTitle === 'function') mbSeedReferencesTitle();
                if (typeof renderReferences === 'function') renderReferences();

                mbState.tvqfBasic    = data.tvqfBasic    || {};
                mbState.tvqfExtended = data.tvqfExtended || {};
                if (typeof mbRenderTvqf === 'function') mbRenderTvqf();

                if (data.modules && typeof renderModuleSelector === 'function') {
                    mbState.modulesData      = data.modules;
                    mbState.currentModuleId  = data.currentModuleId || null;
                    mbState.moduleIdCounter  = data.moduleIdCounter || 0;
                    mbState.currentLOId      = data.currentLOId    || null;
                    mbState.loIdCounter      = data.loIdCounter    || 0;

                    if (typeof syncLearningOutcomesFromCurrentModule === 'function')
                        syncLearningOutcomesFromCurrentModule();
                    renderModuleSelector();
                    if (typeof renderLOSelector === 'function') renderLOSelector();

                    ['current-lo-selector','info-lo-selector','activity-lo-selector'].forEach(id => {
                        const s = document.getElementById(id);
                        if (s && mbState.currentLOId) s.value = mbState.currentLOId;
                    });
                    if (mbState.currentLOId && typeof loadCurrentLOSheets === 'function')
                        loadCurrentLOSheets();
                }
            } catch(err) {
                console.warn('[AutoSave] restore apply error:', err);
            }
        });

        /* ── Init ─────────────────────────────────────────────────── */
        function init() {
            if (_initialized) return;
            _initialized = true;

            buildUI();

            // Try restore after DOM + existing init have settled
            setTimeout(function() {
                /* Listeners are attached BEFORE the restore resolves, not
                   after: the read is asynchronous now and a user typing
                   during those few milliseconds would otherwise have that
                   first edit go unwatched. The restore overwrites the
                   fields either way — it is a restore. */
                attachListeners();
                resetReminderTimer();

                tryRestore().then(function (restored) {
                    if (restored) showBanner();
                });
            }, 1200);
        }

        // Wait for DOMContentLoaded (may already have fired)
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }

    })();
