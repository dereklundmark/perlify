import { useState } from 'react';
import { useApp } from '../../state/AppContext';
import { createCollection, deleteCollection, duplicateCollection, saveCollection } from '../../db/db';
import { MenuDots } from '../ui/MenuDots';
import type { BeadCollection } from '../../db/schema';
import './CollectionsList.css';

export function CollectionsList() {
  const { state, dispatch } = useApp();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  function selectAndEdit(collection: BeadCollection) {
    if (state.draft) {
      dispatch({ type: 'draft/update', patch: { collectionId: collection.id, paletteMode: 'collection' } });
    }
    dispatch({ type: 'collection/edit', id: collection.id });
  }

  async function handleNew() {
    const name = window.prompt('Name this collection', 'New Colors');
    if (!name || !name.trim()) return;
    const collection = await createCollection(name.trim());
    dispatch({ type: 'collection/upsert', collection });
    selectAndEdit(collection);
  }

  async function handleRename(collection: BeadCollection) {
    setOpenMenuId(null);
    const name = window.prompt('Rename collection', collection.name);
    if (!name || !name.trim()) return;
    const updated = { ...collection, name: name.trim() };
    await saveCollection(updated);
    dispatch({ type: 'collection/upsert', collection: updated });
  }

  async function handleDuplicate(collection: BeadCollection) {
    setOpenMenuId(null);
    const copy = await duplicateCollection(collection.id);
    if (copy) dispatch({ type: 'collection/upsert', collection: copy });
  }

  async function handleDelete(collection: BeadCollection) {
    setOpenMenuId(null);
    const usedBy = state.patterns.filter((p) => p.collectionId === collection.id).length;
    const warning = usedBy > 0 ? ` It's used by ${usedBy} pattern${usedBy === 1 ? '' : 's'} — they'll keep their beads but lose the lock to this collection.` : '';
    if (!window.confirm(`Delete "${collection.name}"?${warning}`)) return;
    await deleteCollection(collection.id);
    dispatch({ type: 'collection/remove', id: collection.id });
  }

  return (
    <div className="screen screen--cream collections__screen">
      <div className="collections__bar">
        <button
          type="button"
          onClick={() => dispatch({ type: 'nav', screen: state.draft ? 'adjust' : 'library' })}
        >
          BACK
        </button>
        <span className="type-eyebrow">COLLECTIONS</span>
        <span style={{ width: 40 }} />
      </div>

      <div className="screen__body collections__body">
        <h1 className="type-headline">
          MY
          <br />
          COLLECTIONS
        </h1>

        <div className="collections__grid">
          {state.collections.map((collection) => (
            <div key={collection.id} className="collection-card">
              <button type="button" className="collection-card__thumb-wrap" onClick={() => selectAndEdit(collection)}>
                <div className="collection-card__swatch-grid">
                  {collection.beads.slice(0, 9).map((bead) => (
                    <span key={bead.id} style={{ background: bead.hex }} />
                  ))}
                  {collection.beads.length === 0 && <span className="collection-card__empty">No colors yet</span>}
                </div>
              </button>
              <div className="collection-card__meta-row">
                <div>
                  <div className="collection-card__name">{collection.name}</div>
                  <div className="collection-card__meta">{collection.beads.length} BEADS</div>
                </div>
                <button
                  type="button"
                  className="collection-card__menu-btn"
                  onClick={() => setOpenMenuId(openMenuId === collection.id ? null : collection.id)}
                  aria-label="Collection options"
                >
                  <MenuDots />
                </button>
              </div>
              {openMenuId === collection.id && (
                <div className="collection-card__menu">
                  <button type="button" onClick={() => handleRename(collection)}>
                    Rename
                  </button>
                  <button type="button" onClick={() => handleDuplicate(collection)}>
                    Duplicate
                  </button>
                  <button type="button" className="collection-card__menu-danger" onClick={() => handleDelete(collection)}>
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
          <button type="button" className="collection-card collection-card--new" onClick={handleNew}>
            <span className="collection-card__new-circle">+</span>
            <span className="collection-card__new-label">NEW</span>
          </button>
        </div>
      </div>
    </div>
  );
}
