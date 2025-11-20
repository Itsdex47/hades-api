import express from 'express';
import bcrypt from 'bcryptjs';
import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import SupabaseService from '../services/supabase';
import { User, Currency, KYCStatus } from '../types/payment';

// Ensure environment variables are loaded
const envPath = path.join(process.cwd(), '.env');
dotenv.config({ path: envPath });

const router = express.Router();

// Initialize Supabase service with better error handling
let supabaseService: SupabaseService;
try {
  supabaseService = new SupabaseService();
} catch (error) {
  console.error('❌ Failed to initialize Supabase in auth routes:', error);
  throw error;
}

// Helper function to safely extract error message
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

// Helper function to safely extract error details
function getErrorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      name: error.name
    };
  }
  return {
    message: String(error),
    stack: undefined,
    name: 'UnknownError'
  };
}

// Debug endpoint to test Supabase connection
router.get('/debug', async (req: express.Request, res: express.Response) => {
  try {
    console.log('🔍 Testing Supabase connection...');
    const isHealthy = await supabaseService.healthCheck();
    console.log('✅ Supabase health check result:', isHealthy);
    
    res.json({
      success: true,
      debug: {
        supabaseHealthy: isHealthy,
        envVarsPresent: {
          SUPABASE_URL: !!process.env.SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
          JWT_SECRET: !!process.env.JWT_SECRET
        },
        envValues: {
          SUPABASE_URL: process.env.SUPABASE_URL ? process.env.SUPABASE_URL.substring(0, 30) + '...' : 'NOT SET',
          NODE_ENV: process.env.NODE_ENV
        }
      }
    });
  } catch (error) {
    console.error('🔍 Debug endpoint error:', error);
    const errorDetails = getErrorDetails(error);
    res.status(500).json({
      success: false,
      error: errorDetails.message,
      stack: errorDetails.stack
    });
  }
});

// User registration
router.post('/register', async (req: express.Request, res: express.Response) => {
  try {
    console.log('🟡 Registration attempt started...');
    console.log('📝 Request body:', { 
      email: req.body.email, 
      firstName: req.body.firstName, 
      lastName: req.body.lastName,
      hasPassword: !!req.body.password 
    });

    const { email, password, firstName, lastName, phone, address } = req.body;

    // Basic validation
    if (!email || !password || !firstName || !lastName) {
      console.log('❌ Missing required fields');
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    if (password.length < 8) {
      console.log('❌ Password too short');
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    console.log('🔍 Checking if user already exists...');
    
    // Check if user already exists
    try {
      const existingUser = await supabaseService.getUserByEmail(email);
      if (existingUser) {
        console.log('❌ User already exists');
        res.status(409).json({ error: 'User already exists' });
        return;
      }
      console.log('✅ User does not exist, proceeding...');
    } catch (checkError) {
      console.log('⚠️ Error checking existing user (this might be OK):', getErrorMessage(checkError));
      // Continue - this error might just mean user doesn't exist
    }

    console.log('🔐 Hashing password...');
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('✅ Password hashed successfully');

    // Create user
    const userData = {
      email,
      passwordHash: hashedPassword,
      firstName,
      lastName,
      phone: phone || null,
      address: address || null,
      kycStatus: KYCStatus.NOT_STARTED,
      kycDocuments: [],
      isActive: true,
      riskLevel: 'low' as const
    };

    console.log('👤 Creating user with data:', { 
      email: userData.email, 
      firstName: userData.firstName, 
      lastName: userData.lastName,
      kycStatus: userData.kycStatus 
    });

    const user = await supabaseService.createUser(userData);
    console.log('✅ User created in database:', { id: user.id, email: user.email });

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      (process.env.JWT_SECRET || 'fallback_secret') as Secret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as SignOptions
    );
    console.log('🎫 JWT token generated');

    console.log('✅ User registered successfully:', user.email);

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          kycStatus: user.kycStatus
        },
        token
      }
    });

  } catch (error) {
    const errorDetails = getErrorDetails(error);
    console.error('❌ Registration error details:', errorDetails);
    
    res.status(500).json({ 
      error: 'Registration failed',
      details: process.env.NODE_ENV === 'development' ? errorDetails.message : 'Internal server error'
    });
  }
});

// User login
router.post('/login', async (req: express.Request, res: express.Response) => {
  try {
    console.log('🔐 Login attempt started...');
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password required' });
      return;
    }

    // Get user from database (includes password hash)
    const user = await supabaseService.getUserByEmail(email);
    if (!user) {
      console.log('❌ User not found:', email);
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // Verify password
    if (!user.passwordHash) {
      console.error('❌ User has no password hash stored:', email);
      res.status(500).json({ error: 'Account configuration error. Please contact support.' });
      return;
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      console.log('❌ Invalid password for user:', email);
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    console.log('✅ Password verified successfully');

    // Update last login timestamp
    await supabaseService.updateUserKYCStatus(user.id, user.kycStatus); // Using this as a placeholder until we add updateLastLogin

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      (process.env.JWT_SECRET || 'fallback_secret') as Secret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as SignOptions
    );

    console.log('✅ User logged in successfully:', user.email);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          kycStatus: user.kycStatus,
          riskLevel: user.riskLevel
        },
        token
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get user profile
router.get('/profile', authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const userId = (req as any).user.userId;
    const user = await supabaseService.getUserById(userId);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          address: user.address,
          kycStatus: user.kycStatus,
          riskLevel: user.riskLevel,
          isActive: user.isActive,
          createdAt: user.createdAt
        }
      }
    });

  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update KYC status (admin endpoint)
router.patch('/kyc-status', authenticateToken, async (req: express.Request, res: express.Response) => {
  try {
    const userId = (req as any).user.userId;
    const { kycStatus } = req.body;

    if (!kycStatus || !Object.values(KYCStatus).includes(kycStatus)) {
      res.status(400).json({ error: 'Invalid KYC status' });
      return;
    }

    await supabaseService.updateUserKYCStatus(userId, kycStatus);

    res.json({
      success: true,
      message: 'KYC status updated successfully'
    });

  } catch (error) {
    console.error('KYC update error:', error);
    res.status(500).json({ error: 'Failed to update KYC status' });
  }
});

// Middleware to authenticate JWT tokens
function authenticateToken(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret', (err: any, user: any) => {
    if (err) {
      res.status(403).json({ error: 'Invalid or expired token' });
      return;
    }
    (req as any).user = user;
    next();
  });
}

export { authenticateToken };
export default router;