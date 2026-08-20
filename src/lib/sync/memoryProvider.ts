/**
 * In-memory sync provider. Simulates the server for tests and for a local sync
 * demo. The real Supabase adapter implements the same SyncProvider interface
 * (upsert to Postgres tables via RLS, pull rows where updated_at > since).
 */

import type { Row } from './conflict';
import type { PullResult, PushResult, SyncProvider } from './types';
import type { SyncOperation } from '../db';

export class MemoryProvider implements SyncProvider {
  /** entity → (id → row) */
  private store = new Map<string, Map<string, Row>>();
  /** performed-set idempotency guard */
  private seenEventIds = new Set<string>();

  private table(entity: string): Map<string, Row> {
    let t = this.store.get(entity);
    if (!t) {
      t = new Map();
      this.store.set(entity, t);
    }
    return t;
  }

  /** Seed a remote row directly (used to simulate another device's change). */
  seed(entity: string, row: Row): void {
    this.table(entity).set(row.id, row);
    const eventId = row.clientEventId as string | undefined;
    if (eventId) this.seenEventIds.add(eventId);
  }

  rowCount(entity: string): number {
    return this.table(entity).size;
  }

  async push(ops: SyncOperation[]): Promise<PushResult> {
    const acceptedOpIds: string[] = [];
    for (const op of ops) {
      const row = op.payload as Row;
      const table = this.table(op.entity);

      // Idempotency for performed sets: a repeated clientEventId is a no-op success.
      const eventId = row.clientEventId as string | undefined;
      if (op.entity === 'completedSets' && eventId && this.seenEventIds.has(eventId) && !table.has(row.id)) {
        acceptedOpIds.push(op.id);
        continue;
      }

      const existing = table.get(row.id);
      // Last-writer-wins on the server side too.
      if (!existing || row.updatedAt >= existing.updatedAt) {
        table.set(row.id, { ...row, dirty: false });
        if (eventId) this.seenEventIds.add(eventId);
      }
      acceptedOpIds.push(op.id);
    }
    return { acceptedOpIds, failed: [] };
  }

  async pull(since: number): Promise<PullResult> {
    const changes: Row[] = [];
    let cursor = since;
    for (const [entity, table] of this.store) {
      for (const row of table.values()) {
        if (row.updatedAt > since) {
          changes.push(row);
          cursor = Math.max(cursor, row.updatedAt);
          // Attach entity for the engine.
          (row as Row & { __entity?: string }).__entity = entity;
        }
      }
    }
    return {
      cursor: cursor === since ? since : cursor,
      changes: changes.map((row) => ({
        entity: (row as Row & { __entity?: string }).__entity ?? 'unknown',
        row,
      })),
    };
  }
}
