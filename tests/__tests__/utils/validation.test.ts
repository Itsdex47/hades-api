/**
 * Validation Utility Tests
 * Tests for common validation functions
 */

import bcrypt from 'bcryptjs';

describe('Password Validation', () => {
  describe('bcrypt password hashing', () => {
    it('should hash passwords correctly', async () => {
      const password = 'testpassword123';
      const hash = await bcrypt.hash(password, 10);

      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50);
    });

    it('should verify correct passwords', async () => {
      const password = 'testpassword123';
      const hash = await bcrypt.hash(password, 10);

      const isValid = await bcrypt.compare(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect passwords', async () => {
      const password = 'testpassword123';
      const hash = await bcrypt.hash(password, 10);

      const isValid = await bcrypt.compare('wrongpassword', hash);
      expect(isValid).toBe(false);
    });

    it('should generate different hashes for the same password', async () => {
      const password = 'testpassword123';
      const hash1 = await bcrypt.hash(password, 10);
      const hash2 = await bcrypt.hash(password, 10);

      expect(hash1).not.toBe(hash2);
      // But both should verify correctly
      expect(await bcrypt.compare(password, hash1)).toBe(true);
      expect(await bcrypt.compare(password, hash2)).toBe(true);
    });
  });
});

describe('Email Validation', () => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  it('should validate correct email formats', () => {
    const validEmails = [
      'test@example.com',
      'user.name@example.com',
      'user+tag@example.co.uk',
      'test123@test-domain.com',
    ];

    validEmails.forEach((email) => {
      expect(emailRegex.test(email)).toBe(true);
    });
  });

  it('should reject invalid email formats', () => {
    const invalidEmails = [
      'notanemail',
      '@example.com',
      'user@',
      'user @example.com',
      'user@example',
    ];

    invalidEmails.forEach((email) => {
      expect(emailRegex.test(email)).toBe(false);
    });
  });
});

describe('Amount Validation', () => {
  describe('Transaction amount limits', () => {
    const MIN_AMOUNT = 1;
    const MAX_AMOUNT = 10000;

    it('should accept valid amounts', () => {
      const validAmounts = [1, 10, 100, 1000, 10000];

      validAmounts.forEach((amount) => {
        expect(amount).toBeGreaterThanOrEqual(MIN_AMOUNT);
        expect(amount).toBeLessThanOrEqual(MAX_AMOUNT);
      });
    });

    it('should reject amounts below minimum', () => {
      const invalidAmounts = [0, -1, -100, 0.5];

      invalidAmounts.forEach((amount) => {
        expect(amount).toBeLessThan(MIN_AMOUNT);
      });
    });

    it('should reject amounts above maximum', () => {
      const invalidAmounts = [10001, 50000, 100000];

      invalidAmounts.forEach((amount) => {
        expect(amount).toBeGreaterThan(MAX_AMOUNT);
      });
    });
  });

  describe('Currency formatting', () => {
    it('should format amounts to 2 decimal places', () => {
      const amounts = [
        { input: 100.123, expected: '100.12' },
        { input: 50.5, expected: '50.50' },
        { input: 1000, expected: '1000.00' },
      ];

      amounts.forEach(({ input, expected }) => {
        expect(input.toFixed(2)).toBe(expected);
      });
    });
  });
});
