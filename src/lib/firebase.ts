/**
 * Firebase client factory (auth + Firestore). Returns null when the project isn't
 * configured, keeping the app fully local-first: no env vars → no cloud, everything
 * still works on-device.
 *
 * The web config is public by design — access is enforced by Firestore security
 * rules (see firestore.rules), not by hiding these values.
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { initializeFirestore, type Firestore } from 'firebase/firestore';

export interface FirebaseHandles {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

let cached: FirebaseHandles | null | undefined;

function readConfig() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
  if (!apiKey || !projectId || !appId) return null;
  return {
    apiKey,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? `${projectId}.firebaseapp.com`,
    projectId,
    appId,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  };
}

export function getFirebase(): FirebaseHandles | null {
  if (cached !== undefined) return cached;
  const config = readConfig();
  if (!config) {
    cached = null;
    return null;
  }
  const app = getApps().length ? getApp() : initializeApp(config);
  // ignoreUndefinedProperties: our rows carry optional fields that may be undefined;
  // Firestore would otherwise reject the write.
  const db = initializeFirestore(app, { ignoreUndefinedProperties: true });
  cached = { app, auth: getAuth(app), db };
  return cached;
}

export function isCloudConfigured(): boolean {
  return getFirebase() !== null;
}
