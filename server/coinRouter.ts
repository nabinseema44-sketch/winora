import { Router, type Response } from 'express';
import { requireAuth, requireRole, type AuthenticatedRequest } from './authMiddleware.ts';
import {
  getLedger,
  getPaymentInstruction,
  getWallet,
  transferCoins,
  updatePaymentInstruction,
  type CoinTransferType,
} from './virtualCoinService.ts';

export const coinRouter = Router();

coinRouter.use(requireAuth);

coinRouter.get('/wallet', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const wallet = await getWallet(req.uid!);
    res.json({ success: true, wallet });
  } catch (error) {
    console.error('[COIN] wallet read failed', error);
    res.status(500).json({ success: false, error: 'Unable to load coin wallet.' });
  }
});

coinRouter.get('/ledger', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ledger = await getLedger(req.uid!, Math.min(Number(req.query.limit) || 50, 100));
    res.json({ success: true, ledger });
  } catch (error) {
    console.error('[COIN] ledger read failed', error);
    res.status(500).json({ success: false, error: 'Unable to load coin history.' });
  }
});

coinRouter.post('/transfer', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const recipientUid = String(req.body?.recipientUid || '').trim();
    const amount = Number(req.body?.amount);
    const type = String(req.body?.type || '') as CoinTransferType;
    const idempotencyKey = String(req.body?.idempotencyKey || '').trim();
    const note = typeof req.body?.note === 'string' ? req.body.note : undefined;

    const allowedTypes: CoinTransferType[] = [
      'MASTER_TO_AGENT',
      'AGENT_TO_PLAYER',
      'PLAYER_TO_AGENT',
      'AGENT_TO_MASTER',
    ];
    if (!allowedTypes.includes(type)) {
      res.status(400).json({ success: false, error: 'Unsupported coin transfer type.' });
      return;
    }

    const result = await transferCoins({
      actorUid: req.uid!,
      recipientUid,
      amount,
      type,
      note,
      idempotencyKey,
    });

    res.json({ success: true, transfer: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error?.message || 'Coin transfer failed.' });
  }
});

coinRouter.get('/payment-instructions', async (_req: AuthenticatedRequest, res: Response) => {
  try {
    res.json({ success: true, instructions: await getPaymentInstruction() });
  } catch {
    res.status(500).json({ success: false, error: 'Unable to load Master instructions.' });
  }
});

coinRouter.post('/payment-instructions', requireRole('master'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const instructions = await updatePaymentInstruction({
      actorUid: req.uid!,
      url: String(req.body?.url || ''),
      title: req.body?.title,
      message: req.body?.message,
    });
    res.json({ success: true, instructions });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error?.message || 'Unable to update instructions.' });
  }
});
