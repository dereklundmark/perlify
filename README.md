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
reordered flow — **Photo comes first**, then **Board Setup** (pattern
name, bead type, board size) locks in the physical board's real shape,
then a big-preview **Adjust** screen for palette/color-count/contrast/
dithering (all live against the real photo, already matched to the real
board). Board size first means a later size change never has to happen
after color tuning is already dialed in. Both screens keep their own live
preview (not just Adjust) — canvas.grid-block sits in an unpadded stage
region on each, spanning the full screen width — so changing anything on
either one shows the result immediately, no bouncing between screens just
to see what changed. Adjust's controls collapse into an accordion (Palette
open by default — its option rows are deliberately compact since you tend
to tap between Auto/Hama/Perler/My Collection repeatedly to compare —
Adjustments and Detail collapsed) so the live image dominates the screen.
There's no fixed default board size either: a fresh photo gets a starting
board shape matching its own aspect ratio (`computeDefaultBoardSize` in
`lib/board.ts`), so the live preview never opens visibly squished into a
square before you've adjusted it on Board Setup. Screens: Library →
Photo → Board Setup → Adjust → Final Preview → Export,
with Manual Edit, a two-step Swap flow, and a step-by-step History timeline
reachable from the editor. iPad gets a persistent side panel (cream stage,
yellow tool panel) instead of a bottom sheet. Multi-board seam lines and
per-board PDF pages carry over from before. Fully offline via a precaching
service worker.

**Multiple bead collections** are supported — a "My Collections" screen
(create/rename/duplicate/delete) lets you keep separate named collections
per physical bead set; each pattern remembers which one it's locked to.
Two more palette options sit alongside Auto Palette and My Collection for
trying variations fast: **Hama** and **Perler** presets, seeded as regular
(editable, deletable) collections the first time the app runs. They're the
catalog's even/odd-index halves respectively — a simple, deterministic
split, not verified real-world brand inventories (the catalog itself is
still placeholder data; see `lib/catalog.ts`).

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

**Board Setup keeps a live preview too** (not just Adjust) — changing board
size there re-matches the grid, so without a visible result you'd have to
bounce back to Adjust every time just to see what changed.

**A "DETAIL" section on Adjust controls how smooth the pixelation itself
is** (`src/lib/imageProcess.ts`, wired into `matchImageToGrid` in
`lib/match.ts`): **Sampling Mode** — Box Average (the default; manually
averages every source pixel inside each cell, at up to native resolution,
rather than relying on the browser's own resize quality for one huge
single-step downscale) vs Nearest Neighbor (samples one pixel per cell —
better for already flat-colored source art like cartoons/sprites, where
averaging would blur crisp edges); **Denoise** (box blur before matching —
directly flattens photo/JPEG noise that would otherwise get amplified into
speckled bead choices); **Abstraction** (a cheap edge-aware/bilateral-style
smoothing pass — merges flat regions and gentle gradients while leaving
real edges alone); **Sharpen** (unsharp mask, applied right before
matching — keeps small boards legible). All three sliders are 0-10.

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
