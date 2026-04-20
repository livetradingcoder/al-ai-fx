import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const requiredLandingKeys = [
  "calcPerMonth",
  "heroTitle",
  "lifetimeSourceTitle",
  "lifetimeSourceNote",
  "sourceCodeAccess",
  "modifyAndResell",
  "freeTrialActionCopy",
  "whyGoldBot",
  "comingSoonEyebrow",
  "comingSoonTitle",
  "comingSoonCopy",
  "comingSoonSummaryLabel",
  "comingSoonSummaryTitle",
  "comingSoonSummaryCopy",
  "comingSoonBoardProduct",
  "comingSoonBoardSurface",
  "comingSoonBoardStatus",
  "comingSoonGoldGapTitle",
  "comingSoonGoldGapStatus",
  "comingSoonGoldGapEyebrow",
  "comingSoonGoldGapDescription",
  "comingSoonGoldGapBullet1",
  "comingSoonGoldGapBullet2",
  "comingSoonGoldGapBullet3",
  "comingSoonGoldGapSurface",
  "comingSoonTradingViewTitle",
  "comingSoonTradingViewStatus",
  "comingSoonTradingViewEyebrow",
  "comingSoonTradingViewDescription",
  "comingSoonTradingViewBullet1",
  "comingSoonTradingViewBullet2",
  "comingSoonTradingViewBullet3",
  "comingSoonTradingViewSurface",
  "comingSoonCTraderTitle",
  "comingSoonCTraderStatus",
  "comingSoonCTraderEyebrow",
  "comingSoonCTraderDescription",
  "comingSoonCTraderBullet1",
  "comingSoonCTraderBullet2",
  "comingSoonCTraderBullet3",
  "comingSoonCTraderSurface",
  "customAccessEyebrow",
  "customAccessTitle",
  "customAccessCopy",
  "customAccessPrimaryCta",
  "customAccessSecondaryCta",
  "customAccessCard1Title",
  "customAccessCard1Copy",
  "customAccessCard1Bullet1",
  "customAccessCard1Bullet2",
  "customAccessCard1Bullet3",
  "customAccessCard2Title",
  "customAccessCard2Copy",
  "customAccessCard2Bullet1",
  "customAccessCard2Bullet2",
  "customAccessCard2Bullet3",
  "customAccessCard3Title",
  "customAccessCard3Copy",
  "customAccessCard3Bullet1",
  "customAccessCard3Bullet2",
  "customAccessCard3Bullet3",
  "contactUs",
  "riskAwareAutomation",
  "comparisonEyebrow",
  "deployGoldBot",
];

test("all locale dictionaries include the required landing-page localization keys", () => {
  const messagesDir = path.join(process.cwd(), "src/messages");
  const localeFiles = fs.readdirSync(messagesDir).filter((file) => file.endsWith(".json"));

  for (const localeFile of localeFiles) {
    const locale = JSON.parse(
      fs.readFileSync(path.join(messagesDir, localeFile), "utf8"),
    ) as { Landing?: Record<string, string | null | undefined> };

    const missingKeys = requiredLandingKeys.filter((key) => {
      const value = locale.Landing?.[key];
      return typeof value !== "string" || value.trim().length === 0;
    });

    assert.deepEqual(
      missingKeys,
      [],
      `${localeFile} is missing landing keys: ${missingKeys.join(", ")}`,
    );
  }
});
