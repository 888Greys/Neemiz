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
