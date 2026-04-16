import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions) as any;
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { subscriptionId, mt5AccountNumber } = await req.json();

    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { user: true }
    });

    if (!subscription || subscription.userId !== session.user.id) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }

    // Update the subscription with the new MT5 account
    const updatedSub = await prisma.subscription.update({
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
  } catch (error: any) {
    console.error("Update MT5 error:", error);
    return NextResponse.json({ error: 'Failed to update MT5 account' }, { status: 500 });
  }
}
