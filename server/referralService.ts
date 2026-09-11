import crypto from 'crypto';
import { authoritativeBackendStore } from './authoritativeBackendStore.ts';

export type ReferralStatus = 'REGISTERED' | 'QUALIFIED' | 'COMPLETED' | 'CANCELLED';

export interface ReferralRecord {
  id: string;
  referrerUserId: string;
  referredUserId: string;
  referralCode: string;
  status: ReferralStatus;
  createdAt: string;
  idempotencyKey: string;
  rewardAmount: number;
  rewardWallet: 'bonus';
  rewardCredited: boolean;
  rewardCreditedAt?: string;
  isAgentReferral?: boolean;
  agentCommissionRate?: number;
}

export interface UserReferralProfile {
  userId: string;
  displayName: string;
  referralCode: string;
  referredByUserId: string | null;
  isAgent?: boolean;
  assignedAgentId?: string | null;
  totalCommissionEarned?: number;
  createdAt: string;
}

export interface ReferralConfig {
  REFERRAL_REWARD_AMOUNT: number;
  REFERRAL_COMMISSION_RATE: number;
  IS_REWARD_ACTIVE: boolean;
  QUALIFYING_EVENT: 'FIRST_DEPOSIT' | 'FIRST_BET' | 'MANUAL_ACTIVATION';
}

export const DEFAULT_REFERRAL_CONFIG: ReferralConfig = {
  REFERRAL_REWARD_AMOUNT: 100,
  REFERRAL_COMMISSION_RATE: 0.05,
  IS_REWARD_ACTIVE: true,
  QUALIFYING_EVENT: 'FIRST_DEPOSIT',
};

const CODE_CHARSET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export class ServerReferralService {
  private config: ReferralConfig = { ...DEFAULT_REFERRAL_CONFIG };
  private users: Map<string, UserReferralProfile> = new Map();
  private codeToUserId: Map<string, string> = new Map();
  private referralsByReferredUser: Map<string, ReferralRecord> = new Map();
  private referralsByReferrer: Map<string, ReferralRecord[]> = new Map();
  private processedRewardKeys: Set<string> = new Set();

  constructor() {
    // Production never creates demo users or demo referral relationships.
    // Profiles and referral relationships are created only after authenticated registration.
  }

  public generateUniqueReferralCode(): string {
    for (let attempt = 0; attempt < 100; attempt++) {
      let code = 'WIN';
      const randomBytes = crypto.randomBytes(6);
      for (let i = 0; i < 6; i++) code += CODE_CHARSET[randomBytes[i] % CODE_CHARSET.length];
      if (!this.codeToUserId.has(code)) return code;
    }
    return `WIN${Date.now().toString(36).toUpperCase().slice(-6)}`;
  }

  public resolveReferralCode(code: string): { valid: boolean; referrerDisplayName?: string; referralCode?: string; error?: string } {
    if (!code || typeof code !== 'string') return { valid: false, error: 'Referral code is required.' };
    const normalized = code.trim().toUpperCase();
    const referrerId = this.codeToUserId.get(normalized);
    if (!referrerId) return { valid: false, error: 'Invalid referral code.' };
    const referrer = this.users.get(referrerId);
    return { valid: true, referrerDisplayName: referrer?.displayName || 'WINORA Player', referralCode: normalized };
  }

  public registerUser(params: { userId: string; displayName: string; referralCodeToRedeem?: string }): { success: boolean; userProfile: UserReferralProfile; referralRecord?: ReferralRecord; error?: string; errorCode?: string } {
    const { userId, displayName, referralCodeToRedeem } = params;
    if (!userId) return { success: false, userProfile: undefined as never, error: 'Authenticated user ID is required.', errorCode: 'MISSING_USER_ID' };

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

    if (referralCodeToRedeem?.trim()) {
      const linkResult = this.createReferralRelationship({ referredUserId: userId, referralCode: referralCodeToRedeem });
      if (!linkResult.success) return { success: false, userProfile: user, error: linkResult.error, errorCode: linkResult.errorCode };
      return { success: true, userProfile: this.users.get(userId)!, referralRecord: linkResult.referralRecord };
    }
    return { success: true, userProfile: user };
  }

  public createReferralRelationship(params: { referredUserId: string; referralCode: string }): { success: boolean; referralRecord?: ReferralRecord; error?: string; errorCode?: string } {
    const { referredUserId, referralCode } = params;
    if (!referredUserId) return { success: false, error: 'User ID is required.', errorCode: 'INVALID_USER_ID' };
    if (!referralCode?.trim()) return { success: false, error: 'Referral code is required.', errorCode: 'INVALID_REFERRAL_CODE' };

    const normalizedCode = referralCode.trim().toUpperCase();
    const referrerUserId = this.codeToUserId.get(normalizedCode);
    if (!referrerUserId) return { success: false, error: 'Invalid referral code.', errorCode: 'INVALID_REFERRAL_CODE' };
    if (referrerUserId === referredUserId) return { success: false, error: 'Self-referral is forbidden.', errorCode: 'SELF_REFERRAL_FORBIDDEN' };

    const user = this.users.get(referredUserId);
    const existing = this.referralsByReferredUser.get(referredUserId);
    const currentReferrer = user?.referredByUserId || existing?.referrerUserId;
    if (currentReferrer) {
      if (currentReferrer === referrerUserId) return { success: true, referralRecord: existing };
      return { success: false, error: 'User already has an established referrer.', errorCode: 'REFERRER_ALREADY_ATTACHED' };
    }
    if (this.detectReferralCycle(referrerUserId, referredUserId)) return { success: false, error: 'Referral loop detected.', errorCode: 'REFERRAL_LOOP_DETECTED' };

    const referrerProfile = this.users.get(referrerUserId);
    const isAgent = Boolean(referrerProfile?.isAgent);
    const now = new Date().toISOString();
    const record: ReferralRecord = {
      id: `ref_rel_${referredUserId}`,
      referrerUserId,
      referredUserId,
      referralCode: normalizedCode,
      status: 'REGISTERED',
      createdAt: now,
      idempotencyKey: `rel_${referredUserId}_${referrerUserId}`,
      rewardAmount: 0,
      rewardWallet: 'bonus',
      rewardCredited: false,
      isAgentReferral: isAgent,
      agentCommissionRate: isAgent ? this.config.REFERRAL_COMMISSION_RATE : undefined,
    };

    if (user) {
      user.referredByUserId = referrerUserId;
      if (isAgent) user.assignedAgentId = referrerUserId;
    } else {
      const myCode = this.generateUniqueReferralCode();
      this.users.set(referredUserId, { userId: referredUserId, displayName: 'WINORA Player', referralCode: myCode, referredByUserId: referrerUserId, assignedAgentId: isAgent ? referrerUserId : null, createdAt: now });
      this.codeToUserId.set(myCode, referredUserId);
    }

    this.referralsByReferredUser.set(referredUserId, record);
    const list = this.referralsByReferrer.get(referrerUserId) || [];
    list.push(record);
    this.referralsByReferrer.set(referrerUserId, list);
    return { success: true, referralRecord: record };
  }

  private detectReferralCycle(potentialReferrerId: string, candidateReferredId: string): boolean {
    let currentId: string | null = potentialReferrerId;
    const visited = new Set<string>();
    while (currentId) {
      if (currentId === candidateReferredId) return true;
      if (visited.has(currentId)) break;
      visited.add(currentId);
      currentId = this.users.get(currentId)?.referredByUserId || null;
    }
    return false;
  }

  public processReferralReward(params: { referredUserId: string; event: 'FIRST_DEPOSIT' | 'FIRST_BET' | 'MANUAL_ACTIVATION'; idempotencyKey?: string }): { success: boolean; rewarded: boolean; reason?: string; message: string; rewardAmount?: number; creditedWallet?: 'bonus' } {
    const record = this.referralsByReferredUser.get(params.referredUserId);
    if (!record) return { success: false, rewarded: false, reason: 'NO_REFERRER_RELATIONSHIP', message: 'User does not have an established referral relationship.' };
    if (!this.config.IS_REWARD_ACTIVE || this.config.REFERRAL_REWARD_AMOUNT <= 0) return { success: false, rewarded: false, reason: 'REWARD_CONDITIONS_NOT_MET', message: 'Referral reward is not active.' };
    if (this.config.QUALIFYING_EVENT !== params.event) return { success: false, rewarded: false, reason: 'EVENT_MISMATCH', message: 'Referral qualifying event does not match configuration.' };

    const rewardKey = params.idempotencyKey || `ref_reward_${params.referredUserId}_${params.event}`;
    if (this.processedRewardKeys.has(rewardKey) || record.rewardCredited) return { success: true, rewarded: false, reason: 'ALREADY_PROCESSED', message: 'Referral reward has already been processed.', rewardAmount: record.rewardAmount, creditedWallet: 'bonus' };

    const amount = this.config.REFERRAL_REWARD_AMOUNT;
    const credit = authoritativeBackendStore.creditBonusSync({ userId: record.referrerUserId, amount, type: 'REFERRAL_REWARD', actorId: 'referral_system', referenceId: record.id, idempotencyKey: rewardKey });
    if (!credit.success) return { success: false, rewarded: false, reason: 'CREDIT_FAILED', message: 'Referral reward could not be credited.' };

    this.processedRewardKeys.add(rewardKey);
    record.rewardAmount = amount;
    record.rewardCredited = true;
    record.rewardCreditedAt = new Date().toISOString();
    record.status = 'COMPLETED';
    return { success: true, rewarded: true, message: `Referral reward of ${amount} coins credited to Bonus Wallet.`, rewardAmount: amount, creditedWallet: 'bonus' };
  }

  public getUserProfile(userId: string) { return this.users.get(userId); }
  public getReferralRecordByReferred(userId: string) { return this.referralsByReferredUser.get(userId); }
  public getReferralsByReferrer(userId: string) { return this.referralsByReferrer.get(userId) || []; }
  public getConfig() { return { ...this.config }; }
  public updateConfigForTesting(updates: Partial<ReferralConfig>) { this.config = { ...this.config, ...updates }; }
  public resetForTesting() {
    this.config = { ...DEFAULT_REFERRAL_CONFIG };
    this.users.clear(); this.codeToUserId.clear(); this.referralsByReferredUser.clear(); this.referralsByReferrer.clear(); this.processedRewardKeys.clear();
  }
}

export const serverReferralService = new ServerReferralService();
