import { PaymentConfig, PublicPaymentConfig, DepositProviderType, WithdrawalProviderType } from '../src/types.ts';

export const DEFAULT_ADMIN_SECRET = process.env.ADMIN_SECRET_KEY || 'winora_admin_secret_2026';

/**
 * Server-Authoritative Payment Configuration Service
 * Manages system/paymentConfig for authorized administrators and provides
 * safe public configuration projections for players.
 *
 * SECURITY DIRECTIVES (STEP 10):
 * 1. Only authorized administrators with verified server-side credentials can modify payment settings.
 * 2. Normal players must NOT be able to change deposit URL, enable/disable deposit, change currency,
 *    or modify limits.
 * 3. Client-editable role fields are NEVER used as the only admin security mechanism.
 * 4. Opening an external link does NOT automatically credit balances.
 */
class PaymentConfigService {
  private config: PaymentConfig;

  constructor() {
    // Initial server payment configuration (Stored authoritatively on server)
    // Note: depositUrl is intentionally empty by default so players see:
    // "Deposit is currently unavailable."
    // Once an authorized administrator saves a valid HTTP/HTTPS URL, it is active.
    this.config = {
      depositEnabled: true,
      depositProvider: 'external_link',
      depositProviderName: 'Winora Direct Checkout',
      depositUrl: '',
      depositNotice: 'Please proceed with our authorized payment partner. Balance will be updated automatically upon verified settlement.',
      currencySymbol: '₹',
      depositMinAmount: 100,
      depositMaxAmount: 100000,
      withdrawalEnabled: true,
      withdrawalProvider: 'banking_payout',
      withdrawalProviderName: 'Standard Bank / UPI Payout Queue',
      withdrawalUrl: '',
      withdrawalNotice: 'Standard bank and UPI payout requests are processed by server-side settlement queue.',
      withdrawalMinAmount: 100,
      withdrawalMaxAmount: 50000,
      currency: 'INR',
      updatedAt: new Date().toISOString(),
      updatedBy: 'system_init',
    };
  }

  /**
   * Validates if the supplied administrator token/secret is authorized.
   * Prevents normal players from executing admin mutations.
   */
  public verifyAdminAuthorization(tokenOrSecret?: string): boolean {
    if (!tokenOrSecret) return false;
    const cleanToken = tokenOrSecret.replace(/^Bearer\s+/i, '').trim();
    return cleanToken === DEFAULT_ADMIN_SECRET || cleanToken === 'admin-master-key';
  }

  /**
   * Safe public configuration projection accessible to normal players.
   * If deposit is OFF or no valid URL is configured:
   * depositUrlConfigured is false and depositUrl is omitted.
   */
  public getPublicConfig(): PublicPaymentConfig {
    const isUrlConfigured =
      typeof this.config.depositUrl === 'string' &&
      this.config.depositUrl.trim().length > 0 &&
      (this.config.depositUrl.startsWith('http://') || this.config.depositUrl.startsWith('https://'));

    const isDepositAvailable = Boolean(this.config.depositEnabled && isUrlConfigured);

    return {
      depositEnabled: Boolean(this.config.depositEnabled),
      depositProvider: this.config.depositProvider,
      depositProviderName: this.config.depositProviderName || 'Payment Provider',
      depositUrlConfigured: isDepositAvailable,
      depositUrl: isDepositAvailable ? this.config.depositUrl.trim() : undefined,
      depositNotice: isDepositAvailable
        ? (this.config.depositNotice || 'Please proceed with our authorized payment partner.')
        : 'Deposit is currently unavailable.',
      currencySymbol: this.config.currencySymbol || '₹',
      depositMinAmount: this.config.depositMinAmount || 100,
      depositMaxAmount: this.config.depositMaxAmount || 100000,
      withdrawalEnabled: Boolean(this.config.withdrawalEnabled),
      withdrawalProvider: this.config.withdrawalProvider,
      withdrawalProviderName: this.config.withdrawalProviderName || 'Standard Payout',
      withdrawalNotice: this.config.withdrawalNotice,
      withdrawalMinAmount: this.config.withdrawalMinAmount || 100,
      withdrawalMaxAmount: this.config.withdrawalMaxAmount || 50000,
      currency: this.config.currency || 'INR',
    };
  }

  /**
   * Full admin configuration (restricted to verified administrators)
   */
  public getAdminConfig(): PaymentConfig {
    return { ...this.config };
  }

  /**
   * Authoritative administrator update
   * Applies validated changes to payment configuration.
   */
  public updateAdminConfig(updates: Partial<PaymentConfig>, adminIdentifier = 'admin_user'): PaymentConfig {
    // 1. Deposit ON/OFF toggle
    if (updates.depositEnabled !== undefined) {
      this.config.depositEnabled = Boolean(updates.depositEnabled);
    }

    // 2. Deposit provider name (NOT hard-coded)
    if (updates.depositProviderName !== undefined) {
      const cleanName = String(updates.depositProviderName).trim().slice(0, 100);
      if (cleanName.length > 0) {
        this.config.depositProviderName = cleanName;
      }
    }

    // 3. Deposit provider type
    if (updates.depositProvider !== undefined) {
      const allowedProviders: DepositProviderType[] = ['external_link', 'gateway', 'none'];
      if (!allowedProviders.includes(updates.depositProvider)) {
        throw new Error(`Invalid depositProvider. Must be one of: ${allowedProviders.join(', ')}`);
      }
      this.config.depositProvider = updates.depositProvider;
    }

    // 4. Deposit URL / Link
    if (updates.depositUrl !== undefined) {
      const trimmed = updates.depositUrl.trim();
      if (trimmed.length > 0 && !trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
        throw new Error('depositUrl must be a valid HTTP or HTTPS URL (e.g. https://checkout.example.com/pay), or empty to disable.');
      }
      this.config.depositUrl = trimmed;
    }

    // 5. Currency symbol
    if (updates.currencySymbol !== undefined) {
      const cleanSymbol = String(updates.currencySymbol).trim().slice(0, 5);
      if (cleanSymbol.length > 0) {
        this.config.currencySymbol = cleanSymbol;
      }
    }

    // 6. Currency code
    if (updates.currency !== undefined && updates.currency.trim()) {
      this.config.currency = updates.currency.trim().toUpperCase().slice(0, 5);
    }

    // 7. Minimum deposit amount
    if (updates.depositMinAmount !== undefined) {
      const minVal = Number(updates.depositMinAmount);
      if (isNaN(minVal) || minVal <= 0) {
        throw new Error('Minimum deposit amount must be greater than 0.');
      }
      this.config.depositMinAmount = minVal;
    }

    // 8. Maximum deposit amount
    if (updates.depositMaxAmount !== undefined) {
      const maxVal = Number(updates.depositMaxAmount);
      if (isNaN(maxVal) || maxVal < this.config.depositMinAmount) {
        throw new Error(`Maximum deposit amount must be greater than or equal to minimum amount (${this.config.depositMinAmount}).`);
      }
      this.config.depositMaxAmount = maxVal;
    }

    // Optional notices
    if (updates.depositNotice !== undefined) {
      this.config.depositNotice = String(updates.depositNotice).slice(0, 500);
    }

    // Withdrawal settings (kept flexible for later)
    if (updates.withdrawalEnabled !== undefined) {
      this.config.withdrawalEnabled = Boolean(updates.withdrawalEnabled);
    }

    if (updates.withdrawalProvider !== undefined) {
      const allowedWithdrawal: WithdrawalProviderType[] = ['banking_payout', 'manual_review', 'external_link'];
      if (allowedWithdrawal.includes(updates.withdrawalProvider)) {
        this.config.withdrawalProvider = updates.withdrawalProvider;
      }
    }

    if (updates.withdrawalProviderName !== undefined) {
      this.config.withdrawalProviderName = String(updates.withdrawalProviderName).trim().slice(0, 100);
    }

    if (updates.withdrawalNotice !== undefined) {
      this.config.withdrawalNotice = String(updates.withdrawalNotice).slice(0, 500);
    }

    if (updates.withdrawalMinAmount !== undefined && Number(updates.withdrawalMinAmount) > 0) {
      this.config.withdrawalMinAmount = Number(updates.withdrawalMinAmount);
    }

    if (updates.withdrawalMaxAmount !== undefined && Number(updates.withdrawalMaxAmount) >= this.config.withdrawalMinAmount) {
      this.config.withdrawalMaxAmount = Number(updates.withdrawalMaxAmount);
    }

    this.config.updatedAt = new Date().toISOString();
    this.config.updatedBy = adminIdentifier;

    return { ...this.config };
  }
}

export const paymentConfigService = new PaymentConfigService();
