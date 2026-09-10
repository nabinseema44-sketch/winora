import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from './firebaseAdmin.ts';
import type { ServerRole } from './authMiddleware.ts';

export type CoinTransferType =
  | 'MASTER_TO_AGENT'
  | 'AGENT_TO_PLAYER'
  | 'PLAYER_TO_AGENT'
  | 'AGENT_TO_MASTER'
  | 'ADMIN_ADJUSTMENT'
  | 'GAME_STAKE'
  | 'GAME_WIN'
  | 'HOURLY_PROTECTION_REFUND';

export interface CoinWallet {
  uid: string;
  balance: number;
  currency: 'COIN';
  updatedAt: FirebaseFirestore.Timestamp;
}

export interface CoinLedgerEntry {
  id: string;
  type: CoinTransferType;
  fromUid?: string;
  toUid?: string;
  amount: number;
  balanceAfterFrom?: number;
  balanceAfterTo?: number;
  note?: string;
  idempotencyKey: string;
  createdAt: FirebaseFirestore.Timestamp;
}

const walletRef = (uid: string) => getAdminDb().collection('wallets').doc(uid);
const ledgerRef = () => getAdminDb().collection('walletLedger');
const userRef = (uid: string) => getAdminDb().collection('users').doc(uid);
const adminRef = (uid: string) => getAdminDb().collection('admins').doc(uid);

async function getRole(uid: string): Promise<ServerRole> {
  const db = getAdminDb();
  const admin = await adminRef(uid).get();
  if (admin.exists) {
    const role = admin.data()?.role;
    return role === 'agent' ? 'agent' : 'master';
  }
  const user = await userRef(uid).get();
  return user.data()?.role === 'agent' ? 'agent' : 'player';
}

function assertPositiveAmount(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) {
    throw new Error('Coin amount must be greater than zero and within the prototype limit.');
  }
  if (Math.round(amount * 100) !== amount * 100) {
    throw new Error('Coin amount supports at most two decimal places.');
  }
}

function allowedTransfer(type: CoinTransferType, fromRole: ServerRole, toRole: ServerRole) {
  if (type === 'MASTER_TO_AGENT') return fromRole === 'master' && toRole === 'agent';
  if (type === 'AGENT_TO_PLAYER') return fromRole === 'agent' && toRole === 'player';
  if (type === 'PLAYER_TO_AGENT') return fromRole === 'player' && toRole === 'agent';
  if (type === 'AGENT_TO_MASTER') return fromRole === 'agent' && toRole === 'master';
  return false;
}

async function ensureWalletInTransaction(
  tx: FirebaseFirestore.Transaction,
  uid: string,
): Promise<FirebaseFirestore.DocumentSnapshot> {
  const ref = walletRef(uid);
  const snap = await tx.get(ref);
  if (!snap.exists) {
    tx.create(ref, {
      uid,
      balance: 0,
      currency: 'COIN',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
  return snap;
}

export async function getWallet(uid: string) {
  const db = getAdminDb();
  const snap = await walletRef(uid).get();
  if (!snap.exists) {
    return { uid, balance: 0, currency: 'COIN' as const };
  }
  return { uid, ...snap.data() };
}

export async function getLedger(uid: string, limit = 50) {
  const db = getAdminDb();
  const [fromSnap, toSnap] = await Promise.all([
    ledgerRef().where('fromUid', '==', uid).orderBy('createdAt', 'desc').limit(limit).get(),
    ledgerRef().where('toUid', '==', uid).orderBy('createdAt', 'desc').limit(limit).get(),
  ]);
  const merged = new Map<string, CoinLedgerEntry>();
  for (const doc of [...fromSnap.docs, ...toSnap.docs]) {
    merged.set(doc.id, { id: doc.id, ...(doc.data() as Omit<CoinLedgerEntry, 'id'>) });
  }
  return [...merged.values()]
    .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
    .slice(0, limit);
}

export async function transferCoins(params: {
  actorUid: string;
  recipientUid: string;
  amount: number;
  type: CoinTransferType;
  note?: string;
  idempotencyKey: string;
}) {
  const { actorUid, recipientUid, amount, type, note, idempotencyKey } = params;
  if (!actorUid || !recipientUid || actorUid === recipientUid) throw new Error('Invalid coin transfer participants.');
  assertPositiveAmount(amount);
  if (!idempotencyKey || idempotencyKey.length < 12 || idempotencyKey.length > 120) {
    throw new Error('A valid idempotency key is required.');
  }

  const db = getAdminDb();
  const ledgerDocument = ledgerRef().doc(`transfer_${idempotencyKey}`);

  return db.runTransaction(async (tx) => {
    const existing = await tx.get(ledgerDocument);
    if (existing.exists) {
      return { ...existing.data(), id: existing.id, duplicate: true };
    }

    const [fromRole, toRole] = await Promise.all([getRole(actorUid), getRole(recipientUid)]);
    if (!allowedTransfer(type, fromRole, toRole)) {
      throw new Error(`Transfer ${type} is not allowed for ${fromRole} → ${toRole}.`);
    }

    const fromRef = walletRef(actorUid);
    const toRef = walletRef(recipientUid);
    const fromSnap = await ensureWalletInTransaction(tx, actorUid);
    const toSnap = await ensureWalletInTransaction(tx, recipientUid);

    const fromBalance = Number(fromSnap.data()?.balance || 0);
    const toBalance = Number(toSnap.data()?.balance || 0);
    if (fromBalance < amount) throw new Error('Insufficient available coins.');

    const newFromBalance = Math.round((fromBalance - amount) * 100) / 100;
    const newToBalance = Math.round((toBalance + amount) * 100) / 100;

    tx.set(fromRef, { uid: actorUid, balance: newFromBalance, currency: 'COIN', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(toRef, { uid: recipientUid, balance: newToBalance, currency: 'COIN', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.create(ledgerDocument, {
      type,
      fromUid: actorUid,
      toUid: recipientUid,
      amount,
      balanceAfterFrom: newFromBalance,
      balanceAfterTo: newToBalance,
      note: note?.trim().slice(0, 200) || undefined,
      idempotencyKey,
      createdAt: FieldValue.serverTimestamp(),
    });

    return {
      id: ledgerDocument.id,
      type,
      fromUid: actorUid,
      toUid: recipientUid,
      amount,
      balanceAfterFrom: newFromBalance,
      balanceAfterTo: newToBalance,
      duplicate: false,
    };
  });
}

export async function getPaymentInstruction() {
  const snap = await getAdminDb().collection('system').doc('coinPaymentInstructions').get();
  return snap.exists
    ? snap.data()
    : {
        enabled: false,
        url: '',
        title: 'Coin Deposit Instructions',
        message: 'Contact your assigned Agent for manual coin transfer instructions.',
      };
}

export async function updatePaymentInstruction(params: { actorUid: string; url: string; title?: string; message?: string }) {
  const role = await getRole(params.actorUid);
  if (role !== 'master') throw new Error('Only Master can change the coin instruction link.');
  if (params.url && !/^https:\/\//i.test(params.url)) throw new Error('Instruction link must use HTTPS.');
  await getAdminDb().collection('system').doc('coinPaymentInstructions').set({
    enabled: Boolean(params.url),
    url: params.url.trim(),
    title: params.title?.trim().slice(0, 80) || 'Coin Deposit Instructions',
    message: params.message?.trim().slice(0, 500) || 'Contact your assigned Agent for manual coin transfer instructions.',
    updatedBy: params.actorUid,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  return getPaymentInstruction();
}
