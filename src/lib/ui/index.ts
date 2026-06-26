import { mount } from 'svelte';
import App from '../components/App.svelte';
import type { ApiRequest, ApiResponse, CypressApiPluginConfig, DbQueryDisplayData } from '../types';

export function mountApiUI(
  container: HTMLElement,
  request: ApiRequest,
  response: ApiResponse,
  config: CypressApiPluginConfig,
) {
  return mount(App, {
    target: container,
    props: {
      request,
      response,
      config,
      mode: 'api',
    },
  });
}

export function mountDbQueryUI(container: HTMLElement, dbQuery: DbQueryDisplayData, config: CypressApiPluginConfig) {
  return mount(App, {
    target: container,
    props: {
      dbQuery,
      config,
      mode: 'db',
    },
  });
}
