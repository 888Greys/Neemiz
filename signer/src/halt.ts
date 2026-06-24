/**
 * Kill switch. A panic lever that stops the signer from signing ANY withdrawal,
 * instantly and WITHOUT a restart. It is checked at request time, so flipping it
 * takes effect on the very next request.
 *
 * The flag is simply the presence of a file at SIGNER_HALT_FILE (default: a
 * "HALT" file inside SIGNER_STATE_DIR — i.e. the persistent /data volume).
 * Because it lives on the volume, a halt SURVIVES a container restart / redeploy:
 * once tripped, the signer stays frozen until a human clears it. Fail-closed.
 *
 *   Trip it:   touch "$SIGNER_STATE_DIR/HALT"     (or run ./halt.sh on the host)
 *   Clear it:  rm    "$SIGNER_STATE_DIR/HALT"     (or run ./resume.sh on the host)
 *
 * The on-box wallet-watcher also trips this automatically the moment it sees the
 * hot wallet drained or funds reaching the active attacker address.
 */
import { existsSync } from "fs";
import { join } from "path";

const STATE_DIR = process.env.SIGNER_STATE_DIR ?? "/data";
const HALT_FILE = process.env.SIGNER_HALT_FILE ?? join(STATE_DIR, "HALT");

export function haltFilePath(): string {
  return HALT_FILE;
}

/** True when signing is halted. One stat() call — cheap enough to run per request. */
export function isHalted(): boolean {
  return existsSync(HALT_FILE);
}
