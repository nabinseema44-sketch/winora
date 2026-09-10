/**
 * WINORA Web Application Entry Component
 * Incorporating 00-99 Multi-Number Game Matrix, Dual Wallet Structure,
 * 15-Minute Bidding Cutoff, Handshake Verification, and Master 00-99 Risk Engine.
 */

import React, { useState, useEffect } from 'react';
import { DisclaimerBanner } from './components/DisclaimerBanner.tsx';
import { Navbar } from './components/Navbar.tsx';
import { BottomNav } from './components/BottomNav.tsx';
import { GamePreviewModal } from './components/GamePreviewModal.tsx';
import { DualConfirmationHandshakeModal } from './components/DualConfirmationHandshakeModal.tsx';
import { SqlSchemaModal } from './components/SqlSchemaModal.tsx';
import { Logo } from './components/Logo.tsx';

import { HomePage } from './pages/HomePage.tsx';
import { GamesPage } from './pages/GamesPage.tsx';
import { WalletPage } from './pages/WalletPage.tsx';
import { DepositPage } from './pages/DepositPage.tsx';
import { ProfilePage } from './pages/ProfilePage.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { RegisterPage } from './pages/RegisterPage.tsx';
import { HistoryPage } from './pages/HistoryPage.tsx';
import { AgentPortalPage } from './pages/AgentPortalPage.tsx';
import { MasterPortalPage } from './pages/MasterPortalPage.tsx';

import { DEFAULT_PLAYER_AVATAR, MOCK_GAMES, INITIAL_LEDGER } from './data/mockData.ts';
import { GameItem, NavPage, UserProfile, WalletTransaction, CurrencyConfig, DEFAULT_CURRENCY } from './types.ts';
import { CheckCircle2, Shield, Heart } from 'lucide-react';
import { onAuthChange, logoutUser } from './firebase/authService.ts';
import { getUserProfile, createUserProfile } from './firebase/firestoreService.ts';
import { winoraEngine } from './services/winoraEngine.ts';

export default function App() {
  const [currentPage, setCurrentPage] = useState<NavPage>('games');
  const [user, setUser] = useState<UserProfile>(winoraEngine.getCurrentUser());
  const [authLoading, setAuthLoading] = useState(false);
  const [games] = useState<GameItem[]>(MOCK_GAMES);
  const [ledger, setLedger] = useState<WalletTransaction[]>(INITIAL_LEDGER);
  const [selectedGame, setSelectedGame] = useState<GameItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals
  const [showHandshakeModal, setShowHandshakeModal] = useState(false);
  const [handshakeInitialMode, setHandshakeInitialMode] = useState<'deposit' | 'withdrawal'>('deposit');
  const [showSqlModal, setShowSqlModal] = useState(false);

  // Sync state with winoraEngine
  useEffect(() => {
    const unsub = winoraEngine.subscribe(() => {
      setUser({ ...winoraEngine.getCurrentUser() });
    });
    return () => unsub();
  }, []);

  // Firebase auth sync
  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const profile = await getUserProfile(firebaseUser.uid);
          const verifiedPhone = firebaseUser.phoneNumber || profile?.phoneNumber || '';
          const defaultName = verifiedPhone.length >= 4 
            ? `Player ••${verifiedPhone.slice(-4)}` 
            : 'WINORA Player';

          if (profile) {
            setUser((prev) => ({
              ...prev,
              id: profile.uid,
              displayName: profile.displayName || firebaseUser.displayName || defaultName,
              phoneNumber: profile.phoneNumber || verifiedPhone,
              avatar: profile.avatar || DEFAULT_PLAYER_AVATAR,
              tier: profile.tier || 'Bronze',
              role: profile.role || 'player',
              status: profile.status || 'active',
            }));
          }
        } catch (err) {
          console.error('[WINORA] Firestore profile fetch error:', err);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const handleNavigate = (page: NavPage) => {
    if (page === 'deposit') {
      setHandshakeInitialMode('deposit');
      setShowHandshakeModal(true);
      return;
    }
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDepositInitiated = (newTx: WalletTransaction) => {
    setLedger([newTx, ...ledger]);
    showToast(`Deposit request logged. Dual-confirmation required by assigned agent.`);
  };

  const handleWithdrawalRequested = (newTx: WalletTransaction) => {
    setLedger([newTx, ...ledger]);
    showToast(`Withdrawal request submitted. Held for agent handshake.`);
  };

  const handleCurrencyChange = (newCurrency: CurrencyConfig) => {
    setUser((prev) => ({ ...prev, currency: newCurrency }));
    showToast(`Currency changed to ${newCurrency.name}`);
  };

  const handleBalanceUpdate = (newBalance: number) => {
    setUser((prev) => ({ ...prev, mainBalance: newBalance, walletBalance: newBalance }));
  };

  const handleLoginSuccess = (displayName: string, phoneNumber: string = '+91 98765 43210') => {
    setUser((prev) => ({
      ...prev,
      displayName,
      phoneNumber,
    }));
    setCurrentPage('games');
    showToast(`Welcome back, ${displayName}!`);
  };

  const handleRegisterSuccess = (displayName: string, phoneNumber: string, avatar: string) => {
    setUser({ ...winoraEngine.getCurrentUser() });
    setCurrentPage('games');
    showToast(`Welcome to WINORA, ${displayName}! 50/50 Referral rule active on 1st deposit.`);
  };

  const handleUpdateProfile = (updatedData: { displayName: string; avatar?: string }) => {
    setUser((prev) => ({
      ...prev,
      ...updatedData,
    }));
    showToast('Profile updated successfully!');
  };

  const handleLogout = async () => {
    await logoutUser();
    winoraEngine.switchUserRole('player');
    setUser({ ...winoraEngine.getCurrentUser() });
    setCurrentPage('login');
    showToast('Signed out of WINORA session.');
  };

  const handleRoleSwitch = (newRole: 'player' | 'agent' | 'master') => {
    winoraEngine.switchUserRole(newRole);
    setUser({ ...winoraEngine.getCurrentUser() });
    if (newRole === 'master') {
      setCurrentPage('master');
    } else if (newRole === 'agent') {
      setCurrentPage('agent');
    } else {
      setCurrentPage('games');
    }
    showToast(`Switched active persona to ${newRole.toUpperCase()}`);
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
        onOpenDeposit={() => {
          setHandshakeInitialMode('deposit');
          setShowHandshakeModal(true);
        }}
        onRoleSwitch={handleRoleSwitch}
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
              <span>Connecting to WINORA Game Servers...</span>
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
                user={user}
                onToast={showToast}
              />
            )}

            {currentPage === 'history' && (
              <HistoryPage
                user={user}
              />
            )}

            {currentPage === 'agent' && (
              <AgentPortalPage
                currentAgent={user}
                onToast={showToast}
              />
            )}

            {currentPage === 'master' && (
              <MasterPortalPage
                onToast={showToast}
                onOpenSqlModal={() => setShowSqlModal(true)}
              />
            )}

            {currentPage === 'deposit' && (
              <DepositPage
                user={user}
                transactions={ledger}
                onNavigate={handleNavigate}
                onBalanceUpdate={handleBalanceUpdate}
              />
            )}

            {currentPage === 'wallet' && (
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
            )}

            {currentPage === 'profile' && (
              <ProfilePage
                user={user}
                onLogout={handleLogout}
                onNavigate={handleNavigate}
                onUpdateProfile={handleUpdateProfile}
              />
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
              WINORA System • 90× Payout Games & 80% Green Protection Engine
            </span>
          </div>

          <div className="flex items-center gap-2 text-zinc-400 text-[11px]">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>Dual-Confirmation Handshake • 15-Minute Cutoff Enforced • Dual Wallet Isolation</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSqlModal(true)}
              className="text-[11px] text-zinc-400 hover:text-amber-400 underline cursor-pointer"
            >
              Supabase SQL Schema
            </button>
          </div>
        </div>
      </footer>

      {/* Mobile-First Bottom Navigation Bar */}
      <BottomNav
        currentPage={currentPage}
        onNavigate={handleNavigate}
      />

      {/* Game Preview Modal */}
      <GamePreviewModal
        game={selectedGame}
        onClose={() => setSelectedGame(null)}
      />

      {/* Dual Confirmation Handshake Modal */}
      {showHandshakeModal && (
        <DualConfirmationHandshakeModal
          user={user}
          initialMode={handshakeInitialMode}
          onClose={() => setShowHandshakeModal(false)}
          onSuccessToast={showToast}
        />
      )}

      {/* Supabase SQL Schema Modal */}
      {showSqlModal && (
        <SqlSchemaModal
          onClose={() => setShowSqlModal(false)}
          onToast={showToast}
        />
      )}
    </div>
  );
}
