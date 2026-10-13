import { collectDefaultMetrics, Registry } from "@prometheus-io/client";

// One registry per process, not the library's global one: each process
// exposes only its own metrics, and tests get a fresh registry each time.
export function createMetricsRegistry(): Registry {
  const registry = new Registry();
  // CPU, memory, event loop lag, GC: what to look at first under load.
  collectDefaultMetrics({ register: registry });
  return registry;
}
