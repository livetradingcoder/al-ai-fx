import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuth } from "next-auth/middleware";
import createIntlMiddleware from 'next-intl/middleware';
import {routing} from './i18n/routing';

// Referral capture. The short link /r/CODE does the full job (click log +
// cookie), but affiliates also paste plain URLs with ?ref=CODE onto pages we
// don't control, so any request carrying one drops the cookie here. Middleware
// runs on the edge and cannot touch the database, hence cookie only — the code
// is validated later, when it is turned into a Referral row.
const REF_COOKIE = 'alx_ref';
const REF_PARAMS = ['ref', 'aff', 'affiliate', 'referral', 'referralCode'];
const REF_COOKIE_DAYS = 30;

function refCodeFrom(req: NextRequest) {
  for (const param of REF_PARAMS) {
    const value = req.nextUrl.searchParams.get(param);
    if (value) {
      const code = value.trim().toUpperCase().slice(0, 32);
      if (/^[A-Z0-9]{4,32}$/.test(code)) return code;
    }
  }
  return null;
}

function withRefCookie(res: NextResponse, code: string | null) {
  if (!code) return res;
  res.cookies.set(REF_COOKIE, code, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: REF_COOKIE_DAYS * 86_400,
  });
  return res;
}

const intlMiddleware = createIntlMiddleware(routing);

// CSRF Protection Middleware
function csrfMiddleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip CSRF check for:
  // 1. GET, HEAD, OPTIONS requests (safe methods)
  // 2. NextAuth callbacks
  // 3. Webhook endpoints (they use their own authentication)
  const isStateMutatingMethod = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method);
  const isWebhook = pathname.startsWith('/api/webhooks/');
  const isNextAuth = pathname.startsWith('/api/auth/');
  // Deliberately cross-origin: consumed by the education site
  // (algotradingschool.com). Not a CSRF target — no cookies/session are read
  // or mutated, and the route rate-limits per IP and sets its own CORS headers.
  const isPublicCrossOrigin = pathname === '/api/marketing/subscribe';

  if (isStateMutatingMethod && !isWebhook && !isPublicCrossOrigin) {
    // Check Origin header for CSRF protection
    const requestOrigin = request.headers.get('origin');
    const host = request.headers.get('host');
    
    // For API routes (except webhooks), verify same-origin
    if (pathname.startsWith('/api/') && !isNextAuth) {
      // Allow requests from same origin or if no origin header (same-origin requests from forms)
      if (requestOrigin && host) {
        const requestUrl = new URL(requestOrigin);
        const expectedHost = host.split(':')[0]; // Remove port for comparison
        const actualHost = requestUrl.hostname;
        
        if (actualHost !== expectedHost && !actualHost.endsWith(`.${expectedHost}`)) {
          console.warn(`[CSRF] Blocked cross-origin request from ${requestOrigin} to ${host}`);
          return new NextResponse(
            JSON.stringify({ error: 'Forbidden: Invalid origin' }), 
            { 
              status: 403,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        }
      }
    }
  }
  
  return NextResponse.next();
}

// Combine CSRF protection with NextAuth
export default withAuth(
  function middleware(req) {
    // Run CSRF check first
    const csrfResponse = csrfMiddleware(req);
    if (csrfResponse.status === 403) {
      return csrfResponse;
    }
    
    const refCode = refCodeFrom(req);

    // Skip next-intl for API routes and for /r/<code> — the referral link is a
    // route handler, not a page, so a locale rewrite turns it into a 404.
    const skipIntl =
      req.nextUrl.pathname.startsWith('/api/') || req.nextUrl.pathname.startsWith('/r/');

    if (!skipIntl) {
      return withRefCookie(intlMiddleware(req), refCode);
    }

    return withRefCookie(NextResponse.next(), refCode);
  },
  {
    secret: process.env.NEXTAUTH_SECRET,
    callbacks: {
      authorized: ({ req, token }) => {
        // Admin route protection
        if (req.nextUrl.pathname.startsWith('/admin')) {
          return token?.role === "ADMIN";
        }
        // Dashboard route protection
        if (req.nextUrl.pathname.startsWith('/dashboard')) {
          return !!token;
        }
        return true;
      },
    },
  }
);

export const config = {
  matcher: [
    '/',
    '/(en|hi|bn|ur|ar|de|es)/:path*',
    '/((?!api|_next|_vercel|.*\\..*).*)',
    '/api/:path*'
  ],
};
