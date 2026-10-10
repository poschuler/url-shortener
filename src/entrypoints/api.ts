import { loadConfig } from "../shared/config/config.js";
import { buildServer } from "../shared/http/build-server.js";

// Below Docker's default stop timeout (10s), so we exit before it sends SIGKILL.
const SHUTDOWN_TIMEOUT_MS = 8_000;

const config = loadConfig();
const app = buildServer({ logLevel: config.app.logLevel });

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  app.log.info({ signal }, "Shutting down");

  // Last resort if close() hangs.
  const timer = setTimeout(() => {
    app.log.fatal("Shutdown timed out, forcing exit");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  try {
    await app.close();
    app.log.info("Shutdown complete");
  } catch (error) {
    app.log.error({ err: error }, "Shutdown failed");
    process.exitCode = 1;
  } finally {
    clearTimeout(timer);
  }
}

// once(): a second Ctrl+C falls back to Node's default and kills the process.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => void shutdown(signal));
}

await app.listen({ port: config.app.port, host: "0.0.0.0" });
