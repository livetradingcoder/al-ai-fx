import Script from "next/script";

import { CONSENT_COOKIE, CONSENT_STORAGE_KEY, buildAskFirstScript } from "@/lib/consent";
import { getMarketingConfig } from "@/lib/marketing";

export default function MarketingScripts() {
  const config = getMarketingConfig();
  // The built-in pixel ID is the live site's, so the snippet only runs on the
  // live site: a local or preview build must not write into its data. Setting
  // NEXT_PUBLIC_META_PIXEL_ID says "use this one", and lifts that limit.
  const pixelOnAnyHost = Boolean(process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim());

  return (
    <>
      {config.googleAdsId ? (
        <>
          <Script
            id="google-ads-src"
            src={`https://www.googletagmanager.com/gtag/js?id=${config.googleAdsId}`}
            strategy="afterInteractive"
          />
          <Script id="google-ads-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = gtag;
              gtag('js', new Date());
              gtag('config', '${config.googleAdsId}', { send_page_view: false });
            `}
          </Script>
        </>
      ) : null}
      {config.metaPixelId ? (
        <Script id="meta-pixel-init" strategy="afterInteractive">
          {`
            (function () {
              if (!${pixelOnAnyHost} && !/(^|\\.)al-ai-fx\\.xyz$/.test(location.hostname)) return;
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              // The visitor's own choice wins. Without one, Europe waits for an
              // accept (ConsentBanner grants it later) and everywhere else the
              // pixel is on until the visitor turns it off in Cookie settings.
              var consent = null;
              try { consent = localStorage.getItem('${CONSENT_STORAGE_KEY}'); } catch (e) {}
              if (consent !== 'granted' && consent !== 'denied') {
                ${buildAskFirstScript()}
                if (!askFirst) consent = 'granted';
              }
              // The server cannot read localStorage, and it decides whether
              // anything goes to the Conversions API: keep a cookie copy of the choice.
              if (consent === 'granted' || consent === 'denied') {
                try {
                  document.cookie = '${CONSENT_COOKIE}=' + consent + '; Max-Age=31536000; Path=/; SameSite=Lax' +
                    (location.protocol === 'https:' ? '; Secure' : '');
                } catch (e) {}
              }
              fbq('consent', consent === 'granted' ? 'grant' : 'revoke');
              fbq('init', '${config.metaPixelId}');
              // Which pixel the page's own events must address (marketing-client).
              window.__metaPixelId = '${config.metaPixelId}';
            })();
          `}
        </Script>
      ) : null}
    </>
  );
}
