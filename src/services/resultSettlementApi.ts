import { getFirebaseAuth } from '../firebase/config.ts';

export interface GameResultRecord {
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
  totalProtectionRefunds?: number;
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
  resultColor?: 'GREEN' | 'RED' | null;
  entriesCount: number;
  totalStake: number;
  result?: GameResultRecord;
}

export interface SettlementLiabilityPreview {
  winningNumber: string;
  resultColor: 'GREEN' | 'RED';
  totalStake: number;
  total90xPayout: number;
  totalProtectionRefund: number;
  totalLiability: number;
  netHousePnL: number;
  winningBidsCount?: number;
  matchingColorBidsCount?: number;
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
   * Master preview liability for winning number & result color
   */
  public async calculateLiability(params: {
    gameId: string;
    roundId: string;
    winningNumber: string;
    resultColor: 'GREEN' | 'RED';
  }): Promise<{ success: boolean; liability?: SettlementLiabilityPreview; message?: string }> {
    try {
      const res = await fetch('/api/results/calculate-liability', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, message: e?.message || 'Failed to calculate liability' };
    }
  }

  /**
   * Helper to retrieve authenticated Master headers
   */
  private async getMasterHeaders(actorId?: string, actorRole?: string): Promise<Record<string, string>> {
    const user = getFirebaseAuth()?.currentUser;
    if (user) {
      try {
        const token = await user.getIdToken();
        return { Authorization: `Bearer ${token}` };
      } catch {}
    }
    const adminKey = localStorage.getItem('winora_admin_secret');
    if (adminKey) {
      return {
        Authorization: `Bearer ${adminKey}`,
        'x-admin-key': adminKey,
      };
    }
    return {
      Authorization: `Bearer dev_${actorId || 'master'}_${actorRole || 'master'}`,
    };
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
      const authHeaders = await this.getMasterHeaders(params.actorId, params.actorRole);
      const res = await fetch('/api/results/freeze-round', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
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
   * Master declare result & execute settlement with Winning Number AND Result Color
   */
  public async declareResult(params: {
    gameId: string;
    roundId: string;
    winningNumber: string;
    resultColor: 'GREEN' | 'RED';
    actorId: string;
    actorRole: string;
  }): Promise<{
    success: boolean;
    message: string;
    result?: GameResultRecord;
    summary?: SettlementSummary;
  }> {
    try {
      const authHeaders = await this.getMasterHeaders(params.actorId, params.actorRole);
      const res = await fetch('/api/results/declare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          gameId: params.gameId,
          roundId: params.roundId,
          winningNumber: params.winningNumber,
          resultColor: params.resultColor,
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
      const authHeaders = await this.getMasterHeaders(undefined, actorRole);
      const res = await fetch('/api/results/audit-logs', {
        headers: {
          ...authHeaders,
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
