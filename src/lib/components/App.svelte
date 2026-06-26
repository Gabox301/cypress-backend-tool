<script lang="ts">
  import { pluginConfig } from '$lib/stores.svelte';
  import type { ApiRequest, ApiResponse, CypressApiPluginConfig, DbQueryDisplayData } from '$lib/types';
  import QueryPanel from './QueryPanel.svelte';
  import RequestPanel from './RequestPanel.svelte';
  import ResponsePanel from './ResponsePanel.svelte';

  interface Props {
    request?: ApiRequest | null;
    response?: ApiResponse | null;
    dbQuery?: DbQueryDisplayData | null;
    config?: CypressApiPluginConfig | null;
    mode?: 'api' | 'db';
  }

  let { request = null, response = null, dbQuery = null, config = null, mode = 'api' }: Props = $props();

  // Assign config to the reactive pluginConfig rune on mount (watch for changes)
  $effect(() => {
    if (config) {
      Object.assign(pluginConfig, config);
    }
  });

  let isDbMode = $derived(mode === 'db' || dbQuery !== null);
</script>

{#if isDbMode && dbQuery}
  <QueryPanel
    query={dbQuery.query}
    rowCount={dbQuery.rowCount}
    duration={dbQuery.duration}
    rows={dbQuery.rows}
    error={dbQuery.error}
  />
{:else}
  <RequestPanel
    {request}
    hideCredentials={pluginConfig.hideCredentials}
    hideCredentialsOptions={pluginConfig.hideCredentialsOptions}
  />
  <ResponsePanel {response} snapshotOnly={pluginConfig.snapshotOnly} />
{/if}

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
    flex-direction: row;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  :global(#cypress-api-plugin-container > *) {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding: 12px;
    box-sizing: border-box;
  }
</style>
