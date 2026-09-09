/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { DisclaimerBanner } from './components/DisclaimerBanner.tsx';
import { Navbar } from './components/Navbar.tsx';
import { BottomNav } from './components/BottomNav.tsx';
import { GamePreviewModal } from './components/GamePreviewModal.tsx';
import { Logo } from './components/Logo.tsx';

import { HomePage } from './pages/HomePage.tsx';
import { GamesPage } from './pages/GamesPage.tsx';
import { WalletPage } from './pages/WalletPage.tsx';
import { DepositPage } from './pages/DepositPage.tsx';
import { ProfilePage } from './pages/ProfilePage.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { RegisterPage } from './pages/RegisterPage.tsx';

import { DEFAULT_PLAYER_AVATAR, MOCK_GAMES, INITIAL_LEDGER } from './data/mockData.ts';
import { GameItem, NavPage, UserProfile, WalletTransaction, CurrencyConfig, DEFAULT_CURRENCY } from './types.ts';
import { CheckCircle2, Shield, Heart } from 'lucide-react';
import { onAuthChange, logoutUser } from './firebase/authService.ts';
import { getUserProfile, createUserProfile } from './firebase/firestoreService.ts';

export default function App() {
  const [currentPage, setCurrentPage] = useState<NavPage>('home');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [games] = useState<GameItem[]>(MOCK_GAMES);
  const [ledger, setLedger] = useState<WalletTransaction[]>(INITIAL_LEDGER);
  const [selectedGame, setSelectedGame] = useState<GameItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Synchronize authenticated Firebase user session
  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        // Attempt to fetch profile document from Cloud Firestore: users/{uid}
        try {
          const profile = await getUserProfile(firebaseUser.uid);
          const verifiedPhone = firebaseUser.phoneNumber || profile?.phoneNumber || '';
          const defaultName = verifiedPhone.length >= 4 
            ? `Player ••${verifiedPhone.slice(-4)}` 
            : 'WINORA Player';

          if (profile) {
            setUser({
              id: profile.uid,
              displayName: profile.displayName || firebaseUser.displayName || defaultName,
              phoneNumber: profile.phoneNumber || verifiedPhone,
              avatar: profile.avatar || DEFAULT_PLAYER_AVATAR,
              walletBalance: 2500,
              currency: DEFAULT_CURRENCY,
              tier: profile.tier || 'Bronze',
              joinedDate: profile.createdAt 
                ? new Date(profile.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) 
                : 'Active',
              level: profile.level || 1,
              role: profile.role || 'player',
              status: profile.status || 'active',
              stats: {
                gamesPlayed: 0,
                highestVirtualWin: 0,
                favoriteCategory: 'Crash Games',
                winRate: '0%',
              },
            });
          } else {
            // Missing user document safe recovery: automatically provision in Firestore users/{uid}
            const fallbackName = firebaseUser.displayName || defaultName;
            await createUserProfile(firebaseUser.uid, {
              phoneNumber: verifiedPhone,
              displayName: fallbackName,
              avatar: DEFAULT_PLAYER_AVATAR,
            });
            const fresh = await getUserProfile(firebaseUser.uid);
            if (fresh) {
              setUser({
                id: fresh.uid,
                displayName: fresh.displayName || fallbackName,
                phoneNumber: fresh.phoneNumber || verifiedPhone,
                avatar: fresh.avatar || DEFAULT_PLAYER_AVATAR,
                walletBalance: 2500,
                currency: DEFAULT_CURRENCY,
                tier: fresh.tier || 'Bronze',
                joinedDate: fresh.createdAt 
                  ? new Date(fresh.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) 
                  : 'Active',
                level: fresh.level || 1,
                role: fresh.role || 'player',
                status: fresh.status || 'active',
                stats: {
                  gamesPlayed: 0,
                  highestVirtualWin: 0,
                  favoriteCategory: 'Crash Games',
                  winRate: '0%',
                },
              });
            }
          }
        } catch (err) {
          console.error('[WINORA] Failed to load Firestore profile on auth state change:', err);
        }
      } else {
        setUser(null);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Authentication protection: route unauthenticated users away from protected pages
  useEffect(() => {
    if (!authLoading && !user && (currentPage === 'profile' || currentPage === 'wallet')) {
      setCurrentPage('login');
    }
  }, [authLoading, user, currentPage]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const handleNavigate = (page: NavPage) => {
    // Prevent unauthenticated users from accessing authenticated pages (wallet, profile)
    if (!user && (page === 'wallet' || page === 'profile')) {
      showToast(`Please sign in to access your ${page === 'wallet' ? 'Account Wallet' : 'Profile'}.`);
      setCurrentPage('login');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    // Prevent authenticated users from visiting login or register
    if (user && (page === 'login' || page === 'register')) {
      setCurrentPage('home');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDepositInitiated = (newTx: WalletTransaction) => {
    // Audit record appended to ledger
    setLedger([newTx, ...ledger]);
    // Security Mandate: The client must NOT directly modify the money balance.
    // In production, balance updates are performed strictly by trusted backend/payment-provider
    // webhook callbacks after verified settlement.
    showToast(`Deposit order logged (${newTx.referenceId}). Balance credits upon gateway settlement.`);
  };

  const handleWithdrawalRequested = (newTx: WalletTransaction) => {
    // Payout request logged in ledger
    setLedger([newTx, ...ledger]);
    // Security Mandate: Direct bank/UPI transfers are queued for backend verification.
    showToast(`Withdrawal request submitted (${newTx.referenceId}). Queued for verification.`);
  };

  const handleCurrencyChange = (newCurrency: CurrencyConfig) => {
    if (user) {
      setUser({
        ...user,
        currency: newCurrency,
      });
      showToast(`Wallet currency changed to ${newCurrency.name}`);
    }
  };

  const handleBalanceUpdate = (newBalance: number) => {
    setUser((prev) => {
      if (!prev || prev.walletBalance === newBalance) return prev;
      return { ...prev, walletBalance: newBalance };
    });
  };

  const handleLoginSuccess = (displayName: string, phoneNumber: string = '+91 98765 43210') => {
    if (!user) {
      setUser({
        id: `user-${Date.now().toString().slice(-6)}`,
        displayName: displayName || 'WINORA Player',
        phoneNumber: phoneNumber,
        walletBalance: 2500,
        currency: DEFAULT_CURRENCY,
        avatar: DEFAULT_PLAYER_AVATAR,
        tier: 'Bronze',
        joinedDate: 'Active',
        level: 1,
        role: 'player',
        status: 'active',
        stats: {
          gamesPlayed: 0,
          highestVirtualWin: 0,
          favoriteCategory: 'Crash Games',
          winRate: '0%',
        },
      });
    }
    setCurrentPage('home');
    showToast(`Welcome back, ${displayName}!`);
  };

  const handleRegisterSuccess = (displayName: string, phoneNumber: string = '+91 98765 43210', avatar: string = DEFAULT_PLAYER_AVATAR) => {
    setUser({
      id: `user-${Date.now().toString().slice(-6)}`,
      displayName: displayName || 'New WINORA Player',
      phoneNumber: phoneNumber,
      walletBalance: 1000,
      currency: DEFAULT_CURRENCY,
      avatar: avatar || DEFAULT_PLAYER_AVATAR,
      tier: 'Bronze',
      joinedDate: 'Just now',
      level: 1,
      role: 'player',
      status: 'active',
      stats: {
        gamesPlayed: 0,
        highestVirtualWin: 0,
        favoriteCategory: 'Arcade',
        winRate: '0%',
      },
    });
    setCurrentPage('home');
    showToast(`Welcome to WINORA, ${displayName}! Virtual Starter Grant activated.`);
  };

  const handleUpdateProfile = (updatedData: { displayName: string; avatar?: string }) => {
    if (!user) return;
    setUser({
      ...user,
      ...updatedData,
    });
    showToast('Profile updated successfully!');
  };

  const handleLogout = async () => {
    await logoutUser();
    setUser(null);
    setCurrentPage('login');
    showToast('Signed out of WINORA session.');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-amber-500 selection:text-black">
      {/* Platform Disclaimer Bar */}
      <DisclaimerBanner />

      {/* Main Top Navigation */}
      <Navbar
        currentPage={currentPage}
        onNavigate={handleNavigate}
        user={user}
        onOpenDeposit={() => handleNavigate('deposit')}
      />

      {/* Floating Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-20 right-4 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="bg-zinc-900 border border-amber-500/50 text-zinc-100 px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs sm:text-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium">{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-12">
        {authLoading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <Logo size="md" />
            <div className="flex items-center gap-2 text-xs text-zinc-400">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>Verifying secure WINORA session...</span>
            </div>
          </div>
        ) : (
          <>
            {currentPage === 'home' && (
              <HomePage
                games={games}
                user={user}
                onNavigate={handleNavigate}
                onSelectGame={(game) => setSelectedGame(game)}
              />
            )}

            {currentPage === 'games' && (
              <GamesPage
                games={games}
                onSelectGame={(game) => setSelectedGame(game)}
              />
            )}

            {currentPage === 'deposit' && (
              user ? (
                <DepositPage
                  user={user}
                  transactions={ledger}
                  onNavigate={handleNavigate}
                  onBalanceUpdate={handleBalanceUpdate}
                />
              ) : (
                <LoginPage
                  onLoginSuccess={handleLoginSuccess}
                  onNavigate={handleNavigate}
                  redirectNotice="Sign in with your mobile number to access deposit and wallet services."
                />
              )
            )}

            {currentPage === 'wallet' && (
              user ? (
                <WalletPage
                  user={user}
                  transactions={ledger}
                  ledger={ledger}
                  onDepositInitiated={handleDepositInitiated}
                  onWithdrawalRequested={handleWithdrawalRequested}
                  onCurrencyChange={handleCurrencyChange}
                  onBalanceUpdate={handleBalanceUpdate}
                  onNavigate={handleNavigate}
                />
              ) : (
                <LoginPage
                  onLoginSuccess={handleLoginSuccess}
                  onNavigate={handleNavigate}
                  redirectNotice="Sign in with your mobile number to view your money wallet balance and transactions."
                />
              )
            )}

            {currentPage === 'profile' && (
              user ? (
                <ProfilePage
                  user={user}
                  onLogout={handleLogout}
                  onNavigate={handleNavigate}
                  onUpdateProfile={handleUpdateProfile}
                />
              ) : (
                <LoginPage
                  onLoginSuccess={handleLoginSuccess}
                  onNavigate={handleNavigate}
                  redirectNotice="Sign in with your mobile number to view your Profile & Account Settings."
                />
              )
            )}

            {currentPage === 'login' && (
              <LoginPage
                onLoginSuccess={handleLoginSuccess}
                onNavigate={handleNavigate}
              />
            )}

            {currentPage === 'register' && (
              <RegisterPage
                onRegisterSuccess={handleRegisterSuccess}
                onNavigate={handleNavigate}
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/80 bg-zinc-950 py-8 px-4 text-xs text-zinc-400 mb-14 md:mb-0">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <span className="text-[11px] text-zinc-400">
              Foundation Version 1.0 • Mobile-First Virtual Gaming
            </span>
          </div>

          <div className="flex items-center gap-2 text-zinc-400 text-[11px]">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>Isolated Account Money Wallet • Licensed Payment Gateways • Games for Entertainment</span>
          </div>

          <div className="text-[11px] text-zinc-400 flex items-center justify-center gap-1">
            <span>Built with precision for</span>
            <span className="text-zinc-300 font-semibold">WINORA Players</span>
          </div>
        </div>
      </footer>

      {/* Mobile-First Bottom Navigation Bar */}
      <BottomNav
        currentPage={currentPage}
        onNavigate={handleNavigate}
      />

      {/* Game Preview Modal (Foundation state with notice) */}
      <GamePreviewModal
        game={selectedGame}
        onClose={() => setSelectedGame(null)}
      />
    </div>
  );
}
