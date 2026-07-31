import { unmount } from 'svelte';

// ───────────────────────────────────────────────────────────────────────────
// EntryRecord — tracks a persistent Svelte mount and its DOM element.
// ───────────────────────────────────────────────────────────────────────────
export interface EntryRecord {
  /** The return value of Svelte 5's mount() — opaque to consumers. */
  component: object;
  /** The div#cabt-entry-{id} DOM element the component was mounted into. */
  element: HTMLElement;
}

// Module-scoped Map — no class, no instantiation, one instance per JS realm.
const _entries = new Map<string, EntryRecord>();

/**
 * Module-level singleton that manages persistent entry component lifecycles.
 *
 * All imports in the same JavaScript realm share the same registry. There is
 * no constructor or factory — the singleton is the module itself.
 */
export const EntryRegistry = {
  /**
   * Register a mounted entry by its unique ID. Throws if the ID already
   * exists (defensive — each cabt-entry-{id} div must be unique in the DOM).
   */
  register(id: string, component: object, element: HTMLElement): void {
    if (_entries.has(id)) {
      throw new Error(`Entry with id "${id}" is already registered`);
    }
    _entries.set(id, { component, element });
  },

  /** Retrieve a registered entry, or undefined if not found. */
  get(id: string): EntryRecord | undefined {
    return _entries.get(id);
  },

  /**
   * Unmount a registered entry: calls Svelte unmount(), removes the DOM
   * element, and deletes the record. A no-op for unknown IDs.
   */
  unmount(id: string): void {
    const entry = _entries.get(id);
    if (!entry) return;
    unmount(entry.component);
    entry.element.remove();
    _entries.delete(id);
  },

  /** Unmount and remove every registered entry. */
  clear(): void {
    // Iterate over a snapshot of keys because unmount() mutates the Map.
    for (const id of Array.from(_entries.keys())) {
      this.unmount(id);
    }
  },

  /** The number of currently registered entries. */
  size(): number {
    return _entries.size;
  },
};
