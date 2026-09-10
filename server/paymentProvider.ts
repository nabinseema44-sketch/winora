import crypto from 'crypto';

export interface CreateOrderParams { transactionId: string; amount: number; currency: string; uid: string; paymentMethod: string; customerPhone?: string; customerName?: string; }
export interface ProviderOrderResult { providerReference: string; orderId: string; checkoutPayload: { gateway: string; environment: string; keyId: string; currency: string; amount: number; intentUrl?: string; qrString?: string; signatureChallenge?: string; }; }
export interface WebhookVerificationResult { isValid: boolean; event: 'payment.captured' | 'payment.failed' | 'payout.processed' | 'payout.reversed' | 'unknown'; providerReference: string; transactionId?: string; amount?: number; currency?: string; rawStatus?: string; errorCode?: string; errorMessage?: string; }
export interface InitiatePayoutParams { transactionId: string; amount: number; currency: string; uid: string; destinationAccount: string; payoutMethod: 'bank' | 'upi'; }
export interface ProviderPayoutResult { providerReference: string; payoutId: string; status: 'queued' | 'processing' | 'completed' | 'failed'; estimatedSettlementMinutes: number; }

export interface PaymentGatewayProvider {
  name: string;
  environment: string;
  createDepositOrder(params: CreateOrderParams): Promise<ProviderOrderResult>;
  verifyWebhookSignature(rawBody: string, signature: string): WebhookVerificationResult;
  initiatePayout(params: InitiatePayoutParams): Promise<ProviderPayoutResult>;
}

/**
 * Disabled payment adapter. WINORA is virtual/demo-credit only.
 * No source code contains default gateway credentials or a signature bypass.
 */
export class SandboxPaymentProvider implements PaymentGatewayProvider {
  public name = 'Disabled — Virtual Credits Only';
  public environment = 'disabled';

  async createDepositOrder(_params: CreateOrderParams): Promise<ProviderOrderResult> {
    throw new Error('VIRTUAL_ONLY: payment orders are disabled.');
  }

  verifyWebhookSignature(_rawBody: string, _signature: string): WebhookVerificationResult {
    return { isValid: false, event: 'unknown', providerReference: '', errorCode: 'VIRTUAL_ONLY', errorMessage: 'Payment webhooks are disabled.' };
  }

  async initiatePayout(_params: InitiatePayoutParams): Promise<ProviderPayoutResult> {
    throw new Error('VIRTUAL_ONLY: payouts are disabled.');
  }

  // Retained only for legacy test callers; it does not authorize or credit anything.
  generateSignedTestPayload(eventData: Record<string, any>): { body: string; signature: string } {
    const secret = process.env.PAYMENT_WEBHOOK_SECRET;
    if (!secret) throw new Error('PAYMENT_WEBHOOK_SECRET is not configured.');
    const body = JSON.stringify(eventData);
    const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');
    return { body, signature };
  }
}

let paymentProviderInstance: PaymentGatewayProvider | null = null;
export function getPaymentProvider(): PaymentGatewayProvider {
  if (!paymentProviderInstance) paymentProviderInstance = new SandboxPaymentProvider();
  return paymentProviderInstance;
}
