import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Copy, ExternalLink, History, Link2, Loader2, RefreshCw, Send, ShieldCheck, WalletCards } from 'lucide-react';
import type { UserProfile } from '../types.ts';
import { coinWalletApi, type CoinInstructions, type CoinLedgerItem, type CoinTransferType } from '../services/coinWalletApi.ts';

interface Props {
  user: UserProfile;
  onToast?: (message: string) => void;
}

const roleLabel = (role: UserProfile['role']) => role === 'master' ? 'Master' : role === 'agent' ? 'Agent' : 'Player';

export const CoinWalletPanel: React.FC<Props> = ({ user, onToast }) => {
  const [balance, setBalance] = useState(0);
  const [ledger, setLedger] = useState<CoinLedgerItem[]>([]);
  const [instructions, setInstructions] = useState<CoinInstructions | null>(null);
  const [recipientUid, setRecipientUid] = useState(user.assignedAgentId || '');
  const [amount, setAmount] = useState('100');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [masterLink, setMasterLink] = useState('');
  const [masterMessage, setMasterMessage] = useState('Contact your assigned Agent for manual coin transfer instructions.');

  const role = user.role === 'user' ? 'player' : user.role;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [wallet, history, info] = await Promise.all([
        coinWalletApi.getWallet(),
        coinWalletApi.getLedger(),
        coinWalletApi.getPaymentInstructions(),
      ]);
      setBalance(Number(wallet.balance || 0));
      setLedger(history);
      setInstructions(info);
      setMasterLink(info.url || '');
      setMasterMessage(info.message || 'Contact your assigned Agent for manual coin transfer instructions.');
    } catch (e: any) {
      const fallbackPaise = user.withdrawableBalancePaise || 0;
      setBalance(fallbackPaise / 100);
      if (e?.message !== 'Please sign in first.') {
        setError(e?.message || 'Unable to load coin wallet.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const transferType = useMemo<CoinTransferType | null>(() => {
    if (role === 'master') return 'MASTER_TO_AGENT';
    if (role === 'agent') return recipientUid === user.assignedAgentId ? 'AGENT_TO_MASTER' : 'AGENT_TO_PLAYER';
    return 'PLAYER_TO_AGENT';
  }, [role, recipientUid, user.assignedAgentId]);

  const targetLabel = role === 'master' ? 'Agent UID' : role === 'agent' ? 'Player / Master UID' : 'Agent UID';
  const actionLabel = role === 'master' ? 'Fund Agent' : role === 'agent' ? 'Transfer Coins' : 'Send Coins to Agent';

  const submitTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(amount);
    if (!recipientUid.trim()) return setError(`Enter the ${targetLabel}.`);
    if (!Number.isFinite(value) || value <= 0) return setError('Enter a valid positive coin amount.');
    if (!transferType) return setError('Transfer type could not be determined.');

    setBusy(true);
    setError(null);
    try {
      await coinWalletApi.transfer({
        recipientUid: recipientUid.trim(),
        amount: value,
        type: transferType,
        note,
      });
      setAmount('100');
      setNote('');
      await load();
      onToast?.(`${value.toLocaleString()} coins transferred successfully.`);
    } catch (e: any) {
      setError(e?.message || 'Coin transfer failed.');
    } finally {
      setBusy(false);
    }
  };

  const updateMasterInstructions = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const info = await coinWalletApi.updatePaymentInstructions({
        url: masterLink.trim(),
        message: masterMessage.trim(),
        title: 'WINORA Coin Deposit Instructions',
      });
      setInstructions(info);
      onToast?.('Master coin instruction link updated.');
    } catch (e: any) {
      setError(e?.message || 'Only Master can update the instruction link.');
    } finally {
      setBusy(false);
    }
  };

  const copyUid = async () => {
    try {
      await navigator.clipboard.writeText(user.id);
      onToast?.('Your UID copied.');
    } catch {
      onToast?.('Copy failed. Select the UID manually.');
    }
  };

  return (
    <div className="w-full space-y-3.5 pb-16 px-0">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-amber-400 font-bold">Virtual Coin Wallet</p>
          <h1 className="text-xl sm:text-2xl font-black text-white mt-0.5">{roleLabel(role)} Wallet</h1>
          <p className="text-[11px] text-zinc-400 mt-0.5">Master → Agent → Player virtual coin flow.</p>
        </div>
        <button onClick={load} disabled={loading} className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-bold text-zinc-200 hover:border-amber-500/40 min-h-[44px] cursor-pointer active:scale-95 shrink-0">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-500/15 via-zinc-900 to-zinc-950 p-4">
          <div className="flex items-center gap-2 text-amber-300 text-xs font-bold"><WalletCards className="w-4 h-4" /> MAIN WALLET</div>
          <div className="text-3xl sm:text-4xl font-black text-white mt-2 truncate">{balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
          <div className="text-xs text-zinc-400 mt-1 font-mono">COIN</div>
          <div className="mt-3.5 flex items-center gap-1.5 text-[11px] text-emerald-300"><ShieldCheck className="w-4 h-4 shrink-0" /> Balance is changed only by the server ledger.</div>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold">Your UID</p>
          <p className="text-xs font-mono text-zinc-200 break-all mt-1 select-all">{user.id}</p>
          <button onClick={copyUid} className="mt-2.5 inline-flex items-center gap-2 px-3 py-2.5 rounded-xl bg-zinc-800 text-xs font-bold text-zinc-200 hover:bg-zinc-700 min-h-[44px] cursor-pointer active:scale-95"><Copy className="w-3.5 h-3.5" /> Copy UID</button>
          {user.assignedAgentId && <p className="text-[11px] text-zinc-500 mt-2.5">Assigned Agent: <span className="text-zinc-300 font-mono">{user.assignedAgentId}</span></p>}
        </div>
      </div>

      {instructions?.enabled && instructions.url && (
        <div className="rounded-2xl sm:rounded-3xl border border-blue-500/20 bg-blue-500/5 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-blue-300 font-bold text-sm"><Link2 className="w-4 h-4" /> {instructions.title}</div>
            <p className="text-xs text-zinc-400 mt-1">{instructions.message}</p>
          </div>
          <a href={instructions.url} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500 text-white text-xs font-bold hover:bg-blue-400 min-h-[40px]">
            Open Master Link <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4 sm:gap-5">
        <form onSubmit={submitTransfer} className="rounded-2xl sm:rounded-3xl border border-zinc-800 bg-zinc-900/70 p-4 sm:p-6 space-y-3.5 sm:space-y-4">
          <div className="flex items-center gap-2"><Send className="w-4 h-4 text-amber-400" /><h2 className="font-bold text-white">{actionLabel}</h2></div>
          <p className="text-[11px] text-zinc-500">The server checks your role and the permitted Master/Agent/Player direction before moving coins.</p>
          <div>
            <label className="text-[11px] text-zinc-400">{targetLabel}</label>
            <input value={recipientUid} onChange={e => setRecipientUid(e.target.value)} className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-amber-500" placeholder="Paste user UID" />
          </div>
          <div>
            <label className="text-[11px] text-zinc-400">Coin amount</label>
            <input value={amount} onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="decimal" className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-amber-500" />
          </div>
          <div>
            <label className="text-[11px] text-zinc-400">Note (optional)</label>
            <input value={note} onChange={e => setNote(e.target.value)} maxLength={200} className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-amber-500" placeholder="Reason / reference" />
          </div>
          <button disabled={busy || loading} className="w-full min-h-[44px] rounded-xl py-3 bg-amber-500 active:bg-amber-400 disabled:opacity-50 text-zinc-950 font-black text-xs sm:text-sm inline-flex items-center justify-center gap-2 cursor-pointer active:scale-98 transition-all">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpRight className="w-4 h-4" />} {actionLabel}
          </button>
        </form>

        {role === 'master' ? (
          <form onSubmit={updateMasterInstructions} className="rounded-2xl sm:rounded-3xl border border-zinc-800 bg-zinc-900/70 p-4 sm:p-6 space-y-3.5 sm:space-y-4">
            <div className="flex items-center gap-2"><Link2 className="w-4 h-4 text-blue-400" /><h2 className="font-bold text-white">Master Coin Instructions</h2></div>
            <p className="text-[11px] text-zinc-500">This is an informational HTTPS link only. It does not process payments.</p>
            <input value={masterLink} onChange={e => setMasterLink(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-blue-500" placeholder="https://example.com/coin-instructions" />
            <textarea value={masterMessage} onChange={e => setMasterMessage(e.target.value)} maxLength={500} rows={4} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-blue-500" />
            <button disabled={busy} className="w-full min-h-[44px] rounded-xl py-2.5 bg-blue-500 active:bg-blue-400 disabled:opacity-50 text-white font-black text-xs cursor-pointer">Save Master Link</button>
          </form>
        ) : (
          <div className="rounded-2xl sm:rounded-3xl border border-zinc-800 bg-zinc-900/70 p-4 sm:p-6">
            <div className="flex items-center gap-2 text-emerald-300"><ArrowDownLeft className="w-4 h-4" /><h2 className="font-bold text-white">How coins move</h2></div>
            <div className="mt-3.5 sm:mt-5 space-y-2.5 sm:space-y-3 text-xs text-zinc-400">
              <div className="rounded-xl bg-zinc-950 p-2.5 sm:p-3"><b className="text-zinc-200">Deposit:</b> Agent transfers coins to your UID.</div>
              <div className="rounded-xl bg-zinc-950 p-2.5 sm:p-3"><b className="text-zinc-200">Withdraw:</b> You transfer coins to your assigned Agent UID.</div>
              <div className="rounded-xl bg-zinc-950 p-2.5 sm:p-3"><b className="text-zinc-200">No gateway:</b> WINORA does not automatically charge or pay money in this prototype.</div>
            </div>
          </div>
        )}
      </div>

      {error && <div className="rounded-2xl border border-red-500/30 bg-red-500/10 text-red-300 text-xs p-4">{error}</div>}

      <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 overflow-hidden">
        <div className="p-5 border-b border-zinc-800 flex items-center gap-2"><History className="w-4 h-4 text-amber-400" /><h2 className="font-bold text-white">Coin Ledger</h2></div>
        {loading ? <div className="p-8 text-center text-xs text-zinc-500">Loading ledger…</div> : ledger.length === 0 ? <div className="p-8 text-center text-xs text-zinc-500">No coin movements yet.</div> : (
          <div className="divide-y divide-zinc-800/70">
            {ledger.map(item => {
              const incoming = item.toUid === user.id;
              return <div key={item.id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0"><div className="text-xs font-bold text-zinc-200">{item.type.replaceAll('_', ' ')}</div><div className="text-[10px] text-zinc-500 truncate">{item.note || item.id}</div></div>
                <div className={`font-black text-sm ${incoming ? 'text-emerald-400' : 'text-red-400'}`}>{incoming ? '+' : '-'}{Number(item.amount).toLocaleString()} COIN</div>
              </div>;
            })}
          </div>
        )}
      </div>
    </div>
  );
};
