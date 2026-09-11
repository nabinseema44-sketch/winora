import React, { useState, useEffect } from 'react';
import {
  Crown,
  Coins,
  Users,
  Briefcase,
  TrendingUp,
  TrendingDown,
  Calculator,
  Search,
  UserX,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  Database,
  ExternalLink,
  Clock,
  ShieldCheck,
  ArrowDownLeft,
  ArrowUpRight,
  Settings,
  FileText,
  Trophy,
  SlidersHorizontal,
  X,
  Check,
  QrCode,
  Building2,
  Smartphone,
} from 'lucide-react';
import {
  UserProfile,
  WinoraGameId,
  DepositRequestRecord,
  WithdrawalRequestRecord,
  MasterPaymentSettings,
  AuditLogRecord,
  NumberAccountingRow,
  MasterDashboardStats,
  formatPaise,
  rupeesToPaise,
} from '../types.ts';
import { winoraEngine, WINORA_GAMES } from '../services/winoraEngine.ts';

interface MasterPortalPageProps {
  onToast: (msg: string) => void;
  onOpenSqlModal?: () => void;
}

export const MasterPortalPage: React.FC<MasterPortalPageProps> = ({ onToast, onOpenSqlModal }) => {
  const [activeTab, setActiveTab] = useState<
    'accounting' | 'deposits' | 'withdrawals' | 'settings' | 'stats' | 'users' | 'audits'
  >('accounting');

  const [selectedGameId, setSelectedGameId] = useState<WinoraGameId>('kalyan_morning');
  const [userSearch, setUserSearch] = useState('');

  // Engine state subscriptions
  const [pnlData, setPnlData] = useState<{
    rows: NumberAccountingRow[];
    totalStakePaise: number;
    totalPlayers: number;
    totalPayoutPaise: number;
    totalProtectionPaise: number;
    netHousePnLPaise: number;
    highestLossNumber: number;
    highestProfitNumber: number;
  } | null>(null);

  const [depositRequests, setDepositRequests] = useState<DepositRequestRecord[]>(winoraEngine.getDepositRequests());
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequestRecord[]>(winoraEngine.getWithdrawalRequests());
  const [paymentSettings, setPaymentSettings] = useState<MasterPaymentSettings>(winoraEngine.getMasterPaymentSettings());
  const [dashboardStats, setDashboardStats] = useState<MasterDashboardStats>(winoraEngine.getMasterDashboardStats());
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>(winoraEngine.getAuditLogs());
  const [players, setPlayers] = useState<UserProfile[]>(winoraEngine.getPlayers());
  const [agents, setAgents] = useState<UserProfile[]>(winoraEngine.getAgents());

  // Settings Edit State
  const [editPaymentUrl, setEditPaymentUrl] = useState(paymentSettings.paymentUrl);
  const [editQrCodeUrl, setEditQrCodeUrl] = useState(paymentSettings.qrCodeUrl || '');
  const [editUpiId, setEditUpiId] = useState(paymentSettings.upiId);
  const [editAccountName, setEditAccountName] = useState(paymentSettings.accountHolderName);
  const [editInstructions, setEditInstructions] = useState(paymentSettings.instructions);
  const [editEnabled, setEditEnabled] = useState(paymentSettings.enabled);
  const [editMinDepRupees, setEditMinDepRupees] = useState((paymentSettings.minDepositPaise / 100).toString());
  const [editMaxDepRupees, setEditMaxDepRupees] = useState((paymentSettings.maxDepositPaise / 100).toString());
  const [editMinWthRupees, setEditMinWthRupees] = useState((paymentSettings.minWithdrawalPaise / 100).toString());
  const [editMaxWthRupees, setEditMaxWthRupees] = useState((paymentSettings.maxWithdrawalPaise / 100).toString());

  // Re-fetch calculations and engine subscriptions
  const refreshAll = () => {
    const currentSettings = winoraEngine.getMasterPaymentSettings();
    setPnlData(winoraEngine.calculateNumberWisePnL(selectedGameId));
    setDepositRequests(winoraEngine.getDepositRequests());
    setWithdrawalRequests(winoraEngine.getWithdrawalRequests());
    setPaymentSettings(currentSettings);
    setEditQrCodeUrl(currentSettings.qrCodeUrl || '');
    setDashboardStats(winoraEngine.getMasterDashboardStats());
    setAuditLogs(winoraEngine.getAuditLogs());
    setPlayers([...winoraEngine.getPlayers()]);
    setAgents([...winoraEngine.getAgents()]);
  };

  useEffect(() => {
    refreshAll();
    const unsub = winoraEngine.subscribe(refreshAll);
    return () => unsub();
  }, [selectedGameId]);

  // Winning Number Declaration
  const handleDeclareWinner = (num: number) => {
    const formatted = num.toString().padStart(2, '0');
    const gameName = WINORA_GAMES.find((g) => g.id === selectedGameId)?.name || selectedGameId;
    const confirmDeclaration = window.confirm(
      `Confirm declaration of Number #${formatted} as WINNER for ${gameName}?\n` +
      `This will execute 90× winning payouts to Withdrawable Balance and 80% protection refunds to Bonus Balance.`
    );
    if (!confirmDeclaration) return;

    const res = winoraEngine.declareWinningNumber(selectedGameId, num);
    onToast(res.message);
    refreshAll();
  };

  // Deposit Approval
  const handleApproveDeposit = (depositId: string) => {
    const res = winoraEngine.approveDepositRequest(depositId);
    onToast(res.message);
    refreshAll();
  };

  // Deposit Rejection
  const handleRejectDeposit = (depositId: string) => {
    const reason = prompt('Please enter reason for rejecting this deposit (e.g. UTR not matched on bank statement):');
    if (!reason) return;
    const res = winoraEngine.rejectDepositRequest(depositId, 'master-admin', reason);
    onToast(res.message);
    refreshAll();
  };

  // Withdrawal Approval (Coins will be deducted from player after confirmation)
  const handleApproveWithdrawal = (requestId: string) => {
    const req = withdrawalRequests.find((r) => r.requestId === requestId);
    const methodText = req?.payoutMethod === 'BANK' ? 'Bank Account' : 'UPI';
    const confirmApproval = window.confirm(
      `Confirm payout and deduct ₹${req ? (req.amountPaise / 100).toLocaleString() : ''} coins from ${req?.playerName}'s wallet?\n` +
      `Payout method: ${methodText}. Coins will be permanently deducted upon your confirmation.`
    );
    if (!confirmApproval) return;

    const payoutRef = prompt('Enter Bank IMPS / UPI payout transaction reference number:', `IMPS-${Date.now().toString().slice(-8)}`);
    if (!payoutRef) return;
    const res = winoraEngine.approveWithdrawal(requestId, 'master-admin', payoutRef);
    onToast(res.message);
    refreshAll();
  };

  // Withdrawal Rejection (No coins were deducted from player)
  const handleRejectWithdrawal = (requestId: string) => {
    const reason = prompt('Enter reason for rejecting withdrawal:');
    if (!reason) return;
    const res = winoraEngine.rejectWithdrawal(requestId, 'master-admin', reason);
    onToast(res.message);
    refreshAll();
  };

  // Save Payment Settings
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const res = winoraEngine.updateMasterPaymentSettings({
      enabled: editEnabled,
      paymentUrl: editPaymentUrl,
      qrCodeUrl: editQrCodeUrl,
      upiId: editUpiId,
      accountHolderName: editAccountName,
      instructions: editInstructions,
      minDepositPaise: rupeesToPaise(Number(editMinDepRupees)),
      maxDepositPaise: rupeesToPaise(Number(editMaxDepRupees)),
      minWithdrawalPaise: rupeesToPaise(Number(editMinWthRupees)),
      maxWithdrawalPaise: rupeesToPaise(Number(editMaxWthRupees)),
    });
    onToast(res.message);
    refreshAll();
  };

  // User Block/Unblock
  const handleToggleBlock = (userId: string) => {
    const res = winoraEngine.toggleUserBlockStatus(userId);
    if (res.success) {
      onToast(`User status updated to ${res.newStatus.toUpperCase()}`);
      refreshAll();
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
      {/* Top Banner */}
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
              <span className="text-xs text-amber-400 font-bold">Full Executive Control</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-zinc-100 font-display mt-0.5">
              WINORA Master Accounting & Administration
            </h1>
          </div>
        </div>

        {onOpenSqlModal && (
          <button
            onClick={onOpenSqlModal}
            className="px-4 py-2 rounded-xl text-xs font-black bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <Database className="w-4 h-4 text-emerald-400" />
            <span>Database Architecture</span>
          </button>
        )}
      </div>

      {/* Navigation Tab Bar */}
      <div className="flex border-b border-zinc-800 gap-2 pb-1 overflow-x-auto text-xs font-bold">
        <button
          onClick={() => setActiveTab('accounting')}
          className={`px-4 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === 'accounting'
              ? 'bg-amber-500 text-zinc-950 shadow'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <Calculator className="w-4 h-4" />
          <span>House P/L & 00–99 Accounting</span>
        </button>

        <button
          onClick={() => setActiveTab('deposits')}
          className={`px-4 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === 'deposits'
              ? 'bg-amber-500 text-zinc-950 shadow'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <ArrowDownLeft className="w-4 h-4" />
          <span>Deposit Verification</span>
          {depositRequests.filter((d) => d.status === 'PENDING').length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-red-500 text-white font-black">
              {depositRequests.filter((d) => d.status === 'PENDING').length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('withdrawals')}
          className={`px-4 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === 'withdrawals'
              ? 'bg-amber-500 text-zinc-950 shadow'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <ArrowUpRight className="w-4 h-4" />
          <span>Withdrawals</span>
          {withdrawalRequests.filter((w) => w.status === 'PENDING').length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-400 text-zinc-950 font-black">
              {withdrawalRequests.filter((w) => w.status === 'PENDING').length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === 'settings'
              ? 'bg-amber-500 text-zinc-950 shadow'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Payment Config</span>
        </button>

        <button
          onClick={() => setActiveTab('stats')}
          className={`px-4 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === 'stats'
              ? 'bg-amber-500 text-zinc-950 shadow'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <Coins className="w-4 h-4" />
          <span>Dashboard & Balances</span>
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === 'users'
              ? 'bg-amber-500 text-zinc-950 shadow'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Players & Agents</span>
        </button>

        <button
          onClick={() => setActiveTab('audits')}
          className={`px-4 py-2.5 rounded-xl transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
            activeTab === 'audits'
              ? 'bg-amber-500 text-zinc-950 shadow'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Audit Logs</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: HOUSE P/L & 00-99 NUMBER ACCOUNTING (Section 10 of Blueprint)     */}
      {/* ========================================================================= */}
      {activeTab === 'accounting' && (
        <div className="space-y-6">
          {/* Game Selection Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-900 p-3 rounded-2xl border border-zinc-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Select Draw Session:</span>
              <div className="flex flex-wrap gap-1.5">
                {WINORA_GAMES.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setSelectedGameId(g.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      selectedGameId === g.id
                        ? 'bg-amber-500 text-zinc-950 font-black shadow-md'
                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    }`}
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            </div>

            {pnlData && (
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="text-zinc-400">Total Bids Pool:</span>
                <span className="font-bold text-emerald-400 text-sm">
                  {formatPaise(pnlData.totalStakePaise)}
                </span>
              </div>
            )}
          </div>

          {/* Highlights: Highest Loss Number & Highest Profit Number */}
          {pnlData && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-red-400 block">
                    Highest House Liability / Loss Number
                  </span>
                  <span className="text-3xl font-black text-red-300 font-mono">
                    #{pnlData.highestLossNumber.toString().padStart(2, '0')}
                  </span>
                  <span className="text-xs text-red-200/80 block mt-1">
                    House P/L if declared:{' '}
                    <strong>
                      {formatPaise(pnlData.rows[pnlData.highestLossNumber]?.netHouseProfitLossPaise || 0)}
                    </strong>
                  </span>
                </div>
                <button
                  onClick={() => handleDeclareWinner(pnlData.highestLossNumber)}
                  className="px-3 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow"
                >
                  <Trophy className="w-3.5 h-3.5" />
                  <span>Declare Winner</span>
                </button>
              </div>

              <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-400 block">
                    Highest House Profit / Retention Number
                  </span>
                  <span className="text-3xl font-black text-emerald-300 font-mono">
                    #{pnlData.highestProfitNumber.toString().padStart(2, '0')}
                  </span>
                  <span className="text-xs text-emerald-200/80 block mt-1">
                    House P/L if declared:{' '}
                    <strong>
                      {formatPaise(pnlData.rows[pnlData.highestProfitNumber]?.netHouseProfitLossPaise || 0)}
                    </strong>
                  </span>
                </div>
                <button
                  onClick={() => handleDeclareWinner(pnlData.highestProfitNumber)}
                  className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-black text-xs flex items-center gap-1.5 cursor-pointer shadow"
                >
                  <Trophy className="w-3.5 h-3.5" />
                  <span>Declare Winner</span>
                </button>
              </div>
            </div>
          )}

          {/* Number-Wise Table (00 to 99) */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-amber-400" />
                  <span>Master Accounting Matrix (00–99 Table)</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Complete mathematical accounting of player stakes, 90× liabilities, protection liabilities, and Net House P/L.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[550px] overflow-y-auto">
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="sticky top-0 bg-zinc-950 text-[10px] uppercase font-bold text-zinc-400 border-b border-zinc-800 z-10">
                  <tr>
                    <th className="py-2.5 px-3">Number</th>
                    <th className="py-2.5 px-3 text-right">Total Bid</th>
                    <th className="py-2.5 px-3 text-right">Players</th>
                    <th className="py-2.5 px-3 text-right">Winning Stake</th>
                    <th className="py-2.5 px-3 text-right">Payout Liability (90×)</th>
                    <th className="py-2.5 px-3 text-right">Hourly Protection</th>
                    <th className="py-2.5 px-3 text-right">House Net P/L</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/70 font-mono text-[11px]">
                  {pnlData?.rows.map((row) => {
                    const isProfitable = row.netHouseProfitLossPaise >= 0;
                    return (
                      <tr key={row.number} className="hover:bg-zinc-850 transition-colors">
                        <td className="py-2 px-3">
                          <span
                            className={`px-2 py-0.5 rounded font-black text-xs ${
                              row.color === 'GREEN'
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-red-500/20 text-red-400 border border-red-500/30'
                            }`}
                          >
                            #{row.formattedNumber}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right text-zinc-200 font-bold">
                          {formatPaise(row.totalBidPaise)}
                        </td>
                        <td className="py-2 px-3 text-right text-zinc-400">
                          {row.playerCount}
                        </td>
                        <td className="py-2 px-3 text-right text-zinc-300">
                          {formatPaise(row.winningStakePaise)}
                        </td>
                        <td className="py-2 px-3 text-right text-amber-400 font-bold">
                          {formatPaise(row.payoutLiabilityPaise)}
                        </td>
                        <td className="py-2 px-3 text-right text-cyan-400">
                          {formatPaise(row.protectionLiabilityPaise)}
                        </td>
                        <td
                          className={`py-2 px-3 text-right font-black ${
                            isProfitable ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {formatPaise(row.netHouseProfitLossPaise)}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <button
                            onClick={() => handleDeclareWinner(row.number)}
                            className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-amber-500 hover:text-zinc-950 font-bold text-[10px] text-zinc-200 transition-colors cursor-pointer"
                          >
                            Declare
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DEPOSIT VERIFICATION                                               */}
      {/* ========================================================================= */}
      {activeTab === 'deposits' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <ArrowDownLeft className="w-4 h-4 text-emerald-400" />
                <span>Manual Deposit Verification Requests</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Verify player UPI reference/UTR against bank statement before approving Withdrawable Balance credit.
              </p>
            </div>
            <span className="text-xs text-zinc-500 font-mono">
              Total Requests: {depositRequests.length}
            </span>
          </div>

          <div className="divide-y divide-zinc-800">
            {depositRequests.map((dep) => (
              <div key={dep.depositId} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-zinc-100 text-sm">{dep.playerName}</span>
                    <span className="text-xs text-zinc-400 font-mono">{dep.playerPhone}</span>
                    <span
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                        dep.status === 'APPROVED'
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : dep.status === 'REJECTED'
                          ? 'bg-red-500/15 text-red-400 border-red-500/30'
                          : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                      }`}
                    >
                      {dep.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                    <span>
                      UTR / Reference: <strong className="text-amber-400 font-mono">{dep.transactionReference}</strong>
                    </span>
                    <span>•</span>
                    <span>Submitted: {new Date(dep.submittedAt).toLocaleString()}</span>
                    {dep.reviewNote && (
                      <>
                        <span>•</span>
                        <span className="italic text-zinc-500">Note: {dep.reviewNote}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="font-mono text-base font-black text-emerald-400 block">
                      {formatPaise(dep.submittedAmountPaise)}
                    </span>
                    {dep.screenshotUrl && (
                      <a
                        href={dep.screenshotUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-amber-400 hover:underline flex items-center justify-end gap-1"
                      >
                        <span>View Proof</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  {dep.status === 'PENDING' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleApproveDeposit(dep.depositId)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs flex items-center gap-1 cursor-pointer shadow"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve</span>
                      </button>
                      <button
                        onClick={() => handleRejectDeposit(dep.depositId)}
                        className="px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 font-bold text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: WITHDRAWAL PROCESSING                                              */}
      {/* ========================================================================= */}
      {activeTab === 'withdrawals' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-amber-400" />
                <span>Player Withdrawal Requests</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Execute bank/UPI payouts. Rejection automatically refunds held amount back to player's Withdrawable Balance.
              </p>
            </div>
            <span className="text-xs text-zinc-500 font-mono">
              Total Requests: {withdrawalRequests.length}
            </span>
          </div>

          <div className="divide-y divide-zinc-800">
            {withdrawalRequests.map((req) => (
              <div key={req.requestId} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-zinc-100 text-sm">{req.playerName}</span>
                    <span className="text-xs text-zinc-400 font-mono">{req.playerPhone}</span>
                    <span
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                        req.status === 'APPROVED'
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : req.status === 'REJECTED'
                          ? 'bg-red-500/15 text-red-400 border-red-500/30'
                          : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                      }`}
                    >
                      {req.status}
                    </span>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 flex items-center gap-1">
                      {req.payoutMethod === 'BANK' || req.bankAccount ? (
                        <>
                          <Building2 className="w-3 h-3 text-cyan-400" />
                          <span>Bank Account</span>
                        </>
                      ) : (
                        <>
                          <Smartphone className="w-3 h-3 text-amber-400" />
                          <span>UPI</span>
                        </>
                      )}
                    </span>
                  </div>

                  {/* Payout Details */}
                  {req.payoutMethod === 'BANK' || req.bankAccount ? (
                    <div className="bg-zinc-950/80 p-2.5 rounded-xl border border-zinc-800 text-xs space-y-1 font-mono">
                      <div className="flex flex-wrap items-center gap-3 text-zinc-350">
                        <span>
                          Bank: <strong className="text-zinc-100">{req.bankAccount?.bankName || 'Direct Transfer'}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          A/C No: <strong className="text-cyan-300 tracking-wider font-bold">{req.bankAccount?.accountNumber}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          IFSC: <strong className="text-amber-400 font-bold">{req.bankAccount?.ifscCode}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          Holder: <strong className="text-zinc-100">{req.bankAccount?.accountHolderName || req.accountName}</strong>
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-zinc-950/80 p-2.5 rounded-xl border border-zinc-800 text-xs flex flex-wrap items-center gap-3 font-mono">
                      <span>
                        UPI ID: <strong className="text-amber-400 font-bold">{req.upiId}</strong>
                      </span>
                      <span>•</span>
                      <span>Beneficiary: <strong className="text-zinc-100">{req.accountName}</strong></span>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-500">
                    <span>Requested: {new Date(req.createdAt).toLocaleString()}</span>
                    {req.payoutReference && (
                      <>
                        <span>•</span>
                        <span className="text-emerald-400 font-mono">Payout Ref: {req.payoutReference}</span>
                      </>
                    )}
                    {req.rejectionReason && (
                      <>
                        <span>•</span>
                        <span className="text-red-400 italic">Rejection: {req.rejectionReason}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <span className="font-mono text-base font-black text-zinc-100 block">
                      {formatPaise(req.amountPaise)}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-semibold block">
                      {Math.floor(req.amountPaise / 100).toLocaleString()} Coins
                    </span>
                  </div>

                  {req.status === 'PENDING' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleApproveWithdrawal(req.requestId)}
                        title="Confirm bank/UPI payout and permanently deduct coins from player wallet"
                        className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs flex items-center gap-1 cursor-pointer shadow transition-all"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Confirm & Deduct Coins</span>
                      </button>
                      <button
                        onClick={() => handleRejectWithdrawal(req.requestId)}
                        title="Reject withdrawal request. No coins were deducted."
                        className="px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 font-bold text-xs flex items-center gap-1 cursor-pointer transition-all"
                      >
                        <X className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Reject</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: MASTER PAYMENT SETTINGS                                            */}
      {/* ========================================================================= */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <Settings className="w-4 h-4 text-amber-400" />
                <span>Master Deposit QR, Payment Link & Limits Configuration</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Master sets the official deposit QR code, payment link, UPI ID, and deposit/withdrawal limits.
              </p>
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-zinc-300">
              <input
                type="checkbox"
                checked={editEnabled}
                onChange={(e) => setEditEnabled(e.target.checked)}
                className="rounded border-zinc-700 text-amber-500 focus:ring-0"
              />
              <span>Deposit System Active</span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Official UPI ID (VPA)</label>
              <input
                type="text"
                value={editUpiId}
                onChange={(e) => setEditUpiId(e.target.value)}
                placeholder="e.g. winora.gaming@icici"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-100 text-sm font-mono focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Account Holder / Beneficiary Name</label>
              <input
                type="text"
                value={editAccountName}
                onChange={(e) => setEditAccountName(e.target.value)}
                placeholder="WINORA ENTERTAINMENT PVT LTD"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-100 text-sm focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-zinc-300 mb-1 flex items-center justify-between">
                <span>Official Payment URL / Direct Link</span>
                <span className="text-[11px] text-zinc-500">Visible to players on Deposit page</span>
              </label>
              <input
                type="text"
                value={editPaymentUrl}
                onChange={(e) => setEditPaymentUrl(e.target.value)}
                placeholder="https://pay.winora.vip/instant-upi"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-100 text-xs font-mono focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-zinc-300 mb-1 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <QrCode className="w-3.5 h-3.5 text-amber-400" />
                  <span>Master QR Code Image URL</span>
                </span>
                <span className="text-[11px] text-zinc-500">Direct image URL for scanning</span>
              </label>
              <div className="flex gap-3 items-center">
                <input
                  type="text"
                  value={editQrCodeUrl}
                  onChange={(e) => setEditQrCodeUrl(e.target.value)}
                  placeholder="https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=..."
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-zinc-100 text-xs font-mono focus:border-amber-500 focus:outline-none"
                />
                {editQrCodeUrl && (
                  <div className="w-11 h-11 rounded-lg bg-white p-1 shrink-0 border border-zinc-700 flex items-center justify-center overflow-hidden">
                    <img src={editQrCodeUrl} alt="QR Preview" className="w-full h-full object-contain" />
                  </div>
                )}
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Player Deposit Instructions</label>
              <textarea
                rows={3}
                value={editInstructions}
                onChange={(e) => setEditInstructions(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-zinc-100 text-xs focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Min Deposit (₹)</label>
              <input
                type="number"
                value={editMinDepRupees}
                onChange={(e) => setEditMinDepRupees(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-zinc-100 text-sm font-mono focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Max Deposit (₹)</label>
              <input
                type="number"
                value={editMaxDepRupees}
                onChange={(e) => setEditMaxDepRupees(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-zinc-100 text-sm font-mono focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Min Withdrawal (₹)</label>
              <input
                type="number"
                value={editMinWthRupees}
                onChange={(e) => setEditMinWthRupees(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-zinc-100 text-sm font-mono focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">Max Withdrawal (₹)</label>
              <input
                type="number"
                value={editMaxWthRupees}
                onChange={(e) => setEditMaxWthRupees(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-zinc-100 text-sm font-mono focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs uppercase tracking-wider transition-all shadow cursor-pointer"
          >
            Save Payment Configuration & Log Audit
          </button>
        </form>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: MASTER DASHBOARD STATS & TOTAL BALANCES                            */}
      {/* ========================================================================= */}
      {activeTab === 'stats' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
              <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">Total Player Balances</span>
              <span className="text-xl font-black text-zinc-100 font-mono">
                {formatPaise(dashboardStats.totalPlayerBalancesPaise)}
              </span>
              <span className="text-[10px] text-zinc-500 block mt-1">Withdrawable</span>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
              <span className="text-[10px] uppercase font-bold text-amber-400 block mb-1">Total Bonus Balances</span>
              <span className="text-xl font-black text-amber-300 font-mono">
                {formatPaise(dashboardStats.totalBonusBalancesPaise)}
              </span>
              <span className="text-[10px] text-zinc-500 block mt-1">Non-withdrawable</span>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
              <span className="text-[10px] uppercase font-bold text-purple-400 block mb-1">Agent Commissions</span>
              <span className="text-xl font-black text-purple-300 font-mono">
                {formatPaise(dashboardStats.agentCommissionsPaise)}
              </span>
              <span className="text-[10px] text-zinc-500 block mt-1">Separated Balance</span>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
              <span className="text-[10px] uppercase font-bold text-emerald-400 block mb-1">Net House P/L</span>
              <span className="text-xl font-black text-emerald-400 font-mono">
                {formatPaise(dashboardStats.houseProfitLossPaise)}
              </span>
              <span className="text-[10px] text-zinc-500 block mt-1">Stakes - Payouts - Protection</span>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
              <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">Pending Deposits</span>
              <span className="text-xl font-black text-amber-400 font-mono">
                {dashboardStats.pendingDepositsCount} ({formatPaise(dashboardStats.pendingDepositsPaise)})
              </span>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
              <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">Approved Deposits</span>
              <span className="text-xl font-black text-emerald-400 font-mono">
                {dashboardStats.approvedDepositsCount} ({formatPaise(dashboardStats.approvedDepositsPaise)})
              </span>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
              <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">Pending Withdrawals</span>
              <span className="text-xl font-black text-amber-400 font-mono">
                {dashboardStats.pendingWithdrawalsCount} ({formatPaise(dashboardStats.pendingWithdrawalsPaise)})
              </span>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
              <span className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">Completed Withdrawals</span>
              <span className="text-xl font-black text-zinc-100 font-mono">
                {dashboardStats.completedWithdrawalsCount} ({formatPaise(dashboardStats.completedWithdrawalsPaise)})
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: USERS & AGENTS MANAGEMENT                                          */}
      {/* ========================================================================= */}
      {activeTab === 'users' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-400" />
                <span>Platform Users & Agents Directory</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Manage players and agents, view separated balances, referral codes, and toggle access.
              </p>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search user or phone..."
                className="bg-zinc-950 border border-zinc-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-zinc-200 focus:outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-zinc-950 text-[10px] uppercase font-bold text-zinc-400 border-b border-zinc-800">
                <tr>
                  <th className="py-2.5 px-3">User</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Referral Code</th>
                  <th className="py-2.5 px-3 text-right">Withdrawable</th>
                  <th className="py-2.5 px-3 text-right">Bonus / Comm</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-zinc-850">
                    <td className="py-2.5 px-3">
                      <span className="font-bold text-zinc-100 block">{u.displayName}</span>
                      <span className="text-[10px] text-zinc-500 font-mono">{u.phoneNumber}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="capitalize text-xs font-semibold text-zinc-400">{u.role}</span>
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-amber-400">
                      {u.referralCode || '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                      {formatPaise(u.withdrawableBalancePaise || 0)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-zinc-400">
                      {u.role === 'agent'
                        ? formatPaise(u.agentCommissionBalancePaise || 0)
                        : formatPaise(u.bonusBalancePaise || 0)}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                          u.status === 'active'
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-red-500/15 text-red-400 border-red-500/30'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        onClick={() => handleToggleBlock(u.id)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                          u.status === 'active'
                            ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30'
                            : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30'
                        }`}
                      >
                        {u.status === 'active' ? 'Block' : 'Unblock'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 7: PRIVILEGED AUDIT LOGS                                              */}
      {/* ========================================================================= */}
      {activeTab === 'audits' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" />
                <span>Privileged Master & System Audit Logs</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Immutable records of administrative operations, settings mutations, and settlements.
              </p>
            </div>
            <span className="text-xs text-zinc-500 font-mono">
              Total Log Entries: {auditLogs.length}
            </span>
          </div>

          <div className="divide-y divide-zinc-800">
            {auditLogs.map((log) => (
              <div key={log.auditId} className="py-3 flex items-start justify-between gap-4 text-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-amber-400">{log.action}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">by {log.actorId}</span>
                  </div>
                  {log.newValue && (
                    <p className="text-zinc-300 text-[11px] font-mono">{log.newValue}</p>
                  )}
                  {log.oldValue && (
                    <p className="text-zinc-500 text-[10px] font-mono">Previous: {log.oldValue}</p>
                  )}
                </div>
                <span className="text-[10px] text-zinc-500 shrink-0">
                  {new Date(log.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
