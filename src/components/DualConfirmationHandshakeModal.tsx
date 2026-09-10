import React, { useState } from 'react';
import {
  X,
  ShieldCheck,
  ArrowDownLeft,
  ArrowUpRight,
  UserCheck,
  Phone,
  QrCode,
  Copy,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Info,
} from 'lucide-react';
import { UserProfile, HandshakeTransaction } from '../types.ts';
import { winoraEngine } from '../services/winoraEngine.ts';

interface DualConfirmationHandshakeModalProps {
  user: UserProfile;
  initialMode?: 'deposit' | 'withdrawal';
  onClose: () => void;
  onSuccessToast: (msg: string) => void;
}

export const DualConfirmationHandshakeModal: React.FC<DualConfirmationHandshakeModalProps> = ({
  user,
  initialMode = 'deposit',
  onClose,
  onSuccessToast,
}) => {
  const [mode, setMode] = useState<'deposit' | 'withdrawal'>(initialMode);
  const [amount, setAmount] = useState<string>('1000');
  const [notes, setNotes] = useState<string>('');
  const [upiId, setUpiId] = useState<string>('');
  const [accountNumber, setAccountNumber] = useState<string>('');
  const [ifsc, setIfsc] = useState<string>('');
  const [selectedAgentId, setSelectedAgentId] = useState<string>(
    user.assignedAgentId || 'agent-vikram'
  );
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const agents = winoraEngine.getAgents();
  const assignedAgent = agents.find((a) => a.id === selectedAgentId) || agents[0];

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount);
    if (!numAmount || numAmount < 100) {
      onSuccessToast('Minimum amount is ₹100.');
      return;
    }

    if (mode === 'withdrawal' && user.mainBalance < numAmount) {
      onSuccessToast(`Insufficient Main Wallet balance (₹${user.mainBalance.toLocaleString()} available).`);
      return;
    }

    setIsSubmitting(true);

    const res = winoraEngine.requestHandshake({
      type: mode,
      amount: numAmount,
      agentId: assignedAgent.id,
      notes: notes || (mode === 'deposit' ? 'Direct UPI transfer to Agent' : `Payout to UPI: ${upiId || 'Bank'}`),
      payoutDetails: mode === 'withdrawal' ? { upiId, accountNumber, ifsc } : undefined,
    });

    setIsSubmitting(false);

    if (res.success) {
      onSuccessToast(res.message);
      onClose();
    } else {
      onSuccessToast(res.message);
    }
  };

  return (
    <div
      id="handshake-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
    >
      <div
        id="handshake-modal"
        className="bg-zinc-900 border border-zinc-750 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Modal Top Header */}
        <div className="p-4 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-zinc-100 font-display leading-tight">
                Dual-Confirmation Handshake
              </h3>
              <p className="text-[11px] text-zinc-400">
                Agent-verified secure deposit & withdrawal protocol
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-100 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Toggle (Deposit vs Withdrawal) */}
        <div className="p-4 border-b border-zinc-800 bg-zinc-950/60">
          <div className="grid grid-cols-2 gap-2 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
            <button
              type="button"
              onClick={() => setMode('deposit')}
              className={`py-2 px-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                mode === 'deposit'
                  ? 'bg-amber-500 text-zinc-950 shadow-md'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <ArrowDownLeft className="w-4 h-4" />
              Deposit Handshake
            </button>
            <button
              type="button"
              onClick={() => setMode('withdrawal')}
              className={`py-2 px-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                mode === 'withdrawal'
                  ? 'bg-amber-500 text-zinc-950 shadow-md'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              Withdrawal Handshake
            </button>
          </div>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto space-y-4 flex-1">
          {/* Assigned Agent Details Card */}
          <div className="bg-gradient-to-br from-zinc-950 to-zinc-900 border border-zinc-800 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5" />
                Assigned Verification Agent
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                Verified Agent
              </span>
            </div>

            <div className="flex items-center justify-between pt-1">
              <div>
                <p className="text-sm font-bold text-zinc-100">{assignedAgent.displayName}</p>
                <div className="flex items-center gap-2 text-xs text-zinc-400 mt-0.5">
                  <Phone className="w-3 h-3 text-zinc-400" />
                  <span className="font-mono">{assignedAgent.phoneNumber}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(assignedAgent.phoneNumber)}
                    className="text-[10px] text-amber-400 hover:underline ml-1"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] uppercase text-zinc-400 block">Agent ID</span>
                <span className="font-mono text-xs font-bold text-zinc-300">
                  {assignedAgent.id.slice(0, 12)}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-zinc-800/80 text-[11px] text-zinc-400 leading-relaxed">
              {mode === 'deposit' ? (
                <span>
                  After sending funds to your agent via UPI or Cash, submit this handshake request. Your agent will verify and approve the transfer, instantaneously crediting your Main Wallet.
                </span>
              ) : (
                <span>
                  Withdrawal requests are locked from your Main Wallet and securely settled directly to your designated bank account or UPI by your assigned agent.
                </span>
              )}
            </div>
          </div>

          {/* Amount Input & Preset Chips */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-zinc-300">
                {mode === 'deposit' ? 'Deposit Amount' : 'Withdrawal Amount'} (₹):
              </label>
              <span className="text-xs text-zinc-400">
                {mode === 'withdrawal'
                  ? `Available to Withdraw: ₹${user.mainBalance.toLocaleString()}`
                  : `Current Main: ₹${user.mainBalance.toLocaleString()}`}
              </span>
            </div>

            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base font-bold text-zinc-400">
                ₹
              </span>
              <input
                type="number"
                min="100"
                max={mode === 'withdrawal' ? user.mainBalance : 100000}
                step="100"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount (min ₹100)"
                required
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl pl-8 pr-4 py-2.5 text-base font-mono font-bold text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Quick Amount Chips */}
            <div className="flex items-center gap-1.5 mt-2">
              {[500, 1000, 2500, 5000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setAmount(amt.toString())}
                  className="flex-1 py-1 rounded-lg text-xs font-bold bg-zinc-800 hover:bg-zinc-750 text-zinc-300 border border-zinc-700 transition-colors cursor-pointer"
                >
                  ₹{amt}
                </button>
              ))}
            </div>
          </div>

          {/* Mode-Specific Details */}
          {mode === 'deposit' ? (
            <div>
              <label className="text-xs font-bold text-zinc-300 block mb-1.5">
                Deposit Reference / UTR / Note (Optional):
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Sent ₹1000 via PhonePe ref 492049182"
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-amber-500"
              />
              {!user.hasMadeFirstDeposit && (
                <div className="mt-2.5 p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/25 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-purple-300">
                    <strong>1st Deposit 50/50 Referral Bonus:</strong> 50% of this first deposit will be credited to your Main Wallet and 50% to your referrer's Main Wallet upon agent handshake!
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1">
                  Payout UPI ID (Instant Transfer):
                </label>
                <input
                  type="text"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  placeholder="e.g. player@okaxis"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2 text-xs text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-zinc-400 block mb-1">
                    Bank Account (Optional):
                  </label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="Account Number"
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-zinc-400 block mb-1">
                    IFSC Code:
                  </label>
                  <input
                    type="text"
                    value={ifsc}
                    onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                    placeholder="e.g. HDFC0001234"
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Dual-Confirmation Handshake Step-by-Step Info */}
          <div className="bg-zinc-950/80 p-3 rounded-xl border border-zinc-800 space-y-1.5">
            <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider flex items-center gap-1">
              <Info className="w-3 h-3 text-amber-400" />
              How Dual-Confirmation Works
            </span>
            <div className="text-[11px] text-zinc-400 space-y-1">
              <p>1. You submit this request with your payment proof or payout destination.</p>
              <p>2. Assigned Agent {assignedAgent.displayName} reviews the request in their agent portal.</p>
              <p>3. Upon agent handshake confirmation, coins settle instantaneously with zero slippage.</p>
            </div>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="p-4 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-zinc-200 bg-zinc-900 border border-zinc-800 cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={isSubmitting || Number(amount) < 100}
            onClick={handleSubmit}
            className="px-6 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 to-amber-400 text-zinc-950 hover:brightness-110 active:scale-95 transition-all shadow-md shadow-amber-500/20 disabled:opacity-50 cursor-pointer flex items-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            Submit {mode === 'deposit' ? 'Deposit' : 'Withdrawal'} Handshake
          </button>
        </div>
      </div>
    </div>
  );
};
