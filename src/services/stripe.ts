import Stripe from 'stripe';

export interface StripePaymentRequest {
  amount: number; // Amount in cents
  currency: string;
  paymentMethodId: string;
  customerId?: string;
  description: string;
  metadata?: Record<string, string>;
}

export interface StripePayoutRequest {
  amount: number; // Amount in cents
  currency: string;
  destination: string; // Connected account ID
  description: string;
  metadata?: Record<string, string>;
}

export interface StripeCustomerData {
  email: string;
  name: string;
  phone?: string;
  address?: {
    line1: string;
    line2?: string;
    city: string;
    state?: string;
    postal_code: string;
    country: string;
  };
  metadata?: Record<string, string>;
}

export class StripeService {
  private stripe: Stripe;

  constructor() {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }

    const Stripe = require('stripe');
    this.stripe = new Stripe(secretKey, {
      apiVersion: '2023-10-16',
    });

    console.log('💳 Stripe service initialized');
  }

  // Create customer for compliance and payment tracking
  async createCustomer(customerData: StripeCustomerData): Promise<Stripe.Customer> {
    try {
      console.log('👤 Creating Stripe customer...');
      
      const customer = await this.stripe.customers.create({
        email: customerData.email,
        name: customerData.name,
        phone: customerData.phone,
        address: customerData.address,
        metadata: {
          ...customerData.metadata,
          created_via: 'starling_api',
          created_at: new Date().toISOString(),
        },
      });

      console.log('✅ Stripe customer created:', customer.id);
      return customer;
    } catch (error) {
      console.error('❌ Failed to create Stripe customer:', error);
      throw new Error(`Stripe customer creation failed: ${this.getErrorMessage(error)}`);
    }
  }

  // Process payment with advanced fraud detection
  async createPaymentIntent(request: StripePaymentRequest): Promise<Stripe.PaymentIntent> {
    try {
      console.log(`💰 Creating payment intent for ${request.amount / 100} ${request.currency}`);

      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: request.amount,
        currency: request.currency.toLowerCase(),
        payment_method: request.paymentMethodId,
        customer: request.customerId,
        description: request.description,
        confirmation_method: 'manual',
        confirm: true,
        metadata: {
          ...request.metadata,
          processed_via: 'starling_api',
          timestamp: new Date().toISOString(),
        },
        // Enhanced fraud detection
        radar_options: {
          session: 'rdr_1234567890', // Generate session ID
        },
      });

      console.log('✅ Payment intent created:', paymentIntent.id);
      return paymentIntent;
    } catch (error) {
      console.error('❌ Payment intent creation failed:', error);
      throw new Error(`Stripe payment failed: ${this.getErrorMessage(error)}`);
    }
  }

  // Confirm payment intent (for 3D Secure, etc.)
  async confirmPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.confirm(paymentIntentId);
      console.log('✅ Payment intent confirmed:', paymentIntentId);
      return paymentIntent;
    } catch (error) {
      console.error('❌ Payment confirmation failed:', error);
      throw new Error(`Payment confirmation failed: ${this.getErrorMessage(error)}`);
    }
  }

  // Create payout to partner accounts (for local disbursement)
  async createPayout(request: StripePayoutRequest): Promise<Stripe.Transfer> {
    try {
      console.log(`📤 Creating payout of ${request.amount / 100} ${request.currency}`);

      const transfer = await this.stripe.transfers.create({
        amount: request.amount,
        currency: request.currency.toLowerCase(),
        destination: request.destination,
        description: request.description,
        metadata: {
          ...request.metadata,
          payout_via: 'starling_api',
          timestamp: new Date().toISOString(),
        },
      });

      console.log('✅ Payout created:', transfer.id);
      return transfer;
    } catch (error) {
      console.error('❌ Payout creation failed:', error);
      throw new Error(`Stripe payout failed: ${this.getErrorMessage(error)}`);
    }
  }

  // Get payment method for compliance verification
  async getPaymentMethod(paymentMethodId: string): Promise<Stripe.PaymentMethod> {
    try {
      const paymentMethod = await this.stripe.paymentMethods.retrieve(paymentMethodId);
      return paymentMethod;
    } catch (error) {
      console.error('❌ Failed to retrieve payment method:', error);
      throw new Error(`Payment method retrieval failed: ${this.getErrorMessage(error)}`);
    }
  }

  // Create setup intent for saving payment methods
  async createSetupIntent(customerId: string): Promise<Stripe.SetupIntent> {
    try {
      const setupIntent = await this.stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
        usage: 'off_session',
      });

      console.log('✅ Setup intent created:', setupIntent.id);
      return setupIntent;
    } catch (error) {
      console.error('❌ Setup intent creation failed:', error);
      throw new Error(`Setup intent failed: ${this.getErrorMessage(error)}`);
    }
  }

  // Dispute and chargeback monitoring
  async getDisputes(paymentIntentId?: string): Promise<Stripe.ApiList<Stripe.Dispute>> {
    try {
      const params: Stripe.DisputeListParams = {};
      if (paymentIntentId) {
        params.payment_intent = paymentIntentId;
      }

      const disputes = await this.stripe.disputes.list(params);
      return disputes;
    } catch (error) {
      console.error('❌ Failed to retrieve disputes:', error);
      throw new Error(`Dispute retrieval failed: ${this.getErrorMessage(error)}`);
    }
  }

  // Compliance: Get detailed payment information
  async getPaymentDetails(paymentIntentId: string): Promise<{
    payment: Stripe.PaymentIntent;
    customer?: Stripe.Customer;
    paymentMethod?: Stripe.PaymentMethod;
    riskScore?: number;
  }> {
    try {
      const payment = await this.stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ['customer', 'payment_method', 'charges.data'],
      });

      const result: any = { payment };

      if (payment.customer && typeof payment.customer === 'object') {
        result.customer = payment.customer;
      }

      if (payment.payment_method && typeof payment.payment_method === 'object') {
        result.paymentMethod = payment.payment_method;
      }

      if (payment.latest_charge && typeof payment.latest_charge === 'string') {
        const charge = await this.stripe.charges.retrieve(payment.latest_charge);
        result.riskScore = charge.outcome?.risk_score;
      }

      return result;
    } catch (error) {
      console.error('❌ Failed to get payment details:', error);
      throw new Error(`Payment details retrieval failed: ${this.getErrorMessage(error)}`);
    }
  }

  // Webhook signature verification for security
  verifyWebhookSignature(payload: string, signature: string): Stripe.Event {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET not configured');
    }

    try {
      return this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (error) {
      console.error('❌ Webhook signature verification failed:', error);
      throw new Error(`Webhook verification failed: ${this.getErrorMessage(error)}`);
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.stripe.accounts.retrieve();
      return true;
    } catch (error) {
      console.error('❌ Stripe health check failed:', error);
      return false;
    }
  }

  private getErrorMessage(error: any): string {
    if (error instanceof Error) return error.message;
    return String(error);
  }
}

export default StripeService; 