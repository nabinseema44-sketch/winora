import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

/**
 * Firebase Client Configuration Interface
 */
export interface FirebaseConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  measurementId?: string;
}

/**
 * Read environment variables supplied via Vite (import.meta.env).
 * Values must be prefixed with VITE_ to be exposed to the client bundle.
 */
export const firebaseEnvConfig: FirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

/**
 * Inspects whether valid Firebase configuration credentials have been supplied.
 * Returns false if configuration is missing, empty, or using default template placeholders.
 */
export function isFirebaseConfigured(): boolean {
  const { apiKey, projectId, appId } = firebaseEnvConfig;
  if (!apiKey || !projectId || !appId) return false;
  if (
    apiKey === 'your-api-key-here' ||
    apiKey === 'MY_FIREBASE_API_KEY' ||
    projectId === 'your-project-id' ||
    apiKey.trim() === ''
  ) {
    return false;
  }
  return true;
}

// Singletons
let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;
let firebaseDb: Firestore | null = null;

/**
 * Initializes and returns the primary FirebaseApp instance.
 * Gracefully returns null if environment variables are not configured yet.
 */
export function getFirebaseApp(): FirebaseApp | null {
  if (firebaseApp) return firebaseApp;

  if (!isFirebaseConfigured()) {
    return null;
  }

  try {
    const existingApps = getApps();
    if (existingApps.length > 0) {
      firebaseApp = existingApps[0];
    } else {
      firebaseApp = initializeApp(firebaseEnvConfig);
    }
    return firebaseApp;
  } catch (error) {
    console.warn('[WINORA Firebase] Failed to initialize Firebase app:', error);
    return null;
  }
}

/**
 * Returns the Firebase Authentication service instance.
 */
export function getFirebaseAuth(): Auth | null {
  if (firebaseAuth) return firebaseAuth;
  const app = getFirebaseApp();
  if (!app) return null;

  try {
    firebaseAuth = getAuth(app);
    return firebaseAuth;
  } catch (error) {
    console.warn('[WINORA Firebase] Failed to get Auth instance:', error);
    return null;
  }
}

/**
 * Returns the Cloud Firestore instance.
 */
export function getFirebaseDb(): Firestore | null {
  if (firebaseDb) return firebaseDb;
  const app = getFirebaseApp();
  if (!app) return null;

  try {
    firebaseDb = getFirestore(app);
    return firebaseDb;
  } catch (error) {
    console.warn('[WINORA Firebase] Failed to get Firestore instance:', error);
    return null;
  }
}
