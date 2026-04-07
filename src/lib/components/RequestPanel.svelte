<script lang="ts">
  import type { ApiRequest } from '$lib/types';
  import CodeBlock from './CodeBlock.svelte';
  import Icon from './Icon.svelte';
  import TitlePanel from './TitlePanel.svelte';

  interface Props {
    request: ApiRequest | null;
    selectedTab?: string;
    onTabChange?: (tab: string) => void;
  }

  let { request = null, selectedTab: controlledTab, onTabChange }: Props = $props();

  let internalTab = $state<string>('body');
  let selectedTab = $derived(controlledTab ?? internalTab);
  let method = $derived(request?.method || 'GET');
  let url = $derived(request?.url || '');

  function handleTabChange(tab: string) {
    if (controlledTab === undefined) internalTab = tab;
    onTabChange?.(tab);
  }

  const tabs = [
    { id: 'body', label: 'Body' },
    { id: 'query', label: 'Query' },
    { id: 'headers', label: 'Headers' },
    { id: 'auth', label: 'Auth' },
    { id: 'curl', label: 'cURL' },
  ] as const;

  let curlCommand = $derived.by(() => {
    if (!request || selectedTab !== 'curl') return '';
    const headersPart = request.headers
      ? Object.entries(request.headers)
          .map(([k, v]) => `-H "${k}: ${v}"`)
          .join(' \\\n     ')
      : '';
    const bodyPart = request.body ? ` \\\n     -d '${JSON.stringify(request.body)}'` : '';
    return `curl -X ${method} "${url}"${headersPart ? ` \\\n     ${headersPart}` : ''}${bodyPart}`;
  });
</script>

<div class="panel">
  <TitlePanel {method} {url} />

  {#if request}
    <div class="tabs-bar">
      {#each tabs as tab}
        <button class="tab-btn" class:active={selectedTab === tab.id} onclick={() => handleTabChange(tab.id)}>
          {tab.label}
        </button>
      {/each}
    </div>

    <div class="content-area">
      {#if selectedTab === 'body'}
        {#if request.body && Object.keys(request.body).length > 0}
          <CodeBlock data={request.body} />
        {:else}
          <div class="empty-tab"><span class="empty-text">Sin body</span></div>
        {/if}
      {:else if selectedTab === 'query'}
        {#if request.qs && Object.keys(request.qs).length > 0}
          <CodeBlock data={request.qs} />
        {:else}
          <div class="empty-tab"><span class="empty-text">Sin query params</span></div>
        {/if}
      {:else if selectedTab === 'headers'}
        {#if request.headers && Object.keys(request.headers).length > 0}
          <CodeBlock data={request.headers} />
        {:else}
          <div class="empty-tab"><span class="empty-text">Sin headers</span></div>
        {/if}
      {:else if selectedTab === 'auth'}
        {#if request.auth && Object.keys(request.auth).length > 0}
          <CodeBlock data={request.auth} />
        {:else}
          <div class="empty-tab"><span class="empty-text">Sin auth</span></div>
        {/if}
      {:else if selectedTab === 'curl'}
        <CodeBlock format="bash" data={curlCommand} />
      {/if}
    </div>
  {:else}
    <div class="empty-state">
      <span class="empty-icon"><Icon name="zap" size={36} color="#64748b" /></span>
      <span class="empty-text">Selecciona una solicitud</span>
    </div>
  {/if}
</div>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    flex: 1; /* ← clave */
    min-height: 0; /* ← clave */
    background: #080c14;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    overflow: hidden;
    font-family: 'SF Mono', 'Fira Code', 'JetBrains Mono', Consolas, Monaco, monospace;
  }

  .tabs-bar {
    display: flex;
    gap: 2px;
    height: 40px;
    padding: 0 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    background: rgba(0, 0, 0, 0.15);
    flex-shrink: 0;
  }

  .tab-btn {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 50px;
    height: 100%;
    padding: 0 10px;
    border-radius: 5px;
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: rgba(100, 116, 139, 0.8);
    background: transparent;
    border: none;
    cursor: pointer;
    transition: all 0.18s;
    font-family: inherit;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .tab-btn:hover:not(.active) {
    color: #94a3b8;
    background: rgba(255, 255, 255, 0.04);
  }

  .tab-btn.active {
    color: #00d4ff;
    background: rgba(0, 212, 255, 0.08);
  }

  .tab-btn.active::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 60%;
    height: 2px;
    background: #00d4ff;
    border-radius: 2px 2px 0 0;
    box-shadow: 0 0 8px #00d4ff;
  }

  .content-area {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    padding: 14px;
    display: flex;
    flex-direction: column;
  }

  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    color: rgba(100, 116, 139, 0.5);
  }

  .empty-icon {
    display: inline-flex;
    align-items: center;
    opacity: 0.25;
  }

  .empty-icon :global(svg) {
    width: 36px;
    height: 36px;
    filter: grayscale(1);
  }

  .empty-text {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .empty-tab {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(100, 116, 139, 0.5);
  }
</style>
