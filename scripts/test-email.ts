import { sendWelcomeEmail } from "../lib/brevo";

async function main() {
  const recipient = process.argv[2];
  if (!recipient) {
    console.error("Usage: bun run scripts/test-email.ts <recipient-email>");
    process.exit(1);
  }

  const apiKey = process.env.RESEND_API_KEY;
  const senderEmail = process.env.MAIL_SENDER_EMAIL ?? process.env.BREVO_SENDER_EMAIL;

  if (!apiKey || !senderEmail) {
    console.error("Error: RESEND_API_KEY and MAIL_SENDER_EMAIL must be set.");
    console.log("Current values:");
    console.log("  RESEND_API_KEY:", apiKey ? "Configured (hidden)" : "Missing");
    console.log("  MAIL_SENDER_EMAIL:", senderEmail || "Missing");
    process.exit(1);
  }

  console.log(`Sending test welcome email to ${recipient}...`);
  try {
    await sendWelcomeEmail(recipient, "Test User");
    console.log("✓ Email sent successfully!");
  } catch (error) {
    console.error("✗ Failed to send email:", error);
    process.exitCode = 1;
  }
}

main();
