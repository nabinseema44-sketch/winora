import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Clock,
  AlertTriangle,
  Coins,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  TrendingUp,
  RotateCcw,
  ArrowRight,
  Check,
  Info,
  FileText,
  RefreshCw,
  Plus,
  Minus,
  Trash2,
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

type ModalView = 'board' | 'review' | 'success' | 'my-entries';

export const GameBoardModal: React.FC<GameBoardModalProps> = ({
  game,
  initialRound,
  user,
  onClose,
  onSuccessToast,
}) => {
  // Current active view
  const [activeView, setActiveView] = useState<ModalView>('board');

  // Selections array: each item has number ("00" to "99"), individual stake, and chosen color ('GREEN' | 'RED')
  const [selections, setSelections] = useState<SelectionPayload[]>([]);

  // Default active bidding controls for newly added numbers
  const [activeColor, setActiveColor] = useState<'GREEN' | 'RED'>('GREEN');
  const [defaultStake, setDefaultStake] = useState<number>(50);
  const [customStakeInput, setCustomStakeInput] = useState<string>('50');

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

  // Limit & action notices
  const [limitWarning, setLimitWarning] = useState<string | null>(null);

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

  // 2. Authoritative Round Countdown & 15-Minute Freeze Check
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

      // Server status check takes absolute priority
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

  // 3. Load User Entries for "My Entries" view
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

  // Pre-generate standard 00 to 99 string array
  const allNumbers: string[] = useMemo(() => {
    return Array.from({ length: 100 }, (_, i) => i.toString().padStart(2, '0'));
  }, []);

  // Map of selections by number string for fast O(1) lookup
  const selectionMap = useMemo(() => {
    const map = new Map<string, SelectionPayload>();
    selections.forEach((s) => map.set(s.number, s));
    return map;
  }, [selections]);

  // 4. Number Selection Toggle (Max 37 numbers rule)
  // Step 13 Rules: A player can pick ANY number (00-99) and bid GREEN or RED on it.
  const handleToggleNumber = (numStr: string) => {
    if (isFrozen) return;
    setLimitWarning(null);

    setSelections((prev) => {
      const exists = prev.find((s) => s.number === numStr);
      if (exists) {
        // Toggle OFF: remove selection
        return prev.filter((s) => s.number !== numStr);
      } else {
        // Toggle ON: check max 37 limit
        if (prev.length >= 37) {
          setLimitWarning('Maximum 37 numbers limit reached! Cannot select more numbers.');
          return prev;
        }
        return [
          ...prev,
          {
            number: numStr,
            stake: defaultStake,
            color: activeColor,
          },
        ];
      }
    });
  };

  // Modify individual selection stake
  const handleUpdateSelectionStake = (numStr: string, newStake: number) => {
    if (isFrozen) return;
    setSelections((prev) =>
      prev.map((s) => (s.number === numStr ? { ...s, stake: Math.max(0, newStake) } : s))
    );
  };

  // Set individual selection color explicitly (GREEN or RED)
  const handleSetSelectionColor = (numStr: string, color: 'GREEN' | 'RED') => {
    if (isFrozen) return;
    setSelections((prev) =>
      prev.map((s) => (s.number === numStr ? { ...s, color } : s))
    );
  };

  // Toggle individual selection color
  const handleToggleSelectionColor = (numStr: string) => {
    if (isFrozen) return;
    setSelections((prev) =>
      prev.map((s) =>
        s.number === numStr
          ? { ...s, color: s.color === 'GREEN' ? 'RED' : 'GREEN' }
          : s
      )
    );
  };

  // Remove individual selection
  const handleRemoveSelection = (numStr: string) => {
    if (isFrozen) return;
    setSelections((prev) => prev.filter((s) => s.number !== numStr));
  };

  // Batch: apply default stake to all current selections
  const handleApplyDefaultStakeToAll = () => {
    if (isFrozen || selections.length === 0) return;
    setSelections((prev) => prev.map((s) => ({ ...s, stake: defaultStake })));
  };

  // Batch: set all selections to GREEN
  const handleSetAllColor = (color: 'GREEN' | 'RED') => {
    if (isFrozen || selections.length === 0) return;
    setSelections((prev) => prev.map((s) => ({ ...s, color })));
  };

  // Clear All
  const handleClearAll = () => {
    if (isFrozen) return;
    setSelections([]);
    setLimitWarning(null);
  };

  // Preset stake change
  const handleSelectPresetStake = (amount: number) => {
    if (isFrozen) return;
    setDefaultStake(amount);
    setCustomStakeInput(amount.toString());
  };

  const handleCustomStakeChange = (valStr: string) => {
    if (isFrozen) return;
    setCustomStakeInput(valStr);
    const parsed = parseInt(valStr, 10);
    if (!isNaN(parsed) && parsed > 0) {
      setDefaultStake(parsed);
    }
  };

  // Calculations per Step 13 & 14 Rules:
  // totalStake = sum of each individual selection's stake
  const selectionsCount = selections.length;
  const totalStake = useMemo(() => {
    return selections.reduce((sum, s) => sum + (s.stake || 0), 0);
  }, [selections]);

  const greenSelections = useMemo(() => selections.filter((s) => s.color === 'GREEN'), [selections]);
  const redSelections = useMemo(() => selections.filter((s) => s.color === 'RED'), [selections]);

  const greenStakeTotal = useMemo(() => greenSelections.reduce((sum, s) => sum + s.stake, 0), [greenSelections]);
  const redStakeTotal = useMemo(() => redSelections.reduce((sum, s) => sum + s.stake, 0), [redSelections]);

  // Max potential 90x payout (if the highest-stake winning number hits)
  const maxIndividualStake = useMemo(() => {
    if (selections.length === 0) return 0;
    return Math.max(...selections.map((s) => s.stake));
  }, [selections]);
  const potential90xReward = maxIndividualStake * 90;

  // Withdrawable Balance check for game bidding
  const availableDemoBalance = user.withdrawableBalancePaise !== undefined ? user.withdrawableBalancePaise / 100 : user.mainBalance;
  const hasInsufficientCredits = totalStake > availableDemoBalance;

  // Comprehensive Step 14 Validation
  const validateSelections = (): string | null => {
    if (isFrozen) {
      return 'Bidding is strictly frozen for this round.';
    }
    if (selections.length === 0) {
      return 'Please select at least 1 number from the 00–99 grid.';
    }
    if (selections.length > 37) {
      return `Selection exceeds the maximum limit of 37 numbers (Currently selected: ${selections.length}).`;
    }

    const seen = new Set<string>();
    for (const sel of selections) {
      if (seen.has(sel.number)) {
        return `Duplicate number "${sel.number}" detected in selection.`;
      }
      seen.add(sel.number);

      if (typeof sel.stake !== 'number' || isNaN(sel.stake) || sel.stake <= 0) {
        return `Every stake must be greater than 0. Please enter a valid stake for #${sel.number}.`;
      }

      if (sel.color !== 'GREEN' && sel.color !== 'RED') {
        return `Every selection must have GREEN or RED chosen. Please check #${sel.number}.`;
      }
    }

    if (totalStake > availableDemoBalance) {
      return `Insufficient Withdrawable Balance. Required: ₹${totalStake.toLocaleString()}, Available: ₹${availableDemoBalance.toLocaleString()}.`;
    }

    return null;
  };

  // Validate before opening Review Panel
  const handleOpenReview = () => {
    const error = validateSelections();
    if (error) {
      setErrorMessage(error);
      return;
    }
    setErrorMessage(null);
    setActiveView('review');
  };

  // 5. Submit Entry to Step 14 API
  const handleConfirmSubmit = async () => {
    if (isFrozen || isSubmitting) return;

    const validationError = validateSelections();
    if (validationError) {
      setErrorMessage(validationError);
      setActiveView('board');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const activeRoundId = serverRound?.id || initialRound.id;
    const idempotencyKey = gameEntryApi.generateIdempotencyKey();

    // Call Step 13/14 game-entry API with selections array
    const response = await gameEntryApi.submitEntry(user.id, {
      gameId: game.id,
      roundId: activeRoundId,
      selections,
      idempotencyKey,
    });

    setIsSubmitting(false);

    if (response.success && response.entry) {
      setConfirmedEntry(response.entry);

      // Sync local engine wallet balance and add entry to engine state
      const bidsForEngine = selections.map((s) => ({
        number: parseInt(s.number, 10),
        amount: s.stake,
        color: s.color,
      }));

      winoraEngine.placeBids({
        gameId: game.id as any,
        bids: bidsForEngine,
        walletType: 'main',
      });

      onSuccessToast(`Entry ${response.entry.id} confirmed! ₹${totalStake.toLocaleString()} demo credits staked.`);
      setActiveView('success');
    } else {
      const errorText =
        response.message || 'Unable to confirm entry. Please review your selections and try again.';
      setErrorMessage(errorText);
      setActiveView('board');
    }
  };

  const handleResetForNewRound = () => {
    setSelections([]);
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
        id="game-board-modal"
        className="bg-zinc-900 border border-zinc-750 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[96vh] animate-in fade-in zoom-in-95 duration-150"
      >
        {/* ==================================================================== */}
        {/* MODAL HEADER: Game Title, Round Status, 15m Freeze Countdown */}
        {/* ==================================================================== */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 border-b border-zinc-800 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {game.code}
              </span>
              <h2 className="text-lg sm:text-xl font-black text-zinc-100 font-display">
                {game.name}
              </h2>
              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30">
                90× Payout
              </span>
              <span className="text-[11px] font-mono text-zinc-400">
                Round #{serverRound?.roundNumber || initialRound.roundNumber}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Bid on any number 00–99. Choose GREEN or RED per selection. 15m cutoff applies.
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Countdown / Freeze Status Badge */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold ${
                isFrozen
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                  : 'bg-zinc-950 text-zinc-200 border-zinc-700'
              }`}
            >
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <div className="flex flex-col text-right leading-tight">
                <span className="text-[9px] uppercase tracking-wider text-zinc-400">
                  {isFrozen ? 'Bidding Frozen' : 'Freeze Deadline'}
                </span>
                <span className="font-mono text-xs sm:text-sm font-black">{timeLeftStr}</span>
              </div>
            </div>

            {/* My Entries Toggle */}
            <button
              type="button"
              onClick={() => setActiveView(activeView === 'my-entries' ? 'board' : 'my-entries')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeView === 'my-entries'
                  ? 'bg-amber-500 text-zinc-950 border-amber-400'
                  : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:text-zinc-100 hover:bg-zinc-750'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">My Entries</span>
            </button>

            {/* Close Modal */}
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-100 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Freeze Notice Banner */}
        {isFrozen ? (
          <div className="bg-rose-500/15 border-b border-rose-500/30 px-4 py-2.5 flex items-center gap-2 text-xs text-rose-300 font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>
              <strong>Bidding Frozen:</strong> Cutoff occurs 15 minutes prior to draw time. The server has locked submissions for this round.
            </span>
          </div>
        ) : (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-between text-xs text-amber-300/90 font-medium">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              15-minute freeze cutoff enforced. Submissions open until cutoff time.
            </span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              80% Matching Color Protection Refund
            </span>
          </div>
        )}

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="bg-rose-500/20 border-b border-rose-500/40 px-4 py-2 flex items-center justify-between text-xs text-rose-300">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-rose-300 hover:text-zinc-100 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ==================================================================== */}
        {/* VIEW 1: MAIN 00–99 GAME BOARD WITH PER-NUMBER STAKE & COLOR */}
        {/* ==================================================================== */}
        {activeView === 'board' && (
          <div className="p-4 overflow-y-auto space-y-4 flex-1">
            {/* Top Bar: Single Main Wallet & Bidding Defaults Bar */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Single Main Wallet Card */}
              <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider block">
                    Main Wallet (One Wallet System)
                  </span>
                  <p className="text-xs text-zinc-400">
                    All game debits, 90× winnings & 80% refunds credit here.
                  </p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-bold text-zinc-200">
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-amber-400 font-mono font-black text-sm">
                    ₹{user.mainBalance.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Next Added Selection Controls (Color + Stake) */}
              <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 flex items-center justify-between gap-2 flex-wrap">
                {/* Active Color Toggle */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase font-bold text-zinc-400">Next Color:</span>
                  <div className="inline-flex rounded-lg p-0.5 bg-zinc-900 border border-zinc-800">
                    <button
                      type="button"
                      disabled={isFrozen}
                      onClick={() => setActiveColor('GREEN')}
                      className={`px-2.5 py-1 rounded-md text-xs font-black transition-all cursor-pointer ${
                        activeColor === 'GREEN'
                          ? 'bg-emerald-500 text-zinc-950 shadow-sm'
                          : 'text-zinc-400 hover:text-emerald-300'
                      }`}
                    >
                      GREEN
                    </button>
                    <button
                      type="button"
                      disabled={isFrozen}
                      onClick={() => setActiveColor('RED')}
                      className={`px-2.5 py-1 rounded-md text-xs font-black transition-all cursor-pointer ${
                        activeColor === 'RED'
                          ? 'bg-rose-500 text-zinc-950 shadow-sm'
                          : 'text-zinc-400 hover:text-rose-300'
                      }`}
                    >
                      RED
                    </button>
                  </div>
                </div>

                {/* Default Stake presets */}
                <div className="flex items-center gap-1">
                  {[10, 50, 100, 200, 500].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      disabled={isFrozen}
                      onClick={() => handleSelectPresetStake(preset)}
                      className={`px-2 py-1 rounded-lg text-xs font-bold font-mono border transition-all cursor-pointer ${
                        defaultStake === preset
                          ? 'bg-amber-500 text-zinc-950 border-amber-400 font-black'
                          : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800'
                      }`}
                    >
                      ₹{preset}
                    </button>
                  ))}
                  <div className="relative pl-1">
                    <input
                      type="number"
                      min="1"
                      disabled={isFrozen}
                      value={customStakeInput}
                      onChange={(e) => handleCustomStakeChange(e.target.value)}
                      className="w-14 px-1.5 py-1 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-zinc-100 font-mono font-bold text-center"
                      title="Custom default stake"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Selection Status & Batch Controls Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
              <div className="flex items-center gap-3">
                {/* Selection Count Pill */}
                <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 px-3 py-1.5 rounded-xl">
                  <span className="text-xs font-bold text-zinc-300">
                    Selected:{' '}
                    <span
                      className={`font-mono text-sm font-black ${
                        selectionsCount === 37 ? 'text-amber-400' : 'text-zinc-100'
                      }`}
                    >
                      {selectionsCount}
                    </span>{' '}
                    / <span className="text-zinc-400">37</span>
                  </span>
                  <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        selectionsCount === 37 ? 'bg-amber-400' : 'bg-emerald-400'
                      }`}
                      style={{ width: `${Math.min(100, (selectionsCount / 37) * 100)}%` }}
                    />
                  </div>
                </div>

                {selectionsCount > 0 && (
                  <button
                    type="button"
                    disabled={isFrozen}
                    onClick={handleClearAll}
                    className="text-xs text-zinc-400 hover:text-rose-400 flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Clear All</span>
                  </button>
                )}
              </div>

              {/* Batch modifiers */}
              {selectionsCount > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap text-xs">
                  <span className="text-[11px] font-bold text-zinc-400">Set All:</span>
                  <button
                    type="button"
                    disabled={isFrozen}
                    onClick={() => handleSetAllColor('GREEN')}
                    className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors cursor-pointer"
                  >
                    All Green
                  </button>
                  <button
                    type="button"
                    disabled={isFrozen}
                    onClick={() => handleSetAllColor('RED')}
                    className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25 transition-colors cursor-pointer"
                  >
                    All Red
                  </button>
                  <button
                    type="button"
                    disabled={isFrozen}
                    onClick={handleApplyDefaultStakeToAll}
                    className="px-2 py-0.5 rounded text-[11px] font-bold bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-750 transition-colors cursor-pointer"
                  >
                    Apply ₹{defaultStake} to All
                  </button>
                </div>
              )}
            </div>

            {/* Warning notice */}
            {limitWarning && (
              <div className="bg-amber-500/15 border border-amber-500/30 rounded-xl p-2.5 flex items-center justify-between gap-2 text-xs text-amber-300">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>{limitWarning}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setLimitWarning(null)}
                  className="text-amber-400 hover:text-zinc-100 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* ================================================================ */}
            {/* 00–99 NUMBER BOARD (10x10 GRID) */}
            {/* Each cell shows number. If selected, shows color badge & stake */}
            {/* ================================================================ */}
            <div className="bg-zinc-950 p-2.5 sm:p-3 rounded-2xl border border-zinc-800">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  00–99 Number Board (Tap to toggle selection)
                </span>
                <span className="text-[11px] text-zinc-400">
                  New numbers added as <strong className={activeColor === 'GREEN' ? 'text-emerald-400' : 'text-rose-400'}>{activeColor}</strong> @ ₹{defaultStake}
                </span>
              </div>

              <div className="grid grid-cols-10 gap-1 sm:gap-1.5 p-1 bg-zinc-900/50 rounded-xl border border-zinc-800/80">
                {allNumbers.map((numStr) => {
                  const sel = selectionMap.get(numStr);
                  const isSelected = Boolean(sel);

                  return (
                    <button
                      key={numStr}
                      type="button"
                      id={`number-cell-${numStr}`}
                      disabled={isFrozen}
                      onClick={() => handleToggleNumber(numStr)}
                      className={`relative aspect-square rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer select-none active:scale-95 disabled:cursor-not-allowed ${
                        isSelected
                          ? sel?.color === 'GREEN'
                            ? 'bg-emerald-500 text-zinc-950 font-black shadow-md ring-2 ring-emerald-300 z-10'
                            : 'bg-rose-500 text-zinc-950 font-black shadow-md ring-2 ring-rose-300 z-10'
                          : 'bg-zinc-850 text-zinc-200 border border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800'
                      } ${isFrozen ? 'opacity-40' : ''}`}
                    >
                      <span className="font-mono text-xs sm:text-sm font-bold leading-none">
                        {numStr}
                      </span>
                      {isSelected && sel && (
                        <span className="text-[8px] sm:text-[9px] font-black leading-none mt-0.5 opacity-90">
                          ₹{sel.stake}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ================================================================ */}
            {/* SELECTED SELECTIONS LIST (ITEMIZED WITH INDIVIDUAL STAKE & COLOR) */}
            {/* ================================================================ */}
            {selections.length > 0 && (
              <div className="bg-zinc-950 p-3 rounded-2xl border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                    Selected Bids ({selections.length} / 37) — Customize per number:
                  </span>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-emerald-400 font-bold">
                      {greenSelections.length} Green (₹{greenStakeTotal.toLocaleString()})
                    </span>
                    <span className="text-rose-400 font-bold">
                      {redSelections.length} Red (₹{redStakeTotal.toLocaleString()})
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                  {selections.map((sel) => (
                    <div
                      key={sel.number}
                      className="bg-zinc-900 border border-zinc-800 rounded-xl p-2 flex items-center justify-between gap-2"
                    >
                      {/* Number & GREEN/RED Selector */}
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-black text-sm text-zinc-100 bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">
                          #{sel.number}
                        </span>

                        {/* Explicit GREEN / RED Selector */}
                        <div className="inline-flex rounded-lg p-0.5 bg-zinc-950 border border-zinc-750">
                          <button
                            type="button"
                            id={`selection-color-green-${sel.number}`}
                            disabled={isFrozen}
                            onClick={() => handleSetSelectionColor(sel.number, 'GREEN')}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-black cursor-pointer transition-all ${
                              sel.color === 'GREEN'
                                ? 'bg-emerald-500 text-zinc-950 shadow-sm'
                                : 'text-zinc-400 hover:text-emerald-300'
                            }`}
                            title="Set color to GREEN"
                          >
                            GREEN
                          </button>
                          <button
                            type="button"
                            id={`selection-color-red-${sel.number}`}
                            disabled={isFrozen}
                            onClick={() => handleSetSelectionColor(sel.number, 'RED')}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-black cursor-pointer transition-all ${
                              sel.color === 'RED'
                                ? 'bg-rose-500 text-zinc-950 shadow-sm'
                                : 'text-zinc-400 hover:text-rose-300'
                            }`}
                            title="Set color to RED"
                          >
                            RED
                          </button>
                        </div>
                      </div>

                      {/* Stake +/- and Input */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          id={`stake-minus-${sel.number}`}
                          disabled={isFrozen || sel.stake <= 1}
                          onClick={() => handleUpdateSelectionStake(sel.number, Math.max(1, sel.stake - 5))}
                          className="w-5 h-5 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 flex items-center justify-center cursor-pointer disabled:opacity-30"
                          title="Decrease stake by 5"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <div className="relative">
                          <span className="text-[10px] text-zinc-400 absolute left-1.5 top-0.5 pointer-events-none">₹</span>
                          <input
                            type="number"
                            id={`stake-input-${sel.number}`}
                            min="1"
                            disabled={isFrozen}
                            value={sel.stake === 0 ? '' : sel.stake}
                            onChange={(e) => {
                              const raw = e.target.value;
                              if (raw === '') {
                                handleUpdateSelectionStake(sel.number, 0);
                              } else {
                                const v = parseInt(raw, 10);
                                if (!isNaN(v)) handleUpdateSelectionStake(sel.number, Math.max(0, v));
                              }
                            }}
                            onBlur={() => {
                              if (sel.stake <= 0) {
                                handleUpdateSelectionStake(sel.number, 5);
                              }
                            }}
                            className="w-16 pl-4 pr-1 py-0.5 bg-zinc-950 border border-zinc-700 rounded text-xs text-zinc-100 font-mono font-bold text-center focus:border-amber-400 focus:outline-none"
                            placeholder="5"
                          />
                        </div>
                        <button
                          type="button"
                          id={`stake-plus-${sel.number}`}
                          disabled={isFrozen}
                          onClick={() => handleUpdateSelectionStake(sel.number, sel.stake + 5)}
                          className="w-5 h-5 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 flex items-center justify-center cursor-pointer"
                          title="Increase stake by 5"
                        >
                          <Plus className="w-3 h-3" />
                        </button>

                        {/* Remove */}
                        <button
                          type="button"
                          id={`remove-selection-${sel.number}`}
                          disabled={isFrozen}
                          onClick={() => handleRemoveSelection(sel.number)}
                          className="w-5 h-5 rounded text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 flex items-center justify-center cursor-pointer ml-1"
                          title="Remove selection"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Live Calculations Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Total Stake */}
              <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                  Total Stake (Sum of Individual Stakes)
                </span>
                <p className="text-xl font-black text-zinc-100 font-mono mt-0.5">
                  ₹{totalStake.toLocaleString()}{' '}
                  <span className="text-xs font-normal text-zinc-400">demo credits</span>
                </p>
                <span className="text-[10px] text-zinc-400">
                  Authoritatively deducted from Main Wallet
                </span>
              </div>

              {/* Potential 90x Reward */}
              <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  Potential 90× Winning Reward
                </span>
                <p className="text-xl font-black text-emerald-400 font-mono mt-0.5">
                  ₹{potential90xReward.toLocaleString()}{' '}
                  <span className="text-xs font-normal text-emerald-400/80">demo credits</span>
                </p>
                <span className="text-[10px] text-zinc-400">
                  Exact winning number match pays stake × 90
                </span>
              </div>

              {/* Matching Color Protection Refund Notice */}
              <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  Color Protection (80%)
                </span>
                <p className="text-xs font-bold text-cyan-300 mt-1">
                  80% Refund on Matching Color
                </p>
                <span className="text-[10px] text-zinc-400">
                  Master declares Winning Number AND Result Color (GREEN or RED). Matching color returns 80% stake.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* VIEW 2: REVIEW PANEL (CONFIRMATION SHEET) */}
        {/* ==================================================================== */}
        {activeView === 'review' && (
          <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <h3 className="font-display font-black text-lg text-zinc-100 uppercase tracking-wide">
                    WINORA ENTRY REVIEW
                  </h3>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Main Wallet Demo Credits
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-zinc-900 p-2.5 rounded-xl border border-zinc-800">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block">Game</span>
                  <span className="font-bold text-zinc-200 text-sm">{game.name}</span>
                </div>
                <div className="bg-zinc-900 p-2.5 rounded-xl border border-zinc-800">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block">Round</span>
                  <span className="font-bold text-zinc-200 text-sm">
                    #{serverRound?.roundNumber || initialRound.roundNumber}
                  </span>
                </div>
                <div className="bg-zinc-900 p-2.5 rounded-xl border border-zinc-800">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block">Wallet</span>
                  <span className="font-bold text-amber-400 text-sm">
                    Main Wallet
                  </span>
                </div>
                <div className="bg-zinc-900 p-2.5 rounded-xl border border-zinc-800">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block">Selections</span>
                  <span className="font-bold text-amber-400 text-sm">{selectionsCount} / 37</span>
                </div>
              </div>

              {/* Selections Breakdown Table */}
              <div>
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">
                  Itemized Selections ({selectionsCount}):
                </span>
                <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
                  <div className="max-h-48 overflow-y-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-zinc-950 text-[10px] uppercase text-zinc-400 font-bold border-b border-zinc-800">
                        <tr>
                          <th className="p-2.5">Number</th>
                          <th className="p-2.5">Chosen Color</th>
                          <th className="p-2.5 text-right">Individual Stake</th>
                          <th className="p-2.5 text-right">90× Win Reward</th>
                          <th className="p-2.5 text-right">80% Color Refund</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800 font-mono">
                        {selections.map((s) => (
                          <tr key={s.number} className="hover:bg-zinc-850/50">
                            <td className="p-2.5 font-bold text-zinc-100">#{s.number}</td>
                            <td className="p-2.5">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                  s.color === 'GREEN'
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                }`}
                              >
                                {s.color}
                              </span>
                            </td>
                            <td className="p-2.5 text-right font-bold text-zinc-200">
                              ₹{s.stake.toLocaleString()}
                            </td>
                            <td className="p-2.5 text-right text-emerald-400">
                              ₹{(s.stake * 90).toLocaleString()}
                            </td>
                            <td className="p-2.5 text-right text-cyan-300">
                              ₹{Math.round(s.stake * 0.8).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Totals Breakdown */}
              <div className="space-y-2 border-t border-zinc-800 pt-3 text-xs">
                <div className="flex justify-between text-base font-black text-zinc-100">
                  <span>Total Stake Required:</span>
                  <span className="font-mono text-amber-400">₹{totalStake.toLocaleString()} demo credits</span>
                </div>
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>Green Bids Total:</span>
                  <span className="font-mono text-emerald-400">₹{greenStakeTotal.toLocaleString()} ({greenSelections.length} bids)</span>
                </div>
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>Red Bids Total:</span>
                  <span className="font-mono text-rose-400">₹{redStakeTotal.toLocaleString()} ({redSelections.length} bids)</span>
                </div>
              </div>

              {/* Disclaimer Notice */}
              <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl text-[11px] text-zinc-400 leading-relaxed">
                <p>
                  <strong>Notice:</strong> This is strictly an interactive virtual demo prototype. No real money or payment gateway is processed. The server calculates authoritative total stake and enforces the 15-minute freeze cutoff.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* VIEW 3: SUCCESS CONFIRMATION */}
        {/* ==================================================================== */}
        {activeView === 'success' && confirmedEntry && (
          <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mb-1">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-2xl font-black font-display text-zinc-100">
                Entry Confirmed!
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Your entry has been securely registered with the server-authoritative Step 13 engine.
              </p>
            </div>

            <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-left space-y-2.5 text-xs">
              <div className="flex justify-between border-b border-zinc-800 pb-2">
                <span className="text-zinc-400 font-medium">Entry Reference:</span>
                <span className="font-mono font-black text-amber-400 tracking-wider">
                  {confirmedEntry.id}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-zinc-400">Game:</span>
                <span className="font-bold text-zinc-200">{confirmedEntry.gameName}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-zinc-400">Round:</span>
                <span className="font-mono font-bold text-zinc-200">
                  #{confirmedEntry.roundNumber}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-zinc-400">Selections Count:</span>
                <span className="font-mono font-bold text-zinc-200">
                  {confirmedEntry.selections.length} numbers
                </span>
              </div>

              <div className="flex justify-between border-t border-zinc-800/80 pt-2 font-bold">
                <span className="text-zinc-300">Total Demo Stake:</span>
                <span className="font-mono text-zinc-100">
                  ₹{confirmedEntry.totalStake.toLocaleString()} (Main Wallet)
                </span>
              </div>

              {/* Mini chips */}
              <div className="pt-1 flex flex-wrap gap-1">
                {confirmedEntry.selections.map((s, idx) => (
                  <span
                    key={idx}
                    className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                      s.color === 'GREEN'
                        ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30'
                        : 'bg-rose-950/40 text-rose-300 border-rose-500/30'
                    }`}
                  >
                    #{s.number} (₹{s.stake} {s.color})
                  </span>
                ))}
              </div>

              <div className="flex justify-between border-t border-zinc-800/80 pt-2">
                <span className="text-zinc-400">Status:</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  {confirmedEntry.status}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2 w-full max-w-md">
              <button
                type="button"
                onClick={() => setActiveView('my-entries')}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-750 text-zinc-200 border border-zinc-700 transition-all cursor-pointer"
              >
                View My Entries
              </button>
              <button
                type="button"
                onClick={handleResetForNewRound}
                className="flex-1 py-2.5 px-4 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-zinc-950 transition-all cursor-pointer"
              >
                Back to Game
              </button>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* VIEW 4: MY ENTRIES (PLAYER-ONLY SECURE ENTRY LEDGER) */}
        {/* ==================================================================== */}
        {activeView === 'my-entries' && (
          <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-black text-base text-zinc-100">
                  My Game Entries
                </h3>
                <p className="text-xs text-zinc-400">
                  Authoritative record of your submissions for {game.name}. Read-only ledger.
                </p>
              </div>

              <button
                type="button"
                onClick={loadMyEntries}
                className="p-1.5 rounded-lg bg-zinc-800 text-zinc-300 hover:text-zinc-100 transition-colors cursor-pointer"
                title="Refresh Entries"
              >
                <RefreshCw className={`w-4 h-4 ${loadingEntries ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {loadingEntries ? (
              <div className="py-12 text-center text-xs text-zinc-400">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-amber-400" />
                <span>Loading your entries from server...</span>
              </div>
            ) : userEntries.length === 0 ? (
              <div className="py-12 text-center bg-zinc-950 rounded-2xl border border-zinc-800 text-xs text-zinc-400 space-y-2">
                <FileText className="w-8 h-8 mx-auto text-zinc-600" />
                <p>No entries found for your account.</p>
                <button
                  type="button"
                  onClick={() => setActiveView('board')}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-zinc-950 cursor-pointer"
                >
                  Place Your First Entry
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {userEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="bg-zinc-950 border border-zinc-800 p-3.5 rounded-xl space-y-2 text-xs hover:border-zinc-700 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-amber-400 text-xs">
                          {entry.id}
                        </span>
                        <span className="text-zinc-300 font-bold">{entry.gameName}</span>
                        <span className="text-[10px] text-zinc-400">Round #{entry.roundNumber}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        {entry.settledWinningNumber && (
                          <span className="font-mono text-[10px] text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/30 font-black">
                            Winner: [{entry.settledWinningNumber}] {entry.settledResultColor}
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            entry.status === 'WON'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                          }`}
                        >
                          {entry.status}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {entry.selections.map((s, idx) => (
                        <span
                          key={idx}
                          className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded border flex items-center gap-1 ${
                            s.color === 'GREEN'
                              ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30'
                              : 'bg-rose-950/40 text-rose-300 border-rose-500/30'
                          }`}
                        >
                          <span>#{s.number}</span>
                          <span className="text-[9px] opacity-75">₹{s.stake}</span>
                          <span className="text-[8px] font-black">{s.color}</span>
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between border-t border-zinc-900 pt-2 text-[11px] text-zinc-400">
                      <div>
                        Stake:{' '}
                        <strong className="text-zinc-200">
                          ₹{entry.totalStake.toLocaleString()}
                        </strong>{' '}
                        ({entry.selections.length} numbers)
                      </div>
                      <div className="flex items-center gap-3">
                        {entry.settledReward !== undefined && entry.settledReward > 0 && (
                          <span className="text-emerald-400 font-bold font-mono">
                            +₹{entry.settledReward.toLocaleString()} 90×
                          </span>
                        )}
                        {entry.protectionRefund !== undefined && entry.protectionRefund > 0 && (
                          <span className="text-cyan-300 font-bold font-mono">
                            +₹{entry.protectionRefund.toLocaleString()} Refund
                          </span>
                        )}
                        <span>
                          {new Date(entry.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          • {new Date(entry.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* MODAL FOOTER: Balance Info & Action Buttons */}
        {/* ==================================================================== */}
        <div className="p-4 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between gap-3">
          {activeView === 'board' && (
            <>
              <div className="flex flex-col">
                <span className="text-xs text-zinc-400">
                  Demo Balance: ₹{availableDemoBalance.toLocaleString()} (Main Wallet)
                </span>
                {hasInsufficientCredits && (
                  <span className="text-xs text-rose-400 font-bold">
                    Insufficient demo coins (Need ₹
                    {(totalStake - availableDemoBalance).toLocaleString()} more)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-zinc-200 bg-zinc-900 border border-zinc-800 cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  id="review-entry-button"
                  disabled={
                    isFrozen || selectionsCount === 0 || hasInsufficientCredits || selectionsCount > 37
                  }
                  onClick={handleOpenReview}
                  className="px-6 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 to-amber-400 text-zinc-950 hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
                >
                  {isFrozen ? (
                    <>
                      <AlertTriangle className="w-4 h-4" />
                      Bidding Frozen
                    </>
                  ) : (
                    <>
                      <span>Review Entry ({selectionsCount} Nos • ₹{totalStake.toLocaleString()})</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </>
          )}

          {activeView === 'review' && (
            <>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setActiveView('board')}
                className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-zinc-200 bg-zinc-900 border border-zinc-800 cursor-pointer"
              >
                Back to Board
              </button>

              <button
                type="button"
                id="confirm-entry-button"
                disabled={isSubmitting || isFrozen}
                onClick={handleConfirmSubmit}
                className="px-7 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-emerald-500 to-teal-400 text-zinc-950 hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Securing Entry...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    CONFIRM ENTRY (Demo Credits Only)
                  </>
                )}
              </button>
            </>
          )}

          {activeView === 'my-entries' && (
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
