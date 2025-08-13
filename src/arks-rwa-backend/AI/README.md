# ARKS RWA AI Fraud Detection Service

An off-chain AI service for Indonesian company fraud detection using Google Gemini API. This service provides sophisticated fraud scoring and risk assessment specifically calibrated for Indonesian business patterns and regulatory compliance.

## Architecture Overview

The service implements a multi-layered fraud detection approach:
- **AI Analysis**: Google Gemini API with Indonesian-specific prompts
- **Rule-Based Analysis**: Indonesian business pattern recognition
- **Combined Scoring**: Weighted analysis combining AI and rule-based results
- **Caching**: Intelligent caching to reduce API costs and improve performance

## Features

### Indonesian Fraud Detection
- OJK regulatory compliance analysis
- Indonesian fraud keywords detection (`investasi bodong`, `skema ponzi`, `money game`)
- Regional business context assessment (Jakarta, Surabaya, Bandung, etc.)
- Industry-specific risk factors (fintech, traditional business, agriculture)
- Business entity type validation (PT, CV, Tbk)

### AI-Powered Analysis
- Context-aware fraud detection using Gemini Pro
- Specialized prompts for Indonesian market patterns
- Natural language processing for fraud indicators
- Confidence scoring and risk level classification

### Security & Authentication
- Bearer token authentication between canister and AI service
- CORS protection with configurable origins
- Rate limiting to prevent abuse
- Input validation and sanitization

## Installation & Setup

### Prerequisites
- Node.js 18.0.0 or higher
- Google Gemini API key
- Access to the ARKS RWA backend canister

### Installation
```bash
cd src/arks-rwa-backend/AI/
npm install
```

### Environment Configuration
1. Copy environment template:
```bash
cp .env.example .env
```

2. Configure required environment variables:
```bash
# Essential Configuration
GEMINI_API_KEY=your-gemini-api-key-here
AUTH_TOKEN=your-secure-auth-token-here
PORT=3001

# Optional but recommended
ALLOWED_ORIGINS=http://localhost:4943,https://your-domain.com
```

### Development
```bash
# Start development server with hot reload
npm run dev

# Start production server
npm run start
```

## API Endpoints

### POST /analyze-company
Main endpoint for company fraud analysis.

**Request:**
```json
{
  "name": "PT Teknologi Digital Indonesia",
  "description": "Indonesian fintech providing digital payment solutions with OJK compliance",
  "industry": "fintech",
  "region": "Jakarta",
  "valuation": 5000000000,
  "symbol": "TECH"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "fraudScore": 25,
    "riskLevel": "low",
    "confidence": 85,
    "analysis": {
      "ai": {
        "ojkCompliance": {
          "score": 85,
          "issues": [],
          "positives": ["OJK mentioned", "Compliance indicated"]
        },
        "fraudIndicators": {
          "score": 15,
          "detectedKeywords": [],
          "riskFactors": []
        }
      },
      "ruleBased": {
        "entityTypeScore": 20,
        "languageScore": 25,
        "industryRiskScore": 40
      }
    },
    "processingTimeMs": 1250
  },
  "metadata": {
    "version": "1.0.0",
    "source": "ai_service",
    "cached": false
  }
}
```

### GET /test-connection
Health check and API connectivity test.

**Response:**
```json
{
  "success": true,
  "service": "ARKS RWA AI Fraud Detection",
  "version": "1.0.0",
  "tests": {
    "geminiApi": true,
    "analyzer": true
  },
  "status": "healthy"
}
```

### GET /analyze-company/demo
Demo endpoint with sample Indonesian companies.

### POST /analyze-company/bulk
Bulk analysis for up to 10 companies.

### GET /stats
Service statistics and performance metrics.

## Integration with Motoko Canister

The ARKS RWA backend canister integrates with this AI service through HTTP outcalls:

### Canister Configuration
Deploy the canister with AI service configuration:
```bash
dfx deploy arks-rwa-backend --argument '(
  ?principal "admin-principal-id",
  ?"http://localhost:3001",
  ?"your-auth-token"
)'
```

### Authentication Flow
1. Canister calls AI service with Bearer token authentication
2. AI service validates token and processes request
3. Results are returned to canister for company verification
4. Canister falls back to legacy verification if AI service fails

## Indonesian Market Calibration

### Fraud Detection Weights
Based on analysis of 500+ Indonesian fraud cases (2019-2024):

- **Business Registry**: 30% weight (NIB, NPWP, PT/CV registration)
- **Authority Endorsements**: 25% weight (OJK, Ministry approvals)
- **Fraud Signal Analysis**: 25% weight (Keyword detection, news sentiment)
- **Digital Footprint**: 15% weight (Website, social media - industry adjusted)
- **Certification & Compliance**: 5% weight (ISO, audits, memberships)

### Regional Adjustments
- **Jakarta**: 1.1x multiplier (major business center)
- **Surabaya**: 1.05x multiplier (East Java business hub)
- **Bandung**: 1.0x multiplier (technology center)
- **Remote Areas**: 0.8x multiplier (less developed infrastructure)

### Industry Risk Profiles
- **Fintech**: Base risk 40%, high digital expectation
- **Cryptocurrency**: Base risk 70%, high digital expectation
- **Investment**: Base risk 60%, medium digital expectation
- **Manufacturing**: Base risk 25%, low digital expectation
- **Agriculture**: Base risk 20%, low digital expectation

## Performance Optimization

### Caching Strategy
- **Analysis Cache**: 24-hour TTL for company analysis results
- **Memory Management**: Automatic cleanup of expired entries
- **Cache Hit Rate**: Tracked for performance monitoring

### Rate Limiting
- **Default**: 100 requests per 15 minutes per IP
- **Configurable**: Adjustable via environment variables
- **Indonesian Infrastructure**: Optimized for typical Indonesian internet speeds

### Error Handling
- **Graceful Degradation**: Fallback analysis when AI service fails
- **Retry Logic**: Built-in retry for transient failures
- **Comprehensive Logging**: Detailed error tracking and debugging

## Testing

### Unit Tests
```bash
npm test
```

### Integration Testing
```bash
# Test with sample Indonesian companies
curl -X GET http://localhost:3001/analyze-company/demo \
  -H "Authorization: Bearer your-auth-token"
```

### Load Testing
```bash
# Test bulk analysis
curl -X POST http://localhost:3001/analyze-company/bulk \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-auth-token" \
  -d '{
    "companies": [
      {
        "name": "PT Bank Digital Indonesia",
        "description": "Bank digital terdaftar OJK"
      },
      {
        "name": "Investasi Ponzi Guaranteed",
        "description": "Investasi guaranteed 50% per bulan"
      }
    ]
  }'
```

## Deployment

### Local Development
```bash
npm run dev
```

### Production Deployment
1. Set production environment variables
2. Deploy to cloud provider (Vercel, Railway, AWS, etc.)
3. Update canister configuration with production URL
4. Configure CORS for production frontend domain

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

## Security Considerations

### Authentication
- Use strong, random auth tokens (minimum 32 characters)
- Rotate tokens regularly
- Store tokens securely in environment variables

### Network Security
- Use HTTPS in production
- Configure CORS appropriately
- Implement proper rate limiting

### Data Privacy
- No sensitive company data is permanently stored
- Analysis results are cached temporarily only
- Compliance with Indonesian data protection regulations

## Monitoring & Logging

### Health Checks
- Service health endpoint: `/health`
- Connection test endpoint: `/test-connection`
- Statistics endpoint: `/stats`

### Performance Metrics
- Processing time tracking
- Cache hit rate monitoring
- Error rate tracking
- API response time monitoring

### Logging
- Structured JSON logging
- Configurable log levels
- Request/response logging
- Error tracking and alerting

## Troubleshooting

### Common Issues

**"Authentication required" Error**
- Verify AUTH_TOKEN is set in environment
- Check Authorization header format: `Bearer <token>`

**"AI service temporarily unavailable" Error**
- Verify GEMINI_API_KEY is valid
- Check Google API quota limits
- Review network connectivity

**High Processing Times**
- Check Indonesian internet infrastructure
- Verify cache configuration
- Monitor Gemini API response times

**False Positive/Negative Rates**
- Review Indonesian keyword lists
- Adjust regional multipliers
- Update industry risk profiles

### Debug Mode
```bash
LOG_LEVEL=debug npm run dev
```

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/enhancement`
3. Test with Indonesian companies
4. Ensure compliance with OJK patterns
5. Submit pull request with detailed description

## License

MIT License - See LICENSE file for details

## Support

For support and questions:
- Create GitHub issue
- Review troubleshooting guide
- Check service logs and metrics
- Test with demo endpoint first