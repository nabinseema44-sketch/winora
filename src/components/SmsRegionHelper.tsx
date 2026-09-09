import React, { useState } from 'react';
import {
  AlertTriangle,
  ExternalLink,
  Check,
  Smartphone,
  ChevronDown,
  ChevronUp,
  KeyRound,
  Sparkles,
} from 'lucide-react';
import { firebaseEnvConfig } from '../firebase/config.ts';

interface SmsRegionHelperProps {
  onFillTestNumber?: (countryCode: string, nationalNumber: string, testOtp?: string) => void;
  isErrorTriggered?: boolean;
}

export const SmsRegionHelper: React.FC<SmsRegionHelperProps> = ({
  onFillTestNumber,
  isErrorTriggered = false,
}) => {
  const [isOpen, setIsOpen] = useState(isErrorTriggered);
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);

  const projectId = firebaseEnvConfig.projectId || 'your-firebase-project';
  const consoleAuthUrl = `https://console.firebase.google.com/project/${projectId}/authentication/settings`;
  const consoleProvidersUrl = `https://console.firebase.google.com/project/${projectId}/authentication/providers`;

  const TEST_NUMBERS = [
    { countryCode: '+91', national: '9876543210', otp: '123456', label: 'India Test Number' },
    { countryCode: '+1', national: '6505553434', otp: '123456', label: 'US Test Number' },
  ];

  const handleCopy = (num: string) => {
    navigator.clipboard.writeText(num);
    setCopiedNumber(num);
    setTimeout(() => setCopiedNumber(null), 2000);
  };

  return (
    <div
      className={`rounded-2xl border transition-all text-xs ${
        isErrorTriggered
          ? 'bg-amber-950/40 border-amber-500/50 shadow-lg shadow-amber-500/10'
          : 'bg-zinc-950/60 border-zinc-800'
      }`}
    >
      {/* Accordion Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-3.5 flex items-center justify-between text-left cursor-pointer hover:bg-zinc-900/50 rounded-2xl transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div
            className={`p-1.5 rounded-lg ${
              isErrorTriggered
                ? 'bg-amber-500 text-zinc-950 font-bold'
                : 'bg-zinc-800 text-amber-400'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-zinc-100 flex items-center gap-1.5">
              {isErrorTriggered ? 'How to Resolve SMS Region Error' : 'Firebase Phone Auth & Test Setup'}
              {isErrorTriggered && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-mono uppercase">
                  Action Required
                </span>
              )}
            </span>
            <span className="text-[11px] text-zinc-400 block">
              {isErrorTriggered
                ? 'Firebase blocked SMS to this country region. Follow these steps to fix.'
                : 'Configure SMS Region Policy or use instant test phone numbers.'}
            </span>
          </div>
        </div>
        <div className="text-zinc-400 p-1">
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Expanded Content */}
      {isOpen && (
        <div className="p-4 pt-1 border-t border-zinc-800/80 space-y-4">
          {/* Quick Explanation */}
          <div className="text-zinc-300 text-xs leading-relaxed bg-zinc-900/80 p-3 rounded-xl border border-zinc-800">
            <p>
              Google Firebase enforces an <strong>SMS Region Policy</strong> to prevent unintended toll charges. When a country code is not enabled in your project's region policy, Firebase rejects dispatching SMS with code <code className="text-amber-400 bg-zinc-950 px-1 py-0.5 rounded font-mono">auth/operation-not-allowed</code>.
            </p>
          </div>

          {/* Solution 1: Use Firebase Test Numbers (Recommended for Prototyping) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Option 1: Use Firebase Test Numbers (Instant & Free)
              </span>
              <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-semibold">
                No SMS costs • Bypasses region lock
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">
              Firebase allows adding free test phone numbers that never send actual carrier SMS and are never blocked by region policies:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {TEST_NUMBERS.map((test) => (
                <div
                  key={test.national}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 flex flex-col justify-between gap-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-zinc-300 font-semibold">{test.label}</span>
                    <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                      OTP: {test.otp}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-zinc-200">
                      {test.countryCode} {test.national}
                    </span>
                    {onFillTestNumber && (
                      <button
                        type="button"
                        onClick={() => onFillTestNumber(test.countryCode, test.national, test.otp)}
                        className="px-2 py-1 rounded bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Smartphone className="w-3 h-3" />
                        <span>Use This</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <p className="text-[10px] text-zinc-400 italic">
              *Note: If your Firebase project doesn't have these test numbers registered yet, register them once under:{' '}
              <a
                href={consoleProvidersUrl}
                target="_blank"
                rel="noreferrer"
                className="text-amber-400 hover:underline inline-flex items-center gap-0.5 font-mono"
              >
                Sign-in method &gt; Phone &gt; Phone numbers for testing <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </p>
          </div>

          {/* Solution 2: Enable SMS Region in Firebase Console */}
          <div className="space-y-2 pt-2 border-t border-zinc-800">
            <span className="font-bold text-zinc-200 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              Option 2: Enable SMS Region Policy (For Real SMS)
            </span>
            <p className="text-[11px] text-zinc-400">
              To allow live SMS delivery to real mobile devices:
            </p>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-zinc-300 pl-1">
              <li>
                Open the{' '}
                <a
                  href={consoleAuthUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-amber-400 hover:underline font-semibold inline-flex items-center gap-1"
                >
                  Firebase Authentication Settings <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                Click on the <strong>SMS region policy</strong> tab.
              </li>
              <li>
                Select <strong>Allowlist</strong> and check your countries (e.g. <strong>India +91</strong>, <strong>USA +1</strong>).
              </li>
              <li>
                Click <strong>Save</strong>. SMS dispatch will be enabled immediately!
              </li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
};
