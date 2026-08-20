'use client';

import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { searchExercises } from '@/domain/exercises/search';
import { humanize } from '@/lib/labels';

/** A bottom-sheet exercise picker used by the builder and the "swap" flow. */
export function ExercisePicker({
  onPick,
  onClose,
  title = 'Add exercise',
}: {
  onPick: (exerciseId: string) => void;
  onClose: () => void;
  title?: string;
}) {
  const [q, setQ] = useState('');
  const library = useLiveQuery(async () => (await db().exercises.toArray()).filter((e) => !e.deletedAt), []);
  const results = useMemo(() => (library ? searchExercises(q, library).slice(0, 40) : []), [library, q]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60" onClick={onClose}>
      <div
        className="max-h-[80vh] rounded-t-3xl border-t border-base-border bg-base-surface p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button className="text-text-muted" onClick={onClose}>
            ✕
          </button>
        </div>
        <input
          className="input mb-3"
          placeholder="Search exercises…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
        <ul className="space-y-1 overflow-y-auto" style={{ maxHeight: '55vh' }}>
          {results.map((ex) => (
            <li key={ex.id}>
              <button
                className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left active:bg-base-elevated"
                onClick={() => onPick(ex.id)}
              >
                <span className="font-medium">{ex.name}</span>
                <span className="chip">{humanize(ex.movementPattern)}</span>
              </button>
            </li>
          ))}
          {results.length === 0 && (
            <li className="py-6 text-center text-sm text-text-muted">No matches.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
