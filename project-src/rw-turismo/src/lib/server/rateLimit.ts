import { LRUCache } from "lru-cache";

// Rate limit em memória (por instância serverless). TODA a lógica fica isolada
// aqui: para um limite global real, basta trocar a implementação abaixo por
// Upstash Redis (ou similar) mantendo a assinatura de checkRateLimit — os
// callers não mudam.
type Entry = { count: number; resetAt: number };

const store = new LRUCache<string, Entry>({
  max: 10_000,
  ttl: 60 * 60 * 1000,
});

export type RateLimitOptions = { limit: number; windowMs: number };
export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

export const checkRateLimit = (
  key: string,
  { limit, windowMs }: RateLimitOptions
): RateLimitResult => {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (entry.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }

  entry.count += 1;
  store.set(key, entry);
  return { allowed: true, retryAfterSeconds: 0 };
};
