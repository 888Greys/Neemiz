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
- `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET`
- `CRON_SECRET`, `SETTLE_SECRET`

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
