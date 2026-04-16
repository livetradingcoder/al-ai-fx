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

export async function sendWelcomeEmail(email: string, tempPassword: string) {
  if (!client) {
    console.warn("[Mail] Mailtrap client not initialized. Skipping welcome email.");
    return;
  }

  await client.send({
    from: sender,
    to: [{ email }],
    subject: "Welcome to GoldBot by AL-ai-FX",
    text: `Welcome! Your account has been created. Use the following credentials to access your dashboard:
    
Email: ${email}
Temporary Password: ${tempPassword}

Please log in and change your password as soon as possible.
https://www.al-ai-fx.xyz/login`,
    category: "Onboarding",
  });
  console.log(`[Mail] Welcome email sent to ${email}`);
}

/**
 * Sends a purchase confirmation email when a subscription is provisioned
 */
export async function sendPurchaseConfirmationEmail(email: string, tier: string, expiresAt: Date, tempPassword?: string | null) {
  if (!client) {
    console.warn("[Mail] Mailtrap client not initialized. Skipping confirmation email.");
    return;
  }

  let text = `Thank you for your purchase! Your ${tier} subscription is now active.
    
Plan: ${tier}
Expires on: ${expiresAt.toLocaleDateString()}

Access your dashboard to download your exclusive EA:
https://www.al-ai-fx.xyz/dashboard`;

  if (tempPassword) {
    text += `\n\nYour account credentials are:\nEmail: ${email}\nTemporary Password: ${tempPassword}\n\nPlease log in and change your password on your first visit.`;
  }

  await client.send({
    from: sender,
    to: [{ email }],
    subject: "Purchase Confirmation - GoldBot Subscription",
    text,
    category: "Transaction",
  });
  console.log(`[Mail] Purchase confirmation sent to ${email}`);
}

/**
 * Sends a password reset email with a new temporary password
 */
export async function sendResetPasswordEmail(email: string, tempPassword: string) {
  if (!client) {
    console.warn("[Mail] Mailtrap client not initialized. Skipping reset password email.");
    return;
  }

  await client.send({
    from: sender,
    to: [{ email }],
    subject: "Password Reset - GoldBot Support",
    text: `You requested a password reset for your GoldBot account.
    
Email: ${email}
New Temporary Password: ${tempPassword}

Please log in and change your password immediately:
https://www.al-ai-fx.xyz/login`,
    category: "Authentication",
  });
  console.log(`[Mail] Password reset email sent to ${email}`);
}
