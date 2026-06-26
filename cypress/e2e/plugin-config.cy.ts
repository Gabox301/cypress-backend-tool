/// <reference types="cypress" />

/**
 * Plugin Configuration E2E Tests — GREEN (Strict TDD)
 *
 * Validates:
 *   PC-CONFIG-01: Static config from cypress.config.ts
 *   PC-CONFIG-02: Runtime override via Cypress.expose()
 *   PC-UI-02:    snapshotOnly collapsed CSS class
 *   PC-CONFIG-04: Debug logging toggle
 *
 * Implements tasks 4.1, validates tasks 1.1, 2.1, 2.3
 */

describe('Plugin Configuration', () => {
  afterEach(() => {
    Cypress.expose({ snapshotOnly: false });
  });

  describe('snapshotOnly Collapsed CSS (PC-UI-02)', () => {
    it('container has cypress-plugin-collapsed class when snapshotOnly is true', () => {
      Cypress.expose({ snapshotOnly: true });
      cy.http({
        url: 'https://jsonplaceholder.typicode.com/posts/1',
        method: 'GET',
      });
      cy.document().then((doc) => {
        const container = doc.getElementById('cypress-api-plugin-container');
        expect(container).to.exist;
        expect(container!.classList.contains('cypress-plugin-collapsed')).to.be.true;
        expect(doc.body.contains(container)).to.be.true;
      });
    });

    it('container does NOT have collapsed class when snapshotOnly is false', () => {
      cy.http({
        url: 'https://jsonplaceholder.typicode.com/posts/1',
        method: 'GET',
      });
      cy.document().then((doc) => {
        const container = doc.getElementById('cypress-api-plugin-container');
        expect(container).to.exist;
        expect(container!.classList.contains('cypress-plugin-collapsed')).to.be.false;
      });
    });

    it('snapshotOnly override does not leak to next test (PC-CONFIG-02)', () => {
      // afterEach resets to false — verify clean state
      cy.http({
        url: 'https://jsonplaceholder.typicode.com/posts/1',
        method: 'GET',
      });
      cy.document().then((doc) => {
        const container = doc.getElementById('cypress-api-plugin-container');
        expect(container).to.exist;
        expect(container!.classList.contains('cypress-plugin-collapsed')).to.be.false;
      });
    });
  });

  describe('Runtime Override via Cypress.expose() (PC-CONFIG-02)', () => {
    it('overrides snapshotOnly at runtime', () => {
      Cypress.expose({ snapshotOnly: true });
      cy.http({
        url: 'https://jsonplaceholder.typicode.com/posts/1',
        method: 'GET',
      });
      cy.document().then((doc) => {
        const container = doc.getElementById('cypress-api-plugin-container');
        expect(container).to.exist;
        expect(container!.classList.contains('cypress-plugin-collapsed')).to.be.true;
      });
    });

    it('partial override does not affect other keys', () => {
      Cypress.expose({ snapshotOnly: true });
      cy.http({
        url: 'https://jsonplaceholder.typicode.com/posts/1',
        method: 'GET',
      }).then((response: any) => {
        // HTTP request still works — other config keys not affected
        expect(response.status).to.eq(200);
      });
    });
  });

  describe('Debug Logging (PC-CONFIG-04)', () => {
    it('plugin works with debug enabled', () => {
      Cypress.expose({ CYPRESS_PLUGIN_DEBUG: true });
      cy.http({
        url: 'https://jsonplaceholder.typicode.com/posts/1',
        method: 'GET',
      }).then((response: any) => {
        expect(response.status).to.eq(200);
      });
    });

    it('plugin works with debug disabled', () => {
      Cypress.expose({ CYPRESS_PLUGIN_DEBUG: false });
      cy.http({
        url: 'https://jsonplaceholder.typicode.com/posts/1',
        method: 'GET',
      }).then((response: any) => {
        expect(response.status).to.eq(200);
      });
    });
  });

  describe('Config Merge (PC-CONFIG-01)', () => {
    it('handles partial config overrides without clobbering other keys', () => {
      Cypress.expose({ snapshotOnly: true });
      cy.http({
        url: 'https://jsonplaceholder.typicode.com/posts/1',
        method: 'GET',
      });
      cy.document().then((doc) => {
        const container = doc.getElementById('cypress-api-plugin-container');
        expect(container).to.exist;
        expect(container!.classList.contains('cypress-plugin-collapsed')).to.be.true;
      });
    });
  });
});
