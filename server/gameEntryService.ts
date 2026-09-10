import crypto from 'crypto';
import { serverWalletService } from './walletService.ts';

export interface ServerGameRound {
  id: string; gameId: string; gameName: string; roundNumber: number;
  freezeTime: string; declareTime: string;
  status: 'OPEN' | 'FROZEN' | 'PROCESSING' | 'COMPLETED';
  totalBidsPool: number; resultNumber?: string | null; resultColor?: 'GREEN' | 'RED' | null;
}
export interface Selection { number: string; stake: number; color: 'GREEN' | 'RED'; }
export interface ServerGameEntry {
  id: string; userId: string; gameId: string; gameName: string; roundId: string; roundNumber: number;
  selections: Selection[]; totalStake: number; walletUsed: 'main'; status: 'CONFIRMED' | 'WON' | 'LOST';
  createdAt: string; idempotencyKey?: string; settledReward?: number; protectionRefund?: number;
  totalSettlementCredit?: number; settledWinningNumber?: string; settledResultColor?: 'GREEN' | 'RED';
  settlementId?: string; settledAt?: string;
}

export const SERVER_GAMES_CONFIG = [
  { id:'game_x', name:'Game X', code:'GX-90', subtitle:'Standard 00–99 High-Yield Draw', payoutMultiplier:90, hasGreenRefund:false, description:'Select lucky numbers between 00 and 99. Exact match delivers a direct 90× payout to your demo Main Wallet.', accentColor:'from-amber-500 to-orange-500', intervalMinutes:60 },
  { id:'game_y', name:'Game Y', code:'GY-90', subtitle:'Afternoon Prime Matrix Draw', payoutMultiplier:90, hasGreenRefund:false, description:'Midday matrix. Place single or spread entries across 00–99 with a fixed 90× multiplier.', accentColor:'from-cyan-500 to-blue-500', intervalMinutes:60 },
  { id:'game_z', name:'Game Z', code:'GZ-90', subtitle:'Night Royal 90× Draw', payoutMultiplier:90, hasGreenRefund:false, description:'Evening draw with deep demo liquidity. Single-number 90× return with automated settlement.', accentColor:'from-purple-500 to-pink-500', intervalMinutes:60 },
  { id:'hourly_dhamaka', name:'Hourly Dhamaka', code:'HD-80G', subtitle:'90× Payout + 80% Protection Refund', payoutMultiplier:90, hasGreenRefund:true, refundPercentage:80, description:'Place bids with your chosen color (GREEN or RED). Winning number pays 90×, plus an 80% protection refund on all bids matching the declared Result Color!', accentColor:'from-emerald-500 to-teal-500', intervalMinutes:60 },
];

class GameEntryService {
  private rounds = new Map<string, ServerGameRound>();
  private entries: ServerGameEntry[] = [];
  private idempotencyStore = new Map<string, ServerGameEntry>();

  constructor() { this.initDefaultRounds(); this.initSeedEntries(); }

  private initDefaultRounds() {
    const now=Date.now();
    const make=(id:string,gameId:string,gameName:string,n:number,mins:number,status:ServerGameRound['status'])=>({ id,gameId,gameName,roundNumber:n,freezeTime:new Date(now+(mins-15)*60000).toISOString(),declareTime:new Date(now+mins*60000).toISOString(),status,totalBidsPool:0 } as ServerGameRound);
    this.rounds.set('game_x',make('round-gx-101','game_x','Game X',101,30,'OPEN')); this.rounds.get('game_x')!.totalBidsPool=28500;
    this.rounds.set('game_y',make('round-gy-204','game_y','Game Y',204,45,'OPEN')); this.rounds.get('game_y')!.totalBidsPool=19200;
    this.rounds.set('game_z',make('round-gz-309','game_z','Game Z',309,12,'FROZEN')); this.rounds.get('game_z')!.totalBidsPool=44100;
    this.rounds.set('hourly_dhamaka',make('round-hd-412','hourly_dhamaka','Hourly Dhamaka',412,35,'OPEN')); this.rounds.get('hourly_dhamaka')!.totalBidsPool=62400;
  }

  private initSeedEntries() {
    const now=new Date(Date.now()-10*60000).toISOString();
    this.entries.push({id:'ENTRY-8F29A10B',userId:'player-arjun',gameId:'game_x',gameName:'Game X',roundId:'round-gx-101',roundNumber:101,selections:[{number:'07',stake:100,color:'GREEN'},{number:'21',stake:100,color:'RED'},{number:'42',stake:100,color:'GREEN'}],totalStake:300,walletUsed:'main',status:'CONFIRMED',createdAt:now,idempotencyKey:'idemp-seed-1'});
    this.entries.push({id:'ENTRY-4E18B90C',userId:'player-arjun',gameId:'hourly_dhamaka',gameName:'Hourly Dhamaka',roundId:'round-hd-412',roundNumber:412,selections:[{number:'00',stake:150,color:'GREEN'},{number:'15',stake:150,color:'RED'},{number:'24',stake:150,color:'GREEN'},{number:'33',stake:150,color:'GREEN'}],totalStake:600,walletUsed:'main',status:'CONFIRMED',createdAt:new Date(Date.now()-25*60000).toISOString(),idempotencyKey:'idemp-seed-2'});
  }

  public getGamesConfig() {
    const roundsList:Record<string,ServerGameRound>={}; const now=Date.now();
    for(const [gameId,round] of this.rounds){ const effectiveStatus=round.status==='OPEN'&&now>=new Date(round.freezeTime).getTime()?'FROZEN':round.status; roundsList[gameId]={...round,status:effectiveStatus}; }
    return {games:SERVER_GAMES_CONFIG,rounds:roundsList,serverTime:new Date().toISOString()};
  }

  public async getUserBalance(userId:string):Promise<{main:number}> { const w=await serverWalletService.getWallet(userId); return {main:w.balance}; }
  public getUserEntries(userId:string):ServerGameEntry[] { return this.entries.filter(e=>e.userId===userId||userId==='all').sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()); }

  public async submitEntry(params:{userId:string;gameId:string;roundId:string;selections:Selection[];idempotencyKey?:string;}):Promise<{success:boolean;error?:string;errorCode?:string;entry?:ServerGameEntry;remainingBalance?:{main:number}}> {
    const {userId,gameId,roundId,selections}=params; const idempotencyKey=params.idempotencyKey;
    if(!idempotencyKey) return {success:false,errorCode:'IDEMPOTENCY_REQUIRED',error:'A unique idempotency key is required.'};
    const existing=this.idempotencyStore.get(`${userId}:${idempotencyKey}`); if(existing) return {success:true,entry:existing,remainingBalance:await this.getUserBalance(userId)};
    const gameConfig=SERVER_GAMES_CONFIG.find(g=>g.id===gameId); if(!gameConfig)return{success:false,errorCode:'GAME_UNAVAILABLE',error:'Requested game is not available.'};
    const round=this.rounds.get(gameId); if(!round||round.id!==roundId)return{success:false,errorCode:'INVALID_ROUND',error:'Invalid or expired round reference.'};
    if(round.status!=='OPEN'||Date.now()>=new Date(round.freezeTime).getTime()){round.status='FROZEN';return{success:false,errorCode:'ROUND_CLOSED',error:'Bidding is strictly FROZEN for this round.'};}
    if(!Array.isArray(selections)||!selections.length)return{success:false,errorCode:'EMPTY_SELECTION',error:'Please select at least 1 number.'};
    if(selections.length>37)return{success:false,errorCode:'LIMIT_EXCEEDED',error:'Selection exceeds the maximum limit of 37 numbers per round.'};
    const seen=new Set<string>(); let total=0;
    for(const sel of selections){
      if(!sel||typeof sel!=='object')return{success:false,errorCode:'INVALID_SELECTION',error:'Malformed selection object received.'};
      const {number:num,stake,color}=sel;
      if(typeof num!=='string'||!/^[0-9]{2}$/.test(num))return{success:false,errorCode:'INVALID_NUMBER',error:`Invalid number format: ${num}.`};
      if(seen.has(num))return{success:false,errorCode:'DUPLICATE_NUMBER',error:`Duplicate number ${num} detected.`}; seen.add(num);
      if(!Number.isFinite(stake)||stake<1||stake>10000)return{success:false,errorCode:'INVALID_AMOUNT',error:`Stake for number ${num} must be between 1 and 10,000 demo credits.`};
      if(color!=='GREEN'&&color!=='RED')return{success:false,errorCode:'INVALID_COLOR',error:`Color for number ${num} must be GREEN or RED.`}; total+=stake;
    }
    try {
      const debit=await serverWalletService.debitForGame({uid:userId,amount:total,idempotencyKey,gameId,roundId});
      if(debit.duplicate){const prior=this.idempotencyStore.get(`${userId}:${idempotencyKey}`);if(prior)return{success:true,entry:prior,remainingBalance:{main:debit.wallet.balance}};}
      round.totalBidsPool+=total;
      const entry:ServerGameEntry={id:`ENTRY-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,userId,gameId,gameName:gameConfig.name,roundId,roundNumber:round.roundNumber,selections:[...selections].sort((a,b)=>a.number.localeCompare(b.number)),totalStake:total,walletUsed:'main',status:'CONFIRMED',createdAt:new Date().toISOString(),idempotencyKey};
      this.entries.unshift(entry); this.idempotencyStore.set(`${userId}:${idempotencyKey}`,entry);
      return{success:true,entry,remainingBalance:{main:debit.wallet.balance}};
    } catch(e:any){return{success:false,errorCode:'INSUFFICIENT_CREDITS',error:e?.message||'Unable to debit Main Wallet.'};}
  }

  public getAllRoundsMap(){return this.rounds;}
  public getRound(gameId:string){return this.rounds.get(gameId);}
  public getRoundById(roundId:string){for(const r of this.rounds.values())if(r.id===roundId)return r;return undefined;}
  public getEntriesForRound(roundId:string){return this.entries.filter(e=>e.roundId===roundId);}
  public updateEntry(entryId:string,updates:Partial<ServerGameEntry>){const e=this.entries.find(x=>x.id===entryId);if(e)Object.assign(e,updates);}

  public async creditUserDemoReward(userId:string,amount:number,settlementId:string,entryId:string):Promise<{main:number}> { const r=await serverWalletService.creditGameReward({uid:userId,amount,idempotencyKey:`${settlementId}:${entryId}`,sourceReference:`settlement:${settlementId}:${entryId}`}); return {main:r.wallet.balance}; }
  public async creditReferralReward(params:{referralKey:string;userId:string;amount:number;referrerId?:string}){return serverWalletService.creditReferralReward(params);}

  public spawnNextRound(gameId:string):ServerGameRound { const existing=this.rounds.get(gameId);const n=existing?existing.roundNumber+1:101;const now=Date.now();const declareTime=new Date(now+30*60000);const round={id:`round-${gameId.replace(/_/g,'-')}-${n}`,gameId,gameName:SERVER_GAMES_CONFIG.find(g=>g.id===gameId)?.name||gameId,roundNumber:n,freezeTime:new Date(declareTime.getTime()-15*60000).toISOString(),declareTime:declareTime.toISOString(),status:'OPEN' as const,totalBidsPool:0,resultNumber:null,resultColor:null};this.rounds.set(gameId,round);return round; }
}
export const serverGameEntryService=new GameEntryService();
