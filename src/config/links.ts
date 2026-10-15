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
 *
 * `checkoutUrl` goes straight to the firm's checkout for `challenge`, which
 * the firm listed at `price` when this was added. The firm sets and can change
 * its prices and terms, so the copy says "listed at" and points to its checkout.
 */
export const PROP_FIRM = {
  name: "ForRealFunding",
  url: "https://forrealfunding.com/",
  checkoutUrl: "https://forrealfunding.com/checkout?type=oneStep&size=5k&payAfterPass=true",
  challenge: "5k one-step challenge",
  price: "$9.99",
  code: "GOLDBOT",
  discount: "50%",
} as const;
