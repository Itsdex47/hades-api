/**
 * Comprehensive Webhook Management
 * Handles webhooks from all integrated payment and compliance services
 */

import express from 'express';
import crypto from 'crypto';
import logger from './logger';

interface ServiceDependencies {
  supabase: any;
  multiRail: any;
  compliance: any;
  monitoring: any;
}

/**
 * Setup webhook endpoints for all integrated services
 */
export function setupWebhooks(app: express.Express, services: ServiceDependencies): void {
  logger.info('🎣 Setting up webhook endpoints...');

  // Stripe webhooks
  app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
      const sig = req.headers['stripe-signature'] as string;
      
      if (!sig) {
        logger.warn('Stripe webhook: Missing signature');
        return res.status(400).send('Missing signature');
      }

      // Verify webhook signature
      const isValid = verifyStripeSignature(req.body, sig);
      if (!isValid) {
        logger.warn('Stripe webhook: Invalid signature');
        return res.status(400).send('Invalid signature');
      }

      const event = JSON.parse(req.body.toString());
      logger.info('Stripe webhook received', { type: event.type, id: event.id });

      await handleStripeWebhook(event, services);
      
      res.status(200).json({ received: true });
    } catch (error) {
      logger.error('Stripe webhook error:', error);
      res.status(500).send('Webhook error');
    }
  });

  // Circle webhooks
  app.post('/webhooks/circle', express.json(), async (req, res) => {
    try {
      const event = req.body;
      logger.info('Circle webhook received', { type: event.Type, id: event.Id });

      await handleCircleWebhook(event, services);
      
      res.status(200).json({ received: true });
    } catch (error) {
      logger.error('Circle webhook error:', error);
      res.status(500).send('Webhook error');
    }
  });

  // Jumio webhooks (KYC updates)
  app.post('/webhooks/jumio', express.json(), async (req, res) => {
    try {
      const sig = req.headers['x-jumio-signature'] as string;
      
      if (!sig) {
        logger.warn('Jumio webhook: Missing signature');
        return res.status(400).send('Missing signature');
      }

      // Verify webhook signature
      const isValid = verifyJumioSignature(JSON.stringify(req.body), sig);
      if (!isValid) {
        logger.warn('Jumio webhook: Invalid signature');
        return res.status(400).send('Invalid signature');
      }

      const event = req.body;
      logger.info('Jumio webhook received', { 
        type: event.eventType, 
        scanReference: event.scanReference 
      });

      await handleJumioWebhook(event, services);
      
      res.status(200).json({ received: true });
    } catch (error) {
      logger.error('Jumio webhook error:', error);
      res.status(500).send('Webhook error');
    }
  });

  // Elliptic webhooks (AML updates)
  app.post('/webhooks/elliptic', express.json(), async (req, res) => {
    try {
      const sig = req.headers['x-elliptic-signature'] as string;
      
      if (!sig) {
        logger.warn('Elliptic webhook: Missing signature');
        return res.status(400).send('Missing signature');
      }

      const event = req.body;
      logger.info('Elliptic webhook received', { 
        type: event.type, 
        address: event.subject?.hash 
      });

      await handleEllipticWebhook(event, services);
      
      res.status(200).json({ received: true });
    } catch (error) {
      logger.error('Elliptic webhook error:', error);
      res.status(500).send('Webhook error');
    }
  });

  // Alchemy webhooks (blockchain events)
  app.post('/webhooks/alchemy', express.json(), async (req, res) => {
    try {
      const sig = req.headers['x-alchemy-signature'] as string;
      
      if (!sig) {
        logger.warn('Alchemy webhook: Missing signature');
        return res.status(400).send('Missing signature');
      }

      const event = req.body;
      logger.info('Alchemy webhook received', { 
        type: event.type, 
        network: event.event?.network 
      });

      await handleAlchemyWebhook(event, services);
      
      res.status(200).json({ received: true });
    } catch (error) {
      logger.error('Alchemy webhook error:', error);
      res.status(500).send('Webhook error');
    }
  });

  // Generic webhook endpoint for testing
  app.post('/webhooks/test', express.json(), (req, res) => {
    logger.info('Test webhook received', req.body);
    res.status(200).json({ 
      received: true, 
      timestamp: new Date().toISOString(),
      body: req.body 
    });
  });

  logger.info('✅ Webhook endpoints configured');
}

/**
 * Handle Stripe webhook events
 */
async function handleStripeWebhook(event: any, services: ServiceDependencies): Promise<void> {
  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handleStripePaymentSuccess(event.data.object, services);
        break;
        
      case 'payment_intent.payment_failed':
        await handleStripePaymentFailed(event.data.object, services);
        break;
        
      case 'payment_intent.processing':
        await handleStripePaymentProcessing(event.data.object, services);
        break;
        
      case 'charge.dispute.created':
        await handleStripeDispute(event.data.object, services);
        break;
        
      default:
        logger.info(`Unhandled Stripe event: ${event.type}`);
    }
    
    // Track webhook processing
    services.monitoring.trackRequest({
      timestamp: new Date(),
      endpoint: '/webhooks/stripe',
      method: 'POST',
      responseTime: 100,
      statusCode: 200
    });
    
  } catch (error) {
    logger.error('Error handling Stripe webhook:', error);
    throw error;
  }
}

/**
 * Handle Circle webhook events
 */
async function handleCircleWebhook(event: any, services: ServiceDependencies): Promise<void> {
  try {
    switch (event.Type) {
      case 'payments':
        await handleCirclePaymentUpdate(event, services);
        break;
        
      case 'transfers':
        await handleCircleTransferUpdate(event, services);
        break;
        
      case 'wallets':
        await handleCircleWalletUpdate(event, services);
        break;
        
      default:
        logger.info(`Unhandled Circle event: ${event.Type}`);
    }
    
  } catch (error) {
    logger.error('Error handling Circle webhook:', error);
    throw error;
  }
}

/**
 * Handle Jumio webhook events (KYC updates)
 */
async function handleJumioWebhook(event: any, services: ServiceDependencies): Promise<void> {
  try {
    switch (event.eventType) {
      case 'VERIFICATION_COMPLETED':
        await handleJumioVerificationCompleted(event, services);
        break;
        
      case 'VERIFICATION_FAILED':
        await handleJumioVerificationFailed(event, services);
        break;
        
      case 'VERIFICATION_PENDING':
        await handleJumioVerificationPending(event, services);
        break;
        
      default:
        logger.info(`Unhandled Jumio event: ${event.eventType}`);
    }
    
  } catch (error) {
    logger.error('Error handling Jumio webhook:', error);
    throw error;
  }
}

/**
 * Handle Elliptic webhook events (AML updates)
 */
async function handleEllipticWebhook(event: any, services: ServiceDependencies): Promise<void> {
  try {
    switch (event.type) {
      case 'address_screening_completed':
        await handleEllipticScreeningCompleted(event, services);
        break;
        
      case 'transaction_screening_completed':
        await handleEllipticTransactionScreening(event, services);
        break;
        
      case 'sanctions_hit':
        await handleEllipticSanctionsHit(event, services);
        break;
        
      default:
        logger.info(`Unhandled Elliptic event: ${event.type}`);
    }
    
  } catch (error) {
    logger.error('Error handling Elliptic webhook:', error);
    throw error;
  }
}

/**
 * Handle Alchemy webhook events (blockchain monitoring)
 */
async function handleAlchemyWebhook(event: any, services: ServiceDependencies): Promise<void> {
  try {
    switch (event.type) {
      case 'ADDRESS_ACTIVITY':
        await handleAlchemyAddressActivity(event, services);
        break;
        
      case 'DROPPED_TRANSACTION':
        await handleAlchemyDroppedTransaction(event, services);
        break;
        
      case 'MINED_TRANSACTION':
        await handleAlchemyMinedTransaction(event, services);
        break;
        
      default:
        logger.info(`Unhandled Alchemy event: ${event.type}`);
    }
    
  } catch (error) {
    logger.error('Error handling Alchemy webhook:', error);
    throw error;
  }
}

// Specific webhook handlers
async function handleStripePaymentSuccess(paymentIntent: any, services: ServiceDependencies): Promise<void> {
  logger.info('Stripe payment succeeded', { paymentId: paymentIntent.id });
  
  // Update payment status in database
  await services.supabase.updatePaymentStatus(
    paymentIntent.metadata?.starling_payment_id,
    'completed',
    { stripePaymentId: paymentIntent.id }
  );
  
  // Track payment metric
  services.monitoring.trackPayment({
    timestamp: new Date(),
    paymentId: paymentIntent.metadata?.starling_payment_id,
    amount: paymentIntent.amount / 100, // Convert from cents
    currency: paymentIntent.currency.toUpperCase(),
    rail: 'stripe',
    status: 'success',
    processingTime: 5000, // Estimate
    fees: paymentIntent.application_fee_amount || 0
  });
}

async function handleStripePaymentFailed(paymentIntent: any, services: ServiceDependencies): Promise<void> {
  logger.error('Stripe payment failed', { 
    paymentId: paymentIntent.id,
    error: paymentIntent.last_payment_error 
  });
  
  // Update payment status in database
  await services.supabase.updatePaymentStatus(
    paymentIntent.metadata?.starling_payment_id,
    'failed',
    { 
      stripePaymentId: paymentIntent.id,
      error: paymentIntent.last_payment_error
    }
  );
  
  // Track error
  services.monitoring.trackError(
    new Error(`Stripe payment failed: ${paymentIntent.last_payment_error?.message}`),
    { paymentId: paymentIntent.id }
  );
}

async function handleStripePaymentProcessing(paymentIntent: any, services: ServiceDependencies): Promise<void> {
  logger.info('Stripe payment processing', { paymentId: paymentIntent.id });
  
  await services.supabase.updatePaymentStatus(
    paymentIntent.metadata?.starling_payment_id,
    'processing',
    { stripePaymentId: paymentIntent.id }
  );
}

async function handleStripeDispute(dispute: any, services: ServiceDependencies): Promise<void> {
  logger.warn('Stripe dispute created', { 
    disputeId: dispute.id,
    chargeId: dispute.charge 
  });
  
  // Handle dispute - notify relevant parties
  services.monitoring.trackError(
    new Error('Payment dispute created'),
    { disputeId: dispute.id, chargeId: dispute.charge }
  );
}

async function handleCirclePaymentUpdate(event: any, services: ServiceDependencies): Promise<void> {
  const payment = event.payment;
  logger.info('Circle payment update', { 
    paymentId: payment.id,
    status: payment.status 
  });
  
  // Update payment status based on Circle status
  const starlingStatus = mapCircleStatusToStarling(payment.status);
  await services.supabase.updatePaymentStatus(
    payment.metadata?.starling_payment_id,
    starlingStatus,
    { circlePaymentId: payment.id }
  );
}

async function handleJumioVerificationCompleted(event: any, services: ServiceDependencies): Promise<void> {
  logger.info('Jumio verification completed', { 
    scanReference: event.scanReference,
    verificationStatus: event.verificationStatus 
  });
  
  // Update KYC status in database
  await services.supabase.updateUserKyc(event.userReference, {
    status: event.verificationStatus.toLowerCase(),
    completedAt: new Date().toISOString(),
    jumioScanReference: event.scanReference
  });
}

async function handleJumioVerificationFailed(event: any, services: ServiceDependencies): Promise<void> {
  logger.warn('Jumio verification failed', { 
    scanReference: event.scanReference,
    rejectReason: event.rejectReason 
  });
  
  await services.supabase.updateUserKyc(event.userReference, {
    status: 'failed',
    failedAt: new Date().toISOString(),
    rejectReason: event.rejectReason
  });
}

async function handleEllipticScreeningCompleted(event: any, services: ServiceDependencies): Promise<void> {
  logger.info('Elliptic screening completed', { 
    address: event.subject.hash,
    riskScore: event.risk_score 
  });
  
  // Store AML result
  await services.supabase.storeAmlResult({
    walletAddress: event.subject.hash,
    blockchain: event.subject.asset,
    riskScore: event.risk_score,
    isHighRisk: event.risk_score > 50,
    recommendation: event.risk_score > 75 ? 'reject' : 'approve',
    sanctions: event.sanctions || [],
    riskFactors: event.risk_factors || [],
    screenedAt: new Date().toISOString()
  });
}

async function handleEllipticSanctionsHit(event: any, services: ServiceDependencies): Promise<void> {
  logger.error('Elliptic sanctions hit detected', { 
    address: event.subject.hash,
    sanctions: event.sanctions 
  });
  
  // Immediately flag and alert
  services.monitoring.trackError(
    new Error('Sanctions hit detected'),
    { address: event.subject.hash, sanctions: event.sanctions }
  );
}

async function handleAlchemyMinedTransaction(event: any, services: ServiceDependencies): Promise<void> {
  logger.info('Alchemy transaction mined', { 
    hash: event.event.hash,
    blockNumber: event.event.blockNum 
  });
  
  // Update transaction status if it's one of ours
  const transaction = await services.supabase.getTransactionByHash(event.event.hash);
  if (transaction) {
    await services.supabase.updateTransactionStatus(event.event.hash, 'confirmed', {
      blockNumber: event.event.blockNum,
      confirmations: 1
    });
  }
}

// Signature verification functions
function verifyStripeSignature(payload: Buffer, signature: string): boolean {
  try {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) return false;
    
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature.split('=')[1], 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    logger.error('Error verifying Stripe signature:', error);
    return false;
  }
}

function verifyJumioSignature(payload: string, signature: string): boolean {
  try {
    const secret = process.env.JUMIO_WEBHOOK_SECRET;
    if (!secret) return false;
    
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    logger.error('Error verifying Jumio signature:', error);
    return false;
  }
}

// Helper functions
function mapCircleStatusToStarling(circleStatus: string): string {
  const statusMap: { [key: string]: string } = {
    'pending': 'processing',
    'confirmed': 'completed',
    'failed': 'failed',
    'cancelled': 'cancelled'
  };
  
  return statusMap[circleStatus] || 'processing';
}

export default setupWebhooks;
