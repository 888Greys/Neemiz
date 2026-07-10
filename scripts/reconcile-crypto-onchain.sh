#!/usr/bin/env bash
# Clamp crypto ledgers down to live on-chain balances on current deposit addresses.
set -a
. /opt/neemiz/settle.env
set +a

{
  printf "[%s] " "$(date '+%Y-%m-%d %H:%M')"
  curl -sL --max-time 280 \
    -H "Authorization: Bearer $CRON_SECRET" \
    "https://www.nezeem.com/api/cron/reconcile-crypto-onchain?dryRun=0"
  printf "\n"
} >> /var/log/neemiz-reconcile-crypto-onchain.log 2>&1
