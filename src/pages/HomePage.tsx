import React from 'react';
import {
  Sparkles,
  Gamepad2,
  Wallet,
  ShieldCheck,
  TrendingUp,
  ArrowRight,
  ArrowDownLeft,
  ArrowUpRight,
  Lock,
} from 'lucide-react';
import { GameCard } from '../components/GameCard.tsx';
import { GameItem, NavPage, UserProfile } from '../types.ts';

interface HomePageProps {
  games: GameItem[];
  user: UserProfile | null;
  onNavigate: (page: NavPage) => void;
  onSelectGame: (game: GameItem) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  games,
  user,
  onNavigate,
  onSelectGame,
}) => {
  const featuredGames = games.filter((g) => g.isHot || g.isNew).slice(0, 4);
  const currencySymbol = user?.currency?.symbol || '₹';
  const balance = user?.walletBalance ?? 0;

  return (
    <div className="space-y-8 pb-12">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-zinc-900 via-zinc-900/90 to-zinc-950 border border-zinc-800 p-6 sm:p-8 md:p-10 shadow-xl">
        {/* Ambient background accents */}
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Official Platform • Isolated Account Wallet</span>
          </div>

          <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-black text-zinc-100 tracking-tight leading-tight mb-4">
            Welcome to <span className="text-amber-400">WINORA</span>
          </h1>

          <p className="text-sm sm:text-base text-zinc-300 mb-6 leading-relaxed max-w-2xl">
            Experience next-generation digital arcade and table simulations with a responsive mobile interface. Includes a dedicated money wallet for seamless deposits and verified withdrawal settlement with licensed payment providers.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <button
              id="hero-explore-games-btn"
              onClick={() => onNavigate('games')}
              className="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-sm flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-amber-500/10 active:scale-98"
            >
              <Gamepad2 className="w-4 h-4" />
              <span>Browse Games</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>

            <button
              id="hero-wallet-btn"
              onClick={() => onNavigate('wallet')}
              className="px-5 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-sm flex items-center gap-2 border border-zinc-700/80 transition-all cursor-pointer active:scale-98"
            >
              <Wallet className="w-4 h-4 text-amber-400" />
              <span>Account Wallet</span>
            </button>
          </div>
        </div>
      </section>

      {/* Account Money Wallet Banner */}
      <section className="bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-4 text-center sm:text-left">
          <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <h3 className="font-display font-bold text-lg text-zinc-100">
                WINORA Money Wallet
              </h3>
              {user && (
                <span className="text-xs font-bold text-amber-400 font-mono bg-zinc-800 px-2 py-0.5 rounded-md border border-zinc-700">
                  {currencySymbol}{balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Instant UPI & card deposits, verified bank withdrawals, and complete transaction history.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            id="home-wallet-deposit-cta"
            onClick={() => onNavigate('wallet')}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <ArrowDownLeft className="w-4 h-4 stroke-[2.5]" />
            <span>Deposit</span>
          </button>
          <button
            id="home-wallet-withdraw-cta"
            onClick={() => onNavigate('wallet')}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-zinc-800 hover:bg-zinc-750 text-zinc-200 border border-zinc-700 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <ArrowUpRight className="w-4 h-4 stroke-[2.5] text-amber-400" />
            <span>Withdraw</span>
          </button>
        </div>
      </section>

      {/* Featured Games */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-zinc-100 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-amber-400" />
              <span>Trending Titles</span>
            </h2>
            <p className="text-xs text-zinc-400">
              Popular community game demonstrations
            </p>
          </div>
          <button
            onClick={() => onNavigate('games')}
            className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {featuredGames.map((game) => (
            <GameCard key={game.id} game={game} onSelect={onSelectGame} />
          ))}
        </div>
      </section>

      {/* WINORA Core Foundation Pillars */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-2">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center mb-3">
            <Lock className="w-5 h-5" />
          </div>
          <h4 className="font-display font-bold text-base text-zinc-100">
            Isolated Financial Ledger
          </h4>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Money balances and payment records are maintained in isolated systems. Browser clients are not permitted to alter monetary balances.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-2">
          <div className="w-9 h-9 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center mb-3">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h4 className="font-display font-bold text-base text-zinc-100">
            Payment Provider Compliance
          </h4>
          <p className="text-xs text-zinc-400 leading-relaxed">
            All deposits and withdrawals integrate with licensed payment aggregators. No card CVVs or banking passwords are captured by WINORA.
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 space-y-2">
          <div className="w-9 h-9 rounded-lg bg-cyan-500/15 text-cyan-400 flex items-center justify-center mb-3">
            <Gamepad2 className="w-5 h-5" />
          </div>
          <h4 className="font-display font-bold text-base text-zinc-100">
            Mobile-First Architecture
          </h4>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Built from the ground up for seamless navigation, instant touch responses, and high-performance smartphone rendering.
          </p>
        </div>
      </section>
    </div>
  );
};
