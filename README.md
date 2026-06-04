# Nezeem

Nezeem is a mobile-first betting and trading platform built with Next.js, TypeScript, Tailwind CSS, Prisma, Supabase Auth, and Bun. It combines a full sportsbook, P2P crypto trading, Aviator crash game, binary options, forex, and Polymarket prediction markets — all backed by real wallets, escrow, and live settlement.

## Live URLs

- Production: `https://www.nezeem.com`
- Admin panel: `https://www.nezeem.com/admin/p2p`
- VPS: `root@vmi3292677`

---

## Current Pages

| Route | Description |
|-------|-------------|
| `/` | Home dashboard — wallet summary, hero carousel, game shortcuts, trending matches |
| `/dashboard` | Main dashboard (default after login) |
| `/sports` | Sportsbook — sport filters, live/upcoming tabs, league blocks, odds rows |
| `/sports/[fixtureId]` | Single match page with in-play markets |
| `/p2p` | P2P trading — buy/sell tabs, merchant cards, verified badge, payment chips |
| `/p2p/merchant` | Merchant application and profile management |
| `/p2p/orders` | User's trade history |
| `/p2p/order/[id]` | Live order page — chat, payment instructions, countdown, release/dispute |
| `/predictions` | Polymarket-style markets — probability bars, Yes/No trading |
| `/binary` | Binary options terminal — digit contracts, demo balance, live Deriv charts |
| `/forex` | Forex trading terminal — live candlesticks, order ticket, history |
| `/aviator` | Aviator crash game — real-time WebSocket, multiplier history, auto cashout |
| `/wallet` | Full wallet — deposit (M-Pesa + crypto), withdraw (crypto + M-Pesa), history |
| `/my-bets` | All bets across sportsbook, binary, forex, predictions |
| `/profile` | User profile, username editor, preferences |
| `/admin/p2p` | **Admin only** — KYC review, dispute resolution, merchant deposit management |
| `/login` | Auth — email/phone, password, social sign-in |

---

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 App Router |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Runtime | Bun |
| Database | PostgreSQL via Prisma ORM |
| Auth | Supabase Auth |
| Fonts | Inter, JetBrains Mono |
| Icons | Material Symbols |
| Email | Brevo (Sendinblue) |
| Crypto payouts | NOWPayments |
| Fiat deposits | MegaPay (M-Pesa STK push) |
| Sports data | SportMonks + TheOddsAPI |
| Prediction markets | Polymarket Gamma API |
| Crash game | Self-hosted Go server + Redis + PostgreSQL on VPS |

---

## Development

```bash
bun install
bun run dev        # http://127.0.0.1:3000
bun run build      # production build
```

---

## Project Structure

```
app/                  Next.js routes and global layout
  api/                All API routes
    admin/p2p/        Admin: merchant KYC, disputes, deposits
    p2p/              P2P: ads, orders, merchant, disputes
    crypto/           Crypto: address, balance, withdraw, webhooks
    wallet/           Fiat: deposit (MegaPay), withdraw, transactions
    cron/             Cron endpoints called from VPS
    bets/             Sports/binary/forex bet placement + settlement
    aviator/          Aviator REST endpoints
    polymarket/       Prediction market bet placement
  admin/p2p/          Admin dashboard page
  p2p/                P2P pages
  wallet/             Wallet full-page (deposit + withdraw + history)
components/           Shared UI components
  admin-p2p-client    KYC, disputes, deposits management panel
  wallet-client       Full-page wallet (deposit, withdraw, history)
  wallet-modal        Quick deposit popup (used in app shell header)
  p2p-order-client    Live order page with chat + actions
lib/                  Helpers, API clients, auth, bet settlement
  crypto/             HD wallet derivation, deposit checker
  p2p/                Crypto balance helpers (lock/unlock/credit/debit)
prisma/               Database schema and migrations
```

---

## Environment Variables

### Required in Vercel (all environments)

```env
# Supabase Auth
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_WEBHOOK_SECRET=

# Database
DATABASE_URL=

# M-Pesa (MegaPay)
MEGAPAY_API_KEY=
MEGAPAY_EMAIL=
MEGAPAY_CALLBACK_TOKEN=
MEGAPAY_PAYBILL=

# Crypto deposits (HD wallet)
MASTER_WALLET_MNEMONIC=        # 12-word BIP44 mnemonic — keep secret
ETHERSCAN_API_KEY=             # EVM cron fallback / manual recovery
TRONGRID_API_KEY=              # TRC20 cron fallback / manual recovery
MORALIS_API_KEY=               # Moralis Streams API key for EVM realtime deposits
MORALIS_EVM_STREAM_ID=         # Moralis EVM stream ID
MORALIS_STREAM_SECRET=         # Moralis webhook signature secret
TATUM_API_KEY=                 # Tatum Notifications API key for BTC/TRC20 realtime deposits
TATUM_WEBHOOK_SECRET=          # Tatum webhook HMAC secret

# Crypto withdrawal
NOWPAYMENTS_API_KEY=

# KES conversion rates (update regularly — no redeploy needed if set as env vars)
USDT_KES_RATE=128
ETH_KES_RATE=420000
BNB_KES_RATE=84000

# Cron auth (must match /opt/neemiz/settle.env on VPS)
CRON_SECRET=
SETTLE_SECRET=

# Sports
SPORTMONKS_API_KEY=
THE_ODDS_API_KEY=

# Email
BREVO_API_KEY=

# Prediction markets (internal mode requires no extra keys)
POLYMARKET_TRADING_MODE=internal
```

### Vercel env check

```bash
vercel env ls
```

---

## Crypto Deposit System

### Architecture

Each user gets a unique blockchain deposit address per coin/network combination. Addresses are derived deterministically from a single BIP44 HD wallet mnemonic so all funds can be recovered from one phrase.

Deposit detection is webhook-first with cron fallback:

- **Moralis Streams** handles realtime EVM deposits: ERC20, BEP20, Polygon.
- **Tatum Notifications** handles realtime BTC/TRC20 deposits for subscribed addresses. The free plan has a subscription limit, so cron remains the universal fallback.
- **VPS cron** runs `/opt/neemiz/check-deposits.sh` every minute and scans all deposit addresses through the chain APIs.

```
MASTER_WALLET_MNEMONIC
       │
       ▼
  BIP44 HD Wallet
       │
       ├── m/44'/60'/0'/0/N  →  EVM address  (ERC20, BEP20, Polygon)
       ├── m/44'/195'/0'/0/N →  Tron address (TRC20)
       └── m/44'/0'/0'/0/N   →  BTC address  (Bitcoin)
```

`N` is a global sequential index — the Nth deposit address ever created on the platform.

### Supported coins

| Coin | Network | Primary detection | Fallback / recovery |
|------|---------|-------------------|---------------------|
| USDT | TRC20 (Tron) | Tatum Notifications | TronGrid cron + tx hash recovery |
| TRX  | TRC20 (Tron) | Tatum Notifications | TronGrid cron |
| BTC  | Bitcoin | Tatum Notifications | Blockstream cron + tx hash recovery |
| USDT | ERC20 (Ethereum) | Moralis Streams | Etherscan API V2 |
| USDT | BEP20 (BSC) | Moralis Streams | BSC RPC + tx hash recovery |
| USDC | Polygon | Moralis Streams | Etherscan / Polygon RPC |
| ETH  | ERC20 | Moralis Streams | Etherscan API V2 |
| BNB  | BEP20 | Moralis Streams | BSC RPC |

### Deposit flow

1. User opens Wallet → Deposit → Crypto tab → selects coin/network
2. Clicks "Get Deposit Address" → `POST /api/crypto/address`
3. Server derives unique address from mnemonic, stores in `crypto_deposit_addresses`
4. User sends coins to that address on-chain
5. Realtime webhook fires when available:
   - Moralis → `POST /api/webhooks/moralis`
   - Tatum → `POST /api/webhooks/tatum`
6. VPS cron also runs every minute → `GET https://www.nezeem.com/api/cron/check-deposits`
7. Each new on-chain deposit goes through `creditOnChainDeposit`, which creates an idempotent ledger reference, credits `UserCryptoBalance`, sends an in-app notification, and sends the deposit email.
8. If a provider misses a deposit, support can recover by calling `/api/cron/check-deposits?address=...&txHash=...`.

### Realtime address sync

After setting the provider env vars in Vercel and redeploying, sync existing deposit addresses:

```bash
source /opt/neemiz/settle.env

curl -sL --max-time 120 \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://www.nezeem.com/api/cron/sync-moralis-addresses \
  | python3 -m json.tool

curl -sL --max-time 120 \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://www.nezeem.com/api/cron/sync-tatum-addresses \
  | python3 -m json.tool
```

Current VPS cron:

```cron
* * * * * /opt/neemiz/check-deposits.sh
*/5 * * * * /opt/neemiz/settle-bets.sh >> /var/log/neemiz-settle.log 2>&1
*/30 * * * * /opt/neemiz/settle-polymarket.sh >> /var/log/neemiz-polymarket-settle.log 2>&1
```

### KES conversion rates

| Env var | Default | Meaning |
|---------|---------|---------|
| `USDT_KES_RATE` | 128 | 1 USDT = KSh 128 |
| `ETH_KES_RATE` | 420000 | 1 ETH = KSh 420,000 |
| `BNB_KES_RATE` | 84000 | 1 BNB = KSh 84,000 |

Update in Vercel → Settings → Environment Variables. Redeploy to apply.

### Sweeping funds

Coins sit in individual deposit addresses until swept. To access funds:

1. **Trust Wallet** or **Exodus** — import `MASTER_WALLET_MNEMONIC`. All EVM addresses (ETH, BNB, USDT ERC20/BEP20) appear automatically.
2. **TronLink** — import same mnemonic for Tron (USDT TRC20).

Sweep regularly to a cold wallet after large deposits.

---

## Crypto Withdrawal System

Users withdraw crypto via NOWPayments:

- API: `POST /api/crypto/withdraw` → body `{ crypto, network, amount, address }`
- 5% platform fee deducted from requested amount
- Minimum amounts: USDT 10, ETH 0.005, BNB 0.01, BTC 0.0001
- Debits `UserCryptoBalance`, creates a PENDING `Transaction`, submits payout to NOWPayments
- On success: NOWPayments calls `POST /api/crypto/withdraw-webhook`
- On failure: balance automatically refunded

UI: `/wallet` → Withdraw tab → Crypto

---

## P2P Trading

### Flow

1. Merchant applies at `/p2p/merchant` — submits display name + KYC document
2. Admin approves KYC at `/admin/p2p` → merchant gets verified badge
3. Merchant deposits crypto to the normal wallet, then moves it to merchant escrow from Merchant Center
4. Merchant creates a SELL ad with price, limits, and payment method
5. Buyer browses ads at `/p2p`, clicks Buy → creates an order
6. Order locks crypto in escrow, or fiat wallet backing for KES Coin. Buyer pays fiat (M-Pesa / bank) and marks as paid
7. Merchant verifies fiat and clicks Release — 2% platform fee deducted, buyer receives 98%
8. If dispute: either party raises dispute → admin resolves at `/admin/p2p` → Disputes

### KES Coin accounting

KES Coin is an internal P2P asset, not blockchain crypto and not a separate converted balance.

- `KES` remains listed in the P2P asset list so users can buy/sell local-currency value.
- There is no manual fiat-to-KES conversion UI or active conversion API.
- Spendable KES Coin equals `User.walletBalance` at a 1:1 rate.
- When a KES order opens, the giver's `User.walletBalance` is debited by `amount + 1%`.
- When a KES order is cancelled or expires, that same debited amount is refunded to `User.walletBalance`.
- When a KES order is released, the receiver gets `amount - 1%` credited to `User.walletBalance`.
- The retained difference is the 2% P2P platform fee.
- Merchant Center derives locked KES from active `P2POrder` rows, not from `UserCryptoBalance(KES/KES)`.

Legacy converted KES balances should be folded back into fiat once after deploying this model:

```sql
BEGIN;

UPDATE users u
SET wallet_balance = wallet_balance + k.available
FROM user_crypto_balances k
WHERE k.user_id = u.id
  AND k.crypto = 'KES'
  AND k.network = 'KES'
  AND k.available > 0;

UPDATE user_crypto_balances
SET available = 0,
    locked = 0
WHERE crypto = 'KES'
  AND network = 'KES';

COMMIT;
```

### Escrow fee

- Platform takes **2%** of the crypto amount on release
- Example: 100 USDT order → 98 USDT to buyer, 2 USDT to platform

### Admin panel (`/admin/p2p`)

Three tabs — all require `isAdmin = true` on the user record:

| Tab | Function |
|-----|---------|
| KYC Requests | Approve/reject merchant applications with notes |
| Disputes | View disputed orders, select resolution (Buyer Wins / Seller Wins), enter note |
| Deposits | Review manual crypto deposit records, approve/reject |

To mark yourself admin: `UPDATE users SET is_admin = true WHERE email = 'your@email.com';`

---

## Aviator Game

Self-hosted Go crash game server on VPS.

### VPS services (vmi3292677)

```bash
docker ps           # aviator_app, aviator_redis_1, aviator_psql_bp_1
```

- **Go server** (`aviator_app`) — WebSocket game server on `:8080`
- **Redis** (`aviator_redis_1`) — pub/sub and state
- **PostgreSQL** (`aviator_psql_bp_1`) — persistent round/bet history

### VPS cron scripts

| Script | Schedule | Function |
|--------|----------|---------|
| `aviator-tick.sh` | Every 10s | Drives Aviator game rounds |
| `bets-settle.sh` | Every 60s | Settles pending sports/binary/forex bets |
| `polymarket-settle.sh` | Every 1h | Settles resolved Polymarket markets |

---

## VPS Cron Setup

All cron jobs run on `root@vmi3292677` and call Vercel endpoints.

### Secret file

```bash
# /opt/neemiz/settle.env
CRON_SECRET=...
SETTLE_SECRET=...
```

### Current crontab

```cron
# Deposit checker — every 5 min
*/5 * * * * source /opt/neemiz/settle.env && echo -n "[$(date +"%Y-%m-%d %H:%M")] " >> /var/log/neemiz-deposits.log && curl -sL -H "Authorization: Bearer $CRON_SECRET" https://www.nezeem.com/api/cron/check-deposits >> /var/log/neemiz-deposits.log 2>&1 && echo "" >> /var/log/neemiz-deposits.log

# Bet settlement — every 30 min
*/30 * * * * /opt/neemiz/settle-bets.sh >> /var/log/neemiz-settle.log 2>&1

# Polymarket settlement — every 30 min
*/30 * * * * /opt/neemiz/settle-polymarket.sh >> /var/log/neemiz-polymarket-settle.log 2>&1
```

> **Note:** Use `https://www.nezeem.com` (with `www`) not `https://nezeem.com` — the bare domain redirects (307) and cron calls without `-L` will silently fail.

### Monitor logs

```bash
tail -f /var/log/neemiz-deposits.log
# [2026-05-27 14:35] {"ok":true,"checked":7,"credited":0,"errors":[]}

tail -n 50 /var/log/neemiz-settle.log
tail -n 50 /var/log/neemiz-polymarket-settle.log
```

### Manual trigger

```bash
source /opt/neemiz/settle.env

# Check deposits now
curl -sL -H "Authorization: Bearer $CRON_SECRET" https://www.nezeem.com/api/cron/check-deposits

# Settle bets now
curl -sL -X POST -H "Authorization: Bearer $SETTLE_SECRET" https://www.nezeem.com/api/bets/settle

# Settle Polymarket bets now
curl -sL -H "Authorization: Bearer $SETTLE_SECRET" https://www.nezeem.com/api/polymarket/settle
```

---

## Polymarket Prediction Mode

```env
POLYMARKET_TRADING_MODE=internal   # recommended — no funded account needed
```

In `internal` mode: real Polymarket markets/prices/charts, but positions are Nezeem ledger entries settled internally.

To place real CLOB orders (requires funded Polymarket account):

```env
POLYMARKET_TRADING_MODE=clob
POLYMARKET_PRIVATE_KEY=0x...
POLYMARKET_API_KEY=...
POLYMARKET_API_SECRET=...
POLYMARKET_API_PASSPHRASE=...
POLYMARKET_CHAIN_ID=137
POLYMARKET_SIGNATURE_TYPE=0
POLYMARKET_ORDER_TYPE=FOK
```

---

## House Edge Summary

| Game | Edge | Method |
|------|------|--------|
| Sports | ~5–10% | Margin baked into odds |
| Binary (Matches/Differs) | ~5% | Payout < 100% |
| Binary (Over/Under) | ~5% dynamic | Target-digit-adjusted payout |
| Forex | 3-pip spread | Spread baked into entry price |
| Aviator | ~3% | Provably fair with configurable house cut |
| P2P | 2% | Fee on crypto release |
| Crypto withdrawal | 5% | Fee on withdrawal amount |

---

## Database Schema Overview

Key models (see `prisma/schema.prisma` for full schema):

| Model | Purpose |
|-------|---------|
| `User` | Platform user — wallet balance, admin flag |
| `MerchantProfile` | P2P merchant — KYC status, trade stats, online status |
| `P2PAd` | Buy/sell ads with price, limits, payment methods |
| `P2POrder` | Live escrow orders — PENDING → PAID → RELEASED/DISPUTED |
| `P2PDispute` | Dispute records with resolution |
| `P2PCryptoBalance` | Merchant escrow balance (available/locked per coin) |
| `UserCryptoBalance` | Regular blockchain crypto balance per coin/network; KES is legacy-only |
| `CryptoDepositAddress` | HD-wallet-derived deposit addresses |
| `P2PCryptoDeposit` | Manual deposit submissions requiring admin approval |
| `Transaction` | Fiat and crypto transaction log |
| `Notification` | In-app notifications |
| `Bet` | Sports/binary/forex/prediction bets |

---

## Migrations

```bash
bun prisma migrate dev --name <name>   # create migration
bun prisma migrate deploy              # apply in production
bun prisma db push                     # push schema changes (dev only)
bun prisma studio                      # GUI
```

---

## Deployment

Deploys trigger automatically from `main` branch on Vercel.

```bash
# Manual deploy
vercel --prod

# Check recent deploys
vercel ls

# Tail production logs
vercel logs --follow
```

Production always uses `www.nezeem.com`. Bare `nezeem.com` → 307 redirect to `www`.

---

## Security Notes

- `MASTER_WALLET_MNEMONIC` controls all deposit funds — rotate if exposed, sweep first
- `CRON_SECRET` and `SETTLE_SECRET` authenticate VPS → Vercel calls — rotate if logged/exposed
- Admin access requires `isAdmin = true` in the database — no UI to self-promote
- All money-moving API routes require Supabase session auth
- P2P escrow: crypto is locked in `P2PCryptoBalance.locked` until released/refunded atomically
