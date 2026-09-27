import { getMarketingConfig } from "@/lib/marketing";

/**
 * The Tag Manager <noscript> fallback, rendered immediately after <body> as
 * Google asks. It only matters for visitors with JavaScript disabled — the
 * loader in MarketingScripts covers everyone else.
 */
export default function GtmNoScript() {
  const { gtmId } = getMarketingConfig();

  if (!gtmId) {
    return null;
  }

  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
        height="0"
        width="0"
        style={{ display: "none", visibility: "hidden" }}
        title="Google Tag Manager"
      />
    </noscript>
  );
}
