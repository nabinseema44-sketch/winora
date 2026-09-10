import React, { useState } from 'react';
import { LogIn, UserPlus, History, Users, Crown, ChevronDown, Sparkles } from 'lucide-react';
import { Logo } from './Logo.tsx';
import { NavPage, UserProfile } from '../types.ts';
import { winoraEngine } from '../services/winoraEngine.ts';

interface NavbarProps {
  currentPage: NavPage;
  onNavigate: (page: NavPage) => void;
  user: UserProfile | null;
  onOpenDeposit?: () => void;
  onRoleSwitch?: (role: 'player' | 'agent' | 'master') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentPage, onNavigate, user, onRoleSwitch }) => {
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const mainBalance = user?.mainBalance ?? user?.walletBalance ?? 0;
  const role = user?.role || 'player';

  const navItems: { id: NavPage; label: string }[] = [
    { id: 'games', label: 'Games' },
    { id: 'history', label: '30D History' },
    { id: 'wallet', label: 'Main Wallet' },
  ];
  if (role === 'agent' || role === 'master') navItems.push({ id: 'agent', label: 'Agent Portal' });
  if (role === 'master') navItems.push({ id: 'master', label: 'Master 00–99 Risk' });

  const switchRole = (nextRole: 'player' | 'agent' | 'master') => {
    winoraEngine.switchUserRole(nextRole);
    onRoleSwitch?.(nextRole);
    setShowRoleMenu(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/80">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <button onClick={() => onNavigate('games')} className="focus:outline-none text-left cursor-pointer">
            <Logo size="sm" />
          </button>
          {user && (
            <div className="relative">
              <button onClick={() => setShowRoleMenu(!showRoleMenu)} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border bg-zinc-900 border-zinc-800 hover:border-amber-500/50 cursor-pointer">
                {role === 'master' ? <Crown className="w-3.5 h-3.5 text-amber-400" /> : role === 'agent' ? <Users className="w-3.5 h-3.5 text-purple-400" /> : <Sparkles className="w-3.5 h-3.5 text-emerald-400" />}
                <span className="capitalize text-zinc-200">{role}</span><ChevronDown className="w-3 h-3 text-zinc-400" />
              </button>
              {showRoleMenu && (
                <div className="absolute left-0 mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-1.5 z-50 text-xs">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 px-2 py-1 block">Switch Persona</span>
                  {(['player', 'agent', 'master'] as const).map((item) => (
                    <button key={item} onClick={() => switchRole(item)} className={`w-full text-left px-2.5 py-2 rounded-lg capitalize cursor-pointer ${role === item ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-zinc-300 hover:bg-zinc-800'}`}>
                      {item}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <nav className="hidden md:flex items-center gap-1 bg-zinc-900/60 p-1 rounded-xl border border-zinc-800/50">
          {navItems.map((item) => (
            <button key={item.id} onClick={() => onNavigate(item.id)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${currentPage === item.id ? 'bg-amber-500 text-zinc-950 font-black' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {user ? (
            <>
              <button onClick={() => onNavigate('wallet')} title="Main Wallet" className="flex items-center bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-full px-3 py-1.5 cursor-pointer">
                <div className="flex flex-col text-left">
                  <span className="text-[8px] uppercase font-bold tracking-wider text-amber-400 leading-none">Main Wallet</span>
                  <span className="text-xs sm:text-sm font-black text-zinc-100 tabular-nums">{mainBalance.toLocaleString()}</span>
                </div>
              </button>
              <button onClick={() => onNavigate('profile')} className="flex items-center gap-1.5 p-1 pl-1 pr-2 rounded-full border bg-zinc-900 border-zinc-800 text-zinc-300 cursor-pointer">
                <img src={user.avatar} alt={user.displayName} className="w-7 h-7 rounded-full object-cover ring-1 ring-zinc-700" />
                <span className="hidden lg:inline text-xs font-semibold max-w-[100px] truncate">{user.displayName}</span>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={() => onNavigate('login')} className="px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold text-zinc-300 hover:text-white hover:bg-zinc-900 border border-zinc-800 flex items-center gap-1.5 cursor-pointer"><LogIn className="w-3.5 h-3.5" />Login</button>
              <button onClick={() => onNavigate('register')} className="px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-zinc-950 flex items-center gap-1.5 cursor-pointer"><UserPlus className="w-3.5 h-3.5" />Register</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
