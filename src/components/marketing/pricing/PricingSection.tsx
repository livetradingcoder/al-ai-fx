import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, KeyRound, Layers, Sparkles, Zap } from "lucide-react";

import NotifyMeForm from "@/components/marketing/NotifyMeForm";
import type { PricingCatalog } from "@/lib/pricing-catalog";
import { loadPricingCatalog } from "@/lib/pricing-data";
import PricingExplorer from "./PricingExplorer";
import { PRICING_LABEL_DEFAULTS, type PricingLabels } from "./labels";
import "./pricing.css";

// The database is the only source of the prices and trials shown here, but the
// homepage must not wait on it: after this long the section falls back to a
// link to the catalog.
const CATALOG_TIMEOUT_MS = 4000;

async function loadCatalogOrNull() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      loadPricingCatalog(),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), CATALOG_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** The section as it is drawn once its data is in; split out so it can be rendered from fixtures. */
export function PricingSectionView({ catalog, labels }: { catalog: PricingCatalog | null; labels: PricingLabels }) {
  return (
    <section id="pricing" className="landing-section px-section">
      <div className="landing-container">
        <div className="section-heading px-heading">
          <span className="landing-eyebrow">{labels.pricingEyebrow}</span>
          <h2 className="section-title">
            {labels.pricingTitleLead}
            <span> {labels.pricingTitleAccent}</span>
          </h2>
          <p className="section-copy">{labels.pricingIntro}</p>
        </div>

        {catalog ? (
          <PricingExplorer robots={catalog.robots} defaultSlug={catalog.defaultSlug} labels={labels} />
        ) : (
          <div className="px-fallback">
            <h3>{labels.pricingUnavailableTitle}</h3>
            <p>{labels.pricingUnavailableCopy}</p>
            <Link href="/catalog" className="px-cta is-primary">
              {labels.pricingUnavailableCta}
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        )}

        <ul className="px-trust">
          <li>
            <KeyRound size={16} aria-hidden="true" />
            {labels.pricingTrustLocked}
          </li>
          <li>
            <Zap size={16} aria-hidden="true" />
            {labels.pricingTrustDelivery}
          </li>
          <li>
            <Image src="/brand/metatrader-5.png" alt="" width={16} height={16} />
            {labels.pricingTrustMt5}
          </li>
        </ul>

        <aside className="px-soon" aria-label={labels.pricingPayAfterTitle}>
          <div className="px-soon-copy">
            <h3>
              {labels.pricingPayAfterTitle}
              <span className="px-chip">
                <Sparkles size={12} aria-hidden="true" />
                {labels.pricingPayAfterSoon}
              </span>
            </h3>
            <p className="px-soon-hook">{labels.pricingPayAfterHook}</p>
            <p>{labels.pricingPayAfterCopy}</p>
          </div>
          <div className="px-soon-form">
            <NotifyMeForm source="al-ai-fx:pay-after-trial" />
          </div>
        </aside>

        <div className="px-more">
          <Link href="/licensing" className="px-more-link">
            <KeyRound size={18} aria-hidden="true" />
            <span>
              <strong>{labels.pricingMoreLicensingTitle}</strong>
              <small>{labels.pricingMoreLicensingCta}</small>
            </span>
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link href="/catalog" className="px-more-link">
            <Layers size={18} aria-hidden="true" />
            <span>
              <strong>{labels.pricingMoreCatalogTitle}</strong>
              <small>{labels.pricingMoreCatalogCta}</small>
            </span>
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}

export default async function PricingSection() {
  const [t, catalog] = await Promise.all([getTranslations("Landing"), loadCatalogOrNull()]);

  // The translation when this language has the key, the English default when it doesn't.
  // `raw` hands back the template untouched; the {placeholders} are filled by the components.
  const labels = Object.fromEntries(
    Object.entries(PRICING_LABEL_DEFAULTS).map(([key, fallback]) => [
      key,
      t.has(key as never) ? String(t.raw(key as never)) : fallback,
    ]),
  ) as PricingLabels;

  return <PricingSectionView catalog={catalog} labels={labels} />;
}
