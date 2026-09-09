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
import { ProfilePage } from './pages/ProfilePage.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { RegisterPage } from './pages/RegisterPage.tsx';

import { DEFAULT_PLAYER_AVATAR, MOCK_GAMES, INITIAL_LEDGER } from './data/mockData.ts';
import { GameItem, NavPage, UserProfile, VirtualLedgerEntry } from './types.ts';
import { CheckCircle2, Shield, Heart } from 'lucide-react';
import { onAuthChange, logoutUser } from './firebase/authService.ts';
import { getUserProfile, createUserProfile } from './firebase/firestoreService.ts';

export default function App() {
  const [currentPage, setCurrentPage] = useState<NavPage>('home');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [games] = useState<GameItem[]>(MOCK_GAMES);
  const [ledger, setLedger] = useState<VirtualLedgerEntry[]>(INITIAL_LEDGER);
  const [selectedGame, setSelectedGame] = useState<GameItem | null>(null);
  const [dailyRewardClaimed, setDailyRewardClaimed] = useState(false);
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
              virtualCredits: 1000,
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
                virtualCredits: 1000,
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
      showToast(`Please sign in to access your ${page === 'wallet' ? 'Virtual Wallet' : 'Profile'}.`);
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

  const handleClaimDailyReward = () => {
    if (dailyRewardClaimed || !user) return;

    const rewardAmount = 500;
    const newBalance = user.virtualCredits + rewardAmount;

    setUser({
      ...user,
      virtualCredits: newBalance,
    });

    const newLedgerEntry: VirtualLedgerEntry = {
      id: `tx-${Date.now()}`,
      timestamp: 'Just now',
      type: 'daily_reward',
      description: 'Daily Virtual Credit Allowance',
      amount: rewardAmount,
      balanceAfter: newBalance,
    };

    setLedger([newLedgerEntry, ...ledger]);
    setDailyRewardClaimed(true);
    showToast(`+${rewardAmount} Free Virtual Credits added to your balance!`);
  };

  const handleLoginSuccess = (displayName: string) => {
    setCurrentPage('home');
    showToast(`Welcome back, ${displayName}!`);
  };

  const handleRegisterSuccess = (displayName: string) => {
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
        onQuickRefill={handleClaimDailyReward}
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
                onClaimDailyReward={handleClaimDailyReward}
                dailyRewardClaimed={dailyRewardClaimed}
              />
            )}

            {currentPage === 'games' && (
              <GamesPage
                games={games}
                onSelectGame={(game) => setSelectedGame(game)}
              />
            )}

            {currentPage === 'wallet' && (
              user ? (
                <WalletPage
                  user={user}
                  ledger={ledger}
                  onClaimDailyReward={handleClaimDailyReward}
                  dailyRewardClaimed={dailyRewardClaimed}
                  onNavigate={handleNavigate}
                />
              ) : (
                <LoginPage
                  onLoginSuccess={handleLoginSuccess}
                  onNavigate={handleNavigate}
                  redirectNotice="Sign in with your mobile number to view your virtual wallet balance."
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
            <span>Virtual Credits hold zero cash redemption value. Strict entertainment simulation.</span>
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
        userBalance={user ? user.virtualCredits : 0}
      />
    </div>
  );
}
