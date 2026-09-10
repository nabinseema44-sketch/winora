import crypto from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebaseAdmin.ts';
import { getPaymentProvider, PaymentGatewayProvider } from './paymentProvider.ts';
import { paymentConfigService } from './paymentConfigService.ts';

export type KycStatus = 'not_submitted' | 'pending' | 'verified' | 'rejected';
export type AccountVerificationStatus = 'unverified' | 'verified' | 'restricted';
export type TransactionType = 'deposit' | 'withdrawal' | 'game_debit' | 'game_reward' | 'referral_reward';
export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'cancelled';
export type AuditOperation = 'deposit_credit' | 'withdrawal_hold' | 'withdrawal_debit' | 'withdrawal_release_failed' | 'game_debit' | 'game_reward' | 'referral_reward';

export interface WalletRecord { uid: string; currency: string; balance: number; heldBalance: number; kycStatus: KycStatus; withdrawalEligibility: boolean; accountVerificationStatus: AccountVerificationStatus; createdAt: string; updatedAt: string; }
export interface TransactionRecord { transactionId: string; uid: string; type: TransactionType; amount: number; currency: string; status: TransactionStatus; paymentMethod: string; providerReference: string; idempotencyKey: string; destinationAccount?: string; failureReason?: string; auditReference?: string; clientIp?: string; userAgent?: string; createdAt: string; updatedAt: string; }
export interface AuditRecord { auditId: string; uid: string; transactionId: string; operation: AuditOperation; amount: number; previousBalance: number; newBalance: number; timestamp: string; sourceReference: string; }

const walletRef = (uid: string) => adminDb.collection('wallets').doc(uid);
const txRef = (id: string) => adminDb.collection('transactions').doc(id);
const auditRef = (id: string) => adminDb.collection('wallet_audits').doc(id);
const idempotencyRef = (key: string) => adminDb.collection('wallet_idempotency').doc(crypto.createHash('sha256').update(key).digest('hex'));

class ServerWalletService {
  private paymentProvider: PaymentGatewayProvider;

  constructor() { this.paymentProvider = getPaymentProvider(); }

  private newWallet(uid: string, currency = 'INR'): WalletRecord {
    const now = new Date().toISOString();
    return { uid, currency, balance: 5000, heldBalance: 0, kycStatus: 'verified', withdrawalEligibility: true, accountVerificationStatus: 'verified', createdAt: now, updatedAt: now };
  }

  public async getOrCreateWallet(uid: string, currency = 'INR'): Promise<WalletRecord> {
    if (!uid) throw new Error('Authentication required.');
    const ref = walletRef(uid);
    const snap = await ref.get();
    if (snap.exists) return snap.data() as WalletRecord;
    const wallet = this.newWallet(uid, currency);
    await ref.create(wallet);
    return wallet;
  }

  public async getWallet(uid: string) {
    const wallet = await this.getOrCreateWallet(uid);
    return { ...wallet, availableBalance: Math.max(0, wallet.balance - wallet.heldBalance) };
  }

  public async debitForGame(params: { uid: string; amount: number; idempotencyKey: string; gameId: string; roundId: string; }): Promise<{ wallet: WalletRecord; transactionId: string; duplicate: boolean }> {
    const { uid, amount, idempotencyKey, gameId, roundId } = params;
    if (!uid || !Number.isFinite(amount) || amount <= 0) throw new Error('Invalid wallet debit.');
    if (!idempotencyKey) throw new Error('Idempotency key is required.');
    const idem = idempotencyRef(`game:${uid}:${idempotencyKey}`);
    const wallet = walletRef(uid);
    const transactionId = `TX-GAME-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    const tx = txRef(transactionId);
    const auditId = `AUD-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    const audit = auditRef(auditId);
    const now = new Date().toISOString();

    return adminDb.runTransaction(async (t) => {
      const idemSnap = await t.get(idem);
      if (idemSnap.exists) {
        const prior = idemSnap.data() as { transactionId: string };
        const priorTx = await t.get(txRef(prior.transactionId));
        const priorWallet = await t.get(wallet);
        return { wallet: priorWallet.data() as WalletRecord, transactionId: prior.transactionId, duplicate: true };
      }
      const walletSnap = await t.get(wallet);
      const current = walletSnap.exists ? walletSnap.data() as WalletRecord : this.newWallet(uid);
      const available = current.balance - current.heldBalance;
      if (available < amount) throw new Error(`Insufficient demo credits in Main Wallet. Required: ₹${amount.toLocaleString()}, Available: ₹${available.toLocaleString()}.`);
      const updated: WalletRecord = { ...current, balance: Number((current.balance - amount).toFixed(2)), updatedAt: now };
      const record: TransactionRecord = { transactionId, uid, type: 'game_debit', amount, currency: current.currency, status: 'completed', paymentMethod: 'Main Wallet', providerReference: `${gameId}:${roundId}`, idempotencyKey, createdAt: now, updatedAt: now };
      const auditRecord: AuditRecord = { auditId, uid, transactionId, operation: 'game_debit', amount, previousBalance: current.balance, newBalance: updated.balance, timestamp: now, sourceReference: `game:${gameId}:${roundId}` };
      t.set(wallet, updated, { merge: true });
      t.create(tx, record);
      t.create(audit, auditRecord);
      t.create(idem, { transactionId, uid, createdAt: now, operation: 'game_debit' });
      return { wallet: updated, transactionId, duplicate: false };
    });
  }

  public async creditGameReward(params: { uid: string; amount: number; idempotencyKey: string; sourceReference: string; }): Promise<{ wallet: WalletRecord; transactionId: string; duplicate: boolean }> {
    const { uid, amount, idempotencyKey, sourceReference } = params;
    if (!uid || !Number.isFinite(amount) || amount <= 0) throw new Error('Invalid wallet credit.');
    if (!idempotencyKey) throw new Error('Idempotency key is required.');
    const idem = idempotencyRef(`reward:${uid}:${idempotencyKey}`);
    const wallet = walletRef(uid);
    const transactionId = `TX-REWARD-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    const tx = txRef(transactionId);
    const auditId = `AUD-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
    const audit = auditRef(auditId);
    const now = new Date().toISOString();
    return adminDb.runTransaction(async (t) => {
      const idemSnap = await t.get(idem);
      if (idemSnap.exists) {
        const prior = idemSnap.data() as { transactionId: string };
        const priorWallet = await t.get(wallet);
        return { wallet: priorWallet.data() as WalletRecord, transactionId: prior.transactionId, duplicate: true };
      }
      const walletSnap = await t.get(wallet);
      const current = walletSnap.exists ? walletSnap.data() as WalletRecord : this.newWallet(uid);
      const updated: WalletRecord = { ...current, balance: Number((current.balance + amount).toFixed(2)), updatedAt: now };
      const record: TransactionRecord = { transactionId, uid, type: 'game_reward', amount, currency: current.currency, status: 'completed', paymentMethod: 'Main Wallet', providerReference: sourceReference, idempotencyKey, createdAt: now, updatedAt: now };
      const auditRecord: AuditRecord = { auditId, uid, transactionId, operation: 'game_reward', amount, previousBalance: current.balance, newBalance: updated.balance, timestamp: now, sourceReference };
      t.set(wallet, updated, { merge: true });
      t.create(tx, record);
      t.create(audit, auditRecord);
      t.create(idem, { transactionId, uid, createdAt: now, operation: 'game_reward' });
      return { wallet: updated, transactionId, duplicate: false };
    });
  }

  public async creditReferralReward(params: { referralKey: string; userId: string; amount: number; referrerId?: string }): Promise<{ success: boolean; message: string; remainingBalance?: { main: number } }> {
    if (!Number.isFinite(params.amount) || params.amount <= 0) throw new Error('Invalid referral reward amount.');
    const first = await this.creditGameReward({ uid: params.userId, amount: params.amount, idempotencyKey: `referral:${params.referralKey}:referred`, sourceReference: `referral:${params.referralKey}` });
    let final = first.wallet;
    if (params.referrerId) {
      const second = await this.creditGameReward({ uid: params.referrerId, amount: params.amount, idempotencyKey: `referral:${params.referralKey}:referrer`, sourceReference: `referral:${params.referralKey}` });
      final = second.wallet;
    }
    return { success: !first.duplicate, message: first.duplicate ? 'This referral reward has already been credited.' : `Referral reward credited to Main Wallet (Key: ${params.referralKey}).`, remainingBalance: { main: final.balance } };
  }

  public async getUserTransactions(uid: string): Promise<TransactionRecord[]> {
    const snap = await adminDb.collection('transactions').where('uid', '==', uid).orderBy('createdAt', 'desc').limit(200).get();
    return snap.docs.map(d => d.data() as TransactionRecord);
  }

  public async getUserAudits(uid: string): Promise<AuditRecord[]> {
    const snap = await adminDb.collection('wallet_audits').where('uid', '==', uid).orderBy('timestamp', 'desc').limit(200).get();
    return snap.docs.map(d => d.data() as AuditRecord);
  }

  public async initiateDeposit(_params: any) { throw new Error('VIRTUAL_ONLY'); }
  public async requestWithdrawal(_params: any) { throw new Error('VIRTUAL_ONLY'); }
  public async handleWithdrawalSettlement(_payoutReference: string, _status: 'completed' | 'failed', _failureReason?: string) { throw new Error('VIRTUAL_ONLY'); }
  public async handlePaymentWebhook(_rawBody: string, _signature: string) { throw new Error('VIRTUAL_ONLY'); }

  public async simulateSandboxWebhook(_transactionId: string, _action: 'confirm_payment' | 'decline_payment' | 'confirm_payout' | 'decline_payout') {
    if (process.env.NODE_ENV === 'production') throw new Error('NOT_FOUND');
    throw new Error('VIRTUAL_ONLY');
  }
}

export const serverWalletService = new ServerWalletService();
