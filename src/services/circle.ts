import axios from 'axios';

export interface CirclePaymentRequest {
  amount: {
    amount: string;
    currency: string;
  };
  source: {
    id: string;
    type: 'card' | 'ach' | 'wire';
  };
  description: string;
  idempotencyKey: string;
}

export interface CirclePaymentResponse {
  id: string;
  status: 'pending' | 'confirmed' | 'paid' | 'failed';
  amount: {
    amount: string;
    currency: string;
  };
  fees: {
    amount: string;
    currency: string;
  };
  createDate: string;
  updateDate: string;
  trackingRef: string;
}

export interface CircleTransferRequest {
  source: {
    type: 'wallet';
    id: string;
  };
  destination: {
    type: 'blockchain';
    address: string;
    chain: 'SOL';
  };
  amount: {
    amount: string;
    currency: 'USD';
  };
  idempotencyKey: string;
}

export interface CircleWallet {
  walletId: string;
  entityId: string;
  type: 'end_user_wallet';
  description: string;
  balances: Array<{
    amount: string;
    currency: string;
  }>;
}

export class CircleService {
  private apiKey: string;
  private baseUrl: string;
  private axios: any;

  constructor() {
    this.apiKey = process.env.CIRCLE_API_KEY || '';
    this.baseUrl = process.env.CIRCLE_ENVIRONMENT === 'production' 
      ? 'https://api.circle.com' 
      : 'https://api-sandbox.circle.com';
    
    if (!this.apiKey) {
      throw new Error('Circle API key is required. Set CIRCLE_API_KEY in your environment variables.');
    }

    this.axios = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    console.log(`🟡 Circle API initialized in ${process.env.CIRCLE_ENVIRONMENT || 'sandbox'} mode`);
  }

  // Create a wallet for a user
  async createWallet(userId: string, description?: string): Promise<CircleWallet> {
    try {
      const response = await this.axios.post('/v1/wallets', {
        idempotencyKey: `wallet_${userId}_${Date.now()}`,
        description: description || `Wallet for user ${userId}`,
      });

      console.log('✅ Circle wallet created:', response.data.data.walletId);
      return response.data.data;
    } catch (error) {
      console.error('❌ Failed to create Circle wallet:', error);
      throw new Error(`Circle wallet creation failed: ${this.getErrorMessage(error)}`);
    }
  }

  // Get wallet details and balance
  async getWallet(walletId: string): Promise<CircleWallet> {
    try {
      const response = await this.axios.get(`/v1/wallets/${walletId}`);
      return response.data.data;
    } catch (error) {
      console.error('❌ Failed to get Circle wallet:', error);
      throw new Error(`Circle wallet fetch failed: ${this.getErrorMessage(error)}`);
    }
  }

  // Convert USD to USDC (deposit)
  async createUSDCDeposit(request: CirclePaymentRequest): Promise<CirclePaymentResponse> {
    try {
      console.log('🔄 Creating USDC deposit via Circle...');
      const response = await this.axios.post('/v1/payments', request);
      
      console.log('✅ USDC deposit created:', response.data.data.id);
      return response.data.data;
    } catch (error) {
      console.error('❌ Failed to create USDC deposit:', error);
      throw new Error(`Circle USDC deposit failed: ${this.getErrorMessage(error)}`);
    }
  }

  // Transfer USDC from Circle wallet to external blockchain address
  async transferToBlockchain(request: CircleTransferRequest): Promise<any> {
    try {
      console.log('🔄 Transferring USDC to blockchain address...');
      const response = await this.axios.post('/v1/transfers', request);
      
      console.log('✅ Blockchain transfer initiated:', response.data.data.id);
      return response.data.data;
    } catch (error) {
      console.error('❌ Failed to transfer to blockchain:', error);
      throw new Error(`Circle blockchain transfer failed: ${this.getErrorMessage(error)}`);
    }
  }

  // Get payment status
  async getPayment(paymentId: string): Promise<CirclePaymentResponse> {
    try {
      const response = await this.axios.get(`/v1/payments/${paymentId}`);
      return response.data.data;
    } catch (error) {
      console.error('❌ Failed to get payment status:', error);
      throw new Error(`Circle payment fetch failed: ${this.getErrorMessage(error)}`);
    }
  }

  // Get transfer status
  async getTransfer(transferId: string): Promise<any> {
    try {
      const response = await this.axios.get(`/v1/transfers/${transferId}`);
      return response.data.data;
    } catch (error) {
      console.error('❌ Failed to get transfer status:', error);
      throw new Error(`Circle transfer fetch failed: ${this.getErrorMessage(error)}`);
    }
  }

  // Convert USDC back to USD (for off-ramping in destination country)
  async createUSDWithdrawal(walletId: string, amount: string, bankAccountId: string): Promise<any> {
    try {
      console.log('🔄 Creating USD withdrawal from USDC...');
      const response = await this.axios.post('/v1/transfers', {
        idempotencyKey: `withdrawal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        source: {
          type: 'wallet',
          id: walletId,
        },
        destination: {
          type: 'ach',
          id: bankAccountId,
        },
        amount: {
          amount,
          currency: 'USD',
        },
      });

      console.log('✅ USD withdrawal initiated:', response.data.data.id);
      return response.data.data;
    } catch (error) {
      console.error('❌ Failed to create USD withdrawal:', error);
      throw new Error(`Circle USD withdrawal failed: ${this.getErrorMessage(error)}`);
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.axios.get('/v1/ping');
      return response.data.message === 'pong';
    } catch (error) {
      console.error('❌ Circle health check failed:', error);
      return false;
    }
  }

  // Helper method to extract error messages
  private getErrorMessage(error: any): string {
    if (error.response?.data?.message) {
      return error.response.data.message;
    }
    if (error.response?.data?.error?.message) {
      return error.response.data.error.message;
    }
    if (error.message) {
      return error.message;
    }
    return 'Unknown Circle API error';
  }

  // Generate idempotency key
  generateIdempotencyKey(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default CircleService;