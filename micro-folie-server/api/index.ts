import { handle } from '../lib/handler.ts';

export default {
  async fetch(request: Request) {
    const origin = request.headers.get('origin');
    const allowedOrigin = new URL(process.env.SITE_URL!).origin;
    const headers = new Headers({
      'Cache-Control': 'no-store', 'Vary': 'Origin',
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
    });
    if (origin && origin !== allowedOrigin) {
      return Response.json({ error: 'Origine de la demande refusée.' }, { status: 403, headers });
    }
    if (origin === allowedOrigin) {
      headers.set('Access-Control-Allow-Origin', allowedOrigin);
      headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      headers.set('Access-Control-Expose-Headers', 'set-auth-token');
    }
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (!['GET', 'POST'].includes(request.method)) return new Response(null, { status: 405, headers });
    // Only the platform's trusted forwarded address participates in rate limits.
    const inputHeaders = new Headers(request.headers);
    inputHeaders.set('cf-connecting-ip', request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() || 'shared');
    const response = await handle(new Request(request, { headers: inputHeaders }));
    const outputHeaders = new Headers(response.headers);
    headers.forEach((value, key) => outputHeaders.set(key, value));
    // GitHub Pages uses signed Bearer sessions; third-party cookies are unnecessary.
    outputHeaders.delete('set-cookie');
    return new Response(response.body, { status: response.status, headers: outputHeaders });
  },
};
