'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { firstWeek, addWorkout, activateProgram, deleteWorkout } from '@/lib/builder';
import { startSession } from '@/lib/session';
import { workoutsForProgram, workoutView } from '@/lib/queries';

export default function ProgramEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [newDay, setNewDay] = useState('');

  const program = useLiveQuery(() => db().programs.get(id), [id]);
  const workouts = useLiveQuery(() => workoutsForProgram(id), [id]);

  async function handleAddDay() {
    const week = await firstWeek(id);
    if (!week) return;
    await addWorkout(week.id, newDay);
    setNewDay('');
  }

  async function handleStart(workoutId: string) {
    const workout = await db().workouts.get(workoutId);
    if (!workout) return;
    const session = await startSession(workout, id);
    router.push(`/session/${session.id}`);
  }

  if (!program) return <p className="text-text-muted">Loading…</p>;

  return (
    <div className="space-y-4">
      <Link href="/programs" className="text-sm text-brand">
        ← Programs
      </Link>

      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{program.name}</h1>
          <span className="chip mt-1">{program.status}</span>
        </div>
        {program.status !== 'active' && (
          <button
            className="btn-primary text-sm"
            onClick={() => activateProgram(id)}
          >
            Activate
          </button>
        )}
      </header>

      <section className="space-y-2">
        <h2 className="label">Training days</h2>
        {workouts && workouts.length > 0 ? (
          <ul className="space-y-2">
            {workouts.map((w) => (
              <WorkoutRow key={w.id} workoutId={w.id} name={w.name} onStart={() => handleStart(w.id)} />
            ))}
          </ul>
        ) : (
          <p className="card p-4 text-sm text-text-muted">
            No days yet. Add a training day, then build it with exercises.
          </p>
        )}
      </section>

      <div className="card space-y-2 p-4">
        <input
          className="input"
          placeholder="Add day (e.g. Push, Lower A)"
          value={newDay}
          onChange={(e) => setNewDay(e.target.value)}
        />
        <button className="btn-ghost w-full" onClick={handleAddDay}>
          + Add training day
        </button>
      </div>
    </div>
  );
}

function WorkoutRow({
  workoutId,
  name,
  onStart,
}: {
  workoutId: string;
  name: string;
  onStart: () => void;
}) {
  const views = useLiveQuery(() => workoutView(workoutId), [workoutId]);
  const count = views?.length ?? 0;

  return (
    <li className="card p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold">{name}</p>
          <p className="text-xs text-text-faint">{count} exercise{count === 1 ? '' : 's'}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/workout/${workoutId}/edit`} className="btn-ghost text-sm">
            Edit
          </Link>
          <button
            className="btn-primary text-sm disabled:opacity-40"
            disabled={count === 0}
            onClick={onStart}
          >
            Start
          </button>
        </div>
      </div>
      <button
        className="mt-2 text-xs text-danger"
        onClick={() => {
          if (confirm(`Delete "${name}"?`)) deleteWorkout(workoutId);
        }}
      >
        Delete day
      </button>
    </li>
  );
}
