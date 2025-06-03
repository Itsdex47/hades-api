import axios, { AxiosInstance } from 'axios';

export interface AlchemyTransactionRequest {
  from: string;
  to: string;
  value?: string;
  gas?: string;
  gasPrice?: string;
  data?: string;
}

export interface AlchemyBlockchainMetrics {
  network: string;
  blockNumber: number;
  gasPrice: {
    slow: string;
    standard: string;
    fast: string;
    instant: string;
  };
  pendingTransactions: number;
  networkCongestion: 'low' | 'medium' | 'high';
}

export interface AlchemyTokenBalanceRequest {
  address: string;
  contractAddresses: string[];
}

export interface AlchemyTokenBalance {
  contractAddress: string;
  tokenBalance: string;
  name?: string;
  symbol?: string;
  decimals?: number;
}

export interface AlchemyTransactionReceipt {
  transactionHash: string;
  blockNumber: number;
  gasUsed: string;
  status: 'success' | 'failed';
  confirmations: number;
  timestamp: number;
  logs: any[];
}

export interface AlchemyNFTMetadata {
  contract: {
    address: string;
    name?: string;
    symbol?: string;
    totalSupply?: string;
    tokenType: 'ERC721' | 'ERC1155';
  };
  id: {
    tokenId: string;
    tokenMetadata?: {
      tokenType: string;
    };
  };
  title: string;
  description?: string;
  tokenUri?: {
    raw: string;
    gateway: string;
  };
  media?: Array<{
    raw: string;
    gateway: string;
    thumbnail?: string;
    format?: string;
    bytes?: number;
  }>;
  metadata?: any;
}

export class AlchemyService {
  private axios: AxiosInstance;
  private apiKey: string;
  private baseUrl: string;
  private network: string;

  constructor() {
    this.apiKey = process.env.ALCHEMY_API_KEY!;
    this.network = process.env.ALCHEMY_NETWORK || 'eth-mainnet';
    
    if (!this.apiKey) {
      throw new Error('ALCHEMY_API_KEY environment variable is required');
    }

    this.baseUrl = `https://${this.network}.g.alchemy.com/v2/${this.apiKey}`;

    this.axios = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Starling Remittance API/1.0',
      },
    });

    console.log(`⚡ Alchemy service initialized for ${this.network}`);
  }

  // Enhanced gas estimation for optimal transaction costs
  async getOptimalGasPrice(): Promise<AlchemyBlockchainMetrics['gasPrice']> {
    try {
      console.log('⛽ Getting optimal gas prices...');

      const response = await this.axios.post('', {
        jsonrpc: '2.0',
        method: 'eth_gasPrice',
        params: [],
        id: 1,
      });

      const currentGasPrice = parseInt(response.data.result, 16);

      // Calculate different priority levels
      const gasPrices = {
        slow: (currentGasPrice * 0.8).toString(),
        standard: currentGasPrice.toString(),
        fast: (currentGasPrice * 1.2).toString(),
        instant: (currentGasPrice * 1.5).toString(),
      };

      console.log('✅ Gas prices retrieved');
      return gasPrices;
    } catch (error) {
      console.error('❌ Failed to get gas prices:', error);
      throw new Error(`Gas price retrieval failed: ${this.getErrorMessage(error)}`);
    }
  }

  // Get comprehensive blockchain metrics
  async getBlockchainMetrics(): Promise<AlchemyBlockchainMetrics> {
    try {
      console.log('📊 Retrieving blockchain metrics...');

      const [blockResponse, gasPriceResponse, pendingResponse] = await Promise.all([
        this.axios.post('', {
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: [],
          id: 1,
        }),
        this.getOptimalGasPrice(),
        this.axios.post('', {
          jsonrpc: '2.0',
          method: 'txpool_status',
          params: [],
          id: 3,
        }).catch(() => ({ data: { result: { pending: '0x0' } } })), // Fallback
      ]);

      const blockNumber = parseInt(blockResponse.data.result, 16);
      const pendingTxs = parseInt(pendingResponse.data.result?.pending || '0x0', 16);

      // Determine network congestion based on pending transactions
      let networkCongestion: 'low' | 'medium' | 'high' = 'low';
      if (pendingTxs > 1000) networkCongestion = 'high';
      else if (pendingTxs > 500) networkCongestion = 'medium';

      const metrics: AlchemyBlockchainMetrics = {
        network: this.network,
        blockNumber,
        gasPrice: gasPriceResponse,
        pendingTransactions: pendingTxs,
        networkCongestion,
      };

      console.log('✅ Blockchain metrics retrieved');
      return metrics;
    } catch (error) {
      console.error('❌ Failed to get blockchain metrics:', error);
      throw new Error(`Blockchain metrics retrieval failed: ${this.getErrorMessage(error)}`);
    }
  }

  // Enhanced transaction monitoring with detailed receipts
  async getTransactionDetails(txHash: string): Promise<AlchemyTransactionReceipt> {
    try {
      console.log(`🔍 Getting transaction details for ${txHash.substring(0, 10)}...`);

      const [txResponse, receiptResponse, blockResponse] = await Promise.all([
        this.axios.post('', {
          jsonrpc: '2.0',
          method: 'eth_getTransactionByHash',
          params: [txHash],
          id: 1,
        }),
        this.axios.post('', {
          jsonrpc: '2.0',
          method: 'eth_getTransactionReceipt',
          params: [txHash],
          id: 2,
        }),
        this.axios.post('', {
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: [],
          id: 3,
        }),
      ]);

      const receipt = receiptResponse.data.result;
      const currentBlock = parseInt(blockResponse.data.result, 16);
      const txBlock = parseInt(receipt.blockNumber, 16);

      const details: AlchemyTransactionReceipt = {
        transactionHash: txHash,
        blockNumber: txBlock,
        gasUsed: receipt.gasUsed,
        status: receipt.status === '0x1' ? 'success' : 'failed',
        confirmations: currentBlock - txBlock,
        timestamp: Date.now(), // Would normally get from block
        logs: receipt.logs || [],
      };

      console.log(`✅ Transaction details retrieved. Status: ${details.status}`);
      return details;
    } catch (error) {
      console.error('❌ Failed to get transaction details:', error);
      throw new Error(`Transaction details retrieval failed: ${this.getErrorMessage(error)}`);
    }
  }

  // Batch token balance checking for efficiency
  async getTokenBalances(request: AlchemyTokenBalanceRequest): Promise<AlchemyTokenBalance[]> {
    try {
      console.log(`💰 Getting token balances for ${request.address.substring(0, 8)}...`);

      const balancePromises = request.contractAddresses.map(async (contractAddress) => {
        const response = await this.axios.post('', {
          jsonrpc: '2.0',
          method: 'alchemy_getTokenBalances',
          params: [request.address, [contractAddress]],
          id: 1,
        });

        const tokenData = response.data.result?.tokenBalances?.[0];
        return {
          contractAddress,
          tokenBalance: tokenData?.tokenBalance || '0x0',
          name: tokenData?.name,
          symbol: tokenData?.symbol,
          decimals: tokenData?.decimals,
        };
      });

      const balances = await Promise.all(balancePromises);

      console.log(`✅ Retrieved balances for ${balances.length} tokens`);
      return balances;
    } catch (error) {
      console.error('❌ Failed to get token balances:', error);
      throw new Error(`Token balance retrieval failed: ${this.getErrorMessage(error)}`);
    }
  }

  // Enhanced transaction simulation for better error handling
  async simulateTransaction(transaction: AlchemyTransactionRequest): Promise<{
    success: boolean;
    gasEstimate: string;
    gasPrice: string;
    totalCost: string;
    error?: string;
  }> {
    try {
      console.log('🧪 Simulating transaction...');

      const [gasEstimateResponse, gasPriceResponse] = await Promise.all([
        this.axios.post('', {
          jsonrpc: '2.0',
          method: 'eth_estimateGas',
          params: [transaction],
          id: 1,
        }),
        this.getOptimalGasPrice(),
      ]);

      const gasEstimate = gasEstimateResponse.data.result;
      const gasPrice = gasPriceResponse.standard;
      const totalCost = (parseInt(gasEstimate, 16) * parseInt(gasPrice)).toString();

      const result = {
        success: true,
        gasEstimate,
        gasPrice,
        totalCost,
      };

      console.log('✅ Transaction simulation completed successfully');
      return result;
    } catch (error) {
      console.error('❌ Transaction simulation failed:', error);
      
      const errorMessage = this.getErrorMessage(error);
      return {
        success: false,
        gasEstimate: '0x0',
        gasPrice: '0x0',
        totalCost: '0',
        error: errorMessage,
      };
    }
  }

  // Advanced webhook monitoring for real-time notifications
  async createWebhook(data: {
    webhookUrl: string;
    webhookType: 'MINED_TRANSACTION' | 'DROPPED_TRANSACTION' | 'ADDRESS_ACTIVITY';
    addresses?: string[];
    appId?: string;
  }): Promise<{ webhookId: string; status: string }> {
    try {
      console.log(`🔔 Creating webhook for ${data.webhookType}...`);

      const response = await this.axios.post('/webhook', {
        webhook_url: data.webhookUrl,
        webhook_type: data.webhookType,
        addresses: data.addresses,
        app_id: data.appId,
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      const result = {
        webhookId: response.data.data.id,
        status: response.data.data.status,
      };

      console.log(`✅ Webhook created: ${result.webhookId}`);
      return result;
    } catch (error) {
      console.error('❌ Failed to create webhook:', error);
      throw new Error(`Webhook creation failed: ${this.getErrorMessage(error)}`);
    }
  }

  // NFT metadata retrieval for comprehensive asset tracking
  async getNFTMetadata(contractAddress: string, tokenId: string): Promise<AlchemyNFTMetadata> {
    try {
      console.log(`🖼️ Getting NFT metadata for ${contractAddress}:${tokenId}...`);

      const response = await this.axios.get(`/getNFTMetadata`, {
        params: {
          contractAddress,
          tokenId,
          tokenType: 'erc721',
        },
      });

      const nftData = response.data;

      const metadata: AlchemyNFTMetadata = {
        contract: {
          address: nftData.contract.address,
          name: nftData.contract.name,
          symbol: nftData.contract.symbol,
          totalSupply: nftData.contract.totalSupply,
          tokenType: nftData.contract.tokenType || 'ERC721',
        },
        id: {
          tokenId: nftData.id.tokenId,
          tokenMetadata: nftData.id.tokenMetadata,
        },
        title: nftData.title,
        description: nftData.description,
        tokenUri: nftData.tokenUri,
        media: nftData.media,
        metadata: nftData.metadata,
      };

      console.log('✅ NFT metadata retrieved');
      return metadata;
    } catch (error) {
      console.error('❌ Failed to get NFT metadata:', error);
      throw new Error(`NFT metadata retrieval failed: ${this.getErrorMessage(error)}`);
    }
  }

  // Health check with comprehensive network status
  async healthCheck(): Promise<{
    status: boolean;
    network: string;
    blockNumber: number;
    latency: number;
  }> {
    const startTime = Date.now();
    
    try {
      const response = await this.axios.post('', {
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 1,
      });

      const latency = Date.now() - startTime;
      const blockNumber = parseInt(response.data.result, 16);

      return {
        status: true,
        network: this.network,
        blockNumber,
        latency,
      };
    } catch (error) {
      console.error('❌ Alchemy health check failed:', error);
      return {
        status: false,
        network: this.network,
        blockNumber: 0,
        latency: Date.now() - startTime,
      };
    }
  }

  private getErrorMessage(error: any): string {
    if (error.response?.data?.error?.message) {
      return error.response.data.error.message;
    }
    if (error.response?.data?.message) {
      return error.response.data.message;
    }
    if (error instanceof Error) return error.message;
    return String(error);
  }
}

export default AlchemyService; 