import test from "node:test";
import assert from "node:assert/strict";

import { buildMetadata, getPageMetadata, ogImageUrl } from "./seo";

function firstImage(metadata: ReturnType<typeof getPageMetadata>) {
  const images = metadata.openGraph?.images;
  const image = Array.isArray(images) ? images[0] : images;
  return typeof image === "string" ? { url: image } : (image as { url: string; width?: number; height?: number; alt?: string });
}

test("the address of a card is absolute, on our own domain", () => {
  assert.equal(
    ogImageUrl({ type: "robot", slug: "gold-multirange-4" }),
    "https://www.al-ai-fx.xyz/api/og/v1/robot/gold-multirange-4.jpg",
  );
});

test("every public page that has a card shows its own on Facebook, WhatsApp and X alike", () => {
  for (const page of ["faq", "support", "privacy-policy", "terms-conditions", "refund-policy", "disclaimer"] as const) {
    const metadata = getPageMetadata(page, "en");
    const expected = `https://www.al-ai-fx.xyz/api/og/v1/page/${page}.jpg`;
    const image = firstImage(metadata);
    assert.equal(image.url, expected, page);
    assert.deepEqual([image.width, image.height], [1200, 630], page);
    assert.deepEqual((metadata.twitter as { images?: string[] }).images, [expected], page);
  }
});

test("the home page keeps the hero picture, and so does checkout, which has no card", () => {
  for (const page of ["home", "checkout"] as const) {
    assert.equal(firstImage(getPageMetadata(page, "en")).url, "https://www.al-ai-fx.xyz/og/goldbot-share-1200x630.jpg", page);
  }
});

test("a page given a card is told the card's size and alt; a foreign picture is not given a size it may not have", () => {
  const card = buildMetadata({
    locale: "en",
    path: "/robots/x",
    title: "X robot",
    description: "d",
    image: ogImageUrl({ type: "robot", slug: "x" }),
    imageAlt: "X",
  });
  assert.deepEqual(
    [firstImage(card).url, firstImage(card).width, firstImage(card).height, firstImage(card).alt],
    ["https://www.al-ai-fx.xyz/api/og/v1/robot/x.jpg", 1200, 630, "X"],
  );

  const photo = buildMetadata({ locale: "en", path: "/robots/x", title: "X", description: "d", image: "/robots/x.jpg" });
  assert.equal(firstImage(photo).url, "https://www.al-ai-fx.xyz/robots/x.jpg");
  assert.equal(firstImage(photo).width, undefined);

  const plain = buildMetadata({ locale: "en", path: "/x", title: "X", description: "d" });
  assert.equal(firstImage(plain).url, "https://www.al-ai-fx.xyz/og/goldbot-share-1200x630.jpg");
  assert.deepEqual([firstImage(plain).width, firstImage(plain).height], [1200, 630]);
});
