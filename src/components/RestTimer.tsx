'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Rest timer (spec §20). Pure client-side — works fully offline. Auto-counts down,
 * pause/skip, ±15s, WebAudio beep + vibration when it hits zero.
 */
export function RestTimer({
  seconds,
  sound,
  vibrate,
  onDone,
  onDismiss,
}: {
  seconds: number;
  sound: boolean;
  vibrate: boolean;
  onDone?: () => void;
  onDismiss: () => void;
}) {
  const [remaining, setRemaining] = useState(seconds);
  const [paused, setPaused] = useState(false);
  const firedRef = useRef(false);

  const beep = useCallback(() => {
    if (vibrate && typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([200, 80, 200]);
    if (!sound) return;
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.value = 0.15;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
      osc.onended = () => ctx.close();
    } catch {
      /* audio not available */
    }
  }, [sound, vibrate]);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(t);
          if (!firedRef.current) {
            firedRef.current = true;
            beep();
            onDone?.();
          }
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [paused, beep, onDone]);

  const mm = Math.floor(remaining / 60);
  const ss = remaining % 60;
  const pct = seconds > 0 ? (remaining / seconds) * 100 : 0;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-base-border bg-base-elevated pb-safe-b">
      <div className="mx-auto max-w-2xl p-3">
        <div className="mb-2 h-1 overflow-hidden rounded bg-base-border">
          <div className="h-full bg-brand transition-all duration-1000" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="w-16 font-mono text-2xl font-bold tabular-nums">
            {mm}:{ss.toString().padStart(2, '0')}
          </span>
          <div className="flex flex-1 justify-end gap-1.5">
            <button className="btn-ghost px-3 text-sm" onClick={() => setRemaining((r) => Math.max(0, r - 15))}>
              −15
            </button>
            <button className="btn-ghost px-3 text-sm" onClick={() => setRemaining((r) => r + 15)}>
              +15
            </button>
            <button className="btn-ghost px-3 text-sm" onClick={() => setPaused((p) => !p)}>
              {paused ? '▶' : '⏸'}
            </button>
            <button className="btn-primary px-4 text-sm" onClick={onDismiss}>
              Skip
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
