import type { CypressApiPluginConfig } from '$lib/types';

/**
 * Resolves plugin configuration from a key-value reader (Cypress.expose).
 * Pure function — testable without Cypress global.
 */
export function getPluginConfig(read: (key: string) => unknown): CypressApiPluginConfig {
  return {
    snapshotOnly: (read('snapshotOnly') as boolean) ?? false,
    hideCredentials: (read('hideCredentials') as boolean) ?? false,
    hideCredentialsOptions: (read('hideCredentialsOptions') as CypressApiPluginConfig['hideCredentialsOptions']) ?? {
      headers: true,
      auth: true,
      body: true,
      query: true,
    },
    requestMode: ((read('requestMode') as string) ?? 'auto') as 'auto' | 'manual',
    CYPRESS_PLUGIN_DEBUG: (read('CYPRESS_PLUGIN_DEBUG') as boolean) ?? false,
  };
}

// ---------------------------------------------------------------------------
// configure() override layer
// ---------------------------------------------------------------------------

/**
 * Module-level config overrides. Applied on top of values from Cypress.expose().
 * Configure wins because it's an explicit programmatic choice.
 */
let configOverrides: Partial<CypressApiPluginConfig> = {};

/**
 * Deep-merges override values into the base config.
 * Top-level scalars use shallow spread; `hideCredentialsOptions` uses deep merge
 * so partial overrides don't wipe unset keys.
 */
export function mergeConfig(
  base: CypressApiPluginConfig,
  overrides: Partial<CypressApiPluginConfig>,
): CypressApiPluginConfig {
  return {
    ...base,
    ...overrides,
    hideCredentialsOptions: {
      ...base.hideCredentialsOptions,
      ...(overrides.hideCredentialsOptions ?? {}),
    },
  };
}

/**
 * Sets programmatic config overrides that take precedence over
 * Cypress.expose() values. Call in `setupNodeEvents` or `beforeEach`.
 *
 * @example
 * ```ts
 * import { configure } from 'cypress-backend-tool';
 * configure({ snapshotOnly: true });
 * ```
 */
export function configure(overrides: Partial<CypressApiPluginConfig>): void {
  configOverrides = { ...configOverrides, ...overrides };
}

/**
 * Returns the current config overrides. Used internally by readPluginConfig()
 * to merge with base values from Cypress.expose().
 * @internal
 */
export function getConfigOverrides(): Partial<CypressApiPluginConfig> {
  return configOverrides;
}

/**
 * Resets config overrides. Exported for testing only.
 * @internal
 */
export function resetConfig(): void {
  configOverrides = {};
}
