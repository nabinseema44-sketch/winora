import { getFirebaseAuth } from '../firebase/config.ts';

/**
 * WINORA server-authoritative game API client.
 * No demo/dev identity is ever fabricated by the client.
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
  number: string;
  stake: number;
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
  id: string;
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

async function getAuthHeaders(): Promise<Record<string, string>> {
  const user = getFirebaseAuth()?.currentUser;
  if (!user) {
    throw new Error('AUTH_REQUIRED');
  }

  const token = await user.getIdToken();
  if (!token) {
    throw new Error('AUTH_REQUIRED');
  }

  return { Authorization: `Bearer ${token}` };
}

export const gameEntryApi = {
  async fetchGamesConfig(): Promise<GamesConfigResponse | null> {
    try {
      const res = await fetch('/api/games/config', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch game configuration');
      return await res.json();
    } catch (err) {
      console.warn('[WINORA] Game config fetch failed:', err);
      return null;
    }
  },

  async fetchMyEntries(_userId?: string): Promise<ConfirmedGameEntry[]> {
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/game-entry/my-entries', {
        headers: authHeaders,
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Failed to fetch entries');
      const data = await res.json();
      return data.entries || [];
    } catch (err) {
      console.warn('[WINORA] My entries fetch failed:', err);
      return [];
    }
  },

  async submitEntry(
    _userId: string,
    payload: SubmitGameEntryPayload
  ): Promise<SubmitEntryResponse> {
    try {
      const authHeaders = await getAuthHeaders();
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
        errorCode: err?.message === 'AUTH_REQUIRED' ? 'AUTH_REQUIRED' : 'NETWORK_ERROR',
        message:
          err?.message === 'AUTH_REQUIRED'
            ? 'Please sign in before placing a bid.'
            : 'Network connection failed. Please check your connectivity and try again.',
      };
    }
  },

  generateIdempotencyKey(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return `idemp_${crypto.randomUUID()}`;
    }
    return `idemp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  },
};
