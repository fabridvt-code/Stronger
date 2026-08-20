'use client';

import { use, useMemo, useState } from 'react';
import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { findAlternatives, toPercent } from '@/domain/substitution/engine';
import { exerciseHistory } from '@/lib/queries';
import { humanize, repRangeLabel } from '@/lib/labels';
import { formatLoad } from '@/domain/values/load';
import { estimate1RM, roundE1RM } from '@/domain/analytics/metrics';
import { EQUIPMENT } from '@/domain/values/taxonomy';

export default function ExerciseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [availOnly, setAvailOnly] = useState<string[]>([]);
  const [showAlts, setShowAlts] = useState(false);

  const exercise = useLiveQuery(() => db().exercises.get(id), [id]);
  const library = useLiveQuery(async () => (await db().exercises.toArray()).filter((e) => !e.deletedAt), []);
  const history = useLiveQuery(() => exerciseHistory(id), [id]);

  const alternatives = useMemo(() => {
    if (!exercise || !library) return [];
    return findAlternatives(exercise, library, {
      availableEquipment: availOnly.length ? (availOnly as never) : undefined,
    });
  }, [exercise, library, availOnly]);

  if (!exercise) return <p className="text-text-muted">Loading…</p>;

  const bestE1rm = history?.reduce<number | null>((best, s) => {
    const e = estimate1RM(s.actualLoad, s.actualReps);
    return e != null && (best == null || e > best) ? e : best;
  }, null);

  return (
    <div className="space-y-5">
      <Link href="/library" className="text-sm text-brand">
        ← Library
      </Link>

      <header>
        <h1 className="text-2xl font-bold">{exercise.name}</h1>
        {exercise.aliases.length > 0 && (
          <p className="text-sm text-text-faint">also: {exercise.aliases.join(', ')}</p>
        )}
      </header>

      <section className="card grid grid-cols-2 gap-3 p-4 text-sm">
        <Fact label="Movement" value={humanize(exercise.movementPattern)} />
        <Fact label="Category" value={humanize(exercise.category)} />
        <Fact label="Primary" value={exercise.primaryMuscles.map(humanize).join(', ')} />
        <Fact label="Secondary" value={exercise.secondaryMuscles.map(humanize).join(', ') || '—'} />
        <Fact label="Equipment" value={exercise.equipment.map(humanize).join(', ')} />
        <Fact label="Difficulty" value={humanize(exercise.difficulty)} />
        <Fact label="Default reps" value={repRangeLabel(exercise.defaultRepRange.min, exercise.defaultRepRange.max)} />
        <Fact label="Default rest" value={`${exercise.defaultRestSec}s`} />
      </section>

      {/* Alternatives — spec §11/§12 core feature */}
      <section className="space-y-3">
        <button className="btn-ghost w-full" onClick={() => setShowAlts((s) => !s)}>
          {showAlts ? 'Hide alternatives' : "Can't perform this? Show alternatives"}
        </button>

        {showAlts && (
          <>
            <div>
              <p className="label mb-1">Filter by available equipment</p>
              <div className="flex flex-wrap gap-1.5">
                {EQUIPMENT.map((eq) => {
                  const on = availOnly.includes(eq);
                  return (
                    <button
                      key={eq}
                      onClick={() =>
                        setAvailOnly((prev) => (on ? prev.filter((e) => e !== eq) : [...prev, eq]))
                      }
                      className={`rounded-full px-2.5 py-1 text-xs ${
                        on ? 'bg-brand text-white' : 'bg-base-elevated text-text-muted'
                      }`}
                    >
                      {humanize(eq)}
                    </button>
                  );
                })}
              </div>
              {availOnly.length > 0 && (
                <button className="mt-2 text-xs text-brand" onClick={() => setAvailOnly([])}>
                  Clear filter
                </button>
              )}
            </div>

            <ul className="space-y-2">
              {alternatives.map((alt) => (
                <li key={alt.exercise.id} className="card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/exercise/${alt.exercise.id}`} className="font-semibold">
                      {alt.exercise.name}
                    </Link>
                    <span className="rounded-lg bg-accent/15 px-2 py-1 text-sm font-bold text-accent">
                      {toPercent(alt.score)}%
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-text-muted">{alt.reason}</p>
                  <div className="mt-2 grid grid-cols-5 gap-1 text-center text-[10px] text-text-faint">
                    <Bar label="Move" v={alt.breakdown.movementPattern} />
                    <Bar label="Musc" v={alt.breakdown.muscle} />
                    <Bar label="Equip" v={alt.breakdown.equipment} />
                    <Bar label="Stab" v={alt.breakdown.stability} />
                    <Bar label="ROM" v={alt.breakdown.rom} />
                  </div>
                </li>
              ))}
              {alternatives.length === 0 && (
                <li className="card p-4 text-center text-sm text-text-muted">
                  No close alternatives with the current equipment filter.
                </li>
              )}
            </ul>
          </>
        )}
      </section>

      {/* History — spec §21 */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">History</h2>
        {bestE1rm != null && (
          <p className="text-sm text-text-muted">
            Best estimated 1RM: <span className="font-semibold text-text">{roundE1RM(bestE1rm)}</span>
          </p>
        )}
        {history && history.length > 0 ? (
          <ul className="space-y-1 text-sm">
            {history.slice(0, 12).map((s) => (
              <li key={s.id} className="flex justify-between border-b border-base-border/50 py-1.5">
                <span>{formatLoad(s.actualLoad, s.unit)} × {s.actualReps ?? '—'}</span>
                <span className="text-text-faint">
                  {s.actualRir != null ? `RIR ${s.actualRir}` : ''}{' '}
                  {new Date(s.completedAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-faint">No logged sets yet. History appears once you train this exercise.</p>
        )}
      </section>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="label">{label}</p>
      <p className="text-text">{value}</p>
    </div>
  );
}

function Bar({ label, v }: { label: string; v: number }) {
  return (
    <div>
      <div className="mb-0.5 h-1 overflow-hidden rounded bg-base-elevated">
        <div className="h-full bg-brand" style={{ width: `${Math.round(v * 100)}%` }} />
      </div>
      {label}
    </div>
  );
}
