import React, { useState } from 'react';
import { Search, Sparkles, Filter, ShieldAlert } from 'lucide-react';
import { GameCard } from '../components/GameCard.tsx';
import { GameCategory, GameItem } from '../types.ts';

interface GamesPageProps {
  games: GameItem[];
  onSelectGame: (game: GameItem) => void;
}

export const GamesPage: React.FC<GamesPageProps> = ({ games, onSelectGame }) => {
  const [activeCategory, setActiveCategory] = useState<GameCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const categories: { id: GameCategory; label: string }[] = [
    { id: 'all', label: 'All Games' },
    { id: 'slots', label: 'Reels & Slots' },
    { id: 'crash', label: 'Crash' },
    { id: 'table', label: 'Table Games' },
    { id: 'arcade', label: 'Arcade & Mines' },
    { id: 'dice', label: 'Dice' },
  ];

  const filteredGames = games.filter((game) => {
    const matchesCategory =
      activeCategory === 'all' || game.category === activeCategory;
    const matchesSearch =
      game.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      game.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs text-amber-400 font-semibold mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Virtual Games Catalogue</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-black text-zinc-100">
            Explore WINORA Games
          </h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Curated interactive titles for entertainment demonstration.
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="games-search-input"
            type="text"
            placeholder="Search virtual titles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 focus:border-amber-500 rounded-xl pl-9 pr-4 py-2 text-xs sm:text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Category Pills (Horizontal scrolling on mobile) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <div className="flex items-center text-xs text-zinc-400 pl-1 pr-2 border-r border-zinc-800 shrink-0">
          <Filter className="w-3.5 h-3.5 mr-1" />
          <span className="hidden sm:inline">Filter:</span>
        </div>
        {categories.map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              id={`filter-category-${cat.id}`}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-amber-500 text-zinc-950 shadow-sm'
                  : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800/80'
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Foundation Architecture Reminder */}
      <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-3.5 flex items-center gap-3 text-xs text-zinc-400">
        <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
        <span>
          <strong className="text-zinc-300">Phase 1 Foundation:</strong> Click any game to view its structural preview. Full math calculations and server-verified RNG engines are coming in the next release.
        </span>
      </div>

      {/* Games Grid */}
      {filteredGames.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredGames.map((game) => (
            <GameCard key={game.id} game={game} onSelect={onSelectGame} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl">
          <p className="text-zinc-400 text-sm">
            No virtual games match "{searchQuery}".
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setActiveCategory('all');
            }}
            className="mt-3 px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 cursor-pointer transition-colors"
          >
            Clear Filters
          </button>
        </div>
      )}
    </div>
  );
};
