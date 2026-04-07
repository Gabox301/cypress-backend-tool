import { defineConfig } from 'cypress';
import fs from 'fs';
import path from 'path';
import pg from 'pg';

const themeFilePath = path.join(process.cwd(), 'cypress-theme.json');
const envFilePath = path.join(process.cwd(), '.env');

function loadEnvFile(): Record<string, string> {
  const env: Record<string, string> = {};
  try {
    if (fs.existsSync(envFilePath)) {
      const content = fs.readFileSync(envFilePath, 'utf-8');
      content.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx > 0) {
            const key = trimmed.slice(0, eqIdx).trim();
            let val = trimmed.slice(eqIdx + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            env[key] = val;
          }
        }
      });
    }
  } catch {}
  return env;
}

const envVars = loadEnvFile();

function loadSavedTheme(): any {
  try {
    if (fs.existsSync(themeFilePath)) {
      return JSON.parse(fs.readFileSync(themeFilePath, 'utf-8'));
    }
  } catch {}
  return null;
}

function saveThemeToFile(theme: any): void {
  try {
    fs.writeFileSync(themeFilePath, JSON.stringify(theme, null, 2));
  } catch {}
}

export default defineConfig({
  e2e: {
    allowCypressEnv: false,
    setupNodeEvents(on, config) {
      on('task', {
        'db:query': async ({ query, host, port, database, user, password }: any) => {
          const { Pool } = pg;
          const pool = new Pool({ host, port, database, user, password });
          const result = await pool.query(query);
          await pool.end();
          return { rows: result.rows, rowCount: result.rowCount };
        },
        'theme:load': () => {
          return loadSavedTheme();
        },
        'theme:save': ({ theme }) => {
          saveThemeToFile(theme);
          return true;
        },
        'db:getConfig': () => {
          return {
            host: envVars.CYPRESS_DB_HOST || 'localhost',
            port: parseInt(envVars.CYPRESS_DB_PORT || '5432', 10),
            database: envVars.CYPRESS_DB_NAME || 'test_db',
            user: envVars.CYPRESS_DB_USER || 'postgres',
            password: envVars.CYPRESS_DB_PASSWORD || '',
          };
        },
        'ui:loadBundle': () => {
          try {
            const projectRoot = process.cwd();
            const bundlePath = path.join(projectRoot, 'dist', 'ui', 'ui.js');
            if (fs.existsSync(bundlePath)) {
              const code = fs.readFileSync(bundlePath, 'utf8');
              return { code, size: code.length };
            }
            const pkgPath = path.join(projectRoot, 'node_modules', 'cypress-backend-tool', 'dist', 'ui', 'ui.js');
            if (fs.existsSync(pkgPath)) {
              const code = fs.readFileSync(pkgPath, 'utf8');
              return { code, size: code.length };
            }
            return { code: null, size: 0 };
          } catch (err: any) {
            return { code: null, size: 0, error: err.message };
          }
        },
      });
      return config;
    },
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    expose: {
      snapshotOnly: false,
      hideCredentials: false,
      CYPRESS_PLUGIN_DEBUG: false,
      dbHost: envVars.CYPRESS_DB_HOST || 'localhost',
      dbPort: envVars.CYPRESS_DB_PORT || '5432',
      dbName: envVars.CYPRESS_DB_NAME || 'test_db',
      dbUser: envVars.CYPRESS_DB_USER || 'postgres',
      dbPassword: envVars.CYPRESS_DB_PASSWORD || '',
      hideCredentialsOptions: {
        headers: ['authorization', 'x-api-key', 'cookie'],
        auth: ['password', 'pass'],
        body: ['password', 'secret', 'token', 'api_key', 'apikey'],
        query: ['password', 'secret', 'token'],
      },
    },
    env: {
      dbHost: process.env.CYPRESS_DB_HOST || 'localhost',
      dbPort: process.env.CYPRESS_DB_PORT || '5432',
      dbName: process.env.CYPRESS_DB_NAME || 'test_db',
      dbUser: process.env.CYPRESS_DB_USER || 'postgres',
      dbPassword: process.env.CYPRESS_DB_PASSWORD || '',
    },
    video: false,
    screenshotOnRunFailure: false,
  },
});
