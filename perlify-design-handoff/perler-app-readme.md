# Perler/Hama Bead Pattern Designer — Project Spec

A personal, private tool that converts a photo into a bead pattern ("blueprint"), matched to the user's own bead collection and board size, with manual touch-up and PDF export for printing.

This is a **single-user, personal tool**. No accounts, no sharing, no backend server required.

\---

## 1\. Architecture Decision

**Build this as a Progressive Web App (PWA), not a native iOS app.**

### Why

* **Privacy by design**: All image processing, palette storage, and pattern generation happen entirely client-side (in-browser). Nothing needs to be uploaded anywhere, which matches the "just for me, no sharing" requirement perfectly.
* **No Apple Developer account needed**: A native iOS app requires Xcode, a Mac, and a $99/year Apple Developer account to stay installed on your phone (free sideloading expires after 7 days). A PWA has none of that — build it, open it in Safari, tap **Share → Add to Home Screen**, and it behaves like an installed app (own icon, launches full-screen, works offline).
* **Fits the build pipeline**: Claude Design produces web UI (HTML/React), and Claude Code can iterate on a web app instantly without a device build/signing step.
* **Persistent local storage**: Bead collections, saved patterns, and settings are stored in the browser's IndexedDB, so they persist across sessions on your phone, entirely offline-capable via a service worker.

### Important correction

**Apple Pencil does not work on iPhone** — it's an iPad-only accessory, regardless of iPhone model. Manual pixel-editing will be **finger/touch only** on iPhone. If Apple Pencil precision is important to you, that's a real reason to consider using this on an iPad instead (same PWA works there too — just install it on the iPad as well). Recommend designing the tap targets generously (large enough for a fingertip) either way, and note that the same PWA scales to iPad + Pencil for free if you ever want the crisper input.

\---

## 2\. App Structure \& Creation Flow (decided)

### App entry point

* **Home screen**: gallery/grid of thumbnails of all saved patterns, plus a prominent **"Start New Pattern"** button. Tapping a thumbnail reopens that pattern in the editor; tapping "Start New" begins the flow below.

### New Pattern wizard (in order)

1. **Board setup**

   * Set board size: separate width and height, each in inches, centimeters, or pegs
   * Choose bead size: **Regular/Midi vs. Mini** (sets the pegs-per-unit conversion)
   * Choose color source: **auto palette (pick number of colors)** or **my saved collection**
   * Other setup properties decided here: pattern name/title, dithering on/off toggle, peg-pitch calibration override (optional, advanced)
2. **Upload photo** (camera roll or new photo)
3. **See "perlified" results** (initial auto-generated grid)
4. **Adjust \& refine**

   * Contrast / saturation / brightness sliders — re-run matching live
   * Change number of colors (if using auto palette) and re-match
   * Manual pixel editing: add/remove/change individual beads by tap (finger) or Apple Pencil (iPad only)
   * Quick color swap (replace all of color A with color B)
5. **Final preview**

   * Toggle background behind the pattern: **white or black**, to check contrast/readability of the design either way
6. **Export to PDF** (grid + color legend with bead counts), and/or save to the pattern library for later

This flow is the same on iPhone and iPad — see layout notes below for how it adapts per device.

## 3\. Core Features

### A. Image Input \& Preprocessing

* Upload photo from Camera Roll or take a new photo (`<input type="file" accept="image/\*" capture>`)
* Pre-processing adjustments before pixelation:

  * Contrast slider
  * Saturation slider
  * Brightness slider (useful add-on)
  * Optional crop/zoom to frame the subject before converting
* Live preview of adjustments applied to the source image

### B. Bead Type \& Board Setup

* **Bead size toggle: Regular (Midi) vs. Mini**

  * Regular/Midi beads: \~5.0mm pitch → \~5.08 pegs/inch → \~2.0 pegs/cm
  * Mini beads: \~2.6mm pitch → \~9.77 pegs/inch → \~3.85 pegs/cm
  * These are standard published spacings, but pegboards vary slightly by manufacturer — include a "calibrate" option where the user can measure their own board and override the pegs-per-inch/cm value if needed.
* **Board size input**: separate **Width** and **Height** fields (not a single combined size), so any rectangle — including a square, where width = height — is supported. For each field, the user picks the unit they're entering in:

  * **Inches**, **Centimeters**, or **Number of pegs** — whichever is easiest to measure with what they have on hand
  * Whichever unit is chosen, it's converted to a peg count under the hood using the bead-size pitch above
* Support entering multiple interlocked boards (common for larger designs)
* **Board shape — v1 is rectangular/square only.** Circle, heart, hexagon, and star boards are a good phase-2 addition (they need the grid masked to a non-rectangular outline), but are out of scope for the initial build to keep things simple.

### C. Palette / Bead Collection Management

* **Two modes:**

  1. **Auto palette**: user sets "number of colors to use" (e.g., 10), and the algorithm auto-selects the best N colors from a large reference palette (or from the full-color image via clustering)
  2. **My Collection**: user builds a custom list of owned bead colors

     * Add a color either by picking from a **built-in reference catalog of official Perler/Hama color names** (fast, accurate — just search "Cherry Red" and pick it), or via a manual color slider/picker (RGB or HSB) for off-brand or custom colors
     * Name each color (auto-filled from the catalog, editable)
     * Save as a reusable named collection (e.g., "My 10 Colors", "Full 48 Set") so it doesn't need re-entry each time
     * Collections persist locally (IndexedDB) and can be edited/duplicated
* When "My Collection" is active, the pixelation step matches **only** to those colors — never introduces a color the user doesn't own

### D. Color Matching Algorithm

* Convert both the image pixels and the palette colors into **CIE Lab color space** before matching (not naive RGB distance) — Lab distance corresponds much more closely to human-perceived color difference, so matches look right instead of just numerically close.
* For each grid cell (one cell = one bead):

  1. Downsample/average the source image region into one representative color
  2. Convert to Lab
  3. Find nearest palette color by Lab distance (Delta E, CIE76 is fine as a v1; CIEDE2000 is a nice-to-have upgrade later)
  4. Assign that bead color to the cell
* Optional: apply dithering (e.g., Floyd–Steinberg) as a toggle for smoother gradients at the cost of a "noisier" pattern — nice-to-have, not required for v1

### E. Grid Generation ("Perlify")

* Output: a grid of W×H cells (from board/peg settings), each holding either a matched bead color **or an explicitly empty/blank state** (no bead placed)
* Rendered as a canvas/SVG grid, one square = one peg/bead, with a thin grid line so individual cells are countable while beading
* Optional **symbol/number overlay**: each color can also be labeled with a small letter, number, or symbol inside the cell — useful when printing in black-and-white, or when two bead colors look too similar to tell apart at a glance

### F. Manual Editing (post-generation)

* Tap any cell to recolor it with the currently selected palette color (finger-friendly hit targets)
* **Clear tool**: tap a cell to set it to empty/blank (no bead), for intentionally leaving pegs unfilled
* Palette swatches shown as a persistent color picker strip during editing
* **Quick color swap**: pick "color A → color B" and replace every occurrence in the grid in one action (e.g., "swap all red beads to orange")
* **Rotate/flip**: rotate the whole design 90°/180°, or flip horizontally/vertically
* Undo/redo history for edits
* Zoom/pan on the grid for precise placement on large designs

### G. Final Preview

* Toggle the canvas background behind the pattern between **white and black**, so contrast/readability of the design can be checked both ways before printing or beading
* Toggle the **symbol/number overlay** on or off for this preview
* These are display-only toggles (they do not change bead colors or grid data)

### H. Export

* **PDF export** for printing, including:

  * The full bead grid, gridlines visible, at a scale that prints clearly (with the symbol overlay included, if turned on)
  * A color legend/key: swatch, bead name, symbol (if used), and **count of beads needed per color** — empty/blank cells are shown as unfilled outlines and excluded from the count
  * Optionally split large boards across multiple pages if they exceed one printable page
* Keep an in-app save/history of past patterns (name + thumbnail + settings) so old designs can be reopened and re-edited

\---

## 3a. Responsive Layout: iPhone vs. iPad

Single responsive codebase — not two separate apps. The wizard/flow above is identical on both devices; only the layout adapts:

* **iPad**: persistent side panel showing palette/tools alongside the main grid (more screen real estate to work with), and supports **Apple Pencil hover preview** — the cell under the pencil tip highlights before tapping, so placement is precise before committing.
* **iPhone**: palette/tools collapse into a bottom sheet/drawer to save space; finger-only input, so tap targets on the grid should be generously sized.
* **Grid rendering**: use `<canvas>` rather than one DOM/SVG element per bead — large boards (e.g., 58×58 pegs from two interlocked boards = 3,364 cells) need canvas-level rendering to keep pinch-zoom and pan smooth on both devices.
* **Board seam lines**: when a design spans multiple interlocked physical boards, render a visibly thicker line at each board boundary, so it's clear where one physical board ends and the next begins during assembly.

\---

## 4\. Suggested Data Model (local storage / IndexedDB)

```
BeadCollection {
  id, name,
  beads: \[ { id, name, hex } ]
}

Pattern {
  id, name, createdAt,
  sourceImageThumbnail,
  boardConfig: { beadType: "regular" | "mini", widthPegs, heightPegs, pegsPerInchOverride? },
  collectionId (or null if using auto-palette),
  gridData: \[ \[ beadId | null, ... ], ... ],  // W x H array; null = intentionally empty peg
  preprocessSettings: { contrast, saturation, brightness }
}
```

**Backup/export**: include a simple "Export all data" action that serializes every `BeadCollection` and `Pattern` to a single JSON file the user can save (e.g., to Files app or iCloud Drive), plus a matching "Import" to restore it. Since everything lives in browser storage, this is a cheap safety net against storage getting cleared or moving to a new device.

\---

## 5\. Suggested Tech Stack

* **Frontend**: React (works well with Claude Design output and Claude Code)
* **Image processing**: Canvas API / OffscreenCanvas for pixel sampling and color conversion
* **Color math**: small utility for RGB↔Lab conversion + Delta E (no heavy library needed)
* **Storage**: IndexedDB (via a light wrapper like `idb`) for collections and saved patterns
* **PDF export**: `jsPDF` (or browser print-to-PDF as a fallback) rendering the canvas grid + legend
* **Offline/installability**: a basic service worker + web app manifest so "Add to Home Screen" behaves like a real app icon

\---

## 6\. Non-Goals (explicitly out of scope, per user's requirements)

* No user accounts, login, or cloud sync
* No sharing/export to other users or social features
* No server-side processing of images — everything stays on-device

\---

## 7\. Handoff Notes

1. **Next step**: hand this spec to **Claude Design** for UI/UX and visual design. Key screens to design: Home (library grid + "Start New Pattern"), Board/Bead/Palette Setup, Photo Upload, Perlified Result + Adjust/Refine (with manual editing), Final Preview (white/black background toggle), Export.
2. Design for **both iPhone and iPad** from the same responsive layout — see section 3a for how the layout should adapt per device.
3. **Then**: hand the resulting design to **Claude Code** to implement as a React PWA, per the architecture and data model above.
4. Flag explicitly to Claude Code:

   * Use **Lab color space matching**, not naive RGB.
   * Implement the **Regular vs. Mini bead pitch toggle** with the pegs-per-inch/cm values above (with a manual calibration override).
   * **Board size uses separate Width and Height fields**, each with a unit selector (inches / centimeters / pegs) — a square is just the case where width = height, no special-casing needed.
   * Grid must render on **canvas**, not per-element DOM/SVG, for performance on large boards.
   * Support **Apple Pencil hover preview** on iPad (pointer events), finger-only (no hover) on iPhone.
   * **v1 boards are rectangular only** — don't build circle/heart/hex shape masking now; leave room to add it later.
   * Grid cells need a **null/empty state** (not just colors) for intentionally blank pegs — this affects the data model, rendering, editing tools, and PDF legend counts.
   * Include a **reference catalog of official Perler/Hama color names + hex values** to speed up building a "My Collection" (in addition to the manual color slider).
   * Support an optional **symbol/number overlay** per bead color, toggleable in preview and export.
   * Include **rotate/flip** as manual editing transforms.
   * Include a simple **JSON export/import** of all patterns and collections as a manual backup mechanism.

