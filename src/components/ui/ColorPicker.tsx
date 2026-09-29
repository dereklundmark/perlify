import { useMemo, useState, type CSSProperties } from 'react';
import { hexToRgb, rgbToHex } from '../../lib/color';
import { hslToRgb, rgbToHsl, type HSL } from '../../lib/hsl';
import './ColorPicker.css';

// Honeycomb: hue runs around the rings, lightness from white (center) to
// the pure color (outer ring) — the classic hexagon color picker. A gray
// row underneath covers white → black. The sliders then fine-tune.
const RINGS = 6;
const CELL = 10; // hex circumradius in viewBox units
const SQRT3 = Math.sqrt(3);
const GRAY_STEPS = 9;

interface HexCell {
  key: string;
  x: number;
  y: number;
  hex: string;
}

function hexPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 90);
    pts.push(`${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}

function buildHoneycomb(): HexCell[] {
  const cells: HexCell[] = [];
  for (let q = -RINGS; q <= RINGS; q++) {
    for (let r = -RINGS; r <= RINGS; r++) {
      const ring = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
      if (ring > RINGS) continue;
      const x = CELL * SQRT3 * (q + r / 2);
      const y = CELL * 1.5 * r;
      const hue = ((Math.atan2(y, x) * 180) / Math.PI + 360 + 90) % 360;
      const l = 1 - 0.5 * (ring / RINGS);
      cells.push({ key: `${q},${r}`, x, y, hex: rgbToHex(hslToRgb({ h: hue, s: 1, l })) });
    }
  }
  return cells;
}

const HONEYCOMB = buildHoneycomb();
const HONEYCOMB_HALF_W = CELL * SQRT3 * (RINGS + 0.5);
const HONEYCOMB_HALF_H = CELL * (1.5 * RINGS + 1);
const GRAYS = Array.from({ length: GRAY_STEPS }, (_, i) => {
  const v = 255 * (1 - i / (GRAY_STEPS - 1));
  return rgbToHex({ r: v, g: v, b: v });
});

function rgbDistSq(a: string, b: string): number {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return (x.r - y.r) ** 2 + (x.g - y.g) ** 2 + (x.b - y.b) ** 2;
}

const HEX_RE = /^#?([0-9a-f]{6})$/i;

interface ColorPickerProps {
  /** Starting color. Remount (change `key`) to load a different one. */
  initialHex: string;
  onChange: (hex: string) => void;
  /** When set, the preview shows this as BEFORE next to the current color. */
  originalHex?: string;
}

export function ColorPicker({ initialHex, onChange, originalHex }: ColorPickerProps) {
  // HSL is the source of truth while dragging — round-tripping through hex
  // on every tick would make the hue jump around at low saturation.
  const [hsl, setHsl] = useState<HSL>(() => rgbToHsl(hexToRgb(initialHex)));
  const hex = rgbToHex(hslToRgb(hsl));
  const [hexText, setHexText] = useState(hex.toUpperCase());

  function update(next: HSL) {
    const nextHex = rgbToHex(hslToRgb(next));
    setHsl(next);
    setHexText(nextHex.toUpperCase());
    onChange(nextHex);
  }

  function pickHex(picked: string) {
    update(rgbToHsl(hexToRgb(picked)));
  }

  function handleHexText(text: string) {
    setHexText(text.toUpperCase());
    const m = HEX_RE.exec(text.trim());
    if (!m) return;
    const next = rgbToHsl(hexToRgb(m[1]));
    setHsl(next);
    onChange(rgbToHex(hslToRgb(next)));
  }

  // Outline whichever honeycomb/gray cell the current color sits on (if any).
  const selectedKey = useMemo(() => {
    let best: string | null = null;
    let bestD = 300;
    for (const c of HONEYCOMB) {
      const d = rgbDistSq(c.hex, hex);
      if (d < bestD) [best, bestD] = [c.key, d];
    }
    GRAYS.forEach((g, i) => {
      const d = rgbDistSq(g, hex);
      if (d < bestD) [best, bestD] = [`gray-${i}`, d];
    });
    return best;
  }, [hex]);

  const h = Math.round(hsl.h);
  const s = Math.round(hsl.s * 100);
  const l = Math.round(hsl.l * 100);
  // Full-strength rainbow regardless of the current color, so the rail stays readable on near-black/white.
  const hueStops = [0, 60, 120, 180, 240, 300, 360].map((d) => `hsl(${d} 100% 50%)`).join(', ');
  const thumbStyle = { '--thumb-color': hex } as CSSProperties;

  return (
    <div className="color-picker" style={thumbStyle}>
      <div className="color-picker__preview-row">
        <div className="color-picker__preview" aria-label={`Current color ${hex}`}>
          {originalHex && (
            <span className="color-picker__preview-half" style={{ background: originalHex }}>
              <span className="color-picker__preview-tag">BEFORE</span>
            </span>
          )}
          <span className="color-picker__preview-half" style={{ background: hex }}>
            {originalHex && <span className="color-picker__preview-tag">NOW</span>}
          </span>
        </div>
        <label className="color-picker__hex-field">
          <span className="type-meta">HEX</span>
          <input
            value={hexText}
            onChange={(e) => handleHexText(e.target.value)}
            onBlur={() => setHexText(hex.toUpperCase())}
            spellCheck={false}
            autoCapitalize="characters"
            maxLength={7}
            className="color-picker__hex-input"
          />
        </label>
      </div>

      <svg
        className="color-picker__honeycomb"
        viewBox={`${-HONEYCOMB_HALF_W} ${-HONEYCOMB_HALF_H} ${HONEYCOMB_HALF_W * 2} ${HONEYCOMB_HALF_H * 2}`}
        role="group"
        aria-label="Color honeycomb"
      >
        {HONEYCOMB.map((c) => (
          <polygon
            key={c.key}
            points={hexPoints(c.x, c.y, CELL - 0.6)}
            fill={c.hex}
            className="color-picker__cell"
            onClick={() => pickHex(c.hex)}
          />
        ))}
        {selectedKey && !selectedKey.startsWith('gray-') && (() => {
          const c = HONEYCOMB.find((cell) => cell.key === selectedKey)!;
          return <polygon points={hexPoints(c.x, c.y, CELL - 0.6)} className="color-picker__cell-selected" />;
        })()}
      </svg>

      <svg
        className="color-picker__grays"
        viewBox={`0 0 ${GRAY_STEPS * CELL * SQRT3} ${CELL * 2}`}
        role="group"
        aria-label="Grays"
      >
        {GRAYS.map((g, i) => {
          const cx = CELL * SQRT3 * (i + 0.5);
          const selected = selectedKey === `gray-${i}`;
          return (
            <polygon
              key={g}
              points={hexPoints(cx, CELL, CELL - 0.6)}
              fill={g}
              className={`color-picker__cell${selected ? ' color-picker__cell-selected' : ''}`}
              style={selected ? { fill: g } : undefined}
              onClick={() => pickHex(g)}
            />
          );
        })}
      </svg>

      <div className="color-picker__rail-block">
        <div className="color-picker__rail-labels">
          <span className="type-row-label">HUE</span>
          <span className="type-meta">{h}°</span>
        </div>
        <input
          type="range"
          min={0}
          max={360}
          value={h}
          onChange={(e) => update({ ...hsl, h: Number(e.target.value) })}
          className="color-picker__rail"
          style={{ background: `linear-gradient(to right, ${hueStops})` }}
          aria-label="Hue"
        />
      </div>

      <div className="color-picker__rail-block">
        <div className="color-picker__rail-labels">
          <span className="type-row-label">SATURATION</span>
          <span className="type-meta">{s}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={s}
          onChange={(e) => update({ ...hsl, s: Number(e.target.value) / 100 })}
          className="color-picker__rail"
          style={{ background: `linear-gradient(to right, hsl(${h} 0% ${l}%), hsl(${h} 100% ${l}%))` }}
          aria-label="Saturation"
        />
      </div>

      <div className="color-picker__rail-block">
        <div className="color-picker__rail-labels">
          <span className="type-row-label">DARKEN ◂ ▸ LIGHTEN</span>
          <span className="type-meta">{l}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          value={l}
          onChange={(e) => update({ ...hsl, l: Number(e.target.value) / 100 })}
          className="color-picker__rail"
          style={{ background: `linear-gradient(to right, #000, hsl(${h} ${s}% 50%), #fff)` }}
          aria-label="Darken or lighten"
        />
      </div>
    </div>
  );
}
