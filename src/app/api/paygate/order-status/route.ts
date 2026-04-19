import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const orderRef = (url.searchParams.get("orderRef") || "").trim();

  if (!orderRef) {
    return NextResponse.json({ error: "Missing orderRef." }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { paygateId: orderRef },
    select: {
      amount: true,
      createdAt: true,
      currency: true,
      paygateId: true,
      pricingTier: true,
      status: true,
    },
  });

  if (!order) {
    return NextResponse.json({ status: "PENDING" }, { status: 200 });
  }

  return NextResponse.json(
    {
      amount: order.amount,
      currency: order.currency,
      orderRef: order.paygateId,
      pricingTier: order.pricingTier,
      status: order.status,
      createdAt: order.createdAt.toISOString(),
    },
    { status: 200 },
  );
}
