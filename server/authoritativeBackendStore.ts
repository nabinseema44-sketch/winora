import fs from 'fs';
import path from 'path';
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
  number: string; // '00' to '99'
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
  freezeTime: string;  // ISO timestamp
  declareTime: string; // ISO timestamp
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
  private dataDir: string;
  private storeFilePath: string;
  private wallets: Map<string, AuthoritativeWallet> = new Map();
  private ledger: Map<string, AuthoritativeLedgerEntry> = new Map();
  private entries: Map<string, AuthoritativeGameEntry> = new Map();
  private rounds: Map<string, AuthoritativeRound> = new Map();
  private results: Map<string, AuthoritativeResultRecord> = new Map();
  private isFirestoreAccessible: boolean | null = null;
  private writeLock: Promise<void> = Promise.resolve();

  constructor() {
    this.dataDir = path.join(process.cwd(), 'data');
    this.storeFilePath = path.join(this.dataDir, 'authoritative_store.json');
    this.ensureDataDir();
    this.loadFromDisk();
  }

  private ensureDataDir() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
    } catch (e) {
      console.warn('[BACKEND_STORE] Failed to create data dir:', e);
    }
  }

  public loadFromDisk(): boolean {
    let raw: string | null = null;
    let sourcePath = this.storeFilePath;

    try {
      if (fs.existsSync(this.storeFilePath)) {
        raw = fs.readFileSync(this.storeFilePath, 'utf8');
      } else if (fs.existsSync(this.storeFilePath + '.bak')) {
        sourcePath = this.storeFilePath + '.bak';
        raw = fs.readFileSync(sourcePath, 'utf8');
      }
    } catch (e) {
      console.warn('[BACKEND_STORE] Error reading primary store, trying backup:', e);
      if (fs.existsSync(this.storeFilePath + '.bak')) {
        try {
          sourcePath = this.storeFilePath + '.bak';
          raw = fs.readFileSync(sourcePath, 'utf8');
        } catch {}
      }
    }

    if (!raw) {
      this.initDefaultPlayers();
      return false;
    }

    try {
      const parsed = JSON.parse(raw);
      if (parsed.wallets) {
        this.wallets.clear();
        for (const [k, v] of Object.entries(parsed.wallets)) {
          this.wallets.set(k, v as AuthoritativeWallet);
        }
      }
      if (parsed.ledger) {
        this.ledger.clear();
        for (const [k, v] of Object.entries(parsed.ledger)) {
          this.ledger.set(k, v as AuthoritativeLedgerEntry);
        }
      }
      if (parsed.entries) {
        this.entries.clear();
        for (const [k, v] of Object.entries(parsed.entries)) {
          this.entries.set(k, v as AuthoritativeGameEntry);
        }
      }
      if (parsed.rounds) {
        this.rounds.clear();
        for (const [k, v] of Object.entries(parsed.rounds)) {
          this.rounds.set(k, v as AuthoritativeRound);
        }
      }
      if (parsed.results) {
        this.results.clear();
        for (const [k, v] of Object.entries(parsed.results)) {
          this.results.set(k, v as AuthoritativeResultRecord);
        }
      }
      this.initDefaultPlayers();
      return true;
    } catch (e) {
      console.warn('[BACKEND_STORE] Failed to parse store JSON, attempting backup:', e);
      if (sourcePath !== this.storeFilePath + '.bak' && fs.existsSync(this.storeFilePath + '.bak')) {
        try {
          const bakRaw = fs.readFileSync(this.storeFilePath + '.bak', 'utf8');
          const bakParsed = JSON.parse(bakRaw);
          if (bakParsed.wallets) {
            this.wallets.clear();
            for (const [k, v] of Object.entries(bakParsed.wallets)) {
              this.wallets.set(k, v as AuthoritativeWallet);
            }
          }
          if (bakParsed.ledger) {
            this.ledger.clear();
            for (const [k, v] of Object.entries(bakParsed.ledger)) {
              this.ledger.set(k, v as AuthoritativeLedgerEntry);
            }
          }
          if (bakParsed.entries) {
            this.entries.clear();
            for (const [k, v] of Object.entries(bakParsed.entries)) {
              this.entries.set(k, v as AuthoritativeGameEntry);
            }
          }
          if (bakParsed.rounds) {
            this.rounds.clear();
            for (const [k, v] of Object.entries(bakParsed.rounds)) {
              this.rounds.set(k, v as AuthoritativeRound);
            }
          }
          if (bakParsed.results) {
            this.results.clear();
            for (const [k, v] of Object.entries(bakParsed.results)) {
              this.results.set(k, v as AuthoritativeResultRecord);
            }
          }
          this.initDefaultPlayers();
          return true;
        } catch {}
      }
      this.initDefaultPlayers();
      return false;
    }
  }

  private initDefaultPlayers() {
    // A newly registered player must have MAIN WALLET: 0, BONUS WALLET: 0
    if (!this.wallets.has('player-arjun')) {
      this.wallets.set('player-arjun', {
        uid: 'player-arjun',
        balance: 0,
        bonusBalance: 0,
        currency: 'COIN',
        updatedAt: new Date().toISOString(),
      });
    }
    if (!this.wallets.has('demo-player-uid-123')) {
      this.wallets.set('demo-player-uid-123', {
        uid: 'demo-player-uid-123',
        balance: 0,
        bonusBalance: 0,
        currency: 'COIN',
        updatedAt: new Date().toISOString(),
      });
    }
  }

  public persistToDiskSync() {
    try {
      const payload = {
        wallets: Object.fromEntries(this.wallets.entries()),
        ledger: Object.fromEntries(this.ledger.entries()),
        entries: Object.fromEntries(this.entries.entries()),
        rounds: Object.fromEntries(this.rounds.entries()),
        results: Object.fromEntries(this.results.entries()),
      };
      const json = JSON.stringify(payload, null, 2);
      const tmpPath = `${this.storeFilePath}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
      fs.writeFileSync(tmpPath, json, 'utf8');
      fs.renameSync(tmpPath, this.storeFilePath);
      try {
        fs.copyFileSync(this.storeFilePath, this.storeFilePath + '.bak');
      } catch {}
    } catch (e) {
      console.warn('[BACKEND_STORE] Failed to persist store to disk:', e);
    }
  }

  private async persistToDisk() {
    return this.enqueueLock(async () => {
      this.persistToDiskSync();
    });
  }

  public reloadFromDisk(): boolean {
    return this.loadFromDisk();
  }

  public setFirestoreAccessible(accessible: boolean | null): void {
    this.isFirestoreAccessible = accessible;
  }

  private enqueueLock<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.writeLock.then(fn, fn);
    this.writeLock = next.then(() => {}, () => {});
    return next;
  }

  /**
   * Check if Firestore is live and writable.
   */
  private async checkFirestore(): Promise<boolean> {
    if (this.isFirestoreAccessible !== null) return this.isFirestoreAccessible;
    try {
      const db = getAdminDb();
      await db.collection('_system').doc('healthCheck').get();
      this.isFirestoreAccessible = true;
      return true;
    } catch {
      this.isFirestoreAccessible = false;
      return false;
    }
  }

  // --------------------------------------------------------------------------
  // WALLET & BALANCE OPERATIONS (STRICTLY AUTHORITATIVE)
  // --------------------------------------------------------------------------

  public getWalletSync(uid: string): AuthoritativeWallet {
    let wallet = this.wallets.get(uid);
    if (!wallet) {
      wallet = {
        uid,
        balance: 0, // Strictly zero balance for new players - Mandatory Blueprint Rule
        bonusBalance: 0,
        currency: 'COIN',
        updatedAt: new Date().toISOString(),
      };
      this.wallets.set(uid, wallet);
      this.persistToDisk().catch(() => {});
    }
    return { ...wallet };
  }

  public async getWallet(uid: string): Promise<AuthoritativeWallet> {
    return this.getWalletSync(uid);
  }

  /**
   * Synchronous / Immediate Atomic Balance Deduction for Bids (GAME_STAKE)
   * Enforces server-authoritative dual-wallet spending policy:
   * 1. If player requests or has bonus coins, Bonus Wallet can fund the bet.
   * 2. Otherwise Main Wallet funds the bet.
   * 3. Never trusts client-reported balances.
   */
  public debitStakeSync(params: {
    userId: string;
    amount: number;
    gameId: string;
    roundId: string;
    idempotencyKey: string;
    walletPreference?: 'main' | 'bonus';
  }): {
    success: boolean;
    balanceBefore: number;
    balanceAfter: number;
    bonusBalanceBefore: number;
    bonusBalanceAfter: number;
    walletUsed: 'main' | 'bonus';
    ledgerId: string;
    duplicate?: boolean;
    error?: string;
  } {
    const { userId, amount, gameId, roundId, idempotencyKey, walletPreference } = params;

    // Idempotency check
    const existingTx = Array.from(this.ledger.values()).find(
      (tx) => tx.idempotencyKey === idempotencyKey && tx.status === 'COMPLETED'
    );
    if (existingTx) {
      const isBonus = existingTx.bonusBalanceBefore !== undefined && existingTx.bonusBalanceBefore !== existingTx.bonusBalanceAfter;
      return {
        success: true,
        balanceBefore: existingTx.balanceBefore,
        balanceAfter: existingTx.balanceAfter,
        bonusBalanceBefore: existingTx.bonusBalanceBefore || 0,
        bonusBalanceAfter: existingTx.bonusBalanceAfter || 0,
        walletUsed: isBonus ? 'bonus' : 'main',
        ledgerId: existingTx.id,
        duplicate: true,
      };
    }

    const wallet = this.wallets.get(userId) || {
      uid: userId,
      balance: 0,
      bonusBalance: 0,
      currency: 'COIN',
      updatedAt: new Date().toISOString(),
    };

    let walletUsed: 'main' | 'bonus' = 'main';
    if (walletPreference === 'bonus') {
      if (wallet.bonusBalance < amount) {
        return {
          success: false,
          balanceBefore: wallet.balance,
          balanceAfter: wallet.balance,
          bonusBalanceBefore: wallet.bonusBalance,
          bonusBalanceAfter: wallet.bonusBalance,
          walletUsed: 'bonus',
          ledgerId: '',
          error: `Insufficient bonus coins. Required: ₹${amount.toLocaleString()}, Available in Bonus Wallet: ₹${wallet.bonusBalance.toLocaleString()}.`,
        };
      }
      walletUsed = 'bonus';
    } else if (walletPreference === 'main') {
      if (wallet.balance < amount) {
        return {
          success: false,
          balanceBefore: wallet.balance,
          balanceAfter: wallet.balance,
          bonusBalanceBefore: wallet.bonusBalance,
          bonusBalanceAfter: wallet.bonusBalance,
          walletUsed: 'main',
          ledgerId: '',
          error: `Insufficient coins in Main Wallet. Required: ₹${amount.toLocaleString()}, Available: ₹${wallet.balance.toLocaleString()}.`,
        };
      }
      walletUsed = 'main';
    } else {
      // Default spending policy: Use bonus wallet if sufficient, else main wallet
      if (wallet.bonusBalance >= amount) {
        walletUsed = 'bonus';
      } else if (wallet.balance >= amount) {
        walletUsed = 'main';
      } else {
        return {
          success: false,
          balanceBefore: wallet.balance,
          balanceAfter: wallet.balance,
          bonusBalanceBefore: wallet.bonusBalance,
          bonusBalanceAfter: wallet.bonusBalance,
          walletUsed: 'main',
          ledgerId: '',
          error: `Insufficient balance. Required: ₹${amount.toLocaleString()}, Available: ₹${wallet.balance.toLocaleString()} (Main) and ₹${wallet.bonusBalance.toLocaleString()} (Bonus).`,
        };
      }
    }

    const balanceBefore = wallet.balance;
    const bonusBalanceBefore = wallet.bonusBalance;
    let balanceAfter = balanceBefore;
    let bonusBalanceAfter = bonusBalanceBefore;

    if (walletUsed === 'bonus') {
      bonusBalanceAfter = Math.round((bonusBalanceBefore - amount) * 100) / 100;
      wallet.bonusBalance = bonusBalanceAfter;
    } else {
      balanceAfter = Math.round((balanceBefore - amount) * 100) / 100;
      wallet.balance = balanceAfter;
    }

    wallet.updatedAt = new Date().toISOString();
    this.wallets.set(userId, wallet);

    const ledgerId = `tx_stake_${idempotencyKey || crypto.randomBytes(4).toString('hex')}`;
    const ledgerEntry: AuthoritativeLedgerEntry = {
      id: ledgerId,
      userId,
      type: 'GAME_STAKE',
      amount: -amount,
      balanceBefore,
      balanceAfter,
      bonusBalanceBefore,
      bonusBalanceAfter,
      actorId: userId,
      gameId,
      roundId,
      status: 'COMPLETED',
      idempotencyKey,
      createdAt: new Date().toISOString(),
    };
    this.ledger.set(ledgerId, ledgerEntry);

    this.persistToDisk().catch(() => {});
    this.syncWalletToFirestore(wallet, ledgerEntry).catch(() => {});

    return {
      success: true,
      balanceBefore,
      balanceAfter,
      bonusBalanceBefore,
      bonusBalanceAfter,
      walletUsed,
      ledgerId,
      duplicate: false,
    };
  }

  public async debitStake(params: {
    userId: string;
    amount: number;
    gameId: string;
    roundId: string;
    idempotencyKey: string;
    walletPreference?: 'main' | 'bonus';
  }) {
    return this.debitStakeSync(params);
  }

  /**
   * Synchronous / Immediate Atomic Balance Crediting for Referral Rewards (BONUS WALLET ONLY)
   * Blueprint Rule 8: Referral rewards MUST be credited to Bonus Wallet, NEVER Main Wallet.
   */
  public creditBonusSync(params: {
    userId: string;
    amount: number;
    type?: 'REFERRAL_REWARD' | 'MASTER_ADJUSTMENT' | 'HELPER_GIFT';
    actorId?: string;
    referenceId?: string;
    idempotencyKey: string;
  }): {
    success: boolean;
    bonusBalanceBefore: number;
    bonusBalanceAfter: number;
    ledgerId: string;
    duplicate?: boolean;
  } {
    const { userId, amount, type = 'REFERRAL_REWARD', actorId = 'system_referral_engine', referenceId, idempotencyKey } = params;

    const existingTx = Array.from(this.ledger.values()).find(
      (tx) => tx.idempotencyKey === idempotencyKey && tx.status === 'COMPLETED'
    );
    if (existingTx) {
      return {
        success: true,
        bonusBalanceBefore: existingTx.bonusBalanceBefore || 0,
        bonusBalanceAfter: existingTx.bonusBalanceAfter || 0,
        ledgerId: existingTx.id,
        duplicate: true,
      };
    }

    const wallet = this.wallets.get(userId) || {
      uid: userId,
      balance: 0,
      bonusBalance: 0,
      currency: 'COIN',
      updatedAt: new Date().toISOString(),
    };

    const bonusBalanceBefore = wallet.bonusBalance || 0;
    const bonusBalanceAfter = Math.round((bonusBalanceBefore + amount) * 100) / 100;
    wallet.bonusBalance = bonusBalanceAfter;
    wallet.updatedAt = new Date().toISOString();
    this.wallets.set(userId, wallet);

    const ledgerId = `tx_bonus_${type.toLowerCase()}_${idempotencyKey}`;
    const ledgerEntry: AuthoritativeLedgerEntry = {
      id: ledgerId,
      userId,
      type: type as any,
      amount,
      balanceBefore: wallet.balance,
      balanceAfter: wallet.balance,
      bonusBalanceBefore,
      bonusBalanceAfter,
      actorId,
      referenceId,
      status: 'COMPLETED',
      idempotencyKey,
      createdAt: new Date().toISOString(),
    };
    this.ledger.set(ledgerId, ledgerEntry);

    this.persistToDisk().catch(() => {});
    this.syncWalletToFirestore(wallet, ledgerEntry).catch(() => {});

    return {
      success: true,
      bonusBalanceBefore,
      bonusBalanceAfter,
      ledgerId,
      duplicate: false,
    };
  }

  /**
   * Synchronous / Immediate Atomic Balance Crediting for Wins and Protection Refunds (MAIN WALLET ONLY)
   * Blueprint Rule 2: Game winnings and protection refunds are ALWAYS credited to Main Wallet.
   */
  public creditWinningSync(params: {
    userId: string;
    amount: number;
    type: 'GAME_WIN' | 'HOURLY_PROTECTION_REFUND';
    gameId: string;
    roundId: string;
    entryId: string;
    referenceId?: string;
    idempotencyKey: string;
  }): {
    success: boolean;
    balanceBefore: number;
    balanceAfter: number;
    ledgerId: string;
    duplicate?: boolean;
  } {
    const { userId, amount, type, gameId, roundId, entryId, referenceId, idempotencyKey } = params;

    // Idempotency check: Cannot credit twice with same idempotencyKey
    const existingTx = Array.from(this.ledger.values()).find(
      (tx) => tx.idempotencyKey === idempotencyKey && tx.status === 'COMPLETED'
    );
    if (existingTx) {
      return {
        success: true,
        balanceBefore: existingTx.balanceBefore,
        balanceAfter: existingTx.balanceAfter,
        ledgerId: existingTx.id,
        duplicate: true,
      };
    }

    const wallet = this.wallets.get(userId) || {
      uid: userId,
      balance: 0, // Mandatory zero starting balance
      bonusBalance: 0,
      currency: 'COIN',
      updatedAt: new Date().toISOString(),
    };

    const balanceBefore = wallet.balance;
    const balanceAfter = Math.round((balanceBefore + amount) * 100) / 100;
    wallet.balance = balanceAfter;
    wallet.updatedAt = new Date().toISOString();
    this.wallets.set(userId, wallet);

    const ledgerId = `tx_${type.toLowerCase()}_${idempotencyKey}`;
    const ledgerEntry: AuthoritativeLedgerEntry = {
      id: ledgerId,
      userId,
      type,
      amount,
      balanceBefore,
      balanceAfter,
      bonusBalanceBefore: wallet.bonusBalance,
      bonusBalanceAfter: wallet.bonusBalance,
      actorId: 'system_settlement_engine',
      gameId,
      roundId,
      entryId,
      referenceId,
      status: 'COMPLETED',
      idempotencyKey,
      createdAt: new Date().toISOString(),
    };
    this.ledger.set(ledgerId, ledgerEntry);

    this.persistToDisk().catch(() => {});
    this.syncWalletToFirestore(wallet, ledgerEntry).catch(() => {});

    return {
      success: true,
      balanceBefore,
      balanceAfter,
      ledgerId,
      duplicate: false,
    };
  }

  public async creditWinning(params: {
    userId: string;
    amount: number;
    type: 'GAME_WIN' | 'HOURLY_PROTECTION_REFUND';
    gameId: string;
    roundId: string;
    entryId: string;
    referenceId?: string;
    idempotencyKey: string;
  }) {
    return this.creditWinningSync(params);
  }

  public saveEntrySync(entry: AuthoritativeGameEntry): void {
    this.entries.set(entry.id, entry);
    this.persistToDisk().catch(() => {});
  }

  public saveResultSync(result: AuthoritativeResultRecord): void {
    this.results.set(result.resultId, result);
    this.persistToDisk().catch(() => {});
  }

  private async syncWalletToFirestore(wallet: AuthoritativeWallet, ledger: AuthoritativeLedgerEntry) {
    return this.enqueueLock(async () => {
      if (!(await this.checkFirestore())) return;
      try {
        const db = getAdminDb();
        await db.collection('coinWallets').doc(wallet.uid).set(wallet, { merge: true });
        await db.collection('coinLedger').doc(ledger.id).set(ledger, { merge: true });
      } catch (e) {
        // Firestore unreachable, local authoritative store remains source of truth
        console.warn('[BACKEND_STORE] Firestore sync failed (non-blocking fallback active):', e);
      }
    });
  }

  public getLedger(userId: string, limit = 50): AuthoritativeLedgerEntry[] {
    return Array.from(this.ledger.values())
      .filter((l) => l.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  // --------------------------------------------------------------------------
  // GAME ENTRIES
  // --------------------------------------------------------------------------

  public async saveEntry(entry: AuthoritativeGameEntry): Promise<void> {
    this.entries.set(entry.id, entry);
    await this.persistToDisk();
  }

  public getEntry(entryId: string): AuthoritativeGameEntry | undefined {
    return this.entries.get(entryId);
  }

  public getEntriesForRound(roundId: string): AuthoritativeGameEntry[] {
    return Array.from(this.entries.values()).filter((e) => e.roundId === roundId);
  }

  public getUserEntries(userId: string): AuthoritativeGameEntry[] {
    return Array.from(this.entries.values())
      .filter((e) => e.userId === userId || userId === 'all')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public async updateEntry(entryId: string, updates: Partial<AuthoritativeGameEntry>): Promise<void> {
    const entry = this.entries.get(entryId);
    if (entry) {
      Object.assign(entry, updates);
      await this.persistToDisk();
    }
  }

  // --------------------------------------------------------------------------
  // ROUNDS
  // --------------------------------------------------------------------------

  public getRound(gameId: string): AuthoritativeRound | undefined {
    return this.rounds.get(gameId);
  }

  public getRoundById(roundId: string): AuthoritativeRound | undefined {
    for (const r of this.rounds.values()) {
      if (r.id === roundId) return r;
    }
    return undefined;
  }

  public setRound(gameId: string, round: AuthoritativeRound): void {
    this.rounds.set(gameId, round);
  }

  public getAllRoundsMap(): Map<string, AuthoritativeRound> {
    return this.rounds;
  }

  // --------------------------------------------------------------------------
  // RESULTS & SETTLEMENT
  // --------------------------------------------------------------------------

  public async saveResult(result: AuthoritativeResultRecord): Promise<void> {
    this.results.set(result.resultId, result);
    await this.persistToDisk();
  }

  public getResultByRoundId(roundId: string): AuthoritativeResultRecord | undefined {
    for (const r of this.results.values()) {
      if (r.roundId === roundId) return r;
    }
    return undefined;
  }

  public getRecentResults(limit = 20): AuthoritativeResultRecord[] {
    return Array.from(this.results.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
  }

  public getStoreSnapshot() {
    return {
      wallets: Object.fromEntries(this.wallets.entries()),
      ledger: Array.from(this.ledger.values()),
      gameEntries: Array.from(this.entries.values()),
      results: Object.fromEntries(this.results.entries()),
      rounds: Object.fromEntries(this.rounds.entries()),
      isFirestoreAccessible: this.isFirestoreAccessible,
      lastSyncTime: new Date().toISOString(),
      version: '2.0.0-authoritative',
    };
  }
}

export const authoritativeBackendStore = new AuthoritativeBackendStore();
