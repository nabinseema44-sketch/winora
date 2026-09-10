/**
 * WINORA Web Application Entry Component
 * 00–99 game matrix, 15-minute bidding cutoff, server-authoritative settlement,
 * Firebase Phone OTP authentication, and a single virtual Main Wallet.
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
import { ProfilePage } from './pages/ProfilePage.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { RegisterPage } from './pages/RegisterPage.tsx';
import { HistoryPage } from './pages/HistoryPage.tsx';
import { AgentPortalPage } from './pages/AgentPortalPage.tsx';
import { MasterPortalPage } from './pages/MasterPortalPage.tsx';
import { DEFAULT_PLAYER_AVATAR, MOCK_GAMES, INITIAL_LEDGER } from './data/mockData.ts';
import { GameItem, NavPage, UserProfile, WalletTransaction } from './types.ts';
import { CheckCircle2, Shield } from 'lucide-react';
import { onAuthChange, logoutUser } from './firebase/authService.ts';
import { getUserProfile } from './firebase/firestoreService.ts';
import { winoraEngine } from './services/winoraEngine.ts';

export default function App() {
  const [currentPage, setCurrentPage] = useState<NavPage>('login');
  const [user, setUser] = useState<UserProfile>(winoraEngine.getCurrentUser());
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [games] = useState<GameItem[]>(MOCK_GAMES);
  const [ledger, setLedger] = useState<WalletTransaction[]>(INITIAL_LEDGER);
  const [selectedGame, setSelectedGame] = useState<GameItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showHandshakeModal, setShowHandshakeModal] = useState(false);
  const [showSqlModal, setShowSqlModal] = useState(false);

  useEffect(() => {
    const unsub = winoraEngine.subscribe(() => setUser({ ...winoraEngine.getCurrentUser() }));
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      if (!firebaseUser) {
        setIsAuthenticated(false);
        setCurrentPage('login');
        setAuthLoading(false);
        return;
      }

      try {
        const profile = await getUserProfile(firebaseUser.uid);
        const verifiedPhone = firebaseUser.phoneNumber || profile?.phoneNumber || '';
        const defaultName = verifiedPhone.length >= 4 ? `Player ••${verifiedPhone.slice(-4)}` : 'WINORA Player';
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
        setIsAuthenticated(true);
        setCurrentPage((page) => page === 'login' || page === 'register' ? 'games' : page);
      } catch (err) {
        console.error('[WINORA] Firestore profile fetch error:', err);
        setIsAuthenticated(true);
        setCurrentPage('games');
      } finally {
        setAuthLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => setToastMessage(null), 3500);
  };

  const handleNavigate = (page: NavPage) => {
    const protectedPages: NavPage[] = ['home', 'games', 'history', 'wallet', 'profile', 'agent', 'master'];
    if (!isAuthenticated && protectedPages.includes(page)) {
      setCurrentPage('login');
      return;
    }
    if (page === 'deposit') {
      showToast('Deposits are disabled. WINORA uses virtual/demo credits only.');
      return;
    }
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDepositInitiated = (newTx: WalletTransaction) => setLedger((prev) => [newTx, ...prev]);
  const handleWithdrawalRequested = (newTx: WalletTransaction) => setLedger((prev) => [newTx, ...prev]);

  const handleBalanceUpdate = (newBalance: number) => {
    setUser((prev) => ({ ...prev, mainBalance: newBalance, walletBalance: newBalance }));
  };

  const handleLoginSuccess = (displayName: string, phoneNumber = '') => {
    setUser((prev) => ({ ...prev, displayName, phoneNumber }));
    setIsAuthenticated(true);
    setCurrentPage('games');
    showToast(`Welcome back, ${displayName}!`);
  };

  const handleRegisterSuccess = (displayName: string) => {
    setUser((prev) => ({ ...prev, displayName }));
    setIsAuthenticated(true);
    setCurrentPage('games');
    showToast(`Welcome to WINORA, ${displayName}!`);
  };

  const handleUpdateProfile = (updatedData: { displayName: string; avatar?: string }) => {
    setUser((prev) => ({ ...prev, ...updatedData }));
    showToast('Profile updated successfully!');
  };

  const handleLogout = async () => {
    const result = await logoutUser();
    if (!result.success) {
      showToast(result.error || 'Unable to sign out.');
      return;
    }
    setIsAuthenticated(false);
    setCurrentPage('login');
    setSelectedGame(null);
    showToast('Signed out of WINORA.');
  };

  const handleRoleSwitch = (newRole: 'player' | 'agent' | 'master') => {
    if (!isAuthenticated) return;
    winoraEngine.switchUserRole(newRole);
    setUser({ ...winoraEngine.getCurrentUser() });
    setCurrentPage(newRole === 'master' ? 'master' : newRole === 'agent' ? 'agent' : 'games');
    showToast(`Switched active persona to ${newRole.toUpperCase()}`);
  };

  const visibleUser = isAuthenticated ? user : null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-amber-500 selection:text-black">
      <DisclaimerBanner />
      <Navbar currentPage={currentPage} onNavigate={handleNavigate} user={visibleUser} onRoleSwitch={handleRoleSwitch} />

      {toastMessage && (
        <div className="fixed top-20 right-4 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="bg-zinc-900 border border-amber-500/50 text-zinc-100 px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs sm:text-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-medium">{toastMessage}</span>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-12">
        {authLoading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4"><Logo size="md" /><div className="text-xs text-zinc-400">Connecting to WINORA Authentication...</div></div>
        ) : (
          <>
            {currentPage === 'home' && <HomePage games={games} user={user} onNavigate={handleNavigate} onSelectGame={setSelectedGame} />}
            {currentPage === 'games' && <GamesPage user={user} onToast={showToast} />}
            {currentPage === 'history' && <HistoryPage user={user} />}
            {currentPage === 'agent' && <AgentPortalPage currentAgent={user} onToast={showToast} />}
            {currentPage === 'master' && <MasterPortalPage onToast={showToast} onOpenSqlModal={() => setShowSqlModal(true)} />}
            {currentPage === 'wallet' && <WalletPage user={user} transactions={ledger} ledger={ledger} onDepositInitiated={handleDepositInitiated} onWithdrawalRequested={handleWithdrawalRequested} onBalanceUpdate={handleBalanceUpdate} onNavigate={handleNavigate} />}
            {currentPage === 'profile' && <ProfilePage user={user} onLogout={handleLogout} onNavigate={handleNavigate} onUpdateProfile={handleUpdateProfile} />}
            {currentPage === 'login' && <LoginPage onLoginSuccess={handleLoginSuccess} onNavigate={handleNavigate} />}
            {currentPage === 'register' && <RegisterPage onRegisterSuccess={handleRegisterSuccess} onNavigate={handleNavigate} />}
          </>
        )}
      </main>

      <footer className="border-t border-zinc-800/80 bg-zinc-950 py-8 px-4 text-xs text-zinc-400 mb-14 md:mb-0">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
          <div className="flex items-center gap-3"><Logo size="sm" /><span className="text-[11px] text-zinc-400">WINORA System • Virtual Credits • 90× Number Reward • 80% Hourly Color Protection</span></div>
          <div className="flex items-center gap-2 text-zinc-400 text-[11px]"><Shield className="w-3.5 h-3.5 text-emerald-400" /><span>Server Settlement • 15-Minute Cutoff • Single Main Wallet</span></div>
          <button onClick={() => setShowSqlModal(true)} className="text-[11px] text-zinc-400 hover:text-amber-400 underline cursor-pointer">Supabase SQL Schema</button>
        </div>
      </footer>

      <BottomNav currentPage={currentPage} onNavigate={handleNavigate} />
      <GamePreviewModal game={selectedGame} onClose={() => setSelectedGame(null)} />
      {showHandshakeModal && <DualConfirmationHandshakeModal user={user} initialMode="deposit" onClose={() => setShowHandshakeModal(false)} onSuccessToast={showToast} />}
      {showSqlModal && <SqlSchemaModal onClose={() => setShowSqlModal(false)} onToast={showToast} />}
    </div>
  );
}
