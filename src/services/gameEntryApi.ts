import { getFirebaseAuth } from '../firebase/config.ts';

/**
 * WINORA Step 13 Game Entry API Service
 * Handles server-authoritative round configuration,
 * per-selection stakes & chosen colors, idempotent entry submission,
 * and entry history retrieval.
 */

export interface ServerRoundInfo {
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
}

export interface GamesConfigResponse {
  success: boolean;
  games: any[];
  rounds: Record<string, ServerRoundInfo>;
  serverTime: string;
}

export interface SelectionPayload {
  number: string; // '00' to '99'
  stake: number;  // per-number stake
  color: 'GREEN' | 'RED';
}

export type PlayerNumberSelection = SelectionPayload;

export interface SubmitGameEntryPayload {
  gameId: string;
  roundId: string;
  selections: SelectionPayload[];
  idempotencyKey: string;
  walletPreference?: 'main' | 'bonus';
}

export interface ConfirmedGameEntry {
  id: string; // 'ENTRY-XXXXXXXX'
  userId: string;
  gameId: string;
  gameName: string;
  roundId: string;
  roundNumber: number;
  selections: SelectionPayload[];
  totalStake: number;
  walletUsed: 'main' | 'bonus';
  bonusBalanceBefore?: number;
  bonusBalanceAfter?: number;
  status: 'CONFIRMED' | 'WON' | 'LOST';
  createdAt: string;
  idempotencyKey?: string;
  settledReward?: number;
  protectionRefund?: number;
  totalSettlementCredit?: number;
  settledWinningNumber?: string;
  settledResultColor?: 'GREEN' | 'RED';
  settlementId?: string;
  settledAt?: string;
}

export interface SubmitEntryResponse {
  success: boolean;
  message?: string;
  errorCode?: string;
  entry?: ConfirmedGameEntry;
  remainingBalance?: { main: number; bonus?: number };
}

async function getAuthHeaders(userId?: string): Promise<Record<string, string>> {
  const user = getFirebaseAuth()?.currentUser;
  if (user) {
    try {
      const token = await user.getIdToken();
      return { Authorization: `Bearer ${token}` };
    } catch {}
  }
  return { Authorization: `Bearer dev_${userId || 'player-arjun'}` };
}

export const gameEntryApi = {
  /**
   * Fetch server-authoritative round statuses
   */
  async fetchGamesConfig(): Promise<GamesConfigResponse | null> {
    try {
      const res = await fetch('/api/games/config');
      if (!res.ok) throw new Error('Failed to fetch game configuration');
      return await res.json();
    } catch (err) {
      console.warn('[WINORA] Game config fetch fallback to local:', err);
      return null;
    }
  },

  /**
   * Fetch user entries from server
   */
  async fetchMyEntries(userId: string): Promise<ConfirmedGameEntry[]> {
    try {
      const authHeaders = await getAuthHeaders(userId);
      const res = await fetch(`/api/game-entry/my-entries`, {
        headers: {
          ...authHeaders,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch entries');
      const data = await res.json();
      return data.entries || [];
    } catch (err) {
      console.warn('[WINORA] My entries fetch failed:', err);
      return [];
    }
  },

  /**
   * Submit secure game entry to Step 13 API
   * Client sends selections array: [{ number, stake, color }].
   * Server calculates authoritative totalStake and verifies dual-wallet balances.
   */
  async submitEntry(
    userId: string,
    payload: SubmitGameEntryPayload
  ): Promise<SubmitEntryResponse> {
    try {
      const authHeaders = await getAuthHeaders(userId);
      const res = await fetch('/api/game-entry/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          gameId: payload.gameId,
          roundId: payload.roundId,
          selections: payload.selections,
          idempotencyKey: payload.idempotencyKey,
          walletPreference: payload.walletPreference,
        }),
      });

      const data = await res.json();
      return data;
    } catch (err: any) {
      return {
        success: false,
        errorCode: 'NETWORK_ERROR',
        message: 'Network connection failed. Please check your connectivity and try again.',
      };
    }
  },

  /**
   * Generate robust idempotency key for new submissions
   */
  generateIdempotencyKey(): string {
    return 'idemp_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 10);
  },
};
