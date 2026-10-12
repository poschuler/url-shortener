import { afterEach, describe, expect, it, vi } from "vitest";

import { withTimeout } from "#src/shared/async/with-timeout.js";

describe("withTimeout", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the value when the promise settles in time", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 100)).resolves.toBe("ok");
  });

  it("passes on the rejection of the promise", async () => {
    await expect(
      withTimeout(Promise.reject(new Error("boom")), 100),
    ).rejects.toThrow("boom");
  });

  it("rejects when the promise takes too long", async () => {
    vi.useFakeTimers();
    const result = withTimeout(new Promise(() => {}), 100);

    vi.advanceTimersByTime(100);

    await expect(result).rejects.toThrow("Timed out after 100 ms");
  });

  it("clears its timer when the promise settles", async () => {
    vi.useFakeTimers();

    await withTimeout(Promise.resolve("ok"), 100);

    expect(vi.getTimerCount()).toBe(0);
  });
});
