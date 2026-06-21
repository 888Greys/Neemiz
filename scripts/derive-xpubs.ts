/**
 * ONE-TIME migration helper — run LOCALLY (or on the signer host) where the
 * rotated MASTER_WALLET_MNEMONIC is available. It NEVER sends the seed anywhere.
 *
 *   MASTER_WALLET_MNEMONIC="word word ..." bunx tsx scripts/derive-xpubs.ts
 *
 * It does two things:
 *   1. Prints the three account-level xpubs to put in the WEB APP (nez) env:
 *        MASTER_XPUB_EVM / MASTER_XPUB_TRON / MASTER_XPUB_BTC
 *   2. PROVES the watch-only deriver (lib/crypto/xpub.ts) reproduces the exact
 *      same addresses the seed produces, for indices 0..N, on EVM/Tron/BTC.
 *      If any address differs it exits non-zero — do NOT cut over on failure,
 *      or existing users' deposit addresses would change and funds be lost.
 *
 * The seed stays on the signer (soi) only. The web app gets the xpubs.
 */
import { HDNodeWallet, Mnemonic } from "ethers";
import { evmToTron, btcP2PKHFromPubKey } from "../lib/crypto/address-codec";
import { evmAddressFromXpub, tronAddressFromXpub, btcAddressFromXpub } from "../lib/crypto/xpub";

const VERIFY_COUNT = 8; // index 0 (hot wallet) … 7

function fail(msg: string): never {
  console.error(`\n❌ ${msg}`);
  process.exit(1);
}

const phrase = process.env.MASTER_WALLET_MNEMONIC?.trim();
if (!phrase) fail("MASTER_WALLET_MNEMONIC is not set in this shell.");

const root = HDNodeWallet.fromSeed(Mnemonic.fromPhrase(phrase).computeSeed());

// Account-level nodes — every hardened step done, only /index remains (non-hardened).
const evmAcct  = root.derivePath("m/44'/60'/0'/0");
const tronAcct = root.derivePath("m/44'/195'/0'/0");
const btcAcct  = root.derivePath("m/44'/0'/0'/0");

const xpubEvm  = evmAcct.neuter().extendedKey;
const xpubTron = tronAcct.neuter().extendedKey;
const xpubBtc  = btcAcct.neuter().extendedKey;

// Seed-based reference derivation (mirrors the original hd-wallet.ts scheme).
const seedEvm  = (i: number) => root.derivePath(`m/44'/60'/0'/0/${i}`).address;
const seedTron = (i: number) => evmToTron(root.derivePath(`m/44'/195'/0'/0/${i}`).address);
const seedBtc  = (i: number) => btcP2PKHFromPubKey(root.derivePath(`m/44'/0'/0'/0/${i}`).publicKey);

let mismatches = 0;
console.log(`\nVerifying ${VERIFY_COUNT} indices per chain (seed vs xpub)…\n`);
for (let i = 0; i < VERIFY_COUNT; i++) {
  const checks: Array<[string, string, string]> = [
    ["EVM ", seedEvm(i),  evmAddressFromXpub(xpubEvm, i)],
    ["Tron", seedTron(i), tronAddressFromXpub(xpubTron, i)],
    ["BTC ", seedBtc(i),  btcAddressFromXpub(xpubBtc, i)],
  ];
  for (const [chain, fromSeed, fromXpub] of checks) {
    const ok = fromSeed === fromXpub;
    if (!ok) mismatches++;
    console.log(`  [${ok ? "ok" : "MISMATCH"}] ${chain} #${i}  ${fromSeed}${ok ? "" : `  !=  ${fromXpub}`}`);
  }
}

if (mismatches > 0) fail(`${mismatches} address mismatch(es). DO NOT cut over.`);

console.log(`\n✅ All ${VERIFY_COUNT * 3} addresses match. Safe to cut over.\n`);
console.log("─".repeat(72));
console.log("Put these in the WEB APP (nez) env — NOT the seed:\n");
console.log(`MASTER_XPUB_EVM=${xpubEvm}`);
console.log(`MASTER_XPUB_TRON=${xpubTron}`);
console.log(`MASTER_XPUB_BTC=${xpubBtc}`);
console.log("\nKeep MASTER_WALLET_MNEMONIC ONLY on the signer host (soi).");
console.log("─".repeat(72));
