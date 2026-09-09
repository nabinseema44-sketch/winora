import React, { useState } from 'react';
import { X, ShieldAlert, Sparkles, Coins, Users, Award, Play } from 'lucide-react';
import { GameItem } from '../types.ts';

interface GamePreviewModalProps {
  game: GameItem | null;
  onClose: () => void;
  userBalance: number;
}

export const GamePreviewModal: React.FC<GamePreviewModalProps> = ({
  game,
  onClose,
  userBalance,
}) => {
  const [demoBet, setDemoBet] = useState(50);
  const [simulatedFeedback, setSimulatedFeedback] = useState<string | null>(null);

  if (!game) return null;

  const handleSimulateClick = () => {
    setSimulatedFeedback(
      `Foundation Demo Triggered: Demo stake set to ${demoBet} points. Game calculations are scheduled for Phase 2 implementation.`
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          id="close-game-modal-btn"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-full transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-xl bg-zinc-800 border border-zinc-700/60 text-amber-400">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-amber-400">
              WINORA Virtual Game Showcase
            </span>
            <h2 className="font-display text-2xl font-bold text-zinc-100">
              {game.title}
            </h2>
          </div>
        </div>

        {/* Foundation Notice */}
        <div className="mb-5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-200/90 leading-relaxed">
            <span className="font-bold text-amber-300 block mb-0.5">
              Foundation Version Notice
            </span>
            This is the initial structural preview. Game mathematics, outcome RNGs, and virtual balance deductions will be integrated server-side in subsequent development stages.
          </div>
        </div>

        <p className="text-sm text-zinc-300 mb-5 leading-relaxed">
          {game.description}
        </p>

        {/* Demo Stake Configuration Preview */}
        <div className="bg-zinc-950/70 border border-zinc-800 rounded-xl p-4 mb-5">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-zinc-400 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" /> Demo Stake
            </span>
            <span className="text-zinc-100 font-bold tabular-nums">
              {demoBet} Points
            </span>
          </div>

          <input
            type="range"
            min={game.minVirtualBet}
            max={Math.min(game.maxVirtualBet, 500)}
            step={5}
            value={demoBet}
            onChange={(e) => {
              setDemoBet(Number(e.target.value));
              setSimulatedFeedback(null);
            }}
            className="w-full accent-amber-500 cursor-pointer h-2 bg-zinc-800 rounded-lg"
          />

          <div className="flex justify-between text-[11px] text-zinc-400 mt-1">
            <span>Min: {game.minVirtualBet} Pts</span>
            <span>Demo Demo Mode</span>
            <span>Max: {game.maxVirtualBet} Pts</span>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-2.5 mb-5 text-xs">
          <div className="p-3 bg-zinc-950/50 border border-zinc-800/80 rounded-xl">
            <span className="text-zinc-400 block mb-1 flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-zinc-400" /> Active Players
            </span>
            <span className="font-bold text-zinc-200">{game.playersOnline} simulated</span>
          </div>
          <div className="p-3 bg-zinc-950/50 border border-zinc-800/80 rounded-xl">
            <span className="text-zinc-400 block mb-1 flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-zinc-400" /> Virtual Volatility
            </span>
            <span className="font-bold text-zinc-200">Medium / Entertainment</span>
          </div>
        </div>

        {simulatedFeedback && (
          <div className="mb-4 p-3 bg-zinc-800/80 border border-zinc-700 text-xs text-zinc-300 rounded-xl animate-in fade-in">
            {simulatedFeedback}
          </div>
        )}

        {/* Action Button */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer text-center"
          >
            Close Preview
          </button>
          <button
            type="button"
            onClick={handleSimulateClick}
            className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-zinc-950 transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Simulate Demo Round</span>
          </button>
        </div>
      </div>
    </div>
  );
};
