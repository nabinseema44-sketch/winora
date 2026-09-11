import { WalletTransaction } from '../types.ts';

/**
 * Production data source is the authenticated backend/Firebase.
 * These exports remain for compatibility with older components, but contain
 * no demo players, balances, transactions, games, or cash/payment history.
 */
export const DEFAULT_PLAYER_AVATAR = '';
export const MOCK_GAMES = [] as never[];
export const INITIAL_WALLET_TRANSACTIONS: WalletTransaction[] = [];
export const INITIAL_LEDGER: WalletTransaction[] = [];
