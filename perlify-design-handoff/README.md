# Handoff: Perlify

A personal, private tool that converts a photo into a perler/Hama bead pattern ("blueprint") sized to the user's own pegboard, matched to their own bead collection, hand-editable, and exportable as a printable PDF with a bead legend. No accounts, no backend, no sharing. Original product spec: `perler-app-readme.md` (included).

**Name:** Perlify — the app's own verb, used as the primary action on the photo screen. Note that *Perler* and *Hama* are registered trademarks; this name is fine for a private personal tool but should be changed before any public release.

**Visual direction:** *Pegboard* — the chosen one of three explored. Fourteen screens are designed in it: the full creation wizard on iPhone, the iPad split-panel editor, three edge cases (first run, board calibration, multi-board layout), and the two-step color swap with its history timeline.

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes showing intended look and behavior, **not production code to copy**. `Perler Studio.dc.html` is a design-tool document: it renders every screen side by side on one canvas and generates its bead grids at runtime with `<canvas>`, so the artwork, palettes and legend counts are real rather than drawn.

**Build the screens under turn badges `4a` ("Pegboard — complete set, 12 screens") and `5a`–`5c` (swap + history).** The canvas also contains an earlier direction (badges `1a`–`3c`, warm paper + dark editor) and a discarded one (`4b` "Darkroom"). Both are kept for reference only — **ignore them for implementation.** Where this README and those older screens disagree, this README wins.

The task is to **recreate the 4a screens in the target codebase** using its established patterns. Per the product spec that means a React PWA (Vite or Next static export), IndexedDB for storage, service worker + web app manifest for installability. Do not ship the DC file, `support.js`, or `ios-frame.jsx` — the last only draws an iPhone bezel so screens can be reviewed on a desktop canvas. In the real app each screen is full-viewport.

## Fidelity
**High-fidelity.** Colors, type, spacing, radii, borders and copy are final and specified below. Recreate pixel-faithfully at iPhone width (design width 402 px, safe-area top 56 px, bottom 44 px). Every screen except Board Setup and My Collection fits without scrolling and should stay that way.

---

## Design Tokens — Pegboard

### Color
| Token | Value | Use |
|---|---|---|
| yellow | `#ffd23f` | "Shelf" surface — first run, library, export, iPad tool panel |
| cream | `#fff8e7` | Working-screen background — setup, photo, adjust, edit, preview, collection, two boards |
| white | `#ffffff` | Cards, sheets, fields, inactive pills |
| ink | `#12100c` | All borders, primary text, filled buttons, active pills |
| body | `#3d3830` | Paragraph text on cream/yellow |
| muted | `#6b6659` | Meta lines, eyebrows, inactive nav, captions (5.2:1 on white — do not lighten) |
| disabled | `#c9c2ae` | Disabled glyphs and borders (redo, unmet Next) |
| track | `#f0ebdd` | Slider tracks, hairline dividers inside cards |
| red | `#e8533f` | **One** forward action per screen (Perlify, Next, Export, Done, Save, Calibrate) and the edit cursor |

No other hues. Every remaining color on screen is a bead. Yellow and cream never appear on the same screen as equals — yellow is the shelf, cream is the workbench.

### Typography — no monospace anywhere
- **Archivo** 400/500/600/700 — all UI text.
- **Archivo Black** (400 only) — headlines and any number the user reads as a value (color count, board dimensions, bead counts in the legend).
- Scale: eyebrow `700 11–11.5px, letter-spacing .1em`, muted; meta `600 11–12px`, muted; body `500 12.5–15px, line-height 1.45–1.5`, body color; row label `700 13.5–15px`, ink; screen headline `Archivo Black 30px/1, letter-spacing -.02em` (46px/.92, -.03em on yellow shelf screens); numeric value `Archivo Black 17–24px`.
- Headlines are set in caps and break across two lines ("SET UP / THE BOARD", "MY / PATTERNS", "SHOPPING / LIST"). Body copy is sentence case.
- Long paragraphs use `text-wrap: pretty`.

### Borders, shadows, geometry
- **Every element is `box-sizing: border-box`.** The 2.5 px border is load-bearing in this direction — on `content-box` a bordered pill renders 5 px taller than the filled pill beside it and 7-column swatch grids overflow their container by ~32 px. Set a `*{box-sizing:border-box}` reset globally.
- **Borders carry the design.** `2.5px solid #12100c` on cards, sheets, pills, fields, toggles, swatches. `2px` on small/nested items (legend rows, preset chips, secondary swatches). `1.5px` on thumbnails inside cards. Dashed `2.5px` for the "new" tile and the all-photos tile.
- **Offset shadows, never blurred:** `4px 4px 0 #12100c` (cards), `5px 5px 0 #12100c` (grid frames, sheets), `6px 6px 0` (final preview frame), `8px 8px 0` (iPad canvas frame), `3px 3px 0` (small count badge), `2px 2px 0` (slider thumbs), `5px 5px 0 rgba(18,16,12,.25)` (primary button, on yellow).
- Radii: 30 (primary pill h 60), 28 (h 56), 22–23 (segmented h 44–46), 20–21 (h 40–42), 18–19 (tool pills h 36–38), 16 (chips h 32), 14 (cards), 12 (list rows, small cards), 10 (numeric fields), 8 (swatches, preset chips), 6–7 (thumbnails).
- Sheets: `border-top: 2.5px solid #12100c`, `border-radius: 24px 24px 0 0` (26 on the calibrate modal), padding `16–18px 20px 44px`.
- Spacing: gutter 20 px; card padding 14 px; section gap 15–16 px; control-stack gap 17 px.
- **Toggle:** 60 × 32, `2.5px` ink border, knob 24 px inset 2 px. **On** = yellow track, ink knob, knob right. **Off** = white track, `#d8d3c4` knob, knob left.
- **Slider:** track h 14, `#f0ebdd`, 2 px ink border; fill yellow (or red for image adjustments) with a 2 px ink right edge; thumb 28 px white, 2.5 px ink border, `2px 2px 0` shadow.
- **Progress:** five separate segments, h 9, radius 5, 2 px ink border, filled ink for completed steps and white for pending — not a continuous bar.
- Minimum touch target 44 px; bead cells at working zoom render ≥ 26 px.

---

## Screens
Badges below are the labels under each phone on the canvas, in flow order.

### 1. First run
Yellow. Headline "NOTHING / YET". Centered 214 px empty-pegboard image (29 × 29 open circles, `rgba(25,23,19,.17)` stroke on `#efece4`, 2.5 px ink border, radius 12, `5px 5px 0` shadow). Pitch paragraph: "Turn any photo into a bead blueprint sized to your own pegboard. Everything happens on this phone — no account, no upload." Three numbered white cards (28 px ink circle, yellow numeral): set your board size and bead type / pick a photo and perlify it / print it and start beading. Bottom: primary pill "START NEW PATTERN", then centered "RESTORE FROM BACKUP".

### 2. Library
Yellow. Headline "MY / PATTERNS" with a 52 px white circle badge showing the count (`3px 3px 0` shadow). 2-column grid, 15 px gap, of white cards (2.5 px border, `4px 4px 0`, padding 10): thumbnail (radius 6, 1.5 px border), name `700 15px`, meta `600 11px` muted ("29×29 · 12 COLORS"). Last tile is a dashed square with a 40 px ink circle "+" and the label "NEW". Bottom: primary pill "START NEW PATTERN". No tab bar — single-user tool. Long-press a card for duplicate / rename / delete.

### 3. Board setup — step 1 of 5
Cream. Top bar CANCEL / STEP 1 OF 5 / NEXT (NEXT is `#c9c2ae` until valid); five-segment progress. Headline "SET UP / THE BOARD". Then cards:
- **Pattern name** — value on a 2.5 px ink bottom rule.
- **Bead size** — two h 44 pills, REGULAR filled ink / MINI outlined; below, "5.0 mm pitch" muted and red "CALIBRATE" → screen 4.
- **Board size** — eyebrow with live conversion ("5.7 × 5.7 in") right-aligned; WIDTH and HEIGHT fields (`Archivo Black 24px`) either side of a "×", then a **yellow** unit chip 72 × 58 reading "PEGS". Below a `#f0ebdd` rule: "BOARDS" with −/`1×1`/+ (the + is a filled ink circle).
- **Color source** — two radio cards, exactly one selected. *Auto palette* (selected: shadowed card, ink dot with white inner ring): label + count in `Archivo Black 24px`, slider, six preset chips (8 / 12 / 16 / 24 / 32 / 60), caption "Fewer colors read graphic and cost less; more hold gradients. Any number 2–60." *My collection* (unselected: flat card, hollow dot): label, red "24 ›" link, wrapping row of 20 px swatches. Selecting it locks matching to owned beads and collapses the auto card's controls.
- **Dithering** — label, caption "Smoother, noisier", toggle (default off).

### 4. Calibrate my board — modal
Setup dimmed behind `rgba(18,16,12,.5)`. Cream sheet, 46 × 5 ink grab bar. Headline "CALIBRATE / MY BOARD" + "Pegboards vary by brand. Measure once and every size you enter in inches or cm converts correctly." White card: eyebrow "MEASURE ACROSS 10 SPACINGS", a justified row of 11 open 16 px circles (ends ink, inner nine `#c9c2ae`), and a measurement rule — 2.5 px ink end ticks, 2.5 px line, centered "50.0 MM" in Archivo Black. MEASURED field + **yellow** "MM" unit chip. Two result rows: "YOUR PITCH / 5.00 mm" (ink border) and "STANDARD MIDI / 0.0% OFF" (muted border). Actions: ink pill "USE MINE" + outlined "STANDARD".
**Rule:** pitch = measured ÷ 10; pegs/in = 25.4 ÷ pitch; pegs/cm = 10 ÷ pitch. Warn, don't block, beyond ±15 % of standard.

### 5. Photo + crop — step 2 of 5
Cream. Bar BACK / STEP 2 OF 5 / red PERLIFY; progress at 2. A 378 px stage bordered 2.5 px top and bottom, ink background, holding the photo under a **cream scrim** `rgba(255,248,231,.66)` — this direction never goes dark. The 340 px crop window shows the photo unscrimmed with rule-of-thirds lines at `rgba(18,16,12,.3)`, a 3 px ink frame, and four 26 px / 6 px **yellow** corner brackets outside it. Below: two h 44 pills CAMERA ROLL (ink) / TAKE PHOTO (outlined); a 4-up recents strip (selected tile gets a 3 px red border, others 2 px ink, last tile dashed "ALL PHOTOS"); caption "Crop is locked to your board shape. Nothing leaves the phone."
Crop aspect is locked to the board's peg aspect from step 1.

### 6. Result + adjust — step 3 of 5
Cream. Bar BACK / "FERRY SUNSET" (Archivo Black 17) / red NEXT. The grid sits in a white frame (12 px padding, 2.5 px border, radius 16, `5px 5px 0`) at 261 px, followed by two chips: ink "829 BEADS" and outlined "12 COLORS". White sheet: three h 40 pills ADJUST (ink) / COLORS / EDIT; "HOW MANY COLORS" with the value in Archivo Black 22 and a **yellow-fill** slider; "CONTRAST" with a **red-fill** slider; "GRIDLINES" toggle. In collection mode the colors slider is replaced by a locked info row.
Every control re-runs matching live and updates the grid and both chips.

### 7. Manual edit
Cream. Bar: undo (white, ink border) / redo (`#c9c2ae` border and glyph when unavailable) / "320% · 14,17" / red DONE. Bar left group: undo, redo, and a **yellow step-count chip** that opens History (screen 14). Tool row: PAINT (ink pill, 13 px swatch of the active color ringed in yellow), CLEAR, SWAP (opens screen 13), then two 38 px glyph buttons ⟳ (rotate) and ⇄ (flip) — the five must fit 362 px without scrolling. Grid in a white frame at 312 px with a 26 px **red** 3 px cursor box on the target cell. Sheet: "PALETTE · 12" + red "CATALOG +", a 7-column swatch grid (each 2.5 px ink border), then a rule and the selected bead's name with "N PLACED".
Tap applies the active tool; Clear writes `null`; Swap replaces all of one color; rotate/flip transform the grid; undo/redo ≥ 50 steps via the History sheet; pinch to zoom, drag to pan.

### 8. Final preview — step 4 of 5
Cream. Bar BACK / STEP 4 OF 5 / red EXPORT; progress at 4. Grid centered at 320 px in a white frame with `6px 6px 0`. Bottom: eyebrow "BACKGROUND BEHIND PATTERN" + two h 46 pills, WHITE (ink, white chip) / BLACK (outlined, ink chip); then two white cards with toggles — "SYMBOL OVERLAY / For B&W printing" and "GRIDLINES / Off = as beaded". Display-only; these never mutate a bead.

### 9. Export
Yellow. The grid sits above at 150 px in a white-bordered frame. White sheet: headline "SHOPPING / LIST" with "2 PAGES · A4" right-aligned. One cream row per color (2 px ink border, radius 10): 26 px swatch, name `700 14px`, count in Archivo Black 17. Primary pill "PRINT BLUEPRINT".
Reframing the legend as a shopping list is deliberate — it is the artifact you take to the craft store. The printed PDF still carries the full legend (swatch, name, symbol, count).
**PDF contents:** full grid at print scale, gridlines, symbol overlay if enabled, heavier rule every 10 pegs, seam lines where applicable, legend. Empty cells print as unfilled outlines and are excluded from counts.

### 10. My collection
Cream, scrolling. Bar COLLECTIONS / red SAVE. Headline "MY 24 / COLORS" + "USED BY 9 PATTERNS". Search field (2.5 px border, 15 px ring glyph, "3 HITS" right-aligned). Result rows: 30 px swatch, name, source line ("PERLER P07"), and a trailing 30 px control — filled ink circle with a yellow ✓ when owned, outlined "+" when not. Then eyebrow "OWNED · 24 OF 60" and a 6-column swatch grid. Then a "CUSTOM COLOR" card with a bordered spectrum rail and a 26 px thumb.
Catalog search first (it yields the real bead name for the printed legend), manual picker second for off-brand beads.

### 11. Two interlocked boards — 58 × 29
Cream. Bar BACK / "58 × 29 · 2 BOARDS" / red EXPORT. Two centered column headers BOARD 1 / BOARD 2 above the wide grid in a white frame; below, a 24 × 4 ink bar and "SEAM — SNAP HERE WHEN ASSEMBLING". Chips: pegs (ink), colors, "PDF: 4 PAGES". Four h 42 pills FIT (ink) / 100% / BOARD 1 / BOARD 2 — board jumps are the primary navigation at this size, with pinch-pan still available. Two toggle cards: SEAM LINES, SPLIT PDF PER BOARD. Caption "Beads are counted per board, so you can finish and iron one before starting the next."
The seam is a 3 px ink line at every board boundary, drawn above the beads and never printed as a bead.

### 12. iPad editor
1194 × 834 landscape, ink bezel. Header on cream (2.5 px bottom border): "LIBRARY", title + "29 × 29 · MIDI · AUTO 12 COLORS" (the trailing label reflects palette mode), and right-aligned ADJUST / PREVIEW outlined pills + ink EXPORT. Canvas region stays **cream** with the grid in a white frame at 466 px, `8px 8px 0` — the one place the yellow is withheld, so color judgement happens against a neutral field. A 18 px red cursor box marks the hovered cell with an ink readout pill beside (not under) the tip. Bottom-left chips "829 BEADS" and "PENCIL HOVER ON"; bottom-right 42 px round undo/redo.
Right panel: 340 px, **yellow**, 2.5 px ink left border — tool pills, "PALETTE · 12 OF 60" as a 7-column swatch grid **inside a white bordered card** (bead colors are never judged against yellow — the card gives them a neutral ground), "BEAD COUNTS" as white bordered rows (swatch, name, Archivo Black count), and three pinned toggles above a 2.5 px rule: GRIDLINES, SYMBOL OVERLAY, PENCIL HOVER.
Apple Pencil hover (`pointerType === 'pen'`) previews the cell before commit. There is no hover state on iPhone.

### 13. Swap a color — two steps
Reached from the SWAP tool on screen 7. Canvas badges `5a` / `5b`.

**Step 1 — find the color.** Cream. Bar CANCEL / "SWAP · 1 OF 2" / NEXT (disabled until a color is picked). The grid renders with the selected color at full strength and **every other bead mixed 88 % toward the paper**, so its distribution is visible as a shape. Caption under the frame: "Everything else fades so you can see exactly what moves." Sheet: eyebrow "TAP A COLOR TO FIND IT", the 7-column active-palette grid, and a selected-color row (30 px swatch, name, count in Archivo Black 17).

**Step 2 — choose the replacement.** Bar BACK / "SWAP · 2 OF 2" / UNDO. The grid shows the swap **applied live**, with each changed cell outlined `1.5px #e8533f` so it stays findable even when the replacement is a near hue. Sheet: a single decision strip — from swatch, name, red "→", to swatch, name, affected count. Then eyebrow "SWAP IN — FROM MY COLLECTION" and the collection swatch grid. Then CANCEL (outlined, 112 px) + "APPLY SWAP" (ink pill).

Tapping a different candidate re-renders the preview immediately; nothing is committed until APPLY. The swap is a single history step regardless of how many beads it touches.

### 14. History — step backwards
Canvas badge `5c`. A modal sheet over the editor (`rgba(18,16,12,.5)` scrim), reached by tapping the **step counter** — a yellow chip showing the step count, sitting beside undo/redo in the edit bar on screen 7.

A 145 px preview of the pattern **as it stands at the selected step** sits above the sheet. Sheet headline "HISTORY" with "6 STEPS" right-aligned, then one row per step, **oldest at top, newest at the bottom** (nearest the thumb):
- Colour-change steps show a swatch pair with an arrow; single-color steps show one swatch.
- Label `700 13px` ink, affected-bead count `600 11.5px` muted right-aligned.
- **Applied** steps: white, 2.5 px ink border.
- **Undone** steps: `#f7f3e6` fill, `#c9c2ae` border, `#9c9689` struck-through label.
- Between the two groups: a red 2.5 px rule labelled "YOU ARE HERE".

Actions: "REDO ALL 3" (outlined, count reflects the undone steps) + "KEEP THIS" (ink pill). Caption: "Tap any step to jump there. Nothing is discarded until you make a new change."

**Behavior:** tapping any row moves the pointer to that step and re-renders; rows after it become undone but stay in the list. Redo remains available until the user makes a *new* edit, which truncates the undone tail. Undoing "the last 3" is one tap, not three. Every operation is one step — swap, paint stroke, clear, border, rotate, flip — labelled by what it did and how many beads it touched. Recommend ≥ 50 steps retained; history is in-memory and not persisted with the pattern.

---

## Interactions & Behavior
- **Wizard:** Board setup → Photo → Result/Adjust → Final preview → Export, five-segment progress. Steps stay reachable from the editor; re-cropping and re-matching are expected, so preserve manual edits where possible and warn before a re-match discards them.
- **Live matching:** contrast / saturation / brightness / color count / dithering re-run matching and repaint immediately; all counts update with them. Debounce ~60–100 ms while dragging; matching runs on the downsampled grid (≤ ~3.4k cells), never the full photo.
- **Display-only toggles:** preview background, symbol overlay, gridlines, seam lines. These must never mutate grid data.
- **Every stateful control renders both states.** No hardcoded switch positions — this was a real bug caught in review of the prototype.
- **Empty cells:** `null` is a first-class grid value — renders as an open circle, prints as an unfilled outline, excluded from counts.
- **Edge states still to design:** photo smaller than the board's peg count, board over the supported maximum, denied photo permission, storage quota exceeded, JSON import version mismatch.
- **Responsive:** one codebase. iPhone = bottom sheets, targets ≥ 44 px. iPad = persistent right panel + Pencil hover. Grid renders to `<canvas>`, never one DOM node per bead.

## State Management
From the spec's data model (`perler-app-readme.md` §4):
- `BeadCollection { id, name, beads: [{ id, name, hex }] }`
- `Pattern { id, name, createdAt, sourceImageThumbnail, boardConfig: { beadType, widthPegs, heightPegs, pegsPerInchOverride? }, collectionId | null, gridData: (beadId | null)[][], preprocessSettings: { contrast, saturation, brightness } }`

Add from these mockups: `paletteMode: 'auto' | 'collection'`, `colorCount: 2–60` (auto only), `dither: boolean`, and display prefs `gridlines`, `symbolOverlay`, `previewBackground: 'white' | 'black'`, `seamLines`, `pencilHover`. Undo/redo is an in-memory list of labelled steps (`{ kind, label, affected, diff }`) with a pointer, not persisted — see screen 14. Storage: IndexedDB (`idb`); full JSON export/import of all collections and patterns as the backup path.

## Color Matching — implemented in the prototype, reuse this logic
1. Average each cell's source region to one RGB value.
2. Apply the user's preprocess adjustments (the prototype uses a fixed saturation ×1.45 / contrast ×1.1 boost as a stand-in).
3. Convert cell and palette colors to **CIE Lab** (sRGB → linear → XYZ D65 → Lab) and pick the nearest by squared ΔE. **Do not use RGB distance** — an earlier RGB version mismatched a sunset's orange glow to browns.
4. **Palette selection:** in *collection* mode the candidate set is exactly the owned beads — no color outside the collection may ever be assigned. In *auto* mode, quantize once against the full 60-color catalog, keep the N most-used, then re-quantize restricted to those N.
5. Floyd–Steinberg dithering as an optional toggle.

## Assets
- **No image assets.** Every bead grid, thumbnail, photo and empty pegboard in the prototype is generated at runtime on `<canvas>` (procedural sunset / moonrise / citrus scenes standing in for user photos).
- **Bead rendering:** flat color square per cell; `rgba(0,0,0,.14)` circle at r = 0.16 × cell as the bead hole when cell ≥ 9 px; gridlines `rgba(0,0,0,.13)` on light backgrounds with a heavier `.32` line every 10 cells; symbol glyph at `600 (0.56 × cell)px`, dark or light per bead luminance (threshold 0.55).
- **Bead catalog:** the prototype ships a 60-entry reference catalog (name + hex), symbols auto-assigned A–Z, 0–9, then lowercase. **Replace with the real published Perler/Hama names, codes and hexes** — the prototype's values are plausible, not authoritative. Symbols would read better assigned per pattern by usage rank than by catalog index.
- **Fonts:** Archivo (400/500/600/700) + Archivo Black, Google Fonts.

## Open decisions for the implementer
1. **ΔE formula** — prototype uses CIE76; spec lists CIEDE2000 as a nice-to-have.
2. **Auto palette may include beads the user doesn't own** (flagged in copy). A third mode — "auto, but only from my collection" — is a reasonable addition.
3. **Bead inventory quantities** — collections store which colors are owned, not how many. Adding counts would let export warn "needs 214 Butterscotch, you have ~150" and drive a real shopping list. The Export screen is already framed for this.
4. **Symbol assignment** — per pattern by usage vs. global by catalog index.
5. **Row-by-row beading mode** — a phone-friendly "current row" readout was scoped but not designed. Highest-value addition after v1.
6. **Board shapes** — v1 is rectangular only; circle/heart/hex masking is phase 2.

## Files
| File | What it is |
|---|---|
| `Perler Studio.dc.html` | The design document. **Build badges `4a` and `5a`–`5c`.** Open in a browser; needs `support.js` and `ios-frame.jsx` beside it. |
| `support.js` | Runtime for the design document. Not part of the app. |
| `ios-frame.jsx` | iPhone bezel used to present screens on a desktop canvas. Not part of the app. |
| `perler-app-readme.md` | The original product spec these designs implement. |
