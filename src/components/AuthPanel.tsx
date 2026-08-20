'use client';

import { useState } from 'react';
import { useSyncStore } from '@/lib/sync/store';
import { signIn, signUp, signInWithGoogle, signOut } from '@/lib/auth';
import { syncNow } from '@/lib/sync/run';

export function AuthPanel() {
  const { user, configured, syncing, pending, lastSyncedAt, lastError } = useSyncStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!configured) {
    return (
      <section className="card space-y-2 p-4">
        <h2 className="font-semibold">Account & cloud sync</h2>
        <p className="text-sm text-text-muted">
          Cloud sync is <span className="text-warn">not configured</span>. The app is fully local —
          your data lives on this device. To enable multi-device sync, add your Firebase config (see{' '}
          <span className="font-mono text-xs">DEPLOY.md</span>) and deploy{' '}
          <span className="font-mono text-xs">firestore.rules</span>.
        </p>
        <p className="chip">{pending} changes queued locally</p>
      </section>
    );
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const { error } = mode === 'in' ? await signIn(email, password) : await signUp(email, password);
    setError(error);
    setBusy(false);
  }

  if (user) {
    return (
      <section className="card space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Signed in</h2>
            <p className="text-sm text-text-muted">{user.email}</p>
          </div>
          <button className="btn-ghost text-sm" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-text-muted">
            {syncing ? 'Syncing…' : lastSyncedAt ? `Last sync ${new Date(lastSyncedAt).toLocaleTimeString()}` : 'Not synced yet'}
          </span>
          <span className="chip">{pending} pending</span>
        </div>
        {lastError && <p className="text-sm text-danger">{lastError}</p>}
        <button className="btn-primary w-full" onClick={() => syncNow()} disabled={syncing}>
          {syncing ? 'Syncing…' : 'Sync now'}
        </button>
      </section>
    );
  }

  return (
    <section className="card space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{mode === 'in' ? 'Sign in' : 'Create account'}</h2>
        <button className="text-sm text-brand" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
          {mode === 'in' ? 'Need an account?' : 'Have an account?'}
        </button>
      </div>
      <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      <input className="input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} />
      {error && <p className="text-sm text-danger">{error}</p>}
      <button className="btn-primary w-full" onClick={submit} disabled={busy || !email || !password}>
        {busy ? '…' : mode === 'in' ? 'Sign in' : 'Sign up'}
      </button>
      <button className="btn-ghost w-full" onClick={() => signInWithGoogle()}>
        Continue with Google
      </button>
      <p className="text-center text-xs text-text-faint">
        Your local data stays; signing in starts syncing it to your account.
      </p>
    </section>
  );
}
