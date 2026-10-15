import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { loadUserLocations } from "@/lib/admin-locations";
import UsersTable from "./UsersTable";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || session?.user?.role !== "ADMIN") {
    redirect("/dashboard");
  }

  // An explicit select, not `include`: these rows are serialised into the
  // page for the client table, and password hashes must never ride along.
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      role: true,
      isBlocked: true,
      isDeleted: true,
      createdAt: true,
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

  // Where each person signs in from (address and country), and whether other
  // accounts share it. Empty rather than an error if that data isn't there yet.
  const locations = await loadUserLocations(users.map((user) => user.id));
  const rows = users.map((user) => ({ ...user, location: locations.get(user.id) ?? null }));

  // The admin home's "Add a person" button links here with ?add=1.
  const addOnArrival = (await searchParams).add === "1";

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="admin-container">
        <h1 style={{ fontSize: '2.1rem', marginBottom: '1.75rem' }}>User Management</h1>
        <UsersTable users={rows} currentUserId={session.user.id} defaultAdding={addOnArrival} />
      </div>
    </div>
  );
}
