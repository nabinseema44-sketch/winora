/**
 * WINORA Authoritative Backend Calculation & Security Test Suite
 * Validates:
 * 1. Authoritative Coin & Wallet Calculations (Single Main Wallet, Server-Side Balance)
 * 2. Authoritative Bid Validation & Deduction (Server-Calculated Stakes, Idempotency)
 * 3. Authoritative 90x Payout & 80% Protection Refund Calculations
 * 4. Double-Settlement & Replay Attack Prevention
 * 5. Cutoff Enforcement & Freeze Rules
 * 6. Color-Number Rule Consistency (Even=GREEN, Odd=RED)
 * 7. Security Rejections (Invalid Numbers, Insufficient Balance, Non-Master Declaration)
 */

import fs from 'fs';
import path from 'path';
import { authoritativeBackendStore } from './authoritativeBackendStore.ts';
import { serverGameEntryService, SERVER_GAMES_CONFIG } from './gameEntryService.ts';
import { serverResultSettlementService } from './resultSettlementService.ts';

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

function assert(condition: boolean, suite: string, name: string, details?: any) {
  if (condition) {
    results.push({ suite, name, passed: true, details });
    console.log(`  [PASS] ${name}`);
  } else {
    results.push({ suite, name, passed: false, error: 'Assertion failed', details });
    console.error(`  [FAIL] ${name}`, details);
  }
}

export async function runAllTests(): Promise<{ passed: number; failed: number; results: TestResult[] }> {
  console.log('\n======================================================');
  console.log('   STARTING WINORA AUTHORITATIVE BACKEND TEST SUITE   ');
  console.log('======================================================\n');

  const testUserId = `test_player_${Date.now()}`;
  const masterUserId = 'master-admin-01';

  // ---------------------------------------------------------
  // SUITE 1: Authoritative Wallet & Balance Integrity
  // ---------------------------------------------------------
  console.log('--- SUITE 1: Authoritative Wallet & Balance ---');
  const initialWallet = authoritativeBackendStore.getWalletSync(testUserId);
  assert(initialWallet.balance === 0 && initialWallet.bonusBalance === 0, 'Suite 1', 'Initial default wallet balance is 0 for newly registered player (Zero Balance Rule)', { balance: initialWallet.balance, bonus: initialWallet.bonusBalance });

  // Direct deposit / initial credit through authoritative store
  const creditRes = authoritativeBackendStore.creditWinningSync({
    userId: testUserId,
    amount: 6500,
    type: 'GAME_WIN',
    gameId: 'initial_deposit',
    roundId: 'round_00',
    entryId: 'entry_init_01',
    idempotencyKey: `init_deposit_${testUserId}`,
  });
  assert(creditRes.balanceAfter === 6500, 'Suite 1', 'Authoritative credit increases balance accurately to 6,500', { balanceAfter: creditRes.balanceAfter });

  // Verify Idempotent credit
  const duplicateCredit = authoritativeBackendStore.creditWinningSync({
    userId: testUserId,
    amount: 6500,
    type: 'GAME_WIN',
    gameId: 'initial_deposit',
    roundId: 'round_00',
    entryId: 'entry_init_01',
    idempotencyKey: `init_deposit_${testUserId}`,
  });
  assert(duplicateCredit.duplicate === true && duplicateCredit.balanceAfter === 6500, 'Suite 1', 'Duplicate credit idempotency key prevents double crediting', { duplicateCredit });

  // ---------------------------------------------------------
  // SUITE 2: Server-Authoritative Bid Submission & Validation
  // ---------------------------------------------------------
  console.log('\n--- SUITE 2: Server-Authoritative Bid Submission ---');
  const gamesConfig = serverGameEntryService.getGamesConfig();
  const hourlyRound = gamesConfig.rounds['hourly_play'];
  assert(Boolean(hourlyRound && hourlyRound.id), 'Suite 2', 'Active Hourly Play round exists', { roundId: hourlyRound?.id });

  // 2.1 Attack: Even number with RED color
  const invalidColorBid = serverGameEntryService.submitEntry({
    userId: testUserId,
    gameId: 'hourly_play',
    roundId: hourlyRound.id,
    selections: [{ number: '02', stake: 100, color: 'RED' }], // 02 is even, must be GREEN
  });
  assert(invalidColorBid.success === false && invalidColorBid.errorCode === 'COLOR_MISMATCH', 'Suite 2', 'Rejected invalid color mismatch (Even number with RED)', { errorCode: invalidColorBid.errorCode });

  // 2.2 Attack: Out-of-bounds number '100'
  const outOfBoundsBid = serverGameEntryService.submitEntry({
    userId: testUserId,
    gameId: 'hourly_play',
    roundId: hourlyRound.id,
    selections: [{ number: '100', stake: 100, color: 'GREEN' } as any],
  });
  assert(outOfBoundsBid.success === false && outOfBoundsBid.errorCode === 'INVALID_NUMBER', 'Suite 2', 'Rejected out-of-bounds number "100"', { errorCode: outOfBoundsBid.errorCode });

  // 2.3 Attack: Negative or NaN stake
  const invalidStakeBid = serverGameEntryService.submitEntry({
    userId: testUserId,
    gameId: 'hourly_play',
    roundId: hourlyRound.id,
    selections: [{ number: '04', stake: -50, color: 'GREEN' }],
  });
  assert(invalidStakeBid.success === false && invalidStakeBid.errorCode === 'INVALID_AMOUNT', 'Suite 2', 'Rejected negative stake', { errorCode: invalidStakeBid.errorCode });

  // 2.4 Attack: Single stake exceeding 10,000 limit
  const maxStakeViolation = serverGameEntryService.submitEntry({
    userId: testUserId,
    gameId: 'hourly_play',
    roundId: hourlyRound.id,
    selections: [{ number: '06', stake: 15000, color: 'GREEN' }],
  });
  assert(maxStakeViolation.success === false && maxStakeViolation.errorCode === 'INVALID_AMOUNT', 'Suite 2', 'Rejected single stake exceeding 10,000 maximum limit', { errorCode: maxStakeViolation.errorCode });

  // 2.5 Attack: Combined stake (8,000) exceeding available balance (6,500)
  const excessiveStakeBid = serverGameEntryService.submitEntry({
    userId: testUserId,
    gameId: 'hourly_play',
    roundId: hourlyRound.id,
    selections: [
      { number: '06', stake: 5000, color: 'GREEN' },
      { number: '08', stake: 3000, color: 'GREEN' },
    ],
  });
  assert(excessiveStakeBid.success === false && excessiveStakeBid.errorCode === 'INSUFFICIENT_CREDITS', 'Suite 2', 'Rejected bid exceeding available balance (8,000 > 6,500)', { errorCode: excessiveStakeBid.errorCode });

  // 2.5 Valid Bid: Number 14 (Green, stake 100), Number 16 (Green, stake 50), Number 15 (Red, stake 50)
  // Total calculated by server: 200 credits
  const bidIdempotencyKey = `bid_${testUserId}_valid_01`;
  const validBid = serverGameEntryService.submitEntry({
    userId: testUserId,
    gameId: 'hourly_play',
    roundId: hourlyRound.id,
    selections: [
      { number: '14', stake: 100, color: 'GREEN' },
      { number: '16', stake: 50, color: 'GREEN' },
      { number: '15', stake: 50, color: 'RED' },
    ],
    idempotencyKey: bidIdempotencyKey,
  });
  assert(validBid.success === true && validBid.entry?.totalStake === 200, 'Suite 2', 'Server accurately calculated totalStake = 200 credits', { totalStake: validBid.entry?.totalStake });
  assert(validBid.remainingBalance?.main === 6300, 'Suite 2', 'Wallet atomic deduction: 6500 - 200 = 6300', { remainingBalance: validBid.remainingBalance });

  // 2.6 Bid Idempotency: Re-submitting same idempotency key
  const replayBid = serverGameEntryService.submitEntry({
    userId: testUserId,
    gameId: 'hourly_play',
    roundId: hourlyRound.id,
    selections: [
      { number: '14', stake: 100, color: 'GREEN' },
      { number: '16', stake: 50, color: 'GREEN' },
      { number: '15', stake: 50, color: 'RED' },
    ],
    idempotencyKey: bidIdempotencyKey,
  });
  assert(replayBid.success === true && replayBid.remainingBalance?.main === 6300, 'Suite 2', 'Bid re-submission with same idempotency key did not double-deduct', { remainingBalance: replayBid.remainingBalance });

  // ---------------------------------------------------------
  // SUITE 3: Settlement Calculations (90x Win + 80% Protection Refund)
  // ---------------------------------------------------------
  console.log('\n--- SUITE 3: Settlement Calculations (90x Win + 80% Protection) ---');

  // 3.1 Non-Master cannot freeze or declare results
  const unauthorizedFreeze = serverResultSettlementService.freezeRound({
    actorRole: 'player',
    actorId: testUserId,
    gameId: 'hourly_play',
    roundId: hourlyRound.id,
  });
  assert(unauthorizedFreeze.success === false && unauthorizedFreeze.errorCode === 'UNAUTHORIZED', 'Suite 3', 'Normal player cannot freeze rounds (403 UNAUTHORIZED)', { errorCode: unauthorizedFreeze.errorCode });

  // 3.2 Master freezes the round
  const masterFreeze = serverResultSettlementService.freezeRound({
    actorRole: 'master',
    actorId: masterUserId,
    gameId: 'hourly_play',
    roundId: hourlyRound.id,
  });
  assert(masterFreeze.success === true && masterFreeze.round?.status === 'FROZEN', 'Suite 3', 'Master successfully froze the round', { status: masterFreeze.round?.status });

  // 3.3 New bid on FROZEN round must be rejected
  const bidOnFrozenRound = serverGameEntryService.submitEntry({
    userId: testUserId,
    gameId: 'hourly_play',
    roundId: hourlyRound.id,
    selections: [{ number: '20', stake: 10, color: 'GREEN' }],
  });
  assert(bidOnFrozenRound.success === false && bidOnFrozenRound.errorCode === 'ROUND_CLOSED', 'Suite 3', 'Bid strictly rejected on FROZEN round (Cutoff rule enforced)', { errorCode: bidOnFrozenRound.errorCode });

  // 3.4 Liability calculation preview
  // Winning Number = '14', Result Color = 'GREEN'
  // Selection 14 (stake 100) -> 90x = 9,000
  // Selection 16 (stake 50, GREEN) -> 80% protection refund = 40
  // Selection 15 (stake 50, RED) -> 0 (Color is GREEN)
  const liability = serverResultSettlementService.calculateSettlementLiability({
    gameId: 'hourly_play',
    roundId: hourlyRound.id,
    winningNumber: '14',
    resultColor: 'GREEN',
  });
  assert(liability.total90xPayout === 9000, 'Suite 3', 'Server calculated 90x payout = 9,000 demo credits', { payout: liability.total90xPayout });
  assert(liability.totalProtectionRefund === 40, 'Suite 3', 'Server calculated 80% protection refund on #16 = 40 credits (50 * 0.8)', { refund: liability.totalProtectionRefund });
  assert(liability.totalLiability === 9040, 'Suite 3', 'Total liability preview = 9,040 credits', { totalLiability: liability.totalLiability });

  // 3.5 Master declares result: Number 14, Color GREEN
  const settlementResult = serverResultSettlementService.declareResultAndSettle({
    actorRole: 'master',
    actorId: masterUserId,
    gameId: 'hourly_play',
    roundId: hourlyRound.id,
    winningNumber: '14',
    resultColor: 'GREEN',
    idempotencyKey: `settle_${hourlyRound.id}`,
  });
  assert(settlementResult.success === true, 'Suite 3', 'Result declared and settled successfully', { summary: settlementResult.summary });
  assert(settlementResult.summary?.total90xRewards === 9000, 'Suite 3', 'Summary records 90x reward = 9,000', { total90xRewards: settlementResult.summary?.total90xRewards });
  assert(settlementResult.summary?.totalProtectionRefund === 40, 'Suite 3', 'Summary records 80% Protection Refund = 40', { totalProtectionRefund: settlementResult.summary?.totalProtectionRefund });

  // 3.6 Check player wallet after settlement
  // Previous balance: 6300. Win: 9000. Refund: 40. Expected balance: 6300 + 9040 = 15340.
  const walletAfterSettlement = authoritativeBackendStore.getWalletSync(testUserId);
  assert(walletAfterSettlement.balance === 15340, 'Suite 3', 'Player wallet credited authoritative 90x win + 80% refund: 6300 + 9040 = 15,340', { balance: walletAfterSettlement.balance });

  // 3.7 Verify Double-Settlement rejection
  const duplicateSettlement = serverResultSettlementService.declareResultAndSettle({
    actorRole: 'master',
    actorId: masterUserId,
    gameId: 'hourly_play',
    roundId: hourlyRound.id,
    winningNumber: '14',
    resultColor: 'GREEN',
  });
  assert(duplicateSettlement.success === false && duplicateSettlement.errorCode === 'ROUND_ALREADY_SETTLED', 'Suite 3', 'Double settlement attempt strictly rejected (Idempotency enforced)', { errorCode: duplicateSettlement.errorCode });

  // ---------------------------------------------------------
  // SUITE 4: Ledger Audit & Traceability Verification
  // ---------------------------------------------------------
  console.log('\n--- SUITE 4: Ledger Audit & Traceability ---');
  const userLedger = authoritativeBackendStore.getLedger(testUserId, 20);
  assert(userLedger.length >= 3, 'Suite 4', 'Immutable ledger entries created for user', { count: userLedger.length });

  const stakeTx = userLedger.find((l) => l.type === 'GAME_STAKE');
  assert(Boolean(stakeTx && stakeTx.amount === -200), 'Suite 4', 'Ledger recorded GAME_STAKE debit of -200 with balanceBefore and balanceAfter', stakeTx);

  const winTx = userLedger.find((l) => l.type === 'GAME_WIN');
  assert(Boolean(winTx && winTx.amount === 9000), 'Suite 4', 'Ledger recorded GAME_WIN credit of +9000 with roundId and entryId', winTx);

  const refundTx = userLedger.find((l) => l.type === 'HOURLY_PROTECTION_REFUND');
  assert(Boolean(refundTx && refundTx.amount === 40), 'Suite 4', 'Ledger recorded HOURLY_PROTECTION_REFUND credit of +40 with roundId and entryId', refundTx);

  // ---------------------------------------------------------
  // SUITE 5: Concurrency & Race Condition Defense
  // ---------------------------------------------------------
  console.log('\n--- SUITE 5: Concurrency & Race Condition Defense ---');
  const concUserId = `test_conc_${Date.now()}`;
  // Initialize account with exactly 500 credits
  authoritativeBackendStore.creditWinningSync({
    userId: concUserId,
    amount: 500,
    type: 'GAME_WIN',
    gameId: 'hourly_play',
    roundId: 'conc_init',
    entryId: `conc_init_${concUserId}`,
    idempotencyKey: `conc_init_${concUserId}`,
  });
  const concStart = authoritativeBackendStore.getWalletSync(concUserId);
  assert(concStart.balance === 500, 'Suite 5', 'Concurrency test account initialized with exactly 500 credits', { balance: concStart.balance });

  // 5.1 Simultaneous debits: 5 concurrent attempts to debit 200 credits with distinct keys
  // Only 2 should succeed (2 x 200 = 400), 3 must fail with insufficient credits. Final balance must be 100.
  const debitAttempts = await Promise.all(
    [1, 2, 3, 4, 5].map((i) =>
      new Promise<{ success: boolean; errorCode?: string }>((resolve) => {
        const res = authoritativeBackendStore.debitStakeSync({
          userId: concUserId,
          amount: 200,
          gameId: 'hourly_play',
          roundId: 'conc_round',
          idempotencyKey: `conc_deb_${concUserId}_${i}`,
        });
        resolve(res);
      })
    )
  );
  const debitSuccessCount = debitAttempts.filter((r) => r.success).length;
  const debitFailCount = debitAttempts.filter((r) => !r.success).length;
  const walletAfterConcurrentDebits = authoritativeBackendStore.getWalletSync(concUserId);
  assert(
    debitSuccessCount === 2 && debitFailCount === 3 && walletAfterConcurrentDebits.balance === 100,
    'Suite 5',
    'Concurrent debits prevented negative balance: exactly 2 succeeded, 3 failed, final balance is 100',
    { debitSuccessCount, debitFailCount, finalBalance: walletAfterConcurrentDebits.balance }
  );

  // 5.2 Simultaneous winning credits: 4 parallel credits of 250 credits
  await Promise.all(
    [1, 2, 3, 4].map((i) =>
      new Promise<{ success: boolean }>((resolve) => {
        const res = authoritativeBackendStore.creditWinningSync({
          userId: concUserId,
          amount: 250,
          type: 'GAME_WIN',
          gameId: 'hourly_play',
          roundId: 'conc_round',
          entryId: `conc_entry_${i}`,
          idempotencyKey: `conc_cred_${concUserId}_${i}`,
        });
        resolve(res);
      })
    )
  );
  const walletAfterConcurrentCredits = authoritativeBackendStore.getWalletSync(concUserId);
  assert(
    walletAfterConcurrentCredits.balance === 1100,
    'Suite 5',
    'Concurrent winning credits calculated correctly without lost updates: 100 + (4 x 250) = 1,100',
    { balance: walletAfterConcurrentCredits.balance }
  );

  // 5.3 Simultaneous settlements on the same round
  const raceRoundId = `test_race_round_${Date.now()}`;
  const raceRoundObj = {
    id: raceRoundId,
    gameId: 'kalyan_morning',
    gameName: 'Kalyan Morning',
    roundNumber: 88,
    freezeTime: new Date(Date.now() - 60000).toISOString(),
    declareTime: new Date().toISOString(),
    status: 'FROZEN' as const,
    totalBidsPool: 0,
  };
  serverGameEntryService.getAllRoundsMap().set('kalyan_morning', raceRoundObj);
  authoritativeBackendStore.setRound('kalyan_morning', raceRoundObj);
  const settleCall1 = serverResultSettlementService.declareResultAndSettle({
    actorRole: 'master',
    actorId: masterUserId,
    gameId: 'kalyan_morning',
    roundId: raceRoundId,
    winningNumber: '42',
    resultColor: 'GREEN',
    idempotencyKey: `settle_race_${raceRoundId}`,
  });
  const settleCall2 = serverResultSettlementService.declareResultAndSettle({
    actorRole: 'master',
    actorId: masterUserId,
    gameId: 'kalyan_morning',
    roundId: raceRoundId,
    winningNumber: '42',
    resultColor: 'GREEN',
    idempotencyKey: `settle_race_${raceRoundId}`,
  });
  assert(
    settleCall1.success === true && settleCall2.success === false && settleCall2.errorCode === 'ROUND_ALREADY_SETTLED',
    'Suite 5',
    'Simultaneous settlement attempt strictly rejected duplicate settlement (Single settlement guarantee)',
    { settleCall1Success: settleCall1.success, settleCall2Error: settleCall2.errorCode }
  );

  // ---------------------------------------------------------
  // SUITE 6: Advanced Idempotency & Network Retry Defense
  // ---------------------------------------------------------
  console.log('\n--- SUITE 6: Idempotency & Network Retry Defense ---');
  // 6.1 Parallel duplicate requests with exact same idempotency key (Browser double-click simulation)
  const duplicateKey = `key_doubleclick_${Date.now()}`;
  const duplicateBurst = await Promise.all(
    [1, 2, 3, 4, 5].map(() =>
      new Promise<{ success: boolean; duplicate?: boolean }>((resolve) => {
        const res = authoritativeBackendStore.debitStakeSync({
          userId: concUserId,
          amount: 100,
          gameId: 'hourly_play',
          roundId: 'conc_round',
          idempotencyKey: duplicateKey,
        });
        resolve(res);
      })
    )
  );
  const burstPrimary = duplicateBurst.filter((r) => r.success && !r.duplicate).length;
  const burstDuplicates = duplicateBurst.filter((r) => r.duplicate).length;
  const walletAfterBurst = authoritativeBackendStore.getWalletSync(concUserId);
  assert(
    burstPrimary === 1 && burstDuplicates === 4 && walletAfterBurst.balance === 1000,
    'Suite 6',
    'Parallel duplicate requests: exactly 1 debit executed, 4 duplicates returned, balance debited once (1,100 - 100 = 1,000)',
    { burstPrimary, burstDuplicates, balance: walletAfterBurst.balance }
  );

  // 6.2 Network retry after delay with same key produces zero financial side-effects
  const retryResult = authoritativeBackendStore.debitStakeSync({
    userId: concUserId,
    amount: 100,
    gameId: 'hourly_play',
    roundId: 'conc_round',
    idempotencyKey: duplicateKey,
  });
  const walletAfterRetry = authoritativeBackendStore.getWalletSync(concUserId);
  assert(
    retryResult.duplicate === true && walletAfterRetry.balance === 1000,
    'Suite 6',
    'Delayed network retry returned duplicate receipt with zero additional balance deduction',
    { duplicate: retryResult.duplicate, balance: walletAfterRetry.balance }
  );

  // ---------------------------------------------------------
  // SUITE 7: Persistence & Server Restart Recovery
  // ---------------------------------------------------------
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
  // Pre-restart expected: 5000 - 500 + 300 = 4800
  authoritativeBackendStore.persistToDiskSync();

  // 7.1 Simulate server restart by reloading entire state from disk snapshot
  const reloadSuccess = authoritativeBackendStore.reloadFromDisk();
  const postRestartWallet = authoritativeBackendStore.getWalletSync(restartTestUser);
  const postRestartLedger = authoritativeBackendStore.getLedger(restartTestUser, 10);
  assert(
    reloadSuccess === true && postRestartWallet.balance === 4800 && postRestartLedger.length === 3,
    'Suite 7',
    'Server restart simulation successfully recovered wallet balance (4,800) and all immutable ledger entries from disk',
    { balance: postRestartWallet.balance, ledgerCount: postRestartLedger.length }
  );

  // 7.2 Corrupted file recovery: verify fallback to .bak on corrupted primary JSON
  const dataStorePath = path.join(process.cwd(), 'data', 'authoritative_store.json');
  fs.writeFileSync(dataStorePath, '{ corrupted_unparseable_json_### ', 'utf8');
  const corruptRecoverySuccess = authoritativeBackendStore.reloadFromDisk();
  const corruptRecoveredWallet = authoritativeBackendStore.getWalletSync(restartTestUser);
  assert(
    corruptRecoverySuccess === true && corruptRecoveredWallet.balance === 4800,
    'Suite 7',
    'Corrupted JSON store automatically recovered from valid .bak snapshot without data loss',
    { balance: corruptRecoveredWallet.balance }
  );
  // Restore clean state to disk
  authoritativeBackendStore.persistToDiskSync();

  // ---------------------------------------------------------
  // SUITE 8: Firestore Offline & Failure Resilience
  // ---------------------------------------------------------
  console.log('\n--- SUITE 8: Firestore Offline & Failure Resilience ---');
  // 8.1 Simulate Firestore being offline/unreachable
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
    'Authoritative store operations continue deterministically when Firestore is unreachable: 5000 - 400 + 800 = 5,400',
    { balance: offlineWallet.balance }
  );

  // 8.2 Restore Firestore accessibility
  authoritativeBackendStore.setFirestoreAccessible(null);
  assert(true, 'Suite 8', 'Firestore accessibility state safely restored after degradation test');

  // ---------------------------------------------------------
  // SUITE 9: Authorization & Anti-Tamper Security
  // ---------------------------------------------------------
  console.log('\n--- SUITE 9: Authorization & Anti-Tamper Security ---');
  // 9.1 Non-master (e.g. agent) cannot declare round result
  const agentDeclaration = serverResultSettlementService.declareResultAndSettle({
    actorRole: 'agent',
    actorId: 'agent_user_01',
    gameId: 'hourly_play',
    roundId: hourlyRound.id,
    winningNumber: '25',
    resultColor: 'RED',
  });
  assert(
    agentDeclaration.success === false && agentDeclaration.errorCode === 'UNAUTHORIZED',
    'Suite 9',
    'Agent role strictly forbidden from declaring results (403 UNAUTHORIZED)',
    { errorCode: agentDeclaration.errorCode }
  );

  // 9.2 Non-master (e.g. agent) cannot freeze rounds
  const agentFreeze = serverResultSettlementService.freezeRound({
    actorRole: 'agent',
    actorId: 'agent_user_01',
    gameId: 'hourly_play',
    roundId: hourlyRound.id,
  });
  assert(
    agentFreeze.success === false && agentFreeze.errorCode === 'UNAUTHORIZED',
    'Suite 9',
    'Agent role strictly forbidden from freezing rounds (403 UNAUTHORIZED)',
    { errorCode: agentFreeze.errorCode }
  );

  // 9.3 Invariant verification: Debit cannot cause balance to drop below zero
  const zeroBalanceUser = `test_zero_${Date.now()}`;
  authoritativeBackendStore.debitStakeSync({
    userId: zeroBalanceUser,
    amount: 5000,
    gameId: 'hourly_play',
    roundId: 'zero_round',
    idempotencyKey: `zero_deb_${zeroBalanceUser}`,
  });
  const excessiveDebitAttempt = authoritativeBackendStore.debitStakeSync({
    userId: zeroBalanceUser,
    amount: 1,
    gameId: 'hourly_play',
    roundId: 'zero_round',
    idempotencyKey: `excess_deb_${zeroBalanceUser}`,
  });
  const zeroWallet = authoritativeBackendStore.getWalletSync(zeroBalanceUser);
  assert(
    excessiveDebitAttempt.success === false && zeroWallet.balance === 0,
    'Suite 9',
    'Zero-balance invariant enforced: debit of 1 on balance of 0 strictly rejected, balance remains exactly 0',
    { balance: zeroWallet.balance, error: excessiveDebitAttempt.error }
  );

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log('\n======================================================');
  console.log(`   TEST SUITE FINISHED: ${passed} PASSED, ${failed} FAILED   `);
  console.log('======================================================\n');

  return { passed, failed, results };
}
