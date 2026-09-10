import React, { useEffect, useState } from 'react';
import { Wallet, RefreshCw, ShieldCheck, Clock } from 'lucide-react';
import { UserProfile, WalletTransaction, NavPage, CurrencyConfig } from '../types.ts';
import { walletBackendApi } from '../services/walletBackendApi.ts';

interface WalletPageProps {
  user: UserProfile | null;
  transactions?: WalletTransaction[];
  ledger?: WalletTransaction[];
  onNavigate?: (page: NavPage) => void;
  onDepositInitiated?: (transaction: WalletTransaction) => void;
  onWithdrawalRequested?: (transaction: WalletTransaction) => void;
  onCurrencyChange?: (currency: CurrencyConfig) => void;
  onBalanceUpdate?: (newBalance: number) => void;
}

export const WalletPage: React.FC<WalletPageProps> = ({
  user,
  transactions = [],
  ledger = [],
  onNavigate,
  onBalanceUpdate,
}) => {
  const [balance, setBalance] = useState<number>(user?.mainBalance ?? user?.walletBalance ?? 0);
  const [entries, setEntries] = useState<WalletTransaction[]>(transactions.length ? transactions : ledger);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!user) return;
      setLoading(true);
      setError(null);
      try {
        const [wallet, txns] = await Promise.all([
          walletBackendApi.getWallet(user.id),
          walletBackendApi.getTransactions(user.id),
        ]);
        if (!active) return;
        const nextBalance = typeof wallet.balance === 'number' ? wallet.balance : 0;
        setBalance(nextBalance);
        setEntries(txns);
        onBalanceUpdate?.(nextBalance);
      } catch (err: any) {
        if (active) setError(err?.message || 'Unable to load the Main Wallet.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [user, onBalanceUpdate]);

  if (!user) {
    return (
      <div className="max-w-md mx-auto my-12 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-8 text-center">
        <Wallet className="w-10 h-10 text-amber-400 mx-auto mb-4" />
        <h2 className="text-xl font-black text-zinc-100">Sign in to view your Main Wallet</h2>
        <p className="text-xs text-zinc-400 mt-2">Use verified phone OTP login to access your virtual credits.</p>
        <button onClick={() => onNavigate?.('login')} className="mt-5 px-5 py-2.5 rounded-xl bg-amber-500 text-zinc-950 font-bold text-xs">Sign In</button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-14">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-100">Main Wallet</h1>
          <p className="text-xs text-zinc-400 mt-1">One wallet for WINORA virtual/demo credits.</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          disabled={loading}
          className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-amber-400"
          title="Refresh wallet"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <section className="rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-7 shadow-2xl">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest font-bold text-emerald-400">
          <ShieldCheck className="w-4 h-4" /> Server authoritative
        </div>
        <div className="mt-2 text-xs uppercase tracking-wider text-zinc-500">Available Virtual Credits</div>
        <div className="mt-1 text-4xl sm:text-5xl font-black text-zinc-100 tabular-nums">{balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        <p className="mt-3 text-xs text-zinc-400 leading-relaxed">
          This is a virtual/demo-credit wallet only. Deposits, withdrawals, cash payouts, payment gateways, and real-money conversion are disabled.
        </p>
      </section>

      {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">{error}</div>}

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 overflow-hidden">
        <div className="p-4 border-b border-zinc-800 flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-400" />
          <h2 className="font-bold text-zinc-100">Wallet Activity</h2>
        </div>
        {entries.length === 0 ? (
          <div className="p-10 text-center text-xs text-zinc-500">No wallet activity yet.</div>
        ) : (
          <div className="divide-y divide-zinc-800/80">
            {entries.map((entry) => (
              <div key={entry.id} className="p-4 flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-bold text-zinc-200">{entry.description || entry.type}</div>
                  <div className="text-[10px] text-zinc-500 mt-1">{entry.createdAt} • {entry.status}</div>
                </div>
                <div className="font-mono text-sm font-bold text-zinc-200">{entry.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-200/90 leading-relaxed">
        <strong>WINORA virtual-credit notice:</strong> all game stakes and rewards use the Main Wallet only. Settlement is calculated server-side and wallet mutations are server-authoritative.
      </div>
    </div>
  );
};
