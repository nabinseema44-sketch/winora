import React, { useState, useEffect } from 'react';
import {
  X,
  Clock,
  AlertTriangle,
  Coins,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  HelpCircle,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import {
  WinoraGameConfig,
  GameRound,
  UserProfile,
} from '../types.ts';
import { winoraEngine, isNumberGreen } from '../services/winoraEngine.ts';

interface BiddingEngineModalProps {
  game: WinoraGameConfig;
  round: GameRound;
  user: UserProfile;
  onClose: () => void;
  onSuccessToast: (msg: string) => void;
}

export const BiddingEngineModal: React.FC<BiddingEngineModalProps> = ({
  game,
  round,
  user,
  onClose,
  onSuccessToast,
}) => {
  // Numbers selected with their individual bid amount: map of number (0-99) -> amount
  const [bidsMap, setBidsMap] = useState<Record<number, number>>({});
  const [activeNumber, setActiveNumber] = useState<number | null>(null);
  const [quickAmount, setQuickAmount] = useState<number>(100);
  const [walletChoice, setWalletChoice] = useState<'bonus' | 'main'>('bonus');
  const [timeLeftStr, setTimeLeftStr] = useState<string>('');
  const [isFrozen, setIsFrozen] = useState<boolean>(false);
  const [secondsToFreeze, setSecondsToFreeze] = useState<number>(0);
  const [filterMode, setFilterMode] = useState<'all' | 'green' | 'red' | 'selected'>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Live Countdown Clock to Result Time & 15-Minute Freeze Check
  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now();
      const declareMs = new Date(round.declareTime).getTime();
      const freezeMs = new Date(round.freezeTime).getTime();

      const diffDeclare = declareMs - now;
      const diffFreeze = freezeMs - now;

      if (diffFreeze <= 0 || round.status === 'frozen' || round.status === 'completed') {
        setIsFrozen(true);
        setSecondsToFreeze(0);
        // Show time until final declaration
        if (diffDeclare > 0) {
          const m = Math.floor(diffDeclare / 60000);
          const s = Math.floor((diffDeclare % 60000) / 1000);
          setTimeLeftStr(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
        } else {
          setTimeLeftStr('00:00 (Declaring)');
        }
      } else {
        setIsFrozen(false);
        setSecondsToFreeze(Math.floor(diffFreeze / 1000));
        const m = Math.floor(diffFreeze / 60000);
        const s = Math.floor((diffFreeze % 60000) / 1000);
        setTimeLeftStr(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [round]);

  // Handle number click on grid
  const handleToggleNumber = (num: number) => {
    if (isFrozen) return;
    setBidsMap((prev) => {
      const copy = { ...prev };
      if (copy[num]) {
        delete copy[num];
      } else {
        copy[num] = quickAmount;
      }
      return copy;
    });
    setActiveNumber(num);
  };

  const handleSetAmountForNumber = (num: number, amt: number) => {
    if (isFrozen) return;
    setBidsMap((prev) => {
      const copy = { ...prev };
      if (amt <= 0) {
        delete copy[num];
      } else {
        copy[num] = amt;
      }
      return copy;
    });
  };

  const handleApplyQuickAmountToAllSelected = (amt: number) => {
    setQuickAmount(amt);
    setBidsMap((prev) => {
      const updated: Record<number, number> = {};
      Object.keys(prev).forEach((k) => {
        updated[Number(k)] = amt;
      });
      return updated;
    });
  };

  const handleSelectBatch = (type: 'all-green' | 'all-red' | 'clear') => {
    if (isFrozen) return;
    if (type === 'clear') {
      setBidsMap({});
      return;
    }
    const newBids: Record<number, number> = {};
    for (let i = 0; i < 100; i++) {
      const green = isNumberGreen(i);
      if (type === 'all-green' && green) {
        newBids[i] = quickAmount;
      } else if (type === 'all-red' && !green) {
        newBids[i] = quickAmount;
      }
    }
    setBidsMap(newBids);
  };

  // Calculations
  const selectedNumbers = Object.keys(bidsMap).map(Number);
  const totalBidsCount = selectedNumbers.length;
  const totalBetAmount = selectedNumbers.reduce((sum, n) => sum + (bidsMap[n] || 0), 0);
  const isDhamaka = game.hasGreenRefund;

  // Potential returns
  const maxSingleBet = selectedNumbers.length > 0 ? Math.max(...selectedNumbers.map((n) => bidsMap[n] || 0)) : 0;
  const potentialSingleWin = maxSingleBet * game.payoutMultiplier;

  // Green refund preview for Dhamaka:
  // If user bet on Green numbers, and that green number doesn't win, 80% is refunded!
  const greenBids = selectedNumbers.filter((n) => isNumberGreen(n));
  const greenBetAmount = greenBids.reduce((sum, n) => sum + (bidsMap[n] || 0), 0);
  const greenRefundPreview = Math.round(greenBetAmount * 0.8);

  const availableBalance = walletChoice === 'bonus' ? user.bonusBalance : user.mainBalance;

  const handleSubmitBids = () => {
    if (isFrozen) return;
    if (totalBidsCount === 0) return;
    if (availableBalance < totalBetAmount) {
      onSuccessToast(`Insufficient ${walletChoice === 'bonus' ? 'Bonus' : 'Main'} Wallet balance.`);
      return;
    }

    setIsSubmitting(true);
    const bidsPayload = selectedNumbers.map((n) => ({
      number: n,
      amount: bidsMap[n] || quickAmount,
    }));

    const res = winoraEngine.placeBids({
      gameId: game.id,
      bids: bidsPayload,
      walletType: walletChoice,
    });

    setIsSubmitting(false);
    if (res.success) {
      onSuccessToast(res.message);
      onClose();
    } else {
      onSuccessToast(res.message);
    }
  };

  return (
    <div
      id="bidding-engine-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
    >
      <div
        id="bidding-engine-modal"
        className="bg-zinc-900 border border-zinc-750 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh]"
      >
        {/* Header with Game Info & Live 15-Min Freeze Timer */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-zinc-900 via-zinc-850 to-zinc-900 border-b border-zinc-800 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {game.code}
              </span>
              <h2 className="text-lg sm:text-xl font-black text-zinc-100 font-display">
                {game.name}
              </h2>
              <span className="text-xs font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30">
                90× Payout
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">{game.subtitle}</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Freeze Countdown */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold ${
                isFrozen
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                  : secondsToFreeze < 300
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-zinc-800 text-zinc-200 border-zinc-700'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <div className="flex flex-col text-right leading-none">
                <span className="text-[9px] uppercase tracking-wider text-zinc-400">
                  {isFrozen ? 'Bidding Frozen' : 'Freeze In'}
                </span>
                <span className="font-mono text-xs sm:text-sm font-black">{timeLeftStr}</span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-100 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 15-Minute Freeze Notice Banner */}
        {isFrozen ? (
          <div className="bg-rose-500/15 border-b border-rose-500/30 px-4 py-2.5 flex items-center gap-2 text-xs text-rose-300 font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>
              <strong>Bidding strictly frozen:</strong> Rules mandate all bids close 15 minutes prior to draw time. Next round opens immediately upon result declaration.
            </span>
          </div>
        ) : (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center justify-between text-xs text-amber-300/90 font-medium">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              15-minute cutoff rule active. Bids accepted until freeze time.
            </span>
            {isDhamaka && (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                80% Green Refund Protected
              </span>
            )}
          </div>
        )}

        {/* Modal Scrollable Body */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {/* Dual Wallet Selector */}
          <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-bold uppercase text-zinc-400 tracking-wider">
                Select Deduction Wallet:
              </span>
              <p className="text-xs text-zinc-400">
                Play using non-withdrawable bonus coins or withdrawable main coins.
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setWalletChoice('bonus')}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  walletChoice === 'bonus'
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/50 shadow-sm'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                }`}
              >
                <Coins className="w-3.5 h-3.5 text-purple-400" />
                <span>Bonus Wallet: ₹{user.bonusBalance.toLocaleString()}</span>
              </button>

              <button
                type="button"
                onClick={() => setWalletChoice('main')}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  walletChoice === 'main'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200'
                }`}
              >
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                <span>Main Wallet: ₹{user.mainBalance.toLocaleString()}</span>
              </button>
            </div>
          </div>

          {/* Quick Amount Controls & Grid Filters */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* Quick Stake Chips */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-zinc-400 font-semibold mr-1">Stake / No:</span>
              {[50, 100, 200, 500, 1000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => handleApplyQuickAmountToAllSelected(amt)}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold border transition-all cursor-pointer ${
                    quickAmount === amt
                      ? 'bg-amber-500 text-zinc-950 border-amber-400 shadow-sm'
                      : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-750'
                  }`}
                >
                  ₹{amt}
                </button>
              ))}
            </div>

            {/* Batch Select Controls for Hourly Dhamaka */}
            {isDhamaka && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleSelectBatch('all-green')}
                  disabled={isFrozen}
                  className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors cursor-pointer disabled:opacity-50"
                >
                  + All Green (00–49)
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectBatch('all-red')}
                  disabled={isFrozen}
                  className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25 transition-colors cursor-pointer disabled:opacity-50"
                >
                  + All Red (50–99)
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectBatch('clear')}
                  className="px-2 py-1 rounded-md text-[11px] font-bold bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-700 transition-colors cursor-pointer"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* 00 to 99 Number Matrix Grid */}
          <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  00–99 Number Matrix
                </span>
                {isDhamaka && (
                  <div className="flex items-center gap-2 text-[10px] font-bold">
                    <span className="text-emerald-400 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> 00–49 Green (80% Refund)
                    </span>
                    <span className="text-rose-400 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" /> 50–99 Red (90× Only)
                    </span>
                  </div>
                )}
              </div>
              <span className="text-xs text-zinc-400 font-mono">
                {selectedNumbers.length} Selected
              </span>
            </div>

            {/* 10x10 Grid */}
            <div className="grid grid-cols-10 gap-1 sm:gap-1.5 max-h-72 overflow-y-auto p-1 bg-zinc-900/60 rounded-lg border border-zinc-800/80">
              {Array.from({ length: 100 }, (_, i) => {
                const isSelected = bidsMap[i] !== undefined;
                const isGreen = isDhamaka ? isNumberGreen(i) : false;
                const bidAmt = bidsMap[i];

                return (
                  <button
                    key={i}
                    type="button"
                    disabled={isFrozen}
                    onClick={() => handleToggleNumber(i)}
                    className={`relative p-1 sm:p-2 rounded-lg text-center transition-all flex flex-col items-center justify-center cursor-pointer disabled:cursor-not-allowed ${
                      isSelected
                        ? 'bg-amber-500 text-zinc-950 font-black shadow-md scale-95 ring-2 ring-amber-300'
                        : isDhamaka
                        ? isGreen
                          ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-900/50'
                          : 'bg-rose-950/30 text-rose-300 border border-rose-500/30 hover:bg-rose-900/50'
                        : 'bg-zinc-850 text-zinc-300 border border-zinc-800 hover:border-amber-500/40 hover:bg-zinc-800'
                    } ${isFrozen ? 'opacity-50' : ''}`}
                  >
                    <span className="font-mono text-xs sm:text-sm font-bold leading-none">
                      {i.toString().padStart(2, '0')}
                    </span>
                    {isSelected && (
                      <span className="text-[9px] font-black leading-none mt-0.5">
                        ₹{bidAmt}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Number Custom Amount Modifier */}
          {activeNumber !== null && bidsMap[activeNumber] !== undefined && !isFrozen && (
            <div className="bg-zinc-850 p-3 rounded-xl border border-zinc-700 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-base font-black px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  #{activeNumber.toString().padStart(2, '0')}
                </span>
                <span className="text-xs text-zinc-300 font-semibold">
                  Adjust Stake for Number #{activeNumber.toString().padStart(2, '0')}:
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="10"
                  max="10000"
                  step="50"
                  value={bidsMap[activeNumber] || ''}
                  onChange={(e) => handleSetAmountForNumber(activeNumber, Number(e.target.value))}
                  className="w-24 bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1 text-xs text-zinc-100 font-mono font-bold focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={() => handleToggleNumber(activeNumber)}
                  className="text-xs text-rose-400 hover:text-rose-300 px-2 py-1 rounded bg-rose-500/10 border border-rose-500/20 cursor-pointer"
                >
                  Remove
                </button>
              </div>
            </div>
          )}

          {/* Real-Time Live Calculations & Payout Previews */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Total Stake */}
            <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
              <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                Total Stake ({totalBidsCount} Nos)
              </span>
              <p className="text-lg font-black text-zinc-100 font-mono mt-0.5">
                ₹{totalBetAmount.toLocaleString()}
              </p>
              <span className="text-[10px] text-zinc-400">
                From: {walletChoice === 'bonus' ? 'Bonus Wallet' : 'Main Wallet'}
              </span>
            </div>

            {/* 90x Payout Preview */}
            <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
              <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                90× Payout on Match
              </span>
              <p className="text-lg font-black text-emerald-400 font-mono mt-0.5">
                ₹{potentialSingleWin.toLocaleString()}
              </p>
              <span className="text-[10px] text-zinc-400">
                Credited directly to Main Wallet
              </span>
            </div>

            {/* 80% Green Refund Preview (Hourly Dhamaka) */}
            <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
              <span className="text-[10px] uppercase font-bold text-cyan-400 tracking-wider flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                {isDhamaka ? '80% Green Protection' : 'Standard Game'}
              </span>
              <p className="text-lg font-black text-cyan-300 font-mono mt-0.5">
                {isDhamaka ? `₹${greenRefundPreview.toLocaleString()}` : 'N/A'}
              </p>
              <span className="text-[10px] text-zinc-400">
                {isDhamaka ? `On ${greenBids.length} Green bids if result non-match` : 'Direct 90× multiplier only'}
              </span>
            </div>
          </div>
        </div>

        {/* Modal Footer / Action Button */}
        <div className="p-4 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-xs text-zinc-400">
              Balance: ₹{availableBalance.toLocaleString()} ({walletChoice === 'bonus' ? 'Bonus' : 'Main'})
            </span>
            {totalBetAmount > availableBalance && (
              <span className="text-xs text-rose-400 font-bold">
                Insufficient coins (Need ₹{(totalBetAmount - availableBalance).toLocaleString()} more)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-zinc-200 bg-zinc-900 border border-zinc-800 cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={isFrozen || totalBidsCount === 0 || totalBetAmount > availableBalance || isSubmitting}
              onClick={handleSubmitBids}
              className="px-6 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 to-amber-400 text-zinc-950 hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
            >
              {isFrozen ? (
                <>
                  <AlertTriangle className="w-4 h-4" />
                  Bidding Frozen
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Confirm {totalBidsCount} Bid(s) (₹{totalBetAmount.toLocaleString()})
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
