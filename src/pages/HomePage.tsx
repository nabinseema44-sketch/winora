import React, { useState, useEffect } from 'react';
import {
  Clock,
  Sparkles,
  ShieldCheck,
  Zap,
  ArrowRight,
  ArrowDownLeft,
  ArrowUpRight,
  Coins,
  Play,
  Flame,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';
import { GameItem, NavPage, UserProfile, WinoraGameConfig } from '../types.ts';
import { WINORA_GAMES } from '../services/winoraEngine.ts';
import {
  getHourlyPlayRound,
  getKalyanRound,
  formatISTTime,
  formatISTDateTime,
} from '../utils/istTime.ts';

interface HomePageProps {
  games: GameItem[];
  user: UserProfile | null;
  onNavigate: (page: NavPage) => void;
  onSelectGame: (game: GameItem) => void;
  onOpenWinoraGame?: (gameConfig: WinoraGameConfig) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  games,
  user,
  onNavigate,
  onOpenWinoraGame,
}) => {
  // Live Indian Standard Time ticker (updates every second)
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const currencySymbol = user?.currency?.symbol || '₹';
  const mainBalance = user?.mainBalance ?? user?.walletBalance ?? 0;
  const bonusBalance = user?.bonusBalance ?? 0;

  // Active rounds computed using Indian Standard Time rules
  const hourlyRound = getHourlyPlayRound(now);
  const kalyanMorningRound = getKalyanRound('kalyan_morning', now);
  const kalyanRound = getKalyanRound('kalyan', now);
  const kalyanNightRound = getKalyanRound('kalyan_night', now);

  const hourlyGameConfig =
    WINORA_GAMES.find((g) => g.id === 'hourly_play') || WINORA_GAMES[0];
  const kmGameConfig =
    WINORA_GAMES.find((g) => g.id === 'kalyan_morning') || WINORA_GAMES[1];
  const klGameConfig =
    WINORA_GAMES.find((g) => g.id === 'kalyan') || WINORA_GAMES[2];
  const knGameConfig =
    WINORA_GAMES.find((g) => g.id === 'kalyan_night') || WINORA_GAMES[3];

  const handlePlayGame = (config: WinoraGameConfig) => {
    if (onOpenWinoraGame) {
      onOpenWinoraGame(config);
    } else {
      onNavigate('games');
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 pb-8 font-sans">
      {/* 1. Real-Time Indian Standard Time (IST) Header Ticker */}
      <div className="flex items-center justify-between gap-1.5 px-3 py-2 rounded-xl bg-zinc-900/90 border border-zinc-800 text-[11px] shadow-sm">
        <div className="flex items-center gap-1.5 text-zinc-300 font-medium min-w-0">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <span className="font-bold text-zinc-100 shrink-0">IST:</span>
          <span className="font-mono text-amber-400 font-bold truncate">
            {formatISTDateTime(now)}
          </span>
        </div>
        <div className="text-[10px] text-zinc-400 flex items-center gap-1 shrink-0">
          <span className="text-emerald-400 font-semibold">Live Rounds</span>
        </div>
      </div>

      {/* 2. PRIORITY TOP BANNER: HOURLY PLAY (Priority #1 Game for All Players) */}
      <section className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-amber-500/15 via-zinc-900 to-zinc-950 border-2 border-amber-500/40 p-3.5 sm:p-6 shadow-xl shadow-amber-500/10">
        {/* Ambient backdrop glow */}
        <div className="absolute -top-16 -right-16 w-80 h-80 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-3 sm:space-y-4">
          {/* Top Badges */}
          <div className="flex items-center justify-between gap-1.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500 text-zinc-950 text-[10px] sm:text-xs font-black uppercase tracking-wider shadow-sm">
              <Zap className="w-3 h-3 fill-current" />
              <span>Priority #1 • Hourly</span>
            </div>

            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-zinc-900/90 border border-zinc-700 text-[10px] sm:text-xs font-mono font-bold text-zinc-300">
              <Clock className="w-3 h-3 text-amber-400" />
              <span>Every Hour • 24×7</span>
            </div>
          </div>

          {/* Banner Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 items-center">
            <div className="lg:col-span-7 space-y-2.5 sm:space-y-3">
              <div className="flex items-center justify-between">
                <h1 className="font-display text-2xl sm:text-3xl font-black text-zinc-100 tracking-tight leading-none">
                  HOURLY PLAY <span className="text-amber-400">DHAMAKA</span>
                </h1>
                <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/30 shrink-0">
                  90× Return
                </span>
              </div>

              {/* Status and Countdown Box */}
              <div className="bg-zinc-950/85 border border-zinc-800 rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        hourlyRound.isFrozen ? 'bg-rose-500' : 'bg-emerald-500'
                      } animate-ping`}
                    />
                    {hourlyRound.isFrozen ? (
                      <span className="text-rose-400 font-black">
                        FROZEN (15m cutoff)
                      </span>
                    ) : (
                      <span className="text-emerald-400 font-black">
                        OPEN (15m freeze applies)
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-zinc-400 text-[10px]">
                    Round #{hourlyRound.roundNumber}
                  </span>
                </div>

                <div className="flex items-baseline gap-2.5">
                  <div className="font-mono text-2xl sm:text-3xl font-black text-amber-400 tracking-tight">
                    {hourlyRound.formattedTimeLeft}
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    {hourlyRound.isFrozen ? (
                      <span>result at <strong>{hourlyRound.declareTimeIST}</strong></span>
                    ) : (
                      <span>freeze at <strong>{hourlyRound.freezeTimeIST}</strong></span>
                    )}
                  </div>
                </div>
              </div>

              {/* Green & Red Rule Highlights */}
              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-xl p-2 flex items-start gap-1.5">
                  <span className="text-base leading-none">🟢</span>
                  <div className="text-[10px] min-w-0">
                    <div className="font-bold text-emerald-400 truncate">GREEN (Even)</div>
                    <div className="text-zinc-300 text-[9px] sm:text-[10px] mt-0.5 leading-snug">
                      90× win • 80% refund on match
                    </div>
                  </div>
                </div>

                <div className="bg-rose-950/30 border border-rose-500/40 rounded-xl p-2 flex items-start gap-1.5">
                  <span className="text-base leading-none">🔴</span>
                  <div className="text-[10px] min-w-0">
                    <div className="font-bold text-rose-400 truncate">RED (Odd)</div>
                    <div className="text-zinc-300 text-[9px] sm:text-[10px] mt-0.5 leading-snug">
                      90× win • 80% refund on match
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Banner Action CTA */}
            <div className="lg:col-span-5 pt-1">
              <button
                id="play-hourly-game-top-btn"
                type="button"
                onClick={() => handlePlayGame(hourlyGameConfig)}
                className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-98 transition-all cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Play Hourly Game (00–99)</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Account Wallet Quick Strip */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-xl sm:rounded-2xl p-3 sm:p-4 flex items-center justify-between gap-2.5 shadow-sm">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Coins className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[9px] font-bold uppercase text-zinc-400 tracking-wider block">
              Player Balance
            </span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-base sm:text-lg font-bold font-mono text-zinc-100 truncate">
                {currencySymbol}
                {mainBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              {bonusBalance > 0 && (
                <span className="text-[10px] font-bold font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-1.5 py-0.2 rounded shrink-0" title="Bonus Balance from 80% color protection">
                  +{currencySymbol}{bonusBalance.toFixed(0)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            id="home-wallet-deposit-cta"
            type="button"
            onClick={() => onNavigate('wallet')}
            className="px-3 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-amber-500 active:bg-amber-400 text-zinc-950 shadow-sm active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1 min-h-[44px]"
          >
            <ArrowDownLeft className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Deposit</span>
          </button>
          <button
            id="home-wallet-withdraw-cta"
            type="button"
            onClick={() => onNavigate('wallet')}
            className="px-3 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-zinc-800 active:bg-zinc-750 text-zinc-200 border border-zinc-700 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1 min-h-[44px]"
          >
            <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5] text-amber-400" />
            <span>Withdraw</span>
          </button>
        </div>
      </section>

      {/* 4. Kalyan Traditional Markets Section (2-Hour Close Rule Enforced) */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between gap-1">
          <div>
            <h2 className="font-display text-base sm:text-lg font-bold text-zinc-100 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-amber-400" />
              <span>Kalyan Daily Markets</span>
            </h2>
            <p className="text-[10px] sm:text-xs text-zinc-400">
              Strict 2-hour close cutoff before declare. IST schedule.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('games')}
            className="text-xs font-bold text-amber-400 active:text-amber-300 flex items-center gap-1 cursor-pointer py-1"
          >
            <span>All Games</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
          {/* Kalyan Morning */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-3 flex flex-col justify-between space-y-2.5">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-display font-bold text-sm text-zinc-100">
                  Kalyan Morning
                </span>
                <span
                  className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                    kalyanMorningRound.isFrozen
                      ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                      : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {kalyanMorningRound.isFrozen ? 'Closed (2h)' : 'Open'}
                </span>
              </div>

              <div className="space-y-0.5 text-[11px] text-zinc-400">
                <div className="flex justify-between">
                  <span>Declare:</span>
                  <strong className="text-zinc-200">11:30 AM IST</strong>
                </div>
                <div className="flex justify-between">
                  <span>Closes:</span>
                  <strong className="text-amber-400">09:30 AM IST</strong>
                </div>
                <div className="flex justify-between pt-1 border-t border-zinc-800/80">
                  <span>Countdown:</span>
                  <strong className="font-mono text-zinc-200">
                    {kalyanMorningRound.formattedTimeLeft}
                  </strong>
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={kalyanMorningRound.isFrozen}
              onClick={() => handlePlayGame(kmGameConfig)}
              className={`w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer min-h-[44px] ${
                kalyanMorningRound.isFrozen
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  : 'bg-zinc-800 active:bg-amber-500 active:text-zinc-950 text-zinc-200 border border-zinc-700'
              }`}
            >
              {kalyanMorningRound.isFrozen ? 'Closed (2h Cutoff)' : 'Play Morning'}
            </button>
          </div>

          {/* Kalyan (Day) */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-3 flex flex-col justify-between space-y-2.5">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-display font-bold text-sm text-zinc-100">
                  Kalyan
                </span>
                <span
                  className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                    kalyanRound.isFrozen
                      ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                      : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {kalyanRound.isFrozen ? 'Closed (2h)' : 'Open'}
                </span>
              </div>

              <div className="space-y-0.5 text-[11px] text-zinc-400">
                <div className="flex justify-between">
                  <span>Declare:</span>
                  <strong className="text-zinc-200">04:30 PM IST</strong>
                </div>
                <div className="flex justify-between">
                  <span>Closes:</span>
                  <strong className="text-amber-400">02:30 PM IST</strong>
                </div>
                <div className="flex justify-between pt-1 border-t border-zinc-800/80">
                  <span>Countdown:</span>
                  <strong className="font-mono text-zinc-200">
                    {kalyanRound.formattedTimeLeft}
                  </strong>
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={kalyanRound.isFrozen}
              onClick={() => handlePlayGame(klGameConfig)}
              className={`w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer min-h-[44px] ${
                kalyanRound.isFrozen
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  : 'bg-zinc-800 active:bg-amber-500 active:text-zinc-950 text-zinc-200 border border-zinc-700'
              }`}
            >
              {kalyanRound.isFrozen ? 'Closed (2h Cutoff)' : 'Play Kalyan'}
            </button>
          </div>

          {/* Kalyan Night */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-3 flex flex-col justify-between space-y-2.5">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-display font-bold text-sm text-zinc-100">
                  Kalyan Night
                </span>
                <span
                  className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                    kalyanNightRound.isFrozen
                      ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                      : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {kalyanNightRound.isFrozen ? 'Closed (2h)' : 'Open'}
                </span>
              </div>

              <div className="space-y-0.5 text-[11px] text-zinc-400">
                <div className="flex justify-between">
                  <span>Declare:</span>
                  <strong className="text-zinc-200">11:45 PM IST</strong>
                </div>
                <div className="flex justify-between">
                  <span>Closes:</span>
                  <strong className="text-amber-400">09:45 PM IST</strong>
                </div>
                <div className="flex justify-between pt-1 border-t border-zinc-800/80">
                  <span>Countdown:</span>
                  <strong className="font-mono text-zinc-200">
                    {kalyanNightRound.formattedTimeLeft}
                  </strong>
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={kalyanNightRound.isFrozen}
              onClick={() => handlePlayGame(knGameConfig)}
              className={`w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer min-h-[44px] ${
                kalyanNightRound.isFrozen
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  : 'bg-zinc-800 active:bg-amber-500 active:text-zinc-950 text-zinc-200 border border-zinc-700'
              }`}
            >
              {kalyanNightRound.isFrozen ? 'Closed (2h Cutoff)' : 'Play Kalyan Night'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
