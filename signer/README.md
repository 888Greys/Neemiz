# Neemiz withdrawal signer (Layer 1 key isolation)

The web app (nez) is now **watch-only**: it derives deposit addresses from
**xpubs** and holds **no seed**. All signing happens here, on a separate host
(soi), reachable **only over WireGuard**. A full compromise of nez (repo, env,
server) yields xpubs — which cannot move funds.

```
nez (web, xpub only) ──WireGuard──> soi (signer, holds seed)
   POST /sign-withdrawal  ─ HMAC + timestamp ─>  caps → sign → broadcast → txHash
```

What protects funds, in layers:
1. **No seed on nez** — leaks there can't sign.
2. **WireGuard-only** — the signer isn't on the public internet.
3. **HMAC + timestamp** — only nez (with the shared secret) can call it; no replays.
4. **Independent caps on the signer** — per-tx + rolling 24h, enforced even if nez is owned.
5. **Telegram alerts** — every sign and every block pings you.

---

## 0. Prerequisites

- Rotated `MASTER_WALLET_MNEMONIC` (done — confirmed off git history).
- `soi`: Ubuntu + Docker (present). `nez`: Docker + the web app.
- Decide WireGuard IPs (used below): **nez = `10.8.0.1`**, **soi = `10.8.0.2`**.

---

## 1. WireGuard tunnel (soi = listener, nez = peer)

On **both** hosts: `sudo apt-get update && sudo apt-get install -y wireguard`

Generate keys on each host:
```bash
wg genkey | tee privatekey | wg pubkey > publickey
```

**soi** `/etc/wireguard/wg0.conf`:
```ini
[Interface]
Address = 10.8.0.2/24
ListenPort = 51820
PrivateKey = <SOI_PRIVATE_KEY>

[Peer]
# nez
PublicKey = <NEZ_PUBLIC_KEY>
AllowedIPs = 10.8.0.1/32
```

**nez** `/etc/wireguard/wg0.conf`:
```ini
[Interface]
Address = 10.8.0.1/24
PrivateKey = <NEZ_PRIVATE_KEY>

[Peer]
# soi
PublicKey = <SOI_PUBLIC_KEY>
Endpoint = <SOI_PUBLIC_IP>:51820
AllowedIPs = 10.8.0.2/32
PersistentKeepalive = 25
```

Open the WG port to soi and bring the tunnel up:
```bash
# GCP: allow UDP 51820 ingress to soi in the VPC firewall (console or gcloud).
# soi local firewall (if ufw): sudo ufw allow 51820/udp
sudo systemctl enable --now wg-quick@wg0   # run on BOTH hosts
```

Verify from **nez**:
```bash
ping -c2 10.8.0.2 && sudo wg show     # handshake + transfer should be non-zero
```

---

## 2. Build & run the signer on soi

Copy this `signer/` directory to soi (e.g. `scp -r signer mark@soi:~/neemiz-signer`),
then:

```bash
cd ~/neemiz-signer
cp .env.example .env        # fill in the values below
docker build -t neemiz-signer .

# Publish ONLY on the WireGuard IP — never 0.0.0.0. Persist state in a volume.
docker run -d --name neemiz-signer --restart unless-stopped \
  --env-file .env \
  -v neemiz-signer-data:/data \
  -p 10.8.0.2:8787:8787 \
  neemiz-signer
```

`.env` on soi (the ONLY host with the seed):
```ini
MASTER_WALLET_MNEMONIC="<rotated seed>"
SIGNER_HMAC_SECRET="<openssl rand -hex 32>"   # same value goes on nez
SIGNER_BIND=0.0.0.0          # safe: the port is published only on 10.8.0.2 above
SIGNER_PORT=8787
SIGNER_PER_TX_CAP={"DEFAULT":1000,"USDT":1000,"USDC":1000}
SIGNER_DAILY_CAP={"DEFAULT":2000,"USDT":2000,"USDC":2000}
SIGNER_TG_BOT_TOKEN=<bot token>
SIGNER_TG_CHAT_ID=<chat id>
# TRONGRID_API_KEY=...   # recommended for Tron rate limits
```

> Coolify alternative: add this folder as a Dockerfile resource, set the env
> vars, attach a persistent volume at `/data`, and bind the port to `10.8.0.2`.

Health check from **nez** (over the tunnel):
```bash
curl -s http://10.8.0.2:8787/health    # -> {"ok":true}
```

---

## 3. Generate the xpubs (run where the seed is — locally or on soi)

```bash
MASTER_WALLET_MNEMONIC="<rotated seed>" bunx tsx scripts/derive-xpubs.ts
```
It verifies xpub-derived addresses match the seed exactly, then prints
`MASTER_XPUB_EVM / MASTER_XPUB_TRON / MASTER_XPUB_BTC`. **If it reports any
mismatch, STOP — do not cut over.**

---

## 4. Cut over nez env

Add to nez:
```ini
MASTER_XPUB_EVM=xpub6...
MASTER_XPUB_TRON=xpub6...
MASTER_XPUB_BTC=xpub6...
SIGNER_URL=http://10.8.0.2:8787
SIGNER_HMAC_SECRET=<same 32-byte hex as soi>
```
Then **remove `MASTER_WALLET_MNEMONIC` from nez entirely** and redeploy the web
app. Deposit addresses are unchanged (proven in step 3); the seed is gone from
the web tier.

---

## 5. End-to-end verification

1. Open a deposit address in the app → confirm it's identical to before.
2. Do a **small real withdrawal** (e.g. 1 USDT on Polygon).
   - Web app debits, calls the signer, gets a txHash, marks COMPLETED.
   - Telegram fires a ✅ "sent" alert.
   - The tx confirms on-chain.
3. Try a withdrawal **over the per-tx cap** → app shows the signer's rejection,
   Telegram fires a ⛔ "BLOCKED" alert, balance is refunded.

---

## Rollback

If anything misbehaves, the web app falls back cleanly: re-add
`MASTER_WALLET_MNEMONIC` to nez and revert the `crypto/withdraw` + `hd-wallet`
changes. But the goal is to **not** keep the seed on nez — fix forward instead.

## Operating notes

- **Daily cap is the real safety net.** Even if nez is fully owned, the signer
  won't sign more than `SIGNER_DAILY_CAP` per crypto per UTC day. Size it to your
  real volume; raise temporarily for a large legitimate payout, then lower again.
- State lives in the `/data` volume (`daily.json`, `idempotency.json`). Don't wipe
  it — `idempotency.json` is what stops a retry from double-paying.
- Rotate `SIGNER_HMAC_SECRET` by setting the new value on soi then nez together.
