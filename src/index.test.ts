/**
 * Tests for src/index.ts — container reuse, store wiring, MutationObserver.
 *
 * Cypress globals are mocked via vi.stubGlobal BEFORE the module is imported.
 * The module auto-executes on import (registers commands), so mocks must exist first.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock factories (hoisted — available before module import)
// ---------------------------------------------------------------------------
const { capturedCommands, cyStateMock, cypressExposeMock } = vi.hoisted(() => {
  const captured: Record<string, (...args: unknown[]) => unknown> = {};
  return {
    capturedCommands: captured,
    cyStateMock: vi.fn(),
    cypressExposeMock: vi.fn(),
  };
});

// ---------------------------------------------------------------------------
// Stub Cypress globals BEFORE any import of src/index.ts
// ---------------------------------------------------------------------------
vi.stubGlobal('cy', {
  state: cyStateMock,
});

vi.stubGlobal('Cypress', {
  expose: cypressExposeMock,
  Commands: {
    add: vi.fn((name: string, handler: (...args: unknown[]) => unknown) => {
      capturedCommands[name] = handler;
    }),
  },
  log: vi.fn(() => ({
    snapshot: vi.fn(function (this: unknown) {
      return this;
    }),
    set: vi.fn(function (this: unknown) {
      return this;
    }),
    end: vi.fn(),
  })),
  $: vi.fn(() => ({ length: 0 })),
});

// ---------------------------------------------------------------------------
// Clean document between tests
// ---------------------------------------------------------------------------
function cleanDocument() {
  document.body.innerHTML = '';
  const existing = document.getElementById('cypress-api-plugin-container');
  if (existing) existing.remove();
}

beforeEach(() => {
  cleanDocument();
  // cy.state() returns different things depending on key
  cyStateMock.mockImplementation((key: string) => {
    if (key === 'window') return window;
    if (key === 'document') return document;
    if (key === 'runnable') return { id: 'test-1' };
    return undefined;
  });
  // Default plugin config — snapshotOnly disabled
  cypressExposeMock.mockImplementation((key: string) => {
    if (key === 'CYPRESS_PLUGIN_DEBUG') return false;
    if (key === 'snapshotOnly') return false;
    if (key === 'hideCredentials') return false;
    if (key === 'hideCredentialsOptions') return { headers: true, auth: true, body: true, query: true };
    if (key === 'requestMode') return 'auto';
    return undefined;
  });
});

afterEach(() => {
  vi.clearAllMocks();
  cleanDocument();
});

// ===========================================================================
// Task 2 — Container Reuse Unit Tests
// ===========================================================================

describe('createFreshContainer (Task 2)', () => {
  let createFreshContainer: (doc?: Document) => HTMLElement;

  beforeAll(async () => {
    const mod = await import('./index');
    createFreshContainer = (doc?: Document) => mod.createFreshContainer(doc || document);
  });

  it('creates container when none exists in the DOM', () => {
    const container = createFreshContainer(document);
    expect(container).toBeInstanceOf(HTMLElement);
    expect(container.id).toBe('cypress-api-plugin-container');
    expect(document.getElementById('cypress-api-plugin-container')).toBe(container);
  });

  it('reuses the same container — content accumulates, not cleared', () => {
    const first = createFreshContainer(document);
    const second = createFreshContainer(document);
    expect(second).toBe(first); // Same DOM element reused
    expect(document.querySelectorAll('#cypress-api-plugin-container').length).toBe(1);
  });

  it('always has exactly one container after any number of calls', () => {
    let last: HTMLElement | null = null;
    for (let i = 0; i < 10; i++) {
      last = createFreshContainer(document);
    }
    const all = document.querySelectorAll('#cypress-api-plugin-container');
    expect(all.length).toBe(1);
    expect(all[0]).toBe(last);
  });
});

// ===========================================================================
// Task 3 — Store Wiring Integration Tests
// ===========================================================================

describe('store wiring (Task 3)', () => {
  let addApiCall: (...args: any[]) => void;
  let addDbQuery: (...args: any[]) => void;
  let clearApiCalls: () => void;
  let clearDbQueries: () => void;
  let apiCalls: unknown[];
  let dbQueries: unknown[];

  beforeAll(async () => {
    const stores = await import('./lib/stores.svelte');
    addApiCall = stores.addApiCall;
    addDbQuery = stores.addDbQuery;
    clearApiCalls = stores.clearApiCalls;
    clearDbQueries = stores.clearDbQueries;
    // Access reactive $state arrays — vitest unwraps them via proxy
    apiCalls = stores.apiCalls as unknown[];
    dbQueries = stores.dbQueries as unknown[];
  });

  beforeEach(() => {
    // Clear stores before each test
    clearApiCalls();
    clearDbQueries();
  });

  function _mockApiResponse(status = 200, body: unknown = { ok: true }) {
    return {
      status,
      statusText: status === 200 ? 'OK' : 'Not Found',
      headers: { 'content-type': 'application/json' },
      body,
      duration: 42,
      size: JSON.stringify(body).length,
      cookies: [],
    };
  }

  function mockHttpHandler(url: string, method = 'GET', status = 200) {
    const options = { url, method };
    // Simulate what the real handler does: call cy.request → .then()
    const cyResponse = {
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      headers: { 'content-type': 'application/json' },
      body: { result: 'ok' },
    };

    const response = {
      status: cyResponse.status,
      statusText: cyResponse.statusText,
      headers: cyResponse.headers as Record<string, string>,
      body: cyResponse.body,
      duration: 42,
      size: JSON.stringify(cyResponse.body).length,
      cookies: [],
    };

    const call = {
      id: crypto.randomUUID(),
      request: {
        url: options.url,
        method: options.method,
        headers: undefined,
        body: undefined,
        qs: undefined,
        auth: undefined,
      },
      response,
      timestamp: Date.now(),
    };

    addApiCall(call);
    return call;
  }

  it('after one cy.http() simulation, apiCalls contains one entry with correct data', () => {
    const call = mockHttpHandler('https://api.example.com/users', 'GET');

    expect(apiCalls).toHaveLength(1);
    const stored = apiCalls[0] as Record<string, unknown>;
    expect(stored.id).toBe(call.id);
    expect((stored.request as Record<string, unknown>).url).toBe('https://api.example.com/users');
    expect((stored.request as Record<string, unknown>).method).toBe('GET');
    expect((stored.response as Record<string, unknown>).status).toBe(200);
  });

  it('after one cy.query() simulation, dbQueries contains one entry with correct data', () => {
    const queryCall = {
      id: crypto.randomUUID(),
      connectionId: 'conn-default',
      query: 'SELECT 1',
      result: [{ col: 1 }],
      duration: 5,
      timestamp: Date.now(),
    };
    addDbQuery(queryCall);

    expect(dbQueries).toHaveLength(1);
    const stored = dbQueries[0] as Record<string, unknown>;
    expect(stored.id).toBe(queryCall.id);
    expect(stored.query).toBe('SELECT 1');
    expect(stored.result as unknown[]).toHaveLength(1);
  });

  it('two sequential cy.http() calls preserve insertion order', () => {
    const call1 = mockHttpHandler('https://api.example.com/first', 'GET');
    const call2 = mockHttpHandler('https://api.example.com/second', 'POST');

    expect(apiCalls).toHaveLength(2);
    expect((apiCalls[0] as Record<string, unknown>).id).toBe(call1.id);
    expect((apiCalls[1] as Record<string, unknown>).id).toBe(call2.id);
    expect(((apiCalls[0] as Record<string, unknown>).request as Record<string, unknown>).url).toBe(
      'https://api.example.com/first',
    );
    expect(((apiCalls[1] as Record<string, unknown>).request as Record<string, unknown>).url).toBe(
      'https://api.example.com/second',
    );
  });

  it('beforeEach clear empties both arrays between simulated tests', () => {
    // Simulate test A execution
    mockHttpHandler('https://api.example.com/a', 'GET');
    const queryCall = {
      id: crypto.randomUUID(),
      connectionId: 'conn-1',
      query: 'SELECT * FROM a',
      result: [],
      duration: 1,
      timestamp: Date.now(),
    };
    addDbQuery(queryCall);

    expect(apiCalls).toHaveLength(1);
    expect(dbQueries).toHaveLength(1);

    // Simulate beforeEach clearing (as would happen between tests)
    clearApiCalls();
    clearDbQueries();

    expect(apiCalls).toHaveLength(0);
    expect(dbQueries).toHaveLength(0);

    // Simulate test B execution — should start fresh
    const callB = mockHttpHandler('https://api.example.com/b', 'POST');
    expect(apiCalls).toHaveLength(1);
    expect((apiCalls[0] as Record<string, unknown>).id).toBe(callB.id);
  });
});

// ===========================================================================
// Task 4 — MutationObserver Retry Resilience
// ===========================================================================

describe('MutationObserver resilience (Task 4)', () => {
  let createFreshContainer: (doc?: Document) => HTMLElement;

  beforeAll(async () => {
    const mod = await import('./index');
    createFreshContainer = (doc?: Document) => mod.createFreshContainer(doc || document);
  });

  it('removing container from DOM — next call creates fresh one', () => {
    const container = createFreshContainer(document);
    expect(container.isConnected).toBe(true);

    // Simulate Cypress snapshot replay removing it
    container.remove();
    expect(container.isConnected).toBe(false);

    // Next call should create a fresh container (always does)
    const fresh = createFreshContainer(document);
    expect(fresh.isConnected).toBe(true);
    expect(fresh).not.toBe(container);
    expect(document.querySelectorAll('#cypress-api-plugin-container').length).toBe(1);
  });

  it('after container removal, next mount creates fresh element', () => {
    const container1 = createFreshContainer(document);
    expect(document.body.contains(container1)).toBe(true);

    // Remove it (snapshot replay)
    container1.remove();

    // Always creates a new container
    const container2 = createFreshContainer(document);
    expect(document.body.contains(container2)).toBe(true);
    expect(container2).not.toBe(container1);
    expect(document.body.contains(container1)).toBe(false); // old one is gone
  });

  it('every call produces exactly one container in the DOM', () => {
    createFreshContainer(document);
    createFreshContainer(document);
    createFreshContainer(document);
    const last = createFreshContainer(document);
    // Only one container should exist
    const all = document.querySelectorAll('#cypress-api-plugin-container');
    expect(all.length).toBe(1);
    expect(all[0]).toBe(last);
  });
});
