import React, { useState } from 'react';
import { X, Copy, CheckCircle2, Database, ShieldCheck, FileCode } from 'lucide-react';
import { WINORA_SUPABASE_SQL } from '../data/supabaseSqlScript.ts';

interface SqlSchemaModalProps {
  onClose: () => void;
  onToast: (msg: string) => void;
}

export const SqlSchemaModal: React.FC<SqlSchemaModalProps> = ({ onClose, onToast }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(WINORA_SUPABASE_SQL);
    setCopied(true);
    onToast('SQL schema copied to clipboard! Paste into Supabase SQL Editor.');
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div
      id="sql-schema-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto"
    >
      <div
        id="sql-schema-modal"
        className="bg-zinc-900 border border-zinc-750 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="p-4 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-zinc-100 font-display">
                Supabase / PostgreSQL Production Schema (Prompt 1)
              </h3>
              <p className="text-xs text-zinc-400">
                5 Tables, 15-Min Freeze Trigger, 50/50 Referral & 10% Agent Triggers, 00–99 Risk Procedure
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 text-zinc-950 hover:bg-emerald-400 transition-colors shadow-sm cursor-pointer"
            >
              {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied!' : 'Copy SQL'}</span>
            </button>

            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-100 p-1.5 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-zinc-950/60 px-4 py-2.5 border-b border-zinc-800 text-xs text-zinc-300 flex items-center justify-between">
          <span>
            Run this script directly in your <strong>Supabase Dashboard → SQL Editor</strong> to initialize PostgreSQL tables, triggers, and RLS policies.
          </span>
          <span className="text-[11px] text-zinc-400">PostgreSQL 15+</span>
        </div>

        {/* Code Viewer */}
        <div className="p-4 overflow-y-auto bg-zinc-950 flex-1 font-mono text-xs text-zinc-300 leading-relaxed select-all">
          <pre className="whitespace-pre-wrap">{WINORA_SUPABASE_SQL}</pre>
        </div>

        {/* Footer */}
        <div className="p-3 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between">
          <span className="text-[11px] text-zinc-400">
            Row-Level Security (RLS) enabled on all tables
          </span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-emerald-500 text-zinc-950 hover:bg-emerald-400 transition-colors shadow-md cursor-pointer"
          >
            {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied to Clipboard!' : 'Copy Full SQL Script'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
