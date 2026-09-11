import type { NextFunction, Request, Response } from 'express';
import { getAdminAuth, getAdminDb } from './firebaseAdmin.ts';

export type ServerRole = 'master' | 'agent' | 'player';

export interface AuthenticatedRequest extends Request {
  uid?: string;
  serverRole?: ServerRole;
}

async function resolveRole(uid: string): Promise<ServerRole> {
  const db = getAdminDb();

  const adminSnap = await db.collection('admins').doc(uid).get();
  if (adminSnap.exists) {
    const role = adminSnap.data()?.role;
    if (role === 'master' || role === 'agent') return role;
    return 'master';
  }

  const userSnap = await db.collection('users').doc(uid).get();
  const role = userSnap.data()?.role;
  return role === 'agent' ? 'agent' : 'player';
}

/**
 * Production authentication boundary.
 * The server accepts only a Firebase ID token. Client-supplied UID, role,
 * x-admin-key, and development tokens are never authentication credentials.
 */
export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: 'Authentication required.' });
      return;
    }

    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      res.status(401).json({ success: false, error: 'Authentication token missing.' });
      return;
    }

    const decoded = await getAdminAuth().verifyIdToken(token);
    req.uid = decoded.uid;
    req.serverRole = await resolveRole(decoded.uid);
    next();
  } catch (error) {
    console.error('[WINORA AUTH] rejected request', error);
    res.status(401).json({ success: false, error: 'Invalid or expired authentication token.' });
  }
}

export function requireRole(...allowed: ServerRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.serverRole || !allowed.includes(req.serverRole)) {
      res.status(403).json({ success: false, error: 'Insufficient permissions.' });
      return;
    }
    next();
  };
}
