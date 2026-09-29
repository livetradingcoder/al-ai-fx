import test from "node:test";
import assert from "node:assert/strict";

import {
  breadcrumbJsonLd,
  buildLocalizedUrl,
  buildMetadata,
  getPageMetadata,
  getPublicSitemapEntries,
  jsonLdScript,
  noIndexMetadata,
  robotProductJsonLd,
} from "./seo";

test("buildLocalizedUrl keeps the default locale unprefixed", () => {
  assert.equal(buildLocalizedUrl("en", "/faq"), "https://www.al-ai-fx.xyz/faq");
  assert.equal(buildLocalizedUrl("en", "/"), "https://www.al-ai-fx.xyz/");
});

test("buildLocalizedUrl prefixes non-default locales", () => {
  assert.equal(buildLocalizedUrl("de", "/faq"), "https://www.al-ai-fx.xyz/de/faq");
  assert.equal(buildLocalizedUrl("ar", "/"), "https://www.al-ai-fx.xyz/ar");
});

test("checkout metadata is crawlable but not indexable", () => {
  const metadata = getPageMetadata("checkout", "es");
  const robots =
    metadata.robots && typeof metadata.robots === "object" && !Array.isArray(metadata.robots)
      ? metadata.robots
      : null;

  assert.equal(metadata.alternates?.canonical, "https://www.al-ai-fx.xyz/es/checkout");
  assert.equal(robots?.index, false);
  assert.equal(robots?.follow, true);
});

test("faq metadata exposes locale alternates and x-default", () => {
  const metadata = getPageMetadata("faq", "de");
  const languages = metadata.alternates?.languages;

  assert.equal(metadata.alternates?.canonical, "https://www.al-ai-fx.xyz/de/faq");
  assert.equal(languages?.de, "https://www.al-ai-fx.xyz/de/faq");
  assert.equal(languages?.en, "https://www.al-ai-fx.xyz/faq");
  assert.equal(languages?.["x-default"], "https://www.al-ai-fx.xyz/faq");
});

test("home metadata uses a share-safe og image", () => {
  const metadata = getPageMetadata("home", "en");
  const images = metadata.openGraph?.images;
  const image = Array.isArray(images) ? images[0] : images;

  assert.equal(typeof image === "string" ? image : (image as any)?.url, "https://www.al-ai-fx.xyz/og/goldbot-share-1200x630.jpg");
  assert.equal((metadata.twitter as any)?.card, "summary_large_image");
});

test("public sitemap entries cover every locale and public page", () => {
  const entries = getPublicSitemapEntries();
  const homeEntry = entries.find((entry) => entry.url === "https://www.al-ai-fx.xyz/");
  const germanSupportEntry = entries.find(
    (entry) => entry.url === "https://www.al-ai-fx.xyz/de/support",
  );
  const checkoutEntry = entries.find(
    (entry) => entry.url === "https://www.al-ai-fx.xyz/checkout",
  );

  assert.equal(entries.length, 49);
  assert.equal(homeEntry?.priority, 1);
  assert.equal(germanSupportEntry?.changeFrequency, "monthly");
  assert.equal(checkoutEntry, undefined);
});

test("buildMetadata gives every page its own canonical, never the home page's", () => {
  const meta = buildMetadata({ locale: "en", path: "/catalog", title: "t", description: "d" });
  assert.equal(meta.alternates?.canonical, "https://www.al-ai-fx.xyz/catalog");

  const de = buildMetadata({ locale: "de", path: "/features", title: "t", description: "d" });
  assert.equal(de.alternates?.canonical, "https://www.al-ai-fx.xyz/de/features");
  const languages = de.alternates?.languages as Record<string, string>;
  assert.equal(languages["x-default"], "https://www.al-ai-fx.xyz/features");
  assert.equal(Object.keys(languages).length, 8);
});

test("buildMetadata indexes by default and can opt out", () => {
  const indexed = buildMetadata({ locale: "en", path: "/faq", title: "t", description: "d" });
  assert.equal((indexed.robots as { index: boolean }).index, true);

  const hidden = buildMetadata({ locale: "en", path: "/faq", title: "t", description: "d", index: false });
  assert.equal((hidden.robots as { index: boolean }).index, false);
});

test("noIndexMetadata hides the page and clears the inherited canonical", () => {
  const meta = noIndexMetadata("Sign in");
  assert.deepEqual(meta.robots, { index: false, follow: false });
  assert.equal(meta.alternates?.canonical, null);
});

test("robotProductJsonLd lists one USD offer per plan with absolute URLs", () => {
  const product = robotProductJsonLd({
    locale: "en",
    slug: "gold-multirange-4",
    name: "Gold MultiRange 4",
    description: "Four ranges",
    image: "/robots/gold-multirange-4.jpg",
    offers: [{ name: "Monthly", price: 99, checkoutPath: "/checkout?tier=1-month&robot=gold-multirange-4" }],
  });
  assert.equal(product["@type"], "Product");
  assert.equal(product.url, "https://www.al-ai-fx.xyz/robots/gold-multirange-4");
  assert.equal(product.image, "https://www.al-ai-fx.xyz/robots/gold-multirange-4.jpg");
  const [offer] = product.offers ?? [];
  assert.equal(offer.price, "99.00");
  assert.equal(offer.priceCurrency, "USD");
  assert.equal(offer.url, "https://www.al-ai-fx.xyz/checkout?tier=1-month&robot=gold-multirange-4");
});

test("breadcrumbJsonLd numbers items and localises their URLs", () => {
  const crumbs = breadcrumbJsonLd("es", [
    { name: "Home", path: "/" },
    { name: "Catalog", path: "/catalog" },
  ]);
  assert.equal(crumbs.itemListElement[1].position, 2);
  assert.equal(crumbs.itemListElement[1].item, "https://www.al-ai-fx.xyz/es/catalog");
});

test("jsonLdScript cannot close its own script tag", () => {
  const { __html } = jsonLdScript({ text: "</script><script>alert(1)</script>" });
  assert.ok(!__html.includes("</script>"));
});
