-- Starling Remittance API Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  address JSONB,
  kyc_status VARCHAR(20) DEFAULT 'not_started' CHECK (kyc_status IN ('not_started', 'pending', 'approved', 'rejected', 'expired')),
  kyc_documents JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  risk_level VARCHAR(10) DEFAULT 'low' CHECK (risk_level IN ('low', 'medium', 'high')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Quotes table
CREATE TABLE quotes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  quote_id VARCHAR(100) UNIQUE NOT NULL,
  input_amount DECIMAL(10,2) NOT NULL,
  input_currency VARCHAR(3) NOT NULL,
  output_amount DECIMAL(15,2) NOT NULL,
  output_currency VARCHAR(3) NOT NULL,
  exchange_rate DECIMAL(10,6) NOT NULL,
  fees JSONB NOT NULL,
  estimated_time VARCHAR(50),
  valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
  corridor VARCHAR(10) NOT NULL,
  compliance_required BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payments table
CREATE TABLE payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  quote_id VARCHAR(100) NOT NULL,
  sender_id UUID REFERENCES users(id),
  recipient_id UUID,
  amount_usd DECIMAL(10,2) NOT NULL,
  from_currency VARCHAR(3) NOT NULL,
  to_currency VARCHAR(3) NOT NULL,
  recipient_details JSONB NOT NULL,
  purpose VARCHAR(255),
  reference VARCHAR(255),
  steps JSONB DEFAULT '[]'::jsonb,
  blockchain_details JSONB DEFAULT '{}'::jsonb,
  fiat_details JSONB DEFAULT '{}'::jsonb,
  fees JSONB NOT NULL,
  status VARCHAR(30) DEFAULT 'created' CHECK (status IN ('created', 'kyc_pending', 'compliance_review', 'processing', 'blockchain_pending', 'converting', 'settling', 'completed', 'failed', 'cancelled')),
  compliance_check JSONB DEFAULT '{}'::jsonb,
  estimated_completion_time TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Compliance records table
CREATE TABLE compliance_records (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  payment_id UUID REFERENCES payments(id),
  compliance_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- KYC documents table
CREATE TABLE kyc_documents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  document_type VARCHAR(30) NOT NULL CHECK (document_type IN ('passport', 'drivers_license', 'national_id', 'proof_of_address', 'bank_statement')),
  file_name VARCHAR(255) NOT NULL,
  file_url VARCHAR(500) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  review_notes TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE
);

-- Blockchain transactions table (for tracking on-chain activity)
CREATE TABLE blockchain_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  payment_id UUID REFERENCES payments(id),
  network VARCHAR(20) NOT NULL,
  transaction_hash VARCHAR(100) UNIQUE NOT NULL,
  from_address VARCHAR(100) NOT NULL,
  to_address VARCHAR(100) NOT NULL,
  amount DECIMAL(20,8) NOT NULL,
  currency VARCHAR(10) NOT NULL,
  gas_used INTEGER,
  gas_price DECIMAL(20,8),
  confirmations INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  confirmed_at TIMESTAMP WITH TIME ZONE
);

-- API keys table (for managing external service credentials)
CREATE TABLE api_keys (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  service_name VARCHAR(50) NOT NULL,
  key_name VARCHAR(100) NOT NULL,
  encrypted_key TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Exchange rates table (for caching rates)
CREATE TABLE exchange_rates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  from_currency VARCHAR(3) NOT NULL,
  to_currency VARCHAR(3) NOT NULL,
  rate DECIMAL(15,8) NOT NULL,
  source VARCHAR(50) NOT NULL,
  valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(from_currency, to_currency, source)
);

-- Indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_kyc_status ON users(kyc_status);
CREATE INDEX idx_quotes_quote_id ON quotes(quote_id);
CREATE INDEX idx_quotes_valid_until ON quotes(valid_until);
CREATE INDEX idx_payments_sender_id ON payments(sender_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created_at ON payments(created_at DESC);
CREATE INDEX idx_payments_quote_id ON payments(quote_id);
CREATE INDEX idx_compliance_records_user_id ON compliance_records(user_id);
CREATE INDEX idx_compliance_records_payment_id ON compliance_records(payment_id);
CREATE INDEX idx_kyc_documents_user_id ON kyc_documents(user_id);
CREATE INDEX idx_blockchain_transactions_payment_id ON blockchain_transactions(payment_id);
CREATE INDEX idx_blockchain_transactions_hash ON blockchain_transactions(transaction_hash);
CREATE INDEX idx_exchange_rates_currencies ON exchange_rates(from_currency, to_currency);
CREATE INDEX idx_exchange_rates_valid_until ON exchange_rates(valid_until);

-- Row Level Security (RLS) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies (basic setup - you'll refine these based on your auth strategy)
CREATE POLICY "Users can view their own data" ON users
  FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "Users can update their own data" ON users
  FOR UPDATE USING (auth.uid()::text = id::text);

CREATE POLICY "Users can view their own payments" ON payments
  FOR SELECT USING (auth.uid()::text = sender_id::text);

CREATE POLICY "Users can view their own KYC documents" ON kyc_documents
  FOR SELECT USING (auth.uid()::text = user_id::text);

-- Functions for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to automatically update updated_at
CREATE TRIGGER update_users_updated_at 
  BEFORE UPDATE ON users 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at 
  BEFORE UPDATE ON payments 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_keys_updated_at 
  BEFORE UPDATE ON api_keys 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert some test data
INSERT INTO users (email, first_name, last_name, kyc_status) VALUES 
('demo@starlinglabs.dev', 'Demo', 'User', 'approved');

-- Create a view for payment analytics
CREATE VIEW payment_analytics AS
SELECT 
  DATE_TRUNC('day', created_at) as date,
  status,
  from_currency,
  to_currency,
  COUNT(*) as transaction_count,
  SUM(amount_usd) as total_volume_usd,
  AVG(amount_usd) as avg_amount_usd
FROM payments 
GROUP BY DATE_TRUNC('day', created_at), status, from_currency, to_currency
ORDER BY date DESC;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;