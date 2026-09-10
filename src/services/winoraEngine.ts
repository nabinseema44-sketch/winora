/**
 * WINORA Core Game & Financial Engine
 * Implements:
 * - Role Hierarchy: Master -> Agent -> Player
 * - Dual Wallet System: Main Wallet (Withdrawable) + Bonus Wallet (Play-Only)
 * - Games: Games X, Y, Z (90x) + Hourly Dhamaka (90x + 80% Green Refund)
 * - 15-Minute Bidding Freeze Logic
 * - Dual-Confirmation Handshake (Deposit & Withdrawal)
 * - Referral Engine (50% Main / 50% Bonus on 1st Deposit + 10% Agent Commission)
 * - Real-time 00-99 Risk & Payout Calculator with Master P&L
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
} from '../types.ts';

export const WINORA_GAMES: WinoraGameConfig[] = [
  {
    id: 'game_x',
    name: 'Game X',
    code: 'GX-90',
    subtitle: 'Standard 00–99 High-Yield Draw',
    payoutMultiplier: 90,
    hasGreenRefund: false,
    description: 'Select lucky numbers between 00 and 99. Exact match delivers a direct 90× payout to your Main Wallet.',
    accentColor: 'from-amber-500 to-orange-500',
    intervalMinutes: 60,
  },
  {
    id: 'game_y',
    name: 'Game Y',
    code: 'GY-90',
    subtitle: 'Afternoon Prime Matrix Draw',
    payoutMultiplier: 90,
    hasGreenRefund: false,
    description: 'Midday high-roller matrix. Place single or spread bids across 00–99 with a fixed 90× multiplier.',
    accentColor: 'from-cyan-500 to-blue-500',
    intervalMinutes: 60,
  },
  {
    id: 'game_z',
    name: 'Game Z',
    code: 'GZ-90',
    subtitle: 'Night Royal 90× Draw',
    payoutMultiplier: 90,
    hasGreenRefund: false,
    description: 'Evening flagship draw with deep liquidity. Single-number 90× return with instant automated settlement.',
    accentColor: 'from-purple-500 to-pink-500',
    intervalMinutes: 60,
  },
  {
    id: 'hourly_dhamaka',
    name: 'Hourly Dhamaka',
    code: 'HD-80G',
    subtitle: '90× Payout + 80% Green Protection Refund',
    payoutMultiplier: 90,
    hasGreenRefund: true,
    refundPercentage: 80,
    description: '50 Green Numbers (00–49) & 50 Red Numbers (50–99). If your Green number does not win, receive an automatic 80% refund!',
    accentColor: 'from-emerald-500 to-teal-500',
    intervalMinutes: 60,
  },
];

// Helper to check if a number is designated Green (50% green split: 00-49)
export function isNumberGreen(num: number): boolean {
  return num >= 0 && num <= 49;
}

// Initial Agent profiles
export const MOCK_AGENTS: UserProfile[] = [
  {
    id: 'agent-vikram',
    displayName: 'Vikram Sharma (Agent)',
    phoneNumber: '+91 98765 11223',
    walletBalance: 45000,
    mainBalance: 45000,
    bonusBalance: 0,
    currency: { code: 'INR', symbol: '₹', name: 'Indian Rupee (₹)' },
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    tier: 'Diamond',
    joinedDate: 'January 2026',
    level: 12,
    role: 'agent',
    status: 'active',
    address: 'Sector 18, Cyber City, Gurugram',
    pincode: '122002',
    stats: {
      gamesPlayed: 0,
      highestVirtualWin: 0,
      favoriteCategory: 'Hourly Dhamaka',
      winRate: '98% Agent SLA',
    },
  },
  {
    id: 'agent-rahul',
    displayName: 'Rahul Verma (Agent)',
    phoneNumber: '+91 98111 22334',
    walletBalance: 32000,
    mainBalance: 32000,
    bonusBalance: 0,
    currency: { code: 'INR', symbol: '₹', name: 'Indian Rupee (₹)' },
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    tier: 'Gold',
    joinedDate: 'February 2026',
    level: 8,
    role: 'agent',
    status: 'active',
    address: 'Brigade Road, Bengaluru',
    pincode: '560001',
    stats: {
      gamesPlayed: 0,
      highestVirtualWin: 0,
      favoriteCategory: 'Game X',
      winRate: '99% Agent SLA',
    },
  },
];

// Initial Master profile
export const MOCK_MASTER: UserProfile = {
  id: 'master-admin',
  displayName: 'WINORA Master SuperAdmin',
  phoneNumber: '+91 90000 00001',
  walletBalance: 1250000,
  mainBalance: 1250000,
  bonusBalance: 0,
  currency: { code: 'INR', symbol: '₹', name: 'Indian Rupee (₹)' },
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  tier: 'Diamond',
  joinedDate: 'January 2025',
  level: 99,
  role: 'master',
  status: 'active',
  address: 'WINORA HQ, High-Tech Core',
  pincode: '500081',
  stats: {
    gamesPlayed: 0,
    highestVirtualWin: 0,
    favoriteCategory: 'Master Controls',
    winRate: 'System Authority',
  },
};

// Initial Player profile
export const DEFAULT_PLAYER: UserProfile = {
  id: 'player-arjun',
  displayName: 'Arjun Mehta',
  phoneNumber: '+91 98765 43210',
  walletBalance: 3500,
  mainBalance: 2500, // Withdrawable
  bonusBalance: 1000, // Play-Only Bonus
  currency: { code: 'INR', symbol: '₹', name: 'Indian Rupee (₹)' },
  avatar: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=150&auto=format&fit=crop&q=80',
  tier: 'Silver',
  joinedDate: 'March 2026',
  level: 3,
  role: 'user',
  status: 'active',
  address: '42 Lotus Colony, Indiranagar',
  pincode: '560038',
  assignedAgentId: 'agent-vikram',
  assignedAgentName: 'Vikram Sharma (Agent)',
  assignedAgentPhone: '+91 98765 11223',
  referrerId: 'player-sumit',
  hasMadeFirstDeposit: true,
  stats: {
    gamesPlayed: 34,
    highestVirtualWin: 9000,
    favoriteCategory: 'Hourly Dhamaka',
    winRate: '32%',
  },
};

// Helper to create future round times with 15-minute freeze cutoff
function createRoundTimes(minuteOffset: number) {
  const now = new Date();
  // Align declare time to next scheduled minuteOffset
  const declare = new Date(now.getTime() + minuteOffset * 60 * 1000);
  // Freeze time is strictly 15 minutes before declare time
  const freeze = new Date(declare.getTime() - 15 * 60 * 1000);
  return {
    declareTime: declare.toISOString(),
    freezeTime: freeze.toISOString(),
  };
}

// Initial active rounds for each of the 4 games
export function generateInitialRounds(): Record<WinoraGameId, GameRound> {
  const tX = createRoundTimes(28); // 28 mins left -> freeze in 13 mins
  const tY = createRoundTimes(45); // 45 mins left -> freeze in 30 mins
  const tZ = createRoundTimes(14); // 14 mins left -> ALREADY FROZEN (< 15 mins)
  const tD = createRoundTimes(35); // 35 mins left -> freeze in 20 mins

  return {
    game_x: {
      id: 'round-gx-101',
      gameId: 'game_x',
      gameName: 'Game X (90×)',
      roundNumber: 101,
      freezeTime: tX.freezeTime,
      declareTime: tX.declareTime,
      status: 'open',
      totalBidsPool: 24500,
    },
    game_y: {
      id: 'round-gy-204',
      gameId: 'game_y',
      gameName: 'Game Y (90×)',
      roundNumber: 204,
      freezeTime: tY.freezeTime,
      declareTime: tY.declareTime,
      status: 'open',
      totalBidsPool: 18200,
    },
    game_z: {
      id: 'round-gz-309',
      gameId: 'game_z',
      gameName: 'Game Z (90×)',
      roundNumber: 309,
      freezeTime: tZ.freezeTime,
      declareTime: tZ.declareTime,
      status: 'frozen', // Frozen because < 15 mins remaining
      totalBidsPool: 41200,
    },
    hourly_dhamaka: {
      id: 'round-hd-412',
      gameId: 'hourly_dhamaka',
      gameName: 'Hourly Dhamaka (90× + 80% Green Refund)',
      roundNumber: 412,
      freezeTime: tD.freezeTime,
      declareTime: tD.declareTime,
      status: 'open',
      totalBidsPool: 56800,
    },
  };
}

// Seed mock bids across 00-99 to make the 00-99 Risk & Payout Calculator immediately live & interesting
function generateSeedBids(): BidRecord[] {
  const bids: BidRecord[] = [];
  const numbers = [7, 14, 21, 33, 42, 55, 68, 77, 88, 93, 0, 99, 25, 49, 50, 72];
  
  // Game X bids
  numbers.forEach((num, idx) => {
    bids.push({
      id: `bid-gx-${idx}`,
      gameId: 'game_x',
      gameName: 'Game X',
      roundId: 'round-gx-101',
      userId: idx % 2 === 0 ? 'player-arjun' : 'player-user2',
      userName: idx % 2 === 0 ? 'Arjun Mehta' : 'Rohan Patel',
      number: num,
      amount: (idx + 1) * 100,
      walletUsed: idx % 3 === 0 ? 'bonus' : 'main',
      isGreen: isNumberGreen(num),
      status: 'placed',
      payoutAmount: 0,
      refundAmount: 0,
      createdAt: new Date(Date.now() - (idx + 1) * 120000).toISOString(),
    });
  });

  // Hourly Dhamaka bids
  numbers.forEach((num, idx) => {
    bids.push({
      id: `bid-hd-${idx}`,
      gameId: 'hourly_dhamaka',
      gameName: 'Hourly Dhamaka',
      roundId: 'round-hd-412',
      userId: idx % 2 === 0 ? 'player-arjun' : 'player-user3',
      userName: idx % 2 === 0 ? 'Arjun Mehta' : 'Karan Singh',
      number: num,
      amount: (idx + 2) * 150,
      walletUsed: idx % 2 === 0 ? 'main' : 'bonus',
      isGreen: isNumberGreen(num),
      status: 'placed',
      payoutAmount: 0,
      refundAmount: 0,
      createdAt: new Date(Date.now() - (idx + 1) * 90000).toISOString(),
    });
  });

  return bids;
}

// Initial Handshake Transactions (Dual-confirmation: Player -> Agent)
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
    notes: 'UPI Transfer ref: UPI-84920482029 to Agent Vikram QR',
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
    isFirstDeposit: true, // Will trigger 50% referral bonus + 10% agent commission!
    notes: 'First-time deposit via GPay ref: GP-392019482',
  },
  {
    id: 'tx-hs-103',
    senderId: 'player-arjun',
    senderName: 'Arjun Mehta',
    senderPhone: '+91 98765 43210',
    receiverId: 'agent-vikram',
    agentName: 'Vikram Sharma (Agent)',
    agentPhone: '+91 98765 11223',
    amount: 1000,
    type: 'withdrawal',
    status: 'completed',
    createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    completedAt: new Date(Date.now() - 1 * 3600000).toISOString(),
    notes: 'Withdrawn to UPI: arjun@okaxis (Handshake confirmed by Vikram)',
    payoutDetails: {
      upiId: 'arjun@okaxis',
    },
  },
];

// Initial 30-Day Activity History
export const INITIAL_HISTORY: ActivityHistoryItem[] = [
  {
    id: 'act-1',
    type: 'referral',
    title: 'Referral Bonus (50% Main / 50% Bonus)',
    amount: 500,
    wallet: 'bonus',
    status: 'completed',
    timestamp: new Date(Date.now() - 24 * 3600000).toISOString(),
    details: 'Received ₹500 Bonus Wallet credit from Sumit first deposit.',
    referenceId: 'REF-78491',
  },
  {
    id: 'act-2',
    type: 'win',
    title: 'Game X - 90× Winning Payout!',
    amount: 9000,
    wallet: 'main',
    status: 'won',
    timestamp: new Date(Date.now() - 48 * 3600000).toISOString(),
    details: 'Lucky #42 drawn! Bet ₹100 × 90 = ₹9,000 credited to Main Wallet.',
    gameName: 'Game X',
    referenceId: 'WIN-90X-42',
  },
  {
    id: 'act-3',
    type: 'refund',
    title: 'Hourly Dhamaka 80% Green Protection Refund',
    amount: 240,
    wallet: 'main',
    status: 'refunded',
    timestamp: new Date(Date.now() - 3 * 3600000).toISOString(),
    details: 'Bet ₹300 on Green #24. Round settled on #68. 80% refund (₹240) credited.',
    gameName: 'Hourly Dhamaka',
    referenceId: 'REFUND-GRN-24',
  },
  {
    id: 'act-4',
    type: 'deposit',
    title: 'Agent Dual-Confirmation Deposit',
    amount: 2500,
    wallet: 'main',
    status: 'completed',
    timestamp: new Date(Date.now() - 72 * 3600000).toISOString(),
    details: 'Handshake completed by Agent Vikram Sharma. Main balance credited.',
    referenceId: 'DEP-HS-2500',
  },
];

/**
 * In-Memory State Manager with Event Subscribers
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
      walletBalance: 1500,
      mainBalance: 1500,
      bonusBalance: 0,
      currency: { code: 'INR', symbol: '₹', name: 'Indian Rupee (₹)' },
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
      tier: 'Bronze',
      joinedDate: 'March 2026',
      level: 1,
      role: 'user',
      status: 'active',
      address: '15 Park Street, Kolkata',
      pincode: '700016',
      assignedAgentId: 'agent-vikram',
      assignedAgentName: 'Vikram Sharma (Agent)',
      hasMadeFirstDeposit: false,
      stats: { gamesPlayed: 5, highestVirtualWin: 900, favoriteCategory: 'Game X', winRate: '20%' },
    },
    {
      id: 'player-sumit',
      displayName: 'Sumit Joshi',
      phoneNumber: '+91 98333 44556',
      walletBalance: 8200,
      mainBalance: 6500,
      bonusBalance: 1700,
      currency: { code: 'INR', symbol: '₹', name: 'Indian Rupee (₹)' },
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
      tier: 'Gold',
      joinedDate: 'February 2026',
      level: 6,
      role: 'user',
      status: 'active',
      address: 'B-12 Civil Lines, Jaipur',
      pincode: '302006',
      assignedAgentId: 'agent-rahul',
      assignedAgentName: 'Rahul Verma (Agent)',
      hasMadeFirstDeposit: true,
      stats: { gamesPlayed: 58, highestVirtualWin: 18000, favoriteCategory: 'Hourly Dhamaka', winRate: '41%' },
    },
  ];

  private rounds: Record<WinoraGameId, GameRound> = generateInitialRounds();
  private bids: BidRecord[] = generateSeedBids();
  private handshakes: HandshakeTransaction[] = [...INITIAL_HANDSHAKES];
  private history: ActivityHistoryItem[] = [...INITIAL_HISTORY];
  private listeners: (() => void)[] = [];

  constructor() {
    // Start live round tick every 5 seconds to update freeze status
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

  // Periodic timer to maintain 15-minute freeze rule
  private tickRoundTimers() {
    const now = Date.now();
    let updated = false;

    (Object.keys(this.rounds) as WinoraGameId[]).forEach((gid) => {
      const round = this.rounds[gid];
      if (round.status === 'open') {
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

  // Role Switching (seamless testing between Master, Agent, and Player)
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

  public registerPlayer(params: {
    displayName: string;
    phoneNumber: string;
    address: string;
    pincode: string;
    referralCode?: string;
    assignedAgentId?: string;
    avatar?: string;
  }): UserProfile {
    const newId = `user-${Date.now().toString().slice(-6)}`;
    const newPlayer: UserProfile = {
      id: newId,
      displayName: params.displayName,
      phoneNumber: params.phoneNumber,
      walletBalance: 1000,
      mainBalance: 0,
      bonusBalance: 1000,
      currency: { code: 'INR', symbol: '₹', name: 'Indian Rupee (₹)' },
      avatar: params.avatar || 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=150&auto=format&fit=crop&q=80',
      tier: 'Bronze',
      joinedDate: 'Just now',
      level: 1,
      role: 'user',
      status: 'active',
      address: params.address,
      pincode: params.pincode,
      assignedAgentId: params.assignedAgentId || this.agents[0].id,
      assignedAgentName: this.agents[0].displayName,
      referrerId: params.referralCode ? 'user-rahul' : undefined,
      hasMadeFirstDeposit: false,
      stats: { gamesPlayed: 0, highestVirtualWin: 0, favoriteCategory: 'Hourly Dhamaka', winRate: '0%' },
    };

    this.players.unshift(newPlayer);
    this.currentUser = newPlayer;
    this.activeRole = 'user';
    this.notify();
    return newPlayer;
  }

  public getCurrentUser(): UserProfile {
    return this.currentUser;
  }

  public updateCurrentUser(updater: Partial<UserProfile>) {
    this.currentUser = { ...this.currentUser, ...updater };
    if (this.currentUser.role === 'user') {
      this.players = this.players.map((p) => (p.id === this.currentUser.id ? this.currentUser : p));
    } else if (this.currentUser.role === 'agent') {
      this.agents = this.agents.map((a) => (a.id === this.currentUser.id ? this.currentUser : a));
    } else if (this.currentUser.role === 'master') {
      this.masterProfile = this.currentUser;
    }
    this.notify();
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

  // ---------------------------------------------------------------------------
  // BIDDING & FREEZE ENGINE
  // Timing Rule: Bidding strictly freezes 15 minutes prior to result declaration
  // ---------------------------------------------------------------------------
  public placeBids(params: {
    gameId: WinoraGameId;
    bids: { number: number; amount: number }[];
    walletType: 'main' | 'bonus';
  }): { success: boolean; message: string; totalDebited: number } {
    const { gameId, bids, walletType } = params;
    const round = this.rounds[gameId];

    if (!round) {
      return { success: false, message: 'Invalid game round.', totalDebited: 0 };
    }

    // Strict 15-Minute Freeze Check
    const now = Date.now();
    const freezeTimestamp = new Date(round.freezeTime).getTime();
    if (now >= freezeTimestamp || round.status === 'frozen' || round.status === 'completed') {
      return {
        success: false,
        message: 'Bidding is strictly FROZEN! Cutoff occurs 15 minutes prior to result declaration.',
        totalDebited: 0,
      };
    }

    const totalAmount = bids.reduce((acc, b) => acc + b.amount, 0);
    if (totalAmount <= 0) {
      return { success: false, message: 'Please enter a valid bid amount.', totalDebited: 0 };
    }

    // Check balance in chosen wallet
    const available =
      walletType === 'bonus' ? this.currentUser.bonusBalance : this.currentUser.mainBalance;

    if (available < totalAmount) {
      return {
        success: false,
        message: `Insufficient ${walletType === 'bonus' ? 'Bonus' : 'Main'} Wallet balance (Available: ₹${available.toLocaleString()}).`,
        totalDebited: 0,
      };
    }

    // Deduct from wallet
    if (walletType === 'bonus') {
      this.currentUser.bonusBalance -= totalAmount;
    } else {
      this.currentUser.mainBalance -= totalAmount;
    }
    this.currentUser.walletBalance = this.currentUser.mainBalance + this.currentUser.bonusBalance;

    const gameConfig = WINORA_GAMES.find((g) => g.id === gameId);

    // Record individual bids
    bids.forEach((b) => {
      const isGreen = isNumberGreen(b.number);
      const newBid: BidRecord = {
        id: `bid-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        gameId,
        gameName: gameConfig?.name || gameId,
        roundId: round.id,
        userId: this.currentUser.id,
        userName: this.currentUser.displayName,
        number: b.number,
        amount: b.amount,
        walletUsed: walletType,
        isGreen,
        status: 'placed',
        payoutAmount: 0,
        refundAmount: 0,
        createdAt: new Date().toISOString(),
      };
      this.bids.unshift(newBid);
    });

    // Update round pool
    round.totalBidsPool += totalAmount;

    // Record Activity History
    this.history.unshift({
      id: `act-bid-${Date.now()}`,
      type: 'bid',
      title: `${gameConfig?.name}: Placed ${bids.length} Bid(s)`,
      amount: totalAmount,
      wallet: walletType,
      status: 'completed',
      timestamp: new Date().toISOString(),
      details: `Numbers: ${bids.map((b) => `#${b.number.toString().padStart(2, '0')} (₹${b.amount})`).join(', ')}`,
      gameName: gameConfig?.name,
    });

    this.notify();
    return {
      success: true,
      message: `Successfully placed ${bids.length} bid(s) totaling ₹${totalAmount.toLocaleString()} using ${walletType === 'bonus' ? 'Bonus' : 'Main'} Wallet.`,
      totalDebited: totalAmount,
    };
  }

  // ---------------------------------------------------------------------------
  // DUAL-CONFIRMATION HANDSHAKE (DEPOSITS & WITHDRAWALS)
  // ---------------------------------------------------------------------------
  public requestHandshake(params: {
    type: 'deposit' | 'withdrawal';
    amount: number;
    agentId: string;
    notes?: string;
    payoutDetails?: { upiId?: string; accountNumber?: string; ifsc?: string };
  }): { success: boolean; message: string; transactionId: string } {
    const { type, amount, agentId, notes, payoutDetails } = params;
    const agent = this.agents.find((a) => a.id === agentId) || this.agents[0];

    if (amount < 100) {
      return { success: false, message: 'Minimum transaction amount is ₹100.', transactionId: '' };
    }

    if (type === 'withdrawal') {
      if (this.currentUser.mainBalance < amount) {
        return {
          success: false,
          message: `Insufficient Main Wallet (Withdrawable) balance. Available: ₹${this.currentUser.mainBalance.toLocaleString()}`,
          transactionId: '',
        };
      }
      // Hold the withdrawal amount
      this.currentUser.mainBalance -= amount;
      this.currentUser.walletBalance = this.currentUser.mainBalance + this.currentUser.bonusBalance;
    }

    const tx: HandshakeTransaction = {
      id: `tx-hs-${Date.now().toString().slice(-6)}`,
      senderId: this.currentUser.id,
      senderName: this.currentUser.displayName,
      senderPhone: this.currentUser.phoneNumber,
      receiverId: agent.id,
      agentName: agent.displayName,
      agentPhone: agent.phoneNumber,
      amount,
      type,
      status: 'pending',
      createdAt: new Date().toISOString(),
      isFirstDeposit: type === 'deposit' && !this.currentUser.hasMadeFirstDeposit,
      notes,
      payoutDetails,
    };

    this.handshakes.unshift(tx);

    this.history.unshift({
      id: `act-hs-${Date.now()}`,
      type,
      title: `${type === 'deposit' ? 'Deposit' : 'Withdrawal'} Request (Handshake Pending)`,
      amount,
      wallet: 'main',
      status: 'pending',
      timestamp: new Date().toISOString(),
      details: `Assigned Agent: ${agent.displayName} (${agent.phoneNumber}). Awaiting agent dual-confirmation.`,
      referenceId: tx.id,
    });

    this.notify();
    return {
      success: true,
      message: `Handshake request submitted! Agent ${agent.displayName} will confirm and settle your ${type}.`,
      transactionId: tx.id,
    };
  }

  // Agent Dual-Confirmation Handshake Approval
  public approveHandshake(transactionId: string): { success: boolean; message: string } {
    const tx = this.handshakes.find((t) => t.id === transactionId);
    if (!tx) return { success: false, message: 'Transaction not found.' };
    if (tx.status !== 'pending') return { success: false, message: 'Transaction is already processed.' };

    tx.status = 'completed';
    tx.completedAt = new Date().toISOString();

    const player = this.players.find((p) => p.id === tx.senderId) || this.currentUser;
    const agent = this.agents.find((a) => a.id === tx.receiverId);

    if (tx.type === 'deposit') {
      // 1. Credit player main wallet
      player.mainBalance += tx.amount;
      player.walletBalance = player.mainBalance + player.bonusBalance;

      // 2. REFERRAL TRIGGER: Player -> Player 1st Deposit
      // 50% Main to Referrer, 50% Bonus to New Player (Debited from Master)
      if (!player.hasMadeFirstDeposit && player.referrerId) {
        player.hasMadeFirstDeposit = true;
        const halfBonus = Math.floor(tx.amount * 0.5);

        // Credit new player 50% bonus
        player.bonusBalance += halfBonus;
        player.walletBalance = player.mainBalance + player.bonusBalance;

        // Credit referrer 50% main balance
        const referrer = this.players.find((p) => p.id === player.referrerId);
        if (referrer) {
          referrer.mainBalance += halfBonus;
          referrer.walletBalance = referrer.mainBalance + referrer.bonusBalance;
        }

        // Debit from Master Pool
        this.masterProfile.mainBalance -= halfBonus * 2;
        this.masterProfile.walletBalance = this.masterProfile.mainBalance;

        this.history.unshift({
          id: `act-ref-${Date.now()}`,
          type: 'referral',
          title: 'Referral Bonus Triggered (50/50 Handshake)',
          amount: halfBonus,
          wallet: 'bonus',
          status: 'completed',
          timestamp: new Date().toISOString(),
          details: `First deposit referral: ₹${halfBonus} Bonus to ${player.displayName}, ₹${halfBonus} Main to Referrer.`,
        });
      }

      // 3. AGENT COMMISSION TRIGGER: Agent -> Player 10% All-time Deposit
      if (agent) {
        const commission = Math.floor(tx.amount * 0.1);
        agent.mainBalance += commission;
        agent.walletBalance = agent.mainBalance + agent.bonusBalance;
        this.masterProfile.mainBalance -= commission;

        this.history.unshift({
          id: `act-comm-${Date.now()}`,
          type: 'referral',
          title: `Agent 10% Deposit Commission`,
          amount: commission,
          wallet: 'main',
          status: 'completed',
          timestamp: new Date().toISOString(),
          details: `Agent ${agent.displayName} earned 10% commission on deposit of ₹${tx.amount}.`,
        });
      }
    } else {
      // Withdrawal completed: funds already held, now finalized
    }

    this.notify();
    return {
      success: true,
      message: `Dual-confirmation handshake approved! ${tx.type === 'deposit' ? 'Funds & commissions credited.' : 'Withdrawal completed successfully.'}`,
    };
  }

  // Reject Handshake
  public rejectHandshake(transactionId: string, reason: string): { success: boolean; message: string } {
    const tx = this.handshakes.find((t) => t.id === transactionId);
    if (!tx) return { success: false, message: 'Transaction not found.' };
    if (tx.status !== 'pending') return { success: false, message: 'Transaction already processed.' };

    tx.status = 'rejected';
    tx.notes = `Rejected by Agent: ${reason}`;

    // Refund player held balance if it was a withdrawal
    if (tx.type === 'withdrawal') {
      const player = this.players.find((p) => p.id === tx.senderId) || this.currentUser;
      player.mainBalance += tx.amount;
      player.walletBalance = player.mainBalance + player.bonusBalance;
    }

    this.notify();
    return { success: true, message: 'Handshake rejected. Held funds refunded to player if withdrawal.' };
  }

  // ---------------------------------------------------------------------------
  // MASTER 00–99 RISK & EXPOSURE CALCULATOR
  // Computes for all 100 numbers:
  // - Total Bids on number
  // - 90x Payout liability
  // - Green Refunds liability (80% on green numbers for Hourly Dhamaka)
  // - Net Master Profit / Loss
  // ---------------------------------------------------------------------------
  public calculate00to99Risk(gameId: WinoraGameId): {
    items: NumberRiskItem[];
    totalPool: number;
    highestProfitNumber: number;
    highestLossNumber: number;
    maxProfitAmount: number;
    maxLossAmount: number;
  } {
    const round = this.rounds[gameId];
    const roundBids = this.bids.filter((b) => b.roundId === round.id);
    const totalPool = roundBids.reduce((acc, b) => acc + b.amount, 0);

    const isDhamaka = gameId === 'hourly_dhamaka';

    // Total green bids across the entire round (needed for Dhamaka refund calc)
    const totalGreenBidsAmount = roundBids
      .filter((b) => b.isGreen)
      .reduce((acc, b) => acc + b.amount, 0);

    const items: NumberRiskItem[] = [];
    let highestProfitNumber = 0;
    let highestLossNumber = 0;
    let maxProfitAmount = -Infinity;
    let maxLossAmount = Infinity;

    for (let i = 0; i < 100; i++) {
      const numberBids = roundBids.filter((b) => b.number === i);
      const totalBidsOnThisNumber = numberBids.reduce((acc, b) => acc + b.amount, 0);
      const bidCount = numberBids.length;

      // 90x Payout liability if number `i` wins
      const payout90x = totalBidsOnThisNumber * 90;

      // Dhamaka 80% Green Refund liability:
      // If number `i` wins:
      // All green number bids EXCEPT the winning number get 80% refund.
      // (If `i` is green, winners on `i` get 90x payout, other green numbers get 80% refund).
      let greenRefunds = 0;
      if (isDhamaka) {
        const otherGreenBids = isNumberGreen(i)
          ? totalGreenBidsAmount - totalBidsOnThisNumber
          : totalGreenBidsAmount;
        greenRefunds = Math.round(otherGreenBids * 0.8);
      }

      // Net Master Profit/Loss = Total Pool Collections - (90x Payout + Green Refunds)
      const netMasterPnL = totalPool - (payout90x + greenRefunds);

      if (netMasterPnL > maxProfitAmount) {
        maxProfitAmount = netMasterPnL;
        highestProfitNumber = i;
      }
      if (netMasterPnL < maxLossAmount) {
        maxLossAmount = netMasterPnL;
        highestLossNumber = i;
      }

      items.push({
        number: i,
        formattedNumber: i.toString().padStart(2, '0'),
        isGreen: isNumberGreen(i),
        totalBids: totalBidsOnThisNumber,
        bidCount,
        payout90x,
        greenRefunds,
        netMasterPnL,
      });
    }

    return {
      items,
      totalPool,
      highestProfitNumber,
      highestLossNumber,
      maxProfitAmount,
      maxLossAmount,
    };
  }

  // ---------------------------------------------------------------------------
  // MASTER: DECLARE WINNING NUMBER & SETTLE ROUND
  // ---------------------------------------------------------------------------
  public declareWinningNumber(gameId: WinoraGameId, winningNumber: number): {
    success: boolean;
    message: string;
    totalWinnersPaid: number;
    totalRefundsPaid: number;
    netMasterPnL: number;
  } {
    const round = this.rounds[gameId];
    if (!round) return { success: false, message: 'Invalid round', totalWinnersPaid: 0, totalRefundsPaid: 0, netMasterPnL: 0 };

    round.resultNumber = winningNumber;
    round.status = 'completed';
    round.declaredAt = new Date().toISOString();

    const isDhamaka = gameId === 'hourly_dhamaka';
    const roundBids = this.bids.filter((b) => b.roundId === round.id);

    let totalWinnersPaid = 0;
    let totalRefundsPaid = 0;

    roundBids.forEach((bid) => {
      const player = this.players.find((p) => p.id === bid.userId) || this.currentUser;

      if (bid.number === winningNumber) {
        // WINNER! 90x Payout credited to Main Wallet
        const winPayout = bid.amount * 90;
        bid.status = 'won';
        bid.payoutAmount = winPayout;
        player.mainBalance += winPayout;
        player.walletBalance = player.mainBalance + player.bonusBalance;
        totalWinnersPaid += winPayout;

        this.history.unshift({
          id: `act-win-${Date.now()}-${bid.id}`,
          type: 'win',
          title: `${round.gameName}: 90× Win on #${winningNumber.toString().padStart(2, '0')}`,
          amount: winPayout,
          wallet: 'main',
          status: 'won',
          timestamp: new Date().toISOString(),
          details: `Bid ₹${bid.amount} × 90 = ₹${winPayout.toLocaleString()} credited to Main Wallet!`,
          gameName: round.gameName,
        });
      } else if (isDhamaka && bid.isGreen) {
        // Hourly Dhamaka: 80% Green Protection Refund on non-winning Green numbers!
        const refundAmt = Math.round(bid.amount * 0.8);
        bid.status = 'refunded';
        bid.refundAmount = refundAmt;
        player.mainBalance += refundAmt;
        player.walletBalance = player.mainBalance + player.bonusBalance;
        totalRefundsPaid += refundAmt;

        this.history.unshift({
          id: `act-ref-${Date.now()}-${bid.id}`,
          type: 'refund',
          title: `Hourly Dhamaka: 80% Green Refund on #${bid.number.toString().padStart(2, '0')}`,
          amount: refundAmt,
          wallet: 'main',
          status: 'refunded',
          timestamp: new Date().toISOString(),
          details: `Result was #${winningNumber.toString().padStart(2, '0')}. 80% refund (₹${refundAmt}) credited to Main Wallet.`,
          gameName: round.gameName,
        });
      } else {
        bid.status = 'lost';
      }
    });

    const netMasterPnL = round.totalBidsPool - (totalWinnersPaid + totalRefundsPaid);
    this.masterProfile.mainBalance += netMasterPnL;
    this.masterProfile.walletBalance = this.masterProfile.mainBalance;

    // Advance round to new round
    const nextTimes = createRoundTimes(60);
    this.rounds[gameId] = {
      id: `round-${gameId}-${round.roundNumber + 1}`,
      gameId,
      gameName: round.gameName,
      roundNumber: round.roundNumber + 1,
      freezeTime: nextTimes.freezeTime,
      declareTime: nextTimes.declareTime,
      status: 'open',
      totalBidsPool: 0,
    };

    this.notify();
    return {
      success: true,
      message: `Winning number #${winningNumber.toString().padStart(2, '0')} declared! 90× Payouts (₹${totalWinnersPaid.toLocaleString()}) & Green Refunds (₹${totalRefundsPaid.toLocaleString()}) settled. Master Net P&L: ₹${netMasterPnL.toLocaleString()}`,
      totalWinnersPaid,
      totalRefundsPaid,
      netMasterPnL,
    };
  }

  // Master Financial Workflow: Transfer coins to Agent
  public masterTransferToAgent(agentId: string, amount: number): { success: boolean; message: string } {
    const agent = this.agents.find((a) => a.id === agentId);
    if (!agent) return { success: false, message: 'Agent not found.' };
    if (this.masterProfile.mainBalance < amount) {
      return { success: false, message: 'Insufficient Master coins balance.' };
    }

    this.masterProfile.mainBalance -= amount;
    this.masterProfile.walletBalance = this.masterProfile.mainBalance;
    agent.mainBalance += amount;
    agent.walletBalance = agent.mainBalance + agent.bonusBalance;

    this.history.unshift({
      id: `act-mtransfer-${Date.now()}`,
      type: 'deposit',
      title: `Master Coin Transfer to Agent`,
      amount,
      wallet: 'main',
      status: 'completed',
      timestamp: new Date().toISOString(),
      details: `Transferred ₹${amount.toLocaleString()} coins to Agent ${agent.displayName}.`,
    });

    this.notify();
    return {
      success: true,
      message: `Transferred ₹${amount.toLocaleString()} to Agent ${agent.displayName} successfully!`,
    };
  }

  // User Management: Block / Unblock User
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
