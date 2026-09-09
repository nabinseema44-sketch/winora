import React, { useState, useEffect, useCallback } from 'react';
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
  FileText,
  BadgeAlert,
  HelpCircle,
  Settings,
} from 'lucide-react';
import {
  UserProfile,
  WalletTransaction,
  NavPage,
  CurrencyConfig,
  SUPPORTED_CURRENCIES,
  WalletDocument,
  WalletAuditRecord,
  DepositInitiateResponse,
  WithdrawalResponse,
  PublicPaymentConfig,
} from '../types.ts';
import { walletBackendApi } from '../services/walletBackendApi.ts';
import { AdminPaymentConfigModal } from '../components/AdminPaymentConfigModal.tsx';

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

type ModalMode = 'none' | 'deposit' | 'withdrawal';

export const WalletPage: React.FC<WalletPageProps> = ({
  user,
  transactions = [],
  ledger = [],
  onNavigate,
  onDepositInitiated,
  onWithdrawalRequested,
  onCurrencyChange,
  onBalanceUpdate,
}) => {
  // Modal state
  const [modalMode, setModalMode] = useState<ModalMode>('none');
  const [showAuditModal, setShowAuditModal] = useState<boolean>(false);
  const [showAdminModal, setShowAdminModal] = useState<boolean>(false);
  const [publicConfig, setPublicConfig] = useState<PublicPaymentConfig | null>(null);

  // Backend authoritative wallet state
  const [backendWallet, setBackendWallet] = useState<WalletDocument | null>(null);
  const [backendTransactions, setBackendTransactions] = useState<WalletTransaction[]>([]);
  const [audits, setAudits] = useState<WalletAuditRecord[]>([]);
  const [isLoadingBackend, setIsLoadingBackend] = useState<boolean>(false);
  const [backendError, setBackendError] = useState<string | null>(null);

  // Filter state for Transaction History
  const [filterType, setFilterType] = useState<'all' | 'deposit' | 'withdrawal' | 'pending'>('all');

  // Active currency
  const activeCurrency: CurrencyConfig = user?.currency || SUPPORTED_CURRENCIES[0];

  // Deposit Form State
  const [depositAmount, setDepositAmount] = useState<string>('1000');
  const [depositMethod, setDepositMethod] = useState<'upi' | 'card' | 'net_banking' | 'wire'>('upi');
  const [depositStep, setDepositStep] = useState<'form' | 'confirm' | 'status'>('form');
  const [depositSubmitting, setDepositSubmitting] = useState<boolean>(false);
  const [depositResult, setDepositResult] = useState<DepositInitiateResponse | null>(null);
  const [depositSimulating, setDepositSimulating] = useState<boolean>(false);

  // Withdrawal Form State
  const [withdrawAmount, setWithdrawAmount] = useState<string>('500');
  const [withdrawMethod, setWithdrawMethod] = useState<'bank' | 'upi'>('bank');
  const [withdrawAccount, setWithdrawAccount] = useState<string>('');
  const [withdrawIfsc, setWithdrawIfsc] = useState<string>('');
  const [withdrawUpiId, setWithdrawUpiId] = useState<string>('');
  const [withdrawStep, setWithdrawStep] = useState<'form' | 'confirm' | 'status'>('form');
  const [withdrawSubmitting, setWithdrawSubmitting] = useState<boolean>(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawResult, setWithdrawResult] = useState<WithdrawalResponse | null>(null);
  const [withdrawSimulating, setWithdrawSimulating] = useState<boolean>(false);

  const userId = user?.id || 'demo-player-uid-123';

  // Synchronize with backend wallet
  const fetchWalletData = useCallback(async () => {
    if (!user) return;
    setIsLoadingBackend(true);
    setBackendError(null);
    try {
      const [walletData, txnData, auditData, pubConfig] = await Promise.all([
        walletBackendApi.getWallet(userId),
        walletBackendApi.getTransactions(userId),
        walletBackendApi.getAudits(userId),
        walletBackendApi.getPublicPaymentConfig().catch(() => null),
      ]);

      setBackendWallet(walletData);
      setBackendTransactions(txnData);
      setAudits(auditData);
      if (pubConfig) setPublicConfig(pubConfig);

      if (onBalanceUpdate && typeof walletData.balance === 'number') {
        onBalanceUpdate(walletData.balance);
      }
    } catch (err: any) {
      console.warn('[WalletPage] Backend sync fallback:', err.message);
      setBackendError(err.message);
    } finally {
      setIsLoadingBackend(false);
    }
  }, [user, userId, onBalanceUpdate]);

  useEffect(() => {
    fetchWalletData();
  }, [fetchWalletData]);

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

  // Authoritative calculations
  const totalBalance = backendWallet ? backendWallet.balance : user.walletBalance ?? 0;
  const heldBalance = backendWallet ? backendWallet.heldBalance : 0;
  const availableBalance = backendWallet ? backendWallet.availableBalance : Math.max(0, totalBalance - heldBalance);
  const kycStatus = backendWallet?.kycStatus || 'verified';
  const withdrawalEligibility = backendWallet?.withdrawalEligibility ?? true;

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

  // Open Deposit Flow (Navigates to dedicated configurable Deposit Page)
  const handleOpenDeposit = () => {
    if (onNavigate) {
      onNavigate('deposit');
      return;
    }
    setDepositAmount('1000');
    setDepositMethod('upi');
    setDepositStep('form');
    setDepositResult(null);
    setModalMode('deposit');
  };

  // Open Withdrawal Modal
  const handleOpenWithdrawal = () => {
    if (publicConfig && !publicConfig.withdrawalEnabled) {
      alert('Withdrawal service is currently unavailable. Please try again later.');
      return;
    }
    setWithdrawAmount(Math.min(500, Math.floor(availableBalance)).toString());
    setWithdrawMethod('bank');
    setWithdrawStep('form');
    setWithdrawError(null);
    setWithdrawResult(null);
    setModalMode('withdrawal');
  };

  // Close modals
  const handleCloseModal = () => {
    setModalMode('none');
    setDepositStep('form');
    setWithdrawStep('form');
    fetchWalletData();
  };

  // Step 1 -> Step 2 (Deposit Confirmation)
  const handleProceedDepositConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(depositAmount);
    if (isNaN(num) || num <= 0) return;
    setDepositStep('confirm');
  };

  // Step 2 -> Step 3 (Execute Deposit via Server Backend)
  const handleExecuteDeposit = async () => {
    const num = parseFloat(depositAmount);
    setDepositSubmitting(true);
    try {
      const response = await walletBackendApi.initiateDeposit({
        uid: userId,
        amount: num,
        currency: activeCurrency.code,
        paymentMethod:
          depositMethod === 'upi'
            ? 'UPI Instant (GPay / PhonePe / QR)'
            : depositMethod === 'card'
            ? 'Debit / Credit Card'
            : depositMethod === 'net_banking'
            ? 'Net Banking'
            : 'Bank Wire',
      });

      setDepositResult(response);
      setDepositStep('status');

      // Sync optimistic transaction representation
      const newTxn: WalletTransaction = {
        id: response.transactionId,
        referenceId: response.providerReference,
        transactionId: response.transactionId,
        uid: userId,
        type: 'deposit',
        amount: response.amount,
        currency: response.currency,
        status: 'pending',
        paymentMethod: response.paymentMethod,
        createdAt: 'Just now',
        description: 'Account Wallet Deposit (Awaiting Gateway Settlement)',
      };

      if (onDepositInitiated) {
        onDepositInitiated(newTxn);
      }
      fetchWalletData();
    } catch (err: any) {
      alert(`Deposit initiation failed: ${err.message}`);
    } finally {
      setDepositSubmitting(false);
    }
  };

  // Sandbox Webhook Simulator for Deposit
  const handleSimulateDepositWebhook = async (action: 'confirm_payment' | 'decline_payment') => {
    if (!depositResult?.transactionId) return;
    setDepositSimulating(true);
    try {
      await walletBackendApi.simulateSandboxWebhook(depositResult.transactionId, action);
      await fetchWalletData();
      alert(
        action === 'confirm_payment'
          ? 'Gateway Webhook Verified: Payment captured and balance credited to wallet.'
          : 'Gateway Webhook Received: Payment failed. Balance remains unchanged.'
      );
      handleCloseModal();
    } catch (err: any) {
      alert(`Simulation error: ${err.message}`);
    } finally {
      setDepositSimulating(false);
    }
  };

  // Step 1 -> Step 2 (Withdrawal Confirmation)
  const handleProceedWithdrawConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(withdrawAmount);
    if (isNaN(num) || num <= 0) {
      setWithdrawError('Please enter a valid withdrawal amount.');
      return;
    }
    if (num > availableBalance) {
      setWithdrawError(`Insufficient funds. Your available balance is ${formatMoney(availableBalance)} (Held: ${formatMoney(heldBalance)}).`);
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

  // Step 2 -> Step 3 (Execute Withdrawal Request via Server Backend)
  const handleExecuteWithdrawal = async () => {
    const num = parseFloat(withdrawAmount);
    const dest = withdrawMethod === 'bank' ? withdrawAccount.trim() : withdrawUpiId.trim();

    setWithdrawSubmitting(true);
    try {
      const response = await walletBackendApi.requestWithdrawal({
        uid: userId,
        amount: num,
        currency: activeCurrency.code,
        destinationAccount: dest,
        payoutMethod: withdrawMethod === 'bank' ? 'bank' : 'upi',
      });

      setWithdrawResult(response);
      setWithdrawStep('status');

      const newTxn: WalletTransaction = {
        id: response.transactionId,
        referenceId: response.providerReference,
        transactionId: response.transactionId,
        uid: userId,
        type: 'withdrawal',
        amount: response.amount,
        currency: response.currency,
        status: 'pending',
        paymentMethod: withdrawMethod === 'bank' ? 'Bank Transfer (IMPS Payout)' : 'Verified UPI Payout',
        createdAt: 'Just now',
        description: `Payout Request to ${dest}`,
        destinationAccount: dest,
      };

      if (onWithdrawalRequested) {
        onWithdrawalRequested(newTxn);
      }
      fetchWalletData();
    } catch (err: any) {
      setWithdrawError(err.message || 'Withdrawal request rejected by server.');
      setWithdrawStep('form');
    } finally {
      setWithdrawSubmitting(false);
    }
  };

  // Sandbox Webhook Simulator for Withdrawal
  const handleSimulateWithdrawalSettlement = async (action: 'confirm_payout' | 'decline_payout') => {
    if (!withdrawResult?.transactionId) return;
    setWithdrawSimulating(true);
    try {
      await walletBackendApi.simulateSandboxWebhook(withdrawResult.transactionId, action);
      await fetchWalletData();
      alert(
        action === 'confirm_payout'
          ? 'Payout Settled: Bank confirmed transfer. Hold released and balance debited.'
          : 'Payout Declined: Bank rejected transfer. Held balance released back to available.'
      );
      handleCloseModal();
    } catch (err: any) {
      alert(`Simulation error: ${err.message}`);
    } finally {
      setWithdrawSimulating(false);
    }
  };

  // Combined transactions list (backend records prioritized)
  const transactionList = backendTransactions.length > 0 ? backendTransactions : (transactions.length > 0 ? transactions : ledger);

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
      {/* Page Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-black text-zinc-100">
            Account Wallet
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Server-authoritative money balance, compliant settlement flows, and immutable audit trails.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="wallet-admin-config-btn"
            onClick={() => setShowAdminModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-300 hover:text-amber-400 hover:border-zinc-700 transition-colors cursor-pointer shadow-sm"
            title="Configure Payment Provider Link"
          >
            <Settings className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Admin Config</span>
          </button>

          <button
            id="wallet-audit-trail-btn"
            onClick={() => setShowAuditModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-300 hover:text-amber-400 hover:border-zinc-700 transition-colors cursor-pointer shadow-sm"
          >
            <FileText className="w-3.5 h-3.5 text-amber-400" />
            <span>Audit Trail</span>
          </button>

          <button
            id="wallet-refresh-btn"
            onClick={fetchWalletData}
            disabled={isLoadingBackend}
            className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
            title="Refresh authoritative balance"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingBackend ? 'animate-spin text-amber-400' : ''}`} />
          </button>

          {/* Currency selector */}
          <div className="flex items-center gap-2 bg-zinc-900/90 border border-zinc-800 px-3 py-1.5 rounded-xl">
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
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
      </div>

      {/* Main Balance & Protection Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800 p-6 sm:p-8 shadow-2xl">
        <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Backend Authoritative
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                Deposit: {publicConfig?.depositEnabled ? (publicConfig?.depositUrlConfigured ? 'Configured' : 'Unconfigured Link') : 'Unavailable'}
              </span>
              {publicConfig?.withdrawalEnabled && (
                <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  Payouts Active
                </span>
              )}
            </div>

            <span className="text-xs text-zinc-400 uppercase tracking-wider block mb-1">
              Available Balance
            </span>

            <div className="flex items-baseline gap-2">
              <span className="font-display text-4xl sm:text-5xl font-black text-zinc-100 tabular-nums tracking-tight">
                {formatMoney(availableBalance)}
              </span>
              <span className="font-display text-lg sm:text-xl font-bold text-amber-400">
                {activeCurrency.code}
              </span>
            </div>

            {/* Held funds breakdown if active */}
            {heldBalance > 0 && (
              <div className="mt-3 flex items-center gap-2 text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-xl w-fit">
                <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Reserved on Hold for Pending Payout: <strong>{formatMoney(heldBalance)}</strong></span>
                <span className="text-zinc-500">|</span>
                <span className="text-zinc-400">Total Account Value: {formatMoney(totalBalance)}</span>
              </div>
            )}

            <p className="text-xs text-zinc-400 mt-2 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Balance mutations are strictly executed on the server following cryptographic webhook verification.</span>
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
              disabled={availableBalance <= 0 || !withdrawalEligibility}
              className={`px-6 py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider border active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 ${
                availableBalance > 0 && withdrawalEligibility
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border-zinc-700'
                  : 'bg-zinc-900 text-zinc-500 border-zinc-800 cursor-not-allowed'
              }`}
            >
              <ArrowUpRight className="w-4 h-4 stroke-[2.5] text-amber-400" />
              <span>Withdrawal</span>
            </button>
          </div>
        </div>
      </div>

      {/* Security & Idempotency Architecture Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex items-start gap-3.5 text-xs text-zinc-400 leading-relaxed">
          <Lock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-zinc-200 block">
              Server-Authoritative Balances & Idempotency
            </span>
            <p>
              Client applications cannot mutate balances or write completed transactions. Webhook deliveries use HMAC-SHA256 signature verification and server-side idempotency tracking to prevent double crediting.
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3.5 text-xs text-amber-200/90 leading-relaxed">
          <Layers className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-amber-300 block">
              Strict Separation from Game Mechanics
            </span>
            <p>
              This money wallet is strictly decoupled from gaming simulations, stakes, and RNG routines. Real-money wagering, game betting, and gambling payouts are strictly forbidden.
            </p>
          </div>
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
                        {entry.auditReference && (
                          <>
                            <span>•</span>
                            <span className="text-emerald-400/80 font-mono">
                              Audit: {entry.auditReference}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-left sm:text-right shrink-0">
                    <span
                      className={`font-mono text-sm font-bold block tabular-nums ${
                        isDeposit ? 'text-emerald-400' : 'text-zinc-200'
                      }`}
                    >
                      {isDeposit ? '+' : '-'}
                      {formatMoney(entry.amount, entry.currency || activeCurrency.code)}
                    </span>
                    <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                      {entry.currency || activeCurrency.code}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DEPOSIT MODAL                                                             */}
      {/* ========================================================================= */}
      {modalMode === 'deposit' && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-7 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <button
              id="deposit-modal-close-btn"
              onClick={handleCloseModal}
              className="absolute right-5 top-5 p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {depositStep === 'form' && (
              <form onSubmit={handleProceedDepositConfirm} className="space-y-5">
                <div>
                  <h3 className="font-display text-lg font-bold text-zinc-100 flex items-center gap-2">
                    <ArrowDownLeft className="w-5 h-5 text-emerald-400" />
                    <span>Deposit Funds</span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Select an authorized payment method. All deposits are verified via server webhook before crediting your balance.
                  </p>
                </div>

                {/* Amount presets */}
                <div>
                  <label className="text-xs text-zinc-400 font-semibold uppercase tracking-wider block mb-2">
                    Select Amount ({activeCurrency.code})
                  </label>
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {[500, 1000, 2500, 5000].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setDepositAmount(amt.toString())}
                        className={`py-2 rounded-xl text-xs font-bold font-mono transition-colors cursor-pointer border ${
                          depositAmount === amt.toString()
                            ? 'bg-amber-500 text-zinc-950 border-amber-400'
                            : 'bg-zinc-800/80 hover:bg-zinc-800 text-zinc-200 border-zinc-700'
                        }`}
                      >
                        {formatMoney(amt)}
                      </button>
                    ))}
                  </div>

                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-sm">
                      {activeCurrency.symbol}
                    </span>
                    <input
                      id="deposit-amount-input"
                      type="number"
                      min="100"
                      max="100000"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="Custom amount (min 100)"
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl pl-8 pr-4 py-2.5 text-zinc-100 font-mono text-sm focus:outline-none focus:border-amber-500"
                      required
                    />
                  </div>
                </div>

                {/* Payment Method Selector */}
                <div>
                  <label className="text-xs text-zinc-400 font-semibold uppercase tracking-wider block mb-2">
                    Payment Gateway Method
                  </label>
                  <div className="space-y-2">
                    {[
                      { id: 'upi', label: 'UPI Instant (GPay / PhonePe / Paytm / QR)', desc: 'Zero gateway processing fees', icon: QrCode },
                      { id: 'card', label: 'Debit & Credit Cards (Visa / Mastercard / RuPay)', desc: 'Bank 3D Secure 2.0 Auth', icon: CreditCard },
                      { id: 'net_banking', label: 'Net Banking (Top 50+ Banks)', desc: 'Instant gateway redirect', icon: Building2 },
                      { id: 'wire', label: 'Direct Bank Transfer (IMPS / NEFT)', desc: 'Corporate virtual account', icon: Building2 },
                    ].map((method) => {
                      const Icon = method.icon;
                      const isSelected = depositMethod === method.id;
                      return (
                        <div
                          key={method.id}
                          onClick={() => setDepositMethod(method.id as any)}
                          className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-amber-500/10 border-amber-500/50'
                              : 'bg-zinc-800/50 border-zinc-700 hover:bg-zinc-800'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <Icon className={`w-4 h-4 ${isSelected ? 'text-amber-400' : 'text-zinc-400'}`} />
                            <div>
                              <div className="text-xs font-bold text-zinc-100">{method.label}</div>
                              <div className="text-[10px] text-zinc-400">{method.desc}</div>
                            </div>
                          </div>
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isSelected ? 'border-amber-400 bg-amber-500' : 'border-zinc-600'}`}>
                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-zinc-950" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button
                  id="deposit-proceed-confirm-btn"
                  type="submit"
                  className="w-full py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Continue to Confirmation</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </form>
            )}

            {depositStep === 'confirm' && (
              <div className="space-y-5">
                <div>
                  <h3 className="font-display text-lg font-bold text-zinc-100">
                    Confirm Deposit Request
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Please review transaction specifications before initiating the order.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Deposit Amount</span>
                    <span className="font-bold text-zinc-100 font-mono text-sm">
                      {formatMoney(parseFloat(depositAmount))}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Payment Channel</span>
                    <span className="font-bold text-zinc-200 capitalize">{depositMethod}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Processing Fee</span>
                    <span className="font-bold text-emerald-400">Free (0.00)</span>
                  </div>
                  <div className="border-t border-zinc-800 pt-2 flex justify-between">
                    <span className="text-zinc-300 font-bold">Total Payable</span>
                    <span className="font-bold text-amber-400 font-mono text-base">
                      {formatMoney(parseFloat(depositAmount))}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-zinc-800/60 border border-zinc-700/80 text-[11px] text-zinc-300 leading-relaxed flex items-start gap-2.5">
                  <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Security Notice:</strong> WINORA will register a pending order on the backend. Your balance will be credited solely after our server verifies the payment provider’s cryptographically signed webhook.
                  </span>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setDepositStep('form')}
                    className="flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-wider bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    id="deposit-execute-btn"
                    type="button"
                    onClick={handleExecuteDeposit}
                    disabled={depositSubmitting}
                    className="flex-2 py-3 rounded-xl font-bold text-xs uppercase tracking-wider bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {depositSubmitting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Register Deposit Order</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {depositStep === 'status' && depositResult && (
              <div className="space-y-5 text-center py-2">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
                  <Clock className="w-7 h-7 animate-pulse" />
                </div>

                <div>
                  <h3 className="font-display text-lg font-bold text-zinc-100">
                    Deposit Order Registered (Pending)
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
                    {depositResult.instructions}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 text-xs text-left space-y-2">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Transaction ID:</span>
                    <span className="font-mono text-zinc-300 font-bold">{depositResult.transactionId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Provider Order Reference:</span>
                    <span className="font-mono text-amber-400 font-bold">{depositResult.providerReference}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Amount:</span>
                    <span className="font-mono text-zinc-100 font-bold">{formatMoney(depositResult.amount, depositResult.currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Current Status:</span>
                    <span className="font-bold text-amber-400 uppercase tracking-wider text-[11px]">PENDING (Awaiting Webhook)</span>
                  </div>
                </div>

                {/* Sandbox Webhook Simulation Panel */}
                <div className="p-4 rounded-2xl bg-zinc-800/80 border border-amber-500/30 text-left space-y-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-zinc-200">Sandbox Payment Verification Simulator</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Test the secure backend webhook flow. The server will cryptographically verify the provider webhook and update the balance only upon confirmation.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <button
                      id="simulate-deposit-success-btn"
                      onClick={() => handleSimulateDepositWebhook('confirm_payment')}
                      disabled={depositSimulating}
                      className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs rounded-xl transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      {depositSimulating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      <span>Simulate Webhook Confirmation</span>
                    </button>

                    <button
                      id="simulate-deposit-fail-btn"
                      onClick={() => handleSimulateDepositWebhook('decline_payment')}
                      disabled={depositSimulating}
                      className="flex-1 py-2.5 px-3 bg-zinc-800 hover:bg-zinc-700 text-red-400 border border-red-500/30 font-bold text-xs rounded-xl transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Simulate Webhook Decline</span>
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleCloseModal}
                  className="w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 cursor-pointer"
                >
                  Return to Wallet
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* WITHDRAWAL MODAL                                                          */}
      {/* ========================================================================= */}
      {modalMode === 'withdrawal' && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-7 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            <button
              id="withdrawal-modal-close-btn"
              onClick={handleCloseModal}
              className="absolute right-5 top-5 p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {withdrawStep === 'form' && (
              <form onSubmit={handleProceedWithdrawConfirm} className="space-y-5">
                <div>
                  <h3 className="font-display text-lg font-bold text-zinc-100 flex items-center gap-2">
                    <ArrowUpRight className="w-5 h-5 text-amber-400" />
                    <span>Request Payout / Withdrawal</span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Withdraw available funds directly to your verified bank account or UPI ID.
                  </p>
                </div>

                {withdrawError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{withdrawError}</span>
                  </div>
                )}

                {/* Available Balance pill */}
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex justify-between items-center text-xs">
                  <span className="text-zinc-400">Available to Withdraw:</span>
                  <span className="font-bold text-zinc-100 font-mono text-sm">
                    {formatMoney(availableBalance)}
                  </span>
                </div>

                {/* Amount input */}
                <div>
                  <label className="text-xs text-zinc-400 font-semibold uppercase tracking-wider block mb-2">
                    Withdrawal Amount ({activeCurrency.code})
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-sm">
                      {activeCurrency.symbol}
                    </span>
                    <input
                      id="withdraw-amount-input"
                      type="number"
                      min="100"
                      max={availableBalance}
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="Minimum 100"
                      className="w-full bg-zinc-950 border border-zinc-700 rounded-xl pl-8 pr-4 py-2.5 text-zinc-100 font-mono text-sm focus:outline-none focus:border-amber-500"
                      required
                    />
                  </div>
                </div>

                {/* Method selector */}
                <div>
                  <label className="text-xs text-zinc-400 font-semibold uppercase tracking-wider block mb-2">
                    Payout Method
                  </label>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <button
                      type="button"
                      onClick={() => setWithdrawMethod('bank')}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-colors ${
                        withdrawMethod === 'bank'
                          ? 'bg-amber-500/10 border-amber-500/50'
                          : 'bg-zinc-800/40 border-zinc-700 hover:bg-zinc-800'
                      }`}
                    >
                      <Building2 className={`w-4 h-4 mb-1.5 ${withdrawMethod === 'bank' ? 'text-amber-400' : 'text-zinc-400'}`} />
                      <div className="text-xs font-bold text-zinc-100">Bank Transfer</div>
                      <div className="text-[10px] text-zinc-400">Direct IMPS / NEFT</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setWithdrawMethod('upi')}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-colors ${
                        withdrawMethod === 'upi'
                          ? 'bg-amber-500/10 border-amber-500/50'
                          : 'bg-zinc-800/40 border-zinc-700 hover:bg-zinc-800'
                      }`}
                    >
                      <QrCode className={`w-4 h-4 mb-1.5 ${withdrawMethod === 'upi' ? 'text-amber-400' : 'text-zinc-400'}`} />
                      <div className="text-xs font-bold text-zinc-100">UPI Instant</div>
                      <div className="text-[10px] text-zinc-400">VPA Settlement</div>
                    </button>
                  </div>

                  {withdrawMethod === 'bank' ? (
                    <div className="space-y-3">
                      <div>
                        <label className="text-[11px] text-zinc-400 block mb-1">Bank Account Number</label>
                        <input
                          id="withdraw-bank-account-input"
                          type="text"
                          value={withdrawAccount}
                          onChange={(e) => setWithdrawAccount(e.target.value)}
                          placeholder="e.g. 9876543210123"
                          className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-zinc-100 text-xs font-mono focus:outline-none focus:border-amber-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-zinc-400 block mb-1">Bank IFSC Code</label>
                        <input
                          id="withdraw-bank-ifsc-input"
                          type="text"
                          value={withdrawIfsc}
                          onChange={(e) => setWithdrawIfsc(e.target.value.toUpperCase())}
                          placeholder="e.g. HDFC0001234"
                          className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-zinc-100 text-xs font-mono uppercase focus:outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="text-[11px] text-zinc-400 block mb-1">Destination UPI VPA ID</label>
                      <input
                        id="withdraw-upi-id-input"
                        type="text"
                        value={withdrawUpiId}
                        onChange={(e) => setWithdrawUpiId(e.target.value)}
                        placeholder="e.g. player@okhdfcbank"
                        className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3.5 py-2.5 text-zinc-100 text-xs font-mono focus:outline-none focus:border-amber-500"
                        required
                      />
                    </div>
                  )}
                </div>

                <button
                  id="withdraw-proceed-confirm-btn"
                  type="submit"
                  className="w-full py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Review Payout Request</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </form>
            )}

            {withdrawStep === 'confirm' && (
              <div className="space-y-5">
                <div>
                  <h3 className="font-display text-lg font-bold text-zinc-100">
                    Confirm Withdrawal Payout
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Funds will be reserved on secure hold to protect against double withdrawal.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-3 text-xs">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Withdrawal Amount</span>
                    <span className="font-bold text-zinc-100 font-mono text-sm">
                      {formatMoney(parseFloat(withdrawAmount))}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Payout Method</span>
                    <span className="font-bold text-zinc-200 capitalize">
                      {withdrawMethod === 'bank' ? 'Bank Transfer (IMPS)' : 'UPI Instant'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Destination</span>
                    <span className="font-bold text-amber-400 font-mono">
                      {withdrawMethod === 'bank'
                        ? `•••• ${withdrawAccount.slice(-4) || '9241'}`
                        : withdrawUpiId}
                    </span>
                  </div>
                  <div className="border-t border-zinc-800 pt-2 flex justify-between">
                    <span className="text-zinc-300 font-bold">Post-Hold Available</span>
                    <span className="font-bold text-zinc-300 font-mono text-sm">
                      {formatMoney(Math.max(0, availableBalance - parseFloat(withdrawAmount)))}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200/90 leading-relaxed flex items-start gap-2.5">
                  <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>Hold Protection:</strong> {formatMoney(parseFloat(withdrawAmount))} will be placed on reservation hold. If the banking network rejects or cancels the transfer, the hold will automatically release back to your available balance.
                  </span>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setWithdrawStep('form')}
                    className="flex-1 py-3 rounded-xl font-bold text-xs uppercase tracking-wider bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    id="withdraw-execute-btn"
                    type="button"
                    onClick={handleExecuteWithdrawal}
                    disabled={withdrawSubmitting}
                    className="flex-2 py-3 rounded-xl font-bold text-xs uppercase tracking-wider bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {withdrawSubmitting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Submit Payout Request</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {withdrawStep === 'status' && withdrawResult && (
              <div className="space-y-5 text-center py-2">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto">
                  <Clock className="w-7 h-7 animate-pulse" />
                </div>

                <div>
                  <h3 className="font-display text-lg font-bold text-zinc-100">
                    Withdrawal Registered & Funds Held
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
                    {withdrawResult.message}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 text-xs text-left space-y-2">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Transaction ID:</span>
                    <span className="font-mono text-zinc-300 font-bold">{withdrawResult.transactionId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Payout Reference:</span>
                    <span className="font-mono text-amber-400 font-bold">{withdrawResult.providerReference}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Amount on Hold:</span>
                    <span className="font-mono text-zinc-100 font-bold">{formatMoney(withdrawResult.amount, withdrawResult.currency)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Remaining Available Balance:</span>
                    <span className="font-mono text-emerald-400 font-bold">{formatMoney(withdrawResult.availableBalance, withdrawResult.currency)}</span>
                  </div>
                </div>

                {/* Sandbox Settlement Simulator */}
                <div className="p-4 rounded-2xl bg-zinc-800/80 border border-amber-500/30 text-left space-y-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-zinc-200">Sandbox Settlement Simulator</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Test payout finalization. Confirming releases the hold and debits the balance. Declining releases the hold back to available funds.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <button
                      id="simulate-withdraw-success-btn"
                      onClick={() => handleSimulateWithdrawalSettlement('confirm_payout')}
                      disabled={withdrawSimulating}
                      className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-bold text-xs rounded-xl transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      {withdrawSimulating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      <span>Simulate Bank Confirmation</span>
                    </button>

                    <button
                      id="simulate-withdraw-fail-btn"
                      onClick={() => handleSimulateWithdrawalSettlement('decline_payout')}
                      disabled={withdrawSimulating}
                      className="flex-1 py-2.5 px-3 bg-zinc-800 hover:bg-zinc-700 text-red-400 border border-red-500/30 font-bold text-xs rounded-xl transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Simulate Payout Reversal</span>
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleCloseModal}
                  className="w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 cursor-pointer"
                >
                  Return to Wallet
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* IMMUTABLE AUDIT TRAIL MODAL                                               */}
      {/* ========================================================================= */}
      {showAuditModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-7 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <div>
                <h3 className="font-display text-lg font-bold text-zinc-100 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-400" />
                  <span>Immutable Financial Audit Records</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Server-generated audit trail logging every balance mutation with previous/new balances.
                </p>
              </div>
              <button
                onClick={() => setShowAuditModal(false)}
                className="p-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto py-4 space-y-3 flex-1 divide-y divide-zinc-800/80">
              {audits.length === 0 ? (
                <div className="text-center py-10 text-xs text-zinc-500">
                  No balance mutation records logged yet.
                </div>
              ) : (
                audits.map((a) => (
                  <div key={a.auditId} className="pt-3 first:pt-0 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-zinc-400 font-bold">{a.auditId}</span>
                      <span className="text-[10px] text-zinc-500 font-mono">{new Date(a.timestamp).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="capitalize font-semibold text-zinc-200">
                        {a.operation.replace(/_/g, ' ')}
                      </span>
                      <span className="font-mono font-bold text-amber-400">
                        Amount: {formatMoney(a.amount)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-zinc-400 bg-zinc-950 px-3 py-1.5 rounded-xl">
                      <span>Prev: {formatMoney(a.previousBalance)}</span>
                      <span>➔</span>
                      <span className="text-zinc-200 font-bold">New: {formatMoney(a.newBalance)}</span>
                      <span className="text-zinc-500 font-mono text-[10px]">Src: {a.sourceReference}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-4 border-t border-zinc-800 text-right">
              <button
                onClick={() => setShowAuditModal(false)}
                className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs rounded-xl border border-zinc-700 transition-colors cursor-pointer"
              >
                Close Audit Viewer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Payment Configuration Modal */}
      <AdminPaymentConfigModal
        isOpen={showAdminModal}
        onClose={() => setShowAdminModal(false)}
        onConfigUpdated={() => {
          fetchWalletData();
        }}
      />
    </div>
  );
};
