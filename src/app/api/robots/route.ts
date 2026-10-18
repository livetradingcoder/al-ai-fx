import { NextResponse } from "next/server";
import { listCheckoutRobots } from "@/lib/checkout-robots";

// PUBLIC list of purchasable robots for the checkout robot picker.
// Display-only — charge amounts stay server-authoritative in create-session.
export async function GET() {
  return NextResponse.json(
    { robots: await listCheckoutRobots() },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}
