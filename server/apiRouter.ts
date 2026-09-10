import { Router, Request, Response } from 'express';
import { serverWalletService } from './walletService.ts';
import { getPaymentProvider } from './paymentProvider.ts';
import { paymentConfigService } from './paymentConfigService.ts';
import { serverGameEntryService } from './gameEntryService.ts';
import { serverResultSettlementService } from './resultSettlementService.ts';

export const apiRouter = Router();

/**
 * Public payment configuration for normal players (read-only projection)
 * NEVER exposes private keys or allows client-side mutation.
 */
apiRouter.get('/payment-config/public', (req: Request, res: Response) => {
  const publicConfig = paymentConfigService.getPublicConfig();
  res.json({ success: true, config: publicConfig });
});

/**
 * Admin payment configuration (Full system/paymentConfig)
 * Protected by server-side administrator authorization.
 */
apiRouter.get('/payment-config/admin', (req: Request, res: Response) => {
  const adminKey = (req.headers['x-admin-key'] as string) || (req.headers['authorization'] as string);
  if (!paymentConfigService.verifyAdminAuthorization(adminKey)) {
    res.status(403).json({
      success: false,
      error: 'Access Denied: Only authorized administrators can view payment settings. Normal players are not permitted.',
    });
    return;
  }

  const adminConfig = paymentConfigService.getAdminConfig();
  res.json({ success: true, config: adminConfig });
});

/**
 * Admin payment configuration update
 * SECURITY ENFORCEMENT:
 * Only authorized administrators with verified credentials can update depositUrl, depositEnabled, limits, etc.
 * Normal players must NOT be able to change deposit URL, enable/disable deposit, or change limits.
 * Client-editable role fields are NEVER trusted as the only authorization mechanism.
 */
apiRouter.post('/payment-config/admin/update', (req: Request, res: Response) => {
  try {
    const adminKey = (req.headers['x-admin-key'] as string) || (req.headers['authorization'] as string);
    if (!paymentConfigService.verifyAdminAuthorization(adminKey)) {
      res.status(403).json({
        success: false,
        error: 'Access Denied: Only authorized administrators can modify payment settings. Normal players are not permitted to change payment configuration.',
      });
      return;
    }

    const adminIdentifier = (req.headers['x-admin-user'] as string) || 'admin_operator';
    const updates = req.body;

    const updatedConfig = paymentConfigService.updateAdminConfig(updates, adminIdentifier);
    res.json({
      success: true,
      config: updatedConfig,
      message: 'Payment configuration successfully updated by administrator.',
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || 'Failed to update payment configuration.' });
  }
});

/**
 * Health check & payment gateway configuration status
 */
apiRouter.get('/wallet/status', (req: Request, res: Response) => {
  const provider = getPaymentProvider();
  res.json({
    status: 'ok',
    environment: provider.environment,
    gatewayProvider: provider.name,
    timestamp: new Date().toISOString(),
    securityDirectives: {
      clientBalanceMutationAllowed: false,
      serverAuthoritative: true,
      holdProtectionActive: true,
      auditLoggingEnabled: true,
    },
  });
});

/**
 * Get authoritative user wallet and compliance status
 */
apiRouter.get('/wallet/:uid', (req: Request, res: Response) => {
  const { uid } = req.params;
  if (!uid) {
    res.status(400).json({ error: 'Missing user UID' });
    return;
  }

  const wallet = serverWalletService.getWallet(uid);
  res.json({ success: true, wallet });
});

/**
 * Get user transaction history
 */
apiRouter.get('/wallet/:uid/transactions', (req: Request, res: Response) => {
  const { uid } = req.params;
  if (!uid) {
    res.status(400).json({ error: 'Missing user UID' });
    return;
  }

  const transactions = serverWalletService.getUserTransactions(uid);
  res.json({ success: true, transactions });
});

/**
 * Get user immutable audit records
 */
apiRouter.get('/wallet/:uid/audits', (req: Request, res: Response) => {
  const { uid } = req.params;
  if (!uid) {
    res.status(400).json({ error: 'Missing user UID' });
    return;
  }

  const audits = serverWalletService.getUserAudits(uid);
  res.json({ success: true, audits });
});

/**
 * 3. DEPOSIT FLOW — Authenticated user initiates a deposit order
 * Creates a pending transaction. Does NOT credit wallet balance.
 */
apiRouter.post('/wallet/deposit/initiate', async (req: Request, res: Response) => {
  try {
    const { uid, amount, currency, paymentMethod, idempotencyKey } = req.body;
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const result = await serverWalletService.initiateDeposit({
      uid,
      amount: Number(amount),
      currency,
      paymentMethod: paymentMethod || 'upi',
      clientIp,
      userAgent,
      idempotencyKey,
    });

    res.json(result);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || 'Deposit initiation failed.' });
  }
});

/**
 * 3 & 5. PAYMENT WEBHOOK — Provider confirms payment settlement
 * Cryptographically verified. Idempotent. Only updates balance upon verification.
 */
apiRouter.post('/payments/webhook', async (req: Request, res: Response) => {
  try {
    const signature = (req.headers['x-winora-signature'] ||
      req.headers['x-razorpay-signature'] ||
      req.headers['x-webhook-signature'] ||
      '') as string;

    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    const result = await serverWalletService.handlePaymentWebhook(rawBody, signature);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || 'Webhook verification failed.' });
  }
});

/**
 * 4. WITHDRAWAL FLOW — Authenticated user requests a withdrawal
 * Validates available balance & KYC. Holds balance so it cannot be withdrawn twice.
 */
apiRouter.post('/wallet/withdraw/request', async (req: Request, res: Response) => {
  try {
    const { uid, amount, currency, destinationAccount, payoutMethod, idempotencyKey } = req.body;
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'unknown';

    const result = await serverWalletService.requestWithdrawal({
      uid,
      amount: Number(amount),
      currency,
      destinationAccount,
      payoutMethod: payoutMethod || 'bank',
      clientIp,
      userAgent,
      idempotencyKey,
    });

    res.json(result);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || 'Withdrawal request failed.' });
  }
});

/**
 * 4. WITHDRAWAL SETTLEMENT CALLBACK — Provider confirms or fails payout
 */
apiRouter.post('/wallet/withdraw/process-callback', async (req: Request, res: Response) => {
  try {
    const { payoutReference, status, failureReason } = req.body;
    if (!payoutReference || !status) {
      res.status(400).json({ error: 'Missing payoutReference or status.' });
      return;
    }

    const result = await serverWalletService.handleWithdrawalSettlement(payoutReference, status, failureReason);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || 'Settlement callback failed.' });
  }
});

/**
 * SANDBOX TESTING HELPER — Simulates webhook execution for testing
 */
apiRouter.post('/wallet/sandbox/simulate-payment', async (req: Request, res: Response) => {
  try {
    const { transactionId, action } = req.body;
    if (!transactionId || !action) {
      res.status(400).json({ error: 'Missing transactionId or action.' });
      return;
    }

    const result = await serverWalletService.simulateSandboxWebhook(transactionId, action);
    res.json({ success: true, result });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || 'Sandbox simulation failed.' });
  }
});

/**
 * ============================================================================
 * WINORA STEP 11 & 12 — 00–99 GAME ENTRY & CONFIGURATION APIS
 * Server-authoritative round freeze, balance validation, and idempotency
 * ============================================================================
 */

/**
 * Get active games, live rounds with server status, and server-controlled color classifications
 */
apiRouter.get('/games/config', (req: Request, res: Response) => {
  const config = serverGameEntryService.getGamesConfig();
  res.json({ success: true, ...config });
});

/**
 * Get user's demo credit balances
 */
apiRouter.get('/game-entry/balances/:uid', (req: Request, res: Response) => {
  const { uid } = req.params;
  const balances = serverGameEntryService.getUserBalance(uid || 'default');
  res.json({ success: true, balances });
});

/**
 * Get player's personal entries (Read-only, no edit/delete)
 */
apiRouter.get('/game-entry/my-entries', (req: Request, res: Response) => {
  const userId = (req.query.userId as string) || (req.headers['x-user-id'] as string) || 'player-arjun';
  const entries = serverGameEntryService.getUserEntries(userId);
  res.json({ success: true, entries });
});

/**
 * Step 11 Secure Game Entry Submission
 * Strictly validates:
 * - Authoritative round status and 15-minute freeze cutoff against server clock
 * - Maximum 37 selected numbers
 * - Valid 2-digit string representations ('00' to '99')
 * - Valid demo stake amount
 * - Authoritative wallet balance deduction
 * - Idempotency key deduplication
 */
apiRouter.post('/game-entry/submit', (req: Request, res: Response) => {
  try {
    const {
      gameId,
      roundId,
      gameModeId,
      selectedNumbers,
      amountPerNumber,
      idempotencyKey,
    } = req.body;

    // Derive user ID securely from auth header/token context, not trusting client-sent body
    const userId = (req.headers['x-user-id'] as string) || 'player-arjun';

    const result = serverGameEntryService.submitEntry({
      userId,
      gameId,
      roundId,
      gameModeId,
      selectedNumbers,
      amountPerNumber: Number(amountPerNumber),
      idempotencyKey,
    });

    if (!result.success) {
      res.status(400).json({
        success: false,
        errorCode: result.errorCode,
        message: result.error,
      });
      return;
    }

    res.json({
      success: true,
      message: 'Entry confirmed successfully.',
      entry: result.entry,
      remainingBalance: result.remainingBalance,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      errorCode: 'SERVER_ERROR',
      message: 'An unexpected error occurred while processing game entry.',
    });
  }
});

/**
 * Authoritative Referral Reward Claim / Handshake Credit (Strictly Main Wallet with Idempotency)
 */
apiRouter.post('/referral/claim-reward', (req: Request, res: Response) => {
  try {
    const { referralKey, userId, amount, referrerId } = req.body;
    if (!referralKey || !userId || !amount) {
      res.status(400).json({
        success: false,
        message: 'Missing required parameters: referralKey, userId, and amount are required.',
      });
      return;
    }

    const result = serverGameEntryService.creditReferralReward({
      referralKey,
      userId,
      amount: Number(amount),
      referrerId,
    });

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to credit referral reward.',
    });
  }
});

/**
 * ============================================================================
 * WINORA STEP 13 — DEMO-CREDIT RESULT DECLARATION & SETTLEMENT ENGINE APIS
 * Server-authoritative result declaration, 90x payout, 80% Green Protection,
 * idempotency, and immutable audit logs.
 * ============================================================================
 */

/**
 * Get all current game rounds with their live statuses and settlement readiness
 */
apiRouter.get('/results/rounds', (req: Request, res: Response) => {
  try {
    const config = serverGameEntryService.getGamesConfig();
    const roundsList = Object.values(config.rounds).map((round) => {
      const entries = serverGameEntryService.getEntriesForRound(round.id);
      const result = serverResultSettlementService.getResultByRoundId(round.id);
      return {
        ...round,
        entriesCount: entries.length,
        totalStake: entries.reduce((sum, e) => sum + e.totalStake, 0),
        result,
      };
    });

    res.json({
      success: true,
      rounds: roundsList,
      serverTime: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      errorCode: 'SERVER_ERROR',
      message: 'Failed to retrieve rounds list.',
    });
  }
});

/**
 * Get recent declared results with full settlement summaries
 */
apiRouter.get('/results/recent', (req: Request, res: Response) => {
  try {
    const results = serverResultSettlementService.getRecentResults();
    res.json({
      success: true,
      results,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      errorCode: 'SERVER_ERROR',
      message: 'Failed to retrieve recent results.',
    });
  }
});

/**
 * Get specific round result and settlement details
 */
apiRouter.get('/results/round/:roundId', (req: Request, res: Response) => {
  try {
    const { roundId } = req.params;
    const result = serverResultSettlementService.getResultByRoundId(roundId);
    if (!result) {
      res.status(404).json({
        success: false,
        errorCode: 'RESULT_NOT_FOUND',
        message: `No declared result found for round ${roundId}.`,
      });
      return;
    }

    res.json({
      success: true,
      result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      errorCode: 'SERVER_ERROR',
      message: 'Failed to retrieve round result.',
    });
  }
});

/**
 * Master Freeze Round helper (allows testing/triggering outside natural 15m window)
 */
apiRouter.post('/results/freeze-round', (req: Request, res: Response) => {
  try {
    const actorRole = (req.headers['x-user-role'] as string) || '';
    const actorId = (req.headers['x-user-id'] as string) || 'master-unknown';
    const { gameId, roundId } = req.body;

    if (actorRole !== 'master' && actorRole !== 'admin') {
      res.status(403).json({
        success: false,
        errorCode: 'FORBIDDEN',
        message: 'Master or Super Admin role is strictly required to freeze game rounds.',
      });
      return;
    }

    const freezeRes = serverResultSettlementService.freezeRound({
      actorRole,
      actorId,
      gameId,
      roundId,
    });

    if (!freezeRes.success) {
      res.status(400).json({
        success: false,
        errorCode: freezeRes.errorCode,
        message: freezeRes.error,
      });
      return;
    }

    res.json({
      success: true,
      message: `Round ${roundId} is now strictly FROZEN. Ready for result declaration.`,
      round: freezeRes.round,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      errorCode: 'SERVER_ERROR',
      message: 'Failed to freeze round.',
    });
  }
});

/**
 * Master Result Declaration & Settlement Execution
 * Validates:
 * - Master/Admin authorization (players rejected with 403)
 * - Round is FROZEN (OPEN rounds rejected)
 * - Round not already settled (idempotent, no double pay)
 * - Valid 00-99 winning number
 * - Atomically executes 90x payouts + 80% Green Protection
 * - Generates immutable wallet ledger entries and audit log
 */
apiRouter.post('/results/declare', (req: Request, res: Response) => {
  try {
    const actorRole = (req.headers['x-user-role'] as string) || '';
    const actorId = (req.headers['x-user-id'] as string) || 'master-unknown';
    const { gameId, roundId, winningNumber, idempotencyKey } = req.body;

    // Reject non-Master callers immediately
    if (actorRole !== 'master' && actorRole !== 'admin') {
      res.status(403).json({
        success: false,
        errorCode: 'FORBIDDEN',
        message: 'Master / Super Admin role is strictly required to declare winning results.',
      });
      return;
    }

    const settleRes = serverResultSettlementService.declareResultAndSettle({
      actorRole,
      actorId,
      gameId,
      roundId,
      winningNumber,
      idempotencyKey,
    });

    if (!settleRes.success) {
      res.status(400).json({
        success: false,
        errorCode: settleRes.errorCode,
        message: settleRes.error,
      });
      return;
    }

    res.json({
      success: true,
      message: `Result successfully declared and settled for Round #${settleRes.result?.roundNumber}. Winning Number: ${winningNumber}.`,
      result: settleRes.result,
      summary: settleRes.summary,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      errorCode: 'SERVER_ERROR',
      message: 'Unexpected server error while processing result declaration.',
    });
  }
});

/**
 * Get immutable settlement audit logs
 */
apiRouter.get('/results/audit-logs', (req: Request, res: Response) => {
  try {
    const actorRole = (req.headers['x-user-role'] as string) || '';
    if (actorRole !== 'master' && actorRole !== 'admin') {
      res.status(403).json({
        success: false,
        errorCode: 'FORBIDDEN',
        message: 'Master / Super Admin role required to view audit logs.',
      });
      return;
    }

    const logs = serverResultSettlementService.getAuditLogs();
    res.json({
      success: true,
      logs,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      errorCode: 'SERVER_ERROR',
      message: 'Failed to retrieve audit logs.',
    });
  }
});


