# Capacity headroom (nez VPS)

_Last updated: 2026-07-11 — Phase 4 of the smoothness plan._

Self-hosted Next.js on **nez** (France): Docker standalone image, nginx + Cloudflare,
self-hosted Supabase (Postgres + GoTrue + Realtime) on the same box, Aviator Go
service + Redis also on-box. This runbook sizes shared resources so 300+ daily
signups do not tip into connection exhaustion or request storms.

Do **not** apply blindly — verify live numbers on nez first, then change one
knob at a time.

## Current box facts

| Resource | Value (from `docs/INFRA-COST-REDUCTION.md`) |
|---|---|
| CPU | **6 cores** |
| RAM | ~11 GB |
| Disk | ~193 GB |

Processes sharing the box: Next.js app (cluster workers), Postgres/Supavisor,
GoTrue, Realtime, Aviator (Go + its Redis/Postgres), nginx, Grafana/Prometheus,
crons.

## 1. Prisma `connection_limit` (per worker)

App workers connect through the **Supavisor / PgBouncer transaction pooler**,
not direct to Postgres. Each Node worker opens its own Prisma pool.

### Sizing

With `WEB_CONCURRENCY=2` (default) plus occasional cron containers that also
use `DATABASE_URL`:

| Consumer | Suggested Prisma `connection_limit` |
|---|---|
| Each Next.js worker | **5** |
| Each cron / one-shot job | **2** |

Example URL query (append to the pooler URL already in use):

```text
...?pgbouncer=true&connection_limit=5
```

Full shape (self-hosted pooler host will differ):

```env
DATABASE_URL=postgresql://USER:PASS@127.0.0.1:6543/postgres?pgbouncer=true&connection_limit=5
```

### Budget check (do this on nez before raising workers)

```bash
# Supavisor / pooler max clients (example — adjust to your compose)
grep -E 'default_pool_size|max_client_conn|pool_size' /opt/supabase/**/*.toml 2>/dev/null || true

# Live Postgres connections
sudo -u postgres psql -c "SELECT count(*), state FROM pg_stat_activity GROUP BY 2 ORDER BY 1 DESC;"
sudo -u postgres psql -c "SHOW max_connections;"
```

Rule of thumb:  
`(WEB_CONCURRENCY × connection_limit) + cron_budget + supabase_services + aviator + headroom ≤ pooler max_client_conn`  
and the pooler's server-side pool must fit under Postgres `max_connections`.

### Apply

1. Edit `/opt/neemiz/neemiz-runtime.docker.env` (or the env file `scripts/deploy-server.sh` mounts).
2. Redeploy / recreate the app container so Prisma picks up the new URL.
3. Watch Grafana Postgres connection panels + app 5xx for 30 minutes.

## 2. `WEB_CONCURRENCY`

`scripts/cluster-server.mjs` forks `WEB_CONCURRENCY` workers (default **2**),
capped by `os.availableParallelism()`.

| Cores free for Node after Postgres/Aviator/nginx | Suggested `WEB_CONCURRENCY` |
|---|---|
| ≤2 | 1–2 |
| 3–4 | **2** (current default — keep) |
| ≥4 with clear headroom | **3** optional |

nez has **6 cores**, so **3 is allowed only after** confirming:

```bash
nproc
# during peak traffic
top -bn1 | head -20
docker stats --no-stream
```

If Postgres or Aviator already sit above ~40% CPU at peak, stay at 2.

```env
WEB_CONCURRENCY=3
```

Raising workers **multiplies** Prisma connections — raise `connection_limit`
budget check first (section 1). Each worker also opens its own Deriv feed WS
(Phase 1) — three workers ⇒ three Deriv connections (fine).

## 3. nginx

Live files on nez (see `scripts/deploy-server.sh`):

- `/etc/nginx/conf.d/neemiz-upstream.conf` — blue/green upstream port
- Site config under `/etc/nginx/sites-enabled/` (or conf.d) for `nezeem.com` /
  `aviator.nezeem.com`

### Recommended deltas

Apply in the **http** block (or a snippet included from there):

```nginx
worker_rlimit_nofile 65535;

events {
    worker_connections 4096;
    multi_accept on;
}
```

App upstream — keepalive so each request does not open a fresh local TCP
connection to the Node container:

```nginx
upstream neemiz_app {
    server 127.0.0.1:3007;   # port managed by deploy-server.sh
    keepalive 32;
}

server {
    # ...
    location / {
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_pass http://neemiz_app;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
    }
}
```

WebSocket locations (Aviator hub, Supabase Realtime if proxied through nginx):

```nginx
location /ws {
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_pass http://aviator_upstream;  # existing Aviator upstream
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
}
```

### Apply checklist

```bash
sudo nginx -t && sudo nginx -s reload
# confirm nofile
cat /proc/$(pidof nginx | awk '{print $1}')/limits | grep 'open files'
```

`deploy-server.sh` rewrites `neemiz-upstream.conf` to a single `server` line —
if you add `keepalive`, either patch the deploy script to preserve it or put
keepalive in a separate upstream file that deploy does not overwrite.

## 4. Redis rate limiting

Code: `lib/rate-limit.ts`. When `REDIS_URL` is set, fixed-window counters are
stored in Redis so limits are **global across cluster workers**. If Redis is
down, the limiter falls back to in-memory (per-worker) without failing requests
open entirely.

### Env

```env
# Same Redis instance Aviator already uses is fine — use a dedicated logical DB index if available
REDIS_URL=redis://127.0.0.1:6379/1
```

From the app container, Redis must be reachable (host network, `extra_hosts`,
or `host.docker.internal` / bridge IP). Example if Redis listens on the host:

```env
REDIS_URL=redis://172.17.0.1:6379/1
```

### Verify

```bash
redis-cli -n 1 keys 'rl:*' | head
# place bets / transfers from two workers — counters should share one key
```

Keys are prefixed `rl:`.

## 5. Cloudflare edge cache

CF does **not** cache non-static paths by default. Public JSON that already
sends shared `Cache-Control` should be forced at the edge:

| Path / pattern | Notes |
|---|---|
| `/_next/image*` | Image optimizer — cacheable |
| `/api/p2p/spot*` | Already `s-maxage` |
| `/api/p2p/fx*` | Already long `s-maxage` |
| `/api/sports/fixtures*` | Phase 3 — `s-maxage=10, stale-while-revalidate` |
| `/api/sports/live*` | Same |
| `/api/forex/news*` | Public news |

### Suggested Cache Rule (Cloudflare dashboard → Caching → Cache Rules)

1. **Name:** `Public market JSON + next/image`
2. **If:**  
   `(http.request.uri.path matches "^/_next/image") or (http.request.uri.path matches "^/api/(p2p/spot|p2p/fx|sports/fixtures|sports/live|forex/news)")`
3. **Then:** Eligible for cache — **Bypass cache on cookie** off for these public paths; respect origin `Cache-Control`.

Also confirm **Caching level** is Standard and that a Page Rule / Configuration
Rule is not forcing `Cache Level: Bypass` on `nezeem.com/*`.

### Verify

```bash
curl -sI 'https://www.nezeem.com/api/p2p/fx' | grep -iE 'cf-cache-status|cache-control'
curl -sI 'https://www.nezeem.com/api/sports/fixtures' | grep -iE 'cf-cache-status|cache-control'
# Expect: cf-cache-status: HIT or EXPIRED after warm-up; not DYNAMIC forever
```

## 6. Rollout order (safe)

1. Set Prisma `connection_limit=5` on workers; redeploy; watch connections.
2. Set `REDIS_URL`; redeploy; confirm `rl:*` keys and no rate-limit errors in logs.
3. nginx keepalive + `worker_connections` / `worker_rlimit_nofile`; `nginx -t` + reload.
4. Cloudflare Cache Rules; verify `cf-cache-status`.
5. Only then consider `WEB_CONCURRENCY=3` if CPU headroom is clear.

## Related

- Cluster entry: `scripts/cluster-server.mjs`
- Deploy / upstream flip: `scripts/deploy-server.sh`
- Rate limit implementation: `lib/rate-limit.ts`
- Sports soft-refresh (fewer RSC storms): `docs/PERFORMANCE.md`
- Box inventory: `docs/INFRA-COST-REDUCTION.md`
