// ============================================================
// /src/events.js
// One delegated listener per event type, replacing 81 inline handlers.
//
// WHY
// Inline `onclick="fn()"` resolves the name against the GLOBAL scope and
// nowhere else. That single fact is what has kept every file in this
// project a classic script: the moment anything becomes an ES module its
// functions leave the global scope and every button in the tool stops
// working on the first click. Removing the inline handlers is therefore
// not a tidiness exercise — it is the precondition for the module flip,
// and for ever running this tool under a Content-Security-Policy that
// forbids inline script, which most hosting worth deploying to does.
//
// HOW
// The markup now says WHAT should happen, not HOW:
//     <button data-act="addResource">
//     <button data-act="switchTab" data-args='["covers"]'>
//     <select data-act="switchModule" data-on="change">
// A registry maps each name to a function. A name that is not in the
// registry does nothing and says so in the console — an unknown action
// is a typo, and silently ignoring it is how a dead button survives to
// production.
//
// The registry is also a whitelist. Dispatching on an arbitrary string
// pulled from the DOM is only safe because the string has to match a key
// that this file put there deliberately.
// ============================================================

/* Actions that need more than "call the function": DOM-flavoured
   behaviour that used to sit in the attribute itself. */
var MB_UI_ACTIONS = {
    openFrontCoverPicker: function () { document.getElementById('front-cover-image-input').click(); },
    openBackCoverPicker:  function () { document.getElementById('back-cover-image-input').click(); }
};

/**
 * Resolve an action name to a function.
 *
 * Looks in MB_UI_ACTIONS first, then at the global functions the rest of
 * the app still defines. The second lookup is the transition seam: once
 * every module exports properly, MB_UI_ACTIONS becomes the whole registry
 * and the `window[name]` branch is deleted. Keeping it explicit — rather
 * than letting the dispatcher fall through to whatever happens to be
 * global — means the day that branch can go, it is one line.
 */
function mbResolveAction(name) {
    if (Object.prototype.hasOwnProperty.call(MB_UI_ACTIONS, name)) return MB_UI_ACTIONS[name];
    var fn = window[name];
    return (typeof fn === 'function') ? fn : null;
}

/* `"$value"` stands for the element's current value.
   Several converted handlers were written as `update(id, this.value)`.
   `this` cannot survive into a data attribute: the attribute is built
   once, when the row is rendered, so anything evaluated there freezes at
   render time — an empty string, forever. The sentinel defers the read
   to dispatch time, which is what `this.value` meant. */
function mbReadArgs(el) {
    var raw = el.getAttribute('data-args');
    if (!raw) return [];
    var v;
    try {
        v = JSON.parse(raw);
    } catch (e) {
        console.warn('data-args is not valid JSON on', el, raw);
        return [];
    }
    if (!Array.isArray(v)) v = [v];
    return v.map(function (a) {
        if (a === '$value')   return el.value;
        if (a === '$checked') return el.checked;
        return a;
    });
}

/**
 * Handlers used to receive `this` (the element) and `event` implicitly.
 * Several still expect them — `handleFrontCoverUpload(this)` and
 * `handleFrontCoverDrop(event)` did. Rather than give every action a new
 * signature, the element and event are appended after the declared args,
 * so a function that ignores them is unaffected and one that wants them
 * finds them where its old inline call put them.
 */
function mbDispatch(ev) {
    var el = ev.target.closest ? ev.target.closest('[data-act]') : null;
    if (!el) return;

    /* Only fire for the event type the element asked for. Default is
       click, so the common case needs no attribute. */
    var want = el.getAttribute('data-on') || 'click';
    if (want !== ev.type) return;

    var name = el.getAttribute('data-act');
    var fn = mbResolveAction(name);
    if (!fn) {
        console.warn('No handler registered for data-act="' + name + '"');
        return;
    }

    var args = mbReadArgs(el);
    /* Several actions are async now (they can raise a modal). Their
       result is a Promise nobody awaits, which is correct here — this is
       the top of the stack — but an unhandled rejection would be
       invisible, so it is caught. */
    var out;
    try {
        out = fn.apply(el, args.concat([el, ev]));
    } catch (e) {
        console.error('Action "' + name + '" threw:', e);
        return;
    }
    if (out && typeof out.catch === 'function') {
        out.catch(function (e) { console.error('Action "' + name + '" rejected:', e); });
    }
}

/**
 * Cover drop zones.
 *
 * Not expressible as `data-act`: one element, four different events, and
 * dragover has to call preventDefault() or the browser navigates away to
 * the dropped file instead of handing it over. Wired explicitly, which
 * is what stateful drag-and-drop deserves anyway.
 */
function mbBindDropZones() {
    document.querySelectorAll('[data-dropzone]').forEach(function (zone) {
        var which = zone.getAttribute('data-dropzone');
        var hover = which === 'front' ? '#e0f2fe' : '#ede9fe';

        zone.addEventListener('click', function () {
            document.getElementById(which + '-cover-image-input').click();
        });
        zone.addEventListener('dragover', function (e) {
            e.preventDefault();          // without this, drop never fires
            zone.style.background = hover;
        });
        zone.addEventListener('dragleave', function () {
            zone.style.background = 'white';
        });
        zone.addEventListener('drop', function (e) {
            zone.style.background = 'white';
            var fn = which === 'front' ? window.handleFrontCoverDrop : window.handleBackCoverDrop;
            if (typeof fn === 'function') fn(e);
        });
    });
}

/**
 * Bind once, on the document.
 *
 * Delegation is what makes this work for rows that do not exist yet:
 * every step, criterion and resource the renderers add later is covered
 * without rebinding, which the inline-handler approach could only manage
 * by rebuilding the attribute string on every render.
 */
function mbBindEvents() {
    ['click', 'change', 'input', 'blur', 'focus'].forEach(function (type) {
        /* blur and focus do not bubble; their capturing phase does. */
        var capture = (type === 'blur' || type === 'focus');
        document.addEventListener(type, mbDispatch, capture);
    });
    mbBindDropZones();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mbBindEvents);
} else {
    mbBindEvents();
}
