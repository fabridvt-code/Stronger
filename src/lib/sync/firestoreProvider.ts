/**
 * Firestore sync adapter (spec §5). Implements the same SyncProvider interface the
 * MemoryProvider does, so the engine and UI are unchanged.
 *
 * Layout: users/{uid}/documents/{id}. One subcollection per user makes the security
 * rules trivial (see firestore.rules) and needs no userId field on each doc. Using
 * the row id as the document id makes writes naturally idempotent — a performed set
 * can never be duplicated.
 */

import {
  collection,
  doc,
  getDocs,
  limit as fbLimit,
  orderBy,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import type { FirebaseHandles } from '../firebase';
import type { Row } from './conflict';
import type { PullResult, PushResult, SyncProvider } from './types';
import type { SyncOperation } from '../db';

const BATCH_LIMIT = 400; // Firestore hard limit is 500 writes per batch
const PULL_PAGE = 500;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export class FirestoreProvider implements SyncProvider {
  constructor(private readonly fb: FirebaseHandles) {}

  private uid(): string | null {
    return this.fb.auth.currentUser?.uid ?? null;
  }

  async push(ops: SyncOperation[]): Promise<PushResult> {
    const uid = this.uid();
    if (!uid) return { acceptedOpIds: [], failed: ops.map((o) => ({ opId: o.id, error: 'Not signed in.' })) };

    const acceptedOpIds: string[] = [];
    const failed: { opId: string; error: string }[] = [];

    for (const group of chunk(ops, BATCH_LIMIT)) {
      const batch = writeBatch(this.fb.db);
      for (const op of group) {
        const row = op.payload as Row;
        const ref = doc(this.fb.db, 'users', uid, 'documents', op.entityId);
        batch.set(ref, {
          entity: op.entity,
          updatedAt: Number(row.updatedAt ?? Date.now()),
          deletedAt: (row.deletedAt as number | null) ?? null,
          clientEventId: (row.clientEventId as string | undefined) ?? null,
          doc: row,
        });
      }
      try {
        await batch.commit();
        for (const op of group) acceptedOpIds.push(op.id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Firestore write failed.';
        for (const op of group) failed.push({ opId: op.id, error: msg });
      }
    }
    return { acceptedOpIds, failed };
  }

  async pull(since: number): Promise<PullResult> {
    const uid = this.uid();
    if (!uid) return { changes: [], cursor: since };

    const q = query(
      collection(this.fb.db, 'users', uid, 'documents'),
      where('updatedAt', '>', since),
      orderBy('updatedAt', 'asc'),
      fbLimit(PULL_PAGE),
    );

    let snap;
    try {
      snap = await getDocs(q);
    } catch {
      return { changes: [], cursor: since };
    }

    let cursor = since;
    const changes = snap.docs.map((d) => {
      const data = d.data() as { entity: string; updatedAt: number; doc: Row };
      cursor = Math.max(cursor, data.updatedAt);
      return { entity: data.entity, row: data.doc };
    });
    return { changes, cursor };
  }
}
