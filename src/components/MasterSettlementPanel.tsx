import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  FileText,
  Lock,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import {
  resultSettlementApi,
  RoundWithStats,
  GameResultRecord,
  SettlementSummary,
  SettlementAuditLog,
} from '../services/resultSettlementApi.ts';

interface MasterSettlementPanelProps {
  onToast: (msg: string) => void;
  actorId?: string;
  actorRole?: string;
}

export const MasterSettlementPanel: React.FC<MasterSettlementPanelProps> = ({
  onToast,
  actorId = 'master-admin',
  actorRole = 'master',
}) => {
  const [rounds, setRounds] = useState<RoundWithStats[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState<string>('');
  const [winningNumber, setWinningNumber] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [declaring, setDeclaring] = useState(false);
  const [auditLogs, setAuditLogs] = useState<SettlementAuditLog[]>([]);
  const [recentResults, setRecentResults] = useState<GameResultRecord[]>([]);
  const [settlementSuccessSummary, setSettlementSuccessSummary] = useState<SettlementSummary | null>(null);

  // Load rounds and logs
  const loadData = async () => {
    setLoading(true);
    const [roundsData, resultsData, logsData] = await Promise.all([
      resultSettlementApi.fetchRounds(),
      resultSettlementApi.fetchRecentResults(),
      resultSettlementApi.fetchAuditLogs(actorRole),
    ]);
    setRounds(roundsData);
    setRecentResults(resultsData);
    setAuditLogs(logsData);

    if (roundsData.length > 0 && !selectedRoundId) {
      // Default to the first FROZEN round or the first round
      const frozen = roundsData.find((r) => r.status === 'FROZEN');
      setSelectedRoundId(frozen ? frozen.id : roundsData[0].id);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const activeRound = rounds.find((r) => r.id === selectedRoundId) || rounds[0];

  // Freeze action
  const handleFreezeRound = async () => {
    if (!activeRound) return;
    setLoading(true);
    const res = await resultSettlementApi.freezeRound({
      gameId: activeRound.gameId,
      roundId: activeRound.id,
      actorId,
      actorRole,
    });
    onToast(res.message);
    await loadData();
    setLoading(false);
  };

  // Declare Result action
  const handleDeclareResult = async () => {
    if (!activeRound) return;
    if (!winningNumber || !/^\d{2}$/.test(winningNumber)) {
      onToast('Please select a valid 2-digit winning number (00–99).');
      return;
    }

    const isConfirmed = window.confirm(
      `CONFIRM RESULT DECLARATION:\n\n` +
      `Game: ${activeRound.gameName}\n` +
      `Round: #${activeRound.roundNumber} (${activeRound.id})\n` +
      `Winning Number: [${winningNumber}]\n\n` +
      `This will execute 90× demo payouts to all matching bids and 80% Green Protection for Hourly Dhamaka. Continue?`
    );
    if (!isConfirmed) return;

    setDeclaring(true);
    const res = await resultSettlementApi.declareResult({
      gameId: activeRound.gameId,
      roundId: activeRound.id,
      winningNumber,
      actorId,
      actorRole,
    });

    if (res.success && res.summary) {
      setSettlementSuccessSummary(res.summary);
      onToast(res.message);
      setWinningNumber('');
      await loadData();
    } else {
      onToast(res.message);
    }
    setDeclaring(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Disclaimer */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold text-amber-400 mb-1">
            <Trophy className="w-4 h-4" />
            <span>Master Authoritative Settlement Console (Step 13)</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-zinc-100 font-display">
            00–99 Result Declaration & Payout Engine
          </h2>
          <p className="text-xs text-zinc-400 mt-1 max-w-xl">
            Declare exact winning numbers for FROZEN rounds. The server automatically calculates 90× single-number returns, applies 80% Green Protection refunds, logs immutable audit records, and credits user demo wallets.
          </p>
        </div>

        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="px-3.5 py-2 rounded-xl text-xs font-bold bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-zinc-100 flex items-center gap-2 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Sync Live State</span>
        </button>
      </div>

      {/* Main Grid: Round Selector & Declaration Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Round Selector & Status */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider font-mono">
            Active Game Rounds ({rounds.length})
          </h3>

          <div className="space-y-2">
            {rounds.map((r) => {
              const isSelected = r.id === selectedRoundId;
              const isFrozen = r.status === 'FROZEN';
              const isCompleted = r.status === 'COMPLETED';

              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setSelectedRoundId(r.id);
                    setSettlementSuccessSummary(null);
                  }}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-500/40 text-zinc-100'
                      : 'bg-zinc-950 border-zinc-850 hover:border-zinc-700 text-zinc-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs">{r.gameName}</span>
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded uppercase font-mono ${
                        isCompleted
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : isFrozen
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 animate-pulse'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {r.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                    <span>Round #{r.roundNumber}</span>
                    <span>Pool: ₹{r.totalBidsPool.toLocaleString()} demo</span>
                  </div>

                  {isCompleted && r.resultNumber && (
                    <div className="text-[11px] text-emerald-400 font-bold">
                      Winner Declared: <span className="font-mono underline">[{r.resultNumber}]</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Round Freeze Action */}
          {activeRound && activeRound.status === 'OPEN' && (
            <div className="bg-amber-500/10 border border-amber-500/30 p-3.5 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                <AlertTriangle className="w-4 h-4" />
                <span>Round is currently OPEN</span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Rules require a 15-minute freeze before result declaration. You can manually freeze bidding now to test declaration.
              </p>
              <button
                type="button"
                onClick={handleFreezeRound}
                disabled={loading}
                className="w-full py-2.5 rounded-xl text-xs font-black bg-amber-500 text-zinc-950 hover:bg-amber-400 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Enforce 15-Min Freeze Now</span>
              </button>
            </div>
          )}
        </div>

        {/* Center/Right Column: 00-99 Winning Number Board & Declaration Execution */}
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-5">
          {activeRound ? (
            <>
              {/* Round Detail Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                      {activeRound.gameName}
                    </span>
                    <h3 className="text-lg font-black text-zinc-100 font-display">
                      Round #{activeRound.roundNumber} ({activeRound.id})
                    </h3>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Entries: <strong>{activeRound.entriesCount}</strong> • Total Pool:{' '}
                    <strong className="font-mono text-zinc-200">
                      ₹{activeRound.totalBidsPool.toLocaleString()} demo credits
                    </strong>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-xl text-xs font-black font-mono border ${
                      activeRound.status === 'FROZEN'
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                        : activeRound.status === 'COMPLETED'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-zinc-950 text-zinc-400 border-zinc-800'
                    }`}
                  >
                    STATUS: {activeRound.status}
                  </span>
                </div>
              </div>

              {/* Settlement Status Banner */}
              {activeRound.status === 'COMPLETED' ? (
                <div className="bg-emerald-950/40 border border-emerald-500/40 p-5 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    <span>This round is fully settled and COMPLETED</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div>
                      <span className="text-xs text-zinc-400 block">Winning Number</span>
                      <span className="text-3xl font-black font-mono text-emerald-300 bg-emerald-900/40 px-3 py-1 rounded-lg border border-emerald-500/50 inline-block mt-1">
                        {activeRound.resultNumber || activeRound.result?.winningNumber}
                      </span>
                    </div>
                    {activeRound.result?.summary && (
                      <div className="text-xs text-zinc-300 space-y-1">
                        <div>
                          Winning Bids:{' '}
                          <strong className="text-emerald-400">
                            {activeRound.result.summary.winningEntries}
                          </strong>{' '}
                          of {activeRound.result.summary.totalEntries}
                        </div>
                        <div>
                          Total Payout:{' '}
                          <strong className="font-mono text-emerald-300">
                            ₹{activeRound.result.summary.totalDemoRewards.toLocaleString()} demo
                          </strong>
                        </div>
                        <div className="text-[11px] text-zinc-400 font-mono">
                          Settlement ID: {activeRound.result.summary.settlementId}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : activeRound.status !== 'FROZEN' ? (
                <div className="bg-zinc-950 border border-zinc-800 p-6 rounded-2xl text-center space-y-3">
                  <Lock className="w-10 h-10 mx-auto text-amber-500/60" />
                  <h4 className="text-sm font-bold text-zinc-200">
                    Bidding Must Be Frozen Prior to Declaration
                  </h4>
                  <p className="text-xs text-zinc-400 max-w-md mx-auto">
                    The WINORA 15-minute freeze cutoff ensures deterministic result declaration.
                    Please wait for the automatic freeze deadline or click "Enforce 15-Min Freeze Now".
                  </p>
                </div>
              ) : (
                /* FROZEN Round: Master 00-99 Selector */
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider block">
                        Select Exactly One Winning Number (00–99)
                      </span>
                      <span className="text-[11px] text-zinc-400">
                        Numbers 00–49 are Green (qualify for 80% Green Protection in Hourly Dhamaka)
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-400">Selected Winner:</span>
                      <span className="font-mono text-lg font-black px-3 py-1 rounded-lg bg-amber-500 text-zinc-950">
                        {winningNumber || '--'}
                      </span>
                    </div>
                  </div>

                  {/* 10x10 Number Board for Master */}
                  <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800 max-h-72 overflow-y-auto">
                    <div className="grid grid-cols-10 gap-1 sm:gap-1.5">
                      {Array.from({ length: 100 }, (_, i) => {
                        const numStr = i.toString().padStart(2, '0');
                        const isGreen = i < 50;
                        const isSelected = winningNumber === numStr;

                        return (
                          <button
                            key={numStr}
                            type="button"
                            onClick={() => setWinningNumber(numStr)}
                            className={`h-9 sm:h-10 rounded-lg font-mono text-xs sm:text-sm font-black transition-all cursor-pointer flex flex-col items-center justify-center ${
                              isSelected
                                ? 'bg-amber-400 text-zinc-950 scale-105 ring-2 ring-amber-300 shadow-lg font-black z-10'
                                : isGreen && activeRound.gameId === 'hourly_dhamaka'
                                ? 'bg-emerald-950/50 text-emerald-300 hover:bg-emerald-900/60 border border-emerald-800/40'
                                : 'bg-zinc-900 text-zinc-300 hover:bg-zinc-800 border border-zinc-800'
                            }`}
                          >
                            <span>{numStr}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Execution Action Button */}
                  <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="text-xs text-zinc-400">
                      <div>
                        Target: <strong className="text-zinc-200">{activeRound.gameName}</strong>
                      </div>
                      <div>
                        Winning Number:{' '}
                        <strong className="text-amber-400 font-mono">
                          {winningNumber ? `[${winningNumber}]` : 'None Selected'}
                        </strong>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleDeclareResult}
                      disabled={declaring || !winningNumber}
                      className={`px-6 py-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        !winningNumber || declaring
                          ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700'
                          : 'bg-gradient-to-r from-amber-500 to-amber-400 text-zinc-950 hover:brightness-110 shadow-lg shadow-amber-500/20 active:scale-[0.98]'
                      }`}
                    >
                      {declaring ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Executing Settlement Engine...</span>
                        </>
                      ) : (
                        <>
                          <Trophy className="w-4 h-4" />
                          <span>Confirm #{winningNumber} & Execute Settlement</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Settlement Success Dialog / Card */}
              {settlementSuccessSummary && (
                <div className="bg-gradient-to-br from-emerald-950/60 via-zinc-900 to-zinc-950 border border-emerald-500/40 p-5 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                      <Sparkles className="w-5 h-5" />
                      <span>Settlement Executed Successfully!</span>
                    </div>
                    <span className="font-mono text-xs text-zinc-400">
                      ID: {settlementSuccessSummary.settlementId}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                      <span className="text-[10px] uppercase font-bold text-zinc-400 block">Winning Number</span>
                      <span className="font-mono font-black text-xl text-emerald-300">
                        {settlementSuccessSummary.winningNumber}
                      </span>
                    </div>

                    <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                      <span className="text-[10px] uppercase font-bold text-zinc-400 block">Winning Bids</span>
                      <span className="font-mono font-black text-xl text-zinc-100">
                        {settlementSuccessSummary.winningEntries} / {settlementSuccessSummary.totalEntries}
                      </span>
                    </div>

                    <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                      <span className="text-[10px] uppercase font-bold text-zinc-400 block">90× Payout</span>
                      <span className="font-mono font-black text-lg text-emerald-400">
                        ₹{settlementSuccessSummary.total90xRewards.toLocaleString()}
                      </span>
                    </div>

                    <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                      <span className="text-[10px] uppercase font-bold text-zinc-400 block">Total Credited</span>
                      <span className="font-mono font-black text-lg text-amber-300">
                        ₹{settlementSuccessSummary.totalDemoRewards.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="py-12 text-center text-xs text-zinc-400">
              Select an active game round to inspect.
            </div>
          )}
        </div>
      </div>

      {/* Bottom Section: Audit Log & Recent Declared Results */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Immutable Audit Trail */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider font-mono flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Immutable Settlement Audit Logs</span>
            </h3>
            <span className="text-xs text-zinc-400 font-mono">
              Events: {auditLogs.length}
            </span>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {auditLogs.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-500">
                No audit events logged yet.
              </div>
            ) : (
              auditLogs.slice(0, 10).map((log) => (
                <div
                  key={log.auditId}
                  className="bg-zinc-950 p-3 rounded-xl border border-zinc-850 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`font-mono font-bold px-2 py-0.5 rounded text-[10px] ${
                        log.event === 'REWARD_SETTLED'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : log.event === 'RESULT_DECLARED'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-rose-500/20 text-rose-300'
                      }`}
                    >
                      {log.event}
                    </span>
                    <span className="text-[11px] text-zinc-500 font-mono">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-[11px] text-zinc-300 flex items-center gap-2">
                    <span>Round: <strong className="font-mono">{log.roundId}</strong></span>
                    <span>•</span>
                    <span>Actor: <strong className="font-mono">{log.actor}</strong></span>
                  </div>
                  {log.entryReference && (
                    <div className="text-[10px] text-zinc-400 font-mono">
                      Ref: {log.entryReference} • Credited: ₹{log.details?.totalCredited || log.details?.amount || 0} demo
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recently Declared Results Archive */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-zinc-200 uppercase tracking-wider font-mono flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-400" />
              <span>Declared Results Archive</span>
            </h3>
            <span className="text-xs text-zinc-400 font-mono">
              Records: {recentResults.length}
            </span>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {recentResults.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-500">
                No declared results in history yet.
              </div>
            ) : (
              recentResults.map((res) => (
                <div
                  key={res.resultId}
                  className="bg-zinc-950 p-3 rounded-xl border border-zinc-850 text-xs flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-100">{res.gameName}</span>
                      <span className="text-[11px] text-zinc-400 font-mono">
                        Round #{res.roundNumber}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-0.5">
                      Declared by <span className="text-zinc-300 font-mono">{res.declaredBy}</span> at{' '}
                      {new Date(res.declaredAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-zinc-400 block">Winner</span>
                    <span className="font-mono font-black text-xl text-emerald-400">
                      [{res.winningNumber}]
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
