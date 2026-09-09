import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  limit,
  getDocFromServer,
  type DocumentData,
} from 'firebase/firestore';
import { getFirebaseDb, isFirebaseConfigured } from './config';
import { handleFirebaseError } from './errorHandling';

/**
 * ============================================================================
 * WINORA FIRESTORE ARCHITECTURAL CONTRACT
 * ============================================================================
 * Master Rule: The browser/client is strictly untrusted.
 * Client permissions are restricted to:
 *  - Reading user public profiles
 *  - Creating user profile upon signup
 *  - Reading own monetary wallet balance
 *  - Reading public game lobby catalog
 *  - Reading own participation and rewards logs
 *
 * SENSITIVE LOGIC FORBIDDEN ON CLIENT (Reserved for Server-side Cloud Functions):
 *  - Wallet balance additions, deductions, refills
 *  - Virtual game outcome & RNG calculations
 *  - Reward allocations & promotions
 *  - Administrative audits & privileges
 * ============================================================================
 */

export const COLLECTIONS = {
  USERS: 'users',
  WALLETS: 'wallets',
  GAMES: 'games',
  GAME_ROUNDS: 'gameRounds',
  GAME_ENTRIES: 'gameEntries',
  GAME_RESULTS: 'gameResults',
  GAME_REWARDS: 'gameRewards',
  NOTIFICATIONS: 'notifications',
  AUDIT_LOGS: 'auditLogs',
} as const;

// Typed Firestore Document Definitions
export interface UserDocument {
  uid: string;
  phoneNumber: string;
  displayName: string;
  role: 'player';
  status: 'active';
  avatar?: string;
  tier?: 'Bronze' | 'Silver' | 'Gold' | 'Diamond';
  level?: number;
  createdAt: string;
  updatedAt: string;
}

export interface WalletDocument {
  id: string;
  userId: string;
  balance: number;
  currency: string;
  updatedAt: string;
}

export interface GameDocument {
  id: string;
  title: string;
  category: 'slots' | 'crash' | 'table' | 'arcade' | 'dice';
  description: string;
  minVirtualBet: number;
  maxVirtualBet: number;
  status: 'active' | 'maintenance' | 'coming_soon';
  isHot?: boolean;
  isNew?: boolean;
}

export interface GameRoundDocument {
  id: string;
  gameId: string;
  status: 'betting' | 'in_progress' | 'completed' | 'cancelled';
  seedHash?: string;
  startTime: string;
  endTime?: string;
}

export interface GameEntryDocument {
  id: string;
  roundId: string;
  userId: string;
  virtualBetAmount: number;
  entryTime: string;
}

export interface GameResultDocument {
  id: string;
  roundId: string;
  userId: string;
  multiplier: number;
  virtualPayout: number;
  outcome: 'win' | 'loss' | 'push' | 'void';
  calculatedAt: string;
}

export interface GameRewardDocument {
  id: string;
  userId: string;
  type: 'daily_allowance' | 'tier_promotion' | 'starter_bonus' | 'streak_bonus';
  amount: number;
  claimedAt: string;
}

export interface NotificationDocument {
  id: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface AuditLogDocument {
  id: string;
  actorId: string;
  action: string;
  entityPath?: string;
  ipAddress?: string;
  timestamp: string;
}

// ----------------------------------------------------------------------------
// Prepared Profile Operations
// ----------------------------------------------------------------------------

/**
 * Retrieve user profile document from Firestore.
 */
export async function getUserProfile(userId: string): Promise<UserDocument | null> {
  const db = getFirebaseDb();
  if (!db) return null;

  try {
    const userRef = doc(db, COLLECTIONS.USERS, userId);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return snap.data() as UserDocument;
    }
    return null;
  } catch (error) {
    handleFirebaseError(error, 'read', `${COLLECTIONS.USERS}/${userId}`);
    return null;
  }
}

/**
 * Initialize or update initial user profile upon authenticated signup in users/{uid}.
 * Never stores passwords or OTP codes.
 * Role is strictly locked to 'player'.
 */
export async function createUserProfile(
  uid: string,
  data: {
    phoneNumber: string;
    displayName?: string;
    avatar?: string;
    tier?: 'Bronze' | 'Silver' | 'Gold' | 'Diamond';
    level?: number;
    email?: string;
  }
): Promise<boolean> {
  const db = getFirebaseDb();
  if (!db) return false;

  try {
    const userRef = doc(db, COLLECTIONS.USERS, uid);
    const now = new Date().toISOString();
    const fallbackName = data.phoneNumber.length > 4
      ? `Player ••${data.phoneNumber.slice(-4)}`
      : 'WINORA Player';

    const newDoc: UserDocument = {
      uid,
      phoneNumber: data.phoneNumber.trim(),
      displayName: (data.displayName && data.displayName.trim().length >= 2) ? data.displayName.trim() : fallbackName,
      role: 'player', // Default newly registered role is always "player"
      status: 'active', // Default status is always "active"
      avatar: data.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=80',
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(userRef, newDoc, { merge: true });
    return true;
  } catch (error) {
    handleFirebaseError(error, 'create', `${COLLECTIONS.USERS}/${uid}`);
    return false;
  }
}

/**
 * Update safe profile fields for a logged-in player in users/{uid}.
 * Allows updating ONLY safe profile fields such as: displayName (and optional avatar).
 * Modifying uid, role, status, and createdAt is strictly forbidden and rejected.
 * Automatically updates updatedAt timestamp.
 */
export async function updateUserProfile(
  uid: string,
  updates: {
    displayName: string;
    avatar?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const db = getFirebaseDb();
  if (!db) {
    return { success: false, error: 'Firestore database is not initialized.' };
  }

  const trimmedName = updates.displayName.trim();
  if (trimmedName.length < 2 || trimmedName.length > 50) {
    return {
      success: false,
      error: 'Display name must be between 2 and 50 characters long.',
    };
  }

  try {
    const userRef = doc(db, COLLECTIONS.USERS, uid);
    const now = new Date().toISOString();

    // Whitelist ONLY safe fields; never write role, status, uid, or createdAt
    const safePayload: {
      displayName: string;
      updatedAt: string;
      avatar?: string;
    } = {
      displayName: trimmedName,
      updatedAt: now,
    };

    if (updates.avatar && updates.avatar.trim().length > 0) {
      safePayload.avatar = updates.avatar.trim();
    }

    await setDoc(userRef, safePayload, { merge: true });
    return { success: true };
  } catch (error: any) {
    const err = handleFirebaseError(error, 'update', `${COLLECTIONS.USERS}/${uid}`);
    return { success: false, error: err.error };
  }
}

// ----------------------------------------------------------------------------
// Prepared Read Operations for Future Expansion
// ----------------------------------------------------------------------------

/**
 * Read-only access to user's verified wallet document.
 * Browser WRITES to this collection are blocked by Security Rules.
 */
export async function getWallet(userId: string): Promise<WalletDocument | null> {
  const db = getFirebaseDb();
  if (!db) return null;

  try {
    const walletRef = doc(db, COLLECTIONS.WALLETS, userId);
    const snap = await getDoc(walletRef);
    if (snap.exists()) {
      return snap.data() as WalletDocument;
    }
    return null;
  } catch (error) {
    handleFirebaseError(error, 'read', `${COLLECTIONS.WALLETS}/${userId}`);
    return null;
  }
}

/**
 * Read game catalog definitions from Firestore.
 */
export async function getGamesCatalog(): Promise<GameDocument[]> {
  const db = getFirebaseDb();
  if (!db) return [];

  try {
    const gamesCol = collection(db, COLLECTIONS.GAMES);
    const snapshot = await getDocs(gamesCol);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as GameDocument));
  } catch (error) {
    handleFirebaseError(error, 'list', COLLECTIONS.GAMES);
    return [];
  }
}

/**
 * Read user notifications.
 */
export async function getUserNotifications(userId: string): Promise<NotificationDocument[]> {
  const db = getFirebaseDb();
  if (!db) return [];

  try {
    const notifsCol = collection(db, COLLECTIONS.NOTIFICATIONS);
    const q = query(notifsCol, where('userId', 'in', [userId, 'broadcast']), limit(20));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as NotificationDocument));
  } catch (error) {
    handleFirebaseError(error, 'list', COLLECTIONS.NOTIFICATIONS);
    return [];
  }
}

// ----------------------------------------------------------------------------
// Connectivity Verification
// ----------------------------------------------------------------------------

/**
 * Diagnostic test to verify Firestore database reachability.
 */
export async function testFirestoreConnection(): Promise<{
  connected: boolean;
  message: string;
  latencyMs?: number;
}> {
  if (!isFirebaseConfigured()) {
    return {
      connected: false,
      message: 'Firebase configuration is incomplete in .env. Please supply your Firebase project variables.',
    };
  }

  const db = getFirebaseDb();
  if (!db) {
    return {
      connected: false,
      message: 'Failed to obtain Firestore database client instance.',
    };
  }

  const startTime = Date.now();
  try {
    // Attempt a light server-direct probe to test rules and network
    const testDocRef = doc(db, '_system', 'connectionTest');
    await getDocFromServer(testDocRef);
    const latencyMs = Date.now() - startTime;

    return {
      connected: true,
      message: `Successfully connected to Cloud Firestore (Database: ${db.app.options.projectId})`,
      latencyMs,
    };
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    const code = error?.code || '';
    // If the error is 'permission-denied' or document doesn't exist, the network channel to Firestore actually works!
    if (code === 'permission-denied' || code === 'not-found') {
      return {
        connected: true,
        message: `Firestore is reachable (${code}). Backend security rules are actively enforcing access boundaries.`,
        latencyMs,
      };
    }

    const errInfo = handleFirebaseError(error, 'read', '_system/connectionTest');
    return {
      connected: false,
      message: `Firestore connection check failed: ${errInfo.error}`,
      latencyMs,
    };
  }
}
