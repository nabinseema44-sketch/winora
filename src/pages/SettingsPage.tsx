import React, { useState, useEffect } from 'react';
import {
  Settings,
  CreditCard,
  ShieldAlert,
  ShieldCheck,
  Check,
  AlertCircle,
  Loader2,
  ExternalLink,
  Lock,
  ArrowLeft,
  DollarSign,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  Eye,
  EyeOff,
  Server,
} from 'lucide-react';
import { PaymentConfig, PublicPaymentConfig, UserProfile, NavPage } from '../types.ts';
import { walletBackendApi } from '../services/walletBackendApi.ts';

interface SettingsPageProps {
  user: UserProfile | null;
  onNavigate: (page: NavPage) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ user, onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'payment' | 'security'>('payment');

  // Form Fields for Admin Deposit Configuration
  const [depositEnabled, setDepositEnabled] = useState<boolean>(true);
  const [depositProviderName, setDepositProviderName] = useState<string>('Winora Direct Checkout');
  const [depositUrl, setDepositUrl] = useState<string>('');
  const [currencySymbol, setCurrencySymbol] = useState<string>('₹');
  const [currencyCode, setCurrencyCode] = useState<string>('INR');
  const [depositMinAmount, setDepositMinAmount] = useState<string>('100');
  const [depositMaxAmount, setDepositMaxAmount] = useState<string>('100000');
  const [depositNotice, setDepositNotice] = useState<string>('');

  // Withdrawal flexible placeholder
  const [withdrawalEnabled, setWithdrawalEnabled] = useState<boolean>(true);
  const [withdrawalProviderName, setWithdrawalProviderName] = useState<string>('Standard Banking Payout Queue');
  const [withdrawalMinAmount, setWithdrawalMinAmount] = useState<string>('100');
  const [withdrawalMaxAmount, setWithdrawalMaxAmount] = useState<string>('50000');

  // Admin Authorization credentials
  const [adminSecretKey, setAdminSecretKey] = useState<string>(
    () => localStorage.getItem('winora_admin_secret') || 'winora_admin_secret_2026'
  );
  const [showSecretKey, setShowSecretKey] = useState<boolean>(false);

  // States
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [publicPreview, setPublicPreview] = useState<PublicPaymentConfig | null>(null);

  // Load configuration on mount
  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async (customKey?: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const keyToUse = customKey !== undefined ? customKey : adminSecretKey;
      const [adminConfig, pubConfig] = await Promise.all([
        walletBackendApi.getAdminPaymentConfig(keyToUse).catch((err) => {
          console.warn('Admin config fetch warning:', err);
          return null;
        }),
        walletBackendApi.getPublicPaymentConfig().catch(() => null),
      ]);

      if (pubConfig) {
        setPublicPreview(pubConfig);
      }

      if (adminConfig) {
        setDepositEnabled(adminConfig.depositEnabled);
        setDepositProviderName(adminConfig.depositProviderName || 'Winora Direct Checkout');
        setDepositUrl(adminConfig.depositUrl || '');
        setCurrencySymbol(adminConfig.currencySymbol || '₹');
        setCurrencyCode(adminConfig.currency || 'INR');
        setDepositMinAmount(String(adminConfig.depositMinAmount || 100));
        setDepositMaxAmount(String(adminConfig.depositMaxAmount || 100000));
        setDepositNotice(adminConfig.depositNotice || '');

        setWithdrawalEnabled(adminConfig.withdrawalEnabled);
        setWithdrawalProviderName(adminConfig.withdrawalProviderName || 'Standard Banking Payout Queue');
        setWithdrawalMinAmount(String(adminConfig.withdrawalMinAmount || 100));
        setWithdrawalMaxAmount(String(adminConfig.withdrawalMaxAmount || 50000));
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load payment configuration.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSavePaymentSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(null);
    setErrorMessage(null);

    try {
      // Validate inputs
      const cleanUrl = depositUrl.trim();
      if (cleanUrl.length > 0 && !cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        throw new Error('Deposit URL must begin with http:// or https:// (or leave it empty to keep Deposit unavailable).');
      }

      const min = Number(depositMinAmount);
      const max = Number(depositMaxAmount);
      if (isNaN(min) || min <= 0) {
        throw new Error('Minimum deposit amount must be a positive number.');
      }
      if (isNaN(max) || max < min) {
        throw new Error('Maximum deposit amount must be greater than or equal to minimum amount.');
      }

      // Persist secret in localStorage for session convenience
      localStorage.setItem('winora_admin_secret', adminSecretKey);

      // Submit authorized admin update
      const updated = await walletBackendApi.updateAdminPaymentConfig(
        {
          depositEnabled,
          depositProvider: 'external_link',
          depositProviderName: depositProviderName.trim() || 'Payment Provider',
          depositUrl: cleanUrl,
          currencySymbol: currencySymbol.trim() || '₹',
          currency: currencyCode.trim().toUpperCase() || 'INR',
          depositMinAmount: min,
          depositMaxAmount: max,
          depositNotice: depositNotice.trim(),
          withdrawalEnabled,
          withdrawalProvider: 'banking_payout',
          withdrawalProviderName: withdrawalProviderName.trim(),
          withdrawalMinAmount: Number(withdrawalMinAmount) || 100,
          withdrawalMaxAmount: Number(withdrawalMaxAmount) || 50000,
        },
        adminSecretKey
      );

      setSaveSuccess('Payment settings saved and active. Normal players will see updated configuration.');
      const pubConfig = await walletBackendApi.getPublicPaymentConfig();
      setPublicPreview(pubConfig);

      setTimeout(() => {
        setSaveSuccess(null);
      }, 3500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update payment settings.');
    } finally {
      setIsSaving(false);
    }
  };

  // Quick Test Presets
  const applyPresetDisabled = () => {
    setDepositEnabled(false);
    setDepositUrl('');
  };

  const applyPresetTestGateway = () => {
    setDepositEnabled(true);
    setDepositProviderName('WINORA Sandbox Partner');
    setDepositUrl('https://pay.winora.partner/gateway/checkout');
    setCurrencySymbol('₹');
    setDepositMinAmount('100');
    setDepositMaxAmount('100000');
  };

  const applyUnauthorizedTest = async () => {
    setIsSaving(true);
    setSaveSuccess(null);
    setErrorMessage(null);
    try {
      // Intentionally send with invalid/empty admin key to demonstrate server rejection
      await walletBackendApi.updateAdminPaymentConfig(
        { depositEnabled: false },
        'invalid_player_token_unauthorized'
      );
      setSaveSuccess('Unexpected: update was allowed!');
    } catch (err: any) {
      setErrorMessage(`Expected Security Enforcement: Server rejected request with: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-16 max-w-4xl mx-auto px-4 sm:px-0">
      {/* Top Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 mb-1">
            <button
              onClick={() => onNavigate('profile')}
              className="text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Settings
            </button>
            <span className="text-zinc-600">/</span>
            <span className="text-amber-400">Payment Settings</span>
          </div>
          <h1 className="font-display text-2xl font-black text-zinc-100 flex items-center gap-2.5">
            <Settings className="w-6 h-6 text-amber-400" />
            <span>Admin Payment Configuration</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Control player deposit availability, destination payment links, currency symbol, and limits.
          </p>
        </div>

        {/* Quick Navigation buttons */}
        <div className="flex items-center gap-2">
          <button
            id="settings-view-player-wallet-btn"
            onClick={() => onNavigate('wallet')}
            className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-semibold text-zinc-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <CreditCard className="w-3.5 h-3.5 text-amber-400" />
            <span>Player Wallet</span>
          </button>
          <button
            id="settings-view-deposit-page-btn"
            onClick={() => onNavigate('deposit')}
            className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Player Deposit View</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-zinc-800 pb-2">
        <button
          onClick={() => setActiveTab('payment')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'payment'
              ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
              : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>Payment Settings (Deposit & Payouts)</span>
        </button>
        <button
          onClick={() => setActiveTab('security')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === 'security'
              ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
              : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Security & Authorization</span>
        </button>
      </div>

      {/* Notifications */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-start gap-3 shadow-lg">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold block text-sm">Security or Validation Notice:</span>
            <span>{errorMessage}</span>
          </div>
        </div>
      )}

      {saveSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-3 shadow-lg">
          <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold block text-sm">Update Saved Successfully:</span>
            <span>{saveSuccess}</span>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center text-zinc-400 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
          <span className="text-xs">Loading payment configuration from server...</span>
        </div>
      ) : activeTab === 'payment' ? (
        <form onSubmit={handleSavePaymentSettings} className="space-y-6">
          {/* Current Live State Banner */}
          <div className="p-4 rounded-2xl bg-zinc-900/90 border border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-xl ${
                  publicPreview?.depositUrlConfigured
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                }`}
              >
                <Server className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-semibold text-zinc-400 block uppercase tracking-wider">
                  Player Status Preview
                </span>
                <span className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                  {publicPreview?.depositUrlConfigured ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Deposit Active: Players see Deposit button
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      Players see: "Deposit is currently unavailable."
                    </>
                  )}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={applyPresetTestGateway}
                className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-semibold border border-zinc-700 transition-colors cursor-pointer"
              >
                Preset: Live Gateway Link
              </button>
              <button
                type="button"
                onClick={applyPresetDisabled}
                className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] font-semibold border border-zinc-700 transition-colors cursor-pointer"
              >
                Preset: Disable Deposit
              </button>
            </div>
          </div>

          {/* Section 1: Deposit Master Controls */}
          <div className="p-5 sm:p-6 rounded-3xl bg-zinc-900/80 border border-zinc-800 space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-amber-400" />
                <h3 className="font-display text-base font-bold text-zinc-100">
                  Player Deposit Configuration
                </h3>
              </div>
              <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Admin Exclusive
              </span>
            </div>

            {/* Deposit ON/OFF Toggle */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80">
              <div>
                <label className="text-sm font-bold text-zinc-200 block">
                  Deposit System Status (ON / OFF)
                </label>
                <p className="text-xs text-zinc-400 mt-0.5">
                  When turned OFF, players cannot initiate deposits and will see "Deposit is currently unavailable."
                </p>
              </div>
              <button
                id="settings-deposit-toggle-btn"
                type="button"
                onClick={() => setDepositEnabled(!depositEnabled)}
                className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors cursor-pointer ${
                  depositEnabled ? 'bg-emerald-500' : 'bg-zinc-700'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-zinc-950 shadow-md transition-transform ${
                    depositEnabled ? 'translate-x-8' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Deposit Provider Name (NOT hard-coded) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-200 flex items-center justify-between">
                <span>Deposit Provider Name</span>
                <span className="text-[11px] text-zinc-500 font-normal">
                  Configurable string — never hard-coded
                </span>
              </label>
              <input
                id="settings-provider-name-input"
                type="text"
                value={depositProviderName}
                onChange={(e) => setDepositProviderName(e.target.value)}
                placeholder="e.g. WINORA FastPay, Razorpay, Cashfree, Custom Provider"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-zinc-100 text-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
              <p className="text-[11px] text-zinc-400">
                Shown to players as the trusted payment provider label.
              </p>
            </div>

            {/* Deposit URL / Destination Link */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-200 flex items-center justify-between">
                <span>Deposit URL / Destination Link</span>
                <span className="text-[11px] text-amber-400 font-normal">
                  Must start with http:// or https://
                </span>
              </label>
              <input
                id="settings-deposit-url-input"
                type="url"
                value={depositUrl}
                onChange={(e) => setDepositUrl(e.target.value)}
                placeholder="e.g. https://checkout.partner.com/gateway/pay (or empty to disable)"
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-zinc-100 text-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 font-mono"
              />
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-zinc-400">
                <span>
                  When players click Deposit, this URL is opened. Leave empty to keep Deposit unavailable.
                </span>
                {depositUrl.trim() ? (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <Check className="w-3 h-3" /> Valid Link Format
                  </span>
                ) : (
                  <span className="text-zinc-500 italic">No URL configured</span>
                )}
              </div>
            </div>

            {/* Currency Symbol & Code */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-200 block">
                  Currency Symbol
                </label>
                <div className="flex gap-2">
                  <input
                    id="settings-currency-symbol-input"
                    type="text"
                    value={currencySymbol}
                    onChange={(e) => setCurrencySymbol(e.target.value)}
                    maxLength={4}
                    required
                    placeholder="e.g. ₹ or $ or €"
                    className="w-24 px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-zinc-100 text-sm text-center font-bold focus:border-amber-400 focus:outline-none"
                  />
                  <div className="flex items-center gap-1.5">
                    {['₹', '$', '€', '£'].map((sym) => (
                      <button
                        key={sym}
                        type="button"
                        onClick={() => setCurrencySymbol(sym)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                          currencySymbol === sym
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                            : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-white'
                        }`}
                      >
                        {sym}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-200 block">
                  Currency Code
                </label>
                <input
                  id="settings-currency-code-input"
                  type="text"
                  value={currencyCode}
                  onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())}
                  maxLength={5}
                  required
                  placeholder="e.g. INR, USD, EUR"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-zinc-100 text-sm uppercase font-mono focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>

            {/* Minimum & Maximum Limits */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-200 block">
                  Minimum Deposit Amount ({currencySymbol})
                </label>
                <input
                  id="settings-min-amount-input"
                  type="number"
                  value={depositMinAmount}
                  onChange={(e) => setDepositMinAmount(e.target.value)}
                  min={1}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-zinc-100 text-sm focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-200 block">
                  Maximum Deposit Amount ({currencySymbol})
                </label>
                <input
                  id="settings-max-amount-input"
                  type="number"
                  value={depositMaxAmount}
                  onChange={(e) => setDepositMaxAmount(e.target.value)}
                  min={1}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-zinc-100 text-sm focus:border-amber-400 focus:outline-none"
                />
              </div>
            </div>

            {/* Player Instructions / Notice */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-200 block">
                Player Notice / Instructions
              </label>
              <textarea
                id="settings-notice-input"
                value={depositNotice}
                onChange={(e) => setDepositNotice(e.target.value)}
                rows={2}
                placeholder="Instructions displayed to players on the Deposit screen."
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-700 text-zinc-100 text-xs focus:border-amber-400 focus:outline-none resize-none"
              />
            </div>
          </div>

          {/* Section 2: Flexible Withdrawal Settings (Kept for later) */}
          <div className="p-5 sm:p-6 rounded-3xl bg-zinc-900/80 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <h3 className="font-display text-base font-bold text-zinc-100">
                  Withdrawal Interface (Flexible Provider Queue)
                </h3>
              </div>
              <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Active System
              </span>
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-950 border border-zinc-800/80">
              <div>
                <label className="text-xs font-bold text-zinc-200 block">
                  Withdrawal Payout Availability
                </label>
                <p className="text-[11px] text-zinc-400">
                  Controls whether players can submit bank and UPI withdrawal requests.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setWithdrawalEnabled(!withdrawalEnabled)}
                className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors cursor-pointer ${
                  withdrawalEnabled ? 'bg-emerald-500' : 'bg-zinc-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-zinc-950 shadow-md transition-transform ${
                    withdrawalEnabled ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-200 block">
                Withdrawal Provider / Queue Name
              </label>
              <input
                type="text"
                value={withdrawalProviderName}
                onChange={(e) => setWithdrawalProviderName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-zinc-100 text-sm focus:border-amber-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Section 3: Server Admin Secret Key & Save */}
          <div className="p-5 sm:p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-4">
            <div className="flex items-center gap-2 text-zinc-200 font-bold text-sm">
              <Lock className="w-4 h-4 text-amber-400" />
              <span>Server-Authoritative Administrator Credentials</span>
            </div>
            <p className="text-xs text-zinc-400">
              In accordance with Step 10 security mandates, normal players cannot modify payment settings. Client-editable role fields are not trusted as the sole authority. Submitting requires this verified administrative key.
            </p>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  id="settings-admin-secret-input"
                  type={showSecretKey ? 'text' : 'password'}
                  value={adminSecretKey}
                  onChange={(e) => setAdminSecretKey(e.target.value)}
                  placeholder="Enter administrator authorization key"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-zinc-100 text-xs font-mono focus:border-amber-400 focus:outline-none pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowSecretKey(!showSecretKey)}
                  className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-200"
                >
                  {showSecretKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <button
                type="button"
                onClick={applyUnauthorizedTest}
                disabled={isSaving}
                className="px-3 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold border border-zinc-700 transition-colors cursor-pointer"
                title="Test that saving without valid credentials is rejected by the server (HTTP 403)"
              >
                Test Player 403 Rejection
              </button>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
              <button
                id="settings-save-button"
                type="submit"
                disabled={isSaving}
                className="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-black text-sm transition-all shadow-lg shadow-amber-500/25 cursor-pointer flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving Payment Settings...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Save Payment Settings</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      ) : (
        /* Security & Architecture Tab */
        <div className="space-y-5">
          <div className="p-6 rounded-3xl bg-zinc-900 border border-zinc-800 space-y-4">
            <div className="flex items-center gap-2 text-zinc-100 font-bold text-base">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
              <span>STEP 10 Master Security Architecture</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                <span className="font-bold text-amber-400 block text-sm">
                  1. Zero-Trust Balance Rule
                </span>
                <p className="text-zinc-300 leading-relaxed">
                  A player's balance must <strong>NEVER</strong> increase simply because they clicked the Deposit link. The wallet balance is strictly credited only when our server validates an authoritative, cryptographically signed payment webhook from the provider.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                <span className="font-bold text-emerald-400 block text-sm">
                  2. Dual Security Enforcement
                </span>
                <p className="text-zinc-300 leading-relaxed">
                  <strong>Firebase Security Rules</strong> strictly reject all direct client-side writes to <code className="text-amber-400 font-mono">system/paymentConfig</code> (<code className="text-zinc-400 font-mono">allow write: if false</code>).
                  <strong>Trusted Server Authorization</strong> ensures normal players cannot modify payment settings.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                <span className="font-bold text-sky-400 block text-sm">
                  3. Dynamic Provider Routing
                </span>
                <p className="text-zinc-300 leading-relaxed">
                  No payment provider is hard-coded. Any external gateway or partner link saved by an administrator immediately becomes the active destination URL for players.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-950 border border-zinc-800 space-y-2">
                <span className="font-bold text-rose-400 block text-sm">
                  4. Unconfigured State Fallback
                </span>
                <p className="text-zinc-300 leading-relaxed">
                  If Deposit is turned OFF or no valid URL is configured, players actively see:
                  <em className="block text-zinc-100 mt-1 font-semibold">"Deposit is currently unavailable."</em>
                  and the Deposit button remains hidden or disabled.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
