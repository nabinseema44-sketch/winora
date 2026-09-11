import crypto from 'crypto';
import {
  serverGameEntryService,
  type ServerGameRound,
  type ServerGameEntry,
  SERVER_GAMES_CONFIG,
} from './gameEntryService.ts';
import { authoritativeBackendStore } from './authoritativeBackendStore.ts';

export interface GameResultRecord {
  resultId: string;
  gameId: string;
  roundId: string;
  roundNumber: number;
  gameName: string;
  winningNumber: string; // Exact two-digit string '00'–'99'
  resultColor: 'GREEN' | 'RED';
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
  resultColor: 'GREEN' | 'RED';
  totalEntries: number;
  winningEntries: number;
  losingEntries: number;
  totalStake: number;
  total90xRewards: number;
  totalProtectionRefund: number;
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
  rewardType: 'GAME_WIN' | 'HOURLY_PROTECTION_REFUND' | '90x_win' | 'protection_refund' | '90x_win_protection_refund';
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
    const sampleResultId = 'RES-GX100-42-G';
    const sampleSettleId = 'SETTLE-INIT-9001';

    const summary: SettlementSummary = {
      settlementId: sampleSettleId,
      resultId: sampleResultId,
      roundId: sampleRoundId,
      gameId: 'game_x',
      winningNumber: '42',
      resultColor: 'GREEN',
      totalEntries: 18,
      winningEntries: 2,
      losingEntries: 16,
      totalStake: 3600,
      total90xRewards: 18000,
      totalProtectionRefund: 0,
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
      resultColor: 'GREEN',
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
      details: { winningNumber: '42', resultColor: 'GREEN' },
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
   * Calculate potential settlement liabilities before Master confirms declaration
   */
  public calculateSettlementLiability(params: {
    gameId: string;
    roundId: string;
    winningNumber: string;
    resultColor: 'GREEN' | 'RED';
  }): {
    winningNumber: string;
    resultColor: 'GREEN' | 'RED';
    totalEntries: number;
    totalStake: number;
    total90xPayout: number;
    totalProtectionRefund: number;
    totalLiability: number;
    netHousePnL: number;
    winningBidsCount: number;
    matchingColorBidsCount: number;
  } {
    const { gameId, roundId, winningNumber, resultColor } = params;
    const gameConfig = SERVER_GAMES_CONFIG.find((g) => g.id === gameId);
    const roundEntries = serverGameEntryService.getEntriesForRound(roundId);

    const isHourlyDhamaka = gameId === 'hourly_dhamaka' || Boolean(gameConfig?.hasGreenRefund);

    let totalStake = 0;
    let potential90xLiability = 0;
    let protectionRefundLiability = 0;
    let winningBidsCount = 0;
    let matchingColorBidsCount = 0;

    for (const entry of roundEntries) {
      totalStake += entry.totalStake;
      for (const sel of entry.selections) {
        if (sel.number === winningNumber) {
          potential90xLiability += sel.stake * (gameConfig?.payoutMultiplier || 90);
          winningBidsCount++;
        } else if (isHourlyDhamaka && sel.color === resultColor) {
          // Protection liability applies only to eligible non-winning bids on the matching winning color
          protectionRefundLiability += Number((sel.stake * 0.8).toFixed(2));
          matchingColorBidsCount++;
        }
      }
    }

    protectionRefundLiability = Number(protectionRefundLiability.toFixed(2));
    const totalLiability = Number((potential90xLiability + protectionRefundLiability).toFixed(2));
    const netHousePnL = Number((totalStake - totalLiability).toFixed(2));

    return {
      winningNumber,
      resultColor,
      totalEntries: roundEntries.length,
      totalStake,
      total90xPayout: potential90xLiability,
      totalProtectionRefund: protectionRefundLiability,
      totalLiability,
      netHousePnL,
      winningBidsCount,
      matchingColorBidsCount,
    };
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
   * Validates Master-declared Winning Number (00-99) and Result Color (GREEN/RED).
   * Executes 90x payout and 80% color protection refund to demo Main Wallet.
   */
  public declareResultAndSettle(params: {
    actorRole: string;
    actorId: string;
    gameId: string;
    roundId: string;
    winningNumber: string;
    resultColor: 'GREEN' | 'RED';
    idempotencyKey?: string;
  }): {
    success: boolean;
    error?: string;
    errorCode?: string;
    result?: GameResultRecord;
    summary?: SettlementSummary;
  } {
    const { actorRole, actorId, gameId, roundId, winningNumber, resultColor, idempotencyKey } = params;

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
    const existingResult = this.resultsByRound.get(roundId);
    if (existingResult && existingResult.status === 'COMPLETED') {
      return {
        success: false,
        errorCode: 'ROUND_ALREADY_SETTLED',
        error: `Round "${roundId}" has already been declared and settled (Winning Number: ${existingResult.winningNumber}, Color: ${existingResult.resultColor}). Duplicate settlement rejected.`,
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

    // 7. Validate Result Color (GREEN or RED)
    if (resultColor !== 'GREEN' && resultColor !== 'RED') {
      return {
        success: false,
        errorCode: 'INVALID_RESULT_COLOR',
        error: `Invalid result color: "${resultColor}". Master must declare either GREEN or RED.`,
      };
    }

    // 8. Begin Settlement Phase: Round transitions to PROCESSING
    round.status = 'PROCESSING';

    const settlementId = `SETTLE-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const resultId = `RES-${gameConfig.code.replace(/[^a-zA-Z0-9]/g, '')}-${round.roundNumber}-${winningNumber}-${resultColor[0]}`;
    const declaredAt = new Date().toISOString();

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
        resultColor,
      },
    });

    try {
      // 9. Retrieve All Eligible Confirmed Entries for this Round
      const roundEntries = serverGameEntryService.getEntriesForRound(roundId);

      let totalStake = 0;
      let total90xRewards = 0;
      let totalProtectionRefund = 0;
      let totalDemoRewards = 0;
      let winningCount = 0;
      let losingCount = 0;
      const winningEntryIds: string[] = [];

      const isHourlyDhamaka = gameId === 'hourly_dhamaka' || Boolean(gameConfig.hasGreenRefund);

      for (const entry of roundEntries) {
        totalStake += entry.totalStake;

        let entryBase90x = 0;
        let entryProtectionRefund = 0;

        for (const sel of entry.selections) {
          // 90x payout if selection matches winning number
          if (sel.number === winningNumber) {
            entryBase90x += sel.stake * gameConfig.payoutMultiplier;
          } else if (isHourlyDhamaka && sel.color === resultColor) {
            // 80% protection refund ONLY if selection color matches declared resultColor and did not win 90x!
            entryProtectionRefund += Number((sel.stake * 0.8).toFixed(2));
          }
        }

        entryProtectionRefund = Number(entryProtectionRefund.toFixed(2));
        const totalEntryCredit = Number((entryBase90x + entryProtectionRefund).toFixed(2));
        total90xRewards += entryBase90x;
        totalProtectionRefund = Number((totalProtectionRefund + entryProtectionRefund).toFixed(2));
        totalDemoRewards = Number((totalDemoRewards + totalEntryCredit).toFixed(2));

        if (totalEntryCredit > 0) {
          winningCount++;
          winningEntryIds.push(entry.id);

          // Update entry record
          serverGameEntryService.updateEntry(entry.id, {
            status: 'WON',
            settledReward: entryBase90x,
            protectionRefund: entryProtectionRefund,
            totalSettlementCredit: totalEntryCredit,
            settledWinningNumber: winningNumber,
            settledResultColor: resultColor,
            settlementId,
            settledAt: declaredAt,
          });

          // Atomically Credit Demo Main Wallet via Authoritative Backend Store with exact ledger integrity
          if (entryBase90x > 0) {
            authoritativeBackendStore.creditWinningSync({
              userId: entry.userId,
              amount: entryBase90x,
              type: 'GAME_WIN',
              gameId,
              roundId,
              entryId: entry.id,
              referenceId: resultId,
              idempotencyKey: `win_${settlementId}_${entry.id}`,
            });

            const winTxId = `TX-WIN-${settlementId}-${entry.id}`;
            const winTx: WalletRewardTransaction = {
              transactionId: winTxId,
              userId: entry.userId,
              entryId: entry.id,
              resultId,
              roundId,
              rewardType: 'GAME_WIN',
              amount: entryBase90x,
              createdAt: declaredAt,
            };
            this.walletRewardLedger.push(winTx);
          }

          if (entryProtectionRefund > 0) {
            authoritativeBackendStore.creditWinningSync({
              userId: entry.userId,
              amount: entryProtectionRefund,
              type: 'HOURLY_PROTECTION_REFUND',
              gameId,
              roundId,
              entryId: entry.id,
              referenceId: resultId,
              idempotencyKey: `prot_${settlementId}_${entry.id}`,
            });

            const refTxId = `TX-PROT-${settlementId}-${entry.id}`;
            const refTx: WalletRewardTransaction = {
              transactionId: refTxId,
              userId: entry.userId,
              entryId: entry.id,
              resultId,
              roundId,
              rewardType: 'HOURLY_PROTECTION_REFUND',
              amount: entryProtectionRefund,
              createdAt: declaredAt,
            };
            this.walletRewardLedger.push(refTx);
          }

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
              base90x: entryBase90x,
              protectionRefund: entryProtectionRefund,
              totalCredited: totalEntryCredit,
              winningNumber,
              resultColor,
            },
          });
        } else {
          // Losing entry
          losingCount++;
          serverGameEntryService.updateEntry(entry.id, {
            status: 'LOST',
            settledReward: 0,
            protectionRefund: 0,
            totalSettlementCredit: 0,
            settledWinningNumber: winningNumber,
            settledResultColor: resultColor,
            settlementId,
            settledAt: declaredAt,
          });
        }
      }

      // 10. Generate Settlement Summary
      const summary: SettlementSummary = {
        settlementId,
        resultId,
        roundId,
        gameId,
        winningNumber,
        resultColor,
        totalEntries: roundEntries.length,
        winningEntries: winningCount,
        losingEntries: losingCount,
        totalStake,
        total90xRewards,
        totalProtectionRefund: Number(totalProtectionRefund.toFixed(2)),
        totalDemoRewards: Number(totalDemoRewards.toFixed(2)),
        failedSettlements: 0,
        settlementTimestamp: declaredAt,
        winningEntryIds,
      };

      // 11. Complete Round Lifecycle: PROCESSING -> COMPLETED
      round.status = 'COMPLETED';
      round.resultNumber = winningNumber;
      round.resultColor = resultColor;

      // 12. Create Immutable Result Record
      const resultRecord: GameResultRecord = {
        resultId,
        gameId,
        roundId,
        roundNumber: round.roundNumber,
        gameName: gameConfig.name,
        winningNumber,
        resultColor,
        declaredBy: actorId,
        declaredAt,
        ruleVersion: '2.0',
        status: 'COMPLETED',
        settlementId,
        createdAt: declaredAt,
        summary,
      };

      this.results.set(resultId, resultRecord);
      this.resultsByRound.set(roundId, resultRecord);
      this.completedSettlementIds.add(settlementId);
      authoritativeBackendStore.saveResultSync(resultRecord as any);

      // Spawn next active round so bidding can continue for players
      serverGameEntryService.spawnNextRound(gameId);

      return {
        success: true,
        result: resultRecord,
        summary,
      };
    } catch (err: unknown) {
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
