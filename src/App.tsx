import React, { useState, useEffect } from 'react';
import {
  Home as HomeIcon,
  Gamepad2,
  Coins,
  User,
  Plus,
  Minus,
  Clock,
  Copy,
  Check,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Info,
  Gift,
  Trash2,
  Settings as SettingsIcon,
  Volume2,
  VolumeX,
  Smartphone,
  RotateCcw,
  ArrowRight,
  TrendingUp,
  Award
} from 'lucide-react';

/* ==========================================================================
   STRICT SPECIFICATION DATA STRUCTURES
   ========================================================================== */

export interface CoinWallet {
  uid: string;
  balance: number;
  bonusBalance: number;
  currency: 'COIN';
}

export interface CoinLedgerEntry {
  id: string;
  userId: string;
  type: string; // 'Earned' | 'Staked' | 'Won' | 'Gifted'
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  createdAt: string;
}

export interface GameRound {
  id: string;
  gameId: string;
  gameName: string;
  roundNumber: number;
  freezeTime: string;
  declareTime: string;
  status: string; // 'open' | 'frozen' | 'declared'
}

export interface GameEntry {
  id: string;
  userId: string;
  gameId: string;
  roundId: string;
  selections: { number: string; stake: number; color: string }[];
  totalStake: number;
  status: string; // 'confirmed' | 'won' | 'lost'
}

type TabType = 'home' | 'game' | 'wallet' | 'profile';

/* ==========================================================================
   INITIAL MOCK DATA (VIRTUAL COINS ONLY)
   ========================================================================== */

const INITIAL_WALLET: CoinWallet = {
  uid: 'usr_winora_mobile',
  balance: 1450,
  bonusBalance: 200,
  currency: 'COIN'
};

const INITIAL_ROUNDS: GameRound[] = [
  {
    id: 'round-hourly-104',
    gameId: 'hourly_play',
    gameName: 'Hourly Dhamaka',
    roundNumber: 104,
    freezeTime: new Date(Date.now() + 18 * 60000).toISOString(),
    declareTime: new Date(Date.now() + 33 * 60000).toISOString(),
    status: 'open'
  },
  {
    id: 'round-morning-82',
    gameId: 'kalyan_morning',
    gameName: 'Morning Sprint',
    roundNumber: 82,
    freezeTime: new Date(Date.now() + 45 * 60000).toISOString(),
    declareTime: new Date(Date.now() + 75 * 60000).toISOString(),
    status: 'open'
  },
  {
    id: 'round-night-99',
    gameId: 'kalyan_night',
    gameName: 'Night Express',
    roundNumber: 99,
    freezeTime: new Date(Date.now() + 120 * 60000).toISOString(),
    declareTime: new Date(Date.now() + 180 * 60000).toISOString(),
    status: 'open'
  },
  {
    id: 'round-express-41',
    gameId: 'super_100',
    gameName: 'Super 100 Live',
    roundNumber: 41,
    freezeTime: new Date(Date.now() - 2 * 60000).toISOString(),
    declareTime: new Date(Date.now() + 8 * 60000).toISOString(),
    status: 'frozen'
  }
];

const INITIAL_LEDGER: CoinLedgerEntry[] = [
  {
    id: 'led-1',
    userId: 'usr_winora_mobile',
    type: 'Won',
    amount: 900,
    balanceBefore: 550,
    balanceAfter: 1450,
    createdAt: new Date(Date.now() - 40 * 60000).toISOString()
  },
  {
    id: 'led-2',
    userId: 'usr_winora_mobile',
    type: 'Staked',
    amount: 50,
    balanceBefore: 600,
    balanceAfter: 550,
    createdAt: new Date(Date.now() - 75 * 60000).toISOString()
  },
  {
    id: 'led-3',
    userId: 'usr_winora_mobile',
    type: 'Earned',
    amount: 100,
    balanceBefore: 500,
    balanceAfter: 600,
    createdAt: new Date(Date.now() - 150 * 60000).toISOString()
  },
  {
    id: 'led-4',
    userId: 'usr_winora_mobile',
    type: 'Gifted',
    amount: 500,
    balanceBefore: 0,
    balanceAfter: 500,
    createdAt: new Date(Date.now() - 360 * 60000).toISOString()
  }
];

/* ==========================================================================
   APP COMPONENT
   ========================================================================== */

export default function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState<TabType>('home');

  // Core Data States
  const [wallet, setWallet] = useState<CoinWallet>(() => {
    const saved = localStorage.getItem('winora_wallet');
    return saved ? JSON.parse(saved) : INITIAL_WALLET;
  });

  const [ledger, setLedger] = useState<CoinLedgerEntry[]>(() => {
    const saved = localStorage.getItem('winora_ledger');
    return saved ? JSON.parse(saved) : INITIAL_LEDGER;
  });

  const [rounds, setRounds] = useState<GameRound[]>(INITIAL_ROUNDS);
  const [entries, setEntries] = useState<GameEntry[]>([]);
  const [activeRoundId, setActiveRoundId] = useState<string>(INITIAL_ROUNDS[0].id);

  // Profile States
  const [displayName, setDisplayName] = useState<string>('Alex Player');
  const [referralCode] = useState<string>('WINORA-7892');
  const [isDailyClaimed, setIsDailyClaimed] = useState<boolean>(false);
  const [isEditingName, setIsEditingName] = useState<boolean>(false);
  const [nameInput, setNameInput] = useState<string>('Alex Player');

  // Settings
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [hapticsEnabled, setHapticsEnabled] = useState<boolean>(true);

  // Loading States
  const [isLoadingRounds] = useState<boolean>(false);
  const [isLoadingHistory] = useState<boolean>(false);

  // Notification Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Game Board States
  // Selected numbers stored as Map or array
  const [selectedMap, setSelectedMap] = useState<{ [num: string]: number }>({});
  const [currentStake, setCurrentStake] = useState<number>(25);
  const [colorFilter, setColorFilter] = useState<'ALL' | 'GREEN' | 'RED'>('ALL');
  const [activityFilter, setActivityFilter] = useState<'ALL' | 'Earned' | 'Staked' | 'Won' | 'Gifted'>('ALL');

  // Sync Wallet & Ledger to localStorage
  useEffect(() => {
    localStorage.setItem('winora_wallet', JSON.stringify(wallet));
  }, [wallet]);

  useEffect(() => {
    localStorage.setItem('winora_ledger', JSON.stringify(ledger));
  }, [ledger]);

  // Toast Helper
  const showToast = (message: string) => {
    setToastMessage(message);
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 2400);
    return () => clearTimeout(timer);
  };

  // Timer Tick for active rounds
  const [nowTime, setNowTime] = useState<number>(Date.now());
  useEffect(() => {
    const interval = setInterval(() => {
      setNowTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Format Time Remaining Helper
  const formatCountdown = (freezeIso: string) => {
    const diff = Math.max(0, new Date(freezeIso).getTime() - nowTime);
    if (diff <= 0) return '00:00';
    const m = Math.floor(diff / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Switch to Game tab and select round
  const handleOpenRound = (roundId: string) => {
    setActiveRoundId(roundId);
    setActiveTab('game');
  };

  // Active round object
  const activeRound = rounds.find((r) => r.id === activeRoundId) || rounds[0];

  // Game Board: Toggle Number
  const handleToggleNumber = (numStr: string) => {
    setSelectedMap((prev) => {
      const next = { ...prev };
      if (next[numStr]) {
        delete next[numStr];
      } else {
        next[numStr] = currentStake;
      }
      return next;
    });
  };

  // Game Board: Adjust Stake for All Selected or Default
  const handleStakeChange = (delta: number) => {
    setCurrentStake((prev) => {
      const next = Math.max(5, prev + delta);
      // Also update currently selected numbers to new stake if user adjusts
      setSelectedMap((oldMap) => {
        const updated: { [k: string]: number } = {};
        Object.keys(oldMap).forEach((k) => {
          updated[k] = next;
        });
        return updated;
      });
      return next;
    });
  };

  const handleSetPresetStake = (val: number) => {
    setCurrentStake(val);
    setSelectedMap((oldMap) => {
      const updated: { [k: string]: number } = {};
      Object.keys(oldMap).forEach((k) => {
        updated[k] = val;
      });
      return updated;
    });
  };

  // Total Coins Staked Calculation
  const selectedNumbersList = Object.keys(selectedMap).sort();
  const totalStake = selectedNumbersList.reduce((acc, num) => acc + (selectedMap[num] || currentStake), 0);

  // Confirm Entry Action
  const handleConfirmEntry = () => {
    if (selectedNumbersList.length === 0) return;
    if (totalStake > wallet.balance) {
      showToast('Insufficient Coins balance');
      return;
    }

    const before = wallet.balance;
    const after = before - totalStake;

    // 1. Deduct from wallet
    setWallet((prev) => ({
      ...prev,
      balance: after
    }));

    // 2. Append to ledger (CoinLedgerEntry)
    const newLedgerEntry: CoinLedgerEntry = {
      id: `led-${Date.now()}`,
      userId: wallet.uid,
      type: 'Staked',
      amount: totalStake,
      balanceBefore: before,
      balanceAfter: after,
      createdAt: new Date().toISOString()
    };
    setLedger((prev) => [newLedgerEntry, ...prev]);

    // 3. Create Game Entry
    const newGameEntry: GameEntry = {
      id: `entry-${Date.now()}`,
      userId: wallet.uid,
      gameId: activeRound.gameId,
      roundId: activeRound.id,
      selections: selectedNumbersList.map((num) => {
        const parsed = parseInt(num, 10);
        const color = parsed % 2 === 0 ? 'GREEN' : 'RED';
        return {
          number: num,
          stake: selectedMap[num] || currentStake,
          color
        };
      }),
      totalStake,
      status: 'confirmed'
    };
    setEntries((prev) => [newGameEntry, ...prev]);

    // 4. Reset selection and show toast
    setSelectedMap({});
    showToast('Entry confirmed');
  };

  // Profile: Copy Referral Code
  const handleCopyReferral = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(referralCode);
    }
    showToast('Referral code copied');
  };

  // Profile: Claim Daily Coins
  const handleClaimDaily = () => {
    if (isDailyClaimed) {
      showToast('Already claimed for today');
      return;
    }

    const claimAmount = 50;
    const before = wallet.balance;
    const after = before + claimAmount;

    setWallet((prev) => ({
      ...prev,
      balance: after
    }));

    const newLedgerEntry: CoinLedgerEntry = {
      id: `led-${Date.now()}`,
      userId: wallet.uid,
      type: 'Earned',
      amount: claimAmount,
      balanceBefore: before,
      balanceAfter: after,
      createdAt: new Date().toISOString()
    };
    setLedger((prev) => [newLedgerEntry, ...prev]);
    setIsDailyClaimed(true);
    showToast('Daily Coins claimed');
  };

  // Reset Demo Coins
  const handleResetDemoCoins = () => {
    setWallet({
      uid: wallet.uid,
      balance: 1500,
      bonusBalance: 200,
      currency: 'COIN'
    });
    setSelectedMap({});
    setIsDailyClaimed(false);
    showToast('Demo Coins refreshed');
  };

  // 100 Numbers generation: "00" to "99"
  const allNumbers = Array.from({ length: 100 }, (_, i) => i.toString().padStart(2, '0'));

  // Filtered Numbers for grid
  const displayedNumbers = allNumbers.filter((num) => {
    const val = parseInt(num, 10);
    if (colorFilter === 'GREEN') return val % 2 === 0;
    if (colorFilter === 'RED') return val % 2 !== 0;
    return true;
  });

  // Filtered Ledger Entries
  const filteredLedger = ledger.filter((item) => {
    if (activityFilter === 'ALL') return true;
    return item.type === activityFilter;
  });

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center selection:bg-amber-500 selection:text-black antialiased font-sans">
      {/* Mobile Shell Constraint: 375–430px optimized */}
      <div className="w-full max-w-[430px] min-h-screen flex flex-col relative bg-zinc-950 border-x border-zinc-900 shadow-2xl">
        
        {/* ====================================================================
            TOP MOBILE HEADER (App Brand & Coin Balance)
            ==================================================================== */}
        <header className="sticky top-0 z-30 bg-zinc-950/90 backdrop-blur border-b border-zinc-800/80 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500 flex items-center justify-center text-zinc-950 font-black text-sm shadow">
              W
            </div>
            <div>
              <span className="font-display font-black text-base tracking-tight text-zinc-100">
                WINORA
              </span>
              <span className="block text-[10px] text-zinc-400 font-mono -mt-0.5 leading-none">
                00–99 Casual Game
              </span>
            </div>
          </div>

          {/* Quick Coin Balance Pill */}
          <button
            type="button"
            onClick={() => setActiveTab('wallet')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 hover:border-amber-500/50 transition-colors cursor-pointer"
          >
            <Coins className="w-4 h-4 text-amber-400" />
            <span className="font-mono font-bold text-xs text-zinc-100">
              {wallet.balance.toLocaleString()}
            </span>
            <span className="text-[10px] text-zinc-400 uppercase font-semibold">Coins</span>
          </button>
        </header>

        {/* ====================================================================
            AUTO-DISMISS NOTIFICATION TOAST
            ==================================================================== */}
        {toastMessage && (
          <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 pointer-events-none px-4 w-full max-w-[400px]">
            <div className="bg-zinc-900 border border-amber-400 text-zinc-100 px-4 py-2.5 rounded-full shadow-2xl flex items-center justify-center gap-2 text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{toastMessage}</span>
            </div>
          </div>
        )}

        {/* ====================================================================
            MAIN VIEW CONTENT (ONE THUMB OPERABLE)
            ==================================================================== */}
        <main className="flex-1 px-4 pt-3 pb-28">

          {/* ------------------------------------------------------------------
              TAB 1: HOME (Active Game Rounds Cards)
              ------------------------------------------------------------------ */}
          {activeTab === 'home' && (
            <div className="space-y-3.5">
              {/* Screen Title */}
              <div className="flex items-center justify-between pt-1">
                <div>
                  <h1 className="text-xl font-black font-display text-zinc-100">
                    Active Game Rounds
                  </h1>
                  <p className="text-xs text-zinc-400">
                    Select a round to choose 00–99 numbers
                  </p>
                </div>
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-amber-400">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>90× Win</span>
                </div>
              </div>

              {/* Loading Skeleton State */}
              {isLoadingRounds ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-4 animate-pulse space-y-2.5"
                    >
                      <div className="h-4 w-28 bg-zinc-800 rounded" />
                      <div className="h-6 w-44 bg-zinc-800 rounded" />
                      <div className="h-10 w-full bg-zinc-800 rounded-xl mt-2" />
                    </div>
                  ))}
                </div>
              ) : rounds.length === 0 ? (
                /* Empty State */
                <div className="bg-zinc-900/50 border border-dashed border-zinc-800 rounded-2xl p-8 text-center space-y-2.5 my-6">
                  <AlertCircle className="w-8 h-8 text-zinc-500 mx-auto" />
                  <h3 className="text-sm font-bold text-zinc-300">No Active Rounds</h3>
                  <p className="text-xs text-zinc-400 max-w-xs mx-auto">
                    There are currently no active game rounds scheduled. Please check back shortly.
                  </p>
                </div>
              ) : (
                /* Active Rounds Cards */
                <div className="space-y-3">
                  {rounds.map((round) => {
                    const isFrozen = round.status === 'frozen';
                    const timeLeft = formatCountdown(round.freezeTime);

                    return (
                      <div
                        key={round.id}
                        onClick={() => handleOpenRound(round.id)}
                        className={`bg-zinc-900 border rounded-2xl p-4 transition-all cursor-pointer relative overflow-hidden ${
                          round.id === activeRoundId
                            ? 'border-amber-500/60 shadow-lg shadow-amber-500/10'
                            : 'border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        {/* Status Tag & Game Name */}
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                              Round #{round.roundNumber}
                            </span>
                            <h2 className="text-base font-black text-zinc-100 leading-tight">
                              {round.gameName}
                            </h2>
                          </div>

                          <span
                            className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                              isFrozen
                                ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isFrozen ? 'bg-rose-400' : 'bg-emerald-400 animate-pulse'
                              }`}
                            />
                            {isFrozen ? 'Drawing' : 'Open'}
                          </span>
                        </div>

                        {/* Round Info Row: Time & Coin Pool */}
                        <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-zinc-800/70 text-xs">
                          <div className="flex items-center gap-1.5 text-zinc-400">
                            <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>Draw in:</span>
                            <span className="font-mono font-black text-zinc-100">
                              {isFrozen ? 'Results pending' : `${timeLeft}`}
                            </span>
                          </div>

                          <div className="flex items-center justify-end gap-1 text-zinc-400">
                            <span>Pool:</span>
                            <span className="font-mono font-black text-amber-400">
                              {(round.roundNumber * 125).toLocaleString()} Coins
                            </span>
                          </div>
                        </div>

                        {/* One Obvious Action Button (Min 44x44px target) */}
                        <div className="mt-3.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenRound(round.id);
                            }}
                            className={`w-full py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 min-h-[44px] transition-all cursor-pointer ${
                              isFrozen
                                ? 'bg-zinc-800 text-zinc-400 hover:bg-zinc-750'
                                : 'bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-md active:scale-[0.98]'
                            }`}
                          >
                            <span>{isFrozen ? 'View Number Grid' : 'Pick Numbers & Play'}</span>
                            <ArrowRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Casual Rule Notice Card */}
              <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-3.5 flex items-start gap-2.5 text-xs text-zinc-400">
                <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Choose any number from <strong>00 to 99</strong>. Correct predictions receive a <strong>90× Coin payout</strong> automatically added to your Coin Balance.
                </p>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------------
              TAB 2: GAME BOARD (00–99 Focus, Thumb-Friendly)
              ------------------------------------------------------------------ */}
          {activeTab === 'game' && (
            <div className="space-y-3">
              {/* Round Selector Pill Strip */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-2.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-zinc-200">
                    <span>{activeRound.gameName}</span>
                    <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                      Round #{activeRound.roundNumber}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 font-mono text-zinc-400 text-[11px]">
                    <Clock className="w-3 h-3 text-amber-400" />
                    <span>{formatCountdown(activeRound.freezeTime)} left</span>
                  </div>
                </div>

                {/* Round switcher horizontal chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs">
                  {rounds.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setActiveRoundId(r.id)}
                      className={`px-2.5 py-1 rounded-lg font-bold text-xs whitespace-nowrap cursor-pointer transition-colors ${
                        r.id === activeRoundId
                          ? 'bg-amber-500 text-zinc-950'
                          : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {r.gameName.split(' ')[0]} #{r.roundNumber}
                    </button>
                  ))}
                </div>
              </div>

              {/* Simple Color Selector & Filter */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-2.5 flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setColorFilter('ALL')}
                    className={`px-3 py-1.5 rounded-xl font-bold min-h-[36px] cursor-pointer transition-colors ${
                      colorFilter === 'ALL'
                        ? 'bg-zinc-100 text-zinc-950'
                        : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    All (100)
                  </button>
                  <button
                    type="button"
                    onClick={() => setColorFilter('GREEN')}
                    className={`px-2.5 py-1.5 rounded-xl font-bold min-h-[36px] flex items-center gap-1 cursor-pointer transition-colors ${
                      colorFilter === 'GREEN'
                        ? 'bg-emerald-500 text-zinc-950 font-black'
                        : 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/30'
                    }`}
                  >
                    <span>● Green (Even)</span>
                    <span className="text-[10px]">✓ WIN</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setColorFilter('RED')}
                    className={`px-2.5 py-1.5 rounded-xl font-bold min-h-[36px] flex items-center gap-1 cursor-pointer transition-colors ${
                      colorFilter === 'RED'
                        ? 'bg-rose-500 text-zinc-950 font-black'
                        : 'bg-rose-950/40 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    <span>▲ Red (Odd)</span>
                    <span className="text-[10px]">✕ LOSS</span>
                  </button>
                </div>

                {selectedNumbersList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedMap({})}
                    className="p-1.5 text-zinc-400 hover:text-rose-400 transition-colors cursor-pointer"
                    title="Clear selected"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Simple Coin Stake Control (+ and − at least 44x44px) */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-zinc-300">Coin Stake Per Number</span>
                  <span className="text-[11px] text-amber-400 font-mono">
                    90× Payout = {(currentStake * 90).toLocaleString()} Coins
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  {/* Minus button: at least 44x44px */}
                  <button
                    type="button"
                    onClick={() => handleStakeChange(-5)}
                    className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 flex items-center justify-center font-bold text-lg cursor-pointer active:scale-95 transition-all shadow"
                    aria-label="Decrease Stake"
                  >
                    <Minus className="w-5 h-5" />
                  </button>

                  {/* Stake Value Indicator */}
                  <div className="flex-1 text-center py-2 bg-zinc-950 border border-zinc-800 rounded-xl">
                    <span className="font-mono font-black text-lg text-amber-400">
                      {currentStake}
                    </span>
                    <span className="text-xs font-semibold text-zinc-400 ml-1">Coins</span>
                  </div>

                  {/* Plus button: at least 44x44px */}
                  <button
                    type="button"
                    onClick={() => handleStakeChange(5)}
                    className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 flex items-center justify-center font-bold text-lg cursor-pointer active:scale-95 transition-all shadow"
                    aria-label="Increase Stake"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                {/* Stake Presets (Tap to instantly set) */}
                <div className="flex items-center justify-between gap-1 pt-1">
                  {[10, 25, 50, 100, 250].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleSetPresetStake(preset)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer ${
                        currentStake === preset
                          ? 'bg-amber-500 text-zinc-950'
                          : 'bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* --------------------------------------------------------------
                  MAIN NUMBER GRID: 00 01 02 ... 99
                  -------------------------------------------------------------- */}
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-2.5">
                <div className="flex items-center justify-between text-xs text-zinc-400 mb-2 px-1">
                  <span>Tap numbers to select (00–99)</span>
                  <span className="font-mono font-bold text-zinc-300">
                    {selectedNumbersList.length} selected
                  </span>
                </div>

                {/* 10-Column Compact Grid */}
                <div className="grid grid-cols-10 gap-1 sm:gap-1.5">
                  {displayedNumbers.map((num) => {
                    const isSelected = !!selectedMap[num];
                    const val = parseInt(num, 10);
                    const isEven = val % 2 === 0;

                    return (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handleToggleNumber(num)}
                        className={`aspect-square min-h-[34px] sm:min-h-[38px] flex flex-col items-center justify-center rounded-xl font-mono text-xs sm:text-sm font-black transition-all cursor-pointer relative ${
                          isSelected
                            ? 'bg-amber-500 text-zinc-950 border border-amber-300 shadow-md scale-[1.03] z-10'
                            : isEven
                            ? 'bg-zinc-950 text-zinc-200 border border-zinc-800 hover:border-emerald-500/40'
                            : 'bg-zinc-950 text-zinc-200 border border-zinc-800 hover:border-rose-500/40'
                        }`}
                        title={`Number ${num}`}
                      >
                        <span>{num}</span>
                        {/* Tiny color indicator dot when unselected */}
                        {!isSelected && (
                          <span
                            className={`w-1 h-1 rounded-full absolute bottom-0.5 ${
                              isEven ? 'bg-emerald-500/70' : 'bg-rose-500/70'
                            }`}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Small Summary Section for Selected Numbers */}
              {selectedNumbersList.length > 0 && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-zinc-300">Selected Numbers Summary</span>
                    <span className="text-zinc-400 font-mono">
                      {selectedNumbersList.length} number{selectedNumbersList.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                    {selectedNumbersList.map((num) => (
                      <span
                        key={num}
                        onClick={() => handleToggleNumber(num)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono text-xs font-bold cursor-pointer hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500/30 transition-colors"
                        title="Tap to remove"
                      >
                        <span>#{num}</span>
                        <span className="text-[10px] text-zinc-400">({selectedMap[num] || currentStake})</span>
                        <span className="text-[10px] text-zinc-500 ml-0.5">✕</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* ==============================================================
                  STICKY ACTION AREA (Confirm Entry & Total Coins)
                  ============================================================== */}
              <div className="sticky bottom-16 left-0 right-0 z-20 bg-zinc-950/95 backdrop-blur border border-zinc-800 rounded-2xl p-3.5 shadow-2xl flex items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">
                    Total Staked
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="font-mono font-black text-xl text-amber-400">
                      {totalStake.toLocaleString()}
                    </span>
                    <span className="text-xs font-bold text-zinc-300">Coins</span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={selectedNumbersList.length === 0 || totalStake > wallet.balance}
                  onClick={handleConfirmEntry}
                  className="flex-1 py-3 px-5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-500 text-zinc-950 font-black text-sm uppercase tracking-wider min-h-[44px] flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:cursor-not-allowed transition-all active:scale-[0.98]"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Confirm Entry</span>
                </button>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------------
              TAB 3: WALLET (Simple, No Currency Symbols, No Cash-Out)
              ------------------------------------------------------------------ */}
          {activeTab === 'wallet' && (
            <div className="space-y-3.5">
              {/* Top: Large Coin Balance Display */}
              <div className="bg-gradient-to-b from-zinc-900 to-zinc-900/80 border border-zinc-800 rounded-2xl p-5 text-center space-y-1.5 shadow-md">
                <span className="text-xs font-bold uppercase text-zinc-400 tracking-wider block">
                  Coin Balance
                </span>
                <div className="font-mono font-black text-4xl sm:text-5xl text-amber-400 tracking-tight">
                  {wallet.balance.toLocaleString()}
                </div>
                <div className="text-sm font-bold text-zinc-300">Coins</div>

                {wallet.bonusBalance > 0 && (
                  <div className="pt-2 mt-2 border-t border-zinc-800/80 flex items-center justify-center gap-1 text-xs text-emerald-400 font-mono font-bold">
                    <Award className="w-3.5 h-3.5" />
                    <span>+{wallet.bonusBalance} Bonus Coins</span>
                  </div>
                )}
              </div>

              {/* Prominent Disclaimer: STRICT USER REQUIREMENT */}
              <div className="bg-zinc-900/90 border border-amber-500/30 rounded-2xl p-3.5 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-zinc-300 leading-relaxed font-medium">
                  "Coins have no cash value and cannot be bought, deposited, or withdrawn for money."
                </p>
              </div>

              {/* Simple Activity List Header & Filters */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-zinc-200">Activity History</h3>
                  <span className="text-xs text-zinc-400 font-mono">
                    {filteredLedger.length} entries
                  </span>
                </div>

                {/* Filter Pills: Earned, Staked, Won, Gifted */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 text-xs">
                  {(['ALL', 'Earned', 'Staked', 'Won', 'Gifted'] as const).map((ft) => (
                    <button
                      key={ft}
                      type="button"
                      onClick={() => setActivityFilter(ft)}
                      className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap cursor-pointer transition-colors ${
                        activityFilter === ft
                          ? 'bg-amber-500 text-zinc-950 font-black'
                          : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                      }`}
                    >
                      {ft === 'ALL' ? 'All' : ft}
                    </button>
                  ))}
                </div>

                {/* Activity List Container */}
                {isLoadingHistory ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-14 bg-zinc-900 rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : filteredLedger.length === 0 ? (
                  /* Empty State */
                  <div className="bg-zinc-900/40 border border-dashed border-zinc-800 rounded-2xl p-6 text-center text-xs text-zinc-500">
                    No transactions found under this filter.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredLedger.map((item) => {
                      const isPositive = item.type === 'Won' || item.type === 'Earned' || item.type === 'Gifted';

                      return (
                        <div
                          key={item.id}
                          className="bg-zinc-900 border border-zinc-800/90 rounded-xl p-3 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                item.type === 'Won'
                                  ? 'bg-emerald-500/15 text-emerald-400'
                                  : item.type === 'Staked'
                                  ? 'bg-amber-500/15 text-amber-400'
                                  : item.type === 'Gifted'
                                  ? 'bg-blue-500/15 text-blue-400'
                                  : 'bg-zinc-800 text-zinc-300'
                              }`}
                            >
                              {item.type === 'Won' && <TrendingUp className="w-4 h-4" />}
                              {item.type === 'Staked' && <Gamepad2 className="w-4 h-4" />}
                              {item.type === 'Gifted' && <Gift className="w-4 h-4" />}
                              {item.type === 'Earned' && <Sparkles className="w-4 h-4" />}
                            </div>

                            <div>
                              <div className="font-bold text-zinc-200 flex items-center gap-1.5">
                                <span>{item.type}</span>
                              </div>
                              <div className="text-[10px] text-zinc-400 font-mono">
                                {new Date(item.createdAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <div
                              className={`font-mono font-bold text-sm ${
                                isPositive ? 'text-emerald-400' : 'text-zinc-300'
                              }`}
                            >
                              {isPositive ? '+' : '-'}
                              {item.amount.toLocaleString()} Coins
                            </div>
                            <div className="text-[10px] text-zinc-400 font-mono">
                              Bal: {item.balanceAfter.toLocaleString()} Coins
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------------
              TAB 4: PROFILE (Name, Referral, Daily Claim, Settings)
              ------------------------------------------------------------------ */}
          {activeTab === 'profile' && (
            <div className="space-y-3.5">
              {/* Profile Card */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-black text-lg">
                    {displayName.charAt(0).toUpperCase()}
                  </div>

                  <div>
                    {isEditingName ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={nameInput}
                          onChange={(e) => setNameInput(e.target.value)}
                          className="bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1 text-xs font-bold text-zinc-100 w-28 focus:outline-none focus:border-amber-400"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setDisplayName(nameInput || 'Alex Player');
                            setIsEditingName(false);
                            showToast('Display name updated');
                          }}
                          className="px-2 py-1 bg-amber-500 text-zinc-950 rounded-lg text-xs font-bold cursor-pointer"
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <h2 className="text-base font-bold text-zinc-100">{displayName}</h2>
                        <button
                          type="button"
                          onClick={() => {
                            setNameInput(displayName);
                            setIsEditingName(true);
                          }}
                          className="text-[10px] text-zinc-400 hover:text-amber-400 underline cursor-pointer"
                        >
                          Edit
                        </button>
                      </div>
                    )}
                    <span className="text-[11px] text-zinc-400 font-mono block">
                      UID: {wallet.uid}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-zinc-400 block">Balance</span>
                  <span className="font-mono font-bold text-sm text-amber-400">
                    {wallet.balance.toLocaleString()} Coins
                  </span>
                </div>
              </div>

              {/* Referral Code Box with Copy Button */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2">
                <span className="text-xs font-bold text-zinc-300 block">
                  Referral Code
                </span>
                <div className="flex items-center justify-between gap-2 bg-zinc-950 border border-zinc-800 rounded-xl p-2.5">
                  <span className="font-mono font-black text-sm tracking-wider text-amber-400">
                    {referralCode}
                  </span>

                  <button
                    type="button"
                    onClick={handleCopyReferral}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer active:scale-95 transition-all min-h-[36px]"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </button>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Share this code with friends to enjoy casual games together.
                </p>
              </div>

              {/* Daily Coin Claim Button */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-200 flex items-center gap-1.5">
                    <Gift className="w-4 h-4 text-amber-400" />
                    <span>Daily Coin Bonus</span>
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    +50 Coins
                  </span>
                </div>

                <button
                  type="button"
                  disabled={isDailyClaimed}
                  onClick={handleClaimDaily}
                  className={`w-full py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 min-h-[44px] transition-all cursor-pointer ${
                    isDailyClaimed
                      ? 'bg-zinc-800 text-zinc-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 shadow-md active:scale-98'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{isDailyClaimed ? 'Daily Coins Claimed' : 'Claim 50 Free Daily Coins'}</span>
                </button>
              </div>

              {/* Settings Section */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-3">
                <span className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                  <SettingsIcon className="w-4 h-4 text-zinc-400" />
                  <span>Settings</span>
                </span>

                <div className="space-y-2 text-xs">
                  {/* Sound Toggle */}
                  <div className="flex items-center justify-between py-1 border-b border-zinc-800/60">
                    <div className="flex items-center gap-2 text-zinc-300">
                      {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                      <span>Sound Effects</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSoundEnabled(!soundEnabled)}
                      className={`w-11 h-6 rounded-full transition-colors cursor-pointer relative p-0.5 ${
                        soundEnabled ? 'bg-amber-500' : 'bg-zinc-700'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-zinc-950 transition-transform ${
                          soundEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Haptics Toggle */}
                  <div className="flex items-center justify-between py-1 border-b border-zinc-800/60">
                    <div className="flex items-center gap-2 text-zinc-300">
                      <Smartphone className="w-4 h-4" />
                      <span>Haptic Feedback</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setHapticsEnabled(!hapticsEnabled)}
                      className={`w-11 h-6 rounded-full transition-colors cursor-pointer relative p-0.5 ${
                        hapticsEnabled ? 'bg-amber-500' : 'bg-zinc-700'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-zinc-950 transition-transform ${
                          hapticsEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Reset Demo Coins */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleResetDemoCoins}
                      className="w-full py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-zinc-300 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset Demo Coins to 1,500</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </main>

        {/* ====================================================================
            FIXED BOTTOM NAVIGATION (EXACTLY FOUR TABS)
            1. Home | 2. Game | 3. Wallet | 4. Profile
            ==================================================================== */}
        <nav className="fixed bottom-0 left-0 right-0 max-w-[430px] mx-auto bg-zinc-950/95 backdrop-blur border-t border-zinc-800/90 z-40 px-2 py-1.5 flex items-center justify-around shadow-2xl">
          {/* Tab 1: Home */}
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className={`flex-1 min-h-[48px] flex flex-col items-center justify-center gap-1 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'home'
                ? 'text-amber-400 font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <HomeIcon className="w-5 h-5" />
            <span className="text-[11px] leading-none">Home</span>
          </button>

          {/* Tab 2: Game */}
          <button
            type="button"
            onClick={() => setActiveTab('game')}
            className={`flex-1 min-h-[48px] flex flex-col items-center justify-center gap-1 rounded-xl transition-colors cursor-pointer relative ${
              activeTab === 'game'
                ? 'text-amber-400 font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Gamepad2 className="w-5 h-5" />
            <span className="text-[11px] leading-none">Game</span>
            {selectedNumbersList.length > 0 && (
              <span className="absolute top-1.5 right-4 w-2 h-2 rounded-full bg-amber-400" />
            )}
          </button>

          {/* Tab 3: Wallet */}
          <button
            type="button"
            onClick={() => setActiveTab('wallet')}
            className={`flex-1 min-h-[48px] flex flex-col items-center justify-center gap-1 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'wallet'
                ? 'text-amber-400 font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Coins className="w-5 h-5" />
            <span className="text-[11px] leading-none">Wallet</span>
          </button>

          {/* Tab 4: Profile */}
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`flex-1 min-h-[48px] flex flex-col items-center justify-center gap-1 rounded-xl transition-colors cursor-pointer ${
              activeTab === 'profile'
                ? 'text-amber-400 font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <User className="w-5 h-5" />
            <span className="text-[11px] leading-none">Profile</span>
          </button>
        </nav>

      </div>
    </div>
  );
}
