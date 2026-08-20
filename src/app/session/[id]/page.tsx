'use client';

import { use, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { workoutView, lastPerformed } from '@/lib/queries';
import { LOCAL_USER_ID } from '@/lib/repo';
import { logSet, finishSession, abandonSession } from '@/lib/session';
import { RestTimer } from '@/components/RestTimer';
import { repRangeLabel } from '@/lib/labels';
import { formatLoad } from '@/domain/values/load';
import type { CompletedSet, SetTemplate, WorkoutExercise } from '@/domain/types';

interface Draft {
  load: string;
  reps: string;
  effort: string;
}

export default function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [rest, setRest] = useState<{ seconds: number } | null>(null);

  const session = useLiveQuery(() => db().sessions.get(id), [id]);
  const prefs = useLiveQuery(() => db().preferences.get(LOCAL_USER_ID), []);
  const views = useLiveQuery(async () => {
    if (!session) return [];
    return workoutView(session.workoutId);
  }, [session?.workoutId]);
  const logged = useLiveQuery(async () => {
    const rows = await db().completedSets.where('sessionId').equals(id).toArray();
    return rows.filter((s) => !s.deletedAt);
  }, [id]);

  const loggedKey = useMemo(() => {
    const m = new Map<string, CompletedSet>();
    for (const s of logged ?? []) m.set(`${s.workoutExerciseId}:${s.setIndex}`, s);
    return m;
  }, [logged]);

  if (!session || !prefs) return <p className="text-text-muted">Loading…</p>;
  const effortSystem = prefs.effortSystem;

  function draftFor(key: string, seed: Draft): Draft {
    return drafts[key] ?? seed;
  }
  function setDraft(key: string, patch: Partial<Draft>, seed: Draft) {
    setDrafts((d) => ({ ...d, [key]: { ...draftFor(key, seed), ...patch } }));
  }

  async function handleLog(we: WorkoutExercise, exerciseId: string, set: SetTemplate, draft: Draft) {
    const load = draft.load === '' ? null : Number(draft.load);
    const reps = draft.reps === '' ? null : Number(draft.reps);
    const effort = draft.effort === '' ? null : Number(draft.effort);
    await logSet({
      sessionId: id,
      workoutExerciseId: we.id,
      exerciseId,
      setTemplateId: set.id,
      setIndex: set.setIndex,
      setType: set.setType,
      actualLoad: load,
      actualReps: reps,
      actualRir: effortSystem === 'rir' ? effort : null,
      actualRpe: effortSystem === 'rpe' ? effort : null,
      unit: prefs!.unit,
    });
    if (set.restSec) setRest({ seconds: set.restSec });
  }

  async function handleFinish() {
    await finishSession(id);
    router.replace(`/session/${id}/summary`);
  }

  const totalSets = views?.reduce((n, v) => n + v.sets.length, 0) ?? 0;
  const doneSets = logged?.length ?? 0;

  return (
    <div className="space-y-4 pb-24">
      <header className="sticky top-0 z-30 -mx-4 border-b border-base-border bg-base-bg/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">Workout</h1>
          <button
            className="text-xs text-text-faint"
            onClick={() => {
              if (confirm('Discard this session?')) {
                abandonSession(id).then(() => router.replace('/programs'));
              }
            }}
          >
            Discard
          </button>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded bg-base-border">
          <div className="h-full bg-accent" style={{ width: `${totalSets ? (doneSets / totalSets) * 100 : 0}%` }} />
        </div>
        <p className="mt-1 text-xs text-text-faint">
          {doneSets}/{totalSets} sets logged
        </p>
      </header>

      {views?.map((v) => (
        <ExerciseBlock
          key={v.workoutExercise.id}
          we={v.workoutExercise}
          exerciseName={v.exercise?.name ?? 'Exercise'}
          exerciseId={v.workoutExercise.exerciseId}
          sets={v.sets}
          effortSystem={effortSystem}
          unit={prefs.unit}
          loggedKey={loggedKey}
          draftFor={draftFor}
          setDraft={setDraft}
          onLog={handleLog}
        />
      ))}

      <button className="btn-primary w-full py-4 text-lg" onClick={handleFinish}>
        Finish workout
      </button>

      {rest && (
        <RestTimer
          seconds={rest.seconds}
          sound={prefs.restTimerSound}
          vibrate={prefs.restTimerVibrate}
          onDismiss={() => setRest(null)}
          onDone={() => setRest(null)}
        />
      )}
    </div>
  );
}

function ExerciseBlock({
  we,
  exerciseName,
  exerciseId,
  sets,
  effortSystem,
  unit,
  loggedKey,
  draftFor,
  setDraft,
  onLog,
}: {
  we: WorkoutExercise;
  exerciseName: string;
  exerciseId: string;
  sets: SetTemplate[];
  effortSystem: 'rir' | 'rpe';
  unit: 'kg' | 'lb';
  loggedKey: Map<string, CompletedSet>;
  draftFor: (key: string, seed: Draft) => Draft;
  setDraft: (key: string, patch: Partial<Draft>, seed: Draft) => void;
  onLog: (we: WorkoutExercise, exerciseId: string, set: SetTemplate, draft: Draft) => void;
}) {
  const last = useLiveQuery(() => lastPerformed(exerciseId), [exerciseId]);
  const working = sets.find((s) => s.setType === 'working') ?? sets[0];

  return (
    <section className="card p-4">
      <div className="mb-1 flex items-baseline justify-between">
        <h2 className="text-lg font-bold">{exerciseName}</h2>
        <span className="chip">
          {sets.length} × {repRangeLabel(working?.repMin ?? null, working?.repMax ?? null)}
          {working?.targetRir != null ? ` · RIR ${working.targetRir}` : ''}
        </span>
      </div>

      {last && last.length > 0 && (
        <p className="mb-3 text-xs text-text-faint">
          Last time: {last.map((s) => `${formatLoad(s.actualLoad, s.unit)}×${s.actualReps ?? '—'}`).join(', ')}
        </p>
      )}

      <div className="space-y-2">
        {sets.map((set, i) => {
          const key = `${we.id}:${set.setIndex}`;
          const done = loggedKey.get(key);
          const prev = last?.[i];
          const seed: Draft = {
            load: String(done?.actualLoad ?? set.targetLoad ?? prev?.actualLoad ?? ''),
            reps: String(done?.actualReps ?? set.repMax ?? prev?.actualReps ?? ''),
            effort: String(
              (effortSystem === 'rir' ? done?.actualRir ?? set.targetRir : done?.actualRpe) ?? '',
            ),
          };
          const draft = draftFor(key, seed);

          return (
            <div
              key={set.id}
              className={`flex items-center gap-2 rounded-xl p-2 ${done ? 'bg-accent/10' : 'bg-base-elevated'}`}
            >
              <span className="w-8 text-center text-xs font-semibold text-text-faint">
                {set.setType === 'warmup' ? 'W' : set.setType === 'working' ? set.setIndex : set.setType[0]?.toUpperCase()}
              </span>
              <Field label={unit} value={draft.load} onChange={(v) => setDraft(key, { load: v }, seed)} />
              <span className="text-text-faint">×</span>
              <Field label="reps" value={draft.reps} onChange={(v) => setDraft(key, { reps: v }, seed)} />
              <Field
                label={effortSystem.toUpperCase()}
                value={draft.effort}
                onChange={(v) => setDraft(key, { effort: v }, seed)}
                width="w-16"
              />
              <button
                className={`ml-auto min-h-touch min-w-touch rounded-xl px-3 text-lg font-bold ${
                  done ? 'bg-accent text-base-bg' : 'bg-brand text-white'
                }`}
                onClick={() => onLog(we, exerciseId, set, draft)}
                aria-label={done ? 'Update set' : 'Complete set'}
              >
                ✓
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  width = 'w-20',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  width?: string;
}) {
  return (
    <label className={`flex flex-col ${width}`}>
      <input
        type="number"
        inputMode="decimal"
        className="rounded-lg bg-base-surface px-2 py-2 text-center text-lg font-semibold focus:outline-none focus:ring-1 focus:ring-brand"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="mt-0.5 text-center text-[10px] uppercase text-text-faint">{label}</span>
    </label>
  );
}
