# Nezeem wallet watcher (on-chain drainer early-warning)

Polls the **public** balance of the **current hot wallet** across
Polygon / BSC / Ethereum / Tron. Holds **no keys and no seed** — safe to run
anywhere. Runs on `soi` as a systemd timer (every ~3 min). State is kept in
`state.json` next to the script.

It sends a Telegram alert when:
- the **hot wallet** is suddenly **drained** (≥ `hot_drain_pct` of a meaningful balance).

We deliberately do **not** watch the old leaked wallet or the thief's address.
The old wallet is dead (all deposit rows were re-derived after rotation) and the
attacker address is a **shared drainer collector** — its balance rises whenever
*any* victim gets drained, so watching it produced false "active theft" alerts
and needless signer halts over other people's losses. A drop in **our** hot
wallet is the only signal that means **our** money is moving. Any leftover
`attacker` / `old_compromised` entries in a `config.json` are now ignored.

## Auto kill switch

When it detects the hot wallet being **drained**, it **trips the signer's kill
switch**: it creates the `HALT` flag on the signer's Docker volume
(`signer_halt_file`), so the signer (`signer/`) refuses to sign any withdrawal
within one watch cycle, even if nobody is awake. The freeze is cleared manually
with `signer/resume.sh`. Set `"auto_halt": false` in `config.json` to disable
the auto-trip entirely (alerts still fire).

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
