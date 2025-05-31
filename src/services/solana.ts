import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount,
  TokenAccountNotFoundError,
  TokenInvalidAccountOwnerError,
} from '@solana/spl-token';

export interface SolanaTransferRequest {
  fromWallet: string; // Private key or wallet address
  toAddress: string;
  amount: number; // Amount in USDC (decimals will be handled)
  memo?: string;
}

export interface SolanaTransferResult {
  signature: string;
  fromAddress: string;
  toAddress: string;
  amount: number;
  fee: number;
  blockTime?: number;
  slot?: number;
}

export class SolanaService {
  private connection: Connection;
  private usdcMintAddress: PublicKey;

  constructor() {
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    this.connection = new Connection(rpcUrl, 'confirmed');

    // USDC mint addresses
    this.usdcMintAddress = new PublicKey(
      process.env.SOLANA_USDC_MINT || 
      // Devnet USDC mint address
      'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr'
      // Mainnet USDC mint: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
    );

    console.log(`🟡 Solana service initialized`);
    console.log(`🔗 RPC URL: ${rpcUrl}`);
    console.log(`🪙 USDC Mint: ${this.usdcMintAddress.toString()}`);
  }

  // Get SOL balance
  async getBalance(address: string): Promise<number> {
    try {
      const publicKey = new PublicKey(address);
      const balance = await this.connection.getBalance(publicKey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      console.error('❌ Failed to get SOL balance:', error);
      throw new Error(`Failed to get balance: ${this.getErrorMessage(error)}`);
    }
  }

  // Get USDC token balance
  async getUSDCBalance(address: string): Promise<number> {
    try {
      const publicKey = new PublicKey(address);
      const tokenAccount = await getAssociatedTokenAddress(
        this.usdcMintAddress,
        publicKey
      );

      const accountInfo = await getAccount(this.connection, tokenAccount);
      // USDC has 6 decimal places
      return Number(accountInfo.amount) / Math.pow(10, 6);
    } catch (error) {
      if (error instanceof TokenAccountNotFoundError) {
        console.log('ℹ️ USDC token account not found, balance is 0');
        return 0;
      }
      console.error('❌ Failed to get USDC balance:', error);
      throw new Error(`Failed to get USDC balance: ${this.getErrorMessage(error)}`);
    }
  }

  // Transfer USDC between addresses
  async transferUSDC(request: SolanaTransferRequest): Promise<SolanaTransferResult> {
    try {
      console.log(`🔄 Initiating USDC transfer of ${request.amount} USDC`);
      console.log(`📤 From: ${request.fromWallet.substring(0, 8)}...`);
      console.log(`📥 To: ${request.toAddress}`);

      // Parse wallet private key
      const fromKeypair = this.parseWallet(request.fromWallet);
      const toPublicKey = new PublicKey(request.toAddress);

      // Get associated token accounts
      const fromTokenAccount = await getAssociatedTokenAddress(
        this.usdcMintAddress,
        fromKeypair.publicKey
      );

      const toTokenAccount = await getAssociatedTokenAddress(
        this.usdcMintAddress,
        toPublicKey
      );

      // Create transaction
      const transaction = new Transaction();

      // Check if recipient token account exists, create if not
      try {
        await getAccount(this.connection, toTokenAccount);
        console.log('✅ Recipient token account exists');
      } catch (error) {
        if (error instanceof TokenAccountNotFoundError) {
          console.log('🔧 Creating recipient token account...');
          const createAccountInstruction = createAssociatedTokenAccountInstruction(
            fromKeypair.publicKey, // payer
            toTokenAccount,
            toPublicKey, // owner
            this.usdcMintAddress
          );
          transaction.add(createAccountInstruction);
        } else {
          throw error;
        }
      }

      // Convert amount to proper decimals (USDC has 6 decimal places)
      const transferAmount = Math.floor(request.amount * Math.pow(10, 6));

      // Create transfer instruction
      const transferInstruction = createTransferInstruction(
        fromTokenAccount,
        toTokenAccount,
        fromKeypair.publicKey,
        transferAmount,
        [],
        TOKEN_PROGRAM_ID
      );

      transaction.add(transferInstruction);

      // Get recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromKeypair.publicKey;

      console.log('🔐 Signing and sending transaction...');
      
      // Send and confirm transaction
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [fromKeypair],
        { commitment: 'confirmed' }
      );

      // Get transaction details
      const transactionDetails = await this.connection.getTransaction(signature, {
        commitment: 'confirmed'
      });

      const fee = transactionDetails?.meta?.fee || 0;

      console.log('✅ USDC transfer completed!');
      console.log(`📋 Signature: ${signature}`);
      console.log(`💰 Amount: ${request.amount} USDC`);
      console.log(`⛽ Fee: ${fee / LAMPORTS_PER_SOL} SOL`);

      return {
        signature,
        fromAddress: fromKeypair.publicKey.toString(),
        toAddress: request.toAddress,
        amount: request.amount,
        fee: fee / LAMPORTS_PER_SOL,
        blockTime: transactionDetails?.blockTime || undefined,
        slot: transactionDetails?.slot || undefined,
      };

    } catch (error) {
      console.error('❌ USDC transfer failed:', error);
      throw new Error(`Solana USDC transfer failed: ${this.getErrorMessage(error)}`);
    }
  }

  // Generate a new wallet keypair
  generateWallet(): { publicKey: string; privateKey: string } {
    const keypair = Keypair.generate();
    return {
      publicKey: keypair.publicKey.toString(),
      privateKey: Buffer.from(keypair.secretKey).toString('base64'),
    };
  }

  // Get transaction status
  async getTransaction(signature: string): Promise<any> {
    try {
      const transaction = await this.connection.getTransaction(signature, {
        commitment: 'confirmed'
      });
      return transaction;
    } catch (error) {
      console.error('❌ Failed to get transaction:', error);
      throw new Error(`Failed to get transaction: ${this.getErrorMessage(error)}`);
    }
  }

  // Wait for transaction confirmation
  async waitForConfirmation(
    signature: string, 
    maxRetries: number = 30,
    retryDelay: number = 2000
  ): Promise<boolean> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const status = await this.connection.getSignatureStatus(signature);
        
        if (status.value?.confirmationStatus === 'confirmed' || 
            status.value?.confirmationStatus === 'finalized') {
          console.log(`✅ Transaction confirmed: ${signature}`);
          return true;
        }
        
        if (status.value?.err) {
          console.error(`❌ Transaction failed: ${signature}`, status.value.err);
          return false;
        }

        console.log(`⏳ Waiting for confirmation... (${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } catch (error) {
        console.error(`⚠️ Error checking transaction status:`, error);
      }
    }

    console.error(`❌ Transaction confirmation timeout: ${signature}`);
    return false;
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const slot = await this.connection.getSlot();
      return slot > 0;
    } catch (error) {
      console.error('❌ Solana health check failed:', error);
      return false;
    }
  }

  // Parse wallet private key from various formats
  private parseWallet(wallet: string): Keypair {
    try {
      if (wallet.length === 88) {
        // Base64 encoded private key
        const privateKeyBytes = Buffer.from(wallet, 'base64');
        return Keypair.fromSecretKey(privateKeyBytes);
      } else if (wallet.length === 128) {
        // Hex encoded private key
        const privateKeyBytes = Buffer.from(wallet, 'hex');
        return Keypair.fromSecretKey(privateKeyBytes);
      } else if (wallet.startsWith('[') && wallet.endsWith(']')) {
        // JSON array format
        const privateKeyArray = JSON.parse(wallet);
        return Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
      } else {
        // Try as comma-separated numbers
        const privateKeyArray = wallet.split(',').map(num => parseInt(num.trim()));
        return Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
      }
    } catch (error) {
      throw new Error(`Invalid wallet private key format: ${this.getErrorMessage(error)}`);
    }
  }

  // Helper method to extract error messages
  private getErrorMessage(error: any): string {
    if (error instanceof Error) return error.message;
    return String(error);
  }
}

export default SolanaService;