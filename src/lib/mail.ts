// Transport: Mailgun HTTP API (same integration pattern as LTL's trade-cmp
// mailgunConfig.ts — HTTPS-only, no SMTP ports needed). Replaces the original
// Mailtrap client, which was never provisioned. The `client` object below is
// call-compatible with MailtrapClient#send so all sender functions and their
// no-op-safe `if (!client)` guards are unchanged.
const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN;
const MAILGUN_API_BASE = "https://api.mailgun.net/v3";

const SENDER_EMAIL = process.env.SMTP_FROM_EMAIL || "hello@al-ai-fx.xyz";
const FROM_NAME = process.env.SMTP_FROM_NAME || "GoldBot Support";

if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
  console.warn("[Mail] MAILGUN_API_KEY / MAILGUN_DOMAIN not set. Emails will not be sent.");
}

type MailMessage = {
  from: { email: string; name: string };
  to: { email: string }[];
  subject: string;
  html: string;
  text: string;
  category?: string;
};

const client =
  MAILGUN_API_KEY && MAILGUN_DOMAIN
    ? {
        async send(msg: MailMessage) {
          const body = new URLSearchParams({
            from: `${msg.from.name} <${msg.from.email}>`,
            to: msg.to.map((t) => t.email).join(","),
            subject: msg.subject,
            html: msg.html,
            text: msg.text,
          });
          if (msg.category) {
            body.set("o:tag", msg.category);
          }

          const response = await fetch(`${MAILGUN_API_BASE}/${MAILGUN_DOMAIN}/messages`, {
            method: "POST",
            headers: {
              Authorization: `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString("base64")}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body,
          });

          if (!response.ok) {
            const data = (await response.json().catch(() => ({}))) as { message?: string };
            throw new Error(data.message || `Mailgun API error (HTTP ${response.status})`);
          }
        },
      }
    : null;

const sender = {
  email: SENDER_EMAIL.toLowerCase(),
  name: FROM_NAME,
};

function renderEmailTemplate(input: {
  buttonLabel: string;
  buttonUrl: string;
  eyebrow: string;
  intro: string;
  title: string;
  detailLines: string[];
}) {
  const detailsHtml = input.detailLines
    .map(
      (line) =>
        `<p style="margin:0 0 10px 0;color:#d8d1c3;font-size:15px;line-height:1.7;">${line}</p>`,
    )
    .join("");

  const html = `
    <div style="background:#0c0907;padding:32px 16px;font-family:Arial,sans-serif;">
      <div style="max-width:560px;margin:0 auto;background:#17110d;border:1px solid rgba(244,220,162,0.16);border-radius:24px;padding:32px;">
        <p style="margin:0 0 12px 0;color:#d8b36a;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;">${input.eyebrow}</p>
        <h1 style="margin:0 0 16px 0;color:#fff7e3;font-size:30px;line-height:1.2;">${input.title}</h1>
        <p style="margin:0 0 24px 0;color:#e5dccb;font-size:16px;line-height:1.7;">${input.intro}</p>
        ${detailsHtml}
        <div style="margin-top:28px;">
          <a href="${input.buttonUrl}" style="display:inline-block;background:#f4dca2;color:#1a130c;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:700;">
            ${input.buttonLabel}
          </a>
        </div>
        <p style="margin:24px 0 0;color:#9e9079;font-size:13px;line-height:1.7;">
          If the button does not work, copy and paste this URL into your browser:<br />
          <span style="color:#fff7e3;word-break:break-all;">${input.buttonUrl}</span>
        </p>
      </div>
    </div>
  `;

  const text = [
    input.title,
    "",
    input.intro,
    "",
    ...input.detailLines,
    "",
    `${input.buttonLabel}: ${input.buttonUrl}`,
  ].join("\n");

  return { html, text };
}

export async function sendWelcomeEmail(email: string, magicLinkUrl: string) {
  if (!client) {
    console.warn("[Mail] Mail client not initialized. Skipping welcome email.");
    return;
  }

  const { html, text } = renderEmailTemplate({
    buttonLabel: "Open GoldBot",
    buttonUrl: magicLinkUrl,
    eyebrow: "GoldBot access",
    intro: "Your GoldBot account is ready. Use the secure sign-in link below to enter your dashboard instantly.",
    title: "Welcome to GoldBot",
    detailLines: [
      `Email: ${email}`,
      "This secure link replaces temporary passwords and gets you straight into your dashboard.",
    ],
  });

  await client.send({
    from: sender,
    to: [{ email }],
    subject: "Welcome to GoldBot by AL-ai-FX",
    html,
    text,
    category: "Onboarding",
  });
  console.log(`[Mail] Welcome email sent to ${email}`);
}

/**
 * Sends a purchase confirmation email when a subscription is provisioned
 */
export async function sendPurchaseConfirmationEmail(
  email: string,
  tier: string,
  expiresAt: Date,
  magicLinkUrl: string,
) {
  if (!client) {
    console.warn("[Mail] Mail client not initialized. Skipping confirmation email.");
    return;
  }

  const { html, text } = renderEmailTemplate({
    buttonLabel: "Open your dashboard",
    buttonUrl: magicLinkUrl,
    eyebrow: "GoldBot purchase",
    intro: `Thank you for your purchase. Your ${tier} access is active and ready to use.`,
    title: "Your GoldBot access is live",
    detailLines: [
      `Plan: ${tier}`,
      `Access email: ${email}`,
      `Expires on: ${expiresAt.toLocaleDateString()}`,
      "Use the secure link below to enter your dashboard, connect your MT5 account, and download your build.",
    ],
  });

  await client.send({
    from: sender,
    to: [{ email }],
    subject: "Purchase Confirmation - GoldBot Subscription",
    html,
    text,
    category: "Transaction",
  });
  console.log(`[Mail] Purchase confirmation sent to ${email}`);
}

/**
 * DLVR-01: Sends the buying user a "your build is ready" email once their
 * compile reaches COMPLETED. Carries a signed, expiring magic-link that lands
 * them authenticated in the dashboard where the Download button lives. No-op
 * safe (same `if (!client)` guard as the other senders) — never throws when
 * MAILGUN_API_KEY is unset; the /complete caller wraps it best-effort.
 */
export async function sendCompileReadyEmail(
  email: string,
  robotName: string,
  magicLinkUrl: string,
) {
  if (!client) {
    console.warn("[Mail] Mail client not initialized. Skipping compile-ready email.");
    return;
  }

  const { html, text } = renderEmailTemplate({
    buttonLabel: "Open your dashboard",
    buttonUrl: magicLinkUrl,
    eyebrow: "Build ready",
    title: `Your ${robotName} build is ready`,
    intro: "Your compiled, account-locked EA has finished building. Open your dashboard with the secure link below to download the .ex5.",
    detailLines: [
      `Robot: ${robotName}`,
      "This secure sign-in link is time-limited — if it expires, request a fresh one from your dashboard.",
    ],
  });

  await client.send({
    from: sender,
    to: [{ email }],
    subject: `${robotName} — your build is ready`,
    html,
    text,
    category: "Delivery",
  });
  console.log(`[Mail] Compile-ready email sent to ${email}`);
}

/**
 * DLVR-03: Sends the buying user a "your build hit a snag" email once their
 * compile reaches terminal FAILED (retries exhausted). Carries a support link
 * so the user can reach the team. No-op safe (same `if (!client)` guard as the
 * other senders) — never throws when MAILGUN_API_KEY is unset; the
 * notifyTerminalFailure caller wraps it best-effort.
 */
export async function sendCompileFailedEmail(
  email: string,
  robotName: string,
  supportUrl: string,
) {
  if (!client) {
    console.warn("[Mail] Mail client not initialized. Skipping compile-failed email.");
    return;
  }

  const { html, text } = renderEmailTemplate({
    buttonLabel: "Contact support",
    buttonUrl: supportUrl,
    eyebrow: "Build issue",
    title: `We hit a snag building your ${robotName}`,
    intro:
      "Your compile did not complete after several automatic retries. Our team has been alerted and will get your build sorted — no action needed, but you can reach us any time.",
    detailLines: [
      `Robot: ${robotName}`,
      "You have not been charged for a failed build. Reply to this email or use the support link and we'll resolve it quickly.",
    ],
  });

  await client.send({
    from: sender,
    to: [{ email }],
    subject: `${robotName} — build needs attention`,
    html,
    text,
    category: "Delivery",
  });
  console.log(`[Mail] Compile-failed email sent to ${email}`);
}

/**
 * Sends a secure sign-in link for account recovery
 */
export async function sendResetPasswordEmail(email: string, magicLinkUrl: string) {
  if (!client) {
    console.warn("[Mail] Mail client not initialized. Skipping reset password email.");
    return;
  }

  const { html, text } = renderEmailTemplate({
    buttonLabel: "Sign in securely",
    buttonUrl: magicLinkUrl,
    eyebrow: "GoldBot recovery",
    intro: "A secure sign-in link was requested for your GoldBot account.",
    title: "Use this magic link to access GoldBot",
    detailLines: [
      `Email: ${email}`,
      "This link is time-limited and lets you access your account without resetting to a temporary password.",
    ],
  });

  await client.send({
    from: sender,
    to: [{ email }],
    subject: "Secure Sign-In Link - GoldBot",
    html,
    text,
    category: "Authentication",
  });
  console.log(`[Mail] Password reset email sent to ${email}`);
}

type AdminAlertKind =
  | { kind: "stale-heartbeat"; lastSeenAgoSeconds: number | null }
  | { kind: "job-failed"; jobId: string; attempts: number; errorMessage?: string };

/**
 * Fires the admin alert email via Mailtrap. Recipient is ADMIN_ALERT_EMAIL
 * (env), falling back to SMTP_FROM_EMAIL. Silent (no throw) if
 * MAILGUN_API_KEY is missing — callers must not fail the request
 * just because email failed. Best-effort side effect only.
 */
export async function sendAdminCompilerAlertEmail(payload: AdminAlertKind) {
  if (!client) {
    console.warn("[Mail] Mail client not initialized. Skipping admin alert.");
    return;
  }
  const to = (process.env.ADMIN_ALERT_EMAIL || process.env.SMTP_FROM_EMAIL || "").toLowerCase();
  if (!to) {
    console.warn("[Mail] No ADMIN_ALERT_EMAIL or SMTP_FROM_EMAIL configured. Skipping admin alert.");
    return;
  }

  const isStale = payload.kind === "stale-heartbeat";
  const title = isStale ? "Compile server offline" : "Compile job exhausted retries";
  const eyebrow = "Compiler alert";
  const intro = isStale
    ? `The Windows compile worker has not sent a heartbeat for ${payload.lastSeenAgoSeconds ?? "?"} seconds. Users cannot receive their .ex5 until the worker is restored.`
    : `Compilation job ${payload.jobId} has failed permanently after ${payload.attempts} attempts.${payload.errorMessage ? " Last error: " + payload.errorMessage : ""}`;
  const detailLines = isStale
    ? [
        "Check the VM: ssh alfx",
        "Service status: nssm.exe status al-ai-fx-daemon",
        "Recent logs: tail C:\\ProgramData\\al-ai-fx\\logs\\al-ai-fx-daemon.err.log",
      ]
    : [
        `Job ID: ${payload.jobId}`,
        `Total attempts: ${payload.attempts}`,
        payload.errorMessage
          ? `Last error: ${payload.errorMessage.slice(0, 200)}`
          : "No error message recorded.",
      ];

  const { html, text } = renderEmailTemplate({
    buttonLabel: "Open Admin Dashboard",
    buttonUrl: "https://www.al-ai-fx.xyz/dashboard/admin",
    eyebrow,
    intro,
    title,
    detailLines,
  });

  try {
    await client.send({
      from: sender,
      to: [{ email: to }],
      subject: isStale
        ? "[AL-ai-FX] Compile server offline"
        : "[AL-ai-FX] Compile job failed (retries exhausted)",
      html,
      text,
      category: "AdminAlert",
    });
    console.log(`[Mail] Admin alert sent (${payload.kind}) to ${to}`);
  } catch (err) {
    console.error("[Mail] Admin alert send failed:", err);
  }
}

/**
 * Welcome email for education-site (algotradingschool.com) subscribers.
 * No-op-safe like every other sender — the subscribe route calls this
 * best-effort and must never fail the request over email problems.
 */
export async function sendSubscriberWelcomeEmail(email: string) {
  if (!client) {
    console.warn("[Mail] Mail client not initialized. Skipping subscriber welcome email.");
    return;
  }

  const { html, text } = renderEmailTemplate({
    buttonLabel: "Browse the lessons",
    buttonUrl: "https://www.algotradingschool.com/en",
    eyebrow: "Algo Trading School",
    intro:
      "You're on the list. From time to time we'll send you a new plain-language lesson on automated trading — same tone as the site: no signals, no promises.",
    title: "Welcome to Algo Trading School",
    detailLines: [
      `Email: ${email}`,
      "You can unsubscribe at any time by replying to any email.",
    ],
  });

  await client.send({
    from: sender,
    to: [{ email }],
    subject: "Welcome to Algo Trading School",
    html,
    text,
    category: "EducationNewsletter",
  });
  console.log(`[Mail] Subscriber welcome email sent to ${email}`);
}
