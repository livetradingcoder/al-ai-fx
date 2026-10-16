// Where a reward code is spent. No robot or plan is named on purpose: robots
// and plans come and go (the catalog has changed since this was first built),
// and the code works on any of them. Checkout opens with the code filled in
// and the buyer picks the plan. Kept free of server-only imports so client
// components can use it.
export function rewardCheckoutPath(code: string): string {
  return `/checkout?coupon=${encodeURIComponent(code)}`;
}
