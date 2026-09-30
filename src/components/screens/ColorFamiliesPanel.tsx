import { useMemo, useState } from 'react';
import type { Bead } from '../../db/schema';
import { beadById, customColorBead } from '../../lib/catalog';
import { colorFamily } from '../../lib/colorFamily';
import {
  adjustHex,
  contrastHexes,
  nearestBead,
  pickMerge,
  type ColorAdjust,
  type FamilyColor,
  type FamilyGroup,
} from '../../lib/familyEdit';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Slider } from '../ui/Slider';
import { ColorPicker } from '../ui/ColorPicker';
import './ColorFamiliesPanel.css';

type SliderSource = 'collection' | 'custom';
type AddSource = 'collection' | 'any';

/** What's being tuned: one color, or a whole family's contrast. */
type Editing = { kind: 'color'; family: string; colorId: string } | { kind: 'contrast'; family: string };

interface ColorFamiliesPanelProps {
  families: FamilyGroup[];
  /** The palette the design uses (its collection, or the catalog for Auto). */
  palettePool: Bead[];
  /** Everything: the catalog plus every collection. */
  anyPool: Bead[];
  paletteName: string;
  /** Shows a remap of the active layer on the board without committing it (null clears). */
  onPreview: (map: Map<string, string> | null) => void;
  /** Commits a remap as one undoable step. */
  onApply: (map: Map<string, string>, label: string) => void;
  /** Adds one color to a family from the given pool; returns a message if it couldn't. */
  onAdd: (family: FamilyGroup, pool: Bead[]) => Promise<string | null>;
}


export function ColorFamiliesPanel({
  families,
  palettePool,
  anyPool,
  paletteName,
  onPreview,
  onApply,
  onAdd,
}: ColorFamiliesPanelProps) {
  const [sliderSource, setSliderSource] = useState<SliderSource>('collection');
  const [addSource, setAddSource] = useState<AddSource>('collection');
  const [openFamily, setOpenFamily] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [adjust, setAdjust] = useState<ColorAdjust>({ brightness: 0, saturation: 0 });
  const [contrast, setContrast] = useState(0);
  // Tuning one color: nudge it with sliders, or pick any color from the hexagon.
  const [colorMode, setColorMode] = useState<'sliders' | 'picker'>('sliders');
  const [pickedHex, setPickedHex] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const editingGroup = editing ? families.find((f) => f.family === editing.family) : undefined;
  const editingColor =
    editing?.kind === 'color' ? editingGroup?.colors.find((c) => c.id === editing.colorId) : undefined;

  // Where each slider result lands: a real bead from the palette, or a custom tint.
  function resolve(base: Bead, hex: string, source: SliderSource): Bead {
    if (hex.toLowerCase() === base.hex.toLowerCase()) return base;
    if (source === 'custom') return customColorBead(hex, `${base.name} (custom)`);
    return nearestBead(hex, palettePool) ?? base;
  }

  function buildMap(
    next: { adjust?: ColorAdjust; contrast?: number; source?: SliderSource; mode?: 'sliders' | 'picker'; picked?: string | null } = {},
  ): Map<string, string> {
    const source = next.source ?? sliderSource;
    const mode = next.mode ?? colorMode;
    const picked = next.picked !== undefined ? next.picked : pickedHex;
    const map = new Map<string, string>();
    if (editing?.kind === 'color' && editingColor && mode === 'picker') {
      // The hexagon always makes a custom color — that's what it's for.
      if (picked && picked.toLowerCase() !== editingColor.hex.toLowerCase()) {
        map.set(editingColor.id, customColorBead(picked, `${editingColor.name} (custom)`).id);
      }
    } else if (editing?.kind === 'color' && editingColor) {
      const target = resolve(editingColor, adjustHex(editingColor.hex, next.adjust ?? adjust), source);
      if (target.id !== editingColor.id) map.set(editingColor.id, target.id);
    } else if (editing?.kind === 'contrast' && editingGroup) {
      const hexes = contrastHexes(
        editingGroup.colors.map((c) => c.hex),
        next.contrast ?? contrast,
      );
      editingGroup.colors.forEach((c, i) => {
        const target = resolve(c, hexes[i], source);
        if (target.id !== c.id) map.set(c.id, target.id);
      });
    }
    return map;
  }

  const previewMap = useMemo(() => (editing ? buildMap() : new Map<string, string>()), [editing, adjust, contrast, sliderSource, colorMode, pickedHex, families]); // eslint-disable-line react-hooks/exhaustive-deps

  function startEditing(next: Editing) {
    setEditing(next);
    setAdjust({ brightness: 0, saturation: 0 });
    setContrast(0);
    setColorMode('sliders');
    setPickedHex(null);
    setMessage(null);
    onPreview(null);
  }

  function stopEditing() {
    setEditing(null);
    onPreview(null);
  }

  function updateAdjust(patch: Partial<ColorAdjust>) {
    const next = { ...adjust, ...patch };
    setAdjust(next);
    onPreview(buildMap({ adjust: next }));
  }

  function changeColorMode(mode: 'sliders' | 'picker') {
    setColorMode(mode);
    onPreview(buildMap({ mode }));
  }

  function updatePicked(hex: string) {
    setPickedHex(hex);
    onPreview(buildMap({ picked: hex }));
  }

  function updateContrast(v: number) {
    setContrast(v);
    onPreview(buildMap({ contrast: v }));
  }

  function changeSliderSource(source: SliderSource) {
    setSliderSource(source);
    if (editing) onPreview(buildMap({ source }));
  }

  function apply() {
    if (!editing || previewMap.size === 0) return stopEditing();
    const label =
      editing.kind === 'color' && editingColor
        ? `Tuned ${editingColor.name}`
        : `Contrast · ${editingGroup?.label.toLowerCase() ?? 'family'}`;
    onApply(previewMap, label);
    setEditing(null);
  }

  function removeOne(group: FamilyGroup) {
    stopEditing();
    const merge = pickMerge(group.colors);
    if (!merge) return;
    onApply(new Map([[merge.from.id, merge.to.id]]), `Merged ${merge.from.name} into ${merge.to.name}`);
    setMessage(`Merged ${merge.from.name} into ${merge.to.name}.`);
  }

  async function addOne(group: FamilyGroup) {
    stopEditing();
    const inDesign = new Set(families.flatMap((f) => f.colors.map((c) => c.id)));
    const pool = (addSource === 'any' ? anyPool : palettePool).filter(
      (b) => !inDesign.has(b.id) && colorFamily(b.hex) === group.family,
    );
    if (pool.length === 0) {
      setMessage(
        addSource === 'collection'
          ? `${paletteName} has no other ${group.label.toLowerCase()} — try USE ANY.`
          : `No other ${group.label.toLowerCase()} available.`,
      );
      return;
    }
    setBusy(true);
    try {
      setMessage(await onAdd(group, pool));
    } catch (err) {
      setMessage(`Couldn’t add a color: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  const resultBead = (c: FamilyColor): Bead => {
    const id = previewMap.get(c.id);
    return (id && beadById(id)) || c;
  };

  if (families.length === 0) return null;

  return (
    <div className="families">
      <div className="edit__palette-header">
        <span className="type-eyebrow">COLOR FAMILIES</span>
      </div>

      <div className="families__switches">
        <div className="families__switch">
          <span className="type-meta">SLIDERS</span>
          <SegmentedControl
            size="compact"
            options={[
              { value: 'collection', label: 'COLLECTION COLOR' },
              { value: 'custom', label: 'CUSTOM COLOR' },
            ]}
            value={sliderSource}
            onChange={changeSliderSource}
          />
        </div>
        <div className="families__switch">
          <span className="type-meta">ADD COLORS</span>
          <SegmentedControl
            size="compact"
            options={[
              { value: 'collection', label: 'FROM COLLECTION' },
              { value: 'any', label: 'USE ANY' },
            ]}
            value={addSource}
            onChange={setAddSource}
          />
        </div>
      </div>

      {message && <p className="type-meta families__message">{message}</p>}

      {families.map((group) => {
        const open = openFamily === group.family;
        const beadCount = group.colors.reduce((n, c) => n + c.count, 0);
        return (
          <div key={group.family} className={`families__group${open ? ' families__group--open' : ''}`}>
            <div className="families__head">
              <button
                type="button"
                className="families__toggle"
                onClick={() => {
                  setOpenFamily(open ? null : group.family);
                  if (editing?.family === group.family) stopEditing();
                }}
              >
                <span className="families__mini-swatches">
                  {group.colors.map((c) => (
                    <span key={c.id} style={{ background: c.hex }} />
                  ))}
                </span>
                <span className="type-row-label families__name">{group.label}</span>
                <span className="type-meta">{beadCount}</span>
              </button>
              <div className="families__stepper">
                <button
                  type="button"
                  className="edit__extend-btn"
                  disabled={group.colors.length < 2 || busy}
                  onClick={() => removeOne(group)}
                  aria-label={`One fewer ${group.label.toLowerCase()}`}
                >
                  −
                </button>
                <span className="type-numeric families__count">{group.colors.length}</span>
                <button
                  type="button"
                  className="edit__extend-btn"
                  disabled={busy}
                  onClick={() => addOne(group)}
                  aria-label={`One more ${group.label.toLowerCase()}`}
                >
                  +
                </button>
              </div>
            </div>

            {open && (
              <div className="families__body">
                <div className="families__colors">
                  {group.colors.map((c) => {
                    const selected = editing?.kind === 'color' && editing.colorId === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        className={`families__color${selected ? ' families__color--selected' : ''}`}
                        onClick={() => (selected ? stopEditing() : startEditing({ kind: 'color', family: group.family, colorId: c.id }))}
                      >
                        <span className="families__color-swatch" style={{ background: c.hex }} />
                        <span className="families__color-name">{c.name}</span>
                        <span className="type-numeric families__color-count">{c.count}</span>
                      </button>
                    );
                  })}
                </div>

                {group.colors.length > 1 && !(editing?.kind === 'contrast' && editing.family === group.family) && (
                  <button
                    type="button"
                    className="adjust__link families__contrast-link"
                    onClick={() => startEditing({ kind: 'contrast', family: group.family })}
                  >
                    FAMILY CONTRAST ›
                  </button>
                )}

                {editing?.family === group.family && (
                  <div className="families__editor">
                    {editing.kind === 'color' && editingColor && (
                      <>
                        <div className="families__result">
                          <span className="families__color-swatch" style={{ background: editingColor.hex }} />
                          <span className="families__arrow">→</span>
                          <ResultSwatch bead={resultBead(editingColor)} />
                        </div>
                        <SegmentedControl
                          size="compact"
                          options={[
                            { value: 'sliders', label: 'SLIDERS' },
                            { value: 'picker', label: 'COLOR PICKER ⬡' },
                          ]}
                          value={colorMode}
                          onChange={changeColorMode}
                        />
                        {colorMode === 'sliders' ? (
                          <>
                            <Slider
                              label="DARKER ◂ ▸ LIGHTER"
                              value={adjust.brightness}
                              min={-100}
                              max={100}
                              onChange={(v) => updateAdjust({ brightness: v })}
                            />
                            <Slider
                              label="SATURATION"
                              value={adjust.saturation}
                              min={-100}
                              max={100}
                              onChange={(v) => updateAdjust({ saturation: v })}
                            />
                          </>
                        ) : (
                          <ColorPicker
                            key={editingColor.id}
                            initialHex={pickedHex ?? editingColor.hex}
                            originalHex={editingColor.hex}
                            onChange={updatePicked}
                          />
                        )}
                      </>
                    )}
                    {editing.kind === 'contrast' && (
                      <>
                        <div className="families__result families__result--wrap">
                          {group.colors.map((c) => (
                            <span key={c.id} className="families__pair">
                              <span className="families__color-swatch" style={{ background: c.hex }} />
                              <span className="families__arrow">→</span>
                              <ResultSwatch bead={resultBead(c)} compact />
                            </span>
                          ))}
                        </div>
                        <Slider label="FAMILY CONTRAST" value={contrast} min={-100} max={100} onChange={updateContrast} />
                      </>
                    )}
                    <p className="type-meta families__hint">
                      {editing.kind === 'color' && colorMode === 'picker'
                        ? 'Any color you like — saved as a custom color (it may not exist as a real bead).'
                        : sliderSource === 'collection'
                        ? `Snaps to the closest bead in ${paletteName}.`
                        : 'Makes a custom color — it may not exist as a real bead.'}
                    </p>
                    <div className="families__actions">
                      <button type="button" className="families__cancel" onClick={stopEditing}>
                        CANCEL
                      </button>
                      <button type="button" className="families__apply" disabled={previewMap.size === 0} onClick={apply}>
                        APPLY
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ResultSwatch({ bead, compact }: { bead: Bead; compact?: boolean }) {
  return (
    <span className="families__result-bead">
      <span className="families__color-swatch" style={{ background: bead.hex }} />
      {!compact && <span className="type-row-label">{bead.name}</span>}
    </span>
  );
}
