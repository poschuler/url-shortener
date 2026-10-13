# Prometheus metrics on a port of their own, recorded by decorators

Each API process exposes Prometheus metrics for a scraper to pull. They are recorded with `@prometheus-io/client`, the former `prom-client`: the old package is deprecated and frozen, and the new one is maintained as a Prometheus project with the same API. Each process creates its own registry, not the library's global one, with the default Node.js metrics: CPU, memory, event loop lag and garbage collection.

Request latency is recorded by a hook on the Fastify root as `http_request_duration_seconds`, by method, status code and route. The route is the pattern (`/:code`), never the URL, so the number of series stays fixed whatever clients request; requests that match no route count as `unmatched`. The `links` module records its own metrics through decorators: each one implements the same port as the adapter it wraps, delegates to it and records the result. They count cache reads by result and time the Postgres queries by operation and outcome. The use cases and the adapters do not know metrics exist. The entrypoint creates the module's metrics once per process, because the all-in-one `api` composes both sides and a registry rejects a metric name it already holds.

`/metrics` is served by a second Fastify instance on its own port, `METRICS_PORT` (9464 by default). The public port does not serve it, so it never goes through the public load balancer, needs no authentication or rate limit, and scrapes do not show up in the request metrics. The local stack publishes it on `127.0.0.1` only. The read path is load tested with k6 against these metrics, as the README describes.

## Considered Options

- **`prom-client`**: the usual choice until it was deprecated in favour of `@prometheus-io/client`.
- **The OpenTelemetry SDK with a Prometheus exporter**: more setup and more dependencies for a system that only needs Prometheus metrics.
- **`fastify-metrics`**: a dependency, with its own options and defaults, for what a hook of a few lines does.
- **A metrics port in `application/`**: the use cases would call it on every request, and their tests would have to fake it.
- **`/metrics` on the public port, blocked at the edge**: safe only as long as configuration outside the repository stays right.
- **`/metrics` behind a token**: one more secret to issue and rotate.

## Consequences

Every API process opens two ports. Metrics are per process, so totals across replicas are summed in Prometheus. A Redis failure counts as a cache `miss`, because `RedisLinkCache` turns failures into misses before the decorator sees them; counting Redis errors apart would mean changing the adapter. A new adapter gets metrics by adding a decorator in `index.ts`, without touching the use case.
