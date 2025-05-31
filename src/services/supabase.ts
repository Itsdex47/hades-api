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
    const { data, error } = await this.supabase
      .from('users')
      .insert([{
        ...userData,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create user: ${error.message}`);
    }

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
      firstName: dbUser.first_name,
      lastName: dbUser.last_name,
      phone: dbUser.phone,
      address: dbUser.address,
      kycStatus: dbUser.kyc_status,
      kycDocuments: dbUser.kyc_documents || [],
      createdAt: new Date(dbUser.created_at),
      updatedAt: new Date(dbUser.updated_at),
      isActive: dbUser.is_active,
      riskLevel: dbUser.risk_level
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