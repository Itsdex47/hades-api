export function validateEnvironment() {
  const requiredEnvVars = [
    'PORT',
    'SUPABASE_URL',
    'SUPABASE_KEY',
    'JWT_SECRET',
    // Add other critical environment variables here
  ];

  const missingVars = requiredEnvVars.filter(v => !process.env[v]);

  if (missingVars.length > 0) {
    console.error(`❌ Missing critical environment variables: ${missingVars.join(', ')}`);
    console.log('🔍 Please ensure all required variables are set in your .env file.');
    process.exit(1);
  }
  console.log('✅ Environment variables validated successfully.');
} 