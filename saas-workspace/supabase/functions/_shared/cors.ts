const allowedOrigins = new Set([
  'https://app.realtymedia.ro',
  'http://localhost:8082',
  'http://localhost:8081',
  'http://localhost:19006',
]);

export function corsHeaders(request: Request) {
  const origin = request.headers.get('origin') ?? '';
  const configuredOrigin = Deno.env.get('REALTY_MEDIA_WEB_URL')?.replace(/\/$/, '');
  const permitted =
    allowedOrigins.has(origin) || (configuredOrigin && origin === configuredOrigin);
  const fallbackOrigin =
    configuredOrigin ??
    allowedOrigins.values().next().value ??
    'https://app.realtymedia.ro';

  return {
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, x-instagram-sync-secret, x-tiktok-sync-secret',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Origin': permitted ? origin : fallbackOrigin,
    Vary: 'Origin',
  };
}

export function json(
  request: Request,
  body: unknown,
  status = 200,
) {
  return new Response(JSON.stringify(body), {
    headers: {
      ...corsHeaders(request),
      'Content-Type': 'application/json; charset=utf-8',
    },
    status,
  });
}
