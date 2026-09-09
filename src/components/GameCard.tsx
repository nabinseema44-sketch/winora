import React from 'react';
import {
  Rocket,
  Sparkles,
  Dices,
  Bomb,
  Layers,
  Disc,
  Grid,
  CircleDot,
  Users,
  Flame,
  Play,
  Clock,
} from 'lucide-react';
import { GameItem } from '../types.ts';

interface GameCardProps {
  game: GameItem;
  onSelect: (game: GameItem) => void;
}

export const GameCard: React.FC<GameCardProps> = ({ game, onSelect }) => {
  const renderIcon = (iconName: string) => {
    const props = { className: 'w-7 h-7 sm:w-8 sm:h-8' };
    switch (iconName) {
      case 'Rocket':
        return <Rocket {...props} />;
      case 'Sparkles':
        return <Sparkles {...props} />;
      case 'Dices':
        return <Dices {...props} />;
      case 'Bomb':
        return <Bomb {...props} />;
      case 'Layers':
        return <Layers {...props} />;
      case 'Disc':
        return <Disc {...props} />;
      case 'Grid':
        return <Grid {...props} />;
      default:
        return <CircleDot {...props} />;
    }
  };

  const isComingSoon = game.status === 'coming_soon';

  return (
    <div
      id={`game-card-${game.id}`}
      onClick={() => onSelect(game)}
      className="group relative flex flex-col justify-between bg-zinc-900/90 hover:bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-2xl p-4 transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md hover:-translate-y-0.5 overflow-hidden"
    >
      {/* Background ambient gradient glow */}
      <div
        className={`absolute -right-10 -top-10 w-32 h-32 rounded-full blur-3xl opacity-20 pointer-events-none bg-gradient-to-br ${game.accentColor}`}
      />

      <div>
        {/* Top Badges */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400 border border-zinc-700/60">
            {game.category}
          </span>
          <div className="flex items-center gap-1.5">
            {game.isHot && (
              <span className="flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                <Flame className="w-3 h-3 text-amber-400" /> HOT
              </span>
            )}
            {game.isNew && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
                NEW
              </span>
            )}
          </div>
        </div>

        {/* Icon & Title */}
        <div className="flex items-start gap-3 mb-2.5">
          <div
            className={`p-3 rounded-xl bg-gradient-to-br ${game.accentColor} border shrink-0 group-hover:scale-105 transition-transform duration-200`}
          >
            {renderIcon(game.icon)}
          </div>
          <div>
            <h3 className="font-display text-lg font-bold text-zinc-100 group-hover:text-amber-400 transition-colors">
              {game.title}
            </h3>
            <p className="text-xs text-zinc-400 line-clamp-2 mt-0.5">
              {game.description}
            </p>
          </div>
        </div>
      </div>

      {/* Footer Info: Demo Stakes Range & CTA */}
      <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between">
        <div>
          <span className="text-[10px] uppercase tracking-wider text-zinc-400 block">
            Demo Stakes
          </span>
          <span className="text-xs font-semibold text-zinc-300">
            {game.minVirtualBet} - {game.maxVirtualBet} <span className="text-amber-400 font-bold">Points</span>
          </span>
        </div>

        {isComingSoon ? (
          <span className="flex items-center gap-1 text-xs font-medium text-zinc-400 px-3 py-1.5 rounded-xl bg-zinc-800/80 border border-zinc-700/50">
            <Clock className="w-3.5 h-3.5 text-zinc-400" /> Coming Soon
          </span>
        ) : (
          <button
            type="button"
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-amber-500/15 text-amber-400 hover:bg-amber-500 hover:text-zinc-950 border border-amber-500/30 transition-all cursor-pointer group-hover:shadow-sm"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>Play Demo</span>
          </button>
        )}
      </div>

      {/* Online Players live indicator */}
      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-zinc-400">
        <Users className="w-3 h-3 text-zinc-400" />
        <span>{game.playersOnline} playing virtual rounds</span>
      </div>
    </div>
  );
};
