// ============================================================
// /src/autosave.js
// Autosave + backup reminder.
//
// 3.12.0: autosave no longer writes a snapshot of the session. It asks
// the module library (module_library.js) to save what is open, and the
// library writes only what changed — the open module's record, and the
// shared project data or the project record when those changed. So the
// cost of a save is the cost of ONE module, however many the project
// holds, and a page reload reopens the project where it was left: the
// "restore previous session" banner is gone with the snapshot.
// ============================================================

(function AutoSaveModule() {
        'use strict';

        const DEBOUNCE_MS   = 900;
        const REMINDER_MS   = 8 * 60 * 1000;   // 8 minutes
        const TOAST_HIDE_MS = 7000;

        let _debounceTimer   = null;
        let _reminderTimer   = null;
        let _toastEl         = null;
        let _initialized     = false;
        let _saving          = null;   // the save in flight, if any

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

            #as-offer-banner {
                position: fixed; bottom: 80px; right: 20px;
                background: #1e293b; color: #e2e8f0;
                padding: 10px 14px; border-radius: 10px;
                font-size: 0.84em; font-weight: 500;
                box-shadow: 0 4px 16px rgba(0,0,0,0.25);
                z-index: 99991; display: flex; align-items: center; gap: 10px;
                opacity: 0; pointer-events: none; transform: translateY(8px);
                transition: opacity 0.3s, transform 0.3s; max-width: 380px;
            }
            #as-offer-banner.as-visible { opacity: 1; pointer-events: auto; transform: translateY(0); }
            #as-offer-banner .as-restore-now {
                background: #6366f1; color: #fff; border: none; border-radius: 6px;
                padding: 5px 12px; font-weight: 600; cursor: pointer; white-space: nowrap;
            }
            #as-offer-banner .as-restore-now:hover { background: #4f46e5; }
            #as-offer-banner .as-dismiss {
                background: transparent; border: none; color: #94a3b8; cursor: pointer; font-size: 1em;
            }
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

        /* ── Save through the module library ──────────────────────── */
        function persistNow() {
            clearTimeout(_debounceTimer);
            _debounceTimer = null;
            if (typeof mbLibrarySave !== 'function') return Promise.resolve();
            const run = mbLibrarySave()
                .then(function (r) { if (r && r.changed) flashDot(); })
                .catch(function (e) {
                    /* Autosave degrades quietly by design — it fires every
                       few seconds and a modal on each failure would make
                       the tool unusable exactly when storage is full. The
                       DELIBERATE save (💾) surfaces its own errors. */
                    console.warn('[AutoSave] write failed:', e && e.message);
                });
            _saving = run;
            run.then(function () { if (_saving === run) _saving = null; });
            return run;
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
            _debounceTimer = setTimeout(persistNow, DEBOUNCE_MS);
        }

        /* ── Is there real work in a snapshot? ────────────────────────
           Kept for the one-time move of a 3.11 snapshot into the library
           (module_library.js): an empty one is not worth a project. */
        function _txt(v) {
            if (v === null || v === undefined) return '';
            if (typeof v === 'string') return v.trim();
            if (typeof v === 'object') return Object.keys(v).map(k => (typeof v[k] === 'string' ? v[k] : '')).join('').trim();
            return String(v).trim();
        }
        function _modulesHaveWork(modules) {
            return (modules || []).some(function (m) {
                if (m && m.taskAnalysisSource && (m.taskAnalysisSource.sourceTaskIds || []).length) return true;
                const los = (m && m.learningOutcomes) || [];
                if (los.length > 1) return true;
                return los.some(function (lo) {
                    return (lo.performanceCriteria || []).length ||
                        (lo.infoSheets || []).some(sh => _txt(sh && sh.title) || ((sh && sh.contentSections) || []).length) ||
                        (lo.activitySheets || []).some(sh => _txt(sh && sh.title) || ((sh && sh.steps) || []).length);
                });
            });
        }
        function _snapHasWork(d) {
            if (!d || typeof d !== 'object') return false;
            return _modulesHaveWork(d.modules) ||
                !!d.frontCoverImage || !!d.backCoverImage ||
                (d.teamMembers || []).length > 0 ||
                (d.introBlocks || []).length > 0 ||
                (d.referencesData || []).some(r => _txt(r && r.value)) ||
                Object.keys(d.assessmentFormsData || {}).length > 0 ||
                !!_txt(d.coversAdditionalInfo) || !!_txt(d.introAdditionalDetails);
        }
        window.mbSnapshotHasWork = _snapHasWork;

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
            const root = document.getElementById('main-container') || document.body;
            ['input', 'change'].forEach(evt => {
                root.addEventListener(evt, scheduleSave, { passive: true });
            });
            /* Buttons change state too — add a sheet, delete an image,
               reorder steps — without an input event. Any click on a
               button schedules a save; the library writes nothing when
               nothing changed, so a click that only navigates costs one
               walk of the open module. Capture phase, on the document:
               the dialogs live outside the main container. */
            document.addEventListener('click', function (e) {
                if (e.target && e.target.closest && e.target.closest('button, [data-act], label')) scheduleSave();
            }, { capture: true, passive: true });

            /* Leaving the page: the pending save goes out now. IndexedDB
               writes started here normally complete; the browser's own
               "leave page?" question is asked only while one is still
               waiting, so it no longer appears for work already saved. */
            window.addEventListener('beforeunload', function (e) {
                const pending = !!_debounceTimer || !!_saving;
                if (_debounceTimer) persistNow();
                if (!pending) return;
                e.preventDefault();
                e.returnValue = '';
                return '';
            });
            document.addEventListener('visibilitychange', function () {
                if (document.visibilityState === 'hidden' && _debounceTimer) persistNow();
            });

            /* Clear All: the library already wrote the empty project. */
            window.addEventListener('mb:projectcleared', function () {
                clearTimeout(_debounceTimer);
                _debounceTimer = null;
            });

            // The 💾 button resets the backup reminder
            document.querySelectorAll('[data-act="saveWork"]').forEach(btn => {
                btn.addEventListener('click', resetReminderTimer, { passive: true });
            });
        }

        /* For other modules: save now, wait for it. */
        window.mbAutosaveFlush = persistNow;

        /* ── Init ─────────────────────────────────────────────────── */
        function init() {
            if (_initialized) return;
            _initialized = true;
            buildUI();
            attachListeners();
            resetReminderTimer();
        }

        // Wait for DOMContentLoaded (may already have fired)
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }

    })();
