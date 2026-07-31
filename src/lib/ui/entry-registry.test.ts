import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Svelte's unmount so the unit test doesn't need a real component tree.
// vi.mock is hoisted before all imports, so both the test AND entry-registry.ts
// see the mocked version.
vi.mock('svelte', () => ({ unmount: vi.fn() }));

import { unmount } from 'svelte';
import { EntryRegistry } from './entry-registry';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockComponent(): object {
  return { __tag: 'mock-component', id: crypto.randomUUID() };
}

function mockElement(id: string): HTMLElement {
  const el = document.createElement('div');
  el.id = id;
  document.body.appendChild(el);
  return el;
}

beforeEach(() => {
  document.body.innerHTML = '';
  EntryRegistry.clear();
  vi.clearAllMocks();
});

// ===========================================================================
// register + get
// ===========================================================================
describe('register + get', () => {
  it('stores and retrieves an entry by ID', () => {
    const id = 'entry-1';
    const comp = mockComponent();
    const el = mockElement(id);

    EntryRegistry.register(id, comp, el);

    const record = EntryRegistry.get(id);
    expect(record).toBeDefined();
    expect(record!.component).toBe(comp);
    expect(record!.element).toBe(el);
  });

  it('rejects duplicate IDs with a throw and does NOT overwrite', () => {
    const id = 'dup';
    const comp1 = mockComponent();
    const el1 = mockElement('dup-1');

    EntryRegistry.register(id, comp1, el1);

    const comp2 = mockComponent();
    const el2 = mockElement('dup-2');

    expect(() => EntryRegistry.register(id, comp2, el2)).toThrow();

    // First entry is still intact
    const record = EntryRegistry.get(id);
    expect(record!.component).toBe(comp1);
    expect(record!.element).toBe(el1);
  });
});

// ===========================================================================
// get — unknown ID
// ===========================================================================
describe('get — unknown ID', () => {
  it('returns undefined when the ID was never registered', () => {
    expect(EntryRegistry.get('does-not-exist')).toBeUndefined();
  });
});

// ===========================================================================
// unmount
// ===========================================================================
describe('unmount', () => {
  it('removes an existing entry and its element from the DOM', () => {
    const id = 'remove-me';
    const comp = mockComponent();
    const el = mockElement(id);
    EntryRegistry.register(id, comp, el);

    expect(EntryRegistry.get(id)).toBeDefined();
    expect(document.getElementById(id)).not.toBeNull();

    EntryRegistry.unmount(id);

    expect(EntryRegistry.get(id)).toBeUndefined();
    expect(document.getElementById(id)).toBeNull();
  });

  it('calls Svelte unmount on the component', () => {
    const id = 'call-unmount';
    const comp = mockComponent();
    const el = mockElement(id);
    EntryRegistry.register(id, comp, el);

    EntryRegistry.unmount(id);

    expect(unmount).toHaveBeenCalledWith(comp);
  });

  it('is a no-op for an unknown ID (does not throw)', () => {
    expect(() => EntryRegistry.unmount('ghost')).not.toThrow();
  });
});

// ===========================================================================
// clear
// ===========================================================================
describe('clear', () => {
  it('empties the registry of all entries', () => {
    EntryRegistry.register('a', mockComponent(), mockElement('a'));
    EntryRegistry.register('b', mockComponent(), mockElement('b'));
    EntryRegistry.register('c', mockComponent(), mockElement('c'));

    expect(EntryRegistry.size()).toBe(3);

    EntryRegistry.clear();

    expect(EntryRegistry.size()).toBe(0);
    expect(EntryRegistry.get('a')).toBeUndefined();
    expect(EntryRegistry.get('b')).toBeUndefined();
    expect(EntryRegistry.get('c')).toBeUndefined();
    expect(document.getElementById('a')).toBeNull();
    expect(document.getElementById('b')).toBeNull();
    expect(document.getElementById('c')).toBeNull();
  });

  it('calls Svelte unmount for every registered entry', () => {
    const compA = mockComponent();
    const compB = mockComponent();
    EntryRegistry.register('a', compA, mockElement('a'));
    EntryRegistry.register('b', compB, mockElement('b'));

    EntryRegistry.clear();

    expect(unmount).toHaveBeenCalledTimes(2);
    expect(unmount).toHaveBeenCalledWith(compA);
    expect(unmount).toHaveBeenCalledWith(compB);
  });
});

// ===========================================================================
// size
// ===========================================================================
describe('size', () => {
  it('returns 0 for an empty registry', () => {
    expect(EntryRegistry.size()).toBe(0);
  });

  it('reflects the number of registered entries', () => {
    EntryRegistry.register('x', mockComponent(), mockElement('x'));
    expect(EntryRegistry.size()).toBe(1);

    EntryRegistry.register('y', mockComponent(), mockElement('y'));
    expect(EntryRegistry.size()).toBe(2);

    EntryRegistry.unmount('x');
    expect(EntryRegistry.size()).toBe(1);
  });
});
