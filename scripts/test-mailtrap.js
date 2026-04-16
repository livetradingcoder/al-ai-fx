const { MailtrapClient } = require("mailtrap");

/**
 * This script tests the Mailtrap integration using credentials from .env.local
 * Usage: node --env-file=.env.local scripts/test-mailtrap.js
 */

const TOKEN = process.env.SMTP_PASS;
const SENDER_EMAIL = process.env.SMTP_USER || "hello@demomailtrap.co";
const FROM_NAME = process.env.SMTP_FROM_NAME || "Mailtrap Test";

if (!TOKEN) {
  console.error("Error: SMTP_PASS (Mailtrap Token) not found in environment.");
  console.log("Make sure to run the script with: node --env-file=.env.local scripts/test-mailtrap.js");
  process.exit(1);
}

const client = new MailtrapClient({
  token: TOKEN,
});

const sender = {
  email: SENDER_EMAIL,
  name: FROM_NAME,
};

const recipients = [
  {
    email: "live-trading-league@proton.me",
  }
];

console.log(`Sending test email from ${SENDER_EMAIL}...`);

client
  .send({
    from: sender,
    to: recipients,
    subject: "Mailtrap Test - GoldBot Support",
    text: "Congrats! Your Mailtrap integration is working correctly.",
    category: "Integration Test",
  })
  .then((response) => {
    console.log("Success!", response);
  })
  .catch((error) => {
    console.error("Failed to send email:", error);
  });
