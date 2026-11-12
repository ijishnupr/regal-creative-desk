import { initializeApp } from "firebase/app";
import { connectAuthEmulator, browserLocalPersistence, indexedDBLocalPersistence, initializeAuth, browserPopupRedirectResolver } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, connectFirestoreEmulator } from "firebase/firestore";

const env = import.meta.env;
export const firebaseApp = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
});

// IndexedDB-persisted auth => returning users are signed in instantly, even offline.
export const auth = initializeAuth(firebaseApp, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence],
  popupRedirectResolver: browserPopupRedirectResolver,
});

// Offline-first Firestore: every screen renders from the local cache immediately,
// then live-updates. Writes apply locally at once (latency compensation).
export const db = initializeFirestore(firebaseApp, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

/** Functions SDK is only needed at first sign-in, so it is loaded on demand. */
export async function callFunction<T = unknown>(name: string, data?: unknown): Promise<T> {
  const { getFunctions, httpsCallable, connectFunctionsEmulator } = await import("firebase/functions");
  const fns = getFunctions(firebaseApp, env.VITE_FUNCTIONS_REGION || "asia-south1");
  if (env.VITE_USE_EMULATORS === "true") { try { connectFunctionsEmulator(fns, "127.0.0.1", 5001); } catch { /* already */ } }
  return (await httpsCallable(fns, name)(data)).data as T;
}

if (env.VITE_USE_EMULATORS === "true") {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}

