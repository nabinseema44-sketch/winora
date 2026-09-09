import React, { useState, useEffect } from 'react';
import {
  Phone,
  UserPlus,
  ShieldCheck,
  Gift,
  Check,
  AlertCircle,
  Loader2,
  KeyRound,
  RotateCcw,
  ArrowRight,
  Edit2,
  ChevronDown,
  User,
} from 'lucide-react';
import { Logo } from '../components/Logo.tsx';
import { NavPage } from '../types.ts';
import { isFirebaseConfigured } from '../firebase/config.ts';
import {
  sendPhoneOtp,
  verifyPhoneOtp,
  getOrCreateRecaptchaVerifier,
  clearRecaptchaVerifier,
} from '../firebase/authService.ts';
import { createUserProfile } from '../firebase/firestoreService.ts';
import {
  COUNTRY_CODES,
  formatToE164,
  formatPhoneDisplay,
  isValidNationalNumber,
} from '../utils/phoneUtils.ts';
import { isSmsRegionPolicyError } from '../firebase/errorHandling.ts';
import { SmsRegionHelper } from '../components/SmsRegionHelper.tsx';
import type { ConfirmationResult } from 'firebase/auth';

interface RegisterPageProps {
  onRegisterSuccess: (displayName: string, phoneNumber: string, avatar: string) => void;
  onNavigate: (page: NavPage) => void;
}

const AVATAR_PRESETS = [
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
];

export const RegisterPage: React.FC<RegisterPageProps> = ({
  onRegisterSuccess,
  onNavigate,
}) => {
  // Registration Steps: 'phone' | 'otp'
  const [step, setStep] = useState<'phone' | 'otp'>('phone');

  // Phone Inputs
  const [selectedCountryCode, setSelectedCountryCode] = useState('+91');
  const [nationalNumber, setNationalNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [displayName, setDisplayName] = useState('');

  // Profile preferences
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_PRESETS[0].src);
  const [termsAgreed, setTermsAgreed] = useState(true);

  // States
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState<number>(0);

  const formattedE164 = formatToE164(selectedCountryCode, nationalNumber);

  // Resend OTP countdown timer
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setTimeout(() => {
      setResendCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  // Clean up reCAPTCHA on unmount
  useEffect(() => {
    return () => {
      clearRecaptchaVerifier();
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Step 1: Send Registration OTP
  // ---------------------------------------------------------------------------
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!nationalNumber.trim()) {
      setErrorMessage('Please enter your mobile phone number.');
      return;
    }

    if (!isValidNationalNumber(nationalNumber)) {
      setErrorMessage('Please enter a valid mobile number (7 to 14 digits).');
      return;
    }

    if (!termsAgreed) {
      setErrorMessage('Please accept the Virtual Amusement Policy & Terms.');
      return;
    }

    if (!isFirebaseConfigured()) {
      setErrorMessage(
        'Firebase is not yet configured with valid project credentials in .env. Please configure your Firebase credentials.'
      );
      return;
    }

    setLoading(true);

    try {
      const verifier = getOrCreateRecaptchaVerifier('register-recaptcha-container', 'invisible');
      if (!verifier) {
        setLoading(false);
        setErrorMessage('Failed to initialize security verification. Please refresh and try again.');
        return;
      }

      const res = await sendPhoneOtp(formattedE164, verifier);
      setLoading(false);

      if (res.success && res.data) {
        setConfirmationResult(res.data);
        setStep('otp');
        setResendCountdown(30);
        setSuccessMessage(`OTP verification code sent via SMS to ${formatPhoneDisplay(formattedE164)}.`);
      } else {
        clearRecaptchaVerifier();
        setErrorMessage(res.error || 'Failed to send SMS verification code.');
      }
    } catch (err) {
      setLoading(false);
      clearRecaptchaVerifier();
      setErrorMessage('An unexpected error occurred sending OTP.');
    }
  };

  // ---------------------------------------------------------------------------
  // Step 2: Verify OTP & Initialize Player Profile
  // ---------------------------------------------------------------------------
  const handleVerifyAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmationResult) {
      setErrorMessage('OTP session expired. Please request a new code.');
      setStep('phone');
      return;
    }

    const cleanOtp = otpCode.replace(/\D/g, '');
    if (cleanOtp.length !== 6) {
      setErrorMessage('Please enter the full 6-digit OTP code.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const fallbackName = `Player ••${formattedE164.slice(-4)}`;
    const finalDisplayName = displayName.trim().length > 0 ? displayName.trim() : fallbackName;

    const res = await verifyPhoneOtp(confirmationResult, cleanOtp, finalDisplayName);

    if (res.success && res.data) {
      const firebaseUser = res.data;
      const verifiedPhone = firebaseUser.phoneNumber || formattedE164;

      // Create corresponding user document in Firestore: users/{uid}
      // Strictly stores: uid, phoneNumber, displayName, role: "player", status: "active", createdAt, updatedAt
      // NEVER stores password or OTP code
      await createUserProfile(firebaseUser.uid, {
        phoneNumber: verifiedPhone,
        displayName: finalDisplayName,
        avatar: selectedAvatar,
        tier: 'Bronze',
        level: 1,
      });

      setLoading(false);
      onRegisterSuccess(finalDisplayName, verifiedPhone, selectedAvatar);
    } else {
      setLoading(false);
      setErrorMessage(res.error || 'Invalid verification code. Please check and try again.');
    }
  };

  // ---------------------------------------------------------------------------
  // Resend OTP
  // ---------------------------------------------------------------------------
  const handleResendOtp = async () => {
    if (resendCountdown > 0 || loading) return;
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      clearRecaptchaVerifier();
      const verifier = getOrCreateRecaptchaVerifier('register-recaptcha-container', 'invisible');
      if (!verifier) {
        setLoading(false);
        setErrorMessage('Security verifier error. Please refresh the page.');
        return;
      }

      const res = await sendPhoneOtp(formattedE164, verifier);
      setLoading(false);

      if (res.success && res.data) {
        setConfirmationResult(res.data);
        setResendCountdown(45);
        setSuccessMessage(`New code sent to ${formatPhoneDisplay(formattedE164)}.`);
      } else {
        setErrorMessage(res.error || 'Failed to resend SMS code.');
      }
    } catch {
      setLoading(false);
      setErrorMessage('Error resending OTP code.');
    }
  };

  const handleFillTestNumber = (code: string, national: string, testOtp?: string) => {
    setSelectedCountryCode(code);
    setNationalNumber(national);
    if (testOtp) {
      setOtpCode(testOtp);
    }
    setErrorMessage(null);
  };

  const isRegionError = isSmsRegionPolicyError(errorMessage);

  return (
    <div className="max-w-md mx-auto py-6 sm:py-10 px-4 space-y-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Invisible reCAPTCHA container */}
        <div id="register-recaptcha-container" className="flex justify-center my-1" />

        {/* Brand Header */}
        <div className="text-center flex flex-col items-center">
          <Logo size="md" />
          <h1 className="font-display text-2xl font-bold text-zinc-100 mt-4">
            {step === 'otp' ? 'Verify Mobile Number' : 'Create WINORA Account'}
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            {step === 'otp'
              ? 'Enter the 6-digit OTP code to finalize account registration'
              : 'Claim 2,500 Virtual Credits and start simulated play'}
          </p>
        </div>

        {/* Welcome Bonus Callout */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/20 to-emerald-500/15 border border-amber-500/30 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500 text-zinc-950 shrink-0">
            <Gift className="w-5 h-5" />
          </div>
          <div>
            <span className="font-display text-xs font-bold text-amber-300 block">
              Virtual Starter Grant
            </span>
            <span className="text-xs text-zinc-200">
              New accounts receive <strong>+2,500 VC</strong> for free amusement.
            </span>
          </div>
        </div>

        {/* Success Alert */}
        {successMessage && (
          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-400 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold block">Registration Issue</span>
              <span>{errorMessage}</span>
            </div>
          </div>
        )}

        {/* SMS Region Policy Interactive Resolution Banner */}
        {isRegionError && (
          <SmsRegionHelper
            isErrorTriggered={true}
            onFillTestNumber={handleFillTestNumber}
          />
        )}

        {/* =================================================================== */}
        {/* STEP 1: Phone Number & Avatar Selection Form */}
        {/* =================================================================== */}
        {step === 'phone' && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            {/* Avatar Choice */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-2">
                Choose Profile Avatar
              </label>
              <div className="flex items-center justify-between gap-3">
                {AVATAR_PRESETS.map((av) => {
                  const isSelected = selectedAvatar === av.src;
                  return (
                    <button
                      type="button"
                      key={av.id}
                      onClick={() => setSelectedAvatar(av.src)}
                      className={`relative p-1 rounded-2xl border-2 transition-all cursor-pointer flex-1 flex flex-col items-center gap-1 ${
                        isSelected
                          ? 'border-amber-400 bg-zinc-800/80'
                          : 'border-zinc-800 hover:border-zinc-700 bg-zinc-950/40'
                      }`}
                    >
                      <img
                        src={av.src}
                        alt={av.label}
                        className="w-12 h-12 rounded-xl object-cover"
                      />
                      <span className="text-[10px] text-zinc-400 font-medium">
                        {av.label}
                      </span>
                      {isSelected && (
                        <div className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-amber-400 text-zinc-950 flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mobile Number with Country Code */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Player Mobile Number
              </label>
              <div className="flex gap-2">
                {/* Country Code Dropdown */}
                <div className="relative w-36 shrink-0">
                  <select
                    id="register-country-code-select"
                    value={selectedCountryCode}
                    onChange={(e) => setSelectedCountryCode(e.target.value)}
                    className="w-full appearance-none bg-zinc-950 border border-zinc-800 focus:border-amber-500 rounded-xl pl-3 pr-7 py-3 text-xs sm:text-sm text-zinc-100 focus:outline-none transition-colors cursor-pointer"
                  >
                    {COUNTRY_CODES.map((item) => (
                      <option key={item.code} value={item.code} className="bg-zinc-900 text-zinc-100">
                        {item.flag} {item.code} ({item.country})
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                {/* Number Input */}
                <div className="relative flex-1">
                  <Phone className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="register-mobile-input"
                    type="tel"
                    inputMode="tel"
                    required
                    autoFocus
                    placeholder="98765 43210"
                    value={nationalNumber}
                    onChange={(e) => setNationalNumber(e.target.value.replace(/[^\d\s-]/g, ''))}
                    className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 rounded-xl pl-10 pr-4 py-3 text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none transition-colors tracking-wide"
                  />
                </div>
              </div>
              <span className="text-[11px] text-zinc-500 mt-1 block">
                Your mobile number will be your verified player account ID.
              </span>
            </div>

            {/* Social Platform Acknowledgment */}
            <div className="pt-2">
              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-zinc-400 leading-snug select-none">
                <input
                  type="checkbox"
                  required
                  checked={termsAgreed}
                  onChange={(e) => setTermsAgreed(e.target.checked)}
                  className="mt-0.5 rounded bg-zinc-950 border-zinc-700 text-amber-500 focus:ring-0 cursor-pointer"
                />
                <span>
                  I acknowledge that <strong className="text-zinc-200">WINORA</strong> is a virtual credit amusement platform with zero real-money deposits, withdrawals, or gambling payouts.
                </span>
              </label>
            </div>

            <button
              id="register-send-otp-btn"
              type="submit"
              disabled={loading || !nationalNumber.trim() || !termsAgreed}
              className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer active:scale-98"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sending Verification Code...</span>
                </>
              ) : (
                <>
                  <span>Send Verification Code (OTP)</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* =================================================================== */}
        {/* STEP 2: OTP Verification & Display Name Setup */}
        {/* =================================================================== */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyAndRegister} className="space-y-4">
            {/* Phone Summary & Edit Button */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-3 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Verifying Mobile Number</span>
                <span className="text-xs sm:text-sm font-bold text-zinc-200">
                  {formatPhoneDisplay(formattedE164)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setStep('phone');
                  setOtpCode('');
                  setErrorMessage(null);
                }}
                className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-400 text-xs font-semibold flex items-center gap-1 cursor-pointer border border-zinc-700"
              >
                <Edit2 className="w-3 h-3" />
                <span>Change</span>
              </button>
            </div>

            {/* OTP Input */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Enter 6-Digit SMS Verification Code
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="register-otp-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  required
                  autoFocus
                  placeholder="123456"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 rounded-xl pl-10 pr-4 py-3 text-base sm:text-lg text-zinc-100 placeholder-zinc-600 focus:outline-none transition-colors text-center tracking-[0.35em] font-mono"
                />
              </div>
            </div>

            {/* Optional Display Nickname */}
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Player Display Name <span className="text-zinc-500 font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="register-displayname-input"
                  type="text"
                  maxLength={30}
                  placeholder={`Player ••${formattedE164.slice(-4)}`}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 focus:border-amber-500 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none transition-colors"
                />
              </div>
              <span className="text-[11px] text-zinc-500 mt-1 block">
                Visible to other players in leaderboards and game rooms.
              </span>
            </div>

            {/* Resend Code Options */}
            <div className="flex items-center justify-between text-xs text-zinc-400 pt-1">
              <span>Didn't receive SMS?</span>
              {resendCountdown > 0 ? (
                <span className="text-zinc-500 text-[11px]">Resend in {resendCountdown}s</span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={loading}
                  className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Resend OTP</span>
                </button>
              )}
            </div>

            <button
              id="register-verify-otp-btn"
              type="submit"
              disabled={loading || otpCode.replace(/\D/g, '').length !== 6}
              className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer active:scale-98"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying & Creating Account...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Complete Registration & Claim 2,500 VC</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Switch to Login */}
        <div className="pt-4 border-t border-zinc-800/80 text-center">
          <p className="text-xs text-zinc-400">
            Already have a WINORA account?{' '}
            <button
              onClick={() => onNavigate('login')}
              className="text-amber-400 hover:text-amber-300 font-bold ml-1 cursor-pointer"
            >
              Sign In with Mobile
            </button>
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 text-[11px] text-zinc-500 text-center">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>No passwords stored • Verified phone security</span>
        </div>
      </div>

      {/* Firebase Setup & Test Numbers Helper */}
      {!isRegionError && (
        <SmsRegionHelper
          isErrorTriggered={false}
          onFillTestNumber={handleFillTestNumber}
        />
      )}
    </div>
  );
};
