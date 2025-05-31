import SupabaseService from './supabase';
import CircleService from './circle';
import SolanaService from './solana';
import { 
  Payment, 
  PaymentRequest, 
  PaymentStatus, 
  PaymentStep, 
  PaymentStepType, 
  StepStatus,
  BlockchainDetails,
  FiatDetails,
  ComplianceCheck 
} from '../types/payment';

export interface ProcessPaymentRequest {
  quoteId: string;
  senderId: string;
  recipientDetails: {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    address: any;
    bankAccount: any;
  };
  purpose?: string;
  reference?: string;
}

export class PaymentProcessor {
  private supabaseService: SupabaseService;
  private circleService: CircleService;
  private solanaService: SolanaService;

  constructor() {
    this.supabaseService = new SupabaseService();
    this.circleService = new CircleService();
    this.solanaService = new SolanaService();

    console.log('💳 Payment Processor initialized');
  }

  // Main payment processing function
  async processPayment(request: ProcessPaymentRequest): Promise<Payment> {
    console.log(`🚀 Starting payment processing for quote: ${request.quoteId}`);

    try {
      // Step 1: Get and validate quote
      const quote = await this.supabaseService.getQuoteById(request.quoteId);
      if (!quote) {
        throw new Error('Quote not found or expired');
      }

      if (new Date() > quote.validUntil) {
        throw new Error('Quote has expired');
      }

      // Step 2: Create payment record
      const paymentRequest: PaymentRequest = {
        senderId: request.senderId,
        recipientId: request.recipientDetails.email || 'external',
        amountUSD: quote.inputAmount,
        fromCurrency: quote.inputCurrency as any,
        toCurrency: quote.outputCurrency as any,
        recipientDetails: request.recipientDetails,
        purpose: request.purpose,
        reference: request.reference,
      };

      const payment = await this.createPaymentRecord(request.quoteId, paymentRequest, quote);
      console.log(`✅ Payment record created: ${payment.id}`);

      // Step 3: Start processing asynchronously
      this.processPaymentAsync(payment.id).catch(error => {
        console.error(`❌ Async payment processing failed for ${payment.id}:`, error);
        this.updatePaymentStatus(payment.id, PaymentStatus.FAILED, 'Payment processing failed');
      });

      return payment;

    } catch (error) {
      console.error('❌ Payment initiation failed:', error);
      throw error;
    }
  }

  // Create initial payment record in database
  private async createPaymentRecord(
    quoteId: string, 
    paymentRequest: PaymentRequest, 
    quote: any
  ): Promise<Payment> {
    const payment: Omit<Payment, 'id' | 'createdAt' | 'updatedAt'> = {
      quoteId,
      request: paymentRequest,
      steps: [{
        stepId: '1',
        stepName: PaymentStepType.INITIATE,
        status: StepStatus.COMPLETED,
        timestamp: new Date(),
        details: 'Payment initiated successfully'
      }],
      blockchain: {
        network: 'solana',
        stablecoin: 'USDC',
        sourceWallet: '',
        destinationWallet: '',
      } as BlockchainDetails,
      fiat: {
        inputConfirmed: false,
        outputInitiated: false,
      } as FiatDetails,
      fees: quote.fees,
      status: PaymentStatus.PROCESSING,
      compliance: {
        kycRequired: quote.complianceRequired,
        kycStatus: quote.complianceRequired ? 'pending' : 'not_required',
        amlScreening: 'pending',
        sanctionsCheck: 'pending',
        riskScore: 50
      } as ComplianceCheck,
      estimatedCompletionTime: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
    };

    return await this.supabaseService.createPayment(payment);
  }

  // Async payment processing pipeline
  private async processPaymentAsync(paymentId: string): Promise<void> {
    console.log(`🔄 Processing payment: ${paymentId}`);

    try {
      // Get payment details
      const payment = await this.supabaseService.getPaymentById(paymentId);
      if (!payment) {
        throw new Error('Payment not found');
      }

      // Step 1: Compliance checks
      await this.runComplianceChecks(paymentId, payment);

      // Step 2: USD to USDC conversion (Circle)
      await this.convertUSDToUSDC(paymentId, payment);

      // Step 3: USDC transfer via Solana
      await this.transferUSDCViaSolana(paymentId, payment);

      // Step 4: USDC to local currency conversion
      await this.convertUSDCToLocalCurrency(paymentId, payment);

      // Step 5: Final settlement
      await this.completeFinalSettlement(paymentId, payment);

      // Mark as completed
      await this.updatePaymentStatus(paymentId, PaymentStatus.COMPLETED, 'Payment completed successfully');
      console.log(`✅ Payment ${paymentId} completed successfully!`);

    } catch (error) {
      console.error(`❌ Payment processing failed for ${paymentId}:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      await this.updatePaymentStatus(paymentId, PaymentStatus.FAILED, `Payment failed: ${errorMessage}`);
      throw error;
    }
  }

  // Step 1: Compliance checks
  private async runComplianceChecks(paymentId: string, payment: Payment): Promise<void> {
    console.log(`🔍 Running compliance checks for payment: ${paymentId}`);
    
    await this.addPaymentStep(paymentId, {
      stepId: '2',
      stepName: PaymentStepType.COMPLIANCE_SCREEN,
      status: StepStatus.PROCESSING,
      timestamp: new Date(),
      details: 'Running AML and sanctions screening'
    });

    // Simulate compliance checks (in real implementation, integrate with compliance providers)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // For demo purposes, pass all compliance checks
    // In production, integrate with services like ComplyAdvantage, Chainalysis, etc.
    const complianceResult = {
      amlScreening: 'passed',
      sanctionsCheck: 'passed',
      riskScore: 25
    };

    await this.addPaymentStep(paymentId, {
      stepId: '2',
      stepName: PaymentStepType.COMPLIANCE_SCREEN,
      status: StepStatus.COMPLETED,
      timestamp: new Date(),
      details: `Compliance checks passed. Risk score: ${complianceResult.riskScore}`
    });

    console.log(`✅ Compliance checks completed for payment: ${paymentId}`);
  }

  // Step 2: Convert USD to USDC via Circle
  private async convertUSDToUSDC(paymentId: string, payment: Payment): Promise<void> {
    console.log(`💱 Converting USD to USDC for payment: ${paymentId}`);

    await this.addPaymentStep(paymentId, {
      stepId: '3',
      stepName: PaymentStepType.USD_TO_USDC,
      status: StepStatus.PROCESSING,
      timestamp: new Date(),
      details: 'Converting USD to USDC via Circle API'
    });

    try {
      // In a real implementation, you would:
      // 1. Create Circle wallet for the user
      // 2. Process USD payment (ACH, wire, card)
      // 3. Convert to USDC in Circle wallet

      // For demo purposes, simulate the process
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Generate demo wallet address
      const demoWallet = this.solanaService.generateWallet();

      await this.addPaymentStep(paymentId, {
        stepId: '3',
        stepName: PaymentStepType.USD_TO_USDC,
        status: StepStatus.COMPLETED,
        timestamp: new Date(),
        details: `USD converted to USDC. Wallet: ${demoWallet.publicKey.substring(0, 8)}...`
      });

      console.log(`✅ USD to USDC conversion completed for payment: ${paymentId}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      await this.addPaymentStep(paymentId, {
        stepId: '3',
        stepName: PaymentStepType.USD_TO_USDC,
        status: StepStatus.FAILED,
        timestamp: new Date(),
        details: `USD to USDC conversion failed: ${errorMessage}`,
        errorMessage: errorMessage
      });
      throw error;
    }
  }

  // Step 3: Transfer USDC via Solana
  private async transferUSDCViaSolana(paymentId: string, payment: Payment): Promise<void> {
    console.log(`⛓️ Transferring USDC via Solana for payment: ${paymentId}`);

    await this.addPaymentStep(paymentId, {
      stepId: '4',
      stepName: PaymentStepType.BLOCKCHAIN_TRANSFER,
      status: StepStatus.PROCESSING,
      timestamp: new Date(),
      details: 'Transferring USDC on Solana blockchain'
    });

    try {
      // For demo purposes, simulate blockchain transfer
      // In production, you would use actual wallet private keys and recipient addresses
      await new Promise(resolve => setTimeout(resolve, 4000));

      const demoTransactionSignature = `demo_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      await this.addPaymentStep(paymentId, {
        stepId: '4',
        stepName: PaymentStepType.BLOCKCHAIN_TRANSFER,
        status: StepStatus.COMPLETED,
        timestamp: new Date(),
        details: `USDC transferred successfully`,
        transactionHash: demoTransactionSignature
      });

      console.log(`✅ Solana USDC transfer completed for payment: ${paymentId}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      await this.addPaymentStep(paymentId, {
        stepId: '4',
        stepName: PaymentStepType.BLOCKCHAIN_TRANSFER,
        status: StepStatus.FAILED,
        timestamp: new Date(),
        details: `Blockchain transfer failed: ${errorMessage}`,
        errorMessage: errorMessage
      });
      throw error;
    }
  }

  // Step 4: Convert USDC to local currency
  private async convertUSDCToLocalCurrency(paymentId: string, payment: Payment): Promise<void> {
    console.log(`💰 Converting USDC to local currency for payment: ${paymentId}`);

    await this.addPaymentStep(paymentId, {
      stepId: '5',
      stepName: PaymentStepType.USDC_TO_LOCAL,
      status: StepStatus.PROCESSING,
      timestamp: new Date(),
      details: `Converting USDC to ${payment.request.toCurrency}`
    });

    try {
      // In production, integrate with local exchange partners
      // For Mexico: Bitso, Binance Mexico
      // For Nigeria: Quidax, Binance Nigeria
      // For Philippines: PDAX, Coins.ph

      await new Promise(resolve => setTimeout(resolve, 3000));

      await this.addPaymentStep(paymentId, {
        stepId: '5',
        stepName: PaymentStepType.USDC_TO_LOCAL,
        status: StepStatus.COMPLETED,
        timestamp: new Date(),
        details: `USDC converted to ${payment.request.toCurrency} successfully`
      });

      console.log(`✅ USDC to ${payment.request.toCurrency} conversion completed for payment: ${paymentId}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      await this.addPaymentStep(paymentId, {
        stepId: '5',
        stepName: PaymentStepType.USDC_TO_LOCAL,
        status: StepStatus.FAILED,
        timestamp: new Date(),
        details: `Currency conversion failed: ${errorMessage}`,
        errorMessage: errorMessage
      });
      throw error;
    }
  }

  // Step 5: Final settlement
  private async completeFinalSettlement(paymentId: string, payment: Payment): Promise<void> {
    console.log(`🏦 Completing final settlement for payment: ${paymentId}`);

    await this.addPaymentStep(paymentId, {
      stepId: '6',
      stepName: PaymentStepType.BANK_TRANSFER,
      status: StepStatus.PROCESSING,
      timestamp: new Date(),
      details: 'Initiating bank transfer to recipient'
    });

    try {
      // In production, integrate with banking partners
      // Mexico: SPEI system via bank partners
      // Nigeria: NIP system via bank partners
      // Philippines: InstaPay/PESONet via bank partners

      await new Promise(resolve => setTimeout(resolve, 5000));

      await this.addPaymentStep(paymentId, {
        stepId: '6',
        stepName: PaymentStepType.BANK_TRANSFER,
        status: StepStatus.COMPLETED,
        timestamp: new Date(),
        details: `Bank transfer completed to ${payment.request.recipientDetails.bankAccount.bankName}`
      });

      console.log(`✅ Final settlement completed for payment: ${paymentId}`);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      await this.addPaymentStep(paymentId, {
        stepId: '6',
        stepName: PaymentStepType.BANK_TRANSFER,
        status: StepStatus.FAILED,
        timestamp: new Date(),
        details: `Bank transfer failed: ${errorMessage}`,
        errorMessage: errorMessage
      });
      throw error;
    }
  }

  // Get payment status and details
  async getPaymentStatus(paymentId: string): Promise<Payment | null> {
    return await this.supabaseService.getPaymentById(paymentId);
  }

  // Get payments for a user
  async getUserPayments(userId: string): Promise<Payment[]> {
    return await this.supabaseService.getPaymentsByUserId(userId);
  }

  // Helper: Add a step to payment
  private async addPaymentStep(paymentId: string, step: PaymentStep): Promise<void> {
    const payment = await this.supabaseService.getPaymentById(paymentId);
    if (!payment) return;

    // Update existing step or add new one
    const existingStepIndex = payment.steps.findIndex(s => s.stepId === step.stepId);
    if (existingStepIndex >= 0) {
      payment.steps[existingStepIndex] = step;
    } else {
      payment.steps.push(step);
    }

    await this.supabaseService.updatePaymentStatus(paymentId, payment.status, payment.steps);
  }

  // Helper: Update payment status
  private async updatePaymentStatus(paymentId: string, status: PaymentStatus, details?: string): Promise<void> {
    const payment = await this.supabaseService.getPaymentById(paymentId);
    if (!payment) return;

    // Add completion step
    if (status === PaymentStatus.COMPLETED) {
      payment.steps.push({
        stepId: '7',
        stepName: PaymentStepType.COMPLETE,
        status: StepStatus.COMPLETED,
        timestamp: new Date(),
        details: details || 'Payment completed successfully'
      });
      payment.completedAt = new Date();
    }

    await this.supabaseService.updatePaymentStatus(paymentId, status, payment.steps);
  }

  // Health check for all services
  async healthCheck(): Promise<{
    circle: boolean;
    solana: boolean;
    supabase: boolean;
  }> {
    const [circle, solana, supabase] = await Promise.all([
      this.circleService.healthCheck().catch(() => false),
      this.solanaService.healthCheck().catch(() => false),
      this.supabaseService.healthCheck().catch(() => false),
    ]);

    return { circle, solana, supabase };
  }
}

export default PaymentProcessor;