import 'dotenv/config';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function getCredential() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return undefined;
  const parsed = JSON.parse(raw);
  return cert(parsed);
}

const credential = getCredential();
const app = getApps().length ? getApps()[0] : initializeApp(credential ? { credential } : undefined);

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
