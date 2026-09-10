import { Router, type Response } from 'express';
import { requireAuth, requireRole, type AuthenticatedRequest } from './authMiddleware.ts';
import {
  getLedger,
  getWallet,
  transferCoins,
  giftBonusCoins,
  adminAdjustCoins,
  getPaymentInstruction,
  updatePaymentInstruction,
  type CoinTransferType,
} from './virtualCoinService.ts';

export const coinRouter = Router();
coinRouter.use(requireAuth);

coinRouter.get('/wallet', async (req: AuthenticatedRequest, res: Response) => {
  try {
    res.json({ success: true, wallet: await getWallet(req.uid!) });
  } catch (error) {
    console.error('[COIN] wallet read failed', error);
    res.status(500).json({ success: false, error: 'Unable to load coin wallet.' });
  }
});

coinRouter.get('/ledger', async (req: AuthenticatedRequest, res: Response) => {
  try {
    res.json({ success: true, ledger: await getLedger(req.uid!, Math.min(Number(req.query.limit) || 50, 100)) });
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
    if (!['MASTER_TO_AGENT', 'AGENT_TO_PLAYER', 'PLAYER_TO_AGENT', 'AGENT_TO_MASTER'].includes(type)) {
      res.status(400).json({ success: false, error: 'Unsupported coin transfer type.' }); return;
    }
    const result = await transferCoins({ actorUid: req.uid!, recipientUid, amount, type, note, idempotencyKey });
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

coinRouter.post('/helper/gift-bonus', requireRole('agent'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await giftBonusCoins({
      actorUid: req.uid!,
      playerUid: String(req.body?.playerUid || '').trim(),
      amount: Number(req.body?.amount),
      idempotencyKey: String(req.body?.idempotencyKey || '').trim(),
      note: req.body?.note,
    });
    res.json({ success: true, gift: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error?.message || 'Bonus coin gift failed.' });
  }
});

coinRouter.post('/master/adjust', requireRole('master'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await adminAdjustCoins({
      actorUid: req.uid!,
      playerUid: String(req.body?.playerUid || '').trim(),
      amount: Number(req.body?.amount),
      bonus: Boolean(req.body?.bonus),
      reason: String(req.body?.reason || '').trim(),
      idempotencyKey: String(req.body?.idempotencyKey || '').trim(),
    });
    res.json({ success: true, adjustment: result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error?.message || 'Coin adjustment failed.' });
  }
});

coinRouter.all('/deposit', (_req, res) => res.status(410).json({ success: false, error: 'Cash deposits are not supported. Earn or receive virtual coins in-game.' }));
coinRouter.all('/withdraw', (_req, res) => res.status(410).json({ success: false, error: 'Cash withdrawals are not supported. Winora coins have no cash value.' }));
