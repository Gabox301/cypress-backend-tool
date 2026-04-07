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
import 'cypress-backend-tool';
```

### 2. Configurar cypress.config.ts

```typescript
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      return config;
    },
  },
});
```

### 3. Variables de entorno (opcional)

Crea un archivo `.env` en la raíz de tu proyecto:

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

### Cypress.expose()

Opciones configurables en `cypress.config.ts`:

```typescript
export default defineConfig({
  e2e: {
    expose: {
      // Oculta la UI después de ejecutar el comando
      snapshotOnly: false,

      // Oculta credenciales en la UI
      hideCredentials: false,

      // Activa logs de diagnóstico en consola
      CYPRESS_PLUGIN_DEBUG: false,

      // Personaliza qué credenciales ocultar
      hideCredentialsOptions: {
        headers: ['authorization', 'x-api-key', 'cookie'],
        auth: ['password', 'pass'],
        body: ['password', 'secret', 'token', 'api_key', 'apikey'],
        query: ['password', 'secret', 'token'],
      },
    },
  },
});
```

### Tabla de opciones

| Opción                   | Tipo    | Default      | Descripción                      |
| ------------------------ | ------- | ------------ | -------------------------------- |
| `snapshotOnly`           | boolean | `false`      | Oculta la UI después de ejecutar |
| `hideCredentials`        | boolean | `false`      | Oculta credenciales en la UI     |
| `CYPRESS_PLUGIN_DEBUG`   | boolean | `false`      | Activa logs de diagnóstico       |
| `hideCredentialsOptions` | object  | (ver arriba) | Configuración de sanitización    |

## Desarrollo

```bash
# Instalar dependencias
npm install

# Build del paquete
npm run build

# Ejecutar tests
npm run test

# Abrir Cypress en modo interactivo
npm run cy
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

### 1.0.0

- UI integrada para HTTP requests y PostgreSQL queries
- Componentes Svelte para la UI
- Soporte para `cy.http()` y `cy.query()`
- Sanitización automática de credenciales
- Compatible con Cypress 15.10.0+

## Licencia

MIT
