import axios, { AxiosInstance } from 'axios';

export interface JumioInitiateRequest {
  customerInternalReference: string;
  userReference: string;
  reportingCriteria?: string;
  callbackUrl?: string;
  successUrl?: string;
  errorUrl?: string;
  locale?: string;
  customerData?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    country?: string;
    dateOfBirth?: string;
  };
}

export interface JumioVerificationResult {
  scanReference: string;
  verificationStatus: 'APPROVED_VERIFIED' | 'DENIED_FRAUD' | 'DENIED_UNSUPPORTED_ID_TYPE' | 'ERROR_NOT_READABLE_ID' | 'NO_ID_UPLOADED';
  idScanStatus: 'SUCCESS' | 'ERROR';
  identityVerification?: {
    similarity: 'MATCH' | 'NO_MATCH' | 'NOT_POSSIBLE';
    validity: boolean;
    reason?: string;
  };
  document?: {
    type: string;
    country: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    expiryDate?: string;
    documentNumber?: string;
    personalNumber?: string;
  };
  transaction?: {
    date: string;
    status: string;
    source: 'WEB' | 'API';
  };
}

export interface JumioWebhookData {
  scanReference: string;
  timestamp: string;
  verificationStatus: string;
  idScanStatus: string;
  customerInternalReference: string;
  document?: any;
  identityVerification?: any;
}

export class JumioService {
  private axios: AxiosInstance;
  private apiToken: string;
  private apiSecret: string;
  private baseUrl: string;

  constructor() {
    this.apiToken = process.env.JUMIO_API_TOKEN!;
    this.apiSecret = process.env.JUMIO_API_SECRET!;
    
    if (!this.apiToken || !this.apiSecret) {
      throw new Error('JUMIO_API_TOKEN and JUMIO_API_SECRET environment variables are required');
    }

    // Use sandbox for testing, production for live
    this.baseUrl = process.env.JUMIO_ENVIRONMENT === 'production' 
      ? 'https://netverify.com' 
      : 'https://netverify.com';

    this.axios = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Starling Remittance API/1.0',
      },
      auth: {
        username: this.apiToken,
        password: this.apiSecret,
      },
    });

    console.log('🆔 Jumio KYC service initialized');
  }

  // Initiate KYC verification session
  async initiateVerification(request: JumioInitiateRequest): Promise<{
    scanReference: string;
    redirectUrl: string;
  }> {
    try {
      console.log(`🔍 Initiating KYC verification for ${request.customerInternalReference}`);

      const response = await this.axios.post('/api/netverify/v2/initiateNetverify', {
        customerInternalReference: request.customerInternalReference,
        userReference: request.userReference,
        reportingCriteria: request.reportingCriteria || 'Starling Remittance KYC',
        callbackUrl: request.callbackUrl || process.env.JUMIO_CALLBACK_URL,
        successUrl: request.successUrl,
        errorUrl: request.errorUrl,
        locale: request.locale || 'en',
        customerData: request.customerData,
        // Document types to verify
        enabledFields: 'idNumber,idFirstName,idLastName,idDob,idExpiry,idUsState,idPersonalNumber',
        // Allow ID verification
        authorizationTokenLifetime: 5184000, // 60 days
        // Enable identity verification (selfie match)
        enableIdentityVerification: true,
      });

      const result = {
        scanReference: response.data.scan.scanReference,
        redirectUrl: response.data.redirectUrl,
      };

      console.log('✅ KYC verification initiated:', result.scanReference);
      return result;
    } catch (error) {
      console.error('❌ Failed to initiate KYC verification:', error);
      throw new Error(`Jumio verification initiation failed: ${this.getErrorMessage(error)}`);
    }
  }

  // Get verification result
  async getVerificationResult(scanReference: string): Promise<JumioVerificationResult> {
    try {
      console.log(`📋 Retrieving verification result for ${scanReference}`);

      const response = await this.axios.get(`/api/netverify/v2/scans/${scanReference}`);
      
      const result: JumioVerificationResult = {
        scanReference: response.data.scanReference,
        verificationStatus: response.data.status,
        idScanStatus: response.data.idScanStatus,
        identityVerification: response.data.identityVerification ? {
          similarity: response.data.identityVerification.similarity,
          validity: response.data.identityVerification.validity,
          reason: response.data.identityVerification.reason,
        } : undefined,
        document: response.data.document ? {
          type: response.data.document.type,
          country: response.data.document.issuingCountry,
          firstName: response.data.document.firstName,
          lastName: response.data.document.lastName,
          dateOfBirth: response.data.document.dob,
          expiryDate: response.data.document.expiry,
          documentNumber: response.data.document.number,
          personalNumber: response.data.document.personalNumber,
        } : undefined,
        transaction: response.data.transaction ? {
          date: response.data.transaction.date,
          status: response.data.transaction.status,
          source: response.data.transaction.source,
        } : undefined,
      };

      console.log('✅ Verification result retrieved:', result.verificationStatus);
      return result;
    } catch (error) {
      console.error('❌ Failed to get verification result:', error);
      throw new Error(`Jumio result retrieval failed: ${this.getErrorMessage(error)}`);
    }
  }

  // Get document images (for compliance records)
  async getDocumentImages(scanReference: string): Promise<{
    front?: string; // Base64 encoded image
    back?: string;  // Base64 encoded image
    face?: string;  // Base64 encoded selfie
  }> {
    try {
      console.log(`📸 Retrieving document images for ${scanReference}`);

      const [frontResponse, backResponse, faceResponse] = await Promise.allSettled([
        this.axios.get(`/api/netverify/v2/scans/${scanReference}/images/front`, {
          responseType: 'arraybuffer',
        }),
        this.axios.get(`/api/netverify/v2/scans/${scanReference}/images/back`, {
          responseType: 'arraybuffer',
        }),
        this.axios.get(`/api/netverify/v2/scans/${scanReference}/images/face`, {
          responseType: 'arraybuffer',
        }),
      ]);

      const images: any = {};

      if (frontResponse.status === 'fulfilled') {
        images.front = Buffer.from(frontResponse.value.data).toString('base64');
      }

      if (backResponse.status === 'fulfilled') {
        images.back = Buffer.from(backResponse.value.data).toString('base64');
      }

      if (faceResponse.status === 'fulfilled') {
        images.face = Buffer.from(faceResponse.value.data).toString('base64');
      }

      console.log('✅ Document images retrieved');
      return images;
    } catch (error) {
      console.error('❌ Failed to retrieve document images:', error);
      throw new Error(`Document image retrieval failed: ${this.getErrorMessage(error)}`);
    }
  }

  // Validate webhook signature for security
  validateWebhook(payload: string, signature: string): JumioWebhookData {
    try {
      // Jumio uses HMAC-SHA256 for webhook validation
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', this.apiSecret)
        .update(payload)
        .digest('hex');

      if (signature !== expectedSignature) {
        throw new Error('Invalid webhook signature');
      }

      const webhookData: JumioWebhookData = JSON.parse(payload);
      console.log('✅ Valid webhook received:', webhookData.scanReference);
      
      return webhookData;
    } catch (error) {
      console.error('❌ Webhook validation failed:', error);
      throw new Error(`Webhook validation failed: ${this.getErrorMessage(error)}`);
    }
  }

  // Get verification statistics for compliance reporting
  async getVerificationStatistics(from: Date, to: Date): Promise<{
    totalVerifications: number;
    approvedVerifications: number;
    rejectedVerifications: number;
    pendingVerifications: number;
    fraudDetected: number;
  }> {
    try {
      console.log('📊 Retrieving verification statistics...');

      const response = await this.axios.get('/api/netverify/v2/scans', {
        params: {
          from: from.toISOString(),
          to: to.toISOString(),
        },
      });

      const scans = response.data.scans || [];
      
      const stats = {
        totalVerifications: scans.length,
        approvedVerifications: scans.filter((s: any) => s.status === 'APPROVED_VERIFIED').length,
        rejectedVerifications: scans.filter((s: any) => s.status.startsWith('DENIED')).length,
        pendingVerifications: scans.filter((s: any) => s.status === 'PENDING').length,
        fraudDetected: scans.filter((s: any) => s.status === 'DENIED_FRAUD').length,
      };

      console.log('✅ Verification statistics retrieved');
      return stats;
    } catch (error) {
      console.error('❌ Failed to get verification statistics:', error);
      throw new Error(`Statistics retrieval failed: ${this.getErrorMessage(error)}`);
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      // Simple ping to verify API connectivity
      await this.axios.get('/api/netverify/v2/account');
      return true;
    } catch (error) {
      console.error('❌ Jumio health check failed:', error);
      return false;
    }
  }

  private getErrorMessage(error: any): string {
    if (error.response?.data?.message) {
      return error.response.data.message;
    }
    if (error instanceof Error) return error.message;
    return String(error);
  }
}

export default JumioService; 