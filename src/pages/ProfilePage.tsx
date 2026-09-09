import React, { useState } from 'react';
import {
  User,
  Award,
  Gamepad2,
  Trophy,
  Calendar,
  Volume2,
  VolumeX,
  ShieldCheck,
  LogOut,
  Sparkles,
  Smartphone,
  Edit3,
  Lock,
  Check,
  AlertCircle,
  X,
  Loader2,
  Database,
  FileCode,
} from 'lucide-react';
import { UserProfile, NavPage } from '../types.ts';
import { FirebaseStatusCard } from '../components/FirebaseStatusCard.tsx';
import { updateUserProfile } from '../firebase/firestoreService.ts';

interface ProfilePageProps {
  user: UserProfile | null;
  onLogout: () => void;
  onNavigate: (page: NavPage) => void;
  onUpdateProfile?: (updatedData: { displayName: string; avatar?: string }) => void;
}

const AVATAR_OPTIONS = [
  {
    id: 'av-1',
    src: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=150&auto=format&fit=crop&q=80',
    label: 'Cyber Raider',
  },
  {
    id: 'av-2',
    src: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    label: 'Neon Scout',
  },
  {
    id: 'av-3',
    src: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    label: 'Vortex Pilot',
  },
  {
    id: 'av-4',
    src: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    label: 'Apex Runner',
  },
];

export const ProfilePage: React.FC<ProfilePageProps> = ({
  user,
  onLogout,
  onNavigate,
  onUpdateProfile,
}) => {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState(user?.displayName || '');
  const [selectedAvatar, setSelectedAvatar] = useState(user?.avatar || AVATAR_OPTIONS[0].src);
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
          Sign in or create a free WINORA virtual gaming account to view personalized stats.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => onNavigate('login')}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs rounded-xl cursor-pointer"
          >
            Log In
          </button>
          <button
            onClick={() => onNavigate('register')}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs rounded-xl border border-zinc-700 cursor-pointer"
          >
            Register
          </button>
        </div>
      </div>
    );
  }

  const handleOpenEdit = () => {
    setEditDisplayName(user.displayName);
    setSelectedAvatar(user.avatar);
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

    // Call secure firestore update function: strictly displayName, updatedAt, avatar
    const res = await updateUserProfile(user.id, {
      displayName: cleanName,
      avatar: selectedAvatar,
    });

    setIsSaving(false);

    if (res.success) {
      setEditSuccess('Profile display updated in Firestore!');
      if (onUpdateProfile) {
        onUpdateProfile({
          displayName: cleanName,
          avatar: selectedAvatar,
        });
      }
      setTimeout(() => {
        setIsEditing(false);
        setEditSuccess(null);
      }, 1200);
    } else {
      setEditError(res.error || 'Failed to update profile. Check Firestore Security Rules.');
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-4xl mx-auto">
      {/* Header Card */}
      <div className="relative overflow-hidden rounded-3xl bg-zinc-900 border border-zinc-800 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
          <div className="relative">
            <img
              src={user.avatar}
              alt={user.displayName}
              className="w-20 h-20 rounded-2xl object-cover ring-2 ring-amber-400/50 shadow-lg"
            />
            <div className="absolute -bottom-2 -right-2 px-2 py-0.5 rounded-md bg-amber-500 text-zinc-950 text-[10px] font-black uppercase">
              LVL {user.level}
            </div>
          </div>

          <div className="flex-1">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
              <h1 className="font-display text-2xl font-black text-zinc-100">
                {user.displayName}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-bold">
                {user.tier} Rank
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-medium uppercase tracking-wider">
                {user.status || 'Active'}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400 font-mono text-[10px] border border-zinc-700">
                role: {user.role || 'player'}
              </span>
            </div>

            {/* Verified Mobile Number as sole identity */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-3">
              <div className="flex items-center gap-1.5 text-xs text-zinc-300 bg-zinc-950/80 px-2.5 py-1 rounded-xl border border-zinc-800">
                <Smartphone className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="font-mono font-semibold tracking-wide">
                  {user.phoneNumber}
                </span>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-lg">
                <ShieldCheck className="w-3 h-3" />
                <span>Verified Player</span>
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-zinc-400">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-zinc-400" /> Member since {user.joinedDate}
              </span>
              <span className="flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> WINORA Verified Member
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="profile-edit-btn"
              onClick={handleOpenEdit}
              className="px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Profile</span>
            </button>
            <button
              id="profile-logout-btn"
              onClick={onLogout}
              className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Edit Profile Modal Dialog */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-7 max-w-lg w-full space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display text-base font-bold text-zinc-100">
                    Edit Player Profile
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Update your visible display name and avatar (mobile identity is permanent)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            {editSuccess && (
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>{editSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-4">
              {/* Editable: Display Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                  <span>Display Name</span>
                  <span className="text-[11px] font-mono text-zinc-500">
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
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-700 text-zinc-100 text-sm focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
                <p className="text-[11px] text-zinc-400">
                  Allowed length: 2 to 50 characters. Stored securely under your verified account.
                </p>
              </div>

              {/* Editable: Avatar selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-300 block">
                  Choose Player Avatar
                </label>
                <div className="grid grid-cols-4 gap-2.5">
                  {AVATAR_OPTIONS.map((av) => (
                    <button
                      type="button"
                      key={av.id}
                      onClick={() => setSelectedAvatar(av.src)}
                      className={`relative rounded-xl overflow-hidden border-2 transition-all p-0.5 cursor-pointer ${
                        selectedAvatar === av.src
                          ? 'border-amber-400 shadow-md shadow-amber-500/20'
                          : 'border-zinc-800 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={av.src}
                        alt={av.label}
                        className="w-full aspect-square object-cover rounded-lg"
                      />
                      {selectedAvatar === av.src && (
                        <div className="absolute top-1 right-1 bg-amber-500 text-zinc-950 p-0.5 rounded-full">
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Read-Only Protected Security Fields Notice */}
              <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-2 text-xs">
                <div className="flex items-center gap-1.5 text-zinc-300 font-semibold">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Immutable Identity & Security Fields (Protected by Rules)</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-400 font-mono">
                  <div className="p-1.5 rounded bg-zinc-900 border border-zinc-800/80">
                    <span className="text-zinc-500 block">primary mobile:</span>
                    <span className="truncate block text-zinc-200 font-semibold" title={user.phoneNumber}>
                      {user.phoneNumber}
                    </span>
                  </div>
                  <div className="p-1.5 rounded bg-zinc-900 border border-zinc-800/80">
                    <span className="text-zinc-500 block">role:</span>
                    <span className="text-amber-400 font-semibold">{user.role || 'player'}</span>
                  </div>
                  <div className="p-1.5 rounded bg-zinc-900 border border-zinc-800/80">
                    <span className="text-zinc-500 block">status:</span>
                    <span className="text-emerald-400 font-semibold">{user.status || 'active'}</span>
                  </div>
                  <div className="p-1.5 rounded bg-zinc-900 border border-zinc-800/80">
                    <span className="text-zinc-500 block">joined:</span>
                    <span className="truncate block text-zinc-300">{user.joinedDate}</span>
                  </div>
                </div>
                <p className="text-[10px] text-zinc-500 italic">
                  Firestore security rules strictly protect your account. The mobile number, role, status, and join date cannot be altered.
                </p>
              </div>

              <div className="flex gap-2.5 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold cursor-pointer border border-zinc-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 text-xs font-bold cursor-pointer flex items-center gap-1.5 transition-colors"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving to Firestore...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Save Profile Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Database & Security Architecture Card */}
      <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-zinc-200 font-bold text-sm">
            <Database className="w-4 h-4 text-amber-400" />
            <span>WINORA Verified Identity & Security Architecture (STEP 5)</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
            Active Rules
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80 space-y-1.5">
            <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
              <FileCode className="w-3.5 h-3.5 text-amber-400" />
              Collection: <code className="text-amber-400 font-mono">users/{'{uid}'}</code>
            </span>
            <ul className="text-[11px] text-zinc-400 space-y-1 list-disc list-inside">
              <li><strong className="text-zinc-300">Read:</strong> Only authenticated owner (<code className="text-zinc-300">auth.uid == uid</code>)</li>
              <li><strong className="text-zinc-300">Cross-user Read:</strong> Strictly rejected (<code className="text-zinc-300">allow list: if false</code>)</li>
              <li><strong className="text-zinc-300">Creation:</strong> Role locked to <code className="text-emerald-400">player</code>, status locked to <code className="text-emerald-400">active</code></li>
            </ul>
          </div>

          <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80 space-y-1.5">
            <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Field-Level Permissions
            </span>
            <ul className="text-[11px] text-zinc-400 space-y-1 list-disc list-inside">
              <li><strong className="text-zinc-300">Editable:</strong> <code className="text-amber-400">displayName</code>, <code className="text-amber-400">avatar</code>, <code className="text-amber-400">updatedAt</code></li>
              <li><strong className="text-zinc-300">Immutable:</strong> <code className="text-red-400">uid</code>, <code className="text-red-400">role</code>, <code className="text-red-400">status</code>, <code className="text-red-400">createdAt</code></li>
              <li><strong className="text-zinc-300">Credentials:</strong> Password & OTP fields forbidden in DB</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Virtual Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-2xl">
          <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1">
            <Gamepad2 className="w-4 h-4 text-amber-400" />
            <span>Simulated Rounds</span>
          </div>
          <span className="font-display text-xl sm:text-2xl font-black text-zinc-100 tabular-nums">
            {user.stats.gamesPlayed}
          </span>
        </div>

        <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-2xl">
          <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>Best Virtual Win</span>
          </div>
          <span className="font-display text-xl sm:text-2xl font-black text-amber-400 tabular-nums">
            {user.stats.highestVirtualWin.toLocaleString()} <span className="text-xs">Pts</span>
          </span>
        </div>

        <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-2xl">
          <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1">
            <Award className="w-4 h-4 text-cyan-400" />
            <span>Demo Win Rate</span>
          </div>
          <span className="font-display text-xl sm:text-2xl font-black text-zinc-100">
            {user.stats.winRate}
          </span>
        </div>

        <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-2xl">
          <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1">
            <Smartphone className="w-4 h-4 text-emerald-400" />
            <span>Favorite Mode</span>
          </div>
          <span className="font-display text-base font-bold text-zinc-200 truncate block">
            {user.stats.favoriteCategory}
          </span>
        </div>
      </div>

      {/* Preferences & System Settings */}
      <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-5 space-y-4">
        <h3 className="font-display text-base font-bold text-zinc-100">
          Preferences & Controls
        </h3>

        <div className="flex items-center justify-between py-2 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-zinc-800 text-zinc-300">
              {soundEnabled ? (
                <Volume2 className="w-4 h-4" />
              ) : (
                <VolumeX className="w-4 h-4" />
              )}
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-semibold text-zinc-200">
                Interface Sound Effects
              </h4>
              <p className="text-[11px] text-zinc-400">
                Play simulated audio cues for rolls, clicks, and virtual awards
              </p>
            </div>
          </div>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`w-11 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
              soundEnabled ? 'bg-amber-500' : 'bg-zinc-800'
            }`}
          >
            <div
              className={`bg-zinc-950 w-4 h-4 rounded-full shadow-md transform transition-transform ${
                soundEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-semibold text-zinc-200">
                Social Play Assurance
              </h4>
              <p className="text-[11px] text-zinc-400">
                Account is verified under WINORA non-monetary virtual simulation standards
              </p>
            </div>
          </div>
          <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
            Verified
          </span>
        </div>
      </div>

      {/* Cloud & Firebase Architecture Status */}
      <FirebaseStatusCard />
    </div>
  );
};
