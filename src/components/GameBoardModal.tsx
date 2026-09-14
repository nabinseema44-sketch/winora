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
  initialRound?: GameRound;
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
  const [activeView, setActiveView] = useState<ModalView>('board');
  const [selections, setSelections] = useState<SelectionPayload[]>([]);
  const [activeStake, setActiveStake] = useState<number>(25);
  const [customStakeInput, setCustomStakeInput] = useState<string>('25');
  const [focusedNumber, setFocusedNumber] = useState<string | null>(null);
  const [colorTab, setColorTab] = useState<'ALL' | 'GREEN' | 'RED'>('ALL');
  const [serverRound, setServerRound] = useState<ServerRoundInfo | null>(null);
  const [serverTimeOffsetMs, setServerTimeOffsetMs] = useState<number>(0);
  const [timeLeftStr, setTimeLeftStr] = useState<string>('');
  const [isFrozen, setIsFrozen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmedEntry, setConfirmedEntry] = useState<ConfirmedGameEntry | null>(null);
  const [userEntries, setUserEntries] = useState<ConfirmedGameEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState<boolean>(false);

  const isHourlyGame =
    game.id === 'hourly_play' ||
    game.id === 'hourly_dhamaka' ||
    Boolean(game.hasHourlyProtection);

  useEffect(() => {
    const unsub = winoraEngine.subscribe(() => {
      // Server state remains authoritative; this subscription only causes the UI
      // to refresh after existing local wallet state changes elsewhere.
      void winoraEngine.getCurrentUser();
    });
    return unsub;
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadServerConfig = async () => {
      const config = await gameEntryApi.fetchGamesConfig();
      if (!isMounted) return;

      if (config) {
        const round = config.rounds?.[game.id];
        if (round) setServerRound(round);
        if (config.serverTime) {
          const serverMs = new Date(config.serverTime).getTime();
          if (Number.isFinite(serverMs)) setServerTimeOffsetMs(serverMs - Date.now());
        }
        return;
      }

      // Do not invent an active round when the backend is unavailable. The user
      // may inspect the board, but submission remains blocked until a server
      // round is available.
      setServerRound(null);
    };

    void loadServerConfig();
    const interval = setInterval(() => void loadServerConfig(), 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [game.id]);

  useEffect(() => {
    const updateTimer = () => {
      if (!serverRound) {
        setIsFrozen(true);
        setTimeLeftStr('Server unavailable');
        return;
      }

      const now = Date.now() + serverTimeOffsetMs;
      const freezeMs = new Date(serverRound.freezeTime).getTime();
      const declareMs = new Date(serverRound.declareTime).getTime();
      const diffFreeze = freezeMs - now;
      const diffDeclare = declareMs - now;

      const locked =
        serverRound.status === 'FROZEN' ||
        serverRound.status === 'PROCESSING' ||
        serverRound.status === 'COMPLETED' ||
        diffFreeze <= 0;

      if (locked) {
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
  }, [serverRound, serverTimeOffsetMs]);

  const loadMyEntries = async () => {
    setLoadingEntries(true);
    try {
      const entries = await gameEntryApi.fetchMyEntries(user.id);
      setUserEntries(entries);
    } finally {
      setLoadingEntries(false);
    }
  };

  useEffect(() => {
    if (activeView === 'my-entries') void loadMyEntries();
  }, [activeView]);

  const allNumbers = useMemo(
    () => Array.from({ length: 100 }, (_, i) => i.toString().padStart(2, '0')),
    []
  );

  const displayedNumbers = useMemo(() => {
    if (!isHourlyGame || colorTab === 'ALL') return allNumbers;
    return allNumbers.filter((n) => {
      const even = Number(n) % 2 === 0;
      return colorTab === 'GREEN' ? even : !even;
    });
  }, [allNumbers, isHourlyGame, colorTab]);

  const selectionMap = useMemo(() => {
    const map = new Map<string, SelectionPayload>();
    selections.forEach((s) => map.set(s.number, s));
    return map;
  }, [selections]);

  const focusedSelection = focusedNumber ? selectionMap.get(focusedNumber) : null;

  const handleUpdateNumberStake = (numStr: string, newStake: number) => {
    if (isFrozen) return;
    if (!Number.isFinite(newStake) || newStake <= 0) {
      setSelections((prev) => prev.filter((s) => s.number !== numStr));
      if (focusedNumber === numStr) setFocusedNumber(null);
      return;
    }
    setSelections((prev) =>
      prev.map((s) => (s.number === numStr ? { ...s, stake: Math.floor(newStake) } : s))
    );
  };

  const handleSelectChipStake = (amount: number) => {
    setActiveStake(amount);
    setCustomStakeInput(amount.toString());
    if (focusedNumber && selectionMap.has(focusedNumber)) {
      handleUpdateNumberStake(focusedNumber, amount);
    }
  };

  const handleCustomStakeInput = (value: string) => {
    const normalized = value.replace(/[^0-9]/g, '').slice(0, 5);
    setCustomStakeInput(normalized);
    const parsed = Number(normalized);
    if (Number.isInteger(parsed) && parsed > 0) {
      setActiveStake(Math.min(parsed, 10000));
      if (focusedNumber && selectionMap.has(focusedNumber)) {
        handleUpdateNumberStake(focusedNumber, Math.min(parsed, 10000));
      }
    }
  };

  const handleToggleNumber = (numStr: string) => {
    if (isFrozen) return;
    setErrorMessage(null);

    const existing = selectionMap.get(numStr);
    if (existing) {
      if (focusedNumber === numStr) {
        setSelections((prev) => prev.filter((s) => s.number !== numStr));
        setFocusedNumber(null);
      } else {
        setFocusedNumber(numStr);
      }
      return;
    }

    if (selections.length >= 37) {
      setErrorMessage('Maximum 37 numbers limit reached per round.');
      return;
    }

    const num = Number(numStr);
    setSelections((prev) => [
      ...prev,
      {
        number: numStr,
        stake: activeStake,
        color: num % 2 === 0 ? 'GREEN' : 'RED',
      },
    ]);
    setFocusedNumber(numStr);
  };

  const handleQuickPick = (count: number, color?: 'GREEN' | 'RED') => {
    if (isFrozen) return;
    setErrorMessage(null);

    let candidates = allNumbers.filter((n) => !selectionMap.has(n));
    if (color) {
      candidates = candidates.filter((n) => {
        const even = Number(n) % 2 === 0;
        return color === 'GREEN' ? even : !even;
      });
    }

    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    const toAdd = shuffled.slice(0, Math.min(count, 37 - selections.length));
    if (toAdd.length === 0) {
      setErrorMessage('No more numbers can be added (limit 37).');
      return;
    }

    setSelections((prev) => [
      ...prev,
      ...toAdd.map((number) => ({
        number,
        stake: activeStake,
        color: Number(number) % 2 === 0 ? 'GREEN' : 'RED',
      })),
    ]);
    setFocusedNumber(toAdd[toAdd.length - 1]);
  };

  const handleClearAll = () => {
    if (isFrozen) return;
    setSelections([]);
    setFocusedNumber(null);
    setErrorMessage(null);
  };

  const handleApplyStakeToAll = () => {
    if (isFrozen || selections.length === 0) return;
    setSelections((prev) => prev.map((s) => ({ ...s, stake: activeStake })));
  };

  const selectionsCount = selections.length;
  const totalStake = useMemo(
    () => selections.reduce((sum, selection) => sum + selection.stake, 0),
    [selections]
  );
  const maxIndividualStake = useMemo(
    () => selections.reduce((max, selection) => Math.max(max, selection.stake), 0),
    [selections]
  );
  const potential90xReward = maxIndividualStake * 90;

  const validateBeforeSubmit = (): string | null => {
    if (!serverRound) return 'Game server is unavailable. Please wait for the live round to load.';
    if (isFrozen) return 'Bidding is strictly frozen for this round.';
    if (selections.length === 0) return 'Please select at least 1 number to place a bid.';
    if (selections.length > 37) return 'Maximum 37 numbers allowed per round.';
    for (const sel of selections) {
      if (!Number.isInteger(sel.stake) || sel.stake < 1 || sel.stake > 10000) {
        return `Bid for ${sel.number} must be between 1 and 10,000 coins.`;
      }
    }
    return null;
  };

  const handlePlaceBidDirect = async () => {
    if (isSubmitting) return;
    const validationError = validateBeforeSubmit();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const response = await gameEntryApi.submitEntry(user.id, {
        gameId: game.id,
        roundId: serverRound!.id,
        selections,
        idempotencyKey: gameEntryApi.generateIdempotencyKey(),
        walletPreference: 'main',
      });

      if (!response.success || !response.entry) {
        setErrorMessage(response.message || 'Unable to place your bid.');
        return;
      }

      setConfirmedEntry(response.entry);
      setActiveView('success');
      onSuccessToast('Entry confirmed by the server.');
      setSelections([]);
      setFocusedNumber(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to place your bid.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayedRound = serverRound ?? (initialRound ? {
    id: initialRound.id,
    gameId: initialRound.gameId,
    gameName: initialRound.gameName,
    roundNumber: initialRound.roundNumber,
    freezeTime: initialRound.freezeTime,
    declareTime: initialRound.declareTime,
    status: initialRound.status === 'frozen' ? 'FROZEN' : 'OPEN',
    totalBidsPool: initialRound.totalBidsPool,
  } as ServerRoundInfo : null);

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-2xl max-h-[95vh] overflow-hidden rounded-t-3xl sm:rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl flex flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-zinc-800 p-4 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Coins className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="font-black text-base truncate">{game.name}</h2>
                <div className="text-[10px] text-zinc-400 truncate">{displayedRound ? `Round #${displayedRound.roundNumber}` : 'Connecting to server…'}</div>
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="min-w-11 min-h-11 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="overflow-y-auto p-3 space-y-3">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Clock className="w-4 h-4 text-amber-400 shrink-0" />
              <div className="min-w-0">
                <div className={`text-xs font-black ${isFrozen ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {isFrozen ? 'BIDDING CLOSED' : 'BIDDING OPEN'}
                </div>
                <div className="text-[10px] text-zinc-500 truncate">{timeLeftStr}</div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[9px] uppercase text-zinc-500">Pool</div>
              <div className="font-mono text-sm font-bold">{displayedRound?.totalBidsPool ?? 0}</div>
            </div>
          </div>

          {activeView === 'success' && confirmedEntry ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-5 text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
              <div className="text-lg font-black">Entry Confirmed</div>
              <div className="text-xs text-zinc-400">Receipt: {confirmedEntry.id}</div>
              <div className="grid grid-cols-2 gap-2 text-left">
                <div className="rounded-xl bg-zinc-900 p-3"><div className="text-[9px] text-zinc-500">Numbers</div><div className="font-bold">{confirmedEntry.selections.length}</div></div>
                <div className="rounded-xl bg-zinc-900 p-3"><div className="text-[9px] text-zinc-500">Total stake</div><div className="font-bold">{confirmedEntry.totalStake} coins</div></div>
              </div>
              <button type="button" onClick={onClose} className="w-full min-h-11 rounded-xl bg-amber-500 text-zinc-950 font-black">Close</button>
            </div>
          ) : activeView === 'my-entries' ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between"><h3 className="font-bold">My Entries</h3><button type="button" onClick={() => void loadMyEntries()} className="min-h-11 min-w-11 rounded-xl border border-zinc-800 flex items-center justify-center"><RefreshCw className="w-4 h-4" /></button></div>
              {loadingEntries ? <div className="text-sm text-zinc-500 p-4 text-center">Loading entries…</div> : userEntries.length === 0 ? <div className="text-sm text-zinc-500 p-4 text-center">No entries found.</div> : userEntries.map((entry) => <div key={entry.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3"><div className="flex justify-between gap-2"><span className="font-bold text-sm">{entry.gameName}</span><span className="text-xs text-zinc-400">{entry.status}</span></div><div className="text-[10px] text-zinc-500 mt-1">{entry.selections.map((s) => `${s.number} (${s.stake})`).join(', ')}</div><div className="text-xs mt-2">Total: {entry.totalStake} coins</div></div>)}
              <button type="button" onClick={() => setActiveView('board')} className="w-full min-h-11 rounded-xl bg-zinc-800 font-bold">Back to Board</button>
            </div>
          ) : (
            <>
              {errorMessage && <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 text-rose-300 text-xs p-3 flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />{errorMessage}</div>}

              {isHourlyGame && <div className="grid grid-cols-3 gap-2">
                {(['ALL', 'GREEN', 'RED'] as const).map((tab) => <button key={tab} type="button" onClick={() => setColorTab(tab)} className={`min-h-11 rounded-xl border text-xs font-black ${colorTab === tab ? 'bg-amber-500 text-zinc-950 border-amber-400' : 'bg-zinc-900 border-zinc-800 text-zinc-400'}`}>{tab}</button>)}
              </div>}

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-3 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {[10, 25, 50, 100, 500].map((amount) => <button key={amount} type="button" onClick={() => handleSelectChipStake(amount)} className={`min-h-10 px-3 rounded-xl text-xs font-bold border ${activeStake === amount ? 'border-amber-400 bg-amber-500/15 text-amber-300' : 'border-zinc-800 bg-zinc-950 text-zinc-400'}`}>{amount}</button>)}
                  <input aria-label="Custom stake" inputMode="numeric" value={customStakeInput} onChange={(event) => handleCustomStakeInput(event.target.value)} className="w-24 min-h-10 rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-xs font-bold outline-none focus:border-amber-400" />
                  <button type="button" onClick={handleApplyStakeToAll} disabled={selections.length === 0 || isFrozen} className="min-h-10 px-3 rounded-xl bg-zinc-800 text-xs font-bold disabled:opacity-40">Apply all</button>
                </div>

                <div className="grid grid-cols-5 gap-2">
                  {displayedNumbers.map((num) => {
                    const selected = selectionMap.get(num);
                    const even = Number(num) % 2 === 0;
                    return <button key={num} type="button" onClick={() => handleToggleNumber(num)} disabled={isFrozen} className={`min-h-12 rounded-xl border text-sm font-black transition ${selected ? 'border-amber-400 bg-amber-500/15 text-amber-300' : even ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-300' : 'border-rose-500/30 bg-rose-950/20 text-rose-300'} ${focusedNumber === num ? 'ring-2 ring-amber-400' : ''} disabled:opacity-50`}><span>{num}</span>{selected && <span className="block text-[9px] text-zinc-400">{selected.stake}</span>}</button>;
                  })}
                </div>
              </div>

              {focusedSelection && <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3 flex items-center justify-between gap-3"><div><div className="text-[10px] text-zinc-500">Selected number</div><div className="font-black text-xl">{focusedSelection.number}</div></div><div className="flex items-center gap-2"><button type="button" onClick={() => handleUpdateNumberStake(focusedSelection.number, focusedSelection.stake - 5)} className="min-h-11 min-w-11 rounded-xl bg-zinc-800 flex items-center justify-center"><Minus className="w-4 h-4" /></button><span className="w-20 text-center font-black">{focusedSelection.stake}</span><button type="button" onClick={() => handleUpdateNumberStake(focusedSelection.number, focusedSelection.stake + 5)} className="min-h-11 min-w-11 rounded-xl bg-zinc-800 flex items-center justify-center"><Plus className="w-4 h-4" /></button><button type="button" onClick={() => handleToggleNumber(focusedSelection.number)} className="min-h-11 min-w-11 rounded-xl bg-rose-950/50 border border-rose-500/30 text-rose-300 flex items-center justify-center"><Trash2 className="w-4 h-4" /></button></div></div>}

              <div className="grid grid-cols-3 gap-2"><button type="button" onClick={() => handleQuickPick(5)} disabled={isFrozen} className="min-h-11 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-bold flex items-center justify-center gap-1"><Sparkles className="w-4 h-4" />Quick 5</button><button type="button" onClick={() => handleQuickPick(5, 'GREEN')} disabled={isFrozen} className="min-h-11 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-xs font-bold">5 Green</button><button type="button" onClick={() => handleQuickPick(5, 'RED')} disabled={isFrozen} className="min-h-11 rounded-xl bg-rose-950/30 border border-rose-500/30 text-xs font-bold">5 Red</button></div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-3 space-y-2">
                <div className="flex items-center justify-between text-sm"><span className="text-zinc-400">Selected</span><span className="font-bold">{selectionsCount}</span></div>
                <div className="flex items-center justify-between text-sm"><span className="text-zinc-400">Total stake</span><span className="font-black">{totalStake} coins</span></div>
                <div className="flex items-center justify-between text-sm"><span className="text-zinc-400">Potential 90×</span><span className="font-black text-emerald-400">{potential90xReward} coins</span></div>
              </div>

              <div className="flex gap-2"><button type="button" onClick={handleClearAll} disabled={selections.length === 0 || isFrozen} className="min-h-11 px-4 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-bold disabled:opacity-40">Clear</button><button type="button" onClick={() => setActiveView('my-entries')} className="min-h-11 px-4 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-bold flex items-center gap-1"><FileText className="w-4 h-4" />History</button><button type="button" onClick={handlePlaceBidDirect} disabled={isSubmitting || isFrozen || !serverRound || selections.length === 0} className="flex-1 min-h-11 rounded-xl bg-amber-500 text-zinc-950 font-black disabled:opacity-40">{isSubmitting ? 'Submitting…' : 'Confirm Entry'}</button></div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
