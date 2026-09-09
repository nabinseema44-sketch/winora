import React from 'react';
import { ShieldCheck, Info } from 'lucide-react';

export const DisclaimerBanner: React.FC = () => {
  return (
    <div className="bg-zinc-900/90 border-b border-zinc-800/80 px-4 py-2 text-xs text-zinc-400">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-1.5 text-center sm:text-left">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>
            <strong className="text-zinc-200">WINORA Wallet & Play Policy:</strong> Account money wallet is isolated from game simulations.
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-zinc-400 text-[11px]">
          <Info className="w-3 h-3 text-amber-400 shrink-0" />
          <span>Real-money gambling and wagering calculations are prohibited</span>
        </div>
      </div>
    </div>
  );
};
