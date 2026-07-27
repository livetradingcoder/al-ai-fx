import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCompiledFilename } from "@/lib/compiler-filename";

export const metadata = { title: "Downloads" };

/** Every build this account has ever been issued, newest first. Each row is a
 *  real Compilation — nothing here is generated for display. */
export default async function DownloadsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const jobs = await prisma.compilation.findMany({
    where: { subscription: { userId: session.user.id } },
    include: {
      robot: { select: { slug: true, name: true } },
      subscription: { select: { tier: true, mt5AccountNumber: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <>
      <header style={{ marginBottom: "22px" }}>
        <h1 style={{ fontSize: "2.1rem", marginBottom: "0.35rem" }}>Downloads</h1>
        <p style={{ color: "var(--text-secondary)" }}>
          Every build issued to this account. Each one runs only on the MT5 account it was
          compiled for.
        </p>
      </header>

      {jobs.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "40px 26px" }}>
          <p style={{ color: "var(--text-secondary)", marginBottom: "16px" }}>
            No builds yet. Lock an MT5 account on a licence and we&apos;ll compile one for you.
          </p>
          <Link href="/dashboard/licenses" className="btn-primary" style={{ textDecoration: "none" }}>
            Go to My Licenses
          </Link>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Build</th>
                  <th>Robot</th>
                  <th>Locked to</th>
                  <th>Status</th>
                  <th>Issued</th>
                  <th>Download</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td data-label="Build">
                      <span className="plate plate-sm">
                        {getCompiledFilename(job.id, { robotSlug: job.robot.slug })}
                      </span>
                    </td>
                    <td data-label="Robot">{job.robot.name}</td>
                    <td data-label="Locked to" className="num">
                      {job.subscription.mt5AccountNumber || "—"}
                    </td>
                    <td data-label="Status">
                      <span
                        style={{
                          color:
                            job.status === "COMPLETED"
                              ? "var(--accent-success)"
                              : job.status === "FAILED"
                                ? "var(--accent-danger)"
                                : "var(--accent-primary)",
                          fontWeight: 600,
                          fontSize: "0.85rem",
                        }}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td data-label="Issued" className="num">
                      {job.createdAt.toLocaleDateString()}
                    </td>
                    <td data-label="Download">
                      {job.status === "COMPLETED" && job.downloadUrl ? (
                        <a
                          href={`/api/compiler/download?jobId=${job.id}`}
                          download
                          style={{ color: "var(--accent-primary)", fontWeight: 600 }}
                        >
                          Download .ex5
                        </a>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
