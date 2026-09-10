import { getFirebaseAuth } from '../firebase/config.ts';

const API_BASE = '/api/coin';

async function authHeaders() {
  const user = getFirebaseAuth()?.currentUser;
  if (!user) throw new Error('Please sign in first.');
  const token = await user.getIdToken();
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export type CoinTransferType = 'MASTER_TO_AGENT' | 'AGENT_TO_PLAYER' | 'PLAYER_TO_AGENT' | 'AGENT_TO_MASTER';

export interface CoinWalletResponse {
  uid: string;
  balance: number;
  currency: 'COIN';
  updatedAt?: unknown;
}

export interface CoinLedgerItem {
  id: string;
  type: CoinTransferType;
  fromUid?: string;
  toUid?: string;
  amount: number;
  balanceAfterFrom?: number;
  balanceAfterTo?: number;
  note?: string;
  idempotencyKey: string;
  createdAt?: { seconds?: number };
}

export interface CoinInstructions {
  enabled: boolean;
  url: string;
  title: string;
  message: string;
}

export const coinWalletApi = {
  getWallet: async () => {
    const data = await request<{ wallet: CoinWalletResponse }>('/wallet');
    return data.wallet;
  },

  getLedger: async () => {
    const data = await request<{ ledger: CoinLedgerItem[] }>('/ledger');
    return data.ledger;
  },

  transfer: async (params: {
    recipientUid: string;
    amount: number;
    type: CoinTransferType;
    note?: string;
  }) => {
    const idempotencyKey = `${crypto.randomUUID()}-${Date.now()}`;
    return request<{ transfer: CoinLedgerItem & { duplicate?: boolean } }>('/transfer', {
      method: 'POST',
      body: JSON.stringify({ ...params, idempotencyKey }),
    });
  },

  getPaymentInstructions: async () => {
    const data = await request<{ instructions: CoinInstructions }>('/payment-instructions');
    return data.instructions;
  },

  updatePaymentInstructions: async (params: { url: string; title?: string; message?: string }) => {
    const data = await request<{ instructions: CoinInstructions }>('/payment-instructions', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return data.instructions;
  },
};
