/**
 * One-shot: fill fixtures_cache from The Odds API (same as refresh-fixtures cron).
 * Usage: bunx tsx --env-file=.env.local scripts/refresh-fixtures-once.ts
 */
import { refreshFixtureCache } from "../lib/fixtures-cache";

async function main() {
  console.log("Refreshing fixture cache…");
  const result = await refreshFixtureCache();
  console.log(JSON.stringify(result, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
