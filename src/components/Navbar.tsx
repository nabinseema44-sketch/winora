import React, { useState } from 'react';
import {
  Wallet,
  ArrowDownLeft,
  LogIn,
  UserPlus,
  Coins,
  History,
  ShieldAlert,
  Users,
  Crown,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
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

export const Navbar: React.FC<NavbarProps> = ({
  currentPage,
  onNavigate,
  user,
  onOpenDeposit,
  onRoleSwitch,
}) => {
  const [showRoleMenu, setShowRoleMenu] = useState(false);

  const mainBalance = user?.mainBalance ?? user?.walletBalance ?? 0;
  const role = user?.role || 'player';

  const navItems: { id: NavPage; label: string; icon?: React.ReactNode }[] = [
    { id: 'games', label: 'Games' },
    { id: 'history', label: '30D History' },
    { id: 'wallet', label: 'Main Wallet' },
  ];

  // Add role-based links
  if (role === 'agent' || role === 'master') {
    navItems.push({ id: 'agent', label: 'Agent Portal' });
  }
  if (role === 'master') {
    navItems.push({ id: 'master', label: 'Master 00-99 Risk' });
  }

  return (
    <header className="sticky top-0 z-40 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/80">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Brand Logo & Role Badge */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => onNavigate('games')}
            className="focus:outline-none text-left cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]"
            id="nav-brand-logo-btn"
          >
            <Logo size="sm" />
          </button>

          {/* Quick Role Persona Switcher */}
          <div className="relative">
            <button
              onClick={() => setShowRoleMenu(!showRoleMenu)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors bg-zinc-900 border-zinc-800 hover:border-amber-500/50 cursor-pointer"
            >
              {role === 'master' && <Crown className="w-3.5 h-3.5 text-amber-400" />}
              {role === 'agent' && <Users className="w-3.5 h-3.5 text-purple-400" />}
              {role === 'player' && <Sparkles className="w-3.5 h-3.5 text-emerald-400" />}
              <span className="capitalize text-zinc-200">
                {role === 'master' ? 'Master' : role === 'agent' ? 'Agent' : 'Player'}
              </span>
              <ChevronDown className="w-3 h-3 text-zinc-400" />
            </button>

            {showRoleMenu && (
              <div className="absolute left-0 mt-2 w-48 bg-zinc-900 border border-zinc-750 rounded-xl shadow-2xl p-1.5 z-50 text-xs">
                <span className="text-[10px] uppercase font-bold text-zinc-400 px-2 py-1 block">
                  Switch Persona
                </span>
                <button
                  onClick={() => {
                    winoraEngine.switchUserRole('player');
                    onRoleSwitch?.('player');
                    setShowRoleMenu(false);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                    role === 'player' ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  <span>Player (End User)</span>
                  <span className="text-[10px] text-zinc-400">90× Bids</span>
                </button>
                <button
                  onClick={() => {
                    winoraEngine.switchUserRole('agent');
                    onRoleSwitch?.('agent');
                    setShowRoleMenu(false);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                    role === 'agent' ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  <span>Agent Vikram</span>
                  <span className="text-[10px] text-zinc-400">10% Comm</span>
                </button>
                <button
                  onClick={() => {
                    winoraEngine.switchUserRole('master');
                    onRoleSwitch?.('master');
                    setShowRoleMenu(false);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                    role === 'master' ? 'bg-amber-500/20 text-amber-300 font-bold' : 'text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  <span>Master SuperAdmin</span>
                  <span className="text-[10px] text-zinc-400">00–99 Risk</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 bg-zinc-900/60 p-1 rounded-xl border border-zinc-800/50">
          {navItems.map((item) => {
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                id={`nav-link-${item.id}`}
                onClick={() => onNavigate(item.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-amber-500 text-zinc-950 font-black shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Right Section: Main Wallet Pill & Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {user ? (
            <>
              {/* Single Main Wallet Display */}
              <div className="flex items-center gap-1 sm:gap-2">
                {/* Main Wallet Pill */}
                <button
                  id="nav-wallet-pill-btn"
                  onClick={() => onNavigate('wallet')}
                  title="Main Wallet"
                  className="flex items-center bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-amber-500/40 rounded-full pl-2.5 sm:pl-3 pr-1 py-1 transition-all cursor-pointer"
                >
                  <div className="flex flex-col text-left pr-1.5 sm:pr-2">
                    <span className="text-[8px] uppercase font-bold tracking-wider text-amber-400 leading-none">
                      Main Wallet
                    </span>
                    <span className="text-xs sm:text-sm font-black text-zinc-100 tabular-nums">
                      ₹{mainBalance.toLocaleString()}
                    </span>
                  </div>

                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onOpenDeposit) onOpenDeposit();
                      else onNavigate('wallet');
                    }}
                    title="Deposit Handshake"
                    className="bg-amber-500 hover:bg-amber-400 text-zinc-950 p-1 sm:p-1.5 rounded-full transition-all shadow-sm active:scale-95 flex items-center justify-center cursor-pointer"
                  >
                    <ArrowDownLeft className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[2.5]" />
                  </div>
                </button>
              </div>

              {/* Profile Avatar Button */}
              <button
                id="nav-profile-btn"
                onClick={() => onNavigate('profile')}
                className={`flex items-center gap-1.5 p-1 pl-1 pr-2 rounded-full border transition-all cursor-pointer ${
                  currentPage === 'profile'
                    ? 'bg-zinc-800 border-amber-500/50 text-amber-300'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                }`}
              >
                <img
                  src={user.avatar}
                  alt={user.displayName}
                  className="w-7 h-7 rounded-full object-cover ring-1 ring-zinc-700"
                />
                <span className="hidden lg:inline text-xs font-semibold max-w-[100px] truncate">
                  {user.displayName}
                </span>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <button
                id="nav-login-btn"
                onClick={() => onNavigate('login')}
                className="px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold text-zinc-300 hover:text-white hover:bg-zinc-900 border border-zinc-800 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Login</span>
              </button>
              <button
                id="nav-register-btn"
                onClick={() => onNavigate('register')}
                className="px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-zinc-950 transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Register</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
