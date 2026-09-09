import React from 'react';
import { Wallet, ArrowDownLeft, LogIn, UserPlus } from 'lucide-react';
import { Logo } from './Logo.tsx';
import { NavPage, UserProfile } from '../types.ts';

interface NavbarProps {
  currentPage: NavPage;
  onNavigate: (page: NavPage) => void;
  user: UserProfile | null;
  onOpenDeposit?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentPage,
  onNavigate,
  user,
  onOpenDeposit,
}) => {
  const navItems: { id: NavPage; label: string }[] = [
    { id: 'home', label: 'Home' },
    { id: 'games', label: 'Games' },
    { id: 'wallet', label: 'Wallet' },
    { id: 'profile', label: 'Profile' },
  ];

  const currencySymbol = user?.currency?.symbol || '₹';
  const balance = user?.walletBalance ?? 0;

  return (
    <header className="sticky top-0 z-40 bg-zinc-950/85 backdrop-blur-md border-b border-zinc-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand Logo */}
        <button
          onClick={() => onNavigate('home')}
          className="focus:outline-none text-left cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]"
          id="nav-brand-logo-btn"
        >
          <Logo size="sm" />
        </button>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 bg-zinc-900/60 p-1 rounded-xl border border-zinc-800/50">
          {navItems.map((item) => {
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                id={`nav-link-${item.id}`}
                onClick={() => onNavigate(item.id)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Right Section: Money Wallet Balance & Account Controls */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {user ? (
            <>
              {/* Money Wallet Balance Pill */}
              <button
                id="nav-wallet-pill-btn"
                onClick={() => onNavigate('wallet')}
                title="View Wallet Balance & Transactions"
                className="flex items-center bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-amber-500/40 rounded-full pl-3 pr-1.5 py-1 shadow-inner transition-all cursor-pointer group"
              >
                <Wallet className="w-4 h-4 text-amber-400 mr-2 shrink-0 group-hover:scale-110 transition-transform" />
                <div className="flex flex-col text-left pr-2">
                  <span className="text-[9px] uppercase font-bold tracking-wider text-zinc-400 leading-none">
                    Balance
                  </span>
                  <span className="text-xs sm:text-sm font-black text-zinc-100 tabular-nums">
                    {currencySymbol}
                    {balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onOpenDeposit) {
                      onOpenDeposit();
                    } else {
                      onNavigate('wallet');
                    }
                  }}
                  title="Deposit Funds"
                  className="bg-amber-500 hover:bg-amber-400 text-zinc-950 p-1.5 rounded-full transition-all shadow-sm active:scale-95 flex items-center justify-center cursor-pointer"
                >
                  <ArrowDownLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                </div>
              </button>

              {/* Profile Avatar Button */}
              <button
                id="nav-profile-btn"
                onClick={() => onNavigate('profile')}
                className={`flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-full border transition-all cursor-pointer ${
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
                <span className="hidden lg:inline text-xs font-semibold max-w-[120px] truncate">
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
