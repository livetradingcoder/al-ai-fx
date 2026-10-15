import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateMT5Account } from "@/lib/validation";
import { ipFromHeaders } from "@/lib/client-ip";
import { linkMt5Account, MT5_ACCOUNT_USED_MESSAGE } from "@/lib/trial-abuse";
import { recordUserIp } from "@/lib/user-ip";

type UpdateMt5Payload = {
  subscriptionId?: string;
  mt5AccountNumber?: string | number;
};

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { subscriptionId, mt5AccountNumber } = await req.json() as UpdateMt5Payload;

    if (!subscriptionId || !mt5AccountNumber) {
      return NextResponse.json({ error: 'Missing subscriptionId or mt5AccountNumber' }, { status: 400 });
    }

    // Validate MT5 account number
    const mt5Validation = validateMT5Account(mt5AccountNumber);
    if (!mt5Validation.valid) {
      return NextResponse.json({ error: mt5Validation.error }, { status: 400 });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { user: true, robot: { select: { sourceVersion: true } } }
    });

    if (!subscription || subscription.userId !== session.user.id) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    // Link the account. A free trial is refused an account that has already
    // been used with any licence (see lib/trial-abuse.ts).
    const account = String(mt5AccountNumber).trim();
    const outcome = await linkMt5Account({
      subscriptionId,
      userId: session.user.id,
      tier: subscription.tier,
      accountNumber: account,
    });
    if (!outcome.ok) {
      return NextResponse.json({ error: MT5_ACCOUNT_USED_MESSAGE, code: "mt5-account-used" }, { status: 409 });
    }
    await recordUserIp({ userId: session.user.id, ip: ipFromHeaders((name) => req.headers.get(name)), source: "mt5" });

    // Create a new compilation job.
    // Denormalize robotId from the subscription at creation time: the compile
    // worker's filename generation needs the slug directly, and a compilation's
    // robot is immutable once queued even if the subscription is later re-pointed.
    const job = await prisma.compilation.create({
      data: {
        subscriptionId: subscription.id,
        robotId: subscription.robotId,
        sourceVersion: subscription.robot.sourceVersion,
        status: 'PENDING'
      }
    });

    console.log(
      `[pipeline] JOB CREATED job=${job.id} robot=${subscription.robotId} ` +
      `sub=${subscription.id} mt5=${mt5AccountNumber} sourceVersion=${subscription.robot.sourceVersion}`,
    );
    return NextResponse.json({ success: true, job }, { status: 200 });
  } catch (error) {
    console.error("Update MT5 error:", error);
    return NextResponse.json({ error: 'Failed to update MT5 account' }, { status: 500 });
  }
}
