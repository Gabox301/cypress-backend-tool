/// <reference types="cypress" />

declare global {
  namespace Cypress {
    interface Chainable {
      http(url: string, options?: Partial<ApiRequestOptions>): Chainable<ApiResponse>;
      http(options: ApiRequestOptions): Chainable<ApiResponse>;
      query(
        query: string,
        connectionOptions?: { host: string; port: number; database: string; user: string; password: string },
      ): Chainable<DbQueryResponse>;
      state(key: 'window'): Window;
      state<T = any>(key: string): T;
    }
  }
}

interface ApiRequestOptions {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';
  headers?: Record<string, string>;
  body?: unknown;
  qs?: Record<string, string>;
  auth?: { username: string; password: string };
  failOnStatusCode?: boolean;
}

interface ApiResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: unknown;
  duration: number;
  size: number;
  cookies: Array<{
    name: string;
    value: string;
    domain?: string;
    path?: string;
    expires?: string;
    httpOnly?: boolean;
    secure?: boolean;
  }>;
}

interface DbQueryResponse {
  rows: unknown[];
  rowCount: number;
  duration: number;
  query: string;
}

interface PluginConfig {
  snapshotOnly: boolean;
  hideCredentials: boolean;
  hideCredentialsOptions: { headers: string[]; auth: string[]; body: string[]; query: string[] };
}

function getPluginConfig(): PluginConfig {
  return {
    snapshotOnly: Cypress.expose('snapshotOnly') ?? false,
    hideCredentials: Cypress.expose('hideCredentials') ?? false,
    hideCredentialsOptions: Cypress.expose('hideCredentialsOptions') ?? {
      headers: ['authorization', 'x-api-key', 'cookie'],
      auth: ['password', 'pass'],
      body: ['password', 'secret', 'token', 'api_key', 'apikey'],
      query: ['password', 'secret', 'token'],
    },
  };
}

interface UiColors {
  get: string;
  post: string;
  put: string;
  patch: string;
  delete: string;
  head: string;
  options: string;
}

interface UiTheme {
  colors: UiColors;
  background: string;
  panel: string;
  header: string;
  text: string;
  textSecondary: string;
  accent: string;
  success: string;
  error: string;
  warning: string;
}

function getUiTheme(): UiTheme {
  return {
    colors: {
      get: '#98C379',
      post: '#E5C07B',
      put: '#61AFEF',
      patch: '#C678DD',
      delete: '#E06C75',
      head: '#98C379',
      options: '#D172A5',
    },
    background: '#1a1a2e',
    panel: '#0d1117',
    header: '#16213e',
    text: '#eaeaea',
    textSecondary: '#a0a0a0',
    accent: '#e94560',
    success: '#22c55e',
    error: '#ef4444',
    warning: '#fbbf24',
  };
}

const DEBUG = (Cypress.expose('CYPRESS_PLUGIN_DEBUG') as boolean) ?? false;

function logDebug(...args: unknown[]) {
  if (DEBUG) {
    console.warn('[cypress-plugin-api-db]', ...args);
  }
}
// Wrap it in an explicit Promise so the resolved value is properly extracted.
function readTaskValue<T>(taskName: string, args?: unknown): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    (cy as any).task(taskName, args, { log: false }).then(
      (result: T) => resolve(result),
      (err: unknown) => reject(err),
    );
  });
}

async function loadSavedTheme(): Promise<Partial<UiTheme>> {
  try {
    return (await readTaskValue<Partial<UiTheme>>('theme:load')) || {};
  } catch {
    return {};
  }
}

async function saveTheme(theme: UiTheme) {
  try {
    await readTaskValue('theme:save', { theme });
  } catch (e) {
    console.error('[cypress-plugin-api-db] Error in saveTheme:', e);
  }
}

let cypressWin: Window | null = null;
let currentTheme: UiTheme = getUiTheme();

function getCypressWindow(): Window {
  return cy.state('window');
}

let uiBundleLoaded = false;

// FIX: cy.readFile() also returns a Cypress Chainable — same wrapping pattern.
// We also check CypressApiDbUI on `win` (AUT window), not on the plugin window,
// because the <script> injection targets win.document.
async function loadUIBundle(): Promise<void> {
  const win = getCypressWindow();

  // FIX: was checking (window as any).CypressApiDbUI — the plugin's own window.

  try {
    // Cargar CSS primero
    const cssLink = win.document.createElement('link');
    cssLink.rel = 'stylesheet';
    cssLink.href = '/dist/ui/ui.css';
    win.document.head.appendChild(cssLink);

    const script = win.document.createElement('script');
    script.src = '/dist/ui/ui.js'; // Cypress sirve archivos estáticos
    script.async = false; // Asegurar carga sincrónica

    // Esperar a que el script cargue
    await new Promise<void>((resolve, reject) => {
      script.onload = () => {
        resolve();
      };
      script.onerror = () => {
        reject(new Error('Failed to load script'));
      };
      win.document.head.appendChild(script);
    });

    // Verificar que CypressApiDbUI esté disponible
    if ((win as any).CypressApiDbUI) {
      uiBundleLoaded = true;
    } else {
      logDebug('Bundle loaded but CypressApiDbUI not available on window');
    }
  } catch (err) {
    logDebug('Error loading UI bundle:', err);
  }
}

async function showApiUi(request: ApiRequestOptions, response: ApiResponse): Promise<void> {
  const config = getPluginConfig();

  // Load bundle first (idempotent after first run)
  await loadUIBundle();

  // FIX: await the container creation so the DOM is ready before we try to mount.
  // Previously createApiUiContainer() was fire-and-forget (void, not awaited).
  await createApiUiContainer();

  const win = cypressWin;
  const container = win?.document.getElementById('cypress-api-plugin-container');

  // FIX: check CypressApiDbUI on `win` (AUT window), not on the plugin window.

  if (container && (win as any)?.CypressApiDbUI) {
    (win as any).CypressApiDbUI.mountApiUI(container, request, response);
  } else {
    logDebug('Cannot mount UI - container or CypressApiDbUI unavailable');
  }

  if (config.snapshotOnly) {
    container?.classList.add('collapsed');
  }
}

// FIX: async so it can properly await createApiUiContainer
async function showDbQueryUi(query: string, result: DbQueryResponse): Promise<void> {
  await loadUIBundle();
  await createApiUiContainer(true);

  const win = cypressWin;
  const container = win?.document.getElementById('cypress-api-plugin-container');

  if (container && (win as any)?.CypressApiDbUI) {
    (win as any).CypressApiDbUI.mountDbQueryUI(container, {
      query,
      rows: result.rows,
      rowCount: result.rowCount,
      duration: result.duration,
    });
  } else {
    logDebug('Cannot mount DB UI - container or CypressApiDbUI unavailable');
  }
}

async function createApiUiContainer(isDbQuery = false): Promise<void> {
  const win = getCypressWindow();
  cypressWin = win;

  const savedTheme = await loadSavedTheme();
  const baseTheme = getUiTheme();
  currentTheme = { ...baseTheme, ...savedTheme, colors: { ...baseTheme.colors, ...(savedTheme.colors || {}) } };

  const existing = win.document.getElementById('cypress-api-plugin-container');
  if (existing) {
    existing.remove();
  }

  const container = win.document.createElement('div');
  container.id = 'cypress-api-plugin-container';
  container.style.cssText = `
    --bg-main: ${currentTheme.background};
    --bg-panel: ${currentTheme.panel};
    --bg-header: ${currentTheme.header};
    --text-primary: ${currentTheme.text};
    --text-secondary: ${currentTheme.textSecondary};
    --accent: ${currentTheme.accent};
    --success: ${currentTheme.success};
    --error: ${currentTheme.error};
    --warning: ${currentTheme.warning};
    --method-get: ${currentTheme.colors.get};
    --method-post: ${currentTheme.colors.post};
    --method-put: ${currentTheme.colors.put};
    --method-patch: ${currentTheme.colors.patch};
    --method-delete: ${currentTheme.colors.delete};
    --method-head: ${currentTheme.colors.head};
    --method-options: ${currentTheme.colors.options};
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: var(--bg-main);
    border-top: 3px solid var(--accent);
    z-index: 9999;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    display: flex;
    flex-direction: row;
  `;

  container.innerHTML = isDbQuery
    ? `<div id="cypress-api-request-panel" style="width: 100%; height: 100%;"></div>`
    : `<div id="cypress-api-request-panel" style="width: 50%; height: 100%;"></div><div id="cypress-api-response-panel" style="width: 50%; height: 100%;"></div>`;

  win.document.body.appendChild(container);

  // Inyectar estilos CSS globales para los componentes Svelte
  injectGlobalStyles(win);
}

// Estilos CSS globales para asegurar que los componentes Svelte se vean correctamente
function injectGlobalStyles(win: Window): void {
  const styleId = 'cypress-api-ui-styles';
  if (win.document.getElementById(styleId)) return;

  const style = win.document.createElement('style');
  style.id = styleId;
  style.textContent = `
    /* TitlePanel styles */
    .title-panel {
      display: flex !important;
      align-items: center !important;
      gap: 12px !important;
      padding: 12px 16px !important;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
      background: rgba(0, 0, 0, 0.3) !important;
      min-height: 48px !important;
    }
    .method-badge {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      padding: 4px 10px !important;
      border-radius: 4px !important;
      font-family: monospace !important;
      font-size: 11px !important;
      font-weight: 800 !important;
      letter-spacing: 0.06em !important;
      white-space: nowrap !important;
      border: 1px solid !important;
      flex-shrink: 0 !important;
    }
    .url-container {
      display: flex !important;
      align-items: center !important;
      overflow: hidden !important;
      flex: 1 !important;
      font-family: monospace !important;
      font-size: 12px !important;
    }
    .url-origin {
      color: rgba(148, 163, 184, 0.6) !important;
      white-space: nowrap !important;
      flex-shrink: 0 !important;
    }
    .url-path {
      color: #e2e8f0 !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
    }

    /* Panel styles */
    .panel {
      display: flex !important;
      flex-direction: column !important;
      height: 100% !important;
      background: #0a0f1c !important;
      border-radius: 8px !important;
      overflow: hidden !important;
    }

    /* Tabs styles */
    .tabs-bar {
      display: flex !important;
      gap: 4px !important;
      padding: 8px 12px !important;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05) !important;
      background: rgba(0, 0, 0, 0.2) !important;
    }
    .tab-btn {
      display: flex !important;
      align-items: center !important;
      gap: 5px !important;
      padding: 5px 12px !important;
      border-radius: 5px !important;
      font-size: 11px !important;
      font-weight: 600 !important;
      color: rgba(100, 116, 139, 0.8) !important;
      background: transparent !important;
      border: none !important;
      cursor: pointer !important;
      font-family: inherit !important;
    }
    .tab-btn.active {
      color: #00d4ff !important;
      background: rgba(0, 212, 255, 0.1) !important;
    }
    .tab-icon {
      font-size: 10px !important;
      opacity: 0.7 !important;
      font-family: monospace !important;
    }

    /* Content area */
    .content-area {
      flex: 1 !important;
      overflow: auto !important;
      padding: 12px !important;
    }

    /* Code container */
    .code-container {
      background: #060a10 !important;
      border: 1px solid rgba(0, 212, 255, 0.1) !important;
      border-radius: 8px !important;
      overflow: hidden !important;
      font-family: monospace !important;
      font-size: 12px !important;
    }
    .code-header {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      padding: 6px 12px !important;
      background: rgba(0, 212, 255, 0.05) !important;
      border-bottom: 1px solid rgba(0, 212, 255, 0.1) !important;
    }
    .code-body {
      overflow: auto !important;
      max-height: 400px !important;
      display: flex !important;
    }
    .line-numbers {
      display: flex !important;
      flex-direction: column !important;
      padding: 12px 12px 12px 8px !important;
      text-align: right !important;
      color: rgba(100, 116, 139, 0.4) !important;
      border-right: 1px solid rgba(255, 255, 255, 0.05) !important;
      font-size: 11px !important;
      background: rgba(0, 0, 0, 0.2) !important;
      flex-shrink: 0 !important;
    }
    .code-lines {
      flex: 1 !important;
      padding: 12px 16px !important;
      overflow: auto !important;
      white-space: pre !important;
      color: #94a3b8 !important;
      margin: 0 !important;
    }

    /* JSON colors */
    .json-key { color: #7dd3fc !important; }
    .json-string { color: #86efac !important; }
    .json-number { color: #fca5a5 !important; }
    .json-bool { color: #c4b5fd !important; }
    .json-null { color: #64748b !important; font-style: italic !important; }

    /* Response header */
    .response-header {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      padding: 10px 16px !important;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important;
      background: rgba(0, 0, 0, 0.2) !important;
    }
    .status-group {
      display: flex !important;
      align-items: center !important;
      gap: 10px !important;
    }
    .status-dot {
      width: 8px !important;
      height: 8px !important;
      border-radius: 50% !important;
    }
    .status-code {
      font-family: monospace !important;
      font-size: 16px !important;
      font-weight: 700 !important;
    }
    .status-text {
      font-size: 11px !important;
      font-weight: 600 !important;
      text-transform: uppercase !important;
      opacity: 0.7 !important;
    }
    .meta-pills {
      display: flex !important;
      gap: 8px !important;
    }
    .pill {
      padding: 3px 10px !important;
      border-radius: 99px !important;
      font-family: monospace !important;
      font-size: 10px !important;
      font-weight: 600 !important;
      color: rgba(148, 163, 184, 0.7) !important;
      background: rgba(255, 255, 255, 0.05) !important;
      border: 1px solid rgba(255, 255, 255, 0.1) !important;
    }

    /* Empty state */
    .empty-state {
      flex: 1 !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 12px !important;
      color: rgba(100, 116, 139, 0.5) !important;
      padding: 40px !important;
    }
    .empty-icon {
      display: inline-flex !important;
      align-items: center !important;
      opacity: 0.25 !important;
    }
    .empty-icon svg {
      width: 36px !important;
      height: 36px !important;
      color: #64748b !important;
      fill: none !important;
      stroke: currentColor !important;
    }

    /* Custom scrollbar styles */
    #cypress-api-plugin-container * {
      scrollbar-width: thin;
      scrollbar-color: rgba(0, 212, 255, 0.3) rgba(0, 0, 0, 0.2);
    }

    #cypress-api-plugin-container *::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }

    #cypress-api-plugin-container *::-webkit-scrollbar-track {
      background: rgba(0, 0, 0, 0.2);
      border-radius: 4px;
    }

    #cypress-api-plugin-container *::-webkit-scrollbar-thumb {
      background: rgba(0, 212, 255, 0.3);
      border-radius: 4px;
    }

    #cypress-api-plugin-container *::-webkit-scrollbar-thumb:hover {
      background: rgba(0, 212, 255, 0.5);
    }
  `;
  win.document.head.appendChild(style);
}

export function init() {
  (Cypress.Commands as any).add(
    'http',
    (urlOrOptions: string | ApiRequestOptions, maybeOptions?: ApiRequestOptions) => {
      const options: ApiRequestOptions =
        typeof urlOrOptions === 'string'
          ? { url: urlOrOptions, method: maybeOptions?.method || 'GET', ...maybeOptions }
          : urlOrOptions;
      const startTime = Date.now();

      return (cy as any).request(options).then((cyResponse: any) => {
        const response: ApiResponse = {
          status: cyResponse.status,
          statusText: cyResponse.statusText || '',
          headers: cyResponse.headers || {},
          body: cyResponse.body,
          duration: Date.now() - startTime,
          size: JSON.stringify(cyResponse.body).length,
          cookies: cyResponse.cookies || [],
        };
        return showApiUi(options, response).then(() => response);
      });
    },
  );

  (Cypress.Commands as any).add(
    'query',
    (
      query: string,
      connectionOptions?: { host: string; port: number; database: string; user: string; password: string },
    ) => {
      const startTime = Date.now();
      cypressWin = getCypressWindow();

      return (cy as any).task('db:getConfig').then((defaultConfig: any) => {
        const host = connectionOptions?.host || Cypress.expose('dbHost') || defaultConfig?.host || 'localhost';
        const port = connectionOptions?.port || parseInt(Cypress.expose('dbPort') || String(defaultConfig?.port || '5432'), 10);
        const database = connectionOptions?.database || Cypress.expose('dbName') || defaultConfig?.database || 'test_db';
        const user = connectionOptions?.user || Cypress.expose('dbUser') || defaultConfig?.user || 'postgres';
        const password = connectionOptions?.password || Cypress.expose('dbPassword') || defaultConfig?.password || '';

        return (cy as any).task('db:query', { query, host, port, database, user, password }).then((result: any) => {
          const dbResponse: DbQueryResponse = {
            rows: result.rows || [],
            rowCount: result.rowCount || 0,
            duration: Date.now() - startTime,
            query,
          };
          return showDbQueryUi(query, dbResponse).then(() => cy.wrap(dbResponse));
        });
      });
    },
  );
}

export default { init };
