'use client';

import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { db } from '@/lib/db';
import { LOCAL_USER_ID } from '@/lib/repo';
import { historyBySession, roundE1RM } from '@/domain/analytics/metrics';
import { setsPerMuscle, weeklyConsistency } from '@/domain/analytics/volume';
import { humanize } from '@/lib/labels';
import type { CompletedSet, Exercise } from '@/domain/types';

const AXIS = { fontSize: 11, fill: '#5f6b7c' };

export default function ProgressPage() {
  const data = useLiveQuery(async () => {
    const sessions = (await db().sessions.where('userId').equals(LOCAL_USER_ID).toArray()).filter(
      (s) => !s.deletedAt,
    );
    const sets = (await db().completedSets.toArray()).filter((s) => !s.deletedAt);
    const exercises = await db().exercises.toArray();
    const prs = await db().personalRecords.where('userId').equals(LOCAL_USER_ID).count();
    return { sessions, sets, exercises, prs };
  }, []);

  const [exerciseId, setExerciseId] = useState<string>('');

  const derived = useMemo(() => {
    if (!data) return null;
    const sessionStart = new Map(data.sessions.map((s) => [s.id, s.startedAt]));
    const exById = new Map<string, Exercise>(data.exercises.map((e) => [e.id, e]));
    const window30 = Date.now() - 30 * 864e5;
    const recentSets = data.sets.filter((s) => (sessionStart.get(s.sessionId) ?? s.completedAt) >= window30);

    const muscle = setsPerMuscle(recentSets, exById).slice(0, 10).map((m) => ({
      name: humanize(m.muscle),
      sets: m.sets,
    }));
    const weekly = weeklyConsistency(data.sets, sessionStart).map((w) => ({
      name: w.week.replace(/^\d+-/, ''),
      sessions: w.sessions,
    }));

    // Exercises that actually have logged history, for the strength selector.
    const withHistory = [...new Set(data.sets.map((s) => s.exerciseId))]
      .map((id) => exById.get(id))
      .filter((e): e is Exercise => !!e)
      .sort((a, b) => a.name.localeCompare(b.name));

    const completed = data.sessions.filter((s) => s.status === 'completed').length;
    return { sessionStart, exById, muscle, weekly, withHistory, completed };
  }, [data]);

  const strengthSeries = useMemo(() => {
    if (!data || !derived) return [];
    const id = exerciseId || derived.withHistory[0]?.id;
    if (!id) return [];
    const sets: CompletedSet[] = data.sets.filter((s) => s.exerciseId === id);
    return historyBySession(sets, derived.sessionStart)
      .filter((p) => p.e1rm != null)
      .map((p) => ({ date: new Date(p.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), e1rm: roundE1RM(p.e1rm!) }));
  }, [data, derived, exerciseId]);

  if (!data || !derived) return <p className="text-text-muted">Loading…</p>;
  const activeExerciseId = exerciseId || derived.withHistory[0]?.id || '';

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Progress</h1>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Workouts completed" value={derived.completed} />
        <Stat label="Sets logged" value={data.sets.length} />
        <Stat label="Sessions" value={data.sessions.length} />
        <Stat label="Personal records" value={data.prs} />
      </div>

      {data.sets.length === 0 ? (
        <div className="card p-6 text-center text-sm text-text-muted">
          Charts populate as you train. Log a workout to see strength, volume, and consistency trends.
        </div>
      ) : (
        <>
          {/* Strength — estimated 1RM trend */}
          <section className="card p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="font-semibold">Estimated 1RM</h2>
              <select
                className="input max-w-[55%] py-1 text-sm"
                value={activeExerciseId}
                onChange={(e) => setExerciseId(e.target.value)}
              >
                {derived.withHistory.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name}
                  </option>
                ))}
              </select>
            </div>
            {strengthSeries.length > 1 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={strengthSeries} margin={{ top: 5, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a333f" />
                  <XAxis dataKey="date" tick={AXIS} />
                  <YAxis tick={AXIS} domain={['auto', 'auto']} />
                  <Tooltip contentStyle={{ background: '#1c232f', border: '1px solid #2a333f', borderRadius: 12, color: '#e8edf5' }} />
                  <Line type="monotone" dataKey="e1rm" stroke="#4f8cff" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-8 text-center text-sm text-text-faint">
                Need at least two sessions of this exercise to draw a trend.
              </p>
            )}
          </section>

          {/* Volume — weighted sets per muscle, last 30 days */}
          <section className="card p-4">
            <h2 className="mb-2 font-semibold">Sets per muscle · last 30 days</h2>
            <ResponsiveContainer width="100%" height={Math.max(160, derived.muscle.length * 28)}>
              <BarChart data={derived.muscle} layout="vertical" margin={{ top: 0, right: 12, bottom: 0, left: 20 }}>
                <XAxis type="number" tick={AXIS} />
                <YAxis type="category" dataKey="name" tick={AXIS} width={80} />
                <Tooltip contentStyle={{ background: '#1c232f', border: '1px solid #2a333f', borderRadius: 12, color: '#e8edf5' }} cursor={{ fill: '#ffffff10' }} />
                <Bar dataKey="sets" fill="#22d3a6" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>

          {/* Consistency — sessions per week */}
          <section className="card p-4">
            <h2 className="mb-2 font-semibold">Sessions per week</h2>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={derived.weekly} margin={{ top: 5, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a333f" vertical={false} />
                <XAxis dataKey="name" tick={AXIS} />
                <YAxis tick={AXIS} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#1c232f', border: '1px solid #2a333f', borderRadius: 12, color: '#e8edf5' }} cursor={{ fill: '#ffffff10' }} />
                <Bar dataKey="sessions" fill="#4f8cff" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="card flex flex-col items-center p-4">
      <span className="text-3xl font-bold tabular-nums">{value ?? '—'}</span>
      <span className="mt-1 text-center text-xs text-text-faint">{label}</span>
    </div>
  );
}
