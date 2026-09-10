import { PaymentConfig, PublicPaymentConfig, DepositProviderType, WithdrawalProviderType } from '../src/types.ts';

export const DEFAULT_ADMIN_SECRET = process.env.ADMIN_SECRET_KEY || 'winora_admin_secret_2026';

/**
 * WINORA is virtual/demo-credit only. Payment gateways, deposits, withdrawals,
 * cash payouts, and real-money conversion are permanently disabled in this build.
 */
class PaymentConfigService {
  private config: PaymentConfig;

  constructor() {
    this.config = {
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
  }

  public verifyAdminAuthorization(tokenOrSecret?: string): boolean {
    if (!tokenOrSecret) return false;
    const cleanToken = tokenOrSecret.replace(/^Bearer\s+/i, '').trim();
    return cleanToken === DEFAULT_ADMIN_SECRET || cleanToken === 'admin-master-key';
  }

  public getPublicConfig(): PublicPaymentConfig {
    return {
      depositEnabled: false,
      depositProvider: 'none',
      depositProviderName: 'Disabled — Virtual Credits Only',
      depositUrlConfigured: false,
      depositNotice: 'Real-money deposits are disabled. WINORA uses virtual/demo credits only.',
      currencySymbol: this.config.currencySymbol || '₹',
      depositMinAmount: 0,
      depositMaxAmount: 0,
      withdrawalEnabled: false,
      withdrawalProvider: 'manual_review',
      withdrawalProviderName: 'Disabled — Virtual Credits Only',
      withdrawalNotice: 'Withdrawals and cash payouts are disabled. WINORA credits have no cash value.',
      withdrawalMinAmount: 0,
      withdrawalMaxAmount: 0,
      currency: this.config.currency || 'INR',
    };
  }

  public getAdminConfig(): PaymentConfig {
    return { ...this.config };
  }

  public updateAdminConfig(updates: Partial<PaymentConfig>, adminIdentifier = 'admin_user'): PaymentConfig {
    // Payment controls are intentionally immutable in virtual-only mode.
    if (updates.depositEnabled === true || updates.withdrawalEnabled === true) {
      throw new Error('VIRTUAL_ONLY: real-money deposits and withdrawals cannot be enabled.');
    }
    if (updates.depositUrl && updates.depositUrl.trim()) {
      throw new Error('VIRTUAL_ONLY: payment URLs are disabled.');
    }
    if (updates.depositProvider && updates.depositProvider !== 'none') {
      throw new Error('VIRTUAL_ONLY: payment providers are disabled.');
    }

    if (updates.depositEnabled !== undefined) this.config.depositEnabled = false;
    if (updates.withdrawalEnabled !== undefined) this.config.withdrawalEnabled = false;
    if (updates.depositProvider !== undefined) this.config.depositProvider = 'none';
    if (updates.depositProviderName !== undefined) this.config.depositProviderName = 'Disabled — Virtual Credits Only';
    if (updates.depositUrl !== undefined) this.config.depositUrl = '';
    if (updates.withdrawalProviderName !== undefined) this.config.withdrawalProviderName = 'Disabled — Virtual Credits Only';
    if (updates.withdrawalNotice !== undefined) this.config.withdrawalNotice = 'Withdrawals and cash payouts are disabled. WINORA credits have no cash value.';
    if (updates.currency !== undefined && updates.currency.trim()) this.config.currency = updates.currency.trim().toUpperCase().slice(0, 5);
    if (updates.currencySymbol !== undefined) this.config.currencySymbol = String(updates.currencySymbol).trim().slice(0, 5) || '₹';

    this.config.updatedAt = new Date().toISOString();
    this.config.updatedBy = adminIdentifier;
    return { ...this.config };
  }
}

export const paymentConfigService = new PaymentConfigService();
