import crypto from 'crypto';
import { authoritativeBackendStore } from './authoritativeBackendStore.ts';

export interface ServerGameRound {
  id: string;
  gameId: string;
  gameName: string;
  roundNumber: number;
  freezeTime: string;  // ISO timestamp (15 mins prior to drawTime)
  declareTime: string; // ISO timestamp
  status: 'OPEN' | 'FROZEN' | 'PROCESSING' | 'COMPLETED';
  totalBidsPool: number;
  resultNumber?: string | null;
  resultColor?: 'GREEN' | 'RED' | null;
}

export interface Selection {
  number: string; // "00" - "99"
  stake: number;
  color: 'GREEN' | 'RED';
}

export interface ServerGameEntry {
  id: string;
  userId: string;
  gameId: string;
  gameName: string;
  roundId: string;
  roundNumber: number;
  selections: Selection[];
  totalStake: number;
  walletUsed: 'main';
  status: 'CONFIRMED' | 'WON' | 'LOST';
  createdAt: string;
  idempotencyKey?: string;
  balanceBefore?: number;
  balanceAfter?: number;
  ledgerTxId?: string;
  settledReward?: number;
  protectionRefund?: number;
  totalSettlementCredit?: number;
  settledWinningNumber?: string;
  settledResultColor?: 'GREEN' | 'RED';
  settlementId?: string;
  settledAt?: string;
}

export const SERVER_GAMES_CONFIG = [
  {
    id: 'hourly_play',
    name: 'Hourly Play',
    code: 'HP-80P',
    subtitle: 'Every Hour 24×7 (IST) | 15-min Freeze | 80% Protection Refund',
    payoutMultiplier: 90,
    hasGreenRefund: true,
    refundPercentage: 80,
    description: 'Hourly draws every hour. Winning number pays 90×, plus an 80% protection refund on all bids matching the declared winning color (Green or Red)!',
    accentColor: 'from-emerald-500 to-teal-500',
    intervalMinutes: 60,
  },
  {
    id: 'kalyan_morning',
    name: 'Kalyan Morning',
    code: 'KM-90',
    subtitle: 'Close: 09:30 AM IST | Result: 11:30 AM IST (Closes 2 hr before)',
    payoutMultiplier: 90,
    hasGreenRefund: false,
    description: 'Premier morning market. Closes strictly 2 hours before declaration.',
    accentColor: 'from-amber-500 to-orange-500',
    intervalMinutes: 120,
  },
  {
    id: 'kalyan',
    name: 'Kalyan',
    code: 'KL-90',
    subtitle: 'Close: 02:30 PM IST | Result: 04:30 PM IST (Closes 2 hr before)',
    payoutMultiplier: 90,
    hasGreenRefund: false,
    description: 'Flagship afternoon market. Closes strictly 2 hours before declaration.',
    accentColor: 'from-cyan-500 to-blue-500',
    intervalMinutes: 120,
  },
  {
    id: 'kalyan_night',
    name: 'Kalyan Night',
    code: 'KN-90',
    subtitle: 'Close: 09:45 PM IST | Result: 11:45 PM IST (Closes 2 hr before)',
    payoutMultiplier: 90,
    hasGreenRefund: false,
    description: 'Evening high-yield market. Closes strictly 2 hours before declaration.',
    accentColor: 'from-purple-500 to-pink-500',
    intervalMinutes: 120,
  },
  {
    id: 'game_x',
    name: 'Game X',
    code: 'GX-90',
    subtitle: 'Standard 00–99 High-Yield Draw',
    payoutMultiplier: 90,
    hasGreenRefund: false,
    description: 'Select lucky numbers between 00 and 99. Exact match delivers a direct 90× payout to your demo Main Wallet.',
    accentColor: 'from-amber-500 to-orange-500',
    intervalMinutes: 60,
  },
  {
    id: 'game_y',
    name: 'Game Y',
    code: 'GY-90',
    subtitle: 'Afternoon Prime Matrix Draw',
    payoutMultiplier: 90,
    hasGreenRefund: false,
    description: 'Midday matrix. Place single or spread entries across 00–99 with a fixed 90× multiplier.',
    accentColor: 'from-cyan-500 to-blue-500',
    intervalMinutes: 60,
  },
  {
    id: 'game_z',
    name: 'Game Z',
    code: 'GZ-90',
    subtitle: 'Night Royal 90× Draw',
    payoutMultiplier: 90,
    hasGreenRefund: false,
    description: 'Evening draw with deep demo liquidity. Single-number 90× return with automated settlement.',
    accentColor: 'from-purple-500 to-pink-500',
    intervalMinutes: 60,
  },
  {
    id: 'hourly_dhamaka',
    name: 'Hourly Dhamaka',
    code: 'HD-80G',
    subtitle: '90× Payout + 80% Protection Refund',
    payoutMultiplier: 90,
    hasGreenRefund: true,
    refundPercentage: 80,
    description: 'Place bids with your chosen color (GREEN or RED). Winning number pays 90×, plus an 80% protection refund on all bids matching the declared Result Color!',
    accentColor: 'from-emerald-500 to-teal-500',
    intervalMinutes: 60,
  },
];

class GameEntryService {
  private rounds: Map<string, ServerGameRound> = new Map();
  private entries: ServerGameEntry[] = [];
  private idempotencyStore: Map<string, ServerGameEntry> = new Map();
  // In-memory demo balances for server authoritative check - strictly Main Wallet only
  private userDemoBalances: Map<string, { main: number }> = new Map();
  private processedReferralKeys: Set<string> = new Set();

  constructor() {
    this.initDefaultRounds();
    this.initDefaultUserBalances();
    this.initSeedEntries();
  }

  private initDefaultUserBalances() {
    // Default demo balances (Main Wallet only)
    this.userDemoBalances.set('player-arjun', { main: 5000 });
    this.userDemoBalances.set('demo-player-uid-123', { main: 5000 });
    this.userDemoBalances.set('default', { main: 5000 });
  }

  private initDefaultRounds() {
    const now = Date.now();
    // Round for Game X: Draw in 30 mins, Freeze in 15 mins (OPEN)
    const declareX = new Date(now + 30 * 60000);
    const freezeX = new Date(declareX.getTime() - 15 * 60000);

    // Round for Game Y: Draw in 45 mins, Freeze in 30 mins (OPEN)
    const declareY = new Date(now + 45 * 60000);
    const freezeY = new Date(declareY.getTime() - 15 * 60000);

    // Round for Game Z: Draw in 12 mins, Freeze was 3 mins ago (FROZEN)
    const declareZ = new Date(now + 12 * 60000);
    const freezeZ = new Date(declareZ.getTime() - 15 * 60000);

    // Round for Hourly Play: Freeze 15 mins before declaration
    const declareH = new Date(now + 35 * 60000);
    const freezeH = new Date(declareH.getTime() - 15 * 60000);

    // Kalyan Morning: 2 hours cutoff before declaration
    const declareKM = new Date(now + 150 * 60000);
    const freezeKM = new Date(declareKM.getTime() - 120 * 60000); // 2 hours before!

    // Kalyan: 2 hours cutoff before declaration
    const declareKL = new Date(now + 180 * 60000);
    const freezeKL = new Date(declareKL.getTime() - 120 * 60000); // 2 hours before!

    // Kalyan Night: 2 hours cutoff before declaration
    const declareKN = new Date(now + 210 * 60000);
    const freezeKN = new Date(declareKN.getTime() - 120 * 60000); // 2 hours before!

    this.rounds.set('hourly_play', {
      id: 'round-hp-412',
      gameId: 'hourly_play',
      gameName: 'Hourly Play',
      roundNumber: 412,
      freezeTime: freezeH.toISOString(),
      declareTime: declareH.toISOString(),
      status: now >= freezeH.getTime() ? 'FROZEN' : 'OPEN',
      totalBidsPool: 62400,
    });

    this.rounds.set('kalyan_morning', {
      id: 'round-km-101',
      gameId: 'kalyan_morning',
      gameName: 'Kalyan Morning',
      roundNumber: 101,
      freezeTime: freezeKM.toISOString(),
      declareTime: declareKM.toISOString(),
      status: now >= freezeKM.getTime() ? 'FROZEN' : 'OPEN',
      totalBidsPool: 28500,
    });

    this.rounds.set('kalyan', {
      id: 'round-kl-204',
      gameId: 'kalyan',
      gameName: 'Kalyan',
      roundNumber: 204,
      freezeTime: freezeKL.toISOString(),
      declareTime: declareKL.toISOString(),
      status: now >= freezeKL.getTime() ? 'FROZEN' : 'OPEN',
      totalBidsPool: 19200,
    });

    this.rounds.set('kalyan_night', {
      id: 'round-kn-309',
      gameId: 'kalyan_night',
      gameName: 'Kalyan Night',
      roundNumber: 309,
      freezeTime: freezeKN.toISOString(),
      declareTime: declareKN.toISOString(),
      status: now >= freezeKN.getTime() ? 'FROZEN' : 'OPEN',
      totalBidsPool: 44100,
    });

    this.rounds.set('game_x', {
      id: 'round-gx-101',
      gameId: 'game_x',
      gameName: 'Game X',
      roundNumber: 101,
      freezeTime: freezeX.toISOString(),
      declareTime: declareX.toISOString(),
      status: 'OPEN',
      totalBidsPool: 28500,
    });

    this.rounds.set('game_y', {
      id: 'round-gy-204',
      gameId: 'game_y',
      gameName: 'Game Y',
      roundNumber: 204,
      freezeTime: freezeY.toISOString(),
      declareTime: declareY.toISOString(),
      status: 'OPEN',
      totalBidsPool: 19200,
    });

    this.rounds.set('game_z', {
      id: 'round-gz-309',
      gameId: 'game_z',
      gameName: 'Game Z',
      roundNumber: 309,
      freezeTime: freezeZ.toISOString(),
      declareTime: declareZ.toISOString(),
      status: 'FROZEN',
      totalBidsPool: 44100,
    });

    this.rounds.set('hourly_dhamaka', {
      id: 'round-hd-412',
      gameId: 'hourly_dhamaka',
      gameName: 'Hourly Dhamaka',
      roundNumber: 412,
      freezeTime: freezeH.toISOString(),
      declareTime: declareH.toISOString(),
      status: 'OPEN',
      totalBidsPool: 62400,
    });
  }

  private initSeedEntries() {
    // Seed initial demo entries for Arjun
    this.entries.push({
      id: 'ENTRY-8F29A10B',
      userId: 'player-arjun',
      gameId: 'game_x',
      gameName: 'Game X',
      roundId: 'round-gx-101',
      roundNumber: 101,
      selections: [
        { number: '07', stake: 100, color: 'GREEN' },
        { number: '21', stake: 100, color: 'RED' },
        { number: '42', stake: 100, color: 'GREEN' },
      ],
      totalStake: 300,
      walletUsed: 'main',
      status: 'CONFIRMED',
      createdAt: new Date(Date.now() - 10 * 60000).toISOString(),
      idempotencyKey: 'idemp-seed-1',
    });

    this.entries.push({
      id: 'ENTRY-4E18B90C',
      userId: 'player-arjun',
      gameId: 'hourly_dhamaka',
      gameName: 'Hourly Dhamaka',
      roundId: 'round-hd-412',
      roundNumber: 412,
      selections: [
        { number: '00', stake: 150, color: 'GREEN' },
        { number: '15', stake: 150, color: 'RED' },
        { number: '24', stake: 150, color: 'GREEN' },
        { number: '33', stake: 150, color: 'GREEN' },
      ],
      totalStake: 600,
      walletUsed: 'main',
      status: 'CONFIRMED',
      createdAt: new Date(Date.now() - 25 * 60000).toISOString(),
      idempotencyKey: 'idemp-seed-2',
    });
  }

  public getGamesConfig() {
    const roundsList: Record<string, ServerGameRound> = {};
    const now = Date.now();

    for (const [gameId, round] of this.rounds.entries()) {
      const freezeMs = new Date(round.freezeTime).getTime();
      let effectiveStatus = round.status;
      if (round.status === 'OPEN' && now >= freezeMs) {
        effectiveStatus = 'FROZEN';
      }
      roundsList[gameId] = {
        ...round,
        status: effectiveStatus,
      };
    }

    return {
      games: SERVER_GAMES_CONFIG,
      rounds: roundsList,
      serverTime: new Date().toISOString(),
    };
  }

  public getUserBalance(userId: string): { main: number } {
    const wallet = authoritativeBackendStore.getWalletSync(userId);
    return { main: wallet.balance };
  }

  public setUserBalance(userId: string, balances: { main: number }) {
    this.userDemoBalances.set(userId, balances);
    const wallet = authoritativeBackendStore.getWalletSync(userId);
    wallet.balance = balances.main;
  }

  public getUserEntries(userId: string): ServerGameEntry[] {
    return this.entries
      .filter((e) => e.userId === userId || userId === 'all')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /**
   * Authoritative Step 13 Game Entry Submission - Single Main Wallet
   * Validates selections array: number (00-99), stake (min 1, max 10000), color (GREEN | RED).
   * Server calculates totalStake = sum of selection stakes.
   */
  public submitEntry(params: {
    userId: string;
    gameId: string;
    roundId: string;
    selections: Selection[];
    idempotencyKey?: string;
  }): {
    success: boolean;
    error?: string;
    errorCode?: string;
    entry?: ServerGameEntry;
    remainingBalance?: { main: number };
  } {
    const { userId, gameId, roundId, selections, idempotencyKey } = params;

    // 1. Idempotency Check
    if (idempotencyKey && this.idempotencyStore.has(idempotencyKey)) {
      const existing = this.idempotencyStore.get(idempotencyKey)!;
      return {
        success: true,
        entry: existing,
        remainingBalance: this.getUserBalance(userId),
      };
    }

    // 2. Validate Game ID
    const gameConfig = SERVER_GAMES_CONFIG.find((g) => g.id === gameId);
    if (!gameConfig) {
      return { success: false, errorCode: 'GAME_UNAVAILABLE', error: 'Requested game is not available.' };
    }

    // 3. Validate Round & Server-Authoritative Freeze Time
    const round = this.rounds.get(gameId);
    if (!round || round.id !== roundId) {
      return { success: false, errorCode: 'INVALID_ROUND', error: 'Invalid or expired round reference.' };
    }

    const now = Date.now();
    const freezeTimestamp = new Date(round.freezeTime).getTime();

    // Check server status
    if (
      round.status === 'FROZEN' ||
      round.status === 'PROCESSING' ||
      round.status === 'COMPLETED' ||
      now >= freezeTimestamp
    ) {
      round.status = 'FROZEN';
      const isKalyan = gameId.startsWith('kalyan');
      return {
        success: false,
        errorCode: 'ROUND_CLOSED',
        error: `Bidding is strictly FROZEN for this round. Server cutoff (${isKalyan ? '2 hours' : '15 minutes'} prior to draw time) has been enforced.`,
      };
    }

    // 4. Validate Selection Count (1 to 37 numbers maximum)
    if (!Array.isArray(selections) || selections.length === 0) {
      return { success: false, errorCode: 'EMPTY_SELECTION', error: 'Please select at least 1 number.' };
    }

    if (selections.length > 37) {
      return {
        success: false,
        errorCode: 'LIMIT_EXCEEDED',
        error: `Selection exceeds the maximum limit of 37 numbers per round (Received: ${selections.length}).`,
      };
    }

    // 5. Validate Each Selection (number format, duplicate number check, stake, color)
    const seenNumbers = new Set<string>();
    let calculatedTotalStake = 0;

    for (const sel of selections) {
      if (!sel || typeof sel !== 'object') {
        return {
          success: false,
          errorCode: 'INVALID_SELECTION',
          error: 'Malformed selection object received.',
        };
      }

      const { number: numStr, stake, color } = sel;

      if (typeof numStr !== 'string' || !/^\d{2}$/.test(numStr)) {
        return {
          success: false,
          errorCode: 'INVALID_NUMBER',
          error: `Invalid number format: "${numStr}". Numbers must be 2-digit strings between "00" and "99".`,
        };
      }
      const numVal = parseInt(numStr, 10);
      if (numVal < 0 || numVal > 99) {
        return {
          success: false,
          errorCode: 'INVALID_NUMBER',
          error: `Number out of valid range: "${numStr}". Allowed range is 00 to 99.`,
        };
      }
      if (seenNumbers.has(numStr)) {
        return {
          success: false,
          errorCode: 'DUPLICATE_NUMBER',
          error: `Duplicate number "${numStr}" detected in selection.`,
        };
      }
      seenNumbers.add(numStr);

      if (typeof stake !== 'number' || isNaN(stake) || stake < 1 || stake > 10000) {
        return {
          success: false,
          errorCode: 'INVALID_AMOUNT',
          error: `Stake for number ${numStr} must be between 1 and 10,000 demo credits (Received: ${stake}).`,
        };
      }

      if (color !== 'GREEN' && color !== 'RED') {
        return {
          success: false,
          errorCode: 'INVALID_COLOR',
          error: `Color for number ${numStr} must be either GREEN or RED (Received: ${color}).`,
        };
      }

      // Number-color rule: Even numbers MUST be GREEN, Odd numbers MUST be RED
      const expectedColor: 'GREEN' | 'RED' = numVal % 2 === 0 ? 'GREEN' : 'RED';
      if (color !== expectedColor) {
        return {
          success: false,
          errorCode: 'COLOR_MISMATCH',
          error: `Color mismatch for number ${numStr}. Winora rules strictly mandate Even numbers must be GREEN and Odd numbers must be RED (Expected: ${expectedColor}, Received: ${color}).`,
        };
      }

      calculatedTotalStake += stake;
    }

    const totalStake = calculatedTotalStake;

    // 6. Server-Authoritative Balance Check & Atomic Deduction via Authoritative Backend Store
    const effectiveIdempotencyKey = idempotencyKey || `bid_${userId}_${round.id}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const debitRes = authoritativeBackendStore.debitStakeSync({
      userId,
      amount: totalStake,
      gameId,
      roundId: round.id,
      idempotencyKey: effectiveIdempotencyKey,
    });

    if (!debitRes.success) {
      return {
        success: false,
        errorCode: 'INSUFFICIENT_CREDITS',
        error: debitRes.error || `Insufficient demo credits in Main Wallet. Required: ₹${totalStake.toLocaleString()}, Available: ₹${debitRes.balanceBefore.toLocaleString()}.`,
      };
    }

    // 7. Update Round Pool
    round.totalBidsPool += totalStake;

    // 8. Create Immutable Entry Record
    const entryId = `ENTRY-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const newEntry: ServerGameEntry = {
      id: entryId,
      userId,
      gameId,
      gameName: gameConfig.name,
      roundId: round.id,
      roundNumber: round.roundNumber,
      selections: [...selections].sort((a, b) => a.number.localeCompare(b.number)),
      totalStake,
      walletUsed: 'main',
      status: 'CONFIRMED',
      createdAt: new Date().toISOString(),
      idempotencyKey: effectiveIdempotencyKey,
      balanceBefore: debitRes.balanceBefore,
      balanceAfter: debitRes.balanceAfter,
      ledgerTxId: debitRes.ledgerId,
    };

    this.entries.unshift(newEntry);
    this.idempotencyStore.set(effectiveIdempotencyKey, newEntry);
    authoritativeBackendStore.saveEntrySync(newEntry as any);

    return {
      success: true,
      entry: newEntry,
      remainingBalance: { main: debitRes.balanceAfter },
    };
  }

  public getAllRoundsMap(): Map<string, ServerGameRound> {
    return this.rounds;
  }

  public getRound(gameId: string): ServerGameRound | undefined {
    return this.rounds.get(gameId);
  }

  public getRoundById(roundId: string): ServerGameRound | undefined {
    for (const round of this.rounds.values()) {
      if (round.id === roundId) return round;
    }
    return undefined;
  }

  public getEntriesForRound(roundId: string): ServerGameEntry[] {
    return this.entries.filter((e) => e.roundId === roundId);
  }

  public updateEntry(entryId: string, updates: Partial<ServerGameEntry>): void {
    const entry = this.entries.find((e) => e.id === entryId);
    if (entry) {
      Object.assign(entry, updates);
    }
  }

  public creditUserDemoReward(userId: string, amount: number): { main: number } {
    const credRes = authoritativeBackendStore.creditWinningSync({
      userId,
      amount,
      type: 'GAME_WIN',
      gameId: 'reward',
      roundId: 'manual',
      entryId: 'manual',
      idempotencyKey: `reward_${userId}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    });
    return { main: credRes.balanceAfter };
  }

  /**
   * Referral Reward Crediting with strict idempotency (can only be credited once per qualifying referral)
   * Credited 100% to Main Wallet.
   */
  public creditReferralReward(params: {
    referralKey: string;
    userId: string;
    amount: number;
    referrerId?: string;
  }): { success: boolean; message: string; remainingBalance?: { main: number } } {
    const { referralKey, userId, amount, referrerId } = params;

    if (this.processedReferralKeys.has(referralKey)) {
      return {
        success: false,
        message: 'This referral reward has already been credited (idempotency key matched).',
        remainingBalance: this.getUserBalance(userId),
      };
    }

    this.processedReferralKeys.add(referralKey);

    const userBal = this.getUserBalance(userId);
    userBal.main += amount;
    this.userDemoBalances.set(userId, userBal);

    if (referrerId) {
      const refBal = this.getUserBalance(referrerId);
      refBal.main += amount;
      this.userDemoBalances.set(referrerId, refBal);
    }

    return {
      success: true,
      message: `Referral reward of ₹${amount} demo credits credited to Main Wallet (Key: ${referralKey}).`,
      remainingBalance: userBal,
    };
  }

  public spawnNextRound(gameId: string): ServerGameRound {
    const existing = this.rounds.get(gameId);
    const nextRoundNumber = existing ? existing.roundNumber + 1 : 101;
    const now = Date.now();
    const declareTime = new Date(now + 30 * 60000);
    const freezeTime = new Date(declareTime.getTime() - 15 * 60000);
    const gameConfig = SERVER_GAMES_CONFIG.find((g) => g.id === gameId);

    const newRound: ServerGameRound = {
      id: `round-${gameId.replace(/_/g, '-')}-${nextRoundNumber}`,
      gameId,
      gameName: gameConfig?.name || gameId,
      roundNumber: nextRoundNumber,
      freezeTime: freezeTime.toISOString(),
      declareTime: declareTime.toISOString(),
      status: 'OPEN',
      totalBidsPool: 0,
      resultNumber: null,
      resultColor: null,
    };

    this.rounds.set(gameId, newRound);
    return newRound;
  }
}

export const serverGameEntryService = new GameEntryService();
