# Perlify

A personal, single-user PWA that turns a photo into a Perler/Hama bead pattern
sized to your own pegboard, matched to your own bead collection, hand-editable,
and exportable as a printable PDF with a bead legend.

No accounts, no backend, no sharing — everything runs on-device and is stored
locally (IndexedDB). Installed via Safari's "Add to Home Screen" — see the
deploy section below for getting a real HTTPS URL to install from.

Design source of truth: `perlify-design-handoff/` (the Claude Design handoff —
screen specs, tokens, and product brief). The visual direction is **Pegboard**
(yellow/cream/ink/red, Archivo type, thick borders + offset hard shadows) —
the handoff's README explicitly names this as the one to build and flags the
alternate warm-paper/dark-editor screens in the same reference file as
**"kept for reference only — ignore for implementation."** This is a
from-scratch implementation of that spec, not a copy of the reference HTML.

## Status

**Pegboard rebuild** (current): the full Pegboard visual system, plus a
reordered flow — **Photo comes first**, then one combined **Adjust** screen
holds board size, bead type, and palette mode alongside contrast, all live
against the real photo (no more choosing a color count blind before ever
seeing a match). Screens: Library → Photo → Adjust → Final Preview → Export,
with Manual Edit, a two-step Swap flow, and a step-by-step History timeline
reachable from the editor. iPad gets a persistent side panel (cream stage,
yellow tool panel) instead of a bottom sheet. Multi-board seam lines and
per-board PDF pages carry over from before. Fully offline via a precaching
service worker.

**Multiple bead collections** are supported — a "My Collections" screen
(create/rename/duplicate/delete) lets you keep separate named collections
per physical bead set; each pattern remembers which one it's locked to.

Documented scope cuts: no dedicated vertical-flip control (compose Flip +
Rotate instead), "Catalog +" in the editor adds a color to that pattern's
working palette rather than to a saved collection, and the custom-color
picker is a single hue rail at fixed saturation/brightness (matching the
actual Pegboard mock).

## Stack

Vite + React + TypeScript, plain CSS custom properties for the design tokens,
`idb` for IndexedDB, `jsPDF` for PDF export, `vite-plugin-pwa` for the offline
service worker. No router, no UI framework — see `src/lib/`, `src/db/`,
`src/state/`, `src/hooks/`, and `src/components/` for the layout.

## Development

```bash
npm install
npm run dev      # start the dev server
npm run test     # run the unit tests (color engine, grid transforms, crop math)
npm run build    # type-check + production build
```

## Deploying (GitHub Pages)

Configured to deploy to `https://<your-username>.github.io/perlify/` via
GitHub Actions (`.github/workflows/deploy-pages.yml`) on every push to
`master`. One-time setup: repo Settings → Pages → Source → **GitHub Actions**.
A real HTTPS origin is what lets the service worker (and therefore true
offline use) activate — a local `http://` address doesn't count as a secure
context.
