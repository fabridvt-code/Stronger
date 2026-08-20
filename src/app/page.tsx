'use client';

import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { LOCAL_USER_ID } from '@/lib/repo';

export default function DashboardPage() {
  const stats = useLiveQuery(async () => {
    const [exercises, programs, sessions, pending] = await Promise.all([
      db().exercises.count(),
      db().programs.where('userId').equals(LOCAL_USER_ID).count(),
      db().sessions.where('userId').equals(LOCAL_USER_ID).count(),
      db().syncQueue.where('status').equals('pending').count(),
    ]);
    return { exercises, programs, sessions, pending };
  }, []);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Stronger</h1>
        <p className="text-sm text-text-muted">Local-first training tracker — works fully offline.</p>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Exercises" value={stats?.exercises} />
        <Stat label="Programs" value={stats?.programs} />
        <Stat label="Sessions" value={stats?.sessions} />
      </div>

      <section className="card p-4">
        <h2 className="mb-1 font-semibold">Today</h2>
        <p className="text-sm text-text-muted">
          No active workout scheduled. Create a program or browse your library to get started.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/programs" className="btn-primary">Programs</Link>
          <Link href="/library" className="btn-ghost">Browse Library</Link>
        </div>
      </section>

      <section className="card p-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-text-muted">Local data</span>
          <span className="chip">{stats?.pending ?? 0} changes pending sync</span>
        </div>
        <p className="mt-2 text-xs text-text-faint">
          All your data lives on this device (IndexedDB). Cloud sync arrives in a later stage; your
          changes are already queued and safe.
        </p>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="card flex flex-col items-center p-3">
      <span className="text-2xl font-bold tabular-nums">{value ?? '—'}</span>
      <span className="text-xs text-text-faint">{label}</span>
    </div>
  );
}
