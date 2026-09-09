import React, { useState, useEffect } from 'react';
import {
  ArrowDownLeft,
  ArrowLeft,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  Clock,
  CheckCircle2,
  XCircle,
  Settings,
  Filter,
  RefreshCw,
  Info,
  Lock,
  Search,
} from 'lucide-react';
import {
  UserProfile,
  WalletTransaction,
  PublicPaymentConfig,
  NavPage,
  CurrencyConfig,
} from '../types.ts';
import { walletBackendApi } from '../services/walletBackendApi.ts';
import { AdminPaymentConfigModal } from '../components/AdminPaymentConfigModal.tsx';

interface DepositPageProps {
  user: UserProfile;
  transactions: WalletTransaction[];
  onNavigate: (page: NavPage) => void;
  onBalanceUpdate?: (newBalance: number) => void;
}

export const DepositPage: React.FC<DepositPageProps> = ({
  user,
  transactions: initialTransactions,
  onNavigate,
  onBalanceUpdate,
}) => {
  // Config & Data state
  const [publicConfig, setPublicConfig] = useState<PublicPaymentConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [transactions, setTransactions] = useState<WalletTransaction[]>(initialTransactions);
  const [loadingTxns, setLoadingTxns] = useState(false);

  // Form State
  const [amount, setAmount] = useState<number>(1000);
  const [customAmount, setCustomAmount] = useState<string>('1000');
  const [initiating, setInitiating] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);

  // Active Transaction Status State
  const [activeDeposit, setActiveDeposit] = useState<{
    transactionId: string;
    providerReference: string;
    amount: number;
    currency: string;
    status: string;
    destinationUrl?: string;
    depositUrl?: string;
    instructions: string;
  } | null>(null);

  const [simulating, setSimulating] = useState(false);
  const [simMessage, setSimMessage] = useState<string | null>(null);

  // Filter & Search for History
  const [historyFilter, setHistoryFilter] = useState<'all' | 'deposit' | 'withdrawal' | 'pending'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Admin Modal
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

  const currencySymbol = user.currency?.symbol || '₹';
  const currencyCode = user.currency?.code || 'INR';

  // Quick preset amounts
  const presetAmounts = [500, 1000, 2500, 5000, 10000];

  useEffect(() => {
    loadPublicConfig();
    fetchTransactions();
  }, [user.id]);

  const loadPublicConfig = async () => {
    setConfigLoading(true);
    try {
      const config = await walletBackendApi.getPublicPaymentConfig();
      setPublicConfig(config);
    } catch (err: any) {
      console.error('Failed to load payment configuration', err);
    } finally {
      setConfigLoading(false);
    }
  };

  const fetchTransactions = async () => {
    setLoadingTxns(true);
    try {
      const list = await walletBackendApi.getTransactions(user.id);
      setTransactions(list);
    } catch (err) {
      console.error('Failed to fetch transactions', err);
    } finally {
      setLoadingTxns(false);
    }
  };

  const handlePresetSelect = (val: number) => {
    setAmount(val);
    setCustomAmount(String(val));
    setDepositError(null);
  };

  const handleCustomAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomAmount(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed > 0) {
      setAmount(parsed);
      setDepositError(null);
    }
  };

  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDepositError(null);
    setSimMessage(null);

    if (!publicConfig?.depositUrlConfigured || !publicConfig?.depositEnabled) {
      setDepositError('Deposit service is currently unavailable. Please try again later.');
      return;
    }

    if (!amount || amount < (publicConfig.depositMinAmount || 100)) {
      setDepositError(`Minimum deposit amount is ${currencySymbol}${(publicConfig.depositMinAmount || 100).toLocaleString()}.`);
      return;
    }

    if (amount > (publicConfig.depositMaxAmount || 100000)) {
      setDepositError(`Maximum single deposit limit is ${currencySymbol}${(publicConfig.depositMaxAmount || 100000).toLocaleString()}.`);
      return;
    }

    setInitiating(true);
    try {
      const response = await walletBackendApi.initiateDeposit({
        uid: user.id,
        amount,
        currency: currencyCode,
        paymentMethod: 'Configured External Provider',
      });

      // Destination URL configured by admin
      const targetUrl = (response as any).destinationUrl || (response as any).depositUrl || publicConfig.depositUrl;

      // Register active transaction state
      setActiveDeposit({
        transactionId: response.transactionId,
        providerReference: response.providerReference,
        amount: response.amount,
        currency: response.currency,
        status: 'pending',
        destinationUrl: targetUrl,
        depositUrl: (response as any).depositUrl,
        instructions: response.instructions,
      });

      // Safely open the configured destination payment link
      if (targetUrl) {
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
      }

      // Refresh transactions
      fetchTransactions();
    } catch (err: any) {
      setDepositError(err.message || 'Deposit service is currently unavailable. Please try again later.');
    } finally {
      setInitiating(false);
    }
  };

  const handleSimulateWebhook = async (action: 'confirm_payment' | 'decline_payment') => {
    if (!activeDeposit) return;
    setSimulating(true);
    setSimMessage(null);

    try {
      const simResult = await walletBackendApi.simulateSandboxWebhook(activeDeposit.transactionId, action);
      if (action === 'confirm_payment') {
        const newBal = simResult.result?.newBalance;
        if (typeof newBal === 'number' && onBalanceUpdate) {
          onBalanceUpdate(newBal);
        }
        setActiveDeposit((prev) => prev ? { ...prev, status: 'completed' } : null);
        setSimMessage(`Payment verified and confirmed by server webhook. ₹${activeDeposit.amount.toLocaleString()} credited.`);
      } else {
        setActiveDeposit((prev) => prev ? { ...prev, status: 'failed' } : null);
        setSimMessage('Payment was declined or cancelled. Wallet balance was not modified.');
      }
      fetchTransactions();
    } catch (err: any) {
      setSimMessage(`Simulation error: ${err.message}`);
    } finally {
      setSimulating(false);
    }
  };

  // Filtered transactions for the history table
  const filteredTransactions = transactions.filter((t) => {
    if (historyFilter === 'deposit' && t.type !== 'deposit') return false;
    if (historyFilter === 'withdrawal' && t.type !== 'withdrawal') return false;
    if (historyFilter === 'pending' && t.status !== 'pending') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = t.id?.toLowerCase().includes(q);
      const matchRef = t.referenceId?.toLowerCase().includes(q);
      const matchMethod = t.paymentMethod?.toLowerCase().includes(q);
      if (!matchId && !matchRef && !matchMethod) return false;
    }

    return true;
  });

  const isDepositUnavailable = !publicConfig?.depositEnabled || !publicConfig?.depositUrlConfigured;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-20 sm:pb-12" id="deposit-page">
      {/* Top Sticky Header */}
      <div className="bg-zinc-900/80 border-b border-zinc-800/80 backdrop-blur-md sticky top-16 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('wallet')}
              className="p-2 rounded-xl bg-zinc-800/70 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors cursor-pointer"
              title="Return to Wallet"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-base sm:text-lg font-black text-zinc-100 uppercase tracking-wide flex items-center gap-2">
                Deposit Funds
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 font-bold border border-amber-500/30">
                  Secure Money Gateway
                </span>
              </h1>
              <p className="text-[11px] text-zinc-400">
                Official payment provider integration. Server-authoritative balance management.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Balance Pill */}
            <div className="hidden sm:flex flex-col text-right px-3 py-1 bg-zinc-950 rounded-xl border border-zinc-800">
              <span className="text-[9px] uppercase font-bold tracking-wider text-zinc-400">
                Available Balance
              </span>
              <span className="text-xs sm:text-sm font-black text-amber-400 tabular-nums">
                {currencySymbol}
                {user.walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            {/* Admin Config Trigger */}
            <button
              onClick={() => onNavigate('settings')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold border border-zinc-700 transition-colors cursor-pointer"
              title="Open Admin Payment Settings"
              id="deposit-admin-config-btn"
            >
              <Settings className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Payment Settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* State Banner: Unavailable vs Available */}
        {configLoading ? (
          <div className="p-8 rounded-2xl bg-zinc-900/60 border border-zinc-800 text-center animate-pulse text-xs text-zinc-400">
            Checking payment gateway configuration...
          </div>
        ) : isDepositUnavailable ? (
          <div
            className="p-5 sm:p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3"
            id="deposit-unavailable-banner"
          >
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-300 shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h2 className="text-base sm:text-lg font-black text-amber-200" id="deposit-unavailable-title">
                  Deposit is currently unavailable.
                </h2>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Deposit is currently turned OFF or no valid payment destination link has been configured by the platform administrator.
                  Wallet balance updates remain strictly safeguarded and can only be enabled by authorized administrators.
                </p>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate('settings')}
                className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Admin: Settings → Payment Settings</span>
              </button>
              <button
                type="button"
                onClick={loadPublicConfig}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs font-semibold border border-zinc-700 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Status</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-zinc-900/70 border border-emerald-500/30 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-emerald-300">
                  {publicConfig?.depositProviderName || 'Authorized Payment Provider'} Active
                </div>
                <div className="text-[11px] text-zinc-400">
                  Destination URL configured by administrator | Currency: <strong className="text-zinc-200">{publicConfig?.currencySymbol || currencySymbol}</strong>
                </div>
              </div>
            </div>
            <button
              onClick={() => onNavigate('settings')}
              className="text-xs text-zinc-400 hover:text-zinc-200 underline cursor-pointer"
            >
              Payment Settings
            </button>
          </div>
        )}

        {/* Deposit Form & Payment Status Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Deposit Amount Form */}
          <div className="lg:col-span-6 space-y-6">
            <div className="p-5 sm:p-6 rounded-2xl bg-zinc-900/90 border border-zinc-800 shadow-xl space-y-5">
              <div className="border-b border-zinc-800 pb-3">
                <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                  <ArrowDownLeft className="w-4 h-4 text-amber-400" />
                  Select Deposit Amount
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Choose a preset or enter a custom amount to add to your WINORA wallet.
                </p>
              </div>

              {depositError && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{depositError}</span>
                </div>
              )}

              <form onSubmit={handleDepositSubmit} className="space-y-5">
                {/* Preset Chips */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-zinc-400">
                    Quick Preset Amounts
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {presetAmounts.map((val) => {
                      const isSelected = amount === val && customAmount === String(val);
                      return (
                        <button
                          key={val}
                          type="button"
                          disabled={isDepositUnavailable}
                          onClick={() => handlePresetSelect(val)}
                          className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                            isSelected
                              ? 'bg-amber-500 text-zinc-950 shadow-md scale-[1.02]'
                              : 'bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 border border-zinc-700/60'
                          }`}
                        >
                          {currencySymbol}
                          {val.toLocaleString()}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom Amount Input */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-zinc-400">
                    Custom Amount ({currencyCode})
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-400 font-black text-sm">
                      {currencySymbol}
                    </span>
                    <input
                      type="number"
                      min={publicConfig?.depositMinAmount || 100}
                      max={publicConfig?.depositMaxAmount || 100000}
                      step="1"
                      disabled={isDepositUnavailable}
                      value={customAmount}
                      onChange={handleCustomAmountChange}
                      placeholder="Enter amount"
                      className="w-full pl-9 pr-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl text-sm font-bold text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500 font-mono disabled:opacity-40 disabled:cursor-not-allowed"
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-zinc-500 px-1">
                    <span>Min: {currencySymbol}{(publicConfig?.depositMinAmount || 100).toLocaleString()}</span>
                    <span>Max: {currencySymbol}{(publicConfig?.depositMaxAmount || 100000).toLocaleString()}</span>
                  </div>
                </div>

                {/* Payment Security Notice */}
                <div className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800/80 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Important Deposit Security Guarantee</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed">
                    Opening the deposit link registers a pending order on the server.
                    <strong> Opening the link does NOT automatically credit your wallet.</strong>
                    Your wallet balance is updated strictly after our server cryptographically verifies the provider confirmation webhook.
                  </p>
                </div>

                {/* Primary Deposit Action: Shown when active, otherwise displays 'Deposit is currently unavailable.' */}
                {isDepositUnavailable ? (
                  <div
                    id="deposit-unavailable-indicator"
                    className="w-full py-4 px-4 rounded-xl bg-zinc-950 border border-amber-500/30 text-amber-300 text-xs sm:text-sm font-bold text-center flex items-center justify-center gap-2 shadow-inner"
                  >
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Deposit is currently unavailable.</span>
                  </div>
                ) : (
                  <button
                    type="submit"
                    disabled={initiating}
                    className="w-full py-3.5 rounded-xl text-xs sm:text-sm font-black uppercase tracking-wider bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-lg transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    id="submit-deposit-btn"
                  >
                    {initiating ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Opening Configured Destination...</span>
                      </>
                    ) : (
                      <>
                        <ExternalLink className="w-4 h-4" />
                        <span>
                          Deposit {publicConfig?.currencySymbol || currencySymbol}
                          {amount.toLocaleString()}
                        </span>
                      </>
                    )}
                  </button>
                )}
              </form>
            </div>
          </div>

          {/* Right Column: Payment Status & Settlement Verification */}
          <div className="lg:col-span-6 space-y-6">
            <div className="p-5 sm:p-6 rounded-2xl bg-zinc-900/90 border border-zinc-800 shadow-xl space-y-5">
              <div className="border-b border-zinc-800 pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wider flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-400" />
                    Payment Status
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Real-time transaction tracking and settlement status.
                  </p>
                </div>
                {activeDeposit && (
                  <button
                    onClick={() => setActiveDeposit(null)}
                    className="text-xs text-zinc-400 hover:text-zinc-200 underline cursor-pointer"
                  >
                    Clear Active
                  </button>
                )}
              </div>

              {activeDeposit ? (
                <div className="space-y-4" id="active-deposit-status-card">
                  {/* Status Indicator */}
                  <div
                    className={`p-4 rounded-xl border flex items-center justify-between ${
                      activeDeposit.status === 'completed'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : activeDeposit.status === 'failed'
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {activeDeposit.status === 'completed' ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                      ) : activeDeposit.status === 'failed' ? (
                        <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                      ) : (
                        <Clock className="w-5 h-5 text-amber-400 animate-spin shrink-0" />
                      )}
                      <div>
                        <div className="text-xs font-black uppercase tracking-wider">
                          Status:{' '}
                          {activeDeposit.status === 'completed'
                            ? 'Completed & Credited'
                            : activeDeposit.status === 'failed'
                            ? 'Failed / Declined'
                            : 'Pending Settlement'}
                        </div>
                        <div className="text-[11px] opacity-80">
                          {activeDeposit.status === 'completed'
                            ? 'Cryptographic webhook confirmed by server.'
                            : activeDeposit.status === 'failed'
                            ? 'Payment authorization failed or declined.'
                            : 'Awaiting verified provider webhook confirmation.'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Transaction Details */}
                  <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/80 space-y-2.5 text-xs font-mono">
                    <div className="flex justify-between text-zinc-400">
                      <span>Transaction ID:</span>
                      <span className="text-zinc-200 font-bold">{activeDeposit.transactionId}</span>
                    </div>
                    <div className="flex justify-between text-zinc-400">
                      <span>Provider Reference:</span>
                      <span className="text-zinc-200">{activeDeposit.providerReference}</span>
                    </div>
                    <div className="flex justify-between text-zinc-400">
                      <span>Amount:</span>
                      <span className="text-amber-400 font-bold">
                        {currencySymbol}
                        {activeDeposit.amount.toLocaleString()} {activeDeposit.currency}
                      </span>
                    </div>
                    {activeDeposit.destinationUrl && (
                      <div className="flex justify-between text-zinc-400 pt-1 border-t border-zinc-850">
                        <span>Configured URL:</span>
                        <a
                          href={activeDeposit.destinationUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-amber-400 hover:underline max-w-[220px] truncate flex items-center gap-1"
                        >
                          <span className="truncate">{activeDeposit.destinationUrl}</span>
                          <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Anti-Fraud Banner */}
                  <div className="p-3.5 rounded-xl bg-zinc-950/60 border border-zinc-800 text-[11px] text-zinc-400 space-y-1">
                    <div className="font-semibold text-zinc-300 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                      Zero Trust Balance Safeguard
                    </div>
                    <p className="leading-relaxed">
                      WINORA does not credit balances based on frontend redirects, user screenshots, or manual transaction IDs.
                      Credits occur strictly upon receiving a valid cryptographic payload on our server webhook.
                    </p>
                  </div>

                  {/* Sandbox Verification Tool */}
                  <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                        Provider Settlement Simulator (Sandbox)
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400">
                      Simulate the external payment provider calling the server webhook:
                    </p>

                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        disabled={simulating || activeDeposit.status === 'completed'}
                        onClick={() => handleSimulateWebhook('confirm_payment')}
                        className="py-2.5 px-3 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition-all cursor-pointer disabled:opacity-40 flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Simulate Confirmation</span>
                      </button>

                      <button
                        type="button"
                        disabled={simulating || activeDeposit.status === 'completed'}
                        onClick={() => handleSimulateWebhook('decline_payment')}
                        className="py-2.5 px-3 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 text-xs font-bold transition-all cursor-pointer disabled:opacity-40 flex items-center justify-center gap-1.5"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Simulate Decline</span>
                      </button>
                    </div>

                    {simMessage && (
                      <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-700/80 text-[11px] text-zinc-300 animate-fadeIn">
                        {simMessage}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-12 px-4 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-800/60 border border-zinc-700/60 text-zinc-500 flex items-center justify-center mx-auto">
                    <ArrowDownLeft className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                      No Active Deposit In Progress
                    </h3>
                    <p className="text-[11px] text-zinc-500 max-w-xs mx-auto">
                      Select an amount on the left and click Deposit to register an order with the configured payment provider.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Transaction History Section */}
        <div className="p-5 sm:p-6 rounded-2xl bg-zinc-900/90 border border-zinc-800 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
            <div>
              <h2 className="text-sm font-bold text-zinc-200 uppercase tracking-wider">
                Transaction History
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Complete record of deposits, withdrawals, amounts, and reference IDs.
              </p>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
              {(['all', 'deposit', 'withdrawal', 'pending'] as const).map((filterKey) => (
                <button
                  key={filterKey}
                  onClick={() => setHistoryFilter(filterKey)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                    historyFilter === filterKey
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {filterKey}
                </button>
              ))}
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
              <Search className="w-3.5 h-3.5" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Reference ID, transaction ID, or payment method..."
              className="w-full pl-9 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 font-mono"
            />
          </div>

          {/* Table / List */}
          {loadingTxns ? (
            <div className="py-8 text-center text-xs text-zinc-500 animate-pulse">
              Loading ledger transactions...
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="py-10 text-center text-zinc-500 text-xs">
              No transactions found matching the selected filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 px-3">Currency</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Reference ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-850">
                  {filteredTransactions.map((txn) => {
                    const isDep = txn.type === 'deposit';
                    return (
                      <tr key={txn.id} className="hover:bg-zinc-850/50 transition-colors">
                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              isDep
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            {isDep ? '+ Deposit' : '- Withdrawal'}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-zinc-200">
                          {isDep ? '+' : '-'}
                          {currencySymbol}
                          {txn.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-3 font-mono text-zinc-400">{txn.currency}</td>
                        <td className="py-3 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                              txn.status === 'completed'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : txn.status === 'pending'
                                ? 'bg-amber-500/20 text-amber-300 animate-pulse'
                                : 'bg-zinc-800 text-zinc-400'
                            }`}
                          >
                            {txn.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-zinc-400 text-[11px]">{txn.createdAt}</td>
                        <td className="py-3 px-3 font-mono text-zinc-400 text-[11px]">
                          {txn.referenceId || txn.id}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Admin Payment Config Modal */}
      <AdminPaymentConfigModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        onConfigUpdated={() => {
          loadPublicConfig();
          fetchTransactions();
        }}
      />
    </div>
  );
};
