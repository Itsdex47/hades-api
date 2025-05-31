import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'Starling Remittance API',
    version: '0.1.0',
    environment: process.env.NODE_ENV
  });
});

// API Status
app.get('/api/status', (req, res) => {
  res.json({ 
    message: 'Starling Labs Remittance API is running! 🚀',
    version: '0.1.0',
    environment: process.env.NODE_ENV,
    features: {
      demoMode: process.env.ENABLE_DEMO_MODE === 'true',
      kycBypass: process.env.ENABLE_KYC_BYPASS === 'true'
    }
  });
});

// Payment Quote Endpoint (MVP)
app.post('/api/payments/quote', (req: express.Request, res: express.Response) => {
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
    
    res.json({
      quote: {
        quoteId: `quote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        inputAmount: amount,
        inputCurrency: fromCurrency,
        outputAmount: recipientAmount,
        outputCurrency: toCurrency,
        exchangeRate,
        fees: {
          starlingFee: parseFloat(starlingFee.toFixed(2)),
          blockchainFee,
          totalFees: parseFloat(totalFees.toFixed(2)),
          feePercentage: starlingFeePercent * 100
        },
        estimatedTime: '2-5 minutes',
        validUntil: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
        corridor: rateKey,
        complianceRequired: amount > 1000 // KYC required for amounts > $1000
      }
    });
    
  } catch (error) {
    console.error('Quote generation error:', error);
    res.status(500).json({ error: 'Failed to generate quote' });
  }
}) as express.RequestHandler);

// Supported Corridors
app.get('/api/corridors', (req, res) => {
  res.json({
    corridors: [
      {
        from: 'USD',
        to: 'MXN',
        country: 'Mexico',
        status: 'active',
        estimatedTime: '2-5 minutes',
        minAmount: 1,
        maxAmount: 10000
      },
      {
        from: 'USD',
        to: 'NGN',
        country: 'Nigeria',
        status: 'coming_soon',
        estimatedTime: '5-10 minutes',
        minAmount: 1,
        maxAmount: 5000
      },
      {
        from: 'GBP',
        to: 'NGN',
        country: 'Nigeria',
        status: 'coming_soon',
        estimatedTime: '5-10 minutes',
        minAmount: 1,
        maxAmount: 5000
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
    error: isDevelopment ? err.message : 'Internal server error',
    ...(isDevelopment && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    available_endpoints: [
      'GET /health',
      'GET /api/status',
      'POST /api/payments/quote',
      'GET /api/corridors'
    ]
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Starling Remittance API running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`💰 Payment quote: POST http://localhost:${PORT}/api/payments/quote`);
  console.log(`🌍 Corridors: GET http://localhost:${PORT}/api/corridors`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV}`);
});

export default app;