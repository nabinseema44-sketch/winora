import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar.tsx';
import { BottomNav } from './components/BottomNav.tsx';
import { GamePreviewModal } from './components/GamePreviewModal.tsx';
import { SqlSchemaModal } from './components/SqlSchemaModal.tsx';
import { Logo } from './components/Logo.tsx';
import { CoinWalletPanel } from './components/CoinWalletPanel.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { GamesPage } from './pages/GamesPage.tsx';
import { ProfilePage } from './pages/ProfilePage.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { RegisterPage } from './pages/RegisterPage.tsx';
import { HistoryPage } from './pages/HistoryPage.tsx';
import { AgentPortalPage } from './pages/AgentPortalPage.tsx';
import { MasterPortalPage } from './pages/MasterPortalPage.tsx';
import { GameItem, NavPage, UserProfile, WinoraGameConfig } from './types.ts';
import { CheckCircle2, Shield } from 'lucide-react';
import { onAuthChange, logoutUser } from './firebase/authService.ts';
import { getUserProfile } from './firebase/firestoreService.ts';
import { gameEntryApi } from './services/gameEntryApi.ts';
import { GameBoardModal } from './components/GameBoardModal.tsx';

const EMPTY_USER: UserProfile = {
  id: '',
  displayName: 'WINORA Player',
  phoneNumber: '',
  withdrawableBalancePaise: 0,
  bonusBalancePaise: 0,
  walletBalance: 0,
  mainBalance: 0,
  currency: { code: 'COIN', symbol: '', name: 'Virtual Coins' },
  tier: 'Bronze',
  joinedDate: '',
  level: 1,
  role: 'player',
  status: 'active',
  stats: {
    gamesPlayed: 0,
    highestVirtualWin: 0,
    favoriteCategory: 'Hourly Play',
    winRate: '0%',
  },
};

function mapBackendGame(game: any): GameItem {
  return {
    id: String(game.id),
    title: String(game.name || 'WINORA Game'),
    category: 'arcade',
    icon: game.id === 'hourly_play' ? 'Clock' : 'Grid',
    accentColor: String(game.accentColor || 'from-zinc-800 to-zinc-900 text-zinc-200 border-zinc-700'),
    description: String(game.description || game.subtitle || 'Server-authoritative virtual coin game.'),
    minVirtualBet: 1,
    maxVirtualBet: 0,
    playersOnline: 0,
    isHot: game.id === 'hourly_play',
    status: 'active',
  };
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<NavPage>('home');
  const [user, setUser] = useState<UserProfile>(EMPTY_USER);
  const [games, setGames] = useState<GameItem[]>([]);
  const [backendGames, setBackendGames] = useState<WinoraGameConfig[]>([]);
  const [selectedGame, setSelectedGame] = useState<GameItem | null>(null);
  const [activeBiddingGame, setActiveBiddingGame] = useState<WinoraGameConfig | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showSqlModal, setShowSqlModal] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadGames = async () => {
      const config = await gameEntryApi.fetchGamesConfig();
      if (!mounted || !config?.games) return;
      const serverGames = config.games as WinoraGameConfig[];
      setBackendGames(serverGames);
      setGames(serverGames.map(mapBackendGame));
    };
    loadGames();
    const interval = setInterval(loadGames, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(EMPTY_USER);
        return;
      }
      try {
        const profile = await getUserProfile(firebaseUser.uid);
        const verifiedPhone = firebaseUser.phoneNumber || profile?.phoneNumber || '';
        const defaultName = verifiedPhone.length >= 4 ? `Player ••${verifiedPhone.slice(-4)}` : 'WINORA Player';
        setUser((prev) => ({
          ...prev,
          id: firebaseUser.uid,
          displayName: profile?.displayName || firebaseUser.displayName || defaultName,
          phoneNumber: profile?.phoneNumber || verifiedPhone,
          tier: profile?.tier || 'Bronze',
          role: profile?.role === 'agent' || profile?.role === 'master' ? profile.role : 'player',
          status: profile?.status || 'active',
          pincode: profile?.pincode,
          assignedAgentId: profile?.assignedAgentId,
          referralCode: profile?.referralCode,
          referredByUserId: profile?.referredByUserId,
        }));
      } catch (err) {
        console.error('[WINORA] Firestore profile fetch error:', err);
      }
    });
    return () => unsubscribe();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleNavigate = (page: NavPage) => {
    if (page === 'deposit') {
      setCurrentPage('wallet');
      return;
    }
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogout = async () => {
    await logoutUser();
    setUser(EMPTY_USER);
    setCurrentPage('login');
    showToast('Signed out of WINORA session.');
  };

  const handleRoleSwitch = (_newRole: 'player' | 'agent' | 'master') => {
    showToast('Workspace access is controlled by your verified Firebase role.');
  };

  const handleUpdateProfile = (updatedData: { displayName: string }) => {
    setUser((prev) => ({ ...prev, ...updatedData }));
    showToast('Profile updated successfully!');
  };

  const openBackendGame = (gameId: string) => {
    const game = backendGames.find((item) => item.id === gameId);
    if (game) setActiveBiddingGame(game);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-amber-500 selection:text-black">
      <Navbar
        currentPage={currentPage}
        onNavigate={handleNavigate}
        user={user}
        onOpenDeposit={() => setCurrentPage('wallet')}
        onRoleSwitch={handleRoleSwitch}
      />

      {toastMessage && (
        <div className="fixed top-14 sm:top-16 inset-x-3 sm:inset-x-auto sm:right-4 z-50 animate-in fade-in slide-in-from-top-3 duration-200 pointer-events-none flex justify-center">
          <div className="bg-zinc-900/95 backdrop-blur-md border border-amber-500/60 text-zinc-100 px-3.5 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs sm:text-sm font-semibold max-w-sm w-full">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate">{toastMessage}</span>
          </div>
        </div>
      )}

      <main className="flex-1 w-full max-w-md mx-auto px-2.5 sm:px-3.5 py-3 sm:py-4 pb-24 sm:pb-28">
        {currentPage === 'home' && (
          <HomePage
            games={games}
            user={user}
            onNavigate={handleNavigate}
            onSelectGame={(game) => setSelectedGame(game)}
            onOpenWinoraGame={(gameConfig) => openBackendGame(gameConfig.id)}
          />
        )}
        {currentPage === 'games' && <GamesPage user={user} onToast={showToast} />}
        {currentPage === 'history' && <HistoryPage user={user} />}
        {currentPage === 'agent' && <AgentPortalPage currentAgent={user} onToast={showToast} />}
        {currentPage === 'master' && <MasterPortalPage onToast={showToast} onOpenSqlModal={() => setShowSqlModal(true)} />}
        {currentPage === 'wallet' && <CoinWalletPanel user={user} onToast={showToast} />}
        {currentPage === 'deposit' && <CoinWalletPanel user={user} onToast={showToast} />}
        {currentPage === 'profile' && <ProfilePage user={user} onLogout={handleLogout} onNavigate={handleNavigate} onUpdateProfile={handleUpdateProfile} />}
        {currentPage === 'login' && <LoginPage onLoginSuccess={(name, phone) => { setUser((prev) => ({ ...prev, displayName: name, phoneNumber: phone })); setCurrentPage('games'); showToast(`Welcome back, ${name}!`); }} onNavigate={handleNavigate} />}
        {currentPage === 'register' && <RegisterPage onRegisterSuccess={() => { setCurrentPage('games'); showToast('Welcome to WINORA!'); }} onNavigate={handleNavigate} />}
      </main>

      <footer className="border-t border-zinc-900 bg-zinc-950 py-4 px-3 text-[11px] text-zinc-500 mb-16 select-none">
        <div className="max-w-md mx-auto flex flex-col items-center justify-center gap-2 text-center">
          <div className="flex items-center gap-2"><Logo size="sm" /><span className="text-[10px] text-zinc-500">Virtual Coins • Server Game Matrix</span></div>
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-400"><Shield className="w-3 h-3 text-emerald-400" /><span>Firebase Auth • Server-Authoritative Ledger • IST Schedule</span></div>
          <button onClick={() => setShowSqlModal(true)} className="text-[10px] text-zinc-500 hover:text-amber-400 underline cursor-pointer py-1">View Database Schema</button>
        </div>
      </footer>

      <BottomNav currentPage={currentPage} onNavigate={handleNavigate} user={user} />
      <GamePreviewModal game={selectedGame} onClose={() => setSelectedGame(null)} />
      {activeBiddingGame && user.id && (
        <GameBoardModal
          game={activeBiddingGame}
          initialRound={{
            id: `backend-${activeBiddingGame.id}`,
            gameId: activeBiddingGame.id,
            gameName: activeBiddingGame.name,
            roundNumber: 0,
            openTime: new Date().toISOString(),
            freezeTime: new Date().toISOString(),
            declareTime: new Date().toISOString(),
            status: 'open',
            totalBidsPool: 0,
          }}
          user={user}
          onClose={() => setActiveBiddingGame(null)}
          onSuccessToast={showToast}
        />
      )}
      {showSqlModal && <SqlSchemaModal onClose={() => setShowSqlModal(false)} onToast={showToast} />}
    </div>
  );
}
