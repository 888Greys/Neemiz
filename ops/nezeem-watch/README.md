# Nezeem wallet watcher (on-chain drainer early-warning)

Polls **public** balances of the hot wallet, the old (leaked-seed) wallet, and
known attacker addresses across Polygon / BSC / Ethereum / Tron. Holds **no keys
and no seed** — safe to run anywhere. Runs on `soi` as a systemd timer (every
~3 min). State is kept in `state.json` next to the script.

It sends a Telegram alert when:
- a **known-bad** address (attacker / old compromised) **receives** funds, or
- the **hot wallet** is suddenly **drained** (≥ `hot_drain_pct` of a meaningful balance).

## Auto kill switch

When it detects a **true emergency** — the hot wallet drained, or funds reaching
the **active attacker** address — it also **trips the signer's kill switch**: it
creates the `HALT` flag on the signer's Docker volume (`signer_halt_file`), so the
signer (`signer/`) refuses to sign any withdrawal within one watch cycle, even if
nobody is awake. The freeze is cleared manually with `signer/resume.sh`.

Harmless dust to a **dead/old** address (`old_compromised`) only **alerts** — it
does **not** halt. Set `"auto_halt": false` in `config.json` to disable the
auto-trip entirely (alerts still fire).

## Deploy / operate (on soi)

```bash
# install location: /opt/nezeem-watch
sudo cp watch.py /opt/nezeem-watch/watch.py
sudo cp config.example.json /opt/nezeem-watch/config.json   # then fill in real values
sudo python3 -m py_compile /opt/nezeem-watch/watch.py       # sanity check
sudo systemctl start nezeem-watch.service                   # run one cycle now
journalctl -u nezeem-watch.service -n 20 --no-pager         # see the result
systemctl list-timers nezeem-watch.timer                    # confirm the 3-min timer
```

`config.json` holds the Telegram token — it is **git-ignored / never committed**.
Only `config.example.json` (placeholders) lives in the repo.
