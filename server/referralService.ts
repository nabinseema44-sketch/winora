import crypto from 'crypto';
import { authoritativeBackendStore } from './authoritativeBackendStore.ts';

export type ReferralStatus = 'REGISTERED' | 'QUALIFIED' | 'COMPLETED' | 'CANCELLED';

export interface ReferralRecord {
  id: string;                    // Unique referral record ID (e.g. ref_rel_player-arjun)
  referrerUserId: string;        // Server-resolved referrer ID (never trusted from client)
  referredUserId: string;        // The new/referred player user ID
  referralCode: string;          // The code that was redeemed
  status: ReferralStatus;        // Relationship status
  createdAt: string;             // ISO timestamp
  idempotencyKey: string;        // Deduplication key
  rewardAmount: number;          // Bonus reward amount (virtual credits to BONUS Wallet)
  rewardWallet: 'bonus';         // Strictly Bonus Wallet as mandated by Blueprint
  rewardCredited: boolean;       // Flag indicating if reward was granted
  rewardCreditedAt?: string;     // ISO timestamp when credited
  isAgentReferral?: boolean;     // Whether referrer is an Agent
  agentCommissionRate?: number;  // Commission rate if agent referral
}

export interface UserReferralProfile {
  userId: string;
  displayName: string;
  referralCode: string;
  referredByUserId: string | null; // At most one, immutable once set
  isAgent?: boolean;
  assignedAgentId?: string | null;
  totalCommissionEarned?: number;
  createdAt: string;
}

export interface ReferralConfig {
  REFERRAL_REWARD_AMOUNT: number;   // Configured reward amount in bonus coins
  REFERRAL_COMMISSION_RATE: number; // Commission rate for agent
  IS_REWARD_ACTIVE: boolean;
  QUALIFYING_EVENT: 'FIRST_DEPOSIT' | 'FIRST_BET' | 'MANUAL_ACTIVATION';
}

/**
 * Default central configuration for referral rewards.
 * Rewards are credited strictly to BONUS WALLET.
 */
export const DEFAULT_REFERRAL_CONFIG: ReferralConfig = {
  REFERRAL_REWARD_AMOUNT: 100,
  REFERRAL_COMMISSION_RATE: 0.05,
  IS_REWARD_ACTIVE: true,
  QUALIFYING_EVENT: 'FIRST_DEPOSIT',
};

// Safe, unambiguous uppercase character set (excluding 0, O, 1, I, L)
const CODE_CHARSET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export class ServerReferralService {
  private config: ReferralConfig = { ...DEFAULT_REFERRAL_CONFIG };
  // Maps userId -> UserReferralProfile
  private users: Map<string, UserReferralProfile> = new Map();
  // Maps uppercase referralCode -> userId
  private codeToUserId: Map<string, string> = new Map();
  // Maps referredUserId -> ReferralRecord (at most one relationship per user)
  private referralsByReferredUser: Map<string, ReferralRecord> = new Map();
  // Maps referrerUserId -> ReferralRecord[]
  private referralsByReferrer: Map<string, ReferralRecord[]> = new Map();
  // Processed reward idempotency keys
  private processedRewardKeys: Set<string> = new Set();

  constructor() {
    this.seedDefaultUsers();
  }

  /**
   * Seed standard demo personas with unique, stable referral codes.
   */
  private seedDefaultUsers() {
    const seedList: Array<{ userId: string; displayName: string; code: string; referredBy?: string }> = [
      { userId: 'player-sumit', displayName: 'Sumit Joshi', code: 'WIN42SUM8' },
      { userId: 'player-arjun', displayName: 'Arjun Mehta', code: 'WIN78ARJ1', referredBy: 'player-sumit' },
      { userId: 'player-sneha', displayName: 'Sneha Roy', code: 'WIN99SNE3' },
      { userId: 'demo-player-uid-123', displayName: 'Demo Player VIP', code: 'WIN123DEM' },
    ];

    for (const seed of seedList) {
      this.registerSeedUser(seed.userId, seed.displayName, seed.code, seed.referredBy);
    }
  }

  private registerSeedUser(userId: string, displayName: string, code: string, referredBy?: string) {
    const normalizedCode = code.toUpperCase();
    const profile: UserReferralProfile = {
      userId,
      displayName,
      referralCode: normalizedCode,
      referredByUserId: referredBy || null,
      createdAt: new Date().toISOString(),
    };
    this.users.set(userId, profile);
    this.codeToUserId.set(normalizedCode, userId);

    if (referredBy) {
      const record: ReferralRecord = {
        id: `ref_rel_${userId}`,
        referrerUserId: referredBy,
        referredUserId: userId,
        referralCode: normalizedCode,
        status: 'REGISTERED',
        createdAt: new Date().toISOString(),
        idempotencyKey: `rel_${userId}_${referredBy}`,
        rewardAmount: 0,
        rewardWallet: 'bonus',
        rewardCredited: false,
      };
      this.referralsByReferredUser.set(userId, record);
      const list = this.referralsByReferrer.get(referredBy) || [];
      list.push(record);
      this.referralsByReferrer.set(referredBy, list);
    }
  }

  /**
   * Generate a unique, cryptographically random referral code.
   * Format: 'WIN' + 6 alphanumeric characters (e.g. WIN78K4N2).
   * Stable, easy to share, case-insensitive, does not expose internal IDs.
   */
  public generateUniqueReferralCode(): string {
    const maxAttempts = 100;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let code = 'WIN';
      const randomBytes = crypto.randomBytes(6);
      for (let i = 0; i < 6; i++) {
        const index = randomBytes[i] % CODE_CHARSET.length;
        code += CODE_CHARSET[index];
      }
      if (!this.codeToUserId.has(code)) {
        return code;
      }
    }
    // Fallback if collision
    return `WIN${Date.now().toString(36).toUpperCase().slice(-6)}`;
  }

  /**
   * Resolve a referral code (case-insensitive).
   * Returns safe public metadata without exposing internal database IDs.
   */
  public resolveReferralCode(code: string): {
    valid: boolean;
    referrerDisplayName?: string;
    referralCode?: string;
    error?: string;
  } {
    if (!code || typeof code !== 'string') {
      return { valid: false, error: 'Referral code is required.' };
    }

    const normalized = code.trim().toUpperCase();
    const referrerId = this.codeToUserId.get(normalized);
    if (!referrerId) {
      return { valid: false, error: 'Invalid referral code.' };
    }

    const referrer = this.users.get(referrerId);
    return {
      valid: true,
      referrerDisplayName: referrer?.displayName || 'WINORA Player',
      referralCode: normalized,
    };
  }

  /**
   * Register or ensure a user profile exists on the server with a unique referralCode.
   */
  public registerUser(params: {
    userId: string;
    displayName: string;
    referralCodeToRedeem?: string;
  }): {
    success: boolean;
    userProfile: UserReferralProfile;
    referralRecord?: ReferralRecord;
    error?: string;
    errorCode?: string;
  } {
    const { userId, displayName, referralCodeToRedeem } = params;

    let user = this.users.get(userId);
    if (!user) {
      const myCode = this.generateUniqueReferralCode();
      user = {
        userId,
        displayName: displayName || 'WINORA Player',
        referralCode: myCode,
        referredByUserId: null,
        createdAt: new Date().toISOString(),
      };
      this.users.set(userId, user);
      this.codeToUserId.set(myCode, userId);
    }

    // If referral code is supplied, establish relationship
    if (referralCodeToRedeem && referralCodeToRedeem.trim().length > 0) {
      const linkResult = this.createReferralRelationship({
        referredUserId: userId,
        referralCode: referralCodeToRedeem,
      });

      if (!linkResult.success) {
        return {
          success: false,
          userProfile: user,
          error: linkResult.error,
          errorCode: linkResult.errorCode,
        };
      }

      return {
        success: true,
        userProfile: this.users.get(userId)!,
        referralRecord: linkResult.referralRecord,
      };
    }

    return {
      success: true,
      userProfile: user,
    };
  }

  /**
   * Establish an authoritative referral relationship on the server.
   *
   * Core Enforcement Rules:
   * 1. Server Authority: Resolves the referral code; does NOT trust client-provided referrer IDs.
   * 2. Invalid codes are strictly rejected.
   * 3. Self-referrals are strictly rejected.
   * 4. Single Referrer Rule: A user can have at most ONE referrer.
   * 5. Immutability: An existing referrer cannot be changed or replaced.
   * 6. Loop Prevention: User A cannot refer User B if User B is already in User A's referrer ancestor chain.
   * 7. Idempotency: Duplicate calls with the same referrer return the existing record without duplicate entries.
   */
  public createReferralRelationship(params: {
    referredUserId: string;
    referralCode: string;
  }): {
    success: boolean;
    referralRecord?: ReferralRecord;
    error?: string;
    errorCode?: string;
  } {
    const { referredUserId, referralCode } = params;

    if (!referredUserId || typeof referredUserId !== 'string') {
      return { success: false, error: 'User ID is required.', errorCode: 'INVALID_USER_ID' };
    }

    if (!referralCode || typeof referralCode !== 'string' || referralCode.trim().length === 0) {
      return { success: false, error: 'Referral code is required.', errorCode: 'INVALID_REFERRAL_CODE' };
    }

    const normalizedCode = referralCode.trim().toUpperCase();

    // 1. Resolve referrer via server code lookup
    const referrerUserId = this.codeToUserId.get(normalizedCode);
    if (!referrerUserId) {
      return {
        success: false,
        error: `Referral code "${normalizedCode}" does not exist.`,
        errorCode: 'INVALID_REFERRAL_CODE',
      };
    }

    // 2. Reject self-referral
    if (referrerUserId === referredUserId) {
      return {
        success: false,
        error: 'Self-referral is strictly forbidden.',
        errorCode: 'SELF_REFERRAL_FORBIDDEN',
      };
    }

    // 3. Check existing user state
    const user = this.users.get(referredUserId);
    const existingRecord = this.referralsByReferredUser.get(referredUserId);

    // 4. Idempotency & Immutability Checks
    if (user?.referredByUserId || existingRecord) {
      const currentReferrer = user?.referredByUserId || existingRecord?.referrerUserId;

      // If same referrer is passed again -> Return existing record idempotently
      if (currentReferrer === referrerUserId) {
        return {
          success: true,
          referralRecord: existingRecord,
        };
      }

      // If different referrer -> Reject replacement
      return {
        success: false,
        error: 'User already has an established referrer. Existing referrer cannot be replaced or updated.',
        errorCode: 'REFERRER_ALREADY_ATTACHED',
      };
    }

    // 5. Loop Prevention (e.g. B -> A when A is already referred by B)
    if (this.detectReferralCycle(referrerUserId, referredUserId)) {
      return {
        success: false,
        error: 'Referral loop detected: cannot establish circular referral relationship.',
        errorCode: 'REFERRAL_LOOP_DETECTED',
      };
    }

    // 6. Create immutable ReferralRecord
    const idempotencyKey = `rel_${referredUserId}_${referrerUserId}`;
    const recordId = `ref_rel_${referredUserId}`;
    const now = new Date().toISOString();

    // Check if referrer is an agent
    const referrerProfile = this.users.get(referrerUserId);
    const isAgent = Boolean(referrerProfile?.isAgent || normalizedCode.startsWith('AGT'));

    const record: ReferralRecord = {
      id: recordId,
      referrerUserId,
      referredUserId,
      referralCode: normalizedCode,
      status: 'REGISTERED',
      createdAt: now,
      idempotencyKey,
      rewardAmount: 0,
      rewardWallet: 'bonus',
      rewardCredited: false,
      isAgentReferral: isAgent,
      agentCommissionRate: isAgent ? (this.config.REFERRAL_COMMISSION_RATE || 0.05) : undefined,
    };

    // 7. Update user profile with established referrer
    if (user) {
      user.referredByUserId = referrerUserId;
      if (isAgent) {
        user.assignedAgentId = referrerUserId;
      }
    } else {
      const myCode = this.generateUniqueReferralCode();
      const newProfile: UserReferralProfile = {
        userId: referredUserId,
        displayName: 'WINORA Player',
        referralCode: myCode,
        referredByUserId: referrerUserId,
        assignedAgentId: isAgent ? referrerUserId : null,
        createdAt: now,
      };
      this.users.set(referredUserId, newProfile);
      this.codeToUserId.set(myCode, referredUserId);
    }

    // 8. Store records in index maps
    this.referralsByReferredUser.set(referredUserId, record);
    const referrerList = this.referralsByReferrer.get(referrerUserId) || [];
    referrerList.push(record);
    this.referralsByReferrer.set(referrerUserId, referrerList);

    return {
      success: true,
      referralRecord: record,
    };
  }

  /**
   * Traverse referrer ancestry to detect circular dependencies.
   * Returns true if setting referrerUserId would create a cycle back to referredUserId.
   */
  private detectReferralCycle(potentialReferrerId: string, candidateReferredId: string): boolean {
    let currentId: string | null = potentialReferrerId;
    const visited = new Set<string>();

    while (currentId) {
      if (currentId === candidateReferredId) {
        return true; // Cycle detected!
      }
      if (visited.has(currentId)) {
        break; // Already checked loop branch
      }
      visited.add(currentId);
      const profile: UserReferralProfile | undefined = this.users.get(currentId);
      currentId = profile?.referredByUserId || null;
    }

    return false;
  }

  /**
   * Process Referral Reward with strict idempotency and central configuration check.
   *
   * BLUEPRINT MANDATE (Sections 7 & 8):
   * - Referral rewards MUST GO TO BONUS WALLET.
   * - NEVER CREDIT REFERRAL REWARDS TO MAIN WALLET.
   * - Bonus wallet can be used to place bids, cannot be withdrawn.
   */
  public processReferralReward(params: {
    referredUserId: string;
    event: 'FIRST_DEPOSIT' | 'FIRST_BET' | 'MANUAL_ACTIVATION';
    idempotencyKey?: string;
  }): {
    success: boolean;
    rewarded: boolean;
    reason?: string;
    message: string;
    rewardAmount?: number;
    creditedWallet?: 'bonus';
  } {
    const { referredUserId, event } = params;

    // 1. Verify user has an established referral relationship
    const record = this.referralsByReferredUser.get(referredUserId);
    if (!record) {
      return {
        success: false,
        rewarded: false,
        reason: 'NO_REFERRER_RELATIONSHIP',
        message: 'User does not have an established referral relationship.',
      };
    }

    // 2. Check central reward configuration
    if (!this.config.IS_REWARD_ACTIVE || this.config.REFERRAL_REWARD_AMOUNT <= 0) {
      return {
        success: false,
        rewarded: false,
        reason: 'REWARD_CONDITIONS_NOT_MET',
        message: 'Referral reward is not activated or reward condition is not met.',
      };
    }

    // 3. Verify event matches configured qualifying event
    if (this.config.QUALIFYING_EVENT !== event) {
      return {
        success: false,
        rewarded: false,
        reason: 'EVENT_MISMATCH',
        message: `Event ${event} does not match configured qualifying event ${this.config.QUALIFYING_EVENT}.`,
      };
    }

    // 4. Idempotency Check: prevent duplicate reward processing
    const rewardKey = params.idempotencyKey || `ref_reward_${referredUserId}_${event}`;
    if (this.processedRewardKeys.has(rewardKey) || record.rewardCredited) {
      return {
        success: true,
        rewarded: false,
        reason: 'ALREADY_PROCESSED',
        message: 'Referral reward has already been processed for this referral relationship.',
        rewardAmount: record.rewardAmount,
        creditedWallet: 'bonus',
      };
    }

    // 5. Credit strictly to BONUS WALLET
    const amount = this.config.REFERRAL_REWARD_AMOUNT;
    authoritativeBackendStore.creditBonusSync({
      userId: record.referrerUserId,
      amount,
      type: 'REFERRAL_REWARD',
      actorId: 'referral_system',
      referenceId: record.id,
      idempotencyKey: rewardKey,
    });

    this.processedRewardKeys.add(rewardKey);
    record.rewardAmount = amount;
    record.rewardCredited = true;
    record.rewardCreditedAt = new Date().toISOString();
    record.status = 'COMPLETED';

    return {
      success: true,
      rewarded: true,
      message: `Referral reward of ₹${amount} coins successfully credited to referrer Bonus Wallet.`,
      rewardAmount: amount,
      creditedWallet: 'bonus',
    };
  }

  public getUserProfile(userId: string): UserReferralProfile | undefined {
    return this.users.get(userId);
  }

  public getReferralRecordByReferred(referredUserId: string): ReferralRecord | undefined {
    return this.referralsByReferredUser.get(referredUserId);
  }

  public getReferralsByReferrer(referrerUserId: string): ReferralRecord[] {
    return this.referralsByReferrer.get(referrerUserId) || [];
  }

  public getConfig(): ReferralConfig {
    return { ...this.config };
  }

  /**
   * For testing purposes: temporarily activate reward configuration to verify Task 11 Test 8
   */
  public updateConfigForTesting(updates: Partial<ReferralConfig>) {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Reset test state to clean baseline
   */
  public resetForTesting() {
    this.config = { ...DEFAULT_REFERRAL_CONFIG };
    this.users.clear();
    this.codeToUserId.clear();
    this.referralsByReferredUser.clear();
    this.referralsByReferrer.clear();
    this.processedRewardKeys.clear();
    this.seedDefaultUsers();
  }
}

export const serverReferralService = new ServerReferralService();
