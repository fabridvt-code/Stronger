'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { workoutView } from '@/lib/queries';
import {
  addExercise,
  deleteWorkoutExercise,
  reorderExercises,
  addSet,
  removeSet,
  updateSet,
} from '@/lib/builder';
import { ExercisePicker } from '@/components/ExercisePicker';
import { humanize } from '@/lib/labels';
import type { SetTemplate } from '@/domain/types';

export default function WorkoutBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [picking, setPicking] = useState(false);

  const workout = useLiveQuery(() => db().workouts.get(id), [id]);
  const views = useLiveQuery(() => workoutView(id), [id]);

  async function move(index: number, dir: -1 | 1) {
    if (!views) return;
    const ids = views.map((v) => v.workoutExercise.id);
    const target = index + dir;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    await reorderExercises(id, ids);
  }

  if (!workout) return <p className="text-text-muted">Loading…</p>;

  return (
    <div className="space-y-4">
      <Link href={`/program/${''}`} onClick={(e) => { e.preventDefault(); history.back(); }} className="text-sm text-brand">
        ← Back
      </Link>
      <h1 className="text-2xl font-bold">{workout.name}</h1>

      <ul className="space-y-3">
        {views?.map((v, i) => (
          <li key={v.workoutExercise.id} className="card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{v.exercise?.name ?? 'Unknown'}</p>
                <p className="text-xs text-text-faint">
                  {v.exercise ? humanize(v.exercise.movementPattern) : ''} · {v.sets.length} sets
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button className="btn-ghost px-2 text-sm" onClick={() => move(i, -1)} aria-label="Move up">
                  ↑
                </button>
                <button className="btn-ghost px-2 text-sm" onClick={() => move(i, 1)} aria-label="Move down">
                  ↓
                </button>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {v.sets.map((s) => (
                <SetRow key={s.id} set={s} />
              ))}
            </div>

            <div className="mt-2 flex gap-2">
              <button className="btn-ghost flex-1 text-sm" onClick={() => addSet(v.workoutExercise.id)}>
                + Set
              </button>
              <button
                className="btn-danger text-sm"
                onClick={() => {
                  if (confirm(`Remove ${v.exercise?.name}?`)) deleteWorkoutExercise(v.workoutExercise.id);
                }}
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>

      <button className="btn-primary w-full" onClick={() => setPicking(true)}>
        + Add exercise
      </button>

      {picking && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onPick={async (exerciseId) => {
            await addExercise(id, exerciseId);
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}

function SetRow({ set }: { set: SetTemplate }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-6 text-text-faint">#{set.setIndex}</span>
      <select
        className="input flex-1 py-1"
        value={set.setType}
        onChange={(e) => updateSet(set.id, { setType: e.target.value as SetTemplate['setType'] })}
      >
        <option value="warmup">Warm-up</option>
        <option value="working">Working</option>
        <option value="backoff">Back-off</option>
        <option value="dropset">Drop set</option>
        <option value="amrap">AMRAP</option>
      </select>
      <NumberField
        value={set.repMin}
        placeholder="min"
        onCommit={(n) => updateSet(set.id, { repMin: n })}
      />
      <span className="text-text-faint">–</span>
      <NumberField
        value={set.repMax}
        placeholder="max"
        onCommit={(n) => updateSet(set.id, { repMax: n })}
      />
      <span className="text-xs text-text-faint">reps</span>
      <NumberField
        value={set.targetRir}
        placeholder="RIR"
        onCommit={(n) => updateSet(set.id, { targetRir: n })}
      />
      <button className="text-danger" onClick={() => removeSet(set.id)} aria-label="Delete set">
        ✕
      </button>
    </div>
  );
}

function NumberField({
  value,
  placeholder,
  onCommit,
}: {
  value: number | null;
  placeholder: string;
  onCommit: (n: number | null) => void;
}) {
  return (
    <input
      type="number"
      className="input w-14 py-1 text-center"
      placeholder={placeholder}
      defaultValue={value ?? ''}
      onBlur={(e) => {
        const raw = e.target.value.trim();
        onCommit(raw === '' ? null : Number(raw));
      }}
    />
  );
}
