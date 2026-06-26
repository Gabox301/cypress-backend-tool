/// <reference types="cypress" />

// ============================================
// Cypress Backend Tool — Unified Entry
// Auto-init on side-effect import.
// Replaces cypress/support/plugin/index.ts
// ============================================

import { getPluginConfig } from '$lib/config';
import type { ApiRequest, ApiResponse, CypressApiPluginConfig, DbQueryDisplayData } from '$lib/types';
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
// UI container — create fresh each mount
// ============================================

function createUiContainer(): HTMLElement {
  const win = cy.state('window') as Window;
  const doc = win.document;

  // Remove previous
  const existing = doc.getElementById('cypress-api-plugin-container');
  if (existing) existing.remove();

  // Create new
  const container = doc.createElement('div');
  container.id = 'cypress-api-plugin-container';
  doc.body.appendChild(container);

  return container;
}

// ============================================
// UI display helpers — in-process Svelte mounts
// ============================================

function showApiUi(request: ApiRequestOptions, response: ApiResponse): void {
  const config = readPluginConfig();
  const container = createUiContainer();

  if (config.snapshotOnly) {
    container.classList.add('cypress-plugin-collapsed');
  }

  const req: ApiRequest = {
    url: request.url,
    method: request.method,
    headers: request.headers,
    body: request.body,
    qs: request.qs,
    auth: request.auth,
  };

  mountApiUI(container, req, response, config);
  logDebug('API UI mounted');
}

function showDbQueryUi(query: string, result: DbQueryResponse): void {
  const config = readPluginConfig();
  const container = createUiContainer();

  if (config.snapshotOnly) {
    container.classList.add('cypress-plugin-collapsed');
  }

  const dbData: DbQueryDisplayData = {
    query,
    rows: result.rows,
    rowCount: result.rowCount,
    duration: result.duration,
  };

  mountDbQueryUI(container, dbData, config);
  logDebug('DB Query UI mounted');
}

// ============================================
// Command registration — auto-init on import
// ============================================

Cypress.Commands.add(
  'http',
  // Cypress Command.add typing is limited for overloaded commands — the callback
  // signature uses (...args: any[]) which forces an unsafe cast at the call site.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (urlOrOptions: any, maybeOptions?: ApiRequestOptions) => {
    const options: ApiRequestOptions =
      typeof urlOrOptions === 'string'
        ? { url: urlOrOptions, method: maybeOptions?.method || 'GET', ...maybeOptions }
        : urlOrOptions;
    const startTime = Date.now();

    // cy.request() RequestOptions type is incomplete (body: unknown not assignable).
    // Cast through unknown — the actual values flow through to cy.request unchanged.
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

      showApiUi(options, response);
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
      showDbQueryUi(query, dbResponse);
      return cy.wrap(dbResponse);
    });
  });
});
