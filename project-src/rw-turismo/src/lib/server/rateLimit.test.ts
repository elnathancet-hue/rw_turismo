import { describe, expect, it, vi } from "vitest";
import { checkRateLimit } from "./rateLimit";

// A store é global ao módulo, então cada teste usa uma key única.
describe("checkRateLimit", () => {
  it("permite até o limite e bloqueia a partir da 6ª chamada", () => {
    const key = `block-${Math.random()}`;
    const opts = { limit: 5, windowMs: 60_000 };

    for (let i = 0; i < 5; i += 1) {
      expect(checkRateLimit(key, opts).allowed).toBe(true);
    }

    const blocked = checkRateLimit(key, opts);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("libera de novo depois que a janela expira", () => {
    vi.useFakeTimers();
    try {
      const key = `reset-${Math.random()}`;
      const opts = { limit: 2, windowMs: 1_000 };

      expect(checkRateLimit(key, opts).allowed).toBe(true);
      expect(checkRateLimit(key, opts).allowed).toBe(true);
      expect(checkRateLimit(key, opts).allowed).toBe(false);

      vi.advanceTimersByTime(1_001);

      expect(checkRateLimit(key, opts).allowed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("chaves diferentes não compartilham contador", () => {
    const opts = { limit: 1, windowMs: 60_000 };
    expect(checkRateLimit(`a-${Math.random()}`, opts).allowed).toBe(true);
    expect(checkRateLimit(`b-${Math.random()}`, opts).allowed).toBe(true);
  });
});
