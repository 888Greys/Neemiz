#!/bin/bash
# Pull an immutable image from GHCR, health-check it on the idle port, and
# switch Nginx only after the new container is ready.
set -euo pipefail

UPSTREAM=/etc/nginx/conf.d/neemiz-upstream.conf
RUNTIME_ENV=/opt/neemiz/neemiz-runtime.docker.env
REGISTRY=ghcr.io

IMAGE="${SSH_ORIGINAL_COMMAND:-}"
IMAGE="${IMAGE#deploy }"

if [[ ! "$IMAGE" =~ ^ghcr\.io/888greys/neemiz:[a-f0-9]{40}$ ]]; then
  echo "[deploy] invalid image reference"
  exit 1
fi

read -r GHCR_TOKEN
if [ -z "$GHCR_TOKEN" ]; then
  echo "[deploy] missing registry token"
  exit 1
fi

cleanup_registry_auth() {
  docker logout "$REGISTRY" >/dev/null 2>&1 || true
}
trap cleanup_registry_auth EXIT

echo "$GHCR_TOKEN" | docker login "$REGISTRY" -u 888Greys --password-stdin >/dev/null
unset GHCR_TOKEN

echo "[deploy] $(date -u) pulling $IMAGE"
docker pull "$IMAGE"

CUR=$(grep -oE '127.0.0.1:[0-9]+' "$UPSTREAM" | grep -oE '[0-9]+$' || echo 3007)
if [ "$CUR" = "3007" ]; then NEW=3008; else NEW=3007; fi
NEWNAME="neemiz-app-$NEW"
echo "[deploy] live port=$CUR -> new port=$NEW ($NEWNAME)"

docker rm -f "$NEWNAME" >/dev/null 2>&1 || true
docker run -d \
  --name "$NEWNAME" \
  --restart unless-stopped \
  --env-file "$RUNTIME_ENV" \
  -p "127.0.0.1:$NEW:3000" \
  "$IMAGE" >/dev/null

ok=
for i in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$NEW/dashboard" || echo 000)
  if [ "$code" = "200" ]; then
    ok=1
    echo "[deploy] new container healthy after ${i} tries"
    break
  fi
  sleep 3
done

if [ -z "$ok" ]; then
  echo "[deploy] new container unhealthy; keeping the old container live"
  docker logs --tail 30 "$NEWNAME" || true
  docker rm -f "$NEWNAME" >/dev/null 2>&1 || true
  exit 1
fi

echo "upstream neemiz_app { server 127.0.0.1:$NEW; }" > "$UPSTREAM"
nginx -t
nginx -s reload
echo "[deploy] traffic switched to $NEW"

for old in $(docker ps -a --format '{{.Names}}' | grep -E '^neemiz-app(-[0-9]+)?$' | grep -v "^${NEWNAME}$"); do
  docker rm -f "$old" >/dev/null 2>&1 || true
done

docker image prune -f >/dev/null 2>&1 || true
echo "[deploy] done; live on $NEW"
