"use client";

import { startRegistration, startAuthentication } from "@simplewebauthn/browser";

/**
 * Enroll a passwordless sign-in passkey. Must be called while logged in.
 */
export async function enrollPasskey(deviceName?: string): Promise<{ ok: boolean; error?: string }> {
  const optRes = await fetch("/api/auth/passkey/register/options", { method: "POST" });
  if (!optRes.ok) return { ok: false, error: "Could not start passkey setup. Please try again." };
  const optionsJSON = await optRes.json();

  let attResp;
  try {
    attResp = await startRegistration({ optionsJSON });
  } catch {
    return { ok: false, error: "Your device didn't complete the passkey prompt." };
  }

  const verRes = await fetch("/api/auth/passkey/register/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ response: attResp, deviceName }),
  });
  if (!verRes.ok) {
    const j = await verRes.json().catch(() => ({}));
    return { ok: false, error: j.error ?? "Could not save your passkey." };
  }
  return { ok: true };
}

/**
 * Run the passwordless sign-in ceremony. Returns a magic-link token_hash that
 * the caller exchanges via supabase.auth.verifyOtp() to establish the session.
 */
export async function loginWithPasskey(): Promise<{ ok: boolean; tokenHash?: string; error?: string }> {
  const optRes = await fetch("/api/auth/passkey/login/options", { method: "POST" });
  if (!optRes.ok) return { ok: false, error: "Could not start passkey sign-in." };
  const optionsJSON = await optRes.json();

  let authResp;
  try {
    authResp = await startAuthentication({ optionsJSON });
  } catch {
    return { ok: false, error: "Passkey sign-in was dismissed." };
  }

  const verRes = await fetch("/api/auth/passkey/login/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ response: authResp }),
  });
  const j = await verRes.json().catch(() => ({}));
  if (!verRes.ok || !j.tokenHash) return { ok: false, error: j.error ?? "Passkey sign-in failed." };
  return { ok: true, tokenHash: j.tokenHash };
}
