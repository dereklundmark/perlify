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

**Milestone 2** (current): everything from M1 (Library → Setup → Photo/Crop →
Adjust → Final Preview → PDF/JSON export), plus:

- Manual pixel editing (paint/clear/swap/rotate/flip, 50-step undo/redo)
- "My Colors" catalog editor (search, custom HSB color, owned-list management)
- iPad breakpoint (≥900px) for the Adjust/Edit screens: persistent side panel
  instead of a bottom sheet, plus Apple Pencil/mouse hover preview
- Multi-board (interlocked) layouts: seam lines, per-board PDF pages/legends
- Full offline support via a precaching service worker (`vite-plugin-pwa`)

Known scope cuts from this round (see the M2 plan for the reasoning): no
dedicated vertical-flip control (compose Flip + Rotate instead), "Catalog +"
in the editor adds a color to that pattern's working palette rather than to
your permanent collection, the HSB picker fixes brightness at 90%, and only
one collection ("My Colors") is supported rather than multiple named ones.

## Stack

Vite + React + TypeScript, plain CSS custom properties for the design tokens,
`idb` for IndexedDB, `jsPDF` for PDF export, `vite-plugin-pwa` for the offline
service worker. No router, no UI framework — see `src/lib/`, `src/db/`,
`src/state/`, `src/hooks/`, and `src/components/` for the layout.

## Development

```bash
npm install
npm run dev      # start the dev server
npm run test     # run the color-matching engine's unit tests
npm run build    # type-check + production build
```
