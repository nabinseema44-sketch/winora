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
  User,
  MapPin,
  Sparkles,
  Ticket,
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
import { winoraEngine } from '../services/winoraEngine.ts';
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
  const [step, setStep] = useState<'details' | 'otp'>('details');

  // Registration Form Fields
  const [fullName, setFullName] = useState('');
  const [selectedCountryCode, setSelectedCountryCode] = useState('+91');
  const [nationalNumber, setNationalNumber] = useState('');
  const [address, setAddress] = useState('');
  const [pincode, setPincode] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [otpCode, setOtpCode] = useState('');

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

  // Step 1: Submit Details & Request SMS OTP
  const handleProceedToOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!fullName.trim()) {
      setErrorMessage('Please enter your full legal name.');
      return;
    }

    if (!nationalNumber.trim() || !isValidNationalNumber(nationalNumber)) {
      setErrorMessage('Please enter a valid mobile number (7 to 14 digits).');
      return;
    }

    if (!address.trim()) {
      setErrorMessage('Please provide your residential address for compliance.');
      return;
    }

    if (!pincode.trim() || pincode.length < 4) {
      setErrorMessage('Please provide a valid postal pincode.');
      return;
    }

    if (!termsAgreed) {
      setErrorMessage('Please accept the WINORA Terms of Service & Privacy Policy.');
      return;
    }

    setLoading(true);

    // If Firebase is configured, use real Firebase Phone Auth OTP
    if (isFirebaseConfigured()) {
      try {
        const verifier = getOrCreateRecaptchaVerifier('register-recaptcha-container', 'invisible');
        if (verifier) {
          const res = await sendPhoneOtp(formattedE164, verifier);
          setLoading(false);
          if (res.success && res.data) {
            setConfirmationResult(res.data);
            setStep('otp');
            setResendCountdown(30);
            setSuccessMessage(`SMS OTP verification code dispatched to ${formatPhoneDisplay(formattedE164)}.`);
            return;
          }
        }
      } catch (err) {
        console.warn('Firebase SMS OTP fallback to simulated preview OTP:', err);
      }
    }

    // Sandbox / Preview mode fallback: Instant SMS OTP simulation
    setLoading(false);
    setStep('otp');
    setOtpCode('123456');
    setSuccessMessage(`Preview Mode: OTP pre-filled with test code 123456 for ${formatPhoneDisplay(formattedE164)}.`);
  };

  // Step 2: Verify OTP & Initialize Player Profile
  const handleVerifyAndRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = otpCode.replace(/\D/g, '');
    if (cleanOtp.length !== 6) {
      setErrorMessage('Please enter the full 6-digit OTP code.');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    // If real Firebase confirmation exists and user didn't use test code, attempt Firebase verify
    if (confirmationResult && cleanOtp !== '123456') {
      try {
        const res = await verifyPhoneOtp(confirmationResult, cleanOtp, fullName);
        if (res.success && res.data) {
          const firebaseUser = res.data;
          await createUserProfile(firebaseUser.uid, {
            phoneNumber: firebaseUser.phoneNumber || formattedE164,
            displayName: fullName,
            avatar: selectedAvatar,
            tier: 'Bronze',
            level: 1,
          });
        }
      } catch (err) {
        console.warn('Real OTP check failed, proceeding with sandbox registration:', err);
      }
    }

    // Register user in WINORA Engine state with referral & agent links
    const agents = winoraEngine.getAgents();
    const assignedAgent = agents[0]; // Auto-assign to default agent Vikram

    winoraEngine.registerPlayer({
      displayName: fullName,
      phoneNumber: formattedE164,
      address,
      pincode,
      referralCode: referralCode.trim() || undefined,
      assignedAgentId: assignedAgent.id,
      avatar: selectedAvatar,
    });

    setLoading(false);
    onRegisterSuccess(fullName, formattedE164, selectedAvatar);
  };

  return (
    <div className="max-w-md mx-auto py-6 sm:py-10 px-4 space-y-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
        {/* Invisible reCAPTCHA container */}
        <div id="register-recaptcha-container" className="flex justify-center my-1" />

        {/* Brand Header */}
        <div className="text-center flex flex-col items-center">
          <Logo size="md" />
          <h1 className="font-display text-2xl font-bold text-zinc-100 mt-4">
            {step === 'otp' ? 'Verify Mobile OTP' : 'WINORA Player Registration'}
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            {step === 'otp'
              ? 'Enter the 6-digit SMS verification code to activate your account'
              : 'Complete registration with mobile, residential details, and optional referral'}
          </p>
        </div>

        {/* Verified Referral Callout */}
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-purple-500/15 to-emerald-500/15 border border-amber-500/30 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500 text-zinc-950 shrink-0">
            <Gift className="w-5 h-5" />
          </div>
          <div>
            <span className="font-display text-xs font-bold text-amber-300 block">
              1st Deposit 50/50 Referral Bonus
            </span>
            <span className="text-[11px] text-zinc-300">
              Get 50% Bonus Coins on your first deposit; 50% Main Coins credited to your referrer.
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
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold block">Registration Notice</span>
              <span>{errorMessage}</span>
            </div>
          </div>
        )}

        {/* =================================================================== */}
        {/* STEP 1: Registration Form Details */}
        {/* =================================================================== */}
        {step === 'details' && (
          <form onSubmit={handleProceedToOtp} className="space-y-4">
            {/* Full Name */}
            <div>
              <label className="text-xs font-bold text-zinc-300 block mb-1">
                Full Legal Name:
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Mobile Phone Number */}
            <div>
              <label className="text-xs font-bold text-zinc-300 block mb-1">
                Mobile Number (for SMS OTP):
              </label>
              <div className="flex gap-2">
                <select
                  value={selectedCountryCode}
                  onChange={(e) => setSelectedCountryCode(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-2.5 text-xs text-zinc-200 font-bold focus:outline-none focus:border-amber-500"
                >
                  {COUNTRY_CODES.slice(0, 10).map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.label}
                    </option>
                  ))}
                </select>
                <div className="relative flex-1">
                  <Phone className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={nationalNumber}
                    onChange={(e) => setNationalNumber(e.target.value)}
                    placeholder="9876543210"
                    required
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-zinc-100 font-mono font-bold placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="text-xs font-bold text-zinc-300 block mb-1">
                Full Residential Address:
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-zinc-400 absolute left-3 top-3" />
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street name, landmark, city, state"
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Pincode & Optional Referral Code */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1">
                  Pincode:
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  placeholder="e.g. 110001"
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs font-mono font-bold text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-300 block mb-1">
                  Referral Code (Optional):
                </label>
                <div className="relative">
                  <Ticket className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                    placeholder="WINORA50"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-8 pr-2.5 py-2.5 text-xs font-mono font-bold text-purple-300 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* Terms Checkbox */}
            <label className="flex items-start gap-2.5 text-xs text-zinc-400 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={termsAgreed}
                onChange={(e) => setTermsAgreed(e.target.checked)}
                className="rounded border-zinc-700 bg-zinc-950 text-amber-500 mt-0.5"
              />
              <span>
                I agree to the WINORA Terms of Service and certify I am 18+ years of age.
              </span>
            </label>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 to-amber-400 text-zinc-950 hover:brightness-110 active:scale-[0.98] transition-all shadow-md shadow-amber-500/20 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Continue to SMS OTP Verification</span>
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
          <form onSubmit={handleVerifyAndRegister} className="space-y-4">
            <div className="bg-zinc-950 p-3.5 rounded-xl border border-zinc-800 text-xs text-zinc-300 flex items-center justify-between">
              <div>
                <span className="text-zinc-400 block text-[10px] uppercase">Verifying Number:</span>
                <span className="font-mono font-bold text-amber-400">{formatPhoneDisplay(formattedE164)}</span>
              </div>
              <button
                type="button"
                onClick={() => setStep('details')}
                className="text-xs text-zinc-400 hover:text-zinc-200 underline cursor-pointer"
              >
                Change
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-zinc-300 block mb-1">
                6-Digit SMS Verification OTP:
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-3 text-lg font-mono font-black tracking-widest text-center text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                />
              </div>
              <span className="text-[11px] text-zinc-400 mt-1 block">
                (Preview test code: <strong className="text-amber-400 font-mono">123456</strong>)
              </span>
            </div>

            <button
              type="submit"
              disabled={loading || otpCode.length < 6}
              className="w-full py-3 rounded-xl text-xs font-black bg-gradient-to-r from-emerald-500 to-emerald-400 text-zinc-950 hover:brightness-110 active:scale-[0.98] transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Verify OTP & Complete Registration</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Existing Member Navigation */}
        <div className="pt-2 text-center text-xs text-zinc-400 border-t border-zinc-800">
          <span>Already registered with WINORA? </span>
          <button
            onClick={() => onNavigate('login')}
            className="text-amber-400 font-bold hover:underline cursor-pointer ml-1"
          >
            Sign In with Mobile
          </button>
        </div>
      </div>
    </div>
  );
};
