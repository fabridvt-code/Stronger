'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { db } from '@/lib/db';
import { recommendationsForWorkout, type ExerciseRecommendation } from '@/lib/session';
import { sessionSets } from '@/lib/queries';
import { formatLoad } from '@/domain/values/load';
import type { CompletedSet } from '@/domain/types';

export default function SummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [recs, setRecs] = useState<ExerciseRecommendation[] | null>(null);
  const [performed, setPerformed] = useState<Map<string, CompletedSet[]>>(new Map());

  useEffect(() => {
    (async () => {
      const session = await db().sessions.get(id);
      if (!session) return;
      const sets = await sessionSets(id);
      const byExercise = new Map<string, CompletedSet[]>();
      for (const s of sets) {
        const arr = byExercise.get(s.exerciseId) ?? [];
        arr.push(s);
        byExercise.set(s.exerciseId, arr);
      }
      setPerformed(byExercise);
      setRecs(await recommendationsForWorkout(session.workoutId));
    })();
  }, [id]);

  return (
    <div className="space-y-4">
      <header className="text-center">
        <div className="text-4xl">💪</div>
        <h1 className="mt-1 text-2xl font-bold">Workout complete</h1>
        <p className="text-sm text-text-muted">Here's what to aim for next time.</p>
      </header>

      {recs === null ? (
        <p className="text-center text-text-muted">Calculating recommendations…</p>
      ) : recs.length === 0 ? (
        <p className="card p-4 text-center text-text-muted">No exercises recorded.</p>
      ) : (
        <ul className="space-y-3">
          {recs.map((r) => {
            const perf = performed.get(r.exerciseId) ?? [];
            const rec = r.result;
            return (
              <li key={r.workoutExerciseId} className="card p-4">
                <h2 className="font-bold">{r.exerciseName}</h2>

                <div className="mt-2 grid grid-cols-1 gap-2 text-sm">
                  <Row label="Performed" tone="muted">
                    {perf.length > 0
                      ? perf
                          .filter((s) => s.setType !== 'warmup')
                          .map((s) => `${formatLoad(s.actualLoad, s.unit)}×${s.actualReps ?? '—'}`)
                          .join('  ')
                      : '—'}
                  </Row>
                  <Row label="Recommended" tone="accent">
                    <span className="font-semibold">
                      {rec.recommendedLoad != null ? formatLoad(rec.recommendedLoad, 'kg') : 'Keep load'}
                      {rec.recommendedReps
                        ? ` · ${rec.recommendedReps.min}${rec.recommendedReps.max !== rec.recommendedReps.min ? `–${rec.recommendedReps.max}` : ''} reps`
                        : ''}
                    </span>
                  </Row>
                </div>

                <p className="mt-2 rounded-lg bg-base-elevated p-2 text-xs text-text-muted">{rec.rationale}</p>
                {rec.flags.map((f, i) => (
                  <p key={i} className="mt-1 text-xs text-warn">
                    ⚠ {f}
                  </p>
                ))}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex gap-2">
        <Link href="/programs" className="btn-ghost flex-1">
          Programs
        </Link>
        <Link href="/progress" className="btn-primary flex-1">
          View progress
        </Link>
      </div>
      <p className="text-center text-xs text-text-faint">
        Recommendations are conservative suggestions derived from your history — always yours to override.
      </p>
    </div>
  );
}

function Row({
  label,
  tone,
  children,
}: {
  label: string;
  tone: 'muted' | 'accent';
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className={`label ${tone === 'accent' ? 'text-accent' : ''}`}>{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}
