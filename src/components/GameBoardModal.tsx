import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Clock,
  AlertTriangle,
  Coins,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  HelpCircle,
  TrendingUp,
  RotateCcw,
  ArrowRight,
  ListFilter,
  Check,
  Info,
  Layers,
  FileText,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { WinoraGameConfig, GameRound, UserProfile } from '../types.ts';
import {
  gameEntryApi,
  ServerRoundInfo,
  ServerColorClassification,
  ConfirmedGameEntry,
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

  // Selected numbers state: store as array of exact 2-digit strings (e.g. '00', '07', '99')
  const [selectedNumbers, setSelectedNumbers] = useState<string[]>([]);

  // Stake per selected number (default ₹50 demo credits)
  const [stakePerNumber, setStakePerNumber] = useState<number>(50);
  const [customStakeInput, setCustomStakeInput] = useState<string>('50');

  // Server-authoritative round data and color configuration
  const [serverRound, setServerRound] = useState<ServerRoundInfo | null>(null);
  const [colorConfig, setColorConfig] = useState<ServerColorClassification | null>(null);
  const [serverTimeOffsetMs, setServerTimeOffsetMs] = useState<number>(0);

  // Live timer display
  const [timeLeftStr, setTimeLeftStr] = useState<string>('');
  const [isFrozen, setIsFrozen] = useState<boolean>(false);
  const [serverStatusText, setServerStatusText] = useState<string>('OPEN');

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmedEntry, setConfirmedEntry] = useState<ConfirmedGameEntry | null>(null);

  // My Entries state
  const [userEntries, setUserEntries] = useState<ConfirmedGameEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState<boolean>(false);

  // Filter limit warning
  const [limitWarning, setLimitWarning] = useState<string | null>(null);

  // 1. Fetch server-authoritative round configuration and color classification on mount
  useEffect(() => {
    let isMounted = true;

    async function loadServerConfig() {
      const config = await gameEntryApi.fetchGamesConfig();
      if (!isMounted) return;

      if (config) {
        if (config.rounds && config.rounds[game.id]) {
          setServerRound(config.rounds[game.id]);
        }
        if (config.colorClassification) {
          setColorConfig(config.colorClassification);
        }
        if (config.serverTime) {
          const serverMs = new Date(config.serverTime).getTime();
          setServerTimeOffsetMs(serverMs - Date.now());
        }
      } else {
        // Fallback to initialRound
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
    const interval = setInterval(loadServerConfig, 10000); // Polling every 10s for authoritative status
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

      // Server status check takes absolute priority over client clock
      const isServerLocked =
        currentRound.status === 'FROZEN' ||
        currentRound.status === 'PROCESSING' ||
        currentRound.status === 'COMPLETED' ||
        diffFreeze <= 0;

      if (isServerLocked) {
        setIsFrozen(true);
        setServerStatusText(currentRound.status || 'FROZEN');
        if (diffDeclare > 0) {
          const m = Math.floor(diffDeclare / 60000);
          const s = Math.floor((diffDeclare % 60000) / 1000);
          setTimeLeftStr(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')} to draw`);
        } else {
          setTimeLeftStr('Declaring Result');
        }
      } else {
        setIsFrozen(false);
        setServerStatusText('OPEN');
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

  // Helper: check if a number string is classified as Green by server configuration
  const isNumberGreen = (numStr: string): boolean => {
    if (game.id !== 'hourly_dhamaka') return false;
    if (colorConfig && colorConfig.greenNumbers) {
      return colorConfig.greenNumbers.includes(numStr);
    }
    // Fallback: 00 through 49
    const val = parseInt(numStr, 10);
    return val >= 0 && val <= 49;
  };

  // 4. Number Selection Logic (Max 37 numbers rule)
  const handleToggleNumber = (numStr: string) => {
    if (isFrozen) return;
    setLimitWarning(null);

    setSelectedNumbers((prev) => {
      if (prev.includes(numStr)) {
        return prev.filter((n) => n !== numStr);
      } else {
        if (prev.length >= 37) {
          setLimitWarning('Maximum 37 numbers limit reached! Cannot select more numbers.');
          return prev;
        }
        return [...prev, numStr];
      }
    });
  };

  // Clear All
  const handleClearAll = () => {
    if (isFrozen) return;
    setSelectedNumbers([]);
    setLimitWarning(null);
  };

  // Hourly Dhamaka Quick Filter Handlers
  const handleSelectAllGreen = () => {
    if (isFrozen) return;
    const greenList = colorConfig?.greenNumbers || allNumbers.slice(0, 50);

    // Rule: Total green numbers is 50, but max allowed is 37.
    // Display limit warning and deterministically select the first 37 green numbers.
    if (greenList.length > 37) {
      const first37 = greenList.slice(0, 37);
      setSelectedNumbers(first37);
      setLimitWarning(
        `Selection exceeds the 37-number limit (Total Green: ${greenList.length}). Selected the first 37 numbers (${first37[0]}–${first37[36]}).`
      );
    } else {
      setSelectedNumbers(greenList);
      setLimitWarning(null);
    }
  };

  const handleSelectAllRed = () => {
    if (isFrozen) return;
    const redList = colorConfig?.redNumbers || allNumbers.slice(50, 100);

    // Total red numbers is 50, but max allowed is 37.
    if (redList.length > 37) {
      const first37 = redList.slice(0, 37);
      setSelectedNumbers(first37);
      setLimitWarning(
        `Selection exceeds the 37-number limit (Total Red: ${redList.length}). Selected the first 37 numbers (${first37[0]}–${first37[36]}).`
      );
    } else {
      setSelectedNumbers(redList);
      setLimitWarning(null);
    }
  };

  // Stake preset selection
  const handleSelectPresetStake = (amount: number) => {
    if (isFrozen) return;
    setStakePerNumber(amount);
    setCustomStakeInput(amount.toString());
  };

  const handleCustomStakeChange = (valStr: string) => {
    if (isFrozen) return;
    setCustomStakeInput(valStr);
    const parsed = parseInt(valStr, 10);
    if (!isNaN(parsed) && parsed > 0) {
      setStakePerNumber(parsed);
    }
  };

  // Calculations
  const numberCount = selectedNumbers.length;
  const totalStake = numberCount * stakePerNumber;
  const potential90xReward = stakePerNumber * 90;

  // Hourly Dhamaka Green Protection (80% of applicable stake on green numbers)
  const isDhamaka = game.id === 'hourly_dhamaka' || game.hasGreenRefund;
  const greenSelectionsCount = selectedNumbers.filter((n) => isNumberGreen(n)).length;
  const greenProtectionEstimate = isDhamaka ? Math.round(greenSelectionsCount * stakePerNumber * 0.8) : 0;

  // Wallet balance display (Client-side visual preview; server performs authoritative deduction)
  const availableDemoBalance = user.mainBalance;
  const hasInsufficientCredits = totalStake > availableDemoBalance;

  // Validate before opening Review Panel
  const handleOpenReview = () => {
    if (isFrozen) {
      setErrorMessage('Bidding is strictly frozen for this round.');
      return;
    }
    if (numberCount === 0) {
      setErrorMessage('Please select at least 1 number from the 00–99 grid.');
      return;
    }
    if (numberCount > 37) {
      setErrorMessage('Selection exceeds the maximum limit of 37 numbers.');
      return;
    }
    if (hasInsufficientCredits) {
      setErrorMessage(
        `Insufficient demo credits in Main Wallet. Required: ₹${totalStake.toLocaleString()}, Available: ₹${availableDemoBalance.toLocaleString()}.`
      );
      return;
    }
    setErrorMessage(null);
    setActiveView('review');
  };

  // 5. Submit Entry to Step 11 API
  const handleConfirmSubmit = async () => {
    if (isFrozen || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    const activeRoundId = serverRound?.id || initialRound.id;
    const idempotencyKey = gameEntryApi.generateIdempotencyKey();

    // Call Step 11 secure game-entry API
    const response = await gameEntryApi.submitEntry(user.id, {
      gameId: game.id,
      roundId: activeRoundId,
      selectedNumbers,
      amountPerNumber: stakePerNumber,
      idempotencyKey,
    });

    setIsSubmitting(false);

    if (response.success && response.entry) {
      setConfirmedEntry(response.entry);

      // Sync local engine wallet balance and add entry to engine state
      const bidsForEngine = selectedNumbers.map((n) => ({
        number: parseInt(n, 10),
        amount: stakePerNumber,
      }));

      // Place in local engine to keep all tabs/views in sync
      winoraEngine.placeBids({
        gameId: game.id as any,
        bids: bidsForEngine,
        walletType: 'main',
      });

      onSuccessToast(`Entry ${response.entry.id} confirmed! ₹${totalStake.toLocaleString()} demo credits staked.`);
      setActiveView('success');
    } else {
      // Map safe server error code to helpful user notification
      const errorText =
        response.message || 'Unable to confirm entry. Please review your selection and try again.';
      setErrorMessage(errorText);
      setActiveView('board');
    }
  };

  const handleResetForNewRound = () => {
    setSelectedNumbers([]);
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
        className="bg-zinc-900 border border-zinc-750 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[96vh] animate-in fade-in zoom-in-95 duration-150"
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
            <p className="text-xs text-zinc-400 mt-0.5">{game.subtitle}</p>
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

        {/* 15-Minute Freeze Notice Banner */}
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
            {isDhamaka && (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                80% Green Protection Active
              </span>
            )}
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
        {/* VIEW 1: MAIN 00–99 GAME BOARD */}
        {/* ==================================================================== */}
        {activeView === 'board' && (
          <div className="p-4 overflow-y-auto space-y-4 flex-1">
            {/* 1. Main Wallet Balance Display */}
            <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold uppercase text-zinc-400 tracking-wider">
                  Main Wallet:
                </span>
                <p className="text-xs text-zinc-400">
                  All game entries are placed using your Main Wallet. Server authoritatively verifies balance.
                </p>
              </div>

              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs font-bold text-zinc-200">
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-zinc-400">Available Balance:</span>
                <span className="text-amber-400 font-mono font-black">₹{user.mainBalance.toLocaleString()}</span>
              </div>
            </div>

            {/* 2. Stake Per Number Selection */}
            <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-300 font-bold uppercase tracking-wider">
                  Stake Per Number:
                </span>
                <span className="text-[11px] text-zinc-400">
                  (Applied equally to each selected number)
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Presets */}
                <div className="flex items-center gap-1">
                  {[50, 100, 200, 500, 1000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      disabled={isFrozen}
                      onClick={() => handleSelectPresetStake(preset)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold font-mono border transition-all cursor-pointer ${
                        stakePerNumber === preset
                          ? 'bg-amber-500 text-zinc-950 border-amber-400 font-black shadow-sm'
                          : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800'
                      }`}
                    >
                      ₹{preset}
                    </button>
                  ))}
                </div>

                {/* Custom Input */}
                <div className="flex items-center gap-1.5 pl-2 border-l border-zinc-800">
                  <span className="text-xs text-zinc-400 font-bold">Custom:</span>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1 text-xs text-zinc-400">₹</span>
                    <input
                      type="number"
                      min="10"
                      max="10000"
                      step="10"
                      disabled={isFrozen}
                      value={customStakeInput}
                      onChange={(e) => handleCustomStakeChange(e.target.value)}
                      className="w-20 pl-6 pr-2 py-1 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-zinc-100 font-mono font-bold focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Number Selection Bar & Hourly Dhamaka Quick Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
              <div className="flex items-center gap-3">
                {/* Selection Count Pill */}
                <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 px-3 py-1.5 rounded-xl">
                  <span className="text-xs font-bold text-zinc-300">
                    Selected:{' '}
                    <span
                      className={`font-mono text-sm font-black ${
                        numberCount === 37 ? 'text-amber-400' : 'text-zinc-100'
                      }`}
                    >
                      {numberCount}
                    </span>{' '}
                    / <span className="text-zinc-400">37</span>
                  </span>
                  <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        numberCount === 37 ? 'bg-amber-400' : 'bg-emerald-400'
                      }`}
                      style={{ width: `${Math.min(100, (numberCount / 37) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Clear All */}
                {numberCount > 0 && (
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

              {/* Quick Filters for Hourly Dhamaka */}
              {isDhamaka && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-bold text-zinc-400">Filters:</span>
                  <button
                    type="button"
                    disabled={isFrozen}
                    onClick={handleSelectAllGreen}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    + All Green
                  </button>
                  <button
                    type="button"
                    disabled={isFrozen}
                    onClick={handleSelectAllRed}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    + All Red
                  </button>
                  <button
                    type="button"
                    disabled={isFrozen}
                    onClick={handleClearAll}
                    className="px-2 py-1 rounded-lg text-xs font-bold bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-700 transition-colors cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            {/* Quick Limit Warning Notice */}
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
            {/* 4. 00–99 NUMBER BOARD (MOBILE-FIRST 10x10 GRID) */}
            {/* Numbers are strictly 2-digit strings: '00', '01' ... '99' */}
            {/* ================================================================ */}
            <div className="bg-zinc-950 p-2.5 sm:p-3 rounded-2xl border border-zinc-800">
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                    00–99 Number Board
                  </span>
                  {isDhamaka && (
                    <div className="flex items-center gap-2 text-[10px] font-bold">
                      <span className="text-emerald-400 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Green (80% Protection)
                      </span>
                      <span className="text-rose-400 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" /> Red (90× Multiplier)
                      </span>
                    </div>
                  )}
                </div>
                <span className="text-[11px] text-zinc-400">
                  Tap to select / deselect
                </span>
              </div>

              {/* 10 x 10 Responsive Grid */}
              <div className="grid grid-cols-10 gap-1 sm:gap-1.5 p-1 bg-zinc-900/50 rounded-xl border border-zinc-800/80">
                {allNumbers.map((numStr) => {
                  const isSelected = selectedNumbers.includes(numStr);
                  const isGreen = isNumberGreen(numStr);

                  return (
                    <button
                      key={numStr}
                      type="button"
                      id={`number-cell-${numStr}`}
                      disabled={isFrozen}
                      onClick={() => handleToggleNumber(numStr)}
                      className={`relative aspect-square rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer select-none active:scale-95 disabled:cursor-not-allowed ${
                        isSelected
                          ? 'bg-amber-500 text-zinc-950 font-black shadow-md ring-2 ring-amber-300 scale-95 z-10'
                          : isDhamaka
                          ? isGreen
                            ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-900/60'
                            : 'bg-rose-950/30 text-rose-300 border border-rose-500/30 hover:bg-rose-900/50'
                          : 'bg-zinc-850 text-zinc-200 border border-zinc-800 hover:border-amber-500/50 hover:bg-zinc-800'
                      } ${isFrozen ? 'opacity-40' : ''}`}
                    >
                      <span className="font-mono text-xs sm:text-sm font-bold leading-none">
                        {numStr}
                      </span>
                      {isSelected && (
                        <span className="text-[8px] sm:text-[9px] font-black leading-none mt-0.5 opacity-90">
                          ₹{stakePerNumber}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Numbers Chip Preview */}
            {selectedNumbers.length > 0 && (
              <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800">
                <span className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider block mb-1.5">
                  Selected Numbers ({selectedNumbers.length} / 37):
                </span>
                <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                  {selectedNumbers
                    .slice()
                    .sort((a, b) => a.localeCompare(b))
                    .map((numStr) => (
                      <span
                        key={numStr}
                        onClick={() => handleToggleNumber(numStr)}
                        className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 cursor-pointer hover:bg-rose-500/20 hover:text-rose-300 hover:border-rose-500/40 transition-colors"
                        title="Click to remove"
                      >
                        #{numStr}
                      </span>
                    ))}
                </div>
              </div>
            )}

            {/* 5. Live Calculations Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Total Stake */}
              <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                  Total Stake ({numberCount} × ₹{stakePerNumber})
                </span>
                <p className="text-xl font-black text-zinc-100 font-mono mt-0.5">
                  ₹{totalStake.toLocaleString()}{' '}
                  <span className="text-xs font-normal text-zinc-400">demo credits</span>
                </p>
                <span className="text-[10px] text-zinc-400">
                  Deducted from Main Wallet
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
                  On single exact draw match (Demo Prototype)
                </span>
              </div>

              {/* Green Protection Refund (Hourly Dhamaka) */}
              <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  {isDhamaka ? 'Green Protection (80%)' : 'Standard Game Multiplier'}
                </span>
                <p className="text-xl font-black text-cyan-300 font-mono mt-0.5">
                  {isDhamaka ? `₹${greenProtectionEstimate.toLocaleString()}` : 'N/A (90× Only)'}
                </p>
                <span className="text-[10px] text-zinc-400">
                  {isDhamaka
                    ? `80% refund on ${greenSelectionsCount} Green number(s) if not winning`
                    : 'Fixed 90× single return'}
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
                  Demo Credits Only
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
                  <span className="font-bold text-amber-400 text-sm">{numberCount} / 37</span>
                </div>
              </div>

              {/* Selected Numbers Grid */}
              <div>
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">
                  Selected Numbers ({numberCount}):
                </span>
                <div className="flex flex-wrap gap-1.5 p-3 bg-zinc-900 rounded-xl border border-zinc-800 max-h-32 overflow-y-auto">
                  {selectedNumbers
                    .slice()
                    .sort((a, b) => a.localeCompare(b))
                    .map((n) => (
                      <span
                        key={n}
                        className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700"
                      >
                        {n}
                      </span>
                    ))}
                </div>
              </div>

              {/* Stake & Math Breakdown */}
              <div className="space-y-2 border-t border-zinc-800 pt-3 text-xs">
                <div className="flex justify-between text-zinc-300">
                  <span>Stake Per Selected Number:</span>
                  <span className="font-mono font-bold">₹{stakePerNumber.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-zinc-300">
                  <span>Number Count:</span>
                  <span className="font-mono font-bold">{numberCount} numbers</span>
                </div>
                <div className="flex justify-between text-base font-black text-zinc-100 border-t border-zinc-800/80 pt-2">
                  <span>Total Stake Required:</span>
                  <span className="font-mono text-amber-400">₹{totalStake.toLocaleString()} demo credits</span>
                </div>
                <div className="flex justify-between text-emerald-400 font-bold">
                  <span>Potential 90× Reward:</span>
                  <span className="font-mono">₹{potential90xReward.toLocaleString()} demo credits</span>
                </div>

                {isDhamaka && (
                  <div className="flex justify-between text-cyan-300 font-medium">
                    <span>Green Protection (80% on {greenSelectionsCount} Green selections):</span>
                    <span className="font-mono">₹{greenProtectionEstimate.toLocaleString()}</span>
                  </div>
                )}
              </div>

              {/* Disclaimer Notice */}
              <div className="bg-zinc-900 border border-zinc-800 p-3 rounded-xl text-[11px] text-zinc-400 leading-relaxed">
                <p>
                  <strong>Notice:</strong> This is an interactive demo credit prototype. No real-money is staked or processed. The server performs authoritative round cutoff and balance validation.
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
                Your entry has been securely registered with the server-authoritative Step 11 engine.
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
                  #{confirmedEntry.roundNumber} ({confirmedEntry.roundId})
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-zinc-400">Numbers Count:</span>
                <span className="font-mono font-bold text-zinc-200">
                  {confirmedEntry.numbersCount} numbers
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-zinc-400">Stake Per Number:</span>
                <span className="font-mono font-bold text-zinc-200">
                  ₹{confirmedEntry.amountPerNumber}
                </span>
              </div>

              <div className="flex justify-between border-t border-zinc-800/80 pt-2 font-bold">
                <span className="text-zinc-300">Total Demo Stake:</span>
                <span className="font-mono text-zinc-100">
                  ₹{confirmedEntry.totalStake.toLocaleString()} (Main Wallet)
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-zinc-400">Potential 90× Reward:</span>
                <span className="font-mono font-bold text-emerald-400">
                  ₹{confirmedEntry.potentialReward.toLocaleString()}
                </span>
              </div>

              {confirmedEntry.greenProtectionAmount > 0 && (
                <div className="flex justify-between text-cyan-300">
                  <span>80% Green Protection:</span>
                  <span className="font-mono font-bold">
                    ₹{confirmedEntry.greenProtectionAmount.toLocaleString()}
                  </span>
                </div>
              )}

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
                  Authoritative record of your submissions for {game.name} & other draws. Read-only.
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

                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        {entry.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {entry.selectedNumbers.map((numStr) => (
                        <span
                          key={numStr}
                          className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-300 border border-zinc-800"
                        >
                          {numStr}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between border-t border-zinc-900 pt-2 text-[11px] text-zinc-400">
                      <div>
                        Stake:{' '}
                        <strong className="text-zinc-200">
                          ₹{entry.totalStake.toLocaleString()}
                        </strong>{' '}
                        ({entry.numbersCount} nos @ ₹{entry.amountPerNumber})
                      </div>
                      <div>
                        {new Date(entry.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        • {new Date(entry.createdAt).toLocaleDateString()}
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
                    isFrozen || numberCount === 0 || hasInsufficientCredits || numberCount > 37
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
                      <span>Review Entry ({numberCount} Nos • ₹{totalStake.toLocaleString()})</span>
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
