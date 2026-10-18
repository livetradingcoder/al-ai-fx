export type TierId = "free-trial" | "10-days" | "1-month" | "6-months" | "1-year" | "lifetime" | "lifetime-source" | "secret-test";

// The robot the home page selects first and the catalog marks as the flagship.
// Identity only: every price on the site, this robot's included, is read from
// the robot's RobotPrice rows (src/lib/pricing-data.ts), the same rows checkout
// charges from, so there is no price list here to keep in step by hand.
export const FLAGSHIP_ROBOT = { slug: "gold-multirange-4", name: "Gold MultiRange 4" } as const;

// Delisted robot slug -> the robot that replaced it. Old links to a delisted
// robot's page or checkout land on its successor instead of a 404 or an
// unrelated robot.
export const RETIRED_ROBOTS: Record<string, string> = {
  goldbot: "gold-multirange-4",
};
