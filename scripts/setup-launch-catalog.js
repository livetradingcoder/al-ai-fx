// Launch-catalog setup (2026-07-13): only GoldBot Double Range is purchasable;
// the other robots stay visible in the catalog as "coming soon" (all their
// price rows deactivated) until their source is production-ready.
//
// Idempotent. Run locally against dev, or with the production DATABASE_URL
// once the cloud DB is resumed:
//   DATABASE_URL=... node scripts/setup-launch-catalog.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const LIVE_SLUG = "goldbot";
const LIVE_NAME = "GoldBot Double Range";

const ARTWORK = {
  goldbot: "/robots/goldbot.jpg",
  goldshield: "/robots/goldshield.jpg",
  "precision-range": "/robots/precision-range.jpg",
  "sniper-lite": "/robots/sniper-lite.jpg",
};

(async () => {
  // 0. Brand cleanup: retire the VisionFX name entirely (robot rebranded
  //    to GoldShield EA). Idempotent — skipped if already renamed.
  const legacy = await prisma.robot.findUnique({ where: { slug: "visionfx" } });
  if (legacy) {
    await prisma.robot.update({
      where: { id: legacy.id },
      data: {
        slug: "goldshield",
        name: "GoldShield EA",
        longDescription:
          "GoldShield EA trades range breakouts with built-in hedging and an extensive holiday calendar covering EU, UK, US, DE, FR, and IT sessions — so it sits out when major markets are closed instead of trading into thin liquidity. Delivered as a compiled, MT5-account-locked build.",
      },
    });
    console.log("renamed visionfx -> goldshield (GoldShield EA)");
  }
  const precision = await prisma.robot.findUnique({ where: { slug: "precision-range" } });
  if (precision && precision.longDescription.includes("VisionFX")) {
    await prisma.robot.update({
      where: { id: precision.id },
      data: {
        longDescription: precision.longDescription.replace(
          /VisionFX's hedged holiday-aware model/g,
          "a hedged holiday-aware model"
        ),
      },
    });
    console.log("scrubbed VisionFX mention from precision-range copy");
  }
  // 1. Rename the live robot + set artwork.
  const live = await prisma.robot.update({
    where: { slug: LIVE_SLUG },
    data: { name: LIVE_NAME, artworkUrl: ARTWORK[LIVE_SLUG], active: true },
  });
  console.log(`live robot: ${live.slug} -> "${live.name}"`);

  // 2. Make sure the live robot's prices are active.
  const activated = await prisma.robotPrice.updateMany({
    where: { robotId: live.id },
    data: { active: true },
  });
  console.log(`live robot prices activated: ${activated.count}`);

  // 3. Every other robot: keep the Robot row active (visible in catalog as
  //    "coming soon") but deactivate ALL its price rows so nothing is buyable.
  const others = await prisma.robot.findMany({ where: { slug: { not: LIVE_SLUG } } });
  for (const robot of others) {
    await prisma.robot.update({
      where: { id: robot.id },
      data: { artworkUrl: ARTWORK[robot.slug] ?? robot.artworkUrl, active: true },
    });
    const off = await prisma.robotPrice.updateMany({
      where: { robotId: robot.id },
      data: { active: false },
    });
    console.log(`coming soon: ${robot.slug} (${off.count} prices deactivated)`);
  }

  await prisma.$disconnect();
  console.log("done");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
