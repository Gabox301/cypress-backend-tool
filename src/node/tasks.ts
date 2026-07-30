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
  const readEnv = (key: string): string => {
    const fromDefaults = options?.defaults?.[key.toLowerCase() as keyof DbTaskConfig];
    return (
      process.env[envPrefix + key] ??
      process.env['DB_' + key] ??
      (fromDefaults != null ? String(fromDefaults) : undefined) ??
      { host: 'localhost', port: '5432', name: 'test_db', user: 'postgres', password: '' }[key.toLowerCase()] ??
      ''
    );
  };
  const pool = new pg.Pool({
    max: 1,
    host: readEnv('HOST'),
    port: parseInt(readEnv('PORT'), 10),
    database: readEnv('NAME'),
    user: readEnv('USER'),
    password: readEnv('PASSWORD'),
  });

  on('task', {
    [`${prefix}db:getConfig`]: (): DbTaskConfig => ({
      host: readEnv('HOST'),
      port: parseInt(readEnv('PORT'), 10),
      database: readEnv('NAME'),
      user: readEnv('USER'),
      password: readEnv('PASSWORD'),
    }),

    [`${prefix}db:query`]: async (args: {
      query: string;
      host: string;
      port: number;
      database: string;
      user: string;
      password: string;
    }): Promise<DbTaskResult> => {
      const poolOpts = pool.options;
      if (
        args.host !== poolOpts.host ||
        args.port !== poolOpts.port ||
        args.database !== poolOpts.database ||
        args.user !== poolOpts.user ||
        args.password !== poolOpts.password
      ) {
        const client = new pg.Client({
          host: args.host,
          port: args.port,
          database: args.database,
          user: args.user,
          password: args.password,
        });
        await client.connect();
        const result = await client.query(args.query);
        await client.end();
        return { rows: result.rows, rowCount: result.rowCount ?? 0 };
      }
      const result = await pool.query(args.query);
      return { rows: result.rows, rowCount: result.rowCount ?? 0 };
    },
  });
}
