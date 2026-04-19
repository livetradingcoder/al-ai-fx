import DashboardSidebar from "@/components/dashboard/DashboardSidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dashboard-layout">
      <DashboardSidebar />

      {/* Main Content Area */}
      <main className="dashboard-main">
        {children}
      </main>
      
    </div>
  );
}
