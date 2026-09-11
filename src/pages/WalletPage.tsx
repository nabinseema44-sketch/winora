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
  QrCode,
  Building2,
  Smartphone,
  Edit3,
  Save,
  Coins,
  X,
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
  initialTab?: 'overview' | 'deposit' | 'withdrawal' | 'ledger' | 'referrals';
}

export const WalletPage: React.FC<WalletPageProps> = ({ user: initialUser, onNavigate, initialTab }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'deposit' | 'withdrawal' | 'ledger' | 'referrals'>(
    initialTab || 'overview'
  );
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Sync initialTab if prop changes
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Engine state subscriptions
  const [currentUser, setCurrentUser] = useState<UserProfile>(
    initialUser || winoraEngine.getCurrentUser()
  );
  const [ledgerEntries, setLedgerEntries] = useState<ImmutableLedgerEntry[]>(winoraEngine.getLedger());
  const [depositRequests, setDepositRequests] = useState<DepositRequestRecord[]>(winoraEngine.getDepositRequests());
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequestRecord[]>(winoraEngine.getWithdrawalRequests());
  const [paymentSettings, setPaymentSettings] = useState<MasterPaymentSettings>(winoraEngine.getMasterPaymentSettings());
  const [referrals, setReferrals] = useState<ReferralRecord[]>(winoraEngine.getReferrals());

  // Master Deposit QR & Link Edit State
  const isMaster = currentUser.role === 'master' || currentUser.id === 'master-admin';
  const [showMasterDepositEditor, setShowMasterDepositEditor] = useState(false);
  const [masterQrUrl, setMasterQrUrl] = useState(paymentSettings.qrCodeUrl || '');
  const [masterPaymentUrl, setMasterPaymentUrl] = useState(paymentSettings.paymentUrl || '');
  const [masterUpiId, setMasterUpiId] = useState(paymentSettings.upiId || '');
  const [masterAccountName, setMasterAccountName] = useState(paymentSettings.accountHolderName || '');
  const [masterInstructions, setMasterInstructions] = useState(paymentSettings.instructions || '');

  // Deposit Form State
  const [depositAmountRupees, setDepositAmountRupees] = useState<string>('1000');
  const [depositUtr, setDepositUtr] = useState<string>('');
  const [depositProofUrl, setDepositProofUrl] = useState<string>('https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&auto=format&fit=crop&q=80');
  const [depositSubmitting, setDepositSubmitting] = useState(false);
  const [depositNotice, setDepositNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Withdrawal Form State
  const [payoutMethod, setPayoutMethod] = useState<'UPI' | 'BANK'>('UPI');
  const [withdrawAmountRupees, setWithdrawAmountRupees] = useState<string>('500');
  
  // UPI fields
  const [withdrawUpiId, setWithdrawUpiId] = useState<string>('');
  const [withdrawAccountName, setWithdrawAccountName] = useState<string>(currentUser.displayName || '');

  // Bank fields
  const [bankAccountNumber, setBankAccountNumber] = useState<string>('');
  const [confirmBankAccountNumber, setConfirmBankAccountNumber] = useState<string>('');
  const [bankIfscCode, setBankIfscCode] = useState<string>('');
  const [bankName, setBankName] = useState<string>('');
  const [bankHolderName, setBankHolderName] = useState<string>(currentUser.displayName || '');

  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);
  const [withdrawNotice, setWithdrawNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Subscribe to winoraEngine updates
  useEffect(() => {
    const handleUpdate = () => {
      const user = winoraEngine.getCurrentUser();
      const settings = winoraEngine.getMasterPaymentSettings();
      setCurrentUser({ ...user });
      setLedgerEntries(winoraEngine.getLedger());
      setDepositRequests(winoraEngine.getDepositRequests());
      setWithdrawalRequests(winoraEngine.getWithdrawalRequests());
      setPaymentSettings(settings);
      setMasterQrUrl(settings.qrCodeUrl || '');
      setMasterPaymentUrl(settings.paymentUrl || '');
      setMasterUpiId(settings.upiId || '');
      setMasterAccountName(settings.accountHolderName || '');
      setMasterInstructions(settings.instructions || '');
      setReferrals(winoraEngine.getReferrals(user.id));
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
  const presetWithdrawals = [500, 1000, 2500, 5000];

  // Save Master Deposit QR & Link Configuration
  const handleSaveMasterDepositConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const res = winoraEngine.updateMasterPaymentSettings({
      qrCodeUrl: masterQrUrl.trim(),
      paymentUrl: masterPaymentUrl.trim(),
      upiId: masterUpiId.trim(),
      accountHolderName: masterAccountName.trim(),
      instructions: masterInstructions.trim(),
    });
    setPaymentSettings(winoraEngine.getMasterPaymentSettings());
    setShowMasterDepositEditor(false);
    setDepositNotice({ type: 'success', text: 'Master Deposit QR code and payment link updated!' });
  };

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

    const amountPaise = rupeesToPaise(amountRupees);

    if (amountPaise > withdrawablePaise) {
      setWithdrawNotice({
        type: 'error',
        text: `Requested amount exceeds Withdrawable Balance (Available: ${formatPaise(withdrawablePaise)}). Note: Bonus Balance cannot be withdrawn.`,
      });
      return;
    }

    if (amountPaise < paymentSettings.minWithdrawalPaise) {
      setWithdrawNotice({
        type: 'error',
        text: `Minimum withdrawal is ₹${paymentSettings.minWithdrawalPaise / 100}.`,
      });
      return;
    }

    if (payoutMethod === 'UPI') {
      if (!withdrawUpiId.trim() || !withdrawUpiId.includes('@')) {
        setWithdrawNotice({ type: 'error', text: 'Please enter a valid UPI ID (e.g. mobile@paytm, user@oksbi).' });
        return;
      }
      if (!withdrawAccountName.trim()) {
        setWithdrawNotice({ type: 'error', text: 'Please enter the UPI account holder name.' });
        return;
      }
    } else {
      // BANK VALIDATION
      if (!bankAccountNumber.trim() || bankAccountNumber.trim().length < 8) {
        setWithdrawNotice({ type: 'error', text: 'Please enter a valid bank account number (at least 8 digits).' });
        return;
      }
      if (bankAccountNumber.trim() !== confirmBankAccountNumber.trim()) {
        setWithdrawNotice({ type: 'error', text: 'Bank account numbers do not match. Please recheck.' });
        return;
      }
      if (!bankIfscCode.trim() || bankIfscCode.trim().length < 9) {
        setWithdrawNotice({ type: 'error', text: 'Please enter a valid 11-character bank IFSC code (e.g. SBIN0001234).' });
        return;
      }
      if (!bankHolderName.trim()) {
        setWithdrawNotice({ type: 'error', text: 'Please enter the bank account holder name.' });
        return;
      }
    }

    setWithdrawSubmitting(true);

    const res = winoraEngine.requestWithdrawal({
      playerId: currentUser.id,
      amountPaise,
      payoutMethod,
      upiId: payoutMethod === 'UPI' ? withdrawUpiId.trim() : undefined,
      bankAccount:
        payoutMethod === 'BANK'
          ? {
              accountNumber: bankAccountNumber.trim(),
              ifscCode: bankIfscCode.trim().toUpperCase(),
              bankName: bankName.trim() || 'Direct Bank Transfer',
              accountHolderName: bankHolderName.trim(),
            }
          : undefined,
      accountName: payoutMethod === 'BANK' ? bankHolderName.trim() : withdrawAccountName.trim(),
      agentId: currentUser.assignedAgentId,
    });

    setWithdrawSubmitting(false);

    if (res.success) {
      setWithdrawNotice({
        type: 'success',
        text: 'Withdrawal request submitted! Coins will be deducted from your wallet once Master verifies and executes the payout.',
      });
      setWithdrawAmountRupees('');
      setBankAccountNumber('');
      setConfirmBankAccountNumber('');
      setBankIfscCode('');
    } else {
      setWithdrawNotice({ type: 'error', text: res.message });
    }
  };

  // Master Direct Action Handlers from Wallet Page
  const handleMasterApproveDeposit = (depositId: string) => {
    const res = winoraEngine.approveDepositRequest(depositId);
    setDepositNotice({ type: 'success', text: res.message });
  };

  const handleMasterRejectDeposit = (depositId: string) => {
    const reason = prompt('Reason for rejecting deposit:');
    if (!reason) return;
    const res = winoraEngine.rejectDepositRequest(depositId, 'master-admin', reason);
    setDepositNotice({ type: 'error', text: res.message });
  };

  const handleMasterApproveWithdrawal = (requestId: string) => {
    const req = withdrawalRequests.find((r) => r.requestId === requestId);
    const methodStr = req?.payoutMethod === 'BANK' ? 'Bank Account' : 'UPI';
    const confirmDeduct = window.confirm(
      `Confirm payout and deduct ₹${req ? (req.amountPaise / 100).toLocaleString() : ''} coins from ${req?.playerName}?\n` +
      `Payout method: ${methodStr}. Coins will be permanently deducted upon your confirmation.`
    );
    if (!confirmDeduct) return;

    const ref = prompt('Enter Bank / UPI transaction reference:', `IMPS-${Date.now().toString().slice(-8)}`);
    if (!ref) return;
    const res = winoraEngine.approveWithdrawal(requestId, 'master-admin', ref);
    setWithdrawNotice({ type: 'success', text: res.message });
  };

  const handleMasterRejectWithdrawal = (requestId: string) => {
    const reason = prompt('Reason for rejection (no coins deducted):');
    if (!reason) return;
    const res = winoraEngine.rejectWithdrawal(requestId, 'master-admin', reason);
    setWithdrawNotice({ type: 'error', text: res.message });
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
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Integer Paise Backend-Authoritative
            </span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-black text-zinc-100">
            Authoritative Money Wallet
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Strict separation of Withdrawable Balance and Bonus Balance with an immutable transaction ledger.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('ledger')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-300 hover:text-amber-400 hover:border-zinc-700 transition-colors cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-amber-400" />
            <span>Immutable Ledger</span>
          </button>
        </div>
      </div>

      {/* Main Dual Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Withdrawable Balance */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 border border-emerald-500/30 p-6 shadow-xl">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Withdrawable Balance
            </span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
              Eligible for Payout
            </span>
          </div>

          <div className="flex items-baseline gap-2 mt-2">
            <span className="font-display text-4xl sm:text-5xl font-black text-zinc-100 tabular-nums">
              {formatPaise(withdrawablePaise)}
            </span>
            <span className="text-xs font-mono text-zinc-500">
              ({withdrawablePaise.toLocaleString()} paise)
            </span>
          </div>

          <p className="text-xs text-zinc-400 mt-3 flex items-center gap-1.5">
            <span>Authoritative funds available for game bidding and instant withdrawal requests.</span>
          </p>

          <div className="mt-5 flex gap-2">
            <button
              onClick={() => setActiveTab('deposit')}
              className="flex-1 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <ArrowDownLeft className="w-4 h-4 stroke-[2.5]" />
              <span>Deposit</span>
            </button>
            <button
              onClick={() => setActiveTab('withdrawal')}
              className="flex-1 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <ArrowUpRight className="w-4 h-4 stroke-[2.5] text-amber-400" />
              <span>Withdraw</span>
            </button>
          </div>
        </div>

        {/* Card 2: Bonus Balance (Non-Withdrawable) */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 border border-amber-500/30 p-6 shadow-xl">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-amber-400" />
              Bonus Balance (Non-Withdrawable)
            </span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
              Protection Only
            </span>
          </div>

          <div className="flex items-baseline gap-2 mt-2">
            <span className="font-display text-4xl sm:text-5xl font-black text-amber-300 tabular-nums">
              {formatPaise(bonusPaise)}
            </span>
            <span className="text-xs font-mono text-zinc-500">
              ({bonusPaise.toLocaleString()} paise)
            </span>
          </div>

          <p className="text-xs text-amber-200/80 mt-3 flex items-start gap-1.5 leading-relaxed">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <span>
              Credited from 80% Hourly Protection refunds & promotions. <strong>Never withdrawable</strong> per Master Blueprint rules.
            </span>
          </p>

          {isAgent && (
            <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between text-xs">
              <span className="text-purple-300 font-semibold">Agent Commission Balance:</span>
              <span className="font-mono font-bold text-purple-400">{formatPaise(commPaise)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Tab Bar */}
      <div className="flex border-b border-zinc-800 gap-2 pb-1 overflow-x-auto text-xs font-bold">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'overview'
              ? 'bg-amber-500 text-zinc-950 shadow'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <Wallet className="w-4 h-4" />
          <span>Wallet Overview</span>
        </button>

        <button
          onClick={() => setActiveTab('deposit')}
          className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'deposit'
              ? 'bg-amber-500 text-zinc-950 shadow'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <ArrowDownLeft className="w-4 h-4" />
          <span>Manual Deposit (UTR)</span>
          {playerDeposits.filter((d) => d.status === 'PENDING').length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-400 text-zinc-950 font-black">
              {playerDeposits.filter((d) => d.status === 'PENDING').length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('withdrawal')}
          className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'withdrawal'
              ? 'bg-amber-500 text-zinc-950 shadow'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <ArrowUpRight className="w-4 h-4" />
          <span>Withdrawal Request</span>
        </button>

        <button
          onClick={() => setActiveTab('ledger')}
          className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'ledger'
              ? 'bg-amber-500 text-zinc-950 shadow'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Immutable Ledger</span>
        </button>

        <button
          onClick={() => setActiveTab('referrals')}
          className={`px-4 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'referrals'
              ? 'bg-amber-500 text-zinc-950 shadow'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Referral System</span>
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
      {/* TAB 2: COIN DEPOSIT SYSTEM (Master QR & Link Verified)                    */}
      {/* ========================================================================= */}
      {activeTab === 'deposit' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-amber-500/10 via-zinc-900 to-zinc-900 border border-amber-500/30 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                <QrCode className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h2 className="text-base font-black text-zinc-100 flex items-center gap-2">
                  <span>Coin Deposit Gateway</span>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-500/30">
                    1 Coin = ₹1.00
                  </span>
                </h2>
                <p className="text-xs text-zinc-400">
                  Scan Master QR code or open Master Payment Link, transfer via any UPI app, and submit your 12-digit UTR.
                </p>
              </div>
            </div>

            {/* Master Settings Button */}
            <button
              onClick={() => setShowMasterDepositEditor(!showMasterDepositEditor)}
              className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shrink-0"
            >
              <Edit3 className="w-3.5 h-3.5 text-amber-400" />
              <span>{showMasterDepositEditor ? 'Hide Master Editor' : 'Edit QR & Link (Master)'}</span>
            </button>
          </div>

          {/* Master QR & Link Editor Modal / Drawer (when opened) */}
          {showMasterDepositEditor && (
            <form onSubmit={handleSaveMasterDepositConfig} className="bg-zinc-900 border-2 border-amber-500/40 p-5 rounded-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                    <Edit3 className="w-4 h-4" />
                    <span>Master Controls: Update Deposit QR & Payment Link</span>
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Changes here immediately update the QR code, link, and payment instructions visible to all players.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMasterDepositEditor(false)}
                  className="p-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-zinc-300 mb-1">Official Master QR Code URL</label>
                  <input
                    type="text"
                    value={masterQrUrl}
                    onChange={(e) => setMasterQrUrl(e.target.value)}
                    placeholder="https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 font-mono focus:border-amber-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-zinc-500 mt-1 block">
                    Paste an image URL for your UPI QR code. Leave empty to use auto-generated UPI QR.
                  </span>
                </div>

                <div>
                  <label className="block font-semibold text-zinc-300 mb-1">Official Master Payment Link</label>
                  <input
                    type="text"
                    value={masterPaymentUrl}
                    onChange={(e) => setMasterPaymentUrl(e.target.value)}
                    placeholder="https://pay.winora.vip/deposit or upi://pay?pa=..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 font-mono focus:border-amber-500 focus:outline-none"
                  />
                  <span className="text-[10px] text-zinc-500 mt-1 block">
                    Link given by Master for direct browser or gateway payments.
                  </span>
                </div>

                <div>
                  <label className="block font-semibold text-zinc-300 mb-1">Master UPI ID (VPA)</label>
                  <input
                    type="text"
                    value={masterUpiId}
                    onChange={(e) => setMasterUpiId(e.target.value)}
                    placeholder="winora.gaming@icici"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-zinc-300 mb-1">Account Holder / Beneficiary Name</label>
                  <input
                    type="text"
                    value={masterAccountName}
                    onChange={(e) => setMasterAccountName(e.target.value)}
                    placeholder="WINORA ENTERTAINMENT PVT LTD"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-100 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block font-semibold text-zinc-300 mb-1">Deposit Instructions for Players</label>
                  <textarea
                    rows={2}
                    value={masterInstructions}
                    onChange={(e) => setMasterInstructions(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-zinc-100 focus:border-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowMasterDepositEditor(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs flex items-center gap-1.5 shadow"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Master Configuration</span>
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Official Master QR & Payment Link */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                      <QrCode className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-bold text-zinc-100">Master Deposit QR Code</h3>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Official Master Route
                  </span>
                </div>

                {/* QR Code Container */}
                <div className="bg-white p-4 rounded-2xl flex flex-col items-center justify-center shadow-lg border border-zinc-200">
                  <div className="w-56 h-56 relative flex items-center justify-center">
                    <img
                      src={
                        paymentSettings.qrCodeUrl ||
                        `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(
                          `upi://pay?pa=${paymentSettings.upiId || 'winora.gaming@icici'}&pn=${encodeURIComponent(
                            paymentSettings.accountHolderName || 'WINORA ENTERTAINMENT'
                          )}&cu=INR`
                        )}`
                      }
                      alt="Master Payment QR"
                      className="w-full h-full object-contain rounded-lg"
                    />
                  </div>
                  <p className="text-[11px] text-zinc-700 font-semibold mt-2 text-center">
                    Scan with Google Pay, PhonePe, Paytm, BHIM, or any UPI App
                  </p>
                </div>

                {/* Master Official Payment Link Box */}
                <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 space-y-2">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block flex items-center justify-between">
                    <span>Master Official Payment Link</span>
                    <span className="text-amber-400">Direct Transfer</span>
                  </span>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={paymentSettings.paymentUrl || `https://pay.winora.vip/upi?id=${paymentSettings.upiId || 'winora.gaming@icici'}`}
                      className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-amber-300 font-mono truncate"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const linkToCopy = paymentSettings.paymentUrl || `https://pay.winora.vip/upi?id=${paymentSettings.upiId || 'winora.gaming@icici'}`;
                        navigator.clipboard.writeText(linkToCopy);
                        setCopiedLink(true);
                        setTimeout(() => setCopiedLink(false), 2000);
                      }}
                      className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs flex items-center gap-1 shrink-0"
                      title="Copy Payment Link"
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    {paymentSettings.paymentUrl && (
                      <a
                        href={paymentSettings.paymentUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs flex items-center gap-1 shrink-0 border border-emerald-500/30 font-bold"
                        title="Open Payment Link"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Master UPI ID & Beneficiary */}
                <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 space-y-2.5">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">Official UPI ID (VPA)</span>
                    <div className="flex items-center justify-between bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-800">
                      <span className="font-mono font-bold text-amber-300 text-xs">
                        {paymentSettings.upiId || 'winora.gaming@icici'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(paymentSettings.upiId || 'winora.gaming@icici');
                          setCopiedUpi(true);
                          setTimeout(() => setCopiedUpi(false), 2000);
                        }}
                        className="text-zinc-400 hover:text-zinc-100 p-1 flex items-center gap-1 text-[11px]"
                      >
                        {copiedUpi ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span className="text-[10px]">{copiedUpi ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-0.5">Account Holder Name</span>
                    <span className="text-xs font-semibold text-zinc-200">
                      {paymentSettings.accountHolderName || 'WINORA ENTERTAINMENT PVT LTD'}
                    </span>
                  </div>
                </div>

                {/* Instructions */}
                <div className="space-y-1.5 text-xs text-zinc-400">
                  <span className="font-bold text-zinc-200 block">How to Deposit:</span>
                  <div className="whitespace-pre-line bg-zinc-950/60 p-3 rounded-xl border border-zinc-850 font-sans text-[11px] leading-relaxed text-zinc-300">
                    {paymentSettings.instructions ||
                      '1. Scan the QR code above or open the Master payment link.\n2. Transfer the desired amount and copy the 12-digit UTR/Reference number.\n3. Submit the deposit request form with the UTR number.\n4. Master will verify and credit coins to your Withdrawable Balance.'}
                  </div>
                </div>

                <div className="text-[11px] text-zinc-500 flex items-center justify-between pt-2 border-t border-zinc-800">
                  <span>Min Deposit: ₹{paymentSettings.minDepositPaise / 100}</span>
                  <span>Max Deposit: ₹{(paymentSettings.maxDepositPaise / 100).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Right Column: Player Deposit Submission Form & History */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl space-y-4">
                <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                  <Coins className="w-4 h-4 text-amber-400" />
                  <span>Submit Coin Deposit Request</span>
                </h3>

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
                      Deposit Amount (Coins / ₹)
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
                    <div className="flex gap-2 mt-2">
                      {presetDeposits.map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setDepositAmountRupees(amt.toString())}
                          className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[11px] font-bold text-zinc-300 cursor-pointer"
                        >
                          ₹{amt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* UTR Reference */}
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      12-Digit UPI UTR / Reference Number
                    </label>
                    <input
                      type="text"
                      value={depositUtr}
                      onChange={(e) => setDepositUtr(e.target.value)}
                      placeholder="e.g. 489201928312"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-100 text-sm font-mono focus:border-amber-500 focus:outline-none"
                    />
                    <span className="text-[10px] text-zinc-500 mt-1 block">
                      Locate this in your UPI payment receipt (Google Pay, PhonePe, Paytm, BHIM, etc.)
                    </span>
                  </div>

                  {/* Screenshot Proof URL */}
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      Payment Screenshot Proof URL
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
                    <span>{depositSubmitting ? 'Submitting...' : 'Submit Deposit for Master Confirmation'}</span>
                  </button>
                </form>
              </div>

              {/* Submitted Deposits History */}
              <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-zinc-100">Your Submitted Deposit Requests</h3>
                  <span className="text-xs text-zinc-500 font-mono">
                    Total: {playerDeposits.length}
                  </span>
                </div>

                {playerDeposits.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-6 text-center">No deposit submissions found.</p>
                ) : (
                  <div className="divide-y divide-zinc-800">
                    {playerDeposits.map((dep) => (
                      <div key={dep.depositId} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-zinc-200 text-sm">
                              ₹{(dep.submittedAmountPaise / 100).toLocaleString()} ({Math.floor(dep.submittedAmountPaise / 100).toLocaleString()} Coins)
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
                              Master Note: {dep.reviewNote}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {dep.screenshotUrl && (
                            <a
                              href={dep.screenshotUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11px] text-amber-400 hover:underline flex items-center gap-1 bg-zinc-800 px-2 py-1 rounded"
                            >
                              <span>View Receipt</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}

                          {/* Master inline approval/rejection */}
                          {isMaster && dep.status === 'PENDING' && (
                            <div className="flex items-center gap-1.5 ml-2">
                              <button
                                onClick={() => handleMasterApproveDeposit(dep.depositId)}
                                className="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-[11px]"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleMasterRejectDeposit(dep.depositId)}
                                className="px-2.5 py-1 rounded bg-red-500/20 text-red-400 border border-red-500/30 text-[11px]"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: COIN WITHDRAWAL SYSTEM (UPI & Bank Account)                        */}
      {/* ========================================================================= */}
      {activeTab === 'withdrawal' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-emerald-500/10 via-zinc-900 to-zinc-900 border border-emerald-500/30 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
                <ArrowUpRight className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <h2 className="text-base font-black text-zinc-100 flex items-center gap-2">
                  <span>Coin Withdrawal Portal</span>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    UPI & Bank Account
                  </span>
                </h2>
                <p className="text-xs text-zinc-400">
                  Select your payout method (UPI or Direct Bank Transfer) and submit for Master verification.
                </p>
              </div>
            </div>

            <div className="bg-zinc-950/80 px-4 py-2 rounded-xl border border-zinc-800 text-right shrink-0">
              <span className="text-[10px] uppercase font-bold text-zinc-400 block">Available Withdrawable</span>
              <span className="text-base font-black text-emerald-400 font-mono">
                {formatPaise(withdrawablePaise)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Authoritative Rules & Policy */}
            <div className="lg:col-span-5 bg-zinc-900 border border-zinc-800 p-5 rounded-2xl space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-zinc-100">Withdrawal & Coin Rules</h3>
                  <span className="text-[10px] text-emerald-400 font-semibold">Master Confirmed Flow</span>
                </div>
              </div>

              {/* Master Confirmation Callout */}
              <div className="bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-xl space-y-1.5 text-xs">
                <div className="flex items-center gap-2 text-amber-400 font-bold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Coins Deducted After Master Confirmation</span>
                </div>
                <p className="text-[11px] text-amber-200/90 leading-relaxed">
                  Your coins will safely stay in your balance when you submit. Coins will be permanently deducted from your wallet <strong>only after the Master confirms and executes your payout</strong>.
                </p>
              </div>

              <div className="space-y-2 text-xs text-zinc-300 bg-zinc-950 p-4 rounded-xl border border-zinc-850 leading-relaxed">
                <p>
                  • <strong>Withdrawable Balance Only:</strong> You can only withdraw from your Withdrawable Balance ({formatPaise(withdrawablePaise)}).
                </p>
                <p>
                  • <strong>Bonus Protection Balance:</strong> Non-withdrawable ({formatPaise(bonusPaise)}). Reserved solely for hourly safety refunds and game betting.
                </p>
                <p>
                  • <strong>Payout Methods Supported:</strong> Instant UPI VPA transfer or Direct Bank Account IMPS/NEFT.
                </p>
                <p>
                  • <strong>Rejections:</strong> If Master rejects the request, zero coins are deducted.
                </p>
              </div>

              <div className="text-[11px] text-zinc-400 pt-2 border-t border-zinc-800 flex justify-between">
                <span>Min Withdrawal: ₹{paymentSettings.minWithdrawalPaise / 100}</span>
                <span>Max Withdrawal: ₹{(paymentSettings.maxWithdrawalPaise / 100).toLocaleString()}</span>
              </div>
            </div>

            {/* Right Column: Withdrawal Form & Player Requests */}
            <div className="lg:col-span-7 space-y-6">
              <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-zinc-100">Request Coin Withdrawal</h3>
                  <span className="text-[11px] text-zinc-400">
                    Bal: <strong className="text-emerald-400 font-mono">{formatPaise(withdrawablePaise)}</strong>
                  </span>
                </div>

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

                {/* Method Switcher Tabs */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Choose Payout Method</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPayoutMethod('UPI')}
                      className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                        payoutMethod === 'UPI'
                          ? 'bg-amber-500 text-zinc-950 border-amber-400 shadow'
                          : 'bg-zinc-950 text-zinc-300 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      <Smartphone className="w-4 h-4" />
                      <span>UPI ID (Instant)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPayoutMethod('BANK')}
                      className={`py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                        payoutMethod === 'BANK'
                          ? 'bg-amber-500 text-zinc-950 border-amber-400 shadow'
                          : 'bg-zinc-950 text-zinc-300 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      <Building2 className="w-4 h-4" />
                      <span>Bank Account Transfer</span>
                    </button>
                  </div>
                </div>

                <form onSubmit={handleSubmitWithdrawal} className="space-y-4">
                  {/* Amount Field */}
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      Withdrawal Amount (Coins / ₹)
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

                    {/* Presets */}
                    <div className="flex gap-2 mt-2">
                      {presetWithdrawals.map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setWithdrawAmountRupees(amt.toString())}
                          className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[11px] font-bold text-zinc-300 cursor-pointer"
                        >
                          ₹{amt}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setWithdrawAmountRupees((withdrawablePaise / 100).toString())}
                        className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-[11px] font-bold cursor-pointer border border-emerald-500/30"
                      >
                        Max All
                      </button>
                    </div>
                  </div>

                  {/* UPI FIELDS */}
                  {payoutMethod === 'UPI' && (
                    <div className="space-y-3 bg-zinc-950/60 p-3.5 rounded-xl border border-zinc-800">
                      <div>
                        <label className="block text-xs font-semibold text-zinc-300 mb-1">
                          Recipient UPI ID (VPA)
                        </label>
                        <input
                          type="text"
                          value={withdrawUpiId}
                          onChange={(e) => setWithdrawUpiId(e.target.value)}
                          placeholder="e.g. yourname@oksbi or 9876543210@paytm"
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
                          placeholder="Name as registered on UPI"
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-100 text-sm focus:border-amber-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* BANK ACCOUNT FIELDS */}
                  {payoutMethod === 'BANK' && (
                    <div className="space-y-3 bg-zinc-950/60 p-3.5 rounded-xl border border-zinc-800">
                      <div>
                        <label className="block text-xs font-semibold text-zinc-300 mb-1">
                          Bank Name
                        </label>
                        <input
                          type="text"
                          value={bankName}
                          onChange={(e) => setBankName(e.target.value)}
                          placeholder="e.g. State Bank of India, HDFC Bank, ICICI Bank"
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-zinc-100 text-xs focus:border-amber-500 focus:outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-zinc-300 mb-1">
                            Bank Account Number
                          </label>
                          <input
                            type="text"
                            value={bankAccountNumber}
                            onChange={(e) => setBankAccountNumber(e.target.value)}
                            placeholder="e.g. 50100234123456"
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-zinc-100 text-xs font-mono focus:border-amber-500 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-zinc-300 mb-1">
                            Confirm Account Number
                          </label>
                          <input
                            type="text"
                            value={confirmBankAccountNumber}
                            onChange={(e) => setConfirmBankAccountNumber(e.target.value)}
                            placeholder="Re-enter account number"
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-zinc-100 text-xs font-mono focus:border-amber-500 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-zinc-300 mb-1">
                            Bank IFSC Code
                          </label>
                          <input
                            type="text"
                            value={bankIfscCode}
                            onChange={(e) => setBankIfscCode(e.target.value.toUpperCase())}
                            placeholder="e.g. SBIN0001234"
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-zinc-100 text-xs font-mono uppercase focus:border-amber-500 focus:outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-zinc-300 mb-1">
                            Account Holder Name (as in Passbook)
                          </label>
                          <input
                            type="text"
                            value={bankHolderName}
                            onChange={(e) => setBankHolderName(e.target.value)}
                            placeholder="Exact name in bank account"
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-zinc-100 text-xs focus:border-amber-500 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="text-[11px] text-zinc-500 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span>Coins are deducted from your wallet only after Master reviews and executes payout.</span>
                  </div>

                  <button
                    type="submit"
                    disabled={withdrawSubmitting || withdrawablePaise <= 0}
                    className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-98 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    <span>{withdrawSubmitting ? 'Submitting...' : 'Submit Withdrawal for Master Payout'}</span>
                  </button>
                </form>
              </div>

              {/* Player Withdrawal Requests History */}
              <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-zinc-100">Your Withdrawal History</h3>
                  <span className="text-xs text-zinc-500 font-mono">
                    Total: {playerWithdrawals.length}
                  </span>
                </div>

                {playerWithdrawals.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-6 text-center">No withdrawal requests found.</p>
                ) : (
                  <div className="divide-y divide-zinc-800">
                    {playerWithdrawals.map((req) => (
                      <div key={req.requestId} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-zinc-200 text-sm">
                              {formatPaise(req.amountPaise)} ({Math.floor(req.amountPaise / 100).toLocaleString()} Coins)
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
                              {req.status === 'PENDING' ? 'Pending Master Confirmation' : req.status}
                            </span>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 flex items-center gap-1">
                              {req.payoutMethod === 'BANK' || req.bankAccount ? (
                                <>
                                  <Building2 className="w-3 h-3 text-cyan-400" />
                                  <span>Bank</span>
                                </>
                              ) : (
                                <>
                                  <Smartphone className="w-3 h-3 text-amber-400" />
                                  <span>UPI</span>
                                </>
                              )}
                            </span>
                          </div>

                          {/* Destination info */}
                          {req.payoutMethod === 'BANK' || req.bankAccount ? (
                            <p className="text-[11px] text-zinc-400 font-mono">
                              Bank: {req.bankAccount?.bankName || 'Direct'} • A/C: ••••{req.bankAccount?.accountNumber.slice(-4)} • IFSC: {req.bankAccount?.ifscCode}
                            </p>
                          ) : (
                            <p className="text-[11px] text-zinc-400 font-mono">
                              UPI: {req.upiId} • Holder: {req.accountName}
                            </p>
                          )}

                          <div className="text-[10px] text-zinc-500 flex flex-wrap items-center gap-2">
                            <span>Req ID: {req.requestId}</span>
                            <span>•</span>
                            <span>{new Date(req.createdAt).toLocaleString()}</span>
                            {req.status === 'PENDING' && (
                              <span className="text-amber-400 font-medium">
                                • Coins will deduct upon Master confirmation
                              </span>
                            )}
                            {req.payoutReference && (
                              <span className="text-emerald-400 font-mono">
                                • Payout Ref: {req.payoutReference} (Coins Deducted)
                              </span>
                            )}
                            {req.rejectionReason && (
                              <span className="text-red-400 italic">
                                • Rejection: {req.rejectionReason} (No Coins Deducted)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* If Master is viewing, quick approval button */}
                        {isMaster && req.status === 'PENDING' && (
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => handleMasterApproveWithdrawal(req.requestId)}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs flex items-center gap-1 cursor-pointer"
                            >
                              <Check className="w-3 h-3" />
                              <span>Confirm & Deduct</span>
                            </button>
                            <button
                              onClick={() => handleMasterRejectWithdrawal(req.requestId)}
                              className="px-2.5 py-1.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold cursor-pointer"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
