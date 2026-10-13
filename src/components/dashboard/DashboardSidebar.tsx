"use client";

import { signOut, useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import {
  ACCOUNT_NAV,
  ADMIN_NAV,
  ADMIN_VIEW_ACCOUNT,
  isAdminPath,
  type NavItem,
} from "@/components/dashboard/nav";
import { openSupportChat } from "@/components/NdeskWidget";
import { Link } from "@/i18n/routing";

/* Six small glyphs for the rail — inline, so the dashboard gains no icon
   dependency and each icon inherits currentColor for its active state. */
const Icon = {
  overview: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  ),
  licence: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M7 11h4M7 15h7" />
      <circle cx="16.5" cy="11" r="1.6" />
    </svg>
  ),
  billing: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" /><path d="M2.5 10h19" />
    </svg>
  ),
  admin: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l7 3v5.5c0 4.3-2.9 8.2-7 9.5-4.1-1.3-7-5.2-7-9.5V6z" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" /><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
      <path d="M16 5.2a3.2 3.2 0 010 5.6M18 20c0-2.2-.8-3.9-2-5" />
    </svg>
  ),
  robots: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="8" width="16" height="11" rx="3" /><path d="M12 8V4.5M8.5 13h.01M15.5 13h.01M9.5 16.5h5" />
    </svg>
  ),
  coupons: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9V7a1 1 0 011-1h14a1 1 0 011 1v2a2 2 0 000 4v2a1 1 0 01-1 1H5a1 1 0 01-1-1v-2a2 2 0 000-4z" />
      <path d="M14 7v10" strokeDasharray="2 3" />
    </svg>
  ),
  orders: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6" />
    </svg>
  ),
  setup: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h4l2.5-6 3 12L17 12h2" />
    </svg>
  ),
  affiliate: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="3" /><path d="M4 20c0-3 2.2-5 5-5s5 2 5 5" /><path d="M17 8h4M19 6v4" />
    </svg>
  ),
  downloads: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4v10M8 11l4 4 4-4M5 19h14" />
    </svg>
  ),
  profile: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1A1.7 1.7 0 008.6 19a1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H2a2 2 0 110-4h.1A1.7 1.7 0 004 8.6a1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.5V2a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.5 1H22a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
    </svg>
  ),
  support: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3.6" />
      <path d="M14.6 9.4l3-3M6.4 17.6l3-3M14.6 14.6l3 3M6.4 6.4l3 3" />
    </svg>
  ),
  logout: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3M10 16l-4-4 4-4M6 12h11" />
    </svg>
  ),
};

export default function DashboardSidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations("Dashboard");
  const isAdmin = session?.user?.role === "ADMIN";
  const localePrefix = locale === "en" ? "" : `/${locale}`;

  // The route decides the workspace. Only admins have a second one, so a
  // customer's rail is the account rail whatever URL they type.
  const inAdmin = isAdmin && isAdminPath(pathname);
  const groups = inAdmin ? ADMIN_NAV : ACCOUNT_NAV;

  const isActive = (path: string) =>
    pathname === `${localePrefix}${path}` || pathname === path;

  // An admin's "Overview" is their own customer dashboard, and plain
  // /dashboard would send them to the admin home.
  const hrefFor = (item: NavItem) =>
    isAdmin && item.href === "/dashboard" ? ADMIN_VIEW_ACCOUNT : item.href;

  const railLink = (item: NavItem) => (
    <Link
      key={item.href}
      href={hrefFor(item)}
      className="rail-link"
      aria-current={isActive(item.href) ? "page" : undefined}
    >
      {Icon[item.icon]}
      {t(item.label)}
    </Link>
  );

  return (
    <aside className="shell-rail">
      {isAdmin ? (
        <div
          className="rail-switch"
          role="group"
          aria-label={`${t("workspaceAdmin")} / ${t("workspaceAccount")}`}
        >
          <Link href="/dashboard/admin" aria-current={inAdmin ? "true" : undefined}>
            {Icon.admin}
            {t("workspaceAdmin")}
          </Link>
          <Link href={ADMIN_VIEW_ACCOUNT} aria-current={inAdmin ? undefined : "true"}>
            {Icon.profile}
            {t("workspaceAccount")}
          </Link>
        </div>
      ) : null}

      {groups.map((group) => (
        <nav key={group.label} className="rail-group" aria-label={t(group.label)}>
          <p className="rail-group-label">{t(group.label)}</p>
          {group.items.map(railLink)}
        </nav>
      ))}

      <nav className="rail-group" aria-label={t("helpGroup")}>
        <p className="rail-group-label">{t("helpGroup")}</p>
        <button type="button" className="rail-link rail-button" onClick={openSupportChat}>
          {Icon.support}
          {t("support")}
        </button>
      </nav>

      <div className="rail-group">
        <button
          type="button"
          className="rail-link rail-button"
          onClick={() => void signOut({ callbackUrl: `${localePrefix}/login` })}
        >
          {Icon.logout}
          {t("logout")}
        </button>
      </div>
    </aside>
  );
}
