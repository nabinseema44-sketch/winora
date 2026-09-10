import React, { useState } from 'react';
import {
  Users,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
  Phone,
  Coins,
  Search,
  Filter,
  AlertCircle,
  Copy,
  TrendingUp,
} from 'lucide-react';
import { UserProfile, HandshakeTransaction } from '../types.ts';
import { winoraEngine } from '../services/winoraEngine.ts';

interface AgentPortalPageProps {
  currentAgent: UserProfile;
  onToast: (msg: string) => void;
}

export const AgentPortalPage: React.FC<AgentPortalPageProps> = ({ currentAgent, onToast }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'players' | 'completed'>('pending');

  const handshakes = winoraEngine.getHandshakes();
  const allPlayers = winoraEngine.getPlayers();

  // Filter pending handshakes directed to this agent
  const pendingHandshakes = handshakes.filter(
    (h) => h.receiverId === currentAgent.id && h.status === 'pending'
  );

  const completedHandshakes = handshakes.filter(
    (h) => h.receiverId === currentAgent.id && h.status !== 'pending'
  );

  // Players assigned to this agent
  const assignedPlayers = allPlayers.filter(
    (p) => p.assignedAgentId === currentAgent.id || !p.assignedAgentId
  );

  const filteredPlayers = assignedPlayers.filter(
    (p) =>
      p.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.phoneNumber.includes(searchTerm) ||
      (p.pincode && p.pincode.includes(searchTerm))
  );

  const handleApprove = (txId: string) => {
    const res = winoraEngine.approveHandshake(txId);
    onToast(res.message);
  };

  const handleReject = (txId: string) => {
    const reason = prompt('Please provide reason for rejecting this handshake:');
    if (!reason) return;
    const res = winoraEngine.rejectHandshake(txId, reason);
    onToast(res.message);
  };

  // Commission totals
  const totalCommissionEarned = completedHandshakes
    .filter((h) => h.type === 'deposit' && h.status === 'completed')
    .reduce((sum, h) => sum + Math.floor(h.amount * 0.1), 0);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Agent Header Profile Card */}
      <div className="bg-gradient-to-r from-zinc-900 via-zinc-850 to-zinc-900 border border-zinc-800 p-5 sm:p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <img
            src={currentAgent.avatar}
            alt={currentAgent.displayName}
            className="w-14 h-14 rounded-2xl object-cover border-2 border-amber-500/50 shadow-md"
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Agent Intermediary
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                Active SLA
              </span>
            </div>
            <h1 className="text-xl font-black text-zinc-100 font-display mt-0.5">
              {currentAgent.displayName}
            </h1>
            <p className="text-xs text-zinc-400">
              Agent ID: <span className="font-mono text-zinc-300">{currentAgent.id}</span> • {currentAgent.phoneNumber}
            </p>
          </div>
        </div>

        {/* Quick Agent Metrics */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full md:w-auto">
          <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 text-center">
            <span className="text-[10px] uppercase font-bold text-zinc-400 block">Agent Wallet</span>
            <span className="text-sm sm:text-base font-black text-amber-400 font-mono">
              ₹{currentAgent.mainBalance.toLocaleString()}
            </span>
          </div>

          <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 text-center">
            <span className="text-[10px] uppercase font-bold text-emerald-400 block">10% Comm.</span>
            <span className="text-sm sm:text-base font-black text-emerald-400 font-mono">
              ₹{totalCommissionEarned.toLocaleString()}
            </span>
          </div>

          <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 text-center">
            <span className="text-[10px] uppercase font-bold text-cyan-400 block">Players</span>
            <span className="text-sm sm:text-base font-black text-cyan-300 font-mono">
              {assignedPlayers.length}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'pending'
              ? 'bg-amber-500 text-zinc-950 shadow-md'
              : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          Pending Handshakes
          {pendingHandshakes.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-zinc-950 text-amber-300">
              {pendingHandshakes.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('players')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'players'
              ? 'bg-amber-500 text-zinc-950 shadow-md'
              : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
          }`}
        >
          <Users className="w-4 h-4" />
          Assigned Players ({assignedPlayers.length})
        </button>

        <button
          onClick={() => setActiveTab('completed')}
          className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'completed'
              ? 'bg-amber-500 text-zinc-950 shadow-md'
              : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
          }`}
        >
          <CheckCircle2 className="w-4 h-4" />
          Handshake Logs ({completedHandshakes.length})
        </button>
      </div>

      {/* Tab 1: Pending Dual-Confirmation Handshakes */}
      {activeTab === 'pending' && (
        <div className="space-y-3">
          {pendingHandshakes.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-10 text-center text-zinc-400 space-y-2">
              <ShieldCheck className="w-10 h-10 mx-auto text-emerald-400/80" />
              <p className="text-base font-bold text-zinc-200">No Pending Handshakes</p>
              <p className="text-xs text-zinc-400">
                All player deposits and withdrawals assigned to you have been confirmed.
              </p>
            </div>
          ) : (
            pendingHandshakes.map((tx) => (
              <div
                key={tx.id}
                className="bg-zinc-900 border border-amber-500/40 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`p-2 rounded-xl border ${
                        tx.type === 'deposit'
                          ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                      }`}
                    >
                      {tx.type === 'deposit' ? (
                        <ArrowDownLeft className="w-5 h-5" />
                      ) : (
                        <ArrowUpRight className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-bold text-zinc-100">
                          {tx.senderName} ({tx.type.toUpperCase()})
                        </h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Awaiting Your Handshake
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400">
                        Phone: {tx.senderPhone} • Ref: {tx.id}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xl font-black text-zinc-100 font-mono">
                      ₹{tx.amount.toLocaleString()}
                    </span>
                    <span className="text-[11px] text-zinc-400 block">
                      {tx.type === 'deposit'
                        ? `You earn ₹${Math.floor(tx.amount * 0.1)} (10% Comm.)`
                        : 'Payout from Player Main'}
                    </span>
                  </div>
                </div>

                {/* Details & Notes */}
                <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 text-xs text-zinc-300 space-y-1">
                  <p>
                    <strong className="text-zinc-400">Notes / UTR:</strong> {tx.notes || 'No note provided'}
                  </p>
                  {tx.payoutDetails && (
                    <p>
                      <strong className="text-zinc-400">Payout Target:</strong> UPI: {tx.payoutDetails.upiId || 'N/A'} • A/C: {tx.payoutDetails.accountNumber || 'N/A'} ({tx.payoutDetails.ifsc || ''})
                    </p>
                  )}
                  {tx.isFirstDeposit && (
                    <p className="text-purple-300 flex items-center gap-1 font-semibold">
                      <Sparkles className="w-3.5 h-3.5" />
                      Player's 1st Deposit: Will automatically trigger 50% Referrer Main + 50% Player Bonus on approval!
                    </p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    onClick={() => handleReject(tx.id)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject Handshake
                  </button>

                  <button
                    onClick={() => handleApprove(tx.id)}
                    className="px-5 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-emerald-500 to-emerald-400 text-zinc-950 hover:brightness-110 active:scale-95 transition-all shadow-md shadow-emerald-500/20 cursor-pointer flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Approve & Settle Handshake
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 2: Assigned Player List */}
      {activeTab === 'players' && (
        <div className="space-y-4">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search assigned players by name, phone, or pincode..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredPlayers.map((player) => (
              <div
                key={player.id}
                className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 p-4 rounded-xl space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={player.avatar}
                      alt={player.displayName}
                      className="w-10 h-10 rounded-xl object-cover border border-zinc-700"
                    />
                    <div>
                      <h4 className="text-sm font-bold text-zinc-100">{player.displayName}</h4>
                      <p className="text-xs text-zinc-400">{player.phoneNumber}</p>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      player.status === 'active'
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {player.status.toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-zinc-950 p-2.5 rounded-lg text-xs">
                  <div>
                    <span className="text-[10px] uppercase text-zinc-400 block">Main (Withdrawable)</span>
                    <span className="font-mono font-bold text-amber-400">
                      ₹{player.mainBalance.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-zinc-400 block">Bonus (Play-Only)</span>
                    <span className="font-mono font-bold text-purple-400">
                      ₹{player.bonusBalance.toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-zinc-400 border-t border-zinc-800/80 pt-2 flex items-center justify-between">
                  <span>Address: {player.address || 'Not registered'}</span>
                  <span>PIN: {player.pincode || 'N/A'}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Handshake Logs */}
      {activeTab === 'completed' && (
        <div className="space-y-2">
          {completedHandshakes.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center text-zinc-400">
              No completed handshakes yet.
            </div>
          ) : (
            completedHandshakes.map((tx) => (
              <div
                key={tx.id}
                className="bg-zinc-900 border border-zinc-800 p-3.5 rounded-xl flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg ${
                      tx.status === 'completed'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-rose-500/15 text-rose-400'
                    }`}
                  >
                    {tx.status === 'completed' ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-zinc-100">
                      {tx.senderName} • {tx.type.toUpperCase()}
                    </p>
                    <p className="text-zinc-400 text-[11px]">
                      {new Date(tx.createdAt).toLocaleString()} • Ref: {tx.id}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-mono font-bold text-zinc-100 block">
                    ₹{tx.amount.toLocaleString()}
                  </span>
                  <span
                    className={`text-[10px] font-bold ${
                      tx.status === 'completed' ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {tx.status.toUpperCase()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
