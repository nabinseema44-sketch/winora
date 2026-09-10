export type NavPage = 'home' | 'games' | 'deposit' | 'wallet' | 'profile' | 'login' | 'register' | 'settings' | 'history' | 'agent' | 'master' | 'sql-schema';

export type UserRole = 'master' | 'agent' | 'user' | 'player';

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

export type GameCategory = 'all' | 'slots' | 'crash' | 'table' | 'arcade' | 'dice' | 'numbers';

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
  walletBalance: number; // Main Wallet demo credit balance
  mainBalance: number;   // Main Wallet demo credits
  currency: CurrencyConfig;
  avatar: string;
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Diamond';
  joinedDate: string;
  level: number;
  role: UserRole;
  status: 'active' | 'blocked' | 'suspended';
  address?: string;
  pincode?: string;
  assignedAgentId?: string;
  assignedAgentName?: string;
  assignedAgentPhone?: string;
  referrerId?: string;
  hasMadeFirstDeposit?: boolean;
  stats: {
    gamesPlayed: number;
    highestVirtualWin: number;
    favoriteCategory: string;
    winRate: string;
  };
}

export type WinoraGameId = 'game_x' | 'game_y' | 'game_z' | 'hourly_dhamaka';

export interface SelectionItem {
  number: string; // '00' to '99'
  stake: number;
  color: 'GREEN' | 'RED';
}

export interface WinoraGameConfig {
  id: WinoraGameId;
  name: string;
  code: string;
  subtitle: string;
  payoutMultiplier: number; // 90x
  hasGreenRefund: boolean;  // true for Hourly Dhamaka (80% protection refund)
  refundPercentage?: number; // 80%
  description: string;
  accentColor: string;
  intervalMinutes: number; // e.g. 60 min for hourly
}

export interface GameRound {
  id: string;
  gameId: WinoraGameId;
  gameName: string;
  roundNumber: number;
  freezeTime: string;  // ISO timestamp (15 minutes prior to declareTime)
  declareTime: string; // ISO timestamp
  status: 'open' | 'frozen' | 'completed';
  resultNumber?: string | null;
  resultColor?: 'GREEN' | 'RED' | null;
  totalBidsPool: number;
  declaredAt?: string;
}

export interface PlayerNumberSelection {
  number: string; // '00' to '99'
  stake: number;  // individual stake per number
  color: 'GREEN' | 'RED'; // explicitly chosen color
}

export interface BidRecord {
  id: string;
  gameId: WinoraGameId;
  gameName: string;
  roundId: string;
  userId: string;
  userName: string;
  number: number; // 0 to 99
  amount: number;
  walletUsed: 'main';
  color?: 'GREEN' | 'RED';
  isGreen?: boolean;
  status: 'placed' | 'won' | 'lost' | 'refunded';
  payoutAmount: number;
  refundAmount: number;
  createdAt: string;
}

export interface HandshakeTransaction {
  id: string;
  senderId: string;
  senderName: string;
  senderPhone: string;
  receiverId: string; // Assigned Agent ID
  agentName: string;
  agentPhone?: string;
  amount: number;
  type: 'deposit' | 'withdrawal';
  status: 'pending' | 'agent_approved' | 'completed' | 'rejected';
  createdAt: string;
  completedAt?: string;
  notes?: string;
  isFirstDeposit?: boolean;
  payoutDetails?: {
    upiId?: string;
    accountNumber?: string;
    ifsc?: string;
  };
}

export interface ActivityHistoryItem {
  id: string;
  type: 'bid' | 'win' | 'refund' | 'referral' | 'deposit' | 'withdrawal';
  title: string;
  amount: number;
  wallet: 'main';
  status: 'completed' | 'pending' | 'rejected' | 'won' | 'refunded';
  timestamp: string;
  details: string;
  gameName?: string;
  referenceId?: string;
}

export interface NumberRiskItem {
  number: number;
  formattedNumber: string; // '00', '01', ... '99'
  isGreen: boolean;
  totalBids: number;
  bidCount: number;
  payout90x: number;
  greenRefunds: number;
  netMasterPnL: number;
  isWinning?: boolean;
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
