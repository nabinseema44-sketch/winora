import React from 'react';
import {
  ArrowDownLeft,
  LogIn,
  UserPlus,
  User,
} from 'lucide-react';
import { Logo } from './Logo.tsx';
import { NavPage, UserProfile } from '../types.ts';

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
}) => {
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

          {role !== 'player' && (
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/15 text-amber-300 border border-amber-500/30">
              {role}
            </span>
          )}
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
              {/* Authoritative Dual Balance Display */}
              <div className="flex items-center gap-1 sm:gap-2">
                {/* Main Wallet Pill */}
                <button
                  id="nav-wallet-pill-btn"
                  onClick={() => onNavigate('wallet')}
                  title="Withdrawable & Bonus Balance"
                  className="flex items-center bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-amber-500/40 rounded-full pl-2.5 sm:pl-3 pr-1 py-1 transition-all cursor-pointer"
                >
                  <div className="flex flex-col text-left pr-1.5 sm:pr-2">
                    <div className="flex items-center gap-1 leading-none">
                      <span className="text-[8px] uppercase font-bold tracking-wider text-emerald-400">
                        Withdrawable
                      </span>
                      {(user.bonusBalancePaise || 0) > 0 && (
                        <span className="text-[8px] font-bold text-amber-400">
                          +₹{((user.bonusBalancePaise || 0) / 100).toLocaleString()} Bonus
                        </span>
                      )}
                    </div>
                    <span className="text-xs sm:text-sm font-black text-zinc-100 tabular-nums mt-0.5">
                      ₹{((user.withdrawableBalancePaise ?? (mainBalance * 100)) / 100).toLocaleString()}
                    </span>
                  </div>

                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onOpenDeposit) onOpenDeposit();
                      else onNavigate('wallet');
                    }}
                    title="Manual Deposit (UTR)"
                    className="bg-amber-500 hover:bg-amber-400 text-zinc-950 p-1 sm:p-1.5 rounded-full transition-all shadow-sm active:scale-95 flex items-center justify-center cursor-pointer"
                  >
                    <ArrowDownLeft className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[2.5]" />
                  </div>
                </button>
              </div>

              {/* Profile Button */}
              <button
                id="nav-profile-btn"
                onClick={() => onNavigate('profile')}
                className={`flex items-center gap-1.5 p-1 pl-1.5 pr-2.5 rounded-full border transition-all cursor-pointer ${
                  currentPage === 'profile'
                    ? 'bg-zinc-800 border-amber-500/50 text-amber-300'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                }`}
              >
                <div className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-amber-400">
                  <User className="w-3.5 h-3.5" />
                </div>
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
