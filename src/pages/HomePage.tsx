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
    <div className="space-y-6 pb-12 font-sans">
      {/* 1. Real-Time Indian Standard Time (IST) Header Ticker */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2.5 rounded-2xl bg-zinc-900/90 border border-zinc-800 text-xs shadow-sm">
        <div className="flex items-center gap-2 text-zinc-300 font-medium">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-bold text-zinc-100">Live Indian Time (IST):</span>
          <span className="font-mono text-amber-400 font-bold">
            {formatISTDateTime(now)}
          </span>
        </div>
        <div className="text-[11px] text-zinc-400 flex items-center gap-2">
          <span>UTC+05:30 (Asia/Kolkata)</span>
          <span className="text-zinc-600">•</span>
          <span className="text-emerald-400 font-semibold">Authoritative Game Timers</span>
        </div>
      </div>

      {/* 2. PRIORITY TOP BANNER: HOURLY PLAY (Priority #1 Game for All Players) */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500/15 via-zinc-900 to-zinc-950 border-2 border-amber-500/40 p-6 sm:p-8 shadow-2xl shadow-amber-500/10">
        {/* Ambient backdrop glow */}
        <div className="absolute -top-16 -right-16 w-80 h-80 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-80 h-80 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-5">
          {/* Top Badges */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500 text-zinc-950 text-xs font-black uppercase tracking-wider shadow-md">
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>Priority Game #1 • Hourly Play</span>
            </div>

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900/90 border border-zinc-700 text-xs font-mono font-bold text-zinc-300">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Draws Every Hour (7 AM – 8 AM ... 24×7)</span>
            </div>
          </div>

          {/* Banner Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-7 space-y-3">
              <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-black text-zinc-100 tracking-tight leading-none">
                HOURLY PLAY <span className="text-amber-400">DHAMAKA</span>
              </h1>

              {/* Status and Countdown Box */}
              <div className="bg-zinc-950/80 border border-zinc-800 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        hourlyRound.isFrozen ? 'bg-rose-500' : 'bg-emerald-500'
                      } animate-ping`}
                    />
                    {hourlyRound.isFrozen ? (
                      <span className="text-rose-400 font-black">
                        BIDDING FROZEN (Drawing in progress)
                      </span>
                    ) : (
                      <span className="text-emerald-400 font-black">
                        BIDDING OPEN (15-min freeze applies)
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-zinc-400">
                    Round #{hourlyRound.roundNumber}
                  </span>
                </div>

                <div className="flex items-baseline gap-3">
                  <div className="font-mono text-3xl sm:text-4xl font-black text-amber-400 tracking-tight">
                    {hourlyRound.formattedTimeLeft}
                  </div>
                  <div className="text-xs text-zinc-400">
                    {hourlyRound.isFrozen ? (
                      <span>until result declares at <strong>{hourlyRound.declareTimeIST}</strong></span>
                    ) : (
                      <span>until freeze cutoff at <strong>{hourlyRound.freezeTimeIST}</strong></span>
                    )}
                  </div>
                </div>
              </div>

              {/* Green & Red Rule Highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-xl p-3 flex items-start gap-2.5">
                  <span className="text-lg leading-none">🟢</span>
                  <div className="text-xs">
                    <div className="font-bold text-emerald-400">GREEN (Even: 00, 02..98)</div>
                    <div className="text-zinc-300 text-[11px] mt-0.5">
                      90× winning payout. If declared number is Green, <strong>80% of all Green stakes refunded</strong> to Bonus!
                    </div>
                  </div>
                </div>

                <div className="bg-rose-950/30 border border-rose-500/40 rounded-xl p-3 flex items-start gap-2.5">
                  <span className="text-lg leading-none">🔴</span>
                  <div className="text-xs">
                    <div className="font-bold text-rose-400">RED (Odd: 01, 03..99)</div>
                    <div className="text-zinc-300 text-[11px] mt-0.5">
                      90× winning payout. If declared number is Red, <strong>80% of all Red stakes refunded</strong> to Bonus!
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Banner Right Action Card */}
            <div className="lg:col-span-5 flex flex-col justify-center bg-zinc-950/90 border border-zinc-800 rounded-2xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  Hourly Play Specs
                </span>
                <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/30">
                  90× Win Multiplier
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-zinc-300">
                  <span className="text-zinc-400">Round Cycle:</span>
                  <span className="font-bold">Every 60 Minutes (24×7)</span>
                </div>
                <div className="flex justify-between text-zinc-300">
                  <span className="text-zinc-400">Freeze Cutoff:</span>
                  <span className="font-bold text-amber-400">15 min before declare</span>
                </div>
                <div className="flex justify-between text-zinc-300">
                  <span className="text-zinc-400">Refund Protection:</span>
                  <span className="font-bold text-emerald-400">80% on matching color</span>
                </div>
                <div className="flex justify-between text-zinc-300">
                  <span className="text-zinc-400">Max Picks Per Round:</span>
                  <span className="font-bold">37 Numbers Limit</span>
                </div>
              </div>

              <button
                id="play-hourly-game-top-btn"
                type="button"
                onClick={() => handlePlayGame(hourlyGameConfig)}
                className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-zinc-950 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-98 transition-all cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Play Hourly Game Now</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Account Wallet Quick Strip */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider block">
              Player Balance
            </span>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="text-xl font-bold font-mono text-zinc-100">
                {currencySymbol}
                {mainBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              {bonusBalance > 0 && (
                <span className="text-xs font-bold font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded-md" title="Bonus Balance from 80% color protection">
                  +{currencySymbol}{bonusBalance.toFixed(2)} Bonus
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            id="home-wallet-deposit-cta"
            type="button"
            onClick={() => onNavigate('wallet')}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <ArrowDownLeft className="w-4 h-4 stroke-[2.5]" />
            <span>Deposit</span>
          </button>
          <button
            id="home-wallet-withdraw-cta"
            type="button"
            onClick={() => onNavigate('wallet')}
            className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-zinc-800 hover:bg-zinc-750 text-zinc-200 border border-zinc-700 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <ArrowUpRight className="w-4 h-4 stroke-[2.5] text-amber-400" />
            <span>Withdraw</span>
          </button>
        </div>
      </section>

      {/* 4. Kalyan Traditional Markets Section (2-Hour Close Rule Enforced) */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
          <div>
            <h2 className="font-display text-xl font-bold text-zinc-100 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-amber-400" />
              <span>Kalyan Daily Markets</span>
            </h2>
            <p className="text-xs text-zinc-400">
              Strict 2-hour close cutoff before result declaration. Indian Standard Time enforced.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('games')}
            className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 self-start sm:self-auto cursor-pointer"
          >
            <span>All Game Rooms</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Kalyan Morning */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 flex flex-col justify-between space-y-3 hover:border-zinc-700 transition-colors">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-display font-bold text-base text-zinc-100">
                  Kalyan Morning
                </span>
                <span
                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                    kalyanMorningRound.isFrozen
                      ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                      : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {kalyanMorningRound.isFrozen ? 'Locked (2h cutoff)' : 'Bidding Open'}
                </span>
              </div>

              <div className="space-y-1 text-xs text-zinc-400">
                <div className="flex justify-between">
                  <span>Result Declaration:</span>
                  <strong className="text-zinc-200">11:30 AM IST</strong>
                </div>
                <div className="flex justify-between">
                  <span>Bidding Closes:</span>
                  <strong className="text-amber-400">09:30 AM IST (2 hr before)</strong>
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
              className={`w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                kalyanMorningRound.isFrozen
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  : 'bg-zinc-800 hover:bg-amber-500 hover:text-zinc-950 text-zinc-200 border border-zinc-700'
              }`}
            >
              {kalyanMorningRound.isFrozen ? 'Bidding Closed (2h before)' : 'Play Kalyan Morning'}
            </button>
          </div>

          {/* Kalyan (Day) */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 flex flex-col justify-between space-y-3 hover:border-zinc-700 transition-colors">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-display font-bold text-base text-zinc-100">
                  Kalyan
                </span>
                <span
                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                    kalyanRound.isFrozen
                      ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                      : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {kalyanRound.isFrozen ? 'Locked (2h cutoff)' : 'Bidding Open'}
                </span>
              </div>

              <div className="space-y-1 text-xs text-zinc-400">
                <div className="flex justify-between">
                  <span>Result Declaration:</span>
                  <strong className="text-zinc-200">04:30 PM IST</strong>
                </div>
                <div className="flex justify-between">
                  <span>Bidding Closes:</span>
                  <strong className="text-amber-400">02:30 PM IST (2 hr before)</strong>
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
              className={`w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                kalyanRound.isFrozen
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  : 'bg-zinc-800 hover:bg-amber-500 hover:text-zinc-950 text-zinc-200 border border-zinc-700'
              }`}
            >
              {kalyanRound.isFrozen ? 'Bidding Closed (2h before)' : 'Play Kalyan'}
            </button>
          </div>

          {/* Kalyan Night */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 flex flex-col justify-between space-y-3 hover:border-zinc-700 transition-colors">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-display font-bold text-base text-zinc-100">
                  Kalyan Night
                </span>
                <span
                  className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                    kalyanNightRound.isFrozen
                      ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                      : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {kalyanNightRound.isFrozen ? 'Locked (2h cutoff)' : 'Bidding Open'}
                </span>
              </div>

              <div className="space-y-1 text-xs text-zinc-400">
                <div className="flex justify-between">
                  <span>Result Declaration:</span>
                  <strong className="text-zinc-200">11:45 PM IST</strong>
                </div>
                <div className="flex justify-between">
                  <span>Bidding Closes:</span>
                  <strong className="text-amber-400">09:45 PM IST (2 hr before)</strong>
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
              className={`w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer ${
                kalyanNightRound.isFrozen
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  : 'bg-zinc-800 hover:bg-amber-500 hover:text-zinc-950 text-zinc-200 border border-zinc-700'
              }`}
            >
              {kalyanNightRound.isFrozen ? 'Bidding Closed (2h before)' : 'Play Kalyan Night'}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
