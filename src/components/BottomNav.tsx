import React from 'react';
import { Gamepad2, Wallet, User, History, ShieldAlert, Users } from 'lucide-react';
import { NavPage, UserProfile } from '../types.ts';

interface BottomNavProps {
  currentPage: NavPage;
  onNavigate: (page: NavPage) => void;
  user?: UserProfile | null;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentPage, onNavigate, user }) => {
  const role = user?.role || 'player';

  const items: { id: NavPage; label: string; icon: React.ReactNode }[] = [
    { id: 'games', label: 'Games', icon: <Gamepad2 className="w-5 h-5" /> },
    { id: 'history', label: 'Ledger', icon: <History className="w-5 h-5" /> },
    { id: 'wallet', label: 'Wallet', icon: <Wallet className="w-5 h-5" /> },
  ];

  if (role === 'master') {
    items.push({ id: 'master', label: 'Master', icon: <ShieldAlert className="w-5 h-5" /> });
  } else if (role === 'agent') {
    items.push({ id: 'agent', label: 'Agent', icon: <Users className="w-5 h-5" /> });
  }

  items.push({ id: 'profile', label: 'Profile', icon: <User className="w-5 h-5" /> });

  return (
    <nav
      id="mobile-bottom-nav"
      aria-label="Bottom Navigation"
      className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800/90 px-1 pt-1.5 pb-safe select-none"
    >
      <div className="max-w-md mx-auto flex items-center justify-around">
        {items.map((item) => {
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              id={`bottom-nav-${item.id}`}
              onClick={() => onNavigate(item.id)}
              className={`flex-1 flex flex-col items-center justify-center min-h-[48px] py-1 px-1 rounded-xl transition-all active:scale-90 cursor-pointer ${
                isActive
                  ? 'text-amber-400 font-bold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <div
                className={`p-1 rounded-lg transition-colors ${
                  isActive ? 'bg-amber-500/20 text-amber-400' : 'text-zinc-400'
                }`}
              >
                {item.icon}
              </div>
              <span className="text-[10px] sm:text-[11px] font-semibold mt-0.5 tracking-tight leading-none">
                {item.label}
              </span>
              {isActive && (
                <div className="w-1 h-1 rounded-full bg-amber-400 mt-1" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

