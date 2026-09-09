export type NavPage = 'home' | 'games' | 'wallet' | 'profile' | 'login' | 'register';

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
export type TransactionStatus = 'completed' | 'processing' | 'pending' | 'failed' | 'rejected';

export interface WalletTransaction {
  id: string;
  referenceId: string;
  type: TransactionType;
  amount: number;
  currency: string;
  status: TransactionStatus;
  paymentMethod: string;
  createdAt: string;
  description: string;
  destinationAccount?: string;
}

// Deprecated alias to prevent breaking temporary imports
export type VirtualLedgerEntry = WalletTransaction;
