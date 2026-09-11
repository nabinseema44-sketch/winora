import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './server/apiRouter.ts';
import { coinRouter } from './server/coinRouter.ts';
import { authoritativeBackendStore } from './server/authoritativeBackendStore.ts';
import dotenv from 'dotenv';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  app.disable('x-powered-by');
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  if (process.env.NODE_ENV === 'production') {
    const requiredFirebaseEnv = ['FIREBASE_PROJECT_ID'];
    const missing = requiredFirebaseEnv.filter((key) => !process.env[key]);
    if (missing.length > 0) {
      throw new Error(`Production Firebase configuration is incomplete. Missing: ${missing.join(', ')}`);
    }
  }

  // Firebase is the persistent backend. Hydrate before accepting requests so a
  // restart does not reset wallets, entries, rounds, or results to demo state.
  await authoritativeBackendStore.hydrateFromFirestore();

  app.use('/api/coin', coinRouter);
  app.use('/api', apiRouter);

  app.all('/api/*', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`WINORA Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
