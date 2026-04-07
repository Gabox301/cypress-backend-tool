// Punto de entrada para exportar componentes UI como librería IIFE
// Esta librería se carga en el runner de Cypress

import { mount } from 'svelte';
import CodeBlock from '../components/CodeBlock.svelte';
import QueryPanel from '../components/QueryPanel.svelte';
import RequestPanel from '../components/RequestPanel.svelte';
import ResponsePanel from '../components/ResponsePanel.svelte';
import TitlePanel from '../components/TitlePanel.svelte';
import type { ApiRequest, ApiResponse, DbQueryDisplayData } from '../types';

declare global {
  interface Window {
    CypressApiDbUI?: {
      mountApiUI: typeof mountApiUI;
      mountDbQueryUI: typeof mountDbQueryUI;
      RequestPanel: typeof RequestPanel;
      ResponsePanel: typeof ResponsePanel;
      CodeBlock: typeof CodeBlock;
      TitlePanel: typeof TitlePanel;
      QueryPanel: typeof QueryPanel;
    };
  }
}

export { default as CodeBlock } from '../components/CodeBlock.svelte';
export { default as QueryPanel } from '../components/QueryPanel.svelte';
export { default as RequestPanel } from '../components/RequestPanel.svelte';
export { default as ResponsePanel } from '../components/ResponsePanel.svelte';
export { default as TitlePanel } from '../components/TitlePanel.svelte';

// Montar UI de API en un contenedor
export function mountApiUI(container: HTMLElement, request: ApiRequest, response: ApiResponse) {
  const requestContainer = container.querySelector('#cypress-api-request-panel');
  const responseContainer = container.querySelector('#cypress-api-response-panel');

  if (requestContainer) {
    mount(RequestPanel, {
      target: requestContainer as HTMLElement,
      props: {
        request,
      },
    });
  }

  if (responseContainer) {
    mount(ResponsePanel, {
      target: responseContainer as HTMLElement,
      props: { response },
    });
  }
}

// Montar UI de DB Query en un contenedor (usa un solo panel)
export function mountDbQueryUI(container: HTMLElement, dbQuery: DbQueryDisplayData) {
  const requestContainer = container.querySelector('#cypress-api-request-panel');
  const responseContainer = container.querySelector('#cypress-api-response-panel');

  if (requestContainer) {
    mount(QueryPanel, {
      target: requestContainer as HTMLElement,
      props: {
        query: dbQuery.query,
        rowCount: dbQuery.rowCount,
        duration: dbQuery.duration,
        rows: dbQuery.rows,
        error: dbQuery.error,
      },
    });
  }

  if (responseContainer) {
    responseContainer.innerHTML = '';
  }
}

// Hacer disponible globalmente para el plugin - ejecutar inmediatamente
const api = {
  mountApiUI,
  mountDbQueryUI,
  RequestPanel,
  ResponsePanel,
  CodeBlock,
  TitlePanel,
  QueryPanel,
};

// Forzar asignación global sin verificación condicional
(window as any).CypressApiDbUI = api;

// También exportar como default para compatibilidad
export default { mountApiUI, mountDbQueryUI, RequestPanel, ResponsePanel, CodeBlock, TitlePanel, QueryPanel };
