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

  // Payment Management
  async createPayment(paymentData: Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>): Promise<Payment> {
    // Build the payment record for database insertion
    const dbPaymentData: any = {
      quote_id: paymentData.quoteId,
      sender_id: paymentData.request.senderId,
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
    };

    // Only add recipient_id if it's not null (for external recipients, it will be null)
    if (paymentData.request.recipientId) {
      dbPaymentData.recipient_id = paymentData.request.recipientId;
    }

    console.log('🔄 Creating payment with data:', {
      quote_id: dbPaymentData.quote_id,
      sender_id: dbPaymentData.sender_id,
      recipient_id: dbPaymentData.recipient_id || 'null (external)',
      amount_usd: dbPaymentData.amount_usd,
      status: dbPaymentData.status
    });

    const { data, error } = await this.supabase
      .from('payments')
      .insert([dbPaymentData])
      .select()
      .single();

    if (error) {
      console.error('❌ Payment creation error:', error);
      throw new Error(`Failed to create payment: ${error.message}`);
    }

    console.log('✅ Payment successfully created in database:', data.id);
    return this.mapDbPaymentToPayment(data);
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

  async updatePaymentStatus(paymentId: string, status: string, steps?: any[]): Promise<void> {
    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    };

    if (steps) {
      updateData.steps = steps;
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

  // NEW: Create quote method that returns the created quote
  async createQuote(quoteData: any): Promise<{ id: string }> {
    console.log('🔄 Creating quote with data:', {
      user_id: quoteData.userId,
      amount: quoteData.inputAmount,
      currency: `${quoteData.inputCurrency} -> ${quoteData.outputCurrency}`
    });

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
      console.error('❌ Quote creation error:', error);
      throw new Error(`Failed to create quote: ${error.message}`);
    }

    console.log('✅ Quote successfully created in database:', data.id);
    return data;
  }

  async getQuoteById(quoteId: string): Promise<Quote | null> {
    // First try to get by quote_id string
    let { data, error } = await this.supabase
      .from('quotes')
      .select('*')
      .eq('quote_id', quoteId)
      .single();

    // If not found and quoteId looks like a UUID, try by id
    if (error && error.code === 'PGRST116') {
      const { data: dataById, error: errorById } = await this.supabase
        .from('quotes')
        .select('*')
        .eq('id', quoteId)
        .single();
      
      if (!errorById) {
        data = dataById;
        error = null;
      }
    }

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`Failed to get quote: ${error.message}`);
    }

    return this.mapDbQuoteToQuote(data);
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
      quoteId: dbQuote.quote_id || dbQuote.id, // Handle both quote_id string and UUID id
      inputAmount: dbQuote.input_amount,
      inputCurrency: dbQuote.input_currency,
      outputAmount: dbQuote.output_amount,
      outputCurrency: dbQuote.output_currency,
      exchangeRate: dbQuote.exchange_rate,
      fees: dbQuote.fees,
      estimatedTime: dbQuote.estimated_time || '2-5 minutes',
      validUntil: new Date(dbQuote.valid_until),
      corridor: dbQuote.corridor,
      complianceRequired: dbQuote.compliance_required,
      createdAt: new Date(dbQuote.created_at)
    };
  }
}

export default SupabaseService;