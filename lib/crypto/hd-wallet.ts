/**
 * Deposit-address management for the web app (WATCH-ONLY).
 *
 * The web app NO LONGER holds the master seed. Addresses are derived from the
 * account xpubs (see xpub.ts) — public keys only, so a compromise of this app
 * cannot move funds. All private-key derivation and signing lives on the signer
 * service (signer/), reachable only over WireGuard.
 *
 * Address scheme (unchanged, byte-identical to the old seed-based one — proven
 * by scripts/derive-xpubs.ts before cutover):
 *   EVM  → m/44'/60'/0'/0/N   (one address shared across ERC20/BEP20/POLYGON)
 *   Tron → m/44'/195'/0'/0/N
 *   BTC  → m/44'/0'/0'/0/N    (Legacy P2PKH — 1… addresses)
 *   Index 0 is the hot wallet (gas funder); user addresses start at 1+.
 */
import { db } from "@/lib/db";
import { registerMoralisEvmAddress } from "@/lib/crypto/moralis";
import { registerTatumAddress } from "@/lib/crypto/tatum";
import { deriveEVMAddress, deriveTronAddress, deriveBTCAddress, deriveLTCAddress } from "@/lib/crypto/xpub";

async function registerRealtimeDepositAddress(address: string, network: string) {
  if (["ERC20", "BEP20", "POLYGON"].includes(network)) {
    const result = await registerMoralisEvmAddress(address);
    if (!result.ok && !result.skipped) {
      console.warn(`[moralis] failed to register ${address}: ${result.error ?? result.status}`);
    }
    return;
  }

  if (["BITCOIN", "TRC20"].includes(network)) {
    const result = await registerTatumAddress(address, network);
    if (!result.ok && !result.skipped) {
      console.warn(`[tatum] failed to register ${address}: ${result.error ?? result.status}`);
    }
  }
}

// ─── SECURITY KILL SWITCH ─────────────────────────────────────────────────────
//
// 2026-06-20: the production MASTER_WALLET_MNEMONIC was leaked in git history and
// every address derived from it is being auto-drained by a sweeper bot within
// seconds of any deposit. Until the seed is ROTATED, handing out any deposit
// address (new OR existing) just sends user funds straight to the thief.
//
// Fail-closed: deposits are OFF unless someone who knows the seed is safe sets
// CRYPTO_DEPOSITS_ENABLED=true. Do NOT flip this until a fresh mnemonic is live
// on the signer. See memory: neemiz-seed-compromise.
export class DepositsDisabledError extends Error {
  constructor() {
    super("Crypto deposits are temporarily disabled for security maintenance. Please check back soon.");
    this.name = "DepositsDisabledError";
  }
}

function assertDepositsEnabled() {
  if (process.env.CRYPTO_DEPOSITS_ENABLED !== "true") {
    throw new DepositsDisabledError();
  }
}

// ─── Public: create/get deposit address ──────────────────────────────────────

/**
 * Returns the existing deposit address for userId × crypto × network,
 * or derives and stores the next one using a global sequential index.
 * Stores the hdIndex so the signer can re-derive the key when withdrawing.
 */
export async function getOrCreateDepositAddress(
  userId:  string,
  crypto:  string,
  network: string,
): Promise<string> {
  assertDepositsEnabled();

  const existing = await db.cryptoDepositAddress.findUnique({
    where: { userId_crypto_network: { userId, crypto, network } },
  });
  if (existing) {
    await registerRealtimeDepositAddress(existing.address, network);
    return existing.address;
  }

  const isTron = network === "TRC20";
  const isBTC  = network === "BITCOIN";
  const isLTC  = network === "LITECOIN";
  const isEvm  = !isTron && !isBTC && !isLTC;

  if (isEvm) {
    // Reuse the same EVM address for this user across ERC20/BEP20/POLYGON
    const evmRow = await db.cryptoDepositAddress.findFirst({
      where: { userId, network: { in: ["ERC20", "BEP20", "POLYGON"] } },
      orderBy: { createdAt: "asc" },
    });
    if (evmRow) {
      await db.cryptoDepositAddress.create({
        data: { userId, crypto, network, address: evmRow.address, hdIndex: evmRow.hdIndex },
      });
      await registerRealtimeDepositAddress(evmRow.address, network);
      return evmRow.address;
    }
  }

  // New slot — use count as next index (index 0 is reserved for hot wallet)
  // Add 1 so user addresses start at 1+
  const index   = (await db.cryptoDepositAddress.count()) + 1;
  const address = isTron ? deriveTronAddress(index)
                : isBTC  ? deriveBTCAddress(index)
                : isLTC  ? deriveLTCAddress(index)
                :           deriveEVMAddress(index);

  await db.cryptoDepositAddress.create({
    data: { userId, crypto, network, address, hdIndex: index },
  });

  await registerRealtimeDepositAddress(address, network);
  return address;
}
