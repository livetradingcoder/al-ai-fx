import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // The country database reads its .dat files from its own folder at run time;
  // bundled, those paths would point nowhere.
  serverExternalPackages: ["geoip-country"],
  // The public affiliate page moved from /refer to /affiliates. Keep old
  // links, bookmarks and search results working (referral links themselves
  // use /r/CODE and ?ref=CODE, which are unaffected).
  async redirects() {
    return [
      { source: "/refer", destination: "/affiliates", permanent: true },
      {
        source: "/:locale(en|hi|bn|ur|ar|de|es)/refer",
        destination: "/:locale/affiliates",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          },
          {
            key: 'Content-Security-Policy',
            // nDesk support chat needs four of these: the loader script, its
            // stylesheet and fonts from the CDN, its API and websocket for live
            // messages, and a frame because the chat UI renders in an iframe.
            // Without them the loader is blocked and the bubble never appears.
            // The Meta pixel loads fbevents.js from connect.facebook.net
            // (script-src), reports through www.facebook.com — an image request
            // normally, a beacon or fetch when the payload is larger, which is
            // what connect-src is for — and uses a facebook.com frame. The tutorial
            // video is a click-to-load youtube-nocookie.com embed (frame-src).
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://connect.facebook.net https://cdn.ndesk.chat; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.ndesk.chat; img-src 'self' data: https:; font-src 'self' data: https://fonts.gstatic.com https://cdn.ndesk.chat; connect-src 'self' https://api.paygate.to https://checkout.paygate.to https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://connect.facebook.net https://www.facebook.com https://*.ndesk.chat wss://*.ndesk.chat; frame-src 'self' https://www.googletagmanager.com https://checkout.paygate.to https://www.facebook.com https://*.ndesk.chat https://www.youtube-nocookie.com;"
          }
        ]
      }
    ];
  }
};
export default withNextIntl(nextConfig);
