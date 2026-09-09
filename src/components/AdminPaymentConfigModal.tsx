import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  X,
  CheckCircle2,
  Save,
  Link,
  RotateCcw,
  ExternalLink,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { PaymentConfig, DepositProviderType, WithdrawalProviderType } from '../types.ts';
import { walletBackendApi } from '../services/walletBackendApi.ts';

interface AdminPaymentConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigUpdated: () => void;
}

export const AdminPaymentConfigModal: React.FC<AdminPaymentConfigModalProps> = ({
  isOpen,
  onClose,
  onConfigUpdated,
}) => {
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form state
  const [depositEnabled, setDepositEnabled] = useState(true);
  const [depositProvider, setDepositProvider] = useState<DepositProviderType>('external_link');
  const [depositUrl, setDepositUrl] = useState('');
  const [depositNotice, setDepositNotice] = useState('');
  const [withdrawalEnabled, setWithdrawalEnabled] = useState(true);
  const [withdrawalProvider, setWithdrawalProvider] = useState<WithdrawalProviderType>('banking_payout');
  const [withdrawalNotice, setWithdrawalNotice] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen]);

  const loadConfig = async () => {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const data = await walletBackendApi.getAdminPaymentConfig();
      setConfig(data);
      setDepositEnabled(data.depositEnabled);
      setDepositProvider(data.depositProvider);
      setDepositUrl(data.depositUrl || '');
      setDepositNotice(data.depositNotice || '');
      setWithdrawalEnabled(data.withdrawalEnabled);
      setWithdrawalProvider(data.withdrawalProvider);
      setWithdrawalNotice(data.withdrawalNotice || '');
    } catch (err: any) {
      setError(err.message || 'Failed to load system payment configuration.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await walletBackendApi.updateAdminPaymentConfig({
        depositEnabled,
        depositProvider,
        depositUrl: depositUrl.trim(),
        depositNotice: depositNotice.trim(),
        withdrawalEnabled,
        withdrawalProvider,
        withdrawalNotice: withdrawalNotice.trim(),
      });
      setSuccessMsg('Payment configuration updated successfully on system/paymentConfig.');
      onConfigUpdated();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Failed to update payment configuration.');
    } finally {
      setSaving(false);
    }
  };

  const handleSetPresetUnavailable = () => {
    setDepositUrl('');
    setError(null);
    setSuccessMsg('Preset applied: depositUrl cleared. Click Save to test unavailable state.');
  };

  const handleSetPresetAvailable = () => {
    setDepositUrl('https://pay.winora.partner/gateway/checkout');
    setDepositEnabled(true);
    setDepositProvider('external_link');
    setError(null);
    setSuccessMsg('Preset applied: sample external gateway link loaded. Click Save to test active link.');
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto"
      id="admin-payment-config-modal"
    >
      <div className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                Payment Provider Configuration
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                  system/paymentConfig
                </span>
              </h2>
              <p className="text-xs text-zinc-400">
                Authorized server-side configuration foundation. Players cannot modify these settings.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {loading ? (
            <div className="py-12 text-center text-zinc-400 text-sm animate-pulse">
              Loading authoritative payment configuration from server...
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-6">
              {/* Alert Messages */}
              {error && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              {successMsg && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Quick Testing Presets */}
              <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <RotateCcw className="w-3.5 h-3.5" /> Testing Presets (Requirement Verification)
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={handleSetPresetUnavailable}
                    className="px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-left text-xs transition-colors cursor-pointer"
                  >
                    <div className="font-semibold text-rose-300">Preset: Unconfigured Link</div>
                    <div className="text-[11px] text-zinc-400">
                      Clears URL to test &quot;Deposit service is currently unavailable&quot;
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={handleSetPresetAvailable}
                    className="px-3 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-left text-xs transition-colors cursor-pointer"
                  >
                    <div className="font-semibold text-emerald-300">Preset: Valid Gateway Link</div>
                    <div className="text-[11px] text-zinc-400">
                      Loads sample partner URL to test active deposit redirect
                    </div>
                  </button>
                </div>
              </div>

              {/* Section 1: Deposit Settings */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider">
                    Deposit Configuration
                  </h3>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-xs text-zinc-400">Enabled:</span>
                    <input
                      type="checkbox"
                      checked={depositEnabled}
                      onChange={(e) => setDepositEnabled(e.target.checked)}
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      Deposit Provider Type
                    </label>
                    <select
                      value={depositProvider}
                      onChange={(e) => setDepositProvider(e.target.value as DepositProviderType)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
                    >
                      <option value="external_link">external_link (Configurable payment URL)</option>
                      <option value="gateway">gateway (Direct API integration)</option>
                      <option value="none">none (Disabled)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      Base Currency
                    </label>
                    <input
                      type="text"
                      value={config?.currency || 'INR'}
                      disabled
                      className="w-full bg-zinc-950/60 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-500 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center justify-between">
                    <span>
                      Configured Deposit URL (<code className="text-amber-400">depositUrl</code>)
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      Leave empty to disable deposit service
                    </span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-500">
                      <Link className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="url"
                      value={depositUrl}
                      onChange={(e) => setDepositUrl(e.target.value)}
                      placeholder="https://checkout.provider.com/pay"
                      className="w-full pl-9 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                  <p className="mt-1.5 text-[11px] text-zinc-400 leading-relaxed">
                    When configured, clicking Deposit registers a pending server transaction and opens this destination URL.
                    Opening the link does <strong>not</strong> credit the balance until verified webhook confirmation.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Deposit Notice for Players (Optional)
                  </label>
                  <input
                    type="text"
                    value={depositNotice}
                    onChange={(e) => setDepositNotice(e.target.value)}
                    placeholder="e.g. Instant UPI and Net Banking deposits active."
                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Section 2: Withdrawal Settings */}
              <div className="space-y-4 pt-2 border-t border-zinc-800">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider">
                    Withdrawal Configuration
                  </h3>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-xs text-zinc-400">Enabled:</span>
                    <input
                      type="checkbox"
                      checked={withdrawalEnabled}
                      onChange={(e) => setWithdrawalEnabled(e.target.checked)}
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      Withdrawal Method
                    </label>
                    <select
                      value={withdrawalProvider}
                      onChange={(e) => setWithdrawalProvider(e.target.value as WithdrawalProviderType)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
                    >
                      <option value="banking_payout">banking_payout (IMPS & UPI queue)</option>
                      <option value="manual_review">manual_review (Admin audit approval)</option>
                      <option value="external_link">external_link (External payout portal)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                      Notice for Players
                    </label>
                    <input
                      type="text"
                      value={withdrawalNotice}
                      onChange={(e) => setWithdrawalNotice(e.target.value)}
                      placeholder="e.g. Payouts processed 24/7."
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Security Directive Banner */}
              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-start gap-3">
                <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-[11px] text-zinc-400 leading-relaxed">
                  <strong>Security Guard:</strong> Configuration updates take effect immediately on the server.
                  The client has no authority to manipulate balances directly. All money wallet credits require cryptographic provider webhook confirmation.
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-md transition-all active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
