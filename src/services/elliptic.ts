import axios, { AxiosInstance } from 'axios';

export interface EllipticAddressRiskRequest {
  address: string;
  blockchain: 'bitcoin' | 'ethereum' | 'solana';
  outputFormat?: 'simple' | 'detailed';
}

export interface EllipticAddressRiskResponse {
  address: string;
  blockchain: string;
  riskScore: number; // 0-100, higher = more risky
  riskLevel: 'low' | 'medium' | 'high' | 'severe';
  cluster?: {
    id: string;
    name?: string;
    category?: string;
  };
  sanctions: {
    isOnSanctionsList: boolean;
    sanctionPrograms?: string[];
  };
  exposure: {
    direct: number;
    indirect: number;
  };
  reportingCriteria?: {
    suspicious: boolean;
    reasons?: string[];
  };
}

export interface EllipticTransactionMonitoringRequest {
  transactionHash: string;
  blockchain: 'bitcoin' | 'ethereum' | 'solana';
  amount?: number;
  currency?: string;
  direction: 'inbound' | 'outbound';
}

export interface EllipticTransactionAnalysis {
  transactionHash: string;
  blockchain: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'severe';
  inputs: {
    address: string;
    riskScore: number;
    cluster?: string;
  }[];
  outputs: {
    address: string;
    riskScore: number;
    cluster?: string;
  }[];
  flags: {
    darkweb?: boolean;
    ransomware?: boolean;
    terrorism?: boolean;
    sanctions?: boolean;
    exchange?: boolean;
    mixer?: boolean;
  };
  recommendedAction: 'proceed' | 'review' | 'block';
}

export interface EllipticWalletScreeningRequest {
  walletAddresses: string[];
  blockchain: 'bitcoin' | 'ethereum' | 'solana';
  includeTransactionHistory?: boolean;
}

export interface EllipticComplianceReport {
  walletAddress: string;
  overallRiskScore: number;
  complianceStatus: 'compliant' | 'needs_review' | 'high_risk' | 'blocked';
  transactions: {
    hash: string;
    timestamp: string;
    amount: number;
    riskScore: number;
    counterparties: string[];
  }[];
  recommendations: string[];
}

export class EllipticService {
  private axios: AxiosInstance;
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.ELLIPTIC_API_KEY!;
    
    if (!this.apiKey) {
      throw new Error('ELLIPTIC_API_KEY environment variable is required');
    }

    this.baseUrl = process.env.ELLIPTIC_API_URL || 'https://api.elliptic.co';

    this.axios = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Starling Remittance API/1.0',
      },
    });

    console.log('🔍 Elliptic AML service initialized');
  }

  // Screen address for risk assessment
  async screenAddress(request: EllipticAddressRiskRequest): Promise<EllipticAddressRiskResponse> {
    try {
      console.log(`🔍 Screening address ${request.address.substring(0, 8)}... on ${request.blockchain}`);

      const response = await this.axios.post('/v2/wallet/synchronous', {
        subject: {
          asset: request.blockchain,
          hash: request.address,
        },
        type: 'address',
        outputFormat: request.outputFormat || 'detailed',
      });

      const data = response.data;
      
      const result: EllipticAddressRiskResponse = {
        address: request.address,
        blockchain: request.blockchain,
        riskScore: data.riskScore || 0,
        riskLevel: this.calculateRiskLevel(data.riskScore || 0),
        cluster: data.cluster ? {
          id: data.cluster.id,
          name: data.cluster.name,
          category: data.cluster.category,
        } : undefined,
        sanctions: {
          isOnSanctionsList: data.sanctions?.isOnSanctionsList || false,
          sanctionPrograms: data.sanctions?.programs || [],
        },
        exposure: {
          direct: data.exposure?.direct || 0,
          indirect: data.exposure?.indirect || 0,
        },
        reportingCriteria: {
          suspicious: data.reportingCriteria?.suspicious || false,
          reasons: data.reportingCriteria?.reasons || [],
        },
      };

      console.log(`✅ Address screening completed. Risk level: ${result.riskLevel}`);
      return result;
    } catch (error) {
      console.error('❌ Address screening failed:', error);
      throw new Error(`Elliptic address screening failed: ${this.getErrorMessage(error)}`);
    }
  }

  // Monitor transaction for compliance
  async analyzeTransaction(request: EllipticTransactionMonitoringRequest): Promise<EllipticTransactionAnalysis> {
    try {
      console.log(`🔍 Analyzing transaction ${request.transactionHash.substring(0, 10)}...`);

      const response = await this.axios.post('/v2/analyses', {
        subject: {
          asset: request.blockchain,
          hash: request.transactionHash,
        },
        type: 'transaction',
      });

      const data = response.data;

      const result: EllipticTransactionAnalysis = {
        transactionHash: request.transactionHash,
        blockchain: request.blockchain,
        riskScore: data.riskScore || 0,
        riskLevel: this.calculateRiskLevel(data.riskScore || 0),
        inputs: data.inputs?.map((input: any) => ({
          address: input.address,
          riskScore: input.riskScore || 0,
          cluster: input.cluster?.name,
        })) || [],
        outputs: data.outputs?.map((output: any) => ({
          address: output.address,
          riskScore: output.riskScore || 0,
          cluster: output.cluster?.name,
        })) || [],
        flags: {
          darkweb: data.flags?.darkweb || false,
          ransomware: data.flags?.ransomware || false,
          terrorism: data.flags?.terrorism || false,
          sanctions: data.flags?.sanctions || false,
          exchange: data.flags?.exchange || false,
          mixer: data.flags?.mixer || false,
        },
        recommendedAction: this.getRecommendedAction(data.riskScore || 0, data.flags || {}),
      };

      console.log(`✅ Transaction analysis completed. Action: ${result.recommendedAction}`);
      return result;
    } catch (error) {
      console.error('❌ Transaction analysis failed:', error);
      throw new Error(`Elliptic transaction analysis failed: ${this.getErrorMessage(error)}`);
    }
  }

  // Bulk wallet screening for compliance
  async screenWallets(request: EllipticWalletScreeningRequest): Promise<EllipticComplianceReport[]> {
    try {
      console.log(`🔍 Screening ${request.walletAddresses.length} wallet addresses...`);

      const screeningPromises = request.walletAddresses.map(address =>
        this.screenAddress({
          address,
          blockchain: request.blockchain,
          outputFormat: 'detailed',
        })
      );

      const screeningResults = await Promise.allSettled(screeningPromises);

      const reports: EllipticComplianceReport[] = [];

      for (let i = 0; i < screeningResults.length; i++) {
        const result = screeningResults[i];
        const address = request.walletAddresses[i];

        if (result.status === 'fulfilled') {
          const screening = result.value;
          
          reports.push({
            walletAddress: address,
            overallRiskScore: screening.riskScore,
            complianceStatus: this.getComplianceStatus(screening.riskScore),
            transactions: [], // Would be populated if includeTransactionHistory is true
            recommendations: this.generateRecommendations(screening),
          });
        } else {
          // Handle failed screening
          reports.push({
            walletAddress: address,
            overallRiskScore: 50, // Unknown risk
            complianceStatus: 'needs_review',
            transactions: [],
            recommendations: ['Address screening failed - manual review required'],
          });
        }
      }

      console.log(`✅ Wallet screening completed for ${reports.length} addresses`);
      return reports;
    } catch (error) {
      console.error('❌ Wallet screening failed:', error);
      throw new Error(`Elliptic wallet screening failed: ${this.getErrorMessage(error)}`);
    }
  }

  // Create case for suspicious activity
  async createComplianceCase(data: {
    entityId: string;
    description: string;
    riskFactors: string[];
    priority: 'low' | 'medium' | 'high' | 'urgent';
    assignee?: string;
  }): Promise<{ caseId: string; status: string }> {
    try {
      console.log(`📋 Creating compliance case for entity ${data.entityId}`);

      const response = await this.axios.post('/v2/cases', {
        entityId: data.entityId,
        description: data.description,
        riskFactors: data.riskFactors,
        priority: data.priority,
        assignee: data.assignee,
        source: 'starling_api',
        createdAt: new Date().toISOString(),
      });

      const result = {
        caseId: response.data.id,
        status: response.data.status,
      };

      console.log(`✅ Compliance case created: ${result.caseId}`);
      return result;
    } catch (error) {
      console.error('❌ Failed to create compliance case:', error);
      throw new Error(`Compliance case creation failed: ${this.getErrorMessage(error)}`);
    }
  }

  // Get compliance statistics
  async getComplianceMetrics(from: Date, to: Date): Promise<{
    totalAddressesScreened: number;
    highRiskAddresses: number;
    sanctionedAddresses: number;
    casesCreated: number;
    averageRiskScore: number;
  }> {
    try {
      console.log('📊 Retrieving compliance metrics...');

      const response = await this.axios.get('/v2/metrics', {
        params: {
          from: from.toISOString(),
          to: to.toISOString(),
        },
      });

      const metrics = response.data;

      const result = {
        totalAddressesScreened: metrics.totalScreenings || 0,
        highRiskAddresses: metrics.highRiskCount || 0,
        sanctionedAddresses: metrics.sanctionedCount || 0,
        casesCreated: metrics.casesCreated || 0,
        averageRiskScore: metrics.averageRiskScore || 0,
      };

      console.log('✅ Compliance metrics retrieved');
      return result;
    } catch (error) {
      console.error('❌ Failed to get compliance metrics:', error);
      throw new Error(`Metrics retrieval failed: ${this.getErrorMessage(error)}`);
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.axios.get('/v2/health');
      return true;
    } catch (error) {
      console.error('❌ Elliptic health check failed:', error);
      return false;
    }
  }

  // Helper methods
  private calculateRiskLevel(riskScore: number): 'low' | 'medium' | 'high' | 'severe' {
    if (riskScore >= 80) return 'severe';
    if (riskScore >= 60) return 'high';
    if (riskScore >= 30) return 'medium';
    return 'low';
  }

  private getRecommendedAction(riskScore: number, flags: any): 'proceed' | 'review' | 'block' {
    if (flags.sanctions || flags.terrorism || riskScore >= 80) return 'block';
    if (flags.ransomware || flags.mixer || riskScore >= 50) return 'review';
    return 'proceed';
  }

  private getComplianceStatus(riskScore: number): 'compliant' | 'needs_review' | 'high_risk' | 'blocked' {
    if (riskScore >= 80) return 'blocked';
    if (riskScore >= 60) return 'high_risk';
    if (riskScore >= 30) return 'needs_review';
    return 'compliant';
  }

  private generateRecommendations(screening: EllipticAddressRiskResponse): string[] {
    const recommendations: string[] = [];

    if (screening.sanctions.isOnSanctionsList) {
      recommendations.push('Address is on sanctions list - transaction should be blocked');
    }

    if (screening.riskScore >= 70) {
      recommendations.push('High risk address - enhanced due diligence required');
    }

    if (screening.exposure.direct > 0) {
      recommendations.push('Direct exposure to illicit activity detected');
    }

    if (screening.cluster?.category === 'exchange') {
      recommendations.push('Address belongs to cryptocurrency exchange');
    }

    if (recommendations.length === 0) {
      recommendations.push('No immediate compliance concerns identified');
    }

    return recommendations;
  }

  private getErrorMessage(error: any): string {
    if (error.response?.data?.message) {
      return error.response.data.message;
    }
    if (error instanceof Error) return error.message;
    return String(error);
  }
}

export default EllipticService; 