import type { ApiCall, DbConnection, DbQuery } from './types';

// Estados globales reactivos usando Svelte 5 runes

export const apiCalls = $state<ApiCall[]>([]);
export const dbQueries = $state<DbQuery[]>([]);
export const dbConnectionsGlobal = $state<DbConnection[]>([]);
export const activeTab = $state<string | null>(null);
export const isLoading = $state(false);

// Funciones helper para manipular el estado
export function addApiCall(call: ApiCall) {
  apiCalls.push(call);
}

export function addDbQuery(query: DbQuery) {
  dbQueries.push(query);
}

export function addDbConnection(conn: DbConnection) {
  dbConnectionsGlobal.push(conn);
}

export function removeDbConnection(id: string) {
  const index = dbConnectionsGlobal.findIndex((c) => c.id === id);
  if (index !== -1) {
    dbConnectionsGlobal.splice(index, 1);
  }
}

export function updateDbConnection(id: string, updates: Partial<DbConnection>) {
  const conn = dbConnectionsGlobal.find((c) => c.id === id);
  if (conn) {
    Object.assign(conn, updates);
  }
}
