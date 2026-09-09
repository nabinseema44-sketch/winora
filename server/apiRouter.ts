import { Router, Request, Response } from 'express';
import { serverWalletService } from './walletService.ts';
import { getPaymentProvider } from './paymentProvider.ts';
import { paymentConfigService } from './paymentConfigService.ts';

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
