'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/db';
import { parseWorkoutText } from '@/domain/import/parser';
import { fromAiExtraction } from '@/domain/import/ai';
import { AiExtraction } from '@/domain/import/schema';
import { createProgramFromParsed } from '@/lib/builder';
import { fileToImportPayload } from '@/lib/importFile';
import { ExercisePicker } from '@/components/ExercisePicker';
import type { ParsedProgram, ParsedExercise } from '@/domain/import/types';

const EXAMPLE = `Monday — Push
Bench Press 4x6-8 RIR 2
Incline Dumbbell Press 3x8-10
Lateral Raises 3x12-15
Triceps Pushdown 3x10-12`;

export default function ImportPage() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [program, setProgram] = useState<ParsedProgram | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [fixing, setFixing] = useState<{ day: number; ex: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function interpretPayload(payload: { text?: string; image?: { data: string; mediaType: string } }) {
    setBusy(true);
    setNote(null);
    const library = (await db().exercises.toArray()).filter((e) => !e.deletedAt);
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.available && data.extraction) {
        const parsed = AiExtraction.safeParse(data.extraction);
        if (parsed.success) {
          setProgram(fromAiExtraction(parsed.data, library));
          setNote('Interpreted with AI. Review everything before creating the program.');
          return;
        }
      }
      // Image/scanned PDF needs the vision model — there's no offline fallback for pixels.
      if (payload.image) {
        setNote(
          data.needsKeyForImage
            ? 'Reading images/scanned PDFs needs an AI key (Gemini) configured on the server. For now, paste the text instead.'
            : data.error ?? 'Could not read the image.',
        );
        return;
      }
      if (data.error) setNote(`${data.error} Using the built-in parser.`);
      else setNote('Interpreted with the built-in parser (no AI key configured).');
    } catch {
      setNote('Offline or AI unavailable — used the built-in parser.');
    } finally {
      if (payload.text) setProgram((p) => p ?? parseWorkoutText(payload.text!, library));
      setBusy(false);
    }
  }

  async function onFile(file: File) {
    setBusy(true);
    setNote(`Reading ${file.name}…`);
    try {
      const payload = await fileToImportPayload(file);
      if (payload.text) setText(payload.text);
      await interpretPayload(payload);
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Could not read that file.');
      setBusy(false);
    }
  }

  function patchExercise(day: number, ex: number, patch: Partial<ParsedExercise>) {
    setProgram((prog) => {
      if (!prog) return prog;
      const days = prog.days.map((d, di) =>
        di !== day
          ? d
          : { ...d, exercises: d.exercises.map((e, ei) => (ei === ex ? { ...e, ...patch } : e)) },
      );
      return { ...prog, days };
    });
  }

  async function create() {
    if (!program) return;
    setBusy(true);
    const created = await createProgramFromParsed(program);
    router.push(`/program/${created.id}`);
  }

  const unresolved = program?.days.flatMap((d) => d.exercises).filter((e) => !e.matchedExerciseId).length ?? 0;

  return (
    <div className="space-y-4">
      <Link href="/programs" className="text-sm text-brand">
        ← Programs
      </Link>
      <h1 className="text-2xl font-bold">Import a program</h1>

      {!program ? (
        <>
          <p className="text-sm text-text-muted">
            Paste a plan from your coach (text, in any language). It's interpreted into a structured
            program you can review and edit — nothing is invented.
          </p>
          <textarea
            className="input min-h-[180px] font-mono text-sm"
            placeholder={EXAMPLE}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              className="btn-primary flex-1"
              onClick={() => interpretPayload({ text })}
              disabled={busy || !text.trim()}
            >
              {busy ? 'Interpreting…' : 'Interpret'}
            </button>
            <button className="btn-ghost" onClick={() => setText(EXAMPLE)}>
              Example
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-base-border" />
            <span className="text-xs text-text-faint">or upload</span>
            <div className="h-px flex-1 bg-base-border" />
          </div>
          <button className="btn-ghost w-full" onClick={() => fileRef.current?.click()} disabled={busy}>
            📄 Upload PDF, image or text file
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.md,.pdf,image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
              e.target.value = '';
            }}
          />
          <p className="text-center text-[11px] text-text-faint">
            PDFs with selectable text work offline. Photos & scanned PDFs are read with AI (needs a
            server API key).
          </p>
          {note && <p className="text-sm text-warn">{note}</p>}
        </>
      ) : (
        <>
          {note && <p className="rounded-lg bg-base-elevated p-2 text-xs text-text-muted">{note}</p>}
          <input
            className="input font-semibold"
            value={program.name}
            onChange={(e) => setProgram({ ...program, name: e.target.value })}
          />

          {program.days.map((day, di) => (
            <section key={di} className="space-y-2">
              <h2 className="label">{day.name}</h2>
              {day.exercises.map((ex, ei) => (
                <div
                  key={ei}
                  className={`card p-3 ${ex.status === 'needs_review' ? 'border-warn/50' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <button className="text-left font-semibold" onClick={() => setFixing({ day: di, ex: ei })}>
                      {ex.matchedName ?? ex.name}
                      {!ex.matchedExerciseId && <span className="ml-1 text-warn">· tap to match</span>}
                    </button>
                    <ConfidenceBadge value={ex.confidence} status={ex.status} />
                  </div>
                  <p className="mt-0.5 text-[11px] text-text-faint">from: “{ex.raw}”</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                    <MiniNum label="sets" value={ex.sets} onChange={(n) => patchExercise(di, ei, { sets: n })} />
                    <MiniNum label="min" value={ex.repMin} onChange={(n) => patchExercise(di, ei, { repMin: n })} />
                    <MiniNum label="max" value={ex.repMax} onChange={(n) => patchExercise(di, ei, { repMax: n })} />
                    <MiniNum label="RIR" value={ex.targetRir} onChange={(n) => patchExercise(di, ei, { targetRir: n })} />
                  </div>
                </div>
              ))}
            </section>
          ))}

          {program.unparsed.length > 0 && (
            <div className="card p-3 text-xs text-text-faint">
              Ignored lines: {program.unparsed.join(' · ')}
            </div>
          )}

          {unresolved > 0 && (
            <p className="text-sm text-warn">
              {unresolved} exercise{unresolved === 1 ? '' : 's'} still need a library match and will be
              skipped. Tap a name to fix.
            </p>
          )}

          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => setProgram(null)}>
              Back
            </button>
            <button className="btn-primary flex-1" onClick={create} disabled={busy}>
              Create program
            </button>
          </div>
        </>
      )}

      {fixing && (
        <ExercisePicker
          title="Match to library"
          onClose={() => setFixing(null)}
          onPick={async (exerciseId) => {
            const ex = await db().exercises.get(exerciseId);
            patchExercise(fixing.day, fixing.ex, {
              matchedExerciseId: exerciseId,
              matchedName: ex?.name ?? null,
              confidence: 1,
              status: 'ok',
            });
            setFixing(null);
          }}
        />
      )}
    </div>
  );
}

function ConfidenceBadge({ value, status }: { value: number; status: string }) {
  const pct = Math.round(value * 100);
  const tone =
    status === 'ok' ? 'bg-accent/15 text-accent' : status === 'needs_review' ? 'bg-warn/15 text-warn' : 'bg-base-elevated text-text-muted';
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${tone}`}>{status === 'needs_review' ? `Review · ${pct}%` : `${pct}%`}</span>;
}

function MiniNum({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (n: number | null) => void;
}) {
  return (
    <label className="flex items-center gap-1">
      <input
        type="number"
        className="input w-14 py-1 text-center"
        defaultValue={value ?? ''}
        onBlur={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      />
      <span className="text-[10px] uppercase text-text-faint">{label}</span>
    </label>
  );
}
