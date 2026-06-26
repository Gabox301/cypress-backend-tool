/// <reference types="cypress" />

/**
 * Credential Masking E2E Tests — RED (Strict TDD)
 *
 * Validates:
 *   CA-UI-01: Credential Masking in RequestPanel
 *   CA-UI-02: Masking Rules via hideCredentialsOptions
 *
 * Implements task 4.2, validates tasks 3.1, 3.2, 3.3
 *
 * Design decision: tab-level blanket masking (per design #7 — boolean toggles per tab).
 * When hideCredentialsOptions.{tab} is true, ALL values in that tab display as ***.
 *
 * IMPORTANT: Both RequestPanel and ResponsePanel have "Body" and "Headers" tab buttons.
 * All tab interactions are scoped to [data-testid="request-panel"].
 */

const RP = '[data-testid="request-panel"]';

describe('Credential Masking (CA-UI-01, CA-UI-02)', () => {
  const BASE_URL = 'https://jsonplaceholder.typicode.com/posts/1';

  afterEach(() => {
    Cypress.expose({
      hideCredentials: false,
      hideCredentialsOptions: { headers: true, auth: true, body: true, query: true },
    });
    cy.document().then((doc) => {
      const container = doc.getElementById('cypress-api-plugin-container');
      if (container) container.remove();
    });
  });

  // ==========================================
  // CA-UI-01: Basic Credential Masking
  // ==========================================
  describe('Basic Masking (CA-UI-01)', () => {
    it('masks Authorization header value when hideCredentials is true', () => {
      Cypress.expose({ hideCredentials: true });
      cy.http({
        url: BASE_URL,
        method: 'GET',
        headers: {
          Authorization: 'Bearer secret-token-abc',
          Accept: 'application/json',
        },
      });
      cy.get(RP).should('exist');
      cy.get(RP).contains('button', 'Headers').click();
      cy.get(RP).within(() => {
        cy.contains('***').should('exist');
        cy.contains('secret-token-abc').should('not.exist');
      });
    });

    it('masks auth credentials when hideCredentials is true', () => {
      Cypress.expose({ hideCredentials: true });
      cy.http({
        url: BASE_URL,
        method: 'GET',
        auth: { username: 'admin', password: 'super-secret-pw' },
      });
      cy.get(RP).should('exist');
      cy.get(RP).contains('button', 'Auth').click();
      cy.get(RP).within(() => {
        cy.contains('***').should('exist');
        cy.contains('super-secret-pw').should('not.exist');
      });
    });

    it('masks body fields when hideCredentials is true', () => {
      Cypress.expose({ hideCredentials: true });
      cy.http({
        url: 'https://jsonplaceholder.typicode.com/posts',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: {
          title: 'Test Post',
          password: 'body-secret-123',
          token: 'body-token-xyz',
        },
      });
      cy.get(RP).should('exist');
      // Force Body tab re-render: switch away then back
      cy.get(RP).contains('button', 'Headers').click();
      cy.get(RP).contains('button', 'Body').click();
      cy.get(RP).within(() => {
        cy.contains('***').should('exist');
        cy.contains('body-secret-123').should('not.exist');
        cy.contains('body-token-xyz').should('not.exist');
      });
    });

    it('masks query params when hideCredentials is true', () => {
      Cypress.expose({ hideCredentials: true });
      cy.http({
        url: BASE_URL,
        method: 'GET',
        qs: { api_key: 'query-key-abc', name: 'test' },
      });
      cy.get(RP).should('exist');
      cy.get(RP).contains('button', 'Query').click();
      cy.get(RP).within(() => {
        cy.contains('***').should('exist');
        cy.contains('query-key-abc').should('not.exist');
      });
    });

    it('shows ALL values unmasked when hideCredentials is false', () => {
      Cypress.expose({ hideCredentials: false });
      cy.http({
        url: 'https://jsonplaceholder.typicode.com/posts',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer visible-token-123',
        },
        body: { title: 'Visible', password: 'visible-secret' },
        auth: { username: 'user', password: 'visible-pass' },
      });
      cy.get(RP).should('exist');
      // Headers tab — values visible
      cy.get(RP).contains('button', 'Headers').click();
      cy.get(RP).contains('visible-token-123').should('exist');
      // Auth tab — values visible
      cy.get(RP).contains('button', 'Auth').click();
      cy.get(RP).contains('visible-pass').should('exist');
      // Body tab — values visible
      cy.get(RP).contains('button', 'Body').click();
      cy.get(RP).contains('visible-secret').should('exist');
    });
  });

  // ==========================================
  // CA-UI-02: Granular hideCredentialsOptions
  // ==========================================
  describe('Granular Masking via hideCredentialsOptions (CA-UI-02)', () => {
    it('body-only masking: body masked, headers visible', () => {
      Cypress.expose({
        hideCredentials: true,
        hideCredentialsOptions: { headers: false, auth: false, body: true, query: false },
      });
      cy.http({
        url: 'https://jsonplaceholder.typicode.com/posts',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer headers-visible-token',
        },
        body: { title: 'Body test', password: 'body-hidden-secret' },
        auth: { username: 'admin', password: 'auth-visible' },
      });
      cy.get(RP).should('exist');
      // Body tab — masked (force re-render)
      cy.get(RP).contains('button', 'Headers').click();
      cy.get(RP).contains('button', 'Body').click();
      cy.get(RP).within(() => {
        cy.contains('***').should('exist');
        cy.contains('body-hidden-secret').should('not.exist');
      });
      // Headers tab — visible
      cy.get(RP).contains('button', 'Headers').click();
      cy.get(RP).contains('headers-visible-token').should('exist');
      // Auth tab — visible
      cy.get(RP).contains('button', 'Auth').click();
      cy.get(RP).contains('auth-visible').should('exist');
    });

    it('headers-disabled: headers visible, other tabs masked', () => {
      Cypress.expose({
        hideCredentials: true,
        hideCredentialsOptions: { headers: false, auth: true, body: true, query: true },
      });
      cy.http({
        url: 'https://jsonplaceholder.typicode.com/posts',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer only-headers-visible',
        },
        body: { password: 'body-masked-pw' },
        auth: { username: 'admin', password: 'auth-masked' },
      });
      cy.get(RP).should('exist');
      // Headers tab — visible
      cy.get(RP).contains('button', 'Headers').click();
      cy.get(RP).contains('only-headers-visible').should('exist');
      // Body tab — masked (force re-render)
      cy.get(RP).contains('button', 'Headers').click();
      cy.get(RP).contains('button', 'Body').click();
      cy.get(RP).within(() => {
        cy.contains('***').should('exist');
        cy.contains('body-masked-pw').should('not.exist');
      });
      // Auth tab — masked
      cy.get(RP).contains('button', 'Auth').click();
      cy.get(RP).contains('auth-masked').should('not.exist');
    });

    it('default options mask all tabs when hideCredentialsOptions is absent', () => {
      Cypress.expose({ hideCredentials: true });
      cy.http({
        url: 'https://jsonplaceholder.typicode.com/posts',
        method: 'POST',
        headers: { Authorization: 'Bearer default-masked-token' },
        body: { password: 'default-masked-secret' },
      });
      cy.get(RP).should('exist');
      // Headers tab — masked (default headers: true)
      cy.get(RP).contains('button', 'Headers').click();
      cy.get(RP).contains('default-masked-token').should('not.exist');
      // Body tab — masked (default body: true), force re-render
      cy.get(RP).contains('button', 'Headers').click();
      cy.get(RP).contains('button', 'Body').click();
      cy.get(RP).within(() => {
        cy.contains('***').should('exist');
        cy.contains('default-masked-secret').should('not.exist');
      });
    });

    it('masking toggle does not affect response panel', () => {
      Cypress.expose({ hideCredentials: true });
      cy.http({
        url: BASE_URL,
        method: 'GET',
      }).then((response: any) => {
        expect(response.status).to.eq(200);
        expect(response.body).to.have.property('id', 1);
      });
    });
  });

  // ==========================================
  // Edge Cases
  // ==========================================
  describe('Edge Cases', () => {
    it('handles request with empty body/headers/auth gracefully', () => {
      Cypress.expose({ hideCredentials: true });
      cy.http({
        url: BASE_URL,
        method: 'DELETE',
      });
      cy.get('#cypress-api-plugin-container').should('exist');
    });

    it('cURL tab — values NOT masked (curl is for copy-paste)', () => {
      Cypress.expose({ hideCredentials: true });
      cy.http({
        url: BASE_URL,
        method: 'GET',
        headers: { Authorization: 'Bearer curl-visible-token' },
      });
      cy.get(RP).should('exist');
      cy.get(RP).contains('button', 'cURL').click();
      cy.get(RP).contains('curl-visible-token').should('exist');
    });
  });
});
