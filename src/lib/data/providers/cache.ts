/**
 * Tiny in-memory TTL cache (per server instance). Avoids paying twice for
 * identical provider calls within a short window; nothing is persisted.
 */
export class TtlCache<T> {
  private store = new Map<string, { expires: number; value: T }>();

  constructor(
    private ttlMs: number,
    private maxEntries = 200
  ) {}

  get(key: string): T | undefined {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expires < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: T): void {
    if (this.store.size >= this.maxEntries) {
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, { expires: Date.now() + this.ttlMs, value });
  }
}
