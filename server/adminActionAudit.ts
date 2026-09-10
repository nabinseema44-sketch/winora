import type { Request, Response, NextFunction } from 'express';

export function adminActionAudit(action: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const startedAt = Date.now();
    res.on('finish', () => console.info(JSON.stringify({
      type: 'WINORA_ADMIN_ACTION', actorUid: req.uid || null, role: req.role || null,
      action, method: req.method, path: req.path, status: res.statusCode,
      ip: req.ip || req.socket.remoteAddress || null,
      userAgent: req.get('user-agent') || null, timestamp: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
    })));
    next();
  };
}
