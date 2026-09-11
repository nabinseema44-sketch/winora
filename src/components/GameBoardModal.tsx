import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Clock,
  AlertTriangle,
  Coins,
  ShieldCheck,
  CheckCircle2,
  TrendingUp,
  RotateCcw,
  Check,
  FileText,
  RefreshCw,
  Plus,
  Minus,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { WinoraGameConfig, GameRound, UserProfile } from '../types.ts';
import {
  gameEntryApi,
  ServerRoundInfo,
  ConfirmedGameEntry,
  SelectionPayload,
} from '../services/gameEntryApi.ts';
import { winoraEngine } from '../services/winoraEngine.ts';

interface GameBoardModalProps {
  game: WinoraGameConfig;
  initialRound: GameRound;
  user: UserProfile;
  onClose: () => void;
  onSuccessToast: (msg: string) => void;
  onNavigateToHistory?: () => void;
}

type ModalView = 'board' | 'success' | 'my-entries';

export const GameBoardModal: React.FC<GameBoardModalProps> = ({
  game,
  initialRound,
  user,
  onClose,
  onSuccessToast,
}) => {
  // Current active view
  const [activeView, setActiveView] = useState<ModalView>('board');

  // Active selections list
  const [selections, setSelections] = useState<SelectionPayload[]>([]);

  // Default active stake applied immediately when tapping any number
  // Set default to 25 as highlighted by the user ("like if i select 25 than my bid amount show imidietly")
  const [activeStake, setActiveStake] = useState<number>(25);
  const [customStakeInput, setCustomStakeInput] = useState<string>('25');

  // Currently focused number for instant inline amount inspection/editing
  const [focusedNumber, setFocusedNumber] = useState<string | null>(null);

  // Hourly Play color filter tab
  const [colorTab, setColorTab] = useState<'ALL' | 'GREEN' | 'RED'>('ALL');

  const isHourlyGame =
    game.id === 'hourly_play' ||
    game.id === 'hourly_dhamaka' ||
    Boolean(game.hasHourlyProtection);

  const isKalyanMarket = game.id.startsWith('kalyan');

  // Server-authoritative round data
  const [serverRound, setServerRound] = useState<ServerRoundInfo | null>(null);
  const [serverTimeOffsetMs, setServerTimeOffsetMs] = useState<number>(0);

  // Live timer display & 15-minute freeze state
  const [timeLeftStr, setTimeLeftStr] = useState<string>('');
  const [isFrozen, setIsFrozen] = useState<boolean>(false);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmedEntry, setConfirmedEntry] = useState<ConfirmedGameEntry | null>(null);

  // My Entries state
  const [userEntries, setUserEntries] = useState<ConfirmedGameEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState<boolean>(false);

  // Dynamic balance sync (Withdrawable balance in paise converted to rupees)
  const [currentDemoBalance, setCurrentDemoBalance] = useState<number>(() => {
    return user.withdrawableBalancePaise !== undefined
      ? user.withdrawableBalancePaise / 100
      : user.mainBalance;
  });

  // Subscribe to winoraEngine balance updates
  useEffect(() => {
    const unsub = winoraEngine.subscribe(() => {
      const u = winoraEngine.getCurrentUser();
      if (u) {
        setCurrentDemoBalance(u.withdrawableBalancePaise / 100);
      }
    });
    return unsub;
  }, []);

  // 1. Fetch server-authoritative round configuration on mount
  useEffect(() => {
    let isMounted = true;

    async function loadServerConfig() {
      const config = await gameEntryApi.fetchGamesConfig();
      if (!isMounted) return;

      if (config) {
        if (config.rounds && config.rounds[game.id]) {
          setServerRound(config.rounds[game.id]);
        }
        if (config.serverTime) {
          const serverMs = new Date(config.serverTime).getTime();
          setServerTimeOffsetMs(serverMs - Date.now());
        }
      } else {
        setServerRound({
          id: initialRound.id,
          gameId: initialRound.gameId,
          gameName: initialRound.gameName,
          roundNumber: initialRound.roundNumber,
          freezeTime: initialRound.freezeTime,
          declareTime: initialRound.declareTime,
          status: initialRound.status === 'frozen' ? 'FROZEN' : 'OPEN',
          totalBidsPool: initialRound.totalBidsPool,
        });
      }
    }

    loadServerConfig();
    const interval = setInterval(loadServerConfig, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [game.id, initialRound]);

  // 2. Countdown & 15-Minute Freeze Check
  useEffect(() => {
    const updateTimer = () => {
      const currentRound = serverRound || {
        freezeTime: initialRound.freezeTime,
        declareTime: initialRound.declareTime,
        status: initialRound.status === 'frozen' ? 'FROZEN' : 'OPEN',
      };

      const now = Date.now() + serverTimeOffsetMs;
      const freezeMs = new Date(currentRound.freezeTime).getTime();
      const declareMs = new Date(currentRound.declareTime).getTime();

      const diffFreeze = freezeMs - now;
      const diffDeclare = declareMs - now;

      const isServerLocked =
        currentRound.status === 'FROZEN' ||
        currentRound.status === 'PROCESSING' ||
        currentRound.status === 'COMPLETED' ||
        diffFreeze <= 0;

      if (isServerLocked) {
        setIsFrozen(true);
        if (diffDeclare > 0) {
          const m = Math.floor(diffDeclare / 60000);
          const s = Math.floor((diffDeclare % 60000) / 1000);
          setTimeLeftStr(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')} to draw`);
        } else {
          setTimeLeftStr('Declaring Result');
        }
      } else {
        setIsFrozen(false);
        const m = Math.floor(diffFreeze / 60000);
        const s = Math.floor((diffFreeze % 60000) / 1000);
        setTimeLeftStr(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')} to freeze`);
      }
    };

    updateTimer();
    const timer = setInterval(updateTimer, 1000);
    return () => clearInterval(timer);
  }, [serverRound, initialRound, serverTimeOffsetMs]);

  // 3. Load User Entries
  const loadMyEntries = async () => {
    setLoadingEntries(true);
    const entries = await gameEntryApi.fetchMyEntries(user.id);
    setUserEntries(entries);
    setLoadingEntries(false);
  };

  useEffect(() => {
    if (activeView === 'my-entries') {
      loadMyEntries();
    }
  }, [activeView]);

  // 00 to 99 string array
  const allNumbers: string[] = useMemo(() => {
    return Array.from({ length: 100 }, (_, i) => i.toString().padStart(2, '0'));
  }, []);

  // Filtered numbers for Hourly Play
  const displayedNumbers = useMemo(() => {
    if (!isHourlyGame || colorTab === 'ALL') return allNumbers;
    return allNumbers.filter((n) => {
      const num = parseInt(n, 10);
      const isEvenGreen = num % 2 === 0;
      return colorTab === 'GREEN' ? isEvenGreen : !isEvenGreen;
    });
  }, [allNumbers, isHourlyGame, colorTab]);

  // Fast selection lookup map
  const selectionMap = useMemo(() => {
    const map = new Map<string, SelectionPayload>();
    selections.forEach((s) => map.set(s.number, s));
    return map;
  }, [selections]);

  // Focused selection details
  const focusedSelection = focusedNumber ? selectionMap.get(focusedNumber) : null;

  // Change active stake via preset chip
  const handleSelectChipStake = (amount: number) => {
    setActiveStake(amount);
    setCustomStakeInput(amount.toString());

    // If a number is currently focused, update its stake immediately!
    if (focusedNumber && selectionMap.has(focusedNumber)) {
      handleUpdateNumberStake(focusedNumber, amount);
    }
  };

  // Change active stake via custom input (allows ANY amount)
  const handleCustomStakeInput = (valStr: string) => {
    setCustomStakeInput(valStr);
    const parsed = parseInt(valStr, 10);
    if (!isNaN(parsed) && parsed > 0) {
      setActiveStake(parsed);
      if (focusedNumber && selectionMap.has(focusedNumber)) {
        handleUpdateNumberStake(focusedNumber, parsed);
      }
    }
  };

  // 4. Number Selection Toggle
  // When a user selects a number (e.g. 25), the active stake (e.g. ₹25) shows immediately on the tile!
  const handleToggleNumber = (numStr: string) => {
    if (isFrozen) return;
    setErrorMessage(null);

    const existing = selectionMap.get(numStr);

    if (existing) {
      // If already selected: focus it to allow adjusting or removing
      if (focusedNumber === numStr) {
        // Tapping focused tile again toggles off
        setSelections((prev) => prev.filter((s) => s.number !== numStr));
        setFocusedNumber(null);
      } else {
        setFocusedNumber(numStr);
      }
    } else {
      // Not selected: check max 37 limit
      if (selections.length >= 37) {
        setErrorMessage('Maximum 37 numbers limit reached per round.');
        return;
      }

      const numVal = parseInt(numStr, 10);
      const color: 'GREEN' | 'RED' = numVal % 2 === 0 ? 'GREEN' : 'RED';

      const newSel: SelectionPayload = {
        number: numStr,
        stake: activeStake, // Immediately uses chosen amount (e.g. 25)
        color,
      };

      setSelections((prev) => [...prev, newSel]);
      setFocusedNumber(numStr); // Immediately focus so user sees and can tweak bid
    }
  };

  // Update specific number's stake to ANY amount
  const handleUpdateNumberStake = (numStr: string, newStake: number) => {
    if (isFrozen) return;
    if (newStake <= 0) {
      setSelections((prev) => prev.filter((s) => s.number !== numStr));
      if (focusedNumber === numStr) setFocusedNumber(null);
      return;
    }
    setSelections((prev) =>
      prev.map((s) => (s.number === numStr ? { ...s, stake: newStake } : s))
    );
  };

  // Quick Pick Random numbers
  const handleQuickPick = (count: number, color?: 'GREEN' | 'RED') => {
    if (isFrozen) return;
    setErrorMessage(null);

    let candidates = allNumbers;
    if (color) {
      candidates = allNumbers.filter((n) => {
        const isEven = parseInt(n, 10) % 2 === 0;
        return color === 'GREEN' ? isEven : !isEven;
      });
    }

    const available = candidates.filter((n) => !selectionMap.has(n));
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    const toAdd = shuffled.slice(0, Math.min(count, 37 - selections.length));

    if (toAdd.length === 0) {
      setErrorMessage('No more numbers can be added (limit 37).');
      return;
    }

    const newItems: SelectionPayload[] = toAdd.map((numStr) => {
      const numVal = parseInt(numStr, 10);
      return {
        number: numStr,
        stake: activeStake,
        color: numVal % 2 === 0 ? 'GREEN' : 'RED',
      };
    });

    setSelections((prev) => [...prev, ...newItems]);
    setFocusedNumber(toAdd[toAdd.length - 1]);
  };

  // Clear all selections
  const handleClearAll = () => {
    if (isFrozen) return;
    setSelections([]);
    setFocusedNumber(null);
    setErrorMessage(null);
  };

  // Apply active stake to all currently selected numbers
  const handleApplyStakeToAll = () => {
    if (isFrozen || selections.length === 0) return;
    setSelections((prev) => prev.map((s) => ({ ...s, stake: activeStake })));
  };

  // Free Demo Coins Helper (so users can test any bid amount without zero balance blocks)
  const handleAddDemoCoins = () => {
    winoraEngine.addPlayerDemoCredits(1000);
    const u = winoraEngine.getCurrentUser();
    setCurrentDemoBalance(u.withdrawableBalancePaise / 100);
    setErrorMessage(null);
    onSuccessToast('Added ₹1,000 demo credits to your wallet for testing!');
  };

  // Totals calculations
  const selectionsCount = selections.length;
  const totalStake = useMemo(() => {
    return selections.reduce((sum, s) => sum + (s.stake || 0), 0);
  }, [selections]);

  const maxIndividualStake = useMemo(() => {
    if (selections.length === 0) return 0;
    return Math.max(...selections.map((s) => s.stake));
  }, [selections]);
  const potential90xReward = maxIndividualStake * 90;

  const hasInsufficientCredits = totalStake > currentDemoBalance;

  // Fast Validation
  const validateBeforeSubmit = (): string | null => {
    if (isFrozen) return 'Bidding is strictly frozen for this round.';
    if (selections.length === 0) return 'Please select at least 1 number to place a bid.';
    if (selections.length > 37) return 'Maximum 37 numbers allowed per round.';
    for (const sel of selections) {
      if (!sel.stake || sel.stake <= 0) {
        return `Please set a valid bid amount for number #${sel.number}.`;
      }
    }
    if (hasInsufficientCredits) {
      return `Insufficient balance (Need ₹${totalStake.toLocaleString()}, Available: ₹${currentDemoBalance.toLocaleString()}). Tap "+ ₹1,000 Demo Coins" to top up.`;
    }
    return null;
  };

  // Direct 1-Tap Place Bid Submission
  const handlePlaceBidDirect = async () => {
    if (isFrozen || isSubmitting) return;

    const err = validateBeforeSubmit();
    if (err) {
      setErrorMessage(err);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const activeRoundId = serverRound?.id || initialRound.id;
    const idempotencyKey = gameEntryApi.generateIdempotencyKey();

    try {
      // 1. Submit to server API
      const response = await gameEntryApi.submitEntry(user.id, {
        gameId: game.id,
        roundId: activeRoundId,
        selections,
        idempotencyKey,
      });

      if (response.success && response.entry) {
        setConfirmedEntry(response.entry);

        // 2. Debit engine wallet
        winoraEngine.placeBids({
          gameId: game.id as any,
          bids: selections.map((s) => ({
            number: parseInt(s.number, 10),
            amount: s.stake,
            color: s.color,
          })),
          walletType: 'main',
        });

        // Update local balance
        const u = winoraEngine.getCurrentUser();
        setCurrentDemoBalance(u.withdrawableBalancePaise / 100);

        onSuccessToast(`Bid confirmed! ₹${totalStake.toLocaleString()} placed on ${selectionsCount} number(s).`);
        setActiveView('success');
      } else {
        setErrorMessage(response.message || 'Failed to place bid. Please try again.');
      }
    } catch (e: any) {
      setErrorMessage(e?.message || 'Network error while placing bid.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForNewBid = () => {
    setSelections([]);
    setFocusedNumber(null);
    setConfirmedEntry(null);
    setErrorMessage(null);
    setActiveView('board');
  };

  return (
    <div
      id="game-board-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
    >
      <div
        id="game-board-modal-container"
        className="relative w-full max-w-4xl bg-zinc-900 border border-zinc-800 rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden max-h-[95vh]"
      >
        {/* ================================================================ */}
        {/* MODAL HEADER: Title, Timer, Balance & Close                      */}
        {/* ================================================================ */}
        <div className="p-3.5 sm:p-4 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-amber-400" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="font-display font-black text-sm sm:text-base text-zinc-100 truncate">
                  {game.name}
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 shrink-0">
                  90× Return
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 truncate">
                Round #{serverRound?.roundNumber || initialRound.roundNumber} • Select any number & amount
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Live Timer */}
            <div
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-bold ${
                isFrozen
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                  : 'bg-zinc-900 text-zinc-200 border-zinc-800'
              }`}
            >
              <Clock className="w-3.5 h-3.5 shrink-0 text-amber-400" />
              <span className="font-mono text-xs sm:text-sm font-black">{timeLeftStr || '00:00'}</span>
            </div>

            {/* My Entries button */}
            <button
              type="button"
              onClick={() => setActiveView(activeView === 'my-entries' ? 'board' : 'my-entries')}
              className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeView === 'my-entries'
                  ? 'bg-amber-500 text-zinc-950 border-amber-400 font-black'
                  : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:text-zinc-100'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">My Bids</span>
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-100 p-1.5 rounded-xl hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Close panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Global Error Notice */}
        {errorMessage && (
          <div className="bg-rose-950/70 border-b border-rose-500/40 px-4 py-2 flex items-center justify-between text-xs text-rose-300">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <div className="flex items-center gap-2">
              {hasInsufficientCredits && (
                <button
                  type="button"
                  onClick={handleAddDemoCoins}
                  className="px-2 py-0.5 rounded bg-emerald-500 text-zinc-950 font-bold hover:bg-emerald-400 cursor-pointer"
                >
                  + Add ₹1,000 Coins
                </button>
              )}
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-rose-300 hover:text-zinc-100 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Freeze Notice */}
        {isFrozen && (
          <div className="bg-rose-500/15 border-b border-rose-500/30 px-4 py-2 flex items-center gap-2 text-xs text-rose-300 font-bold">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>Bidding is currently FROZEN for this round. Bids will unlock for the next round.</span>
          </div>
        )}

        {/* ================================================================ */}
        {/* VIEW 1: SIMPLIFIED GAME BOARD (ANY AMOUNT, ANY NUMBER)           */}
        {/* ================================================================ */}
        {activeView === 'board' && (
          <div className="p-3 sm:p-4 overflow-y-auto space-y-3.5 flex-1">
            {/* 1. TOP CONTROLS BAR: Wallet Balance & Quick Top-Up */}
            <div className="bg-zinc-950 p-2.5 sm:p-3 rounded-2xl border border-zinc-800 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800">
                  <Coins className="w-4 h-4 text-amber-400" />
                  <span className="text-xs text-zinc-400 font-medium">Balance:</span>
                  <span className="text-amber-400 font-mono font-black text-sm">
                    ₹{currentDemoBalance.toLocaleString()}
                  </span>
                </div>
                {/* Instant Test Coins Top Up */}
                <button
                  type="button"
                  onClick={handleAddDemoCoins}
                  className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 transition-all flex items-center gap-1 cursor-pointer"
                  title="Add ₹1,000 demo credits to test bids"
                >
                  <Plus className="w-3 h-3" />
                  <span>+₹1,000 Free Coins</span>
                </button>
              </div>

              {/* Number Count Pill & Clear */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-zinc-300 bg-zinc-900 px-2.5 py-1 rounded-lg border border-zinc-800">
                  Selected:{' '}
                  <span className={`font-mono font-black ${selectionsCount === 37 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {selectionsCount}
                  </span>
                  /37
                </span>

                {selectionsCount > 0 && (
                  <button
                    type="button"
                    disabled={isFrozen}
                    onClick={handleClearAll}
                    className="text-xs text-zinc-400 hover:text-rose-400 flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Clear</span>
                  </button>
                )}
              </div>
            </div>

            {/* 2. BID AMOUNT SELECTOR: Preset Chips & Any Custom Amount */}
            <div className="bg-zinc-950 p-3 rounded-2xl border border-zinc-800 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-black uppercase text-zinc-300 tracking-wider flex items-center gap-1.5">
                    <span>Select Bid Amount</span>
                    <span className="text-[10px] text-zinc-400 font-normal normal-case">
                      (Tap any amount, then tap numbers to place immediately)
                    </span>
                  </span>
                </div>

                {/* Custom stake input for ANY amount */}
                <div className="flex items-center gap-1.5 self-start sm:self-auto">
                  <span className="text-xs font-bold text-zinc-400">Custom ₹:</span>
                  <div className="flex items-center bg-zinc-900 border border-zinc-700 rounded-xl px-1.5 py-0.5 focus-within:border-amber-400">
                    <button
                      type="button"
                      disabled={isFrozen || activeStake <= 1}
                      onClick={() => handleSelectChipStake(Math.max(1, activeStake - 5))}
                      className="p-1 text-zinc-400 hover:text-zinc-100 disabled:opacity-30 cursor-pointer"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      type="number"
                      min="1"
                      disabled={isFrozen}
                      value={customStakeInput}
                      onChange={(e) => handleCustomStakeInput(e.target.value)}
                      className="w-16 px-1 py-0.5 bg-transparent text-center font-mono font-black text-sm text-amber-400 focus:outline-none"
                      placeholder="25"
                    />
                    <button
                      type="button"
                      disabled={isFrozen}
                      onClick={() => handleSelectChipStake(activeStake + 5)}
                      className="p-1 text-zinc-400 hover:text-zinc-100 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  {selectionsCount > 0 && (
                    <button
                      type="button"
                      disabled={isFrozen}
                      onClick={handleApplyStakeToAll}
                      className="px-2 py-1 text-[11px] font-bold rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700 cursor-pointer"
                      title="Set all selected numbers to this amount"
                    >
                      Set All to ₹{activeStake}
                    </button>
                  )}
                </div>
              </div>

              {/* Preset Chips */}
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                {[5, 10, 25, 50, 100, 200, 500, 1000].map((preset) => {
                  const isActive = activeStake === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      disabled={isFrozen}
                      onClick={() => handleSelectChipStake(preset)}
                      className={`px-2.5 sm:px-3.5 py-1.5 rounded-xl font-mono text-xs sm:text-sm font-black transition-all cursor-pointer border ${
                        isActive
                          ? 'bg-amber-400 text-zinc-950 border-amber-300 shadow-md shadow-amber-500/20 scale-105'
                          : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      ₹{preset}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. INSTANT FOCUSED NUMBER INSPECTOR (Shows immediately when a number is selected!) */}
            {focusedNumber && (
              <div className="bg-amber-500/10 border border-amber-500/30 p-2.5 sm:p-3 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-400 text-zinc-950 font-mono font-black text-lg flex items-center justify-center shadow-lg shrink-0">
                    {focusedNumber}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-zinc-100">
                        Number {focusedNumber} Selected
                      </span>
                      {isHourlyGame && (
                        <span
                          className={`text-[10px] font-black px-1.5 py-0.2 rounded ${
                            parseInt(focusedNumber, 10) % 2 === 0
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {parseInt(focusedNumber, 10) % 2 === 0 ? 'GREEN (Even)' : 'RED (Odd)'}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-400">
                      Current Bid: <strong className="text-amber-400 font-mono">₹{focusedSelection?.stake || activeStake}</strong> •{' '}
                      Potential Win:{' '}
                      <strong className="text-emerald-400 font-mono">
                        ₹{((focusedSelection?.stake || activeStake) * 90).toLocaleString()} (90×)
                      </strong>
                    </p>
                  </div>
                </div>

                {/* Instant Amount Adjuster on this focused number */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-bold text-zinc-400">Adjust Bid:</span>
                  <button
                    type="button"
                    disabled={isFrozen}
                    onClick={() =>
                      handleUpdateNumberStake(
                        focusedNumber,
                        Math.max(1, (focusedSelection?.stake || activeStake) - 5)
                      )
                    }
                    className="px-2 py-1 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-xs font-bold border border-zinc-700 cursor-pointer"
                  >
                    -5
                  </button>
                  <button
                    type="button"
                    disabled={isFrozen}
                    onClick={() =>
                      handleUpdateNumberStake(
                        focusedNumber,
                        (focusedSelection?.stake || activeStake) + 5
                      )
                    }
                    className="px-2 py-1 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 text-xs font-bold border border-zinc-700 cursor-pointer"
                  >
                    +5
                  </button>
                  <button
                    type="button"
                    disabled={isFrozen}
                    onClick={() =>
                      handleUpdateNumberStake(
                        focusedNumber,
                        (focusedSelection?.stake || activeStake) + 25
                      )
                    }
                    className="px-2 py-1 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-xs font-bold border border-amber-500/30 cursor-pointer"
                  >
                    +25
                  </button>
                  <button
                    type="button"
                    disabled={isFrozen}
                    onClick={() =>
                      handleUpdateNumberStake(
                        focusedNumber,
                        (focusedSelection?.stake || activeStake) + 50
                      )
                    }
                    className="px-2 py-1 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-xs font-bold border border-amber-500/30 cursor-pointer"
                  >
                    +50
                  </button>
                  <button
                    type="button"
                    disabled={isFrozen}
                    onClick={() => {
                      setSelections((prev) => prev.filter((s) => s.number !== focusedNumber));
                      setFocusedNumber(null);
                    }}
                    className="px-2 py-1 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 text-xs font-bold border border-rose-500/30 flex items-center gap-1 cursor-pointer"
                    title="Remove this number"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Remove</span>
                  </button>
                </div>
              </div>
            )}

            {/* 4. 00–99 NUMBER BOARD */}
            <div className="bg-zinc-950 p-2.5 sm:p-3 rounded-2xl border border-zinc-800 space-y-2.5">
              {/* Filter Tabs & Quick Pick */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-black uppercase text-zinc-300 tracking-wider">
                    00–99 Numbers Board
                  </span>
                  {isHourlyGame && (
                    <div className="flex items-center gap-1 bg-zinc-900 p-0.5 rounded-lg border border-zinc-800 ml-2">
                      <button
                        type="button"
                        onClick={() => setColorTab('ALL')}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                          colorTab === 'ALL'
                            ? 'bg-amber-500 text-zinc-950'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        All (100)
                      </button>
                      <button
                        type="button"
                        onClick={() => setColorTab('GREEN')}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                          colorTab === 'GREEN'
                            ? 'bg-emerald-500 text-zinc-950'
                            : 'text-emerald-400 hover:text-emerald-300'
                        }`}
                      >
                        Green (50)
                      </button>
                      <button
                        type="button"
                        onClick={() => setColorTab('RED')}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                          colorTab === 'RED'
                            ? 'bg-rose-500 text-zinc-950'
                            : 'text-rose-400 hover:text-rose-300'
                        }`}
                      >
                        Red (50)
                      </button>
                    </div>
                  )}
                </div>

                {/* Quick Pick random buttons */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase">Quick Pick:</span>
                  <button
                    type="button"
                    disabled={isFrozen}
                    onClick={() => handleQuickPick(5)}
                    className="px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-[11px] font-bold text-zinc-300 cursor-pointer disabled:opacity-40"
                  >
                    +5 Random
                  </button>
                  <button
                    type="button"
                    disabled={isFrozen}
                    onClick={() => handleQuickPick(10)}
                    className="px-2 py-1 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-[11px] font-bold text-zinc-300 cursor-pointer disabled:opacity-40"
                  >
                    +10 Random
                  </button>
                  {isHourlyGame && (
                    <>
                      <button
                        type="button"
                        disabled={isFrozen}
                        onClick={() => handleQuickPick(5, 'GREEN')}
                        className="px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold cursor-pointer disabled:opacity-40"
                      >
                        +5 Green
                      </button>
                      <button
                        type="button"
                        disabled={isFrozen}
                        onClick={() => handleQuickPick(5, 'RED')}
                        className="px-2 py-1 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px] font-bold cursor-pointer disabled:opacity-40"
                      >
                        +5 Red
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Number Grid: 10 columns on tablet/desktop, 5 on mobile */}
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-1 sm:gap-1.5 p-1.5 sm:p-2 bg-zinc-900/60 rounded-xl border border-zinc-800/80">
                {displayedNumbers.map((numStr) => {
                  const sel = selectionMap.get(numStr);
                  const isSelected = Boolean(sel);
                  const isFocused = focusedNumber === numStr;
                  const numVal = parseInt(numStr, 10);
                  const isEven = numVal % 2 === 0;

                  return (
                    <button
                      key={numStr}
                      type="button"
                      id={`number-cell-${numStr}`}
                      disabled={isFrozen}
                      onClick={() => handleToggleNumber(numStr)}
                      className={`relative min-h-[50px] sm:min-h-[58px] rounded-xl flex flex-col items-center justify-center p-1 transition-all select-none cursor-pointer active:scale-95 disabled:cursor-not-allowed ${
                        isSelected
                          ? isFocused
                            ? 'bg-amber-400 text-zinc-950 font-black shadow-xl ring-2 ring-amber-300 z-10 scale-[1.02]'
                            : sel?.color === 'GREEN'
                              ? 'bg-emerald-600 text-white font-black shadow-md ring-1 ring-emerald-300'
                              : 'bg-rose-600 text-white font-black shadow-md ring-1 ring-rose-300'
                          : isHourlyGame
                            ? isEven
                              ? 'bg-emerald-950/20 text-emerald-200 border border-emerald-500/25 hover:border-emerald-400 hover:bg-emerald-900/30'
                              : 'bg-rose-950/20 text-rose-200 border border-rose-500/25 hover:border-rose-400 hover:bg-rose-900/30'
                            : 'bg-zinc-850 text-zinc-200 border border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800'
                      } ${isFrozen ? 'opacity-40' : ''}`}
                    >
                      {/* Number Display */}
                      <span className="font-mono text-sm sm:text-base font-black leading-none">
                        {numStr}
                      </span>

                      {/* When selected: BID AMOUNT SHOWS IMMEDIATELY RIGHT ON THIS TILE! */}
                      {isSelected && sel && (
                        <div
                          className={`mt-1 px-1 sm:px-1.5 py-0.5 rounded font-black text-[10px] sm:text-xs leading-none shadow-sm flex items-center justify-center ${
                            isFocused
                              ? 'bg-zinc-950 text-amber-300 font-mono'
                              : 'bg-zinc-950/80 text-amber-300 font-mono'
                          }`}
                        >
                          ₹{sel.stake}
                        </div>
                      )}

                      {/* Hourly color hint when not selected */}
                      {isHourlyGame && !isSelected && (
                        <span
                          className={`text-[8px] sm:text-[9px] font-bold leading-none mt-0.5 ${
                            isEven ? 'text-emerald-400/80' : 'text-rose-400/80'
                          }`}
                        >
                          {isEven ? 'GRN' : 'RED'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 5. SELECTED NUMBERS SUMMARY CHIPS (Fast overview) */}
            {selections.length > 0 && (
              <div className="bg-zinc-950 p-2.5 sm:p-3 rounded-2xl border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
                    Selected Bids ({selections.length}/37):
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    Tap any chip to adjust bid amount
                  </span>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
                  {selections.map((s) => (
                    <button
                      key={s.number}
                      type="button"
                      onClick={() => setFocusedNumber(s.number)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border transition-all shrink-0 cursor-pointer ${
                        focusedNumber === s.number
                          ? 'bg-amber-400 text-zinc-950 border-amber-300 font-black shadow-md'
                          : s.color === 'GREEN'
                            ? 'bg-emerald-950/50 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/50'
                            : 'bg-rose-950/50 text-rose-300 border-rose-500/40 hover:bg-rose-900/50'
                      }`}
                    >
                      <span className="font-mono font-black">#{s.number}</span>
                      <span className="font-mono text-amber-300 font-black bg-zinc-950/70 px-1 py-0.2 rounded">
                        ₹{s.stake}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* VIEW 2: SUCCESS RECEIPT                                         */}
        {/* ================================================================ */}
        {activeView === 'success' && confirmedEntry && (
          <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 flex flex-col items-center text-center justify-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center animate-bounce">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div>
              <h3 className="text-xl sm:text-2xl font-black font-display text-zinc-100">
                Bid Placed Successfully!
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Your entry #{confirmedEntry.id} is confirmed with the live draw engine.
              </p>
            </div>

            <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-left space-y-2 text-xs">
              <div className="flex justify-between border-b border-zinc-800 pb-2">
                <span className="text-zinc-400">Receipt Ref:</span>
                <span className="font-mono font-black text-amber-400">{confirmedEntry.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Game:</span>
                <span className="font-bold text-zinc-200">{confirmedEntry.gameName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Numbers Count:</span>
                <span className="font-mono font-bold text-zinc-200">
                  {confirmedEntry.selections.length} numbers
                </span>
              </div>
              <div className="flex justify-between border-t border-zinc-800/80 pt-2 font-bold">
                <span className="text-zinc-300">Total Stake Debited:</span>
                <span className="font-mono text-emerald-400 text-sm">
                  ₹{confirmedEntry.totalStake.toLocaleString()}
                </span>
              </div>

              {/* Number badges */}
              <div className="pt-1.5 flex flex-wrap gap-1 max-h-28 overflow-y-auto">
                {confirmedEntry.selections.map((s, idx) => (
                  <span
                    key={idx}
                    className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                      s.color === 'GREEN'
                        ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30'
                        : 'bg-rose-950/40 text-rose-300 border-rose-500/30'
                    }`}
                  >
                    #{s.number} (₹{s.stake})
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2 w-full max-w-md">
              <button
                type="button"
                onClick={() => setActiveView('my-entries')}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-750 text-zinc-200 border border-zinc-700 transition-all cursor-pointer"
              >
                View My Bids
              </button>
              <button
                type="button"
                onClick={handleResetForNewBid}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-zinc-950 transition-all cursor-pointer"
              >
                Place Another Bid
              </button>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* VIEW 3: MY ENTRIES / BIDS LEDGER                                 */}
        {/* ================================================================ */}
        {activeView === 'my-entries' && (
          <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-black text-base text-zinc-100">
                  My Bid History
                </h3>
                <p className="text-xs text-zinc-400">
                  Confirmed entries for {game.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveView('board')}
                className="px-3 py-1.5 rounded-xl text-xs font-black bg-amber-500 text-zinc-950 hover:bg-amber-400 cursor-pointer"
              >
                Back to Board
              </button>
            </div>

            {loadingEntries ? (
              <div className="py-12 flex flex-col items-center justify-center text-zinc-400 text-xs">
                <RefreshCw className="w-6 h-6 animate-spin text-amber-400 mb-2" />
                <span>Loading your entries...</span>
              </div>
            ) : userEntries.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 text-xs bg-zinc-950/60 rounded-2xl border border-zinc-800/80">
                <FileText className="w-8 h-8 mx-auto mb-2 text-zinc-600" />
                <p className="font-bold text-zinc-300">No entries placed yet for this game</p>
                <p className="text-[11px] mt-0.5">Select numbers on the board and tap Place Bid!</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {userEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-amber-400">{entry.id}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          {entry.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        {entry.selections.length} number(s) • Round #{entry.roundNumber} •{' '}
                        {new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      <div className="text-right">
                        <span className="text-[10px] text-zinc-400 uppercase font-bold block">Stake</span>
                        <span className="font-mono font-bold text-zinc-100 text-sm">
                          ₹{entry.totalStake.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================================================================ */}
        {/* MODAL FOOTER: Fast One-Tap "Place Bid" Action Bar               */}
        {/* ================================================================ */}
        <div className="p-3.5 sm:p-4 bg-zinc-950 border-t border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          {activeView === 'board' ? (
            <>
              {/* Summary Stats */}
              <div className="flex items-center gap-3 sm:gap-6 w-full sm:w-auto justify-between sm:justify-start">
                <div>
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block">Total Bid</span>
                  <p className="text-lg sm:text-xl font-mono font-black text-amber-400 leading-none">
                    ₹{totalStake.toLocaleString()}{' '}
                    <span className="text-xs font-normal text-zinc-400">
                      ({selectionsCount} {selectionsCount === 1 ? 'num' : 'nums'})
                    </span>
                  </p>
                </div>

                {selectionsCount > 0 && (
                  <div className="border-l border-zinc-800 pl-3 sm:pl-6">
                    <span className="text-[10px] uppercase font-bold text-emerald-400 block flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      Potential Win (90×)
                    </span>
                    <p className="text-base sm:text-lg font-mono font-black text-emerald-400 leading-none">
                      ₹{potential90xReward.toLocaleString()}
                    </p>
                  </div>
                )}
              </div>

              {/* Direct Place Bid Button */}
              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2.5 rounded-xl text-xs font-bold text-zinc-400 hover:text-zinc-200 bg-zinc-900 border border-zinc-800 cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  id="place-bid-button"
                  disabled={
                    isFrozen ||
                    selectionsCount === 0 ||
                    hasInsufficientCredits ||
                    selectionsCount > 37 ||
                    isSubmitting
                  }
                  onClick={handlePlaceBidDirect}
                  className="flex-1 sm:flex-none px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-black bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 active:scale-95 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Placing Bid...</span>
                    </>
                  ) : isFrozen ? (
                    <>
                      <AlertTriangle className="w-4 h-4" />
                      <span>Bidding Frozen</span>
                    </>
                  ) : hasInsufficientCredits ? (
                    <span>Insufficient Balance</span>
                  ) : selectionsCount === 0 ? (
                    <span>Select Numbers Above</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>PLACE BID (₹{totalStake.toLocaleString()})</span>
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={() => setActiveView('board')}
                className="px-5 py-2 rounded-xl text-xs font-black bg-amber-500 text-zinc-950 cursor-pointer hover:bg-amber-400"
              >
                Back to Game Board
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
