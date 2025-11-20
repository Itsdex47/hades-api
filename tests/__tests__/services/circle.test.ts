/**
 * Circle Service Tests
 * Tests for Circle API integration
 */

import { CircleService } from '../../../src/services/circle';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('CircleService', () => {
  let circleService: CircleService;
  let mockAxiosInstance: any;

  beforeEach(() => {
    // Setup mock axios instance
    mockAxiosInstance = {
      post: jest.fn(),
      get: jest.fn(),
    };

    mockedAxios.create = jest.fn().mockReturnValue(mockAxiosInstance);

    circleService = new CircleService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createWallet', () => {
    it('should successfully create a wallet', async () => {
      const mockWalletResponse = {
        data: {
          data: {
            walletId: 'wallet_123',
            entityId: 'entity_123',
            type: 'end_user_wallet',
            description: 'Test wallet',
            balances: [],
          },
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockWalletResponse);

      const result = await circleService.createWallet('user_123', 'Test wallet');

      expect(result).toHaveProperty('walletId', 'wallet_123');
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/v1/wallets',
        expect.objectContaining({
          description: 'Test wallet',
          idempotencyKey: expect.stringContaining('wallet_user_123'),
        })
      );
    });

    it('should handle wallet creation errors', async () => {
      const mockError = {
        response: {
          data: {
            message: 'Invalid API key',
          },
        },
      };

      mockAxiosInstance.post.mockRejectedValue(mockError);

      await expect(circleService.createWallet('user_123')).rejects.toThrow(
        'Circle wallet creation failed: Invalid API key'
      );
    });
  });

  describe('getWallet', () => {
    it('should retrieve wallet details', async () => {
      const mockWalletResponse = {
        data: {
          data: {
            walletId: 'wallet_123',
            balances: [
              { amount: '100.00', currency: 'USD' },
              { amount: '50.00', currency: 'USDC' },
            ],
          },
        },
      };

      mockAxiosInstance.get.mockResolvedValue(mockWalletResponse);

      const result = await circleService.getWallet('wallet_123');

      expect(result).toHaveProperty('walletId', 'wallet_123');
      expect(result.balances).toHaveLength(2);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/v1/wallets/wallet_123');
    });

    it('should handle wallet not found error', async () => {
      const mockError = {
        response: {
          data: {
            message: 'Wallet not found',
          },
        },
      };

      mockAxiosInstance.get.mockRejectedValue(mockError);

      await expect(circleService.getWallet('invalid_wallet')).rejects.toThrow(
        'Circle wallet fetch failed: Wallet not found'
      );
    });
  });

  describe('createUSDCDeposit', () => {
    it('should create a USDC deposit successfully', async () => {
      const mockPaymentResponse = {
        data: {
          data: {
            id: 'payment_123',
            status: 'pending',
            amount: {
              amount: '100.00',
              currency: 'USD',
            },
          },
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockPaymentResponse);

      const request = {
        amount: {
          amount: '100.00',
          currency: 'USD',
        },
        source: {
          id: 'source_123',
          type: 'card' as const,
        },
        description: 'Test deposit',
        idempotencyKey: 'idem_123',
      };

      const result = await circleService.createUSDCDeposit(request);

      expect(result).toHaveProperty('id', 'payment_123');
      expect(result).toHaveProperty('status', 'pending');
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/v1/payments', request);
    });
  });

  describe('transferToBlockchain', () => {
    it('should initiate blockchain transfer successfully', async () => {
      const mockTransferResponse = {
        data: {
          data: {
            id: 'transfer_123',
            status: 'pending',
          },
        },
      };

      mockAxiosInstance.post.mockResolvedValue(mockTransferResponse);

      const request = {
        source: {
          type: 'wallet' as const,
          id: 'wallet_123',
        },
        destination: {
          type: 'blockchain' as const,
          address: 'solana_address_123',
          chain: 'SOL' as const,
        },
        amount: {
          amount: '50.00',
          currency: 'USD' as const,
        },
        idempotencyKey: 'idem_transfer_123',
      };

      const result = await circleService.transferToBlockchain(request);

      expect(result).toHaveProperty('id', 'transfer_123');
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/v1/transfers', request);
    });
  });

  describe('healthCheck', () => {
    it('should return true when API is healthy', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          message: 'pong',
        },
      });

      const result = await circleService.healthCheck();

      expect(result).toBe(true);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/v1/ping');
    });

    it('should return false when API is unhealthy', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Network error'));

      const result = await circleService.healthCheck();

      expect(result).toBe(false);
    });
  });

  describe('generateIdempotencyKey', () => {
    it('should generate unique idempotency keys', () => {
      const key1 = circleService.generateIdempotencyKey('test');
      const key2 = circleService.generateIdempotencyKey('test');

      expect(key1).toMatch(/^test_\d+_[a-z0-9]+$/);
      expect(key2).toMatch(/^test_\d+_[a-z0-9]+$/);
      expect(key1).not.toBe(key2);
    });
  });
});
