import { Router, Request, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { serverWalletService } from './walletService.ts';
import { paymentConfigService } from './paymentConfigService.ts';
import { serverGameEntryService } from './gameEntryService.ts';
import { serverResultSettlementService } from './resultSettlementService.ts';
import { serverReferralService } from './referralService.ts';
import { requireFirebaseAuth, requireMasterOrAdmin } from './authMiddleware.ts';

export const apiRouter = Router();

const sensitiveRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, errorCode: 'RATE_LIMITED', message: 'Too many requests. Please try again later.' },
});

// Public-only configuration. No identity or authorization header is trusted here.
apiRouter.get('/payment-config/public', (_req, res) => {
  res.json({ success: true, config: paymentConfigService.getPublicConfig() });
});

// Admin payment configuration is authenticated and authorized by Firebase + server-side role.
apiRouter.get('/payment-config/admin', requireFirebaseAuth, requireMasterOrAdmin, (_req, res) => {
  res.json({ success: true, config: paymentConfigService.getAdminConfig() });
});

apiRouter.post('/payment-config/admin/update', requireFirebaseAuth, requireMasterOrAdmin, (req, res) => {
  try {
    const updatedConfig = paymentConfigService.updateAdminConfig(req.body, req.uid!);
    res.json({ success: true, config: updatedConfig, message: 'Payment configuration updated.' });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || 'Failed to update payment configuration.' });
  }
});

// Wallet status is harmless health/config information and exposes no user data.
apiRouter.get('/wallet/status', (_req, res) => {
  res.json({
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
    virtualCreditsOnly: true,
    timestamp: new Date().toISOString(),
    securityDirectives: { clientBalanceMutationAllowed: false, serverAuthoritative: true, auditLoggingEnabled: true },
  });
});

// The product is virtual-credit only. Real-money deposit/withdrawal paths are intentionally disabled.
apiRouter.post('/wallet/deposit/initiate', requireFirebaseAuth, sensitiveRateLimit, (_req, res) => {
  res.status(410).json({ success: false, errorCode: 'VIRTUAL_ONLY', message: 'Real-money deposits are disabled. WINORA uses virtual/demo credits only.' });
});
apiRouter.post('/wallet/withdraw/request', requireFirebaseAuth, sensitiveRateLimit, (_req, res) => {
  res.status(410).json({ success: false, errorCode: 'VIRTUAL_ONLY', message: 'Real-money withdrawals are disabled. WINORA uses virtual/demo credits only.' });
});
apiRouter.post('/wallet/withdraw/process-callback', requireFirebaseAuth, requireMasterOrAdmin, (_req, res) => {
  res.status(410).json({ success: false, errorCode: 'VIRTUAL_ONLY', message: 'Real-money payout processing is disabled.' });
});

// Provider webhook is the only deposit-credit entry point. It remains signature-verified in walletService.
apiRouter.post('/payments/webhook', async (req, res) => {
  try {
    const signature = String(req.headers['x-winora-signature'] || req.headers['x-razorpay-signature'] || req.headers['x-webhook-signature'] || '');
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    const result = await serverWalletService.handlePaymentWebhook(rawBody, signature);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || 'Webhook verification failed.' });
  }
});

// Sandbox payment simulation is unavailable in production and admin-only elsewhere.
apiRouter.post('/wallet/sandbox/simulate-payment', requireFirebaseAuth, requireMasterOrAdmin, async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(404).json({ success: false, errorCode: 'NOT_FOUND' });
    return;
  }
  try {
    const { transactionId, action } = req.body;
    if (!transactionId || !action) {
      res.status(400).json({ success: false, errorCode: 'MISSING_PARAMETERS', message: 'transactionId and action are required.' });
      return;
    }
    const result = await serverWalletService.simulateSandboxWebhook(transactionId, action);
    res.json({ success: true, result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || 'Sandbox simulation failed.' });
  }
});

// Authenticated wallet reads are always scoped to req.uid; URL uid is never trusted.
apiRouter.get('/wallet/:uid', requireFirebaseAuth, (req, res) => {
  if (req.params.uid !== req.uid) {
    res.status(403).json({ success: false, errorCode: 'FORBIDDEN' });
    return;
  }
  res.json({ success: true, wallet: serverWalletService.getWallet(req.uid) });
});
apiRouter.get('/wallet/:uid/transactions', requireFirebaseAuth, (req, res) => {
  if (req.params.uid !== req.uid) { res.status(403).json({ success: false, errorCode: 'FORBIDDEN' }); return; }
  res.json({ success: true, transactions: serverWalletService.getUserTransactions(req.uid) });
});
apiRouter.get('/wallet/:uid/audits', requireFirebaseAuth, (req, res) => {
  if (req.params.uid !== req.uid) { res.status(403).json({ success: false, errorCode: 'FORBIDDEN' }); return; }
  res.json({ success: true, audits: serverWalletService.getUserAudits(req.uid) });
});

// Public game catalog/config.
apiRouter.get('/games/config', (_req, res) => res.json({ success: true, ...serverGameEntryService.getGamesConfig() }));

apiRouter.get('/game-entry/balances/:uid', requireFirebaseAuth, (req, res) => {
  if (req.params.uid !== req.uid) { res.status(403).json({ success: false, errorCode: 'FORBIDDEN' }); return; }
  res.json({ success: true, balances: serverGameEntryService.getUserBalance(req.uid) });
});

apiRouter.get('/game-entry/my-entries', requireFirebaseAuth, (req, res) => {
  res.json({ success: true, entries: serverGameEntryService.getUserEntries(req.uid!) });
});

apiRouter.post('/game-entry/submit', requireFirebaseAuth, (req, res) => {
  try {
    const { gameId, roundId, selections, idempotencyKey } = req.body;
    const result = serverGameEntryService.submitEntry({ userId: req.uid!, gameId, roundId, selections, idempotencyKey });
    if (!result.success) {
      res.status(400).json({ success: false, errorCode: result.errorCode, message: result.error });
      return;
    }
    res.json({ success: true, message: 'Entry confirmed successfully.', entry: result.entry, remainingBalance: result.remainingBalance });
  } catch {
    res.status(500).json({ success: false, errorCode: 'SERVER_ERROR', message: 'Unexpected game entry error.' });
  }
});

// Referral code resolution/config are public. All user-specific referral operations are authenticated and UID-scoped.
apiRouter.get('/referral/resolve/:code', (req, res) => {
  const result = serverReferralService.resolveReferralCode(req.params.code);
  if (!result.valid) { res.status(404).json({ success: false, valid: false, message: result.error || 'Invalid referral code.' }); return; }
  res.json({ success: true, valid: true, referrerDisplayName: result.referrerDisplayName, referralCode: result.referralCode });
});
apiRouter.get('/referral/config', (_req, res) => res.json({ success: true, config: serverReferralService.getConfig() }));

apiRouter.get('/referral/user/:userId', requireFirebaseAuth, (req, res) => {
  if (req.params.userId !== req.uid) { res.status(403).json({ success: false, errorCode: 'FORBIDDEN' }); return; }
  const user = serverReferralService.getUserProfile(req.uid);
  if (!user) { res.status(404).json({ success: false, message: 'Referral profile not found.' }); return; }
  const referrals = serverReferralService.getReferralsByReferrer(req.uid);
  const relationshipRecord = serverReferralService.getReferralRecordByReferred(req.uid);
  res.json({ success: true, userProfile: user, referralRecord: relationshipRecord || null, referralsCount: referrals.length, referrals });
});

apiRouter.post('/referral/create-relationship', requireFirebaseAuth, (req, res) => {
  try {
    const { referralCode } = req.body;
    if (!referralCode) { res.status(400).json({ success: false, errorCode: 'MISSING_PARAMETERS' }); return; }
    const result = serverReferralService.createReferralRelationship({ referredUserId: req.uid!, referralCode });
    if (!result.success) { res.status(400).json({ success: false, errorCode: result.errorCode, message: result.error }); return; }
    res.json({ success: true, message: 'Referral relationship established.', referralRecord: result.referralRecord });
  } catch (error: any) { res.status(500).json({ success: false, errorCode: 'SERVER_ERROR', message: error.message }); }
});

apiRouter.post('/referral/register-player', requireFirebaseAuth, (req, res) => {
  try {
    const result = serverReferralService.registerUser({ userId: req.uid!, displayName: String(req.body.displayName || 'WINORA Player').slice(0, 80), referralCodeToRedeem: req.body.referralCodeToRedeem });
    if (!result.success) { res.status(400).json({ success: false, errorCode: result.errorCode, message: result.error, userProfile: result.userProfile }); return; }
    res.json({ success: true, userProfile: result.userProfile, referralRecord: result.referralRecord });
  } catch (error: any) { res.status(500).json({ success: false, errorCode: 'SERVER_ERROR', message: error.message }); }
});

apiRouter.post('/referral/claim-reward', requireFirebaseAuth, (req, res) => {
  try {
    const { referralKey } = req.body;
    if (!referralKey) { res.status(400).json({ success: false, errorCode: 'MISSING_PARAMETERS' }); return; }
    // Amount and referrer identity are intentionally omitted. The service must derive both server-side.
    const result = serverGameEntryService.creditReferralReward({ referralKey, userId: req.uid! });
    if (!result.success) { res.status(400).json(result); return; }
    res.json(result);
  } catch (error: any) { res.status(500).json({ success: false, message: error.message || 'Failed to credit referral reward.' }); }
});

// Public result reads.
apiRouter.get('/results/rounds', (_req, res) => {
  const config = serverGameEntryService.getGamesConfig();
  const rounds = Object.values(config.rounds).map(round => ({
    ...round,
    entriesCount: serverGameEntryService.getEntriesForRound(round.id).length,
    totalStake: serverGameEntryService.getEntriesForRound(round.id).reduce((sum, e) => sum + e.totalStake, 0),
    result: serverResultSettlementService.getResultByRoundId(round.id),
  }));
  res.json({ success: true, rounds, serverTime: new Date().toISOString() });
});
apiRouter.get('/results/recent', (_req, res) => res.json({ success: true, results: serverResultSettlementService.getRecentResults() }));
apiRouter.get('/results/round/:roundId', (req, res) => {
  const result = serverResultSettlementService.getResultByRoundId(req.params.roundId);
  if (!result) { res.status(404).json({ success: false, errorCode: 'RESULT_NOT_FOUND' }); return; }
  res.json({ success: true, result });
});

// Master/admin result operations use verified Firebase identity and server-side role.
apiRouter.post('/results/freeze-round', requireFirebaseAuth, requireMasterOrAdmin, (req, res) => {
  try {
    const { gameId, roundId } = req.body;
    const result = serverResultSettlementService.freezeRound({ actorRole: req.role!, actorId: req.uid!, gameId, roundId });
    if (!result.success) { res.status(400).json({ success: false, errorCode: result.errorCode, message: result.error }); return; }
    res.json({ success: true, message: `Round ${roundId} is now frozen.`, round: result.round });
  } catch { res.status(500).json({ success: false, errorCode: 'SERVER_ERROR' }); }
});

apiRouter.post('/results/calculate-liability', requireFirebaseAuth, requireMasterOrAdmin, (req, res) => {
  try {
    const { gameId, roundId, winningNumber, resultColor } = req.body;
    if (typeof winningNumber !== 'string' || !/^\d{2}$/.test(winningNumber) || !['GREEN', 'RED'].includes(resultColor)) {
      res.status(400).json({ success: false, errorCode: 'INVALID_RESULT', message: 'Valid winning number and explicit result color are required.' });
      return;
    }
    res.json({ success: true, liability: serverResultSettlementService.calculateSettlementLiability({ gameId, roundId, winningNumber, resultColor }) });
  } catch (error: any) { res.status(500).json({ success: false, errorCode: 'SERVER_ERROR', message: error.message }); }
});

apiRouter.post('/results/declare', requireFirebaseAuth, requireMasterOrAdmin, sensitiveRateLimit, (req, res) => {
  try {
    const { gameId, roundId, winningNumber, resultColor, idempotencyKey } = req.body;
    if (typeof winningNumber !== 'string' || !/^\d{2}$/.test(winningNumber) || !['GREEN', 'RED'].includes(resultColor)) {
      res.status(400).json({ success: false, errorCode: 'INVALID_RESULT', message: 'Valid winning number and explicit result color are required.' });
      return;
    }
    const result = serverResultSettlementService.declareResultAndSettle({ actorRole: req.role!, actorId: req.uid!, gameId, roundId, winningNumber, resultColor, idempotencyKey });
    if (!result.success) { res.status(400).json({ success: false, errorCode: result.errorCode, message: result.error }); return; }
    res.json({ success: true, message: 'Result declared and settled.', result: result.result, summary: result.summary });
  } catch { res.status(500).json({ success: false, errorCode: 'SERVER_ERROR' }); }
});

apiRouter.get('/results/audit-logs', requireFirebaseAuth, requireMasterOrAdmin, (_req, res) => {
  res.json({ success: true, logs: serverResultSettlementService.getAuditLogs() });
});
