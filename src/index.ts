/// <reference types="cypress" />

// ============================================
// Cypress Backend Tool — Unified Entry
// Auto-init on side-effect import.
// Replaces cypress/support/plugin/index.ts
// ============================================

import { getPluginConfig } from '$lib/config';
import { addApiCall, addDbQuery } from '$lib/stores.svelte';
import type { ApiCall, ApiResponse, CypressApiPluginConfig, DbQuery, DbQueryDisplayData } from '$lib/types';
import { mountApiUI, mountDbQueryUI } from '$lib/ui';

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
  return getPluginConfig((key: string) => Cypress.expose(key));
}

// ============================================
// UI container — NEW container every call (Vue plugin pattern)
// Svelte component instances are NOT reused — each call gets a fresh mount.
// State survives in window.__cypress_backend_tool__[testId]
// ============================================

// Per-test storage — scoped by Cypress test ID so data survives between it() blocks
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

function createFreshContainer(): HTMLElement {
  const win = cy.state('window') as Window;
  const doc = win.document;

  let container = doc.getElementById('cypress-api-plugin-container') as HTMLElement | null;
  if (container) {
    container.innerHTML = '';
    return container;
  }

  container = doc.createElement('div');
  container.id = 'cypress-api-plugin-container';
  doc.body.appendChild(container);
  return container;
}

// Exported for unit testing
export { createFreshContainer };

function showApiUi(index: number): void {
  const store = getTestStore();
  const call = store.apiCalls[index];
  if (!call?.response) return;

  const config = readPluginConfig();

  const log = Cypress.log({
    name: call.request.method,
    autoEnd: false,
    message: `${call.request.method} ${call.request.url}`,
    consoleProps: () => ({ request: call.request, response: call.response }),
  }).snapshot('request');

  const container = createFreshContainer();

  if (config.snapshotOnly) {
    container.classList.add('cypress-plugin-collapsed');
  }

  mountApiUI(container, call.request, call.response, config);

  // Svelte 5 mount() is synchronous — DOM is ready
  const $el = Cypress.$('#cypress-api-plugin-container');
  log.set({ $el }).snapshot('response').end();

  logDebug('API UI mounted (index:', index, ')');
}

function showDbQueryUi(index: number): void {
  const store = getTestStore();
  const query = store.dbQueries[index];
  if (!query) return;

  const config = readPluginConfig();
  const container = createFreshContainer();

  if (config.snapshotOnly) {
    container.classList.add('cypress-plugin-collapsed');
  }

  const dbData: DbQueryDisplayData = {
    query: query.query,
    rows: (query.result as unknown[]) ?? [],
    rowCount: Array.isArray(query.result) ? query.result.length : 0,
    duration: query.duration,
    error: query.error,
  };

  mountDbQueryUI(container, dbData, config);

  logDebug('DB Query UI mounted (index:', index, ')');
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
      const store = getTestStore();
      store.apiCalls.push(call);
      showApiUi(store.apiCalls.length - 1);
      return response;
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
      const store = getTestStore();
      store.dbQueries.push(dbCall);
      showDbQueryUi(store.dbQueries.length - 1);
      return cy.wrap(dbResponse);
    });
  });
});
