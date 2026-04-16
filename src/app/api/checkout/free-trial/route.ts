import { NextResponse } from "next/server";
import { provisionSubscription } from "@/lib/subscriptions";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
    }

    console.log(`[Free Trial] Processing trial for: ${email}`);

    const result = await provisionSubscription(email, "free-trial");

    return NextResponse.json({
      success: true,
      message: "Free trial activated successfully.",
      ...result
    }, { status: 201 });

  } catch (error) {
    console.error("Free trial error:", error);
    return NextResponse.json({ error: "Failed to process free trial." }, { status: 500 });
  }
}
