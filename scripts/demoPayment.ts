import dotenv from 'dotenv';
import PaymentProcessor from '../src/services/paymentProcessor';

dotenv.config();

async function runDemoPayment() {
  console.log('🚀 Running demo payment flow...');
  
  try {
    const processor = new PaymentProcessor();
    
    // Check service health first
    console.log('🔍 Checking service health...');
    const health = await processor.healthCheck();
    console.log('📊 Service Status:', health);
    
    if (!health.supabase) {
      console.log('❌ Supabase connection failed - check your database configuration');
      return;
    }
    
    // For demo, we'll simulate a payment process
    console.log('');
    console.log('💡 Demo Payment Simulation');
    console.log('   This demonstrates the payment pipeline without real money');
    console.log('');
    
    const demoPayment = {
      quoteId: 'demo_quote_123',
      senderId: 'demo_user_123',
      recipientDetails: {
        firstName: 'Maria',
        lastName: 'Rodriguez',
        email: 'maria@example.com',
        phone: '+52-555-0123',
        address: {
          street: '123 Reforma Avenue',
          city: 'Mexico City',
          state: 'CDMX',
          country: 'Mexico',
          postalCode: '06500'
        },
        bankAccount: {
          accountNumber: '123456789012',
          bankName: 'Banco Azteca',
          bankCode: 'AZTECA',
          accountType: 'checking'
        }
      },
      purpose: 'Family support',
      reference: 'Monthly remittance'
    };
    
    console.log('📋 Demo Payment Details:');
    console.log(`   Recipient: ${demoPayment.recipientDetails.firstName} ${demoPayment.recipientDetails.lastName}`);
    console.log(`   Bank: ${demoPayment.recipientDetails.bankAccount.bankName}`);
    console.log(`   Purpose: ${demoPayment.purpose}`);
    console.log('');
    
    // Note: This would fail without a real quote in the database
    console.log('ℹ️  To run a full payment demo:');
    console.log('   1. First create a quote via API: POST /api/payments/quote');
    console.log('   2. Then process payment: POST /api/payments/process');
    console.log('   3. Monitor status: GET /api/payments/status/:paymentId');
    console.log('');
    console.log('📚 See README.md for complete API examples');
    
  } catch (error) {
    console.error('❌ Demo payment failed:', error.message);
  }
}

if (require.main === module) {
  runDemoPayment();
}

export { runDemoPayment };