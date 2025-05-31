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
  async saveQuote(quoteData: Quote): Promise<void> {\n    const { error } = await this.supabase\n      .from('quotes')\n      .insert([{\n        quote_id: quoteData.quoteId,\n        input_amount: quoteData.inputAmount,\n        input_currency: quoteData.inputCurrency,\n        output_amount: quoteData.outputAmount,\n        output_currency: quoteData.outputCurrency,\n        exchange_rate: quoteData.exchangeRate,\n        fees: quoteData.fees,\n        estimated_time: quoteData.estimatedTime,\n        valid_until: quoteData.validUntil,\n        corridor: quoteData.corridor,\n        compliance_required: quoteData.complianceRequired,\n        created_at: quoteData.createdAt\n      }]);\n\n    if (error) {\n      throw new Error(`Failed to save quote: ${error.message}`);\n    }\n  }\n\n  async getQuoteById(quoteId: string): Promise<Quote | null> {\n    const { data, error } = await this.supabase\n      .from('quotes')\n      .select('*')\n      .eq('quote_id', quoteId)\n      .single();\n\n    if (error) {\n      if (error.code === 'PGRST116') return null; // Not found\n      throw new Error(`Failed to get quote: ${error.message}`);\n    }\n\n    return this.mapDbQuoteToQuote(data);\n  }\n\n  // Compliance Management\n  async createComplianceRecord(userId: string, paymentId: string, complianceData: any): Promise<void> {\n    const { error } = await this.supabase\n      .from('compliance_records')\n      .insert([{\n        user_id: userId,\n        payment_id: paymentId,\n        compliance_data: complianceData,\n        created_at: new Date().toISOString()\n      }]);\n\n    if (error) {\n      throw new Error(`Failed to create compliance record: ${error.message}`);\n    }\n  }\n\n  // Health Check\n  async healthCheck(): Promise<boolean> {\n    try {\n      const { data, error } = await this.supabase\n        .from('users')\n        .select('count')\n        .limit(1);\n      \n      return !error;\n    } catch (error) {\n      return false;\n    }\n  }\n\n  // Helper methods to map database objects to our types\n  private mapDbUserToUser(dbUser: any): User {\n    return {\n      id: dbUser.id,\n      email: dbUser.email,\n      firstName: dbUser.first_name,        // snake_case -> camelCase\n      lastName: dbUser.last_name,          // snake_case -> camelCase\n      phone: dbUser.phone,\n      address: dbUser.address,\n      kycStatus: dbUser.kyc_status,        // snake_case -> camelCase\n      kycDocuments: dbUser.kyc_documents || [], // snake_case -> camelCase\n      createdAt: new Date(dbUser.created_at),   // snake_case -> camelCase\n      updatedAt: new Date(dbUser.updated_at),   // snake_case -> camelCase\n      isActive: dbUser.is_active,          // snake_case -> camelCase\n      riskLevel: dbUser.risk_level         // snake_case -> camelCase\n    };\n  }\n\n  private mapDbPaymentToPayment(dbPayment: any): Payment {\n    return {\n      id: dbPayment.id,\n      quoteId: dbPayment.quote_id,\n      request: {\n        senderId: dbPayment.sender_id,\n        recipientId: dbPayment.recipient_id,\n        amountUSD: dbPayment.amount_usd,\n        fromCurrency: dbPayment.from_currency,\n        toCurrency: dbPayment.to_currency,\n        recipientDetails: dbPayment.recipient_details,\n        purpose: dbPayment.purpose,\n        reference: dbPayment.reference\n      },\n      steps: dbPayment.steps || [],\n      blockchain: dbPayment.blockchain_details || {},\n      fiat: dbPayment.fiat_details || {},\n      fees: dbPayment.fees || {},\n      status: dbPayment.status,\n      compliance: dbPayment.compliance_check || {},\n      createdAt: new Date(dbPayment.created_at),\n      updatedAt: new Date(dbPayment.updated_at),\n      completedAt: dbPayment.completed_at ? new Date(dbPayment.completed_at) : undefined,\n      estimatedCompletionTime: new Date(dbPayment.estimated_completion_time)\n    };\n  }\n\n  private mapDbQuoteToQuote(dbQuote: any): Quote {\n    return {\n      quoteId: dbQuote.quote_id,\n      inputAmount: dbQuote.input_amount,\n      inputCurrency: dbQuote.input_currency,\n      outputAmount: dbQuote.output_amount,\n      outputCurrency: dbQuote.output_currency,\n      exchangeRate: dbQuote.exchange_rate,\n      fees: dbQuote.fees,\n      estimatedTime: dbQuote.estimated_time,\n      validUntil: new Date(dbQuote.valid_until),\n      corridor: dbQuote.corridor,\n      complianceRequired: dbQuote.compliance_required,\n      createdAt: new Date(dbQuote.created_at)\n    };\n  }\n}\n\nexport default SupabaseService;