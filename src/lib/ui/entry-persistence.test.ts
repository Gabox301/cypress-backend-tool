/**
 * Integration tests: verify persistent mounts survive store clearing.
 *
 * These tests simulate the dual-rendering flow:
 *   1. Data pushed to reactive stores (live per-it display)
 *   2. mountEntry() creates a persistent DOM sibling
 *   3. Stores are cleared (simulating beforeEach)
 *   4. The persistent mount should still exist in the DOM
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Svelte mount to avoid actual component rendering
vi.mock('svelte', () => ({
  mount: vi.fn(() => ({ __tag: 'mocked-component' })),
  unmount: vi.fn(),
}));

import { addApiCall, addDbQuery, apiCalls, clearApiCalls, clearDbQueries, dbQueries } from '$lib/stores.svelte';
import type { ApiCall, DbQuery } from '$lib/types';
import { EntryRegistry } from './entry-registry';
import { mountEntry } from './index';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
function apiCall(id: string = crypto.randomUUID()): ApiCall {
  return {
    id,
    request: { url: 'https://example.com/test', method: 'GET' },
    response: { status: 200, statusText: 'OK', headers: {}, body: { ok: true }, duration: 10, size: 50 },
    timestamp: 1000,
  } as ApiCall;
}

function dbQuery(id: string = crypto.randomUUID()): DbQuery {
  return {
    id,
    connectionId: 'local:5432/test',
    query: 'SELECT 1',
    result: [{ one: 1 }],
    duration: 5,
    timestamp: 2000,
  } as DbQuery;
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------
beforeEach(() => {
  document.body.innerHTML = '';
  const container = document.createElement('div');
  container.id = 'cypress-api-plugin-container';
  document.body.appendChild(container);

  apiCalls.length = 0;
  dbQueries.length = 0;
  EntryRegistry.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  document.body.innerHTML = '';
  apiCalls.length = 0;
  dbQueries.length = 0;
  EntryRegistry.clear();
});

// ===========================================================================
// Task 3.3 — Persistent mount survives store clear
// ===========================================================================
describe('persistent mount survives store clear (Task 3.3)', () => {
  it('ApiCall mount persists after clearApiCalls removes it from the store', () => {
    const call = apiCall('persist-api-1');

    // 1. Push to store (simulating cy.http())
    addApiCall(call);
    expect(apiCalls).toHaveLength(1);

    // 2. Mount independently
    mountEntry(call);
    expect(document.getElementById('cabt-entry-persist-api-1')).not.toBeNull();
    expect(EntryRegistry.size()).toBe(1);

    // 3. Clear stores (simulating beforeEach)
    clearApiCalls();
    expect(apiCalls).toHaveLength(0);

    // 4. Verify persistent mount still exists
    expect(document.getElementById('cabt-entry-persist-api-1')).not.toBeNull();
    expect(EntryRegistry.get('persist-api-1')).toBeDefined();
    expect(EntryRegistry.size()).toBe(1);
  });

  it('DbQuery mount persists after clearDbQueries removes it from the store', () => {
    const q = dbQuery('persist-db-1');

    addDbQuery(q);
    expect(dbQueries).toHaveLength(1);

    mountEntry(q);
    expect(document.getElementById('cabt-entry-persist-db-1')).not.toBeNull();

    clearDbQueries();
    expect(dbQueries).toHaveLength(0);

    // The mounted DOM element is still there
    expect(document.getElementById('cabt-entry-persist-db-1')).not.toBeNull();
    expect(EntryRegistry.get('persist-db-1')).toBeDefined();
  });

  it('multiple entries all persist after clearing both stores', () => {
    const call1 = apiCall('api-a');
    const call2 = apiCall('api-b');
    const q1 = dbQuery('db-a');

    addApiCall(call1);
    addApiCall(call2);
    addDbQuery(q1);
    mountEntry(call1);
    mountEntry(call2);
    mountEntry(q1);

    expect(apiCalls).toHaveLength(2);
    expect(dbQueries).toHaveLength(1);

    // Clear both stores
    clearApiCalls();
    clearDbQueries();

    expect(apiCalls).toHaveLength(0);
    expect(dbQueries).toHaveLength(0);

    // All three mounts persist
    expect(document.getElementById('cabt-entry-api-a')).not.toBeNull();
    expect(document.getElementById('cabt-entry-api-b')).not.toBeNull();
    expect(document.getElementById('cabt-entry-db-a')).not.toBeNull();
    expect(EntryRegistry.size()).toBe(3);
  });

  it('mount persists even after repeated store clears', () => {
    const call = apiCall('tough');

    mountEntry(call);

    // Simulate multiple test runs
    clearApiCalls();
    clearDbQueries();
    clearApiCalls(); // second clear

    expect(document.getElementById('cabt-entry-tough')).not.toBeNull();
    expect(EntryRegistry.get('tough')).toBeDefined();
  });
});

// ===========================================================================
// Task 3.4 — Cypress.$ can find the persistent entry after store clear
// ===========================================================================
describe('DOM query resolves persistent entry after store clear (Task 3.4)', () => {
  it('document.getElementById finds the persistent ApiCall entry after clear', () => {
    addApiCall(apiCall('cy-query-1'));
    mountEntry(apiCall('cy-query-1'));

    clearApiCalls();

    // Direct DOM query — equivalent to Cypress.$('#cabt-entry-cy-query-1')
    const el = document.getElementById('cabt-entry-cy-query-1');
    expect(el).not.toBeNull();
    expect(el!.id).toBe('cabt-entry-cy-query-1');
  });

  it('document.getElementById finds the persistent DbQuery entry after clear', () => {
    addDbQuery(dbQuery('cy-db-1'));
    mountEntry(dbQuery('cy-db-1'));

    clearDbQueries();

    const el = document.getElementById('cabt-entry-cy-db-1');
    expect(el).not.toBeNull();
    expect(el!.tagName).toBe('DIV');
  });

  it('querySelector with exact id selector works after store clear', () => {
    mountEntry(apiCall('sel-test'));
    clearApiCalls();

    // Cypress.$('#cabt-entry-sel-test') is equivalent to querySelector
    const el = document.querySelector('#cabt-entry-sel-test');
    expect(el).not.toBeNull();
    expect(el!.id).toBe('cabt-entry-sel-test');
  });

  it('persistent entry with snapshotOnly config stays in DOM after clear', () => {
    addApiCall(apiCall('snap-only'));
    mountEntry(apiCall('snap-only'));

    clearApiCalls();

    // The element is still queryable — snapshotOnly toggles visibility,
    // it does NOT remove elements from the DOM.
    expect(document.querySelector('#cabt-entry-snap-only')).not.toBeNull();
  });
});
