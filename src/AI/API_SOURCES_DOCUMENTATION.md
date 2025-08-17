# Enhanced Data Sources API Documentation

## Overview

The analyze-company API endpoint now includes comprehensive `dataSources` information in the response, providing full transparency about where fraud detection data is being scraped from. This enhancement builds trust with users by showing exactly which sources were used for analysis.

## New Response Structure

### Enhanced API Response

```json
{
  "success": true,
  "data": {
    "fraudScore": 25,
    "riskLevel": "low",
    "confidence": 78,
    "analysis": { /* existing analysis data */ },
    "timestamp": "2025-01-14T...",
    "processingTimeMs": 15420,
    "dataSources": {
      "summary": {
        "totalSources": 4,
        "sourcesScraped": 6,
        "dataQuality": "good",
        "aiEnhanced": true
      },
      "sources": [
        {
          "name": "OJK (Financial Services Authority)",
          "type": "regulatory",
          "url": "https://www.ojk.go.id",
          "resultsFound": 3,
          "dataQuality": "good",
          "credibility": "very_high",
          "priority": 1,
          "registrationStatus": "registered",
          "details": [
            {
              "title": "PT Bank Digital - Registered Institution",
              "url": "https://www.ojk.go.id/...",
              "relevance": "high"
            }
          ]
        },
        {
          "name": "Indonesian News Media",
          "type": "news_coverage",
          "url": "multiple",
          "resultsFound": 8,
          "dataQuality": "good",
          "credibility": "high",
          "priority": 4,
          "sentiment": "positive",
          "fraudMentions": 0,
          "details": [
            {
              "title": "Company wins digital innovation award",
              "url": "https://detik.com/...",
              "sentiment": "positive"
            }
          ]
        },
        {
          "name": "Business Directories & Registries",
          "type": "business_verification",
          "url": "multiple",
          "resultsFound": 5,
          "dataQuality": "good",
          "credibility": "medium",
          "priority": 3,
          "digitalFootprint": "strong",
          "legitimacySignals": ["ISO certified", "registered company", "valid permits"]
        },
        {
          "name": "PPATK (Financial Intelligence Unit)",
          "type": "specialized_research",
          "url": "https://www.ppatk.go.id",
          "resultsFound": 1,
          "dataQuality": "limited",
          "credibility": "very_high",
          "priority": 5,
          "specialization": "financial_crime"
        }
      ],
      "searchTerms": {
        "totalTermsUsed": 12,
        "categories": ["base", "legitimacy", "fraud", "regulatory"]
      },
      "performance": {
        "scrapingTimeMs": 8500,
        "earlyTermination": false,
        "efficiency": "high"
      }
    }
  },
  "metadata": {
    "version": "1.0.0",
    "source": "enhanced_intelligent_analysis",
    "cached": false
  }
}
```

## Data Sources Field Structure

### Summary Object
- **totalSources**: Number of distinct sources that provided data
- **sourcesScraped**: Total number of sources attempted during scraping
- **dataQuality**: Overall data quality ("comprehensive", "good", "limited", "minimal")
- **aiEnhanced**: Whether AI-enhanced analysis was used

### Sources Array
Each source object contains:

#### Basic Information
- **name**: Human-readable source name (e.g., "OJK (Financial Services Authority)")
- **type**: Source category (regulatory, news_coverage, business_verification, etc.)
- **url**: Base URL or "multiple" for aggregated sources
- **resultsFound**: Number of relevant results found from this source
- **dataQuality**: Source-specific data quality assessment

#### Credibility Assessment
- **credibility**: Source reliability ("very_high", "high", "medium", "low")
- **priority**: Numeric priority for fraud detection (1 = highest priority)

#### Source-Specific Data
Different source types include additional relevant fields:

**Regulatory Sources (OJK, PPATK):**
- `registrationStatus`: Company's regulatory status
- `details`: Array of specific findings with titles and URLs

**News Sources:**
- `sentiment`: Overall news sentiment ("positive", "negative", "neutral", "mixed")
- `fraudMentions`: Number of articles mentioning fraud
- `details`: Array of news articles with sentiment

**Business Verification:**
- `digitalFootprint`: Digital presence assessment
- `legitimacySignals`: Array of positive business indicators

**Specialized Research:**
- `specialization`: Source focus area (financial_crime, business_registration, etc.)

### Search Terms Object
- **totalTermsUsed**: Total search terms used across all sources
- **categories**: Types of search terms used (base, legitimacy, fraud, regulatory)

### Performance Object
- **scrapingTimeMs**: Time spent on web scraping (milliseconds)
- **earlyTermination**: Whether analysis ended early due to conclusive evidence
- **efficiency**: Scraping efficiency assessment ("high", "standard", "low")

## Source Types and Credibility

### Source Type Categories

1. **regulatory**: Government regulatory agencies (OJK, PPATK)
   - Credibility: very_high
   - Priority: 1-2

2. **news_coverage**: Indonesian news media (Detik, Kompas, Tribun)
   - Credibility: high
   - Priority: 4

3. **business_verification**: Business directories and registries
   - Credibility: medium
   - Priority: 3

4. **fraud_intelligence**: Fraud report databases
   - Credibility: high
   - Priority: 2

5. **specialized_research**: Specialized Indonesian sources
   - Credibility: medium
   - Priority: 5

6. **general**: General web search results
   - Credibility: low
   - Priority: 6

### Indonesian Sources Covered

**Government & Regulatory:**
- OJK (Financial Services Authority): https://www.ojk.go.id
- PPATK (Financial Intelligence Unit): https://www.ppatk.go.id
- AHU (Ministry of Law & Human Rights): https://ahu.go.id

**News Media:**
- Detik News: https://www.detik.com
- Kompas News: https://www.kompas.com
- Tribun News: https://www.tribunnews.com
- Tempo Magazine: https://www.tempo.co

**Business & Community:**
- Yellow Pages Indonesia: https://www.yellowpages.co.id
- Kaskus Forum: https://www.kaskus.co.id

## Usage Examples

### Basic Analysis Request

```bash
curl -X POST http://localhost:3001/analyze-company \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-secure-auth-token-123" \
  -d '{
    "name": "PT Bank Digital Indonesia",
    "description": "Bank digital terdaftar OJK dengan layanan mobile banking",
    "industry": "banking"
  }'
```

### Bulk Analysis with Sources

```bash
curl -X POST http://localhost:3001/analyze-company/bulk \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-secure-auth-token-123" \
  -d '{
    "companies": [
      {
        "name": "PT Aqua Golden Mississippi",
        "description": "Produsen air minum dalam kemasan AQUA",
        "industry": "manufacturing"
      },
      {
        "name": "Suspicious Investment",
        "description": "Guaranteed profit 100% per month",
        "industry": "investment"
      }
    ]
  }'
```

### Source Transparency Demo

```bash
curl -X GET http://localhost:3001/analyze-company/sources-demo \
  -H "Authorization: Bearer test-secure-auth-token-123"
```

## Benefits of Source Transparency

### For Users
- **Trust Building**: See exactly where fraud detection data comes from
- **Verification**: Validate analysis by checking source credibility
- **Understanding**: Learn how different sources contribute to risk assessment

### For Developers
- **Debugging**: Understand why certain fraud scores were assigned
- **Optimization**: Identify which sources provide the most valuable data
- **Compliance**: Meet transparency requirements for financial applications

### For Auditors
- **Traceability**: Full audit trail of data sources used
- **Quality Assessment**: Evaluate data quality and source reliability
- **Regulatory Compliance**: Demonstrate use of authoritative Indonesian sources

## Implementation Notes

- Source information is extracted from both enhanced analysis (stage 2 scraping) and legacy analysis
- Graceful fallback to basic source information when detailed data isn't available
- Performance impact is minimal - source extraction adds <1ms to response time
- Compatible with caching - cached analyses include original source information
- All source URLs are validated and sanitized before inclusion in response

## Testing

Run the test script to verify source transparency functionality:

```bash
node src/AI/test-sources-api.js
```

This will test:
- Single company analysis with source transparency
- Bulk analysis with sources
- Sources demo endpoint
- Source credibility assessment
- Performance metrics inclusion