import { useMemo, useState } from 'react';
import { useApp } from '../../state/AppContext';
import { CATALOG, catalogBeadById } from '../../lib/catalog';
import { hsbToRgb } from '../../lib/hsb';
import { rgbToHex } from '../../lib/color';
import { saveCollection } from '../../db/db';
import type { Bead } from '../../db/schema';
import './CollectionEditor.css';

// Pegboard's custom-color control is a single hue rail (see the `4a` canvas
// markup) — saturation/value are fixed rather than a second rail.
const CUSTOM_SAT = 0.65;
const CUSTOM_VALUE = 0.85;

export function CollectionEditor() {
  const { state, dispatch } = useApp();
  const editing = state.collections.find((c) => c.id === state.editingCollectionId);
  const [name, setName] = useState(editing?.name ?? '');
  const [beads, setBeads] = useState<Bead[]>(editing?.beads ?? []);
  const [search, setSearch] = useState('');
  const [hue, setHue] = useState(220);
  const [customName, setCustomName] = useState('');

  const ownedIds = useMemo(() => new Set(beads.map((b) => b.id)), [beads]);

  if (!editing) return null;

  const results = search.trim()
    ? CATALOG.filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase()))
    : CATALOG;

  const usedByCount = state.patterns.filter((p) => p.collectionId === editing.id).length;

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

  const customHex = rgbToHex(hsbToRgb({ h: hue, s: CUSTOM_SAT, v: CUSTOM_VALUE }));

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
    if (!editing) return;
    const updated = { ...editing, name: name.trim() || editing.name, beads };
    await saveCollection(updated);
    dispatch({ type: 'collection/upsert', collection: updated });
    dispatch({ type: 'nav', screen: 'adjust' });
  }

  return (
    <div className="screen screen--cream collection__screen">
      <div className="collection__bar">
        <button type="button" onClick={() => dispatch({ type: 'nav', screen: 'collections' })}>
          COLLECTIONS
        </button>
        <button type="button" className="collection__save" onClick={handleSave}>
          SAVE
        </button>
      </div>

      <div className="screen__body collection__body">
        <input
          className="collection__name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Collection name"
        />
        <div className="type-meta">
          {beads.length} BEADS · USED BY {usedByCount} PATTERN{usedByCount === 1 ? '' : 'S'}
        </div>

        <div className="collection__search">
          <span className="collection__search-icon" aria-hidden>
            ◎
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="collection__search-input"
          />
          <span className="type-meta collection__search-hits">{results.length} HITS</span>
        </div>

        <div className="collection__results">
          {results.map((c) => {
            const owned = ownedIds.has(c.id);
            return (
              <div key={c.id} className="collection__result-row">
                <span className="collection__swatch" style={{ background: c.hex }} />
                <div className="collection__result-main">
                  <div className="collection__result-name">{c.name}</div>
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

        <div className="type-eyebrow">
          OWNED · {beads.length} OF {CATALOG.length}
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
                {catalogBead?.symbol && <span>{catalogBead.symbol}</span>}
              </button>
            );
          })}
        </div>

        <div className="collection__custom-card">
          <div className="collection__custom-head">
            <span className="type-row-label">CUSTOM COLOR</span>
            <span className="type-meta">{customHex.toUpperCase()}</span>
          </div>

          <input
            type="range"
            min={0}
            max={360}
            value={hue}
            onChange={(e) => setHue(Number(e.target.value))}
            className="collection__hue-rail"
          />

          <div className="collection__custom-add-row">
            <input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Name (optional)"
              className="collection__custom-name-input"
            />
            <button type="button" className="collection__custom-add" onClick={addCustomColor}>
              ADD
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
