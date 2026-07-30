/// <reference types="cypress" />

import pg from 'pg';

// ============================================
// Types
// ============================================

export interface DbTaskConfig {
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
}

export interface DbTaskResult {
  rows: unknown[];
  rowCount: number;
}

export interface DbTaskOptions {
  /** Prefix for registered task names (default: '') */
  defaultPrefix?: string;
  /** Environment variable prefix (default: 'CYPRESS_DB_') */
  envPrefix?: string;
  /** Fallback values when env vars are not set */
  defaults?: Partial<DbTaskConfig>;
}

// ============================================
// setupDatabaseTasks
// ============================================

/**
 * Registers `{prefix}db:getConfig` and `{prefix}db:query` Cypress tasks
 * using a persistent `pg.Pool(max: 1)`.
 *
 * Env var resolution (highest priority first):
 *   1. `{envPrefix}{KEY}` (default: `CYPRESS_DB_*`)
 *   2. `DB_{KEY}`
 *   3. `options.defaults`
 *   4. Built-in fallbacks (localhost, 5432, test_db, postgres, '')
 *
 * @param on - Cypress PluginEvents from setupNodeEvents
 * @param options - Optional configuration
 *
 * @example
 * ```ts
 * // cypress.config.ts
 * import { setupDatabaseTasks } from 'cypress-backend-tool/tasks';
 *
 * export default defineConfig({
 *   e2e: {
 *     setupNodeEvents(on) {
 *       setupDatabaseTasks(on);
 *     },
 *   },
 * });
 * ```
 */
export function setupDatabaseTasks(on: Cypress.PluginEvents, options?: DbTaskOptions): void {
  const prefix = options?.defaultPrefix ?? '';
  const envPrefix = options?.envPrefix ?? 'CYPRESS_DB_';

  const readEnv = (key: string): string | undefined => {
    const fromDefaults = options?.defaults?.[key.toLowerCase() as keyof DbTaskConfig];
    return (
      process.env[envPrefix + key] ??
      process.env['DB_' + key] ??
      (fromDefaults != null ? String(fromDefaults) : undefined)
    );
  };

  const pool = new pg.Pool({ max: 1 });

  on('task', {
    [`${prefix}db:getConfig`]: (): DbTaskConfig => ({
      host: readEnv('HOST') || 'localhost',
      port: parseInt(readEnv('PORT') || '5432', 10),
      database: readEnv('NAME') || 'test_db',
      user: readEnv('USER') || 'postgres',
      password: readEnv('PASSWORD') || '',
    }),

    [`${prefix}db:query`]: async (args: {
      query: string;
      host: string;
      port: number;
      database: string;
      user: string;
      password: string;
    }): Promise<DbTaskResult> => {
      const result = await pool.query(args.query);
      return { rows: result.rows, rowCount: result.rowCount ?? 0 };
    },
  });
}
