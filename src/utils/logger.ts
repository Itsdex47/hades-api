/**
 * Winston Logger Configuration
 * Comprehensive logging for Starling Remittance API
 */

import winston from 'winston';
import path from 'path';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Tell winston that you want to link the colors
winston.addColors(colors);

// Define format for logs
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}${
      Object.keys(info).length > 3 ? 
        ' ' + JSON.stringify(Object.fromEntries(
          Object.entries(info).filter(([key]) => !['timestamp', 'level', 'message'].includes(key))
        ), null, 2) 
        : ''
    }`
  ),
);

// Define transports
const transports = [
  // Console transport for development
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      format
    )
  }),
  
  // File transport for errors
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'error.log'),
    level: 'error',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  }),
  
  // File transport for all logs
  new winston.transports.File({
    filename: path.join(process.cwd(), 'logs', 'combined.log'),
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  }),
];

// Production-specific transports
if (process.env.NODE_ENV === 'production') {
  // Add production-specific transports here
  // For example, CloudWatch, Datadog, etc.
}

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'development' ? 'debug' : 'info'),
  levels,
  format,
  transports,
  
  // Don't exit on handled exceptions
  exitOnError: false,
  
  // Handle uncaught exceptions
  exceptionHandlers: [
    new winston.transports.File({ 
      filename: path.join(process.cwd(), 'logs', 'exceptions.log') 
    })
  ],
  
  // Handle unhandled promise rejections
  rejectionHandlers: [
    new winston.transports.File({ 
      filename: path.join(process.cwd(), 'logs', 'rejections.log') 
    })
  ]
});

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Ensure we log unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
});

// Ensure we log uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

// Add structured logging methods
const structuredLogger = {
  ...logger,
  
  // API request logging
  logRequest: (req: any, res: any, responseTime: number) => {
    logger.info('API Request', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      contentLength: res.get('content-length')
    });
  },
  
  // Payment logging
  logPayment: (paymentData: any) => {
    logger.info('Payment Processing', {
      paymentId: paymentData.id,
      amount: paymentData.amount,
      currency: paymentData.currency,
      rail: paymentData.rail,
      status: paymentData.status,
      processingTime: paymentData.processingTime
    });
  },
  
  // Compliance logging
  logCompliance: (type: string, data: any) => {
    logger.info(`Compliance ${type}`, {
      type,
      userId: data.userId,
      result: data.result,
      riskScore: data.riskScore,
      flags: data.flags
    });
  },
  
  // Security logging
  logSecurity: (event: string, data: any) => {
    logger.warn(`Security Event: ${event}`, {
      event,
      ip: data.ip,
      userAgent: data.userAgent,
      timestamp: new Date().toISOString(),
      ...data
    });
  },
  
  // Business metrics logging
  logMetrics: (metrics: any) => {
    logger.info('Business Metrics', {
      timestamp: new Date().toISOString(),
      ...metrics
    });
  },
  
  // Error with context
  logError: (error: Error, context?: any) => {
    logger.error('Application Error', {
      error: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString()
    });
  }
};

export default logger;
