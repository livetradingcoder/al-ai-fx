import { NextResponse, type NextRequest } from "next/server";
import { polar } from "@/lib/polar";

/**
 * GET /api/checkout/polar?products=<product_id> → redirect to Polar's hosted
 * checkout. Lives under /api because /checkout is the next-intl checkout page.
 * No success URL: Polar shows its own confirmation after payment.
 */
export async function GET(req: NextRequest) {
  const products = req.nextUrl.searchParams.getAll("products");
  if (products.length === 0) {
    return NextResponse.json({ error: "Missing products in query params" }, { status: 400 });
  }

  try {
    const checkout = await polar().checkouts.create({ products });
    return NextResponse.redirect(checkout.url, 302);
  } catch (error) {
    console.error("[Polar] checkout create failed:", error);
    return NextResponse.json({ error: "Could not start checkout" }, { status: 502 });
  }
}
