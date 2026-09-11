import crypto from 'crypto';
import { authoritativeBackendStore } from './authoritativeBackendStore.ts';

export interface ServerGameRound {
  id: string;
  gameId: string;
  gameName: string;
  roundNumber: number;
  openTime?: string;
  freezeTime: string;
  declareTime: string;
  status: 'OPEN' | 'FROZEN' | 'PROCESSING' | 'COMPLETED';
  totalBidsPool: number;
  resultNumber?: string | null;
  resultColor?: 'GREEN' | 'RED' | null;
}

export interface Selection {
  number: string;
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

export const SERVER_GAMES_CONFIG = [
  {
    id: 'hourly_play',
    name: 'Hourly Play',
    code: 'HP-80P',
    subtitle: '7:00 AM → 9:00 PM IST | Hourly | 15-min Freeze | 80% Protection',
    payoutMultiplier: 90,
    singleDigitMultiplier: undefined,
    hasHourlyProtection: true,
    hasGreenRefund: true,
    refundPercentage: 80,
    twoDigitOnly: true,
    description: 'Hourly Play runs from 7:00 AM to 9:00 PM IST. Only 00–99 selections are allowed. Bidding closes 15 minutes before each hourly result. Winning number pays 90× and matching result-color stakes receive 80% protection.',
    accentColor: 'from-emerald-500 to-teal-500',
    intervalMinutes: 60,
  },
  {
    id: 'kalyan_morning',
    name: 'Kalyan Morning',
    code: 'KM-90',
    subtitle: 'Opening: 11:40 AM IST | Result/Close: 12:40 PM IST',
    payoutMultiplier: 90,
    singleDigitMultiplier: 9,
    hasHourlyProtection: false,
    hasGreenRefund: false,
    twoDigitOnly: false,
    description: 'Kalyan Morning opens at 11:40 AM IST and closes/results at 12:40 PM IST. Regular single digit pays 9× and two digit pays 90×.',
    accentColor: 'from-amber-500 to-orange-500',
    intervalMinutes: 1440,
  },
  {
    id: 'kalyan',
    name: 'Kalyan',
    code: 'KL-90',
    subtitle: 'Opening: 04:35 PM IST | Result/Close: 06:35 PM IST',
    payoutMultiplier: 90,
    singleDigitMultiplier: 9,
    hasHourlyProtection: false,
    hasGreenRefund: false,
    twoDigitOnly: false,
    description: 'Kalyan opens at 04:35 PM IST and closes/results at 06:35 PM IST. Regular single digit pays 9× and two digit pays 90×.',
    accentColor: 'from-cyan-500 to-blue-500',
    intervalMinutes: 1440,
  },
  {
    id: 'kalyan_night',
    name: 'Kalyan Night',
    code: 'KN-90',
    subtitle: 'Opening: 09:40 PM IST | Result/Close: 11:40 PM IST',
    payoutMultiplier: 90,
    singleDigitMultiplier: 9,
    hasHourlyProtection: false,
    hasGreenRefund: false,
    twoDigitOnly: false,
    description: 'Kalyan Night opens at 09:40 PM IST and closes/results at 11:40 PM IST. Regular single digit pays 9× and two digit pays 90×.',
    accentColor: 'from-purple-500 to-pink-500',
    intervalMinutes: 1440,
  },
];

type GameId = 'hourly_play' | 'kalyan_morning' | 'kalyan' | 'kalyan_night';

function istTargetUtc(year: number, month: number, day: number, hour: number, minute: number): Date {
  return new Date(Date.UTC(year, month, day, hour, minute, 0, 0) - 330 * 60000);
}

function istParts(date: Date) {
  const shifted = new Date(date.getTime() + 330 * 60000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  };
}

function addDays(year: number, month: number, day: number, days: number) {
  const d = new Date(Date.UTC(year, month, day) + days * 86400000);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth(), day: d.getUTCDate() };
}

function makeScheduledRound(gameId: GameId, now = new Date()): ServerGameRound {
  const p = istParts(now);
  let openTime: Date;
  let declareTime: Date;

  if (gameId === 'hourly_play') {
    let hour = p.hour;
    let dayOffset = 0;
    if (hour < 7) { hour = 7; }
    else if (hour >= 21) { hour = 7; dayOffset = 1; }
    else if (p.minute >= 45) { hour += 1; if (hour >= 21) { hour = 7; dayOffset = 1; } }
    const day = addDays(p.year, p.month, p.day, dayOffset);
    declareTime = istTargetUtc(day.year, day.month, day.day, hour + 1, 0);
    openTime = istTargetUtc(day.year, day.month, day.day, hour, 0);
  } else {
    const schedule: Record<Exclude<GameId, 'hourly_play'>, [number, number, number, number]> = {
      kalyan_morning: [11, 40, 12, 40],
      kalyan: [16, 35, 18, 35],
      kalyan_night: [21, 40, 23, 40],
    };
    const [oh, om, dh, dm] = schedule[gameId];
    let dayOffset = 0;
    const todayOpen = istTargetUtc(p.year, p.month, p.day, oh, om);
    const todayDeclare = istTargetUtc(p.year, p.month, p.day, dh, dm);
    if (now.getTime() > todayDeclare.getTime()) dayOffset = 1;
    const day = addDays(p.year, p.month, p.day, dayOffset);
    openTime = istTargetUtc(day.year, day.month, day.day, oh, om);
    declareTime = istTargetUtc(day.year, day.month, day.day, dh, dm);
  }

  const freezeMinutes = gameId === 'hourly_play' ? 15 : 15;
  const freezeTime = new Date(declareTime.getTime() - freezeMinutes * 60000);
  const open = openTime.getTime();
  const freeze = freezeTime.getTime();
  const status: ServerGameRound['status'] = now.getTime() < open ? 'OPEN' : now.getTime() >= freeze ? 'FROZEN' : 'OPEN';
  const dayNumber = Math.floor(declareTime.getTime() / 3600000);

  return {
    id: `round-${gameId}-${dayNumber}`,
    gameId,
    gameName: SERVER_GAMES_CONFIG.find((g) => g.id === gameId)!.name,
    roundNumber: dayNumber,
    openTime: openTime.toISOString(),
    freezeTime: freezeTime.toISOString(),
    declareTime: declareTime.toISOString(),
    status,
    totalBidsPool: 0,
    resultNumber: null,
    resultColor: null,
  };
}

class GameEntryService {
  private rounds = new Map<string, ServerGameRound>();
  private entries: ServerGameEntry[] = [];
  private idempotencyStore = new Map<string, ServerGameEntry>();

  constructor() {
    this.refreshScheduledRounds();
  }

  private refreshScheduledRounds() {
    const now = new Date();
    for (const game of SERVER_GAMES_CONFIG) {
      const round = makeScheduledRound(game.id as GameId, now);
      this.rounds.set(game.id, round);
      authoritativeBackendStore.setRound(game.id, round as any);
    }
  }

  public getGamesConfig() {
    const now = new Date();
    const roundsList: Record<string, ServerGameRound> = {};
    for (const game of SERVER_GAMES_CONFIG) {
      const existing = this.rounds.get(game.id);
      const round = existing && new Date(existing.declareTime).getTime() > now.getTime() ? existing : makeScheduledRound(game.id as GameId, now);
      if (existing !== round) this.rounds.set(game.id, round);
      const freezeMs = new Date(round.freezeTime).getTime();
      const openMs = round.openTime ? new Date(round.openTime).getTime() : 0;
      roundsList[game.id] = { ...round, status: now.getTime() < openMs ? 'OPEN' : now.getTime() >= freezeMs ? 'FROZEN' : 'OPEN' };
    }
    return { success: true, games: SERVER_GAMES_CONFIG, rounds: roundsList, serverTime: now.toISOString() };
  }

  public getUserBalance(userId: string) {
    const wallet = authoritativeBackendStore.getWalletSync(userId);
    return { main: wallet.balance, bonus: wallet.bonusBalance };
  }

  /** Compatibility method retained only for tests; production APIs never expose it. */
  public setUserBalance(userId: string, balances: { main: number; bonus?: number }) {
    if (!process.env.WINORA_TEST_MODE) throw new Error('Direct balance mutation is disabled in production.');
    const wallet = authoritativeBackendStore.getWalletSync(userId);
    if (balances.main < 0 || (balances.bonus ?? 0) < 0) throw new Error('Balance cannot be negative.');
    wallet.balance = balances.main;
    if (balances.bonus !== undefined) wallet.bonusBalance = balances.bonus;
  }

  public getUserEntries(userId: string): ServerGameEntry[] {
    return this.entries.filter((e) => e.userId === userId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  public submitEntry(params: { userId: string; gameId: string; roundId: string; selections: Selection[]; idempotencyKey?: string; walletPreference?: 'main' | 'bonus' }) {
    const { userId, gameId, roundId, selections, idempotencyKey, walletPreference } = params;
    if (!userId) return { success: false, errorCode: 'AUTH_REQUIRED', error: 'Authenticated player is required.' };
    if (idempotencyKey && this.idempotencyStore.has(idempotencyKey)) {
      const existing = this.idempotencyStore.get(idempotencyKey)!;
      return { success: true, entry: existing, remainingBalance: this.getUserBalance(userId) };
    }

    const gameConfig = SERVER_GAMES_CONFIG.find((g) => g.id === gameId);
    if (!gameConfig) return { success: false, errorCode: 'GAME_UNAVAILABLE', error: 'Requested game is not available.' };

    let round = this.rounds.get(gameId);
    if (!round || round.id !== roundId || new Date(round.declareTime).getTime() <= Date.now()) {
      round = makeScheduledRound(gameId as GameId, new Date());
      this.rounds.set(gameId, round);
    }
    const now = Date.now();
    const openMs = round.openTime ? new Date(round.openTime).getTime() : 0;
    const freezeMs = new Date(round.freezeTime).getTime();
    if (now < openMs) return { success: false, errorCode: 'ROUND_NOT_OPEN', error: 'Bidding for this game has not opened yet.' };
    if (round.status !== 'OPEN' || now >= freezeMs) return { success: false, errorCode: 'ROUND_CLOSED', error: 'Bidding is closed for this round.' };

    if (!Array.isArray(selections) || selections.length === 0) return { success: false, errorCode: 'EMPTY_SELECTION', error: 'Please select at least 1 number.' };
    if (selections.length > 37) return { success: false, errorCode: 'LIMIT_EXCEEDED', error: 'Maximum 37 unique numbers per player per round.' };

    const seen = new Set<string>();
    let totalStake = 0;
    for (const sel of selections) {
      if (!sel || typeof sel !== 'object') return { success: false, errorCode: 'INVALID_SELECTION', error: 'Malformed selection.' };
      if (typeof sel.number !== 'string') return { success: false, errorCode: 'INVALID_NUMBER', error: 'Number is required.' };
      const isSingle = /^\d$/.test(sel.number);
      const isDouble = /^\d{2}$/.test(sel.number);
      if (!isSingle && !isDouble) return { success: false, errorCode: 'INVALID_NUMBER', error: 'Regular games accept 0–9 single digit or 00–99 two digit numbers.' };
      if (gameId === 'hourly_play' && !isDouble) return { success: false, errorCode: 'INVALID_NUMBER', error: 'Hourly Play accepts only 00–99.' };
      const normalized = isSingle ? `0${sel.number}` : sel.number;
      const value = Number(normalized);
      if (value < 0 || value > 99 || seen.has(normalized)) return { success: false, errorCode: 'DUPLICATE_OR_INVALID_NUMBER', error: `Invalid or duplicate number ${sel.number}.` };
      seen.add(normalized);
      if (typeof sel.stake !== 'number' || !Number.isFinite(sel.stake) || sel.stake < 1 || sel.stake > 10000) return { success: false, errorCode: 'INVALID_AMOUNT', error: 'Each stake must be between 1 and 10,000 coins.' };
      const expectedColor: 'GREEN' | 'RED' = value % 2 === 0 ? 'GREEN' : 'RED';
      if (sel.color !== expectedColor) return { success: false, errorCode: 'COLOR_MISMATCH', error: `Number ${sel.number} must use ${expectedColor}.` };
      totalStake += sel.stake;
    }

    const effectiveKey = idempotencyKey || `bid_${userId}_${round.id}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const debit = authoritativeBackendStore.debitStakeSync({ userId, amount: totalStake, gameId, roundId: round.id, idempotencyKey: effectiveKey, walletPreference });
    if (!debit.success) return { success: false, errorCode: 'INSUFFICIENT_COINS', error: debit.error || 'Insufficient coins.' };

    round.totalBidsPool += totalStake;
    const entry: ServerGameEntry = {
      id: `ENTRY-${crypto.randomBytes(5).toString('hex').toUpperCase()}`,
      userId,
      gameId,
      gameName: gameConfig.name,
      roundId: round.id,
      roundNumber: round.roundNumber,
      selections: selections.map((s) => ({ ...s, number: /^\d$/.test(s.number) ? `0${s.number}` : s.number })).sort((a, b) => a.number.localeCompare(b.number)),
      totalStake,
      walletUsed: debit.walletUsed,
      status: 'CONFIRMED',
      createdAt: new Date().toISOString(),
      idempotencyKey: effectiveKey,
      balanceBefore: debit.balanceBefore,
      balanceAfter: debit.balanceAfter,
      bonusBalanceBefore: debit.bonusBalanceBefore,
      bonusBalanceAfter: debit.bonusBalanceAfter,
      ledgerTxId: debit.ledgerId,
    };
    this.entries.unshift(entry);
    this.idempotencyStore.set(effectiveKey, entry);
    authoritativeBackendStore.saveEntrySync(entry as any);
    authoritativeBackendStore.setRound(gameId, round as any);
    return { success: true, entry, remainingBalance: { main: debit.balanceAfter, bonus: debit.bonusBalanceAfter } };
  }

  public getAllRoundsMap() { return this.rounds; }
  public getRound(gameId: string) { return this.rounds.get(gameId); }
  public getRoundById(roundId: string) { return Array.from(this.rounds.values()).find((r) => r.id === roundId); }
  public getEntriesForRound(roundId: string) { return this.entries.filter((e) => e.roundId === roundId); }
  public updateEntry(entryId: string, updates: Partial<ServerGameEntry>) { const entry = this.entries.find((e) => e.id === entryId); if (entry) Object.assign(entry, updates); }

  /** Internal settlement compatibility helper; direct client access is not exposed. */
  public creditUserDemoReward(userId: string, amount: number) {
    if (!process.env.WINORA_TEST_MODE) throw new Error('Direct reward mutation is disabled in production.');
    authoritativeBackendStore.creditWinningSync({ userId, amount, type: 'GAME_WIN', gameId: 'test', roundId: 'test', entryId: 'test', idempotencyKey: `test_reward_${userId}_${Date.now()}` });
    return this.getUserBalance(userId);
  }

  public creditReferralReward(params: { referralKey: string; userId: string; amount: number; referrerId?: string }) {
    if (!process.env.WINORA_TEST_MODE) throw new Error('Direct referral mutation is disabled in production.');
    const { referralKey, userId, amount, referrerId } = params;
    const credit = authoritativeBackendStore.creditBonusSync({ userId, amount, type: 'REFERRAL_REWARD', actorId: 'referral_system', referenceId: referralKey, idempotencyKey: `ref_user_${referralKey}` });
    if (referrerId) authoritativeBackendStore.creditBonusSync({ userId: referrerId, amount, type: 'REFERRAL_REWARD', actorId: 'referral_system', referenceId: referralKey, idempotencyKey: `ref_referrer_${referralKey}` });
    return { success: credit.success, message: credit.success ? `Referral reward of ${amount} coins credited to Bonus Wallet.` : 'Referral reward could not be credited.', remainingBalance: this.getUserBalance(userId) };
  }

  public spawnNextRound(gameId: string): ServerGameRound {
    const round = makeScheduledRound(gameId as GameId, new Date());
    this.rounds.set(gameId, round);
    authoritativeBackendStore.setRound(gameId, round as any);
    return round;
  }
}

export const serverGameEntryService = new GameEntryService();
