'use client';

import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { LOCAL_USER_ID, updatePreferences } from '@/lib/repo';
import { exportBackupJson, importBackup, exportSetsCsv } from '@/lib/backup';
import { AuthPanel } from '@/components/AuthPanel';
import type { EffortSystem, WeightUnit } from '@/domain/values';

function download(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function SettingsPage() {
  const prefs = useLiveQuery(() => db().preferences.get(LOCAL_USER_ID), []);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!prefs) return <p className="text-text-muted">Loading…</p>;

  const set = (patch: Parameters<typeof updatePreferences>[0]) => updatePreferences(patch);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Settings</h1>

      <AuthPanel />

      <section className="card space-y-4 p-4">
        <div>
          <p className="label mb-2">Effort system</p>
          <Toggle
            value={prefs.effortSystem}
            options={[
              { v: 'rir', label: 'RIR' },
              { v: 'rpe', label: 'RPE' },
            ]}
            onChange={(v) => set({ effortSystem: v as EffortSystem })}
          />
          <p className="mt-1 text-xs text-text-faint">RIR↔RPE conversion is treated as an estimate.</p>
        </div>

        <div>
          <p className="label mb-2">Units</p>
          <Toggle
            value={prefs.unit}
            options={[
              { v: 'kg', label: 'kg' },
              { v: 'lb', label: 'lb' },
            ]}
            onChange={(v) => set({ unit: v as WeightUnit, loadIncrement: v === 'kg' ? 2.5 : 5 })}
          />
        </div>

        <div>
          <p className="label mb-1">Load increment ({prefs.unit})</p>
          <input
            type="number"
            step="0.5"
            className="input"
            value={prefs.loadIncrement}
            onChange={(e) => set({ loadIncrement: Number(e.target.value) || 0 })}
          />
        </div>

        <div>
          <p className="label mb-1">Default rest (seconds)</p>
          <input
            type="number"
            className="input"
            value={prefs.defaultRestSec}
            onChange={(e) => set({ defaultRestSec: Number(e.target.value) || 0 })}
          />
        </div>

        <label className="flex items-center justify-between">
          <span>Rest timer sound</span>
          <input type="checkbox" checked={prefs.restTimerSound} onChange={(e) => set({ restTimerSound: e.target.checked })} />
        </label>
        <label className="flex items-center justify-between">
          <span>Rest timer vibration</span>
          <input type="checkbox" checked={prefs.restTimerVibrate} onChange={(e) => set({ restTimerVibrate: e.target.checked })} />
        </label>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">Your data</h2>
        <p className="text-xs text-text-faint">
          Everything is stored on this device. Export regularly as a backup — no lock-in.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn-ghost"
            onClick={async () => {
              download(`stronger-backup-${Date.now()}.json`, await exportBackupJson(), 'application/json');
              setMsg('Backup exported.');
            }}
          >
            Export JSON
          </button>
          <button
            className="btn-ghost"
            onClick={async () => {
              download(`stronger-sets-${Date.now()}.csv`, await exportSetsCsv(), 'text/csv');
              setMsg('Sets exported as CSV.');
            }}
          >
            Export CSV
          </button>
          <button className="btn-ghost" onClick={() => fileRef.current?.click()}>
            Import JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const { imported } = await importBackup(await file.text());
                setMsg(`Imported ${imported} records.`);
              } catch (err) {
                setMsg(err instanceof Error ? err.message : 'Import failed.');
              }
              e.target.value = '';
            }}
          />
        </div>
        {msg && <p className="text-sm text-accent">{msg}</p>}
      </section>

      <p className="text-center text-xs text-text-faint">
        Stronger is a training-management tool, not a medical device. It does not diagnose injuries.
        If you feel pain, stop and consult a qualified professional.
      </p>
    </div>
  );
}

function Toggle<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { v: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-xl bg-base-elevated p-1">
      {options.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          className={`min-w-touch rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
            value === o.v ? 'bg-brand text-white' : 'text-text-muted'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
