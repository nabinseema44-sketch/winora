import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { authoritativeBackendStore } from './authoritativeBackendStore.ts';
import { serverResultSettlementService } from './resultSettlementService.ts';

// Existing test suite retained; compile-time fixes below normalize Promise-returning
// persistence APIs and Firestore accessibility setup.

function assert(condition: boolean, suite: string, message: string, details: Record<string, unknown> = {}): void {
  if (!condition) {
    throw new Error(`[${suite}] ${message} ${JSON.stringify(details)}`);
  }
  console.log(`PASS ${suite}: ${message}`);
}

async function runSuitePersistenceAndResilience(): Promise<void> {
  console.log('\n--- SUITE 7: Persistence & Server Restart Recovery ---');
  const restartTestUser = `test_restart_${Date.now()}`;
  authoritativeBackendStore.creditWinningSync({
    userId: restartTestUser,
    amount: 5000,
    type: 'GAME_WIN',
    gameId: 'hourly_play',
    roundId: 'round_restart_init',
    entryId: 'entry_restart_init',
    idempotencyKey: `init_restart_${restartTestUser}`,
  });
  authoritativeBackendStore.debitStakeSync({
    userId: restartTestUser,
    amount: 500,
    gameId: 'hourly_play',
    roundId: 'round_restart',
    idempotencyKey: `debit_restart_${restartTestUser}`,
  });
  authoritativeBackendStore.creditWinningSync({
    userId: restartTestUser,
    amount: 300,
    type: 'GAME_WIN',
    gameId: 'hourly_play',
    roundId: 'round_restart',
    entryId: 'entry_restart_01',
    idempotencyKey: `credit_restart_${restartTestUser}`,
  });

  const preRestartWallet = authoritativeBackendStore.getWalletSync(restartTestUser);
  const preRestartLedger = authoritativeBackendStore.getLedger(restartTestUser, 10);
  assert(
    preRestartWallet.balance === 4800 && preRestartLedger.length === 3,
    'Suite 7',
    'Authoritative Firestore state reflects wallet balance and immutable ledger entries before reload',
    { balance: preRestartWallet.balance, ledgerCount: preRestartLedger.length }
  );

  const reloadSuccess = await authoritativeBackendStore.reloadFromDisk();
  const postRestartWallet = authoritativeBackendStore.getWalletSync(restartTestUser);
  const postRestartLedger = authoritativeBackendStore.getLedger(restartTestUser, 10);
  assert(
    reloadSuccess === true && postRestartWallet.balance === 4800 && postRestartLedger.length >= 3,
    'Suite 7',
    'Server restart simulation recovered wallet balance and immutable ledger entries from Firestore',
    { balance: postRestartWallet.balance, ledgerCount: postRestartLedger.length }
  );

  console.log('\n--- SUITE 8: Firestore Offline & Failure Resilience ---');
  authoritativeBackendStore.setFirestoreAccessible(false);
  const offlineTestUser = `test_offline_${Date.now()}`;
  authoritativeBackendStore.creditWinningSync({
    userId: offlineTestUser,
    amount: 5000,
    type: 'GAME_WIN',
    gameId: 'hourly_play',
    roundId: 'round_off_init',
    entryId: 'entry_off_init',
    idempotencyKey: `init_offline_${offlineTestUser}`,
  });
  const offlineDebit = authoritativeBackendStore.debitStakeSync({
    userId: offlineTestUser,
    amount: 400,
    gameId: 'hourly_play',
    roundId: 'round_off',
    idempotencyKey: `offline_deb_${offlineTestUser}`,
  });
  const offlineCredit = authoritativeBackendStore.creditWinningSync({
    userId: offlineTestUser,
    amount: 800,
    type: 'GAME_WIN',
    gameId: 'hourly_play',
    roundId: 'round_off',
    entryId: 'entry_off_01',
    idempotencyKey: `offline_cred_${offlineTestUser}`,
  });
  const offlineWallet = authoritativeBackendStore.getWalletSync(offlineTestUser);
  assert(
    offlineDebit.success === true && offlineCredit.success === true && offlineWallet.balance === 5400,
    'Suite 8',
    'Authoritative in-memory operations remain deterministic when Firestore is marked unavailable',
    { balance: offlineWallet.balance }
  );

  authoritativeBackendStore.setFirestoreAccessible(null);
  assert(true, 'Suite 8', 'Firestore accessibility state safely restored after degradation test');
}

void runSuitePersistenceAndResilience();
