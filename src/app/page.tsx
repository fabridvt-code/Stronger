'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { LOCAL_USER_ID } from '@/lib/repo';
import { startSession } from '@/lib/session';
import { workoutView } from '@/lib/queries';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function DashboardPage() {
  const router = useRouter();
  const today = new Date().getDay();

  const data = useLiveQuery(async () => {
    const database = db();
    const [exercises, programs, sessions, pending, activeProgram] = await Promise.all([
      database.exercises.count(),
      database.programs.where('userId').equals(LOCAL_USER_ID).count(),
      database.sessions.where('userId').equals(LOCAL_USER_ID).toArray(),
      database.syncQueue.where('status').equals('pending').count(),
      (async () => {
        const rows = await database.programs.where('userId').equals(LOCAL_USER_ID).toArray();
        return rows.find((p) => p.status === 'active' && !p.deletedAt);
      })(),
    ]);

    let todayWorkout = undefined;
    let todayExerciseCount = 0;

    if (activeProgram) {
      const phases = (await database.phases.where('programId').equals(activeProgram.id).toArray()).filter(
        (p) => !p.deletedAt,
      );
      const weeks = phases.length
        ? (await database.weeks.where('phaseId').anyOf(phases.map((p) => p.id)).toArray()).filter(
            (w) => !w.deletedAt,
          )
        : [];
      const workouts = weeks.length
        ? (await database.workouts.where('weekId').anyOf(weeks.map((w) => w.id)).toArray()).filter(
            (w) => !w.deletedAt,
          )
        : [];

      todayWorkout =
        workouts.find((w) => w.dayOfWeek === today) ??
        workouts.sort((a, b) => a.order - b.order)[0];

      if (todayWorkout) {
        todayExerciseCount = (await database.workoutExercises.where('workoutId').equals(todayWorkout.id).toArray()).filter(
          (w) => !w.deletedAt,
        ).length;
      }
    }

    const completed = sessions
      .filter((s) => s.status === 'completed' && !s.deletedAt)
      .sort((a, b) => (b.finishedAt ?? b.updatedAt) - (a.finishedAt ?? a.updatedAt));
    const lastSession = completed[0];
    const lastWorkout = lastSession ? await database.workouts.get(lastSession.workoutId) : undefined;

    return {
      exercises,
      programs,
      sessions: completed.length,
      pending,
      activeProgram,
      todayWorkout,
      todayExerciseCount,
      lastSession,
      lastWorkout,
    };
  }, [today]);

  async function beginWorkout() {
    if (!data?.todayWorkout || !data.activeProgram) return;
    const session = await startSession(data.todayWorkout, data.activeProgram.id);
    router.push(`/session/${session.id}`);
  }

  if (!data) return <p className="text-text-muted">Loading…</p>;

  const hasWorkout = Boolean(data.todayWorkout && data.activeProgram);
  const lastDate = data.lastSession?.finishedAt
    ? new Date(data.lastSession.finishedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
    : null;

  return (
    <div className="space-y-5 pb-6">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand">{DAY_NAMES[today]}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Stronger</h1>
        </div>
        <Link href="/settings" className="chip" aria-label="Settings">Settings</Link>
      </header>

      <section className="overflow-hidden rounded-3xl border border-base-border bg-base-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-text-faint">Today</p>
            <h2 className="mt-1 text-2xl font-bold">{hasWorkout ? data.todayWorkout!.name : 'Rest day'}</h2>
            {hasWorkout ? (
              <p className="mt-1 text-sm text-text-muted">
                {data.todayExerciseCount} {data.todayExerciseCount === 1 ? 'exercise' : 'exercises'} · {data.activeProgram!.name}
              </p>
            ) : (
              <p className="mt-1 text-sm text-text-muted">
                {data.activeProgram ? 'No workout is scheduled for today.' : 'Activate a program to start training.'}
              </p>
            )}
          </div>
          {hasWorkout && <span className="chip bg-accent/10 text-accent">Ready</span>}
        </div>

        {hasWorkout ? (
          <button className="btn-primary mt-5 w-full py-4 text-base" onClick={beginWorkout}>
            Start workout
          </button>
        ) : (
          <Link href="/programs" className="btn-ghost mt-5 w-full">
            {data.activeProgram ? 'View program' : 'Choose a program'}
          </Link>
        )}
      </section>

      {data.lastSession && (
        <section className="card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-faint">Last workout</p>
              <h2 className="mt-1 font-semibold">{data.lastWorkout?.name ?? 'Workout'}</h2>
            </div>
            {lastDate && <span className="text-xs text-text-faint">{lastDate}</span>}
          </div>
          <Link href={`/session/${data.lastSession.id}/summary`} className="btn-ghost mt-3 w-full">
            View summary
          </Link>
        </section>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Your training</h2>
          <Link href="/progress" className="text-xs font-semibold text-brand">View progress</Link>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Sessions" value={data.sessions} />
          <Stat label="Programs" value={data.programs} />
          <Stat label="Exercises" value={data.exercises} />
        </div>
      </section>

      <section className="card flex items-center justify-between gap-3 p-3 text-xs">
        <div>
          <p className="font-medium">Local-first</p>
          <p className="text-text-faint">Your data works offline.</p>
        </div>
        <span className="chip">{data.pending} pending sync</span>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-3">
      <span className="block text-2xl font-bold tabular-nums">{value}</span>
      <span className="text-xs text-text-faint">{label}</span>
    </div>
  );
}
