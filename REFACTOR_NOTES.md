# Module Builder — Phase 1, Step A (mechanical decomposition)

Reference behaviour: `Module_Builder.html` v2.0-legacy (7,432 lines / 382 KB).
**No line of logic was rewritten in this step.** Every function was moved
verbatim; only indentation was normalised and file headers added.

## Result

```
index.html            815 lines of markup + script tags (was 7,432)
mb-styles.css         1,373 lines  (the whole <style> block, untouched)
src/
  mb_state.js          55   global declarations
  ui.js                28   showStatus + docx load check
  tabs.js              97   switchTab, proceedToTab, guards
  covers.js            89   cover table rows
  cover_images.js      73   front/back cover upload + preview
  workteam.js          90
  modules.js          345   module CRUD + selector
  outcomes.js         332   LO CRUD + performance criteria
  sheets.js           559   info/activity sheet save-load-navigate
  content.js          354   content sections, tables, images, QR
  criteria.js          46
  assessment.js       295
  references.js        68
  resources.js         59
  marks.js            170
  steps.js            103
  storage.js          438   save/load/clear project JSON
  export_ui.js        120
  exports_docx.js   1,590   DOCX generation
  app.js               34   boot sequence (DOMContentLoaded)
  autosave.js         374   self-contained IIFE
```

Verification run: all 21 files pass `node --check`; the set of 148 function
declarations in the original script block is present in the split, with none
lost and none duplicated.

## Why classic scripts and not ES modules yet

The markup still carries **79 inline `onclick=` / `onchange=` handlers**.
Inline handlers resolve names against the global scope only. Converting to
`type="module"` now would put every function into module scope and break every
button in the tool on the first click. Step B replaces the handlers with
delegated listeners first, then flips to modules.

Load order matters in exactly one place: `mb_state.js` declares with
`let` / `const`, so those bindings are in the temporal dead zone until it has
run. Everything else reads them from inside functions that fire after load.

## Findings that need a decision

**1. The supplied file is truncated.**
It ends mid-comment at `// Wait for DO`, inside `autosave.js`. I reconstructed
the boot guard and IIFE close (marked `RECONSTRUCTED TAIL` in the file).
Diff it against your original before shipping.

**2. Autosave restore cannot work as written.**
`autosave.js` restores by assigning `window.modulesData = data.modules`, but
`mb_state.js` declares `let modulesData`. A `let` at the top level of a classic
script is a *lexical* global — it is not a property of `window`, and it shadows
any property of that name. So the assignment lands on `window.modulesData`
while every reader continues to resolve the untouched `modulesData`. This is a
pre-existing bug, identical in the monolith; the split only made it visible.
It disappears on its own once state moves into a single `mbState` object in
Step B, which is the strongest single argument for doing that step.

**3. `error-handler2.js`** — supplied and now included in the package. Note
that DACUM's own `error-handler.js` v2.0 is the *newer* of the two and its
header says it was modelled on this one; it adds STATE / NETWORK / WORKSHOP /
STORAGE categories, a `reportError(err, context)` entry point, `getLastError()`,
and persistence to `localStorage`. Module Builder's v1.0 has none of those.
Unify onto the DACUM version in Phase 2 — its strings have to pass through
`t()` anyway, so touching the file twice is wasted work.

**4. Scale of what Phase 2 inherits:**
- 42 native dialogs — 14 `alert`, 19 `confirm`, 9 `prompt`. None can be
  translated; `prompt` cannot even have its buttons relabelled. All 42 become
  one translated modal component.
- 116 hard-coded `rightToLeft: false` / `bidirectional: false` in
  `exports_docx.js`. This is the single largest obstacle to Arabic output.
- 341 `getElementById` calls used as a data source at export time
  (`sheets.js` 88, `storage.js` 73, `content.js` 60). Each one is a place
  where the DOM, not the state, is the source of truth.

## Step B — DONE

The 26 bare globals are now one `mbState` object. 561 references across 18
files were rewritten; object-literal keys and spread forms were corrected by
hand-checked pass; all files re-pass `node --check`. Finding 2 is fixed as a
side effect: `autosave.js` now writes to the same object every reader reads.

`mbState` is declared with `var`, so it lands on `window` and stays reachable
from the 79 inline handlers. It is the only global the application has.

## Deferred to Phase 3 (NOT blockers for Arabic)

1. Replace the 79 inline handlers with delegated listeners in `events.js`.
2. Flip to `type="module"`.
3. Make `storage.js` the only file touching `localStorage` (`modules.js` and
   `autosave.js` reach it directly, 8 call sites).

**Acceptance test for the whole of Phase 1:** three reference projects export a
DOCX byte-identical to v2.0-legacy. Prepare those three files before Step B —
after Step B there is no way to prove nothing moved.

## Phase 2 progress

**Schema v4 — bilingual content.** Every value the user types is a
`{ en, ar }` pair (`src/bilang.js`). Interface text is a separate problem with
a separate mechanism and the two never mix. Migration v3→v4 runs on load only,
guessing each field's side by inspecting it for Arabic codepoints — per field,
not per project, because mixed files are the norm. Idempotent, tested.

Not bilingual, by decision: sheet numbers, durations, versions, levels, ids,
image data, and **bibliography entries** — a citation is reproduced in the
script it was published in, and transliterating "Bloom, B.S. (1956)" makes the
source unfindable. The references *title* is bilingual; the entries are not.

**Collectors merge, they no longer rebuild.** `saveCurrentSheetToLO` used to
reconstruct each sheet from the DOM and replace the stored object. With one
language that was fine. With two it was destructive: the DOM holds only the
side on screen, so the first save after switching would have wiped the other
language silently. It now merges onto the stored pair.

**Export reads state only.** All 21 DOM reads in `exports_docx.js` are gone;
the one remaining `getElementById` fetches the status banner. The whole state
is projected to one language once, at the top of the export
(`biFlattenDeep`), so the 1,590-line generator keeps reading plain strings
unchanged — sixty read sites would have been sixty chances to miss one, and a
missed one prints `[object Object]` into a client's module.

**Four fields were promoted into state.** `coversAdditionalInfo`,
`coversAdditionalNotes`, `introAdditionalDetails` and `assessmentContent`
existed *only* in their textareas; save read them from the DOM and export read
them again, with nothing holding them in between. A textarea cannot hold two
sides of a pair, so they are state now.

**The content-language switch is wired** (`src/contentlang_ui.js`) — it became
safe only once the export stopped reading the DOM. It flushes, then switches,
then repaints, in that order; repainting first would make the user's last edit
appear to vanish. It changes editor field direction only, not page chrome:
flipping the whole layout on a switch made dozens of times a day would move
every button the user just learned. A completeness counter shows how much of
the *other* side is filled, so a half-translated module is visible before
export rather than after a client opens it.

**Interface dictionary — done for markup.** 148 keys extracted from
`index.html`, `data-i18n` injected on 184 elements, English and Arabic both
complete, French declared and empty on purpose so the selector, the RTL test
and the fallback chain are exercised by a third locale from day one.

DACUM's i18n engine was carried over rather than rewritten
(`src/mb-translations.js`): it already encodes four fixes worth keeping — the
comma-separated attribute list so one key can feed `title` and `aria-label`
together, the guard that refuses to overwrite an element wrapping child nodes
(which is how icon-plus-label buttons lose their icon), the `data-i18n-once`
check that stops a language switch overwriting text the user has edited, and
the stale-text audit. Storage key stays `dacum_lang`, shared with DACUM Live
Pro, so moving between the two tools does not mean setting the language twice.

Note that `index.html` was reformatted by the HTML parser during the tagging
pass — attribute order and indentation changed throughout. Content and all 79
inline handlers verified intact, but a line-by-line diff against the previous
copy will be noisy.

**Native dialogs are gone.** All 42 `alert`/`confirm`/`prompt` calls now go
through one translated modal (`src/dialog.js`). Native dialogs cannot be part
of a translated interface — their buttons follow the *browser's* locale, not
the page's, so an Arabic question appears under an English "OK / Cancel", and
`prompt` cannot be relabelled at all.

The cost is that a modal cannot block, so **34 functions became `async`** and
their callers had to be checked. Three were real bugs, not bookkeeping:

- `tabs.js` — `if (!checkLearningOutcomeSelected()) return;` A Promise is
  always truthy, so `!promise` is permanently false and the guard would have
  silently stopped guarding: the Info and Activity tabs would open with no
  outcome selected. Now awaited.
- `modules.js` — `addNewLearningOutcome(...)` was followed immediately by two
  renderers that read the list it creates. Now awaited.
- `outcomes.js` — `addNewModule()` in the manual-authoring reset, same shape.

The remaining unawaited calls are inside `onclick="..."` strings in templates,
where fire-and-forget is correct, and one deliberate case in `app.js` (noted
in the file).

Destructive confirmations pass `danger: true`: they get a red confirm button
and, more importantly, a backdrop click does **not** dismiss them. A stray
click should not delete a sheet.

**73 JavaScript strings now route through `t()` / `tf()`**, Arabic complete.
Interpolated values are positional (`{v0}`, `{v1}`) — the original template
literals had no names for them, and inventing semantic names across 73 sites
during a mechanical conversion would have been guessing.

**The RTL bug you spotted, and its cause.** `body { direction: ltr }` was
hard-coded at line 21 of the stylesheet. It overrode the `dir="rtl"` the i18n
engine sets on `<html>`, which is exactly why Arabic changed the words but not
the tabs or the headings. Removed, and a proper RTL layer written against
`html[dir="rtl"]` covering tabs (including the active tab's corner radii),
toolbar and header rows, headings, labels and interface tables.

Seven further `direction: ltr` locks sat on textareas and content inputs, plus
16 inline `dir="ltr"` attributes in the markup. Those are *content* fields, so
their direction is not the stylesheet's business at all — it belongs to
`contentLang`. They now carry `.mb-content-field` and are driven by
`applyContentDirection()`, which also re-runs after an interface-language
change because several renderers rebuild their rows in response and new rows
are born without a `dir`.

Terminology: صحيفة → **ورقة** throughout (ورقة المعلومات، ورقة النشاط).

### Round-two fixes (from live screenshots)

**The tabs were reversed because the RTL layer over-corrected.** `dir="rtl"`
already reverses the main axis of a flex row — the browser does it. Adding
`flex-direction: row-reverse` on top reverses it a *second* time and lands
back at left-to-right, which is why the first tab stayed on the left. Same
cause for the Module Management and Learning Outcome Management cards
(`.mgmt-header`, `.mgmt-row`). All `row-reverse` rules deleted: a flex row in
an RTL document needs no direction rule at all.

A second, older `body.mb-rtl` block was also still in the stylesheet
duplicating the layer and carrying its own `row-reverse`. Deleted rather than
patched — two stylesheets competing over the same elements is how this
survived one round of fixing already. `html[dir="rtl"]` is now the only hook.

CSS Grid does *not* flip the way flex does: `grid-template-columns` is
physical, so the team-member row needed `direction: rtl` stated explicitly.

**Keyboard navigation in Arabic fields.** `applyContentDirection` was setting
`text-align` but the `dir` attribute is what governs the caret, Home/End and
the arrow keys. A field with right-aligned Arabic and no `dir` looks correct
and behaves English. Now sets `dir` and uses `text-align: start` (logical, so
it follows whatever `dir` the element ends up with).

**Content fields defaulted to English regardless of interface.** `contentLang()`
fell back to `'en'` when nothing was stored. Someone who has just switched the
interface to Arabic is about to type Arabic; they now start on the Arabic side
until they touch the switch themselves, after which the two settings go
independent again — which is the point of having two.

**Rows created after boot.** A dozen renderers build rows with `innerHTML` on
demand, and those elements do not exist when the boot-time direction pass runs.
Wrapping each renderer by hand means the next one somebody writes is born
wrong, so a batched `MutationObserver` stamps them as they appear.

**Work-team fields and 21 other template strings** (`Name`, `Task`,
`Work Location`, `Add row`, `Enter content…`, `Describe this step…`, …) now
call `t()` at construction time — `data-i18n` cannot reach them, because
`applyTranslations()` runs before those rows exist. The renderers are also
re-run on `mb:langchange`, or their labels would freeze in whichever language
was active when the row was built.

The resource *quantity* field keeps `dir="ltr"` deliberately: digits run
left-to-right in Arabic too, and flipping a number field only moves the caret
to the wrong end.

Terminology: **الجدارة → الكفاءة** throughout.

### DOCX: the red underlines under Arabic

Those are Word spell-checking Arabic against an **English** dictionary. The
cause is that `docx@7.8.2` has no `language` option on a run — `RunProperties`
never emits `<w:lang>` — so every run inherits Word's UI language. Direction
and dictionary are separate concerns and both are required:
`bidirectional`/`rightToLeft` set the reading order, `w:lang` sets the
dictionary. Fixing only the first gives correctly-ordered Arabic that is still
underlined; fixing only the second gives clean Arabic running the wrong way.

`src/docx_bidi.js` ports DACUM's solution: `TextRun` and `Paragraph` are
subclassed so any run containing Arabic gets `<w:rtl/>` plus `<w:lang>` at
construction, and the export destructures from `mbDocxLib()` instead of
`window.docx` — so no call site changed and a run added later is covered
automatically. `<w:lang>` also goes into `docDefaults`, which covers anything
the wrappers did not build and text the user types into the file afterwards.

**One deliberate divergence from DACUM.** It tags Arabic runs `ar-IQ` on both
`w:val` and `w:bidi`. In OOXML `w:val` governs the *Latin* text inside the run
and `w:bidi` the complex-script text — and your Arabic modules are full of
Latin fragments: NQF, TVQF, ISO codes, equipment names. Tagging the whole run
`ar-IQ` makes Word check *those* against an Arabic dictionary and simply moves
the red underlines from the Arabic to the English. Here `w:val` stays `en-US`
and only `w:bidi` carries Arabic. Verified against a real generated file:

    <w:rPr><w:rtl/><w:lang w:val="en-US" w:bidi="ar-IQ"/></w:rPr>

Two more export fixes came out of the same pass:

- **74 `bidirectional: false` and 76 `rightToLeft: false`** were hard-coded
  ("Force LTR"). Correct while the tool was English-only; the single biggest
  reason an Arabic export is unusable. Both now follow `exportLang()`.
- **60 paragraphs specified `AlignmentType.LEFT`.** In an Arabic document LEFT
  is not "the start of the line", it is the far end — the same mistake as the
  CSS `text-align` that had to become `start`. Resolved through `_mbStart()`.
- The export named **no font at all**, so Word used its own default, which on
  a non-Arabic system may lack Arabic glyphs and falls back silently to boxes.
  Now Arial when exporting Arabic — not the prettiest face, but it ships
  everywhere with full coverage.

### DOCX round two — from your exported file

I unzipped the sample. Three separate problems, three separate causes:

**1. Tables ran left-to-right.** The file had 143 `<w:bidi/>` paragraphs and
144 `<w:rtl/>` runs — the text fix from last round worked — but **zero**
`bidiVisual`. Paragraph direction and *table* direction are different
properties in OOXML: `<w:bidiVisual/>` is what mirrors the COLUMN ORDER, so
without it a checklist puts its first column on the far left while every cell
inside it is correct Arabic. `Table` is now subclassed alongside `TextRun` and
`Paragraph` in `mbDocxLib()`.

**2. Forty-six English strings were baked into the generator** — table headers
(`Assessment Criteria`, `Evidence Verification`, `Completion Date or Notes`),
sheet headings (`Information Sheet 1-2 \ …`, `Self-check`, `Answers-Key`),
`Did you… / Yes / No`, `Competent / Not Yet Competent`, the signature lines,
and both criteria-boilerplate defaults. All keyed.

They resolve through **`_mbT()`, not `t()`** — a distinction that matters
here more than anywhere else in the codebase. `t()` follows the *interface*
language; the document must follow the *export* language. You working in an
English interface exporting an Arabic module would otherwise get English table
headers inside an Arabic deliverable. The engine gained `tIn(key, lang)` and
`tfIn(key, lang, vars)` for exactly this.

**3. Instructional mark headers were English** (`Attention`, `Note`,
`Question`). `MARK_TYPES.label` held display text; it is now an i18n key,
resolved at the point of use. That is the whole point: the editor menu needs
the interface language and the DOCX header needs the export language, and one
pre-resolved string can only ever satisfy one of them.

**New: an export-language switch.** Three switches now, and they are genuinely
three things — interface, editing side, exported document. The module is
bilingual internally but the DOCX is single-language by decision, so the author
has to say which side to emit; it defaults to the side being edited, which is
the one they can see and check.

Verified against generated files: `<w:bidiVisual/>` present on tables,
`<w:rtl/>` and `<w:lang w:val="en-US" w:bidi="ar-IQ"/>` on Arabic runs,
Arabic headers in the cells.

### Stable item identity — `src/uid.js`

This is the piece that was blocking Phase 3, and it is done.

Steps, resources, activity criteria and content sections were arrays whose
only identity was their **position**. The collectors merged the DOM back into
state by index. Harmless in a one-language tool; quietly corrupting in a
bilingual one — move step 3 above step 2 while editing Arabic and the English
halves stay put, so the pairs cross and nobody is told. It surfaces when a
client opens the English export and finds the steps scrambled.

Every item now carries an opaque `uid`, and `biMergeArrayById` /
`biMergeStringsById` merge by identity, returning items in the DOM's order —
so a reorder in one language moves the other language with it. Demonstrated:

    after typing AR: Wear PPE / ارتدِ الوقاية ; Check cables / افحص الأسلاك ; Start machine / شغّل الآلة
    after reorder  : Start machine / شغّل الآلة ; Wear PPE / ارتدِ الوقاية ; Check cables / افحص الأسلاك
    positional     : Wear PPE / شغّل الآلة ; Check cables / ارتدِ الوقاية ; Start machine / افحص الأسلاك

The third line is the old behaviour on the same input — every pair crossed.

Three decisions inside it:

- **Opaque strings, not integers.** A counter reintroduces the same bug the
  moment two projects merge or a module is imported from DACUM: two items
  legitimately hold id 3 and one silently overwrites the other.
- **`mbRestoreRowUid`.** The loaders rebuild rows by calling `addStep()` etc.,
  which mint *new* uids — from their point of view the row is new. The stored
  identity is written back over it, or the collector would see unrecognised
  ids on every load and treat the whole array as newly created, discarding the
  other language.
- **Items missing from the incoming set are dropped**, not preserved. A
  "keep anything not seen" rule would resurrect deleted steps on every save.

Reordering is now safe to offer; `mbReorderSafe(items)` reports whether a
given array is ready (a project loaded from an old file has no uids until it
has been through the load path once).

### DOCX: why the text was still LTR

The generator sets `bidirectional` explicitly on only **74 of its 104
paragraphs**. The other 30 — most of them inside table cells — said nothing
and inherited LTR. That is precisely the symptom you described: tables that
had flipped to RTL with cell text still running the wrong way. The table
carried `<w:bidiVisual/>`, its cell paragraphs had no `<w:bidi/>`.

The `Paragraph` subclass now defaults `bidirectional` to true when exporting
Arabic, so every paragraph is covered including any added later; an explicit
`bidirectional: false` still wins. Verified: 3 of 3 paragraphs carry
`<w:bidi/>` in a document where none of them asked for it.

### Architecture item 1 — inline handlers are gone

**81 in the markup, 43 more generated by the renderers, 124 total. Zero
remain.** The markup now says *what*, not *how*:

    <button data-act="addResource">
    <button data-act="switchTab" data-args='["covers"]'>
    <select data-act="switchModule" data-on="change">

`src/events.js` binds one delegated listener per event type on the document
and dispatches through a registry. Three things this buys that the old
attributes could not:

- **The module flip is now safe.** `onclick="fn()"` resolves names against the
  global scope and nowhere else, which is the single fact that has kept every
  file a classic script. That constraint is lifted.
- **Rows added later are covered for free.** Delegation reaches elements that
  did not exist at bind time; the inline approach could only manage it by
  rebuilding the attribute string on every render.
- **A Content-Security-Policy that forbids inline script becomes possible** —
  most hosting worth deploying to defaults to that.

Two cases did not fit the mechanical conversion, and both were worth stopping
for:

- **`this.value` in a generated handler.** `update(id, this.value)` cannot
  survive into a data attribute: the attribute is built once, when the row is
  rendered, so anything evaluated there **freezes at render time** — it would
  have written an empty string forever. A `"$value"` sentinel defers the read
  to dispatch, which is what `this.value` meant. Six sites.
- **The two cover drop zones** carried four handlers each on one element, and
  `dragover` must call `preventDefault()` or the browser navigates away to the
  dropped file. One `data-act` per element cannot express that, so they are
  `data-dropzone` and wired explicitly.

An unknown action name warns in the console rather than failing silently — a
typo that does nothing is how a dead button reaches production.

### Architecture item 2 — one persistence layer

`localStorage` was reached from four modules. Each site assumed storage is
synchronous, local, unlimited, always available and private. Three of those are
already false: Safari in private mode **throws on write**, the quota is ~5 MB,
and the quota is where this tool actually breaks — a module with a dozen base64
cover images passes it easily.

`src/persistence.js` owns the backend; nothing outside it names `localStorage`.

- **Availability is feature-detected by use, not by presence.** Safari private
  mode exposes the API and throws on the first write, so
  `typeof localStorage !== 'undefined'` is not an answer.
- **Document operations are Promise-based even though the backend is
  synchronous.** A network backend cannot be synchronous, and retrofitting
  async into callers later means auditing them all a second time. That audit
  was already done once for the dialog conversion; there is no reason to earn
  it again.
- **Settings stay synchronous** — they are read during render, and making them
  async means the first paint happens before the language is known, i.e. a
  visible flash of the wrong language on every load.
- **Autosave degrades quietly, deliberate saves do not.** Autosave fires every
  few seconds; a modal on each quota failure would make the tool unusable
  exactly when storage is full.
- `dacum_lang` stays **un-prefixed on purpose** — it is shared with DACUM Live
  Pro so moving between the tools doesn't mean setting the language twice.

One call site is flagged in the code as the first to convert when the backend
becomes remote: autosave's restore reads synchronously during boot.

### Where the module flip stands

Not done, and that is now a small, dull job rather than a risky one. What
remains is that modules reference each other by bare name; converting is a
mechanical import/export pass with no behavioural risk. It was worth stopping
here rather than combining it with the handler work, because if something
breaks you can tell which change caused it.

### Translation and RTL — closed out

Built an automated auditor: boots the whole app in a real DOM (jsdom), builds
every dynamic row, switches to Arabic, and lists what text, `placeholder` and
`title` attributes are still Latin. This turned "a lot of terms aren't
translated" from an impression into a closeable list, and it is now part of
the repo's checks going forward.

**Two real bugs the auditor found, neither cosmetic:**

1. **`stepImages` was undeclared at the moment it was needed**, and the
   failure was silent. It had been a top-level `const` inside `steps.js` — a
   lexical global sitting in the temporal dead zone until that file ran. The
   i18n engine boots from the *first* script on the page and fires
   `mb:langchange` immediately, long before `steps.js` has executed, so
   **every language switch threw `ReferenceError` and aborted the listener
   silently** — which is the actual reason cover labels and other repaints
   were not translating. Moved into `mbState.stepImages`; a boot guard
   (`mbMarkBooted`) now also stops any repaint from running before the
   feature modules exist, which is where this kind of ordering bug lives.

2. **`covers.js` and `workteam.js` never knew about Schema v4.** Their fields
   were declared bilingual back in `BILANG_FIELDS`, but the renderers and
   writers were never updated to match — so after migration they would have
   printed `[object Object]`, and worse: `row.value = input.value` **replaced
   the `{ en, ar }` pair with a bare string on the first edit**, silently
   destroying whichever language wasn't being typed. Fixed with `biGet`/`biPut`
   throughout both files. Found alongside it: `updateTeamMember` built the DOM
   id as `team-workLocation-…` while the actual id is `team-location-…` — the
   Work Location field had been a no-op since it was written.

**Cover labels are seeded, not translated** — a deliberate distinction. A
label is *data* the user renames; sweeping it with `applyTranslations` on
every language switch would silently overwrite a rename. Each row keeps a
`seedKey` until first edited: `mbSeedCoverLabels()` fills the label from the
dictionary in whichever language is being AUTHORED, only while the active
side is empty, and `seedKey` is deleted the moment the user renames the row —
after that it is theirs, in every language, forever.

**Default names for a new Module or Learning Outcome now come from
`tf('dgDefaultModuleName', …)`** rather than a hard-coded `Module 1`. One
honest limitation stated plainly: the *first* module and outcome are created
during boot, before any language switch is possible, so they carry whatever
language was active at boot. Renaming them is the user's action either way —
same as a rename in any word processor — so this was left as-is rather than
adding a second seeding mechanism for content the user is expected to name
anyway.

**Two structural fixes to the translation ENGINE**, needed because dynamically
built rows call `t()` once, at construction, and freeze:

- `data-i18n-title` / `data-i18n-placeholder`: a separate key per attribute.
  `data-i18n-attr` can only repaint several attributes from *one* key, which
  breaks the list-formatting buttons — visible text "Number" and a tooltip
  meaning "Convert to numbered list" are two different sentences.
- `data-i18n-num` for numbered headings ("Step 3:", "Content 2:"): the index
  rides in `data-i18n-num-v0` so a language switch can rebuild the phrase
  without re-rendering the row, which would discard whatever is typed in it.

**RTL: seven `text-align: left` rules converted to logical `start`**, and
margins to `margin-inline`. `padding-left/right` tied to `env(safe-area-inset)`
were deliberately left physical and commented as such — a device notch sits on
a physical edge and does not move with text direction. CSS Grid rows (cover
table, work-team) needed `direction: rtl` stated explicitly, same reasoning as
before: Grid's column order is physical and does not flip the way flex does.

**Result, verified by the auditor:** one leftover placeholder (`https://…`,
not text), two leftover titles (`English` / `Français` — language names that
correctly stay in their own language), and otherwise only the user's own name,
email, LinkedIn handle, and default project content (`Module 1`) — none of
which is interface text.

### Full regression, after all of the above

Booted the entire app under jsdom (no shortcuts, the real `index.html` with
all 29 scripts in their real load order): zero errors, zero warnings. Then
exercised the changed surface directly — state initialises, the delegated
dispatcher fires `addResource`/`addStep`/`switchTab` correctly, new rows carry
a `uid`, the interface language switch sets `dir="rtl"` on `<html>` and
repaints tab labels, and content fields receive a direction attribute. 11/11.

### The Performance Criteria table — the specific bug in your screenshot

Found by reading the exact section your image showed, not by re-running the
general sweep — and that turned out to matter: **all four bugs here were
invisible to every earlier translation sweep**, for the same reason. Every
prior pass matched the pattern `text: '...'` — a literal assigned to a
named property. These four were literals passed **positionally** to a local
helper function: `mkH('Did you...', 62)`, `mkD(c, AlignmentType.LEFT)`. A
string that never appears after `text:` doesn't exist as far as a
`text:`-anchored search is concerned, no matter how many times the sweep runs.

1. **The header row — `#`, `Did you...`, `Yes`, `No` — never called `_mbT` at
   all.** Not "resolved to the wrong language" — never translated,
   unconditionally, regardless of export language, past or future. This is
   the literal text your screenshot shows. Wired to the existing
   `expDidYou` / `expYes` / `expNo` keys, which were already in the
   dictionary from earlier work and simply never reached this table.

2. **The criteria text column was hard-coded `AlignmentType.LEFT`** — the
   second visible bug in your screenshot: Arabic text sitting flush left
   inside an otherwise-mirrored table. Changed to `_mbStart(AlignmentType)`.

3. **The Training Resources table headers had the same invisible-to-search
   problem** — `mkHdr('Material/ Equipment')`, `mkHdr('Quantity/ Number')` —
   plus a second, sharper bug riding on the same line: the column WIDTH was
   decided by testing `t.includes('Mat')` on the header text itself. That
   check depends on the string being the English word "Material" — it
   silently breaks the moment the header is translated, because the Arabic
   word doesn't contain "Mat". Width is now the caller's explicit decision
   (`mkHdr(text, wide)`), not a guess reverse-engineered from a label.

4. **The resource name cells were hard-coded `AlignmentType.LEFT`**, same
   shape as bug 2, in the two data columns of that same table.

**Did a final exhaustive sweep of the whole export file** for this exact
pattern — a capitalized string literal passed positionally into a local
helper — rather than trusting the earlier `text:`-anchored searches to have
caught everything. Nothing else matched.

Verified against generated XML, not just read: `<w:bidiVisual/>` present,
header cells resolve to `# | هل قمت بـ… | نعم | لا`, and the criteria text
cell's `<w:jc>` resolves to `right` where the unfixed code produced `left`.

Two screenshots you sent, for the record: the first was the exported table
with these four bugs visible; the second showed correctly-shaped Arabic script
for comparison — the disconnected-looking letterforms in the first image's
data rows are not a rendering defect, they're the test text itself (ر does
not join to the letter after it, so a string alternating و-ر naturally
renders as isolated pairs — that is correct Arabic behaviour for that
specific input, not corruption).

### The real root cause — three places that poisoned STATE, not the screen

The screenshot-driven fixes from the previous round (table headers, alignment)
were real and correct, but a second uploaded export still showed English
boilerplate for the criteria title/instruction/footer. Traced it end-to-end
with instrumented test runs rather than guessing, and found the actual
mechanism: **three places wrote the English default directly into the stored
activity-sheet object**, unconditionally, the first time it loaded or was
created — bypassing the placeholder-based fix entirely.

- `loadActivitySheetAtIndex`: an "auto-sync" line did
  `activity.criteriaTitle = \`Performance Criteria Check List/ ${num}\`` on the
  STORED object, not the DOM. This is precisely why it was invisible from the
  editor: the on-screen field correctly showed empty (a bare English string
  read for the Arabic side returns `''`), while the data underneath was
  already poisoned. The screen was right and the data was wrong — the worst
  combination, because it looks fixed.
- `ensureFirstActivitySheet` and `addNewActivitySheet`: both pre-filled the
  same three fields with English literals at creation time.

All three write sites removed. There is nothing to "sync" — the sheet number
is read directly wherever needed; a field that is genuinely unset is exactly
what the translated placeholder (edit time) and the `_mbT` fallback (export
time) are designed for, and they only work on a field that is actually empty.

**Verified with instrumented runs, not just re-reading the code:** before the
fix, an untouched criteria sheet saved as
`{"en":"Performance Criteria Check List/ 1-1","ar":""}`; after the fix, the
same sequence produces `{"en":"","ar":""}`.

### A second, unrelated regression this audit caught

`document.title`'s `<title>` element had a `<span data-i18n="...">` nested
inside it from an earlier "wrap bare text nodes" pass. `<title>` uses HTML's
*text content* parsing model — it cannot have element children at all, so
that span never became a real DOM node; `querySelectorAll('[data-i18n]')`
could never find it, and the browser tab would have shown literal, untranslated
markup in every language, English included. Reverted to plain text and the
title is now set programmatically inside `applyTranslations()`, since it is
the one piece of translated text that isn't reachable by attribute at all.

Also translated the sheet-navigation counter ("Sheet 1 of 1"), caught only
because the auditor was updated to actually create an activity sheet
(`ensureFirstActivitySheet()`) before checking — the first version of the
audit never rendered that part of the UI, so it never checked it either. A
reminder that an audit is only as good as the paths it actually exercises.

### Known limits

- Interface RTL still needs work beyond the tabs: many labels and inline
  layouts have physical `left`/`right` in the original stylesheet. Deferred at
  your request.
- Some English remains in renderer-built markup (e.g. the assessment-form
  heading). Deferred with the above.
- Table *header* cells built inside renderer templates (assessment forms,
  content tables) may still be English; the sweep covered `placeholder` and
  `title` attributes and the work-team labels. Switch to Arabic and run
  `window.i18n.audit()` to list what remains.
- The async conversion has been checked by reading, not by running. The
  Golden Master exports are the way to prove it.
- The RTL stylesheet is a first pass covering toolbar, sections and tables.
  DACUM's `dacum-rtl.css` is 1,015 lines; expect to port a good deal of it.

## Note on i18n

There is no `i18n.js` in DACUM Live Pro — that is why you could not find it.
The engine lives at the foot of `translations.js` as an IIFE that publishes
`window.i18n` (`t`, `tf`, `tp`, `setLang`, `getLang`, `apply`, `isRTL`,
`aiDirective`, `lockLang`, `audit`). Phase 2 copies that file's engine block
into Module Builder unchanged and swaps only the dictionaries.
