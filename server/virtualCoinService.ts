import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from './firebaseAdmin.ts';
import type { ServerRole } from './authMiddleware.ts';

export type CoinLedgerType =
  | 'GAME_STAKE'
  | 'GAME_WIN'
  | 'HOURLY_PROTECTION'
  | 'DAILY_CLAIM'
  | 'ACHIEVEMENT_REWARD'
  | 'REFERRAL_REWARD'
  | 'MASTER_ADJUSTMENT'
  | 'HELPER_GIFT';

export interface CoinWallet {
  uid: string;
  balance: number;
  bonusBalance: number;
  currency: 'COIN';
  updatedAt?: FirebaseFirestore.Timestamp;
}

export interface CoinLedgerEntry {
  id: string;
  userId: string;
  type: CoinLedgerType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  bonusBalanceBefore: number;
  bonusBalanceAfter: number;
  actorId: string;
  gameId?: string;
  roundId?: string;
  referenceId?: string;
  status: 'COMPLETED' | 'REJECTED';
  ip?: string;
  device?: string;
  createdAt?: FirebaseFirestore.Timestamp;
}

const walletRef = (uid: string) => getAdminDb().collection('coinWallets').doc(uid);
const ledgerRef = () => getAdminDb().collection('coinLedger');
const userRef = (uid: string) => getAdminDb().collection('users').doc(uid);
const adminRef = (uid: string) => getAdminDb().collection('admins').doc(uid);

export async function getRole(uid: string): Promise<ServerRole> {
  const db = getAdminDb();
  const admin = await adminRef(uid).get();
  if (admin.exists) return admin.data()?.role === 'agent' ? 'agent' : 'master';
  const user = await userRef(uid).get();
  return user.data()?.role === 'agent' ? 'agent' : 'player';
}

function assertAmount(amount: number) {
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 10_000_000) {
    throw new Error('Coin amount must be a positive whole number within the prototype limit.');
  }
}

async function ensureWallet(tx: FirebaseFirestore.Transaction, uid: string) {
  const ref = walletRef(uid);
  const snap = await tx.get(ref);
  if (!snap.exists) {
    tx.create(ref, {
      uid,
      balance: 0,
      bonusBalance: 0,
      currency: 'COIN',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return { balance: 0, bonusBalance: 0 };
  }
  return {
    balance: Number(snap.data()?.balance || 0),
    bonusBalance: Number(snap.data()?.bonusBalance || 0),
  };
}

export async function getWallet(uid: string): Promise<CoinWallet> {
  const snap = await walletRef(uid).get();
  if (!snap.exists) return { uid, balance: 0, bonusBalance: 0, currency: 'COIN' };
  return { uid, ...(snap.data() as Omit<CoinWallet, 'uid'>) };
}

export async function getLedger(uid: string, limit = 50) {
  const snap = await ledgerRef().where('userId', '==', uid).orderBy('createdAt', 'desc').limit(Math.min(limit, 100)).get();
  return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Omit<CoinLedgerEntry, 'id'>) }));
}

export async function applyCoinDelta(params: {
  userId: string;
  actorId: string;
  amount: number;
  type: CoinLedgerType;
  bonus?: boolean;
  gameId?: string;
  roundId?: string;
  referenceId?: string;
  idempotencyKey: string;
  ip?: string;
  device?: string;
}) {
  const { userId, actorId, amount, type, bonus = false, gameId, roundId, referenceId, idempotencyKey, ip, device } = params;
  assertAmount(amount);
  if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 120) throw new Error('Valid idempotency key is required.');

  const ledgerDocument = ledgerRef().doc(`tx_${idempotencyKey}`);
  const db = getAdminDb();

  return db.runTransaction(async (tx) => {
    const existing = await tx.get(ledgerDocument);
    if (existing.exists) return { id: existing.id, ...(existing.data() as object), duplicate: true };

    const ref = walletRef(userId);
    const current = await ensureWallet(tx, userId);
    const before = bonus ? current.bonusBalance : current.balance;
    const after = before + amount;

    tx.set(ref, {
      uid: userId,
      balance: bonus ? current.balance : after,
      bonusBalance: bonus ? after : current.bonusBalance,
      currency: 'COIN',
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    tx.create(ledgerDocument, {
      userId,
      type,
      amount,
      balanceBefore: current.balance,
      balanceAfter: bonus ? current.balance : after,
      bonusBalanceBefore: current.bonusBalance,
      bonusBalanceAfter: bonus ? after : current.bonusBalance,
      actorId,
      gameId,
      roundId,
      referenceId,
      status: 'COMPLETED',
      ip,
      device,
      idempotencyKey,
      createdAt: FieldValue.serverTimestamp(),
    });

    return { id: ledgerDocument.id, userId, amount, type, duplicate: false };
  });
}

export async function debitCoins(params: {
  userId: string;
  actorId: string;
  amount: number;
  type: 'GAME_STAKE';
  gameId?: string;
  roundId?: string;
  referenceId?: string;
  idempotencyKey: string;
  ip?: string;
  device?: string;
}) {
  const { userId, actorId, amount, type, gameId, roundId, referenceId, idempotencyKey, ip, device } = params;
  assertAmount(amount);
  const db = getAdminDb();
  const ledgerDocument = ledgerRef().doc(`tx_${idempotencyKey}`);
  return db.runTransaction(async (tx) => {
    const existing = await tx.get(ledgerDocument);
    if (existing.exists) return { id: existing.id, ...(existing.data() as object), duplicate: true };

    const ref = walletRef(userId);
    const current = await ensureWallet(tx, userId);
    if (current.balance < amount) throw new Error('Insufficient coins.');
    const after = current.balance - amount;

    tx.set(ref, { uid: userId, balance: after, currency: 'COIN', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.create(ledgerDocument, {
      userId, type, amount: -amount,
      balanceBefore: current.balance, balanceAfter: after,
      bonusBalanceBefore: current.bonusBalance, bonusBalanceAfter: current.bonusBalance,
      actorId, gameId, roundId, referenceId, status: 'COMPLETED', ip, device,
      idempotencyKey, createdAt: FieldValue.serverTimestamp(),
    });
    return { id: ledgerDocument.id, userId, amount: -amount, type, duplicate: false };
  });
}

export async function giftBonusCoins(params: { actorUid: string; playerUid: string; amount: number; idempotencyKey: string; note?: string; ip?: string; device?: string }) {
  const { actorUid, playerUid, amount, idempotencyKey, note, ip, device } = params;
  if (await getRole(actorUid) !== 'agent') throw new Error('Only Helpers can gift bonus coins.');
  assertAmount(amount);
  return applyCoinDelta({ userId: playerUid, actorId: actorUid, amount, type: 'HELPER_GIFT', bonus: true, referenceId: note, idempotencyKey, ip, device });
}

export async function adminAdjustCoins(params: { actorUid: string; playerUid: string; amount: number; bonus?: boolean; reason: string; idempotencyKey: string; ip?: string; device?: string }) {
  if (await getRole(params.actorUid) !== 'master') throw new Error('Only Master can adjust coin balances.');
  if (!params.reason?.trim()) throw new Error('Adjustment reason is required.');
  return applyCoinDelta({
    userId: params.playerUid,
    actorId: params.actorUid,
    amount: params.amount,
    type: 'MASTER_ADJUSTMENT',
    bonus: Boolean(params.bonus),
    referenceId: params.reason.trim().slice(0, 200),
    idempotencyKey: params.idempotencyKey,
    ip: params.ip,
    device: params.device,
  });
}
