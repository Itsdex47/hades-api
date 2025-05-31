import express from 'express';
import bcrypt from 'bcryptjs';
<<<<<<< HEAD
import jwt, { Secret, SignOptions } from 'jsonwebtoken';
=======
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
>>>>>>> 05d0a26c00f123f4426fa0bb5dc57f86337adce1
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

// User registration
router.post('/register', async (req: express.Request, res: express.Response) => {
  try {
    const { email, password, firstName, lastName, phone, address } = req.body;

    // Basic validation
    if (!email || !password || !firstName || !lastName) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    // Check if user already exists
    const existingUser = await supabaseService.getUserByEmail(email);
    if (existingUser) {
      res.status(409).json({ error: 'User already exists' });
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const userData = {
      email,
      firstName,
      lastName,
      phone,
      address,
      kycStatus: KYCStatus.NOT_STARTED,
      kycDocuments: [],
      isActive: true,
      riskLevel: 'low' as const
    };

    const user = await supabaseService.createUser(userData);

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      (process.env.JWT_SECRET || 'fallback_secret') as Secret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as SignOptions
    );

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
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// User login (placeholder - you'll implement proper password storage)
router.post('/login', async (req: express.Request, res: express.Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password required' });
      return;
    }

    // For demo purposes, allow login with any password for existing users
    // In production, you'd check against stored password hash
    const user = await supabaseService.getUserByEmail(email);
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

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