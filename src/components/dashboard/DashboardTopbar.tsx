"use client";

import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

/**
 * Context strip above the content: which area you're in, and who you're
 * signed in as. No search box — a search that returns nothing would be
 * decoration, and there are six pages.
 */
export default function DashboardTopbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const t = useTranslations("Dashboard");

  const area = pathname.includes("/dashboard/admin")
    ? t("administration")
    : t("menu");

  const title = pathname.includes("/admin/users")
    ? t("manageUsers")
    : pathname.includes("/admin/robots")
      ? t("manageRobots")
      : pathname.includes("/admin")
        ? t("adminOverview")
        : pathname.includes("/licenses")
          ? t("myLicenses")
          : pathname.includes("/billing")
            ? t("billing")
            : t("overview");

  const email = session?.user?.email ?? "";
  const initials = (session?.user?.name || email || "?")
    .replace(/@.*/, "")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="shell-topbar">
      <div>
        <p className="topbar-eyebrow">{area}</p>
        <p className="topbar-title">{title}</p>
      </div>
      <div className="topbar-chip">
        <span className="topbar-avatar" aria-hidden="true">{initials}</span>
        <span title={email}>{email}</span>
      </div>
    </header>
  );
}
