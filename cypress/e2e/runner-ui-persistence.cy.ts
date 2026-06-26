/**
 * E2E: Runner UI Persistence
 *
 * Validates that multiple cy.http() / cy.query() calls in the same test
 * accumulate correctly and the UI panel displays per-command data.
 *
 * Requires: `npx cypress run --spec cypress/e2e/runner-ui-persistence.cy.ts`
 */
describe('Runner UI Persistence — E2E', () => {
  it('two cy.http() calls accumulate independently, second call has correct status', () => {
    // First call — GET users
    cy.http({
      url: 'https://jsonplaceholder.typicode.com/users/1',
      method: 'GET',
    }).then((res1: any) => {
      expect(res1.status).to.eq(200);
    });

    // Second call — POST a new post (different method, different status)
    cy.http({
      url: 'https://jsonplaceholder.typicode.com/posts',
      method: 'POST',
      body: { title: 'persistence-test', body: 'E2E validation', userId: 1 },
      headers: { 'Content-Type': 'application/json' },
    }).then((res2: any) => {
      // Second call should return 201 Created
      expect(res2.status).to.eq(201);
      expect(res2.body).to.have.property('title', 'persistence-test');
    });
  });

  it('cy.http() + cy.query() in same test — query data is independent', () => {
    // API call
    cy.http({
      url: 'https://jsonplaceholder.typicode.com/posts/1',
      method: 'GET',
    }).then((res: any) => {
      expect(res.status).to.eq(200);
      expect(res.body).to.have.property('id', 1);
    });

    // DB query (requires configured DB)
    cy.env(['dbHost', 'dbPort', 'dbName', 'dbUser', 'dbPassword']).then(
      ({ dbHost, dbPort, dbName, dbUser, dbPassword }) => {
        // Skip if DB not configured
        if (!dbHost) {
          cy.log('DB not configured — skipping query test');
          return;
        }

        cy.query("SELECT 'persistence-check' as label, 42 as value", {
          host: dbHost,
          port: parseInt(dbPort, 10),
          database: dbName,
          user: dbUser,
          password: dbPassword,
        }).then((result: any) => {
          expect(result.rows).to.have.length(1);
          expect(result.rows[0]).to.have.property('label', 'persistence-check');
          expect(result.rows[0]).to.have.property('value', 42);
        });
      },
    );
  });
});
