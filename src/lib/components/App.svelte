<script lang="ts">
  import { apiCalls, dbQueries, pluginConfig } from '$lib/stores.svelte';
  import type { ApiCall, DbQuery } from '$lib/types';
  import QueryPanel from './QueryPanel.svelte';
  import RequestPanel from './RequestPanel.svelte';
  import ResponsePanel from './ResponsePanel.svelte';

  // ────────────────────────────────────────────────────────────────────────
  // WHY THIS CHANGED
  //
  // App used to receive a single {request, response} or {dbQuery} via props
  // and get *remounted from scratch* into a container that was cleared
  // (`innerHTML = ''`) before every single call. That meant the DOM node a
  // past Cypress.log().snapshot() pointed at got wiped out the moment the
  // next cy.http()/cy.query() ran — so going back to an earlier it()'s (or
  // an earlier call's) log entry to inspect its snapshot shows whatever the
  // *latest* call left behind, or an empty overlay if you catch it between
  // the clear and the next render. That's the "blank window" symptom.
  //
  // The fix mirrors cypress-plugin-api (the Vue plugin this was ported
  // from): mount ONCE, then render every call ever made as its own
  // permanent entry with a stable id. Nothing is ever cleared or replaced —
  // new calls are appended, old ones stay exactly as they were rendered.
  // That's what lets Cypress reliably snapshot any individual command.
  // ────────────────────────────────────────────────────────────────────────

  type Entry =
    | { kind: 'api'; id: string; timestamp: number; call: ApiCall }
    | { kind: 'db'; id: string; timestamp: number; query: DbQuery };

  let entries = $derived.by(() => {
    const apiEntries: Entry[] = apiCalls.map((call) => ({
      kind: 'api' as const,
      id: call.id,
      timestamp: call.timestamp,
      call,
    }));
    const dbEntries: Entry[] = dbQueries.map((query) => ({
      kind: 'db' as const,
      id: query.id,
      timestamp: query.timestamp,
      query,
    }));
    return [...apiEntries, ...dbEntries].sort((a, b) => a.timestamp - b.timestamp);
  });
</script>

<div class="scroll-area">
  {#each entries as entry (entry.id)}
    <section id={`cabt-entry-${entry.id}`} class="entry">
      {#if entry.kind === 'db'}
        <QueryPanel
          query={entry.query.query}
          rowCount={Array.isArray(entry.query.result) ? entry.query.result.length : 0}
          duration={entry.query.duration}
          rows={(entry.query.result as unknown[]) ?? []}
          error={entry.query.error}
        />
      {:else}
        <div class="pair">
          <RequestPanel
            request={entry.call.request}
            hideCredentials={pluginConfig.hideCredentials}
            hideCredentialsOptions={pluginConfig.hideCredentialsOptions}
          />
          <ResponsePanel response={entry.call.response} snapshotOnly={pluginConfig.snapshotOnly} />
        </div>
      {/if}
    </section>
  {/each}
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
  /* snapshotOnly: hide the live overlay so the page under test stays usable,
     WITHOUT removing any entry from the DOM. Every past call stays fully
     inspectable through Cypress's command-log snapshot/time-travel feature
     — only its live visibility is toggled, never its content. */
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
  .entry {
    flex-shrink: 0;
    padding: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
  .pair {
    display: flex;
    flex-direction: row;
    gap: 12px;
    height: min(70vh, 560px);
  }
  .pair > :global(*) {
    flex: 1;
    min-height: 0;
  }
  .bottom-anchor {
    height: 1px;
  }
</style>
