/**
 * Tests for src/node/tasks.ts — setupDatabaseTasks()
 *
 * Uses mocked pg.Pool to avoid real database connections.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock pg.Pool before any imports.
// ---------------------------------------------------------------------------

/**
 * Shared references set up inside the vi.mock factory so they are tracked
 * spies. Tests access them via `pgMock` which is populated after import.
 */
let mockPoolQuery: ReturnType<typeof vi.fn>;
let mockPoolCtor: ReturnType<typeof vi.fn>;

vi.mock('pg', () => {
  mockPoolQuery = vi.fn();
  mockPoolCtor = vi.fn(function MockPool(_opts?: Record<string, unknown>) {
    return { query: mockPoolQuery } as never;
  });
  return {
    default: { Pool: mockPoolCtor as unknown as new (...args: unknown[]) => { query: typeof mockPoolQuery } },
    Pool: mockPoolCtor as unknown as new (...args: unknown[]) => { query: typeof mockPoolQuery },
  };
});

let setupDatabaseTasks: (on: Record<string, unknown>, options?: Record<string, unknown>) => void;

/** Helper to extract task handlers from the on spy */
function getTasks(on: ReturnType<typeof vi.fn>): Record<string, unknown> {
  return (on.mock.calls.find(([e]) => e === 'task')?.[1] ?? {}) as Record<string, unknown>;
}

describe('setupDatabaseTasks', () => {
  beforeAll(async () => {
    const mod = await import('./tasks');
    setupDatabaseTasks = mod.setupDatabaseTasks as unknown as typeof setupDatabaseTasks;
  });

  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // -----------------------------------------------------------------------
  // Task registration
  // -----------------------------------------------------------------------

  it('registers db:getConfig and db:query tasks with default prefix', () => {
    const on = vi.fn();
    setupDatabaseTasks(on as unknown as Record<string, unknown>);

    expect(on).toHaveBeenCalledWith('task', expect.any(Object));
    const tasks = getTasks(on);
    expect(tasks).toHaveProperty('db:getConfig');
    expect(tasks).toHaveProperty('db:query');
  });

  it('registers tasks with custom prefix when defaultPrefix is provided', () => {
    const on = vi.fn();
    setupDatabaseTasks(on as unknown as Record<string, unknown>, { defaultPrefix: 'myapp_' });

    const tasks = getTasks(on);
    expect(tasks).toHaveProperty('myapp_db:getConfig');
    expect(tasks).toHaveProperty('myapp_db:query');
    expect(tasks).not.toHaveProperty('db:getConfig');
  });

  // -----------------------------------------------------------------------
  // db:getConfig — env parsing, CYPRESS_DB_* > DB_*
  // -----------------------------------------------------------------------

  it('db:getConfig reads CYPRESS_DB_* env vars', () => {
    vi.stubEnv('CYPRESS_DB_HOST', 'cypress-db.example.com');
    vi.stubEnv('CYPRESS_DB_PORT', '7777');
    vi.stubEnv('CYPRESS_DB_NAME', 'cypress_test');
    vi.stubEnv('CYPRESS_DB_USER', 'cypress_user');
    vi.stubEnv('CYPRESS_DB_PASSWORD', 'cypress_secret');

    const on = vi.fn();
    setupDatabaseTasks(on as unknown as Record<string, unknown>);
    const config = (getTasks(on)['db:getConfig'] as () => Record<string, unknown>)();

    expect(config.host).toBe('cypress-db.example.com');
    expect(config.port).toBe(7777);
    expect(config.database).toBe('cypress_test');
    expect(config.user).toBe('cypress_user');
    expect(config.password).toBe('cypress_secret');
  });

  it('db:getConfig falls back to DB_* when CYPRESS_DB_* is not set', () => {
    vi.stubEnv('DB_HOST', 'db.example.com');
    vi.stubEnv('DB_PORT', '5432');
    vi.stubEnv('DB_NAME', 'test_db');
    vi.stubEnv('DB_USER', 'db_user');
    vi.stubEnv('DB_PASSWORD', 'db_secret');

    const on = vi.fn();
    setupDatabaseTasks(on as unknown as Record<string, unknown>);
    const config = (getTasks(on)['db:getConfig'] as () => Record<string, unknown>)();

    expect(config.host).toBe('db.example.com');
    expect(config.port).toBe(5432);
    expect(config.database).toBe('test_db');
    expect(config.user).toBe('db_user');
    expect(config.password).toBe('db_secret');
  });

  it('db:getConfig prefers CYPRESS_DB_* over DB_* when both are set', () => {
    vi.stubEnv('CYPRESS_DB_HOST', 'preferred.example.com');
    vi.stubEnv('DB_HOST', 'fallback.example.com');

    const on = vi.fn();
    setupDatabaseTasks(on as unknown as Record<string, unknown>);
    const config = (getTasks(on)['db:getConfig'] as () => Record<string, unknown>)();

    expect(config.host).toBe('preferred.example.com');
  });

  it('db:getConfig falls back to built-in defaults when no env vars are set', () => {
    const on = vi.fn();
    setupDatabaseTasks(on as unknown as Record<string, unknown>);
    const config = (getTasks(on)['db:getConfig'] as () => Record<string, unknown>)();

    expect(config.host).toBe('localhost');
    expect(config.port).toBe(5432);
    expect(config.database).toBe('test_db');
    expect(config.user).toBe('postgres');
    expect(config.password).toBe('');
  });

  // -----------------------------------------------------------------------
  // Persistent Pool reuse
  // -----------------------------------------------------------------------

  it('creates a pg.Pool with max: 1', async () => {
    const on = vi.fn();
    setupDatabaseTasks(on as unknown as Record<string, unknown>);

    mockPoolQuery.mockResolvedValue({ rows: [], rowCount: 0 });
    const queryHandler = getTasks(on)['db:query'] as (args: Record<string, unknown>) => Promise<unknown>;
    await queryHandler({
      query: 'SELECT 1',
      host: 'localhost',
      port: 5432,
      database: 'test',
      user: 'postgres',
      password: '',
    });

    expect(mockPoolCtor).toHaveBeenCalledWith({ max: 1 });
  });

  it('reuses the same pool across multiple task handler invocations', async () => {
    const on = vi.fn();
    setupDatabaseTasks(on as unknown as Record<string, unknown>);

    mockPoolQuery.mockResolvedValue({ rows: [{ col: 1 }], rowCount: 1 });

    const queryHandler = getTasks(on)['db:query'] as (args: Record<string, unknown>) => Promise<unknown>;
    await queryHandler({
      query: 'SELECT 1',
      host: 'localhost',
      port: 5432,
      database: 'test',
      user: 'postgres',
      password: '',
    });
    await queryHandler({
      query: 'SELECT 2',
      host: 'localhost',
      port: 5432,
      database: 'test',
      user: 'postgres',
      password: '',
    });

    expect(mockPoolCtor).toHaveBeenCalledTimes(1);
  });

  // -----------------------------------------------------------------------
  // db:query — delegates to pool.query
  // -----------------------------------------------------------------------

  it('db:query calls pool.query with the given SQL', async () => {
    const on = vi.fn();
    setupDatabaseTasks(on as unknown as Record<string, unknown>);

    mockPoolQuery.mockResolvedValue({ rows: [{ result: 1 }], rowCount: 1 });

    const result = await (getTasks(on)['db:query'] as (args: Record<string, unknown>) => Promise<unknown>)({
      query: 'SELECT 1 AS result',
      host: 'localhost',
      port: 5432,
      database: 'test',
      user: 'postgres',
      password: '',
    });

    expect(mockPoolQuery).toHaveBeenCalledWith('SELECT 1 AS result');
    expect(result).toEqual({ rows: [{ result: 1 }], rowCount: 1 });
  });

  // -----------------------------------------------------------------------
  // Options with defaults
  // -----------------------------------------------------------------------

  it('accepts custom envPrefix option', () => {
    vi.stubEnv('MYAPP_DB_HOST', 'custom-prefix.example.com');

    const on = vi.fn();
    setupDatabaseTasks(on as unknown as Record<string, unknown>, { envPrefix: 'MYAPP_DB_' });
    const config = (getTasks(on)['db:getConfig'] as () => Record<string, unknown>)();

    expect(config.host).toBe('custom-prefix.example.com');
  });

  it('applies fallback defaults when provided via options.defaults', () => {
    const on = vi.fn();
    setupDatabaseTasks(
      on as unknown as Record<string, unknown>,
      {
        defaults: { host: 'default-host', port: 9999 },
      } as Record<string, unknown>,
    );
    const config = (getTasks(on)['db:getConfig'] as () => Record<string, unknown>)();

    expect(config.host).toBe('default-host');
    expect(config.port).toBe(9999);
    expect(config.database).toBe('test_db');
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  it('handles missing port env var by using default', () => {
    vi.stubEnv('CYPRESS_DB_HOST', 'srv.example.com');
    // Port intentionally not set

    const on = vi.fn();
    setupDatabaseTasks(on as unknown as Record<string, unknown>);
    const config = (getTasks(on)['db:getConfig'] as () => Record<string, unknown>)();

    expect(config.host).toBe('srv.example.com');
    expect(config.port).toBe(5432);
  });
});
