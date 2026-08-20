/**
 * Authentication (spec §6) on Firebase Auth: email/password + Google OAuth.
 * When Firebase isn't configured every call is a safe no-op and the app stays local.
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { getFirebase } from './firebase';

export interface AuthUser {
  id: string;
  email: string | null;
}

function toUser(u: User | null): AuthUser | null {
  return u ? { id: u.uid, email: u.email } : null;
}

function messageFor(err: unknown): string {
  const code = (err as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'Incorrect email or password.';
    case 'auth/email-already-in-use':
      return 'That email already has an account.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/invalid-email':
      return 'That email address looks invalid.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in was cancelled.';
    default:
      return err instanceof Error ? err.message : 'Authentication failed.';
  }
}

export function authAvailable(): boolean {
  return getFirebase() !== null;
}

export async function currentUser(): Promise<AuthUser | null> {
  const fb = getFirebase();
  return fb ? toUser(fb.auth.currentUser) : null;
}

export async function signUp(email: string, password: string): Promise<{ error: string | null }> {
  const fb = getFirebase();
  if (!fb) return { error: 'Cloud sync is not configured.' };
  try {
    await createUserWithEmailAndPassword(fb.auth, email, password);
    return { error: null };
  } catch (err) {
    return { error: messageFor(err) };
  }
}

export async function signIn(email: string, password: string): Promise<{ error: string | null }> {
  const fb = getFirebase();
  if (!fb) return { error: 'Cloud sync is not configured.' };
  try {
    await signInWithEmailAndPassword(fb.auth, email, password);
    return { error: null };
  } catch (err) {
    return { error: messageFor(err) };
  }
}

export async function signInWithGoogle(): Promise<{ error: string | null }> {
  const fb = getFirebase();
  if (!fb) return { error: 'Cloud sync is not configured.' };
  try {
    await signInWithPopup(fb.auth, new GoogleAuthProvider());
    return { error: null };
  } catch (err) {
    return { error: messageFor(err) };
  }
}

export async function signOut(): Promise<void> {
  const fb = getFirebase();
  if (fb) await fbSignOut(fb.auth);
}

/** Subscribe to auth changes; returns an unsubscribe fn. */
export function onAuthChange(cb: (user: AuthUser | null) => void): () => void {
  const fb = getFirebase();
  if (!fb) return () => {};
  return onAuthStateChanged(fb.auth, (u) => cb(toUser(u)));
}
