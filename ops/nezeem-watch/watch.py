#!/usr/bin/env python3
"""
Nezeem on-chain wallet watcher.

Polls PUBLIC balances of Nezeem's hot wallet + known-bad addresses across
Polygon / BSC / Ethereum / Tron and sends a Telegram alert when:

  - a KNOWN-BAD address (attacker, or old compromised) RECEIVES funds
    (any balance increase)  -> CRITICAL: active theft or deposits mis-routing
  - the HOT WALLET is suddenly DRAINED
    (balance falls by >= drain_pct of a meaningful prior balance) -> CRITICAL

No private keys, no seed. Watches public chain data only — safe to run on a
shared box. State is kept in state.json next to this script.

Config: config.json (see config.example.json). Run: python3 watch.py
"""
import json, os, sys, time, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
CONFIG = os.path.join(HERE, "config.json")
STATE  = os.path.join(HERE, "state.json")

def log(msg):
    print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}", flush=True)

UA = "Mozilla/5.0 (compatible; nezeem-wallet-watch/1.0)"

def http_json(url, payload=None, headers=None, timeout=20, retries=2):
    data = json.dumps(payload).encode() if payload is not None else None
    h = {"User-Agent": UA, "Accept": "application/json"}
    if headers:
        h.update(headers)
    if data is not None:
        h["Content-Type"] = "application/json"
    last = None
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, data=data, headers=h)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            last = e
            if e.code == 429 and attempt < retries:
                time.sleep(2 * (attempt + 1)); continue
            raise
    raise last

# ── balance fetchers (return float in whole coins, or None on error) ──────────

def evm_balance(rpc, addr):
    try:
        res = http_json(rpc, {
            "jsonrpc": "2.0", "method": "eth_getBalance",
            "params": [addr, "latest"], "id": 1,
        })
        return int(res["result"], 16) / 1e18
    except Exception as e:
        log(f"  ! EVM balance error ({rpc} {addr[:10]}…): {e}")
        return None

def tron_balance(addr):
    try:
        res = http_json(f"https://api.trongrid.io/v1/accounts/{addr}")
        data = res.get("data") or []
        if not data:
            return 0.0  # unactivated account = 0
        return int(data[0].get("balance", 0)) / 1e6
    except Exception as e:
        log(f"  ! Tron balance error ({addr[:10]}…): {e}")
        return None

# ── telegram ──────────────────────────────────────────────────────────────────

def telegram(cfg, text):
    tok = cfg.get("telegram_token")
    chat = cfg.get("telegram_chat_id")
    if not tok or not chat or tok.startswith("PUT_"):
        log("  (telegram not configured — would have sent:)")
        log("  " + text.replace("\n", " | "))
        return
    try:
        http_json(
            f"https://api.telegram.org/bot{tok}/sendMessage",
            {"chat_id": chat, "text": text, "parse_mode": "HTML",
             "disable_web_page_preview": True},
        )
    except Exception as e:
        log(f"  ! telegram send failed: {e}")

# ── auto kill switch ──────────────────────────────────────────────────────────

# Default path of the signer's HALT flag: the file inside its Docker volume.
# Touching it makes the signer (on the same box) refuse to sign ANY withdrawal,
# instantly and across restarts. Override with "signer_halt_file" in config.json.
DEFAULT_HALT_FILE = "/var/lib/docker/volumes/neemiz-signer-data/_data/HALT"

def trip_kill_switch(cfg, reasons):
    """Create the signer's HALT flag so it stops signing. Idempotent + best-effort:
    a watcher that can't write the flag must still send its Telegram alert."""
    if not cfg.get("auto_halt", True):
        log("  auto_halt disabled in config -- NOT tripping the kill switch.")
        return False
    path = cfg.get("signer_halt_file", DEFAULT_HALT_FILE)
    if os.path.exists(path):
        log(f"  kill switch already engaged ({path}).")
        return True
    try:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as f:
            f.write(f"auto-halted by wallet-watcher: {'; '.join(reasons)}\n")
    except Exception as e:
        log(f"  ! FAILED to trip kill switch ({path}): {e} -- halt the signer manually!")
        return False
    # The write is what counts; log AFTER so a logging hiccup can't flip the result.
    log(f"  KILL SWITCH TRIPPED -- wrote {path}. Signer will refuse withdrawals.")
    return True

# ── main ────────────────────────────────────────────────────────────────────

def main():
    if not os.path.exists(CONFIG):
        log(f"missing {CONFIG}"); sys.exit(1)
    cfg = json.load(open(CONFIG))
    state = json.load(open(STATE)) if os.path.exists(STATE) else {}
    drain_pct = cfg.get("hot_drain_pct", 0.9)       # alert if hot drops >=90%
    hot_min   = cfg.get("hot_min_meaningful", 0.0)  # only if prior bal above this

    rpcs = cfg["rpcs"]            # {polygon:..., bsc:..., ethereum:...}
    alerts, first_run = [], (len(state) == 0)
    halt_reasons = []   # emergencies that should auto-freeze the signer
    new_state = {}

    for w in cfg["watch"]:
        key   = w["key"]                 # unique id, e.g. "hot-polygon"
        role  = w["role"]                # hot | attacker | old_compromised
        chain = w["chain"]               # polygon | bsc | ethereum | tron
        addr  = w["address"]
        label = w.get("label", key)

        time.sleep(0.4)  # be gentle on public/free endpoints (esp. TronGrid)
        if chain == "tron":
            bal = tron_balance(addr)
        else:
            bal = evm_balance(rpcs[chain], addr)
        if bal is None:
            new_state[key] = state.get(key)   # keep last on transient error
            continue

        prev = state.get(key)
        new_state[key] = bal
        sym = {"polygon": "POL", "bsc": "BNB", "ethereum": "ETH", "tron": "TRX"}[chain]
        log(f"  {label} [{chain}] {addr[:8]}…{addr[-6:]} = {bal:.6f} {sym}"
            + ("" if prev is None else f" (was {prev:.6f})"))

        if prev is None:
            continue  # baseline only

        delta = bal - prev
        if role in ("attacker", "old_compromised") and delta > 1e-9:
            alerts.append(
                f"🚨 <b>{role.upper()} ADDRESS RECEIVED FUNDS</b>\n"
                f"{label} ({chain})\n<code>{addr}</code>\n"
                f"+{delta:.6f} {sym}  (now {bal:.6f})\n"
                f"→ Active theft or deposits mis-routing. Investigate NOW."
            )
            # Funds reaching the ACTIVE attacker address ⇒ live theft ⇒ freeze.
            # old_compromised is a dead address (stale dust) ⇒ alert only, no halt.
            if role == "attacker":
                halt_reasons.append(f"{role} address {label} received +{delta:.6f} {sym}")
        elif role == "hot" and prev > hot_min and bal <= prev * (1 - drain_pct):
            alerts.append(
                f"🚨 <b>HOT WALLET DRAINED</b>\n"
                f"{label} ({chain})\n<code>{addr}</code>\n"
                f"{prev:.6f} → {bal:.6f} {sym}  ({delta:.6f})\n"
                f"→ Possible seed re-compromise. Freeze deposits + rotate."
            )
            halt_reasons.append(f"hot wallet {label} drained {prev:.6f}→{bal:.6f} {sym}")

    json.dump(new_state, open(STATE, "w"), indent=2)

    if first_run:
        log("baseline recorded (no alerts on first run).")
    elif alerts:
        body = "\n\n".join(alerts)
        log(f"!!! {len(alerts)} ALERT(S) — sending telegram")
        if halt_reasons:
            tripped = trip_kill_switch(cfg, halt_reasons)
            body += ("\n\n🔴 <b>SIGNER AUTO-HALTED</b> — withdrawals are frozen. "
                     "Run <code>./resume.sh</code> on soi once it's safe."
                     if tripped else
                     "\n\n⚠️ <b>Tried to auto-halt the signer but FAILED</b> — "
                     "halt it manually: <code>cd ~/neemiz-signer && ./halt.sh</code>")
        telegram(cfg, "<b>Nezeem wallet watch</b>\n\n" + body)
    else:
        log("ok — no suspicious activity.")

if __name__ == "__main__":
    main()
