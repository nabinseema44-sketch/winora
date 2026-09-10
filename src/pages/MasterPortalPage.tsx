import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Coins,
  Users,
  Briefcase,
  TrendingUp,
  TrendingDown,
  Calculator,
  ArrowRightLeft,
  Search,
  UserX,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  Crown,
  Database,
  ExternalLink,
  Sparkles,
  ChevronDown,
} from 'lucide-react';
import {
  UserProfile,
  WinoraGameId,
  NumberRiskItem,
} from '../types.ts';
import { winoraEngine, WINORA_GAMES } from '../services/winoraEngine.ts';

interface MasterPortalPageProps {
  onToast: (msg: string) => void;
  onOpenSqlModal: () => void;
}

export const MasterPortalPage: React.FC<MasterPortalPageProps> = ({
  onToast,
  onOpenSqlModal,
}) => {
  const [selectedGameId, setSelectedGameId] = useState<WinoraGameId>('hourly_dhamaka');
  const [riskData, setRiskData] = useState<{
    items: NumberRiskItem[];
    totalPool: number;
    highestProfitNumber: number;
    highestLossNumber: number;
    maxProfitAmount: number;
    maxLossAmount: number;
  } | null>(null);

  // Financial Workflow State (Master -> Agent transfer)
  const [transferAgentId, setTransferAgentId] = useState('');
  const [transferAmount, setTransferAmount] = useState('10000');
  const [isTransferring, setIsTransferring] = useState(false);

  // User Management State
  const [userSearch, setUserSearch] = useState('');

  // Re-fetch risk whenever game or engine changes
  useEffect(() => {
    const updateRisk = () => {
      const data = winoraEngine.calculate00to99Risk(selectedGameId);
      setRiskData(data);
    };

    updateRisk();
    const unsub = winoraEngine.subscribe(updateRisk);
    return () => unsub();
  }, [selectedGameId]);

  const currentUser = winoraEngine.getCurrentUser();
  const agents = winoraEngine.getAgents();
  const players = winoraEngine.getPlayers();
  const history = winoraEngine.getHistory();

  // Metric computations
  const totalSystemCoins =
    currentUser.mainBalance +
    agents.reduce((sum, a) => sum + a.mainBalance, 0) +
    players.reduce((sum, p) => sum + p.mainBalance + p.bonusBalance, 0);

  const activePlayersCount = players.filter((p) => p.status === 'active').length;
  const activeAgentsCount = agents.filter((a) => a.status === 'active').length;
  const netCollectionsToday = history
    .filter((h) => h.type === 'bid')
    .reduce((sum, h) => sum + h.amount, 0);

  // Declare Winning Number Handler
  const handleDeclareWinner = (num: number) => {
    const confirmDeclare = window.confirm(
      `Confirm declaration of Number #${num.toString().padStart(2, '0')} as WINNER for ${WINORA_GAMES.find((g) => g.id === selectedGameId)?.name}?\nThis will execute 90× payouts to winning bidders and 80% Green Refunds if applicable.`
    );
    if (!confirmDeclare) return;

    const res = winoraEngine.declareWinningNumber(selectedGameId, num);
    onToast(res.message);
  };

  // Master Transfer to Agent Handler
  const handleTransferToAgent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferAgentId) {
      onToast('Please select an agent.');
      return;
    }
    const amt = Number(transferAmount);
    if (amt <= 0) {
      onToast('Enter a valid coin transfer amount.');
      return;
    }

    setIsTransferring(true);
    const res = winoraEngine.masterTransferToAgent(transferAgentId, amt);
    setIsTransferring(false);
    onToast(res.message);
  };

  // User Block/Unblock Handler
  const handleToggleBlock = (userId: string) => {
    const res = winoraEngine.toggleUserBlockStatus(userId);
    if (res.success) {
      onToast(`User status updated to ${res.newStatus.toUpperCase()}`);
    }
  };

  const filteredUsers = [...players, ...agents].filter(
    (u) =>
      u.displayName.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.phoneNumber.includes(userSearch) ||
      u.id.includes(userSearch)
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Master Top Control Bar */}
      <div className="bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 border border-amber-500/40 p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center shadow-inner">
            <Crown className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-500 text-zinc-950">
                Master SuperAdmin
              </span>
              <span className="text-xs text-amber-400 font-bold">WINORA Global Controller</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-zinc-100 font-display mt-0.5">
              Executive Master Dashboard
            </h1>
          </div>
        </div>

        {/* View SQL Schema button */}
        <button
          onClick={onOpenSqlModal}
          className="px-4 py-2 rounded-xl text-xs font-black bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all flex items-center gap-2 cursor-pointer shadow-sm"
        >
          <Database className="w-4 h-4 text-emerald-400" />
          <span>View Supabase SQL Schema (Prompt 1)</span>
        </button>
      </div>

      {/* 1. Summary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total System Coins */}
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl space-y-1">
          <span className="text-[11px] uppercase font-bold text-zinc-400 tracking-wider flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-amber-400" />
            Total System Coins
          </span>
          <p className="text-xl sm:text-2xl font-black text-zinc-100 font-mono">
            ₹{totalSystemCoins.toLocaleString()}
          </p>
          <span className="text-[10px] text-zinc-400">Master + Agents + Players</span>
        </div>

        {/* Total Active Players */}
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl space-y-1">
          <span className="text-[11px] uppercase font-bold text-cyan-400 tracking-wider flex items-center gap-1.5">
            <Users className="w-4 h-4" />
            Active Players
          </span>
          <p className="text-xl sm:text-2xl font-black text-cyan-300 font-mono">
            {activePlayersCount}
          </p>
          <span className="text-[10px] text-zinc-400">Platform capacity ~5,000</span>
        </div>

        {/* Total Active Agents */}
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl space-y-1">
          <span className="text-[11px] uppercase font-bold text-purple-400 tracking-wider flex items-center gap-1.5">
            <Briefcase className="w-4 h-4" />
            Active Agents
          </span>
          <p className="text-xl sm:text-2xl font-black text-purple-300 font-mono">
            {activeAgentsCount}
          </p>
          <span className="text-[10px] text-zinc-400">10% All-time Deposit SLA</span>
        </div>

        {/* Net Daily Collections */}
        <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl space-y-1">
          <span className="text-[11px] uppercase font-bold text-emerald-400 tracking-wider flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4" />
            Active Pool Volume
          </span>
          <p className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
            ₹{netCollectionsToday.toLocaleString()}
          </p>
          <span className="text-[10px] text-zinc-400">Live Bids across matrix</span>
        </div>
      </div>

      {/* 2. LIVE 00–99 RISK & EXPOSURE CALCULATOR */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl space-y-4 p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-black text-zinc-100 font-display">
                Real-Time 00–99 Risk & Exposure Calculator
              </h2>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Live mathematical breakdown of 90× payouts, 80% Green refunds, and Master Net Profit/Loss per number.
            </p>
          </div>

          {/* Game Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400 font-bold">Select Game:</span>
            <select
              value={selectedGameId}
              onChange={(e) => setSelectedGameId(e.target.value as WinoraGameId)}
              className="bg-zinc-950 border border-zinc-700 text-zinc-200 text-xs font-bold rounded-xl px-3 py-2 focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              {WINORA_GAMES.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.hasGreenRefund ? '90× + 80% Green' : '90× Standard'})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Risk Highlights Banner */}
        {riskData && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-zinc-950 p-4 rounded-xl border border-zinc-800 text-xs">
            <div>
              <span className="text-zinc-400 block text-[10px] uppercase font-bold">Total Pool Collections</span>
              <span className="font-mono text-lg font-black text-zinc-100">
                ₹{riskData.totalPool.toLocaleString()}
              </span>
            </div>

            <div>
              <span className="text-emerald-400 block text-[10px] uppercase font-bold">Highest Master Profit</span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-black text-lg text-emerald-400">
                  +₹{riskData.maxProfitAmount.toLocaleString()}
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold text-xs">
                  #{riskData.highestProfitNumber.toString().padStart(2, '0')}
                </span>
              </div>
            </div>

            <div>
              <span className="text-rose-400 block text-[10px] uppercase font-bold">Max Master Exposure</span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-black text-lg text-rose-400">
                  {riskData.maxLossAmount < 0 ? '-' : '+'}₹{Math.abs(riskData.maxLossAmount).toLocaleString()}
                </span>
                <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono font-bold text-xs">
                  #{riskData.highestLossNumber.toString().padStart(2, '0')}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 00-99 Interactive Risk Table */}
        <div className="overflow-x-auto max-h-96 border border-zinc-800 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950 sticky top-0 z-10 text-[11px] uppercase tracking-wider text-zinc-400 border-b border-zinc-800">
              <tr>
                <th className="py-2.5 px-3">No.</th>
                <th className="py-2.5 px-3">Color Badge</th>
                <th className="py-2.5 px-3">Total Bids</th>
                <th className="py-2.5 px-3">90× Payout</th>
                {selectedGameId === 'hourly_dhamaka' && (
                  <th className="py-2.5 px-3">80% Green Refunds</th>
                )}
                <th className="py-2.5 px-3">Master Net P&L</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 font-mono">
              {riskData?.items.map((row) => {
                const isProfitable = row.netMasterPnL >= 0;
                return (
                  <tr
                    key={row.number}
                    className={`hover:bg-zinc-850/60 transition-colors ${
                      row.totalBids > 0 ? 'bg-zinc-900/80 font-bold' : ''
                    }`}
                  >
                    <td className="py-2 px-3">
                      <span className="px-2 py-1 rounded bg-zinc-800 text-zinc-100 font-black">
                        #{row.formattedNumber}
                      </span>
                    </td>

                    <td className="py-2 px-3 font-sans">
                      {selectedGameId === 'hourly_dhamaka' ? (
                        row.isGreen ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            Green (80% Refund)
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30">
                            Red (90× Only)
                          </span>
                        )
                      ) : (
                        <span className="text-zinc-400 text-xs">Standard</span>
                      )}
                    </td>

                    <td className="py-2 px-3 text-zinc-200">
                      ₹{row.totalBids.toLocaleString()}
                      {row.bidCount > 0 && (
                        <span className="text-[10px] text-zinc-400 ml-1.5 font-sans">
                          ({row.bidCount} bid{row.bidCount > 1 ? 's' : ''})
                        </span>
                      )}
                    </td>

                    <td className="py-2 px-3 text-amber-400">
                      ₹{row.payout90x.toLocaleString()}
                    </td>

                    {selectedGameId === 'hourly_dhamaka' && (
                      <td className="py-2 px-3 text-cyan-400">
                        ₹{row.greenRefunds.toLocaleString()}
                      </td>
                    )}

                    <td className="py-2 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-black ${
                          isProfitable
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {row.netMasterPnL >= 0 ? '+' : ''}₹{row.netMasterPnL.toLocaleString()}
                      </span>
                    </td>

                    <td className="py-2 px-3 text-right">
                      <button
                        onClick={() => handleDeclareWinner(row.number)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500 hover:text-zinc-950 transition-all cursor-pointer whitespace-nowrap"
                      >
                        Declare Winner
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Financial Workflow & 4. User Management */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Financial Workflow: Transfer Coins to Agents */}
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl space-y-4">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-black text-zinc-100 font-display">
              Financial Workflow: Transfer Coins to Agent
            </h3>
          </div>
          <p className="text-xs text-zinc-400">
            Allocate working liquidity to intermediaries. Master balance debited with server timestamped audit log.
          </p>

          <form onSubmit={handleTransferToAgent} className="space-y-3 pt-1">
            <div>
              <label className="text-xs font-bold text-zinc-300 block mb-1">
                Select Destination Agent:
              </label>
              <select
                value={transferAgentId}
                onChange={(e) => setTransferAgentId(e.target.value)}
                required
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs text-zinc-100 font-bold focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="">-- Choose Agent --</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.displayName} (Current Bal: ₹{a.mainBalance.toLocaleString()})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-zinc-300 block mb-1">
                Coin Amount (₹):
              </label>
              <input
                type="number"
                min="100"
                step="500"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                required
                className="w-full bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-zinc-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <button
              type="submit"
              disabled={isTransferring || !transferAgentId}
              className="w-full py-2.5 rounded-xl text-xs font-black bg-amber-500 text-zinc-950 hover:bg-amber-400 transition-colors cursor-pointer shadow-md disabled:opacity-50"
            >
              Transfer Coins to Agent
            </button>
          </form>
        </div>

        {/* User Management: Search & Block / Unblock */}
        <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl space-y-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" />
            <h3 className="text-base font-black text-zinc-100 font-display">
              User & Agent Management
            </h3>
          </div>
          <p className="text-xs text-zinc-400">
            Search users by Mobile or ID. Toggle instant block/unblock enforcement.
          </p>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Search by name, phone, or user ID..."
              className="w-full bg-zinc-950 border border-zinc-700 rounded-xl pl-9 pr-3 py-2 text-xs text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {filteredUsers.map((u) => (
              <div
                key={u.id}
                className="bg-zinc-950 border border-zinc-800 p-2.5 rounded-xl flex items-center justify-between text-xs"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-zinc-100">{u.displayName}</span>
                    <span
                      className={`text-[9px] uppercase px-1.5 py-0.2 rounded font-bold ${
                        u.role === 'agent'
                          ? 'bg-purple-500/20 text-purple-300'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {u.role}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 font-mono">{u.phoneNumber}</p>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      u.status === 'active'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-rose-500/15 text-rose-400'
                    }`}
                  >
                    {u.status.toUpperCase()}
                  </span>

                  <button
                    onClick={() => handleToggleBlock(u.id)}
                    className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                      u.status === 'active'
                        ? 'text-rose-400 border-rose-500/30 hover:bg-rose-500/15'
                        : 'text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/15'
                    }`}
                    title={u.status === 'active' ? 'Block User' : 'Unblock User'}
                  >
                    {u.status === 'active' ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
