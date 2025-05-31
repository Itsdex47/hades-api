export interface PaymentRequest {
  senderId: string;
  recipientId: string | null;
  amountUSD: number;
  fromCurrency: Currency;
  toCurrency: Currency;
  recipientDetails: RecipientDetails;
  purpose?: string;
  reference?: string;
}

export interface RecipientDetails {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address: Address;
  bankAccount: BankAccount;
}

export interface Address {
  street: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
}

export interface BankAccount {
  accountNumber: string;
  routingNumber?: string;
  bankName: string;
  bankCode?: string;
  iban?: string;
  swiftCode?: string;
}

export interface PaymentStep {
  stepId: string;
  stepName: PaymentStepType;
  status: StepStatus;
  timestamp: Date;
  details: string;
  transactionHash?: string;
  errorMessage?: string;
}

export interface Payment {
  id: string;
  quoteId: string;
  request: PaymentRequest;
  steps: PaymentStep[];
  blockchain: BlockchainDetails;
  fiat: FiatDetails;
  fees: PaymentFees;
  status: PaymentStatus;
  compliance: ComplianceCheck;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  estimatedCompletionTime: Date;
}

export interface BlockchainDetails {
  network: 'solana' | 'ethereum' | 'polygon';
  stablecoin: 'USDC' | 'USDT' | 'DAI';
  sourceWallet: string;
  destinationWallet: string;
  transactionHash?: string;
  confirmations?: number;
  gasUsed?: number;
}

export interface FiatDetails {
  inputConfirmed: boolean;
  inputReference?: string;
  outputInitiated: boolean;
  outputReference?: string;
  bankTransferStatus?: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface PaymentFees {
  starlingFee: number;
  starlingFeePercent: number;
  blockchainFee: number;
  fxSpread: number;
  partnerFee: number;
  totalFeeUSD: number;
}

export interface ComplianceCheck {
  kycRequired: boolean;
  kycStatus: 'pending' | 'approved' | 'rejected' | 'not_required';
  amlScreening: 'passed' | 'failed' | 'pending' | 'manual_review';
  sanctionsCheck: 'passed' | 'failed' | 'pending';
  riskScore: number; // 0-100
  complianceNotes?: string;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  address?: Address;
  kycStatus: KYCStatus;
  kycDocuments: KYCDocument[];
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface KYCDocument {
  id: string;
  type: DocumentType;
  fileName: string;
  fileUrl: string;
  status: 'pending' | 'approved' | 'rejected';
  uploadedAt: Date;
  reviewedAt?: Date;
  reviewNotes?: string;
}

export interface Quote {
  quoteId: string;
  inputAmount: number;
  inputCurrency: Currency;
  outputAmount: number;
  outputCurrency: Currency;
  exchangeRate: number;
  fees: PaymentFees;
  estimatedTime: string;
  validUntil: Date;
  corridor: string;
  complianceRequired: boolean;
  createdAt: Date;
}

// Enums
export enum Currency {
  USD = 'USD',
  MXN = 'MXN',
  NGN = 'NGN',
  PHP = 'PHP',
  GBP = 'GBP',
  EUR = 'EUR'
}

export enum PaymentStatus {
  CREATED = 'created',
  KYC_PENDING = 'kyc_pending',
  COMPLIANCE_REVIEW = 'compliance_review',
  PROCESSING = 'processing',
  BLOCKCHAIN_PENDING = 'blockchain_pending',
  CONVERTING = 'converting',
  SETTLING = 'settling',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum PaymentStepType {
  INITIATE = 'initiate',
  KYC_CHECK = 'kyc_check',
  COMPLIANCE_SCREEN = 'compliance_screen',
  USD_TO_USDC = 'usd_to_usdc',
  BLOCKCHAIN_TRANSFER = 'blockchain_transfer',
  USDC_TO_LOCAL = 'usdc_to_local',
  BANK_TRANSFER = 'bank_transfer',
  COMPLETE = 'complete'
}

export enum StepStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped'
}

export enum KYCStatus {
  NOT_STARTED = 'not_started',
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired'
}

export enum DocumentType {
  PASSPORT = 'passport',
  DRIVERS_LICENSE = 'drivers_license',
  NATIONAL_ID = 'national_id',
  PROOF_OF_ADDRESS = 'proof_of_address',
  BANK_STATEMENT = 'bank_statement'
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Error Types
export class PaymentError extends Error {
  public code: string;
  public statusCode: number;
  
  constructor(message: string, code: string, statusCode: number = 400) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.name = 'PaymentError';
  }
}

export class ComplianceError extends PaymentError {
  constructor(message: string, code: string = 'COMPLIANCE_FAILED') {
    super(message, code, 403);
    this.name = 'ComplianceError';
  }
}

export class BlockchainError extends PaymentError {
  public transactionHash?: string;
  
  constructor(message: string, code: string = 'BLOCKCHAIN_ERROR', transactionHash?: string) {
    super(message, code, 500);
    this.transactionHash = transactionHash;
    this.name = 'BlockchainError';
  }
}