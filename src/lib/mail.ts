import { MailtrapClient } from "mailtrap";

const TOKEN = process.env.SMTP_PASS;
const SENDER_EMAIL = process.env.SMTP_USER || "hello@al-ai-fx.xyz";
const FROM_NAME = process.env.SMTP_FROM_NAME || "GoldBot Support";

if (!TOKEN) {
  console.warn("[Mail] SMTP_PASS (Mailtrap Token) not found. Emails will not be sent.");
}

const client = TOKEN ? new MailtrapClient({ token: TOKEN }) : null;

const sender = {
  email: SENDER_EMAIL,
  name: FROM_NAME,
};

/**
 * Sends a welcome email with a temporary password to new users
 */
export async function sendWelcomeEmail(email: string, tempPassword: string) {
  if (!client) return;

  try {
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
  } catch (error) {
    console.error(`[Mail] Error sending welcome email to ${email}:`, error);
  }
}

/**
 * Sends a purchase confirmation email when a subscription is provisioned
 */
export async function sendPurchaseConfirmationEmail(email: string, tier: string, expiresAt: Date) {
  if (!client) return;

  try {
    await client.send({
      from: sender,
      to: [{ email }],
      subject: "Purchase Confirmation - GoldBot Subscription",
      text: `Thank you for your purchase! Your ${tier} subscription is now active.
      
Plan: ${tier}
Expires on: ${expiresAt.toLocaleDateString()}

Access your dashboard to download your exclusive EA:
https://www.al-ai-fx.xyz/dashboard`,
      category: "Transaction",
    });
    console.log(`[Mail] Purchase confirmation sent to ${email}`);
  } catch (error) {
    console.error(`[Mail] Error sending purchase confirmation to ${email}:`, error);
  }
}
