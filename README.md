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
reordered flow — **Photo comes first**, then a big-preview **Adjust**
screen for palette/color-count/contrast/dithering (all live against the
real photo), then a separate **Board Setup** screen for pattern name, bead
type, and board size — splitting the two apart keeps color tuning from
being buried under a long scrolling form of unrelated structural fields.
The Adjust preview runs edge-to-edge with no border/frame around it, and
its controls collapse into an accordion (Palette open by default, Contrast
collapsed) so the live image dominates the screen. Screens: Library →
Photo → Adjust → Board Setup → Final Preview → Export,
with Manual Edit, a two-step Swap flow, and a step-by-step History timeline
reachable from the editor. iPad gets a persistent side panel (cream stage,
yellow tool panel) instead of a bottom sheet. Multi-board seam lines and
per-board PDF pages carry over from before. Fully offline via a precaching
service worker.

**Multiple bead collections** are supported — a "My Collections" screen
(create/rename/duplicate/delete) lets you keep separate named collections
per physical bead set; each pattern remembers which one it's locked to.

**Cropping is two separate tools**, matching two separate decisions:
right after picking a photo, **PhotoCropSheet** is a plain trim tool — drag
any edge or corner (one boundary at a time, or two at once from a corner)
over the static, fully-visible photo, plus rotate; no board-shape awareness
at all, it just bakes the chosen region into a new source image. Later, on
Board Setup, **PegboardCropSheet** ("PEGBOARD CROP") is the pinch/pan/zoom
tool that fits that trimmed photo into the *board's* aspect ratio; it's
reachable any time and reopening it starts from wherever you last left it.
Zooming out past the image's own edges is allowed there — anything the crop
window shows beyond the photo's actual bounds is padded white in the
matched pattern. Since fitting to the board is now manual rather than a
forced first-visit popup, Board Setup silently computes a centered,
non-distorting default crop (`computeCoverCrop` in `lib/crop.ts`) whenever
the board's aspect ratio changes and no real crop exists yet, so a pattern
never renders stretched just because the pegboard tool was never opened.

Documented scope cuts: no dedicated vertical-flip control on the framing
tool (rotate three times, or flip the finished grid in Manual Edit instead),
"Catalog +" in the editor adds a color to that pattern's working palette
rather than to a saved collection, and the custom-color picker is a single
hue rail at fixed saturation/brightness (matching the actual Pegboard mock).

## Stack

Vite + React + TypeScript, plain CSS custom properties for the design tokens,
`idb` for IndexedDB, `jsPDF` for PDF export, `vite-plugin-pwa` for the offline
service worker. No router, no UI framework — see `src/lib/`, `src/db/`,
`src/state/`, `src/hooks/`, and `src/components/` for the layout.

## Development

```bash
npm install
npm run dev      # start the dev server
npm run test     # run the unit tests (color engine, grid transforms, HSB)
npm run build    # type-check + production build
```

## Deploying (GitHub Pages)

Configured to deploy to `https://<your-username>.github.io/perlify/` via
GitHub Actions (`.github/workflows/deploy-pages.yml`) on every push to
`master`. One-time setup: repo Settings → Pages → Source → **GitHub Actions**.
A real HTTPS origin is what lets the service worker (and therefore true
offline use) activate — a local `http://` address doesn't count as a secure
context.
