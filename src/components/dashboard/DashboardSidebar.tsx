"use client";

import { signOut, useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

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

  const isActive = (path: string) =>
    pathname === `${localePrefix}${path}` || pathname === path;

  const railLink = (href: string, icon: React.ReactNode, label: string) => (
    <Link
      href={href}
      className="rail-link"
      aria-current={isActive(href) ? "page" : undefined}
    >
      {icon}
      {label}
    </Link>
  );

  return (
    <aside className="shell-rail">
      <nav className="rail-group" aria-label={t("menu")}>
        <p className="rail-group-label">{t("menu")}</p>
        {railLink("/dashboard", Icon.overview, t("overview"))}
        {railLink("/dashboard/licenses", Icon.licence, t("myLicenses"))}
        {railLink("/dashboard/billing", Icon.billing, t("billing"))}
      </nav>

      {isAdmin ? (
        <nav className="rail-group" aria-label={t("administration")}>
          <p className="rail-group-label">{t("administration")}</p>
          {railLink("/dashboard/admin", Icon.admin, t("adminOverview"))}
          {railLink("/dashboard/admin/users", Icon.users, t("manageUsers"))}
          {railLink("/dashboard/admin/robots", Icon.robots, t("manageRobots"))}
        </nav>
      ) : null}

      <div className="rail-group">
        <button
          type="button"
          className="rail-link rail-signout"
          onClick={() => void signOut({ callbackUrl: `${localePrefix}/login` })}
        >
          {Icon.logout}
          {t("logout")}
        </button>
      </div>
    </aside>
  );
}
