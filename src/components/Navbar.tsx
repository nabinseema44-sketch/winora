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

  const withdrawablePaise = user?.withdrawableBalancePaise ?? (mainBalance * 100);
  const formattedBalance = (withdrawablePaise / 100).toLocaleString(undefined, { maximumFractionDigits: 0 });

  return (
    <header className="sticky top-0 z-40 bg-zinc-950/95 backdrop-blur-xl border-b border-zinc-800/80 pt-safe select-none">
      <div className="max-w-md mx-auto px-2.5 sm:px-4 h-14 flex items-center justify-between gap-2">
        {/* Brand Logo & Role Badge */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => onNavigate('games')}
            className="focus:outline-none text-left cursor-pointer transition-transform active:scale-95 py-1 min-h-[44px] flex items-center"
            id="nav-brand-logo-btn"
            aria-label="Winora Home"
          >
            <Logo size="sm" />
          </button>

          {role !== 'player' && (
            <button
              onClick={() => onNavigate(role === 'master' ? 'master' : 'agent')}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 active:scale-95 transition-transform min-h-[28px]"
            >
              {role}
            </button>
          )}
        </div>

        {/* Right Section: Main Wallet Pill & Profile Controls (Mobile Touch Optimized) */}
        <div className="flex items-center gap-1.5 shrink-0">
          {user ? (
            <>
              {/* Main Wallet Pill */}
              <button
                id="nav-wallet-pill-btn"
                onClick={() => onNavigate('wallet')}
                title="Withdrawable & Bonus Balance"
                className="flex items-center bg-zinc-900 active:bg-zinc-800 border border-zinc-800 active:border-amber-500/40 rounded-full pl-2.5 pr-1 py-1 transition-all cursor-pointer min-h-[44px]"
              >
                <div className="flex flex-col text-left pr-1.5">
                  <span className="text-[8px] uppercase font-bold tracking-wider text-emerald-400 leading-tight">
                    Bal
                  </span>
                  <span className="text-xs sm:text-sm font-black text-zinc-100 tabular-nums leading-tight">
                    ₹{formattedBalance}
                  </span>
                </div>

                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onOpenDeposit) onOpenDeposit();
                    else onNavigate('wallet');
                  }}
                  title="Deposit / Wallet"
                  className="bg-amber-500 text-zinc-950 rounded-full shadow-sm active:scale-90 flex items-center justify-center cursor-pointer w-7 h-7 shrink-0"
                >
                  <ArrowDownLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
              </button>

              {/* Profile Button */}
              <button
                id="nav-profile-btn"
                onClick={() => onNavigate('profile')}
                className={`flex items-center justify-center w-11 h-11 rounded-full border transition-all cursor-pointer active:scale-95 shrink-0 ${
                  currentPage === 'profile'
                    ? 'bg-zinc-800 border-amber-500/50 text-amber-300'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-300'
                }`}
                title="Profile"
                aria-label="Profile"
              >
                <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-amber-400">
                  <User className="w-4 h-4" />
                </div>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                id="nav-login-btn"
                onClick={() => onNavigate('login')}
                className="px-3 py-2 rounded-xl text-xs font-bold text-zinc-300 bg-zinc-900 border border-zinc-800 active:scale-95 transition-transform flex items-center gap-1 min-h-[44px]"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Login</span>
              </button>
              <button
                id="nav-register-btn"
                onClick={() => onNavigate('register')}
                className="px-3 py-2 rounded-xl text-xs font-black bg-amber-500 text-zinc-950 active:scale-95 transition-transform flex items-center gap-1 shadow-sm min-h-[44px]"
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
