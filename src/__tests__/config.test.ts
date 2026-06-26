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
