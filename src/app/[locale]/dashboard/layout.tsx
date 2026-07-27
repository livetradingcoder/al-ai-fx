import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardTopbar from "@/components/dashboard/DashboardTopbar";

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
