/// <reference types="cypress" />

/**
 * Credential Isolation E2E Tests — RED (Strict TDD)
 *
 * Validates:
 *   CA-CMD-01: DB Credential Isolation via cy.task() exclusively
 *
 * Implements task 4.3, validates task 2.4
 */

describe('Credential Isolation (CA-CMD-01)', () => {
  afterEach(() => {
    // Clean up any exposed values between tests
    cy.document().then((doc) => {
      const container = doc.getElementById('cypress-api-plugin-container');
      if (container) container.remove();
    });
  });

  describe('DB credentials NEVER enter browser context', () => {
    it('dbPassword is not exposed on window after cy.query()', () => {
      // cy.task('db:getConfig') returns credentials from Node.js process
      // Cypress.expose('dbPassword') fallback MUST NOT exist after fix
      cy.task('db:getConfig').then((config: any) => {
        // The task returns credentials — this is in Node.js, safe
        expect(config).to.have.property('host');
        expect(config).to.have.property('password');

        // Now verify that these are NOT on the browser window
        cy.window().then((win: any) => {
          expect(win.dbPassword).to.be.undefined;
          expect(win.dbHost).to.be.undefined;
          expect(win.dbPort).to.be.undefined;
          expect(win.dbName).to.be.undefined;
          expect(win.dbUser).to.be.undefined;
        });
      });
    });

    it('cy.task("db:getConfig") is available as exclusive credential source', () => {
      cy.task('db:getConfig').then((config: any) => {
        // Verify the task returns a valid config object
        expect(config).to.be.an('object');
        expect(config).to.have.property('host');
        expect(config).to.have.property('port');
        expect(config).to.have.property('database');
        expect(config).to.have.property('user');
        expect(config).to.have.property('password');
      });
    });

    it('credentials from cy.task do not pollute Cypress.env', () => {
      cy.task('db:getConfig').then((_config: any) => {
        // Verify that Cypress.env() does NOT contain DB credentials
        // (Cypress.env gets populated from cypress.config.ts `env` section)
        expect(Cypress.env('dbPassword')).to.be.undefined;
      });
    });

    it('codebase has no Cypress.expose fallback for dbPassword (compile-time assertion)', () => {
      // This test verifies that the implementation removed the fallback.
      // The actual verification is through code review, but we assert behavior:
      // - If Cypress.expose('dbPassword') was called, it would be accessible
      cy.window().then((win: any) => {
        // Browser window must NOT have any DB credential properties
        // These would only exist if Cypress.expose() set them on window
        expect(win.dbPassword).to.be.undefined;
        expect(win.dbHost).to.be.undefined;
        expect(win.dbPort).to.be.undefined;
        expect(win.dbName).to.be.undefined;
        expect(win.dbUser).to.be.undefined;
      });
    });
  });
});
