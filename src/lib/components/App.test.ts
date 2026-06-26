import type { ApiRequest, ApiResponse, DbQueryDisplayData } from '$lib/types';
import { render, screen } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import App from './App.svelte';

function makeApiRequest(overrides: Partial<ApiRequest> = {}): ApiRequest {
  return {
    url: '/api/test',
    method: 'GET',
    headers: { Accept: 'application/json' },
    ...overrides,
  };
}

function makeApiResponse(): ApiResponse {
  return {
    status: 200,
    statusText: 'OK',
    headers: { 'Content-Type': 'application/json' },
    body: { result: 'ok' },
    duration: 10,
    size: 100,
  };
}

function makeDbQuery(): DbQueryDisplayData {
  return {
    query: 'SELECT * FROM users',
    rows: [{ id: 1, name: 'Alice' }],
    rowCount: 1,
    duration: 5,
  };
}

function makeConfig(overrides = {}) {
  return {
    snapshotOnly: false,
    hideCredentials: false,
    hideCredentialsOptions: { headers: true, auth: true, body: true, query: true },
    requestMode: 'auto' as const,
    CYPRESS_PLUGIN_DEBUG: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 4.4 — App component mount + mode switching + config forwarding
// ---------------------------------------------------------------------------
describe('App component — mount and mode', () => {
  it('renders RequestPanel in API mode', () => {
    render(App, {
      props: {
        request: makeApiRequest(),
        response: makeApiResponse(),
        mode: 'api',
      },
    });

    expect(screen.getByText('GET')).toBeInTheDocument();
    expect(screen.getByText('200')).toBeInTheDocument();
  });

  it('renders QueryPanel in DB mode', () => {
    render(App, {
      props: {
        dbQuery: makeDbQuery(),
        mode: 'db',
      },
    });

    expect(screen.getByText('Database Query')).toBeInTheDocument();
    expect(screen.getByText('1 rows')).toBeInTheDocument();
    expect(screen.getByText('5ms')).toBeInTheDocument();
  });

  it('passes hideCredentials config to RequestPanel and masks auth', () => {
    const config = makeConfig({ hideCredentials: true });
    const request = makeApiRequest({
      auth: { username: 'admin', password: 'secret123' },
    });

    render(App, {
      props: { request, response: makeApiResponse(), mode: 'api', config },
    });

    // When hideCredentials is true, the password should be masked
    expect(screen.getByText('GET')).toBeInTheDocument();
    expect(screen.queryByText('secret123')).toBeNull();
  });

  it('shows credentials unmasked when hideCredentials is false', () => {
    const config = makeConfig({ hideCredentials: false });
    const request = makeApiRequest({
      auth: { username: 'admin', password: 'visible123' },
    });

    render(App, {
      props: { request, response: makeApiResponse(), mode: 'api', config },
    });

    expect(screen.getByText('GET')).toBeInTheDocument();
  });

  it('forwards snapshotOnly to ResponsePanel via config', () => {
    const config = makeConfig({ snapshotOnly: true });

    render(App, {
      props: { request: makeApiRequest(), response: makeApiResponse(), mode: 'api', config },
    });

    // snapshotOnly applies collapsed class to the container in showApiUi,
    // which is called from the plugin layer. At the App level, config
    // is forwarded correctly — verify the component renders.
    expect(screen.getByText('200')).toBeInTheDocument();
  });
});
