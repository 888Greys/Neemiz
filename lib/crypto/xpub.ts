/**
 * Watch-only deposit-address derivation for the web app (nez).
 *
 * The web app NO LONGER holds the master seed. It holds only the three account
 * extended public keys (xpubs) at:
 *   EVM   m/44'/60'/0'/0   → MASTER_XPUB_EVM
 *   Tron  m/44'/195'/0'/0  → MASTER_XPUB_TRON
 *   BTC   m/44'/0'/0'/0    → MASTER_XPUB_BTC
 *
 * From an xpub we can derive every child ADDRESS (public key only) but never a
 * private key. So a full compromise of this app yields addresses, not funds —
 * signing lives on the WireGuard-only signer service (see signer/). The derived
 * addresses are byte-identical to the previous seed-based scheme; the migration
 * script (scripts/derive-xpubs.ts) proves this before cutover.
 */
import { HDNodeWallet } from "ethers";
import { evmToTron, btcP2PKHFromPubKey, ltcP2PKHFromPubKey } from "./address-codec";

function requireXpub(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is not set — the web app needs the watch-only xpub (not the seed)`);
  return v.trim();
}

// Neutered (public-only) account nodes, cached per process.
const nodeCache = new Map<string, HDNodeWallet>();
function accountNode(xpub: string): HDNodeWallet {
  let node = nodeCache.get(xpub);
  if (!node) {
    const parsed = HDNodeWallet.fromExtendedKey(xpub);
    // fromExtendedKey returns HDNodeWallet | HDNodeVoidWallet; an xpub yields the
    // void (public-only) variant. Both expose deriveChild/address/publicKey.
    node = parsed as HDNodeWallet;
    nodeCache.set(xpub, node);
  }
  return node;
}

// ── Address-from-xpub primitives (used directly by the migration verifier) ──

export function evmAddressFromXpub(xpub: string, index: number): string {
  return accountNode(xpub).deriveChild(index).address;
}

export function tronAddressFromXpub(xpub: string, index: number): string {
  return evmToTron(accountNode(xpub).deriveChild(index).address);
}

export function btcAddressFromXpub(xpub: string, index: number): string {
  return btcP2PKHFromPubKey(accountNode(xpub).deriveChild(index).publicKey);
}

/**
 * Litecoin reuses the BTC account xpub (same secp256k1 child key), re-encoded
 * with Litecoin's P2PKH version byte (L…). No separate seed/xpub — the signer
 * derives the identical key from the BTC path and controls the LTC address.
 */
export function ltcAddressFromXpub(xpub: string, index: number): string {
  return ltcP2PKHFromPubKey(accountNode(xpub).deriveChild(index).publicKey);
}

// ── Env-bound derivation used by the app ──

export function deriveEVMAddress(index: number): string {
  return evmAddressFromXpub(requireXpub("MASTER_XPUB_EVM"), index);
}

export function deriveTronAddress(index: number): string {
  return tronAddressFromXpub(requireXpub("MASTER_XPUB_TRON"), index);
}

export function deriveBTCAddress(index: number): string {
  return btcAddressFromXpub(requireXpub("MASTER_XPUB_BTC"), index);
}

export function deriveLTCAddress(index: number): string {
  return ltcAddressFromXpub(requireXpub("MASTER_XPUB_BTC"), index);
}

/**
 * Derive a deposit address for a given HD index + on-chain network.
 * Mirrors the network→curve mapping used at deposit time.
 */
export function deriveAddress(index: number, network: string): string {
  if (network === "TRC20")    return deriveTronAddress(index);
  if (network === "BITCOIN")  return deriveBTCAddress(index);
  if (network === "LITECOIN") return deriveLTCAddress(index);
  return deriveEVMAddress(index); // ERC20 / BEP20 / POLYGON share one EVM address
}

/**
 * Hot-wallet (index 0) addresses — gas funder / treasury. Public info, safe to
 * surface to admins. Signing for these still happens on the signer.
 */
export function getHotWalletAddresses(): Record<string, string> {
  return {
    EVM:  deriveEVMAddress(0),
    Tron: deriveTronAddress(0),
  };
}
