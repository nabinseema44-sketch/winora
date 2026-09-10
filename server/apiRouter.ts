import { Router, Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { serverWalletService } from './walletService.ts';
import { paymentConfigService } from './paymentConfigService.ts';
import { serverGameEntryService } from './gameEntryService.ts';
import { serverResultSettlementService } from './resultSettlementService.ts';
import { serverReferralService } from './referralService.ts';
import { requireFirebaseAuth, requireMasterOrAdmin } from './authMiddleware.ts';

export const apiRouter = Router();
const sensitiveRateLimit = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false });

apiRouter.get('/payment-config/public', (_req, res) => res.json({ success: true, config: paymentConfigService.getPublicConfig() }));
apiRouter.get('/payment-config/admin', requireFirebaseAuth, requireMasterOrAdmin, (_req, res) => res.json({ success: true, config: paymentConfigService.getAdminConfig() }));
apiRouter.post('/payment-config/admin/update', requireFirebaseAuth, requireMasterOrAdmin, (req, res) => {
  try { res.json({ success: true, config: paymentConfigService.updateAdminConfig(req.body, req.uid!) }); }
  catch (e: any) { res.status(400).json({ success: false, error: e.message }); }
});

apiRouter.get('/wallet/status', (_req, res) => res.json({ success: true, status: 'ok', virtualCreditsOnly: true, timestamp: new Date().toISOString() }));

// Real-money flows are disabled at the HTTP boundary.
apiRouter.post('/wallet/deposit/initiate', requireFirebaseAuth, sensitiveRateLimit, (_req, res) => res.status(410).json({ success: false, errorCode: 'VIRTUAL_ONLY' }));
apiRouter.post('/wallet/withdraw/request', requireFirebaseAuth, sensitiveRateLimit, (_req, res) => res.status(410).json({ success: false, errorCode: 'VIRTUAL_ONLY' }));
apiRouter.post('/wallet/withdraw/process-callback', requireFirebaseAuth, requireMasterOrAdmin, (_req, res) => res.status(410).json({ success: false, errorCode: 'VIRTUAL_ONLY' }));

// A real payment webhook is accepted only after provider signature verification in walletService.
apiRouter.post('/payments/webhook', async (req, res) => {
  try {
    const signature = String(req.headers['x-winora-signature'] || req.headers['x-razorpay-signature'] || req.headers['x-webhook-signature'] || '');
    res.json(await serverWalletService.handlePaymentWebhook(typeof req.body === 'string' ? req.body : JSON.stringify(req.body), signature));
  } catch (e: any) { res.status(400).json({ success: false, error: e.message }); }
});

apiRouter.post('/wallet/sandbox/simulate-payment', requireFirebaseAuth, requireMasterOrAdmin, async (req, res) => {
  if (process.env.NODE_ENV === 'production') { res.status(404).json({ success: false, errorCode: 'NOT_FOUND' }); return; }
  try { res.json({ success: true, result: await serverWalletService.simulateSandboxWebhook(req.body.transactionId, req.body.action) }); }
  catch (e: any) { res.status(400).json({ success: false, error: e.message }); }
});

apiRouter.get('/wallet/:uid', requireFirebaseAuth, (req, res) => {
  if (req.params.uid !== req.uid) return res.status(403).json({ success: false, errorCode: 'FORBIDDEN' });
  res.json({ success: true, wallet: serverWalletService.getWallet(req.uid!) });
});
apiRouter.get('/wallet/:uid/transactions', requireFirebaseAuth, (req, res) => {
  if (req.params.uid !== req.uid) return res.status(403).json({ success: false, errorCode: 'FORBIDDEN' });
  res.json({ success: true, transactions: serverWalletService.getUserTransactions(req.uid!) });
});
apiRouter.get('/wallet/:uid/audits', requireFirebaseAuth, (req, res) => {
  if (req.params.uid !== req.uid) return res.status(403).json({ success: false, errorCode: 'FORBIDDEN' });
  res.json({ success: true, audits: serverWalletService.getUserAudits(req.uid!) });
});

apiRouter.get('/games/config', (_req, res) => res.json({ success: true, ...serverGameEntryService.getGamesConfig() }));
apiRouter.get('/game-entry/balances/:uid', requireFirebaseAuth, (req, res) => {
  if (req.params.uid !== req.uid) return res.status(403).json({ success: false, errorCode: 'FORBIDDEN' });
  res.json({ success: true, balances: serverGameEntryService.getUserBalance(req.uid!) });
});
apiRouter.get('/game-entry/my-entries', requireFirebaseAuth, (req, res) => res.json({ success: true, entries: serverGameEntryService.getUserEntries(req.uid!) }));
apiRouter.post('/game-entry/submit', requireFirebaseAuth, (req, res) => {
  try {
    const result = serverGameEntryService.submitEntry({ userId: req.uid!, gameId: req.body.gameId, roundId: req.body.roundId, selections: req.body.selections, idempotencyKey: req.body.idempotencyKey });
    if (!result.success) return res.status(400).json({ success: false, errorCode: result.errorCode, message: result.error });
    res.json({ success: true, entry: result.entry, remainingBalance: result.remainingBalance });
  } catch { res.status(500).json({ success: false, errorCode: 'SERVER_ERROR' }); }
});

apiRouter.get('/referral/resolve/:code', (req, res) => {
  const result = serverReferralService.resolveReferralCode(req.params.code);
  if (!result.valid) return res.status(404).json({ success: false, valid: false, message: result.error });
  res.json({ success: true, valid: true, referrerDisplayName: result.referrerDisplayName, referralCode: result.referralCode });
});
apiRouter.get('/referral/config', (_req, res) => res.json({ success: true, config: serverReferralService.getConfig() }));
apiRouter.get('/referral/user/:userId', requireFirebaseAuth, (req, res) => {
  if (req.params.userId !== req.uid) return res.status(403).json({ success: false, errorCode: 'FORBIDDEN' });
  const user = serverReferralService.getUserProfile(req.uid!);
  if (!user) return res.status(404).json({ success: false });
  res.json({ success: true, userProfile: user, referralRecord: serverReferralService.getReferralRecordByReferred(req.uid!) || null, referrals: serverReferralService.getReferralsByReferrer(req.uid!) });
});
apiRouter.post('/referral/create-relationship', requireFirebaseAuth, (req, res) => {
  try { const result = serverReferralService.createReferralRelationship({ referredUserId: req.uid!, referralCode: req.body.referralCode }); res.status(result.success ? 200 : 400).json(result); }
  catch (e: any) { res.status(500).json({ success: false, errorCode: 'SERVER_ERROR', message: e.message }); }
});
apiRouter.post('/referral/register-player', requireFirebaseAuth, (req, res) => {
  try { const result = serverReferralService.registerUser({ userId: req.uid!, displayName: String(req.body.displayName || 'WINORA Player').slice(0, 80), referralCodeToRedeem: req.body.referralCodeToRedeem }); res.status(result.success ? 200 : 400).json(result); }
  catch (e: any) { res.status(500).json({ success: false, errorCode: 'SERVER_ERROR', message: e.message }); }
});
apiRouter.post('/referral/claim-reward', requireFirebaseAuth, (req, res) => {
  try {
    const event = req.body.event;
    if (!['FIRST_DEPOSIT', 'FIRST_BET', 'MANUAL_ACTIVATION'].includes(event)) return res.status(400).json({ success: false, errorCode: 'INVALID_EVENT' });
    // Reward amount and referrer ID are derived from the stored referral record/config, never request input.
    res.json(serverReferralService.processReferralReward({ referredUserId: req.uid!, event }));
  } catch (e: any) { res.status(500).json({ success: false, errorCode: 'SERVER_ERROR', message: e.message }); }
});

apiRouter.get('/results/rounds', (_req, res) => {
  const config = serverGameEntryService.getGamesConfig();
  res.json({ success: true, rounds: Object.values(config.rounds).map(round => ({ ...round, entriesCount: serverGameEntryService.getEntriesForRound(round.id).length, totalStake: serverGameEntryService.getEntriesForRound(round.id).reduce((s, e) => s + e.totalStake, 0), result: serverResultSettlementService.getResultByRoundId(round.id) })), serverTime: new Date().toISOString() });
});
apiRouter.get('/results/recent', (_req, res) => res.json({ success: true, results: serverResultSettlementService.getRecentResults() }));
apiRouter.get('/results/round/:roundId', (req, res) => { const result = serverResultSettlementService.getResultByRoundId(req.params.roundId); if (!result) return res.status(404).json({ success: false, errorCode: 'RESULT_NOT_FOUND' }); res.json({ success: true, result }); });
apiRouter.post('/results/freeze-round', requireFirebaseAuth, requireMasterOrAdmin, (req, res) => {
  try { const result = serverResultSettlementService.freezeRound({ actorRole: req.role!, actorId: req.uid!, gameId: req.body.gameId, roundId: req.body.roundId }); res.status(result.success ? 200 : 400).json(result); }
  catch { res.status(500).json({ success: false, errorCode: 'SERVER_ERROR' }); }
});
apiRouter.post('/results/calculate-liability', requireFirebaseAuth, requireMasterOrAdmin, (req, res) => {
  try { const { gameId, roundId, winningNumber, resultColor } = req.body; if (typeof winningNumber !== 'string' || !/^\d{2}$/.test(winningNumber) || !['GREEN', 'RED'].includes(resultColor)) return res.status(400).json({ success: false, errorCode: 'INVALID_RESULT' }); res.json({ success: true, liability: serverResultSettlementService.calculateSettlementLiability({ gameId, roundId, winningNumber, resultColor }) }); }
  catch (e: any) { res.status(500).json({ success: false, errorCode: 'SERVER_ERROR', message: e.message }); }
});
apiRouter.post('/results/declare', requireFirebaseAuth, requireMasterOrAdmin, sensitiveRateLimit, (req, res) => {
  try { const { gameId, roundId, winningNumber, resultColor, idempotencyKey } = req.body; if (typeof winningNumber !== 'string' || !/^\d{2}$/.test(winningNumber) || !['GREEN', 'RED'].includes(resultColor)) return res.status(400).json({ success: false, errorCode: 'INVALID_RESULT' }); const result = serverResultSettlementService.declareResultAndSettle({ actorRole: req.role!, actorId: req.uid!, gameId, roundId, winningNumber, resultColor, idempotencyKey }); res.status(result.success ? 200 : 400).json(result); }
  catch { res.status(500).json({ success: false, errorCode: 'SERVER_ERROR' }); }
});
apiRouter.get('/results/audit-logs', requireFirebaseAuth, requireMasterOrAdmin, (_req, res) => res.json({ success: true, logs: serverResultSettlementService.getAuditLogs() }));
