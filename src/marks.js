// ============================================================
// /src/marks.js
// Safety / note marks
// Extracted verbatim from Module_Builder.html lines 5058-5222 (v2.0-legacy).
// ============================================================

function showAddMarkDropdown(btn, containerId) {
    // Close any open mark dropdown first
    const existing = document.querySelector('.mark-dropdown-menu');
    if (existing) { existing.remove(); return; }

    const menu = document.createElement('div');
    menu.className = 'mark-dropdown-menu';

    MARK_TYPES.forEach(mt => {
        const item = document.createElement('div');
        item.className = 'mark-dropdown-item';
        item.innerHTML = `<span>${mt.icon}</span><span>${window.i18n.t(mt.label)}</span>`;
        item.onclick = () => {
            menu.remove();
            addMarkToContainer(containerId, mt.key);
        };
        menu.appendChild(item);
    });

    document.body.appendChild(menu);

    // Position below button using actual rendered height
    const rect = btn.getBoundingClientRect();
    const menuH = menu.offsetHeight || (MARK_TYPES.length * 38 + 12);
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;

    let top, left;
    // Prefer below; flip above if not enough room below
    if (spaceBelow >= menuH || spaceBelow >= spaceAbove) {
        top = rect.bottom + 4;
    } else {
        top = Math.max(4, rect.top - menuH - 4);
    }
    left = rect.left;
    if (left + 210 > window.innerWidth) left = window.innerWidth - 215;
    if (left < 4) left = 4;

    menu.style.top  = top + 'px';
    menu.style.left = left + 'px';

    // Close on outside click
    setTimeout(() => {
        document.addEventListener('click', function handler(e) {
            if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', handler); }
        });
    }, 10);
}

function addMarkToContainer(containerId, key, text) {
    mbState.markItemCount++;
    const mt = MARK_TYPES.find(m => m.key === key);
    if (!mt) return;

    const container = document.getElementById(containerId);
    if (!container) return;

    const markDiv = document.createElement('div');
    markDiv.className = 'mark-item';
    markDiv.id = `mark-item-${mbState.markItemCount}`;
    markDiv.dataset.markKey = key;
    markDiv.style.border = `1.5px solid ${mt.border}`;
    markDiv.innerHTML = `
        <div class="mark-item-header" style="background:${mt.header};color:${mt.headerText};">
            <span>${mt.icon}&nbsp;&nbsp;${window.i18n.t(mt.label)}</span>
            <button class="mark-remove-btn" data-act="removeMark" data-args='[${mbState.markItemCount}]' title="${window.i18n.t('dgRemoveMark')}" data-i18n-title="dgRemoveMark" style="color:${mt.headerText};">×</button>
        </div>
        <textarea data-mark-id="${mbState.markItemCount}" placeholder="${window.i18n.tf('dgEnterMarkContent', { v0: window.i18n.t(mt.label) })}"
            style="background:${mt.bg};"
            >${text || ''}</textarea>
    `;
    container.appendChild(markDiv);
}

async function removeMark(id) {
    if (await mbConfirm(window.i18n.t('dgRemoveThisMarkThisAction'))) {
        const el = document.getElementById(`mark-item-${id}`);
        if (el) el.remove();
    }
}

function collectMarks(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return [];
    const marks = [];
    container.querySelectorAll('.mark-item').forEach(item => {
        const textarea = item.querySelector('textarea[data-mark-id]');
        marks.push({
            key: item.dataset.markKey,
            text: textarea ? textarea.value : ''
        });
    });
    return marks;
}

function restoreMarks(containerId, marksArray) {
    if (!marksArray || !marksArray.length) return;
    marksArray.forEach(m => addMarkToContainer(containerId, m.key, m.text));
}

function buildMarkDocxTable(mt, text) {
    /* mbDocxLib(), not window.docx. This was the last place in the
       project still destructuring the raw library, and it is why marks
       came out of an Arabic export underlined in red with a mirrored
       table handle while every other block was clean: the wrappers are
       what emit <w:lang> (the DICTIONARY — Word was checking Arabic
       against an English one and flagging every word) and
       <w:bidiVisual/> (the TABLE's own direction, separate from the
       direction of the paragraphs inside it). Bypassing the factory
       bypassed both at once. */
    const { Table, TableRow, TableCell, WidthType, BorderStyle,
            Paragraph, TextRun, AlignmentType } = mbDocxLib();

    // Strip '#' from hex colors
    const headerFill = mt.header.replace('#', '');
    const bgFill     = mt.bg.replace('#', '');
    const borderColor = mt.border.replace('#', '');
    const headerTextColor = mt.headerText === '#ffffff' ? 'FFFFFF' : '5C3600';

    // Header row cell
    const headerCell = new TableCell({
        children: [new Paragraph({
            children: [new TextRun({
                /* _mbT, not i18n.tIn(exportLang()): the label is
                   boilerplate and must be in the DOCUMENT's language.
                   exportLang() falls back to contentLang(), so an author
                   typing Arabic into the English side got an English
                   "NOTE" heading above an Arabic body. */
                text: _mbT(mt.label),
                bold: true,
                size: 22,
                color: headerTextColor,
                rightToLeft: _mbRtl(),
            })],
            alignment: _mbStart(AlignmentType),
            bidirectional: _mbRtl(),
        })],
        shading: { fill: headerFill, color: 'auto' },
        margins: { top: 100, bottom: 100, left: 150, right: 150 },
    });

    // Content row cell
    const lines = String(text || '').split('\n').filter(l => l.trim());
    const contentParas = lines.length > 0
        ? lines.map(line => new Paragraph({
            children: [new TextRun({ text: line, size: 22, rightToLeft: _mbRtl() })],
            alignment: _mbStart(AlignmentType),
            bidirectional: _mbRtl(),
            spacing: { after: 100 },
        }))
        : [new Paragraph({ children: [new TextRun({ text: ' ' })] })];

    const contentCell = new TableCell({
        children: contentParas,
        shading: { fill: bgFill, color: 'auto' },
        margins: { top: 100, bottom: 120, left: 150, right: 150 },
    });

    return new Table({
        rows: [
            new TableRow({ children: [headerCell] }),
            new TableRow({ children: [contentCell] }),
        ],
        width: { size: 9072, type: WidthType.DXA }, // 16 cm
        borders: {
            top:              { style: BorderStyle.SINGLE, size: 2, color: borderColor },
            bottom:           { style: BorderStyle.SINGLE, size: 2, color: borderColor },
            left:             { style: BorderStyle.SINGLE, size: 2, color: borderColor },
            right:            { style: BorderStyle.SINGLE, size: 2, color: borderColor },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: borderColor },
            insideVertical:   { style: BorderStyle.NONE,   size: 0, color: borderColor },
        },
    });
}

function addMarkBtnHtml(containerId) {
    /* `this` here is the button itself — the dropdown anchors to it. The
       dispatcher appends the element after the declared args, so the
       function keeps its (btn, containerId) shape by taking them in the
       other order via a thin adapter rather than being rewritten. */
    return `<button class="btn-add-mark" data-act="showAddMarkFor" data-args='["${containerId}"]'>🏷️ <span data-i18n="dgAddMark">${window.i18n.t('dgAddMark')}</span></button>`;
}

/* Adapter for the delegated dispatcher, which calls
   fn(...declaredArgs, element, event). */
function showAddMarkFor(containerId, el) {
    return showAddMarkDropdown(el, containerId);
}
