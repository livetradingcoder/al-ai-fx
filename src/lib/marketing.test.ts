import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCheckoutThankYouPath,
  buildGoogleAdsSendTo,
  getMarketingConfig,
} from "./marketing";

test("buildCheckoutThankYouPath keeps the default locale unprefixed", () => {
  assert.equal(
    buildCheckoutThankYouPath("en", "order-123"),
    "/checkout/thank-you?orderRef=order-123",
  );
});

test("buildCheckoutThankYouPath prefixes non-default locales", () => {
  assert.equal(
    buildCheckoutThankYouPath("de", "order-123"),
    "/de/checkout/thank-you?orderRef=order-123",
  );
});

test("buildGoogleAdsSendTo returns null without both values", () => {
  assert.equal(buildGoogleAdsSendTo(undefined, "label"), null);
  assert.equal(buildGoogleAdsSendTo("AW-123", undefined), null);
});

test("buildGoogleAdsSendTo joins conversion id and label", () => {
  assert.equal(buildGoogleAdsSendTo("AW-123456", "AbCdEf"), "AW-123456/AbCdEf");
});

test("getMarketingConfig trims and normalizes environment values", () => {
  const config = getMarketingConfig({
    NEXT_PUBLIC_GOOGLE_ADS_ID: " AW-123456 ",
    NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL_BEGIN_CHECKOUT: " begin123 ",
    NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL_PURCHASE: " purchase456 ",
    NEXT_PUBLIC_META_PIXEL_ID: " 987654321 ",
  });

  assert.equal(config.googleAdsId, "AW-123456");
  assert.equal(config.beginCheckoutSendTo, "AW-123456/begin123");
  assert.equal(config.purchaseSendTo, "AW-123456/purchase456");
  assert.equal(config.metaPixelId, "987654321");
});
