import { pino } from "pino";
import { describe, expect, it, vi } from "vitest";

import { createRedisClient } from "#src/shared/redis/create-redis-client.js";

const CONFIG = { host: "localhost", port: 6379, password: "secret" };

function setUp() {
  const logger = pino({ level: "silent" });
  const warn = vi.spyOn(logger, "warn");
  const info = vi.spyOn(logger, "info");
  const client = createRedisClient(CONFIG, logger);

  return { client, warn, info };
}

describe("createRedisClient", () => {
  it("logs only the first error of an outage", () => {
    const { client, warn } = setUp();

    client.emit("error", new Error("connect ECONNREFUSED"));
    client.emit("error", new Error("connect ECONNREFUSED"));

    expect(warn).toHaveBeenCalledExactlyOnceWith(
      { err: { message: "connect ECONNREFUSED" } },
      "Redis connection failed",
    );
  });

  it("logs when the client is ready again after an outage", () => {
    const { client, info } = setUp();

    client.emit("error", new Error("connect ECONNREFUSED"));
    client.emit("ready");

    expect(info).toHaveBeenCalledExactlyOnceWith("Redis connection restored");
  });

  it("does not log the first ready", () => {
    const { client, info } = setUp();

    client.emit("ready");

    expect(info).not.toHaveBeenCalled();
  });

  it("logs the first error of the next outage", () => {
    const { client, warn } = setUp();

    client.emit("error", new Error("connect ECONNREFUSED"));
    client.emit("ready");
    client.emit("error", new Error("Socket closed unexpectedly"));

    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenLastCalledWith(
      { err: { message: "Socket closed unexpectedly" } },
      "Redis connection failed",
    );
  });
});
