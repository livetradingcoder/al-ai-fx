import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardTopbar from "@/components/dashboard/DashboardTopbar";
import { noIndexMetadata } from "@/lib/seo";

// Private account area: never indexed, whatever a child page sets.
export const metadata = noIndexMetadata("Dashboard | GoldBot by AL-ai-FX");

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <DashboardSidebar />
      <div className="shell-main">
        <DashboardTopbar />
        <main className="shell-content">{children}</main>
      </div>
    </div>
  );
}
