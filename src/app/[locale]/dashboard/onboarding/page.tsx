import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Onboarding from "@/components/dashboard/Onboarding";

export const metadata = { title: "Setup" };

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const sub = await prisma.subscription.findFirst({
    where: { userId: session.user.id, status: "ACTIVE" },
    include: { compilations: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { createdAt: "desc" },
  });

  const job = sub?.compilations[0];

  return (
    <>
      <header style={{ marginBottom: "26px" }}>
        <h1 style={{ fontSize: "2.1rem", marginBottom: "0.35rem" }}>Setup</h1>
        <p style={{ color: "var(--text-secondary)" }}>
          From licence to a running robot, in four steps.
        </p>
      </header>

      <Onboarding
        subscriptionId={sub?.id ?? null}
        tier={sub?.tier ?? null}
        mt5Account={sub?.mt5AccountNumber ?? null}
        jobId={job?.id ?? null}
        jobStatus={job?.status ?? null}
      />
    </>
  );
}
