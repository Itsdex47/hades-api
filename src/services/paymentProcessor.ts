import SupabaseService from './supabase';
import CircleService from './circle';
import SolanaService from './solana';
import StripeService from './stripe';
import JumioService from './jumio';
import EllipticService from './elliptic';
import AlchemyService from './alchemy';
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
  private stripeService?: StripeService;
  private jumioService?: JumioService;
  private ellipticService?: EllipticService;
  private alchemyService?: AlchemyService;

  constructor() {
    this.supabaseService = new SupabaseService();
    this.circleService = new CircleService();
    this.solanaService = new SolanaService();
    
    // Initialize new services with proper error handling
    try {
      this.stripeService = new StripeService();
    } catch (error) {
      console.warn('⚠️ Stripe service not available:', (error as Error).message);
    }
    
    try {
      this.jumioService = new JumioService();
    } catch (error) {
      console.warn('⚠️ Jumio service not available:', (error as Error).message);
    }
    
    try {
      this.ellipticService = new EllipticService();
    } catch (error) {
      console.warn('⚠️ Elliptic service not available:', (error as Error).message);
    }
    
    try {
      this.alchemyService = new AlchemyService();
    } catch (error) {
      console.warn('⚠️ Alchemy service not available:', (error as Error).message);
    }

    console.log('💳 Multi-Rail Payment Processor initialized with all services');
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
        recipientId: null, // Set to null for external recipients
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

  // Enhanced compliance checks with multiple providers
  private async runComplianceChecks(paymentId: string, payment: Payment): Promise<void> {
    console.log(`🔍 Running comprehensive compliance checks for payment: ${paymentId}`);
    
    await this.addPaymentStep(paymentId, {
      stepId: '2',
      stepName: PaymentStepType.COMPLIANCE_SCREEN,
      status: StepStatus.PROCESSING,
      timestamp: new Date(),
      details: 'Running multi-provider AML and sanctions screening'
    });

    try {
      const complianceResults = {
        kycPassed: false,
        amlPassed: false,
        sanctionsCleared: false,
        riskScore: 50,
        recommendedAction: 'review' as 'proceed' | 'review' | 'block',
      };

      // 1. Enhanced KYC with Jumio (if available)
      if (this.jumioService && payment.compliance.kycRequired) {
        try {
          console.log('🆔 Running Jumio KYC verification...');
          
          const kycRequest = {
            customerInternalReference: payment.request.senderId,
            userReference: paymentId,
            customerData: {
              firstName: payment.request.recipientDetails.firstName,
              lastName: payment.request.recipientDetails.lastName,
              email: payment.request.recipientDetails.email,
            },
          };

          const kycResult = await this.jumioService.initiateVerification(kycRequest);
          complianceResults.kycPassed = true;
          
          console.log(`✅ KYC verification initiated: ${kycResult.scanReference}`);
        } catch (error) {
          console.warn('⚠️ KYC verification failed:', (error as Error).message);
          complianceResults.recommendedAction = 'block';
        }
      }

      // 2. Blockchain AML screening with Elliptic (if available)
      if (this.ellipticService) {
        try {
          console.log('🔍 Running Elliptic AML screening...');
          
          // Generate demo wallet for screening
          const demoWallet = this.solanaService.generateWallet();
          
          const amlResult = await this.ellipticService.screenAddress({
            address: demoWallet.publicKey,
            blockchain: 'solana',
          });

          complianceResults.amlPassed = amlResult.riskLevel !== 'severe';
          complianceResults.sanctionsCleared = !amlResult.sanctions.isOnSanctionsList;
          complianceResults.riskScore = amlResult.riskScore;

          if (amlResult.riskLevel === 'severe' || amlResult.sanctions.isOnSanctionsList) {
            complianceResults.recommendedAction = 'block';
          }

          console.log(`✅ AML screening completed. Risk level: ${amlResult.riskLevel}`);
        } catch (error) {
          console.warn('⚠️ AML screening failed:', (error as Error).message);
        }
      }

      // 3. Traditional payment fraud detection with Stripe (if available)
      if (this.stripeService && payment.request.amountUSD > 1000) {
        try {
          console.log('💳 Running Stripe fraud detection...');
          
          // In real implementation, this would check payment method risk
          const fraudCheckPassed = true; // Simulated
          complianceResults.amlPassed = complianceResults.amlPassed && fraudCheckPassed;
          
          console.log('✅ Stripe fraud detection completed');
        } catch (error) {
          console.warn('⚠️ Stripe fraud detection failed:', (error as Error).message);
        }
      }

      // Determine final compliance result
      const overallCompliance = complianceResults.kycPassed && 
                               complianceResults.amlPassed && 
                               complianceResults.sanctionsCleared &&
                               complianceResults.riskScore < 70;

      if (!overallCompliance || complianceResults.recommendedAction === 'block') {
        await this.addPaymentStep(paymentId, {
          stepId: '2',
          stepName: PaymentStepType.COMPLIANCE_SCREEN,
          status: StepStatus.FAILED,
          timestamp: new Date(),
          details: `Compliance checks failed. Risk score: ${complianceResults.riskScore}`,
          errorMessage: 'High risk transaction blocked by compliance screening'
        });
        
        await this.updatePaymentStatus(paymentId, PaymentStatus.COMPLIANCE_REVIEW, 'Transaction requires manual compliance review');
        throw new Error('Compliance screening failed - transaction blocked');
      }

      await this.addPaymentStep(paymentId, {
        stepId: '2',
        stepName: PaymentStepType.COMPLIANCE_SCREEN,
        status: StepStatus.COMPLETED,
        timestamp: new Date(),
        details: `All compliance checks passed. Risk score: ${complianceResults.riskScore}`
      });

      console.log(`✅ Comprehensive compliance checks completed for payment: ${paymentId}`);

    } catch (error) {
      console.error(`❌ Compliance screening failed for ${paymentId}:`, error);
      throw error;
    }
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

  // Enhanced blockchain transfer with optimal gas pricing
  private async transferUSDCViaSolana(paymentId: string, payment: Payment): Promise<void> {
    console.log(`⛓️ Transferring USDC via Solana for payment: ${paymentId}`);

    await this.addPaymentStep(paymentId, {
      stepId: '4',
      stepName: PaymentStepType.BLOCKCHAIN_TRANSFER,
      status: StepStatus.PROCESSING,
      timestamp: new Date(),
      details: 'Optimizing blockchain transfer with Alchemy + Solana'
    });

    try {
      let blockchainMetrics;
      
      // Get optimal blockchain conditions from Alchemy (if available)
      if (this.alchemyService) {
        try {
          blockchainMetrics = await this.alchemyService.getBlockchainMetrics();
          console.log(`📊 Network congestion: ${blockchainMetrics.networkCongestion}`);
          
          // Delay if network is highly congested
          if (blockchainMetrics.networkCongestion === 'high') {
            console.log('⏳ High network congestion detected, waiting...');
            await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
          }
        } catch (error) {
          console.warn('⚠️ Could not get blockchain metrics:', (error as Error).message);
        }
      }

      // Perform the actual Solana USDC transfer
      const transferRequest = {
        fromWallet: process.env.SOLANA_MASTER_WALLET || 'demo_wallet_key',
        toAddress: 'demo_recipient_address',
        amount: payment.request.amountUSD,
        memo: `Starling payment ${paymentId}`,
      };

      // For demo purposes, simulate the transfer
      await new Promise(resolve => setTimeout(resolve, 4000));
      const demoTransactionSignature = `demo_solana_tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Verify transaction with blockchain monitoring
      if (this.ellipticService) {
        try {
          const txAnalysis = await this.ellipticService.analyzeTransaction({
            transactionHash: demoTransactionSignature,
            blockchain: 'solana',
            amount: payment.request.amountUSD,
            direction: 'outbound',
          });

          if (txAnalysis.recommendedAction === 'block') {
            throw new Error('Transaction flagged by blockchain monitoring');
          }

          console.log(`✅ Transaction analysis passed: ${txAnalysis.recommendedAction}`);
        } catch (error) {
          console.warn('⚠️ Transaction analysis failed:', (error as Error).message);
        }
      }

      await this.addPaymentStep(paymentId, {
        stepId: '4',
        stepName: PaymentStepType.BLOCKCHAIN_TRANSFER,
        status: StepStatus.COMPLETED,
        timestamp: new Date(),
        details: `USDC transferred successfully via optimized Solana rails`,
        transactionHash: demoTransactionSignature
      });

      console.log(`✅ Enhanced Solana USDC transfer completed for payment: ${paymentId}`);

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

      const bankName = payment.request.recipientDetails?.bankAccount?.bankName || 'Bank';
      
      await this.addPaymentStep(paymentId, {
        stepId: '6',
        stepName: PaymentStepType.BANK_TRANSFER,
        status: StepStatus.COMPLETED,
        timestamp: new Date(),
        details: `Bank transfer completed to ${bankName}`
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
    try {
      const payment = await this.supabaseService.getPaymentById(paymentId);
      if (!payment) {
        console.error(`Payment ${paymentId} not found when trying to add step`);
        return;
      }

      // Update existing step or add new one
      const existingStepIndex = payment.steps.findIndex(s => s.stepId === step.stepId);
      if (existingStepIndex >= 0) {
        payment.steps[existingStepIndex] = step;
      } else {
        payment.steps.push(step);
      }

      await this.supabaseService.updatePaymentStatus(paymentId, payment.status, payment.steps);
    } catch (error) {
      console.error(`Failed to add payment step for ${paymentId}:`, error);
    }
  }

  // Helper: Update payment status
  private async updatePaymentStatus(paymentId: string, status: PaymentStatus, details?: string): Promise<void> {
    try {
      const payment = await this.supabaseService.getPaymentById(paymentId);
      if (!payment) {
        console.error(`Payment ${paymentId} not found when trying to update status`);
        return;
      }

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
    } catch (error) {
      console.error(`Failed to update payment status for ${paymentId}:`, error);
    }
  }

  // Enhanced health check for all services
  async healthCheck(): Promise<{
    overall: boolean;
    services: {
      supabase: boolean;
      circle: boolean;
      solana: boolean;
      stripe: boolean;
      jumio: boolean;
      elliptic: boolean;
      alchemy: boolean;
    };
  }> {
    console.log('🔧 Running comprehensive health check...');

    const healthResults = await Promise.allSettled([
      this.supabaseService.healthCheck(),
      this.circleService.healthCheck(),
      this.solanaService.healthCheck(),
      this.stripeService?.healthCheck() || Promise.resolve(false),
      this.jumioService?.healthCheck() || Promise.resolve(false),
      this.ellipticService?.healthCheck() || Promise.resolve(false),
      this.alchemyService?.healthCheck().then(result => result.status) || Promise.resolve(false),
    ]);

    const services = {
      supabase: healthResults[0].status === 'fulfilled' ? healthResults[0].value : false,
      circle: healthResults[1].status === 'fulfilled' ? healthResults[1].value : false,
      solana: healthResults[2].status === 'fulfilled' ? healthResults[2].value : false,
      stripe: healthResults[3].status === 'fulfilled' ? healthResults[3].value : false,
      jumio: healthResults[4].status === 'fulfilled' ? healthResults[4].value : false,
      elliptic: healthResults[5].status === 'fulfilled' ? healthResults[5].value : false,
      alchemy: healthResults[6].status === 'fulfilled' ? healthResults[6].value : false,
    };

    // Core services required for basic operation
    const coreServicesHealthy = services.supabase && services.circle && services.solana;
    
    console.log('✅ Health check completed');
    console.log('📊 Service status:', services);

    return {
      overall: coreServicesHealthy,
      services,
    };
  }
}

export default PaymentProcessor;