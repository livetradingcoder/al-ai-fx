import { MailtrapClient } from "mailtrap";

const TOKEN = process.env.MAILTRAP_TOKEN || process.env.SMTP_PASS;
const SENDER_EMAIL = process.env.SMTP_FROM_EMAIL || "hello@al-ai-fx.xyz";
const FROM_NAME = process.env.SMTP_FROM_NAME || "GoldBot Support";

if (!TOKEN) {
  console.warn("[Mail] MAILTRAP_TOKEN or SMTP_PASS (Mailtrap API Token) not found. Emails will not be sent.");
}

const client = TOKEN ? new MailtrapClient({ token: TOKEN }) : null;

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
    console.warn("[Mail] Mailtrap client not initialized. Skipping welcome email.");
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
    console.warn("[Mail] Mailtrap client not initialized. Skipping confirmation email.");
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
 * Sends a secure sign-in link for account recovery
 */
export async function sendResetPasswordEmail(email: string, magicLinkUrl: string) {
  if (!client) {
    console.warn("[Mail] Mailtrap client not initialized. Skipping reset password email.");
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
