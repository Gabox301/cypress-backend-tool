<script lang="ts">
  // ────────────────────────────────────────────────────────────────────────
  // App is the container shell.
  //
  // Individual entries (ApiCall / DbQuery) are mounted into #cabt-scroll-area
  // by mountEntry() as persistent sibling divs. This design means:
  //
  //   • Each entry is an independent Svelte mount — Cypress.log().snapshot()
  //     targets a stable DOM node that never gets replaced.
  //   • Clearing the stores (clearApiCalls / clearDbQueries in beforeEach)
  //     does NOT affect the rendered UI — entries survive until the page
  //     reloads or EntryRegistry.clear() is called.
  //   • No {#each} from stores = no duplicate rendering.
  // ────────────────────────────────────────────────────────────────────────
</script>

<div class="scroll-area" id="cabt-scroll-area">
  <!-- Entries are inserted here by mountEntry() -->
  <div class="bottom-anchor"></div>
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
  }
  :global(#cypress-api-plugin-container) {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: #1a1a2e;
    border-top: 3px solid #e94560;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  /* snapshotOnly: hide the live overlay without removing any entry from the
     DOM. Every past call stays inspectable through Cypress's snapshot feature. */
  :global(#cypress-api-plugin-container.cypress-plugin-collapsed) {
    display: none;
  }
  .scroll-area {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }
  .bottom-anchor {
    height: 1px;
  }
</style>
