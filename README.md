# Nezeem

Nezeem is a mobile-first betting and trading prototype built with Next.js, TypeScript, Tailwind CSS, and Bun. The current version is a polished UI prototype only: it uses mock data and does not place real bets, process payments, settle markets, or connect to SportsMonk yet.

## Current Pages

- `/` - home dashboard with wallet summary, featured match, market shortcuts, trending events, and prediction preview
- `/sports` - sportsbook view with sport filters, live/upcoming tabs, league blocks, and odds rows
- `/p2p` - P2P trading screen with buy/sell tabs, filters, merchant cards, limits, and payment chips
- `/predictions` - Polymarket-style prediction markets with category filters, probability bars, and Yes/No actions
- `/binary` - binary/forex-style trading terminal with chart placeholder, stake entry, Up/Down buttons, and recent trades
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
- `lib/mock-data.ts` - mock events, markets, P2P merchants, wallet activity, and Aviator history
- `tailwind.config.ts` - Nezeem theme tokens

## Notes

The original Stitch-generated HTML reference files have been removed after converting the design into reusable Next.js components. The next step is to replace mock data with real backend/API integrations, starting with SportsMonk for sports data and a secure wallet/ledger backend for account balances.

Production deploys are triggered from the `main` branch on Vercel.

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
