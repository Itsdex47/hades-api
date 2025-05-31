import dotenv from 'dotenv';
import SolanaService from '../src/services/solana';

dotenv.config();

async function checkBalance() {
  console.log('💰 Checking wallet balances...');
  
  const walletAddress = process.argv[2];
  
  if (!walletAddress) {
    console.log('❌ Please provide a wallet address');
    console.log('Usage: npm run check-balance <wallet-address>');
    process.exit(1);
  }
  
  try {
    const solanaService = new SolanaService();
    
    console.log(`🔍 Checking balances for: ${walletAddress}`);
    console.log('');
    
    // Check SOL balance
    const solBalance = await solanaService.getBalance(walletAddress);
    console.log(`⚡ SOL Balance: ${solBalance.toFixed(4)} SOL`);
    
    // Check USDC balance
    const usdcBalance = await solanaService.getUSDCBalance(walletAddress);
    console.log(`🪙 USDC Balance: ${usdcBalance.toFixed(2)} USDC`);
    
    console.log('');
    
    if (solBalance < 0.01) {
      console.log('⚠️  Low SOL balance - you may need SOL for transaction fees');
      console.log('   Get devnet SOL: https://faucet.solana.com/');
    }
    
    if (usdcBalance === 0) {
      console.log('ℹ️  No USDC balance - you may need USDC for testing payments');
      console.log('   Get devnet USDC from Circle sandbox or Solana token faucet');
    }
    
  } catch (error) {
    console.error('❌ Error checking balance:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  checkBalance();
}

export { checkBalance };