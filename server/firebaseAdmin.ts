import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function getCredential() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw) {
    const parsed = JSON.parse(raw);
    return cert(parsed);
  }

  // Supports Google-hosted environments using Application Default Credentials.
  return undefined;
}

const app = getApps().length
  ? getApps()[0]
  : initializeApp(getCredential() ? { credential: getCredential() } : undefined);

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
