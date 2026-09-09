import React, { useState, useEffect } from 'react';
import { Database, ShieldCheck, AlertTriangle, RefreshCw, CheckCircle2, Server, Key } from 'lucide-react';
import { isFirebaseConfigured, firebaseEnvConfig } from '../firebase/config';
import { testAuthConnection } from '../firebase/authService';
import { testFirestoreConnection } from '../firebase/firestoreService';

export const FirebaseStatusCard: React.FC = () => {
  const [testing, setTesting] = useState(false);
  const [authStatus, setAuthStatus] = useState<{ connected: boolean; message: string } | null>(null);
  const [firestoreStatus, setFirestoreStatus] = useState<{ connected: boolean; message: string; latencyMs?: number } | null>(null);
  const configured = isFirebaseConfigured();

  const runTest = async () => {
    setTesting(true);
    try {
      const [authRes, firestoreRes] = await Promise.all([
        testAuthConnection(),
        testFirestoreConnection(),
      ]);
      setAuthStatus(authRes);
      setFirestoreStatus(firestoreRes);
    } catch (err: any) {
      setAuthStatus({ connected: false, message: err?.message || 'Test failed' });
      setFirestoreStatus({ connected: false, message: err?.message || 'Test failed' });
    } finally {
      setTesting(false);
    }
  };

  useEffect(() => {
    if (configured) {
      runTest();
    }
  }, [configured]);

  return (
    <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-zinc-100 flex items-center gap-2">
              Firebase Project Connection
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  configured
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                }`}
              >
                {configured ? 'Configured' : 'Awaiting Config'}
              </span>
            </h4>
            <p className="text-[11px] text-zinc-400">
              {configured
                ? `Project: ${firebaseEnvConfig.projectId || 'Unknown'}`
                : 'Credentials awaiting input in .env'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={runTest}
          disabled={testing}
          className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-zinc-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin text-amber-400' : ''}`} />
          <span>{testing ? 'Testing...' : 'Test Connection'}</span>
        </button>
      </div>

      {/* Environment parameters inspection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
        <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 flex items-center justify-between">
          <span className="text-zinc-400 flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-zinc-500" />
            API Key
          </span>
          <span className="font-mono text-zinc-300">
            {firebaseEnvConfig.apiKey && firebaseEnvConfig.apiKey !== 'your-api-key-here'
              ? `${firebaseEnvConfig.apiKey.substring(0, 6)}••••••`
              : 'Not set'}
          </span>
        </div>

        <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 flex items-center justify-between">
          <span className="text-zinc-400 flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5 text-zinc-500" />
            Auth Domain
          </span>
          <span className="font-mono text-zinc-300 truncate max-w-[160px]">
            {firebaseEnvConfig.authDomain || 'Not set'}
          </span>
        </div>
      </div>

      {/* Test Results Display */}
      {(authStatus || firestoreStatus) && (
        <div className="space-y-2 pt-2 border-t border-zinc-800/80">
          {authStatus && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                authStatus.connected
                  ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-300'
              }`}
            >
              {authStatus.connected ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <span className="font-bold block">Firebase Authentication</span>
                <span className="text-[11px] text-zinc-400 block mt-0.5">
                  {authStatus.message}
                </span>
              </div>
            </div>
          )}

          {firestoreStatus && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                firestoreStatus.connected
                  ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-300'
              }`}
            >
              {firestoreStatus.connected ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold">Cloud Firestore</span>
                  {firestoreStatus.latencyMs !== undefined && (
                    <span className="text-[10px] font-mono text-zinc-400">
                      {firestoreStatus.latencyMs}ms
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-zinc-400 block mt-0.5">
                  {firestoreStatus.message}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Security Architecture Reminder */}
      <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 flex items-start gap-2 text-[11px] text-zinc-400">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
        <span>
          <strong>Security Architecture:</strong> Client is restricted to authenticated profile sync.
          Virtual wallet balances, rewards, and simulated game outcomes remain strictly server-authoritative
          via Cloud Functions.
        </span>
      </div>
    </div>
  );
};
