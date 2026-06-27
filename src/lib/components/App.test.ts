import { apiCalls, dbQueries, pluginConfig } from '$lib/stores.svelte';
import type { ApiCall, DbQuery } from '$lib/types';
import { render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it } from 'vitest';
import App from './App.svelte';

function makeApiCall(overrides: Partial<ApiCall> = {}): ApiCall {
  return {
    id: crypto.randomUUID(),
    request: {
      url: '/api/test',
      method: 'GET',
      headers: { Accept: 'application/json' },
    },
    response: {
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' },
      body: { result: 'ok' },
      duration: 10,
      size: 100,
    },
    timestamp: Date.now(),
    ...overrides,
  } as ApiCall;
}

function makeDbQueryCall(overrides: Partial<DbQuery> = {}): DbQuery {
  return {
    id: crypto.randomUUID(),
    connectionId: 'localhost:5432/test_db',
    query: 'SELECT * FROM users',
    result: [{ id: 1, name: 'Alice' }],
    duration: 5,
    timestamp: Date.now(),
    ...overrides,
  };
}

function setConfig(overrides = {}) {
  Object.assign(pluginConfig, {
    snapshotOnly: false,
    hideCredentials: false,
    hideCredentialsOptions: { headers: true, auth: true, body: true, query: true },
    requestMode: 'auto' as const,
    CYPRESS_PLUGIN_DEBUG: false,
    ...overrides,
  });
}

beforeEach(() => {
  apiCalls.length = 0;
  dbQueries.length = 0;
  setConfig();
});

describe('App component — reads from stores', () => {
  it('renders API calls from apiCalls store', () => {
    apiCalls.push(makeApiCall());
    render(App);

    expect(screen.getByText('GET')).toBeInTheDocument();
    expect(screen.getByText('200')).toBeInTheDocument();
  });

  it('renders multiple API calls', () => {
    apiCalls.push(makeApiCall({ request: { url: '/a', method: 'POST' } }));
    apiCalls.push(makeApiCall({ request: { url: '/b', method: 'PUT' } }));
    render(App);

    expect(screen.getByText('POST')).toBeInTheDocument();
    expect(screen.getByText('PUT')).toBeInTheDocument();
  });

  it('renders DB queries from dbQueries store', () => {
    dbQueries.push(makeDbQueryCall());
    render(App);

    expect(screen.getByText('SELECT * FROM users')).toBeInTheDocument();
  });

  it('masks credentials when hideCredentials is true', () => {
    setConfig({ hideCredentials: true });
    apiCalls.push(
      makeApiCall({
        request: { url: '/login', method: 'POST', auth: { username: 'admin', password: 'secret123' } },
      }),
    );
    render(App);

    expect(screen.getByText('POST')).toBeInTheDocument();
    expect(screen.queryByText('secret123')).toBeNull();
  });

  it('shows unmasked credentials when hideCredentials is false', () => {
    setConfig({ hideCredentials: false });
    apiCalls.push(
      makeApiCall({
        request: { url: '/login', method: 'POST', auth: { username: 'admin', password: 'visible123' } },
      }),
    );
    render(App);

    expect(screen.getByText('POST')).toBeInTheDocument();
  });
});
