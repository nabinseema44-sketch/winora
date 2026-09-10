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
import { BiddingEngineModal } from '../components/BiddingEngineModal.tsx';

interface GamesPageProps {
  user: UserProfile;
  onToast: (msg: string) => void;
}

export const GamesPage: React.FC<GamesPageProps> = ({ user, onToast }) => {
  const [selectedGameForBidding, setSelectedGameForBidding] = useState<WinoraGameConfig | null>(null);
  const [rounds, setRounds] = useState<Record<WinoraGameId, GameRound>>(winoraEngine.getRounds());
  const [now, setNow] = useState<number>(Date.now());

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
    <div className="space-y-6 pb-12 max-w-6xl mx-auto px-4 sm:px-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 border border-zinc-800 p-5 sm:p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs text-amber-400 font-semibold mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>WINORA Official Game Matrix</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-black text-zinc-100">
            00–99 Multi-Number Draws
          </h1>
          <p className="text-xs text-zinc-400 mt-1 max-w-xl">
            Fixed 90× single-number payouts on Games X, Y, Z, plus Hourly Dhamaka featuring an automatic 80% Green Protection Refund on non-winning green bids.
          </p>
        </div>

        {/* 15-Minute Rule Badge */}
        <div className="bg-zinc-950 border border-amber-500/30 p-3 rounded-xl flex items-center gap-3">
          <Clock className="w-5 h-5 text-amber-400 shrink-0" />
          <div className="text-xs">
            <span className="text-zinc-200 font-bold block">15-Minute Freeze Enforced</span>
            <span className="text-zinc-400 text-[11px]">Bidding closes 15 mins prior to result</span>
          </div>
        </div>
      </div>

      {/* 4 Official Game Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {WINORA_GAMES.map((game) => {
          const round = rounds[game.id];
          const cd = round ? formatCountdown(round.declareTime, round.freezeTime) : { isFrozen: false, text: '--' };

          return (
            <div
              key={game.id}
              className={`bg-zinc-900 border rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col justify-between transition-all hover:border-zinc-700 ${
                cd.isFrozen ? 'border-zinc-800 opacity-90' : 'border-zinc-800/90'
              }`}
            >
              <div className="space-y-3">
                {/* Top Row: Game Code & Timer */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded text-xs font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {game.code}
                    </span>
                    <h2 className="text-xl font-black text-zinc-100 font-display">
                      {game.name}
                    </h2>
                  </div>

                  {/* Countdown Badge */}
                  <div
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold font-mono border ${
                      cd.isFrozen
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        : 'bg-zinc-950 text-zinc-300 border-zinc-700'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>{cd.text}</span>
                  </div>
                </div>

                {/* Subtitle & Description */}
                <div>
                  <p className="text-xs font-bold text-amber-400">{game.subtitle}</p>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    {game.description}
                  </p>
                </div>

                {/* Badges / Metrics */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800 text-xs">
                    <span className="text-[10px] uppercase font-bold text-zinc-400 block">Payout Ratio</span>
                    <span className="font-mono font-black text-emerald-400 text-sm">
                      {game.payoutMultiplier}× Return
                    </span>
                  </div>

                  <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800 text-xs">
                    <span className="text-[10px] uppercase font-bold text-zinc-400 block">Round #{round?.roundNumber || 101}</span>
                    <span className="font-mono font-black text-zinc-200 text-sm">
                      Pool: ₹{(round?.totalBidsPool || 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Special Hourly Dhamaka Highlight */}
                {game.hasGreenRefund && (
                  <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-2.5 flex items-center gap-2 text-xs text-emerald-300">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      <strong>80% Green Protection:</strong> 50 Green numbers (00–49) automatically refund 80% of stake if non-winning!
                    </span>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="pt-4 mt-2 border-t border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => setSelectedGameForBidding(game)}
                  className={`w-full py-3 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    cd.isFrozen
                      ? 'bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-750'
                      : 'bg-gradient-to-r from-amber-500 to-amber-400 text-zinc-950 hover:brightness-110 shadow-lg shadow-amber-500/20 active:scale-[0.98]'
                  }`}
                >
                  {cd.isFrozen ? (
                    <>
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      <span>View Grid (Bidding Frozen - 15m Cutoff)</span>
                    </>
                  ) : (
                    <>
                      <PlayCircle className="w-4 h-4" />
                      <span>Open 00–99 Bidding Grid</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Bidding Modal */}
      {selectedGameForBidding && rounds[selectedGameForBidding.id] && (
        <BiddingEngineModal
          game={selectedGameForBidding}
          round={rounds[selectedGameForBidding.id]}
          user={user}
          onClose={() => setSelectedGameForBidding(null)}
          onSuccessToast={onToast}
        />
      )}
    </div>
  );
};
