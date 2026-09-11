import React, { useState, useEffect } from 'react';
import {
  Search,
  Sparkles,
  Filter,
  ShieldCheck,
  Clock,
  Coins,
  TrendingUp,
  AlertTriangle,
  PlayCircle,
  Zap,
} from 'lucide-react';
import { WinoraGameConfig, WinoraGameId, GameRound, UserProfile } from '../types.ts';
import { winoraEngine, WINORA_GAMES } from '../services/winoraEngine.ts';
import { GameBoardModal } from '../components/GameBoardModal.tsx';
import { gameEntryApi, ConfirmedGameEntry } from '../services/gameEntryApi.ts';
import { FileText, RefreshCw } from 'lucide-react';

interface GamesPageProps {
  user: UserProfile;
  onToast: (msg: string) => void;
}

export const GamesPage: React.FC<GamesPageProps> = ({ user, onToast }) => {
  const [selectedGameForBidding, setSelectedGameForBidding] = useState<WinoraGameConfig | null>(null);
  const [rounds, setRounds] = useState<Record<WinoraGameId, GameRound>>(winoraEngine.getRounds());
  const [now, setNow] = useState<number>(Date.now());
  const [activeTab, setActiveTab] = useState<'rooms' | 'my-entries'>('rooms');
  const [myEntries, setMyEntries] = useState<ConfirmedGameEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  // Load entries on tab switch
  useEffect(() => {
    if (activeTab === 'my-entries') {
      loadEntries();
    }
  }, [activeTab, user.id]);

  const loadEntries = async () => {
    setLoadingEntries(true);
    const data = await gameEntryApi.fetchMyEntries(user.id);
    setMyEntries(data);
    setLoadingEntries(false);
  };

  // Listen to engine updates and 1-second ticks for timers
  useEffect(() => {
    const unsub = winoraEngine.subscribe(() => {
      setRounds({ ...winoraEngine.getRounds() });
    });

    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      unsub();
      clearInterval(timer);
    };
  }, []);

  const formatCountdown = (declareTime: string, freezeTime: string) => {
    const freezeMs = new Date(freezeTime).getTime();
    const declareMs = new Date(declareTime).getTime();

    const diffFreeze = freezeMs - now;
    const diffDeclare = declareMs - now;

    if (diffFreeze <= 0) {
      if (diffDeclare > 0) {
        const m = Math.floor(diffDeclare / 60000);
        const s = Math.floor((diffDeclare % 60000) / 1000);
        return { isFrozen: true, text: `Frozen (${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')} to draw)` };
      }
      return { isFrozen: true, text: 'Declaring Result...' };
    }

    const m = Math.floor(diffFreeze / 60000);
    const s = Math.floor((diffFreeze % 60000) / 1000);
    return { isFrozen: false, text: `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')} to freeze` };
  };

  return (
    <div className="space-y-4 pb-8 w-full">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 border border-zinc-800 p-3.5 sm:p-5 rounded-2xl flex flex-col items-start justify-between gap-2.5">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs text-amber-400 font-semibold mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>WINORA Official Game Matrix</span>
          </div>
          <h1 className="font-display text-lg sm:text-2xl font-black text-zinc-100 leading-tight">
            00–99 Multi-Number Draws
          </h1>
          <p className="text-[11px] text-zinc-400 mt-1 leading-relaxed">
            90× return. Hourly Play features draws every hour with 15-min freeze & 80% color refund. Kalyan markets close 2h before declaration.
          </p>
        </div>

        {/* Schedule Badge */}
        <div className="bg-zinc-950 border border-amber-500/30 p-2 rounded-xl flex items-center gap-2 w-full">
          <Clock className="w-4 h-4 text-amber-400 shrink-0" />
          <div className="text-[10px] sm:text-[11px]">
            <span className="text-zinc-200 font-bold block leading-none mb-0.5">Indian Standard Time (IST)</span>
            <span className="text-zinc-400 text-[9px] sm:text-[10px]">Kalyan closes 2h before • Hourly freezes 15m before</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs: All Rooms vs My Entries */}
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-2">
        <div className="grid grid-cols-2 gap-1.5 w-full">
          <button
            type="button"
            onClick={() => setActiveTab('rooms')}
            className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 min-h-[44px] ${
              activeTab === 'rooms'
                ? 'bg-amber-500 text-zinc-950 shadow-md font-black'
                : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Game Rooms ({WINORA_GAMES.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('my-entries')}
            className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 min-h-[44px] ${
              activeTab === 'my-entries'
                ? 'bg-amber-500 text-zinc-950 shadow-md font-black'
                : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>My Entries ({myEntries.length})</span>
          </button>
        </div>

        {activeTab === 'my-entries' && (
          <button
            type="button"
            onClick={loadEntries}
            className="text-xs text-zinc-400 hover:text-zinc-100 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 cursor-pointer min-h-[44px] shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingEntries ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        )}
      </div>

      {activeTab === 'rooms' ? (
        /* 4 Official Game Cards */
        <div className="grid grid-cols-1 gap-3">
          {WINORA_GAMES.map((game) => {
            const round = rounds[game.id];
            const cd = round ? formatCountdown(round.declareTime, round.freezeTime) : { isFrozen: false, text: '--' };

            return (
              <div
                key={game.id}
                className={`bg-zinc-900 border rounded-xl sm:rounded-2xl p-3.5 sm:p-6 shadow-lg flex flex-col justify-between transition-all hover:border-zinc-700 ${
                  cd.isFrozen ? 'border-zinc-800 opacity-90' : 'border-zinc-800/90'
                }`}
              >
                <div className="space-y-2.5 sm:space-y-3">
                  {/* Top Row: Game Code & Timer */}
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="px-2 py-0.5 rounded text-[10px] sm:text-xs font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                        {game.code}
                      </span>
                      <h2 className="text-base sm:text-xl font-black text-zinc-100 font-display truncate">
                        {game.name}
                      </h2>
                    </div>

                    {/* Countdown Badge */}
                    <div
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold font-mono border shrink-0 ${
                        cd.isFrozen
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          : 'bg-zinc-950 text-zinc-300 border-zinc-700'
                      }`}
                    >
                      <Clock className="w-3 h-3" />
                      <span>{cd.text}</span>
                    </div>
                  </div>

                  {/* Subtitle & Description */}
                  <div>
                    <p className="text-xs font-bold text-amber-400">{game.subtitle}</p>
                    <p className="text-[11px] sm:text-xs text-zinc-400 mt-0.5 leading-relaxed">
                      {game.description}
                    </p>
                  </div>

                  {/* Badges / Metrics */}
                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    <div className="bg-zinc-950 p-2 sm:p-2.5 rounded-xl border border-zinc-800 text-xs">
                      <span className="text-[9px] uppercase font-bold text-zinc-400 block leading-none mb-0.5">Payout Ratio</span>
                      <span className="font-mono font-black text-emerald-400 text-xs sm:text-sm">
                        {game.payoutMultiplier}× Return
                      </span>
                    </div>

                    <div className="bg-zinc-950 p-2 sm:p-2.5 rounded-xl border border-zinc-800 text-xs">
                      <span className="text-[9px] uppercase font-bold text-zinc-400 block leading-none mb-0.5">Round #{round?.roundNumber || 101}</span>
                      <span className="font-mono font-black text-zinc-200 text-xs sm:text-sm truncate block">
                        Pool: ₹{(round?.totalBidsPool || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Special Hourly Play Color Refund Highlight */}
                  {(game.hasGreenRefund || game.hasHourlyProtection) && (
                    <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-2 sm:p-2.5 flex items-center gap-2 text-[11px] text-emerald-300">
                      <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="leading-tight">
                        <strong>80% Color Refund:</strong> If declared number is Green, all Green bids get 80% refund. If Red, all Red bids get 80% refund!
                      </span>
                    </div>
                  )}
                </div>

                {/* Action Button */}
                <div className="pt-3 sm:pt-4 mt-2 border-t border-zinc-800/80">
                  <button
                    type="button"
                    onClick={() => setSelectedGameForBidding(game)}
                    className={`w-full min-h-[44px] py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      cd.isFrozen
                        ? 'bg-zinc-800 text-zinc-300 border border-zinc-700 active:bg-zinc-750'
                        : 'bg-gradient-to-r from-amber-500 to-amber-400 text-zinc-950 hover:brightness-110 shadow-lg shadow-amber-500/20 active:scale-[0.98]'
                    }`}
                  >
                    {cd.isFrozen ? (
                      <>
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="truncate">View Grid (Frozen - 15m Cutoff)</span>
                      </>
                    ) : (
                      <>
                        <PlayCircle className="w-4 h-4 shrink-0" />
                        <span>Open 00–99 Bidding Grid</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Standalone My Entries View */
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black text-zinc-100 font-display">My Confirmed Entries</h2>
              <p className="text-xs text-zinc-400">
                Authoritative record of your personal game submissions. Read-only audit ledger.
              </p>
            </div>
            <span className="text-xs text-zinc-400 font-mono">
              Total Entries: {myEntries.length}
            </span>
          </div>

          {loadingEntries ? (
            <div className="py-16 text-center text-xs text-zinc-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-400" />
              <span>Fetching your entries from secure server...</span>
            </div>
          ) : myEntries.length === 0 ? (
            <div className="py-16 text-center bg-zinc-950 rounded-xl border border-zinc-850 p-6 space-y-3">
              <FileText className="w-10 h-10 mx-auto text-zinc-600" />
              <p className="text-sm font-bold text-zinc-300">No Game Entries Found</p>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                You have not placed any bids yet. Head over to any active room to select your lucky numbers from 00 to 99!
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('rooms')}
                className="px-5 py-2.5 rounded-xl text-xs font-black bg-amber-500 text-zinc-950 hover:bg-amber-400 transition-colors cursor-pointer"
              >
                Browse Game Rooms
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {myEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="bg-zinc-950 border border-zinc-800 p-3 sm:p-4 rounded-xl space-y-2.5 sm:space-y-3 hover:border-zinc-700 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-900 pb-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-black text-amber-400 text-xs px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/30">
                        {entry.id}
                      </span>
                      <span className="text-sm font-bold text-zinc-100">{entry.gameName}</span>
                      <span className="text-xs text-zinc-400 font-mono">
                        Round #{entry.roundNumber} ({entry.roundId})
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
                          entry.status === 'WON'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-black'
                            : entry.status === 'LOST'
                            ? 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                            : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {entry.status}
                      </span>
                      {entry.settledWinningNumber && (
                        <span className="text-[11px] text-zinc-300 font-mono bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                          Winner: <strong className="text-emerald-400">[{entry.settledWinningNumber}]</strong>
                        </span>
                      )}
                      {entry.status === 'WON' && entry.settledReward !== undefined && (
                        <span className="text-xs font-mono font-black text-emerald-300 bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-500/30">
                          +₹{entry.settledReward.toLocaleString()} demo
                        </span>
                      )}
                      <span className="text-[11px] text-zinc-400 capitalize">
                        {entry.walletUsed} Wallet
                      </span>
                    </div>
                  </div>

                  {/* Selections Chips */}
                  <div>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                      Selections ({entry.selections?.length || 0}):
                    </span>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {(entry.selections || []).map((s, idx) => (
                        <span
                          key={`${s.number}-${idx}`}
                          className={`font-mono text-xs font-bold px-2 py-0.5 rounded border flex items-center gap-1.5 ${
                            s.color === 'GREEN'
                              ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30'
                              : 'bg-rose-950/40 text-rose-300 border-rose-500/30'
                          }`}
                        >
                          <span>#{s.number}</span>
                          <span className="text-[10px] opacity-75">₹{s.stake}</span>
                          <span className={`text-[9px] px-1 rounded font-black ${
                            s.color === 'GREEN' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                          }`}>
                            {s.color}
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Financial Details */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 text-xs text-zinc-400 border-t border-zinc-900">
                    <div>
                      Stake:{' '}
                      <strong className="text-zinc-100 font-mono">
                        ₹{entry.totalStake.toLocaleString()} demo credits
                      </strong>{' '}
                      ({entry.selections?.length || 0} selection{(entry.selections?.length || 0) === 1 ? '' : 's'})
                    </div>

                    <div className="flex items-center gap-3">
                      {entry.settledReward !== undefined && entry.settledReward > 0 && (
                        <div className="text-emerald-400">
                          90× Win:{' '}
                          <strong className="font-mono">₹{entry.settledReward.toLocaleString()}</strong>
                        </div>
                      )}
                      {entry.protectionRefund !== undefined && entry.protectionRefund > 0 && (
                        <div className="text-cyan-300">
                          Protection Refund:{' '}
                          <strong className="font-mono">
                            ₹{entry.protectionRefund.toLocaleString()}
                          </strong>
                        </div>
                      )}
                      <div className="text-zinc-400">
                        {new Date(entry.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}{' '}
                        • {new Date(entry.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 12 00–99 Game Board & Round Play Modal */}
      {selectedGameForBidding && rounds[selectedGameForBidding.id] && (
        <GameBoardModal
          game={selectedGameForBidding}
          initialRound={rounds[selectedGameForBidding.id]}
          user={user}
          onClose={() => {
            setSelectedGameForBidding(null);
            loadEntries(); // Refresh entries if any were placed
          }}
          onSuccessToast={onToast}
        />
      )}
    </div>
  );
};
