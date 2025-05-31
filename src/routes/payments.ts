import express from 'express';
import PaymentProcessor from '../services/paymentProcessor';
import { authenticateToken } from './auth';

const router = express.Router();
const paymentProcessor = new PaymentProcessor();

// Process a payment (initiate the payment pipeline)
router.post('/process', authenticateToken, async (req: express.Request, res: express.Response) => {
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
    res.status(500).json({ 
      success: false, 
      error: 'Payment processing failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get payment status
router.get('/status/:paymentId', authenticateToken, async (req: express.Request, res: express.Response) => {
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

export default router;