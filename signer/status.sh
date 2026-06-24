#!/usr/bin/env bash
# Show whether the signer is up and whether the kill switch is engaged.
#
# Usage:  ./status.sh
set -euo pipefail
VOL=$(sudo docker volume inspect -f '{{.Mountpoint}}' neemiz-signer-data 2>/dev/null || echo "")
# Docker's volume dir is root-owned, so the existence test must run under sudo.
if [ -n "$VOL" ] && sudo test -e "$VOL/HALT"; then
  echo "🔴 kill switch: ENGAGED (HALT flag present at $VOL/HALT)"
else
  echo "🟢 kill switch: clear"
fi
echo -n "health: "
curl -s --max-time 5 http://10.8.0.2:8787/health && echo || echo "(no response from 10.8.0.2:8787)"
