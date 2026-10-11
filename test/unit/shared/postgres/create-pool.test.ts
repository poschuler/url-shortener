import { pino } from "pino";
import { describe, expect, it, vi } from "vitest";

import { createPool } from "#src/shared/postgres/create-pool.js";

const CONFIG = {
  host: "localhost",
  port: 5432,
  user: "user",
  password: "secret",
  dbName: "db",
};

describe("createPool", () => {
  it("logs idle client errors without the client attached to them", () => {
    const logger = pino({ level: "silent" });
    const warn = vi.spyOn(logger, "warn");
    const pool = createPool(CONFIG, logger);
    const error = Object.assign(new Error("terminating connection"), {
      code: "57P01",
      client: { password: "secret" },
    });

    pool.emit("error", error);

    expect(warn).toHaveBeenCalledExactlyOnceWith(
      { err: { message: "terminating connection", code: "57P01" } },
      "Idle Postgres client failed",
    );
  });
});
