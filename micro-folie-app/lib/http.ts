import { apiPath } from './urls';
const sessionKey = 'micro-folie.admin.session';
export async function apiFetch(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  const token = sessionStorage.getItem(sessionKey);
  if (token) headers.set('Authorization', 'Bearer ' + token);
  const response = await fetch(apiPath(path), { ...options, headers, credentials: 'omit' });
  const nextToken = response.headers.get('set-auth-token');
  if (nextToken && response.ok) sessionStorage.setItem(sessionKey, nextToken);
  if (response.status === 401 || (path === 'auth/sign-out' && response.ok)) sessionStorage.removeItem(sessionKey);
  return response;
}
export async function api(path: string, data?: unknown): Promise<any> {
  const response = await apiFetch(path, {
    method: data === undefined ? 'GET' : 'POST',
    headers: data === undefined ? {} : { 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const result: any = await response.json();
  if (!response.ok)
    throw new Error(
      result.error?.message ??
        result.error ??
        result.message ??
        'Action impossible. Réessayez.',
    );
  return result;
}
