/**
 * Offline + synchronization integration tests (spec §35). Runs the real Dexie DB
 * on fake-indexeddb, exercising the repository → queue → engine → provider path.
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '../db';
import { create, update } from '../repo';
import { runSync } from './engine';
import { MemoryProvider } from './memoryProvider';
import type { Program } from '@/domain/types';

function setOnline(online: boolean) {
  vi.stubGlobal('navigator', { onLine: online });
}

async function clearAll() {
  await Promise.all(db().tables.map((t) => t.clear()));
}

beforeEach(async () => {
  setOnline(true);
  await clearAll();
});

describe('offline persistence + queue', () => {
  it('writes locally and queues a sync op while offline', async () => {
    setOnline(false);
    const program = await create<Program>('programs', {
      userId: 'u', name: 'Offline Program', status: 'draft', effortSystem: 'rir',
    });

    // Data is durable locally without any network.
    expect(await db().programs.get(program.id)).toBeTruthy();
    expect(await db().syncQueue.where('status').equals('pending').count()).toBe(1);

    // Sync does nothing while offline.
    const report = await runSync(new MemoryProvider());
    expect(report.skippedOffline).toBe(true);
    expect(await db().syncQueue.where('status').equals('pending').count()).toBe(1);
  });
});

describe('reconnection + push', () => {
  it('pushes queued ops to the provider and marks them done', async () => {
    const provider = new MemoryProvider();
    const program = await create<Program>('programs', {
      userId: 'u', name: 'P', status: 'draft', effortSystem: 'rir',
    });

    const report = await runSync(provider);
    expect(report.pushed).toBe(1);
    expect(provider.rowCount('programs')).toBe(1);
    expect(await db().syncQueue.where('status').equals('done').count()).toBe(1);
    // Idempotent re-run: nothing left to push.
    const second = await runSync(provider);
    expect(second.pushed).toBe(0);
    expect(provider.rowCount('programs')).toBe(1);
    expect(program.id).toBeTruthy();
  });
});

describe('duplicate prevention (idempotency)', () => {
  it('does not create a duplicate performed set when the same op is retried', async () => {
    const provider = new MemoryProvider();
    const set = await create('completedSets', {
      sessionId: 's', workoutExerciseId: 'we', exerciseId: 'ex_bench_press',
      setTemplateId: null, setIndex: 1, setType: 'working', actualLoad: 80,
      actualReps: 8, actualRir: 2, actualRpe: null, unit: 'kg',
      completedAt: Date.now(), clientEventId: 'evt-123',
    } as never);
    expect(set).toBeTruthy();

    await runSync(provider);
    expect(provider.rowCount('completedSets')).toBe(1);

    // Simulate a retry of the same operation (e.g. flaky network re-queued it).
    const ops = await db().syncQueue.toArray();
    await db().syncQueue.update(ops[0]!.id, { status: 'pending' });
    await runSync(provider);

    // Still exactly one — clientEventId guarded the duplicate.
    expect(provider.rowCount('completedSets')).toBe(1);
  });
});

describe('pull from another device', () => {
  it('merges a remote row into the local store', async () => {
    const provider = new MemoryProvider();
    const t = Date.now();
    provider.seed('programs', {
      id: 'remote-1', userId: 'u', name: 'From Phone', status: 'active', effortSystem: 'rir',
      createdAt: t, updatedAt: t, deletedAt: null, version: 1,
    } as never);

    const report = await runSync(provider);
    expect(report.pulled).toBe(1);
    const local = await db().programs.get('remote-1');
    expect(local?.name).toBe('From Phone');
  });
});

describe('conflict resolution (last-writer-wins by updatedAt)', () => {
  it('remote wins when it is newer and flags the conflict', async () => {
    const provider = new MemoryProvider();
    const program = await create<Program>('programs', {
      userId: 'u', name: 'Local Name', status: 'draft', effortSystem: 'rir',
    });
    // Another device edited the same row later.
    provider.seed('programs', {
      ...program, name: 'Remote Name', updatedAt: program.updatedAt + 5000, version: program.version + 1,
    } as never);

    const report = await runSync(provider);
    expect(report.conflicts).toBeGreaterThanOrEqual(1);
    const local = await db().programs.get(program.id);
    expect(local?.name).toBe('Remote Name');
  });

  it('local wins when it is newer', async () => {
    const provider = new MemoryProvider();
    const program = await create<Program>('programs', {
      userId: 'u', name: 'Local Name', status: 'draft', effortSystem: 'rir',
    });
    // Stale remote copy.
    provider.seed('programs', {
      ...program, name: 'Old Remote', updatedAt: program.updatedAt - 5000,
    } as never);
    // Make a newer local edit.
    await update<Program>('programs', program.id, { name: 'Newer Local' });

    await runSync(provider);
    const local = await db().programs.get(program.id);
    expect(local?.name).toBe('Newer Local');
  });
});
