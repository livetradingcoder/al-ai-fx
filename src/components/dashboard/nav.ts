/**
 * The dashboard has two workspaces. Everyone gets "My account"; admins also get
 * "Admin", and the route decides which one is showing. Sidebar, ⌘K palette and
 * topbar all read this file, so a page is named the same everywhere.
 *
 * `label` and `group.label` are keys in the `Dashboard` translation namespace.
 */
export type NavIcon =
  | "overview"
  | "licence"
  | "setup"
  | "downloads"
  | "affiliate"
  | "billing"
  | "profile"
  | "settings"
  | "admin"
  | "users"
  | "orders"
  | "robots"
  | "coupons"
  | "webhooks"
  | "rewards"
  | "proofs"
  | "giveaways"
  | "promobar";

export type NavItem = { href: string; icon: NavIcon; label: string };
export type NavGroup = { label: string; items: NavItem[] };

export const ACCOUNT_NAV: NavGroup[] = [
  {
    label: "menu",
    items: [
      { href: "/dashboard", icon: "overview", label: "overview" },
      { href: "/dashboard/licenses", icon: "licence", label: "myLicenses" },
      { href: "/dashboard/onboarding", icon: "setup", label: "guidedSetup" },
      { href: "/dashboard/downloads", icon: "downloads", label: "downloads" },
      { href: "/dashboard/affiliate", icon: "affiliate", label: "affiliate" },
      { href: "/dashboard/rewards", icon: "rewards", label: "rewards" },
    ],
  },
  {
    label: "accountGroup",
    items: [
      { href: "/dashboard/billing", icon: "billing", label: "billing" },
      { href: "/dashboard/profile", icon: "profile", label: "profile" },
      { href: "/dashboard/settings", icon: "settings", label: "settings" },
    ],
  },
];

export const ADMIN_NAV: NavGroup[] = [
  {
    label: "administration",
    items: [
      { href: "/dashboard/admin", icon: "admin", label: "adminOverview" },
      { href: "/dashboard/admin/users", icon: "users", label: "manageUsers" },
      { href: "/dashboard/admin/orders", icon: "orders", label: "manageOrders" },
      { href: "/dashboard/admin/licences", icon: "licence", label: "manageLicences" },
      { href: "/dashboard/admin/robots", icon: "robots", label: "manageRobots" },
      { href: "/dashboard/admin/affiliates", icon: "affiliate", label: "manageAffiliates" },
      { href: "/dashboard/admin/coupons", icon: "coupons", label: "manageCoupons" },
      { href: "/dashboard/admin/proofs", icon: "proofs", label: "manageProofs" },
      { href: "/dashboard/admin/giveaways", icon: "giveaways", label: "manageGiveaways" },
      { href: "/dashboard/admin/promo-bar", icon: "promobar", label: "managePromoBar" },
      { href: "/dashboard/admin/payments", icon: "billing", label: "managePayments" },
      { href: "/dashboard/admin/webhooks", icon: "webhooks", label: "manageWebhooks" },
    ],
  },
];

/** Where an admin goes to see their own customer dashboard. Plain `/dashboard`
 *  sends admins to the admin home, so this is the way back. */
export const ADMIN_VIEW_ACCOUNT = "/dashboard?view=account";

/** The path from `/dashboard` on, without any locale prefix or query. */
export function dashboardPath(pathname: string) {
  const at = pathname.indexOf("/dashboard");
  const path = at >= 0 ? pathname.slice(at) : pathname;
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

export function isAdminPath(pathname: string) {
  const path = dashboardPath(pathname);
  return path === "/dashboard/admin" || path.startsWith("/dashboard/admin/");
}

/** The nav entry a page belongs to. The longest matching href wins, so
 *  /dashboard/admin/users is "Manage Users" rather than "Admin Overview". */
export function findNavItem(pathname: string, groups: NavGroup[]) {
  const path = dashboardPath(pathname);
  let best: { group: NavGroup; item: NavItem } | null = null;
  for (const group of groups) {
    for (const item of group.items) {
      const hit = path === item.href || path.startsWith(`${item.href}/`);
      if (hit && (!best || item.href.length > best.item.href.length)) best = { group, item };
    }
  }
  return best;
}
