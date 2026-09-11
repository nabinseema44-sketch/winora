/**
 * WINORA Core Authoritative Engine (Master Blueprint Compliant)
 * 
 * Implements:
 * 1. Integer Paise Monetary Model (₹1 = 100 paise)
 * 2. Strict Wallet Segregation:
 *    - Withdrawable Balance (withdrawableBalancePaise)
 *    - Bonus Balance (bonusBalancePaise) - NEVER withdrawable
 *    - Agent Commission Balance (agentCommissionBalancePaise) - strictly segregated
 * 3. Immutable Ledger System for all transactions
 * 4. Master Payment Settings & Manual Deposit Verification (UTR + Screenshot)
 * 5. Player Withdrawal Engine (atomic balance reservation & approval/rejection refund)
 * 6. Segregated Agent Commission Accounting & Withdrawal
 * 7. Permanent Referral System (Anti-manipulation & ledger rewards)
 * 8. Games: Kalyan Morning, Kalyan, Kalyan Night, Hourly Play (plus aliases)
 * 9. Payouts: Single digit 9x, Two digit 90x, Hourly 90x + 80% Even/Odd Protection as Bonus Balance
 * 10. Number-Wise House Profit/Loss & Master Accounting (Every number 00-99)
 * 11. Master Wallet Dashboard Stats & Privileged Audit Logs
 */

import {
  UserProfile,
  WinoraGameConfig,
  WinoraGameId,
  GameRound,
  BidRecord,
  HandshakeTransaction,
  ActivityHistoryItem,
  NumberRiskItem,
  UserRole,
  ImmutableLedgerEntry,
  DepositRequestRecord,
  WithdrawalRequestRecord,
  AgentCommissionRecord,
  MasterPaymentSettings,
  AuditLogRecord,
  NumberAccountingRow,
  MasterDashboardStats,
  ReferralRecord,
} from '../types.ts';
import {
  getHourlyPlayRound,
  getKalyanRound,
  formatISTTime,
  KALYAN_SCHEDULE,
} from '../utils/istTime.ts';

// ---------------------------------------------------------------------------
// 1. GAME DEFINITIONS (Kalyan Morning, Kalyan, Kalyan Night, Hourly Play)
// ---------------------------------------------------------------------------
export const WINORA_GAMES: WinoraGameConfig[] = [
  {
    id: 'hourly_play',
    name: 'Hourly Play',
    code: 'HP-80P',
    subtitle: 'Every Hour 24×7 (IST) | 15-min Freeze | 80% Protection Refund',
    openTime: 'Every Hour',
    resultTime: 'Top of Hour',
    payoutMultiplier: 90,
    singleDigitMultiplier: 9,
    hasHourlyProtection: true,
    hasGreenRefund: true,
    refundPercentage: 80,
    twoDigitOnly: true,
    description:
      'PRIORITY GAME! Two-digit 00-99 draws every hour (e.g. 7 AM to 8 AM IST). 90× winning payout. If declared number is GREEN, ALL green bids get 80% refund! If declared number is RED, ALL red bids get 80% refund!',
    accentColor: 'from-emerald-500 to-teal-600',
    intervalMinutes: 60,
  },
  {
    id: 'kalyan_morning',
    name: 'Kalyan Morning',
    code: 'KM-90',
    subtitle: 'Close: 09:30 AM IST | Result: 11:30 AM IST (Closes 2 hr before)',
    openTime: '09:30 AM IST',
    resultTime: '11:30 AM IST',
    payoutMultiplier: 90,
    singleDigitMultiplier: 9,
    hasHourlyProtection: false,
    hasGreenRefund: false,
    description:
      'Premier morning market. Single digit (9×) and Two digit Jodi (90×). Bidding closes strictly 2 hours before declaration.',
    accentColor: 'from-amber-500 to-yellow-600',
    intervalMinutes: 120,
  },
  {
    id: 'kalyan',
    name: 'Kalyan',
    code: 'KL-90',
    subtitle: 'Close: 02:30 PM IST | Result: 04:30 PM IST (Closes 2 hr before)',
    openTime: '02:30 PM IST',
    resultTime: '04:30 PM IST',
    payoutMultiplier: 90,
    singleDigitMultiplier: 9,
    hasHourlyProtection: false,
    hasGreenRefund: false,
    description:
      'Flagship afternoon session with deep liquidity. Single digit (9×) and Two digit Jodi (90×). Bidding closes strictly 2 hours before declaration.',
    accentColor: 'from-blue-600 to-indigo-700',
    intervalMinutes: 120,
  },
  {
    id: 'kalyan_night',
    name: 'Kalyan Night',
    code: 'KN-90',
    subtitle: 'Close: 09:45 PM IST | Result: 11:45 PM IST (Closes 2 hr before)',
    openTime: '09:45 PM IST',
    resultTime: '11:45 PM IST',
    payoutMultiplier: 90,
    singleDigitMultiplier: 9,
    hasHourlyProtection: false,
    hasGreenRefund: false,
    description:
      'Evening high-yield session. Single digit (9×) and Two digit Jodi (90×). Bidding closes strictly 2 hours before declaration.',
    accentColor: 'from-purple-600 to-pink-600',
    intervalMinutes: 120,
  },
];

// Helper to determine if a number is designated Green (Even numbers or 00-49)
export function isNumberGreen(num: number): boolean {
  // In Hourly Play: Even result = GREEN (0, 2, 4...), Odd result = RED (1, 3, 5...)
  return num % 2 === 0;
}

// ---------------------------------------------------------------------------
// 2. INITIAL MOCK PROFILES (Integer Paise: ₹1 = 100 paise)
// ---------------------------------------------------------------------------
export const MOCK_AGENTS: UserProfile[] = [
  {
    id: 'agent-vikram',
    displayName: 'Vikram Sharma (Agent)',
    phoneNumber: '+91 98765 11223',
    withdrawableBalancePaise: 4500000, // ₹45,000
    bonusBalancePaise: 0,
    agentCommissionBalancePaise: 750000, // ₹7,500
    walletBalance: 45000,
    mainBalance: 45000,
    currency: { code: 'INR', symbol: '₹', name: 'Indian Rupee (₹)' },
    tier: 'Diamond',
    joinedDate: 'January 2026',
    level: 12,
    role: 'agent',
    status: 'active',
    address: 'Sector 18, Cyber City, Gurugram',
    pincode: '122002',
    referralCode: 'AGTVK99',
    stats: {
      gamesPlayed: 0,
      highestVirtualWin: 0,
      favoriteCategory: 'Hourly Play',
      winRate: '98% SLA',
    },
  },
  {
    id: 'agent-rahul',
    displayName: 'Rahul Verma (Agent)',
    phoneNumber: '+91 98111 22334',
    withdrawableBalancePaise: 3200000, // ₹32,000
    bonusBalancePaise: 0,
    agentCommissionBalancePaise: 420000, // ₹4,200
    walletBalance: 32000,
    mainBalance: 32000,
    currency: { code: 'INR', symbol: '₹', name: 'Indian Rupee (₹)' },
    tier: 'Gold',
    joinedDate: 'February 2026',
    level: 8,
    role: 'agent',
    status: 'active',
    address: 'Brigade Road, Bengaluru',
    pincode: '560001',
    referralCode: 'AGTRH88',
    stats: {
      gamesPlayed: 0,
      highestVirtualWin: 0,
      favoriteCategory: 'Kalyan',
      winRate: '99% SLA',
    },
  },
];

export const MOCK_MASTER: UserProfile = {
  id: 'master-admin',
  displayName: 'WINORA Master SuperAdmin',
  phoneNumber: '+91 90000 00001',
  withdrawableBalancePaise: 125000000, // ₹1,250,000
  bonusBalancePaise: 0,
  agentCommissionBalancePaise: 0,
  walletBalance: 1250000,
  mainBalance: 1250000,
  currency: { code: 'INR', symbol: '₹', name: 'Indian Rupee (₹)' },
  tier: 'Diamond',
  joinedDate: 'January 2025',
  level: 99,
  role: 'master',
  status: 'active',
  address: 'WINORA HQ, Cyber Hub',
  pincode: '500081',
  referralCode: 'WINMASTER',
  stats: {
    gamesPlayed: 0,
    highestVirtualWin: 0,
    favoriteCategory: 'Master Controls',
    winRate: 'Authoritative',
  },
};

export const DEFAULT_PLAYER: UserProfile = {
  id: 'player-user',
  displayName: 'WINORA Player',
  phoneNumber: '+91 98765 43210',
  withdrawableBalancePaise: 0, // ₹0.00 Withdrawable
  bonusBalancePaise: 0,        // ₹0.00 Bonus Balance
  walletBalance: 0,
  mainBalance: 0,
  currency: { code: 'INR', symbol: '₹', name: 'Indian Rupee (₹)' },
  tier: 'Bronze',
  joinedDate: 'March 2026',
  level: 1,
  role: 'user',
  status: 'active',
  address: 'Indiranagar',
  pincode: '560038',
  assignedAgentId: 'agent-vikram',
  assignedAgentName: 'Vikram Sharma (Agent)',
  assignedAgentPhone: '+91 98765 11223',
  referralCode: 'WIN78ARJ1',
  referredByUserId: 'player-sumit',
  referrerId: 'player-sumit',
  hasMadeFirstDeposit: false,
  stats: {
    gamesPlayed: 0,
    highestVirtualWin: 0,
    favoriteCategory: 'Hourly Play',
    winRate: '0%',
  },
};

export function generateInitialRounds(): Record<WinoraGameId, GameRound> {
  const hp = getHourlyPlayRound();
  const km = getKalyanRound('kalyan_morning');
  const kl = getKalyanRound('kalyan');
  const kn = getKalyanRound('kalyan_night');

  return {
    hourly_play: {
      id: `round-hp-${hp.roundNumber}`,
      gameId: 'hourly_play',
      gameName: hp.gameName,
      roundNumber: hp.roundNumber,
      freezeTime: hp.freezeTimeISO,
      declareTime: hp.declareTimeISO,
      status: hp.isFrozen ? 'frozen' : 'open',
      totalBidsPool: 56800,
    },
    kalyan_morning: {
      id: `round-km-${km.roundNumber}`,
      gameId: 'kalyan_morning',
      gameName: 'Kalyan Morning (90×)',
      roundNumber: km.roundNumber,
      freezeTime: km.freezeTimeISO,
      declareTime: km.declareTimeISO,
      status: km.isFrozen ? 'frozen' : 'open',
      totalBidsPool: 24500,
    },
    kalyan: {
      id: `round-kl-${kl.roundNumber}`,
      gameId: 'kalyan',
      gameName: 'Kalyan (90×)',
      roundNumber: kl.roundNumber,
      freezeTime: kl.freezeTimeISO,
      declareTime: kl.declareTimeISO,
      status: kl.isFrozen ? 'frozen' : 'open',
      totalBidsPool: 18200,
    },
    kalyan_night: {
      id: `round-kn-${kn.roundNumber}`,
      gameId: 'kalyan_night',
      gameName: 'Kalyan Night (90×)',
      roundNumber: kn.roundNumber,
      freezeTime: kn.freezeTimeISO,
      declareTime: kn.declareTimeISO,
      status: kn.isFrozen ? 'frozen' : 'open',
      totalBidsPool: 41200,
    },
    // Aliases for backwards compatibility with earlier components
    game_x: {
      id: `round-km-${km.roundNumber}`,
      gameId: 'game_x',
      gameName: 'Kalyan Morning',
      roundNumber: km.roundNumber,
      freezeTime: km.freezeTimeISO,
      declareTime: km.declareTimeISO,
      status: km.isFrozen ? 'frozen' : 'open',
      totalBidsPool: 24500,
    },
    game_y: {
      id: `round-kl-${kl.roundNumber}`,
      gameId: 'game_y',
      gameName: 'Kalyan',
      roundNumber: kl.roundNumber,
      freezeTime: kl.freezeTimeISO,
      declareTime: kl.declareTimeISO,
      status: kl.isFrozen ? 'frozen' : 'open',
      totalBidsPool: 18200,
    },
    game_z: {
      id: `round-kn-${kn.roundNumber}`,
      gameId: 'game_z',
      gameName: 'Kalyan Night',
      roundNumber: kn.roundNumber,
      freezeTime: kn.freezeTimeISO,
      declareTime: kn.declareTimeISO,
      status: kn.isFrozen ? 'frozen' : 'open',
      totalBidsPool: 41200,
    },
    hourly_dhamaka: {
      id: `round-hp-${hp.roundNumber}`,
      gameId: 'hourly_dhamaka',
      gameName: 'Hourly Play',
      roundNumber: hp.roundNumber,
      freezeTime: hp.freezeTimeISO,
      declareTime: hp.declareTimeISO,
      status: hp.isFrozen ? 'frozen' : 'open',
      totalBidsPool: 56800,
    },
  };
}

function generateSeedBids(): BidRecord[] {
  const bids: BidRecord[] = [];
  const numbers = [7, 14, 21, 33, 42, 55, 68, 77, 88, 93, 0, 99, 25, 49, 50, 72];

  numbers.forEach((num, idx) => {
    bids.push({
      id: `bid-km-${idx}`,
      gameId: 'kalyan_morning',
      gameName: 'Kalyan Morning',
      roundId: 'round-km-101',
      userId: idx % 2 === 0 ? 'player-arjun' : 'player-user2',
      userName: idx % 2 === 0 ? 'Arjun Mehta' : 'Rohan Patel',
      number: num,
      amount: (idx + 1) * 100,
      walletUsed: 'main',
      isGreen: isNumberGreen(num),
      status: 'placed',
      payoutAmount: 0,
      refundAmount: 0,
      createdAt: new Date(Date.now() - (idx + 1) * 120000).toISOString(),
    });
  });

  numbers.forEach((num, idx) => {
    bids.push({
      id: `bid-hp-${idx}`,
      gameId: 'hourly_play',
      gameName: 'Hourly Play',
      roundId: 'round-hp-412',
      userId: idx % 2 === 0 ? 'player-arjun' : 'player-user3',
      userName: idx % 2 === 0 ? 'Arjun Mehta' : 'Karan Singh',
      number: num,
      amount: (idx + 2) * 150,
      walletUsed: 'main',
      isGreen: isNumberGreen(num),
      status: 'placed',
      payoutAmount: 0,
      refundAmount: 0,
      createdAt: new Date(Date.now() - (idx + 1) * 90000).toISOString(),
    });
  });

  return bids;
}

// Initial Handshake Transactions (dual confirmation)
export const INITIAL_HANDSHAKES: HandshakeTransaction[] = [
  {
    id: 'tx-hs-101',
    senderId: 'player-arjun',
    senderName: 'Arjun Mehta',
    senderPhone: '+91 98765 43210',
    receiverId: 'agent-vikram',
    agentName: 'Vikram Sharma (Agent)',
    agentPhone: '+91 98765 11223',
    amount: 2000,
    type: 'deposit',
    status: 'pending',
    createdAt: new Date(Date.now() - 15 * 60000).toISOString(),
    isFirstDeposit: false,
    notes: 'UPI Transfer UTR: 489201928312 to Agent Vikram QR',
  },
  {
    id: 'tx-hs-102',
    senderId: 'player-sneha',
    senderName: 'Sneha Roy',
    senderPhone: '+91 98222 33445',
    receiverId: 'agent-vikram',
    agentName: 'Vikram Sharma (Agent)',
    agentPhone: '+91 98765 11223',
    amount: 1500,
    type: 'deposit',
    status: 'pending',
    createdAt: new Date(Date.now() - 40 * 60000).toISOString(),
    isFirstDeposit: true,
    notes: 'PhonePe screenshot verified. First deposit.',
  },
];

export const INITIAL_HISTORY: ActivityHistoryItem[] = [
  {
    id: 'act-1',
    type: 'referral',
    title: 'Referral Bonus Credited',
    amount: 500,
    wallet: 'main',
    status: 'completed',
    timestamp: new Date(Date.now() - 24 * 3600000).toISOString(),
    details: 'Received ₹500 referral reward from Sumit first qualifying deposit.',
    referenceId: 'REF-78491',
  },
  {
    id: 'act-2',
    type: 'win',
    title: 'Kalyan Morning - 90× Winning Payout!',
    amount: 9000,
    wallet: 'main',
    status: 'won',
    timestamp: new Date(Date.now() - 48 * 3600000).toISOString(),
    details: 'Lucky #42 drawn! Bet ₹100 × 90 = ₹9,000 credited to Withdrawable Balance.',
    gameName: 'Kalyan Morning',
    referenceId: 'WIN-90X-42',
  },
  {
    id: 'act-3',
    type: 'refund',
    title: 'Hourly Play 80% Protection Refund',
    amount: 240,
    wallet: 'main',
    status: 'refunded',
    timestamp: new Date(Date.now() - 3 * 3600000).toISOString(),
    details: 'Bet ₹300 on Green #24. Round settled on #68 (Even = Green). 80% refund (₹240) credited to Bonus Balance.',
    gameName: 'Hourly Play',
    referenceId: 'REFUND-GRN-24',
  },
  {
    id: 'act-4',
    type: 'deposit',
    title: 'Manual Deposit Approved by Master',
    amount: 2500,
    wallet: 'main',
    status: 'completed',
    timestamp: new Date(Date.now() - 72 * 3600000).toISOString(),
    details: 'UTR #392819283120 verified by Master. ₹2,500 credited to Withdrawable Balance.',
    referenceId: 'DEP-UTR-39281',
  },
];

// Seed initial ledger entries for full immutability audit
export const INITIAL_LEDGER: ImmutableLedgerEntry[] = [
  {
    transactionId: 'LEDGER-TX-1001',
    userId: 'player-arjun',
    role: 'player',
    transactionType: 'DEPOSIT_APPROVED',
    amountPaise: 250000,
    balanceBeforePaise: 100000,
    balanceAfterPaise: 350000,
    bonusBeforePaise: 50000,
    bonusAfterPaise: 50000,
    referenceId: 'DEP-UTR-39281',
    actorId: 'master-admin',
    status: 'COMPLETED',
    timestamp: new Date(Date.now() - 72 * 3600000).toISOString(),
    description: 'Manual deposit approved by Master SuperAdmin against UTR #392819283120.',
  },
  {
    transactionId: 'LEDGER-TX-1002',
    userId: 'player-arjun',
    role: 'player',
    transactionType: 'GAME_WIN',
    amountPaise: 900000,
    balanceBeforePaise: 250000,
    balanceAfterPaise: 1150000,
    bonusBeforePaise: 50000,
    bonusAfterPaise: 50000,
    gameId: 'kalyan_morning',
    roundId: 'round-km-99',
    actorId: 'system',
    status: 'COMPLETED',
    timestamp: new Date(Date.now() - 48 * 3600000).toISOString(),
    description: '90× Winning payout on Number #42 for Kalyan Morning.',
  },
  {
    transactionId: 'LEDGER-TX-1003',
    userId: 'player-arjun',
    role: 'player',
    transactionType: 'HOURLY_PROTECTION',
    amountPaise: 24000,
    balanceBeforePaise: 350000,
    balanceAfterPaise: 350000,
    bonusBeforePaise: 26000,
    bonusAfterPaise: 50000,
    gameId: 'hourly_play',
    roundId: 'round-hp-408',
    actorId: 'system',
    status: 'COMPLETED',
    timestamp: new Date(Date.now() - 3 * 3600000).toISOString(),
    description: '80% Hourly Protection Refund on Green Number #24 credited to non-withdrawable Bonus Balance.',
  },
];

export const INITIAL_DEPOSIT_REQUESTS: DepositRequestRecord[] = [
  {
    depositId: 'DEP-REQ-801',
    playerId: 'player-arjun',
    playerName: 'Arjun Mehta',
    playerPhone: '+91 98765 43210',
    submittedAmountPaise: 200000, // ₹2,000
    transactionReference: 'UPI-489201928312',
    screenshotUrl: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&auto=format&fit=crop&q=80',
    status: 'PENDING',
    submittedAt: new Date(Date.now() - 25 * 60000).toISOString(),
    reviewNote: 'Awaiting Master verification of ICICI UPI transfer.',
  },
  {
    depositId: 'DEP-REQ-802',
    playerId: 'player-sneha',
    playerName: 'Sneha Roy',
    playerPhone: '+91 98222 33445',
    submittedAmountPaise: 150000, // ₹1,500
    transactionReference: 'PAYTM-99201828112',
    screenshotUrl: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=400&auto=format&fit=crop&q=80',
    status: 'PENDING',
    submittedAt: new Date(Date.now() - 50 * 60000).toISOString(),
    reviewNote: 'PayTM QR transfer submitted by player.',
  },
  {
    depositId: 'DEP-REQ-799',
    playerId: 'player-arjun',
    playerName: 'Arjun Mehta',
    playerPhone: '+91 98765 43210',
    submittedAmountPaise: 250000,
    approvedAmountPaise: 250000,
    transactionReference: 'UTR-392819283120',
    screenshotUrl: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&auto=format&fit=crop&q=80',
    status: 'APPROVED',
    submittedAt: new Date(Date.now() - 74 * 3600000).toISOString(),
    reviewedAt: new Date(Date.now() - 72 * 3600000).toISOString(),
    reviewedBy: 'master-admin',
    reviewNote: 'Verified with ICICI current account statement.',
  },
];

export const INITIAL_WITHDRAWAL_REQUESTS: WithdrawalRequestRecord[] = [
  {
    requestId: 'WTH-REQ-501',
    playerId: 'player-arjun',
    playerName: 'Arjun Mehta',
    playerPhone: '+91 98765 43210',
    amountPaise: 100000, // ₹1,000
    payoutMethod: 'UPI',
    upiId: 'arjun.mehta@oksbi',
    accountName: 'Arjun Mehta',
    status: 'PENDING',
    createdAt: new Date(Date.now() - 45 * 60000).toISOString(),
  },
  {
    requestId: 'WTH-REQ-502',
    playerId: 'player-sneha',
    playerName: 'Sneha Roy',
    playerPhone: '+91 98222 33445',
    amountPaise: 200000, // ₹2,000
    payoutMethod: 'BANK',
    accountName: 'Sneha Roy',
    bankAccount: {
      accountNumber: '918273645019',
      ifscCode: 'HDFC0001234',
      bankName: 'HDFC Bank',
      accountHolderName: 'Sneha Roy',
    },
    status: 'PENDING',
    createdAt: new Date(Date.now() - 20 * 60000).toISOString(),
  },
  {
    requestId: 'WTH-REQ-498',
    playerId: 'player-sumit',
    playerName: 'Sumit Joshi',
    playerPhone: '+91 98333 44556',
    amountPaise: 250000, // ₹2,500
    payoutMethod: 'UPI',
    upiId: 'sumit.joshi@icici',
    accountName: 'Sumit Joshi',
    status: 'APPROVED',
    createdAt: new Date(Date.now() - 5 * 3600000).toISOString(),
    processedAt: new Date(Date.now() - 4 * 3600000).toISOString(),
    processorId: 'master-admin',
    payoutReference: 'IMPS-930281029381',
  },
];

export const INITIAL_MASTER_PAYMENT_SETTINGS: MasterPaymentSettings = {
  enabled: true,
  paymentUrl: 'https://pay.winora.vip/instant-upi',
  qrCodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=upi%3A%2F%2Fpay%3Fpa%3Dwinora.gaming%40icici%26pn%3DWINORA%2520ENTERTAINMENT%2520PVT%2520LTD%26cu%3DINR',
  upiId: 'winora.gaming@icici',
  accountHolderName: 'WINORA ENTERTAINMENT PVT LTD',
  instructions:
    '1. Scan the official UPI QR code or click the payment link.\n2. Note the 12-digit UTR/Reference number from your banking app.\n3. Enter the deposited coin amount and transaction reference.\n4. Submit the deposit form.\n5. Master will verify and credit coins to your Withdrawable Balance.',
  minDepositPaise: 10000, // ₹100
  maxDepositPaise: 5000000, // ₹50,000
  minWithdrawalPaise: 50000, // ₹500
  maxWithdrawalPaise: 10000000, // ₹100,000
  updatedBy: 'master-admin',
  updatedAt: new Date().toISOString(),
};

export const INITIAL_AUDIT_LOGS: AuditLogRecord[] = [
  {
    auditId: 'AUDIT-101',
    actorId: 'master-admin',
    role: 'master',
    action: 'MASTER_UPDATED_PAYMENT_SETTINGS',
    targetId: 'payment-settings',
    oldValue: 'UPI: winora@hdfc',
    newValue: 'UPI: winora.gaming@icici',
    timestamp: new Date(Date.now() - 36 * 3600000).toISOString(),
    device: 'Master Web Console',
  },
  {
    auditId: 'AUDIT-102',
    actorId: 'master-admin',
    role: 'master',
    action: 'DEPOSIT_APPROVED',
    targetId: 'DEP-REQ-799',
    newValue: 'Approved ₹2,500 credit to player-arjun with UTR UTR-392819283120',
    timestamp: new Date(Date.now() - 72 * 3600000).toISOString(),
    device: 'Master Web Console',
  },
];

export const INITIAL_REFERRALS: ReferralRecord[] = [
  {
    id: 'ref-rec-01',
    referrerUserId: 'player-arjun',
    referredUserId: 'player-sumit',
    referredUserName: 'Sumit Joshi',
    referralCode: 'WIN78ARJ1',
    status: 'COMPLETED',
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    idempotencyKey: 'IDEM-REF-ARJUN-SUMIT',
    rewardAmountPaise: 50000, // ₹500
    rewardCredited: true,
    rewardCreditedAt: new Date(Date.now() - 9 * 86400000).toISOString(),
  },
  {
    id: 'ref-rec-02',
    referrerUserId: 'player-arjun',
    referredUserId: 'player-sneha',
    referredUserName: 'Sneha Roy',
    referralCode: 'WIN78ARJ1',
    status: 'REGISTERED',
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    idempotencyKey: 'IDEM-REF-ARJUN-SNEHA',
    rewardAmountPaise: 50000,
    rewardCredited: false,
  },
];

/**
 * Authoritative WinoraStateManager Class
 */
class WinoraStateManager {
  private activeRole: UserRole = 'user';
  private currentUser: UserProfile = DEFAULT_PLAYER;
  private masterProfile: UserProfile = MOCK_MASTER;
  private agents: UserProfile[] = [...MOCK_AGENTS];
  private players: UserProfile[] = [
    DEFAULT_PLAYER,
    {
      id: 'player-sneha',
      displayName: 'Sneha Roy',
      phoneNumber: '+91 98222 33445',
      withdrawableBalancePaise: 0, // ₹0.00
      bonusBalancePaise: 0,        // ₹0.00
      walletBalance: 0,
      mainBalance: 0,
      currency: { code: 'INR', symbol: '₹', name: 'Indian Rupee (₹)' },
      tier: 'Bronze',
      joinedDate: 'March 2026',
      level: 1,
      role: 'user',
      status: 'active',
      address: '15 Park Street, Kolkata',
      pincode: '700016',
      assignedAgentId: 'agent-vikram',
      assignedAgentName: 'Vikram Sharma (Agent)',
      referralCode: 'WINSNEHA9',
      referredByUserId: 'player-arjun',
      hasMadeFirstDeposit: false,
      stats: { gamesPlayed: 0, highestVirtualWin: 0, favoriteCategory: 'Hourly Play', winRate: '0%' },
    },
    {
      id: 'player-sumit',
      displayName: 'Sumit Joshi',
      phoneNumber: '+91 98333 44556',
      withdrawableBalancePaise: 0, // ₹0.00
      bonusBalancePaise: 0,        // ₹0.00
      walletBalance: 0,
      mainBalance: 0,
      currency: { code: 'INR', symbol: '₹', name: 'Indian Rupee (₹)' },
      tier: 'Gold',
      joinedDate: 'February 2026',
      level: 6,
      role: 'user',
      status: 'active',
      address: 'B-12 Civil Lines, Jaipur',
      pincode: '302006',
      assignedAgentId: 'agent-rahul',
      assignedAgentName: 'Rahul Verma (Agent)',
      referralCode: 'WINSUMIT6',
      hasMadeFirstDeposit: true,
      stats: { gamesPlayed: 58, highestVirtualWin: 18000, favoriteCategory: 'Hourly Play', winRate: '41%' },
    },
  ];

  private rounds: Record<WinoraGameId, GameRound> = generateInitialRounds();
  private bids: BidRecord[] = generateSeedBids();
  private handshakes: HandshakeTransaction[] = [...INITIAL_HANDSHAKES];
  private history: ActivityHistoryItem[] = [...INITIAL_HISTORY];
  private ledger: ImmutableLedgerEntry[] = [...INITIAL_LEDGER];
  private depositRequests: DepositRequestRecord[] = [...INITIAL_DEPOSIT_REQUESTS];
  private withdrawalRequests: WithdrawalRequestRecord[] = [...INITIAL_WITHDRAWAL_REQUESTS];
  private masterPaymentSettings: MasterPaymentSettings = { ...INITIAL_MASTER_PAYMENT_SETTINGS };
  private auditLogs: AuditLogRecord[] = [...INITIAL_AUDIT_LOGS];
  private referrals: ReferralRecord[] = [...INITIAL_REFERRALS];
  private agentCommissions: AgentCommissionRecord[] = [
    {
      commissionId: 'COMM-101',
      agentId: 'agent-vikram',
      sourcePlayerId: 'player-arjun',
      sourcePlayerName: 'Arjun Mehta',
      amountPaise: 25000, // ₹250 (10% of ₹2,500 deposit)
      sourceTransaction: 'DEP-REQ-799',
      status: 'CREDITED',
      createdAt: new Date(Date.now() - 72 * 3600000).toISOString(),
    },
    {
      commissionId: 'COMM-102',
      agentId: 'agent-vikram',
      sourcePlayerId: 'player-sumit',
      sourcePlayerName: 'Sumit Joshi',
      amountPaise: 50000, // ₹500
      sourceTransaction: 'DEP-REQ-782',
      status: 'CREDITED',
      createdAt: new Date(Date.now() - 48 * 3600000).toISOString(),
    },
  ];

  private listeners: (() => void)[] = [];

  constructor() {
    // Tick round timers every 5 seconds to enforce the 15-minute freeze rule
    setInterval(() => {
      this.tickRoundTimers();
    }, 5000);
  }

  public subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  // Periodic check for 15-minute freeze rule
  private tickRoundTimers() {
    const now = Date.now();
    let updated = false;

    (Object.keys(this.rounds) as WinoraGameId[]).forEach((gid) => {
      const round = this.rounds[gid];
      if (round && round.status === 'open') {
        const freezeTimestamp = new Date(round.freezeTime).getTime();
        if (now >= freezeTimestamp) {
          round.status = 'frozen';
          updated = true;
        }
      }
    });

    if (updated) {
      this.notify();
    }
  }

  // ---------------------------------------------------------------------------
  // ROLE SWITCHING (Seamless instant testing for Master, Agent, and Player)
  // ---------------------------------------------------------------------------
  public getRole(): UserRole {
    return this.activeRole;
  }

  public setRole(newRole: UserRole) {
    this.activeRole = newRole;
    if (newRole === 'master') {
      this.currentUser = this.masterProfile;
    } else if (newRole === 'agent') {
      this.currentUser = this.agents[0];
    } else {
      this.currentUser = this.players[0];
    }
    this.notify();
  }

  public switchUserRole(newRole: 'player' | 'agent' | 'master') {
    const targetRole: UserRole = newRole === 'player' ? 'user' : newRole;
    this.setRole(targetRole);
  }

  public getCurrentUser(): UserProfile {
    return this.currentUser;
  }

  public getMasterProfile(): UserProfile {
    return this.masterProfile;
  }

  public getAgents(): UserProfile[] {
    return this.agents;
  }

  public getPlayers(): UserProfile[] {
    return this.players;
  }

  public getRounds(): Record<WinoraGameId, GameRound> {
    return this.rounds;
  }

  public getBids(): BidRecord[] {
    return this.bids;
  }

  public getHandshakes(): HandshakeTransaction[] {
    return this.handshakes;
  }

  public getHistory(): ActivityHistoryItem[] {
    return this.history;
  }

  public getLedger(): ImmutableLedgerEntry[] {
    return [...this.ledger].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  public getDepositRequests(): DepositRequestRecord[] {
    return [...this.depositRequests].sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );
  }

  public getWithdrawalRequests(): WithdrawalRequestRecord[] {
    return [...this.withdrawalRequests].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public getMasterPaymentSettings(): MasterPaymentSettings {
    return this.masterPaymentSettings;
  }

  public getAuditLogs(): AuditLogRecord[] {
    return [...this.auditLogs].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  public getReferrals(userId?: string): ReferralRecord[] {
    if (!userId) return this.referrals;
    return this.referrals.filter(
      (r) => r.referrerUserId === userId || r.referredUserId === userId
    );
  }

  public getAgentCommissions(agentId?: string): AgentCommissionRecord[] {
    if (!agentId) return this.agentCommissions;
    return this.agentCommissions.filter((c) => c.agentId === agentId);
  }

  // ---------------------------------------------------------------------------
  // IMMUTABLE LEDGER RECORDING
  // ---------------------------------------------------------------------------
  public recordLedgerEntry(
    entry: Omit<ImmutableLedgerEntry, 'transactionId' | 'timestamp'>
  ): ImmutableLedgerEntry {
    const newEntry: ImmutableLedgerEntry = {
      ...entry,
      transactionId: `LEDGER-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      timestamp: new Date().toISOString(),
    };
    this.ledger.unshift(newEntry);
    return newEntry;
  }

  // ---------------------------------------------------------------------------
  // AUDIT LOG RECORDING
  // ---------------------------------------------------------------------------
  public recordAuditLog(log: Omit<AuditLogRecord, 'auditId' | 'timestamp'>) {
    const record: AuditLogRecord = {
      ...log,
      auditId: `AUDIT-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      timestamp: new Date().toISOString(),
    };
    this.auditLogs.unshift(record);
  }

  // ---------------------------------------------------------------------------
  // 4. DEPOSIT SYSTEM (Master Controls Payment Link & Manual Verification)
  // ---------------------------------------------------------------------------
  public updateMasterPaymentSettings(
    settings: Partial<MasterPaymentSettings>,
    actorId: string = 'master-admin'
  ): { success: boolean; message: string } {
    const oldSettings = JSON.stringify(this.masterPaymentSettings);
    this.masterPaymentSettings = {
      ...this.masterPaymentSettings,
      ...settings,
      updatedBy: actorId,
      updatedAt: new Date().toISOString(),
    };

    this.recordAuditLog({
      actorId,
      role: 'master',
      action: 'MASTER_CHANGED_PAYMENT_SETTINGS',
      targetId: 'payment-settings',
      oldValue: oldSettings,
      newValue: JSON.stringify(this.masterPaymentSettings),
      device: 'Master Console',
    });

    this.notify();
    return { success: true, message: 'Master payment configuration updated successfully.' };
  }

  public submitDepositRequest(params: {
    playerId: string;
    amountPaise: number;
    transactionReference: string;
    screenshotUrl: string;
  }): { success: boolean; message: string; deposit?: DepositRequestRecord } {
    const player = this.players.find((p) => p.id === params.playerId) || this.currentUser;

    // Check duplicate transaction reference
    const duplicate = this.depositRequests.find(
      (d) => d.transactionReference.trim().toUpperCase() === params.transactionReference.trim().toUpperCase()
    );
    if (duplicate) {
      return {
        success: false,
        message: 'This transaction reference / UTR has already been submitted. Please check your reference number.',
      };
    }

    if (params.amountPaise < this.masterPaymentSettings.minDepositPaise) {
      return {
        success: false,
        message: `Minimum deposit amount is ₹${(this.masterPaymentSettings.minDepositPaise / 100).toLocaleString()}.`,
      };
    }

    const newDeposit: DepositRequestRecord = {
      depositId: `DEP-REQ-${Date.now().toString().slice(-6)}`,
      playerId: player.id,
      playerName: player.displayName,
      playerPhone: player.phoneNumber,
      submittedAmountPaise: params.amountPaise,
      transactionReference: params.transactionReference.trim(),
      screenshotUrl: params.screenshotUrl,
      status: 'PENDING',
      submittedAt: new Date().toISOString(),
      reviewNote: 'Awaiting Master approval.',
    };

    this.depositRequests.unshift(newDeposit);

    // Record Pending in ledger
    this.recordLedgerEntry({
      userId: player.id,
      role: 'player',
      transactionType: 'DEPOSIT_PENDING',
      amountPaise: params.amountPaise,
      balanceBeforePaise: player.withdrawableBalancePaise,
      balanceAfterPaise: player.withdrawableBalancePaise,
      bonusBeforePaise: player.bonusBalancePaise,
      bonusAfterPaise: player.bonusBalancePaise,
      referenceId: newDeposit.depositId,
      actorId: player.id,
      status: 'PENDING',
      description: `Player submitted manual deposit request for ₹${(params.amountPaise / 100).toLocaleString()} (Ref: ${params.transactionReference}).`,
    });

    this.notify();
    return {
      success: true,
      message: 'Deposit submitted! Master will verify your payment and credit your Withdrawable Balance.',
      deposit: newDeposit,
    };
  }

  public approveDepositRequest(
    depositId: string,
    masterId: string = 'master-admin',
    reviewNote?: string
  ): { success: boolean; message: string } {
    const dep = this.depositRequests.find((d) => d.depositId === depositId);
    if (!dep) return { success: false, message: 'Deposit request not found.' };
    if (dep.status !== 'PENDING') return { success: false, message: 'Deposit already reviewed.' };

    const player = this.players.find((p) => p.id === dep.playerId) || this.currentUser;
    const balanceBefore = player.withdrawableBalancePaise;

    // Atomically credit withdrawable balance
    player.withdrawableBalancePaise += dep.submittedAmountPaise;
    player.walletBalance = Math.floor(player.withdrawableBalancePaise / 100);
    player.mainBalance = Math.floor((player.withdrawableBalancePaise + player.bonusBalancePaise) / 100);
    dep.status = 'APPROVED';
    dep.approvedAmountPaise = dep.submittedAmountPaise;
    dep.reviewedAt = new Date().toISOString();
    dep.reviewedBy = masterId;
    dep.reviewNote = reviewNote || 'Approved by Master verification.';

    // Create Immutable Ledger Entry
    this.recordLedgerEntry({
      userId: player.id,
      role: 'player',
      transactionType: 'DEPOSIT_APPROVED',
      amountPaise: dep.submittedAmountPaise,
      balanceBeforePaise: balanceBefore,
      balanceAfterPaise: player.withdrawableBalancePaise,
      bonusBeforePaise: player.bonusBalancePaise,
      bonusAfterPaise: player.bonusBalancePaise,
      referenceId: dep.depositId,
      actorId: masterId,
      status: 'COMPLETED',
      description: `Master approved deposit of ₹${(dep.submittedAmountPaise / 100).toLocaleString()} against UTR: ${dep.transactionReference}.`,
    });

    // Record Audit Log
    this.recordAuditLog({
      actorId: masterId,
      role: 'master',
      action: 'MASTER_APPROVED_DEPOSIT',
      targetId: dep.depositId,
      newValue: `Credited ₹${(dep.submittedAmountPaise / 100).toLocaleString()} to ${player.displayName}`,
      device: 'Master Console',
    });

    // Agent Commission Trigger: If player is assigned to an agent, calculate commission (e.g. 10%)
    if (player.assignedAgentId) {
      const agent = this.agents.find((a) => a.id === player.assignedAgentId);
      if (agent) {
        const commPaise = Math.round(dep.submittedAmountPaise * 0.1);
        agent.agentCommissionBalancePaise = (agent.agentCommissionBalancePaise || 0) + commPaise;
        const commRecord: AgentCommissionRecord = {
          commissionId: `COMM-${Date.now()}`,
          agentId: agent.id,
          sourcePlayerId: player.id,
          sourcePlayerName: player.displayName,
          amountPaise: commPaise,
          sourceTransaction: dep.depositId,
          status: 'CREDITED',
          createdAt: new Date().toISOString(),
        };
        this.agentCommissions.unshift(commRecord);

        // Record Agent Commission in ledger
        this.recordLedgerEntry({
          userId: agent.id,
          role: 'agent',
          transactionType: 'AGENT_COMMISSION',
          amountPaise: commPaise,
          balanceBeforePaise: agent.withdrawableBalancePaise,
          balanceAfterPaise: agent.withdrawableBalancePaise,
          bonusBeforePaise: 0,
          bonusAfterPaise: 0,
          referenceId: commRecord.commissionId,
          actorId: 'system',
          status: 'COMPLETED',
          description: `10% Agent Commission (₹${(commPaise / 100).toLocaleString()}) from player ${player.displayName} deposit credited to Agent Commission Balance.`,
        });
      }
    }

    this.notify();
    return {
      success: true,
      message: `Deposit of ₹${(dep.submittedAmountPaise / 100).toLocaleString()} approved and credited to Withdrawable Balance!`,
    };
  }

  public rejectDepositRequest(
    depositId: string,
    masterId: string = 'master-admin',
    reviewNote: string
  ): { success: boolean; message: string } {
    const dep = this.depositRequests.find((d) => d.depositId === depositId);
    if (!dep) return { success: false, message: 'Deposit request not found.' };
    if (dep.status !== 'PENDING') return { success: false, message: 'Deposit already reviewed.' };

    const player = this.players.find((p) => p.id === dep.playerId) || this.currentUser;
    dep.status = 'REJECTED';
    dep.reviewedAt = new Date().toISOString();
    dep.reviewedBy = masterId;
    dep.reviewNote = reviewNote;

    this.recordLedgerEntry({
      userId: player.id,
      role: 'player',
      transactionType: 'DEPOSIT_REJECTED',
      amountPaise: dep.submittedAmountPaise,
      balanceBeforePaise: player.withdrawableBalancePaise,
      balanceAfterPaise: player.withdrawableBalancePaise,
      bonusBeforePaise: player.bonusBalancePaise,
      bonusAfterPaise: player.bonusBalancePaise,
      referenceId: dep.depositId,
      actorId: masterId,
      status: 'REJECTED',
      description: `Deposit rejected: ${reviewNote}`,
    });

    this.recordAuditLog({
      actorId: masterId,
      role: 'master',
      action: 'MASTER_REJECTED_DEPOSIT',
      targetId: dep.depositId,
      newValue: `Reason: ${reviewNote}`,
      device: 'Master Console',
    });

    this.notify();
    return { success: true, message: 'Deposit request rejected.' };
  }

  // ---------------------------------------------------------------------------
  // 5. WITHDRAWAL SYSTEM (Withdrawable Balance Only, Atomic Hold, Master Review)
  // ---------------------------------------------------------------------------
  public requestWithdrawal(params: {
    playerId: string;
    amountPaise: number;
    payoutMethod?: 'UPI' | 'BANK';
    upiId?: string;
    bankAccount?: {
      accountNumber: string;
      ifscCode: string;
      bankName?: string;
      accountHolderName: string;
    };
    accountName: string;
    agentId?: string;
  }): { success: boolean; message: string; request?: WithdrawalRequestRecord } {
    const player = this.players.find((p) => p.id === params.playerId) || this.currentUser;

    if (params.amountPaise <= 0) {
      return { success: false, message: 'Invalid withdrawal amount.' };
    }

    if (params.amountPaise < this.masterPaymentSettings.minWithdrawalPaise) {
      return {
        success: false,
        message: `Minimum withdrawal amount is ₹${(this.masterPaymentSettings.minWithdrawalPaise / 100).toLocaleString()}.`,
      };
    }

    // Strict validation: withdrawable balance ONLY. Bonus balance can never be withdrawn!
    if (params.amountPaise > player.withdrawableBalancePaise) {
      return {
        success: false,
        message: `Requested amount exceeds Withdrawable Balance (Available: ₹${(player.withdrawableBalancePaise / 100).toLocaleString()}). Note: Bonus Balance cannot be withdrawn.`,
      };
    }

    const payoutMethod = params.payoutMethod || (params.bankAccount ? 'BANK' : 'UPI');

    // NOTE: In accordance with platform rule, coin is deducted only after master confirmation.
    const newReq: WithdrawalRequestRecord = {
      requestId: `WTH-REQ-${Date.now().toString().slice(-6)}`,
      playerId: player.id,
      playerName: player.displayName,
      playerPhone: player.phoneNumber,
      amountPaise: params.amountPaise,
      payoutMethod,
      upiId: params.upiId?.trim() || '',
      bankAccount: params.bankAccount
        ? {
            accountNumber: params.bankAccount.accountNumber.trim(),
            ifscCode: params.bankAccount.ifscCode.trim().toUpperCase(),
            bankName: params.bankAccount.bankName?.trim() || 'Direct Bank Transfer',
            accountHolderName: params.bankAccount.accountHolderName.trim(),
          }
        : undefined,
      accountName:
        params.accountName.trim() ||
        params.bankAccount?.accountHolderName.trim() ||
        player.displayName,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      agentId: params.agentId,
    };

    this.withdrawalRequests.unshift(newReq);

    // Record immutable ledger entry for pending request
    this.recordLedgerEntry({
      userId: player.id,
      role: 'player',
      transactionType: 'WITHDRAWAL_REQUEST',
      amountPaise: params.amountPaise,
      balanceBeforePaise: player.withdrawableBalancePaise,
      balanceAfterPaise: player.withdrawableBalancePaise,
      bonusBeforePaise: player.bonusBalancePaise,
      bonusAfterPaise: player.bonusBalancePaise,
      referenceId: newReq.requestId,
      actorId: player.id,
      status: 'PENDING',
      description: `Withdrawal request submitted for ₹${(params.amountPaise / 100).toLocaleString()} via ${
        payoutMethod === 'BANK' ? `Bank (${newReq.bankAccount?.accountNumber.slice(-4)})` : `UPI (${newReq.upiId})`
      }. Coins will be deducted upon Master confirmation.`,
    });

    this.notify();
    return {
      success: true,
      message: `Withdrawal request of ₹${(params.amountPaise / 100).toLocaleString()} submitted. Coins will be deducted from your wallet once Master verifies and confirms payout.`,
      request: newReq,
    };
  }

  public approveWithdrawal(
    requestId: string,
    processorId: string = 'master-admin',
    payoutReference?: string
  ): { success: boolean; message: string } {
    const req = this.withdrawalRequests.find((r) => r.requestId === requestId);
    if (!req) return { success: false, message: 'Withdrawal request not found.' };
    if (req.status !== 'PENDING' && req.status !== 'PROCESSING') {
      return { success: false, message: 'Withdrawal request already processed.' };
    }

    const player = this.players.find((p) => p.id === req.playerId) || this.currentUser;

    // Verify player has sufficient balance before confirmation
    if (player.withdrawableBalancePaise < req.amountPaise) {
      return {
        success: false,
        message: `Player has insufficient Withdrawable Balance (Available: ₹${(player.withdrawableBalancePaise / 100).toLocaleString()}). Cannot approve withdrawal.`,
      };
    }

    const balanceBefore = player.withdrawableBalancePaise;

    // DEDUCT COIN FROM PLAYER AFTER MASTER CONFIRMATION
    player.withdrawableBalancePaise -= req.amountPaise;
    player.walletBalance = Math.floor(player.withdrawableBalancePaise / 100);
    player.mainBalance = Math.floor((player.withdrawableBalancePaise + player.bonusBalancePaise) / 100);

    req.status = 'APPROVED';
    req.processedAt = new Date().toISOString();
    req.processorId = processorId;
    req.payoutReference =
      payoutReference ||
      (req.payoutMethod === 'BANK' ? `IMPS-${Date.now().toString().slice(-8)}` : `UPI-${Date.now().toString().slice(-8)}`);

    this.recordLedgerEntry({
      userId: player.id,
      role: 'player',
      transactionType: 'WITHDRAWAL_APPROVED',
      amountPaise: req.amountPaise,
      balanceBeforePaise: balanceBefore,
      balanceAfterPaise: player.withdrawableBalancePaise,
      bonusBeforePaise: player.bonusBalancePaise,
      bonusAfterPaise: player.bonusBalancePaise,
      referenceId: req.requestId,
      actorId: processorId,
      status: 'COMPLETED',
      description: `Withdrawal of ₹${(req.amountPaise / 100).toLocaleString()} confirmed by Master (${processorId}). Coins deducted. Payout Ref: ${req.payoutReference}.`,
    });

    this.recordAuditLog({
      actorId: processorId,
      role: processorId.startsWith('agent') ? 'agent' : 'master',
      action: 'WITHDRAWAL_APPROVED',
      targetId: req.requestId,
      newValue: `Payout Ref: ${req.payoutReference}, Coins Deducted: ₹${req.amountPaise / 100}`,
      device: 'Portal Console',
    });

    this.notify();
    return {
      success: true,
      message: `Withdrawal of ₹${(req.amountPaise / 100).toLocaleString()} confirmed! Coins successfully deducted from player's wallet.`,
    };
  }

  public rejectWithdrawal(
    requestId: string,
    processorId: string = 'master-admin',
    rejectionReason: string
  ): { success: boolean; message: string } {
    const req = this.withdrawalRequests.find((r) => r.requestId === requestId);
    if (!req) return { success: false, message: 'Withdrawal request not found.' };
    if (req.status !== 'PENDING' && req.status !== 'PROCESSING') {
      return { success: false, message: 'Withdrawal request already processed.' };
    }

    const player = this.players.find((p) => p.id === req.playerId) || this.currentUser;

    req.status = 'REJECTED';
    req.processedAt = new Date().toISOString();
    req.processorId = processorId;
    req.rejectionReason = rejectionReason;

    // Coins were NOT deducted at request time, so no refund debit needed
    this.recordLedgerEntry({
      userId: player.id,
      role: 'player',
      transactionType: 'WITHDRAWAL_REJECTED',
      amountPaise: req.amountPaise,
      balanceBeforePaise: player.withdrawableBalancePaise,
      balanceAfterPaise: player.withdrawableBalancePaise,
      bonusBeforePaise: player.bonusBalancePaise,
      bonusAfterPaise: player.bonusBalancePaise,
      referenceId: req.requestId,
      actorId: processorId,
      status: 'REJECTED',
      description: `Withdrawal rejected: ${rejectionReason}. No coins were deducted.`,
    });

    this.recordAuditLog({
      actorId: processorId,
      role: processorId.startsWith('agent') ? 'agent' : 'master',
      action: 'WITHDRAWAL_REJECTED',
      targetId: req.requestId,
      newValue: `Reason: ${rejectionReason}`,
      device: 'Portal Console',
    });

    this.notify();
    return {
      success: true,
      message: `Withdrawal rejected. No coins were deducted from the player's wallet.`,
    };
  }

  // ---------------------------------------------------------------------------
  // 6. AGENT COMMISSION WITHDRAWAL
  // ---------------------------------------------------------------------------
  public requestAgentCommissionWithdrawal(params: {
    agentId: string;
    amountPaise: number;
    upiId: string;
  }): { success: boolean; message: string } {
    const agent = this.agents.find((a) => a.id === params.agentId);
    if (!agent) return { success: false, message: 'Agent not found.' };

    const commBalance = agent.agentCommissionBalancePaise || 0;
    if (params.amountPaise > commBalance) {
      return {
        success: false,
        message: `Requested amount exceeds Agent Commission Balance (Available: ₹${(commBalance / 100).toLocaleString()}).`,
      };
    }

    agent.agentCommissionBalancePaise = commBalance - params.amountPaise;

    this.recordLedgerEntry({
      userId: agent.id,
      role: 'agent',
      transactionType: 'AGENT_COMMISSION_WITHDRAWAL',
      amountPaise: params.amountPaise,
      balanceBeforePaise: agent.withdrawableBalancePaise,
      balanceAfterPaise: agent.withdrawableBalancePaise,
      bonusBeforePaise: 0,
      bonusAfterPaise: 0,
      referenceId: `AGT-WTH-${Date.now()}`,
      actorId: agent.id,
      status: 'COMPLETED',
      description: `Agent withdrawn ₹${(params.amountPaise / 100).toLocaleString()} from separated Commission Balance to UPI: ${params.upiId}.`,
    });

    this.notify();
    return {
      success: true,
      message: `Commission withdrawal of ₹${(params.amountPaise / 100).toLocaleString()} processed successfully to ${params.upiId}.`,
    };
  }

  // ---------------------------------------------------------------------------
  // 7. REFERRAL SYSTEM
  // ---------------------------------------------------------------------------
  public recordReferralRegistration(referrerCode: string, newPlayer: UserProfile): boolean {
    if (referrerCode.trim().toUpperCase() === newPlayer.referralCode?.toUpperCase()) {
      return false; // Prevent self-referral
    }

    const referrer =
      this.players.find((p) => p.referralCode?.toUpperCase() === referrerCode.trim().toUpperCase()) ||
      this.agents.find((a) => a.referralCode?.toUpperCase() === referrerCode.trim().toUpperCase());

    if (!referrer) return false;

    const record: ReferralRecord = {
      id: `REF-${Date.now()}`,
      referrerUserId: referrer.id,
      referredUserId: newPlayer.id,
      referredUserName: newPlayer.displayName,
      referralCode: referrerCode.trim().toUpperCase(),
      status: 'REGISTERED',
      createdAt: new Date().toISOString(),
      idempotencyKey: `IDEM-REF-${referrer.id}-${newPlayer.id}`,
      rewardAmountPaise: 50000, // ₹500
      rewardCredited: false,
    };

    this.referrals.unshift(record);
    newPlayer.referredByUserId = referrer.id;
    this.notify();
    return true;
  }

  public registerPlayer(params: {
    displayName: string;
    phoneNumber: string;
    address?: string;
    pincode?: string;
    referralCode?: string;
    assignedAgentId?: string;
    avatar?: string;
  }): UserProfile {
    const id = `player-${Date.now()}`;
    const code = 'WIN' + Math.floor(1000 + Math.random() * 9000) + params.displayName.slice(0, 3).toUpperCase();
    const newPlayer: UserProfile = {
      id,
      displayName: params.displayName,
      phoneNumber: params.phoneNumber,
      role: 'player',
      walletBalance: 0,
      mainBalance: 0,
      withdrawableBalancePaise: 0, // ₹0.00 Initial Withdrawable Balance
      bonusBalancePaise: 0, // ₹0.00 Initial Bonus Balance
      agentCommissionBalancePaise: 0,
      tier: 'Bronze',
      level: 1,
      status: 'active',
      referralCode: code,
      assignedAgentId: params.assignedAgentId || 'agent-vikram',
      assignedAgentName: 'Vikram Sharma (Agent)',
      address: params.address,
      pincode: params.pincode,
      avatar: '',
      joinedDate: new Date().toISOString(),
      currency: { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
      stats: {
        gamesPlayed: 0,
        highestVirtualWin: 0,
        favoriteCategory: 'Hourly Play',
        winRate: '0%',
      },
    };

    this.players.push(newPlayer);
    this.currentUser = newPlayer;

    if (params.referralCode) {
      this.recordReferralRegistration(params.referralCode, newPlayer);
    }

    this.notify();
    return newPlayer;
  }

  public addPlayerDemoCredits(amountRupees: number = 1000): void {
    const paise = Math.round(amountRupees * 100);
    this.currentUser.withdrawableBalancePaise += paise;
    this.currentUser.walletBalance = Math.floor(this.currentUser.withdrawableBalancePaise / 100);
    this.currentUser.mainBalance = Math.floor(
      (this.currentUser.withdrawableBalancePaise + this.currentUser.bonusBalancePaise) / 100
    );
    this.notify();
  }

  // ---------------------------------------------------------------------------
  // 8. BIDDING & 15-MINUTE FREEZE ENGINE (Integer Paise)
  // Max 37 unique numbers allowed per round
  // ---------------------------------------------------------------------------
  public placeBids(params: {
    gameId: WinoraGameId;
    bids: { number: number; amount: number; color?: 'GREEN' | 'RED' }[];
    walletType?: 'main';
  }): { success: boolean; message: string; totalDebitedPaise: number } {
    const { gameId, bids } = params;
    // Map alias if needed
    const resolvedGameId =
      gameId === 'game_x' ? 'kalyan_morning' :
      gameId === 'game_y' ? 'kalyan' :
      gameId === 'game_z' ? 'kalyan_night' :
      gameId === 'hourly_dhamaka' ? 'hourly_play' : gameId;

    const round = this.rounds[resolvedGameId] || this.rounds[gameId];
    if (!round) {
      return { success: false, message: 'Invalid game round.', totalDebitedPaise: 0 };
    }

    // Strict Freeze & Close Check
    const now = Date.now();
    const freezeTimestamp = new Date(round.freezeTime).getTime();
    const isKalyan = resolvedGameId.startsWith('kalyan');

    if (now >= freezeTimestamp || round.status === 'frozen' || round.status === 'completed') {
      return {
        success: false,
        message: isKalyan
          ? 'Bidding is strictly CLOSED! Kalyan markets close 2 hours prior to result declaration.'
          : 'Bidding is strictly FROZEN! Hourly bids freeze 15 minutes prior to result declaration.',
        totalDebitedPaise: 0,
      };
    }

    // Constraint: Up to 37 unique numbers per round
    const uniqueNumbers = new Set(bids.map((b) => b.number));
    if (uniqueNumbers.size > 37) {
      return {
        success: false,
        message: 'Maximum 37 unique numbers limit exceeded per round.',
        totalDebitedPaise: 0,
      };
    }

    const totalAmountRupees = bids.reduce((acc, b) => acc + b.amount, 0);
    const totalAmountPaise = Math.round(totalAmountRupees * 100);

    if (totalAmountPaise <= 0) {
      return { success: false, message: 'Please enter a valid bid amount.', totalDebitedPaise: 0 };
    }

    // Check Withdrawable Balance (bids are debited from Withdrawable Balance)
    if (this.currentUser.withdrawableBalancePaise < totalAmountPaise) {
      return {
        success: false,
        message: `Insufficient Withdrawable Balance (Available: ₹${(this.currentUser.withdrawableBalancePaise / 100).toLocaleString()}).`,
        totalDebitedPaise: 0,
      };
    }

    const balanceBefore = this.currentUser.withdrawableBalancePaise;

    // Atomically debit stake in paise
    this.currentUser.withdrawableBalancePaise -= totalAmountPaise;
    this.currentUser.walletBalance = Math.floor(this.currentUser.withdrawableBalancePaise / 100);
    this.currentUser.mainBalance = Math.floor(
      (this.currentUser.withdrawableBalancePaise + this.currentUser.bonusBalancePaise) / 100
    );

    const gameConfig = WINORA_GAMES.find((g) => g.id === resolvedGameId);

    bids.forEach((b) => {
      const explicitColor = b.color || (isNumberGreen(b.number) ? 'GREEN' : 'RED');
      const isGreen = explicitColor === 'GREEN';
      const newBid: BidRecord = {
        id: `bid-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        gameId: resolvedGameId,
        gameName: gameConfig?.name || round.gameName,
        roundId: round.id,
        userId: this.currentUser.id,
        userName: this.currentUser.displayName,
        number: b.number,
        amount: b.amount,
        walletUsed: 'main',
        isGreen,
        status: 'placed',
        payoutAmount: 0,
        refundAmount: 0,
        createdAt: new Date().toISOString(),
      };
      this.bids.unshift(newBid);
    });

    round.totalBidsPool += totalAmountRupees;

    // Create Immutable Ledger Entry
    this.recordLedgerEntry({
      userId: this.currentUser.id,
      role: 'player',
      transactionType: 'GAME_STAKE',
      amountPaise: totalAmountPaise,
      balanceBeforePaise: balanceBefore,
      balanceAfterPaise: this.currentUser.withdrawableBalancePaise,
      bonusBeforePaise: this.currentUser.bonusBalancePaise,
      bonusAfterPaise: this.currentUser.bonusBalancePaise,
      gameId: resolvedGameId,
      roundId: round.id,
      actorId: this.currentUser.id,
      status: 'COMPLETED',
      description: `Placed ${bids.length} number bid(s) totaling ₹${totalAmountRupees.toLocaleString()} on ${round.gameName}.`,
    });

    this.notify();
    return {
      success: true,
      message: `Successfully placed ${bids.length} bid(s) for ₹${totalAmountRupees.toLocaleString()}!`,
      totalDebitedPaise: totalAmountPaise,
    };
  }

  // ---------------------------------------------------------------------------
  // 10. NUMBER-WISE HOUSE PROFIT/LOSS & MASTER ACCOUNTING (00 TO 99)
  // ---------------------------------------------------------------------------
  public calculateNumberWisePnL(gameId: WinoraGameId): {
    rows: NumberAccountingRow[];
    totalStakePaise: number;
    totalPlayers: number;
    totalPayoutPaise: number;
    totalProtectionPaise: number;
    netHousePnLPaise: number;
    highestLossNumber: number;
    highestProfitNumber: number;
  } {
    const resolvedGameId: string =
      gameId === 'game_x' ? 'kalyan_morning' :
      gameId === 'game_y' ? 'kalyan' :
      gameId === 'game_z' ? 'kalyan_night' :
      gameId === 'hourly_dhamaka' ? 'hourly_play' : gameId;

    const round = this.rounds[resolvedGameId] || this.rounds[gameId];
    const roundBids = this.bids.filter((b) => b.roundId === round.id);

    const totalStakePaise = roundBids.reduce((acc, b) => acc + Math.round(b.amount * 100), 0);
    const uniquePlayers = new Set(roundBids.map((b) => b.userId));

    const isHourly = resolvedGameId === 'hourly_play' || gameId === 'hourly_dhamaka';

    const rows: NumberAccountingRow[] = [];
    let highestProfitNumber = 0;
    let highestLossNumber = 0;
    let maxProfitPaise = -Infinity;
    let maxLossPaise = Infinity;

    for (let i = 0; i < 100; i++) {
      const numberBids = roundBids.filter((b) => b.number === i);
      const numberStakePaise = numberBids.reduce((acc, b) => acc + Math.round(b.amount * 100), 0);
      const numberPlayers = new Set(numberBids.map((b) => b.userId)).size;

      // Normal 90x liability if number `i` wins
      const payoutLiabilityPaise = numberStakePaise * 90;

      // Hourly Protection Liability:
      // Even result = GREEN, Odd result = RED.
      // If `i` is Even (GREEN), all eligible green bidders get 80% refund as Bonus Balance
      // If `i` is Odd (RED), all eligible red bidders get 80% refund as Bonus Balance
      let protectionLiabilityPaise = 0;
      if (isHourly) {
        const winningColor = i % 2 === 0 ? 'GREEN' : 'RED';
        const eligibleProtectionBids = roundBids.filter((b) => {
          const isBidGreen = b.isGreen ?? (b.number % 2 === 0);
          return winningColor === 'GREEN' ? isBidGreen : !isBidGreen;
        });

        // Sum stake of protected side excluding exact winning number (which gets 90x)
        const eligibleProtectionStakePaise = eligibleProtectionBids
          .filter((b) => b.number !== i)
          .reduce((acc, b) => acc + Math.round(b.amount * 100), 0);

        protectionLiabilityPaise = Math.round(eligibleProtectionStakePaise * 0.8);
      }

      const netHouseProfitLossPaise = totalStakePaise - (payoutLiabilityPaise + protectionLiabilityPaise);

      if (netHouseProfitLossPaise > maxProfitPaise) {
        maxProfitPaise = netHouseProfitLossPaise;
        highestProfitNumber = i;
      }
      if (netHouseProfitLossPaise < maxLossPaise) {
        maxLossPaise = netHouseProfitLossPaise;
        highestLossNumber = i;
      }

      rows.push({
        number: i,
        formattedNumber: i.toString().padStart(2, '0'),
        color: isNumberGreen(i) ? 'GREEN' : 'RED',
        totalBidPaise: numberStakePaise,
        playerCount: numberPlayers,
        winningStakePaise: numberStakePaise,
        payoutLiabilityPaise,
        protectionLiabilityPaise,
        netHouseProfitLossPaise,
      });
    }

    return {
      rows,
      totalStakePaise,
      totalPlayers: uniquePlayers.size,
      totalPayoutPaise: rows[highestLossNumber]?.payoutLiabilityPaise || 0,
      totalProtectionPaise: rows[highestLossNumber]?.protectionLiabilityPaise || 0,
      netHousePnLPaise: maxProfitPaise,
      highestLossNumber,
      highestProfitNumber,
    };
  }

  // Legacy alias method for components expecting calculate00to99Risk
  public calculate00to99Risk(gameId: WinoraGameId): {
    items: NumberRiskItem[];
    totalPool: number;
    highestProfitNumber: number;
    highestLossNumber: number;
    maxProfitAmount: number;
    maxLossAmount: number;
  } {
    const pnl = this.calculateNumberWisePnL(gameId);
    return {
      items: pnl.rows.map((r) => ({
        number: r.number,
        formattedNumber: r.formattedNumber,
        isGreen: r.color === 'GREEN',
        totalBids: r.totalBidPaise / 100,
        bidCount: r.playerCount,
        payout90x: r.payoutLiabilityPaise / 100,
        greenRefunds: r.protectionLiabilityPaise / 100,
        netMasterPnL: r.netHouseProfitLossPaise / 100,
      })),
      totalPool: pnl.totalStakePaise / 100,
      highestProfitNumber: pnl.highestProfitNumber,
      highestLossNumber: pnl.highestLossNumber,
      maxProfitAmount: (pnl.rows[pnl.highestProfitNumber]?.netHouseProfitLossPaise || 0) / 100,
      maxLossAmount: (pnl.rows[pnl.highestLossNumber]?.netHouseProfitLossPaise || 0) / 100,
    };
  }

  // ---------------------------------------------------------------------------
  // 11. MASTER SETTLEMENT: DECLARE WINNING NUMBER & SETTLE IDEMPOTENTLY
  // ---------------------------------------------------------------------------
  public declareWinningNumber(
    gameId: WinoraGameId,
    winningNumber: number
  ): {
    success: boolean;
    message: string;
    totalWinnersPaidPaise: number;
    totalProtectionPaidPaise: number;
    netHousePnLPaise: number;
  } {
    const resolvedGameId: string =
      gameId === 'game_x' ? 'kalyan_morning' :
      gameId === 'game_y' ? 'kalyan' :
      gameId === 'game_z' ? 'kalyan_night' :
      gameId === 'hourly_dhamaka' ? 'hourly_play' : gameId;

    const round = this.rounds[resolvedGameId] || this.rounds[gameId];
    if (!round) {
      return {
        success: false,
        message: 'Invalid round',
        totalWinnersPaidPaise: 0,
        totalProtectionPaidPaise: 0,
        netHousePnLPaise: 0,
      };
    }

    round.resultNumber = winningNumber.toString().padStart(2, '0');
    round.status = 'completed';
    round.declaredAt = new Date().toISOString();

    const isHourly = resolvedGameId === 'hourly_play' || gameId === 'hourly_dhamaka';
    const winningColor: 'GREEN' | 'RED' = winningNumber % 2 === 0 ? 'GREEN' : 'RED';
    round.resultColor = winningColor;

    const roundBids = this.bids.filter((b) => b.roundId === round.id);

    let totalWinnersPaidPaise = 0;
    let totalProtectionPaidPaise = 0;
    const totalPoolPaise = roundBids.reduce((acc, b) => acc + Math.round(b.amount * 100), 0);

    roundBids.forEach((bid) => {
      const player = this.players.find((p) => p.id === bid.userId) || this.currentUser;

      if (bid.number === winningNumber) {
        // WINNER! 90x Payout credited to Withdrawable Balance
        const winPayoutRupees = bid.amount * 90;
        const winPayoutPaise = winPayoutRupees * 100;
        bid.status = 'won';
        bid.payoutAmount = winPayoutRupees;

        const balanceBefore = player.withdrawableBalancePaise;
        player.withdrawableBalancePaise += winPayoutPaise;
        player.walletBalance = Math.floor(player.withdrawableBalancePaise / 100);
        player.mainBalance = Math.floor((player.withdrawableBalancePaise + player.bonusBalancePaise) / 100);
        totalWinnersPaidPaise += winPayoutPaise;

        // Record Win in ledger
        this.recordLedgerEntry({
          userId: player.id,
          role: 'player',
          transactionType: 'GAME_WIN',
          amountPaise: winPayoutPaise,
          balanceBeforePaise: balanceBefore,
          balanceAfterPaise: player.withdrawableBalancePaise,
          bonusBeforePaise: player.bonusBalancePaise,
          bonusAfterPaise: player.bonusBalancePaise,
          gameId: resolvedGameId,
          roundId: round.id,
          actorId: 'system',
          status: 'COMPLETED',
          description: `90× Winning payout on Number #${winningNumber.toString().padStart(2, '0')} for ${round.gameName}.`,
        });

        this.history.unshift({
          id: `act-win-${Date.now()}-${bid.id}`,
          type: 'win',
          title: `${round.gameName}: 90× Win on #${winningNumber.toString().padStart(2, '0')}`,
          amount: winPayoutRupees,
          wallet: 'main',
          status: 'won',
          timestamp: new Date().toISOString(),
          details: `Bid ₹${bid.amount} × 90 = ₹${winPayoutRupees.toLocaleString()} credited to Withdrawable Balance!`,
          gameName: round.gameName,
        });
      } else if (isHourly) {
        // Hourly Play Protection:
        // If result is GREEN (Even): eligible GREEN bidders receive 80% of green stake as BONUS BALANCE
        // If result is RED (Odd): eligible RED bidders receive 80% of red stake as BONUS BALANCE
        const bidIsGreen = bid.isGreen ?? (bid.number % 2 === 0);
        const matchesWinningSide = winningColor === 'GREEN' ? bidIsGreen : !bidIsGreen;

        if (matchesWinningSide) {
          const refundRupees = Math.round(bid.amount * 0.8);
          const refundPaise = refundRupees * 100;
          bid.status = 'refunded';
          bid.refundAmount = refundRupees;

          const bonusBefore = player.bonusBalancePaise;
          // Protection is credited strictly to non-withdrawable Bonus Balance
          player.bonusBalancePaise += refundPaise;
          player.mainBalance = Math.floor((player.withdrawableBalancePaise + player.bonusBalancePaise) / 100);
          totalProtectionPaidPaise += refundPaise;

          this.recordLedgerEntry({
            userId: player.id,
            role: 'player',
            transactionType: 'HOURLY_PROTECTION',
            amountPaise: refundPaise,
            balanceBeforePaise: player.withdrawableBalancePaise,
            balanceAfterPaise: player.withdrawableBalancePaise,
            bonusBeforePaise: bonusBefore,
            bonusAfterPaise: player.bonusBalancePaise,
            gameId: resolvedGameId,
            roundId: round.id,
            actorId: 'system',
            status: 'COMPLETED',
            description: `80% Hourly Protection on ${winningColor} side credited to Bonus Balance.`,
          });

          this.history.unshift({
            id: `act-ref-${Date.now()}-${bid.id}`,
            type: 'refund',
            title: `Hourly Play: 80% Protection Refund on #${bid.number.toString().padStart(2, '0')}`,
            amount: refundRupees,
            wallet: 'main',
            status: 'refunded',
            timestamp: new Date().toISOString(),
            details: `Result was #${winningNumber.toString().padStart(2, '0')} (${winningColor}). 80% refund (₹${refundRupees}) credited to Bonus Balance.`,
            gameName: round.gameName,
          });
        } else {
          bid.status = 'lost';
        }
      } else {
        bid.status = 'lost';
      }
    });

    const netHousePnLPaise = totalPoolPaise - (totalWinnersPaidPaise + totalProtectionPaidPaise);

    this.recordAuditLog({
      actorId: 'master-admin',
      role: 'master',
      action: 'MASTER_DECLARED_RESULT',
      targetId: round.id,
      newValue: `Declared #${winningNumber.toString().padStart(2, '0')} (${winningColor}). Total payout: ₹${(totalWinnersPaidPaise / 100).toLocaleString()}, Protection: ₹${(totalProtectionPaidPaise / 100).toLocaleString()}, Net P/L: ₹${(netHousePnLPaise / 100).toLocaleString()}`,
      device: 'Master Console',
    });

    // Advance round to new round
    const nowMs = Date.now();
    const isHourlyRound = resolvedGameId === 'hourly_play' || resolvedGameId === 'hourly_dhamaka';
    const isKalyanRound = resolvedGameId.startsWith('kalyan');
    const freezeBufferMinutes = isKalyanRound ? 120 : 15;
    const durationMinutes = isHourlyRound ? 60 : 360;
    const nextFreezeTime = new Date(nowMs + Math.max(5, durationMinutes - freezeBufferMinutes) * 60000).toISOString();
    const nextDeclareTime = new Date(nowMs + durationMinutes * 60000).toISOString();

    this.rounds[resolvedGameId] = {
      id: `round-${resolvedGameId}-${round.roundNumber + 1}`,
      gameId: resolvedGameId,
      gameName: round.gameName,
      roundNumber: round.roundNumber + 1,
      freezeTime: nextFreezeTime,
      declareTime: nextDeclareTime,
      status: 'open',
      totalBidsPool: 0,
    };

    this.notify();
    return {
      success: true,
      message: `Winning number #${winningNumber.toString().padStart(2, '0')} declared! 90× Payouts (₹${(totalWinnersPaidPaise / 100).toLocaleString()}) & Protection (₹${(totalProtectionPaidPaise / 100).toLocaleString()}) settled. House Net P/L: ₹${(netHousePnLPaise / 100).toLocaleString()}`,
      totalWinnersPaidPaise,
      totalProtectionPaidPaise,
      netHousePnLPaise,
    };
  }

  // ---------------------------------------------------------------------------
  // 14. MASTER WALLET DASHBOARD STATS
  // ---------------------------------------------------------------------------
  public getMasterDashboardStats(): MasterDashboardStats {
    const totalPlayerBalancesPaise = this.players.reduce(
      (sum, p) => sum + p.withdrawableBalancePaise,
      0
    );
    const totalBonusBalancesPaise = this.players.reduce(
      (sum, p) => sum + p.bonusBalancePaise,
      0
    );

    const pendingDeposits = this.depositRequests.filter((d) => d.status === 'PENDING');
    const approvedDeposits = this.depositRequests.filter((d) => d.status === 'APPROVED');
    const pendingWithdrawals = this.withdrawalRequests.filter((w) => w.status === 'PENDING');
    const completedWithdrawals = this.withdrawalRequests.filter((w) => w.status === 'APPROVED');

    const agentCommissionsPaise = this.agents.reduce(
      (sum, a) => sum + (a.agentCommissionBalancePaise || 0),
      0
    );

    const totalGameStakesPaise = this.bids.reduce((sum, b) => sum + Math.round(b.amount * 100), 0);
    const totalPayoutsPaise = this.bids.reduce((sum, b) => sum + Math.round((b.payoutAmount || 0) * 100), 0);
    const totalProtectionPaise = this.bids.reduce((sum, b) => sum + Math.round((b.refundAmount || 0) * 100), 0);
    const houseProfitLossPaise = totalGameStakesPaise - totalPayoutsPaise - totalProtectionPaise;

    return {
      totalPlayerBalancesPaise,
      totalBonusBalancesPaise,
      pendingDepositsCount: pendingDeposits.length,
      pendingDepositsPaise: pendingDeposits.reduce((sum, d) => sum + d.submittedAmountPaise, 0),
      approvedDepositsCount: approvedDeposits.length,
      approvedDepositsPaise: approvedDeposits.reduce(
        (sum, d) => sum + (d.approvedAmountPaise || d.submittedAmountPaise),
        0
      ),
      pendingWithdrawalsCount: pendingWithdrawals.length,
      pendingWithdrawalsPaise: pendingWithdrawals.reduce((sum, w) => sum + w.amountPaise, 0),
      completedWithdrawalsCount: completedWithdrawals.length,
      completedWithdrawalsPaise: completedWithdrawals.reduce((sum, w) => sum + w.amountPaise, 0),
      agentCommissionsPaise,
      totalGameStakesPaise,
      totalPayoutsPaise,
      totalProtectionPaise,
      houseProfitLossPaise,
    };
  }

  // Handshake request
  public requestHandshake(params: {
    type: 'deposit' | 'withdrawal';
    amount: number;
    agentId: string;
    notes?: string;
    payoutDetails?: { upiId?: string; accountNumber?: string; ifsc?: string };
  }): { success: boolean; message: string; transactionId?: string } {
    const agent = this.agents.find((a) => a.id === params.agentId) || this.agents[0];
    const txId = `HSK-${Date.now()}`;
    const amountPaise = Math.round(params.amount * 100);

    if (params.type === 'withdrawal') {
      if (this.currentUser.withdrawableBalancePaise < amountPaise) {
        return {
          success: false,
          message: `Insufficient Withdrawable Balance (₹${(this.currentUser.withdrawableBalancePaise / 100).toLocaleString()} available).`,
        };
      }
      this.currentUser.withdrawableBalancePaise -= amountPaise;
      this.currentUser.walletBalance = Math.floor(this.currentUser.withdrawableBalancePaise / 100);
      this.currentUser.mainBalance = Math.floor(
        (this.currentUser.withdrawableBalancePaise + this.currentUser.bonusBalancePaise) / 100
      );
    }

    const newTx: HandshakeTransaction = {
      id: txId,
      type: params.type,
      amount: params.amount,
      senderId: this.currentUser.id,
      senderName: this.currentUser.displayName,
      senderPhone: this.currentUser.phoneNumber,
      receiverId: agent.id,
      agentName: agent.displayName,
      agentPhone: agent.phoneNumber,
      status: 'pending',
      createdAt: new Date().toISOString(),
      notes: params.notes,
      payoutDetails: params.payoutDetails,
    };

    this.handshakes.unshift(newTx);
    this.notify();

    return {
      success: true,
      message: `${params.type === 'deposit' ? 'Deposit' : 'Withdrawal'} handshake request of ₹${params.amount.toLocaleString()} forwarded to Agent ${agent.displayName}.`,
      transactionId: txId,
    };
  }

  // Handshake approval
  public approveHandshake(transactionId: string): { success: boolean; message: string } {
    const tx = this.handshakes.find((t) => t.id === transactionId);
    if (!tx) return { success: false, message: 'Transaction not found.' };
    if (tx.status !== 'pending') return { success: false, message: 'Transaction already processed.' };

    tx.status = 'completed';
    const player = this.players.find((p) => p.id === tx.senderId) || this.currentUser;

    if (tx.type === 'deposit') {
      const amountPaise = tx.amount * 100;
      player.withdrawableBalancePaise += amountPaise;
      player.walletBalance = Math.floor(player.withdrawableBalancePaise / 100);
      player.mainBalance = Math.floor((player.withdrawableBalancePaise + player.bonusBalancePaise) / 100);

      this.recordLedgerEntry({
        userId: player.id,
        role: 'player',
        transactionType: 'DEPOSIT_APPROVED',
        amountPaise,
        balanceBeforePaise: player.withdrawableBalancePaise - amountPaise,
        balanceAfterPaise: player.withdrawableBalancePaise,
        bonusBeforePaise: player.bonusBalancePaise,
        bonusAfterPaise: player.bonusBalancePaise,
        referenceId: tx.id,
        actorId: tx.receiverId,
        status: 'COMPLETED',
        description: `Agent ${tx.agentName} verified deposit handshake of ₹${tx.amount.toLocaleString()}.`,
      });
    }

    this.notify();
    return { success: true, message: 'Handshake completed successfully.' };
  }

  public rejectHandshake(transactionId: string, reason: string): { success: boolean; message: string } {
    const tx = this.handshakes.find((t) => t.id === transactionId);
    if (!tx) return { success: false, message: 'Transaction not found.' };
    if (tx.status !== 'pending') return { success: false, message: 'Transaction already processed.' };

    tx.status = 'rejected';
    tx.notes = `Rejected by Agent: ${reason}`;

    if (tx.type === 'withdrawal') {
      const player = this.players.find((p) => p.id === tx.senderId) || this.currentUser;
      const amountPaise = tx.amount * 100;
      player.withdrawableBalancePaise += amountPaise;
      player.walletBalance = Math.floor(player.withdrawableBalancePaise / 100);
      player.mainBalance = Math.floor((player.withdrawableBalancePaise + player.bonusBalancePaise) / 100);
    }

    this.notify();
    return { success: true, message: 'Handshake rejected.' };
  }

  public toggleUserBlockStatus(userId: string): { success: boolean; newStatus: 'active' | 'blocked' } {
    const player = this.players.find((p) => p.id === userId);
    if (player) {
      player.status = player.status === 'active' ? 'blocked' : 'active';
      this.notify();
      return { success: true, newStatus: player.status };
    }

    const agent = this.agents.find((a) => a.id === userId);
    if (agent) {
      agent.status = agent.status === 'active' ? 'blocked' : 'active';
      this.notify();
      return { success: true, newStatus: agent.status };
    }

    return { success: false, newStatus: 'active' };
  }
}

export const winoraEngine = new WinoraStateManager();
