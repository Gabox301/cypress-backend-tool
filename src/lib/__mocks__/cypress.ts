import type { CypressApiPluginConfig } from '$lib/types';
import { vi } from 'vitest';

/**
 * Creates a mock Cypress global object for unit tests.
 *
 * The mock provides `expose()` that returns values from an internal store,
 * `Commands.add()` as a spy, and a `_set()` helper for tests to mutate
 * the mock store between test cases.
 */
export function createMockCypress(exposeValues: Partial<CypressApiPluginConfig> = {}) {
  const store = new Map<string, unknown>();
  // Seed the store with initial values
  for (const [key, value] of Object.entries(exposeValues)) {
    store.set(key, value);
  }
  return {
    expose: vi.fn((key: string) => store.get(key)),
    Commands: { add: vi.fn() },
    _set: (key: string, value: unknown) => store.set(key, value),
  };
}
