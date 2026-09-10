/**
 * WINORA Step 11 & 12 Game Entry API Service
 * Handles server-authoritative round configuration, 00-99 color classifications,
 * idempotent game entry submission, and entry history retrieval.
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
}

export interface ServerColorClassification {
  gameId: string;
  greenNumbers: string[];
  redNumbers: string[];
  greenRefundPercentage: number;
}

export interface GamesConfigResponse {
  success: boolean;
  games: any[];
  rounds: Record<string, ServerRoundInfo>;
  serverTime: string;
  colorClassification: ServerColorClassification;
}

export interface SubmitGameEntryPayload {
  gameId: string;
  roundId: string;
  gameModeId?: 'main';
  selectedNumbers: string[]; // string '00' to '99'
  amountPerNumber: number;
  idempotencyKey: string;
}

export interface ConfirmedGameEntry {
  id: string; // 'ENTRY-XXXXXXXX'
  userId: string;
  gameId: string;
  gameName: string;
  roundId: string;
  roundNumber: number;
  selectedNumbers: string[];
  numbersCount: number;
  amountPerNumber: number;
  totalStake: number;
  potentialReward: number;
  greenProtectionAmount: number;
  walletUsed: 'main';
  status: 'CONFIRMED' | 'WON' | 'LOST' | 'REFUNDED';
  createdAt: string;
  idempotencyKey: string;
}

export interface SubmitEntryResponse {
  success: boolean;
  message?: string;
  errorCode?: string;
  entry?: ConfirmedGameEntry;
  remainingBalance?: { main: number };
}

export const gameEntryApi = {
  /**
   * Fetch server-authoritative round statuses and color classification
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
      const res = await fetch(`/api/game-entry/my-entries?userId=${encodeURIComponent(userId)}`, {
        headers: {
          'x-user-id': userId,
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
   * Submit secure game entry to Step 11 API
   * Strictly avoids sending client-side balance, user identity as authoritative,
   * or client-calculated rewards.
   */
  async submitEntry(
    userId: string,
    payload: SubmitGameEntryPayload
  ): Promise<SubmitEntryResponse> {
    try {
      const res = await fetch('/api/game-entry/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({
          gameId: payload.gameId,
          roundId: payload.roundId,
          gameModeId: payload.gameModeId,
          selectedNumbers: payload.selectedNumbers,
          amountPerNumber: payload.amountPerNumber,
          idempotencyKey: payload.idempotencyKey,
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
