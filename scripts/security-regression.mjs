import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const api = read('server/apiRouter.ts');
const payment = read('server/paymentConfigService.ts');
const provider = read('server/paymentProvider.ts');
const rules = read('firestore.rules');
const auth = read('server/authMiddleware.ts');

const forbidden = [
  "x-user-id",
  "x-user-role",
  "admin-master-key",
  "winora_admin_secret_2026",
  "req.body.uid",
  "req.body.userId",
];
for (const token of forbidden) {
  if (api.includes(token) || payment.includes(token)) throw new Error(`Forbidden trust/backdoor token remains: ${token}`);
}
if (!auth.includes('verifyIdToken')) throw new Error('Firebase ID-token verification is missing.');
if (!auth.includes("collection('admins').doc(uid)")) throw new Error('Server-side admin role lookup is missing.');
if (!api.includes("requireFirebaseAuth") || !api.includes('requireMasterOrAdmin')) throw new Error('Protected API middleware is missing.');
if (!api.includes("process.env.NODE_ENV === 'production'")) throw new Error('Sandbox production gate is missing.');
if (!payment.includes('depositEnabled: false') || !payment.includes('withdrawalEnabled: false')) throw new Error('Virtual-only payment disablement is missing.');
if (provider.includes("|| 'sandbox_secret") || provider.includes("|| 'sandbox_whsec")) throw new Error('Hardcoded payment secret remains.');
if (provider.includes("signature === 'sandbox-verified-signature'") || provider.includes("|| this.environment === 'sandbox'")) throw new Error('Webhook signature bypass remains.');
if (!rules.includes('match /transactions/{transactionId}') || !rules.includes('allow list: if false;')) throw new Error('Transaction list isolation is missing.');
if (!rules.includes('match /wallet_audits/{auditId}') || !rules.includes('match /referrals/{referralId}')) throw new Error('Private collection rules are missing.');
console.log('WINORA security regression checks passed.');
