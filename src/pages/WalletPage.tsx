import React, { useState } from 'react';
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  CreditCard,
  Building2,
  QrCode,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  Lock,
  ChevronRight,
  RefreshCw,
  SlidersHorizontal,
  ExternalLink,
  Layers,
} from 'lucide-react';
import {
  UserProfile,
  WalletTransaction,
  NavPage,
  CurrencyConfig,
  SUPPORTED_CURRENCIES,
  TransactionType,
} from '../types.ts';

interface WalletPageProps {
  user: UserProfile | null;
  transactions?: WalletTransaction[];
  ledger?: WalletTransaction[];
  onNavigate?: (page: NavPage) => void;
  onDepositInitiated?: (transaction: WalletTransaction) => void;
  onWithdrawalRequested?: (transaction: WalletTransaction) => void;
  onCurrencyChange?: (currency: CurrencyConfig) => void;
}

type ModalMode = 'none' | 'deposit' | 'withdrawal';

export const WalletPage: React.FC<WalletPageProps> = ({
  user,
  transactions = [],
  ledger = [],
  onNavigate,
  onDepositInitiated,
  onWithdrawalRequested,
  onCurrencyChange,
}) => {
  const transactionList = transactions.length > 0 ? transactions : ledger;
  // Modal state
  const [modalMode, setModalMode] = useState<ModalMode>('none');

  // Filter state for Transaction History
  const [filterType, setFilterType] = useState<'all' | 'deposit' | 'withdrawal' | 'pending'>('all');

  // Active currency
  const activeCurrency: CurrencyConfig = user?.currency || SUPPORTED_CURRENCIES[0];

  // Deposit Form State
  const [depositAmount, setDepositAmount] = useState<string>('1000');
  const [depositMethod, setDepositMethod] = useState<'upi' | 'card' | 'net_banking' | 'wire'>('upi');
  const [depositStep, setDepositStep] = useState<'form' | 'confirm' | 'status'>('form');
  const [lastDepositTxn, setLastDepositTxn] = useState<WalletTransaction | null>(null);

  // Withdrawal Form State
  const [withdrawAmount, setWithdrawAmount] = useState<string>('500');
  const [withdrawMethod, setWithdrawMethod] = useState<'bank' | 'upi'>('bank');
  const [withdrawAccount, setWithdrawAccount] = useState<string>('');
  const [withdrawIfsc, setWithdrawIfsc] = useState<string>('');
  const [withdrawUpiId, setWithdrawUpiId] = useState<string>('');
  const [withdrawStep, setWithdrawStep] = useState<'form' | 'confirm' | 'status'>('form');
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [lastWithdrawTxn, setLastWithdrawTxn] = useState<WalletTransaction | null>(null);

  if (!user) {
    return (
      <div className="text-center py-16 bg-zinc-900/70 border border-zinc-800 rounded-3xl p-8 max-w-md mx-auto my-8 shadow-2xl">
        <div className="w-14 h-14 rounded-2xl bg-zinc-800 text-amber-400 flex items-center justify-center mx-auto mb-4 border border-zinc-700/50">
          <Wallet className="w-7 h-7" />
        </div>
        <h2 className="font-display text-xl font-bold text-zinc-100 mb-2">
          Sign In to Access Money Wallet
        </h2>
        <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
          Log in with your verified mobile number to view your available balance, deposit funds, request withdrawals, and inspect verified transaction logs.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            id="wallet-unauth-login-btn"
            onClick={() => onNavigate?.('login')}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-xl transition-transform active:scale-95 cursor-pointer shadow-md shadow-amber-500/15"
          >
            Sign In with Mobile
          </button>
          <button
            id="wallet-unauth-register-btn"
            onClick={() => onNavigate?.('register')}
            className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs rounded-xl border border-zinc-700 transition-transform active:scale-95 cursor-pointer"
          >
            Create Account
          </button>
        </div>
      </div>
    );
  }

  const balance = user.walletBalance ?? 0;

  // Currency quick switcher
  const handleCurrencySelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const found = SUPPORTED_CURRENCIES.find((c) => c.code === e.target.value);
    if (found && onCurrencyChange) {
      onCurrencyChange(found);
    }
  };

  // Helper to format currency
  const formatMoney = (amount: number, currencyCode = activeCurrency.code, symbol = activeCurrency.symbol) => {
    return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Open Deposit Modal
  const handleOpenDeposit = () => {
    setDepositAmount('1000');
    setDepositMethod('upi');
    setDepositStep('form');
    setModalMode('deposit');
  };

  // Open Withdrawal Modal
  const handleOpenWithdrawal = () => {
    setWithdrawAmount(Math.min(500, balance).toString());
    setWithdrawMethod('bank');
    setWithdrawStep('form');
    setWithdrawError(null);
    setModalMode('withdrawal');
  };

  // Close modals
  const handleCloseModal = () => {
    setModalMode('none');
    setDepositStep('form');
    setWithdrawStep('form');
  };

  // Submit Deposit Flow
  const handleProceedDepositConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(depositAmount);
    if (isNaN(num) || num <= 0) return;
    setDepositStep('confirm');
  };

  const handleExecuteDeposit = () => {
    const num = parseFloat(depositAmount);
    const refId = `WIN-DEP-${Math.floor(100000 + Math.random() * 900000)}`;
    const newTxn: WalletTransaction = {
      id: `TXN-${Date.now().toString().slice(-6)}`,
      referenceId: refId,
      type: 'deposit',
      amount: num,
      currency: activeCurrency.code,
      status: 'pending',
      paymentMethod:
        depositMethod === 'upi'
          ? 'UPI Instant (GPay / PhonePe / QR)'
          : depositMethod === 'card'
          ? 'Debit / Credit Card Gateway'
          : depositMethod === 'net_banking'
          ? 'Net Banking Portal'
          : 'Direct Bank Wire (IMPS/NEFT)',
      createdAt: 'Just now',
      description: 'Account Wallet Deposit (Awaiting Gateway Settlement)',
      destinationAccount: depositMethod === 'upi' ? 'UPI Gateway' : 'Bank Gateway',
    };

    setLastDepositTxn(newTxn);
    setDepositStep('status');
    if (onDepositInitiated) {
      onDepositInitiated(newTxn);
    }
  };

  // Submit Withdrawal Flow
  const handleProceedWithdrawConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(withdrawAmount);
    if (isNaN(num) || num <= 0) {
      setWithdrawError('Please enter a valid withdrawal amount.');
      return;
    }
    if (num > balance) {
      setWithdrawError(`Insufficient funds. Your available balance is ${formatMoney(balance)}.`);
      return;
    }
    if (num < 100) {
      setWithdrawError(`Minimum withdrawal amount is ${activeCurrency.symbol}100.00.`);
      return;
    }
    if (withdrawMethod === 'bank' && !withdrawAccount.trim()) {
      setWithdrawError('Please specify the destination Bank Account number.');
      return;
    }
    if (withdrawMethod === 'upi' && !withdrawUpiId.trim()) {
      setWithdrawError('Please specify a valid destination UPI ID.');
      return;
    }

    setWithdrawError(null);
    setWithdrawStep('confirm');
  };

  const handleExecuteWithdrawal = () => {
    const num = parseFloat(withdrawAmount);
    const refId = `WIN-WTH-${Math.floor(100000 + Math.random() * 900000)}`;
    const maskedDest =
      withdrawMethod === 'bank'
        ? `•••• ${withdrawAccount.slice(-4) || '9241'}`
        : withdrawUpiId.trim();

    const newTxn: WalletTransaction = {
      id: `TXN-${Date.now().toString().slice(-6)}`,
      referenceId: refId,
      type: 'withdrawal',
      amount: num,
      currency: activeCurrency.code,
      status: 'processing',
      paymentMethod:
        withdrawMethod === 'bank'
          ? 'Bank Transfer (IMPS Payout)'
          : 'Verified UPI Payout',
      createdAt: 'Just now',
      description: `Payout Request to ${maskedDest}`,
      destinationAccount: maskedDest,
    };

    setLastWithdrawTxn(newTxn);
    setWithdrawStep('status');
    if (onWithdrawalRequested) {
      onWithdrawalRequested(newTxn);
    }
  };

  // Filter transactions
  const filteredTransactions = transactionList.filter((t) => {
    if (filterType === 'all') return true;
    if (filterType === 'deposit') return t.type === 'deposit';
    if (filterType === 'withdrawal') return t.type === 'withdrawal';
    if (filterType === 'pending') return t.status === 'pending' || t.status === 'processing';
    return true;
  });

  return (
    <div className="space-y-6 pb-14 max-w-4xl mx-auto">
      {/* Page Header & Configurable Currency Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-black text-zinc-100">
            Account Money Wallet
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-0.5">
            Manage deposit balances, request verified payouts, and audit transaction records.
          </p>
        </div>

        {/* Currency Selector (Configurable display) */}
        <div className="flex items-center gap-2 self-start sm:self-auto bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 shadow-sm">
          <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider">
            Currency:
          </span>
          <select
            id="wallet-currency-select"
            value={activeCurrency.code}
            onChange={handleCurrencySelect}
            className="bg-transparent text-xs font-bold text-amber-400 focus:outline-none cursor-pointer"
          >
            {SUPPORTED_CURRENCIES.map((cur) => (
              <option key={cur.code} value={cur.code} className="bg-zinc-900 text-zinc-100">
                {cur.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Available Balance Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800 p-6 sm:p-8 shadow-2xl">
        <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Active Wallet
              </span>
              <span className="text-xs text-zinc-400 font-mono">
                {user.phoneNumber}
              </span>
            </div>

            <span className="text-xs text-zinc-400 uppercase tracking-wider block mb-1">
              Available Balance
            </span>

            <div className="flex items-baseline gap-2">
              <span className="font-display text-4xl sm:text-5xl font-black text-zinc-100 tabular-nums tracking-tight">
                {formatMoney(balance)}
              </span>
              <span className="font-display text-lg sm:text-xl font-bold text-amber-400">
                {activeCurrency.code}
              </span>
            </div>

            <p className="text-xs text-zinc-400 mt-2 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Available for account operations and payout requests.</span>
            </p>
          </div>

          {/* Action Buttons: Deposit & Withdrawal */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              id="wallet-deposit-btn"
              onClick={handleOpenDeposit}
              className="px-6 py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <ArrowDownLeft className="w-4 h-4 stroke-[2.5]" />
              <span>Deposit</span>
            </button>

            <button
              id="wallet-withdraw-btn"
              onClick={handleOpenWithdrawal}
              className="px-6 py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border border-zinc-700 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <ArrowUpRight className="w-4 h-4 stroke-[2.5] text-amber-400" />
              <span>Withdrawal</span>
            </button>
          </div>
        </div>
      </div>

      {/* Security & Backend Separation Notice */}
      <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex items-start gap-3.5 text-xs text-zinc-400 leading-relaxed">
        <Lock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold text-zinc-200 block">
            Payment Provider & Balance Security Architecture
          </span>
          <p>
            Client applications have zero authority to directly modify the money balance. All balance credits and debits must be executed by trusted backend services following cryptographically signed webhooks from licensed payment gateways.
          </p>
          <p className="text-[11px] text-zinc-500">
            WINORA never stores or collects card CVVs, banking passwords, or payment OTPs in the browser.
          </p>
        </div>
      </div>

      {/* Isolation from Games Notice */}
      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3.5 text-xs text-amber-200/90 leading-relaxed">
        <Layers className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-amber-300 block mb-0.5">
            Strict Separation from Game Engine
          </span>
          This money wallet is architecturally isolated from game simulations, arcade mechanics, and RNG routines. Real-money wagering, casino staking, and gambling payout calculations are strictly forbidden.
        </div>
      </div>

      {/* Transaction History Section */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold text-zinc-100 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>Transaction History</span>
          </h2>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl border border-zinc-800 self-start sm:self-auto text-xs">
            <button
              id="filter-txn-all"
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                filterType === 'all'
                  ? 'bg-amber-500 text-zinc-950'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              All
            </button>
            <button
              id="filter-txn-deposit"
              onClick={() => setFilterType('deposit')}
              className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                filterType === 'deposit'
                  ? 'bg-amber-500 text-zinc-950'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Deposits
            </button>
            <button
              id="filter-txn-withdrawal"
              onClick={() => setFilterType('withdrawal')}
              className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                filterType === 'withdrawal'
                  ? 'bg-amber-500 text-zinc-950'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Withdrawals
            </button>
            <button
              id="filter-txn-pending"
              onClick={() => setFilterType('pending')}
              className={`px-3 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                filterType === 'pending'
                  ? 'bg-amber-500 text-zinc-950'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Pending
            </button>
          </div>
        </div>

        {/* Transactions Table / List */}
        <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl overflow-hidden divide-y divide-zinc-800/80">
          {filteredTransactions.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-xs">
              No transactions found matching this filter.
            </div>
          ) : (
            filteredTransactions.map((entry) => {
              const isDeposit = entry.type === 'deposit';
              const isSuccess = entry.status === 'completed';
              const isPending = entry.status === 'pending' || entry.status === 'processing';

              return (
                <div
                  key={entry.id}
                  id={`txn-row-${entry.id}`}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-zinc-850 transition-colors"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 ${
                        isDeposit
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                          : 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                      }`}
                    >
                      {isDeposit ? (
                        <ArrowDownLeft className="w-4 h-4 stroke-[2.5]" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs sm:text-sm font-bold text-zinc-100 capitalize">
                          {entry.type}: {entry.paymentMethod}
                        </h4>
                        <span
                          className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                            isSuccess
                              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                              : isPending
                              ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                              : 'bg-red-500/15 text-red-400 border-red-500/30'
                          }`}
                        >
                          {entry.status}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-zinc-400 mt-0.5">
                        <span className="font-mono text-zinc-500">
                          Ref: <strong className="text-zinc-300">{entry.referenceId}</strong>
                        </span>
                        <span>•</span>
                        <span>{entry.createdAt}</span>
                        {entry.destinationAccount && (
                          <>
                            <span>•</span>
                            <span className="text-zinc-400 font-mono">
                              Dest: {entry.destinationAccount}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-left sm:text-right shrink-0">
                    <span
                      className={`font-display text-sm sm:text-base font-black tabular-nums block ${
                        isDeposit ? 'text-emerald-400' : 'text-zinc-200'
                      }`}
                    >
                      {isDeposit ? '+' : '-'}
                      {formatMoney(entry.amount, entry.currency)}
                    </span>
                    <span className="text-[10px] text-zinc-500 uppercase font-mono">
                      {entry.currency}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* =================================================================== */}
      {/* DEPOSIT MODAL                                                       */}
      {/* =================================================================== */}
      {modalMode === 'deposit' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              id="close-deposit-modal-btn"
              onClick={handleCloseModal}
              className="absolute top-5 right-5 p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Title */}
            <div className="flex items-center gap-3 mb-5">
              <div className="p-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                <ArrowDownLeft className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400">
                  Fund Account
                </span>
                <h2 className="font-display text-2xl font-bold text-zinc-100">
                  Wallet Deposit
                </h2>
              </div>
            </div>

            {/* Step 1: Deposit Form */}
            {depositStep === 'form' && (
              <form onSubmit={handleProceedDepositConfirm} className="space-y-5">
                {/* Amount Input */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Deposit Amount ({activeCurrency.code})
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-lg">
                      {activeCurrency.symbol}
                    </span>
                    <input
                      id="deposit-amount-input"
                      type="number"
                      min="100"
                      max="100000"
                      step="100"
                      required
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-750 focus:border-amber-500 rounded-xl pl-9 pr-4 py-3 text-lg font-bold text-zinc-100 placeholder-zinc-600 focus:outline-none tabular-nums"
                      placeholder="1000"
                    />
                  </div>
                  {/* Preset Quick-Fill Chips */}
                  <div className="flex flex-wrap gap-2 mt-2.5">
                    {['500', '1000', '2500', '5000', '10000'].map((preset) => (
                      <button
                        type="button"
                        key={preset}
                        onClick={() => setDepositAmount(preset)}
                        className={`text-xs px-3 py-1.5 rounded-lg border font-semibold transition-colors cursor-pointer ${
                          depositAmount === preset
                            ? 'bg-amber-500 text-zinc-950 border-amber-400'
                            : 'bg-zinc-800/80 text-zinc-300 border-zinc-700 hover:bg-zinc-800'
                        }`}
                      >
                        +{activeCurrency.symbol}{preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-2">
                    Select Payment Method
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setDepositMethod('upi')}
                      className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                        depositMethod === 'upi'
                          ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                      }`}
                    >
                      <QrCode className="w-5 h-5 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-xs text-zinc-100">UPI / QR Instant</div>
                        <div className="text-[10px] text-zinc-400">GPay, PhonePe, Paytm</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDepositMethod('card')}
                      className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                        depositMethod === 'card'
                          ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                      }`}
                    >
                      <CreditCard className="w-5 h-5 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-xs text-zinc-100">Debit / Credit Card</div>
                        <div className="text-[10px] text-zinc-400">Visa, Mastercard, RuPay</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDepositMethod('net_banking')}
                      className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                        depositMethod === 'net_banking'
                          ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                      }`}
                    >
                      <Building2 className="w-5 h-5 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-xs text-zinc-100">Net Banking</div>
                        <div className="text-[10px] text-zinc-400">All Major Scheduled Banks</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDepositMethod('wire')}
                      className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all cursor-pointer ${
                        depositMethod === 'wire'
                          ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                      }`}
                    >
                      <Building2 className="w-5 h-5 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-xs text-zinc-100">Direct Bank Wire</div>
                        <div className="text-[10px] text-zinc-400">IMPS / NEFT Settlement</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Gateway Integration Notice */}
                <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-[11px] text-zinc-400 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    WINORA does not process card or payment credentials directly in the browser. You will be routed to a PCI-DSS certified payment aggregator.
                  </span>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="w-1/3 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs cursor-pointer shadow-md shadow-amber-500/20"
                  >
                    Continue to Confirmation
                  </button>
                </div>
              </form>
            )}

            {/* Step 2: Deposit Confirmation */}
            {depositStep === 'confirm' && (
              <div className="space-y-5">
                <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl space-y-3 text-xs">
                  <div className="flex justify-between py-1 border-b border-zinc-850">
                    <span className="text-zinc-400">Deposit Amount:</span>
                    <span className="font-bold text-zinc-100">
                      {formatMoney(parseFloat(depositAmount) || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-zinc-850">
                    <span className="text-zinc-400">Payment Channel:</span>
                    <span className="font-bold text-amber-400 uppercase">
                      {depositMethod}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-zinc-850">
                    <span className="text-zinc-400">Processing Fee:</span>
                    <span className="font-bold text-emerald-400">0.00 (Free)</span>
                  </div>
                  <div className="flex justify-between py-1 text-sm font-black">
                    <span className="text-zinc-300">Total Payable:</span>
                    <span className="text-amber-400">
                      {formatMoney(parseFloat(depositAmount) || 0)}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl text-xs text-amber-300">
                  <strong>Simulated Gateway Flow:</strong> Clicking "Proceed to Payment Gateway" will initiate a verified payment order. Your balance will be credited after the webhook acknowledges payment receipt.
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDepositStep('form')}
                    className="w-1/3 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteDeposit}
                    className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs cursor-pointer shadow-md shadow-amber-500/20"
                  >
                    Proceed to Payment Gateway
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Transaction Status */}
            {depositStep === 'status' && lastDepositTxn && (
              <div className="space-y-5 text-center py-2">
                <div className="w-14 h-14 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center mx-auto">
                  <Clock className="w-7 h-7 animate-spin" />
                </div>

                <div>
                  <h3 className="font-display text-xl font-bold text-zinc-100 mb-1">
                    Deposit Order Initiated
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Reference ID:{' '}
                    <strong className="text-amber-400 font-mono">
                      {lastDepositTxn.referenceId}
                    </strong>
                  </p>
                </div>

                <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl text-left text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Amount:</span>
                    <span className="font-bold text-zinc-100">
                      {formatMoney(lastDepositTxn.amount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Status:</span>
                    <span className="font-bold text-amber-400 uppercase">
                      {lastDepositTxn.status}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Payment Method:</span>
                    <span className="font-bold text-zinc-300">
                      {lastDepositTxn.paymentMethod}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-zinc-500">
                  Transaction recorded in your audit history. As per security regulations, balance adjustments only take effect once confirmed by the external payment gateway.
                </p>

                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs cursor-pointer"
                >
                  Return to Wallet
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* WITHDRAWAL MODAL                                                    */}
      {/* =================================================================== */}
      {modalMode === 'withdrawal' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              id="close-withdraw-modal-btn"
              onClick={handleCloseModal}
              className="absolute top-5 right-5 p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Title */}
            <div className="flex items-center gap-3 mb-5">
              <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
                <ArrowUpRight className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-amber-400">
                  Payout Request
                </span>
                <h2 className="font-display text-2xl font-bold text-zinc-100">
                  Request Withdrawal
                </h2>
              </div>
            </div>

            {withdrawError && (
              <div className="mb-4 p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{withdrawError}</span>
              </div>
            )}

            {/* Step 1: Withdrawal Form */}
            {withdrawStep === 'form' && (
              <form onSubmit={handleProceedWithdrawConfirm} className="space-y-5">
                {/* Available balance reference banner */}
                <div className="p-3.5 bg-zinc-950 border border-zinc-800 rounded-2xl flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Available Balance:</span>
                  <span className="font-display font-black text-base text-zinc-100 tabular-nums">
                    {formatMoney(balance)}
                  </span>
                </div>

                {/* Amount Input */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Withdrawal Amount ({activeCurrency.code})
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-lg">
                      {activeCurrency.symbol}
                    </span>
                    <input
                      id="withdraw-amount-input"
                      type="number"
                      min="100"
                      max={balance}
                      step="50"
                      required
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-750 focus:border-amber-500 rounded-xl pl-9 pr-4 py-3 text-lg font-bold text-zinc-100 placeholder-zinc-600 focus:outline-none tabular-nums"
                      placeholder="500"
                    />
                  </div>
                  {/* Percent Quick-Fill */}
                  <div className="flex gap-2 mt-2">
                    {[
                      { label: '25%', frac: 0.25 },
                      { label: '50%', frac: 0.5 },
                      { label: '100%', frac: 1.0 },
                    ].map((btn) => (
                      <button
                        type="button"
                        key={btn.label}
                        onClick={() =>
                          setWithdrawAmount(Math.floor(balance * btn.frac).toString())
                        }
                        className="text-xs px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-750 text-zinc-300 font-semibold cursor-pointer border border-zinc-700"
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Withdrawal Method Selection */}
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-2">
                    Withdrawal Settlement Method
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setWithdrawMethod('bank')}
                      className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                        withdrawMethod === 'bank'
                          ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                      }`}
                    >
                      <Building2 className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-xs text-zinc-100">Bank Account</div>
                        <div className="text-[10px] text-zinc-400">IMPS / NEFT Settlement</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setWithdrawMethod('upi')}
                      className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all cursor-pointer ${
                        withdrawMethod === 'upi'
                          ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                      }`}
                    >
                      <QrCode className="w-4 h-4 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-xs text-zinc-100">UPI Payout</div>
                        <div className="text-[10px] text-zinc-400">Direct VPA Handle</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Destination Inputs */}
                {withdrawMethod === 'bank' ? (
                  <div className="space-y-3 bg-zinc-950/70 p-3.5 rounded-2xl border border-zinc-800">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1">
                        Bank Account Number
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 5010029482103"
                        value={withdrawAccount}
                        onChange={(e) => setWithdrawAccount(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1">
                        IFSC Code / Bank Routing
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. HDFC0001234"
                        value={withdrawIfsc}
                        onChange={(e) => setWithdrawIfsc(e.target.value.toUpperCase())}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500 uppercase"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="bg-zinc-950/70 p-3.5 rounded-2xl border border-zinc-800">
                    <label className="block text-xs font-semibold text-zinc-300 mb-1">
                      Registered UPI ID (VPA)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. mobile@okhdfcbank or player@upi"
                      value={withdrawUpiId}
                      onChange={(e) => setWithdrawUpiId(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                )}

                {/* Security Note */}
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  Payouts are subject to automated identity verification. Transfers are completed directly to verified accounts matching the mobile account holder.
                </p>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="w-1/3 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs cursor-pointer shadow-md shadow-amber-500/20"
                  >
                    Review Withdrawal
                  </button>
                </div>
              </form>
            )}

            {/* Step 2: Withdrawal Confirmation */}
            {withdrawStep === 'confirm' && (
              <div className="space-y-5">
                <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl space-y-3 text-xs">
                  <div className="flex justify-between py-1 border-b border-zinc-850">
                    <span className="text-zinc-400">Withdrawal Amount:</span>
                    <span className="font-bold text-zinc-100">
                      {formatMoney(parseFloat(withdrawAmount) || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-zinc-850">
                    <span className="text-zinc-400">Settlement Method:</span>
                    <span className="font-bold text-amber-400 uppercase">
                      {withdrawMethod === 'bank' ? 'Bank IMPS' : 'UPI Payout'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-zinc-850">
                    <span className="text-zinc-400">Destination Account:</span>
                    <span className="font-mono font-bold text-zinc-200">
                      {withdrawMethod === 'bank'
                        ? `•••• ${withdrawAccount.slice(-4)}`
                        : withdrawUpiId}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-zinc-850">
                    <span className="text-zinc-400">Settlement Fee:</span>
                    <span className="font-bold text-emerald-400">0.00 (Standard)</span>
                  </div>
                  <div className="flex justify-between py-1 text-sm font-black">
                    <span className="text-zinc-300">Net Transfer:</span>
                    <span className="text-amber-400">
                      {formatMoney(parseFloat(withdrawAmount) || 0)}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl text-xs text-amber-300">
                  <strong>Backend Payout Notice:</strong> This request is transmitted to the settlement server for verification. Direct bank transfers are not processed on the browser client.
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setWithdrawStep('form')}
                    className="w-1/3 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteWithdrawal}
                    className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs cursor-pointer shadow-md shadow-amber-500/20"
                  >
                    Confirm & Submit Payout Request
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Withdrawal Status */}
            {withdrawStep === 'status' && lastWithdrawTxn && (
              <div className="space-y-5 text-center py-2">
                <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-7 h-7" />
                </div>

                <div>
                  <h3 className="font-display text-xl font-bold text-zinc-100 mb-1">
                    Withdrawal Request Submitted
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Reference ID:{' '}
                    <strong className="text-amber-400 font-mono">
                      {lastWithdrawTxn.referenceId}
                    </strong>
                  </p>
                </div>

                <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl text-left text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Amount:</span>
                    <span className="font-bold text-zinc-100">
                      {formatMoney(lastWithdrawTxn.amount)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Status:</span>
                    <span className="font-bold text-amber-400 uppercase">
                      {lastWithdrawTxn.status}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Destination:</span>
                    <span className="font-bold text-zinc-300 font-mono">
                      {lastWithdrawTxn.destinationAccount}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-zinc-500">
                  Your withdrawal request has been queued for verification. Settlement timelines depend on the banking partner (typically within 15–30 minutes).
                </p>

                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs cursor-pointer"
                >
                  Back to Wallet
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
