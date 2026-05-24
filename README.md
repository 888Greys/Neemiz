# Nezeem

Nezeem is a mobile-first betting and trading app built with Next.js, TypeScript, Tailwind CSS, Prisma, Supabase Auth, and Bun. The current codebase includes real wallet, betting, P2P, crypto, webhook, and settlement routes, so production deployments must configure the secrets in `.env.local.example` before enabling payments or settlement workers.

## Current Pages

- `/` - home dashboard with wallet summary, featured match, market shortcuts, trending events, and prediction preview
- `/sports` - sportsbook view with sport filters, live/upcoming tabs, league blocks, and odds rows
- `/p2p` - P2P trading screen with buy/sell tabs, filters, merchant cards, limits, and payment chips
- `/predictions` - Polymarket-style prediction markets with category filters, probability bars, and Yes/No actions
- `/binary` - coming-soon binary/forex page
- `/aviator` - Aviator-style game screen with multiplier history, flight canvas, bet panels, and auto cashout controls
- `/wallet` - wallet screen with balance, deposit/withdraw/transfer actions, asset breakdown, and recent activity
- `/login` - login/signup UI with email/phone, password, social buttons, and terms copy

## Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Bun
- Inter and JetBrains Mono fonts
- Material Symbols icons

## Development

Install dependencies:

```bash
bun install
```

Run the dev server:

```bash
bun run dev
```

Open:

```text
http://127.0.0.1:3000
```

Build for production:

```bash
bun run build
```

## Project Structure

- `app/` - Next.js routes and global layout/styles
- `components/` - shared shell, icons, cards, odds buttons, wallet UI, and ticket UI
- `lib/` - API clients, auth helpers, bet settlement, wallet/game helpers, and fallback mock data
- `tailwind.config.ts` - Nezeem theme tokens

## Notes

The original Stitch-generated HTML reference files have been removed after converting the design into reusable Next.js components. Some UI surfaces still have placeholder content, but the money-moving APIs are real and should be treated as production-sensitive.

Required production secrets include:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_WEBHOOK_SECRET`
- `MEGAPAY_API_KEY`, `MEGAPAY_EMAIL`, `MEGAPAY_CALLBACK_TOKEN`
- `MASTER_WALLET_MNEMONIC`, `ETHERSCAN_API_KEY`, `TRONGRID_API_KEY`
- `USDT_KES_RATE`, `ETH_KES_RATE`, `BNB_KES_RATE`
- `CRON_SECRET`, `SETTLE_SECRET`

Production deploys are triggered from the `main` branch on Vercel.

## Crypto Deposit System

### How it works

Each user gets a unique blockchain deposit address per coin/network combination. Addresses are derived deterministically from a single BIP44 HD wallet mnemonic (`MASTER_WALLET_MNEMONIC`) so all funds can be recovered from that one phrase.

**Address derivation:**

```
MASTER_WALLET_MNEMONIC
       │
       ▼
  BIP44 HD Wallet
       │
       ├── m/44'/60'/0'/0/N  →  EVM address  (USDT ERC20, USDT BEP20, ETH, BNB)
       └── m/44'/195'/0'/0/N →  Tron address (USDT TRC20)
```

`N` is a global sequential index — the Nth deposit address ever created on the platform. Each user × coin × network combination gets a unique `N`.

**Supported coins:**

| Coin | Network | Detection API |
|------|---------|---------------|
| USDT | TRC20 (Tron) | TronGrid |
| USDT | ERC20 (Ethereum) | Etherscan API V2 |
| USDT | BEP20 (BSC) | Etherscan API V2 |
| ETH  | ERC20 | Etherscan API V2 |
| BNB  | BEP20 | Etherscan API V2 |

**Deposit flow:**

1. User clicks "Get Deposit Address" → `GET /api/p2p/merchant/deposit-address` or `POST /api/crypto/address`
2. Server derives the user's unique address from the mnemonic and stores it in `crypto_deposit_addresses`
3. User sends coins to that address on-chain
4. VPS cron runs every 5 minutes → calls `GET /api/cron/check-deposits`
5. Cron scans every address via TronGrid / Etherscan, finds new inbound transactions
6. For each new deposit:
   - **Merchant user** → credits `P2PCryptoBalance` (escrow for sell ads)
   - **Regular user** → converts to KES at the configured rate, credits `walletBalance`, logs a `Transaction`
7. User receives an in-app notification and their balance updates

**KES conversion rates (set in Vercel env vars):**

| Env var | Default | Meaning |
|---------|---------|---------|
| `USDT_KES_RATE` | 128 | 1 USDT = KSh 128 |
| `ETH_KES_RATE` | 420000 | 1 ETH = KSh 420,000 |
| `BNB_KES_RATE` | 84000 | 1 BNB = KSh 84,000 |

Update these regularly in Vercel → Redeploy to keep rates accurate.

### Sweeping funds (moving coins to your main wallet)

Coins sit in the individual deposit addresses until you sweep them. To access funds:

1. Open **Trust Wallet** or **Exodus**
2. Import `MASTER_WALLET_MNEMONIC` (12 words from `/opt/neemiz/settle.env`)
3. All EVM addresses (ETH, BNB, USDT ERC20/BEP20) will appear automatically
4. For Tron (USDT TRC20) open **TronLink** and import the same mnemonic

Sweep regularly to a cold wallet after large deposits.

### VPS cron for deposit checking

```bash
# /opt/neemiz/settle.env
CRON_SECRET=...
MASTER_WALLET_MNEMONIC="***REMOVED-DEAD-SEED***"
ETHERSCAN_API_KEY=...
TRONGRID_API_KEY=...
```

```cron
*/5 * * * * source /opt/neemiz/settle.env && echo -n "[$(date +"%Y-%m-%d %H:%M")] " >> /var/log/neemiz-deposits.log && curl -s -H "Authorization: Bearer $CRON_SECRET" https://nezeem.com/api/cron/check-deposits >> /var/log/neemiz-deposits.log 2>&1 && echo "" >> /var/log/neemiz-deposits.log
```

Monitor:

```bash
tail -f /var/log/neemiz-deposits.log
# {"ok":true,"checked":5,"credited":1,"errors":[]}
```

`checked` = number of addresses scanned, `credited` = deposits found and credited this run.

---

## Server Cron

Vercel cron is disabled for this project so Hobby deployments are not blocked by the 30-minute settlement schedule. Bet settlement runs from the VPS instead.

Installed on `root@vmi3292677`:

- Secret file: `/opt/neemiz/settle.env`
- Runner script: `/opt/neemiz/settle-bets.sh`
- Cron log: `/var/log/neemiz-settle.log`
- Schedule: every 30 minutes

```cron
*/30 * * * * /opt/neemiz/settle-bets.sh >> /var/log/neemiz-settle.log 2>&1
```

The runner calls:

```bash
curl -fsS -X POST https://www.nezeem.com/api/bets/settle \
  -H "Authorization: Bearer ${CRON_SECRET}"
```

`CRON_SECRET` in `/opt/neemiz/settle.env` must match the `CRON_SECRET` value configured in Vercel.

Useful server checks:

```bash
/opt/neemiz/settle-bets.sh
crontab -l
tail -n 50 /var/log/neemiz-settle.log
```
