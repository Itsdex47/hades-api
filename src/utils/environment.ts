/**
 * Comprehensive Environment Validation
 * Validates all required environment variables for multi-rail infrastructure
 */

interface EnvironmentValidation {
  valid: boolean;
  missing: string[];
  warnings: string[];
  summary: {
    core: boolean;
    database: boolean;
    paymentRails: {
      stripe: boolean;
      circle: boolean;
      alchemy: boolean;
      solana: boolean;
    };
    compliance: {
      jumio: boolean;
      elliptic: boolean;
      cube: boolean;
    };
    monitoring: {
      sentry: boolean;
      posthog: boolean;
    };
  };
}

// Define environment variable categories
const ENVIRONMENT_VARIABLES = {
  // Core application variables (required)
  core: [
    'NODE_ENV',
    'PORT',
    'JWT_SECRET',
    'ALLOWED_ORIGINS'
  ],
  
  // Database configuration (required)
  database: [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY'
  ],
  
  // Payment rails (at least one required for production)
  paymentRails: {
    stripe: [
      'STRIPE_SECRET_KEY',
      'STRIPE_PUBLISHABLE_KEY'
    ],
    circle: [
      'CIRCLE_API_KEY',
      'CIRCLE_WALLET_ID'
    ],
    alchemy: [
      'ALCHEMY_API_KEY'
    ],
    solana: [
      'SOLANA_RPC_URL',
      'SOLANA_PRIVATE_KEY',
      'SOLANA_USDC_MINT'
    ]
  },
  
  // Compliance providers (required for production)
  compliance: {
    jumio: [
      'JUMIO_API_TOKEN',
      'JUMIO_API_SECRET'
    ],
    elliptic: [
      'ELLIPTIC_API_KEY'
    ],
    cube: [
      'CUBE_API_KEY'
    ]
  },
  
  // Monitoring and analytics (optional but recommended)
  monitoring: {
    sentry: [
      'SENTRY_DSN'
    ],
    posthog: [
      'POSTHOG_API_KEY'
    ]
  },
  
  // Regional banking (optional)
  regionalBanking: {
    uk: [
      'UK_OPEN_BANKING_CLIENT_ID',
      'UK_OPEN_BANKING_CLIENT_SECRET'
    ],
    mexico: [
      'MEXICO_SPEI_PARTICIPANT_CODE'
    ],
    nigeria: [
      'NIGERIA_BANK_CODE',
      'NIGERIA_API_KEY'
    ]
  },
  
  // Security (recommended)
  security: [
    'ENCRYPTION_KEY',
    'REFRESH_TOKEN_SECRET'
  ]
};

/**
 * Validate environment variables with detailed reporting
 */
export function validateEnvironment(): EnvironmentValidation {
  const result: EnvironmentValidation = {
    valid: true,
    missing: [],
    warnings: [],
    summary: {
      core: true,
      database: true,
      paymentRails: {
        stripe: false,
        circle: false,
        alchemy: false,
        solana: false
      },
      compliance: {
        jumio: false,
        elliptic: false,
        cube: false
      },
      monitoring: {
        sentry: false,
        posthog: false
      }
    }
  };

  console.log('🔍 Validating environment configuration...\n');

  // Validate core variables (required)
  console.log('📋 Core Configuration:');
  const coreMissing = checkVariables(ENVIRONMENT_VARIABLES.core);
  if (coreMissing.length > 0) {
    result.missing.push(...coreMissing);
    result.summary.core = false;
    result.valid = false;
    console.log(`   ❌ Missing: ${coreMissing.join(', ')}`);
  } else {
    console.log('   ✅ All core variables present');
  }

  // Validate database variables (required)
  console.log('📊 Database Configuration:');
  const dbMissing = checkVariables(ENVIRONMENT_VARIABLES.database);
  if (dbMissing.length > 0) {
    result.missing.push(...dbMissing);
    result.summary.database = false;
    result.valid = false;
    console.log(`   ❌ Missing: ${dbMissing.join(', ')}`);
  } else {
    console.log('   ✅ Database configuration complete');
  }

  // Validate payment rails (at least one required)
  console.log('💳 Payment Rails:');
  let railsConfigured = 0;
  
  Object.entries(ENVIRONMENT_VARIABLES.paymentRails).forEach(([rail, vars]) => {
    const missing = checkVariables(vars);
    const configured = missing.length === 0;
    
    result.summary.paymentRails[rail as keyof typeof result.summary.paymentRails] = configured;
    
    if (configured) {
      railsConfigured++;
      console.log(`   ✅ ${rail.toUpperCase()}: Configured`);
    } else {
      console.log(`   ⚠️  ${rail.toUpperCase()}: Missing ${missing.join(', ')}`);
      result.warnings.push(`${rail} payment rail not configured`);
    }
  });

  if (railsConfigured === 0) {
    result.valid = false;
    result.missing.push('At least one payment rail must be configured');
    console.log('   ❌ No payment rails configured');
  } else {
    console.log(`   ✅ ${railsConfigured} payment rail(s) configured`);
  }

  // Validate compliance providers
  console.log('🛡️  Compliance Providers:');
  let complianceConfigured = 0;
  
  Object.entries(ENVIRONMENT_VARIABLES.compliance).forEach(([provider, vars]) => {
    const missing = checkVariables(vars);
    const configured = missing.length === 0;
    
    result.summary.compliance[provider as keyof typeof result.summary.compliance] = configured;
    
    if (configured) {
      complianceConfigured++;
      console.log(`   ✅ ${provider.toUpperCase()}: Configured`);
    } else {
      console.log(`   ⚠️  ${provider.toUpperCase()}: Missing ${missing.join(', ')}`);
      result.warnings.push(`${provider} compliance provider not configured`);
    }
  });

  if (complianceConfigured === 0 && process.env.NODE_ENV === 'production') {
    result.warnings.push('No compliance providers configured for production');
    console.log('   ⚠️  No compliance providers configured (required for production)');
  }

  // Validate monitoring (optional but recommended)
  console.log('📈 Monitoring & Analytics:');
  
  Object.entries(ENVIRONMENT_VARIABLES.monitoring).forEach(([service, vars]) => {
    const missing = checkVariables(vars);
    const configured = missing.length === 0;
    
    result.summary.monitoring[service as keyof typeof result.summary.monitoring] = configured;
    
    if (configured) {
      console.log(`   ✅ ${service.toUpperCase()}: Configured`);
    } else {
      console.log(`   ⚠️  ${service.toUpperCase()}: Not configured (optional)`);
    }
  });

  // Security validation
  console.log('🔐 Security Configuration:');
  const securityMissing = checkVariables(ENVIRONMENT_VARIABLES.security);
  if (securityMissing.length > 0) {
    result.warnings.push(`Security variables not configured: ${securityMissing.join(', ')}`);
    console.log(`   ⚠️  Missing: ${securityMissing.join(', ')}`);
  } else {
    console.log('   ✅ Security configuration complete');
  }

  // Environment-specific validation
  if (process.env.NODE_ENV === 'production') {
    validateProductionRequirements(result);
  }

  // Print summary
  console.log('\n📊 Environment Validation Summary:');
  console.log(`   Core: ${result.summary.core ? '✅' : '❌'}`);
  console.log(`   Database: ${result.summary.database ? '✅' : '❌'}`);
  console.log(`   Payment Rails: ${railsConfigured}/4 configured`);
  console.log(`   Compliance: ${complianceConfigured}/3 configured`);
  console.log(`   Monitoring: ${Object.values(result.summary.monitoring).filter(Boolean).length}/2 configured`);

  if (result.valid) {
    console.log('\n✅ Environment validation passed');
  } else {
    console.log('\n❌ Environment validation failed');
    console.log(`   Missing critical variables: ${result.missing.join(', ')}`);
  }

  if (result.warnings.length > 0) {
    console.log(`\n⚠️  Warnings (${result.warnings.length}):`);
    result.warnings.forEach(warning => console.log(`   - ${warning}`));
  }

  return result;
}

/**
 * Check if environment variables exist
 */
function checkVariables(variables: string[]): string[] {
  return variables.filter(variable => !process.env[variable]);
}

/**
 * Additional validation for production environment
 */
function validateProductionRequirements(result: EnvironmentValidation): void {
  console.log('\n🏭 Production Environment Checks:');
  
  // Check for demo mode in production
  if (process.env.ENABLE_DEMO_MODE === 'true') {
    result.warnings.push('Demo mode is enabled in production');
    console.log('   ⚠️  Demo mode is enabled');
  }
  
  // Check for KYC bypass in production
  if (process.env.ENABLE_KYC_BYPASS === 'true') {
    result.warnings.push('KYC bypass is enabled in production');
    console.log('   ⚠️  KYC bypass is enabled');
  }
  
  // Check for proper log level
  if (process.env.LOG_LEVEL === 'debug') {
    result.warnings.push('Debug logging enabled in production');
    console.log('   ⚠️  Debug logging enabled');
  }
  
  // Check for rate limiting
  if (!process.env.RATE_LIMIT_MAX_REQUESTS) {
    result.warnings.push('Rate limiting not configured');
    console.log('   ⚠️  Rate limiting not configured');
  }
  
  console.log('   ✅ Production checks complete');
}

/**
 * Validate and exit if critical variables are missing
 */
export function validateEnvironmentOrExit(): void {
  const validation = validateEnvironment();
  
  if (!validation.valid) {
    console.error('\n❌ Critical environment variables are missing. Application cannot start.');
    console.error('🔧 Please check your .env file and ensure all required variables are set.');
    process.exit(1);
  }
  
  if (validation.warnings.length > 0 && process.env.NODE_ENV === 'production') {
    console.warn('\n⚠️  Production warnings detected. Please review configuration.');
  }
  
  console.log('\n🚀 Environment validation complete. Starting application...\n');
}

/**
 * Get environment configuration summary
 */
export function getEnvironmentSummary(): any {
  const validation = validateEnvironment();
  
  return {
    environment: process.env.NODE_ENV,
    valid: validation.valid,
    services: {
      database: validation.summary.database,
      paymentRails: validation.summary.paymentRails,
      compliance: validation.summary.compliance,
      monitoring: validation.summary.monitoring
    },
    warnings: validation.warnings.length,
    timestamp: new Date().toISOString()
  };
}

// Default export for backwards compatibility
export default validateEnvironmentOrExit;
