import React from 'react';
import { Sparkles } from 'lucide-react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ size = 'md', showSubtitle = false }) => {
  const sizeClasses = {
    sm: {
      crest: 'w-7 h-7 text-xs',
      title: 'text-xl',
      badge: 'text-[9px] px-1.5 py-0.5',
    },
    md: {
      crest: 'w-9 h-9 text-sm',
      title: 'text-2xl',
      badge: 'text-[10px] px-2 py-0.5',
    },
    lg: {
      crest: 'w-12 h-12 text-base',
      title: 'text-3xl',
      badge: 'text-xs px-2.5 py-0.5',
    },
  };

  const current = sizeClasses[size];

  return (
    <div className="flex items-center gap-2.5 select-none">
      {/* Sleek Diamond Gaming Crest */}
      <div
        className={`relative flex items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-zinc-950 font-black shadow-lg shadow-amber-500/20 ring-1 ring-amber-300/40 ${current.crest}`}
      >
        <span className="font-display font-extrabold tracking-tighter">W</span>
        <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-zinc-950" />
      </div>

      <div className="flex flex-col">
        <div className="flex items-center gap-1.5">
          <span className={`font-display font-black tracking-widest text-zinc-100 ${current.title}`}>
            WIN<span className="text-amber-400">ORA</span>
          </span>
          <span className={`rounded-full bg-zinc-800 text-zinc-400 font-semibold border border-zinc-700/60 uppercase tracking-wider ${current.badge}`}>
            VIRTUAL
          </span>
        </div>
        {showSubtitle && (
          <span className="text-xs text-zinc-400 tracking-wider flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400 inline" /> Virtual Credit Gaming Lounge
          </span>
        )}
      </div>
    </div>
  );
};
