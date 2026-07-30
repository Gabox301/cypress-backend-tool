import { getPluginConfig } from '$lib/config';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// getPluginConfig is now exported from $lib/config as a pure function.
// Tests pass a mock reader to verify config merge, defaults, and overrides.
// ---------------------------------------------------------------------------

function mockReader(values: Record<string, unknown> = {}) {
  return (key: string) => values[key];
}

describe('getPluginConfig — config resolution logic', () => {
  // -----------------------------------------------------------------------
  // Defaults — when no values are configured
  // -----------------------------------------------------------------------

  it('returns safe defaults when no values are configured', () => {
    const config = getPluginConfig(mockReader());

    expect(config.snapshotOnly).toBe(false);
    expect(config.hideCredentials).toBe(false);
    expect(config.requestMode).toBe('auto');
    expect(config.CYPRESS_PLUGIN_DEBUG).toBe(false);
    expect(config.hideCredentialsOptions).toEqual({
      headers: true,
      auth: true,
      body: true,
      query: true,
    });
  });

  // -----------------------------------------------------------------------
  // Configured values
  // -----------------------------------------------------------------------

  it('honours configured boolean values', () => {
    const config = getPluginConfig(
      mockReader({
        snapshotOnly: true,
        hideCredentials: true,
        CYPRESS_PLUGIN_DEBUG: true,
      }),
    );

    expect(config.snapshotOnly).toBe(true);
    expect(config.hideCredentials).toBe(true);
    expect(config.CYPRESS_PLUGIN_DEBUG).toBe(true);
  });

  it('honours configured requestMode', () => {
    const config = getPluginConfig(
      mockReader({
        requestMode: 'manual',
      }),
    );

    expect(config.requestMode).toBe('manual');
  });

  // -----------------------------------------------------------------------
  // Partial overrides — some keys set, others default
  // -----------------------------------------------------------------------

  it('merges partial config with defaults', () => {
    const config = getPluginConfig(
      mockReader({
        snapshotOnly: true,
        // hideCredentials not set — should default
      }),
    );

    expect(config.snapshotOnly).toBe(true);
    expect(config.hideCredentials).toBe(false); // default
    expect(config.requestMode).toBe('auto'); // default
  });

  // -----------------------------------------------------------------------
  // hideCredentialsOptions
  // -----------------------------------------------------------------------

  it('honours custom hideCredentialsOptions', () => {
    const config = getPluginConfig(
      mockReader({
        hideCredentialsOptions: {
          headers: false,
          auth: false,
          body: true,
          query: true,
        },
      }),
    );

    expect(config.hideCredentialsOptions).toEqual({
      headers: false,
      auth: false,
      body: true,
      query: true,
    });
  });

  it('defaults hideCredentialsOptions when not set', () => {
    const config = getPluginConfig(
      mockReader({
        snapshotOnly: true,
      }),
    );

    expect(config.hideCredentialsOptions).toEqual({
      headers: true,
      auth: true,
      body: true,
      query: true,
    });
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  it('treats falsy-but-defined values correctly (false ≠ undefined)', () => {
    const config = getPluginConfig(
      mockReader({
        snapshotOnly: false,
        hideCredentials: false,
        CYPRESS_PLUGIN_DEBUG: false,
      }),
    );

    // Explicit false should be preserved, not replaced by default
    expect(config.snapshotOnly).toBe(false);
    expect(config.hideCredentials).toBe(false);
    expect(config.CYPRESS_PLUGIN_DEBUG).toBe(false);
  });

  it('handles null/undefined values as defaults', () => {
    const config = getPluginConfig(
      mockReader({
        snapshotOnly: null,
        hideCredentials: undefined,
      }),
    );

    expect(config.snapshotOnly).toBe(false); // null → default
    expect(config.hideCredentials).toBe(false); // undefined → default
  });
});

// ---------------------------------------------------------------------------
// configure() / mergeConfig — override layer on top of getPluginConfig
// ---------------------------------------------------------------------------

describe('configure() — config override layer', () => {
  let _configure: (overrides: Record<string, unknown>) => void;
  let mergeConfig: (base: Record<string, unknown>, overrides: Record<string, unknown>) => Record<string, unknown>;
  let resetConfig: () => void;

  beforeAll(async () => {
    const mod = await import('$lib/config');
    _configure = (mod as unknown as Record<string, unknown>).configure as (overrides: Record<string, unknown>) => void;
    mergeConfig = (mod as unknown as Record<string, unknown>).mergeConfig as (
      base: Record<string, unknown>,
      overrides: Record<string, unknown>,
    ) => Record<string, unknown>;

    // resetConfig may not exist yet (RED phase — will add with GREEN)
    const maybeReset = (mod as unknown as Record<string, unknown>).resetConfig;
    resetConfig = (typeof maybeReset === 'function' ? maybeReset : () => {}) as () => void;
  });

  beforeEach(() => {
    // Reset config overrides before each test
    if (typeof resetConfig === 'function') {
      resetConfig();
    }
  });

  // -----------------------------------------------------------------------
  // mergeConfig pure function tests
  // -----------------------------------------------------------------------

  it('mergeConfig shallow-merges top-level scalars', () => {
    const base = {
      snapshotOnly: false,
      hideCredentials: false,
      requestMode: 'auto' as const,
      CYPRESS_PLUGIN_DEBUG: false,
    };
    const overrides = { snapshotOnly: true };
    const result = mergeConfig(base, overrides);

    expect(result.snapshotOnly).toBe(true);
    expect(result.hideCredentials).toBe(false); // unchanged
    expect(result.requestMode).toBe('auto'); // unchanged
  });

  it('mergeConfig deep-merges hideCredentialsOptions', () => {
    const base = {
      hideCredentialsOptions: { headers: true, auth: true, body: true, query: true },
    };
    const overrides = {
      hideCredentialsOptions: { headers: false },
    };
    const result = mergeConfig(base, overrides);

    const hco = result.hideCredentialsOptions as Record<string, boolean>;
    // overrides wins for provided keys, defaults preserved for others
    expect(hco.headers).toBe(false);
    expect(hco.auth).toBe(true);
    expect(hco.body).toBe(true);
    expect(hco.query).toBe(true);
  });

  // -----------------------------------------------------------------------
  // configure() integration — backward compat (no configure call)
  // -----------------------------------------------------------------------

  it('backward compat: exposes-only returns values from expose unchanged', () => {
    // In real usage, readPluginConfig() calls getPluginConfig with Cypress.expose
    // and then merges with configOverrides. When configure() is never called,
    // configOverrides is empty, so expose values pass through unchanged.
    const exposeValues = {
      snapshotOnly: true,
      hideCredentials: true,
      hideCredentialsOptions: { headers: true, auth: true, body: true, query: true },
      requestMode: 'manual' as const,
      CYPRESS_PLUGIN_DEBUG: true,
    };

    const base = { ...exposeValues };
    const result = mergeConfig(base, {});

    const hco2 = result.hideCredentialsOptions as Record<string, boolean>;
    expect(result.snapshotOnly).toBe(true);
    expect(result.hideCredentials).toBe(true);
    expect(result.requestMode).toBe('manual');
    expect(hco2.headers).toBe(true);
  });

  // -----------------------------------------------------------------------
  // configure() merge rules
  // -----------------------------------------------------------------------

  it('configure overrides expose value when both are set', () => {
    const exposeValues = { snapshotOnly: false };
    const configureValues = { snapshotOnly: true };

    const base = { ...exposeValues };
    const result = mergeConfig(base, configureValues);

    expect(result.snapshotOnly).toBe(true); // configure wins over expose
  });

  it('configure does not affect unset fields', () => {
    const exposeValues = {
      snapshotOnly: false,
      hideCredentials: false,
      requestMode: 'auto' as const,
      CYPRESS_PLUGIN_DEBUG: false,
    };
    const configureValues = { hideCredentials: true };

    const result = mergeConfig(exposeValues, configureValues);

    expect(result.hideCredentials).toBe(true);
    expect(result.snapshotOnly).toBe(false); // unchanged
    expect(result.requestMode).toBe('auto'); // unchanged
  });

  it('configure partial hideCredentialsOptions — deep merge with expose values', () => {
    const exposeValues = {
      hideCredentialsOptions: { headers: true, auth: true, body: true, query: true },
    };
    const configureValues = {
      hideCredentialsOptions: { headers: false, body: false },
    };

    const result = mergeConfig(exposeValues, configureValues);

    const hco3 = result.hideCredentialsOptions as Record<string, boolean>;
    // Configure wins for provided keys
    expect(hco3.headers).toBe(false);
    expect(hco3.body).toBe(false);
    // Expose defaults preserved for non-configured keys
    expect(hco3.auth).toBe(true);
    expect(hco3.query).toBe(true);
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------

  it('configure with empty overrides is a no-op', () => {
    const exposeValues = {
      snapshotOnly: true,
      hideCredentials: false,
      hideCredentialsOptions: { headers: true, auth: true, body: true, query: true },
      requestMode: 'auto' as const,
      CYPRESS_PLUGIN_DEBUG: false,
    };
    const result = mergeConfig(exposeValues, {});
    expect(result).toEqual(exposeValues);
  });

  it('configure handles hideCredentialsOptions not present in overrides', () => {
    const exposeValues = {
      hideCredentialsOptions: { headers: true, auth: true, body: true, query: true },
    };
    const result = mergeConfig(exposeValues, { snapshotOnly: true });
    // hideCredentialsOptions should survive intact from base
    expect(result.hideCredentialsOptions).toEqual(exposeValues.hideCredentialsOptions);
  });
});
