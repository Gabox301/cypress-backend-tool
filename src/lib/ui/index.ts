import { mount, unmount } from 'svelte';
import App from '../components/App.svelte';

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
