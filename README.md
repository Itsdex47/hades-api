# Starling Remittance API

> Cross-border remittance infrastructure using blockchain rails for emerging markets

## 🚀 Quick Start

1. Clone this repository
2. Install dependencies: `npm install`
3. Copy environment variables: `cp .env.example .env`
4. Fill in your environment variables
5. Start development server: `npm run dev`

## 🏗️ Architecture

Building a modern cross-border payment infrastructure that:
- Uses stablecoins (USDC) for low-cost transfers
- Leverages Solana blockchain for fast settlement
- Provides crisis-resilient payment rails for emerging markets
- Integrates with traditional banking systems

## 📋 MVP Features

- [ ] Payment quote API
- [ ] User registration and KYC
- [ ] USD to USDC conversion (Circle API)
- [ ] Solana USDC transfers
- [ ] USDC to local currency conversion
- [ ] Transaction status tracking
- [ ] Basic compliance checks
- [ ] Simple dashboard

## 🛠️ Tech Stack

- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL (via Supabase)
- **Blockchain**: Solana + Circle API
- **Frontend**: Next.js + Tailwind (dashboard)
- **Hosting**: Vercel

## 📚 Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## 🔐 Environment Variables

See `.env.example` for required environment variables.

## 📖 API Documentation

### Health Check
```
GET /health
```

### Payment Quote
```
POST /api/payments/quote
{
  "amount": 100,
  "fromCurrency": "USD",
  "toCurrency": "MXN"
}
```

## 🌍 Supported Corridors

- [x] US → Mexico (USD → MXN)
- [ ] UK → Nigeria (GBP → NGN) - Coming soon
- [ ] US → Philippines (USD → PHP) - Coming soon

## 🔄 Payment Flow

1. **Quote**: Get real-time pricing and fees
2. **Initiate**: Create payment with KYC verification
3. **Convert**: USD → USDC via Circle API
4. **Transfer**: USDC via Solana blockchain
5. **Convert**: USDC → Local currency via partner
6. **Settle**: Bank transfer to recipient

## 📞 Support

For questions or support, reach out to the Starling Labs team.

---

**Built with ❤️ by Starling Labs**