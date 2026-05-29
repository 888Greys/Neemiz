# Nezeem — Complete Developer Reference

> Last updated: 2026-05-29  
> Stack: Next.js 15 (App Router) · Prisma · Supabase (PostgreSQL) · Vercel · VPS (Ubuntu)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Infrastructure](#2-infrastructure)
3. [Environment Variables](#3-environment-variables)
4. [Authentication](#4-authentication)
5. [Database Schema](#5-database-schema)
6. [Wallet System](#6-wallet-system)
7. [Crypto System — HD Wallet](#7-crypto-system--hd-wallet)
8. [Crypto Deposits](#8-crypto-deposits)
9. [Crypto Withdrawals (Self-Custody)](#9-crypto-withdrawals-self-custody)
10. [Internal Crypto Transfers](#10-internal-crypto-transfers)
11. [P2P Trading System](#11-p2p-trading-system)
12. [Games](#12-games)
13. [Email — Brevo](#13-email--brevo)
14. [Admin Panel](#14-admin-panel)
15. [VPS Cron Jobs](#15-vps-cron-jobs)
16. [Key API Routes](#16-key-api-routes)
17. [Hot Wallet — Setup & Funding](#17-hot-wallet--setup--funding)
18. [Debugging Guide](#18-debugging-guide)
19. [Known Issues & Fixes Applied](#19-known-issues--fixes-applied)
20. [Future Work](#20-future-work)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                        VERCEL                           │
│   Next.js 15 App Router  (nezeem.com / www.nezeem.com)  │
│   ├── /app         Pages + API routes                   │
│   ├── /components  React UI                             │
│   ├── /lib         Business logic                       │
│   └── /prisma      DB schema                            │
└──────────────┬──────────────────────────────────────────┘
               │ Prisma Client (DATABASE_URL)
               ▼
┌─────────────────────────────────────────────────────────┐
│               SUPABASE (PostgreSQL)                     │
│   Auth (JWT sessions) + Database                        │
└─────────────────────────────────────────────────────────┘
               ▲
               │ HTTPS cron calls every 5 min
┌─────────────────────────────────────────────────────────┐
│               VPS  root@vmi3292677                      │
│   /opt/neemiz/settle.env   — cron secrets               │
│   /var/log/neemiz-deposits.log — cron output            │
│   /var/log/neemiz-settle.log   — bet settlement log     │
└─────────────────────────────────────────────────────────┘
```

**Key design decisions:**
- The VPS has **no app code** — it only triggers Vercel API endpoints via curl
- All business logic runs on Vercel (serverless Node.js)
- Database is Supabase-hosted PostgreSQL, accessed via Prisma ORM
- Crypto keys never leave Vercel env vars (and VPS settle.env for cron)

---

## 2. Infrastructure

### Vercel (App Hosting)
- URL: `https://www.nezeem.com` (canonical) + `https://nezeem.com` (redirects to www)
- Framework: Next.js 15, App Router
- Runtime: Node.js (all routes use `export const runtime = "nodejs"` where needed)
- Deploy: auto-deploys from `main` branch on GitHub (`888Greys/Neemiz`)
- Worktree branch: `claude/jovial-lalande-582ea2` — push to `HEAD:main` to deploy

### VPS (Cron Only)
- Host: `root@vmi3292677` (Ubuntu)
- Purpose: triggers Vercel API endpoints on a schedule
- No Next.js, no database, no app code
- Cron env file: `/opt/neemiz/settle.env`
- Logs: `/var/log/neemiz-deposits.log`, `/var/log/neemiz-settle.log`

### Supabase
- PostgreSQL database
- Supabase Auth handles all user sessions (JWT, OAuth)
- Direct DB URL in `DATABASE_URL` env var
- Admin SQL editor: supabase.com → project → SQL Editor

### GitHub
- Repo: `github.com/888Greys/Neemiz`
- Main branch: `main`

---

## 3. Environment Variables

### VPS `/opt/neemiz/settle.env`
```bash
CRON_SECRET=<random hex — must match Vercel CRON_SECRET>
MASTER_WALLET_MNEMONIC="word1 word2 ... word12"   # 12-word BIP39 mnemonic — NEVER SHARE
ETHERSCAN_API_KEY=<from etherscan.io>
TRONGRID_API_KEY=<from trongrid.io>
```

### Vercel Environment Variables (add ALL of these)

| Variable | Description |
|---|---|
| `DATABASE_URL` | Supabase PostgreSQL connection string |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) |
| `MASTER_WALLET_MNEMONIC` | **Same 12-word mnemonic as VPS** — used to sign withdrawals |
| `CRON_SECRET` | Random hex string — same as VPS settle.env |
| `ETHERSCAN_API_KEY` | Etherscan API v2 — for EVM deposit detection |
| `TRONGRID_API_KEY` | TronGrid API — for Tron deposit detection |
| `BREVO_API_KEY` | Brevo (Sendinblue) — transactional email |
| `BREVO_SENDER_EMAIL` | Verified sender email in Brevo |
| `BREVO_SENDER_NAME` | Sender name (default: "Nezeem") |
| `NEXT_PUBLIC_APP_URL` | `https://nezeem.com` |
| `ADMIN_EMAIL` | Admin notification email |
| `USDT_KES_RATE` | Fallback rate: USDT → KES (e.g. `128`) |
| `BTC_KES_RATE` | Fallback rate: BTC → KES |
| `ETH_KES_RATE` | Fallback rate: ETH → KES |
| `BNB_KES_RATE` | Fallback rate: BNB → KES |

> **Critical:** `MASTER_WALLET_MNEMONIC` must be identical on VPS and Vercel. It controls ALL deposit addresses and the hot wallet.

---

## 4. Authentication

- Provider: **Supabase Auth** (email/password + OAuth)
- Sessions managed via `lib/supabase/server.ts` (server) and `lib/supabase/client.ts` (client)
- Every API route authenticates via:
  ```typescript
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  ```
- After auth, user is resolved to DB record via `getOrCreateUser(user.id, { email })`
- 2FA: TOTP available (`lib/user-2fa.ts`, `lib/admin-2fa.ts`)
- Admin access: `user.isAdmin === true` in DB

---

## 5. Database Schema

### Core Tables

| Table | Purpose |
|---|---|
| `users` | All platform users |
| `transactions` | Every money movement (deposit, withdrawal, bet) |
| `bets` + `bet_selections` | Sports betting |
| `notifications` | In-app notifications |

### Crypto Tables

| Table | Purpose |
|---|---|
| `crypto_deposit_addresses` | HD-derived deposit address per user × crypto × network |
| `user_crypto_balances` | User's spendable crypto holdings on the platform |
| `p2p_crypto_balances` | Merchant's escrow balance for P2P trading |
| `p2p_crypto_deposits` | History of escrow funding events |

### P2P Tables

| Table | Purpose |
|---|---|
| `merchant_profiles` | Verified merchants |
| `p2p_ads` | Buy/sell listings |
| `p2p_orders` | Individual trades |
| `p2p_messages` | Order chat |
| `p2p_disputes` | Dispute records |
| `p2p_payment_methods` | Merchant bank/M-Pesa accounts |

### Games Tables

| Table | Purpose |
|---|---|
| `aviator_rounds` + `aviator_bets` | Crash game |
| `binary_trades` | Binary options |
| `forex_trades` | Forex positions |
| `polymarket_bets` | Prediction markets |

### Critical `transactions` Table

Every financial event has a row. Key fields:

```sql
type:      DEPOSIT | WITHDRAWAL | BET_STAKE | BET_WIN | BONUS | REFUND
currency:  "KES" for fiat, "USDT"/"USDC"/etc for crypto
provider:  "megapay" | "pesapal" | "crypto" | "transfer" | "self_custody" | "merchant_escrow"
reference: unique dedup key — crypto deposits use "crypto-{txHash}"
status:    PENDING | COMPLETED | FAILED | CANCELLED
```

**The `reference` field is the dedup key** — the cron checks `reference LIKE 'crypto-{txHash}'` before crediting any deposit. Never delete transaction records.

---

## 6. Wallet System

### Two Separate Balances

Every user has TWO types of balance:

#### 1. KES Wallet (`users.wallet_balance`)
- Unit: Kenyan Shillings (KES)
- Used for: sports betting, aviator, binary, forex, polymarket
- Credited by: M-Pesa (Megapay), Pesapal card payments **only**
- Debited by: bets placed, KES withdrawals
- **Crypto deposits NEVER touch this balance** (as of 2026-05-22 change)

#### 2. Crypto Wallet (`user_crypto_balances`)
- Unit: actual crypto (USDT, USDC, BTC, ETH, BNB, etc.)
- Used for: P2P trading, crypto withdrawals, internal transfers
- Credited by: on-chain deposits detected by cron, internal receives
- Debited by: crypto withdrawals, move-to-escrow, internal sends

### Balance Update Rules

| Operation | KES Wallet | Crypto Wallet |
|---|---|---|
| M-Pesa deposit | +KES | unchanged |
| Crypto deposit | unchanged | +crypto amount |
| Crypto withdrawal | unchanged | -crypto amount |
| Internal send | unchanged | -crypto amount |
| Internal receive | unchanged | +crypto amount |
| Move to escrow | unchanged | -crypto amount |
| Move from escrow | unchanged | +crypto amount |
| Place bet | -KES | unchanged |
| Win bet | +KES | unchanged |

> **NEVER** use on-chain balance queries to SET the crypto balance — only use them to detect new deposits. On-chain APIs (TronGrid, Etherscan) can return 0 transiently, which would wipe valid balances.

---

## 7. Crypto System — HD Wallet

### Master Mnemonic

All deposit addresses and the hot wallet are derived from one 12-word BIP39 mnemonic:
```
MASTER_WALLET_MNEMONIC in Vercel env vars
```

**Recovery:** Import the mnemonic into any BIP44 wallet (Trust Wallet, MetaMask) to see all addresses.

### Derivation Paths

```
m/44'/60'/0'/0/N  →  EVM address (Ethereum, BSC, Polygon — same address)
m/44'/195'/0'/0/N →  Tron address (TRC20)
m/44'/0'/0'/0/N   →  Bitcoin address (Legacy P2PKH, starts with "1")
```

Where `N` is the sequential index assigned when the address is first created.

### Address Assignment

- Each user gets a **unique index** when they first request a deposit address
- EVM addresses are **shared** across ERC20/BEP20/POLYGON for the same user (same keypair works on all EVM chains)
- Tron and BTC get their own separate derived addresses
- Stored in `crypto_deposit_addresses` table: `(userId, crypto, network) → address`

### Hot Wallet (Index 0)

```
EVM  (Polygon/ETH/BSC): m/44'/60'/0'/0/0  →  0x29d8Ab96b05c03035265168FC0F2E9B176dD8EB8
Tron (TRC20):           m/44'/195'/0'/0/0  →  TDnUGSNLzZX7kb2PJuVoKE8cWv5HEs2hPj
```

All **outgoing** withdrawals are sent from the hot wallet. It must be funded with:
- Gas coins: MATIC (Polygon), ETH (Ethereum), BNB (BSC), TRX (Tron)
- Tokens: USDT, USDC, etc. — the withdrawal float

### Get Hot Wallet Addresses (on VPS)

```bash
set -a && source /opt/neemiz/settle.env && set +a
mkdir -p /tmp/hw && cd /tmp/hw && npm init -y --quiet && npm install ethers --quiet 2>/dev/null

cat > /tmp/hw/check.js << 'EOF'
const ethers = require('ethers');
const { createHash } = require('crypto');
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function hexToTron(hex) {
  const raw = Buffer.from('41' + hex.slice(2).toLowerCase(), 'hex');
  const h1 = createHash('sha256').update(raw).digest();
  const h2 = createHash('sha256').update(h1).digest();
  const full = Buffer.concat([raw, h2.subarray(0,4)]);
  const digits = [0];
  for (let i=0;i<full.length;i++){let carry=full[i];for(let j=0;j<digits.length;j++){carry+=digits[j]<<8;digits[j]=carry%58;carry=Math.floor(carry/58);}while(carry){digits.push(carry%58);carry=Math.floor(carry/58);}}
  return digits.reverse().map(d=>B58[d]).join('');
}
const root = ethers.HDNodeWallet.fromSeed(ethers.Mnemonic.fromPhrase(process.env.MASTER_WALLET_MNEMONIC.trim()).computeSeed());
const evm = root.derivePath("m/44'/60'/0'/0/0");
console.log('EVM  (Polygon/ETH/BSC):', evm.address);
console.log('Tron (TRC20):          ', hexToTron(evm.address));
EOF

node /tmp/hw/check.js && rm -rf /tmp/hw
```

---

## 8. Crypto Deposits

### Flow

```
User visits /wallet → clicks Crypto tab → selects coin → "Get Address"
    ↓
GET /api/crypto/address?crypto=USDC&network=POLYGON
    ↓
getOrCreateDepositAddress(userId, "USDC", "POLYGON")
    ↓ derives from HD wallet, stores in crypto_deposit_addresses
Returns: 0x5F93306a09f62d740B655ea072e5fb1b2A54FD39

User sends crypto on-chain to that address
    ↓
VPS cron (every 5 min) → curl https://www.nezeem.com/api/cron/check-deposits
    ↓
For each address in crypto_deposit_addresses:
  1. checkDeposits(address, crypto, network) → Etherscan/TronGrid API
  2. For each new txHash not in transactions table:
     a. upsert UserCryptoBalance (available += amount)  ← INCREMENT, never overwrite
     b. create Transaction (reference: "crypto-{txHash}", provider: "crypto")
     c. create Notification
     d. send email via Brevo
```

### Supported Deposit Coins

| Coin | Networks |
|---|---|
| USDT | TRC20 (Tron), ERC20 (Ethereum), BEP20 (BSC) |
| USDC | ERC20 (Ethereum), POLYGON |
| ETH | ERC20 |
| BNB | BEP20 |
| BTC | Bitcoin |
| MATIC | POLYGON |
| TRX | TRC20 |
| DAI | ERC20 |
| WBTC | ERC20 |
| LINK | ERC20 |

### Deposit Detection APIs

- **EVM chains** (ETH/BSC/POLYGON): Etherscan API V2 (`api.etherscan.io/v2/api`) with `ETHERSCAN_API_KEY`
- **Tron TRC20**: TronGrid REST API (`api.trongrid.io`) with `TRONGRID_API_KEY`
- **Bitcoin**: Blockstream API (free, no key)
- **On-chain balance**: Public RPC nodes via `lib/crypto/deposit-checker.ts#getOnChainBalance`
  - ETH: `ethereum-rpc.publicnode.com`
  - BSC: `bsc-rpc.publicnode.com`
  - Polygon: `polygon-bor-rpc.publicnode.com`

### Dedup Logic

```typescript
// Before crediting any deposit, check BOTH tables:
const alreadyDeposit = await db.p2PCryptoDeposit.findFirst({ where: { txHash } });
const alreadyTx      = await db.transaction.findFirst({ where: { reference: `crypto-${txHash}` } });
if (alreadyDeposit || alreadyTx) skip; // already processed
```

This prevents double-crediting even if the cron runs multiple times.

### Merchant Deposit Flow

Merchants who receive crypto follow the same wallet flow. After deposit is credited to `UserCryptoBalance`, they go to Merchant Center → **Fund Escrow** to move crypto into `P2PCryptoBalance` for P2P trading.

---

## 9. Crypto Withdrawals (Self-Custody)

No third-party payout provider. Nezeem signs and broadcasts all withdrawal transactions directly.

### Flow

```
User: Withdraw tab → select coin → enter amount + destination address
    ↓
POST /api/crypto/withdraw
    ↓
1. Validate: min amount, address not empty
2. Calculate: feeAmount = amount × 0.05 (5% platform fee)
              payoutAmount = amount - feeAmount
3. db.$transaction:
   a. debitUserCrypto(userId, crypto, network, amount)  ← throws if insufficient
   b. create Transaction (status: PENDING)
4. broadcastWithdrawal(toAddress, crypto, network, payoutAmount)  ← signs from hot wallet
5. On success: update Transaction (status: COMPLETED, reference: txHash)
6. On failure: REFUND — increment balance back, mark Transaction FAILED
```

### Broadcaster (`lib/crypto/broadcaster.ts`)

**EVM chains** (Ethereum, BSC, Polygon):
- Uses `ethers.js v6` with `JsonRpcProvider` (public nodes)
- Hot wallet: `HDNodeWallet.fromSeed(seed).derivePath("m/44'/60'/0'/0/0")`
- ERC20 transfers: calls `contract.transfer(to, amount)` on token contract
- Native transfers: `wallet.sendTransaction({ to, value })`

**Tron TRC20**:
- No TronWeb — uses raw TronGrid HTTP API
- Creates unsigned transaction via `POST /wallet/triggersmartcontract`
- Signs `txID` with `ethers.SigningKey.sign()` (raw secp256k1, no Ethereum prefix)
- Broadcasts signed tx via `POST /wallet/broadcasttransaction`

**Bitcoin**: Not yet supported (throws "coming soon" error).

### EVM Token Contracts (used by broadcaster)

| Token:Network | Contract |
|---|---|
| USDT:ERC20 | `0xdAC17F958D2ee523a2206206994597C13D831ec7` |
| USDT:BEP20 | `0x55d398326f99059fF775485246999027B3197955` |
| USDT:POLYGON | `0xc2132D05D31c914a87C6611C10748AEb04B58e8F` |
| USDC:ERC20 | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` |
| USDC:POLYGON | `0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359` |

### Fee Structure

- Platform fee: **5%** (taken at withdrawal time)
- User requests 100 USDT → receives 95 USDT on-chain
- The 5% stays in the hot wallet as platform revenue

### Hot Wallet Funding Requirements

| Chain | Gas Coin | Minimum Float | Notes |
|---|---|---|---|
| Polygon | MATIC | 5–10 MATIC | ~0.001 MATIC per tx |
| Ethereum | ETH | 0.05 ETH | gas expensive |
| BSC | BNB | 0.5 BNB | cheap gas |
| Tron | TRX | 200 TRX | ~20 TRX per USDT tx |

Keep a withdrawal float of tokens (USDT, USDC, etc.) in the hot wallet equal to expected daily withdrawals.

---

## 10. Internal Crypto Transfers

Users can send crypto to other Nezeem users for free, instantly.

### Flow

```
POST /api/crypto/transfer
Body: { recipientUsername, crypto, network, amount }

1. Look up recipient by username (GET /api/crypto/transfer?username=xxx)
2. Validate sender ≠ recipient, amount ≤ sender balance
3. db.$transaction:
   a. debitUserCrypto(sender)
   b. creditUserCrypto(recipient)
   c. create Transaction for sender (WITHDRAWAL, provider: "transfer")
   d. create Transaction for recipient (DEPOSIT, provider: "transfer")
   e. create Notification for both
```

No on-chain transaction. Pure DB operation. No fees.

UI: Wallet page → **Send** tab.

---

## 11. P2P Trading System

### Roles
- **Buyer**: any user who places an order on an ad
- **Merchant**: verified users who post ads and hold escrow balance

### Merchant Onboarding

1. Apply (`/p2p/merchant` → Apply button)
2. Admin approves in `/admin/p2p/merchants`
3. Merchant receives/buys crypto → goes to wallet
4. Merchant uses **Fund Escrow** button to move crypto to `P2PCryptoBalance`
5. Merchant posts ads referencing their escrow balance

### Merchant Balance Types

| Balance | Table | Description |
|---|---|---|
| Wallet crypto | `user_crypto_balances` | Normal wallet, can be used for anything |
| Escrow | `p2p_crypto_balances` | Locked for P2P ads, debited when orders are placed |

### Moving Between Wallet and Escrow

```
Wallet → Escrow:  POST /api/p2p/merchant/fund
                  { crypto, network, amount }
                  Debits UserCryptoBalance, credits P2PCryptoBalance

Escrow → Wallet:  POST /api/p2p/merchant/escrow-to-wallet
                  { crypto, amount }
                  Debits P2PCryptoBalance, credits UserCryptoBalance
```

### Order Lifecycle

```
PENDING    → buyer places order, escrow locked in ad
PAID       → buyer marks payment sent (M-Pesa/bank)
RELEASED   → merchant confirms payment, crypto released to buyer
CANCELLED  → cancelled before PAID
DISPUTED   → dispute raised
EXPIRED    → payment window passed without payment
```

On RELEASE: merchant's `P2PCryptoBalance` decreases, buyer's `UserCryptoBalance` increases.

### Supported P2P Cryptos

USDT, USDC, BTC, ETH, BNB (added via `VALID_CRYPTOS` in `/api/p2p/ads/route.ts`)

---

## 12. Games

All games use `users.wallet_balance` (KES).

| Game | Settle Route | Notes |
|---|---|---|
| Sports Betting | `/api/bets/settle` | Triggered by VPS cron every 30 min |
| Aviator | `/api/aviator/tick` | Server-side round management |
| Binary Options | `/api/binary/settle` | Synthetic markets |
| Forex | `/api/forex/close` | Manual close or stop-loss/take-profit |
| Polymarket | `/api/polymarket/settle` | Mirrors real Polymarket outcomes |
| Wheel Spin | `/api/wheel/spin` | Bonus game |

---

## 13. Email — Brevo

All transactional emails use [Brevo](https://brevo.com) (formerly Sendinblue).

### Required Env Vars
```
BREVO_API_KEY       = from brevo.com → API Keys
BREVO_SENDER_EMAIL  = verified sender in Brevo account
BREVO_SENDER_NAME   = "Nezeem"
```

### Email Types (`lib/brevo.ts`)

| Function | Trigger |
|---|---|
| `sendWelcomeEmail` | User registration |
| `sendCryptoDepositEmail` | Crypto deposit credited |
| `sendMerchantApplicationEmail` | Merchant applies |
| `sendKycApprovedEmail` | Admin approves KYC |
| `sendP2POrderEmail` | New P2P order |
| `sendAdCreatedEmail` | Merchant creates ad |

All emails are sent **outside** the DB transaction (non-blocking, `.catch()` swallows errors so email failure doesn't break the flow).

---

## 14. Admin Panel

URL: `/admin`

Protected by Supabase session + `user.isAdmin === true`.

| Section | Route | Description |
|---|---|---|
| Dashboard | `/admin` | Stats overview |
| Users | `/admin/users` | View/manage all users |
| Withdrawals | `/admin/withdrawals` | Pending/completed withdrawals |
| P2P Merchants | `/admin/p2p/merchants` | Approve/reject KYC |
| P2P Deposits | `/admin/p2p/deposits` | Merchant deposit history |
| P2P Disputes | `/admin/p2p/disputes` | Open disputes |
| Profits | `/admin/profits` | Platform revenue |
| Crypto Wallets | `/admin/crypto/wallets` | All deposit addresses |

---

## 15. VPS Cron Jobs

File: `/var/lib/cron/crontabs/root` or `crontab -e`

```cron
# Bet settlement (every 30 min)
*/30 * * * * /opt/neemiz/settle-bets.sh >> /var/log/neemiz-settle.log 2>&1

# Crypto deposit checker (every 5 min)
*/5 * * * * source /opt/neemiz/settle.env && \
  echo -n "[$(date +"%Y-%m-%d %H:%M")] " >> /var/log/neemiz-deposits.log && \
  curl -sL -H "Authorization: Bearer $CRON_SECRET" \
  https://www.nezeem.com/api/cron/check-deposits \
  >> /var/log/neemiz-deposits.log 2>&1 && \
  echo "" >> /var/log/neemiz-deposits.log
```

### Viewing Cron Logs

```bash
# Last 20 deposit cron runs
tail -20 /var/log/neemiz-deposits.log

# Filter for a specific address
grep "TAiVmn" /var/log/neemiz-deposits.log

# Pretty-print latest result with per-address details
tail -1 /var/log/neemiz-deposits.log | python3 -m json.tool

# Trigger deposit cron manually
source /opt/neemiz/settle.env
curl -sL --max-time 60 \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://www.nezeem.com/api/cron/check-deposits | python3 -m json.tool
```

### Cron Response Format

```json
{
  "ok": true,
  "checked": 21,
  "credited": 1,
  "errors": [],
  "details": [
    {
      "address": "TAiVmnEB9V8n15cspRi6LKkTbB6gzvAPFu",
      "crypto": "USDT",
      "network": "TRC20",
      "txsFound": 1,
      "skipped": 0,
      "credited": 1
    }
  ]
}
```

- `txsFound: 0` → API returned no transactions (address has no history, or API issue)
- `skipped > 0` → txHash already in DB (normal for old deposits)
- `credited > 0` → new deposit just credited ✅
- `error: "..."` → API key issue or network error

---

## 16. Key API Routes

### Wallet
```
GET  /api/wallet/balance          → KES balance + crypto balances
GET  /api/wallet/transactions     → transaction history
POST /api/wallet/deposit/megapay  → initiate M-Pesa STK push
POST /api/wallet/withdraw         → KES withdrawal via M-Pesa
```

### Crypto
```
GET  /api/crypto/address          → get/create deposit address
GET  /api/crypto/balance          → user's crypto balances
POST /api/crypto/withdraw         → withdraw crypto (self-custody hot wallet)
GET  /api/crypto/transfer?username=x → look up transfer recipient
POST /api/crypto/transfer         → internal send to another user
```

### Cron
```
GET  /api/cron/check-deposits     → scan all addresses for new deposits
                                    Requires: Authorization: Bearer {CRON_SECRET}
```

### P2P Merchant
```
GET/POST /api/p2p/merchant/apply          → apply / check status
GET      /api/p2p/merchant/balance        → escrow balance
GET      /api/p2p/merchant/deposit        → escrow deposit history
GET      /api/p2p/merchant/deposit-address → get deposit address
POST     /api/p2p/merchant/fund           → wallet → escrow transfer
POST     /api/p2p/merchant/escrow-to-wallet → escrow → wallet transfer
```

### P2P Orders
```
GET/POST /api/p2p/orders          → list / create order
GET/POST /api/p2p/orders/[id]     → order detail
POST     /api/p2p/orders/[id]/paid      → buyer marks paid
POST     /api/p2p/orders/[id]/release   → merchant releases crypto
POST     /api/p2p/orders/[id]/cancel    → cancel order
POST     /api/p2p/orders/[id]/dispute   → raise dispute
GET/POST /api/p2p/orders/[id]/messages  → order chat
```

---

## 17. Hot Wallet — Setup & Funding

### Current Hot Wallet Addresses

```
EVM  (Polygon / ETH / BSC): 0x29d8Ab96b05c03035265168FC0F2E9B176dD8EB8
Tron (USDT TRC20):          TDnUGSNLzZX7kb2PJuVoKE8cWv5HEs2hPj
```

> These are derived from `MASTER_WALLET_MNEMONIC` at index 0. They will always be the same as long as the mnemonic doesn't change.

### What to Fund

| Send to EVM address | Amount | Why |
|---|---|---|
| MATIC (Polygon network) | 10 MATIC | Gas for USDC/USDT Polygon withdrawals |
| ETH (Ethereum network) | 0.05 ETH | Gas for ETH/USDT/USDC ETH withdrawals |
| BNB (BSC network) | 0.5 BNB | Gas for BNB/USDT BSC withdrawals |
| USDC (Polygon) | Your float | Withdrawal reserve |
| USDT (ERC20/BEP20) | Your float | Withdrawal reserve |

| Send to Tron address | Amount | Why |
|---|---|---|
| TRX | 200 TRX | Energy for USDT TRC20 withdrawals |
| USDT (TRC20) | Your float | Withdrawal reserve |

### Monitoring

Check hot wallet balances regularly on:
- **Polygon**: polygonscan.com/address/0x29d8Ab96b05c03035265168FC0F2E9B176dD8EB8
- **Tron**: tronscan.org/#/address/TDnUGSNLzZX7kb2PJuVoKE8cWv5HEs2hPj

Top up gas coins when they run low. A depleted gas balance means withdrawals will fail (funds are debited from user then refunded — bad UX).

---

## 18. Debugging Guide

### "User deposited crypto but balance is 0"

1. Check cron log for that address:
   ```bash
   grep "ADDRESS_PREFIX" /var/log/neemiz-deposits.log | tail -5
   ```
2. Check TronGrid/Etherscan directly:
   ```bash
   # USDT TRC20
   curl "https://api.trongrid.io/v1/accounts/ADDRESS/transactions/trc20?contract_address=TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t&only_confirmed=true&limit=5" \
     -H "TRON-PRO-API-KEY: $TRONGRID_API_KEY"
   ```
3. Check DB via Supabase SQL editor:
   ```sql
   -- Find the deposit
   SELECT reference, status, amount, currency, provider, created_at
   FROM transactions
   WHERE user_id = (SELECT user_id FROM crypto_deposit_addresses WHERE address = 'ADDRESS' LIMIT 1)
   AND provider = 'crypto'
   ORDER BY created_at DESC LIMIT 10;

   -- Check current balance
   SELECT crypto, network, available, locked
   FROM user_crypto_balances
   WHERE user_id = (SELECT user_id FROM crypto_deposit_addresses WHERE address = 'ADDRESS' LIMIT 1);
   ```
4. If transaction exists (COMPLETED) but balance is 0, manually fix:
   ```sql
   UPDATE user_crypto_balances
   SET available = <amount>
   WHERE user_id = (SELECT user_id FROM crypto_deposit_addresses WHERE address = 'ADDRESS' LIMIT 1)
   AND crypto = 'USDT' AND network = 'TRC20';
   ```

### "Cron shows txsFound: 1, skipped: 1 but nothing credited"

The deposit was previously processed. Check where it went:
```sql
-- Check p2p escrow (old system may have put it there)
SELECT tx_hash, status, amount, crypto, created_at
FROM p2p_crypto_deposits
WHERE merchant_id IN (
  SELECT id FROM merchant_profiles
  WHERE user_id = (SELECT user_id FROM crypto_deposit_addresses WHERE address = 'ADDRESS' LIMIT 1)
)
ORDER BY created_at DESC LIMIT 5;

-- Check transaction ledger
SELECT reference, status, amount, currency, created_at
FROM transactions
WHERE reference LIKE '%TXHASH_PREFIX%';
```

### "Withdrawal failed"

- Check transaction status:
  ```sql
  SELECT status, metadata FROM transactions WHERE id = 'TX_ID';
  ```
- If `status = FAILED`, balance was auto-refunded
- Check hot wallet has enough gas and tokens
- Check `MASTER_WALLET_MNEMONIC` is set in Vercel env vars

### "Cron returns checked: 0"

No addresses in `crypto_deposit_addresses` table. Users must click "Get Address" / "Receive" in the deposit modal to register their address.

### "Email not sending"

- Verify `BREVO_API_KEY` and `BREVO_SENDER_EMAIL` in Vercel env vars
- Check Brevo dashboard for failed sends
- Email failures are silent (`.catch()` swallows errors) — check server logs

---

## 19. Known Issues & Fixes Applied

### 2026-05-22: Crypto deposits no longer convert to KES

**Problem:** All crypto deposits were being converted to KES via CoinGecko rates and credited to `walletBalance`. This was wrong — users wanted to keep crypto as crypto.

**Fix:**
- Removed all KES conversion from cron, `fund`, and `escrow-to-wallet` endpoints
- Crypto deposits now only credit `UserCryptoBalance` (increment)
- `walletBalance` is exclusively for M-Pesa/Pesapal deposits

### 2026-05-22: On-chain balance sync was zeroing out valid balances

**Problem:** After crediting a deposit, the on-chain balance sync ran and got `0` from TronGrid (API lag for newly-funded addresses), then SET the balance to 0, erasing the credit.

**Fix:**
- Removed on-chain sync from cron entirely
- `UserCryptoBalance` is now maintained purely by transaction increments/decrements
- The Transaction ledger is the single source of truth

**Affected user:** oira (ombuioira@gmail.com) — 3.7 USDT zeroed out. Manual fix:
```sql
UPDATE user_crypto_balances SET available = 3.70
WHERE user_id = (SELECT user_id FROM crypto_deposit_addresses WHERE address = 'TAiVmnEB9V8n15cspRi6LKkTbB6gzvAPFu' LIMIT 1)
AND crypto = 'USDT' AND network = 'TRC20';
```

### 2026-05-22: Old merchant deposits in P2P escrow

**Problem:** Before the wallet-first redesign, all crypto received by merchants went directly to `P2PCryptoBalance` (escrow), bypassing the normal wallet. These deposits show `skipped: 1` in cron because the txHash is in `p2p_crypto_deposits`.

**How to see:** Merchant Center → Merchant Balances → "In Escrow" column  
**How to fix:** Merchant clicks "To Wallet" button to move escrow → wallet

### 2026-05-29: NOWPayments removed

Replaced with self-custody hot wallet broadcaster (`lib/crypto/broadcaster.ts`).
Old `provider: "nowpayments"` transactions still exist in DB but no new ones are created.

---

## 20. Future Work

### High Priority

- [ ] **BTC withdrawals** — needs `bitcoinjs-lib` installed, sweep from user address to hot wallet
- [ ] **Auto-sweep** — cron job to sweep deposits from individual user addresses to hot wallet (currently hot wallet must be manually topped up)
- [ ] **Hot wallet monitoring** — alert when gas balance < threshold
- [ ] **Withdrawal webhook** — confirm on-chain before marking COMPLETED (currently trusts the broadcast)

### Medium Priority

- [ ] **Store HD index** — add `hd_index` column to `crypto_deposit_addresses` so private key lookup is O(1) instead of O(N) scan (currently not needed since we use hot wallet for outgoing)
- [ ] **USDC TRC20 withdrawals** — TronGrid broadcaster only supports USDT TRC20 currently
- [ ] **Withdrawal limits** — per-day limits, KYC-gated higher limits
- [ ] **Fee configurability** — currently hardcoded 5% in withdraw route

### Nice to Have

- [ ] **Crypto-to-KES conversion** — optional, user-initiated (not automatic)
- [ ] **Multi-sig hot wallet** — for large withdrawal amounts
- [ ] **P2P ratings** — buyer/seller reputation system after trade completion
- [ ] **Admin hot wallet top-up dashboard** — see balances, trigger manual sweeps

---

## Quick Reference

### Common Supabase SQL Queries

```sql
-- Find user by email
SELECT id, username, email, wallet_balance FROM users WHERE email = 'user@example.com';

-- User's crypto balances
SELECT crypto, network, available, locked FROM user_crypto_balances WHERE user_id = 'USER_ID';

-- User's recent transactions
SELECT type, amount, currency, status, provider, reference, created_at
FROM transactions WHERE user_id = 'USER_ID' ORDER BY created_at DESC LIMIT 20;

-- All merchant escrow balances
SELECT m.display_name, p.crypto, p.available, p.locked
FROM p2p_crypto_balances p JOIN merchant_profiles m ON m.id = p.merchant_id;

-- Pending withdrawals
SELECT u.email, t.amount, t.currency, t.status, t.metadata, t.created_at
FROM transactions t JOIN users u ON u.id = t.user_id
WHERE t.type = 'WITHDRAWAL' AND t.status = 'PENDING';

-- Active P2P orders
SELECT o.id, o.status, o.crypto, o.crypto_amount, o.fiat_amount,
       b.username AS buyer, m.display_name AS merchant
FROM p2p_orders o
JOIN users b ON b.id = o.buyer_id
JOIN merchant_profiles m ON m.id = o.seller_id
WHERE o.status NOT IN ('RELEASED', 'CANCELLED', 'EXPIRED');
```

### Manual Balance Correction

```sql
-- Credit crypto (e.g. missed deposit)
UPDATE user_crypto_balances SET available = available + 10.0
WHERE user_id = 'USER_ID' AND crypto = 'USDT' AND network = 'TRC20';

-- Credit KES (e.g. manual refund)
UPDATE users SET wallet_balance = wallet_balance + 500 WHERE id = 'USER_ID';

-- Always add a transaction record to explain the change
INSERT INTO transactions (user_id, type, amount, currency, status, provider, reference, metadata)
VALUES ('USER_ID', 'DEPOSIT', 10.0, 'USDT', 'COMPLETED', 'manual',
        'manual-correction-2026-05-29',
        '{"reason": "missed deposit correction", "admin": "your@email.com"}');
```

### Deploy New Code

```bash
# From the worktree directory
git add <files>
git commit -m "feat: description"
git push origin HEAD:main
# Vercel auto-deploys within ~2 minutes
```

### Force-Trigger Deposit Cron

```bash
# On VPS
set -a && source /opt/neemiz/settle.env && set +a
curl -sL --max-time 60 \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://www.nezeem.com/api/cron/check-deposits \
  | python3 -m json.tool
```
