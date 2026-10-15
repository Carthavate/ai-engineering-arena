import { afterEach, describe, expect, it, vi } from "vitest";
import { debounce } from "./realtime";

afterEach(() => vi.useRealTimers());

describe("debounce", () => {
  it("runs once after a burst of calls, and never after cancel", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 500);
    for (let i = 0; i < 40; i++) d.call();
    vi.advanceTimersByTime(499);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);

    d.call();
    d.cancel();
    vi.advanceTimersByTime(1000);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
