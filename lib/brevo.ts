import { CURRENCY_SYMBOL, MONEY_LOCALE } from "@/lib/currency";
import { isBinarySurface, surfaceBrand } from "@/lib/product-surface";
// Transactional email via Resend.
const RESEND_API_KEY = process.env.RESEND_API_KEY!;
const SENDER_EMAIL = process.env.MAIL_SENDER_EMAIL ?? process.env.BREVO_SENDER_EMAIL ?? "noreply@nezeem.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://nezeem.com";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "toxicgreys001@gmail.com";

function mailBrand(): string {
  return process.env.MAIL_SENDER_NAME?.trim()
    || process.env.BREVO_SENDER_NAME?.trim()
    || surfaceBrand();
}

function supportEmail(): string {
  if (isBinarySurface()) {
    return (process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@binaryoptionske.com").trim();
  }
  return "support@nezeem.com";
}

function supportTelegram(): string {
  if (isBinarySurface()) {
    return (process.env.NEXT_PUBLIC_TELEGRAM_URL ?? "").trim();
  }
  return "https://t.me/NeezemSupport";
}

async function sendEmail(to: string, toName: string, subject: string, htmlContent: string) {
  if (!RESEND_API_KEY) {
    throw new Error("Resend send failed: RESEND_API_KEY is not configured");
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${mailBrand()} <${SENDER_EMAIL}>`,
      to: [toName ? `${toName} <${to}>` : to],
      subject,
      html: htmlContent,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Resend send failed: ${await res.text()}`);
}

/** Admin login one-time code (email fallback when the authenticator is unavailable). */
export async function sendAdminLoginCodeEmail(to: string, code: string) {
  const html = `
    <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="margin:0 0 8px;color:#0f172a">Nezeem admin login code</h2>
      <p style="color:#475569;margin:0 0 16px">Use this code to sign in to the admin panel. It expires in 10 minutes.</p>
      <div style="font-size:32px;font-weight:800;letter-spacing:8px;background:#f1f5f9;border-radius:12px;padding:18px;text-align:center;color:#0f172a">${escapeHtml(code)}</div>
      <p style="color:#94a3b8;font-size:12px;margin:16px 0 0">If you didn't request this, ignore this email and consider rotating your admin credentials.</p>
    </div>`;
  await sendEmail(to, "Admin", "Your Nezeem admin login code", html);
}

export async function waitForEmailDelivery(
  label: string,
  emails: Array<Promise<unknown> | null | undefined>,
) {
  const pending = emails.filter((email): email is Promise<unknown> => Boolean(email));
  if (pending.length === 0) return;

  const results = await Promise.allSettled(pending);
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(`${label} email ${index + 1} failed:`, result.reason);
    }
  });
}

// ─── Shared Layout (Bybit-style, Nezeem branding) ─────────────────────────────

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  })[char] ?? char);
}

function traderGreeting(name?: string | null) {
  const display = (name || "").trim();
  return `<p style="margin:0 0 16px;font-size:15px;color:#1a1a2e;line-height:1.7;">Dear ${display ? escapeHtml(display) : "Trader"},</p>`;
}

function adminGreeting() {
  return `<p style="margin:0 0 16px;font-size:15px;color:#1a1a2e;line-height:1.7;">Dear Admin,</p>`;
}

function statusParagraph(text: string) {
  return `<p style="margin:0 0 20px;font-size:15px;color:#1a1a2e;line-height:1.7;">${text}</p>`;
}

function detailRow(label: string, value: string, last = false) {
  return `<tr>
    <td style="padding:10px 0;${last ? "" : "border-bottom:1px solid #eef1f5;"}font-size:14px;color:#667085;vertical-align:top;width:42%;">${label}</td>
    <td style="padding:10px 0;${last ? "" : "border-bottom:1px solid #eef1f5;"}font-size:14px;color:#1a1a2e;font-weight:600;text-align:right;vertical-align:top;overflow-wrap:anywhere;word-break:break-word;">${value}</td>
  </tr>`;
}

function detailBlock(title: string, rows: string) {
  return `
    <p style="margin:0 0 10px;font-size:15px;color:#1a1a2e;line-height:1.7;">${title}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      ${rows}
    </table>`;
}

function supportLine() {
  const email = supportEmail();
  const tg = supportTelegram();
  const tgBit = tg
    ? ` or <a href="${tg}" style="color:#1687ff;text-decoration:none;">Telegram</a>`
    : "";
  return `<p style="margin:0 0 8px;font-size:14px;color:#667085;line-height:1.7;">
    If you need further assistance, please reach out to
    <a href="mailto:${email}" style="color:#1687ff;text-decoration:none;">${email}</a>${tgBit}.
  </p>`;
}

function emailClosing() {
  return `<p style="margin:16px 0 0;font-size:15px;color:#1a1a2e;line-height:1.7;">${mailBrand()}</p>`;
}

function verificationCodeBlock(code: string) {
  return `<div style="margin:0 0 24px;padding:20px 16px;background:#f7f9fc;border:1px solid #e8ebef;border-radius:8px;text-align:center;">
    <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#8991a3;text-transform:uppercase;letter-spacing:1px;">Verification code</p>
    <p style="margin:0;font-size:32px;font-weight:800;letter-spacing:0.35em;color:#1a1a2e;">${escapeHtml(code)}</p>
  </div>`;
}

function ctaButton(href: string, label: string, color = "#1687ff") {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
    <tr><td>
      <a href="${href}" style="display:inline-block;background:${color};color:#ffffff;font-weight:700;font-size:14px;padding:12px 22px;border-radius:6px;text-decoration:none;">
        ${label}
      </a>
    </td></tr>
  </table>`;
}

function emailWrapper(content: string, preheader?: string) {
  const brand = mailBrand();
  const preview = preheader ?? `An update from your ${brand} account`;
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
    a { overflow-wrap:anywhere; word-break:break-word; }
    @media only screen and (max-width:620px) {
      .outer-pad { padding:0 !important; }
      .email-shell { width:100% !important; max-width:100% !important; }
      .email-pad { padding:24px 16px !important; }
      .logo-pad { padding:20px 16px !important; }
      .footer-pad { padding:16px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a2e;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preview}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="outer-pad" style="background:#f4f6f8;padding:28px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" class="email-shell" style="max-width:560px;width:100%;">
        <tr><td align="left" class="logo-pad" style="padding:0 0 18px;">
          <a href="${APP_URL}" style="text-decoration:none;font-size:22px;font-weight:800;color:#17192a;">${brand}</a>
        </td></tr>
        <tr><td class="email-pad" style="background:#ffffff;border:1px solid #e5e8ed;border-radius:8px;padding:32px 28px;">
          ${content}
          ${supportLine()}
          ${emailClosing()}
        </td></tr>
        <tr><td class="footer-pad" style="padding:18px 4px 0;text-align:left;">
          <p style="margin:0;font-size:12px;color:#8991a3;">
            <a href="${APP_URL}" style="color:#1687ff;text-decoration:none;">nezeem.com</a>
            &nbsp;·&nbsp;
            <a href="${APP_URL}/support" style="color:#8991a3;text-decoration:none;">Support</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

const NETWORK_LABELS: Record<string, string> = {
  TRC20: "TRC-20 (Tron)",
  ERC20: "ERC-20 (Ethereum)",
  BEP20: "BEP-20 (BSC)",
  POLYGON: "Polygon",
  BITCOIN: "Bitcoin",
  BTC: "Bitcoin",
};

function networkLabel(network: string) {
  return NETWORK_LABELS[network] ?? network;
}

function explorerUrl(network: string, txHash: string) {
  if (network === "TRC20") return `https://tronscan.org/#/transaction/${txHash}`;
  if (network === "BITCOIN" || network === "BTC") return `https://blockstream.info/tx/${txHash}`;
  if (network === "BEP20") return `https://bscscan.com/tx/${txHash}`;
  if (network === "ERC20") return `https://etherscan.io/tx/${txHash}`;
  return `https://polygonscan.com/tx/${txHash}`;
}

function txidLink(network: string, txHash: string) {
  const href = explorerUrl(network, txHash);
  const short = txHash.length > 24 ? `${txHash.slice(0, 20)}…` : txHash;
  return `<a href="${href}" style="color:#1687ff;text-decoration:none;">${escapeHtml(short)}</a>`;
}

function money(amount: number) {
  return `${CURRENCY_SYMBOL} ${amount.toLocaleString(MONEY_LOCALE)}`;
}

// ─── Admin alerts ─────────────────────────────────────────────────────────────

/**
 * Alert the owner that a single M-Pesa destination number is receiving an
 * unusual number of withdrawals (possible mule/collector). The latest
 * withdrawal has been auto-held for approval.
 */
export async function sendSuspiciousNumberAlertEmail(info: {
  msisdn: string;
  count: number;
  amountKes: number;
  held: boolean;
  autoKilled?: boolean;
  distinctUsers?: number;
}) {
  const subject = info.autoKilled
    ? `🚨 Nezeem: withdrawals AUTO-DISABLED — +${info.msisdn}`
    : `🚨 Nezeem: ${info.count} withdrawals to one number (+${info.msisdn})`;
  const status = info.autoKilled
    ? "This crossed the auto-kill threshold, so all withdrawals have been automatically disabled."
    : info.held
      ? "This withdrawal has been held for your approval — it will not pay out until you approve it."
      : "This withdrawal was allowed to proceed.";

  await sendEmail(
    ADMIN_EMAIL,
    "Nezeem Admin",
    subject,
    emailWrapper(`
      ${adminGreeting()}
      ${statusParagraph(`The M-Pesa number +${escapeHtml(info.msisdn)} has received ${info.count} withdrawals in the last 24 hours${info.distinctUsers ? ` across ${info.distinctUsers} accounts` : ""}.`)}
      ${detailBlock("The alert information is as follows:", `
        ${detailRow("Destination", `+${escapeHtml(info.msisdn)}`)}
        ${detailRow("Withdrawals (24h)", String(info.count))}
        ${detailRow("Latest amount", money(info.amountKes))}
        ${info.distinctUsers ? detailRow("Distinct users", String(info.distinctUsers)) : ""}
        ${detailRow("Status", status, true)}
      `)}
      ${ctaButton(`${APP_URL}/admin/withdrawals`, "Review withdrawals →", "#dc2626")}
    `, subject),
  );
}

/**
 * Alert the owner that an `is_admin` flag changed on the users table. A flip to
 * TRUE on a non-allowlisted email is the josemuthama-class signature (someone
 * with DB/service-role access granting themselves admin) and is flagged CRITICAL.
 */
export async function sendAdminChangeAlertEmail(changes: {
  email: string; username: string | null; from: string; to: string;
  app: string | null; ip: string | null; at: string; allowlisted: boolean;
}[]) {
  const critical = changes.some((c) => c.to === "true" && !c.allowlisted);
  const subject = critical
    ? "🚨 Nezeem: is_admin granted to a NON-allowlisted account"
    : `Nezeem: admin flag changed (${changes.length})`;

  const blocks = changes.map((c, i) => detailBlock(
    `Change ${i + 1} information is as follows:`,
    `
      ${detailRow("Account", `${escapeHtml(c.email)}${c.username ? ` (${escapeHtml(c.username)})` : ""}`)}
      ${detailRow("Change", `${escapeHtml(c.from)} → ${escapeHtml(c.to)}`)}
      ${detailRow("Allowlist", c.to === "true" && !c.allowlisted ? "NOT allowlisted" : "allowlisted")}
      ${detailRow("Source", `${escapeHtml(c.app ?? "?")} / ${escapeHtml(c.ip ?? "?")}`)}
      ${detailRow("When (UTC)", escapeHtml(c.at), true)}
    `,
  )).join("");

  await sendEmail(
    ADMIN_EMAIL,
    "Nezeem Admin",
    subject,
    emailWrapper(`
      ${adminGreeting()}
      ${statusParagraph(critical
        ? "One change granted admin to an email that is NOT on the owner allowlist. Investigate this write."
        : "The is_admin column changed on the users table. All changes are on allowlisted accounts.")}
      ${blocks}
    `, subject),
  );
}

/**
 * Alert the owner that the runtime RTP guard auto-halted a binary contract kind
 * (realized house loss over volume) and/or flagged high-RTP players.
 */
export async function sendRtpGuardAlertEmail(r: {
  halted: { kind: string; rtp: number }[];
  userFlags: { userId: string; rtp: number; count: number }[];
  windowH: number;
}) {
  const subject = r.halted.length
    ? `🚨 Nezeem: binary ${r.halted.map((h) => h.kind).join(", ")} AUTO-HALTED (RTP breach)`
    : `Nezeem: ${r.userFlags.length} high-RTP player(s) flagged`;

  const haltRows = r.halted.map((h, i) =>
    detailRow(h.kind, `${(h.rtp * 100).toFixed(0)}% RTP (auto-disabled)`, i === r.halted.length - 1 && r.userFlags.length === 0),
  ).join("");
  const userRows = r.userFlags.map((u, i) =>
    detailRow(`${u.userId.slice(0, 10)}…`, `${(u.rtp * 100).toFixed(0)}% over ${u.count} trades`, i === r.userFlags.length - 1),
  ).join("");

  await sendEmail(
    ADMIN_EMAIL,
    "Nezeem Admin",
    subject,
    emailWrapper(`
      ${adminGreeting()}
      ${statusParagraph(`Realized RTP over the last ${r.windowH}h triggered a risk alert (admin/test accounts excluded).`)}
      ${r.halted.length ? detailBlock("The auto-halted contracts are as follows:", haltRows) : ""}
      ${r.userFlags.length ? detailBlock("The flagged players are as follows:", userRows) : ""}
      ${ctaButton(`${APP_URL}/admin/risk`, "Open risk panel →", "#dc2626")}
    `, subject),
  );
}

/**
 * Alert the owner that the daily ledger reconciliation found accounts holding
 * balance with no transaction trail — the signature of money injected straight
 * into wallet_balance (DB compromise / re-breach).
 */
export async function sendReconMismatchEmail(
  findings: Array<{ username: string | null; balance: number; unexplained: number }>,
  total: number,
) {
  const subject = `🚨 Nezeem: unexplained balances detected (${findings.length} account${findings.length === 1 ? "" : "s"})`;
  const rows = findings.slice(0, 25).map((f, i, arr) =>
    detailRow(
      `@${escapeHtml(f.username ?? "?")}`,
      `Balance ${money(f.balance)} · Unexplained +${money(f.unexplained)}`,
      i === arr.length - 1,
    ),
  ).join("");

  await sendEmail(
    ADMIN_EMAIL,
    "Nezeem Admin",
    subject,
    emailWrapper(`
      ${adminGreeting()}
      ${statusParagraph(`Daily reconciliation found ${findings.length} active account(s) holding ${money(total)} of balance the ledger cannot account for. Treat keys as potentially leaked.`)}
      ${detailBlock("The mismatched accounts are as follows:", rows)}
      ${ctaButton(`${APP_URL}/admin/withdrawals`, "Open admin console →", "#dc2626")}
    `, subject),
  );
}

/**
 * Alert the owner that the signup-velocity tripwire detected likely bot account
 * farming — an abnormal burst of new accounts, tight same-second clusters, or one
 * device registering many accounts. Detection-only: no accounts are auto-frozen.
 */
export async function sendBotSignupAlertEmail(report: {
  windowMinutes: number;
  totalSignups: number;
  burst: boolean;
  burstThreshold: number;
  clusters: Array<{ at: string; count: number }>;
  devices: Array<{ deviceHash: string; users: number }>;
  emailClusters: Array<{ email: string; count: number }>;
}) {
  const reasons: string[] = [];
  if (report.burst) reasons.push(`${report.totalSignups} signups in ${report.windowMinutes} min (threshold ${report.burstThreshold})`);
  if (report.clusters.length) reasons.push(`${report.clusters.length} tight time-cluster(s)`);
  if (report.devices.length) reasons.push(`${report.devices.length} shared-device group(s)`);
  if (report.emailClusters.length) reasons.push(`${report.emailClusters.length} email-alias group(s)`);
  const subject = `🤖 Nezeem: possible bot signups — ${reasons.join(", ")}`;

  const clusterRows = report.clusters.slice(0, 15).map((c, i, arr) =>
    detailRow(escapeHtml(c.at), `${c.count} accounts`, i === arr.length - 1),
  ).join("");
  const deviceRows = report.devices.slice(0, 15).map((d, i, arr) =>
    detailRow(escapeHtml(`${d.deviceHash.slice(0, 12)}…`), `${d.users} accounts`, i === arr.length - 1),
  ).join("");
  const emailRows = report.emailClusters.slice(0, 15).map((e, i, arr) =>
    detailRow(escapeHtml(e.email), `${e.count} accounts`, i === arr.length - 1),
  ).join("");

  await sendEmail(
    ADMIN_EMAIL,
    "Nezeem Admin",
    subject,
    emailWrapper(`
      ${adminGreeting()}
      ${statusParagraph(`The signup-velocity tripwire flagged unusual account creation in the last ${report.windowMinutes} minutes: ${escapeHtml(reasons.join("; "))}. No accounts have been frozen.`)}
      ${report.clusters.length ? detailBlock("The tight signup clusters are as follows:", clusterRows) : ""}
      ${report.devices.length ? detailBlock("The shared-device groups are as follows:", deviceRows) : ""}
      ${report.emailClusters.length ? detailBlock("The email-alias groups are as follows:", emailRows) : ""}
      ${ctaButton(`${APP_URL}/admin/players`, "Review new accounts →", "#dc2626")}
    `, subject),
  );
}

/**
 * Consolidated owner alert when one or more business-health metrics breach their
 * thresholds (deposit/payout/settlement). One email lists every firing metric.
 */
export async function sendBusinessMetricAlertEmail(
  alerts: Array<{ title: string; detail: string; link: string; severity: "warn" | "critical" }>,
) {
  if (alerts.length === 0) return;
  const hasCritical = alerts.some((a) => a.severity === "critical");
  const subject = `${hasCritical ? "🔴" : "🟠"} Nezeem health alert — ${alerts.length} metric${alerts.length > 1 ? "s" : ""} need attention`;
  const rows = alerts.map((a, i) =>
    detailRow(
      `[${a.severity === "critical" ? "Critical" : "Warning"}] ${escapeHtml(a.title)}`,
      escapeHtml(a.detail),
      i === alerts.length - 1,
    ),
  ).join("");

  await sendEmail(
    ADMIN_EMAIL,
    "Nezeem Admin",
    subject,
    emailWrapper(`
      ${adminGreeting()}
      ${statusParagraph(`Automated health check flagged ${alerts.length} metric${alerts.length > 1 ? "s" : ""} on the money-movement spine.`)}
      ${detailBlock("The health alert information is as follows:", rows)}
      ${ctaButton(`${APP_URL}/admin`, "Open admin console →", hasCritical ? "#dc2626" : "#1687ff")}
    `, subject),
  );
}

// ─── Account / auth ───────────────────────────────────────────────────────────

export async function sendWelcomeEmail(to: string, firstName: string) {
  const name = firstName || "Trader";
  const brand = mailBrand();
  const pitch = isBinarySurface()
    ? `Your ${brand} account is ready. Deposit and trade binary options.`
    : `Your ${brand} account is ready. You can deposit funds and start trading on sports, predictions, and P2P crypto.`;
  await sendEmail(
    to,
    name,
    `Welcome to ${brand}`,
    emailWrapper(`
      ${traderGreeting(name)}
      ${statusParagraph(pitch)}
      ${detailBlock("The account information is as follows:", `
        ${detailRow("Status", "Active")}
        ${detailRow("Platform", brand, true)}
      `)}
      ${ctaButton(`${APP_URL}/wallet`, "Deposit &amp; Start Trading →")}
    `, `Welcome to ${brand}`),
  );
}

export async function sendWithdrawReopenedEmail(to: string, firstName: string) {
  const name = firstName || "Trader";
  const brand = mailBrand();
  await sendEmail(
    to,
    name,
    `M-Pesa withdrawals are back on ${brand}`,
    emailWrapper(`
      ${traderGreeting(name)}
      ${statusParagraph(`M-Pesa withdrawals are working again. You can withdraw from your ${brand} wallet straight to M-Pesa.`)}
      ${detailBlock("The withdrawal service information is as follows:", `
        ${detailRow("Method", "M-Pesa")}
        ${detailRow("Status", "Available", true)}
      `)}
      ${ctaButton(`${APP_URL}/wallet`, "Withdraw now →")}
    `, "M-Pesa withdrawals reopened"),
  );
}

export async function sendNewLoginEmail(
  to: string,
  name: string,
  details: { when: string; device: string; ip: string; location?: string },
) {
  const display = name || "Trader";
  const brand = mailBrand();
  await sendEmail(
    to,
    display,
    `New login to your ${brand} account`,
    emailWrapper(`
      ${traderGreeting(display)}
      ${statusParagraph(`We detected a new sign-in to your ${brand} account. If this was you, no action is needed.`)}
      ${detailBlock("The login information is as follows:", `
        ${detailRow("When", escapeHtml(details.when))}
        ${detailRow("Device", escapeHtml(details.device))}
        ${detailRow("IP Address", escapeHtml(details.ip))}
        ${details.location ? detailRow("Location", escapeHtml(details.location), true) : detailRow("Location", "—", true)}
      `)}
      ${ctaButton(`${APP_URL}/profile`, "Review account security →")}
    `, "New login detected"),
  );
}

/** 6-digit email OTP for login / 2FA challenge. */
export async function sendEmailOtpCode(to: string, firstName: string, code: string) {
  const name = firstName || "Trader";
  const brand = mailBrand();
  await sendEmail(
    to,
    name,
    `${code} is your ${brand} verification code`,
    emailWrapper(`
      ${traderGreeting(name)}
      ${statusParagraph(`Use this verification code to finish signing in to ${brand}. It expires in 10 minutes.`)}
      ${verificationCodeBlock(code)}
      ${detailBlock("The verification information is as follows:", `
        ${detailRow("Code validity", "10 minutes")}
        ${detailRow("Action", "Sign-in / 2FA", true)}
      `)}
      <p style="margin:0 0 16px;font-size:13px;color:#8991a3;line-height:1.6;">
        If you didn&apos;t try to sign in, you can ignore this email. Do not share this code with anyone.
      </p>
    `, `Your ${brand} verification code`),
  );
}

export async function sendTestingNoticeEmail(to: string, firstName?: string) {
  await sendEmail(
    to,
    firstName || "Trader",
    "Important Notice — Nezeem is Still in Testing",
    emailWrapper(`
      ${traderGreeting(firstName)}
      ${statusParagraph("Thank you for your interest in Nezeem and for making a deposit. The platform is still in testing before official launch.")}
      ${detailBlock("The notice information is as follows:", `
        ${detailRow("Status", "Testing")}
        ${detailRow("Action required", "Do not place bets or play games yet")}
        ${detailRow("Funds", "Safe in your account", true)}
      `)}
      <p style="margin:0 0 16px;font-size:14px;color:#667085;line-height:1.7;">
        We will notify you as soon as the platform is open.
      </p>
    `, "Nezeem is still in testing"),
  );
}

// ─── Games ────────────────────────────────────────────────────────────────────

export async function sendGameResultEmail(
  to: string,
  displayName: string,
  opts: {
    game: string;
    outcome: "WON" | "LOST" | "VOID";
    stake: number;
    payout?: number;
    reference: string;
    summary?: string;
    href: string;
  },
) {
  const won = opts.outcome === "WON";
  const voided = opts.outcome === "VOID";
  const subject = won
    ? `You won ${CURRENCY_SYMBOL} ${Number(opts.payout ?? 0).toLocaleString(MONEY_LOCALE)} on Nezeem`
    : voided
      ? `${opts.game} bet refunded`
      : `${opts.game} bet result`;
  const status = won
    ? `You've successfully won on ${escapeHtml(opts.game)}. Your winnings have been credited to your wallet.`
    : voided
      ? `Your ${escapeHtml(opts.game)} bet was refunded. Your stake has been returned to your wallet.`
      : `Your ${escapeHtml(opts.game)} bet has been settled. This bet did not win.`;

  await sendEmail(
    to,
    displayName || "Trader",
    subject,
    emailWrapper(`
      ${traderGreeting(displayName)}
      ${statusParagraph(opts.summary ? escapeHtml(opts.summary) : status)}
      ${detailBlock("The bet information is as follows:", `
        ${detailRow("Game", escapeHtml(opts.game))}
        ${detailRow("Result", opts.outcome)}
        ${detailRow("Stake", money(opts.stake))}
        ${opts.payout !== undefined ? detailRow(won ? "Credited" : "Returned", money(opts.payout)) : ""}
        ${detailRow("Reference", escapeHtml(opts.reference.slice(0, 18).toUpperCase()), true)}
      `)}
      ${ctaButton(opts.href, "View details →")}
    `, `${opts.game} result: ${opts.outcome}`),
  );
}

// ─── P2P Merchant ─────────────────────────────────────────────────────────────

export async function sendMerchantApplicationEmail(applicantEmail: string, displayName: string) {
  await sendEmail(
    ADMIN_EMAIL,
    "Nezeem Admin",
    `New Merchant Application — ${displayName}`,
    emailWrapper(`
      ${adminGreeting()}
      ${statusParagraph("A new merchant application is waiting for your review in the admin panel.")}
      ${detailBlock("The application information is as follows:", `
        ${detailRow("Display Name", escapeHtml(displayName))}
        ${detailRow("Email", escapeHtml(applicantEmail), true)}
      `)}
      ${ctaButton(`${APP_URL}/admin/p2p`, "Review Application →")}
    `, "New merchant application"),
  );
}

export async function sendKycApprovedEmail(to: string, displayName: string) {
  await sendEmail(
    to,
    displayName,
    "Your Merchant Account is Approved",
    emailWrapper(`
      ${traderGreeting(displayName)}
      ${statusParagraph("Your merchant application has been approved. You can now post buy and sell ads on Nezeem P2P.")}
      ${detailBlock("The merchant account information is as follows:", `
        ${detailRow("Status", "Approved")}
        ${detailRow("Access", "Post buy &amp; sell ads", true)}
      `)}
      ${ctaButton(`${APP_URL}/p2p/merchant`, "Go to Merchant Center →", "#05b957")}
    `, "Merchant account approved"),
  );
}

export async function sendKycRejectedEmail(to: string, displayName: string, reason?: string) {
  await sendEmail(
    to,
    displayName,
    "Merchant Application Update",
    emailWrapper(`
      ${traderGreeting(displayName)}
      ${statusParagraph("Unfortunately your merchant application was not approved at this time. You may re-apply with updated information.")}
      ${detailBlock("The application information is as follows:", `
        ${detailRow("Status", "Not approved")}
        ${reason ? detailRow("Reason", escapeHtml(reason), true) : detailRow("Next step", "Re-apply with updated information", true)}
      `)}
      ${ctaButton(`${APP_URL}/p2p/merchant`, "Re-apply →")}
    `, "Merchant application update"),
  );
}

// ─── Trade & Order Emails ─────────────────────────────────────────────────────

export async function sendTradeCompletedEmail(
  to: string,
  recipientName: string,
  opts: {
    role: "cryptoReceiver" | "cryptoSender";
    crypto: string;
    cryptoAmount: number;
    netCryptoAmount: number;
    fiatAmount: number;
    fiat: string;
    orderId: string;
  },
) {
  const { role, crypto, cryptoAmount, netCryptoAmount, fiatAmount, fiat, orderId } = opts;
  const isReceiver = role === "cryptoReceiver";
  const receivedCrypto = netCryptoAmount || cryptoAmount;
  const amountLabel = (isReceiver ? receivedCrypto : cryptoAmount).toFixed(6);

  await sendEmail(
    to,
    recipientName,
    `Trade Completed — ${amountLabel} ${crypto}`,
    emailWrapper(`
      ${traderGreeting(recipientName)}
      ${statusParagraph(isReceiver
        ? `You've successfully received ${amountLabel} ${escapeHtml(crypto)} from your P2P trade.`
        : `You've successfully released ${amountLabel} ${escapeHtml(crypto)} to the counterparty.`)}
      ${detailBlock("The trade information is as follows:", `
        ${detailRow(isReceiver ? "You received" : "You released", `<strong>${amountLabel} ${escapeHtml(crypto)}</strong>`)}
        ${detailRow(isReceiver ? "You paid" : "You received", `${escapeHtml(fiat)} ${fiatAmount.toLocaleString(MONEY_LOCALE)}`)}
        ${detailRow("Order ID", escapeHtml(orderId.slice(0, 16).toUpperCase()), true)}
      `)}
      ${ctaButton(`${APP_URL}/p2p/order/${orderId}`, "View Order →", "#05b957")}
    `, "P2P trade completed"),
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
  },
) {
  const { side, crypto, totalAmount, pricePerUnit, fiat, minLimit, maxLimit } = opts;
  const isSell = side === "SELL";

  await sendEmail(
    to,
    merchantName,
    `Your ${isSell ? "Sell" : "Buy"} ${crypto} Ad is Live`,
    emailWrapper(`
      ${traderGreeting(merchantName)}
      ${statusParagraph(`Your ${isSell ? "Sell" : "Buy"} ${escapeHtml(crypto)} ad is now live on Nezeem P2P and visible to traders.`)}
      ${detailBlock("The ad information is as follows:", `
        ${detailRow("Side", isSell ? "Sell" : "Buy")}
        ${detailRow(`Total ${escapeHtml(crypto)}`, `${totalAmount.toFixed(6)} ${escapeHtml(crypto)}`)}
        ${detailRow(`Price per ${escapeHtml(crypto)}`, `${pricePerUnit.toLocaleString(MONEY_LOCALE)} ${escapeHtml(fiat)}`)}
        ${detailRow("Order Limit", `${escapeHtml(fiat)} ${minLimit.toLocaleString(MONEY_LOCALE)} – ${maxLimit.toLocaleString(MONEY_LOCALE)}`, true)}
      `)}
      ${ctaButton(`${APP_URL}/p2p/merchant`, "View Merchant Center →", "#05b957")}
    `, "P2P ad created"),
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
    side: "BUY" | "SELL";
  },
) {
  const { orderId, buyerName, crypto, cryptoAmount, fiatAmount, fiat, paymentMethod, side } = opts;
  const method = paymentMethod === "MPESA" ? "M-Pesa" : paymentMethod === "BANK" ? "Bank Transfer" : paymentMethod;
  const merchantIsSelling = side === "SELL";
  const takerAction = merchantIsSelling ? "buy" : "sell";
  const fiatRowLabel = merchantIsSelling ? "You Receive" : "You Pay";

  await sendEmail(
    to,
    merchantName,
    `New P2P Order — ${cryptoAmount.toFixed(6)} ${crypto}`,
    emailWrapper(`
      ${traderGreeting(merchantName)}
      ${statusParagraph(`<strong>${escapeHtml(buyerName)}</strong> wants to ${takerAction} ${escapeHtml(crypto)} using your ad. Please process it promptly.`)}
      ${detailBlock("The order information is as follows:", `
        ${detailRow("Crypto Amount", `${cryptoAmount.toFixed(6)} ${escapeHtml(crypto)}`)}
        ${detailRow(fiatRowLabel, `${escapeHtml(fiat)} ${fiatAmount.toLocaleString(MONEY_LOCALE)}`)}
        ${detailRow("Payment Method", escapeHtml(method))}
        ${detailRow("Order ID", escapeHtml(orderId.slice(0, 16).toUpperCase()), true)}
      `)}
      ${ctaButton(`${APP_URL}/p2p/order/${orderId}`, "View Order →")}
    `, "New P2P order"),
  );
}

export async function sendP2PMessageEmail(
  to: string,
  recipientName: string,
  opts: {
    orderId: string;
    senderName: string;
    message: string;
    hasImage: boolean;
  },
) {
  const senderName = escapeHtml(opts.senderName);
  const subjectSender = opts.senderName.replace(/[\r\n]+/g, " ").trim() || "a trader";
  const message = escapeHtml(opts.message || (opts.hasImage ? "Sent an image" : "Sent you a message"));

  await sendEmail(
    to,
    recipientName,
    `New message from ${subjectSender} on Nezeem P2P`,
    emailWrapper(`
      ${traderGreeting(recipientName)}
      ${statusParagraph(`${senderName} sent you a message on your P2P order.`)}
      ${detailBlock("The message information is as follows:", `
        ${detailRow("From", senderName)}
        ${detailRow("Order ID", escapeHtml(opts.orderId.slice(0, 12).toUpperCase()))}
        ${detailRow("Message", message)}
        ${detailRow("Attachment", opts.hasImage ? "Image attached" : "None", true)}
      `)}
      ${ctaButton(`${APP_URL}/p2p/order/${opts.orderId}`, "Open Chat and Reply")}
    `, "New P2P message"),
  );
}

export async function sendP2POrderStatusEmail(
  to: string,
  recipientName: string,
  opts: {
    orderId: string;
    title: string;
    message: string;
    subject: string;
    crypto: string;
    cryptoAmount: number;
    fiat: string;
    fiatAmount: number;
    accent?: string;
    actionLabel?: string;
  },
) {
  const accent = opts.accent ?? "#1687ff";
  await sendEmail(
    to,
    recipientName,
    opts.subject,
    emailWrapper(`
      ${traderGreeting(recipientName)}
      ${statusParagraph(`${escapeHtml(opts.title)}. ${escapeHtml(opts.message)}`)}
      ${detailBlock("The order information is as follows:", `
        ${detailRow("Crypto Amount", `${opts.cryptoAmount.toFixed(6)} ${escapeHtml(opts.crypto)}`)}
        ${detailRow("Fiat Amount", `${escapeHtml(opts.fiat)} ${opts.fiatAmount.toLocaleString(MONEY_LOCALE)}`)}
        ${detailRow("Order ID", escapeHtml(opts.orderId.slice(0, 16).toUpperCase()), true)}
      `)}
      ${ctaButton(`${APP_URL}/p2p/order/${opts.orderId}`, opts.actionLabel ?? "View Order →", accent)}
    `, opts.subject),
  );
}

// ─── Crypto Deposit Email ─────────────────────────────────────────────────────

export async function sendCryptoDepositEmail(
  to: string,
  displayName: string,
  opts: {
    crypto: string;
    network: string;
    cryptoAmount: number;
    txHash: string;
    address?: string;
  },
) {
  const { crypto, network, cryptoAmount, txHash, address } = opts;
  const amount = `${cryptoAmount.toFixed(8)} ${crypto}`;

  await sendEmail(
    to,
    displayName,
    `${cryptoAmount.toFixed(6)} ${crypto} deposit received`,
    emailWrapper(`
      ${traderGreeting(displayName)}
      ${statusParagraph(`You've successfully deposited ${escapeHtml(amount)} to your ${mailBrand()} account.`)}
      ${detailBlock("The deposit information is as follows:", `
        ${detailRow("Deposit amount", escapeHtml(amount))}
        ${detailRow("Chain type", escapeHtml(networkLabel(network)))}
        ${address ? detailRow("Deposit address", escapeHtml(address)) : ""}
        ${detailRow("TXID", txidLink(network, txHash))}
        ${detailRow("Status", "Credited", true)}
      `)}
      ${ctaButton(`${APP_URL}/dashboard`, "Go to Dashboard →")}
    `, "Crypto deposit credited"),
  );
}

export async function sendCryptoWithdrawalEmail(
  to: string,
  displayName: string,
  opts: {
    crypto: string;
    network: string;
    cryptoAmount: number;
    address: string;
    txHash?: string;
    fee?: number;
  },
) {
  const { crypto, network, cryptoAmount, address, txHash, fee } = opts;
  const amount = `${cryptoAmount.toFixed(8)} ${crypto}`;
  const timestamp = `${new Date().toISOString().slice(0, 19).replace("T", " ")} UTC`;

  await sendEmail(
    to,
    displayName,
    `${cryptoAmount.toFixed(6)} ${crypto} withdrawal sent`,
    emailWrapper(`
      ${traderGreeting(displayName)}
      ${statusParagraph(`The status of your withdrawal has been updated to: Sent. You may check the relevant details on the blockchain.`)}
      ${detailBlock("The withdrawal information is as follows:", `
        ${detailRow("Withdrawal amount", escapeHtml(amount))}
        ${detailRow("Chain type", escapeHtml(networkLabel(network)))}
        ${detailRow("Withdrawal address", escapeHtml(address))}
        ${txHash ? detailRow("TXID", txidLink(network, txHash)) : ""}
        ${fee && fee > 0 ? detailRow("Transaction fee", escapeHtml(`${fee.toFixed(8)} ${crypto}`)) : ""}
        ${detailRow("Timestamp", escapeHtml(timestamp))}
        ${detailRow("Status", "Sent", true)}
      `)}
      ${statusParagraph("If you did not request this withdrawal, please contact support immediately.")}
    `, "Crypto withdrawal sent"),
  );
}

// Stage 1: the deposit has been SEEN on-chain but is still awaiting the
// confirmations required before we credit it. Sent once per transaction; the
// "credited" email (above) follows once it confirms.
export async function sendCryptoDepositPendingEmail(
  to: string,
  displayName: string,
  opts: {
    crypto: string;
    network: string;
    cryptoAmount: number;
    txHash: string;
    address?: string;
  },
) {
  const { crypto, network, cryptoAmount, txHash, address } = opts;
  const amount = `${cryptoAmount.toFixed(8)} ${crypto}`;

  await sendEmail(
    to,
    displayName,
    `${cryptoAmount.toFixed(6)} ${crypto} deposit detected — confirming`,
    emailWrapper(`
      ${traderGreeting(displayName)}
      ${statusParagraph(`The status of your deposit has been updated to: Detected. It will be credited automatically once the network confirms it.`)}
      ${detailBlock("The deposit information is as follows:", `
        ${detailRow("Deposit amount", escapeHtml(amount))}
        ${detailRow("Chain type", escapeHtml(networkLabel(network)))}
        ${address ? detailRow("Deposit address", escapeHtml(address)) : ""}
        ${detailRow("TXID", txidLink(network, txHash))}
        ${detailRow("Status", "Awaiting confirmation", true)}
      `)}
      ${ctaButton(`${APP_URL}/wallet`, "View Wallet →")}
    `, "Crypto deposit detected"),
  );
}
