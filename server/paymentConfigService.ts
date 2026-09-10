import { PaymentConfig, PublicPaymentConfig } from '../src/types.ts';

/**
 * WINORA is virtual/demo-credit only. Payment gateways, deposits, withdrawals,
 * cash payouts, and real-money conversion are permanently disabled.
 * Administrator authorization is handled by Firebase ID tokens + server-side roles.
 */
class PaymentConfigService {
  private config: PaymentConfig = {
    depositEnabled: false,
    depositProvider: 'none',
    depositProviderName: 'Disabled — Virtual Credits Only',
    depositUrl: '',
    depositNotice: 'Real-money deposits are disabled. WINORA uses virtual/demo credits only.',
    currencySymbol: '₹',
    depositMinAmount: 0,
    depositMaxAmount: 0,
    withdrawalEnabled: false,
    withdrawalProvider: 'manual_review',
    withdrawalProviderName: 'Disabled — Virtual Credits Only',
    withdrawalUrl: '',
    withdrawalNotice: 'Withdrawals and cash payouts are disabled. WINORA credits have no cash value.',
    withdrawalMinAmount: 0,
    withdrawalMaxAmount: 0,
    currency: 'INR',
    updatedAt: new Date().toISOString(),
    updatedBy: 'virtual_only_system',
  };

  public getPublicConfig(): PublicPaymentConfig {
    return {
      depositEnabled: false,
      depositProvider: 'none',
      depositProviderName: 'Disabled — Virtual Credits Only',
      depositUrlConfigured: false,
      depositNotice: this.config.depositNotice,
      currencySymbol: this.config.currencySymbol,
      depositMinAmount: 0,
      depositMaxAmount: 0,
      withdrawalEnabled: false,
      withdrawalProvider: 'manual_review',
      withdrawalProviderName: 'Disabled — Virtual Credits Only',
      withdrawalNotice: this.config.withdrawalNotice,
      withdrawalMinAmount: 0,
      withdrawalMaxAmount: 0,
      currency: this.config.currency,
    };
  }

  public getAdminConfig(): PaymentConfig {
    return { ...this.config };
  }

  public updateAdminConfig(updates: Partial<PaymentConfig>, adminIdentifier: string): PaymentConfig {
    if (updates.depositEnabled === true || updates.withdrawalEnabled === true) throw new Error('VIRTUAL_ONLY: real-money payments cannot be enabled.');
    if (updates.depositUrl?.trim()) throw new Error('VIRTUAL_ONLY: payment URLs are disabled.');
    if (updates.depositProvider && updates.depositProvider !== 'none') throw new Error('VIRTUAL_ONLY: payment providers are disabled.');

    this.config.depositEnabled = false;
    this.config.withdrawalEnabled = false;
    this.config.depositProvider = 'none';
    this.config.depositUrl = '';
    this.config.withdrawalUrl = '';
    this.config.updatedAt = new Date().toISOString();
    this.config.updatedBy = adminIdentifier;
    return { ...this.config };
  }
}

export const paymentConfigService = new PaymentConfigService();
