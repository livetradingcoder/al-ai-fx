import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import RobotsTable from "./RobotsTable";

export default async function AdminRobotsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || session?.user?.role !== "ADMIN") {
    redirect("/dashboard");
  }

  // No `where` filter — the admin management surface must show inactive robots too.
  const robots = await prisma.robot.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div className="admin-container">
        <h1 style={{ fontSize: "2.5rem", marginBottom: "3rem" }}>Robot Catalog</h1>
        <RobotsTable robots={robots} />
      </div>
    </div>
  );
}
