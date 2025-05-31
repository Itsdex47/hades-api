import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import SupabaseService from './services/supabase';
import { Quote } from './types/payment';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize services
const supabaseService = new SupabaseService();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/api/auth', authRoutes);

// Health check (now includes database check)
app.get('/health', async (req, res) => {
  try {
    const dbHealthy = await supabaseService.healthCheck();
    
    res.json({ 
      status: dbHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      service: 'Starling Remittance API',
      version: '0.1.0',
      environment: process.env.NODE_ENV,
      services: {
        database: dbHealthy ? 'connected' : 'disconnected',
        api: 'running'
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'Starling Remittance API',
      error: 'Database connection failed'
    });
  }
});

// API Status
app.get('/api/status', (req, res) => {
  res.json({ 
    message: 'Starling Labs Remittance API is running! 🚀',
    version: '0.1.0',
    environment: process.env.NODE_ENV,
    features: {
      demoMode: process.env.ENABLE_DEMO_MODE === 'true',
      kycBypass: process.env.ENABLE_KYC_BYPASS === 'true',
      database: 'connected'
    },
    endpoints: {
      auth: '/api/auth/*',
      payments: '/api/payments/*',
      corridors: '/api/corridors'
    }
  });
});

// Payment Quote Endpoint (now saves to database)
app.post('/api/payments/quote', async (req: express.Request, res: express.Response) => {
  try {
    const { amount, fromCurrency = 'USD', toCurrency = 'MXN', recipientCountry } = req.body;
    
    // Basic validation
    if (!amount || amount <= 0) {
      res.status(400).json({ error: 'Invalid amount' });
      return;
    }
    
    if (amount > (process.env.MAX_TRANSACTION_AMOUNT_USD ? parseInt(process.env.MAX_TRANSACTION_AMOUNT_USD) : 10000)) {
      res.status(400).json({ error: 'Amount exceeds maximum limit' });
      return;
    }
    
    // Simple quote calculation (you'll replace with real rates)
    const exchangeRates: Record<string, number> = {
      'USD-MXN': 18.5,
      'USD-NGN': 760,
      'USD-PHP': 56,
      'GBP-NGN': 950
    };
    
    const rateKey = `${fromCurrency}-${toCurrency}`;
    const exchangeRate = exchangeRates[rateKey] || 1;
    
    // Fee structure
    const starlingFeePercent = 0.015; // 1.5%
    const starlingFee = amount * starlingFeePercent;
    const blockchainFee = 0.01; // Very low on Solana
    const totalFees = starlingFee + blockchainFee;
    
    const amountAfterFees = amount - totalFees;
    const recipientAmount = parseFloat((amountAfterFees * exchangeRate).toFixed(2));
    
    const quoteId = `quote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const validUntil = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    
    // Create quote object
    const quote: Quote = {
      quoteId,
      inputAmount: amount,
      inputCurrency: fromCurrency,
      outputAmount: recipientAmount,
      outputCurrency: toCurrency,
      exchangeRate,
      fees: {
        starlingFee: parseFloat(starlingFee.toFixed(2)),
        starlingFeePercent,
        blockchainFee,
        fxSpread: 0,
        partnerFee: 0,
        totalFeeUSD: parseFloat(totalFees.toFixed(2))
      },
      estimatedTime: '2-5 minutes',
      validUntil,
      corridor: rateKey,
      complianceRequired: amount > 1000, // KYC required for amounts > $1000
      createdAt: new Date()
    };
    
    // Save quote to database
    try {
      await supabaseService.saveQuote(quote);
    } catch (dbError) {
      console.error('Failed to save quote to database:', dbError);
      // Continue without failing the request - quote generation is more important
    }
    
    res.json({
      success: true,
      quote: {
        quoteId: quote.quoteId,
        inputAmount: quote.inputAmount,
        inputCurrency: quote.inputCurrency,
        outputAmount: quote.outputAmount,
        outputCurrency: quote.outputCurrency,
        exchangeRate: quote.exchangeRate,
        fees: {
          starlingFee: quote.fees.starlingFee,
          blockchainFee: quote.fees.blockchainFee,
          totalFees: quote.fees.totalFeeUSD,
          feePercentage: starlingFeePercent * 100
        },
        estimatedTime: quote.estimatedTime,
        validUntil: quote.validUntil.toISOString(),
        corridor: quote.corridor,
        complianceRequired: quote.complianceRequired
      }
    });
    
  } catch (error) {
    console.error('Quote generation error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to generate quote' 
    });
  }
});

// Get quote by ID
app.get('/api/payments/quote/:quoteId', async (req: express.Request, res: express.Response) => {
  try {
    const { quoteId } = req.params;
    
    const quote = await supabaseService.getQuoteById(quoteId);
    
    if (!quote) {
      res.status(404).json({ 
        success: false,
        error: 'Quote not found or expired' 
      });
      return;
    }
    
    // Check if quote is still valid
    if (new Date() > quote.validUntil) {
      res.status(410).json({ 
        success: false,
        error: 'Quote has expired' 
      });
      return;
    }
    
    res.json({
      success: true,
      quote: {
        quoteId: quote.quoteId,
        inputAmount: quote.inputAmount,
        inputCurrency: quote.inputCurrency,
        outputAmount: quote.outputAmount,
        outputCurrency: quote.outputCurrency,
        exchangeRate: quote.exchangeRate,
        fees: quote.fees,
        estimatedTime: quote.estimatedTime,
        validUntil: quote.validUntil.toISOString(),
        corridor: quote.corridor,
        complianceRequired: quote.complianceRequired
      }
    });
    
  } catch (error) {
    console.error('Quote fetch error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch quote' 
    });
  }
});

// Supported Corridors
app.get('/api/corridors', (req, res) => {
  res.json({
    success: true,
    corridors: [
      {
        from: 'USD',
        to: 'MXN',
        country: 'Mexico',
        status: 'active',
        estimatedTime: '2-5 minutes',
        minAmount: 1,
        maxAmount: 10000,
        feePercentage: 1.5
      },
      {
        from: 'USD',
        to: 'NGN',
        country: 'Nigeria',
        status: 'coming_soon',
        estimatedTime: '5-10 minutes',
        minAmount: 1,
        maxAmount: 5000,
        feePercentage: 2.0
      },
      {
        from: 'GBP',
        to: 'NGN',
        country: 'Nigeria',
        status: 'coming_soon',
        estimatedTime: '5-10 minutes',
        minAmount: 1,
        maxAmount: 5000,
        feePercentage: 2.0
      }
    ]
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('API Error:', err.stack);
  
  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({ 
    success: false,
    error: isDevelopment ? err.message : 'Internal server error',
    ...(isDevelopment && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    error: 'Endpoint not found',
    available_endpoints: [
      'GET /health',
      'GET /api/status',
      'POST /api/auth/register',
      'POST /api/auth/login',
      'GET /api/auth/profile',
      'POST /api/payments/quote',
      'GET /api/payments/quote/:quoteId',
      'GET /api/corridors'
    ]
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Starling Remittance API running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 User registration: POST http://localhost:${PORT}/api/auth/register`);
  console.log(`💰 Payment quote: POST http://localhost:${PORT}/api/payments/quote`);
  console.log(`🌍 Corridors: GET http://localhost:${PORT}/api/corridors`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV}`);
  console.log(`💾 Database: Supabase`);
});

export default app;