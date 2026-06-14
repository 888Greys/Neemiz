import cluster from "node:cluster";
import os from "node:os";

const requestedWorkers = Number.parseInt(process.env.WEB_CONCURRENCY ?? "2", 10);
const workerCount = Number.isFinite(requestedWorkers)
  ? Math.max(1, Math.min(requestedWorkers, os.availableParallelism()))
  : 2;

if (cluster.isPrimary) {
  let shuttingDown = false;

  cluster.schedulingPolicy = cluster.SCHED_RR;

  for (let index = 0; index < workerCount; index += 1) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code, signal) => {
    if (shuttingDown) return;
    console.error(`[cluster] worker ${worker.process.pid ?? "unknown"} exited (${signal ?? code}); restarting`);
    cluster.fork();
  });

  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;

    for (const worker of Object.values(cluster.workers ?? {})) {
      worker?.process.kill(signal);
    }

    setTimeout(() => process.exit(0), 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  console.log(`[cluster] started ${workerCount} Next.js workers`);
} else {
  await import("./server.js");
}
