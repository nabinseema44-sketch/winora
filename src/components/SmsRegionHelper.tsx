import React, { useState } from 'react';
import {
  AlertTriangle,
  ExternalLink,
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
  isErrorTriggered = false,
}) => {
  const [isOpen, setIsOpen] = useState(isErrorTriggered);

  const projectId = firebaseEnvConfig.projectId || 'your-firebase-project';
  const consoleAuthUrl = `https://console.firebase.google.com/project/${projectId}/authentication/settings`;
  const consoleProvidersUrl = `https://console.firebase.google.com/project/${projectId}/authentication/providers`;

  return (
    <div
      className={`rounded-2xl border transition-all text-xs ${
        isErrorTriggered
          ? 'bg-amber-950/40 border-amber-500/50 shadow-lg shadow-amber-500/10'
          : 'bg-zinc-950/60 border-zinc-800'
      }`}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-3.5 flex items-center justify-between text-left cursor-pointer hover:bg-zinc-900/50 rounded-2xl transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className={`p-1.5 rounded-lg ${isErrorTriggered ? 'bg-amber-500 text-zinc-950 font-bold' : 'bg-zinc-800 text-amber-400'}`}>
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
                : 'Configure SMS Region Policy or use a Firebase test phone number.'}
            </span>
          </div>
        </div>
        <div className="text-zinc-400 p-1">
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {isOpen && (
        <div className="p-4 pt-1 border-t border-zinc-800/80 space-y-4">
          <div className="text-zinc-300 text-xs leading-relaxed bg-zinc-900/80 p-3 rounded-xl border border-zinc-800">
            <p>
              Firebase blocks real SMS when the country is not enabled by the project's SMS region policy. This does not mean your Firebase Phone provider is disabled.
            </p>
          </div>

          <div className="space-y-2">
            <span className="font-bold text-amber-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Free Firebase Test Phone
            </span>
            <p className="text-[11px] text-zinc-400">
              Your Firebase project already has test phone numbers configured. Use the exact test phone number and fixed verification code shown in Firebase Console under <strong>Authentication → Sign-in method → Phone → Phone numbers for testing</strong>.
            </p>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 flex items-start gap-2.5">
              <Smartphone className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-[11px] text-zinc-200 font-semibold">No real SMS is sent</p>
                <p className="text-[10px] text-zinc-400">
                  Enter one of your registered Firebase test numbers in the phone field, press Send Login OTP, then enter the fixed verification code configured beside that number in Firebase.
                </p>
              </div>
            </div>
            <a
              href={consoleProvidersUrl}
              target="_blank"
              rel="noreferrer"
              className="text-amber-400 hover:underline text-[10px] inline-flex items-center gap-1 font-semibold"
            >
              Open Firebase Phone test-number settings <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>

          <div className="space-y-2 pt-2 border-t border-zinc-800">
            <span className="font-bold text-zinc-200 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              For real SMS later
            </span>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-zinc-300 pl-1">
              <li>Open <a href={consoleAuthUrl} target="_blank" rel="noreferrer" className="text-amber-400 hover:underline font-semibold">Firebase Authentication Settings <ExternalLink className="w-3 h-3 inline" /></a>.</li>
              <li>Open <strong>SMS region policy</strong>.</li>
              <li>Allow the required country code and save.</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
};
