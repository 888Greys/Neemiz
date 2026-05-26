const BREVO_API_KEY = process.env.BREVO_API_KEY!;
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL!;
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME ?? "Nezeem";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://nezeem.com";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "toxicgreys001@gmail.com";

async function sendEmail(to: string, toName: string, subject: string, htmlContent: string) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({
      sender: { name: BREVO_SENDER_NAME, email: BREVO_SENDER_EMAIL },
      to: [{ email: to, name: toName }],
      subject,
      htmlContent,
    }),
  });
  if (!res.ok) console.error("Brevo send failed:", await res.text());
}

// ─── Shared Layout ────────────────────────────────────────────────────────────

function emailWrapper(content: string, footerExtra?: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a2e;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

        <!-- Logo header -->
        <tr><td align="center" style="padding-bottom:24px;">
          <a href="${APP_URL}" style="text-decoration:none;">
            <span style="font-size:28px;font-weight:900;letter-spacing:-0.5px;color:#1a1a2e;">Ne<span style="color:#087cff;">zeem</span></span>
          </a>
        </td></tr>

        <!-- Card -->
        <tr><td style="background:#ffffff;border-radius:16px;border:1px solid #e2e6ea;overflow:hidden;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:36px 40px;">
              ${content}
            </td></tr>
          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding-top:24px;text-align:center;">
          ${footerExtra ? `<p style="margin:0 0 10px;font-size:12px;color:#8a94a6;">${footerExtra}</p>` : ""}
          <p style="margin:0 0 6px;font-size:12px;color:#8a94a6;">
            <a href="${APP_URL}" style="color:#087cff;text-decoration:none;">nezeem.com</a>
            &nbsp;·&nbsp;
            <a href="${APP_URL}/support" style="color:#8a94a6;text-decoration:none;">Support</a>
            &nbsp;·&nbsp;
            <a href="${APP_URL}/legal/privacy" style="color:#8a94a6;text-decoration:none;">Privacy</a>
          </p>
          <p style="margin:0;font-size:11px;color:#b0b8c4;">© ${new Date().getFullYear()} Nezeem. All rights reserved.</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function detailRow(label: string, value: string, last = false) {
  return `<tr>
    <td style="padding:12px 0;${last ? "" : "border-bottom:1px solid #f0f2f5;"}">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:13px;color:#8a94a6;">${label}</td>
        <td align="right" style="font-size:13px;font-weight:600;color:#1a1a2e;">${value}</td>
      </tr></table>
    </td>
  </tr>`;
}

function ctaButton(href: string, label: string, color = "#087cff") {
  return `<table cellpadding="0" cellspacing="0" style="margin-top:28px;">
    <tr><td align="center">
      <a href="${href}" style="display:inline-block;background:${color};color:#ffffff;font-weight:700;font-size:15px;padding:14px 36px;border-radius:10px;text-decoration:none;letter-spacing:0.2px;">
        ${label}
      </a>
    </td></tr>
  </table>`;
}

// ─── Welcome Email ────────────────────────────────────────────────────────────

export async function sendWelcomeEmail(to: string, firstName: string) {
  const name = firstName || "Trader";
  await sendEmail(
    to,
    name,
    "Welcome to Nezeem",
    emailWrapper(`
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1a1a2e;">Welcome to Nezeem, ${name}!</h1>
      <p style="margin:0 0 24px;font-size:15px;color:#4a5568;line-height:1.7;">
        Your account is ready. Nezeem is your all-in-one platform for sports betting, market predictions, and P2P crypto trading — all secured by escrow.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f9fc;border-radius:12px;margin-bottom:28px;">
        <tr><td style="padding:20px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:0 12px 0 0;width:50%;vertical-align:top;">
                <div style="background:#ffffff;border:1px solid #e2e6ea;border-radius:10px;padding:16px;">
                  <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#087cff;text-transform:uppercase;letter-spacing:1px;">P2P Trading</p>
                  <p style="margin:0;font-size:13px;color:#4a5568;line-height:1.5;">Buy &amp; sell crypto directly with other users, escrow protected</p>
                </div>
              </td>
              <td style="padding:0 0 0 12px;width:50%;vertical-align:top;">
                <div style="background:#ffffff;border:1px solid #e2e6ea;border-radius:10px;padding:16px;">
                  <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#087cff;text-transform:uppercase;letter-spacing:1px;">Predictions</p>
                  <p style="margin:0;font-size:13px;color:#4a5568;line-height:1.5;">Trade on real-world outcomes across markets worldwide</p>
                </div>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>

      <p style="margin:0 0 28px;font-size:13px;color:#8a94a6;line-height:1.6;">
        To get started, deposit funds into your wallet. If you didn&apos;t create this account, you can safely ignore this email.
      </p>

      ${ctaButton(`${APP_URL}/wallet`, "Deposit &amp; Start Trading →")}
    `,
    "You received this email because you created an account on Nezeem."
  ));
}

// ─── P2P Merchant Emails ──────────────────────────────────────────────────────

export async function sendMerchantApplicationEmail(applicantEmail: string, displayName: string) {
  await sendEmail(
    ADMIN_EMAIL,
    "Nezeem Admin",
    `New Merchant Application — ${displayName}`,
    emailWrapper(`
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#087cff;text-transform:uppercase;letter-spacing:1px;">Merchant Review</p>
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#1a1a2e;">New Application Received</h2>
      <p style="margin:0 0 24px;font-size:15px;color:#4a5568;line-height:1.7;">
        A new merchant application is waiting for your review in the admin panel.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f9fc;border-radius:12px;margin-bottom:28px;">
        <tr><td style="padding:4px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            ${detailRow("Display Name", `<strong>${displayName}</strong>`)}
            ${detailRow("Email", applicantEmail, true)}
          </table>
        </td></tr>
      </table>

      ${ctaButton(`${APP_URL}/admin/p2p`, "Review Application →")}
    `)
  );
}

export async function sendKycApprovedEmail(to: string, displayName: string) {
  await sendEmail(
    to,
    displayName,
    "Your Merchant Account is Approved ✓",
    emailWrapper(`
      <div style="text-align:center;padding-bottom:28px;border-bottom:1px solid #f0f2f5;margin-bottom:28px;">
        <div style="display:inline-block;width:56px;height:56px;background:#e6f9ee;border-radius:50%;line-height:56px;text-align:center;font-size:26px;margin-bottom:16px;">✓</div>
        <h2 style="margin:0 0 10px;font-size:24px;font-weight:800;color:#1a1a2e;">You&apos;re Verified!</h2>
        <p style="margin:0;font-size:15px;color:#4a5568;line-height:1.7;max-width:400px;margin:0 auto;">
          Your merchant application has been approved. You can now post buy &amp; sell ads on Nezeem P2P.
        </p>
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
        <tr>
          <td style="padding:0 10px 0 0;width:50%;vertical-align:top;">
            <div style="background:#f7f9fc;border-radius:10px;padding:16px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#05b957;text-transform:uppercase;letter-spacing:1px;">Post Ads</p>
              <p style="margin:0;font-size:13px;color:#4a5568;line-height:1.5;">Set your own price &amp; limits</p>
            </div>
          </td>
          <td style="padding:0 0 0 10px;width:50%;vertical-align:top;">
            <div style="background:#f7f9fc;border-radius:10px;padding:16px;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#05b957;text-transform:uppercase;letter-spacing:1px;">Escrow Protected</p>
              <p style="margin:0;font-size:13px;color:#4a5568;line-height:1.5;">Every trade is secured</p>
            </div>
          </td>
        </tr>
      </table>

      ${ctaButton(`${APP_URL}/p2p/merchant`, "Go to Merchant Center →", "#05b957")}
    `,
    "Questions? Visit our <a href='${APP_URL}/support' style='color:#087cff;text-decoration:none;'>support center</a>."
  ));
}

export async function sendKycRejectedEmail(to: string, displayName: string, reason?: string) {
  await sendEmail(
    to,
    displayName,
    "Merchant Application Update",
    emailWrapper(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#1a1a2e;">Application Not Approved</h2>
      <p style="margin:0 0 24px;font-size:15px;color:#4a5568;line-height:1.7;">
        Hi ${displayName}, unfortunately your merchant application was not approved at this time.
      </p>

      ${reason ? `
      <div style="background:#fff5f5;border:1px solid #fcd5d5;border-left:4px solid #e53e3e;border-radius:0 10px 10px 0;padding:16px 20px;margin-bottom:24px;">
        <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#e53e3e;text-transform:uppercase;letter-spacing:1px;">Reason</p>
        <p style="margin:0;font-size:14px;color:#4a5568;line-height:1.6;">${reason}</p>
      </div>` : ""}

      <p style="margin:0 0 28px;font-size:14px;color:#4a5568;line-height:1.7;">
        You may re-apply with updated information. If you believe this was a mistake, please contact our support team.
      </p>

      ${ctaButton(`${APP_URL}/p2p/merchant`, "Re-apply →")}
    `)
  );
}

// ─── Trade & Order Emails ─────────────────────────────────────────────────────

export async function sendTradeCompletedEmail(
  to: string,
  recipientName: string,
  opts: {
    role: "buyer" | "seller";
    crypto: string;
    cryptoAmount: number;
    fiatAmount: number;
    fiat: string;
    orderId: string;
  }
) {
  const { role, crypto, cryptoAmount, fiatAmount, fiat, orderId } = opts;
  const isBuyer = role === "buyer";
  await sendEmail(
    to,
    recipientName,
    `Trade Completed — ${cryptoAmount.toFixed(6)} ${crypto}`,
    emailWrapper(`
      <div style="text-align:center;padding-bottom:28px;border-bottom:1px solid #f0f2f5;margin-bottom:28px;">
        <div style="display:inline-block;width:56px;height:56px;background:#e6f9ee;border-radius:50%;line-height:56px;text-align:center;font-size:26px;margin-bottom:16px;">✓</div>
        <h2 style="margin:0 0 10px;font-size:24px;font-weight:800;color:#1a1a2e;">Trade Completed!</h2>
        <p style="margin:0;font-size:15px;color:#4a5568;line-height:1.7;">
          ${isBuyer
            ? `<strong style="color:#05b957;">${cryptoAmount.toFixed(6)} ${crypto}</strong> has been released to your account.`
            : `You have released <strong>${cryptoAmount.toFixed(6)} ${crypto}</strong> to the buyer.`}
        </p>
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f9fc;border-radius:12px;margin-bottom:28px;">
        <tr><td style="padding:4px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            ${detailRow(isBuyer ? "You received" : "You released", `<strong style="color:#05b957;">${cryptoAmount.toFixed(6)} ${crypto}</strong>`)}
            ${detailRow(isBuyer ? "You paid" : "You received", `${fiat} ${fiatAmount.toLocaleString("en-KE")}`)}
            ${detailRow("Order ID", orderId.slice(0, 16).toUpperCase(), true)}
          </table>
        </td></tr>
      </table>

      ${ctaButton(`${APP_URL}/p2p/order/${orderId}`, "View Order →", "#05b957")}
    `)
  );
}

export async function sendAdCreatedEmail(
  to: string,
  merchantName: string,
  opts: {
    side: "BUY" | "SELL";
    crypto: string;
    totalAmount: number;
    pricePerUnit: number;
    fiat: string;
    minLimit: number;
    maxLimit: number;
    adId: string;
  }
) {
  const { side, crypto, totalAmount, pricePerUnit, fiat, minLimit, maxLimit } = opts;
  const isSell = side === "SELL";
  const sideColor = isSell ? "#e53e3e" : "#05b957";
  await sendEmail(
    to,
    merchantName,
    `Your ${isSell ? "Sell" : "Buy"} ${crypto} Ad is Live`,
    emailWrapper(`
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:${sideColor};text-transform:uppercase;letter-spacing:1px;">${isSell ? "Sell" : "Buy"} Ad</p>
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#1a1a2e;">Ad Created Successfully</h2>
      <p style="margin:0 0 24px;font-size:15px;color:#4a5568;line-height:1.7;">
        Your <strong>${isSell ? "Sell" : "Buy"} ${crypto}</strong> ad is now live on Nezeem P2P and visible to traders.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f9fc;border-radius:12px;margin-bottom:28px;">
        <tr><td style="padding:4px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            ${detailRow(`Total ${crypto}`, `<strong>${totalAmount.toFixed(6)} ${crypto}</strong>`)}
            ${detailRow(`Price per ${crypto}`, `<strong style="color:#087cff;">${pricePerUnit.toLocaleString("en-KE")} ${fiat}</strong>`)}
            ${detailRow("Order Limit", `${fiat} ${minLimit.toLocaleString("en-KE")} – ${maxLimit.toLocaleString("en-KE")}`, true)}
          </table>
        </td></tr>
      </table>

      ${ctaButton(`${APP_URL}/p2p/merchant`, "View Merchant Center →")}
    `)
  );
}

export async function sendNewP2POrderEmail(
  to: string,
  merchantName: string,
  opts: {
    orderId: string;
    buyerName: string;
    crypto: string;
    cryptoAmount: number;
    fiatAmount: number;
    fiat: string;
    paymentMethod: string;
  }
) {
  const { orderId, buyerName, crypto, cryptoAmount, fiatAmount, fiat, paymentMethod } = opts;
  const method = paymentMethod === "MPESA" ? "M-Pesa" : paymentMethod === "BANK" ? "Bank Transfer" : paymentMethod;
  await sendEmail(
    to,
    merchantName,
    `New P2P Order — ${cryptoAmount.toFixed(6)} ${crypto}`,
    emailWrapper(`
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#087cff;text-transform:uppercase;letter-spacing:1px;">New Order</p>
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#1a1a2e;">Order Received</h2>
      <p style="margin:0 0 24px;font-size:15px;color:#4a5568;line-height:1.7;">
        <strong>${buyerName}</strong> has placed an order on your ad. Please process it promptly.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f9fc;border-radius:12px;margin-bottom:28px;">
        <tr><td style="padding:4px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            ${detailRow("Crypto Amount", `<strong>${cryptoAmount.toFixed(6)} ${crypto}</strong>`)}
            ${detailRow("You Receive", `<strong style="color:#05b957;">${fiat} ${fiatAmount.toLocaleString("en-KE")}</strong>`)}
            ${detailRow("Payment Method", method)}
            ${detailRow("Order ID", orderId.slice(0, 16).toUpperCase(), true)}
          </table>
        </td></tr>
      </table>

      <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;padding:14px 18px;margin-bottom:28px;">
        <p style="margin:0;font-size:13px;color:#92400e;line-height:1.6;">
          ⏰ <strong>Respond promptly.</strong> The buyer has a limited window to complete payment. Release crypto only after confirming you have received the funds.
        </p>
      </div>

      ${ctaButton(`${APP_URL}/p2p/order/${orderId}`, "View Order →")}
    `,
    "Never release crypto before confirming payment has arrived in your account."
  ));
}

// ─── Testing Notice ───────────────────────────────────────────────────────────

export async function sendTestingNoticeEmail(to: string, firstName?: string) {
  await sendEmail(
    to,
    firstName || "User",
    "Important Notice — Nezeem is Still in Testing",
    emailWrapper(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#1a1a2e;">Hi${firstName ? ` ${firstName}` : ""},</h2>
      <p style="margin:0 0 20px;font-size:15px;color:#4a5568;line-height:1.7;">
        Thank you for your interest in Nezeem and for making a deposit on the platform.
      </p>

      <div style="background:#fff5f5;border:1px solid #fcd5d5;border-left:4px solid #e53e3e;border-radius:0 10px 10px 0;padding:16px 20px;margin-bottom:24px;">
        <p style="margin:0;font-size:14px;color:#4a5568;line-height:1.6;">
          <strong style="color:#e53e3e;">Please do not place any bets or play any games</strong> on the platform at this time. We are currently running thorough tests before our official launch.
        </p>
      </div>

      <p style="margin:0 0 20px;font-size:15px;color:#4a5568;line-height:1.7;">
        Your funds are safe and your account will be fully ready once we go live. We will notify you as soon as the platform is open.
      </p>
      <p style="margin:0;font-size:15px;color:#4a5568;line-height:1.7;">
        We appreciate your patience and understanding.<br/>
        <strong>— The Nezeem Team</strong>
      </p>
    `)
  );
}
