#!/usr/bin/env bash
# Clear the kill switch — let the signer sign withdrawals again.
# Only run this once you are sure the seed is safe and the threat is over.
#
# Usage:  ./resume.sh
set -euo pipefail
VOL=$(sudo docker volume inspect -f '{{.Mountpoint}}' neemiz-signer-data)
# Docker's volume dir is root-owned, so the existence test must run under sudo.
if sudo test -e "$VOL/HALT"; then
  sudo rm -f "$VOL/HALT"
  echo "🟢 SIGNER RESUMED — HALT flag removed."
else
  echo "🟢 Signer was not halted (no HALT flag)."
fi
curl -s --max-time 5 http://10.8.0.2:8787/health && echo || echo "   (signer not answering /health)"
