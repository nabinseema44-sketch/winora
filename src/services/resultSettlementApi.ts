export interface GameResultRecord {
  resultId: string;
  gameId: string;
  roundId: string;
  roundNumber: number;
  gameName: string;
  winningNumber: string;
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

export interface RoundWithStats {
  id: string;
  gameId: string;
  gameName: string;
  roundNumber: number;
  freezeTime: string;
  declareTime: string;
  status: 'OPEN' | 'FROZEN' | 'PROCESSING' | 'COMPLETED';
  totalBidsPool: number;
  resultNumber?: string | null;
  entriesCount: number;
  totalStake: number;
  result?: GameResultRecord;
}

class ResultSettlementApiService {
  /**
   * Fetch all game rounds with live status and stats
   */
  public async fetchRounds(): Promise<RoundWithStats[]> {
    try {
      const res = await fetch('/api/results/rounds');
      const data = await res.json();
      if (data.success && Array.isArray(data.rounds)) {
        return data.rounds;
      }
      return [];
    } catch {
      return [];
    }
  }

  /**
   * Fetch recent declared results
   */
  public async fetchRecentResults(): Promise<GameResultRecord[]> {
    try {
      const res = await fetch('/api/results/recent');
      const data = await res.json();
      if (data.success && Array.isArray(data.results)) {
        return data.results;
      }
      return [];
    } catch {
      return [];
    }
  }

  /**
   * Fetch specific round result
   */
  public async fetchRoundResult(roundId: string): Promise<GameResultRecord | null> {
    try {
      const res = await fetch(`/api/results/round/${encodeURIComponent(roundId)}`);
      const data = await res.json();
      if (data.success && data.result) {
        return data.result;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Master freeze round helper
   */
  public async freezeRound(params: {
    gameId: string;
    roundId: string;
    actorId: string;
    actorRole: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const res = await fetch('/api/results/freeze-round', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': params.actorId,
          'x-user-role': params.actorRole,
        },
        body: JSON.stringify({
          gameId: params.gameId,
          roundId: params.roundId,
        }),
      });
      const data = await res.json();
      return {
        success: Boolean(data.success),
        message: data.message || data.error || 'Round freeze updated.',
      };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Network error while freezing round.' };
    }
  }

  /**
   * Master declare result & execute settlement
   */
  public async declareResult(params: {
    gameId: string;
    roundId: string;
    winningNumber: string;
    actorId: string;
    actorRole: string;
  }): Promise<{
    success: boolean;
    message: string;
    result?: GameResultRecord;
    summary?: SettlementSummary;
  }> {
    try {
      const res = await fetch('/api/results/declare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': params.actorId,
          'x-user-role': params.actorRole,
        },
        body: JSON.stringify({
          gameId: params.gameId,
          roundId: params.roundId,
          winningNumber: params.winningNumber,
        }),
      });
      const data = await res.json();
      return {
        success: Boolean(data.success),
        message: data.message || data.error || 'Result declaration finished.',
        result: data.result,
        summary: data.summary,
      };
    } catch (e: any) {
      return {
        success: false,
        message: e?.message || 'Network error executing result declaration.',
      };
    }
  }

  /**
   * Fetch immutable audit logs for Master
   */
  public async fetchAuditLogs(actorRole: string): Promise<SettlementAuditLog[]> {
    try {
      const res = await fetch('/api/results/audit-logs', {
        headers: {
          'x-user-role': actorRole,
        },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.logs)) {
        return data.logs;
      }
      return [];
    } catch {
      return [];
    }
  }
}

export const resultSettlementApi = new ResultSettlementApiService();
