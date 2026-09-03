// ============================================================
// /src/shortcuts.js
// Keyboard shortcuts — and the single list that both BINDS them and
// DOCUMENTS them.
//
// WHY ONE LIST
// The Shortcuts pane in the export centre is built from MB_SHORTCUTS,
// the same array the listener reads. Documentation written separately
// from behaviour drifts the first time a key changes, and a printed
// shortcut that does nothing is worse than no list at all.
//
// WHAT IS DELIBERATELY NOT BOUND
// Anything a single letter could trigger. This tool is a text editor
// for most of the time it is open, and a bare-letter shortcut fires
// while somebody is writing a performance criterion. Every entry here
// needs Ctrl (or ⌘), and the handler bails out early inside any field.
//
// Ctrl+S is intercepted rather than left to the browser: "Save page" is
// never what someone pressing it in this tool wants, and the tool's own
// save is one call away.
// ============================================================

/* action: the global function name, resolved at press time so a module
   that loads later still works. keys: what the pane prints. */
var MB_SHORTCUTS = [
    { id: 'save',     combo: { ctrl: true, key: 's' }, action: 'saveWork',
      label: { en: 'Save work',            fr: 'Enregistrer le travail', ar: 'حفظ العمل' } },
    { id: 'word',     combo: { ctrl: true, key: 'e' }, action: 'exportToDocx',
      label: { en: 'Export to Word',       fr: 'Exporter vers Word',     ar: 'تصدير إلى Word' } },
    { id: 'pptx',     combo: { ctrl: true, shift: true, key: 'p' }, action: 'mbExportToPptx',
      label: { en: 'Export to PowerPoint', fr: 'Exporter en PowerPoint', ar: 'تصدير إلى باوربوينت' } },
    { id: 'settings', combo: { ctrl: true, key: ',' }, action: 'openWordSettings',
      label: { en: 'Export settings',      fr: 'Réglages d\u2019export',  ar: 'إعدادات التصدير' } },
    /* Not bound here — the dialogs bind their own Escape and always
       have. Listed because a shortcuts pane that omits the one key
       everybody tries first is not a shortcuts pane. */
    { id: 'close',    combo: { key: 'Escape' }, action: null,
      label: { en: 'Close the open dialog', fr: 'Fermer la boîte de dialogue', ar: 'إغلاق النافذة المفتوحة' } }
];

/** "Ctrl + S" / "⌘ + S", for printing. */
function mbShortcutText(sc) {
    var mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '');
    var parts = [];
    if (sc.combo.ctrl)  parts.push(mac ? '\u2318' : 'Ctrl');
    if (sc.combo.shift) parts.push(mac ? '\u21E7' : 'Shift');
    var k = sc.combo.key;
    parts.push(k.length === 1 ? k.toUpperCase() : k);
    return parts.join(' + ');
}

function mbShortcutLabel(sc, lang) {
    return sc.label[lang] || sc.label.en;
}

(function MbShortcuts() {
    'use strict';

    function typing(el) {
        if (!el) return false;
        if (el.isContentEditable) return true;
        return /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName || '');
    }

    document.addEventListener('keydown', function (e) {
        if (!(e.ctrlKey || e.metaKey)) return;      /* every bound combo needs it */

        for (var i = 0; i < MB_SHORTCUTS.length; i++) {
            var sc = MB_SHORTCUTS[i];
            if (!sc.action || !sc.combo.ctrl) continue;
            if (!!sc.combo.shift !== e.shiftKey) continue;
            if (String(e.key).toLowerCase() !== sc.combo.key) continue;

            /* Ctrl+S is taken even inside a field: the browser's "save
               page" is never the intent, and losing an hour of typing to
               a missed save is the failure this tool exists to prevent.
               The others yield to whatever the user is writing. */
            if (typing(document.activeElement) && sc.id !== 'save') return;

            var fn = window[sc.action];
            if (typeof fn !== 'function') return;   /* module not loaded */
            e.preventDefault();
            try { fn(); } catch (err) { console.error('Shortcut ' + sc.id + ' threw:', err); }
            return;
        }
    });
})();
