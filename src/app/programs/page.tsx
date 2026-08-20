'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { LOCAL_USER_ID } from '@/lib/repo';
import { createProgram } from '@/lib/builder';
import { humanize } from '@/lib/labels';

export default function ProgramsPage() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const programs = useLiveQuery(async () => {
    const rows = await db().programs.where('userId').equals(LOCAL_USER_ID).toArray();
    return rows.filter((p) => !p.deletedAt).sort((a, b) => b.updatedAt - a.updatedAt);
  }, []);

  async function handleCreate() {
    const program = await createProgram(name || 'New Program');
    router.push(`/program/${program.id}`);
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Programs</h1>
        <Link href="/import" className="btn-ghost text-sm">
          ✨ Import
        </Link>
      </header>

      {creating ? (
        <div className="card space-y-2 p-4">
          <input
            className="input"
            placeholder="Program name (e.g. Upper/Lower 4-day)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <div className="flex gap-2">
            <button className="btn-primary flex-1" onClick={handleCreate}>
              Create
            </button>
            <button className="btn-ghost" onClick={() => setCreating(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button className="btn-primary w-full" onClick={() => setCreating(true)}>
          + New Program
        </button>
      )}

      {programs && programs.length > 0 ? (
        <ul className="space-y-2">
          {programs.map((p) => (
            <li key={p.id}>
              <Link href={`/program/${p.id}`} className="card block p-4 active:bg-base-elevated">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{p.name}</span>
                  <span
                    className={`chip ${p.status === 'active' ? 'bg-accent/15 text-accent' : ''}`}
                  >
                    {humanize(p.status)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="card p-6 text-center text-sm text-text-muted">
          No programs yet. Create one manually, or import a plan from your coach.
        </p>
      )}
    </div>
  );
}
