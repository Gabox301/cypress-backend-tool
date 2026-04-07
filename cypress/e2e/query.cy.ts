describe('cypress-backend-tool - Smoke Test (cy.query)', () => {
  it('Query (pg) con UI', () => {
    const testQuery = "SELECT 'Hello World' as message, NOW() as timestamp, 42 as number";
    cy.env(['dbHost', 'dbPort', 'dbName', 'dbUser', 'dbPassword']).then(
      ({ dbHost, dbPort, dbName, dbUser, dbPassword }) => {
        cy.log(`Using config: ${dbHost}:${dbPort}/${dbName}`);
        cy.query(testQuery, {
          host: dbHost,
          port: parseInt(dbPort, 10),
          database: dbName,
          user: dbUser,
          password: dbPassword,
        }).then((result: any) => {
          cy.log(`Query result: ${JSON.stringify(result)}`);
        });
      },
    );
  });
});
