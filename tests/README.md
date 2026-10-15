# Module Builder — behaviour tests

These tests open the app in a real browser (Chromium, via Playwright) and
check what users depend on. They run on GitHub after every push
(**Actions → Tests**) and are not part of the app: nothing in this folder
is loaded or cached by it.

| File | What it guards |
|---|---|
| `specs/smoke.spec.js` | The app starts in EN / FR / AR with no script error; a DACUM Live Pro handoff becomes a module; every script and stylesheet is precached by `sw.js`. |
| `specs/suggested-content.spec.js` | Everything DACUM sends arrives (basic skills, decisions table, category, entry requirements); "Suggested content" in the Information, Activity and Assessment tabs: default destinations, approve / edit / move / also send / remove / outcome, building into sheets shown below (one per task, the empty sheet reused, outcome criteria first in the form), saved after a reload, Undo / Redo, "add to the open sheet", the Coverage view, Distribution settings, an older map, Arabic at 360 px. |

| `specs/glossary-sheet-types.spec.js` | 3.42.0: the Glossary of Terms built in the References tab (Term / Definition first table, saved after a reload, exported on its own page before the References, heading in EN / FR / AR, removed when its table is); the activity-sheet type chosen on the sheet and printed in the export; the names renamed in Settings → Misc; the "completed within the required time" checklist row (on with a duration, off by setting, absent without a duration); Arabic at 360 px. |
| `specs/lo-sequence.spec.js` | 3.43.0: the order and numbering inside a learning outcome: by default information sheets then activity sheets as before; interleaved with one number sequence (1-1 Introduction … 1-6 Reflection) in the model and in Word, sheet names from Settings → Misc; "Comes after" on an activity sheet; the number field computed and read-only; each outcome section printed on the overview, at the start or at the end; the Settings → Misc fields (Arabic). |
| `specs/source-ai.spec.js` | 3.45.0: 📚 Draft from sources — off by default and switched on in Settings → Misc; a pasted text or a PDF read page by page in the browser and kept on the device; only the chosen pages sent (AI mocked); 3.46.0: several sheets — built from DACUM (empty headings written, written ones kept) or by hand (an untitled sheet asks for its topic), pages suggested from the contents only, a run stopped by a busy service goes on from the sheet left; the kept sections, objective, self-check, page citations and reference written to the open information sheet; limits and errors; Arabic at 360 px. |
| `specs/sheet-names-ui.spec.js` | 3.44.0: a sheet name typed in Settings → Misc for the interface language shows on the tabs, the side navigation and the sheet's labels and buttons (the open activity sheet's title follows its own type); a name typed for another language changes nothing; kept after a reload. |
| `specs/languages.spec.js` | One language per text: DACUM's texts and labels written on the side of their own language, DACUM's translations filling the others; an untranslated item flagged ("EN") and left empty on the content-language side, never mixed; ✨ Translate (stand-in AI) fills what is missing, also on sheets already built, kept after a reload; labels translated in exports; an older handoff without a language field; an item edited in Arabic; switching the content language keeps rows not written in it yet. |

`fixtures/dacum-handoff-ar.json` is the same kind of handoff from a project translated into Arabic in DACUM (one step added afterwards, not translated); its Arabic texts were replaced by real Arabic for readability.

`fixtures/dacum-handoff.json` is a real handoff written by DACUM Live Pro
3.104 from its synthetic sample project (basic skills and decisions added
there), not workshop data.

## Running them on a computer (optional)

Needs Node.js 18+ and Python 3:

```
cd tests
npm ci
npx playwright install chromium
npx playwright test
```

## When a test fails on GitHub

Open **Actions → Tests → the failed run**. The log names the test and the
line; the `test-report` download has screenshots and a trace. A failing
test means a change broke something a user would notice — fix the change,
not the test, unless the behaviour was meant to change.
