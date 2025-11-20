/**
 * Authentication Routes Tests
 * Tests for user registration, login, and JWT authentication
 */

import request from 'supertest';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import authRoutes from '../../../src/routes/auth';

// Mock the Supabase service
jest.mock('../../../src/services/supabase', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      createUser: jest.fn(),
      getUserByEmail: jest.fn(),
      updateUserKYCStatus: jest.fn(),
      healthCheck: jest.fn().mockResolvedValue(true),
    })),
  };
});

describe('Authentication Routes', () => {
  let app: express.Application;
  let mockSupabaseService: any;

  beforeEach(() => {
    // Create Express app for testing
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);

    // Get mocked Supabase service instance
    const SupabaseService = require('../../../src/services/supabase').default;
    mockSupabaseService = new SupabaseService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    const validRegistrationData = {
      email: 'test@example.com',
      password: 'password123',
      firstName: 'Test',
      lastName: 'User',
    };

    it('should successfully register a new user', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        kycStatus: 'not_started',
      };

      mockSupabaseService.getUserByEmail.mockResolvedValue(null);
      mockSupabaseService.createUser.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegistrationData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data.user.email).toBe('test@example.com');
    });

    it('should reject registration with missing fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Missing required fields');
    });

    it('should reject registration with short password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          ...validRegistrationData,
          password: 'short',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Password must be at least 8 characters');
    });

    it('should reject registration for existing user', async () => {
      mockSupabaseService.getUserByEmail.mockResolvedValue({
        id: '123',
        email: 'test@example.com',
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send(validRegistrationData);

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('error', 'User already exists');
    });

    it('should hash the password before storing', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        kycStatus: 'not_started',
      };

      mockSupabaseService.getUserByEmail.mockResolvedValue(null);
      mockSupabaseService.createUser.mockResolvedValue(mockUser);

      await request(app)
        .post('/api/auth/register')
        .send(validRegistrationData);

      expect(mockSupabaseService.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          passwordHash: expect.any(String),
        })
      );

      const call = mockSupabaseService.createUser.mock.calls[0][0];
      expect(call.passwordHash).not.toBe('password123'); // Should be hashed
    });
  });

  describe('POST /api/auth/login', () => {
    it('should successfully login with correct credentials', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        kycStatus: 'approved',
        riskLevel: 'low',
        passwordHash: hashedPassword,
      };

      mockSupabaseService.getUserByEmail.mockResolvedValue(mockUser);
      mockSupabaseService.updateUserKYCStatus.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data).toHaveProperty('token');

      // Verify JWT token is valid
      const decoded: any = jwt.verify(response.body.data.token, process.env.JWT_SECRET!);
      expect(decoded).toHaveProperty('userId', '123');
      expect(decoded).toHaveProperty('email', 'test@example.com');
    });

    it('should reject login with missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Email and password required');
    });

    it('should reject login for non-existent user', async () => {
      mockSupabaseService.getUserByEmail.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid credentials');
    });

    it('should reject login with incorrect password', async () => {
      const hashedPassword = await bcrypt.hash('correctpassword', 10);
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        passwordHash: hashedPassword,
      };

      mockSupabaseService.getUserByEmail.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid credentials');
    });

    it('should handle users without password hash', async () => {
      const mockUser = {
        id: '123',
        email: 'test@example.com',
        passwordHash: undefined,
      };

      mockSupabaseService.getUserByEmail.mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Account configuration error. Please contact support.');
    });
  });

  describe('GET /api/auth/debug', () => {
    it('should return debug information', async () => {
      mockSupabaseService.healthCheck.mockResolvedValue(true);

      const response = await request(app).get('/api/auth/debug');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('debug');
      expect(response.body.debug).toHaveProperty('supabaseHealthy');
      expect(response.body.debug).toHaveProperty('envVarsPresent');
    });
  });
});
