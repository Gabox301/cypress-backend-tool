/// <reference types="cypress" />

// ============================================
// Cypress Backend Tool — Unified Entry
// Auto-init on side-effect import.
// Replaces cypress/support/plugin/index.ts
// ============================================

import { getPluginConfig } from '$lib/config';
import { addApiCall, addDbQuery, pluginConfig } from '$lib/stores.svelte';
import type { ApiCall, ApiResponse, CypressApiPluginConfig, DbQuery } from '$lib/types';
import { ensurePluginMounted } from '$lib/ui';

// ============================================
// Cypress namespace augmentations
// ============================================

declare global {
  namespace Cypress {
    interface Chainable {
      http(url: string, options?: Partial<ApiRequestOptions>): Chainable<ApiResponse>;
      http(options: ApiRequestOptions): Chainable<ApiResponse>;
      query(query: string, connectionOptions?: DbConnectionOptions): Chainable<DbQueryResponse>;
      state(key: 'window'): Window;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      state(key: string): any;
    }

    interface ExposeValues {
      snapshotOnly: boolean;
      hideCredentials: boolean;
      hideCredentialsOptions: {
        headers: boolean;
        auth: boolean;
        body: boolean;
        query: boolean;
      };
      requestMode: 'auto' | 'manual';
      CYPRESS_PLUGIN_DEBUG: boolean;
      dbHost: string;
      dbPort: string;
      dbName: string;
      dbUser: string;
      dbPassword: string;
    }
  }
}

// ============================================
// Types
// ============================================

interface ApiRequestOptions {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
  headers?: Record<string, string>;
  body?: unknown;
  qs?: Record<string, string>;
  auth?: { username: string; password: string };
  failOnStatusCode?: boolean;
}

/** Shape returned by cy.task('db:getConfig') */
interface DbTaskConfig {
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
}

/** Shape returned by cy.task('db:query') */
interface DbTaskResult {
  rows: unknown[];
  rowCount: number;
}

interface DbQueryResponse {
  rows: unknown[];
  rowCount: number;
  duration: number;
  query: string;
}

interface DbConnectionOptions {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

// ============================================
// Plugin configuration
// ============================================

const DEBUG = (Cypress.expose('CYPRESS_PLUGIN_DEBUG') as boolean) ?? false;

function logDebug(...args: unknown[]) {
  if (DEBUG) {
    console.warn('[cypress-backend-tool]', ...args);
  }
}

function readPluginConfig(): CypressApiPluginConfig {
  const config = getPluginConfig((key: string) => Cypress.expose(key));
  // Sync straight into the reactive store that App.svelte reads from.
  // No need to thread config through component props on every call anymore
  // — the store is shared between this file and App.svelte.
  Object.assign(pluginConfig, config);
  return config;
}

// ============================================
// ONE persistent container per live document — created once, NEVER
// cleared. Every call is appended as its own entry by App.svelte (keyed by
// that call's own stable `id`), so a Cypress.log().snapshot() taken for
// call #1 keeps pointing at call #1's element even after calls #2, #3, ...
// happen. Reusing-and-clearing a single shared element (the previous
// approach) is exactly what broke snapshot viewing.
//
// Re-creation happens automatically: if the AUT document was reloaded
// (Cypress resetting the page before a new test, or a real cy.visit()),
// the old container no longer exists in the new document, so
// getElementById returns null and we create + (re)mount fresh.
// ============================================

function getOrCreateContainer(doc: Document): HTMLElement {
  let container = doc.getElementById('cypress-api-plugin-container') as HTMLElement | null;
  if (!container) {
    container = doc.createElement('div');
    container.id = 'cypress-api-plugin-container';
    doc.body.appendChild(container);
  }
  ensurePluginMounted(container, doc);
  return container;
}

function applySnapshotOnly(container: HTMLElement, config: CypressApiPluginConfig) {
  container.classList.toggle('cypress-plugin-collapsed', config.snapshotOnly);
}

function scrollToEntry(doc: Document, id: string) {
  doc.getElementById(id)?.scrollIntoView({ block: 'end' });
}

// Per-test storage — scoped by Cypress test ID. Kept for tests that read
// this directly (e.g. custom assertions on the raw call/query history); the
// plugin UI itself no longer depends on it, it reads the shared
// apiCalls/dbQueries stores instead.
declare global {
  interface Window {
    __cypress_backend_tool__?: Record<string, { apiCalls: ApiCall[]; dbQueries: DbQuery[] }>;
  }
}

function getTestStore() {
  const testId = cy.state('runnable')?.id || 'unknown';
  const win = cy.state('window') as Window;
  if (!win.__cypress_backend_tool__) {
    win.__cypress_backend_tool__ = {};
  }
  if (!win.__cypress_backend_tool__[testId]) {
    win.__cypress_backend_tool__[testId] = { apiCalls: [], dbQueries: [] };
  }
  return win.__cypress_backend_tool__[testId];
}

// Exported for unit testing (kept under the old name to avoid churn in any
// existing tests that import it).
export { getOrCreateContainer as createFreshContainer };

function showApiUi(call: ApiCall): Cypress.Chainable<ApiResponse> {
  if (!call.response) return cy.wrap(null) as unknown as Cypress.Chainable<ApiResponse>;

  const config = readPluginConfig();
  const win = cy.state('window') as Window;
  const doc = win.document;

  const log = Cypress.log({
    name: call.request.method,
    autoEnd: false,
    message: `${call.request.method} ${call.request.url}`,
    consoleProps: () => ({ request: call.request, response: call.response }),
  });

  const container = getOrCreateContainer(doc);
  applySnapshotOnly(container, config);

  return cy.window({ log: false }).then(() => {
    const elementId = `cabt-entry-${call.id}`;
    scrollToEntry(doc, elementId);
    const $el = Cypress.$(`#${elementId}`, { log: false });
    log.set({ $el }).snapshot('response').end();
    return call.response!;
  });
}

function showDbQueryUi(query: DbQuery): void {
  const config = readPluginConfig();
  const win = cy.state('window') as Window;
  const doc = win.document;

  // Previously, DB queries had no Cypress.log() entry at all — there was
  // nothing in the command log to click on to inspect a query's snapshot.
  // This gives every cy.query() call its own logged, snapshot-able entry,
  // exactly like cy.http() already has.
  const log = Cypress.log({
    name: 'QUERY',
    autoEnd: false,
    message: query.query,
    consoleProps: () => ({ query: query.query, result: query.result, duration: query.duration, error: query.error }),
  });

  const container = getOrCreateContainer(doc);
  applySnapshotOnly(container, config);

  cy.window({ log: false }).then(() => {
    const elementId = `cabt-entry-${query.id}`;
    scrollToEntry(doc, elementId);
    const $el = Cypress.$(`#${elementId}`, { log: false });
    log.set({ $el }).snapshot('response').end();
  });

  logDebug('DB Query UI rendered (id:', query.id, ')');
}

// ============================================
// Command registration — auto-init on import
// ============================================

Cypress.Commands.add(
  'http',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (urlOrOptions: any, maybeOptions?: ApiRequestOptions) => {
    const options: ApiRequestOptions =
      typeof urlOrOptions === 'string'
        ? { url: urlOrOptions, method: maybeOptions?.method || 'GET', ...maybeOptions }
        : urlOrOptions;
    const startTime = Date.now();

    return cy.request(options as unknown as Record<string, unknown>).then((cyResponse) => {
      const response: ApiResponse = {
        status: cyResponse.status,
        statusText: cyResponse.statusText || '',
        headers: (cyResponse.headers || {}) as Record<string, string>,
        body: cyResponse.body,
        duration: Date.now() - startTime,
        size: JSON.stringify(cyResponse.body).length,
        cookies: (cyResponse as { cookies?: ApiResponse['cookies'] }).cookies || [],
      };

      const call: ApiCall = {
        id: crypto.randomUUID(),
        request: {
          url: options.url,
          method: options.method,
          headers: options.headers,
          body: options.body,
          qs: options.qs,
          auth: options.auth,
        },
        response,
        timestamp: Date.now(),
      };

      addApiCall(call);
      getTestStore().apiCalls.push(call);
      return showApiUi(call);
    });
  },
);

Cypress.Commands.add('query', (query: string, connectionOptions?: DbConnectionOptions) => {
  const startTime = Date.now();

  return cy.task<DbTaskConfig>('db:getConfig').then((defaultConfig) => {
    const host = connectionOptions?.host || defaultConfig?.host || 'localhost';
    const port = connectionOptions?.port || defaultConfig?.port || 5432;
    const database = connectionOptions?.database || defaultConfig?.database || 'test_db';
    const user = connectionOptions?.user || defaultConfig?.user || 'postgres';
    const password = connectionOptions?.password || defaultConfig?.password || '';

    return cy.task<DbTaskResult>('db:query', { query, host, port, database, user, password }).then((result) => {
      const dbResponse: DbQueryResponse = {
        rows: result.rows || [],
        rowCount: result.rowCount || 0,
        duration: Date.now() - startTime,
        query,
      };

      const dbCall: DbQuery = {
        id: crypto.randomUUID(),
        connectionId: `${host}:${port}/${database}`,
        query,
        result: result.rows || [],
        duration: Date.now() - startTime,
        timestamp: Date.now(),
      };

      addDbQuery(dbCall);
      getTestStore().dbQueries.push(dbCall);
      showDbQueryUi(dbCall);
      return cy.wrap(dbResponse);
    });
  });
});

// ============================================
// Auto-reconnect: Cypress destroys the AUT DOM during snapshot replay.
// Watch for container removal and re-create on next beforeEach.
// ============================================

beforeEach(() => {
  cy.document({ log: false }).then((doc) => {
    if (!doc.getElementById('cypress-api-plugin-container')) {
      getOrCreateContainer(doc);
    }
  });
});
