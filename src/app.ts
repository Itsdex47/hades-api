import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import authRoutes from './routes/auth';
import paymentsRoutes from './routes/payments';
import SupabaseService from './services/supabase';

// Force load .env file from project root
const envPath = path.join(process.cwd(), '.env');
console.log('🔧 Loading environment from:', envPath);
const envResult = dotenv.config({ path: envPath });

if (envResult.error) {
  console.error('❌ Failed to load .env file:', envResult.error.message);
  console.log('📁 Current working directory:', process.cwd());
  console.log('🔍 Looking for .env at:', envPath);
  process.exit(1);
} else {
  console.log('✅ Environment variables loaded successfully');
}

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize services with better error handling
let supabaseService: SupabaseService;
try {
  supabaseService = new SupabaseService();
  console.log('✅ Supabase service initialized');
} catch (error) {
  console.error('❌ Failed to initialize Supabase service:', error);
  process.exit(1);
}

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
app.use('/api/payments', paymentsRoutes);

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
      'POST /api/payments/process',
      'POST /api/payments/demo',
      'GET /api/payments/status/:paymentId',
      'GET /api/payments/history',
      'GET /api/payments/health',
      'GET /api/corridors'
    ]
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Starling Remittance API running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 User registration: POST http://localhost:${PORT}/api/auth/register`);
  console.log(`💰 Payment quote: POST http://localhost:${PORT}/api/payments/quote`);
  console.log(`🎮 Demo payment: POST http://localhost:${PORT}/api/payments/demo`);
  console.log(`🌍 Corridors: GET http://localhost:${PORT}/api/corridors`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV}`);
  console.log(`💾 Database: Supabase`);
});

export default app;