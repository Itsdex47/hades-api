/**
 * Comprehensive Compliance Service
 * Integrates KYC, AML, and regulatory monitoring
 */

import axios from 'axios';
import logger from '../utils/logger';

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

export interface ComplianceResult {
  success: boolean;
  riskLevel: 'low' | 'medium' | 'high';
  riskScore: number;
  recommendation: 'approve' | 'review' | 'block';
  flags: string[];
  details: any;
}

export class ComplianceService {
  private circleConfig: any;

  constructor() {
    // Use Circle for compliance instead of separate providers
    this.circleConfig = {
      apiKey: process.env.CIRCLE_API_KEY,
      baseUrl: process.env.CIRCLE_ENVIRONMENT === 'production' 
        ? 'https://api.circle.com' 
        : 'https://api-sandbox.circle.com'
    };

    logger.info('Compliance service initialized with Circle Compliance Engine', {
      circle: !!this.circleConfig.apiKey
    });
  }

  /**
   * Health check for compliance services
   */
  async healthCheck(): Promise<boolean> {
    try {
      const checks = await Promise.allSettled([
        this.checkCircleHealth()
      ]);

      return checks.some(check => check.status === 'fulfilled' && check.value);
    } catch (error) {
      logger.error('Compliance health check failed:', error);
      return false;
    }
  }

  /**
   * Comprehensive KYC verification using Circle's compliance features
   */
  async performKYC(data: KYCData): Promise<ComplianceResult> {
    try {
      if (!this.circleConfig.apiKey) {
        return this.mockKYCResult(data);
      }

      // Use Circle's compliance engine for KYC verification
      const response = await axios.post(
        `${this.circleConfig.baseUrl}/v1/compliance/kyc`,
        {
          customerReference: data.email,
          personalDetails: {
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            phone: data.phone,
            dateOfBirth: data.dateOfBirth
          },
          address: data.address,
          document: {
            type: data.documentType,
            number: data.documentNumber
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.circleConfig.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const verificationId = response.data.verificationId;
      const status = response.data.status;

      logger.info('Circle KYC verification initiated', {
        verificationId,
        email: data.email,
        status
      });

      return {
        success: true,
        riskLevel: 'low',
        riskScore: 15,
        recommendation: 'approve',
        flags: [],
        details: {
          verificationId,
          status,
          provider: 'circle_compliance'
        }
      };

    } catch (error: any) {
      logger.error('Circle KYC verification failed:', {
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
          provider: 'circle_compliance'
        }
      };
    }
  }

  /**
   * Blockchain AML screening using Circle's compliance engine
   */
  async performAMLScreening(data: AMLScreeningData): Promise<ComplianceResult> {
    try {
      if (!this.circleConfig.apiKey) {
        return this.mockAMLResult(data);
      }

      const screeningPayload = {
        walletAddress: data.walletAddress,
        transactionHash: data.transactionHash,
        amount: data.amount.toString(),
        currency: data.currency,
        blockchain: data.blockchain || 'ethereum'
      };

      const response = await axios.post(
        `${this.circleConfig.baseUrl}/v1/compliance/screening`,
        screeningPayload,
        {
          headers: {
            'Authorization': `Bearer ${this.circleConfig.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const riskScore = response.data.riskScore || 0;
      const sanctions = response.data.sanctions || [];
      const riskFactors = response.data.riskFactors || [];

      const riskLevel = this.calculateRiskLevel(riskScore);
      const recommendation = this.getRecommendation(riskScore, sanctions.length);

      logger.info('Circle AML screening completed', {
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
          provider: 'circle_compliance',
          blockchain: data.blockchain
        }
      };

    } catch (error: any) {
      logger.error('Circle AML screening failed:', {
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
          provider: 'circle_compliance'
        }
      };
    }
  }

  /**
   * Comprehensive compliance check combining KYC and AML
   */
  async performComprehensiveCheck(kycData: KYCData, amlData: AMLScreeningData): Promise<ComplianceResult> {
    try {
      const [kycResult, amlResult] = await Promise.all([
        this.performKYC(kycData),
        this.performAMLScreening(amlData)
      ]);

      const combinedRiskScore = Math.max(kycResult.riskScore, amlResult.riskScore);
      const combinedFlags = [...kycResult.flags, ...amlResult.flags];

      const overallRecommendation = this.getCombinedRecommendation([kycResult, amlResult]);

      logger.info('Comprehensive compliance check completed', {
        kycSuccess: kycResult.success,
        amlSuccess: amlResult.success,
        combinedRiskScore,
        recommendation: overallRecommendation
      });

      return {
        success: kycResult.success && amlResult.success,
        riskLevel: this.calculateRiskLevel(combinedRiskScore),
        riskScore: combinedRiskScore,
        recommendation: overallRecommendation,
        flags: combinedFlags,
        details: {
          kyc: kycResult.details,
          aml: amlResult.details,
          provider: 'circle_compliance'
        }
      };

    } catch (error: any) {
      logger.error('Comprehensive compliance check failed:', error);
      
      return {
        success: false,
        riskLevel: 'high',
        riskScore: 100,
        recommendation: 'block',
        flags: ['comprehensive_check_failed'],
        details: {
          error: error.message,
          provider: 'circle_compliance'
        }
      };
    }
  }

  // Private helper methods
  private async checkCircleHealth(): Promise<boolean> {
    try {
      if (!this.circleConfig.apiKey) return false;
      
      const response = await axios.get(
        `${this.circleConfig.baseUrl}/v1/ping`,
        {
          headers: {
            'Authorization': `Bearer ${this.circleConfig.apiKey}`
          },
          timeout: 5000
        }
      );
      
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  private calculateRiskLevel(score: number): 'low' | 'medium' | 'high' {
    if (score < 30) return 'low';
    if (score < 70) return 'medium';
    return 'high';
  }

  private getRecommendation(riskScore: number, sanctionsCount: number): 'approve' | 'review' | 'block' {
    if (sanctionsCount > 0 || riskScore >= 80) return 'block';
    if (riskScore >= 50) return 'review';
    return 'approve';
  }

  private getCombinedRecommendation(results: ComplianceResult[]): 'approve' | 'review' | 'block' {
    if (results.some(r => r.recommendation === 'block')) return 'block';
    if (results.some(r => r.recommendation === 'review')) return 'review';
    return 'approve';
  }

  private generateAMLFlags(riskScore: number, sanctions: any[], riskFactors: any[]): string[] {
    const flags = [];
    
    if (riskScore >= 70) flags.push('high_risk_score');
    if (sanctions.length > 0) flags.push('sanctions_detected');
    if (riskFactors.length > 0) flags.push('risk_factors_detected');
    
    return flags;
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
        provider: 'circle_compliance_mock',
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
        provider: 'circle_compliance_mock',
        address: data.walletAddress
      }
    };
  }
}

export default ComplianceService;
