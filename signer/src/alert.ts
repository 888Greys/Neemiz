/**
 * Telegram alerts so a human SEES every signed withdrawal and — more importantly
 * — every rejected/over-cap attempt. If the web app is ever compromised, the
 * rejected-attempt pings are your early warning. Fire-and-forget; never blocks
 * or fails a withdrawal.
 */
export async function alert(text: string): Promise<void> {
  const token  = process.env.SIGNER_TG_BOT_TOKEN;
  const chatId = process.env.SIGNER_TG_CHAT_ID;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) {
    console.error("[alert] telegram failed:", e instanceof Error ? e.message : e);
  }
}
