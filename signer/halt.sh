#!/usr/bin/env bash
# KILL SWITCH — stop the signer from signing ANY withdrawal. Instant, no restart.
#
# Trips the flag by creating HALT on the signer's persistent /data volume, so it
# works whether the container is running or not, and SURVIVES a restart/redeploy.
# After this, POST /sign-withdrawal returns 503 (SIGNING_HALTED) until ./resume.sh.
#
# Usage:  ./halt.sh
set -euo pipefail
VOL=$(sudo docker volume inspect -f '{{.Mountpoint}}' neemiz-signer-data)
sudo touch "$VOL/HALT"
echo "🔴 SIGNER HALTED — flag at $VOL/HALT"
echo "   No withdrawals will be signed until you run ./resume.sh"
curl -s --max-time 5 http://10.8.0.2:8787/health && echo || echo "   (signer not answering /health — it is still halted regardless)"
