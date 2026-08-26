import { NextResponse, type NextRequest } from 'next/server';

// CORS / origin allowlist for the API. In production the browser API can only be
// called from https://melofy.temi.codes; in dev, from localhost. Override with a
// comma-separated ALLOWED_ORIGINS env var if you add domains later.
//
// Notes:
// - Requests with NO Origin header (server-to-server, curl, and the browser
//   extension's background fetches, which bypass CORS via host_permissions) are
//   NOT blocked — CORS can't police those anyway, and the extension needs them.
// - chrome-extension:// origins are allowed so the Melofy extension keeps working
//   across dev/published builds.
const DEV_ORIGINS = ['http://localhost:3009', 'http://127.0.0.1:3009'];

function allowedOrigins(): string[] {
  const env = process.env.ALLOWED_ORIGINS;
  if (env) return env.split(',').map((o) => o.trim()).filter(Boolean);
  return process.env.NODE_ENV === 'production'
    ? ['https://melofy.temi.codes']
    : DEV_ORIGINS;
}

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true; // non-browser caller (server/curl/extension bg) — CORS N/A
  if (origin.startsWith('chrome-extension://')) return true; // our browser extension
  return allowedOrigins().includes(origin);
}

function withCors(res: NextResponse, origin: string | null): NextResponse {
  if (origin && isAllowedOrigin(origin)) {
    res.headers.set('Access-Control-Allow-Origin', origin);
    res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.headers.set('Access-Control-Max-Age', '86400');
    res.headers.append('Vary', 'Origin');
  }
  return res;
}

export function middleware(req: NextRequest) {
  const origin = req.headers.get('origin');

  // Preflight
  if (req.method === 'OPTIONS') {
    return isAllowedOrigin(origin)
      ? withCors(new NextResponse(null, { status: 204 }), origin)
      : new NextResponse(null, { status: 403 });
  }

  // Block cross-origin browser calls from disallowed origins. (No-Origin requests
  // fall through — see the note above.)
  if (origin && !isAllowedOrigin(origin)) {
    return NextResponse.json({ error: 'Origin not allowed' }, { status: 403 });
  }

  return withCors(NextResponse.next(), origin);
}

export const config = {
  matcher: '/api/:path*',
};
