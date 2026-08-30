/**
 * Best-effort in-process idempotency guard so duplicate webhook deliveries
 * (which providers commonly send) don't double-invoke consumer callbacks.
 *
 * IMPORTANT: This is in-memory and scoped to a single process only. For
 * multi-instance / serverless deployments, this Set is NOT shared across
 * instances or cold starts. Consumers running more than one instance should
 * persist processed references in their own database and check there —
 * this in-memory dedup is a convenience default, not a durability guarantee.
 */
export interface IdempotencyStore {
  has(reference: string): boolean | Promise<boolean>;
  add(reference: string): void | Promise<void>;
}

class InMemoryIdempotencyStore implements IdempotencyStore {
  private seen = new Set<string>();

  has(reference: string): boolean {
    return this.seen.has(reference);
  }

  add(reference: string): void {
    this.seen.add(reference);
  }
}

// Singleton default store, shared for the lifetime of the process.
export const defaultIdempotencyStore: IdempotencyStore = new InMemoryIdempotencyStore();
