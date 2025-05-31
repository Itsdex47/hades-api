import express from 'express';
import PaymentProcessor from '../services/paymentProcessor';
import SupabaseService from '../services/supabase';
import { authenticateToken } from './auth';
import { Quote } from '../types/payment';

const router = express.Router();

// Debug logging
console.log('🔧 Loading payments routes...');

const paymentProcessor = new PaymentProcessor();
const supabaseService = new SupabaseService();

// Payment Quote Endpoint (saves to database)
router.post('/quote', async (req: express.Request, res: express.Response) => {
  console.log('📝 Quote endpoint hit');
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
      console.log('💾 Quote saved to database:', quote.quoteId);
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
router.get('/quote/:quoteId', async (req: express.Request, res: express.Response) => {
  console.log('🔍 Get quote endpoint hit');
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

// DEMO: Process a payment with auto-generated quote
router.post('/demo', authenticateToken, async (req: express.Request, res: express.Response) => {
  console.log('🎮 Demo endpoint hit!');
  try {
    const userId = (req as any).user.userId;
    const { 
      amount = 100,
      inputCurrency = 'USD',
      outputCurrency = 'MXN',
      recipientDetails,
      purpose = 'Demo payment',
      reference = 'Starling Labs Demo'
    } = req.body;

    // Validation for demo
    if (!recipientDetails || !recipientDetails.firstName || !recipientDetails.lastName) {
      res.status(400).json({ 
        success: false, 
        error: 'Recipient details (firstName, lastName) are required for demo' 
      });
      return;
    }

    console.log(`🎮 Processing DEMO payment for user ${userId}, amount: ${amount} ${inputCurrency}`);

    // Create a demo quote using the existing saveQuote method (correct schema)
    const exchangeRate = 18.50;
    const starlingFeePercent = 0.015;
    const starlingFee = amount * starlingFeePercent;
    const blockchainFee = 0.50;
    const totalFees = starlingFee + blockchainFee;
    const outputAmount = (amount - totalFees) * exchangeRate;

    const quoteId = `demo_quote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const demoQuote: Quote = {
      quoteId,
      inputAmount: amount,
      inputCurrency,
      outputAmount: parseFloat(outputAmount.toFixed(2)),
      outputCurrency,
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
      validUntil: new Date(Date.now() + 10 * 60 * 1000),
      corridor: 'US_TO_MEXICO',
      complianceRequired: false,
      createdAt: new Date()
    };

    // Save the demo quote using the existing saveQuote method (correct schema)
    await supabaseService.saveQuote(demoQuote);
    console.log(`✅ Demo quote saved: ${quoteId}`);

    // Add default bank account if not provided
    const defaultRecipientDetails = {
      ...recipientDetails,
      bankAccount: recipientDetails.bankAccount || {
        accountNumber: '123456789012',
        bankName: 'Banco Azteca',
        bankCode: 'AZTECA',
        accountType: 'checking'
      },
      address: recipientDetails.address || {
        street: '123 Reforma Avenue',
        city: 'Mexico City',
        state: 'CDMX',
        country: 'Mexico',
        postalCode: '06500'
      }
    };

    // Process the payment with the demo quote
    const payment = await paymentProcessor.processPayment({
      quoteId: quoteId,
      senderId: userId,
      recipientDetails: defaultRecipientDetails,
      purpose,
      reference
    });

    res.status(202).json({
      success: true,
      message: 'Demo payment processing initiated',
      data: {
        paymentId: payment.id,
        quoteId: quoteId,
        status: payment.status,
        amount: {
          input: amount,
          inputCurrency,
          output: outputAmount,
          outputCurrency,
          exchangeRate
        },
        fees: demoQuote.fees,
        recipient: {
          name: `${recipientDetails.firstName} ${recipientDetails.lastName}`,
          bank: defaultRecipientDetails.bankAccount.bankName
        },
        estimatedCompletionTime: payment.estimatedCompletionTime,
        steps: payment.steps,
        trackingReference: payment.id,
        demo: true
      }
    });

  } catch (error) {
    console.error('Demo payment processing error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ 
      success: false, 
      error: 'Demo payment processing failed',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    });
  }
});

// Process a payment (initiate the payment pipeline)
router.post('/process', authenticateToken, async (req: express.Request, res: express.Response) => {
  console.log('🔄 Process payment endpoint hit');
  try {
    const userId = (req as any).user.userId;
    const { 
      quoteId, 
      recipientDetails, 
      purpose, 
      reference 
    } = req.body;

    // Validation
    if (!quoteId) {
      res.status(400).json({ 
        success: false, 
        error: 'Quote ID is required' 
      });
      return;
    }

    if (!recipientDetails || !recipientDetails.firstName || !recipientDetails.lastName) {
      res.status(400).json({ 
        success: false, 
        error: 'Recipient details (firstName, lastName) are required' 
      });
      return;
    }

    if (!recipientDetails.bankAccount || !recipientDetails.bankAccount.accountNumber) {
      res.status(400).json({ 
        success: false, 
        error: 'Recipient bank account details are required' 
      });
      return;
    }

    console.log(`💳 Processing payment for user ${userId}, quote ${quoteId}`);

    // Process the payment
    const payment = await paymentProcessor.processPayment({
      quoteId,
      senderId: userId,
      recipientDetails,
      purpose,
      reference
    });

    res.status(202).json({
      success: true,
      message: 'Payment processing initiated',
      data: {
        paymentId: payment.id,
        status: payment.status,
        estimatedCompletionTime: payment.estimatedCompletionTime,
        steps: payment.steps,
        trackingReference: payment.id
      }
    });

  } catch (error) {
    console.error('Payment processing error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ 
      success: false, 
      error: 'Payment processing failed',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    });
  }
});

// Get payment status
router.get('/status/:paymentId', authenticateToken, async (req: express.Request, res: express.Response) => {
  console.log('📊 Status endpoint hit');
  try {
    const userId = (req as any).user.userId;
    const { paymentId } = req.params;

    const payment = await paymentProcessor.getPaymentStatus(paymentId);

    if (!payment) {
      res.status(404).json({ 
        success: false, 
        error: 'Payment not found' 
      });
      return;
    }

    // Check if user owns this payment
    if (payment.request.senderId !== userId) {
      res.status(403).json({ 
        success: false, 
        error: 'Access denied' 
      });
      return;
    }

    // Calculate progress percentage
    const totalSteps = 7; // Based on our payment flow
    const completedSteps = payment.steps.filter(step => step.status === 'completed').length;
    const progressPercentage = Math.round((completedSteps / totalSteps) * 100);

    res.json({
      success: true,
      data: {
        paymentId: payment.id,
        status: payment.status,
        progress: {
          percentage: progressPercentage,
          currentStep: payment.steps.length > 0 ? payment.steps[payment.steps.length - 1].stepName : 'initiate',
          completedSteps,
          totalSteps
        },
        amount: {
          input: payment.request.amountUSD,
          inputCurrency: payment.request.fromCurrency,
          output: payment.fees.totalFeeUSD ? payment.request.amountUSD - payment.fees.totalFeeUSD : 0,
          outputCurrency: payment.request.toCurrency
        },
        recipient: {
          name: `${payment.request.recipientDetails.firstName} ${payment.request.recipientDetails.lastName}`,
          bank: payment.request.recipientDetails.bankAccount.bankName
        },
        timeline: payment.steps.map(step => ({
          step: step.stepName,
          status: step.status,
          timestamp: step.timestamp,
          details: step.details,
          transactionHash: step.transactionHash
        })),
        fees: payment.fees,
        createdAt: payment.createdAt,
        completedAt: payment.completedAt,
        estimatedCompletionTime: payment.estimatedCompletionTime
      }
    });

  } catch (error) {
    console.error('Get payment status error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get payment status' 
    });
  }
});

// Get user's payment history
router.get('/history', authenticateToken, async (req: express.Request, res: express.Response) => {
  console.log('📚 History endpoint hit');
  try {
    const userId = (req as any).user.userId;
    const payments = await paymentProcessor.getUserPayments(userId);

    const paymentHistory = payments.map(payment => ({
      paymentId: payment.id,
      status: payment.status,
      amount: {
        input: payment.request.amountUSD,
        inputCurrency: payment.request.fromCurrency,
        output: payment.fees.totalFeeUSD ? payment.request.amountUSD - payment.fees.totalFeeUSD : 0,
        outputCurrency: payment.request.toCurrency
      },
      recipient: {
        name: `${payment.request.recipientDetails.firstName} ${payment.request.recipientDetails.lastName}`,
        bank: payment.request.recipientDetails.bankAccount.bankName
      },
      createdAt: payment.createdAt,
      completedAt: payment.completedAt,
      purpose: payment.request.purpose,
      reference: payment.request.reference
    }));

    res.json({
      success: true,
      data: {
        payments: paymentHistory,
        totalCount: payments.length,
        summary: {
          totalSent: payments.reduce((sum, p) => sum + p.request.amountUSD, 0),
          completed: payments.filter(p => p.status === 'completed').length,
          pending: payments.filter(p => ['processing', 'blockchain_pending', 'converting', 'settling'].includes(p.status)).length,
          failed: payments.filter(p => p.status === 'failed').length
        }
      }
    });

  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get payment history' 
    });
  }
});

// Cancel a payment (only if still in early stages)
router.post('/cancel/:paymentId', authenticateToken, async (req: express.Request, res: express.Response) => {
  console.log('❌ Cancel endpoint hit');
  try {
    const userId = (req as any).user.userId;
    const { paymentId } = req.params;

    const payment = await paymentProcessor.getPaymentStatus(paymentId);

    if (!payment) {
      res.status(404).json({ 
        success: false, 
        error: 'Payment not found' 
      });
      return;
    }

    // Check if user owns this payment
    if (payment.request.senderId !== userId) {
      res.status(403).json({ 
        success: false, 
        error: 'Access denied' 
      });
      return;
    }

    // Check if payment can be cancelled
    const cancellableStatuses = ['created', 'kyc_pending', 'compliance_review'];
    if (!cancellableStatuses.includes(payment.status)) {
      res.status(400).json({ 
        success: false, 
        error: 'Payment cannot be cancelled at this stage' 
      });
      return;
    }

    // In a real implementation, you would:
    // 1. Stop the async processing
    // 2. Refund any deposited funds
    // 3. Update payment status to cancelled

    res.json({
      success: true,
      message: 'Payment cancellation initiated',
      data: {
        paymentId: payment.id,
        status: 'cancelling'
      }
    });

  } catch (error) {
    console.error('Cancel payment error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to cancel payment' 
    });
  }
});

// Get payment processor health check
router.get('/health', async (req: express.Request, res: express.Response) => {
  console.log('🏥 Health endpoint hit');
  try {
    const health = await paymentProcessor.healthCheck();
    
    const allHealthy = Object.values(health).every(status => status === true);
    
    res.status(allHealthy ? 200 : 503).json({
      success: allHealthy,
      services: {
        circle: health.circle ? 'connected' : 'disconnected',
        solana: health.solana ? 'connected' : 'disconnected',
        supabase: health.supabase ? 'connected' : 'disconnected'
      },
      status: allHealthy ? 'healthy' : 'degraded'
    });

  } catch (error) {
    console.error('Payment health check error:', error);
    res.status(503).json({ 
      success: false, 
      error: 'Payment services health check failed' 
    });
  }
});

console.log('✅ Payment routes loaded successfully');

export default router;