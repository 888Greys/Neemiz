const BREVO_API_KEY = process.env.BREVO_API_KEY!;
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL!;
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME ?? "Nezeem";

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
