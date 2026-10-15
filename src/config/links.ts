// Outbound links the site is paid to send people to. Keep them here so every
// mention points at the same place and carries the same disclosure.

/**
 * Where to get a VPS to run MetaTrader on 24/5. This is a referral link, so it
 * is always shown with a "referral link" note and rel="sponsored".
 */
export const VPS_REFERRAL_URL = "https://powervps.net/?from=111003";

/**
 * The prop firm we send people to, with the discount code that gets them 50%
 * off a new account. Shown as a partner offer, never as independent advice.
 */
export const PROP_FIRM = {
  name: "ForRealFunding",
  url: "https://forrealfunding.com/",
  code: "GOLDBOT",
  discount: "50%",
} as const;
