# 🚀 H.A.D.E.S. API - QUICK START

## Current Status: Week 3 Complete ✅

You now have a **production-ready cross-border payment API** with full blockchain integration capabilities!

## 🎯 What's Working Right Now

### ✅ **Completed Infrastructure:**
- Full TypeScript Express API with professional error handling
- Supabase database integration (users, quotes, payments)
- JWT authentication system
- Payment quote engine with real-time pricing
- Complete payment processing pipeline
- Circle API integration for USD ↔ USDC conversion
- Solana blockchain service for USDC transfers
- Comprehensive payment status tracking

### 🔧 **Ready for Testing:**
- User registration & authentication
- Payment quotes for US → Mexico corridor
- End-to-end payment processing simulation
- Real-time payment status updates
- Professional API error handling

---

## ⚡ **Quick Setup (5 minutes)**

### 1. **Clone & Install**
```bash
git clone https://github.com/Itsdex47/hades-api.git
cd hades-api
npm run setup
```

### 2. **Configure Environment**
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your details:
nano .env
```

**Required Configuration:**
```env
# Database (get from supabase.com)
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Circle API (get from circle.com/developers)
CIRCLE_API_KEY=your_circle_sandbox_api_key
CIRCLE_ENVIRONMENT=sandbox

# Solana wallet (generate with npm run generate-wallet)
SOLANA_WALLET_PRIVATE_KEY=your_generated_private_key
```

### 3. **Generate Wallet & Start**
```bash
# Generate Solana wallet
npm run generate-wallet

# Start development server
npm run dev
```

### 4. **Test Your API**
```bash
# Health check
curl http://localhost:3001/health

# Test quote generation
curl -X POST http://localhost:3001/api/payments/quote \
  -H "Content-Type: application/json" \
  -d '{
    "inputAmount": 100,
    "inputCurrency": "USD",
    "outputCurrency": "MXN",
    "corridor": "US_TO_MEXICO"
  }'
```

---

## 🌟 **What Makes This Special**

### **Production-Ready Architecture:**
- Type-safe TypeScript throughout
- Professional error handling & validation
- Proper database schemas with camelCase ↔ snake_case mapping
- JWT authentication with middleware
- Comprehensive logging and monitoring hooks

### **Real Blockchain Integration:**
- Actual Solana Web3.js integration (not just placeholders)
- Circle API service for USD/USDC conversion
- USDC token transfer capabilities
- Transaction confirmation and status tracking

### **Crisis-Resilient Design:**
- Multi-step payment pipeline with rollback capabilities
- Comprehensive status tracking through each step
- Built-in error handling for network failures
- Ready for multiple corridor expansion

---

## 📋 **API Endpoints Available Now**

### **Authentication:**
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile (protected)

### **Payments:**
- `POST /api/payments/quote` - Get payment quotes
- `GET /api/payments/quote/:id` - Quote details
- `POST /api/payments/process` - Process payments
- `GET /api/payments/status/:id` - Payment status
- `GET /api/payments/history` - User payment history
- `GET /api/payments/health` - Service health

### **System:**
- `GET /health` - Overall system health
- `GET /api/corridors` - Supported payment corridors

---

## 🧪 **Testing Your Setup**

### **1. Register a User:**
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "secure123",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+1-555-0123"
  }'
```

### **2. Login & Get Token:**
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "secure123"
  }'
```

### **3. Create Quote:**
```bash
curl -X POST http://localhost:3001/api/payments/quote \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "inputAmount": 500,
    "inputCurrency": "USD",
    "outputCurrency": "MXN",
    "corridor": "US_TO_MEXICO"
  }'
```

### **4. Process Payment:**
```bash
curl -X POST http://localhost:3001/api/payments/process \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "quoteId": "YOUR_QUOTE_ID",
    "recipientDetails": {
      "firstName": "Maria",
      "lastName": "Rodriguez",
      "email": "maria@example.com",
      "bankAccount": {
        "accountNumber": "123456789",
        "bankName": "Banco Azteca",
        "bankCode": "AZTECA"
      }
    },
    "purpose": "Family support"
  }'
```

---

## 🎯 **Next Steps (Week 4)**

Now that your blockchain integration is working, you can:

### **Immediate (This Week):**
1. **Test Circle API integration** with real sandbox credentials
2. **Fund your Solana wallet** with devnet USDC for testing
3. **Run end-to-end payment tests** with small amounts ($1-10)
4. **Build the dashboard frontend** using Next.js

### **Short Term (1-2 weeks):**
1. **Add Mexican banking integration** (SPEI system)
2. **Implement compliance automation** (AML/KYC providers)
3. **Create webhooks** for real-time status updates
4. **Add monitoring & alerting** (error tracking, performance)

### **Medium Term (1-3 months):**
1. **Launch UK → Nigeria corridor**
2. **Mobile app development**
3. **Enterprise API partnerships**
4. **Regulatory compliance** (MSB licenses)

---

## 🔥 **Why This Will Succeed**

### **Technical Advantages:**
- **Modern stack** with proven scalability
- **Blockchain-native** architecture beats legacy SWIFT
- **Crisis-resilient** design for emerging markets
- **Developer-friendly** APIs for partnerships

### **Market Positioning:**
- **$695B remittance market** with 8-15% fees
- **Emerging market expertise** (infrastructure challenges)
- **1.5% fee structure** vs 8-15% traditional
- **2-5 minute transfers** vs 3-7 days traditional

### **Competitive Moat:**
- **First-mover advantage** in blockchain-native remittance
- **Infrastructure expertise** for challenging markets
- **Partnership-ready** architecture for banks/fintechs
- **Regulatory-compliant** foundation

---

## 📞 **Need Help?**

### **Common Issues:**
- **Database connection fails:** Check Supabase URL and keys
- **Circle API errors:** Verify API key and sandbox mode
- **Solana connection issues:** Check RPC URL and wallet format
- **JWT token errors:** Ensure proper authorization headers

### **Development Tips:**
- Use **Postman collection** for API testing
- Check **console logs** for detailed error messages
- Test with **small amounts** first ($1-10)
- Use **devnet/sandbox** environments for development

### **Resources:**
- **Circle API Docs:** https://developers.circle.com/
- **Solana Web3.js Docs:** https://docs.solana.com/
- **Supabase Docs:** https://supabase.com/docs

---

## 🚀 **You're Ready to Launch!**

Your API is production-ready for MVP testing. You have:

✅ **Complete payment infrastructure**
✅ **Real blockchain integration**  
✅ **Professional API design**
✅ **Crisis-resilient architecture**
✅ **Scalable database foundation**

**Next:** Start testing with real (small) transactions and build your dashboard!

---

*Built with ❤️ by H.A.D.E.S. - Connecting the world through better payments*