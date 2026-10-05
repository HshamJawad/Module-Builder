# vendor/ — third-party libraries (self-hosted)

Copied unmodified from the official npm registry packages (3.13.0). Each
npm tarball's sha512 was checked against the registry's published
`dist.integrity` before extraction. All four are MIT licensed; each
folder keeps the package's LICENSE file (docx also ships its bundled
third-party notices in `index.js.LICENSE.txt`).

Served from this site rather than a CDN so that the tool works offline
once the service worker (`sw.js`) has cached it, and so that an export
never depends on a third-party server being reachable.

| File | npm package → path | Size | SHA-256 |
|---|---|---|---|
| `vendor/fflate-0.8.3/fflate.umd.js` | fflate@0.8.3 → umd/index.js | 36 KB | `462ef8041fc970e3615a20a9dd2b2e3047a073b2da729ef4f02b634bba8b7b83` |
|  | new — reads and writes `.mbz` module packages (ZIP) | | |
| `vendor/docx-7.8.2/index.js` | docx@7.8.2 → build/index.js | 324 KB | `db49ebb70f85fff8c738deb0e3f2bd5dee5d5f8f37884c0b39158205e0729fd6` |
|  | replaces `https://cdn.jsdelivr.net/npm/docx@7.8.2/build/index.js` | | |
| `vendor/jspdf-2.5.1/jspdf.umd.min.js` | jspdf@2.5.1 → dist/jspdf.umd.min.js | 356 KB | `98ccf17aa10c20bb1301762618fcc9b6ab3a4e7f26b6071d64d0b41154df3875` |
|  | replaces `https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js` | | |
| `vendor/pptxgenjs-3.12.0/pptxgen.bundle.js` | pptxgenjs@3.12.0 → dist/pptxgen.bundle.js | 468 KB | `cd078ca9e91c6f9e061ee0a3c310d6ff157c3a71b1dea7f40fd53818017266ff` |
|  | replaces `https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js` (still loaded on demand) | | |

docx and jsPDF are byte-identical to the copies in DACUM Live Pro's own
`vendor/` folder (same checksums).

To upgrade a library: `npm pack <name>@<version>`, check the tarball
against `npm view <name>@<version> dist.integrity`, copy the same file
into a new versioned folder, update the `<script src>` in index.html (or
`PX_LIB` in src/exports_pptx.js) and the PRECACHE list in sw.js, and
bump CACHE_VERSION.

Note: jspdf.umd.min.js and pptxgen.bundle.js end with a
`sourceMappingURL` comment; the map files are not included. Browsers
only request them when DevTools is open, so it has no effect on users.
