import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendSupportRequestEmail } from "@/lib/mail";

/** Support requests from the dashboard. Signed-in only, so the message always
 *  carries a verified identity and the licence context staff need to act. */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { subject?: unknown; message?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const subject = String(body.subject ?? "").trim().slice(0, 120);
  const message = String(body.message ?? "").trim().slice(0, 4000);

  if (subject.length < 3) {
    return NextResponse.json({ error: "Add a short subject" }, { status: 400 });
  }
  if (message.length < 10) {
    return NextResponse.json(
      { error: "Describe the problem in a little more detail" },
      { status: 400 },
    );
  }

  // Attach licence context so support doesn't have to ask for it.
  const subs = await prisma.subscription.findMany({
    where: { userId: session.user.id },
    include: { robot: { select: { slug: true } } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const meta = subs.map(
    (s) =>
      `${s.robot.slug} · ${s.tier} · ${s.status} · MT5 ${s.mt5AccountNumber || "not set"}`,
  );

  try {
    const sent = await sendSupportRequestEmail({
      fromEmail: session.user.email,
      subject,
      message,
      meta: meta.length ? meta : ["No subscriptions on this account"],
    });
    if (!sent) {
      return NextResponse.json(
        { error: "Support email is not configured — write to support@al-ai-fx.xyz" },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Support] send failed:", err);
    return NextResponse.json({ error: "Could not send — try again" }, { status: 502 });
  }
}
