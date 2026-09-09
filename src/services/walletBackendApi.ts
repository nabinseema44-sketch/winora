import {
  WalletDocument,
  WalletTransaction,
  WalletAuditRecord,
  DepositInitiateResponse,
  WithdrawalResponse,
  PublicPaymentConfig,
  PaymentConfig,
} from '../types.ts';

const API_BASE = '/api';

/**
 * Backend API Client for WINORA Secure Money Wallet
 * Strictly talks to server-side endpoints.
 * Never performs direct client-side balance mutations.
 */
export const walletBackendApi = {
  /**
   * Fetches safe public payment configuration projection for players.
   */
  async getPublicPaymentConfig(): Promise<PublicPaymentConfig> {
    const res = await fetch(`${API_BASE}/payment-config/public`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch public payment config');
    }
    const data = await res.json();
    return data.config;
  },

  /**
   * Fetches full payment configuration for authorized administrators.
   */
  async getAdminPaymentConfig(adminKey?: string): Promise<PaymentConfig> {
    const key = adminKey !== undefined ? adminKey : (localStorage.getItem('winora_admin_secret') || 'winora_admin_secret_2026');
    const headers: Record<string, string> = {};
    if (key) {
      headers['x-admin-key'] = key;
    }

    const res = await fetch(`${API_BASE}/payment-config/admin`, { headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to fetch admin payment config (${res.status})`);
    }
    const data = await res.json();
    return data.config;
  },

  /**
   * Updates payment configuration (authorized admin only).
   * Normal players will be rejected with HTTP 403 Forbidden.
   */
  async updateAdminPaymentConfig(updates: Partial<PaymentConfig>, adminKey?: string): Promise<PaymentConfig> {
    const key = adminKey !== undefined ? adminKey : (localStorage.getItem('winora_admin_secret') || 'winora_admin_secret_2026');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (key) {
      headers['x-admin-key'] = key;
    }

    const res = await fetch(`${API_BASE}/payment-config/admin/update`, {
      method: 'POST',
      headers,
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || `Failed to update payment config (${res.status})`);
    }
    return data.config;
  },
  /**
   * Fetches authoritative wallet data, including balances, hold amounts, and KYC state.
   */
  async getWallet(uid: string): Promise<WalletDocument> {
    const res = await fetch(`${API_BASE}/wallet/${encodeURIComponent(uid)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to fetch wallet (HTTP ${res.status})`);
    }
    const data = await res.json();
    return data.wallet;
  },

  /**
   * Fetches user's transaction records from backend.
   */
  async getTransactions(uid: string): Promise<WalletTransaction[]> {
    const res = await fetch(`${API_BASE}/wallet/${encodeURIComponent(uid)}/transactions`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to fetch transactions (HTTP ${res.status})`);
    }
    const data = await res.json();
    return (data.transactions || []).map((t: any) => ({
      id: t.transactionId,
      referenceId: t.providerReference || t.transactionId,
      transactionId: t.transactionId,
      uid: t.uid,
      type: t.type,
      amount: t.amount,
      currency: t.currency,
      status: t.status,
      paymentMethod: t.paymentMethod,
      providerReference: t.providerReference,
      destinationAccount: t.destinationAccount,
      createdAt: new Date(t.createdAt).toLocaleString(),
      description: `${t.type === 'deposit' ? 'Deposit via' : 'Payout to'} ${t.paymentMethod}`,
      auditReference: t.auditReference,
    }));
  },

  /**
   * Fetches immutable audit records for the user.
   */
  async getAudits(uid: string): Promise<WalletAuditRecord[]> {
    const res = await fetch(`${API_BASE}/wallet/${encodeURIComponent(uid)}/audits`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to fetch audit records (HTTP ${res.status})`);
    }
    const data = await res.json();
    return data.audits || [];
  },

  /**
   * Initiates a deposit order through the backend payment engine.
   * Creates a pending transaction. Does NOT credit the wallet.
   */
  async initiateDeposit(params: {
    uid: string;
    amount: number;
    currency: string;
    paymentMethod: string;
  }): Promise<DepositInitiateResponse> {
    const res = await fetch(`${API_BASE}/wallet/deposit/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to initiate deposit order.');
    }
    return data;
  },

  /**
   * Submits a withdrawal request to the backend.
   * Backend verifies available balance, places hold, and registers pending transaction.
   */
  async requestWithdrawal(params: {
    uid: string;
    amount: number;
    currency: string;
    destinationAccount: string;
    payoutMethod: 'bank' | 'upi';
  }): Promise<WithdrawalResponse> {
    const res = await fetch(`${API_BASE}/wallet/withdraw/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to submit payout request.');
    }
    return data;
  },

  /**
   * Sandbox Testing Helper:
   * Simulates provider webhook confirmation/failure for sandbox testing.
   */
  async simulateSandboxWebhook(
    transactionId: string,
    action: 'confirm_payment' | 'decline_payment' | 'confirm_payout' | 'decline_payout'
  ) {
    const res = await fetch(`${API_BASE}/wallet/sandbox/simulate-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionId, action }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Sandbox simulation failed.');
    }
    return data;
  },
};
