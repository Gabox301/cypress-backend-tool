# cypress-backend-tool

<p align="center">
  <a href="https://www.npmjs.com/package/cypress-backend-tool">
    <img src="https://img.shields.io/npm/v/cypress-backend-tool" alt="npm version">
  </a>
  <a href="https://www.npmjs.com/package/cypress-backend-tool">
    <img src="https://img.shields.io/npm/dm/cypress-backend-tool" alt="npm downloads">
  </a>
  <a href="https://github.com/Gabox301/cypress-backend-tool/blob/master/LICENSE">
    <img src="https://img.shields.io/npm/l/cypress-backend-tool" alt="license">
  </a>
</p>

Plugin de Cypress para testing de APIs HTTP y consultas a bases de datos PostgreSQL con UI visual integrada en el runner.

## Características

- **UI integrada**: Panel visual para ver requests y respuestas HTTP
- **Soporte PostgreSQL**: Ejecuta queries SQL directamente desde Cypress
- **Sanitización de credenciales**: Oculta datos sensibles en la UI automáticamente
- **API moderna**: Usa las APIs `Cypress.expose()` y `cy.env()` de Cypress 15.10.0+

## Requisitos

- Node.js >= 22
- Cypress >= 15.10.0

## Instalación

```bash
npm install cypress-backend-tool
# o
yarn add cypress-backend-tool
```

## Configuración

### 1. Importar el plugin

```typescript
// cypress/support/e2e.ts
import 'cypress-backend-tool'; // Auto-init: registra cy.http() y cy.query()
```

Nada más. Sin `init()`, sin configuración adicional.

### 2. Configurar cypress.config.ts

```typescript
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      return config;
    },
    // Configuración del plugin vía Cypress.expose()
    expose: {
      snapshotOnly: false, // Colapsa la UI tras cada comando
      hideCredentials: true, // Oculta contraseñas/tokens en la UI
      hideCredentialsOptions: {
        // Qué secciones sanitizar
        headers: true,
        auth: true,
        body: true,
        query: true,
      },
      requestMode: 'auto', // 'auto' o 'manual'
      CYPRESS_PLUGIN_DEBUG: false, // Logs de diagnóstico
    },
  },
});
```

### 3. Credenciales de base de datos

Usa `cy.env()` (moderno, seguro) en vez de `Cypress.env()` (deprecado):

```typescript
// cypress.config.ts
export default defineConfig({
  e2e: {
    env: {
      dbHost: 'localhost',
      dbPort: '5432',
      dbName: 'tu_base_de_datos',
      dbUser: 'tu_usuario',
      dbPassword: 'tu_password',
    },
  },
});
```

O desde un archivo `.env`:

```env
CYPRESS_DB_HOST=localhost
CYPRESS_DB_PORT=5432
CYPRESS_DB_NAME=tu_base_de_datos
CYPRESS_DB_USER=tu_usuario
CYPRESS_DB_PASSWORD=tu_password
```

## Uso

### cy.http() - Testing de APIs HTTP

```typescript
// Request básico
cy.http({
  url: 'https://api.example.com/users',
  method: 'GET',
}).then((response) => {
  expect(response.status).to.eq(200);
});

// Con headers y body
cy.http({
  url: 'https://api.example.com/users',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: 'Bearer tu_token',
  },
  body: {
    name: 'John Doe',
    email: 'john@example.com',
  },
}).then((response) => {
  expect(response.body).to.have.property('id');
});
```

### cy.query() - Consultas PostgreSQL

```typescript
// Sin argumentos - usa las credenciales del .env
cy.query('SELECT * FROM users LIMIT 10').then((result) => {
  expect(result.rows).to.have.length.greaterThan(0);
  console.log(result.rows);
});

// Con argumentos explícitos
cy.query('SELECT * FROM users WHERE id = $1', {
  host: 'localhost',
  port: 5432,
  database: 'mydb',
  user: 'postgres',
  password: 'secret',
}).then((result) => {
  console.log(result.rows);
});
```

## Configuración avanzada

### Cypress.expose() — Opciones

```typescript
// cypress.config.ts
export default defineConfig({
  e2e: {
    expose: {
      // Colapsa la UI tras ejecutar (útil para screenshots limpios)
      snapshotOnly: false,
      // Activa sanitización de credenciales en la UI
      hideCredentials: false,
      // Control granular por sección (booleans, no arrays)
      hideCredentialsOptions: {
        headers: true, // Oculta Authorization, X-API-Key, etc.
        auth: true, // Oculta passwords en Auth tab
        body: true, // Oculta password, token, secret en body
        query: true, // Oculta params sensibles en query string
      },
      // Modo de visualización: 'auto' (muestra UI en cada request) o 'manual'
      requestMode: 'auto',
      // Logs de diagnóstico en consola
      CYPRESS_PLUGIN_DEBUG: false,
    },
  },
});
```

### Tabla de opciones

| Opción                   | Tipo                                 | Default      | Descripción                         |
| ------------------------ | ------------------------------------ | ------------ | ----------------------------------- |
| `snapshotOnly`           | `boolean`                            | `false`      | Colapsa la UI tras cada comando     |
| `hideCredentials`        | `boolean`                            | `false`      | Activa sanitización de credenciales |
| `hideCredentialsOptions` | `{headers,auth,body,query: boolean}` | Todas `true` | Control granular por sección        |
| `requestMode`            | `'auto' \| 'manual'`                 | `'auto'`     | Muestra UI automáticamente o no     |
| `CYPRESS_PLUGIN_DEBUG`   | `boolean`                            | `false`      | Logs de diagnóstico                 |

### Runtime overrides

Podés cambiar la config en plena ejecución con `Cypress.expose()`:

```typescript
beforeEach(() => {
  Cypress.expose({ snapshotOnly: true }); // Colapsar UI en todos los tests
});

it('test específico', () => {
  Cypress.expose({ hideCredentials: false }); // Mostrar credenciales solo aquí
  cy.http({ url: '...', method: 'GET' });
});
```

## Desarrollo

```bash
# Instalar dependencias
npm install

# Build del paquete
npm run build

# Todos los tests
npm test

# Linter
npm run lint

# Type check
npm run check
```

## API de respuesta

### ApiResponse

```typescript
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
```

### DbQueryResponse

```typescript
interface DbQueryResponse {
  rows: unknown[];
  rowCount: number;
  duration: number;
  query: string;
}
```

## Changelog

### 1.0.2

- **Configuración simplificada**: `hideCredentialsOptions` ahora usa booleanos por sección (`headers: true`) en vez de arrays de strings
- **Auto-init**: `import 'cypress-backend-tool'` registra comandos automáticamente, sin `init()`
- **Single build**: Un solo archivo `dist/index.js`, sin subcarpetas
- **ESLint**: Agregado linter con reglas para TypeScript + Svelte 5
- **Tests unitarios**: 98 tests con vitest + @testing-library/svelte (97% coverage)
- **Sanitización**: Credenciales de BD ahora usan `cy.task()` exclusivamente, nunca `Cypress.expose()`
- **`snapshotOnly`**: Colapsa la UI con clase CSS en vez de desmontar componentes

### 1.0.1

- Modernización de Svelte

### 1.0.0

- UI integrada para HTTP requests y PostgreSQL queries
- Componentes Svelte para la UI
- Soporte para `cy.http()` y `cy.query()`
- Sanitización automática de credenciales
- Compatible con Cypress 15.10.0+

## Licencia

MIT
