import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { loadUserLocations } from "@/lib/admin-locations";
import { classifyTrialUser, isListable, SEGMENT_LABELS, TRIAL_SEGMENTS, type TrialSegment } from "@/lib/segments";
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
          mt5AccountNumber: true,
          expiresAt: true
        }
      },
      // Only what the email lists need: how far they got with results and sharing.
      resultProofs: { select: { status: true } },
      shareProof: { select: { status: true } },
      reminderOptOut: { select: { userId: true } }
    }
  });

  // Where each person signs in from (address and country), and whether other
  // accounts share it. Empty rather than an error if that data isn't there yet.
  const locations = await loadUserLocations(users.map((user) => user.id));
  const rows = users.map(({ resultProofs, shareProof, reminderOptOut, ...user }) => {
    void resultProofs; void shareProof; void reminderOptOut;
    return { ...user, location: locations.get(user.id) ?? null };
  });

  // How many people each email list would hold, counted by the same rules as the CSV download.
  const now = new Date();
  const counts = new Map<TrialSegment, number>(TRIAL_SEGMENTS.map((key) => [key, 0]));
  for (const user of users) {
    if (!isListable({ ...user, optedOut: !!user.reminderOptOut })) continue;
    const cls = classifyTrialUser(
      {
        subscriptions: user.subscriptions,
        proofStatuses: user.resultProofs.map((p) => p.status),
        shareStatus: user.shareProof?.status ?? null,
      },
      now,
    );
    for (const key of cls.segments) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const optedInGiveaway = await prisma.emailSubscriber.count({
    where: { source: { startsWith: "giveaway:" }, unsubscribedAt: null },
  });

  // The admin home's "Add a person" button links here with ?add=1.
  const addOnArrival = (await searchParams).add === "1";

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="admin-container">
        <h1 style={{ fontSize: '2.1rem', marginBottom: '1.75rem' }}>User Management</h1>
        <section className="card" style={{ marginBottom: '20px' }} aria-label="Email lists">
          <p className="card-label">Email lists</p>
          <h2 style={{ fontSize: '1.15rem', margin: '6px 0 6px' }}>Download a list for your email tool</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '72ch', marginBottom: '16px' }}>
            Each CSV has a one-click sign-in link and a results link for every person, so the email can send
            them straight where they need to go. Staff, blocked people, anyone who opted out, people who
            already bought and test addresses are left out. The links are private: do not share the files.
          </p>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>List</th><th>People</th><th style={{ textAlign: 'right' }}>Download</th></tr>
              </thead>
              <tbody>
                {TRIAL_SEGMENTS.map((key) => (
                  <tr key={key}>
                    <td data-label="List">{SEGMENT_LABELS[key]}</td>
                    <td data-label="People">{counts.get(key) ?? 0}</td>
                    <td data-label="Download" style={{ textAlign: 'right' }}>
                      {/* A file download, not a page: a plain anchor is right. */}
                      <a className="btn-mini" href={`/api/admin/segments/${key}`}>CSV</a>
                    </td>
                  </tr>
                ))}
                <tr>
                  <td data-label="List">{SEGMENT_LABELS['giveaway-subscribers']}</td>
                  <td data-label="People">{optedInGiveaway}</td>
                  <td data-label="Download" style={{ textAlign: 'right' }}>
                    {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                    <a className="btn-mini" href="/api/admin/segments/giveaway-subscribers">CSV</a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
        <UsersTable users={rows} currentUserId={session.user.id} defaultAdding={addOnArrival} />
      </div>
    </div>
  );
}
