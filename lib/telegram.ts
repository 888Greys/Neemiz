/**
 * Minimal Telegram alerting. Reuses the same bot/chat as the on-chain wallet
 * watcher (soi) so all ops alerts land in one place. Configured via env:
 *   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
 * Fail-soft: a missing config or a network error never throws into the caller —
 * alerting must not be able to break the settlement / guard path.
 */
const API = "https://api.telegram.org";

export function isTelegramConfigured(): boolean {
  return !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

/** Send an HTML-formatted message. Returns true on a 2xx, false otherwise. */
export async function sendTelegram(text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;
  try {
    const res = await fetch(`${API}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      console.error(`[telegram] send failed: ${res.status} ${await res.text().catch(() => "")}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[telegram] send error", e);
    return false;
  }
}
