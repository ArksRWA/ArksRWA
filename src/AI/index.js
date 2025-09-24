import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import analyzeRoutes from './routes/analyze.js';
import authMiddleware from './middleware/auth.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:4943'],
  credentials: true
}));

// Rate limiting - Indonesian internet infrastructure consideration
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'ARKS RWA AI Fraud Detection',
    version: '1.0.0'
  });
});

// Authentication middleware for protected routes
app.use('/analyze', authMiddleware);

// Analysis routes
app.use('/', analyzeRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  if (err.type === 'validation') {
    return res.status(400).json({
      error: 'Validation error',
      details: err.message
    });
  }
  
  if (err.type === 'gemini_api') {
    return res.status(503).json({
      error: 'AI service temporarily unavailable',
      message: 'Please try again later'
    });
  }
  
  res.status(500).json({
    error: 'Internal server error',
    message: 'An unexpected error occurred'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: 'The requested endpoint does not exist'
  });
});

// Start server with extended timeout support
const server = app.listen(PORT, () => {
  console.log(`🚀 ARKS RWA AI Service running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔐 Auth required: ${process.env.AUTH_TOKEN ? 'Yes' : 'No'}`);
  console.log(`🤖 Gemini API: ${process.env.GEMINI_API_KEY ? 'Configured' : 'Missing'}`);
  
  // Configure extended timeout support for worst-case scenarios (15 minutes)
  const serverTimeout = parseInt(process.env.EXPRESS_SERVER_TIMEOUT_MS) || 960000; // 16 minutes default
  server.timeout = serverTimeout;
  server.keepAliveTimeout = serverTimeout;
  server.headersTimeout = serverTimeout + 1000; // Slightly longer than server timeout
  
  console.log(`⏱️ Server timeout configured: ${serverTimeout}ms (${serverTimeout/60000} minutes)`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  process.exit(0);
});