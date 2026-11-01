export type Row = { id: string; [key: string]: unknown };
// Tokens live only in memory: reload requires login and no legacy demo session is accepted.
let token = '';
export function setToken(value: string) { token = value; }
export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (response.status === 401) window.dispatchEvent(new Event('session-expired'));
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || (response.status === 401 ? 'Entre novamente para continuar.' : 'Não foi possível concluir a operação.'));
  }
  return response.status === 204 ? undefined as T : response.json();
}
