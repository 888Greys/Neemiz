import { CURRENCY_SYMBOL, MONEY_LOCALE } from "@/lib/currency";
// Transactional email via Resend.
const RESEND_API_KEY = process.env.RESEND_API_KEY!;
const SENDER_EMAIL = process.env.MAIL_SENDER_EMAIL ?? process.env.BREVO_SENDER_EMAIL ?? "noreply@nezeem.com";
const SENDER_NAME = process.env.MAIL_SENDER_NAME ?? process.env.BREVO_SENDER_NAME ?? "Nezeem";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://nezeem.com";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "toxicgreys001@gmail.com";

async function sendEmail(to: string, toName: string, subject: string, htmlContent: string) {
  if (!RESEND_API_KEY) {
    throw new Error("Resend send failed: RESEND_API_KEY is not configured");
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${SENDER_NAME} <${SENDER_EMAIL}>`,
      to: [toName ? `${toName} <${to}>` : to],
      subject,
      html: htmlContent,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Resend send failed: ${await res.text()}`);
}

/**
 * Alert the owner that a single M-Pesa destination number is receiving an
 * unusual number of withdrawals (possible mule/collector). The latest
 * withdrawal has been auto-held for approval.
 */
export async function sendSuspiciousNumberAlertEmail(info: { msisdn: string; count: number; amountKes: number; held: boolean; autoKilled?: boolean; distinctUsers?: number }) {
  const subject = info.autoKilled
    ? `🚨 Nezeem: withdrawals AUTO-DISABLED — +${info.msisdn}`
    : `🚨 Nezeem: ${info.count} withdrawals to one number (+${info.msisdn})`;
  const usersNote = info.distinctUsers ? ` across <strong>${info.distinctUsers}</strong> accounts` : "";
  const html = `
    <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
      <h2 style="margin:0 0 8px">${info.autoKilled ? "Withdrawals automatically frozen" : "Possible withdrawal mule pattern"}</h2>
      <p style="margin:0 0 16px;color:#475569;line-height:1.6">
        The M-Pesa number <strong>+${info.msisdn}</strong> has received <strong>${info.count}</strong> withdrawals
        in the last 24 hours${usersNote}. The latest is
        <strong>${CURRENCY_SYMBOL} ${info.amountKes.toLocaleString()}</strong>.
      </p>
      <p style="margin:0 0 16px;color:#475569;line-height:1.6">
        ${info.autoKilled
          ? "This crossed the auto-kill threshold, so <strong>ALL withdrawals have been automatically disabled</strong>. Review the activity and re-enable from the kill switch once it's safe."
          : (info.held
            ? "This withdrawal has been <strong>held for your approval</strong> — it will not pay out until you approve it."
            : "This withdrawal was allowed to proceed.")}
        ${info.autoKilled ? "" : "Review the recent activity and, if it looks like account draining, hit the withdrawal kill switch."}
      </p>
      <a href="${APP_URL}/admin/withdrawals" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px">Review withdrawals</a>
      <p style="margin:20px 0 0;color:#94a3b8;font-size:12px">Automated alert from Nezeem. You receive this because you're an owner/admin.</p>
    </div>`;
  await sendEmail(ADMIN_EMAIL, "Nezeem Admin", subject, html);
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
  const rows = changes.map((c) => {
    const danger = c.to === "true" && !c.allowlisted;
    return `<tr style="border-top:1px solid #e2e8f0">
      <td style="padding:8px 6px;font-weight:700">${c.email}${c.username ? ` (${c.username})` : ""}</td>
      <td style="padding:8px 6px">${c.from} → <strong>${c.to}</strong></td>
      <td style="padding:8px 6px">${danger ? "<span style='color:#dc2626;font-weight:700'>NOT allowlisted ⚠️</span>" : "allowlisted"}</td>
      <td style="padding:8px 6px;color:#64748b">${c.app ?? "?"} / ${c.ip ?? "?"}</td>
      <td style="padding:8px 6px;color:#64748b">${c.at}</td>
    </tr>`;
  }).join("");
  const html = `
    <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#0f172a">
      <h2 style="margin:0 0 8px">${critical ? "Admin flag granted to a non-allowlisted account" : "Admin flag change detected"}</h2>
      <p style="margin:0 0 16px;color:#475569;line-height:1.6">
        The <code>is_admin</code> column changed on the users table. ${critical
          ? "One change granted admin to an email that is NOT on the owner allowlist — the panel is still gated by the allowlist (requireOwnerAdmin), but this write should be investigated."
          : "All changes are on allowlisted accounts."}
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="text-align:left;color:#64748b">
          <th style="padding:6px">Account</th><th style="padding:6px">Change</th><th style="padding:6px">Allowlist</th><th style="padding:6px">Source</th><th style="padding:6px">When (UTC)</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin:20px 0 0;color:#94a3b8;font-size:12px">Automated alert from Nezeem. You receive this because you're an owner/admin.</p>
    </div>`;
  await sendEmail(ADMIN_EMAIL, "Nezeem Admin", subject, html);
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
  const haltList = r.halted.map((h) => `<li><strong>${h.kind}</strong> — realized RTP ${(h.rtp * 100).toFixed(0)}% (auto-disabled)</li>`).join("");
  const userList = r.userFlags.map((u) => `<li>${u.userId.slice(0, 10)}… — ${(u.rtp * 100).toFixed(0)}% RTP over ${u.count} trades</li>`).join("");
  const html = `
    <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
      <h2 style="margin:0 0 8px">${r.halted.length ? "Binary contract auto-halted" : "High-RTP players flagged"}</h2>
      <p style="margin:0 0 16px;color:#475569;line-height:1.6">Realized over the last ${r.windowH}h (admin/test accounts excluded).</p>
      ${r.halted.length ? `<p style="margin:0 0 6px;font-weight:700">Auto-halted (now disabled):</p><ul style="margin:0 0 16px;color:#475569">${haltList}</ul>` : ""}
      ${r.userFlags.length ? `<p style="margin:0 0 6px;font-weight:700">Players to review:</p><ul style="margin:0 0 16px;color:#475569">${userList}</ul>` : ""}
      <a href="${APP_URL}/admin/risk" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px">Open risk panel</a>
      <p style="margin:20px 0 0;color:#94a3b8;font-size:12px">Automated alert from Nezeem.</p>
    </div>`;
  await sendEmail(ADMIN_EMAIL, "Nezeem Admin", subject, html);
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
  const rows = findings.slice(0, 25).map((f) => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #eef2f7">@${f.username ?? "?"}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eef2f7;text-align:right">${CURRENCY_SYMBOL} ${f.balance.toLocaleString()}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #eef2f7;text-align:right;color:#dc2626;font-weight:700">+${CURRENCY_SYMBOL} ${f.unexplained.toLocaleString()}</td>
    </tr>`).join("");
  const html = `
    <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#0f172a">
      <h2 style="margin:0 0 8px">Unexplained balances — possible re-breach</h2>
      <p style="margin:0 0 16px;color:#475569;line-height:1.6">
        The daily reconciliation found <strong>${findings.length}</strong> active account(s) holding
        <strong>${CURRENCY_SYMBOL} ${total.toLocaleString()}</strong> of balance that the transactions
        ledger cannot account for. Balance that appears with no ledger row is the signature of a direct
        write to <code>wallet_balance</code> — i.e. database-level access. <strong>Treat keys as potentially leaked.</strong>
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin:0 0 16px">
        <thead><tr style="text-align:left;color:#64748b">
          <th style="padding:6px 10px">Account</th><th style="padding:6px 10px;text-align:right">Balance</th><th style="padding:6px 10px;text-align:right">Unexplained</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <a href="${APP_URL}/admin/withdrawals" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px">Open admin console</a>
      <p style="margin:20px 0 0;color:#94a3b8;font-size:12px">Automated daily reconciliation. You receive this because you're an owner/admin.</p>
    </div>`;
  await sendEmail(ADMIN_EMAIL, "Nezeem Admin", subject, html);
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

  const clusterRows = report.clusters.slice(0, 15).map((c) => `
    <tr><td style="padding:6px 10px;border-bottom:1px solid #eef2f7">${c.at}</td>
    <td style="padding:6px 10px;border-bottom:1px solid #eef2f7;text-align:right;color:#dc2626;font-weight:700">${c.count} accounts</td></tr>`).join("");
  const deviceRows = report.devices.slice(0, 15).map((d) => `
    <tr><td style="padding:6px 10px;border-bottom:1px solid #eef2f7;font-family:monospace">${d.deviceHash.slice(0, 12)}…</td>
    <td style="padding:6px 10px;border-bottom:1px solid #eef2f7;text-align:right;color:#dc2626;font-weight:700">${d.users} accounts</td></tr>`).join("");
  const emailRows = report.emailClusters.slice(0, 15).map((e) => `
    <tr><td style="padding:6px 10px;border-bottom:1px solid #eef2f7">${e.email}</td>
    <td style="padding:6px 10px;border-bottom:1px solid #eef2f7;text-align:right;color:#dc2626;font-weight:700">${e.count} accounts</td></tr>`).join("");

  const html = `
    <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#0f172a">
      <h2 style="margin:0 0 8px">Possible bot account farming</h2>
      <p style="margin:0 0 16px;color:#475569;line-height:1.6">
        The signup-velocity tripwire flagged unusual account creation in the last
        <strong>${report.windowMinutes} minutes</strong>: ${reasons.join("; ")}.
        This is the pattern behind mule/bonus-abuse farms. No accounts have been frozen — review and act if needed.
      </p>
      ${report.clusters.length ? `<h3 style="margin:16px 0 4px;font-size:14px">Tight signup clusters (same-second batches)</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px"><tbody>${clusterRows}</tbody></table>` : ""}
      ${report.devices.length ? `<h3 style="margin:16px 0 4px;font-size:14px">One device, many accounts</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px"><tbody>${deviceRows}</tbody></table>` : ""}
      ${report.emailClusters.length ? `<h3 style="margin:16px 0 4px;font-size:14px">One inbox, many accounts (+alias / dotted-Gmail)</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px"><tbody>${emailRows}</tbody></table>` : ""}
      <a href="${APP_URL}/admin/players" style="display:inline-block;margin-top:16px;background:#dc2626;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px">Review new accounts</a>
      <p style="margin:20px 0 0;color:#94a3b8;font-size:12px">Automated signup-velocity tripwire. You receive this because you're an owner/admin.</p>
    </div>`;
  await sendEmail(ADMIN_EMAIL, "Nezeem Admin", subject, html);
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
  const rows = alerts.map((a) => {
    const accent = a.severity === "critical" ? "#e53e3e" : "#f59e0b";
    return `
      <div style="background:#fafbfc;border:1px solid #e8ebef;border-left:4px solid ${accent};border-radius:0 10px 10px 0;padding:14px 18px;margin-bottom:12px;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:800;color:${accent};text-transform:uppercase;letter-spacing:1px;">${a.severity === "critical" ? "Critical" : "Warning"}</p>
        <p style="margin:0 0 6px;font-size:15px;font-weight:800;color:#17192a;">${escapeHtml(a.title)}</p>
        <p style="margin:0;font-size:13px;color:#4a5568;line-height:1.6;">${escapeHtml(a.detail)}</p>
      </div>`;
  }).join("");

  await sendEmail(
    ADMIN_EMAIL,
    "Nezeem Admin",
    subject,
    emailWrapper(`
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:${hasCritical ? "#e53e3e" : "#f59e0b"};text-transform:uppercase;letter-spacing:1px;">Platform Health</p>
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#1a1a2e;">${alerts.length} metric${alerts.length > 1 ? "s" : ""} need attention</h2>
      <p style="margin:0 0 20px;font-size:14px;color:#4a5568;line-height:1.7;">
        Automated health check flagged the following on the money-movement spine. Open the admin console to investigate.
      </p>
      ${rows}
      ${ctaButton(`${APP_URL}/admin`, "Open admin console →", hasCritical ? "#e53e3e" : "#087cff")}
    `, "Automated health alert. You receive this because you're an owner/admin.", subject)
  );
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

// ─── Shared Layout ────────────────────────────────────────────────────────────

function emailWrapper(content: string, footerExtra?: string, preheader = "An update from your Nezeem account") {
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
      .cta-table, .cta-cell, .cta-link { width:100% !important; }
      .cta-link { box-sizing:border-box !important; text-align:center !important; padding:14px 18px !important; }
      .detail-label, .detail-value { display:block !important; width:100% !important; text-align:left !important; }
      .detail-value { padding-top:4px !important; }
      .mobile-tight { font-size:22px !important; line-height:1.25 !important; }
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

function detailRow(label: string, value: string, last = false) {
  return `<tr>
    <td style="padding:13px 0;${last ? "" : "border-bottom:1px solid #e8ebef;"}">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td class="detail-label" style="font-size:13px;color:#8991a3;">${label}</td>
        <td class="detail-value" align="right" style="font-size:13px;font-weight:700;color:#1a1a2e;">${value}</td>
      </tr></table>
    </td>
  </tr>`;
}

function ctaButton(href: string, label: string, color = "#087cff") {
  return `<table role="presentation" cellpadding="0" cellspacing="0" class="cta-table" style="margin-top:28px;">
    <tr><td align="center" class="cta-cell">
      <a href="${href}" class="cta-link" style="display:inline-block;background:${color};color:#ffffff;font-weight:800;font-size:15px;padding:14px 36px;border-radius:8px;text-decoration:none;letter-spacing:0;">
        ${label}
      </a>
    </td></tr>
  </table>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  })[char] ?? char);
}

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
  const color = won ? "#05c46b" : voided ? "#f5a524" : "#ff4d5e";
  const title = won ? "You won!" : voided ? "Bet refunded" : "Bet settled";
  const subject = won
    ? `You won ${CURRENCY_SYMBOL} ${Number(opts.payout ?? 0).toLocaleString(MONEY_LOCALE)} on Nezeem`
    : voided
      ? `${opts.game} bet refunded`
      : `${opts.game} bet result`;

  await sendEmail(
    to,
    displayName || "Trader",
    subject,
    emailWrapper(`
      <div style="text-align:center;padding-bottom:26px;border-bottom:1px solid #e8ebef;margin-bottom:24px;">
        <div style="display:inline-block;width:54px;height:54px;background:${color}20;border-radius:50%;line-height:54px;text-align:center;font-size:25px;font-weight:900;color:${color};margin-bottom:15px;">${won ? "&#10003;" : voided ? "&#8634;" : "&#8212;"}</div>
        <p style="margin:0 0 5px;font-size:12px;font-weight:800;color:${color};text-transform:uppercase;letter-spacing:1px;">${opts.game}</p>
        <h1 style="margin:0 0 9px;font-size:25px;font-weight:900;color:#17192a;letter-spacing:0;">${title}</h1>
        <p style="margin:0;font-size:14px;color:#667085;line-height:1.65;">${opts.summary ?? (won ? "Your winnings have been credited to your wallet." : voided ? "Your stake has been returned to your wallet." : "This bet did not win.")}</p>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;border-radius:8px;margin-bottom:4px;">
        <tr><td style="padding:4px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            ${detailRow("Result", `<strong style="color:${color};">${opts.outcome}</strong>`)}
            ${detailRow("Stake", `${CURRENCY_SYMBOL} ${opts.stake.toLocaleString(MONEY_LOCALE)}`)}
            ${opts.payout !== undefined ? detailRow(won ? "Credited" : "Returned", `${CURRENCY_SYMBOL} ${opts.payout.toLocaleString(MONEY_LOCALE)}`) : ""}
            ${detailRow("Reference", opts.reference.slice(0, 18).toUpperCase(), true)}
          </table>
        </td></tr>
      </table>
      ${ctaButton(opts.href, "View details", color)}
    `, "This is a transactional account notification.", `${opts.game} result: ${opts.outcome}`)
  );
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

export async function sendWithdrawReopenedEmail(to: string, firstName: string) {
  const name = firstName || "there";
  await sendEmail(
    to,
    name,
    "M-Pesa withdrawals are back on Nezeem",
    emailWrapper(`
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1a1a2e;">Good news, ${name} — withdrawals are back</h1>
      <p style="margin:0 0 24px;font-size:15px;color:#4a5568;line-height:1.7;">
        M-Pesa withdrawals are working again. You can now withdraw from your Nezeem wallet
        straight to your M-Pesa. Thanks for your patience while we sorted it out.
      </p>
      ${ctaButton(`${APP_URL}/wallet`, "Withdraw now →")}
    `,
    "You received this email because you asked to be notified when M-Pesa withdrawals reopened on Nezeem."
  ));
}

export async function sendNewLoginEmail(
  to: string,
  name: string,
  details: { when: string; device: string; ip: string; location?: string },
) {
  const display = name || "Trader";
  await sendEmail(
    to,
    display,
    "New login to your Nezeem account",
    emailWrapper(`
      <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#1a1a2e;">New login detected</h1>
      <p style="margin:0 0 20px;font-size:15px;color:#4a5568;line-height:1.7;">
        Hi ${display}, we detected a new sign-in to your Nezeem account.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f9fc;border-radius:12px;margin-bottom:24px;">
        <tr><td style="padding:18px 22px;font-size:13px;color:#4a5568;line-height:1.9;">
          <strong style="color:#1a1a2e;">When:</strong> ${details.when}<br/>
          <strong style="color:#1a1a2e;">Device:</strong> ${details.device}<br/>
          <strong style="color:#1a1a2e;">IP:</strong> ${details.ip}${details.location ? ` (${details.location})` : ""}
        </td></tr>
      </table>
      <p style="margin:0 0 24px;font-size:13px;color:#8a94a6;line-height:1.6;">
        If this was you, no action is needed. If you don&apos;t recognise this activity,
        change your sign-in method and contact support immediately.
      </p>
      ${ctaButton(`${APP_URL}/profile`, "Review account security →")}
    `,
    "You received this security alert because someone signed in to your Nezeem account."
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
    role: "cryptoReceiver" | "cryptoSender";
    crypto: string;
    cryptoAmount: number;
    netCryptoAmount: number;
    fiatAmount: number;
    fiat: string;
    orderId: string;
  }
) {
  const { role, crypto, cryptoAmount, netCryptoAmount, fiatAmount, fiat, orderId } = opts;
  const isReceiver = role === "cryptoReceiver";
  const receivedCrypto = netCryptoAmount || cryptoAmount;
  await sendEmail(
    to,
    recipientName,
    `Trade Completed — ${(isReceiver ? receivedCrypto : cryptoAmount).toFixed(6)} ${crypto}`,
    emailWrapper(`
      <div style="text-align:center;padding-bottom:28px;border-bottom:1px solid #f0f2f5;margin-bottom:28px;">
        <div style="display:inline-block;width:56px;height:56px;background:#e6f9ee;border-radius:50%;line-height:56px;text-align:center;font-size:26px;margin-bottom:16px;">✓</div>
        <h2 style="margin:0 0 10px;font-size:24px;font-weight:800;color:#1a1a2e;">Trade Completed!</h2>
        <p style="margin:0;font-size:15px;color:#4a5568;line-height:1.7;">
          ${isReceiver
            ? `<strong style="color:#05b957;">${receivedCrypto.toFixed(6)} ${crypto}</strong> has been released to your account.`
            : `You have released <strong>${cryptoAmount.toFixed(6)} ${crypto}</strong> to the counterparty.`}
        </p>
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f9fc;border-radius:12px;margin-bottom:28px;">
        <tr><td style="padding:4px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            ${detailRow(isReceiver ? "You received" : "You released", `<strong style="color:#05b957;">${(isReceiver ? receivedCrypto : cryptoAmount).toFixed(6)} ${crypto}</strong>`)}
            ${detailRow(isReceiver ? "You paid" : "You received", `${fiat} ${fiatAmount.toLocaleString(MONEY_LOCALE)}`)}
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
      <div style="text-align:center;padding-bottom:28px;border-bottom:1px solid #f0f2f5;margin-bottom:28px;">
        <div style="display:inline-block;width:56px;height:56px;background:#e6f9ee;border-radius:50%;line-height:56px;text-align:center;font-size:26px;margin-bottom:16px;">✓</div>
        <h2 style="margin:0 0 10px;font-size:24px;font-weight:800;color:#1a1a2e;">Ad Created Successfully</h2>
        <p style="margin:0;font-size:15px;color:#4a5568;line-height:1.7;">
          Your <strong style="color:${sideColor};">${isSell ? "Sell" : "Buy"} ${crypto}</strong> ad is now live on Nezeem P2P and visible to traders.
        </p>
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f9fc;border-radius:12px;margin-bottom:28px;">
        <tr><td style="padding:4px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            ${detailRow(`Total ${crypto}`, `<strong>${totalAmount.toFixed(6)} ${crypto}</strong>`)}
            ${detailRow(`Price per ${crypto}`, `<strong style="color:#087cff;">${pricePerUnit.toLocaleString(MONEY_LOCALE)} ${fiat}</strong>`)}
            ${detailRow("Order Limit", `${fiat} ${minLimit.toLocaleString(MONEY_LOCALE)} – ${maxLimit.toLocaleString(MONEY_LOCALE)}`, true)}
          </table>
        </td></tr>
      </table>

      ${ctaButton(`${APP_URL}/p2p/merchant`, "View Merchant Center →", "#05b957")}
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
    side: "BUY" | "SELL";
  }
) {
  const { orderId, buyerName, crypto, cryptoAmount, fiatAmount, fiat, paymentMethod, side } = opts;
  const method = paymentMethod === "MPESA" ? "M-Pesa" : paymentMethod === "BANK" ? "Bank Transfer" : paymentMethod;
  const merchantIsSelling = side === "SELL";
  const takerAction = merchantIsSelling ? "buy" : "sell";
  const fiatRowLabel = merchantIsSelling ? "You Receive" : "You Pay";
  const promptText = merchantIsSelling
    ? "The buyer has a limited window to complete payment. Release crypto only after confirming you have received the funds."
    : "You have a limited window to complete payment. The seller should release crypto only after confirming the funds.";
  await sendEmail(
    to,
    merchantName,
    `New P2P Order — ${cryptoAmount.toFixed(6)} ${crypto}`,
    emailWrapper(`
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#087cff;text-transform:uppercase;letter-spacing:1px;">New Order</p>
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#1a1a2e;">Order Received</h2>
      <p style="margin:0 0 24px;font-size:15px;color:#4a5568;line-height:1.7;">
        <strong>${buyerName}</strong> wants to ${takerAction} ${crypto} using your ad. Please process it promptly.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f9fc;border-radius:12px;margin-bottom:28px;">
        <tr><td style="padding:4px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            ${detailRow("Crypto Amount", `<strong>${cryptoAmount.toFixed(6)} ${crypto}</strong>`)}
            ${detailRow(fiatRowLabel, `<strong style="color:#05b957;">${fiat} ${fiatAmount.toLocaleString(MONEY_LOCALE)}</strong>`)}
            ${detailRow("Payment Method", method)}
            ${detailRow("Order ID", orderId.slice(0, 16).toUpperCase(), true)}
          </table>
        </td></tr>
      </table>

      <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;padding:14px 18px;margin-bottom:28px;">
        <p style="margin:0;font-size:13px;color:#92400e;line-height:1.6;">
          ⏰ <strong>Respond promptly.</strong> ${promptText}
        </p>
      </div>

      ${ctaButton(`${APP_URL}/p2p/order/${orderId}`, "View Order →")}
    `,
    merchantIsSelling
      ? "Never release crypto before confirming payment has arrived in your account."
      : "Only mark payment complete after sending funds through the selected payment method."
  ));
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
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:#087cff;text-transform:uppercase;letter-spacing:1px;">P2P Message</p>
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#1a1a2e;">${senderName} sent you a message</h2>
      <div style="background:#f7f9fc;border-left:4px solid #087cff;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:24px;">
        <p style="margin:0;font-size:14px;color:#344054;line-height:1.7;white-space:pre-wrap;">${message}</p>
        ${opts.hasImage ? `<p style="margin:10px 0 0;font-size:12px;font-weight:700;color:#087cff;">Image attached in the order chat</p>` : ""}
      </div>
      <p style="margin:0;font-size:13px;color:#667085;">Order #${opts.orderId.slice(0, 12).toUpperCase()}</p>
      ${ctaButton(`${APP_URL}/p2p/order/${opts.orderId}`, "Open Chat and Reply")}
    `, "Open the order page to reply securely. Never move a P2P conversation outside Nezeem.")
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
  const accent = opts.accent ?? "#087cff";
  await sendEmail(
    to,
    recipientName,
    opts.subject,
    emailWrapper(`
      <p style="margin:0 0 4px;font-size:12px;font-weight:700;color:${accent};text-transform:uppercase;letter-spacing:1px;">P2P Order Update</p>
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#1a1a2e;">${escapeHtml(opts.title)}</h2>
      <p style="margin:0 0 24px;font-size:15px;color:#4a5568;line-height:1.7;">${escapeHtml(opts.message)}</p>

      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f9fc;border-radius:12px;margin-bottom:28px;">
        <tr><td style="padding:4px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            ${detailRow("Crypto Amount", `<strong>${opts.cryptoAmount.toFixed(6)} ${escapeHtml(opts.crypto)}</strong>`)}
            ${detailRow("Fiat Amount", `<strong>${escapeHtml(opts.fiat)} ${opts.fiatAmount.toLocaleString(MONEY_LOCALE)}</strong>`)}
            ${detailRow("Order ID", opts.orderId.slice(0, 16).toUpperCase(), true)}
          </table>
        </td></tr>
      </table>

      ${ctaButton(`${APP_URL}/p2p/order/${opts.orderId}`, opts.actionLabel ?? "View Order →", accent)}
    `, "Review the order inside Nezeem before taking action.")
  );
}

// ─── Crypto Deposit Email ─────────────────────────────────────────────────────

export async function sendCryptoDepositEmail(
  to: string,
  displayName: string,
  opts: {
    crypto:       string;
    network:      string;
    cryptoAmount: number;
    txHash:       string;
  }
) {
  const { crypto, network, cryptoAmount, txHash } = opts;
  const netLabel: Record<string, string> = {
    TRC20: "TRC-20 (Tron)", ERC20: "ERC-20 (Ethereum)", BEP20: "BEP-20 (BSC)",
    POLYGON: "Polygon", BITCOIN: "Bitcoin",
  };
  const explorerLink = network === "TRC20"
    ? `https://tronscan.org/#/transaction/${txHash}`
    : network === "BITCOIN"
    ? `https://blockstream.info/tx/${txHash}`
    : `https://polygonscan.com/tx/${txHash}`;

  await sendEmail(
    to,
    displayName,
    `${cryptoAmount.toFixed(6)} ${crypto} deposit received`,
    emailWrapper(`
      <div style="text-align:center;padding-bottom:28px;border-bottom:1px solid #f0f2f5;margin-bottom:28px;">
        <div style="display:inline-block;width:56px;height:56px;background:#fff7ed;border-radius:50%;line-height:56px;text-align:center;font-size:28px;margin-bottom:16px;">₿</div>
        <h2 style="margin:0 0 10px;font-size:24px;font-weight:800;color:#1a1a2e;">Crypto Deposit Received!</h2>
        <p style="margin:0;font-size:15px;color:#4a5568;line-height:1.7;">
          Your <strong style="color:#f59e0b;">${cryptoAmount.toFixed(6)} ${crypto}</strong> has been credited to your wallet.
        </p>
      </div>

      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f9fc;border-radius:12px;margin-bottom:28px;">
        <tr><td style="padding:4px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            ${detailRow("Coin", `<strong>${crypto}</strong>`)}
            ${detailRow("Network", netLabel[network] ?? network)}
            ${detailRow("Amount", `<strong style="color:#f59e0b;">${cryptoAmount.toFixed(6)} ${crypto}</strong>`)}
            ${detailRow("Tx Hash", `<a href="${explorerLink}" style="color:#087cff;text-decoration:none;font-size:11px;">${txHash.slice(0, 20)}…</a>`, true)}
          </table>
        </td></tr>
      </table>

      <p style="margin:0 0 28px;font-size:14px;color:#8a94a6;line-height:1.6;">
        Your crypto has been added to your Nezeem wallet. You can use it to trade on P2P or fund your merchant escrow.
      </p>

      ${ctaButton(`${APP_URL}/dashboard`, "Go to Dashboard →", "#f59e0b")}
    `,
    "You received this email because a crypto deposit was made to your Nezeem account."
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
