import type { NextFunction, Request, Response } from 'express';
import { getAdminAuth, getAdminDb } from './firebaseAdmin.ts';
import { DEFAULT_ADMIN_SECRET } from './paymentConfigService.ts';

export type ServerRole = 'master' | 'agent' | 'player';

export interface AuthenticatedRequest extends Request {
  uid?: string;
  serverRole?: ServerRole;
}

async function resolveRole(uid: string): Promise<ServerRole> {
  try {
    const db = getAdminDb();
    const adminSnap = await db.collection('admins').doc(uid).get();
    if (adminSnap.exists) {
      const role = adminSnap.data()?.role;
      if (role === 'master' || role === 'agent') return role;
      return 'master';
    }

    const userSnap = await db.collection('users').doc(uid).get();
    const role = userSnap.data()?.role;
    if (role === 'agent') return 'agent';
    return 'player';
  } catch (err) {
    console.warn('[AUTH] Could not resolve role from Firestore, defaulting to player:', err);
    return 'player';
  }
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    const xAdminKey = req.headers['x-admin-key'] as string | undefined;

    // Check if valid administrator secret is provided
    const adminSecret = process.env.ADMIN_SECRET_KEY || DEFAULT_ADMIN_SECRET;
    if (adminSecret && (xAdminKey === adminSecret || (header?.startsWith('Bearer ') && header.slice(7).trim() === adminSecret))) {
      req.uid = 'system_admin';
      req.serverRole = 'master';
      next();
      return;
    }

    if (!header?.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: 'Authentication required. Authorization header missing.' });
      return;
    }

    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      res.status(401).json({ success: false, error: 'Authentication token missing.' });
      return;
    }

    // Support dev tokens in non-production environments
    if (process.env.NODE_ENV !== 'production' && token.startsWith('dev_')) {
      const tokenPayload = token.slice(4);
      if (tokenPayload.includes('_master') || tokenPayload === 'master') {
        req.uid = tokenPayload.replace('_master', '');
        req.serverRole = 'master';
      } else if (tokenPayload.includes('_agent') || tokenPayload === 'agent') {
        req.uid = tokenPayload.replace('_agent', '');
        req.serverRole = 'agent';
      } else {
        req.uid = tokenPayload.replace('_player', '');
        req.serverRole = 'player';
      }
      next();
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
