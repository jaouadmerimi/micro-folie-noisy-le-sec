declare global {
  interface Window { MICRO_FOLIE_CONFIG?: { basePath: string; apiBase: string } }
}
export function sitePath(path = '/') {
  return (typeof window !== 'undefined' ? window.MICRO_FOLIE_CONFIG?.basePath ?? '' : '') + path;
}
export function apiPath(path: string) {
  return (typeof window !== 'undefined' ? window.MICRO_FOLIE_CONFIG?.apiBase ?? '/api' : '/api') + '/' + path;
}
