import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkApiRateLimit, getClientIdentifier } from "@/lib/rate-limit";
import { REF_COOKIE, clientIp, getSettings, hashIp } from "@/lib/affiliate";

/**
 * The short referral link: al-ai-fx.xyz/r/ABC123
 *
 * Logs the click, drops the attribution cookie, and sends the visitor to the
 * page the affiliate pointed at (?to=/catalog) or the homepage. An unknown code
 * still redirects — a visitor should never see an error because a promoter
 * mistyped their own link.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code: raw } = await params;
  const code = raw.trim().toUpperCase().slice(0, 32);

  const url = new URL(req.url);
  const to = url.searchParams.get("to");
  // Only same-site paths: an open redirect here would be a phishing gift.
  const dest = to && to.startsWith("/") && !to.startsWith("//") ? to : "/";
  const redirect = NextResponse.redirect(new URL(dest, url.origin), 302);

  const { success } = await checkApiRateLimit(getClientIdentifier(req));
  if (!success) return redirect;

  try {
    const affiliate = await prisma.affiliate.findUnique({ where: { code } });
    if (!affiliate || affiliate.status !== "ACTIVE") return redirect;

    const settings = await getSettings();

    redirect.cookies.set(REF_COOKIE, code, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: settings.cookieDays * 86_400,
    });

    await prisma.affiliateClick.create({
      data: {
        affiliateId: affiliate.id,
        ipHash: hashIp(clientIp(req)),
        userAgent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
        referer: req.headers.get("referer")?.slice(0, 300) ?? null,
        landingPath: dest,
        country: req.headers.get("cf-ipcountry") ?? null,
      },
    });
  } catch (err) {
    // A broken click log must never break the visit.
    console.error("[affiliate] click failed:", err instanceof Error ? err.message : err);
  }

  return redirect;
}
