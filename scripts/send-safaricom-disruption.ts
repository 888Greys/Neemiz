import { PrismaClient } from "@prisma/client";

// Constants
const PROD_LOCAL_URL = "postgresql://postgres:1dfeefff2117de841c067f65e1f0b489@127.0.0.1:5436/postgres";
const APP_URL = "https://www.nezeem.com";
const SENDER_EMAIL = "noreply@nezeem.com";
const SENDER_NAME = "Nezeem";

// HTML Email template
function emailWrapper(content: string, footerExtra?: string, preheader = "Important Update: Safaricom M-Pesa Disruption") {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    html, body { margin:0 !important; padding:0 !important; width:100% !important; }
    body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
    table { border-collapse:collapse !important; }
    img { border:0; height:auto; line-height:100%; outline:none; text-decoration:none; max-width:100%; }
    a, .detail-value { overflow-wrap:anywhere; word-break:break-word; }
    @media only screen and (max-width:620px) {
      .outer-pad { padding:0 !important; }
      .email-shell { width:100% !important; max-width:100% !important; }
      .email-card { border-radius:0 !important; border-left:0 !important; border-right:0 !important; }
      .email-pad { padding:24px 16px !important; }
      .logo-pad { padding:22px 16px !important; }
      .footer-pad { padding:20px 16px 28px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#eef1f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a2e;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="outer-pad" style="background:#eef1f5;padding:32px 16px;min-width:100%;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" class="email-shell" style="max-width:600px;width:100%;">

        <!-- Logo header -->
        <tr><td align="center" class="logo-pad" style="padding:4px 16px 24px;">
          <a href="${APP_URL}" style="text-decoration:none;">
            <span style="font-size:28px;font-weight:900;letter-spacing:0;color:#17192a;">Ne<span style="color:#1687ff;">zeem</span></span>
          </a>
        </td></tr>

        <!-- Card -->
        <tr><td class="email-card" style="background:#ffffff;border-radius:8px;border:1px solid #dfe3e9;overflow:hidden;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td class="email-pad" style="padding:38px 42px;">
              ${content}
            </td></tr>
          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td class="footer-pad" style="padding:22px 16px 8px;text-align:center;">
          ${footerExtra ? `<p style="margin:0 0 10px;font-size:12px;color:#8991a3;line-height:1.6;">${footerExtra}</p>` : ""}
          <p style="margin:0 0 6px;font-size:12px;color:#8991a3;">
            <a href="${APP_URL}" style="color:#1687ff;text-decoration:none;">nezeem.com</a>
            &nbsp;·&nbsp;
            <a href="${APP_URL}/support" style="color:#8a94a6;text-decoration:none;">Support</a>
            &nbsp;·&nbsp;
            <a href="${APP_URL}/legal/privacy" style="color:#8a94a6;text-decoration:none;">Privacy</a>
          </p>
          <p style="margin:0;font-size:11px;color:#626a7a;">&copy; ${new Date().getFullYear()} Nezeem. All rights reserved.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// Function to send a single email
async function sendEmail(apiKey: string, to: string, subject: string, htmlContent: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${SENDER_NAME} <${SENDER_EMAIL}>`,
      to: [to],
      subject,
      html: htmlContent,
    }),
  });
  if (!res.ok) throw new Error(`Resend send failed: ${await res.text()}`);
}

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0]; // "test" | "affected" | "all"
  const testEmail = args[1];

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("Error: RESEND_API_KEY environment variable is required.");
    console.log("Usage Examples:");
    console.log("  $env:RESEND_API_KEY=\"your_key\"; bun run scripts/send-safaricom-disruption.ts test test@example.com");
    console.log("  $env:RESEND_API_KEY=\"your_key\"; bun run scripts/send-safaricom-disruption.ts affected");
    console.log("  $env:RESEND_API_KEY=\"your_key\"; bun run scripts/send-safaricom-disruption.ts all");
    process.exit(1);
  }

  if (!mode || !["test", "affected", "all"].includes(mode)) {
    console.error("Error: Mode must be one of: test, affected, all");
    process.exit(1);
  }

  if (mode === "test" && !testEmail) {
    console.error("Error: Test email address is required in test mode.");
    console.log("Usage: bun run scripts/send-safaricom-disruption.ts test <email>");
    process.exit(1);
  }

  // Setup Prisma client
  const db = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL || PROD_LOCAL_URL
      }
    }
  });

  const subject = "Notice: Ongoing Safaricom M-Pesa Disruption";
  const bodyHtml = `
    <h2 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#1a1a2e;">Dear Valued Customer,</h2>
    <p style="margin:0 0 16px;font-size:15px;color:#4a5568;line-height:1.7;">
      Please note that the <strong>Nezeem API remains fully operational</strong>. The current service disruption is due to an ongoing upgrade affecting Safaricom PayBill and Till services on stkpush ussd, which <strong>affects both deposits and withdrawals</strong>.
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:#4a5568;line-height:1.7;">
      We kindly ask for your patience as Safaricom works to resolve the issue. <strong>You will be notified once services are fully back</strong> and normal service has resumed.
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:#4a5568;line-height:1.7;">
      Thank you for your understanding and continued support.
    </p>
    <p style="margin:0;font-size:15px;color:#4a5568;line-height:1.7;font-weight:700;">
      Nezeem Support Team
    </p>
  `;
  const emailHtml = emailWrapper(bodyHtml);

  let recipients: string[] = [];

  if (mode === "test") {
    recipients = [testEmail];
    console.log(`[TEST MODE] Preparing to send test email to: ${testEmail}`);
  } else if (mode === "affected") {
    console.log("Fetching affected users from production database...");
    const todayStart = new Date("2026-07-06T00:00:00Z");
    const failedDeposits = await db.transaction.findMany({
      where: {
        type: "DEPOSIT",
        status: { in: ["FAILED", "PENDING"] },
        createdAt: { gte: todayStart }
      },
      include: {
        user: true
      }
    });

    const uniqueEmails = new Set<string>();
    for (const tx of failedDeposits) {
      if (tx.user?.email && tx.user.isActive) {
        uniqueEmails.add(tx.user.email);
      }
    }
    recipients = Array.from(uniqueEmails);
    console.log(`[AFFECTED MODE] Found ${recipients.length} active unique users with failed/pending deposits today.`);
  } else if (mode === "all") {
    console.log("Fetching all active users with email from production database...");
    const activeUsers = await db.user.findMany({
      where: {
        email: { not: null },
        isActive: true
      },
      select: {
        email: true
      }
    });
    recipients = activeUsers.map(u => u.email!).filter(Boolean);
    console.log(`[ALL MODE] Found ${recipients.length} active users with emails.`);
  }

  if (recipients.length === 0) {
    console.log("No recipients found. Exiting.");
    await db.$disconnect();
    return;
  }

  console.log(`Starting email send to ${recipients.length} recipients...`);
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < recipients.length; i++) {
    const email = recipients[i];
    try {
      await sendEmail(apiKey, email, subject, emailHtml);
      successCount++;
      console.log(`[${i + 1}/${recipients.length}] ✓ Sent to ${email}`);
    } catch (err: any) {
      failCount++;
      console.error(`[${i + 1}/${recipients.length}] ✗ Failed for ${email}:`, err.message || err);
    }
    // Add small delay to respect Resend rate limits if sending bulk
    if (mode === "all" && i % 10 === 0) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  console.log("\n=== Send Summary ===");
  console.log(`Total attempted: ${recipients.length}`);
  console.log(`Success: ${successCount}`);
  console.log(`Failed: ${failCount}`);

  await db.$disconnect();
}

main().catch(err => {
  console.error("Fatal Error:", err);
  process.exit(1);
});
