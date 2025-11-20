/**
 * Jest Test Setup
 * Global test configuration and mocks
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_for_testing_only';
process.env.JWT_EXPIRES_IN = '1h';

// Mock environment variables for services (prevent real API calls)
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test_supabase_key';
process.env.CIRCLE_API_KEY = 'test_circle_key';
process.env.CIRCLE_WALLET_ID = 'test_wallet_id';
process.env.CIRCLE_ENVIRONMENT = 'sandbox';
process.env.SOLANA_RPC_URL = 'https://api.devnet.solana.com';
process.env.SOLANA_PRIVATE_KEY = 'test_solana_key';
process.env.STRIPE_SECRET_KEY = 'sk_test_test_stripe_key';
process.env.ALCHEMY_API_KEY = 'test_alchemy_key';

// Increase timeout for integration tests
jest.setTimeout(30000);

// Suppress console logs during tests (optional)
global.console = {
  ...console,
  log: jest.fn(), // Suppress logs
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(), // Keep errors visible
};
