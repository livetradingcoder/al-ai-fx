import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import UsersTable from "./UsersTable";

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id || session?.user?.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      subscriptions: {
        select: {
          id: true,
          tier: true,
          status: true,
          mt5AccountNumber: true
        }
      }
    }
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="admin-container">
        <h1 style={{ fontSize: '2.5rem', marginBottom: '3rem' }}>User Management</h1>
        <UsersTable users={users} currentUserId={session.user.id} />
      </div>
    </div>
  );
}
