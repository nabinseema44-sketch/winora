import crypto from 'crypto';
import {
  serverGameEntryService,
  ServerGameRound,
  ServerGameEntry,
  SERVER_GAMES_CONFIG,
  SERVER_GREEN_NUMBERS,
} from './gameEntryService.ts';

export interface GameResultRecord {
  resultId: string;
  gameId: string;
  roundId: string;
  roundNumber: number;
  gameName: string;
  winningNumber: string; // Exact two-digit string '00'–'99'
  declaredBy: string;
  declaredAt: string;
  ruleVersion: string;
  status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
  settlementId: string;
  createdAt: string;
  summary?: SettlementSummary;
}

export interface SettlementSummary {
  settlementId: string;
  resultId: string;
  roundId: string;
  gameId: string;
  winningNumber: string;
  isGreenNumber: boolean;
  totalEntries: number;
  winningEntries: number;
  losingEntries: number;
  totalStake: number;
  total90xRewards: number;
  totalGreenProtection: number;
  totalDemoRewards: number;
  failedSettlements: number;
  settlementTimestamp: string;
  winningEntryIds: string[];
}

export interface WalletRewardTransaction {
  transactionId: string;
  userId: string;
  entryId: string;
  resultId: string;
  roundId: string;
  rewardType: '90x_win' | '90x_win_green_protection';
  amount: number;
  createdAt: string;
}

export interface SettlementAuditLog {
  auditId: string;
  event: 'RESULT_DECLARED' | 'REWARD_SETTLED' | 'SETTLEMENT_FAILED';
  actor: string;
  roundId: string;
  resultId: string;
  settlementId: string;
  entryReference?: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

class ResultSettlementService {
  private results: Map<string, GameResultRecord> = new Map(); // resultId -> record
  private resultsByRound: Map<string, GameResultRecord> = new Map(); // roundId -> record
  private walletRewardLedger: WalletRewardTransaction[] = [];
  private auditLogs: SettlementAuditLog[] = [];
  private completedSettlementIds: Set<string> = new Set();

  constructor() {
    this.seedSampleResults();
  }

  /**
   * Seed a historic settled round for UI review
   */
  private seedSampleResults() {
    const sampleRoundId = 'round-gx-100';
    const sampleResultId = 'RES-GX100-42';
    const sampleSettleId = 'SETTLE-INIT-9001';

    const summary: SettlementSummary = {
      settlementId: sampleSettleId,
      resultId: sampleResultId,
      roundId: sampleRoundId,
      gameId: 'game_x',
      winningNumber: '42',
      isGreenNumber: true,
      totalEntries: 18,
      winningEntries: 2,
      losingEntries: 16,
      totalStake: 3600,
      total90xRewards: 18000,
      totalGreenProtection: 0,
      totalDemoRewards: 18000,
      failedSettlements: 0,
      settlementTimestamp: new Date(Date.now() - 3600000).toISOString(),
      winningEntryIds: ['ENTRY-SEED-01', 'ENTRY-SEED-02'],
    };

    const record: GameResultRecord = {
      resultId: sampleResultId,
      gameId: 'game_x',
      roundId: sampleRoundId,
      roundNumber: 100,
      gameName: 'Game X',
      winningNumber: '42',
      declaredBy: 'master-admin',
      declaredAt: new Date(Date.now() - 3600000).toISOString(),
      ruleVersion: '1.0',
      status: 'COMPLETED',
      settlementId: sampleSettleId,
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      summary,
    };

    this.results.set(sampleResultId, record);
    this.resultsByRound.set(sampleRoundId, record);
    this.completedSettlementIds.add(sampleSettleId);

    this.logAudit({
      event: 'RESULT_DECLARED',
      actor: 'master-admin',
      roundId: sampleRoundId,
      resultId: sampleResultId,
      settlementId: sampleSettleId,
      details: { winningNumber: '42' },
    });

    this.logAudit({
      event: 'REWARD_SETTLED',
      actor: 'system',
      roundId: sampleRoundId,
      resultId: sampleResultId,
      settlementId: sampleSettleId,
      entryReference: 'ENTRY-SEED-01',
      details: { amount: 9000 },
    });
  }

  private logAudit(entry: Omit<SettlementAuditLog, 'auditId' | 'timestamp'>) {
    const auditId = `AUD-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const logItem: SettlementAuditLog = {
      ...entry,
      auditId,
      timestamp: new Date().toISOString(),
    };
    this.auditLogs.unshift(logItem);
  }

  /**
   * Return all audit logs
   */
  public getAuditLogs(): SettlementAuditLog[] {
    return this.auditLogs;
  }

  /**
   * Return recent declared results
   */
  public getRecentResults(): GameResultRecord[] {
    return Array.from(this.results.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Return result by round ID
   */
  public getResultByRoundId(roundId: string): GameResultRecord | undefined {
    return this.resultsByRound.get(roundId);
  }

  /**
   * Return all wallet reward transactions
   */
  public getRewardLedger(): WalletRewardTransaction[] {
    return this.walletRewardLedger;
  }

  /**
   * Master Manual Round Freeze (to facilitate immediate testing of open rounds)
   */
  public freezeRound(params: {
    actorRole: string;
    actorId: string;
    gameId: string;
    roundId: string;
  }): { success: boolean; error?: string; errorCode?: string; round?: ServerGameRound } {
    const { actorRole, actorId, gameId, roundId } = params;

    // Verify Master authorization
    if (actorRole !== 'master' && actorRole !== 'admin') {
      return {
        success: false,
        errorCode: 'UNAUTHORIZED',
        error: 'Access denied: Master or Super Admin credentials required to freeze rounds.',
      };
    }

    const round = serverGameEntryService.getRound(gameId);
    if (!round || round.id !== roundId) {
      return {
        success: false,
        errorCode: 'INVALID_ROUND',
        error: `Round ${roundId} not found for game ${gameId}.`,
      };
    }

    if (round.status === 'COMPLETED') {
      return {
        success: false,
        errorCode: 'ROUND_ALREADY_COMPLETED',
        error: 'Round has already been completed and settled.',
      };
    }

    round.status = 'FROZEN';
    return {
      success: true,
      round,
    };
  }

  /**
   * Master Result Declaration and Authoritative Settlement Engine
   */
  public declareResultAndSettle(params: {
    actorRole: string;
    actorId: string;
    gameId: string;
    roundId: string;
    winningNumber: string;
    idempotencyKey?: string;
  }): {
    success: boolean;
    error?: string;
    errorCode?: string;
    result?: GameResultRecord;
    summary?: SettlementSummary;
  } {
    const { actorRole, actorId, gameId, roundId, winningNumber, idempotencyKey } = params;

    // 1. Authoritative Role Verification: Master / Admin only
    if (actorRole !== 'master' && actorRole !== 'admin') {
      return {
        success: false,
        errorCode: 'UNAUTHORIZED',
        error: 'Access denied: Master / Super Admin authorization is strictly required to declare winning results.',
      };
    }

    // 2. Validate Game Existence
    const gameConfig = SERVER_GAMES_CONFIG.find((g) => g.id === gameId);
    if (!gameConfig) {
      return {
        success: false,
        errorCode: 'INVALID_GAME',
        error: `Game "${gameId}" does not exist in the configured game registry.`,
      };
    }

    // 3. Double-Settlement & Idempotency Check:
    // If this round has already been declared and settled, DO NOT pay twice!
    const existingResult = this.resultsByRound.get(roundId);
    if (existingResult && existingResult.status === 'COMPLETED') {
      return {
        success: true,
        result: existingResult,
        summary: existingResult.summary,
      };
    }

    // 4. Validate Round Existence
    const round = serverGameEntryService.getRound(gameId);
    if (!round || round.id !== roundId) {
      return {
        success: false,
        errorCode: 'INVALID_ROUND',
        error: `Round "${roundId}" does not match active round for ${gameConfig.name}.`,
      };
    }

    // 5. Round Lifecycle State Check:
    // Only a FROZEN round may enter result processing!
    // Check both explicit status and server freeze deadline
    const now = Date.now();
    const freezeTimestamp = new Date(round.freezeTime).getTime();
    if (round.status === 'OPEN' && now >= freezeTimestamp) {
      round.status = 'FROZEN';
    }

    if (round.status !== 'FROZEN') {
      const statusMsg: Record<string, string> = {
        OPEN: 'Only a FROZEN round may enter result processing. Bidding must be frozen 15 minutes prior to declaration.',
        COMPLETED: 'Round has already been settled and marked COMPLETED.',
        CANCELLED: 'Round was cancelled and cannot be settled.',
        PROCESSING: 'Round is currently undergoing settlement execution.',
      };
      return {
        success: false,
        errorCode: `ROUND_${round.status}`,
        error: statusMsg[round.status] || `Cannot settle round with status ${round.status}.`,
      };
    }

    // 6. Validate Winning Number
    // Must be exact two-digit string '00' to '99'
    if (typeof winningNumber !== 'string' || !/^\d{2}$/.test(winningNumber)) {
      return {
        success: false,
        errorCode: 'INVALID_WINNING_NUMBER',
        error: `Invalid winning number format: "${winningNumber}". Must be a two-digit string between "00" and "99".`,
      };
    }

    const numVal = parseInt(winningNumber, 10);
    if (numVal < 0 || numVal > 99) {
      return {
        success: false,
        errorCode: 'INVALID_WINNING_NUMBER',
        error: `Winning number out of range: "${winningNumber}". Allowed range is 00 to 99.`,
      };
    }

    // 7. Begin Settlement Phase: Round transitions to PROCESSING
    round.status = 'PROCESSING';

    const settlementId = `SETTLE-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const resultId = `RES-${gameConfig.code.replace(/[^a-zA-Z0-9]/g, '')}-${round.roundNumber}-${winningNumber}`;
    const declaredAt = new Date().toISOString();

    // Check if this settlement ID was somehow already processed
    if (this.completedSettlementIds.has(settlementId)) {
      return {
        success: false,
        errorCode: 'DOUBLE_SETTLEMENT_ATTEMPT',
        error: 'Settlement token collision or replay detected. Duplicate payout aborted.',
      };
    }

    // Audit Log: RESULT_DECLARED
    this.logAudit({
      event: 'RESULT_DECLARED',
      actor: actorId,
      roundId,
      resultId,
      settlementId,
      details: {
        gameId,
        gameName: gameConfig.name,
        winningNumber,
      },
    });

    try {
      // 8. Retrieve All Eligible Confirmed Entries for this Round
      const roundEntries = serverGameEntryService.getEntriesForRound(roundId);
      const isGreen = SERVER_GREEN_NUMBERS.includes(winningNumber);

      let totalStake = 0;
      let total90xRewards = 0;
      let totalGreenProtection = 0;
      let totalDemoRewards = 0;
      let winningCount = 0;
      let losingCount = 0;
      const winningEntryIds: string[] = [];

      for (const entry of roundEntries) {
        totalStake += entry.totalStake;

        // Determine if entry selected the winning number
        const isWinner = entry.selectedNumbers.includes(winningNumber);

        if (isWinner) {
          winningCount++;
          winningEntryIds.push(entry.id);

          // Calculate reward based on winning number stake:
          // In WINORA, winningStake = entry.amountPerNumber (the stake placed on that number)
          const winningStake = entry.amountPerNumber;
          const base90x = winningStake * gameConfig.payoutMultiplier; // 90x

          // Hourly Dhamaka Green Protection Rule:
          // If Hourly Dhamaka and the winning number is GREEN:
          // additional Green Protection = winningStake * 80%
          let greenProtection = 0;
          if (gameConfig.hasGreenRefund && isGreen) {
            greenProtection = Math.round(winningStake * 0.8);
          }

          const entryTotalReward = base90x + greenProtection;
          total90xRewards += base90x;
          totalGreenProtection += greenProtection;
          totalDemoRewards += entryTotalReward;

          // Update entry record
          serverGameEntryService.updateEntry(entry.id, {
            status: 'WON',
            settledReward: entryTotalReward,
            settledWinningNumber: winningNumber,
            settlementId,
            settledAt: declaredAt,
          });

          // Atomically Credit Demo Main Wallet via authoritative wallet service
          serverGameEntryService.creditUserDemoReward(entry.userId, entryTotalReward);

          // Create Immutable Wallet Ledger Transaction
          const txId = `TX-WIN-${settlementId}-${entry.id}`;
          const rewardTx: WalletRewardTransaction = {
            transactionId: txId,
            userId: entry.userId,
            entryId: entry.id,
            resultId,
            roundId,
            rewardType: greenProtection > 0 ? '90x_win_green_protection' : '90x_win',
            amount: entryTotalReward,
            createdAt: declaredAt,
          };
          this.walletRewardLedger.push(rewardTx);

          // Audit Log: REWARD_SETTLED
          this.logAudit({
            event: 'REWARD_SETTLED',
            actor: 'system_settlement_engine',
            roundId,
            resultId,
            settlementId,
            entryReference: entry.id,
            details: {
              userId: entry.userId,
              winningStake,
              base90x,
              greenProtection,
              totalCredited: entryTotalReward,
              walletTxId: txId,
            },
          });
        } else {
          // Losing entry receives no reward.
          // Original stake remains represented by existing game-entry wallet transaction.
          losingCount++;
          serverGameEntryService.updateEntry(entry.id, {
            status: 'LOST',
            settledReward: 0,
            settledWinningNumber: winningNumber,
            settlementId,
            settledAt: declaredAt,
          });
        }
      }

      // 9. Generate Settlement Summary
      const summary: SettlementSummary = {
        settlementId,
        resultId,
        roundId,
        gameId,
        winningNumber,
        isGreenNumber: isGreen,
        totalEntries: roundEntries.length,
        winningEntries: winningCount,
        losingEntries: losingCount,
        totalStake,
        total90xRewards,
        totalGreenProtection,
        totalDemoRewards,
        failedSettlements: 0,
        settlementTimestamp: declaredAt,
        winningEntryIds,
      };

      // 10. Complete Round Lifecycle: PROCESSING -> COMPLETED
      round.status = 'COMPLETED';
      round.resultNumber = winningNumber;

      // 11. Create Immutable Result Record
      const resultRecord: GameResultRecord = {
        resultId,
        gameId,
        roundId,
        roundNumber: round.roundNumber,
        gameName: gameConfig.name,
        winningNumber,
        declaredBy: actorId,
        declaredAt,
        ruleVersion: '1.0',
        status: 'COMPLETED',
        settlementId,
        createdAt: declaredAt,
        summary,
      };

      this.results.set(resultId, resultRecord);
      this.resultsByRound.set(roundId, resultRecord);
      this.completedSettlementIds.add(settlementId);

      // Spawn next active round so bidding can continue for players
      serverGameEntryService.spawnNextRound(gameId);

      return {
        success: true,
        result: resultRecord,
        summary,
      };
    } catch (err: unknown) {
      // If settlement fails, round remains in PROCESSING state.
      // Never mark a failed or partially settled round as COMPLETED!
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logAudit({
        event: 'SETTLEMENT_FAILED',
        actor: 'system_settlement_engine',
        roundId,
        resultId,
        settlementId,
        details: { error: errorMsg },
      });

      return {
        success: false,
        errorCode: 'SETTLEMENT_EXECUTION_FAILED',
        error: `Settlement execution encountered an error: ${errorMsg}. Round remains in PROCESSING state for manual audit.`,
      };
    }
  }
}

export const serverResultSettlementService = new ResultSettlementService();
