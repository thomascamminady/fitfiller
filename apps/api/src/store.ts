import { randomUUID } from 'node:crypto';
import type { DecodedFit } from '@fitfiller/core';

interface StoredActivity {
  id: string;
  ownerId: string | null;
  decoded: DecodedFit;
  filename: string;
  createdAt: number;
}

/**
 * In-memory store for decoded activities, keyed by id, with a TTL sweep.
 *
 * This deliberately implements a small interface so it can be swapped for Redis
 * or a database later without changing the routes. Raw FIT messages are kept
 * server-side so the (potentially large) re-encode happens on export only.
 */
export class ActivityStore {
  private readonly map = new Map<string, StoredActivity>();

  constructor(private readonly ttlMs = 60 * 60 * 1000) {}

  put(decoded: DecodedFit, filename: string, ownerId: string | null): string {
    this.sweep();
    const id = randomUUID();
    this.map.set(id, {
      id,
      ownerId,
      decoded,
      filename,
      createdAt: Date.now(),
    });
    return id;
  }

  get(id: string): StoredActivity | undefined {
    const entry = this.map.get(id);
    if (!entry) return undefined;
    if (Date.now() - entry.createdAt > this.ttlMs) {
      this.map.delete(id);
      return undefined;
    }
    return entry;
  }

  private sweep(): void {
    const now = Date.now();
    for (const [id, entry] of this.map) {
      if (now - entry.createdAt > this.ttlMs) this.map.delete(id);
    }
  }
}
