import { getMarketingConfig } from "@/lib/marketing";

/**
 * Google's Tag Manager loader, rendered as a plain inline <script> at the top
 * of <head>. next/script would inject it from client JS instead, which leaves
 * it out of the served HTML — and Tag Manager's install check reads the HTML.
 */
export default function GtmHeadScript() {
  const { gtmId } = getMarketingConfig();

  if (!gtmId) {
    return null;
  }

  return (
    // @next/third-parties injects from client JS too, so the check misses it.
    // eslint-disable-next-line @next/next/next-script-for-ga
    <script
      id="gtm-init"
      dangerouslySetInnerHTML={{
        __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${gtmId}');`,
      }}
    />
  );
}
