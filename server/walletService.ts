import crypto from 'crypto';
import { getPaymentProvider, type PaymentGatewayProvider } from './paymentProvider.ts';
import { paymentConfigService } from './paymentConfigService.ts';

export type KycStatus = 'not_submitted' | 'pending' | 'verified' | 'rejected';
export type AccountVerificationStatus = 'unverified' | 'verified' | 'restricted';
export type TransactionType = 'deposit' | 'withdrawal';
export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'cancelled';
export type AuditOperation = 'deposit_credit' | 'withdrawal_hold' | 'withdrawal_debit' | 'withdrawal_release_failed';

export interface WalletRecord {
  uid: string;
  currency: string;
  balance: number;
  heldBalance: number;
  kycStatus: KycStatus;
  withdrawalEligibility: boolean;
  accountVerificationStatus: AccountVerificationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionRecord {
  transactionId: string;
  uid: string;
  type: TransactionType;
  amount: number;
  currency: string;
  status: TransactionStatus;
  paymentMethod: string;
  providerReference: string;
  idempotencyKey: string;
  destinationAccount?: string;
  failureReason?: string;
  auditReference?: string;
  clientIp?: string;
  userAgent?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditRecord {
  auditId: string;
  uid: string;
  transactionId: string;
  operation: AuditOperation;
  amount: number;
  previousBalance: number;
  newBalance: number;
  timestamp: string;
  sourceReference: string;
}

/**
 * Server-Authoritative Wallet Service
 * Enforces atomic state transitions, strict idempotency, hold reservations,
 * and immutable audit trail generation.
 *
 * CRITICAL SECURITY DIRECTIVE:
 * Frontend/client code has ZERO authority to mutate balances or write transactions.
 * All mutations are processed exclusively within this server service.
 */
class ServerWalletService {
  private wallets: Map<string, WalletRecord> = new Map();
  private transactions: Map<string, TransactionRecord> = new Map();
  private audits: AuditRecord[] = [];
  private processedWebhookEvents: Set<string> = new Set();
  private paymentProvider: PaymentGatewayProvider;

  constructor() {
    this.paymentProvider = getPaymentProvider();
    this.seedDefaultWallets();
  }

  /**
   * Seeds demo data for verified player testing
   */
  private seedDefaultWallets() {
    const demoUid = 'demo-player-uid-123';
    this.wallets.set(demoUid, {
      uid: demoUid,
      currency: 'INR',
      balance: 2500,
      heldBalance: 0,
      kycStatus: 'verified',
      withdrawalEligibility: true,
      accountVerificationStatus: 'verified',
      createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Seed sample initial transaction
    const initialTxId = 'TXN-INIT-9001';
    this.transactions.set(initialTxId, {
      transactionId: initialTxId,
      uid: demoUid,
      type: 'deposit',
      amount: 2500,
      currency: 'INR',
      status: 'completed',
      paymentMethod: 'UPI Instant (Verified)',
      providerReference: 'PAY-GATE-INR-882201',
      idempotencyKey: 'idemp-init-882201',
      createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    });

    this.audits.push({
      auditId: `AUD-${Date.now()}-001`,
      uid: demoUid,
      transactionId: initialTxId,
      operation: 'deposit_credit',
      amount: 2500,
      previousBalance: 0,
      newBalance: 2500,
      timestamp: new Date(Date.now() - 7 * 86400000).toISOString(),
      sourceReference: 'webhook:PAY-GATE-INR-882201',
    });
  }

  /**
   * Retrieves or initializes a wallet for an authenticated user.
   */
  public getOrCreateWallet(uid: string, currency = 'INR'): WalletRecord {
    let wallet = this.wallets.get(uid);
    if (!wallet) {
      wallet = {
        uid,
        currency,
        balance: 1000,
        heldBalance: 0,
        kycStatus: 'verified', // Set to verified so player can test both deposit & withdrawal flows
        withdrawalEligibility: true,
        accountVerificationStatus: 'verified',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      this.wallets.set(uid, wallet);
    }
    return wallet;
  }

  /**
   * Get wallet with calculated available balance
   */
  public getWallet(uid: string) {
    const wallet = this.getOrCreateWallet(uid);
    return {
      ...wallet,
      availableBalance: Math.max(0, wallet.balance - (wallet.heldBalance || 0)),
    };
  }

  /**
   * 3. DEPOSIT FLOW — INITIATION
   * Authenticated user requests a deposit.
   * Backend validates amount.
   * Backend creates a pending transaction.
   * Payment provider creates payment order/intent.
   * Wallet balance is NOT updated here.
   */
  public async initiateDeposit(params: {
    uid: string;
    amount: number;
    currency?: string;
    paymentMethod: string;
    clientIp?: string;
    userAgent?: string;
    idempotencyKey?: string;
  }) {
    const { uid, amount, paymentMethod, clientIp, userAgent } = params;
    const currency = params.currency || 'INR';

    // 0. Configuration check (Step 8 & 10: WINORA Configurable Deposit)
    const paymentConfig = paymentConfigService.getAdminConfig();
    if (!paymentConfig.depositEnabled) {
      throw new Error('Deposit is currently unavailable.');
    }
    if (paymentConfig.depositProvider === 'external_link') {
      const trimmedUrl = (paymentConfig.depositUrl || '').trim();
      if (!trimmedUrl || (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://'))) {
        throw new Error('Deposit is currently unavailable.');
      }
    }

    // 1. Strict Validation
    if (!uid || typeof uid !== 'string') {
      throw new Error('Authentication required: Invalid or missing user UID.');
    }
    if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
      throw new Error('Deposit amount must be a positive number.');
    }
    if (amount < (paymentConfig.depositMinAmount || 100)) {
      throw new Error(`Minimum deposit amount is ${(paymentConfig.depositMinAmount || 100).toFixed(2)}.`);
    }
    if (amount > (paymentConfig.depositMaxAmount || 100000)) {
      throw new Error(`Maximum single deposit transaction limit is ${(paymentConfig.depositMaxAmount || 100000).toFixed(2)}.`);
    }

    // 2. Idempotency Check on Request
    const key = params.idempotencyKey || `DEP-IDEMP-${uid}-${Date.now()}`;
    for (const [, txn] of this.transactions) {
      if (txn.idempotencyKey === key && txn.uid === uid) {
        return {
          transaction: txn,
          isDuplicate: true,
          instructions: 'Existing pending deposit retrieved via idempotency key.',
        };
      }
    }

    // Ensure wallet exists
    this.getOrCreateWallet(uid, currency);

    // 3. Generate unique transaction ID
    const transactionId = `TXN-DEP-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

    // 4. Request order from Payment Provider
    const providerOrder = await this.paymentProvider.createDepositOrder({
      transactionId,
      amount,
      currency,
      uid,
      paymentMethod: paymentConfig.depositProvider === 'external_link' ? 'Configured External Provider' : paymentMethod,
    });

    // 5. Store pending transaction
    const newTransaction: TransactionRecord = {
      transactionId,
      uid,
      type: 'deposit',
      amount,
      currency,
      status: 'pending',
      paymentMethod: paymentConfig.depositProvider === 'external_link' ? 'Configured External Link' : paymentMethod,
      providerReference: providerOrder.providerReference,
      idempotencyKey: key,
      clientIp,
      userAgent,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.transactions.set(transactionId, newTransaction);

    let destinationUrl: string | undefined;
    if (paymentConfig.depositProvider === 'external_link') {
      const trimmedUrl = paymentConfig.depositUrl.trim();
      const sep = trimmedUrl.includes('?') ? '&' : '?';
      destinationUrl = `${trimmedUrl}${sep}order_id=${encodeURIComponent(transactionId)}&uid=${encodeURIComponent(uid)}&amount=${amount}&currency=${encodeURIComponent(currency)}&ref=${encodeURIComponent(providerOrder.providerReference)}`;
    }

    return {
      success: true,
      transactionId,
      orderId: providerOrder.orderId,
      providerReference: providerOrder.providerReference,
      amount,
      currency,
      paymentMethod: newTransaction.paymentMethod,
      depositProvider: paymentConfig.depositProvider,
      depositUrl: paymentConfig.depositUrl,
      destinationUrl,
      checkoutPayload: providerOrder.checkoutPayload,
      idempotencyKey: key,
      instructions:
        paymentConfig.depositProvider === 'external_link'
          ? 'Deposit order registered. Opening configured destination link. Note: opening the link does NOT automatically credit your wallet. Balance will only update after cryptographic provider webhook confirmation.'
          : 'Deposit order registered in pending state. Awaiting provider webhook settlement.',
    };
  }

  /**
   * 3 & 5. DEPOSIT FLOW — WEBHOOK VERIFICATION & IDEMPOTENT CREDITING
   * Only after verified payment confirmation should wallet balance be updated.
   * Never credit wallet based solely on frontend success message.
   */
  public async handlePaymentWebhook(rawBody: string, signature: string) {
    // 1. Verify cryptographic provider signature
    const verification = this.paymentProvider.verifyWebhookSignature(rawBody, signature);
    if (!verification.isValid) {
      throw new Error('Webhook rejected: Invalid cryptographic provider signature.');
    }

    const { providerReference, transactionId, event } = verification;
    const eventHash = crypto
      .createHash('sha256')
      .update(`${providerReference}|${event}|${rawBody}`)
      .digest('hex');

    // 2. Strict Idempotency Check: Prevent duplicate webhook execution
    if (this.processedWebhookEvents.has(eventHash)) {
      return {
        acknowledged: true,
        idempotent: true,
        message: 'Webhook event already processed previously. No balance duplicate change.',
      };
    }

    // 3. Find matching transaction by transactionId or providerReference
    let matchedTxn: TransactionRecord | undefined;
    if (transactionId && this.transactions.has(transactionId)) {
      matchedTxn = this.transactions.get(transactionId);
    } else {
      for (const [, txn] of this.transactions) {
        if (txn.providerReference === providerReference) {
          matchedTxn = txn;
          break;
        }
      }
    }

    if (!matchedTxn) {
      throw new Error(`Transaction matching provider reference ${providerReference} not found.`);
    }

    // 4. Check if transaction is already completed (Double-credit guard)
    if (matchedTxn.status === 'completed') {
      this.processedWebhookEvents.add(eventHash);
      return {
        acknowledged: true,
        idempotent: true,
        transactionId: matchedTxn.transactionId,
        message: 'Transaction is already completed. Balance preserved.',
      };
    }

    // 5. Handle Event
    if (event === 'payment.captured') {
      const wallet = this.getOrCreateWallet(matchedTxn.uid, matchedTxn.currency);
      const previousBalance = wallet.balance;
      const newBalance = previousBalance + matchedTxn.amount;

      // Atomic balance update
      wallet.balance = newBalance;
      wallet.updatedAt = new Date().toISOString();

      // Update transaction status
      matchedTxn.status = 'completed';
      matchedTxn.updatedAt = new Date().toISOString();

      // 10. AUDIT TRAIL: Create immutable balance mutation record
      const auditId = `AUD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const auditRecord: AuditRecord = {
        auditId,
        uid: matchedTxn.uid,
        transactionId: matchedTxn.transactionId,
        operation: 'deposit_credit',
        amount: matchedTxn.amount,
        previousBalance,
        newBalance,
        timestamp: new Date().toISOString(),
        sourceReference: `webhook:${providerReference}`,
      };
      this.audits.push(auditRecord);
      matchedTxn.auditReference = auditId;

      this.processedWebhookEvents.add(eventHash);

      return {
        acknowledged: true,
        status: 'completed',
        transactionId: matchedTxn.transactionId,
        amount: matchedTxn.amount,
        newBalance,
        auditId,
      };
    } else if (event === 'payment.failed') {
      matchedTxn.status = 'failed';
      matchedTxn.failureReason = verification.errorMessage || 'Provider declined payment authorization.';
      matchedTxn.updatedAt = new Date().toISOString();
      this.processedWebhookEvents.add(eventHash);

      return {
        acknowledged: true,
        status: 'failed',
        transactionId: matchedTxn.transactionId,
      };
    }

    return { acknowledged: true, event };
  }

  /**
   * 4. WITHDRAWAL FLOW — SUBMISSION & BALANCE HOLD
   * Authenticated user requests a withdrawal.
   * Backend validates amount and available balance.
   * Reserves/holds the amount so it cannot be withdrawn twice.
   * Creates pending transaction.
   */
  public async requestWithdrawal(params: {
    uid: string;
    amount: number;
    currency?: string;
    destinationAccount: string;
    payoutMethod: 'bank' | 'upi';
    clientIp?: string;
    userAgent?: string;
    idempotencyKey?: string;
  }) {
    const { uid, amount, destinationAccount, payoutMethod, clientIp, userAgent } = params;
    const currency = params.currency || 'INR';

    // 0. Configuration check (Step 8: WINORA Configurable Withdrawal)
    const paymentConfig = paymentConfigService.getAdminConfig();
    if (!paymentConfig.withdrawalEnabled) {
      throw new Error('Withdrawal service is currently unavailable. Please try again later.');
    }

    // 1. Strict Validation
    if (!uid || typeof uid !== 'string') {
      throw new Error('Authentication required: Invalid or missing user UID.');
    }
    if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
      throw new Error('Withdrawal amount must be a positive number.');
    }
    if (amount < (paymentConfig.withdrawalMinAmount || 100)) {
      throw new Error(`Minimum withdrawal amount is ${(paymentConfig.withdrawalMinAmount || 100).toFixed(2)}.`);
    }
    if (amount > (paymentConfig.withdrawalMaxAmount || 50000)) {
      throw new Error(`Maximum withdrawal amount is ${(paymentConfig.withdrawalMaxAmount || 50000).toFixed(2)}.`);
    }
    if (!destinationAccount || destinationAccount.trim().length < 4) {
      throw new Error('Valid destination bank account or UPI ID is required.');
    }

    // 2. Wallet Check (Step 8: Do NOT add KYC)
    const wallet = this.getOrCreateWallet(uid, currency);

    // 3. Available Balance Validation (Balance minus already held funds)
    const availableBalance = wallet.balance - (wallet.heldBalance || 0);
    if (amount > availableBalance) {
      throw new Error(
        `Insufficient available funds. Requested: ${amount}, Available: ${availableBalance} (Held: ${wallet.heldBalance || 0}).`
      );
    }

    // 4. Reserve / Hold Funds (Anti-double spend protection)
    wallet.heldBalance = (wallet.heldBalance || 0) + amount;
    wallet.updatedAt = new Date().toISOString();

    // 5. Generate transaction & call provider payout API
    const transactionId = `TXN-WTH-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
    const payoutResult = await this.paymentProvider.initiatePayout({
      transactionId,
      amount,
      currency,
      uid,
      destinationAccount,
      payoutMethod,
    });

    // 6. Create pending withdrawal transaction
    const newTransaction: TransactionRecord = {
      transactionId,
      uid,
      type: 'withdrawal',
      amount,
      currency,
      status: 'pending',
      paymentMethod: payoutMethod === 'bank' ? 'Bank Transfer (IMPS Payout)' : 'UPI Instant Payout',
      providerReference: payoutResult.providerReference,
      destinationAccount: destinationAccount.startsWith('••••')
        ? destinationAccount
        : `•••• ${destinationAccount.slice(-4)}`,
      idempotencyKey: params.idempotencyKey || `WTH-IDEMP-${uid}-${Date.now()}`,
      clientIp,
      userAgent,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.transactions.set(transactionId, newTransaction);

    // 10. Audit Record for Hold Placement
    const auditId = `AUD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    this.audits.push({
      auditId,
      uid,
      transactionId,
      operation: 'withdrawal_hold',
      amount,
      previousBalance: wallet.balance,
      newBalance: wallet.balance, // Total balance unchanged, held balance increased
      timestamp: new Date().toISOString(),
      sourceReference: `reserve_hold:${transactionId}`,
    });

    return {
      success: true,
      transactionId,
      providerReference: payoutResult.providerReference,
      amount,
      currency,
      heldBalance: wallet.heldBalance,
      availableBalance: wallet.balance - wallet.heldBalance,
      status: 'pending',
      message: 'Withdrawal requested and funds placed on secure reservation hold pending settlement.',
    };
  }

  /**
   * 4. WITHDRAWAL FLOW — SETTLEMENT CALLBACK & COMPLETION / REVERSAL
   * When provider confirms payout completion -> balance deducted and hold released.
   * When provider fails payout -> hold released, balance restored.
   */
  public async handleWithdrawalSettlement(payoutReference: string, status: 'completed' | 'failed', failureReason?: string) {
    let matchedTxn: TransactionRecord | undefined;
    for (const [, txn] of this.transactions) {
      if (txn.providerReference === payoutReference || txn.transactionId === payoutReference) {
        matchedTxn = txn;
        break;
      }
    }

    if (!matchedTxn) {
      throw new Error(`Withdrawal transaction matching ${payoutReference} not found.`);
    }

    if (matchedTxn.status === 'completed' || matchedTxn.status === 'failed') {
      return {
        acknowledged: true,
        idempotent: true,
        message: 'Withdrawal settlement already finalized previously.',
      };
    }

    const wallet = this.getOrCreateWallet(matchedTxn.uid, matchedTxn.currency);

    if (status === 'completed') {
      const previousBalance = wallet.balance;
      const newBalance = Math.max(0, previousBalance - matchedTxn.amount);

      // Deduct balance and release hold
      wallet.balance = newBalance;
      wallet.heldBalance = Math.max(0, (wallet.heldBalance || 0) - matchedTxn.amount);
      wallet.updatedAt = new Date().toISOString();

      matchedTxn.status = 'completed';
      matchedTxn.updatedAt = new Date().toISOString();

      // Audit Record
      const auditId = `AUD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      this.audits.push({
        auditId,
        uid: matchedTxn.uid,
        transactionId: matchedTxn.transactionId,
        operation: 'withdrawal_debit',
        amount: matchedTxn.amount,
        previousBalance,
        newBalance,
        timestamp: new Date().toISOString(),
        sourceReference: `payout_settlement:${payoutReference}`,
      });
      matchedTxn.auditReference = auditId;

      return {
        acknowledged: true,
        status: 'completed',
        transactionId: matchedTxn.transactionId,
        newBalance,
        heldBalance: wallet.heldBalance,
      };
    } else {
      // Failed settlement: Release held amount without debiting total balance
      wallet.heldBalance = Math.max(0, (wallet.heldBalance || 0) - matchedTxn.amount);
      wallet.updatedAt = new Date().toISOString();

      matchedTxn.status = 'failed';
      matchedTxn.failureReason = failureReason || 'Bank settlement network rejected payout request.';
      matchedTxn.updatedAt = new Date().toISOString();

      // Audit Record for hold release
      const auditId = `AUD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      this.audits.push({
        auditId,
        uid: matchedTxn.uid,
        transactionId: matchedTxn.transactionId,
        operation: 'withdrawal_release_failed',
        amount: matchedTxn.amount,
        previousBalance: wallet.balance,
        newBalance: wallet.balance,
        timestamp: new Date().toISOString(),
        sourceReference: `payout_failed_release:${payoutReference}`,
      });

      return {
        acknowledged: true,
        status: 'failed',
        transactionId: matchedTxn.transactionId,
        heldBalance: wallet.heldBalance,
        availableBalance: wallet.balance - wallet.heldBalance,
      };
    }
  }

  /**
   * Returns transactions for a specific user.
   */
  public getUserTransactions(uid: string): TransactionRecord[] {
    const userTxns: TransactionRecord[] = [];
    for (const [, txn] of this.transactions) {
      if (txn.uid === uid) {
        userTxns.push(txn);
      }
    }
    // Return sorted newest first
    return userTxns.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Returns audit records for a specific user.
   */
  public getUserAudits(uid: string): AuditRecord[] {
    return this.audits
      .filter((a) => a.uid === uid)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Sandbox Testing Simulator:
   * Allows safe simulation of payment gateway webhook confirmation or failure
   * for non-production environments.
   */
  public async simulateSandboxWebhook(transactionId: string, action: 'confirm_payment' | 'decline_payment' | 'confirm_payout' | 'decline_payout') {
    const txn = this.transactions.get(transactionId);
    if (!txn) {
      throw new Error(`Transaction ${transactionId} not found.`);
    }

    if (action === 'confirm_payment' || action === 'decline_payment') {
      const event = action === 'confirm_payment' ? 'payment.captured' : 'payment.failed';
      return this.handlePaymentWebhook(
        JSON.stringify({
          event,
          providerReference: txn.providerReference,
          transactionId: txn.transactionId,
          amount: txn.amount,
          currency: txn.currency,
          status: action === 'confirm_payment' ? 'captured' : 'failed',
        }),
        'sandbox-verified-signature'
      );
    } else {
      const status = action === 'confirm_payout' ? 'completed' : 'failed';
      return this.handleWithdrawalSettlement(txn.providerReference, status);
    }
  }
}

export const serverWalletService = new ServerWalletService();
