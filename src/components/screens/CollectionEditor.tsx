import { useMemo, useState, type CSSProperties } from 'react';
import { useApp } from '../../state/AppContext';
import { CATALOG, catalogBeadById } from '../../lib/catalog';
import { hsbToRgb } from '../../lib/hsb';
import { rgbToHex } from '../../lib/color';
import { saveCollection } from '../../db/db';
import type { Bead } from '../../db/schema';
import './CollectionEditor.css';

const CUSTOM_VALUE = 0.9; // fixed brightness — see plan's scope note (two rails only)

export function CollectionEditor() {
  const { state, dispatch } = useApp();
  const [beads, setBeads] = useState<Bead[]>(state.collection?.beads ?? []);
  const [search, setSearch] = useState('');
  const [hue, setHue] = useState(220);
  const [sat, setSat] = useState(60);
  const [customName, setCustomName] = useState('');

  const ownedIds = useMemo(() => new Set(beads.map((b) => b.id)), [beads]);

  if (!state.collection) return null;

  const results = search.trim()
    ? CATALOG.filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase()))
    : CATALOG;

  const usedByCount = state.patterns.filter((p) => p.collectionId === state.collection?.id).length;

  function toggleOwned(catalogId: string) {
    const catalogBead = catalogBeadById(catalogId);
    if (!catalogBead) return;
    setBeads((prev) =>
      ownedIds.has(catalogId)
        ? prev.filter((b) => b.id !== catalogId)
        : [...prev, { id: catalogBead.id, name: catalogBead.name, hex: catalogBead.hex }],
    );
  }

  function removeBead(id: string) {
    setBeads((prev) => prev.filter((b) => b.id !== id));
  }

  const customHex = rgbToHex(hsbToRgb({ h: hue, s: sat / 100, v: CUSTOM_VALUE }));

  function addCustomColor() {
    const bead: Bead = {
      id: crypto.randomUUID(),
      name: customName.trim() || `Custom ${customHex}`,
      hex: customHex,
    };
    setBeads((prev) => [...prev, bead]);
    setCustomName('');
  }

  async function handleSave() {
    if (!state.collection) return;
    const updated = { ...state.collection, beads };
    await saveCollection(updated);
    dispatch({ type: 'collection/update', collection: updated });
    dispatch({ type: 'nav', screen: 'setup' });
  }

  return (
    <div className="screen screen--light collection__screen">
      <div className="collection__bar">
        <button type="button" onClick={() => dispatch({ type: 'nav', screen: 'setup' })}>
          Collections
        </button>
        <button type="button" className="collection__save" onClick={handleSave}>
          Save
        </button>
      </div>

      <div className="screen__body collection__body">
        <h1 className="type-screen-title collection__title">{state.collection.name}</h1>
        <div className="type-mono collection__meta">
          {beads.length} BEADS OWNED · USED BY {usedByCount} PATTERN{usedByCount === 1 ? '' : 'S'}
        </div>

        <div className="collection__search">
          <span className="collection__search-icon" aria-hidden>
            ◎
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search the catalog…"
            className="collection__search-input"
          />
          <span className="type-mono collection__search-hits">CATALOG · {results.length} HITS</span>
        </div>

        <div className="collection__results">
          {results.map((c) => {
            const owned = ownedIds.has(c.id);
            return (
              <div key={c.id} className="collection__result-row">
                <span className="collection__swatch" style={{ background: c.hex }} />
                <div className="collection__result-main">
                  <div className="collection__result-name">{c.name}</div>
                  <div className="type-mono collection__result-hex">{c.hex.toUpperCase()}</div>
                </div>
                <button
                  type="button"
                  className={`collection__owned-toggle${owned ? ' collection__owned-toggle--owned' : ''}`}
                  onClick={() => toggleOwned(c.id)}
                  aria-label={owned ? `Remove ${c.name}` : `Add ${c.name}`}
                >
                  {owned ? '✓' : '+'}
                </button>
              </div>
            );
          })}
        </div>

        <div className="type-eyebrow collection__owned-eyebrow">
          OWNED · {beads.length} OF {CATALOG.length} CATALOG
        </div>
        <div className="collection__owned-grid">
          {beads.map((bead) => {
            const catalogBead = catalogBeadById(bead.id);
            return (
              <button
                key={bead.id}
                type="button"
                className="collection__owned-swatch"
                style={{ background: bead.hex }}
                onClick={() => removeBead(bead.id)}
                title={`Remove ${bead.name}`}
              >
                {catalogBead?.symbol && <span className="type-mono">{catalogBead.symbol}</span>}
              </button>
            );
          })}
        </div>

        <div className="collection__custom-card">
          <div className="type-row-label">Custom color</div>
          <div className="type-mono collection__custom-hex">
            HSB · {customHex.toUpperCase()}
            <span className="collection__custom-preview" style={{ background: customHex }} />
          </div>

          <input
            type="range"
            min={0}
            max={360}
            value={hue}
            onChange={(e) => setHue(Number(e.target.value))}
            className="collection__hue-rail"
          />
          <input
            type="range"
            min={0}
            max={100}
            value={sat}
            onChange={(e) => setSat(Number(e.target.value))}
            className="collection__sat-rail"
            style={{ '--sat-color': `hsl(${hue}, 100%, 45%)` } as CSSProperties}
          />

          <div className="collection__custom-add-row">
            <input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Name (optional)"
              className="collection__custom-name-input"
            />
            <button type="button" className="collection__custom-add" onClick={addCustomColor}>
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
