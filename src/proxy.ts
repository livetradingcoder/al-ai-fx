import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { withAuth } from "next-auth/middleware";
import createIntlMiddleware from 'next-intl/middleware';
import {routing} from './i18n/routing';

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
  
  if (isStateMutatingMethod && !isWebhook) {
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
    
    // Skip next-intl for API routes
    if (!req.nextUrl.pathname.startsWith('/api/')) {
      return intlMiddleware(req);
    }
    
    return NextResponse.next();
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
