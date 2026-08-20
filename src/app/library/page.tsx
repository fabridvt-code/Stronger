'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { searchExercises } from '@/domain/exercises/search';
import { MOVEMENT_PATTERNS, EQUIPMENT } from '@/domain/values/taxonomy';
import { humanize } from '@/lib/labels';
import type { Exercise } from '@/domain/types';

export default function LibraryPage() {
  const [q, setQ] = useState('');
  const [pattern, setPattern] = useState<string>('');
  const [equip, setEquip] = useState<string>('');

  const exercises = useLiveQuery(async () => {
    const rows = await db().exercises.toArray();
    return rows.filter((e) => !e.deletedAt);
  }, []);

  const results = useMemo(() => {
    if (!exercises) return [];
    let list: Exercise[] = searchExercises(q, exercises);
    if (pattern) list = list.filter((e) => e.movementPattern === pattern);
    if (equip) list = list.filter((e) => e.equipment.includes(equip as never));
    return list;
  }, [exercises, q, pattern, equip]);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Exercise Library</h1>
        <span className="chip">{exercises?.length ?? '…'} exercises</span>
      </header>

      <input
        className="input text-base"
        placeholder="Search name, muscle, equipment… (e.g. cable chest, panca)"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoComplete="off"
      />

      <div className="flex gap-2 overflow-x-auto pb-1">
        <select className="input max-w-[46%]" value={pattern} onChange={(e) => setPattern(e.target.value)}>
          <option value="">All patterns</option>
          {MOVEMENT_PATTERNS.map((p) => (
            <option key={p} value={p}>
              {humanize(p)}
            </option>
          ))}
        </select>
        <select className="input max-w-[46%]" value={equip} onChange={(e) => setEquip(e.target.value)}>
          <option value="">All equipment</option>
          {EQUIPMENT.map((eq) => (
            <option key={eq} value={eq}>
              {humanize(eq)}
            </option>
          ))}
        </select>
      </div>

      <p className="text-sm text-text-faint">{results.length} results</p>

      <ul className="space-y-2">
        {results.map((ex) => (
          <li key={ex.id}>
            <Link href={`/exercise/${ex.id}`} className="card block p-4 active:bg-base-elevated">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{ex.name}</span>
                <span className="chip">{humanize(ex.movementPattern)}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-1 text-xs text-text-muted">
                {ex.primaryMuscles.map((m) => (
                  <span key={m} className="rounded bg-brand/10 px-1.5 py-0.5 text-brand">
                    {humanize(m)}
                  </span>
                ))}
                {ex.equipment.map((e) => (
                  <span key={e} className="rounded bg-base-elevated px-1.5 py-0.5">
                    {humanize(e)}
                  </span>
                ))}
              </div>
            </Link>
          </li>
        ))}
        {results.length === 0 && (
          <li className="card p-6 text-center text-text-muted">No exercises match your search.</li>
        )}
      </ul>
    </div>
  );
}
