/**
 * Comprehensive Compliance Service
 * Integrates KYC, AML, and regulatory monitoring
 */

import axios from 'axios';
import logger from '../utils/logger';

export interface ComplianceResult {
  success: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  riskScore: number;
  recommendation: 'approve' | 'review' | 'reject';
  flags: string[];
  details?: any;
}

export interface KYCData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  address: {
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
  };
  documentType: 'passport' | 'drivers_license' | 'national_id';
  documentNumber: string;
}

export interface AMLScreeningData {
  walletAddress?: string;
  transactionHash?: string;
  amount: number;
  currency: string;
  blockchain?: string;
  counterpartyAddress?: string;
}

export class ComplianceService {
  private jumioConfig: any;
  private ellipticConfig: any;
  private cubeConfig: any;

  constructor() {
    this.jumioConfig = {
      apiToken: process.env.JUMIO_API_TOKEN,
      apiSecret: process.env.JUMIO_API_SECRET,
      baseUrl: process.env.JUMIO_BASE_URL || 'https://netverify.com'
    };

    this.ellipticConfig = {
      apiKey: process.env.ELLIPTIC_API_KEY,
      baseUrl: 'https://api.elliptic.co'
    };

    this.cubeConfig = {
      apiKey: process.env.CUBE_API_KEY,
      baseUrl: 'https://api.cube.dev'
    };

    logger.info('Compliance service initialized', {
      jumio: !!this.jumioConfig.apiToken,
      elliptic: !!this.ellipticConfig.apiKey,
      cube: !!this.cubeConfig.apiKey
    });
  }

  /**
   * Health check for compliance services
   */
  async healthCheck(): Promise<boolean> {
    try {
      const checks = await Promise.allSettled([
        this.checkJumioHealth(),
        this.checkEllipticHealth(),
        this.checkCubeHealth()
      ]);

      return checks.some(check => check.status === 'fulfilled' && check.value);
    } catch (error) {
      logger.error('Compliance health check failed:', error);
      return false;
    }
  }

  /**
   * Comprehensive KYC verification using Jumio
   */
  async performKYC(data: KYCData): Promise<ComplianceResult> {
    try {
      if (!this.jumioConfig.apiToken) {
        return this.mockKYCResult(data);
      }

      // Create Jumio verification session
      const response = await axios.post(
        `${this.jumioConfig.baseUrl}/api/v4/accounts`,
        {
          customerInternalReference: data.email,
          workflowDefinition: {
            key: 1, // Standard KYC workflow
            credentials: [
              {
                category: 'ID',
                type: { 
                  country: data.address.country 
                }
              }
            ]
          },
          callbackUrl: `${process.env.API_BASE_URL}/webhooks/jumio`,
          userReference: data.email
        },
        {
          headers: {
            'Authorization': `Bearer ${this.jumioConfig.apiToken}`,
            'Content-Type': 'application/json',
            'User-Agent': 'Starling-Remittance-API/0.2.0'
          }
        }
      );

      const verificationId = response.data.account?.workflowExecution?.id;
      const redirectUrl = response.data.web?.href;

      logger.info('KYC verification initiated', {
        verificationId,
        email: data.email,
        country: data.address.country
      });

      return {
        success: true,
        riskLevel: 'low',
        riskScore: 15,
        recommendation: 'approve',
        flags: [],
        details: {
          verificationId,
          redirectUrl,
          status: 'pending',
          provider: 'jumio'
        }
      };

    } catch (error: any) {
      logger.error('KYC verification failed:', {
        error: error.message,
        email: data.email,
        response: error.response?.data
      });

      return {
        success: false,
        riskLevel: 'high',
        riskScore: 100,
        recommendation: 'review',
        flags: ['kyc_verification_failed'],
        details: {
          error: error.message,
          provider: 'jumio'
        }
      };
    }
  }

  /**
   * Blockchain AML screening using Elliptic
   */
  async performAMLScreening(data: AMLScreeningData): Promise<ComplianceResult> {
    try {
      if (!this.ellipticConfig.apiKey) {
        return this.mockAMLResult(data);
      }

      const screeningPayload = {
        subject: {
          asset: this.getAssetFromBlockchain(data.blockchain || 'ethereum'),
          hash: data.walletAddress || data.transactionHash,
          type: data.walletAddress ? 'address' : 'transaction'
        },
        type: 'wallet_exposure'
      };

      const response = await axios.post(
        `${this.ellipticConfig.baseUrl}/v2/analyses/synchronous`,
        screeningPayload,
        {
          headers: {
            'Authorization': `Bearer ${this.ellipticConfig.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const riskScore = response.data.risk_score || 0;
      const sanctions = response.data.sanctions || [];
      const riskFactors = response.data.risk_factors || [];

      const riskLevel = this.calculateRiskLevel(riskScore);
      const recommendation = this.getRecommendation(riskScore, sanctions.length);

      logger.info('AML screening completed', {
        address: data.walletAddress,
        riskScore,
        sanctionsCount: sanctions.length,
        riskFactorsCount: riskFactors.length,
        recommendation
      });

      return {
        success: true,
        riskLevel,
        riskScore,
        recommendation,
        flags: this.generateAMLFlags(riskScore, sanctions, riskFactors),
        details: {
          sanctions,
          riskFactors,
          provider: 'elliptic',
          blockchain: data.blockchain
        }
      };

    } catch (error: any) {
      logger.error('AML screening failed:', {
        error: error.message,
        address: data.walletAddress,
        response: error.response?.data
      });

      return {
        success: false,
        riskLevel: 'high',
        riskScore: 100,
        recommendation: 'review',
        flags: ['aml_screening_failed'],
        details: {
          error: error.message,
          provider: 'elliptic'
        }
      };
    }
  }

  /**
   * Comprehensive compliance check combining KYC and AML
   */
  async performComprehensiveCheck(
    kycData: KYCData,
    amlData: AMLScreeningData
  ): Promise<ComplianceResult> {
    try {
      const [kycResult, amlResult] = await Promise.all([
        this.performKYC(kycData),
        this.performAMLScreening(amlData)
      ]);

      // Combine risk scores with weighted average
      const combinedRiskScore = (kycResult.riskScore * 0.4) + (amlResult.riskScore * 0.6);
      const combinedRiskLevel = this.calculateRiskLevel(combinedRiskScore);
      
      // Most restrictive recommendation wins
      const recommendation = this.getMostRestrictiveRecommendation([
        kycResult.recommendation,
        amlResult.recommendation
      ]);

      const combinedFlags = [
        ...kycResult.flags,
        ...amlResult.flags
      ];

      logger.info('Comprehensive compliance check completed', {
        email: kycData.email,
        address: amlData.walletAddress,
        combinedRiskScore,
        recommendation,
        flagsCount: combinedFlags.length
      });

      return {
        success: kycResult.success && amlResult.success,
        riskLevel: combinedRiskLevel,
        riskScore: combinedRiskScore,
        recommendation,
        flags: combinedFlags,
        details: {
          kyc: kycResult.details,
          aml: amlResult.details,
          combined: true
        }
      };

    } catch (error: any) {
      logger.error('Comprehensive compliance check failed:', error);
      
      return {
        success: false,
        riskLevel: 'high',
        riskScore: 100,
        recommendation: 'reject',
        flags: ['comprehensive_check_failed'],
        details: {
          error: error.message
        }
      };
    }
  }

  /**
   * Real-time transaction monitoring
   */
  async monitorTransaction(transactionData: {
    id: string;
    amount: number;
    currency: string;
    sender: any;
    recipient: any;
    blockchain?: string;
  }): Promise<ComplianceResult> {
    try {
      // Check transaction patterns
      const patternFlags = await this.checkTransactionPatterns(transactionData);
      
      // Check sanctions lists
      const sanctionsFlags = await this.checkSanctionsList(
        transactionData.sender,
        transactionData.recipient
      );

      // Check amount thresholds
      const thresholdFlags = this.checkAmountThresholds(
        transactionData.amount,
        transactionData.currency
      );

      const allFlags = [...patternFlags, ...sanctionsFlags, ...thresholdFlags];
      const riskScore = this.calculateTransactionRiskScore(allFlags, transactionData);
      const riskLevel = this.calculateRiskLevel(riskScore);
      const recommendation = this.getRecommendation(riskScore, allFlags.length);

      logger.info('Transaction monitoring completed', {
        transactionId: transactionData.id,
        riskScore,
        flagsCount: allFlags.length,
        recommendation
      });

      return {
        success: true,
        riskLevel,
        riskScore,
        recommendation,
        flags: allFlags,
        details: {
          transactionId: transactionData.id,
          monitoring: 'real_time',
          timestamp: new Date().toISOString()
        }
      };

    } catch (error: any) {
      logger.error('Transaction monitoring failed:', error);
      
      return {
        success: false,
        riskLevel: 'high',
        riskScore: 100,
        recommendation: 'review',
        flags: ['monitoring_failed'],
        details: {
          error: error.message
        }
      };
    }
  }

  // Private helper methods
  private async checkJumioHealth(): Promise<boolean> {
    try {
      if (!this.jumioConfig.apiToken) return false;
      
      const response = await axios.get(
        `${this.jumioConfig.baseUrl}/api/v4/accounts/status`,
        {
          headers: {
            'Authorization': `Bearer ${this.jumioConfig.apiToken}`
          },
          timeout: 5000
        }
      );
      
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  private async checkEllipticHealth(): Promise<boolean> {
    try {
      if (!this.ellipticConfig.apiKey) return false;
      
      const response = await axios.get(
        `${this.ellipticConfig.baseUrl}/v2/ping`,
        {
          headers: {
            'Authorization': `Bearer ${this.ellipticConfig.apiKey}`
          },
          timeout: 5000
        }
      );
      
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  private async checkCubeHealth(): Promise<boolean> {
    return !!this.cubeConfig.apiKey;
  }

  private getAssetFromBlockchain(blockchain: string): string {
    const assetMap: { [key: string]: string } = {
      'ethereum': 'ETH',
      'bitcoin': 'BTC',
      'solana': 'SOL',
      'polygon': 'MATIC'
    };
    
    return assetMap[blockchain.toLowerCase()] || 'ETH';
  }

  private calculateRiskLevel(riskScore: number): 'low' | 'medium' | 'high' {
    if (riskScore < 25) return 'low';
    if (riskScore < 75) return 'medium';
    return 'high';
  }

  private getRecommendation(riskScore: number, flagsCount: number): 'approve' | 'review' | 'reject' {
    if (riskScore > 85 || flagsCount > 3) return 'reject';
    if (riskScore > 50 || flagsCount > 1) return 'review';
    return 'approve';
  }

  private generateAMLFlags(riskScore: number, sanctions: any[], riskFactors: any[]): string[] {
    const flags = [];
    
    if (riskScore > 75) flags.push('high_risk_score');
    if (sanctions.length > 0) flags.push('sanctions_hit');
    if (riskFactors.length > 2) flags.push('multiple_risk_factors');
    if (riskScore > 50 && sanctions.length > 0) flags.push('sanctions_and_risk');
    
    return flags;
  }

  private getMostRestrictiveRecommendation(recommendations: string[]): 'approve' | 'review' | 'reject' {
    if (recommendations.includes('reject')) return 'reject';
    if (recommendations.includes('review')) return 'review';
    return 'approve';
  }

  private async checkTransactionPatterns(transactionData: any): Promise<string[]> {
    const flags = [];
    
    // Check for round number amounts (potential structuring)
    if (transactionData.amount % 1000 === 0 && transactionData.amount >= 5000) {
      flags.push('round_number_amount');
    }
    
    // Check for high-frequency transactions from same sender
    // This would require database lookup in real implementation
    
    // Check for unusual time patterns
    const hour = new Date().getHours();
    if (hour < 6 || hour > 23) {
      flags.push('unusual_time_pattern');
    }
    
    return flags;
  }

  private async checkSanctionsList(sender: any, recipient: any): Promise<string[]> {
    const flags = [];
    
    // In real implementation, this would check against OFAC and other sanctions lists
    // For now, we'll do basic country checks
    const sanctionedCountries = ['IR', 'KP', 'SY', 'CU'];
    
    if (sanctionedCountries.includes(sender.country)) {
      flags.push('sender_sanctioned_country');
    }
    
    if (sanctionedCountries.includes(recipient.country)) {
      flags.push('recipient_sanctioned_country');
    }
    
    return flags;
  }

  private checkAmountThresholds(amount: number, currency: string): string[] {
    const flags = [];
    
    // USD thresholds (convert other currencies as needed)
    const usdAmount = this.convertToUSD(amount, currency);
    
    if (usdAmount >= 10000) {
      flags.push('high_value_transaction');
    }
    
    if (usdAmount >= 3000 && usdAmount < 10000) {
      flags.push('medium_value_transaction');
    }
    
    return flags;
  }

  private convertToUSD(amount: number, currency: string): number {
    // Simplified conversion - in production, use real exchange rates
    const rates: { [key: string]: number } = {
      'USD': 1,
      'GBP': 1.27,
      'EUR': 1.09,
      'MXN': 0.057,
      'NGN': 0.0013
    };
    
    return amount * (rates[currency] || 1);
  }

  private calculateTransactionRiskScore(flags: string[], transactionData: any): number {
    let score = 0;
    
    // Base score from flags
    score += flags.length * 15;
    
    // Amount-based scoring
    const usdAmount = this.convertToUSD(transactionData.amount, transactionData.currency);
    if (usdAmount > 10000) score += 20;
    if (usdAmount > 50000) score += 40;
    
    // Pattern-based scoring
    if (flags.includes('sanctioned_country')) score += 50;
    if (flags.includes('round_number_amount')) score += 10;
    if (flags.includes('unusual_time_pattern')) score += 5;
    
    return Math.min(score, 100); // Cap at 100
  }

  private mockKYCResult(data: KYCData): ComplianceResult {
    // Mock result for development/testing
    const riskScore = Math.random() * 30; // Low risk for demo
    
    return {
      success: true,
      riskLevel: 'low',
      riskScore,
      recommendation: 'approve',
      flags: [],
      details: {
        verificationId: `mock_${Date.now()}`,
        status: 'approved',
        provider: 'jumio_mock',
        email: data.email
      }
    };
  }

  private mockAMLResult(data: AMLScreeningData): ComplianceResult {
    // Mock result for development/testing
    const riskScore = Math.random() * 25; // Low risk for demo
    
    return {
      success: true,
      riskLevel: 'low',
      riskScore,
      recommendation: 'approve',
      flags: [],
      details: {
        sanctions: [],
        riskFactors: [],
        provider: 'elliptic_mock',
        address: data.walletAddress
      }
    };
  }
}

export default ComplianceService;
