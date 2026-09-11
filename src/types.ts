export type NavPage =
  | 'home'
  | 'games'
  | 'wallet'
  | 'deposit'
  | 'withdrawal'
  | 'referral'
  | 'profile'
  | 'history'
  | 'login'
  | 'register'
  | 'settings'
  | 'agent'
  | 'master'
  | 'sql-schema';

export const PAISE_PER_RUPEE = 100;

export function formatPaise(paise: number): string {
  const safePaise = Math.round(Number(paise) || 0);
  const rupees = safePaise / 100;
  return `₹${rupees.toLocaleString('en-IN', {
    minimumFractionDigits: rupees % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function rupeesToPaise(rupees: number): number {
  return Math.round((Number(rupees) || 0) * 100);
}

export function paiseToRupees(paise: number): number {
  return (Math.round(Number(paise) || 0)) / 100;
}

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
  withdrawableBalancePaise: number; // Integer paise - authoritative withdrawable balance
  bonusBalancePaise: number;        // Integer paise - non-withdrawable bonus/protection balance
  agentCommissionBalancePaise?: number; // Integer paise - strictly separated agent commission
  walletBalance: number; // In rupees for display / compatibility
  mainBalance: number;   // In rupees for display / compatibility
  currency: CurrencyConfig;
  avatar?: string;
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
  referralCode?: string;         // Unique, stable permanent player referral code (e.g. WIN78ARJ1)
  referredByUserId?: string;     // Single established referrer user ID (immutable, max 1)
  referrerId?: string;           // Legacy reference maintained for compatibility
  hasMadeFirstDeposit?: boolean;
  stats: {
    gamesPlayed: number;
    highestVirtualWin: number;
    favoriteCategory: string;
    winRate: string;
  };
}

export type ReferralStatus = 'REGISTERED' | 'QUALIFIED' | 'COMPLETED' | 'CANCELLED';

export interface ReferralRecord {
  id: string;                    // Unique referral record ID
  referrerUserId: string;        // Referrer user ID
  referredUserId: string;        // Referred user ID
  referredUserName?: string;
  referralCode: string;          // Referral code used at registration
  status: ReferralStatus;        // Relationship lifecycle status
  createdAt: string;             // ISO timestamp
  idempotencyKey: string;        // Deduplication key
  rewardAmountPaise?: number;    // Bonus credits in paise
  rewardAmount?: number;         // Demo credits to Main Wallet when active
  rewardCredited?: boolean;      // Whether reward has been credited
  rewardCreditedAt?: string;     // ISO timestamp when credited
}

export type WinoraGameId =
  | 'kalyan_morning'
  | 'kalyan'
  | 'kalyan_night'
  | 'hourly_play'
  | 'game_x'
  | 'game_y'
  | 'game_z'
  | 'hourly_dhamaka';

export interface SelectionItem {
  number: string; // '0' to '9' (single) or '00' to '99' (two-digit)
  stake: number;  // in rupees or paise
  stakePaise?: number;
  color: 'GREEN' | 'RED';
}

export interface WinoraGameConfig {
  id: WinoraGameId;
  name: string;
  code: string;
  subtitle: string;
  openTime?: string;
  resultTime?: string;
  payoutMultiplier: number; // 90x for two-digit
  singleDigitMultiplier?: number; // 9x for single digit
  hasHourlyProtection: boolean; // true for Hourly Play (80% protection refund as Bonus Balance)
  hasGreenRefund?: boolean; // legacy alias
  refundPercentage?: number; // 80%
  description: string;
  accentColor: string;
  intervalMinutes: number;
  twoDigitOnly?: boolean;
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

// ----------------------------------------------------------------------
// WINORA MASTER BLUEPRINT AUTHORITATIVE TYPES
// ----------------------------------------------------------------------

export type LedgerTransactionType =
  | 'DEPOSIT_PENDING'
  | 'DEPOSIT_APPROVED'
  | 'DEPOSIT_REJECTED'
  | 'WITHDRAWAL_REQUEST'
  | 'WITHDRAWAL_APPROVED'
  | 'WITHDRAWAL_REJECTED'
  | 'GAME_STAKE'
  | 'GAME_WIN'
  | 'HOURLY_PROTECTION'
  | 'BONUS_REWARD'
  | 'REFERRAL_REWARD'
  | 'AGENT_COMMISSION'
  | 'AGENT_COMMISSION_WITHDRAWAL'
  | 'MASTER_ADJUSTMENT'
  | 'REFUND';

export interface ImmutableLedgerEntry {
  transactionId: string;
  userId: string;
  role: 'player' | 'agent' | 'master';
  transactionType: LedgerTransactionType;
  amountPaise: number;
  balanceBeforePaise: number;
  balanceAfterPaise: number;
  bonusBeforePaise: number;
  bonusAfterPaise: number;
  gameId?: string;
  roundId?: string;
  referenceId?: string;
  actorId: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REJECTED';
  timestamp: string;
  ip?: string;
  device?: string;
  description: string;
}

export interface DepositRequestRecord {
  depositId: string;
  playerId: string;
  playerName: string;
  playerPhone: string;
  submittedAmountPaise: number;
  approvedAmountPaise?: number;
  transactionReference: string; // UTR or Ref number
  screenshotUrl: string;        // Payment receipt image
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNote?: string;
}

export interface WithdrawalRequestRecord {
  requestId: string;
  playerId: string;
  playerName: string;
  playerPhone?: string;
  amountPaise: number;
  upiId: string;
  accountName: string;
  status: 'PENDING' | 'PROCESSING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  processedAt?: string;
  processorId?: string;
  rejectionReason?: string;
  agentId?: string;
  payoutReference?: string;
}

export interface AgentCommissionRecord {
  commissionId: string;
  agentId: string;
  sourcePlayerId: string;
  sourcePlayerName: string;
  amountPaise: number;
  sourceTransaction: string;
  status: 'CREDITED' | 'WITHDRAWN';
  createdAt: string;
}

export interface MasterPaymentSettings {
  enabled: boolean;
  paymentUrl: string;
  upiId: string;
  accountHolderName: string;
  instructions: string;
  minDepositPaise: number;
  maxDepositPaise: number;
  minWithdrawalPaise: number;
  maxWithdrawalPaise: number;
  updatedBy: string;
  updatedAt: string;
}

export interface AuditLogRecord {
  auditId: string;
  actorId: string;
  role: 'master' | 'agent' | 'system';
  action: string;
  targetId: string;
  oldValue?: string;
  newValue?: string;
  timestamp: string;
  ip?: string;
  device?: string;
}

export interface NumberAccountingRow {
  number: number;
  formattedNumber: string; // '00' to '99'
  color: 'GREEN' | 'RED';
  totalBidPaise: number;
  playerCount: number;
  winningStakePaise: number;
  payoutLiabilityPaise: number;
  protectionLiabilityPaise: number;
  netHouseProfitLossPaise: number;
  isWinning?: boolean;
}

export interface MasterDashboardStats {
  totalPlayerBalancesPaise: number;
  totalBonusBalancesPaise: number;
  pendingDepositsCount: number;
  pendingDepositsPaise: number;
  approvedDepositsCount: number;
  approvedDepositsPaise: number;
  pendingWithdrawalsCount: number;
  pendingWithdrawalsPaise: number;
  completedWithdrawalsCount: number;
  completedWithdrawalsPaise: number;
  agentCommissionsPaise: number;
  totalGameStakesPaise: number;
  totalPayoutsPaise: number;
  totalProtectionPaise: number;
  houseProfitLossPaise: number;
}

