import Script from "next/script";

import { getMarketingConfig } from "@/lib/marketing";

export default function MarketingScripts() {
  const config = getMarketingConfig();

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
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${config.metaPixelId}');
          `}
        </Script>
      ) : null}
    </>
  );
}
