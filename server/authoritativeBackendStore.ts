import crypto from 'crypto';
import { getAdminDb } from './firebaseAdmin.ts';

export interface AuthoritativeWallet {
  uid: string;
  balance: number;
  bonusBalance: number;
  currency: 'COIN';
  updatedAt: string;
}

export interface AuthoritativeLedgerEntry {
  id: string;
  userId: string;
  type: 'GAME_STAKE' | 'GAME_WIN' | 'HOURLY_PROTECTION_REFUND' | 'MASTER_TO_AGENT' | 'AGENT_TO_PLAYER' | 'PLAYER_TO_AGENT' | 'AGENT_TO_MASTER' | 'MASTER_ADJUSTMENT' | 'HELPER_GIFT' | 'REFERRAL_REWARD';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  bonusBalanceBefore?: number;
  bonusBalanceAfter?: number;
  actorId: string;
  gameId?: string;
  roundId?: string;
  entryId?: string;
  referenceId?: string;
  status: 'COMPLETED' | 'REJECTED';
  idempotencyKey: string;
  createdAt: string;
}

export interface AuthoritativeSelection {
  number: string;
  stake: number;
  color: 'GREEN' | 'RED';
}

export interface AuthoritativeGameEntry {
  id: string;
  userId: string;
  gameId: string;
  gameName: string;
  roundId: string;
  roundNumber: number;
  selections: AuthoritativeSelection[];
  totalStake: number;
  walletUsed: 'main' | 'bonus';
  status: 'CONFIRMED' | 'WON' | 'LOST';
  createdAt: string;
  idempotencyKey?: string;
  balanceBefore?: number;
  balanceAfter?: number;
  bonusBalanceBefore?: number;
  bonusBalanceAfter?: number;
  ledgerTxId?: string;
  settledReward?: number;
  protectionRefund?: number;
  totalSettlementCredit?: number;
  settledWinningNumber?: string;
  settledResultColor?: 'GREEN' | 'RED';
  settlementId?: string;
  settledAt?: string;
}

export interface AuthoritativeRound {
  id: string;
  gameId: string;
  gameName: string;
  roundNumber: number;
  freezeTime: string;
  declareTime: string;
  status: 'OPEN' | 'FROZEN' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED';
  totalBidsPool: number;
  resultNumber?: string | null;
  resultColor?: 'GREEN' | 'RED' | null;
}

export interface AuthoritativeResultRecord {
  resultId: string;
  gameId: string;
  roundId: string;
  roundNumber: number;
  gameName: string;
  winningNumber: string;
  resultColor: 'GREEN' | 'RED';
  declaredBy: string;
  declaredAt: string;
  ruleVersion: string;
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  settlementId: string;
  createdAt: string;
  summary?: any;
}

class AuthoritativeBackendStore {
  private wallets = new Map<string, AuthoritativeWallet>();
  private ledger = new Map<string, AuthoritativeLedgerEntry>();
  private entries = new Map<string, AuthoritativeGameEntry>();
  private rounds = new Map<string, AuthoritativeRound>();
  private results = new Map<string, AuthoritativeResultRecord>();
  private isFirestoreAccessible: boolean | null = null;
  private writeLock: Promise<void> = Promise.resolve();

  constructor() {
    // Never seed demo players, balances, entries, referrals, or rounds.
  }

  public async hydrateFromFirestore(): Promise<void> {
    try {
      const db = getAdminDb();
      const [wallets, ledger, entries, rounds, results] = await Promise.all([
        db.collection('coinWallets').get(),
        db.collection('coinLedger').get(),
        db.collection('gameEntries').get(),
        db.collection('gameRounds').get(),
        db.collection('gameResults').get(),
      ]);

      wallets.forEach((doc) => this.wallets.set(doc.id, doc.data() as AuthoritativeWallet));
      ledger.forEach((doc) => this.ledger.set(doc.id, doc.data() as AuthoritativeLedgerEntry));
      entries.forEach((doc) => this.entries.set(doc.id, doc.data() as AuthoritativeGameEntry));
      rounds.forEach((doc) => this.rounds.set(doc.id, doc.data() as AuthoritativeRound));
      results.forEach((doc) => this.results.set(doc.id, doc.data() as AuthoritativeResultRecord));
      this.isFirestoreAccessible = true;
      console.log(`[BACKEND_STORE] Hydrated Firestore state: ${wallets.size} wallets, ${entries.size} entries, ${results.size} results.`);
    } catch (error) {
      this.isFirestoreAccessible = false;
      console.warn('[BACKEND_STORE] Firestore hydration failed:', error);
    }
  }

  public setFirestoreAccessible(accessible: boolean | null): void { this.isFirestoreAccessible = accessible; }

  private enqueueLock<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.writeLock.then(fn, fn);
    this.writeLock = next.then(() => {}, () => {});
    return next;
  }

  private async firestoreSet(collection: string, id: string, value: any): Promise<void> {
    return this.enqueueLock(async () => {
      try {
        await getAdminDb().collection(collection).doc(id).set(value, { merge: true });
        this.isFirestoreAccessible = true;
      } catch (error) {
        this.isFirestoreAccessible = false;
        console.error(`[BACKEND_STORE] Firestore write failed for ${collection}/${id}:`, error);
        throw error;
      }
    });
  }

  // Kept for compatibility with older callers. Production persistence is Firestore, not local JSON.
  public persistToDiskSync(): void {}
  public async reloadFromDisk(): Promise<boolean> { await this.hydrateFromFirestore(); return this.isFirestoreAccessible === true; }

  public getWalletSync(uid: string): AuthoritativeWallet {
    let wallet = this.wallets.get(uid);
    if (!wallet) {
      wallet = { uid, balance: 0, bonusBalance: 0, currency: 'COIN', updatedAt: new Date().toISOString() };
      this.wallets.set(uid, wallet);
      this.firestoreSet('coinWallets', uid, wallet).catch(() => {});
    }
    return { ...wallet };
  }

  public async getWallet(uid: string): Promise<AuthoritativeWallet> {
    try {
      const doc = await getAdminDb().collection('coinWallets').doc(uid).get();
      if (doc.exists) {
        const wallet = doc.data() as AuthoritativeWallet;
        this.wallets.set(uid, wallet);
        this.isFirestoreAccessible = true;
        return { ...wallet };
      }
    } catch {
      this.isFirestoreAccessible = false;
    }
    return this.getWalletSync(uid);
  }

  public debitStakeSync(params: { userId: string; amount: number; gameId: string; roundId: string; idempotencyKey: string; walletPreference?: 'main' | 'bonus' }) {
    const { userId, amount, gameId, roundId, idempotencyKey, walletPreference } = params;
    if (!Number.isFinite(amount) || amount <= 0) return { success: false, balanceBefore: 0, balanceAfter: 0, bonusBalanceBefore: 0, bonusBalanceAfter: 0, walletUsed: 'main' as const, ledgerId: '', error: 'Stake must be a positive number.' };
    const existingTx = Array.from(this.ledger.values()).find((tx) => tx.idempotencyKey === idempotencyKey && tx.status === 'COMPLETED');
    if (existingTx) {
      const isBonus = existingTx.bonusBalanceBefore !== undefined && existingTx.bonusBalanceBefore !== existingTx.bonusBalanceAfter;
      return { success: true, balanceBefore: existingTx.balanceBefore, balanceAfter: existingTx.balanceAfter, bonusBalanceBefore: existingTx.bonusBalanceBefore || 0, bonusBalanceAfter: existingTx.bonusBalanceAfter || 0, walletUsed: isBonus ? 'bonus' as const : 'main' as const, ledgerId: existingTx.id, duplicate: true };
    }

    const wallet = this.getWalletSync(userId);
    let walletUsed: 'main' | 'bonus';
    if (walletPreference === 'bonus') {
      if (wallet.bonusBalance < amount) return { success: false, balanceBefore: wallet.balance, balanceAfter: wallet.balance, bonusBalanceBefore: wallet.bonusBalance, bonusBalanceAfter: wallet.bonusBalance, walletUsed: 'bonus' as const, ledgerId: '', error: 'Insufficient bonus coins.' };
      walletUsed = 'bonus';
    } else if (walletPreference === 'main') {
      if (wallet.balance < amount) return { success: false, balanceBefore: wallet.balance, balanceAfter: wallet.balance, bonusBalanceBefore: wallet.bonusBalance, bonusBalanceAfter: wallet.bonusBalance, walletUsed: 'main' as const, ledgerId: '', error: 'Insufficient main coins.' };
      walletUsed = 'main';
    } else if (wallet.bonusBalance >= amount) walletUsed = 'bonus';
    else if (wallet.balance >= amount) walletUsed = 'main';
    else return { success: false, balanceBefore: wallet.balance, balanceAfter: wallet.balance, bonusBalanceBefore: wallet.bonusBalance, bonusBalanceAfter: wallet.bonusBalance, walletUsed: 'main' as const, ledgerId: '', error: 'Insufficient coins.' };

    const balanceBefore = wallet.balance;
    const bonusBalanceBefore = wallet.bonusBalance;
    if (walletUsed === 'bonus') wallet.bonusBalance = Math.round((wallet.bonusBalance - amount) * 100) / 100;
    else wallet.balance = Math.round((wallet.balance - amount) * 100) / 100;
    wallet.updatedAt = new Date().toISOString();
    this.wallets.set(userId, wallet);

    const balanceAfter = wallet.balance;
    const bonusBalanceAfter = wallet.bonusBalance;
    const ledgerId = `tx_stake_${idempotencyKey || crypto.randomBytes(8).toString('hex')}`;
    const ledgerEntry: AuthoritativeLedgerEntry = { id: ledgerId, userId, type: 'GAME_STAKE', amount: -amount, balanceBefore, balanceAfter, bonusBalanceBefore, bonusBalanceAfter, actorId: userId, gameId, roundId, status: 'COMPLETED', idempotencyKey, createdAt: new Date().toISOString() };
    this.ledger.set(ledgerId, ledgerEntry);
    this.firestoreSet('coinWallets', userId, wallet).catch(() => {});
    this.firestoreSet('coinLedger', ledgerId, ledgerEntry).catch(() => {});
    return { success: true, balanceBefore, balanceAfter, bonusBalanceBefore, bonusBalanceAfter, walletUsed, ledgerId, duplicate: false };
  }

  public async debitStake(params: { userId: string; amount: number; gameId: string; roundId: string; idempotencyKey: string; walletPreference?: 'main' | 'bonus' }) { return this.debitStakeSync(params); }

  public creditBonusSync(params: { userId: string; amount: number; type?: 'REFERRAL_REWARD' | 'MASTER_ADJUSTMENT' | 'HELPER_GIFT'; actorId?: string; referenceId?: string; idempotencyKey: string }) {
    const { userId, amount, type = 'REFERRAL_REWARD', actorId = 'system', referenceId, idempotencyKey } = params;
    if (!Number.isFinite(amount) || amount <= 0) return { success: false, bonusBalanceBefore: 0, bonusBalanceAfter: 0, ledgerId: '', duplicate: false };
    const existingTx = Array.from(this.ledger.values()).find((tx) => tx.idempotencyKey === idempotencyKey && tx.status === 'COMPLETED');
    if (existingTx) return { success: true, bonusBalanceBefore: existingTx.bonusBalanceBefore || 0, bonusBalanceAfter: existingTx.bonusBalanceAfter || 0, ledgerId: existingTx.id, duplicate: true };
    const wallet = this.getWalletSync(userId);
    const bonusBalanceBefore = wallet.bonusBalance;
    const bonusBalanceAfter = Math.round((bonusBalanceBefore + amount) * 100) / 100;
    wallet.bonusBalance = bonusBalanceAfter; wallet.updatedAt = new Date().toISOString(); this.wallets.set(userId, wallet);
    const ledgerId = `tx_bonus_${type.toLowerCase()}_${idempotencyKey}`;
    const ledgerEntry: AuthoritativeLedgerEntry = { id: ledgerId, userId, type, amount, balanceBefore: wallet.balance, balanceAfter: wallet.balance, bonusBalanceBefore, bonusBalanceAfter, actorId, referenceId, status: 'COMPLETED', idempotencyKey, createdAt: new Date().toISOString() };
    this.ledger.set(ledgerId, ledgerEntry);
    this.firestoreSet('coinWallets', userId, wallet).catch(() => {}); this.firestoreSet('coinLedger', ledgerId, ledgerEntry).catch(() => {});
    return { success: true, bonusBalanceBefore, bonusBalanceAfter, ledgerId, duplicate: false };
  }

  public creditWinningSync(params: { userId: string; amount: number; type: 'GAME_WIN' | 'HOURLY_PROTECTION_REFUND'; gameId: string; roundId: string; entryId: string; referenceId?: string; idempotencyKey: string }) {
    const { userId, amount, type, gameId, roundId, entryId, referenceId, idempotencyKey } = params;
    if (!Number.isFinite(amount) || amount <= 0) return { success: false, balanceBefore: 0, balanceAfter: 0, ledgerId: '', duplicate: false };
    const existingTx = Array.from(this.ledger.values()).find((tx) => tx.idempotencyKey === idempotencyKey && tx.status === 'COMPLETED');
    if (existingTx) return { success: true, balanceBefore: existingTx.balanceBefore, balanceAfter: existingTx.balanceAfter, ledgerId: existingTx.id, duplicate: true };
    const wallet = this.getWalletSync(userId);
    const balanceBefore = wallet.balance;
    const balanceAfter = Math.round((balanceBefore + amount) * 100) / 100;
    wallet.balance = balanceAfter; wallet.updatedAt = new Date().toISOString(); this.wallets.set(userId, wallet);
    const ledgerId = `tx_${type.toLowerCase()}_${idempotencyKey}`;
    const ledgerEntry: AuthoritativeLedgerEntry = { id: ledgerId, userId, type, amount, balanceBefore, balanceAfter, bonusBalanceBefore: wallet.bonusBalance, bonusBalanceAfter: wallet.bonusBalance, actorId: 'system_settlement_engine', gameId, roundId, entryId, referenceId, status: 'COMPLETED', idempotencyKey, createdAt: new Date().toISOString() };
    this.ledger.set(ledgerId, ledgerEntry);
    this.firestoreSet('coinWallets', userId, wallet).catch(() => {}); this.firestoreSet('coinLedger', ledgerId, ledgerEntry).catch(() => {});
    return { success: true, balanceBefore, balanceAfter, ledgerId, duplicate: false };
  }

  public async creditWinning(params: { userId: string; amount: number; type: 'GAME_WIN' | 'HOURLY_PROTECTION_REFUND'; gameId: string; roundId: string; entryId: string; referenceId?: string; idempotencyKey: string }) { return this.creditWinningSync(params); }

  public saveEntrySync(entry: AuthoritativeGameEntry): void { this.entries.set(entry.id, entry); this.firestoreSet('gameEntries', entry.id, entry).catch(() => {}); }
  public async saveEntry(entry: AuthoritativeGameEntry): Promise<void> { this.saveEntrySync(entry); }
  public getEntry(entryId: string) { return this.entries.get(entryId); }
  public getEntriesForRound(roundId: string) { return Array.from(this.entries.values()).filter((e) => e.roundId === roundId); }
  public getUserEntries(userId: string) { return Array.from(this.entries.values()).filter((e) => e.userId === userId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); }
  public async updateEntry(entryId: string, updates: Partial<AuthoritativeGameEntry>): Promise<void> { const entry = this.entries.get(entryId); if (entry) { Object.assign(entry, updates); this.firestoreSet('gameEntries', entryId, entry).catch(() => {}); } }

  public getRound(gameId: string) { return this.rounds.get(gameId); }
  public getRoundById(roundId: string) { return Array.from(this.rounds.values()).find((r) => r.id === roundId); }
  public setRound(gameId: string, round: AuthoritativeRound): void { this.rounds.set(gameId, round); this.firestoreSet('gameRounds', gameId, round).catch(() => {}); }
  public getAllRoundsMap() { return this.rounds; }

  public async saveResult(result: AuthoritativeResultRecord): Promise<void> { this.results.set(result.resultId, result); await this.firestoreSet('gameResults', result.resultId, result); }
  public saveResultSync(result: AuthoritativeResultRecord): void { this.results.set(result.resultId, result); this.firestoreSet('gameResults', result.resultId, result).catch(() => {}); }
  public getResultByRoundId(roundId: string) { return Array.from(this.results.values()).find((r) => r.roundId === roundId); }
  public getRecentResults(limit = 20) { return Array.from(this.results.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, limit); }

  public getLedger(userId: string, limit = 50) { return Array.from(this.ledger.values()).filter((l) => l.userId === userId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, limit); }

  public getStoreSnapshot() {
    return { wallets: Object.fromEntries(this.wallets.entries()), ledger: Array.from(this.ledger.values()), gameEntries: Array.from(this.entries.values()), results: Object.fromEntries(this.results.entries()), rounds: Object.fromEntries(this.rounds.entries()), isFirestoreAccessible: this.isFirestoreAccessible, lastSyncTime: new Date().toISOString(), version: '3.0.0-firestore-first' };
  }
}

export const authoritativeBackendStore = new AuthoritativeBackendStore();
