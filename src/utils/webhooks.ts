import express from 'express';

interface ServiceDependencies {
  supabase: any; // Replace with actual SupabaseService type
  multiRail: any; // Replace with actual OptimalMultiRailService type
  compliance: any; // Replace with actual ComplianceService type
  monitoring: any; // Replace with actual MonitoringService type
}

export function setupWebhooks(app: express.Express, services: ServiceDependencies) {
  // Example Stripe webhook (ensure body-parser is used for raw body)
  app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), (req, res) => {
    console.log('Stripe webhook received');
    // Handle Stripe event
    // e.g., services.multiRail.handleStripeEvent(req.body, req.headers['stripe-signature']);
    res.status(200).send();
  });

  // Example Circle webhook
  app.post('/webhooks/circle', (req, res) => {
    console.log('Circle webhook received');
    // Handle Circle event
    // e.g., services.multiRail.handleCircleEvent(req.body);
    res.status(200).send();
  });

  console.log('🎣 Webhooks initialized.');
} 