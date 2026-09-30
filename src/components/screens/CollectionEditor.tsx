import { useMemo, useState } from 'react';
import { useApp } from '../../state/AppContext';
import { CATALOG, catalogBeadById, isCatalogBead } from '../../lib/catalog';
import { saveCollection } from '../../db/db';
import type { Bead } from '../../db/schema';
import { BottomSheet } from '../ui/BottomSheet';
import { ColorPicker } from '../ui/ColorPicker';
import { SegmentedControl } from '../ui/SegmentedControl';
import { groupByColorFamily } from '../../lib/colorFamily';
import './CollectionEditor.css';

const DEFAULT_CUSTOM_HEX = '#4a7bd9';

type OwnedOrder = 'added' | 'family';
const OWNED_ORDER_KEY = 'perlify.ownedOrder';

function readOwnedOrder(): OwnedOrder {
  try {
    return localStorage.getItem(OWNED_ORDER_KEY) === 'family' ? 'family' : 'added';
  } catch {
    return 'added';
  }
}

export function CollectionEditor() {
  const { state, dispatch } = useApp();
  const editing = state.collections.find((c) => c.id === state.editingCollectionId);
  const [name, setName] = useState(editing?.name ?? '');
  const [beads, setBeads] = useState<Bead[]>(editing?.beads ?? []);
  const [search, setSearch] = useState('');
  const [customHex, setCustomHex] = useState(DEFAULT_CUSTOM_HEX);
  const [customName, setCustomName] = useState('');
  // The owned bead whose edit sheet is open, plus that sheet's working copy.
  const [editingBeadId, setEditingBeadId] = useState<string | null>(null);
  const [editHex, setEditHex] = useState('');
  const [editName, setEditName] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [ownedOrder, setOwnedOrder] = useState<OwnedOrder>(readOwnedOrder);

  const ownedIds = useMemo(() => new Set(beads.map((b) => b.id)), [beads]);

  if (!editing) {
    return (
      <div className="screen screen--cream collection__screen">
        <div className="collection__bar">
          <button type="button" onClick={() => dispatch({ type: 'nav', screen: 'collections' })}>
            COLLECTIONS
          </button>
        </div>
        <p className="type-body collection__missing">This collection no longer exists.</p>
      </div>
    );
  }

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

  const editingBead = editingBeadId ? beads.find((b) => b.id === editingBeadId) : undefined;

  function openBeadEditor(bead: Bead) {
    setEditingBeadId(bead.id);
    setEditHex(bead.hex);
    setEditName(bead.name);
  }

  function closeBeadEditor() {
    setEditingBeadId(null);
  }

  function deleteEditingBead() {
    if (!editingBead) return;
    setBeads((prev) => prev.filter((b) => b.id !== editingBead.id));
    closeBeadEditor();
  }

  function saveEditingBead() {
    if (!editingBead) return;
    const hex = editHex.toLowerCase();
    const beadName = editName.trim() || editingBead.name;
    const hexChanged = hex !== editingBead.hex.toLowerCase();
    if (hexChanged || beadName !== editingBead.name) {
      // A re-tinted color becomes a new bead: a catalog id always means the
      // catalog color, and saved patterns keep drawing the custom one they used.
      const keepId = !hexChanged && !isCatalogBead(editingBead.id);
      const replacement: Bead = { id: keepId ? editingBead.id : crypto.randomUUID(), name: beadName, hex };
      setBeads((prev) => prev.map((b) => (b.id === editingBead.id ? replacement : b)));
    }
    closeBeadEditor();
  }

  function addCustomColor() {
    const bead: Bead = {
      id: crypto.randomUUID(),
      name: customName.trim() || `Custom ${customHex.toUpperCase()}`,
      hex: customHex,
    };
    setBeads((prev) => [...prev, bead]);
    setCustomName('');
  }

  function changeOwnedOrder(order: OwnedOrder) {
    setOwnedOrder(order);
    try {
      localStorage.setItem(OWNED_ORDER_KEY, order);
    } catch {
      // Storage blocked — the choice just won't be remembered next time.
    }
  }

  function renderOwnedSwatch(bead: Bead) {
    const catalogBead = catalogBeadById(bead.id);
    return (
      <button
        key={bead.id}
        type="button"
        className="collection__owned-swatch"
        style={{ background: bead.hex }}
        onClick={() => openBeadEditor(bead)}
        title={`Edit ${bead.name}`}
        aria-label={`Edit ${bead.name}`}
      >
        {catalogBead?.symbol && <span>{catalogBead.symbol}</span>}
      </button>
    );
  }

  async function handleSave() {
    if (!editing) return;
    const updated = { ...editing, name: name.trim() || editing.name, beads };
    try {
      await saveCollection(updated);
    } catch (err) {
      setSaveError(`Couldn't save: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    dispatch({ type: 'collection/upsert', collection: updated });
    // If the open pattern was using all of this collection's colors, keep it
    // that way — otherwise newly added colors sit outside a stale count.
    if (state.draft?.collectionId === editing.id && state.draft.colorCount >= editing.beads.length) {
      dispatch({ type: 'draft/update', patch: { colorCount: Math.max(2, beads.length) } });
    }
    // Adjust needs an open pattern with a photo to render — only go back
    // there when there really is one; otherwise back to the collections list.
    dispatch({ type: 'nav', screen: state.draft?.sourceImage ? 'adjust' : 'collections' });
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
        {saveError && <p className="type-meta collection__error">{saveError}</p>}
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

        <div className="collection__owned-head">
          <span className="type-eyebrow">OWNED · {beads.length}</span>
          {beads.length > 1 && (
            <SegmentedControl
              size="compact"
              options={[
                { value: 'added', label: 'ADDED' },
                { value: 'family', label: 'COLOR' },
              ]}
              value={ownedOrder}
              onChange={changeOwnedOrder}
            />
          )}
        </div>
        {beads.length > 0 && <span className="type-meta">TAP A COLOR TO EDIT OR DELETE</span>}
        {ownedOrder === 'family' ? (
          groupByColorFamily(beads).map((group) => (
            <div key={group.family} className="collection__owned-group">
              <span className="type-meta collection__owned-group-label">
                {group.label} · {group.items.length}
              </span>
              <div className="collection__owned-grid">{group.items.map(renderOwnedSwatch)}</div>
            </div>
          ))
        ) : (
          <div className="collection__owned-grid">{beads.map(renderOwnedSwatch)}</div>
        )}

        <div className="collection__custom-card">
          <span className="type-row-label">CUSTOM COLOR</span>

          <ColorPicker initialHex={DEFAULT_CUSTOM_HEX} onChange={setCustomHex} />

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

      {editingBead && (
        <BottomSheet variant="white" modal onBackdropClick={closeBeadEditor}>
          <div className="collection__edit-sheet">
            <div className="collection__edit-head">
              <span className="type-eyebrow">EDIT COLOR</span>
              <button type="button" className="collection__edit-cancel" onClick={closeBeadEditor}>
                CANCEL
              </button>
            </div>
            <input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Color name"
              className="collection__custom-name-input"
              aria-label="Color name"
            />
            <ColorPicker
              key={editingBead.id}
              initialHex={editingBead.hex}
              originalHex={editingBead.hex}
              onChange={setEditHex}
            />
            <div className="collection__edit-actions">
              <button type="button" className="collection__edit-delete" onClick={deleteEditingBead}>
                DELETE
              </button>
              <button type="button" className="collection__custom-add collection__edit-save" onClick={saveEditingBead}>
                SAVE COLOR
              </button>
            </div>
          </div>
        </BottomSheet>
      )}
    </div>
  );
}
