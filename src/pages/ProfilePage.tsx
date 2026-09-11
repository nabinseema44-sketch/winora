import React, { useState } from 'react';
import {
  User,
  ShieldCheck,
  LogOut,
  Smartphone,
  Edit3,
  Check,
  AlertCircle,
  X,
  Loader2,
  Wallet,
  History,
  Gamepad2,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { UserProfile, NavPage } from '../types.ts';
import { updateUserProfile } from '../firebase/firestoreService.ts';

interface ProfilePageProps {
  user: UserProfile | null;
  onLogout: () => void;
  onNavigate: (page: NavPage) => void;
  onUpdateProfile?: (updatedData: { displayName: string }) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  user,
  onLogout,
  onNavigate,
  onUpdateProfile,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState(user?.displayName || '');
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);

  if (!user) {
    return (
      <div className="text-center py-16 bg-zinc-900/60 border border-zinc-800 rounded-3xl p-8 max-w-md mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-zinc-800 text-zinc-400 flex items-center justify-center mx-auto mb-4">
          <User className="w-7 h-7" />
        </div>
        <h2 className="font-display text-xl font-bold text-zinc-100 mb-2">
          No Player Profile Active
        </h2>
        <p className="text-xs text-zinc-400 mb-6">
          Sign in or create your verified WINORA mobile account to start playing.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => onNavigate('login')}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-xl cursor-pointer transition-colors"
          >
            Log In
          </button>
          <button
            onClick={() => onNavigate('register')}
            className="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs rounded-xl border border-zinc-700 cursor-pointer transition-colors"
          >
            Register
          </button>
        </div>
      </div>
    );
  }

  const handleOpenEdit = () => {
    setEditDisplayName(user.displayName);
    setEditError(null);
    setEditSuccess(null);
    setIsEditing(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = editDisplayName.trim();
    if (cleanName.length < 2 || cleanName.length > 50) {
      setEditError('Display name must be between 2 and 50 characters.');
      return;
    }

    setIsSaving(true);
    setEditError(null);
    setEditSuccess(null);

    // Call secure firestore update function: strictly displayName, updatedAt
    const res = await updateUserProfile(user.id, {
      displayName: cleanName,
    });

    setIsSaving(false);

    if (res.success) {
      setEditSuccess('Profile display updated successfully!');
      if (onUpdateProfile) {
        onUpdateProfile({ displayName: cleanName });
      }
      setTimeout(() => {
        setIsEditing(false);
        setEditSuccess(null);
      }, 1000);
    } else {
      setEditError(res.error || 'Failed to update profile. Check connection.');
    }
  };

  const withdrawableRupees = ((user.withdrawableBalancePaise || 0) / 100).toFixed(2);
  const bonusRupees = ((user.bonusBalancePaise || 0) / 100).toFixed(2);

  // Compute initials for the clean avatar replacement
  const initials = user.displayName
    ? user.displayName
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'WP';

  return (
    <div className="space-y-4 max-w-lg mx-auto pb-16 px-1 sm:px-0">
      {/* 1. Clean Mobile User Profile Card */}
      <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-4">
          {/* Typographic Identity Badge (No avatar image) */}
          <div className="w-16 h-16 rounded-2xl bg-zinc-800 border-2 border-amber-500/40 flex items-center justify-center text-amber-400 font-display font-black text-xl shadow-inner shrink-0">
            {initials}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="font-display text-lg sm:text-xl font-black text-zinc-100 truncate">
                {user.displayName}
              </h1>
              <span className="shrink-0 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold uppercase">
                Active
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-zinc-300 mt-1">
              <Smartphone className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="font-mono font-semibold tracking-wide truncate">
                {user.phoneNumber}
              </span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 ml-1" />
            </div>

            <p className="text-[11px] text-zinc-400 mt-0.5">
              Member since {user.joinedDate || '2026'}
            </p>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-zinc-800/80">
          <button
            id="profile-edit-btn"
            onClick={handleOpenEdit}
            className="w-full py-2.5 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-750 text-zinc-200 border border-zinc-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Edit3 className="w-3.5 h-3.5 text-amber-400" />
            <span>Edit Name</span>
          </button>
          <button
            id="profile-logout-btn"
            onClick={onLogout}
            className="w-full py-2.5 px-3 rounded-xl bg-red-950/30 hover:bg-red-950/50 text-red-400 border border-red-500/30 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* 2. Clean Mobile Wallet 00 Card */}
      <div className="bg-gradient-to-br from-amber-500/10 via-zinc-900 to-zinc-950 border border-amber-500/30 rounded-3xl p-5 shadow-lg space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
            <Wallet className="w-4 h-4" />
            <span>Account Balance</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 font-mono">
            COIN WALLET 00
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-3">
            <span className="text-[10px] uppercase font-bold text-emerald-400 block">
              Withdrawable
            </span>
            <span className="font-display text-2xl font-black text-zinc-100 tabular-nums">
              ₹{withdrawableRupees}
            </span>
          </div>

          <div className="bg-zinc-950/80 border border-zinc-800/80 rounded-2xl p-3">
            <span className="text-[10px] uppercase font-bold text-amber-400 block">
              Bonus Balance
            </span>
            <span className="font-display text-2xl font-black text-amber-400 tabular-nums">
              ₹{bonusRupees}
            </span>
          </div>
        </div>

        <button
          onClick={() => onNavigate('wallet')}
          className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
        >
          <span>Open Coin Wallet & Transfers</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 3. Fast Navigation Shortcuts */}
      <div className="bg-zinc-900/80 border border-zinc-800 rounded-3xl p-3 space-y-1">
        <button
          onClick={() => onNavigate('games')}
          className="w-full p-3 rounded-2xl hover:bg-zinc-800/80 flex items-center justify-between text-left transition-colors cursor-pointer group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400">
              <Gamepad2 className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-zinc-200">Play Games & Draws</h4>
              <p className="text-[11px] text-zinc-400">Hourly Play, Kalyan Morning, Day & Night</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-amber-400 transition-colors" />
        </button>

        <button
          onClick={() => onNavigate('history')}
          className="w-full p-3 rounded-2xl hover:bg-zinc-800/80 flex items-center justify-between text-left transition-colors cursor-pointer group"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-400">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-zinc-200">30-Day Activity Ledger</h4>
              <p className="text-[11px] text-zinc-400">Real-world bidding records, results & payouts</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-cyan-400 transition-colors" />
        </button>
      </div>

      {/* Edit Profile Modal Dialog */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2 text-zinc-100 font-bold text-sm">
                <Edit3 className="w-4 h-4 text-amber-400" />
                <span>Edit Display Name</span>
              </div>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="p-2.5 rounded-xl bg-red-950/50 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            {editSuccess && (
              <div className="p-2.5 rounded-xl bg-emerald-950/50 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>{editSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                  <span>Display Name</span>
                  <span className="text-[10px] font-mono text-zinc-500">
                    {editDisplayName.trim().length} / 50
                  </span>
                </label>
                <input
                  type="text"
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  maxLength={50}
                  minLength={2}
                  required
                  placeholder="e.g. LuckySpinner, WinoraAce"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-zinc-100 text-sm focus:border-amber-400 focus:outline-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-400 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Verified Mobile:</span>
                  <span className="font-mono text-zinc-200 font-semibold">{user.phoneNumber}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500">Role:</span>
                  <span className="text-emerald-400 font-semibold uppercase">{user.role || 'player'}</span>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold cursor-pointer border border-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 text-xs font-bold cursor-pointer flex items-center gap-1.5"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
