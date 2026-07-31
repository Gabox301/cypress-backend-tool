import { pluginConfig } from '$lib/stores.svelte';
import type { ApiCall, DbQuery } from '$lib/types';
import { mount, unmount } from 'svelte';
import App from '../components/App.svelte';
import EntryPanel from '../components/EntryPanel.svelte';
import { EntryRegistry } from './entry-registry';

// ──────────────────────────────────────────────────────────────────────────
// The plugin UI is mounted ONCE per live AUT document and stays mounted.
// App.svelte reads the shared apiCalls/dbQueries stores directly and
// renders every call ever made as its own permanent entry — see
// components/App.svelte for the full rationale.
//
// Previously, mountApiUI()/mountDbQueryUI() called `mount()` fresh into a
// container that got cleared on every call. That destroyed the DOM node any
// earlier Cypress.log().snapshot() was pointing at, which is what broke
// snapshot viewing across multiple it() blocks (and across multiple calls
// within the same it()).
// ──────────────────────────────────────────────────────────────────────────

let mountedInstance: object | null = null;
let mountedDocument: Document | null = null;
let _observer: MutationObserver | null = null;

function watchContainer(container: HTMLElement) {
  _observer?.disconnect();
  _observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.removedNodes) {
        if (node === container) {
          mountedInstance = null;
          mountedDocument = null;
          _observer?.disconnect();
          _observer = null;
          return;
        }
      }
    }
  });
  _observer.observe(container.parentElement!, { childList: true });
}

/**
 * Mounts the plugin App into `container` if it isn't already mounted for
 * this document. Safe to call before every cy.http()/cy.query() — it's a
 * no-op after the first call, until the document itself changes (e.g. a
 * real page navigation, or Cypress resetting the AUT before a new test).
 */
export function ensurePluginMounted(container: HTMLElement, doc: Document): void {
  // Container removed from DOM (Cypress snapshot replay) — reset
  if (!container.isConnected || mountedDocument !== doc) {
    mountedInstance = null;
    mountedDocument = null;
  }

  if (mountedDocument !== doc) {
    mountedDocument = doc;
  }

  if (mountedInstance) return;

  mountedInstance = mount(App, { target: container });
  watchContainer(container);
}

/** Explicit teardown, exposed for completeness / tests. Not required for
 * normal operation — a page reload already discards everything. */
export function teardownPluginUI(): void {
  if (mountedInstance) {
    unmount(mountedInstance);
    mountedInstance = null;
    mountedDocument = null;
  }
}

/**
 * Mount a standalone EntryPanel into a persistent div#cabt-entry-{id} inside
 * the plugin container. The entry is registered in EntryRegistry and its DOM
 * survives store clearing between Cypress it() blocks.
 *
 * Config values (hideCredentials, snapshotOnly, etc.) are captured at mount
 * time as component props — they are NOT reactive. This matches the design
 * decision: "Config captured at mount time, not reactive."
 *
 * @returns The created div#cabt-entry-{id} element.
 */
export function mountEntry(data: ApiCall | DbQuery): HTMLElement {
  const id = data.id;
  const container = document.getElementById('cypress-api-plugin-container');
  if (!container) {
    throw new Error('mountEntry: plugin container not found — call getOrCreateContainer first');
  }

  // Create the persistent element — this is what Cypress.log().snapshot()
  // targets. It is a sibling of App.svelte's root, NOT inside its {#each}.
  const div = document.createElement('div');
  div.id = `cabt-entry-${id}`;
  container.appendChild(div);

  // Mount the entry component with props frozen at call time.
  const component = mount(EntryPanel, {
    target: div,
    props: {
      data,
      hideCredentials: pluginConfig.hideCredentials,
      hideCredentialsOptions: pluginConfig.hideCredentialsOptions,
      snapshotOnly: pluginConfig.snapshotOnly,
    },
  });

  // Track the entry so it can be unmounted later if needed.
  EntryRegistry.register(id, component, div);

  return div;
}
