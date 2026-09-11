import React, { useState, useEffect } from 'react';
import {
  Phone,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  RotateCcw,
  KeyRound,
  Sparkles,
  Edit2,
  ChevronDown,
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
import { getUserProfile, createUserProfile } from '../firebase/firestoreService.ts';
import {
  COUNTRY_CODES,
  formatToE164,
  formatPhoneDisplay,
  isValidNationalNumber,
} from '../utils/phoneUtils.ts';
import { isSmsRegionPolicyError } from '../firebase/errorHandling.ts';
import { SmsRegionHelper } from '../components/SmsRegionHelper.tsx';
import type { ConfirmationResult } from 'firebase/auth';

interface LoginPageProps {
  onLoginSuccess: (displayName: string, phoneNumber: string) => void;
  onNavigate: (page: NavPage) => void;
  redirectNotice?: string;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  onNavigate,
  redirectNotice,
}) => {
  // Authentication Steps: 'phone' | 'otp'
  const [step, setStep] = useState<'phone' | 'otp'>('phone');

  // Phone Inputs
  const [selectedCountryCode, setSelectedCountryCode] = useState('+91');
  const [nationalNumber, setNationalNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');

  // Flow & State Management
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [resendCountdown, setResendCountdown] = useState<number>(0);

  const formattedE164 = formatToE164(selectedCountryCode, nationalNumber);

  // Timer countdown for resend OTP
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
  // Step 1: Send Phone OTP
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

    if (!isFirebaseConfigured()) {
      setErrorMessage(
        'Firebase configuration is missing in .env. Please configure Firebase project credentials.'
      );
      return;
    }

    setLoading(true);

    try {
      const verifier = getOrCreateRecaptchaVerifier('login-recaptcha-container', 'invisible');
      if (!verifier) {
        setLoading(false);
        setErrorMessage('Security check initialization failed. Please refresh the page and try again.');
        return;
      }

      const res = await sendPhoneOtp(formattedE164, verifier);
      setLoading(false);

      if (res.success && res.data) {
        setConfirmationResult(res.data);
        setStep('otp');
        setResendCountdown(30);
        setSuccessMessage(`OTP code sent via SMS to ${formatPhoneDisplay(formattedE164)}.`);
      } else {
        clearRecaptchaVerifier();
        setErrorMessage(res.error || 'Failed to send SMS OTP. Please check your number.');
      }
    } catch (err) {
      setLoading(false);
      clearRecaptchaVerifier();
      setErrorMessage('An unexpected error occurred sending OTP. Please try again.');
    }
  };

  // ---------------------------------------------------------------------------
  // Step 2: Verify Phone OTP & Log In
  // ---------------------------------------------------------------------------
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmationResult) {
      setErrorMessage('OTP session expired. Please request a new SMS code.');
      setStep('phone');
      return;
    }

    const cleanOtp = otpCode.replace(/\D/g, '');
    if (cleanOtp.length !== 6) {
      setErrorMessage('Please enter the complete 6-digit OTP code.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    const res = await verifyPhoneOtp(confirmationResult, cleanOtp);

    if (res.success && res.data) {
      const firebaseUser = res.data;
      const verifiedPhone = firebaseUser.phoneNumber || formattedE164;

      // Locate or create player's Firestore user document in users/{uid}
      let profile = await getUserProfile(firebaseUser.uid);
      if (!profile) {
        const last4 = verifiedPhone.slice(-4);
        await createUserProfile(firebaseUser.uid, {
          phoneNumber: verifiedPhone,
          displayName: firebaseUser.displayName || `Player ••${last4}`,
          tier: 'Bronze',
          level: 1,
        });
        profile = await getUserProfile(firebaseUser.uid);
      }

      setLoading(false);
      const activeName = profile?.displayName || firebaseUser.displayName || `Player ••${verifiedPhone.slice(-4)}`;
      onLoginSuccess(activeName, verifiedPhone);
    } else {
      setLoading(false);
      setErrorMessage(res.error || 'Invalid OTP code. Please check and try again.');
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
      const verifier = getOrCreateRecaptchaVerifier('login-recaptcha-container', 'invisible');
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
        setSuccessMessage(`New OTP code sent to ${formatPhoneDisplay(formattedE164)}.`);
      } else {
        setErrorMessage(res.error || 'Failed to resend SMS code. Please wait a moment.');
      }
    } catch {
      setLoading(false);
      setErrorMessage('Error resending OTP code.');
    }
  };

  // Quick Demo / Test helper
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
        <div id="login-recaptcha-container" className="flex justify-center my-1" />

        {/* Brand Header */}
        <div className="text-center flex flex-col items-center">
          <Logo size="md" />
          <h1 className="font-display text-2xl font-bold text-zinc-100 mt-4">
            Player Sign In
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            {step === 'otp'
              ? 'Enter the 6-digit verification code sent to your mobile phone'
              : 'Sign in securely with your verified mobile number and SMS OTP'}
          </p>
        </div>

        {/* Redirect Notice if routed from protected page */}
        {redirectNotice && (
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
            <Sparkles className="w-4 h-4 shrink-0 text-amber-400" />
            <span>{redirectNotice}</span>
          </div>
        )}

        {/* Success Alert */}
        {successMessage && (
          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-400 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold block">Authentication Issue</span>
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
        {/* STEP 1: Phone Number Input Form */}
        {/* =================================================================== */}
        {step === 'phone' && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Registered Mobile Number
              </label>

              <div className="flex gap-2">
                {/* Country Code Selector */}
                <div className="relative w-36 shrink-0">
                  <select
                    id="login-country-code-select"
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

                {/* Mobile Number Input */}
                <div className="relative flex-1">
                  <Phone className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="login-mobile-input"
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
                Standard SMS rates may apply. A 6-digit one-time code will be sent.
              </span>
            </div>

            <button
              id="login-send-otp-btn"
              type="submit"
              disabled={loading || !nationalNumber.trim()}
              className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer active:scale-98"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sending OTP...</span>
                </>
              ) : (
                <>
                  <span>Send Login OTP</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* =================================================================== */}
        {/* STEP 2: OTP Verification Form */}
        {/* =================================================================== */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            {/* Phone Summary & Edit Button */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-3 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Verifying Mobile</span>
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

            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                Enter 6-Digit SMS Code
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="login-otp-input"
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
              id="login-verify-otp-btn"
              type="submit"
              disabled={loading || otpCode.replace(/\D/g, '').length !== 6}
              className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer active:scale-98"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Code...</span>
                </>
              ) : (
                <>
                  <span>Verify OTP & Enter WINORA</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* Switch to Register */}
        <div className="pt-4 border-t border-zinc-800/80 space-y-3 text-center">
          <p className="text-xs text-zinc-400">
            First time playing on WINORA?{' '}
            <button
              onClick={() => onNavigate('register')}
              className="text-amber-400 hover:text-amber-300 font-bold ml-1 cursor-pointer"
            >
              Register with Mobile
            </button>
          </p>
        </div>

        {/* Responsible Entertainment disclaimer */}
        <div className="flex items-center justify-center gap-2 text-[11px] text-zinc-500 text-center">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>Verified Phone Identity • Secure Account Wallet</span>
        </div>
      </div>
    </div>
  );
};
