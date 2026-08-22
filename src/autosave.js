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
                // Flush current form state into data structures (read-only wrappers)
                if (typeof saveCurrentSheetToLO  === 'function') saveCurrentSheetToLO();
                if (typeof saveCurrentModuleLOData=== 'function') saveCurrentModuleLOData();
                if (typeof saveCoverData          === 'function') saveCoverData();
                if (typeof saveWorkTeamData       === 'function') saveWorkTeamData();

                return {
                    version:              '3.0',
                    _autosave:            true,
                    _savedAt:             Date.now(),
                    coversAdditionalInfo: (document.getElementById('covers-additional-info')  || {}).value || '',
                    coversAdditionalNotes:(document.getElementById('covers-additional-notes') || {}).value || '',
                    frontCoverImage:      mbState.frontCoverImage  || null,
                    backCoverImage:       mbState.backCoverImage   || null,
                    coverRows:            mbState.coverRows        || [],
                    coverRowIdCounter:    mbState.coverRowIdCounter|| 7,
                    teamMembers:          mbState.teamMembers      || [],
                    teamMemberIdCounter:  mbState.teamMemberIdCounter || 0,
                    introAdditionalDetails: (document.getElementById('intro-additional-details') || {}).value || '',
                    modules:              mbState.modulesData      || [],
                    currentModuleId:      mbState.currentModuleId  || null,
                    moduleIdCounter:      mbState.moduleIdCounter  || 0,
                    currentLOId:          mbState.currentLOId      || null,
                    loIdCounter:          mbState.loIdCounter      || 0,
                    assessmentContent:    (document.getElementById('assessment-simple-content') || {}).value || '',
                    assessmentFormsData:  mbState.assessmentFormsData || {},
                    referencesTitle:      mbState.referencesTitle  || 'References',
                    referencesData:       mbState.referencesData   || [],
                    refIdCounter:         mbState.refIdCounter     || 1,
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
        function tryRestore() {
            try {
                /* Read synchronously here: restore runs during boot and the
                   caller is not async. mbLoadDoc's Promise is resolved
                   immediately by the local backend, but relying on that
                   would break the day the backend becomes a network — so
                   this call site is flagged as the one to convert first. */
                const raw = mbGetSetting(MB_KEYS.autosave);
                if (!raw) return false;
                const snap = JSON.parse(raw);
                if (!snap || !snap._autosave || !snap.version) return false;

                // Re-use the existing handleLoadFile logic by dispatching
                // data into the same path as manual JSON load
                if (typeof restoreFromData === 'function') {
                    restoreFromData(snap);
                } else {
                    // Fallback: fire the internal load pipeline directly
                    _applySnapshot(snap);
                }
                return true;
            } catch(e) {
                console.warn('[AutoSave] restore error:', e);
                return false;
            }
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
                if (document.getElementById('covers-additional-info'))
                    document.getElementById('covers-additional-info').value = data.coversAdditionalInfo || '';
                if (document.getElementById('covers-additional-notes'))
                    document.getElementById('covers-additional-notes').value = data.coversAdditionalNotes || '';

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
                if (document.getElementById('intro-additional-details'))
                    document.getElementById('intro-additional-details').value = data.introAdditionalDetails || '';

                if (data.assessmentContent && document.getElementById('assessment-simple-content'))
                    document.getElementById('assessment-simple-content').value = data.assessmentContent;
                if (data.assessmentFormsData)
                    mbState.assessmentFormsData = data.assessmentFormsData;

                mbState.referencesTitle = data.referencesTitle || 'References';
                mbState.referencesData  = data.referencesData  || [];
                mbState.refIdCounter    = data.refIdCounter    || 1;
                if (typeof renderReferences === 'function') renderReferences();

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
                const restored = tryRestore();
                if (restored) showBanner();
                attachListeners();
                resetReminderTimer();
            }, 1200);
        }

        // Wait for DOMContentLoaded (may already have fired)
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }

    })();
