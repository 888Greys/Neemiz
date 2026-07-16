/**
 * The ONLY place the master seed lives. Runs on the signer host (soi) behind
 * WireGuard. Derives private keys by HD index and resolves the key for a given
 * deposit address. No database — the web app passes the hdIndex.
 */
import { HDNodeWallet, Mnemonic, Wallet } from "ethers";
import { evmToTron, btcP2PKHFromPubKey, ltcP2PKHFromPubKey, dogeP2PKHFromPubKey } from "./address-codec";

function getRoot(): HDNodeWallet {
  const phrase = process.env.MASTER_WALLET_MNEMONIC;
  if (!phrase) throw new Error("MASTER_WALLET_MNEMONIC is not set on the signer");
  return HDNodeWallet.fromSeed(Mnemonic.fromPhrase(phrase.trim()).computeSeed());
}

function coinPath(network: string): number {
  if (network === "TRC20")   return 195;
  // LITECOIN / DOGECOIN reuse the BTC secp256k1 key (same path); only the address
  // encoding differs. The signer therefore controls those addresses without a new xpub.
  if (network === "BITCOIN" || network === "LITECOIN" || network === "DOGECOIN") return 0;
  return 60; // ERC20 / BEP20 / POLYGON
}

function privKeyAtIndex(index: number, network: string): string {
  return getRoot().derivePath(`m/44'/${coinPath(network)}'/0'/0/${index}`).privateKey;
}

export function getHotEVMKey():  string { return getRoot().derivePath("m/44'/60'/0'/0/0").privateKey;  }
export function getHotTronKey(): string { return getRoot().derivePath("m/44'/195'/0'/0/0").privateKey; }

/** The on-chain address a private key controls, in the network's encoding. */
function addressForKey(privKey: string, network: string): string {
  const wallet = new Wallet(privKey);
  if (network === "BITCOIN")  return btcP2PKHFromPubKey(wallet.signingKey.compressedPublicKey);
  if (network === "LITECOIN") return ltcP2PKHFromPubKey(wallet.signingKey.compressedPublicKey);
  if (network === "DOGECOIN") return dogeP2PKHFromPubKey(wallet.signingKey.compressedPublicKey);
  return network === "TRC20" ? evmToTron(wallet.address) : wallet.address;
}

const MAX_SCAN = 1000;

/**
 * Return the private key for a deposit address. Prefers the supplied hdIndex
 * (O(1)); if it's null or doesn't match the expected address, scan 0..999 as a
 * fallback for legacy pre-index rows. Throws if no index reproduces the address
 * (guards against a compromised caller asking us to sign from an address we
 * don't actually control).
 */
export function resolveUserKey(input: { hdIndex: number | null; fromAddress: string; network: string }): string {
  const { hdIndex, fromAddress, network } = input;
  const matches = (pk: string) =>
    network === "TRC20"
      ? addressForKey(pk, network) === fromAddress
      : addressForKey(pk, network).toLowerCase() === fromAddress.toLowerCase();

  if (hdIndex != null) {
    const pk = privKeyAtIndex(hdIndex, network);
    if (matches(pk)) return pk;
  }

  for (let i = 0; i < MAX_SCAN; i++) {
    const pk = privKeyAtIndex(i, network);
    if (matches(pk)) return pk;
  }

  throw new Error(`Signer does not control ${fromAddress} (${network}) — refusing to sign`);
}
