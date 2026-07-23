import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyUnsubscribeToken } from "@/lib/marketing-unsubscribe";

// Public, credential-less one-click unsubscribe. GET only (email clients
// prefetch/click links, never fire a POST) — same reasoning as the Paygate
// webhook being GET-only. Idempotent: re-clicking an already-unsubscribed
// link, or a link for an email no longer in the list, both render the same
// confirmation rather than leaking list membership.
function renderPage(message: string, ok: boolean) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Unsubscribe</title>
</head>
<body style="background:#0c0907;color:#e5dccb;font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;">
  <div style="max-width:480px;text-align:center;">
    <h1 style="color:#fff7e3;font-size:22px;">${ok ? "You're unsubscribed" : "Link not valid"}</h1>
    <p style="color:#d8d1c3;font-size:15px;line-height:1.6;">${message}</p>
  </div>
</body>
</html>`;
}

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  const email = token ? verifyUnsubscribeToken(token) : null;

  if (!email) {
    return new NextResponse(
      renderPage("This unsubscribe link is invalid or expired.", false),
      { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  await prisma.emailSubscriber.updateMany({
    where: { email },
    data: { unsubscribedAt: new Date() },
  });

  return new NextResponse(
    renderPage(`${email} will not receive further marketing emails.`, true),
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}
