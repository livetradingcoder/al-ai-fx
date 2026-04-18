import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { user: true }
    });

    if (!subscription || subscription.userId !== session.user.id) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    // Update the subscription with the new MT5 account
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { mt5AccountNumber: String(mt5AccountNumber) }
    });

    // Create a new compilation job
    const job = await prisma.compilation.create({
      data: {
        subscriptionId: subscription.id,
        status: 'PENDING'
      }
    });

    return NextResponse.json({ success: true, job }, { status: 200 });
  } catch (error) {
    console.error("Update MT5 error:", error);
    return NextResponse.json({ error: 'Failed to update MT5 account' }, { status: 500 });
  }
}
