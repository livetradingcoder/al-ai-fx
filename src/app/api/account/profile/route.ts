import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Update the signed-in user's display name. Email is immutable here — it is
 *  the licence and billing identity, so changing it is a support action. */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { name?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  if (name.length < 2 || name.length > 60) {
    return NextResponse.json(
      { error: "Display name must be 2–60 characters" },
      { status: 400 },
    );
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name },
  });

  return NextResponse.json({ ok: true, name });
}
