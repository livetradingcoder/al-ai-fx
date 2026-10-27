import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { confirmWhopReturn } from "@/lib/whop-fulfilment";

const WHOP_REF = /^WHOP-[A-Za-z0-9-]{8,64}$/;
const WHOP_PAYMENT_ID = /^pay_[A-Za-z0-9]{6,40}$/;

const SELECT = {
  amount: true,
  createdAt: true,
  currency: true,
  paygateId: true,
  pricingTier: true,
  status: true,
} as const;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const orderRef = (url.searchParams.get("orderRef") || "").trim();

  if (!orderRef) {
    return NextResponse.json({ error: "Missing orderRef." }, { status: 400 });
  }

  let order = await prisma.order.findUnique({ where: { paygateId: orderRef }, select: SELECT });

  // Whop sends the buyer back with ?payment=pay_…. If the webhook has not
  // written the order yet (or never does), ask Whop about that payment
  // directly instead of leaving the page waiting.
  const paymentId = (url.searchParams.get("payment") || "").trim();
  if (!order && WHOP_REF.test(orderRef) && WHOP_PAYMENT_ID.test(paymentId)) {
    if (await confirmWhopReturn(orderRef, paymentId)) {
      order = await prisma.order.findUnique({ where: { paygateId: orderRef }, select: SELECT });
    }
  }

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
