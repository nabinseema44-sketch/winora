import React, { useState, useEffect } from 'react';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  Lock,
  RefreshCw,
  FileText,
  Copy,
  Share2,
  Check,
  Award,
  ExternalLink,
  Layers,
  Send,
  SlidersHorizontal,
} from 'lucide-react';
import {
  UserProfile,
  NavPage,
  ImmutableLedgerEntry,
  DepositRequestRecord,
  WithdrawalRequestRecord,
  MasterPaymentSettings,
  ReferralRecord,
  formatPaise,
  rupeesToPaise,
} from '../types.ts';
import { winoraEngine } from '../services/winoraEngine.ts';

interface WalletPageProps {
  user: UserProfile | null;
  onNavigate?: (page: NavPage) => void;
  onBalanceUpdate?: (newBalance: number) => void;
}

export const WalletPage: React.FC<WalletPageProps> = ({ user: initialUser, onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'deposit' | 'withdrawal' | 'ledger' | 'referrals'>('overview');
  const [copiedCode, setCopiedCode] = useState(false);

  // Engine state subscriptions
  const [currentUser, setCurrentUser] = useState<UserProfile>(
    initialUser || winoraEngine.getCurrentUser()
  );
  const [ledgerEntries, setLedgerEntries] = useState<ImmutableLedgerEntry[]>(winoraEngine.getLedger());
  const [depositRequests, setDepositRequests] = useState<DepositRequestRecord[]>(winoraEngine.getDepositRequests());
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequestRecord[]>(winoraEngine.getWithdrawalRequests());
  const [paymentSettings, setPaymentSettings] = useState<MasterPaymentSettings>(winoraEngine.getMasterPaymentSettings());
  const [referrals, setReferrals] = useState<ReferralRecord[]>(winoraEngine.getReferrals());

  // Deposit Form State
  const [depositAmountRupees, setDepositAmountRupees] = useState<string>('1000');
  const [depositUtr, setDepositUtr] = useState<string>('');
  const [depositProofUrl, setDepositProofUrl] = useState<string>('https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&auto=format&fit=crop&q=80');
  const [depositSubmitting, setDepositSubmitting] = useState(false);
  const [depositNotice, setDepositNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Withdrawal Form State
  const [withdrawAmountRupees, setWithdrawAmountRupees] = useState<string>('500');
  const [withdrawUpiId, setWithdrawUpiId] = useState<string>('');
  const [withdrawAccountName, setWithdrawAccountName] = useState<string>(currentUser.displayName || '');
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);
  const [withdrawNotice, setWithdrawNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Subscribe to winoraEngine updates
  useEffect(() => {
    const handleUpdate = () => {
      setCurrentUser({ ...winoraEngine.getCurrentUser() });
      setLedgerEntries(winoraEngine.getLedger());
      setDepositRequests(winoraEngine.getDepositRequests());
      setWithdrawalRequests(winoraEngine.getWithdrawalRequests());
      setPaymentSettings(winoraEngine.getMasterPaymentSettings());
      setReferrals(winoraEngine.getReferrals(currentUser.id));
    };

    const unsub = winoraEngine.subscribe(handleUpdate);
    handleUpdate();
    return () => unsub();
  }, [currentUser.id]);

  const withdrawablePaise = currentUser.withdrawableBalancePaise ?? (currentUser.walletBalance * 100);
  const bonusPaise = currentUser.bonusBalancePaise ?? 0;
  const commPaise = currentUser.agentCommissionBalancePaise ?? 0;
  const isAgent = currentUser.role === 'agent';

  // Quick preset deposit amounts
  const presetDeposits = [500, 1000, 2000, 5000, 10000];

  // Deposit Submission Handler
  const handleSubmitDeposit = (e: React.FormEvent) => {
    e.preventDefault();
    setDepositNotice(null);

    const amountRupees = parseFloat(depositAmountRupees);
    if (isNaN(amountRupees) || amountRupees <= 0) {
      setDepositNotice({ type: 'error', text: 'Please enter a valid deposit amount.' });
      return;
    }

    if (!depositUtr.trim()) {
      setDepositNotice({ type: 'error', text: 'Please enter the 12-digit UPI reference / UTR number.' });
      return;
    }

    const amountPaise = rupeesToPaise(amountRupees);
    setDepositSubmitting(true);

    const res = winoraEngine.submitDepositRequest({
      playerId: currentUser.id,
      amountPaise,
      transactionReference: depositUtr.trim(),
      screenshotUrl: depositProofUrl,
    });

    setDepositSubmitting(false);

    if (res.success) {
      setDepositNotice({ type: 'success', text: res.message });
      setDepositUtr('');
    } else {
      setDepositNotice({ type: 'error', text: res.message });
    }
  };

  // Withdrawal Submission Handler
  const handleSubmitWithdrawal = (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawNotice(null);

    const amountRupees = parseFloat(withdrawAmountRupees);
    if (isNaN(amountRupees) || amountRupees <= 0) {
      setWithdrawNotice({ type: 'error', text: 'Please enter a valid withdrawal amount.' });
      return;
    }

    if (!withdrawUpiId.trim()) {
      setWithdrawNotice({ type: 'error', text: 'Please enter a valid UPI ID for payout.' });
      return;
    }

    const amountPaise = rupeesToPaise(amountRupees);

    if (amountPaise > withdrawablePaise) {
      setWithdrawNotice({
        type: 'error',
        text: `Requested amount exceeds Withdrawable Balance (Available: ${formatPaise(withdrawablePaise)}). Note: Bonus Balance cannot be withdrawn.`,
      });
      return;
    }

    setWithdrawSubmitting(true);

    const res = winoraEngine.requestWithdrawal({
      playerId: currentUser.id,
      amountPaise,
      upiId: withdrawUpiId.trim(),
      accountName: withdrawAccountName.trim() || currentUser.displayName,
      agentId: currentUser.assignedAgentId,
    });

    setWithdrawSubmitting(false);

    if (res.success) {
      setWithdrawNotice({ type: 'success', text: res.message });
      setWithdrawAmountRupees('');
    } else {
      setWithdrawNotice({ type: 'error', text: res.message });
    }
  };

  const handleCopyReferral = () => {
    const code = currentUser.referralCode || 'WINORA77';
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const playerDeposits = depositRequests.filter((d) => d.playerId === currentUser.id);
  const playerWithdrawals = withdrawalRequests.filter((w) => w.playerId === currentUser.id);
  const playerLedger = ledgerEntries.filter((l) => l.userId === currentUser.id);

  return (
    <div className="max-w-5xl mx-auto px-2.5 sm:px-4 py-3 sm:py-6 space-y-4 sm:space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Integer Paise Backend-Authoritative
            </span>
          </div>
          <h1 className="font-display text-xl sm:text-3xl font-black text-zinc-100">
            Authoritative Money Wallet
          </h1>
          <p className="text-[11px] sm:text-xs text-zinc-400 mt-0.5">
            Strict separation of Withdrawable Balance and Bonus Balance with an immutable transaction ledger.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('ledger')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-300 hover:text-amber-400 hover:border-zinc-700 transition-colors cursor-pointer min-h-[38px]"
          >
            <FileText className="w-3.5 h-3.5 text-amber-400" />
            <span>Immutable Ledger</span>
          </button>
        </div>
      </div>

      {/* Main Dual Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        {/* Card 1: Withdrawable Balance */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 border border-emerald-500/30 p-3.5 sm:p-6 shadow-xl">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Withdrawable Balance
            </span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              Eligible for Payout
            </span>
          </div>

          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-display text-2xl sm:text-4xl md:text-5xl font-black text-zinc-100 tabular-nums">
              {formatPaise(withdrawablePaise)}
            </span>
            <span className="text-[10px] sm:text-xs font-mono text-zinc-500 truncate">
              ({withdrawablePaise.toLocaleString()} paise)
            </span>
          </div>

          <p className="text-[11px] sm:text-xs text-zinc-400 mt-2 flex items-center gap-1.5 leading-snug">
            <span>Authoritative funds available for game bidding and instant withdrawal requests.</span>
          </p>

          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setActiveTab('deposit')}
              className="flex-1 min-h-[44px] py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <ArrowDownLeft className="w-4 h-4 stroke-[2.5]" />
              <span>Deposit</span>
            </button>
            <button
              onClick={() => setActiveTab('withdrawal')}
              className="flex-1 min-h-[44px] py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-zinc-800 hover:bg-zinc-750 text-zinc-200 border border-zinc-700 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <ArrowUpRight className="w-4 h-4 stroke-[2.5] text-amber-400" />
              <span>Withdraw</span>
            </button>
          </div>
        </div>

        {/* Card 2: Bonus Balance (Non-Withdrawable) */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 border border-amber-500/30 p-3.5 sm:p-6 shadow-xl">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-amber-400" />
              Bonus Balance (Non-Withdrawable)
            </span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
              Protection Only
            </span>
          </div>

          <div className="flex items-baseline gap-2 mt-1">
            <span className="font-display text-2xl sm:text-4xl md:text-5xl font-black text-amber-300 tabular-nums">
              {formatPaise(bonusPaise)}
            </span>
            <span className="text-[10px] sm:text-xs font-mono text-zinc-500 truncate">
              ({bonusPaise.toLocaleString()} paise)
            </span>
          </div>

          <p className="text-[11px] sm:text-xs text-amber-200/80 mt-2 flex items-start gap-1.5 leading-snug">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <span>
              Credited from 80% Hourly Protection refunds & promotions. <strong>Never withdrawable</strong> per Master Blueprint rules.
            </span>
          </p>

          {isAgent && (
            <div className="mt-3 pt-2.5 border-t border-zinc-800 flex items-center justify-between text-xs">
              <span className="text-purple-300 font-semibold">Agent Commission Balance:</span>
              <span className="font-mono font-bold text-purple-400">{formatPaise(commPaise)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Tab Bar */}
      <div className="flex border-b border-zinc-800 gap-1.5 pb-1 overflow-x-auto text-xs font-bold scrollbar-none no-scrollbar -mx-2.5 px-2.5 sm:mx-0 sm:px-0">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-3 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 min-h-[38px] ${
            activeTab === 'overview'
              ? 'bg-amber-500 text-zinc-950 shadow'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <Wallet className="w-3.5 h-3.5" />
          <span>Overview</span>
        </button>

        <button
          onClick={() => setActiveTab('deposit')}
          className={`px-3 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 min-h-[38px] ${
            activeTab === 'deposit'
              ? 'bg-amber-500 text-zinc-950 shadow'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <ArrowDownLeft className="w-3.5 h-3.5" />
          <span>Deposit</span>
          {playerDeposits.filter((d) => d.status === 'PENDING').length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-400 text-zinc-950 font-black">
              {playerDeposits.filter((d) => d.status === 'PENDING').length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('withdrawal')}
          className={`px-3 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 min-h-[38px] ${
            activeTab === 'withdrawal'
              ? 'bg-amber-500 text-zinc-950 shadow'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <ArrowUpRight className="w-3.5 h-3.5" />
          <span>Withdrawal</span>
        </button>

        <button
          onClick={() => setActiveTab('ledger')}
          className={`px-3 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 min-h-[38px] ${
            activeTab === 'ledger'
              ? 'bg-amber-500 text-zinc-950 shadow'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Ledger</span>
        </button>

        <button
          onClick={() => setActiveTab('referrals')}
          className={`px-3 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 min-h-[38px] ${
            activeTab === 'referrals'
              ? 'bg-amber-500 text-zinc-950 shadow'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>Referrals</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW & RECENT ACTIVITY                                         */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
              <span className="text-[11px] uppercase font-bold text-zinc-400 block mb-1">Total Account Worth</span>
              <span className="text-xl font-black text-zinc-100 font-mono">
                {formatPaise(withdrawablePaise + bonusPaise)}
              </span>
              <span className="text-[10px] text-zinc-500 block mt-1">Withdrawable + Bonus</span>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
              <span className="text-[11px] uppercase font-bold text-zinc-400 block mb-1">Player Referral Code</span>
              <div className="flex items-center justify-between">
                <span className="text-base font-black text-amber-400 font-mono tracking-wider">
                  {currentUser.referralCode || 'WINORA77'}
                </span>
                <button
                  onClick={handleCopyReferral}
                  className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
              <span className="text-[10px] text-zinc-500 block mt-1">Share with friends for rewards</span>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
              <span className="text-[11px] uppercase font-bold text-zinc-400 block mb-1">Assigned Agent</span>
              <span className="text-sm font-bold text-zinc-200 block">
                {currentUser.assignedAgentName || 'Vikram Sharma (Agent)'}
              </span>
              <span className="text-[10px] text-emerald-400 block mt-1">Active SLA Available</span>
            </div>
          </div>

          {/* Recent Ledger Entries for this Player */}
          <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Recent Ledger Transactions</span>
              </h3>
              <button
                onClick={() => setActiveTab('ledger')}
                className="text-xs text-amber-400 hover:underline"
              >
                View Full Ledger →
              </button>
            </div>

            <div className="divide-y divide-zinc-800/80">
              {playerLedger.slice(0, 5).map((l) => (
                <div key={l.transactionId} className="py-3 flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-200">{l.transactionType}</span>
                      <span className="text-[10px] text-zinc-500 font-mono">{l.transactionId}</span>
                    </div>
                    <p className="text-zinc-400 text-[11px]">{l.description}</p>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-emerald-400 block">
                      {formatPaise(l.amountPaise)}
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      Bal: {formatPaise(l.balanceAfterPaise)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: MANUAL DEPOSIT SYSTEM (Master Verified)                           */}
      {/* ========================================================================= */}
      {activeTab === 'deposit' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Master Payment Instructions & UPI Details */}
          <div className="lg:col-span-5 bg-zinc-900 border border-zinc-800 p-5 rounded-2xl space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <ArrowDownLeft className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-100">Master Payment Link</h3>
                <span className="text-[10px] text-emerald-400 font-semibold">Official Payment Route</span>
              </div>
            </div>

            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-850 space-y-2">
              <span className="text-[10px] uppercase font-bold text-zinc-400 block">UPI ID / VPA</span>
              <div className="flex items-center justify-between bg-zinc-900 px-3 py-2 rounded-lg border border-zinc-800">
                <span className="font-mono font-bold text-amber-300 text-xs">
                  {paymentSettings.upiId || 'winora.gaming@icici'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(paymentSettings.upiId || 'winora.gaming@icici');
                    alert('UPI ID copied!');
                  }}
                  className="text-zinc-400 hover:text-zinc-100 p-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="pt-2">
                <span className="text-[10px] uppercase font-bold text-zinc-400 block">Account Holder</span>
                <span className="text-xs font-semibold text-zinc-200">
                  {paymentSettings.accountHolderName || 'WINORA ENTERTAINMENT PVT LTD'}
                </span>
              </div>

              {paymentSettings.paymentUrl && (
                <div className="pt-2">
                  <a
                    href={paymentSettings.paymentUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <span>Open Official Payment Link</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>

            {/* Instructions */}
            <div className="space-y-1.5 text-xs text-zinc-400">
              <span className="font-bold text-zinc-200 block">Step-by-Step Instructions:</span>
              <div className="whitespace-pre-line bg-zinc-950/60 p-3 rounded-xl border border-zinc-850 font-sans text-[11px] leading-relaxed text-zinc-300">
                {paymentSettings.instructions ||
                  '1. Pay to the official UPI ID.\n2. Copy the 12-digit UTR/Reference number.\n3. Submit the deposit form with proof screenshot.\n4. Master will verify and credit your Withdrawable Balance.'}
              </div>
            </div>

            <div className="text-[11px] text-zinc-500 flex items-center justify-between pt-2 border-t border-zinc-800">
              <span>Min: ₹{paymentSettings.minDepositPaise / 100}</span>
              <span>Max: ₹{(paymentSettings.maxDepositPaise / 100).toLocaleString()}</span>
            </div>
          </div>

          {/* Right: Submission Form & Player Deposit History */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl space-y-4">
              <h3 className="text-sm font-bold text-zinc-100">Submit Manual Deposit Details</h3>

              {depositNotice && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    depositNotice.type === 'success'
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      : 'bg-red-500/15 text-red-300 border border-red-500/30'
                  }`}
                >
                  {depositNotice.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{depositNotice.text}</span>
                </div>
              )}

              <form onSubmit={handleSubmitDeposit} className="space-y-4">
                {/* Amount */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Deposited Amount (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">₹</span>
                    <input
                      type="number"
                      value={depositAmountRupees}
                      onChange={(e) => setDepositAmountRupees(e.target.value)}
                      placeholder="1000"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-8 pr-4 py-2.5 text-zinc-100 text-sm font-mono focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  {/* Preset amounts */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {presetDeposits.map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setDepositAmountRupees(amt.toString())}
                        className="px-3 py-1.5 rounded-lg bg-zinc-800 active:bg-zinc-700 text-xs font-bold text-zinc-300 min-h-[36px] cursor-pointer"
                      >
                        ₹{amt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* UTR Reference */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    UPI Transaction Reference / UTR Number (12 Digits)
                  </label>
                  <input
                    type="text"
                    value={depositUtr}
                    onChange={(e) => setDepositUtr(e.target.value)}
                    placeholder="e.g. 489201928312"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-100 text-sm font-mono focus:border-amber-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-zinc-500 mt-1 block">
                    Find this 12-digit reference number in your Google Pay, PhonePe, or Banking app receipt.
                  </span>
                </div>

                {/* Proof Screenshot URL */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Payment Receipt Screenshot URL / Image Proof
                  </label>
                  <input
                    type="text"
                    value={depositProofUrl}
                    onChange={(e) => setDepositProofUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-zinc-100 text-xs font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={depositSubmitting}
                  className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  <span>{depositSubmitting ? 'Submitting...' : 'Submit for Master Verification'}</span>
                </button>
              </form>
            </div>

            {/* Player's Deposit Submissions */}
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl space-y-3">
              <h3 className="text-sm font-bold text-zinc-100">Your Submitted Deposits</h3>
              {playerDeposits.length === 0 ? (
                <p className="text-xs text-zinc-500 py-4 text-center">No deposit submissions found.</p>
              ) : (
                <div className="divide-y divide-zinc-800">
                  {playerDeposits.map((dep) => (
                    <div key={dep.depositId} className="py-3 flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-zinc-200">
                            ₹{(dep.submittedAmountPaise / 100).toLocaleString()}
                          </span>
                          <span
                            className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                              dep.status === 'APPROVED'
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : dep.status === 'REJECTED'
                                ? 'bg-red-500/15 text-red-400 border-red-500/30'
                                : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                            }`}
                          >
                            {dep.status}
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-400 font-mono block mt-0.5">
                          UTR: {dep.transactionReference} • {new Date(dep.submittedAt).toLocaleTimeString()}
                        </span>
                        {dep.reviewNote && (
                          <span className="text-[10px] text-zinc-500 italic block mt-0.5">
                            Note: {dep.reviewNote}
                          </span>
                        )}
                      </div>

                      {dep.screenshotUrl && (
                        <a
                          href={dep.screenshotUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] text-amber-400 hover:underline flex items-center gap-1"
                        >
                          <span>Proof</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: WITHDRAWAL SYSTEM                                                  */}
      {/* ========================================================================= */}
      {activeTab === 'withdrawal' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-zinc-900 border border-zinc-800 p-5 rounded-2xl space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-100">Withdrawal Rules</h3>
                <span className="text-[10px] text-emerald-400 font-semibold">Strict Withdrawable Balance Only</span>
              </div>
            </div>

            <div className="space-y-2 text-xs text-zinc-300 bg-zinc-950 p-4 rounded-xl border border-zinc-850 leading-relaxed">
              <p>
                • You can only withdraw from your <strong>Withdrawable Balance</strong> ({formatPaise(withdrawablePaise)}).
              </p>
              <p>
                • <strong>Bonus Balance ({formatPaise(bonusPaise)}) cannot be withdrawn</strong> under any circumstances.
              </p>
              <p>
                • Upon submission, funds are <strong>atomically held/reserved</strong> from your balance.
              </p>
              <p>
                • If Master or Agent rejects your payout, reserved funds are <strong>immediately refunded</strong> to your Withdrawable Balance.
              </p>
            </div>

            <div className="text-[11px] text-zinc-400 pt-2 border-t border-zinc-800 flex justify-between">
              <span>Min: ₹{paymentSettings.minWithdrawalPaise / 100}</span>
              <span>Max: ₹{(paymentSettings.maxWithdrawalPaise / 100).toLocaleString()}</span>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl space-y-4">
              <h3 className="text-sm font-bold text-zinc-100">Request Payout to UPI</h3>

              {withdrawNotice && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    withdrawNotice.type === 'success'
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      : 'bg-red-500/15 text-red-300 border border-red-500/30'
                  }`}
                >
                  {withdrawNotice.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  <span>{withdrawNotice.text}</span>
                </div>
              )}

              <form onSubmit={handleSubmitWithdrawal} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Withdrawal Amount (₹)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 font-bold">₹</span>
                    <input
                      type="number"
                      value={withdrawAmountRupees}
                      onChange={(e) => setWithdrawAmountRupees(e.target.value)}
                      placeholder="500"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-8 pr-4 py-2.5 text-zinc-100 text-sm font-mono focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <span className="text-[10px] text-zinc-500 mt-1 block">
                    Available Withdrawable: {formatPaise(withdrawablePaise)}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Recipient UPI ID (VPA)
                  </label>
                  <input
                    type="text"
                    value={withdrawUpiId}
                    onChange={(e) => setWithdrawUpiId(e.target.value)}
                    placeholder="e.g. yourname@oksbi"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-100 text-sm font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Beneficiary Account Holder Name
                  </label>
                  <input
                    type="text"
                    value={withdrawAccountName}
                    onChange={(e) => setWithdrawAccountName(e.target.value)}
                    placeholder="Account Name"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-100 text-sm focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={withdrawSubmitting || withdrawablePaise <= 0}
                  className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>{withdrawSubmitting ? 'Processing...' : 'Submit Withdrawal Request'}</span>
                </button>
              </form>
            </div>

            {/* Withdrawal Requests History */}
            <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl space-y-3">
              <h3 className="text-sm font-bold text-zinc-100">Your Withdrawal Requests</h3>
              {playerWithdrawals.length === 0 ? (
                <p className="text-xs text-zinc-500 py-4 text-center">No withdrawal requests found.</p>
              ) : (
                <div className="divide-y divide-zinc-800">
                  {playerWithdrawals.map((req) => (
                    <div key={req.requestId} className="py-3 flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-zinc-200">
                            {formatPaise(req.amountPaise)}
                          </span>
                          <span
                            className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                              req.status === 'APPROVED'
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : req.status === 'REJECTED'
                                ? 'bg-red-500/15 text-red-400 border-red-500/30'
                                : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                            }`}
                          >
                            {req.status}
                          </span>
                        </div>
                        <span className="text-[10px] text-zinc-400 font-mono block mt-0.5">
                          UPI: {req.upiId} • Ref: {req.requestId}
                        </span>
                        {req.payoutReference && (
                          <span className="text-[10px] text-emerald-400 font-mono block">
                            Payout Ref: {req.payoutReference}
                          </span>
                        )}
                        {req.rejectionReason && (
                          <span className="text-[10px] text-red-400 italic block">
                            Rejection: {req.rejectionReason} (Refunded)
                          </span>
                        )}
                      </div>

                      <span className="text-[10px] text-zinc-500">
                        {new Date(req.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: IMMUTABLE LEDGER SYSTEM                                            */}
      {/* ========================================================================= */}
      {activeTab === 'ledger' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" />
                <span>Authoritative Immutable Ledger</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Every balance mutation is append-only with before/after state snapshots.
              </p>
            </div>
            <span className="text-xs text-zinc-500 font-mono">
              Total Recorded Entries: {ledgerEntries.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-zinc-950 text-[10px] uppercase font-bold text-zinc-400 border-b border-zinc-800">
                <tr>
                  <th className="py-2.5 px-3">Tx ID / Time</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                  <th className="py-2.5 px-3 text-right">Withdrawable (B/A)</th>
                  <th className="py-2.5 px-3 text-right">Bonus (B/A)</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/80 font-mono text-[11px]">
                {ledgerEntries.map((item) => (
                  <tr key={item.transactionId} className="hover:bg-zinc-850/50 transition-colors">
                    <td className="py-2 px-3">
                      <span className="text-amber-400 block font-bold">{item.transactionId}</span>
                      <span className="text-[10px] text-zinc-500 font-sans">
                        {new Date(item.timestamp).toLocaleString()}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 text-[10px] font-bold">
                        {item.transactionType}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-emerald-400">
                      {formatPaise(item.amountPaise)}
                    </td>
                    <td className="py-2 px-3 text-right text-zinc-300">
                      {formatPaise(item.balanceBeforePaise)} → {formatPaise(item.balanceAfterPaise)}
                    </td>
                    <td className="py-2 px-3 text-right text-amber-300">
                      {formatPaise(item.bonusBeforePaise)} → {formatPaise(item.bonusAfterPaise)}
                    </td>
                    <td className="py-2 px-3 font-sans text-zinc-400 max-w-xs truncate" title={item.description}>
                      {item.description}
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                          item.status === 'COMPLETED'
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : item.status === 'REJECTED'
                            ? 'bg-red-500/15 text-red-400 border-red-500/30'
                            : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: REFERRAL SYSTEM                                                    */}
      {/* ========================================================================= */}
      {activeTab === 'referrals' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 bg-zinc-900 border border-zinc-800 p-5 rounded-2xl space-y-4">
            <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" />
              <span>Your Referral Hub</span>
            </h3>

            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-850 space-y-2">
              <span className="text-[10px] uppercase font-bold text-zinc-400 block">Your Permanent Code</span>
              <div className="flex items-center justify-between bg-zinc-900 px-4 py-3 rounded-xl border border-zinc-800">
                <span className="font-mono font-black text-xl text-amber-400 tracking-wider">
                  {currentUser.referralCode || 'WIN78ARJ1'}
                </span>
                <button
                  onClick={handleCopyReferral}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="space-y-1 text-xs text-zinc-300 leading-relaxed bg-zinc-950/60 p-4 rounded-xl border border-zinc-850">
              <span className="font-bold text-amber-400 block mb-1">Referral Rewards Program:</span>
              <p>• Invite players to register using your code.</p>
              <p>• Earn ₹500 referral credit upon referee's first qualifying deposit.</p>
              <p>• Self-referrals and duplicate device manipulation are automatically prevented.</p>
            </div>
          </div>

          <div className="lg:col-span-7 bg-zinc-900 border border-zinc-800 p-5 rounded-2xl space-y-3">
            <h3 className="text-sm font-bold text-zinc-100">Referred Friends List</h3>
            {referrals.length === 0 ? (
              <p className="text-xs text-zinc-500 py-6 text-center">No referrals recorded yet.</p>
            ) : (
              <div className="divide-y divide-zinc-800">
                {referrals.map((r) => (
                  <div key={r.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-zinc-200 block">{r.referredUserName}</span>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        Registered: {new Date(r.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="text-right">
                      <span
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                          r.status === 'COMPLETED'
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        }`}
                      >
                        {r.status}
                      </span>
                      {r.rewardCredited && (
                        <span className="text-[10px] text-emerald-400 font-mono block mt-0.5">
                          +₹{r.rewardAmountPaise / 100} Credited
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
