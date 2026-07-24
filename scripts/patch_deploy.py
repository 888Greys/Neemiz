#!/usr/bin/env python3
"""Patch deploy.sh to run sister bounces via nohup so SSH drops never block Nezeem cutover."""
import sys

path = sys.argv[1] if len(sys.argv) > 1 else "/opt/neemiz/deploy.sh"

with open(path) as f:
    content = f.read()

marker = "# Sister brand: same image, separate env/container/port."
old_block_start = content.index(marker)
head = content[:old_block_start]

new_sister = '''# Sister brands: inline relay-update (instant sed), then background bounces.
# Each bounce takes ~30s per brand; we nohup them so SSH timeouts never block
# the Nezeem cutover. Failures log to /opt/neemiz/sister-bounce.log.
update_sister_relay() {
  local brand=$1 env="/opt/${brand}/runtime.docker.env"
  if [ -f "$env" ] && grep -q "^DERIV_RELAY_URL=" "$env" 2>/dev/null; then
    sed -i "s|DERIV_RELAY_URL=http://neemiz-app-[0-9]*:3000/api/deriv/relay|DERIV_RELAY_URL=http://$NEWNAME:3000/api/deriv/relay|" "$env"
    echo "[deploy] relay URL updated for $brand -> $NEWNAME"
  fi
}
for brand in binaryoptionske moneybinaryke alphaoptionske binarymarket; do
  update_sister_relay "$brand"
done
nohup /opt/neemiz/bounce-sisters.sh "$IMAGE" "$NEWNAME" >/dev/null 2>&1 &
echo "[deploy] sister bounces forked (pid $!); check /opt/neemiz/sister-bounce.log"
echo "[deploy] done; live on $NEW"
'''

new_content = head + new_sister.rstrip() + "\n"

with open(path, "w") as f:
    f.write(new_content)

print(f"patched {path}, {new_content.count(chr(10))} lines")
