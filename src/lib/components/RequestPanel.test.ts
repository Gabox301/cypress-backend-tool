import type { ApiRequest } from '$lib/types';
import { render, screen } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import RequestPanel from './RequestPanel.svelte';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------
function makeRequest(overrides: Partial<ApiRequest> = {}): ApiRequest {
  return {
    url: '/api/test',
    method: 'POST',
    headers: { Authorization: 'Bearer token123', 'Content-Type': 'application/json' },
    body: { username: 'admin', password: 'secret' },
    qs: { key: 'val123', token: 'abc' },
    auth: { username: 'admin', password: 's3cr3t' },
    ...overrides,
  } as ApiRequest;
}

const ALL_MASKED = { headers: true, auth: true, body: true, query: true };

// ---------------------------------------------------------------------------
// 3.1 — Basic render
// ---------------------------------------------------------------------------
describe('RequestPanel — basic render', () => {
  it('renders method and URL', () => {
    render(RequestPanel, {
      props: { request: makeRequest({ method: 'PUT', url: '/api/data' }), hideCredentials: false },
    });
    expect(screen.getByText('PUT')).toBeInTheDocument();
    // URL is split across segments in TitlePanel — verify each segment
    expect(screen.getByText('/api')).toBeInTheDocument();
    expect(screen.getByText('/data')).toBeInTheDocument();
  });

  it('renders tab bar with 5 tabs', () => {
    render(RequestPanel, { props: { request: makeRequest(), hideCredentials: false } });
    expect(screen.getByText('Body')).toBeInTheDocument();
    expect(screen.getByText('Query')).toBeInTheDocument();
    expect(screen.getByText('Headers')).toBeInTheDocument();
    expect(screen.getByText('Auth')).toBeInTheDocument();
    expect(screen.getByText('cURL')).toBeInTheDocument();
  });

  it('displays GET method as default when none provided', () => {
    const req = makeRequest({ method: undefined as unknown as ApiRequest['method'] });
    render(RequestPanel, { props: { request: req, hideCredentials: false } });
    expect(screen.getByText('GET')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 3.2 — Masking with hideCredentials enabled
// ---------------------------------------------------------------------------
describe('RequestPanel — masking enabled', () => {
  it('headers tab shows masked values when hideCredentials is true', async () => {
    const user = userEvent.setup();
    render(RequestPanel, {
      props: {
        request: makeRequest({ headers: { Authorization: 'Bearer secret-token' } }),
        hideCredentials: true,
        hideCredentialsOptions: ALL_MASKED,
      },
    });

    // Navigate to Headers tab
    await user.click(screen.getByText('Headers'));

    // Masked values should show ***, not the original value
    expect(screen.queryByText('Bearer secret-token')).not.toBeInTheDocument();
    // The key should still be visible (it's the JSON key, not the value)
  });

  it('auth tab shows masked password when hideCredentials is true', async () => {
    const user = userEvent.setup();
    render(RequestPanel, {
      props: {
        request: makeRequest({ auth: { username: 'admin', password: 'p@ssw0rd' } }),
        hideCredentials: true,
        hideCredentialsOptions: ALL_MASKED,
      },
    });

    await user.click(screen.getByText('Auth'));

    // The real password should NOT appear
    expect(screen.queryByText('p@ssw0rd')).not.toBeInTheDocument();
    // 'username' key should still be visible
  });

  it('query tab shows masked query params when hideCredentials is true', async () => {
    const user = userEvent.setup();
    render(RequestPanel, {
      props: {
        request: makeRequest({ qs: { apiKey: 'private-key-123' } }),
        hideCredentials: true,
        hideCredentialsOptions: ALL_MASKED,
      },
    });

    await user.click(screen.getByText('Query'));

    // The real value should NOT appear
    expect(screen.queryByText('private-key-123')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 3.3 — Masking disabled + per-tab options
// ---------------------------------------------------------------------------
describe('RequestPanel — masking disabled / selective', () => {
  it('shows unmasked values when hideCredentials is false', async () => {
    const user = userEvent.setup();
    render(RequestPanel, {
      props: {
        request: makeRequest({ headers: { 'X-API-Key': 'visible-key' } }),
        hideCredentials: false,
        hideCredentialsOptions: ALL_MASKED,
      },
    });

    await user.click(screen.getByText('Headers'));

    // Value should be visible since masking is off (quoted in JSON-syntax-highlighted span)
    expect(screen.getByText('"visible-key"')).toBeInTheDocument();
  });

  it('masks body but not headers when only body option is enabled', async () => {
    const user = userEvent.setup();
    const selectiveOptions = { headers: false, auth: true, body: true, query: true };
    render(RequestPanel, {
      props: {
        request: makeRequest({
          headers: { 'X-Visible': 'shown-value' },
          body: { password: 'body-secret' },
        }),
        hideCredentials: true,
        hideCredentialsOptions: selectiveOptions,
      },
    });

    // Headers should be visible (not masked) (quoted in JSON-syntax-highlighted span)
    await user.click(screen.getByText('Headers'));
    expect(screen.getByText('"shown-value"')).toBeInTheDocument();

    // Body is masked — body-secret should be replaced with ***
    await user.click(screen.getByText('Body'));
    expect(screen.queryByText('body-secret')).not.toBeInTheDocument();
    expect(screen.queryByText('"body-secret"')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 3.4 — deepMask nested object + empty state
// ---------------------------------------------------------------------------
describe('RequestPanel — deepMask and empty state', () => {
  it('fully masks nested object values with deepMask', async () => {
    const user = userEvent.setup();
    const nestedBody = { user: { password: 'deep-secret', token: 'abc123' }, public: 'visible' };
    render(RequestPanel, {
      props: {
        request: makeRequest({ body: nestedBody }),
        hideCredentials: true,
        hideCredentialsOptions: ALL_MASKED,
      },
    });

    await user.click(screen.getByText('Body'));

    // All nested values should be masked (replaced with ***)
    expect(screen.queryByText('deep-secret')).not.toBeInTheDocument();
    expect(screen.queryByText('abc123')).not.toBeInTheDocument();
  });

  it('shows empty state message when request is null', () => {
    render(RequestPanel, {
      props: {
        request: null,
        hideCredentials: false,
      },
    });

    expect(screen.getByText('Selecciona una solicitud')).toBeInTheDocument();
  });

  it('does not render tab bar when request is null', () => {
    render(RequestPanel, {
      props: {
        request: null,
        hideCredentials: false,
      },
    });

    // Tab buttons should NOT be present
    expect(screen.queryByText('Body')).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 3.5 — Empty states and cURL tab
// ---------------------------------------------------------------------------
describe('RequestPanel — empty tabs and cURL', () => {
  it('shows empty headers message when request has no headers', async () => {
    const user = userEvent.setup();
    render(RequestPanel, {
      props: {
        request: makeRequest({ headers: undefined }),
        hideCredentials: false,
      },
    });

    await user.click(screen.getByText('Headers'));
    expect(screen.getByText('Sin headers')).toBeInTheDocument();
  });

  it('shows empty auth message when request has no auth', async () => {
    const user = userEvent.setup();
    render(RequestPanel, {
      props: {
        request: makeRequest({ auth: undefined }),
        hideCredentials: false,
      },
    });

    await user.click(screen.getByText('Auth'));
    expect(screen.getByText('Sin auth')).toBeInTheDocument();
  });

  it('renders cURL command in bash format', async () => {
    const user = userEvent.setup();
    render(RequestPanel, {
      props: {
        request: makeRequest({ url: 'https://api.example.com/users', method: 'GET' }),
        hideCredentials: false,
      },
    });

    await user.click(screen.getByText('cURL'));
    // cURL tab renders CodeBlock with bash format
    const bashBadge = document.querySelector('.format-badge');
    expect(bashBadge).not.toBeNull();
    expect(bashBadge!.textContent).toBe('bash');
  });

  it('shows empty query params message when request has no qs', async () => {
    const user = userEvent.setup();
    render(RequestPanel, {
      props: {
        request: makeRequest({ qs: undefined }),
        hideCredentials: false,
      },
    });

    await user.click(screen.getByText('Query'));
    expect(screen.getByText('Sin query params')).toBeInTheDocument();
  });

  it('shows unmasked auth when hideCredentials is false', async () => {
    const user = userEvent.setup();
    render(RequestPanel, {
      props: {
        request: makeRequest({ auth: { username: 'admin', password: 'visible' } }),
        hideCredentials: false,
      },
    });

    await user.click(screen.getByText('Auth'));
    expect(screen.getByText('"visible"')).toBeInTheDocument();
  });

  it('shows unmasked query params when hideCredentials is false', async () => {
    const user = userEvent.setup();
    render(RequestPanel, {
      props: {
        request: makeRequest({ qs: { token: 'abc', page: '1' } }),
        hideCredentials: false,
      },
    });

    await user.click(screen.getByText('Query'));
    expect(screen.getByText('"abc"')).toBeInTheDocument();
    expect(screen.getByText('"1"')).toBeInTheDocument();
  });
});
