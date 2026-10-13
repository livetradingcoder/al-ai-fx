"use client";

import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import CommandPalette from "@/components/dashboard/CommandPalette";
import { ACCOUNT_NAV, ADMIN_NAV, findNavItem, isAdminPath } from "@/components/dashboard/nav";

/**
 * Context strip above the content: which area you're in, and who you're
 * signed in as. No search box — a search that returns nothing would be
 * decoration, and there are only a handful of pages.
 */
export default function DashboardTopbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const t = useTranslations("Dashboard");

  const isAdmin = session?.user?.role === "ADMIN";
  // Same lookup the sidebar uses, so a page is named the same in both places.
  const match = findNavItem(pathname, isAdminPath(pathname) ? ADMIN_NAV : ACCOUNT_NAV);
  const area = t(match?.group.label ?? "menu");
  const title = t(match?.item.label ?? "overview");

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
      <CommandPalette />
      <div className="topbar-chip">
        <span className="topbar-avatar" aria-hidden="true">{initials}</span>
        <span title={email}>{email}</span>
        {isAdmin ? <span className="topbar-role">{t("workspaceAdmin")}</span> : null}
      </div>
    </header>
  );
}
