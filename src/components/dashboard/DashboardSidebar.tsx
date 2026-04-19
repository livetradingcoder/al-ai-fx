"use client";

import { signOut, useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/routing";

function getLinkStyle(isActive: boolean, accent: "primary" | "secondary" = "secondary") {
  if (isActive) {
    return {
      color: accent === "primary" ? "var(--accent-primary)" : "var(--accent-accent)",
      fontWeight: "700",
    };
  }

  return {
    color: "var(--text-secondary)",
    fontWeight: "500",
  };
}

export default function DashboardSidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations("Dashboard");
  const isAdmin = session?.user?.role === "ADMIN";
  const localePrefix = locale === "en" ? "" : `/${locale}`;

  const isActive = (path: string) =>
    pathname === `${localePrefix}${path}` || pathname === path;

  return (
    <aside className="dashboard-sidebar">
      <div style={{ marginBottom: "2rem" }}>
        <h3
          style={{
            fontSize: "0.9rem",
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "1px",
            marginBottom: "1rem",
          }}
        >
          {t("menu")}
        </h3>
        <ul style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
          <li>
            <Link href="/dashboard" style={getLinkStyle(isActive("/dashboard"), "primary")}>
              {t("overview")}
            </Link>
          </li>
          <li>
            <Link
              href="/dashboard/licenses"
              style={getLinkStyle(isActive("/dashboard/licenses"))}
            >
              {t("myLicenses")}
            </Link>
          </li>
          <li>
            <Link
              href="/dashboard/billing"
              style={getLinkStyle(isActive("/dashboard/billing"))}
            >
              {t("billing")}
            </Link>
          </li>
          <li style={{ marginTop: "2rem" }}>
            <button
              type="button"
              onClick={() => void signOut({ callbackUrl: `${localePrefix || ""}/login` })}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                padding: 0,
                font: "inherit",
              }}
            >
              {t("logout")} &rarr;
            </button>
          </li>
        </ul>
      </div>

      {isAdmin ? (
        <div style={{ marginBottom: "2rem" }}>
          <h3
            style={{
              fontSize: "0.9rem",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "1px",
              marginBottom: "1rem",
            }}
          >
            {t("administration")}
          </h3>
          <ul style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
            <li>
              <Link
                href="/dashboard/admin"
                style={getLinkStyle(isActive("/dashboard/admin"), "secondary")}
              >
                {t("adminOverview")}
              </Link>
            </li>
            <li>
              <Link
                href="/dashboard/admin/users"
                style={getLinkStyle(isActive("/dashboard/admin/users"), "primary")}
              >
                {t("manageUsers")} &rarr;
              </Link>
            </li>
          </ul>
        </div>
      ) : null}
    </aside>
  );
}
