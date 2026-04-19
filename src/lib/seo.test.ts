import test from "node:test";
import assert from "node:assert/strict";

import {
  buildLocalizedUrl,
  getPageMetadata,
  getPublicSitemapEntries,
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

  assert.equal(typeof image === "string" ? image : (image as any)?.url, "https://www.al-ai-fx.xyz/goldbot-social.png");
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
