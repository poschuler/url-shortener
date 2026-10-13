import { Counter, Histogram, type Registry } from "@prometheus-io/client";

export type LinksMetrics = {
  cacheLookups: Counter<"result">;
  queryDuration: Histogram<"operation" | "outcome">;
};

// Created once per process: write and read share these metrics when they
// run together, and a registry rejects a metric name it already holds.
export function createLinksMetrics(registry: Registry): LinksMetrics {
  return {
    cacheLookups: new Counter({
      name: "links_cache_lookups_total",
      help: "Link cache reads, by result (hit, known-missing, miss).",
      labelNames: ["result"],
      registers: [registry],
    }),
    queryDuration: new Histogram({
      name: "links_db_query_duration_seconds",
      help: "Postgres queries of the links module, by operation and outcome.",
      labelNames: ["operation", "outcome"],
      buckets: [0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
      registers: [registry],
    }),
  };
}

export async function timeQuery<T>(
  histogram: LinksMetrics["queryDuration"],
  operation: string,
  query: () => Promise<T>,
): Promise<T> {
  const end = histogram.startTimer({ operation });

  try {
    const result = await query();
    end({ outcome: "ok" });
    return result;
  } catch (error) {
    end({ outcome: "error" });
    throw error;
  }
}
