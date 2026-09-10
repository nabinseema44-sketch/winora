import { NextFunction, Request, Response } from 'express';
import { adminAuth, adminDb } from './firebaseAdmin.ts';

export type ServerRole = 'player' | 'master' | 'admin';

declare global {
  namespace Express {
    interface Request {
      uid?: string;
      role?: ServerRole;
      authToken?: string;
    }
  }
}

export async function requireFirebaseAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      res.status(401).json({ success: false, errorCode: 'AUTH_REQUIRED', message: 'Valid Firebase ID token is required.' });
      return;
    }

    const token = header.slice(7).trim();
    if (!token) {
      res.status(401).json({ success: false, errorCode: 'AUTH_REQUIRED', message: 'Valid Firebase ID token is required.' });
      return;
    }

    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    // Role is deliberately read from the server-side user/admin records.
    // Client headers and untrusted request fields are never used for authorization.
    const adminSnap = await adminDb.collection('admins').doc(uid).get();
    const userSnap = await adminDb.collection('users').doc(uid).get();
    const roleValue = adminSnap.exists ? adminSnap.data()?.role : userSnap.data()?.role;
    const role: ServerRole = roleValue === 'admin' || roleValue === 'master' ? roleValue : 'player';

    req.uid = uid;
    req.role = role;
    req.authToken = token;
    next();
  } catch (error) {
    console.error('[AUTH] Firebase token verification failed', error);
    res.status(401).json({ success: false, errorCode: 'INVALID_AUTH_TOKEN', message: 'Authentication failed.' });
  }
}

export function requireMasterOrAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.role !== 'master' && req.role !== 'admin') {
    res.status(403).json({ success: false, errorCode: 'FORBIDDEN', message: 'Master or admin role required.' });
    return;
  }
  next();
}
