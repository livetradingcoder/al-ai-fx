import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
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

export const config = {
  matcher: [
    '/api/:path*',
    '/dashboard/:path*'
  ],
};
