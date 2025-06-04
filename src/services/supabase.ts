import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { User, Payment, Quote, KYCDocument } from '../types/payment';

export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    // Debug environment variables
    console.log('🔍 Checking Supabase environment variables...');
    console.log('SUPABASE_URL exists:', !!process.env.SUPABASE_URL);
    console.log('SUPABASE_SERVICE_ROLE_KEY exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Missing Supabase environment variables:');
      console.error('SUPABASE_URL:', supabaseUrl ? 'PROVIDED' : 'MISSING');
      console.error('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'PROVIDED' : 'MISSING');
      console.error('Current working directory:', process.cwd());
      console.error('NODE_ENV:', process.env.NODE_ENV);
      
      throw new Error('Missing Supabase environment variables. Please check your .env file.');
    }

    console.log('✅ Supabase environment variables loaded successfully');
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  // User Management
  async createUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    // Map camelCase to snake_case for database insertion
    const dbUserData = {
      email: userData.email,
      first_name: userData.firstName,        // camelCase -> snake_case
      last_name: userData.lastName,          // camelCase -> snake_case
      phone: userData.phone,
      address: userData.address,
      kyc_status: userData.kycStatus,        // camelCase -> snake_case
      kyc_documents: userData.kycDocuments,  // camelCase -> snake_case
      is_active: userData.isActive,          // camelCase -> snake_case
      risk_level: userData.riskLevel,        // camelCase -> snake_case
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log('🔄 Inserting user with mapped data:', dbUserData);

    const { data, error } = await this.supabase
      .from('users')
      .insert([dbUserData])
      .select()
      .single();

    if (error) {
      console.error('❌ Database insertion error:', error);
      throw new Error(`Failed to create user: ${error.message}`);
    }

    console.log('✅ User successfully created in database');
    return this.mapDbUserToUser(data);
  }

  async getUserById(id: string): Promise<User | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to get user: ${error.message}`);
    }

    return this.mapDbUserToUser(data);
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to get user by email: ${error.message}`);
    }

    return this.mapDbUserToUser(data);
  }

  async updateUserKYCStatus(userId: string, kycStatus: string): Promise<void> {
    const { error } = await this.supabase
      .from('users')
      .update({ 
        kyc_status: kycStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (error) {
      throw new Error(`Failed to update KYC status: ${error.message}`);
    }
  }

  // Enhanced KYC management for new compliance features
  async updateUserKyc(userReference: string, kycData: any): Promise<void> {
    const { error } = await this.supabase
      .from('users')
      .update({
        kyc_status: kycData.status,
        kyc_verification_id: kycData.verificationId,
        kyc_level: kycData.level,
        kyc_submitted_at: kycData.submittedAt,
        kyc_completed_at: kycData.completedAt,
        kyc_failed_at: kycData.failedAt,
        kyc_reject_reason: kycData.rejectReason,
        jumio_scan_reference: kycData.jumioScanReference,
        updated_at: new Date().toISOString()
      })
      .eq('email', userReference); // Using email as user reference

    if (error) {
      throw new Error(`Failed to update user KYC: ${error.message}`);
    }
  }

  // Payment Management
  async createPayment(paymentData: Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>): Promise<Payment> {
    const { data, error } = await this.supabase
      .from('payments')
      .insert([{
        quote_id: paymentData.quoteId,
        sender_id: paymentData.request.senderId,
        recipient_id: paymentData.request.recipientId,
        amount_usd: paymentData.request.amountUSD,
        from_currency: paymentData.request.fromCurrency,
        to_currency: paymentData.request.toCurrency,
        recipient_details: paymentData.request.recipientDetails,
        purpose: paymentData.request.purpose,
        reference: paymentData.request.reference,
        steps: paymentData.steps,
        blockchain_details: paymentData.blockchain,
        fiat_details: paymentData.fiat,
        fees: paymentData.fees,
        status: paymentData.status,
        compliance_check: paymentData.compliance,
        estimated_completion_time: paymentData.estimatedCompletionTime,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create payment: ${error.message}`);
    }

    return this.mapDbPaymentToPayment(data);
  }

  // Enhanced payment creation for new multi-rail features
  async createPayment(payment: any): Promise<any> {
    const { data, error } = await this.supabase
      .from('payments')
      .insert([{
        id: payment.id,
        quote_id: payment.quoteId,
        external_id: payment.externalId,
        status: payment.status,
        sender: payment.sender,
        recipient: payment.recipient,
        amount: payment.amount,
        currency: payment.currency,
        route: payment.route,
        fees: payment.fees,
        created_at: payment.createdAt,
        updated_at: payment.updatedAt
      }])
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create payment: ${error.message}`);
    }

    return data;
  }

  async getPaymentById(id: string): Promise<Payment | null> {
    const { data, error } = await this.supabase
      .from('payments')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to get payment: ${error.message}`);
    }

    return this.mapDbPaymentToPayment(data);
  }

  // Enhanced payment retrieval
  async getPayment(paymentId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get payment: ${error.message}`);
    }

    return data;
  }

  async updatePaymentStatus(paymentId: string, status: string, steps?: any[], additionalData?: any): Promise<void> {
    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    };

    if (steps) {
      updateData.steps = steps;
    }

    if (additionalData) {
      Object.assign(updateData, additionalData);
    }

    const { error } = await this.supabase
      .from('payments')
      .update(updateData)
      .eq('id', paymentId);

    if (error) {
      throw new Error(`Failed to update payment status: ${error.message}`);
    }
  }

  async getPaymentsByUserId(userId: string, limit: number = 50): Promise<Payment[]> {
    const { data, error } = await this.supabase
      .from('payments')
      .select('*')
      .eq('sender_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to get payments: ${error.message}`);
    }

    return data.map(this.mapDbPaymentToPayment);
  }

  // Quote Management
  async saveQuote(quoteData: Quote): Promise<void> {
    const { error } = await this.supabase
      .from('quotes')
      .insert([{
        quote_id: quoteData.quoteId,
        input_amount: quoteData.inputAmount,
        input_currency: quoteData.inputCurrency,
        output_amount: quoteData.outputAmount,
        output_currency: quoteData.outputCurrency,
        exchange_rate: quoteData.exchangeRate,
        fees: quoteData.fees,
        estimated_time: quoteData.estimatedTime,
        valid_until: quoteData.validUntil,
        corridor: quoteData.corridor,
        compliance_required: quoteData.complianceRequired,
        created_at: quoteData.createdAt
      }]);

    if (error) {
      throw new Error(`Failed to save quote: ${error.message}`);
    }
  }

  // Enhanced quote storage for new features
  async storeQuote(quote: any): Promise<void> {
    const { error } = await this.supabase
      .from('quotes')
      .insert([{
        quote_id: quote.quoteId,
        from_currency: quote.fromCurrency,
        to_currency: quote.toCurrency,
        from_amount: quote.fromAmount,
        to_amount: quote.toAmount,
        exchange_rate: quote.exchangeRate,
        fees: quote.fees,
        route: quote.route,
        compliance: quote.compliance,
        validity: quote.validity,
        created_at: quote.createdAt
      }]);

    if (error) {
      throw new Error(`Failed to store quote: ${error.message}`);
    }
  }

  async createQuote(quoteData: any): Promise<{ id: string }> {
    const { data, error } = await this.supabase
      .from('quotes')
      .insert([{
        user_id: quoteData.userId,
        input_amount: quoteData.inputAmount,
        input_currency: quoteData.inputCurrency,
        output_amount: quoteData.outputAmount,
        output_currency: quoteData.outputCurrency,
        exchange_rate: quoteData.exchangeRate,
        corridor: quoteData.corridor,
        fees: quoteData.fees,
        estimated_arrival_time: quoteData.estimatedArrivalTime,
        valid_until: quoteData.validUntil,
        compliance_required: quoteData.complianceRequired,
        created_at: new Date().toISOString()
      }])
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to create quote: ${error.message}`);
    }

    return data;
  }

  async getQuoteById(quoteId: string): Promise<Quote | null> {
    const { data, error } = await this.supabase
      .from('quotes')
      .select('*')
      .eq('quote_id', quoteId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to get quote: ${error.message}`);
    }

    return this.mapDbQuoteToQuote(data);
  }

  // Enhanced quote retrieval
  async getQuote(quoteId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('quotes')
      .select('*')
      .eq('quote_id', quoteId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get quote: ${error.message}`);
    }

    return data;
  }

  // AML Management
  async storeAmlResult(amlData: any): Promise<void> {
    const { error } = await this.supabase
      .from('aml_results')
      .insert([{
        wallet_address: amlData.walletAddress,
        blockchain: amlData.blockchain,
        risk_score: amlData.riskScore,
        is_high_risk: amlData.isHighRisk,
        recommendation: amlData.recommendation,
        sanctions: amlData.sanctions,
        risk_factors: amlData.riskFactors,
        screened_at: amlData.screenedAt,
        created_at: new Date().toISOString()
      }]);

    if (error) {
      throw new Error(`Failed to store AML result: ${error.message}`);
    }
  }

  // Blockchain Transaction Management
  async getTransactionByHash(transactionHash: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('blockchain_transactions')
      .select('*')
      .eq('transaction_hash', transactionHash)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new Error(`Failed to get transaction: ${error.message}`);
    }

    return data;
  }

  async updateTransactionStatus(transactionHash: string, status: string, updateData: any): Promise<void> {
    const { error } = await this.supabase
      .from('blockchain_transactions')
      .update({
        status,
        block_number: updateData.blockNumber,
        confirmations: updateData.confirmations,
        updated_at: new Date().toISOString()
      })
      .eq('transaction_hash', transactionHash);

    if (error) {
      throw new Error(`Failed to update transaction status: ${error.message}`);
    }
  }

  // Compliance Management
  async createComplianceRecord(userId: string, paymentId: string, complianceData: any): Promise<void> {
    const { error } = await this.supabase
      .from('compliance_records')
      .insert([{
        user_id: userId,
        payment_id: paymentId,
        compliance_data: complianceData,
        created_at: new Date().toISOString()
      }]);

    if (error) {
      throw new Error(`Failed to create compliance record: ${error.message}`);
    }
  }

  // Enhanced compliance tracking
  async trackComplianceEvent(eventType: string, eventData: any): Promise<void> {
    const { error } = await this.supabase
      .from('compliance_events')
      .insert([{
        event_type: eventType,
        event_data: eventData,
        timestamp: new Date().toISOString()
      }]);

    if (error) {
      throw new Error(`Failed to track compliance event: ${error.message}`);
    }
  }

  // System Metrics
  async getSystemMetrics(timeframe: string = '24h'): Promise<any> {
    const hoursBack = timeframe === '24h' ? 24 : 168; // 24h or 7d
    const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    const [paymentsResult, usersResult, complianceResult] = await Promise.all([
      this.supabase
        .from('payments')
        .select('status, amount, created_at')
        .gte('created_at', cutoff.toISOString()),
      
      this.supabase
        .from('users')
        .select('kyc_status, created_at')
        .gte('created_at', cutoff.toISOString()),
      
      this.supabase
        .from('compliance_events')
        .select('event_type, timestamp')
        .gte('timestamp', cutoff.toISOString())
    ]);

    return {
      payments: paymentsResult.data || [],
      users: usersResult.data || [],
      compliance: complianceResult.data || [],
      timeframe,
      generatedAt: new Date().toISOString()
    };
  }

  // Health Check
  async healthCheck(): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('count')
        .limit(1);
      
      return !error;
    } catch (error) {
      return false;
    }
  }

  // Helper methods to map database objects to our types
  private mapDbUserToUser(dbUser: any): User {
    return {
      id: dbUser.id,
      email: dbUser.email,
      firstName: dbUser.first_name,        // snake_case -> camelCase
      lastName: dbUser.last_name,          // snake_case -> camelCase
      phone: dbUser.phone,
      address: dbUser.address,
      kycStatus: dbUser.kyc_status,        // snake_case -> camelCase
      kycDocuments: dbUser.kyc_documents || [], // snake_case -> camelCase
      createdAt: new Date(dbUser.created_at),   // snake_case -> camelCase
      updatedAt: new Date(dbUser.updated_at),   // snake_case -> camelCase
      isActive: dbUser.is_active,          // snake_case -> camelCase
      riskLevel: dbUser.risk_level         // snake_case -> camelCase
    };
  }

  private mapDbPaymentToPayment(dbPayment: any): Payment {
    return {
      id: dbPayment.id,
      quoteId: dbPayment.quote_id,
      request: {
        senderId: dbPayment.sender_id,
        recipientId: dbPayment.recipient_id,
        amountUSD: dbPayment.amount_usd,
        fromCurrency: dbPayment.from_currency,
        toCurrency: dbPayment.to_currency,
        recipientDetails: dbPayment.recipient_details,
        purpose: dbPayment.purpose,
        reference: dbPayment.reference
      },
      steps: dbPayment.steps || [],
      blockchain: dbPayment.blockchain_details || {},
      fiat: dbPayment.fiat_details || {},
      fees: dbPayment.fees || {},
      status: dbPayment.status,
      compliance: dbPayment.compliance_check || {},
      createdAt: new Date(dbPayment.created_at),
      updatedAt: new Date(dbPayment.updated_at),
      completedAt: dbPayment.completed_at ? new Date(dbPayment.completed_at) : undefined,
      estimatedCompletionTime: new Date(dbPayment.estimated_completion_time)
    };
  }

  private mapDbQuoteToQuote(dbQuote: any): Quote {
    return {
      quoteId: dbQuote.quote_id,
      inputAmount: dbQuote.input_amount,
      inputCurrency: dbQuote.input_currency,
      outputAmount: dbQuote.output_amount,
      outputCurrency: dbQuote.output_currency,
      exchangeRate: dbQuote.exchange_rate,
      fees: dbQuote.fees,
      estimatedTime: dbQuote.estimated_time,
      validUntil: new Date(dbQuote.valid_until),
      corridor: dbQuote.corridor,
      complianceRequired: dbQuote.compliance_required,
      createdAt: new Date(dbQuote.created_at)
    };
  }
}

export default SupabaseService;
