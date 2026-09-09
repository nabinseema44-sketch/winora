export type NavPage = 'home' | 'games' | 'deposit' | 'wallet' | 'profile' | 'login' | 'register' | 'settings';

export type DepositProviderType = 'external_link' | 'gateway' | 'none';
export type WithdrawalProviderType = 'banking_payout' | 'manual_review' | 'external_link';

export interface PaymentConfig {
  depositEnabled: boolean;
  depositProvider: DepositProviderType;
  depositProviderName: string;
  depositUrl: string;
  depositNotice?: string;
  currencySymbol: string;
  depositMinAmount: number;
  depositMaxAmount: number;
  withdrawalEnabled: boolean;
  withdrawalProvider: WithdrawalProviderType;
  withdrawalProviderName?: string;
  withdrawalUrl?: string;
  withdrawalNotice?: string;
  withdrawalMinAmount: number;
  withdrawalMaxAmount: number;
  currency: string;
  updatedAt: string;
  updatedBy?: string;
}

export interface PublicPaymentConfig {
  depositEnabled: boolean;
  depositProvider: DepositProviderType;
  depositProviderName: string;
  depositUrlConfigured: boolean;
  depositUrl?: string;
  depositNotice?: string;
  currencySymbol: string;
  depositMinAmount: number;
  depositMaxAmount: number;
  withdrawalEnabled: boolean;
  withdrawalProvider: WithdrawalProviderType;
  withdrawalProviderName?: string;
  withdrawalNotice?: string;
  withdrawalMinAmount: number;
  withdrawalMaxAmount: number;
  currency: string;
}

export type GameCategory = 'all' | 'slots' | 'crash' | 'table' | 'arcade' | 'dice';

export interface CurrencyConfig {
  code: string;
  symbol: string;
  name: string;
}

export const SUPPORTED_CURRENCIES: CurrencyConfig[] = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee (₹)' },
  { code: 'USD', symbol: '$', name: 'US Dollar ($)' },
  { code: 'EUR', symbol: '€', name: 'Euro (€)' },
  { code: 'GBP', symbol: '£', name: 'British Pound (£)' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham (AED)' },
];

export const DEFAULT_CURRENCY: CurrencyConfig = SUPPORTED_CURRENCIES[0];

export interface UserProfile {
  id: string;
  displayName: string;
  phoneNumber: string;
  walletBalance: number;
  currency: CurrencyConfig;
  avatar: string;
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Diamond';
  joinedDate: string;
  level: number;
  role?: 'player';
  status?: 'active' | 'suspended';
  stats: {
    gamesPlayed: number;
    highestVirtualWin: number;
    favoriteCategory: string;
    winRate: string;
  };
}

export interface GameItem {
  id: string;
  title: string;
  category: 'slots' | 'crash' | 'table' | 'arcade' | 'dice';
  icon: string;
  accentColor: string;
  description: string;
  minVirtualBet: number;
  maxVirtualBet: number;
  playersOnline: number;
  isHot?: boolean;
  isNew?: boolean;
  status: 'active' | 'coming_soon';
}

export type TransactionType = 'deposit' | 'withdrawal';
export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'cancelled' | 'processing';

export type KycStatus = 'not_submitted' | 'pending' | 'verified' | 'rejected';
export type AccountVerificationStatus = 'unverified' | 'verified' | 'restricted';

export interface WalletTransaction {
  id: string;
  referenceId: string;
  transactionId?: string;
  uid?: string;
  type: TransactionType;
  amount: number;
  currency: string;
  status: TransactionStatus;
  paymentMethod: string;
  providerReference?: string;
  idempotencyKey?: string;
  createdAt: string;
  updatedAt?: string;
  description: string;
  destinationAccount?: string;
  balanceAfter?: number;
  auditReference?: string;
  timestamp?: string;
}

export interface WalletDocument {
  uid: string;
  currency: string;
  balance: number;
  heldBalance: number;
  availableBalance: number;
  kycStatus: KycStatus;
  withdrawalEligibility: boolean;
  accountVerificationStatus: AccountVerificationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface WalletAuditRecord {
  auditId: string;
  uid: string;
  transactionId: string;
  operation: 'deposit_credit' | 'withdrawal_hold' | 'withdrawal_debit' | 'withdrawal_release_failed';
  amount: number;
  previousBalance: number;
  newBalance: number;
  timestamp: string;
  sourceReference: string;
}

export interface DepositInitiateResponse {
  success: boolean;
  transactionId: string;
  providerReference: string;
  orderId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  checkoutPayload?: {
    gateway: string;
    environment: string;
    keyId: string;
    intentUrl?: string;
    qrString?: string;
  };
  instructions: string;
  idempotencyKey: string;
}

export interface WithdrawalResponse {
  success: boolean;
  transactionId: string;
  providerReference: string;
  amount: number;
  currency: string;
  heldBalance: number;
  availableBalance: number;
  status: TransactionStatus;
  message: string;
}
