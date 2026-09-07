export async function api(path: string, data?: unknown): Promise<any> {
  const response = await fetch('/api/' + path, {
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
