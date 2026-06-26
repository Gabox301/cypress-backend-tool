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
