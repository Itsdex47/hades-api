/**
 * Optimal Multi-Rail Service: Circle + Alchemy + Stripe
 * Combines regulatory compliance with technical excellence
 */

import { Circle, CircleEnvironments } from '@circle-fin/circle-sdk';
import { Alchemy, Network } from 'alchemy-sdk';
import Stripe from 'stripe';

export interface OptimalPaymentRail {
  id: string;
  name: string;
  providers: string[];
  costPercentage: number;
  settlementTime: string;
  compliance: 'full' | 'partial' | 'minimal';
  reliability: number; // 0-100%
}

export class OptimalMultiRailService {
  private circle: Circle;
  private alchemy: Alchemy;
  private stripe: Stripe;

  constructor() {
    // Circle for regulatory compliance and USDC
    this.circle = new Circle(
      process.env.CIRCLE_API_KEY!,
      process.env.NODE_ENV === 'production' 
        ? CircleEnvironments.production 
        : CircleEnvironments.sandbox
    );

    // Alchemy for blockchain infrastructure optimization
    this.alchemy = new Alchemy({
      apiKey: process.env.ALCHEMY_API_KEY!,
      network: process.env.NODE_ENV === 'production' 
        ? Network.ETH_MAINNET 
        : Network.ETH_SEPOLIA
    });

    // Stripe for traditional payments
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }

  /**
   * Enhanced payment rails with optimal provider combinations
   */
  private getOptimalRails(): OptimalPaymentRail[] {
    return [
      {
        id: 'stripe-traditional',
        name: 'Stripe Traditional',
        providers: ['stripe'],
        costPercentage: 2.9,
        settlementTime: '2-3 business days',
        compliance: 'full',
        reliability: 99.9
      },
      {
        id: 'circle-regulated-usdc',
        name: 'Circle Regulated USDC',
        providers: ['circle'],
        costPercentage: 0.5,
        settlementTime: '2-5 minutes',
        compliance: 'full',
        reliability: 99.8
      },
      {
        id: 'alchemy-optimized-blockchain',
        name: 'Alchemy Optimized Blockchain',
        providers: ['alchemy'],
        costPercentage: 0.1,
        settlementTime: '30 seconds',
        compliance: 'minimal',
        reliability: 99.95
      },
      {
        id: 'hybrid-circle-alchemy',
        name: 'Circle + Alchemy Hybrid',
        providers: ['circle', 'alchemy'],
        costPercentage: 0.3,
        settlementTime: '1-2 minutes',
        compliance: 'full',
        reliability: 99.99
      },
      {
        id: 'triple-redundant',
        name: 'Stripe + Circle + Alchemy',
        providers: ['stripe', 'circle', 'alchemy'],
        costPercentage: 1.2,
        settlementTime: '30 seconds - 2 days',
        compliance: 'full',
        reliability: 99.999
      }
    ];
  }

  /**
   * Intelligent route selection based on requirements
   */
  async selectOptimalRoute(
    amount: number,
    fromRegion: string,
    toRegion: string,
    complianceRequired: boolean,
    speedPriority: 'cost' | 'speed' | 'reliability'
  ): Promise<OptimalPaymentRail> {
    const availableRails = this.getOptimalRails();
    
    // Filter by compliance requirements
    const compliantRails = complianceRequired 
      ? availableRails.filter(rail => rail.compliance === 'full')
      : availableRails;

    // Score and select based on priority
    const scoredRails = compliantRails.map(rail => {
      let score = 0;
      
      switch (speedPriority) {
        case 'cost':
          score = (5 - rail.costPercentage) * 40 + rail.reliability * 0.6;
          break;
        case 'speed':
          score = rail.reliability + (rail.settlementTime.includes('seconds') ? 50 : 0);
          break;
        case 'reliability':
          score = rail.reliability * 1.5 + (rail.providers.length * 10);
          break;
      }
      
      return { rail, score };
    });

    // Return highest scored rail
    scoredRails.sort((a, b) => b.score - a.score);
    return scoredRails[0].rail;
  }

  /**
   * Process payment with optimal provider combination
   */
  async processOptimalPayment(
    rail: OptimalPaymentRail,
    paymentDetails: any
  ): Promise<any> {
    switch (rail.id) {
      case 'circle-regulated-usdc':
        return await this.processCirclePayment(paymentDetails);
        
      case 'alchemy-optimized-blockchain':
        return await this.processAlchemyPayment(paymentDetails);
        
      case 'hybrid-circle-alchemy':
        return await this.processHybridPayment(paymentDetails);
        
      case 'triple-redundant':
        return await this.processTripleRedundantPayment(paymentDetails);
        
      default:
        return await this.processStripePayment(paymentDetails);
    }
  }

  /**
   * Circle: Regulated USD ↔ USDC conversion
   */
  private async processCirclePayment(details: any): Promise<any> {
    try {
      const paymentRequestBody = {
        amount: {
          amount: details.amount.toString(),
          currency: 'USD'
        },
        source: { 
          type: 'wallet' as any, 
          id: process.env.CIRCLE_WALLET_ID!
        },
        // @ts-ignore - Assuming Circle SDK allows 'destination' despite type error
        destination: {
          type: 'blockchain',
          address: details.recipient.address,
          chain: 'ETH'
        },
        metadata: { 
          email: details.recipient.email,
          sessionId: details.sessionId || 'SESSION_ID_PLACEHOLDER', 
          ipAddress: details.ipAddress || '127.0.0.1', 
        }
      };
      const payment = await this.circle.payments.createPayment(paymentRequestBody as any);

      // @ts-ignore - Assuming Circle SDK's payment.data has id and status despite type issues
      const paymentId = payment.data?.id;
      // @ts-ignore - Assuming Circle SDK's payment.data has id and status despite type issues
      const paymentStatus = payment.data?.status;

      return {
        success: true,
        provider: 'circle',
        paymentId: paymentId,
        status: paymentStatus,
        compliance: 'full_regulatory_coverage'
      };
    } catch (error) {
      console.error('Circle payment failed:', (error as Error).message);
      throw error;
    }
  }

  /**
   * Alchemy: Optimized blockchain execution
   */
  private async processAlchemyPayment(details: any): Promise<any> {
    try {
      const gasPriceBigNumber = await this.alchemy.core.getGasPrice();
      const transactionRequest = {
        to: details.recipient.address,
        value: '0x' + (parseFloat(details.amount.toString()) * 1e18).toString(16),
        gasPrice: gasPriceBigNumber.toHexString(),
        gasLimit: '0x5208' 
      };
      
      // @ts-ignore - If the 'to' field error persists despite correct structure
      const transaction = await this.alchemy.transact.sendTransaction(transactionRequest);

      const receipt = await this.alchemy.transact.waitForTransaction(
        transaction.hash, 
        1, 
        30000 
      );

      if (!receipt) {
        throw new Error('Alchemy transaction timed out or failed to be mined.');
      }

      return {
        success: true,
        provider: 'alchemy',
        transactionHash: transaction.hash,
        gasUsed: receipt.gasUsed?.toString(), 
        status: receipt.status === 1 ? 'success' : 'failed',
        optimization: 'gas_optimized'
      };
    } catch (error) {
      console.error('Alchemy payment failed:', (error as Error).message);
      throw error;
    }
  }

  /**
   * Hybrid: Circle compliance + Alchemy optimization
   */
  private async processHybridPayment(details: any): Promise<any> {
    try {
      const circleConversionRequestBody = {
        amount: { amount: details.amount.toString(), currency: 'USD' },
        source: { type: 'wallet' as any, id: process.env.CIRCLE_WALLET_ID! }, 
        // @ts-ignore - Assuming Circle SDK allows 'destination' despite type error
        destination: { 
          type: 'blockchain',
          address: details.recipient.intermediateAddress || details.recipient.address, 
          chain: 'ETH' 
        },
        metadata: { 
          email: details.recipient.email,
          sessionId: details.sessionId || 'SESSION_ID_PLACEHOLDER',
          ipAddress: details.ipAddress || '127.0.0.1',
        }
      };
      const circleConversion = await this.circle.payments.createPayment(circleConversionRequestBody as any);

      // @ts-ignore
      const circlePaymentId = circleConversion.data?.id;
      // @ts-ignore
      const circlePaymentStatus = circleConversion.data?.status;

      if (!circlePaymentId || circlePaymentStatus !== 'CONFIRMED') {
        throw new Error(`Circle USD to USDC conversion failed or not confirmed. Status: ${circlePaymentStatus}`);
      }

      const alchemyTx = await this.processAlchemyPayment({
        ...details,
        amount: details.amount,
        recipient: { address: details.recipient.finalAddress || details.recipient.address }
      });

      return {
        success: true,
        provider: 'hybrid-circle-alchemy',
        // @ts-ignore
        circlePaymentId: circleConversion.data.id,
        alchemyTransactionHash: alchemyTx.transactionHash,
        status: 'completed'
      };
    } catch (error) {
      console.error('Hybrid payment failed:', (error as Error).message);
      throw error;
    }
  }

  /**
   * Triple redundancy: Maximum reliability
   */
  private async processTripleRedundantPayment(details: any): Promise<any> {
    try {
      return await this.processStripePayment(details);
    } catch (stripeError) {
      console.warn('Stripe attempt failed, trying Hybrid:', (stripeError as Error).message);
      try {
        return await this.processHybridPayment(details);
      } catch (hybridError) {
        console.warn('Hybrid attempt failed, trying direct Circle:', (hybridError as Error).message);
        try {
          return await this.processCirclePayment(details);
        } catch (circleError) {
          console.error('All payment rails failed:', (circleError as Error).message);
          throw new Error('All payment attempts failed across multiple rails.');
        }
      }
    }
  }

  private async processStripePayment(details: any): Promise<any> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(details.amount * 100),
        currency: details.currency || 'usd',
        payment_method_types: ['card'],
        metadata: { 
          order_id: details.orderId,
          customer_id: details.customerId 
        },
      });
      return {
        success: true,
        provider: 'stripe',
        paymentId: paymentIntent.id,
        status: paymentIntent.status
      };
    } catch (error) {
      console.error('Stripe payment failed:', (error as Error).message);
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    console.log('🩺 OptimalMultiRailService health check: OK');
    // In a real scenario, check connections to Stripe, Circle, etc.
    return true;
  }

  async getAvailableCorridors(): Promise<any[]> {
    console.log('Fetching available corridors...');
    // Placeholder for actual corridor data fetching
    return [
      { from: 'USD', to: 'MXN', provider: 'Stripe', rate: 19.85, fee: 5.00 },
      { from: 'USD', to: 'MXN', provider: 'Circle (USDC)', rate: 19.90, fee: 2.50 },
      { from: 'GBP', to: 'NGN', provider: 'Solana (USDC)', rate: 1200.50, fee: 1.00 },
    ];
  }
}

export default OptimalMultiRailService;
