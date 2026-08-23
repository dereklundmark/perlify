# Perlify

A personal, single-user PWA that turns a photo into a Perler/Hama bead pattern
sized to your own pegboard, matched to your own bead collection, hand-editable,
and exportable as a printable PDF with a bead legend.

No accounts, no backend, no sharing — everything runs on-device and is stored
locally (IndexedDB). Designed to be installed via Safari's "Add to Home Screen".

Design source of truth: `perlify-design-handoff/` (the original Claude Design
handoff — screen specs, tokens, and product brief). This is a from-scratch
implementation of that spec, not a copy of the reference HTML in that folder.

## Status

**Milestone 1** (current): the full core loop in auto-palette mode on iPhone —
Library → Board Setup → Photo/Crop → Adjust (live color matching) → Final
Preview → PDF/JSON export.

Not yet built (see the handoff README's screen list for what these are):
manual pixel editing, the "My Collection" catalog editor, the iPad panel,
multi-board layouts, and full offline service-worker caching.

## Stack

Vite + React + TypeScript, plain CSS custom properties for the design tokens,
`idb` for IndexedDB, `jsPDF` for PDF export. No router, no UI framework —
see `src/lib/`, `src/db/`, `src/state/`, and `src/components/` for the layout.

## Development

```bash
npm install
npm run dev      # start the dev server
npm run test     # run the color-matching engine's unit tests
npm run build    # type-check + production build
```
