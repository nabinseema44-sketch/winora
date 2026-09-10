import React, { useState } from 'react';
import {
  History,
  TrendingUp,
  ShieldCheck,
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
  Coins,
  Filter,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { ActivityHistoryItem, UserProfile } from '../types.ts';
import { winoraEngine } from '../services/winoraEngine.ts';

interface HistoryPageProps {
  user: UserProfile;
}

export const HistoryPage: React.FC<HistoryPageProps> = ({ user }) => {
  const [filterType, setFilterType] = useState<
    'all' | 'bid' | 'win' | 'refund' | 'referral' | 'deposit' | 'withdrawal'
  >('all');

  const historyItems = winoraEngine.getHistory();

  const filteredItems = historyItems.filter((item) => {
    if (filterType === 'all') return true;
    return item.type === filterType;
  });

  const getBadge = (type: ActivityHistoryItem['type']) => {
    switch (type) {
      case 'win':
        return {
          icon: <TrendingUp className="w-3.5 h-3.5" />,
          color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
          label: '90× Win',
        };
      case 'refund':
        return {
          icon: <ShieldCheck className="w-3.5 h-3.5" />,
          color: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
          label: '80% Refund',
        };
      case 'referral':
        return {
          icon: <Sparkles className="w-3.5 h-3.5" />,
          color: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
          label: 'Referral / Comm',
        };
      case 'deposit':
        return {
          icon: <ArrowDownLeft className="w-3.5 h-3.5" />,
          color: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
          label: 'Deposit',
        };
      case 'withdrawal':
        return {
          icon: <ArrowUpRight className="w-3.5 h-3.5" />,
          color: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
          label: 'Withdrawal',
        };
      case 'bid':
      default:
        return {
          icon: <Coins className="w-3.5 h-3.5" />,
          color: 'bg-zinc-800 text-zinc-300 border-zinc-700',
          label: 'Bid Placed',
        };
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 p-5 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-zinc-100 font-display tracking-wide">
              30-Day Activity Ledger
            </h1>
            <p className="text-xs text-zinc-400">
              Complete verifiable audit trail of Bids, Wins, 80% Green Refunds, Referrals, and Handshakes
            </p>
          </div>
        </div>

        {/* Quick Summary Pill */}
        <div className="flex items-center gap-2 text-xs text-zinc-400 bg-zinc-950 px-3 py-1.5 rounded-xl border border-zinc-800">
          <Calendar className="w-3.5 h-3.5 text-amber-400" />
          <span>Showing last 30 days ({historyItems.length} records)</span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
        {[
          { id: 'all', label: 'All Activities' },
          { id: 'win', label: '90× Wins' },
          { id: 'refund', label: '80% Green Refunds' },
          { id: 'bid', label: 'Bids' },
          { id: 'referral', label: 'Referrals & Comm' },
          { id: 'deposit', label: 'Deposits' },
          { id: 'withdrawal', label: 'Withdrawals' },
        ].map((tab) => {
          const isActive = filterType === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border cursor-pointer ${
                isActive
                  ? 'bg-amber-500 text-zinc-950 border-amber-400 shadow-sm'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:bg-zinc-850'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* History Items List */}
      <div className="space-y-2.5">
        {filteredItems.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center text-zinc-400 space-y-2">
            <History className="w-8 h-8 mx-auto text-zinc-400" />
            <p className="text-sm font-semibold">No activity found for this filter</p>
            <p className="text-xs text-zinc-400">Place bids or request deposits to view your history log.</p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const badge = getBadge(item.type);
            const isCredit = item.type === 'win' || item.type === 'refund' || item.type === 'deposit' || item.type === 'referral';

            return (
              <div
                key={item.id}
                className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-colors p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-xl border shrink-0 mt-0.5 ${badge.color}`}>
                    {badge.icon}
                  </div>

                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-zinc-100">{item.title}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${badge.color}`}>
                        {badge.label}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-400">{item.details}</p>

                    <div className="flex items-center gap-3 text-[11px] text-zinc-400 pt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(item.timestamp).toLocaleString()}
                      </span>
                      {item.referenceId && (
                        <span className="font-mono text-zinc-400">Ref: {item.referenceId}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Amount and Wallet Badge */}
                <div className="text-right sm:shrink-0 flex sm:flex-col justify-between items-end">
                  <span
                    className={`font-mono text-base font-black ${
                      isCredit ? 'text-emerald-400' : 'text-zinc-200'
                    }`}
                  >
                    {isCredit ? '+' : '-'}₹{item.amount.toLocaleString()}
                  </span>

                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full mt-0.5 bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    Main Wallet
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
