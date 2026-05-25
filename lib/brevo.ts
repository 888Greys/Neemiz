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

export async function sendWelcomeEmail(to: string, firstName: string) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": BREVO_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: { name: BREVO_SENDER_NAME, email: BREVO_SENDER_EMAIL },
      to: [{ email: to, name: firstName || "Trader" }],
      subject: "Welcome to Nezeem",
      htmlContent: `
        <!DOCTYPE html>
        <html>
          <body style="margin:0;padding:0;background:#0b1326;font-family:Inter,sans-serif;color:#dae2fd;">
            <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
              <tr>
                <td align="center">
                  <table width="560" cellpadding="0" cellspacing="0" style="background:#171f33;border-radius:12px;border:1px solid #3c4a42;overflow:hidden;">
                    <tr>
                      <td style="background:linear-gradient(135deg,#10b981 0%,#0b1326 60%);padding:40px;text-align:center;">
                        <h1 style="margin:0;font-size:32px;font-weight:900;letter-spacing:-1px;color:#ffffff;">Ne<span style="color:#8b5cf6;">zeem</span></h1>
                        <p style="margin:8px 0 0;color:#bbcabf;font-size:13px;text-transform:uppercase;letter-spacing:2px;">Your account is ready</p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:40px;">
                        <h2 style="margin:0 0 12px;font-size:22px;font-weight:700;">Welcome, ${firstName || "Trader"} 👋</h2>
                        <p style="margin:0 0 24px;color:#bbcabf;line-height:1.6;">
                          You're now part of Nezeem — your all-in-one platform for sports betting, predictions, P2P trading, and more.
                        </p>
                        <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;width:100%;">
                          <tr>
                            <td style="background:#222a3d;border-radius:8px;padding:16px 20px;border-left:3px solid #4edea3;">
                              <p style="margin:0;font-size:13px;color:#4edea3;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Starting balance</p>
                              <p style="margin:4px 0 0;font-size:28px;font-weight:900;font-family:monospace;">$0.00</p>
                            </td>
                          </tr>
                        </table>
                        <table cellpadding="0" cellspacing="0" style="margin-bottom:32px;width:100%;">
                          <tr>
                            <td align="center">
                              <a href="${process.env.NEXT_PUBLIC_APP_URL ?? "https://nezeem.com"}/wallet" style="display:inline-block;background:#7c3aed;color:#ffffff;font-weight:700;padding:14px 36px;border-radius:8px;text-decoration:none;font-size:15px;">
                                Deposit & Start Trading →
                              </a>
                            </td>
                          </tr>
                        </table>
                        <p style="margin:0;color:#bbcabf;font-size:12px;line-height:1.6;">
                          If you didn't create this account, you can safely ignore this email.
                        </p>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:20px 40px;border-top:1px solid #3c4a42;text-align:center;">
                        <p style="margin:0;color:#86948a;font-size:11px;">© 2025 Nezeem · All rights reserved</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Brevo send failed: ${err}`);
  }
}

// ─── P2P Merchant Emails ──────────────────────────────────────────────────────

function emailWrapper(content: string) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0a0f1a;font-family:Inter,sans-serif;color:#e2e8f0;">
    <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
      <tr><td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#0f1623;border-radius:16px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">
          <tr><td style="padding:32px 40px;border-bottom:1px solid rgba(255,255,255,0.06);">
            <h1 style="margin:0;font-size:24px;font-weight:900;color:#fff;">Ne<span style="color:#087cff;">zeem</span></h1>
          </td></tr>
          <tr><td style="padding:40px;">${content}</td></tr>
          <tr><td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
            <p style="margin:0;color:#475569;font-size:11px;">© ${new Date().getFullYear()} Nezeem · All rights reserved</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;
}

// Notify admin when a new merchant application is submitted
export async function sendMerchantApplicationEmail(applicantEmail: string, displayName: string) {
  await sendEmail(
    ADMIN_EMAIL,
    "Nezeem Admin",
    `New Merchant Application — ${displayName}`,
    emailWrapper(`
      <h2 style="margin:0 0 16px;font-size:20px;font-weight:800;color:#fff;">New Merchant Application</h2>
      <p style="margin:0 0 24px;color:#94a3b8;line-height:1.6;">
        A new merchant application has been submitted and is waiting for your review.
      </p>
      <table cellpadding="0" cellspacing="0" style="width:100%;background:rgba(255,255,255,0.04);border-radius:12px;margin-bottom:28px;">
        <tr><td style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
          <p style="margin:0;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Display Name</p>
          <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#fff;">${displayName}</p>
        </td></tr>
        <tr><td style="padding:16px 20px;">
          <p style="margin:0;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Email</p>
          <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#fff;">${applicantEmail}</p>
        </td></tr>
      </table>
      <a href="${APP_URL}/admin/p2p" style="display:inline-block;background:#087cff;color:#fff;font-weight:700;padding:14px 32px;border-radius:10px;text-decoration:none;font-size:15px;">
        Review Application →
      </a>
    `)
  );
}

// Notify merchant when their KYC is approved
export async function sendKycApprovedEmail(to: string, displayName: string) {
  await sendEmail(
    to,
    displayName,
    "Your Merchant Account is Approved ✓",
    emailWrapper(`
      <div style="text-align:center;margin-bottom:32px;">
        <div style="width:64px;height:64px;background:#31c45d20;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:16px;">
          <span style="font-size:28px;">✓</span>
        </div>
        <h2 style="margin:0 0 12px;font-size:22px;font-weight:800;color:#31c45d;">You&apos;re Verified!</h2>
        <p style="margin:0;color:#94a3b8;line-height:1.6;">
          Your merchant application has been approved. You can now post buy &amp; sell ads on Nezeem P2P.
        </p>
      </div>
      <table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:28px;">
        <tr>
          <td style="padding:0 8px 0 0;">
            <div style="background:rgba(255,255,255,0.04);border-radius:10px;padding:16px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Post Ads</p>
              <p style="margin:6px 0 0;font-size:13px;color:#e2e8f0;">Set your own price &amp; limits</p>
            </div>
          </td>
          <td style="padding:0 0 0 8px;">
            <div style="background:rgba(255,255,255,0.04);border-radius:10px;padding:16px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Escrow Protected</p>
              <p style="margin:6px 0 0;font-size:13px;color:#e2e8f0;">Every trade is secured</p>
            </div>
          </td>
        </tr>
      </table>
      <div style="text-align:center;">
        <a href="${APP_URL}/p2p/merchant" style="display:inline-block;background:#31c45d;color:#fff;font-weight:700;padding:14px 32px;border-radius:10px;text-decoration:none;font-size:15px;">
          Go to Merchant Center →
        </a>
      </div>
    `)
  );
}

// One-off notice to a specific user during testing phase
export async function sendTestingNoticeEmail(to: string, firstName?: string) {
  await sendEmail(
    to,
    firstName || "User",
    "Important Notice — Nezeem is Still in Testing",
    emailWrapper(`
      <h2 style="margin:0 0 16px;font-size:20px;font-weight:800;color:#fff;">Hi${firstName ? ` ${firstName}` : ""},</h2>
      <p style="margin:0 0 20px;color:#94a3b8;line-height:1.7;">
        Thank you for your interest in Nezeem and for making a deposit on the platform.
      </p>
      <p style="margin:0 0 20px;color:#94a3b8;line-height:1.7;">
        We are currently conducting thorough testing to ensure everything works perfectly before our official launch.
        During this period, <strong style="color:#fff;">please do not place any bets or play any games</strong> on the platform.
      </p>
      <p style="margin:0 0 20px;color:#94a3b8;line-height:1.7;">
        Your funds are safe and your account will be fully ready once we go live. We will notify you as soon as the platform is open for use.
      </p>
      <p style="margin:0;color:#94a3b8;line-height:1.7;">
        We appreciate your patience and understanding.<br/>
        — The Nezeem Team
      </p>
    `)
  );
}

// Notify both parties when a trade is completed (crypto released)
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
      <div style="text-align:center;margin-bottom:28px;">
        <div style="width:56px;height:56px;background:#31c45d20;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px;">
          <span style="font-size:24px;">✓</span>
        </div>
        <h2 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#31c45d;">Trade Completed!</h2>
        <p style="margin:0;color:#94a3b8;font-size:14px;">
          ${isBuyer
            ? `<strong style="color:#fff;">${cryptoAmount.toFixed(6)} ${crypto}</strong> has been released to your account.`
            : `You have released <strong style="color:#fff;">${cryptoAmount.toFixed(6)} ${crypto}</strong> and received fiat.`}
        </p>
      </div>
      <table cellpadding="0" cellspacing="0" style="width:100%;background:rgba(255,255,255,0.04);border-radius:12px;margin-bottom:28px;">
        <tr><td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
          <p style="margin:0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">${isBuyer ? "You received" : "You released"}</p>
          <p style="margin:4px 0 0;font-size:18px;font-weight:800;color:#31c45d;">${cryptoAmount.toFixed(6)} ${crypto}</p>
        </td></tr>
        <tr><td style="padding:14px 20px;">
          <p style="margin:0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">${isBuyer ? "You paid" : "You received"}</p>
          <p style="margin:4px 0 0;font-size:18px;font-weight:800;color:#fff;">${fiat} ${fiatAmount.toLocaleString("en-KE")}</p>
        </td></tr>
      </table>
      <div style="text-align:center;">
        <a href="${APP_URL}/p2p/order/${orderId}" style="display:inline-block;background:#31c45d;color:#fff;font-weight:700;padding:14px 32px;border-radius:10px;text-decoration:none;font-size:15px;">
          View Order →
        </a>
      </div>
    `)
  );
}

// Notify merchant when they successfully create a new ad
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
  const { side, crypto, totalAmount, pricePerUnit, fiat, minLimit, maxLimit, adId } = opts;
  const action = side === "SELL" ? "Sell" : "Buy";
  const sideColor = side === "SELL" ? "#ef4444" : "#31c45d";
  await sendEmail(
    to,
    merchantName,
    `Your ${action} ${crypto} Ad is Live`,
    emailWrapper(`
      <h2 style="margin:0 0 8px;font-size:20px;font-weight:800;color:#fff;">Ad Created Successfully</h2>
      <p style="margin:0 0 24px;color:#94a3b8;line-height:1.6;">
        Your <strong style="color:${sideColor};">${action} ${crypto}</strong> ad is now live on Nezeem P2P.
      </p>
      <table cellpadding="0" cellspacing="0" style="width:100%;background:rgba(255,255,255,0.04);border-radius:12px;margin-bottom:28px;">
        <tr><td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
          <p style="margin:0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Total ${crypto}</p>
          <p style="margin:4px 0 0;font-size:18px;font-weight:800;color:#fff;">${totalAmount.toFixed(6)} ${crypto}</p>
        </td></tr>
        <tr><td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
          <p style="margin:0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Price per ${crypto}</p>
          <p style="margin:4px 0 0;font-size:18px;font-weight:800;color:#087cff;">${pricePerUnit.toLocaleString("en-KE")} ${fiat}</p>
        </td></tr>
        <tr><td style="padding:14px 20px;">
          <p style="margin:0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Order limit</p>
          <p style="margin:4px 0 0;font-size:15px;font-weight:700;color:#fff;">${fiat} ${minLimit.toLocaleString("en-KE")} – ${maxLimit.toLocaleString("en-KE")}</p>
        </td></tr>
      </table>
      <div style="text-align:center;">
        <a href="${APP_URL}/p2p/merchant" style="display:inline-block;background:#087cff;color:#fff;font-weight:700;padding:14px 32px;border-radius:10px;text-decoration:none;font-size:15px;">
          View Merchant Center →
        </a>
      </div>
    `)
  );
}

// Notify merchant when a buyer places a new order on their ad
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
      <h2 style="margin:0 0 8px;font-size:20px;font-weight:800;color:#fff;">New Order Received</h2>
      <p style="margin:0 0 24px;color:#94a3b8;line-height:1.6;">
        <strong style="color:#fff;">${buyerName}</strong> has placed an order on your ad.
      </p>
      <table cellpadding="0" cellspacing="0" style="width:100%;background:rgba(255,255,255,0.04);border-radius:12px;margin-bottom:28px;">
        <tr><td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
          <p style="margin:0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Amount</p>
          <p style="margin:4px 0 0;font-size:18px;font-weight:800;color:#fff;">${cryptoAmount.toFixed(6)} ${crypto}</p>
        </td></tr>
        <tr><td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.06);">
          <p style="margin:0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">You receive</p>
          <p style="margin:4px 0 0;font-size:18px;font-weight:800;color:#31c45d;">${fiat} ${fiatAmount.toLocaleString("en-KE")}</p>
        </td></tr>
        <tr><td style="padding:14px 20px;">
          <p style="margin:0;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Payment method</p>
          <p style="margin:4px 0 0;font-size:15px;font-weight:700;color:#fff;">${method}</p>
        </td></tr>
      </table>
      <div style="text-align:center;">
        <a href="${APP_URL}/p2p/orders/${orderId}" style="display:inline-block;background:#087cff;color:#fff;font-weight:700;padding:14px 32px;border-radius:10px;text-decoration:none;font-size:15px;">
          View Order →
        </a>
      </div>
    `)
  );
}

// Notify merchant when their KYC is rejected
export async function sendKycRejectedEmail(to: string, displayName: string, reason?: string) {
  await sendEmail(
    to,
    displayName,
    "Merchant Application Update",
    emailWrapper(`
      <div style="text-align:center;margin-bottom:32px;">
        <h2 style="margin:0 0 12px;font-size:22px;font-weight:800;color:#fff;">Application Not Approved</h2>
        <p style="margin:0;color:#94a3b8;line-height:1.6;">
          Unfortunately your merchant application was not approved at this time.
        </p>
      </div>
      ${reason ? `
      <div style="background:rgba(255,255,255,0.04);border-left:3px solid #ef4444;border-radius:0 10px 10px 0;padding:16px 20px;margin-bottom:28px;">
        <p style="margin:0;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Reason</p>
        <p style="margin:0;color:#e2e8f0;line-height:1.6;">${reason}</p>
      </div>` : ""}
      <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin-bottom:28px;">
        You may re-apply with updated information. If you believe this was a mistake, contact our support team.
      </p>
      <div style="text-align:center;">
        <a href="${APP_URL}/p2p/merchant" style="display:inline-block;background:#087cff;color:#fff;font-weight:700;padding:14px 32px;border-radius:10px;text-decoration:none;font-size:15px;">
          Re-apply →
        </a>
      </div>
    `)
  );
}
