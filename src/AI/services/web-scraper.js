import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';
import axios from 'axios';
import UserAgent from 'user-agents';

/**
 * Web Scraping Service for Indonesian Company Research
 * Scrapes OJK database, news sites, and business directories
 */
class WebScrapingService {
  constructor() {
    this.browser = null;
    this.userAgent = new UserAgent();
    
    this.config = {
      // Request delays to avoid being blocked
      minDelay: 2000, // 2 seconds
      maxDelay: 5000, // 5 seconds
      
      // Timeout settings
      pageTimeout: 30000,
      requestTimeout: 15000,
      
      // Anti-detection settings - ENSURE headless mode for production  
      headless: process.env.PUPPETEER_HEADLESS === 'false' ? false : 'new', // Use new headless mode for better performance
      viewport: { width: 1366, height: 768 },
      
      // Cache settings
      cacheExpiryHours: 24,
      
      // Target websites configuration
      targets: {
        ojk: {
          baseUrl: 'https://www.ojk.go.id',
          searchUrl: 'https://www.google.com/search?q=site%3Aojk.go.id+',
          selectors: {
            results: '.search-result',
            title: 'h3',
            snippet: '.search-snippet'
          }
        },
        google: {
          baseUrl: 'https://www.google.com/search?q=',
          selectors: {
            results: '[data-ved]',
            title: 'h3',
            snippet: '[data-sncf="1"]'
          }
        },
        detik: {
          baseUrl: 'https://www.detik.com',
          searchUrl: 'https://www.google.com/search?q=site%3Adetik.com+',
          selectors: {
            results: '.search-result',
            title: 'h3',
            content: '.detail-content'
          }
        }
      }
    };
    
    // Results cache
    this.searchCache = new Map();
  }

  /**
   * Initialize browser instance with anti-detection measures
   */
  async initializeBrowser() {
    if (this.browser) return this.browser;
    
    try {
      this.browser = await puppeteer.launch({
        headless: this.config.headless, // Using 'new' headless mode
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-extensions',
          '--disable-default-apps',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection'
        ]
      });
      
      console.log('🚀 Web scraper browser initialized');
      return this.browser;
    } catch (error) {
      console.error('Browser initialization failed:', error);
      throw new Error('Failed to initialize web scraper browser');
    }
  }

  /**
   * Main function to research Indonesian company
   */
  async researchCompany(companyName, region = 'Indonesia') {
    try {
      console.log(`🔍 Starting web research for: ${companyName}`);
      
      // Check cache first
      const cacheKey = this.generateCacheKey(companyName, region);
      const cachedResult = this.getFromCache(cacheKey);
      if (cachedResult) {
        console.log(`📋 Using cached research for: ${companyName}`);
        return cachedResult;
      }

      const research = {
        companyName,
        region,
        timestamp: new Date().toISOString(),
        sources: {
          ojk: await this.scrapeOJKInformation(companyName),
          news: await this.scrapeNewsArticles(companyName),
          businessInfo: await this.scrapeBusinessInformation(companyName),
          fraudReports: await this.scrapeFraudReports(companyName)
        },
        summary: null
      };

      // Generate research summary
      research.summary = this.generateResearchSummary(research.sources);

      // Cache the results
      this.addToCache(cacheKey, research);
      
      console.log(`✅ Web research completed for: ${companyName}`);
      return research;

    } catch (error) {
      console.error(`Web research failed for ${companyName}:`, error);
      return this.generateFallbackResearch(companyName, region, error);
    }
  }

  /**
   * Scrape OJK (Financial Services Authority) information
   */
  async scrapeOJKInformation(companyName) {
    try {
      const searchQuery = `site:ojk.go.id "${companyName}" OR "${companyName}" terdaftar`;
      const results = await this.performGoogleSearch(searchQuery, 'ojk');
      
      return {
        registrationStatus: this.analyzeOJKResults(results),
        foundEntries: results.length,
        details: results.slice(0, 3), // Top 3 results
        searchQuery
      };
    } catch (error) {
      console.error('OJK scraping failed:', error);
      return {
        registrationStatus: 'unknown',
        foundEntries: 0,
        details: [],
        error: error.message
      };
    }
  }

  /**
   * Scrape Indonesian news articles about the company
   */
  async scrapeNewsArticles(companyName) {
    try {
      const queries = [
        `"${companyName}" Indonesia berita`,
        `"${companyName}" penipuan scam`,
        `"${companyName}" review pengalaman`
      ];

      const allResults = [];
      for (const query of queries) {
        await this.randomDelay();
        const results = await this.performGoogleSearch(query, 'news');
        allResults.push(...results);
      }

      return {
        totalArticles: allResults.length,
        sentiment: this.analyzeNewsSentiment(allResults),
        fraudMentions: this.detectFraudMentions(allResults),
        articles: allResults.slice(0, 5) // Top 5 articles
      };
    } catch (error) {
      console.error('News scraping failed:', error);
      return {
        totalArticles: 0,
        sentiment: 'neutral',
        fraudMentions: 0,
        articles: [],
        error: error.message
      };
    }
  }

  /**
   * Scrape general business information
   */
  async scrapeBusinessInformation(companyName) {
    try {
      const searchQuery = `"${companyName}" NPWP NIB "terdaftar resmi" Indonesia`;
      const results = await this.performGoogleSearch(searchQuery, 'business');
      
      return {
        businessRegistration: this.analyzeBusinessRegistration(results),
        digitalFootprint: this.analyzeDigitalFootprint(results),
        legitimacySignals: this.extractLegitimacySignals(results),
        foundSources: results.length
      };
    } catch (error) {
      console.error('Business info scraping failed:', error);
      return {
        businessRegistration: 'unknown',
        digitalFootprint: 'minimal',
        legitimacySignals: [],
        foundSources: 0,
        error: error.message
      };
    }
  }

  /**
   * Scrape fraud reports and warnings
   */
  async scrapeFraudReports(companyName) {
    try {
      const fraudQuery = `"${companyName}" "investasi bodong" OR "penipuan" OR "scam" OR "kerugian" Indonesia`;
      const results = await this.performGoogleSearch(fraudQuery, 'fraud');
      
      return {
        fraudReportsFound: results.length,
        riskLevel: this.assessFraudRisk(results),
        warnings: this.extractWarnings(results),
        sources: results.slice(0, 3) // Top 3 fraud-related results
      };
    } catch (error) {
      console.error('Fraud reports scraping failed:', error);
      return {
        fraudReportsFound: 0,
        riskLevel: 'unknown',
        warnings: [],
        sources: [],
        error: error.message
      };
    }
  }

  /**
   * Perform Google search with anti-detection measures
   */
  async performGoogleSearch(query, category) {
    try {
      await this.initializeBrowser();
      const page = await this.browser.newPage();
      
      // Set random user agent
      await page.setUserAgent(this.userAgent.toString());
      
      // Set viewport
      await page.setViewport(this.config.viewport);
      
      // Navigate to Google search
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=id&gl=ID`;
      await page.goto(searchUrl, { 
        waitUntil: 'networkidle2', 
        timeout: this.config.pageTimeout 
      });
      
      // Wait for results to load
      await page.waitForSelector('div[data-ved]', { timeout: 10000 });
      
      // Extract search results
      const results = await page.evaluate(() => {
        const resultElements = document.querySelectorAll('div[data-ved]');
        const results = [];
        
        resultElements.forEach((element, index) => {
          if (index >= 10) return; // Limit to top 10 results
          
          const titleElement = element.querySelector('h3');
          const linkElement = element.querySelector('a');
          const snippetElement = element.querySelector('[data-sncf="1"], .VwiC3b');
          
          if (titleElement && linkElement) {
            results.push({
              title: titleElement.textContent?.trim() || '',
              url: linkElement.href || '',
              snippet: snippetElement?.textContent?.trim() || '',
              position: index + 1
            });
          }
        });
        
        return results;
      });
      
      await page.close();
      return results;
      
    } catch (error) {
      console.error(`Google search failed for query: ${query}`, error);
      return [];
    }
  }

  /**
   * Analyze OJK registration results
   */
  analyzeOJKResults(results) {
    if (results.length === 0) return 'not_found';
    
    const ojkKeywords = ['terdaftar', 'registered', 'license', 'izin', 'berizin'];
    const negativeKeywords = ['tidak terdaftar', 'peringatan', 'warning'];
    
    let positiveScore = 0;
    let negativeScore = 0;
    
    results.forEach(result => {
      const text = `${result.title} ${result.snippet}`.toLowerCase();
      
      ojkKeywords.forEach(keyword => {
        if (text.includes(keyword)) positiveScore++;
      });
      
      negativeKeywords.forEach(keyword => {
        if (text.includes(keyword)) negativeScore++;
      });
    });
    
    if (negativeScore > positiveScore) return 'warning_issued';
    if (positiveScore > 0) return 'registered';
    return 'mentioned_only';
  }

  /**
   * Analyze news sentiment
   */
  analyzeNewsSentiment(articles) {
    if (articles.length === 0) return 'neutral';
    
    const positiveKeywords = ['sukses', 'berkembang', 'terpercaya', 'resmi', 'legal'];
    const negativeKeywords = ['penipuan', 'scam', 'kerugian', 'komplain', 'bermasalah'];
    
    let positiveCount = 0;
    let negativeCount = 0;
    
    articles.forEach(article => {
      const text = `${article.title} ${article.snippet}`.toLowerCase();
      
      positiveKeywords.forEach(keyword => {
        if (text.includes(keyword)) positiveCount++;
      });
      
      negativeKeywords.forEach(keyword => {
        if (text.includes(keyword)) negativeCount++;
      });
    });
    
    const ratio = positiveCount / Math.max(negativeCount, 1);
    
    if (ratio > 1.5) return 'positive';
    if (ratio < 0.5) return 'negative';
    return 'mixed';
  }

  /**
   * Detect fraud mentions in search results
   */
  detectFraudMentions(results) {
    const fraudKeywords = ['penipuan', 'scam', 'investasi bodong', 'ponzi', 'money game'];
    let fraudCount = 0;
    
    results.forEach(result => {
      const text = `${result.title} ${result.snippet}`.toLowerCase();
      fraudKeywords.forEach(keyword => {
        if (text.includes(keyword)) fraudCount++;
      });
    });
    
    return fraudCount;
  }

  /**
   * Generate research summary
   */
  generateResearchSummary(sources) {
    const summary = {
      overallRisk: 'medium',
      confidence: 0,
      keyFindings: [],
      dataQuality: 'partial'
    };

    // Analyze OJK status
    if (sources.ojk.registrationStatus === 'registered') {
      summary.keyFindings.push('Registered with OJK');
      summary.confidence += 30;
    } else if (sources.ojk.registrationStatus === 'warning_issued') {
      summary.keyFindings.push('OJK warning found');
      summary.overallRisk = 'high';
      summary.confidence += 40;
    }

    // Analyze news sentiment
    if (sources.news.sentiment === 'negative' || sources.news.fraudMentions > 2) {
      summary.keyFindings.push('Negative news coverage found');
      summary.overallRisk = 'high';
      summary.confidence += 25;
    } else if (sources.news.sentiment === 'positive') {
      summary.keyFindings.push('Positive news coverage');
      summary.confidence += 15;
    }

    // Analyze fraud reports
    if (sources.fraudReports.fraudReportsFound > 0) {
      summary.keyFindings.push('Fraud reports found');
      summary.overallRisk = 'high';
      summary.confidence += 35;
    }

    // Determine data quality
    const totalSources = sources.ojk.foundEntries + sources.news.totalArticles + sources.businessInfo.foundSources;
    if (totalSources > 10) summary.dataQuality = 'comprehensive';
    else if (totalSources > 5) summary.dataQuality = 'good';
    else if (totalSources > 0) summary.dataQuality = 'limited';
    else summary.dataQuality = 'minimal';

    return summary;
  }

  /**
   * Utility functions
   */
  async randomDelay() {
    const delay = Math.random() * (this.config.maxDelay - this.config.minDelay) + this.config.minDelay;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  generateCacheKey(companyName, region) {
    return Buffer.from(`${companyName}:${region}:web_research`).toString('base64');
  }

  getFromCache(key) {
    const cached = this.searchCache.get(key);
    if (!cached) return null;
    
    const now = new Date();
    const expiry = new Date(cached.timestamp);
    expiry.setHours(expiry.getHours() + this.config.cacheExpiryHours);
    
    if (now > expiry) {
      this.searchCache.delete(key);
      return null;
    }
    
    return cached;
  }

  addToCache(key, research) {
    this.searchCache.set(key, research);
  }

  generateFallbackResearch(companyName, region, error) {
    return {
      companyName,
      region,
      timestamp: new Date().toISOString(),
      sources: {
        ojk: { registrationStatus: 'unknown', error: error.message },
        news: { totalArticles: 0, sentiment: 'neutral', error: error.message },
        businessInfo: { businessRegistration: 'unknown', error: error.message },
        fraudReports: { fraudReportsFound: 0, riskLevel: 'unknown', error: error.message }
      },
      summary: {
        overallRisk: 'unknown',
        confidence: 0,
        keyFindings: ['Web research unavailable'],
        dataQuality: 'unavailable'
      },
      fallback: true
    };
  }

  /**
   * Additional analysis methods
   */
  analyzeBusinessRegistration(results) {
    const registrationKeywords = ['npwp', 'nib', 'siup', 'terdaftar resmi'];
    let score = 0;
    
    results.forEach(result => {
      const text = `${result.title} ${result.snippet}`.toLowerCase();
      registrationKeywords.forEach(keyword => {
        if (text.includes(keyword)) score++;
      });
    });
    
    if (score >= 3) return 'well_documented';
    if (score >= 1) return 'partially_documented';
    return 'unknown';
  }

  analyzeDigitalFootprint(results) {
    const digitalKeywords = ['website', 'facebook', 'instagram', 'linkedin', 'twitter'];
    let footprintScore = 0;
    
    results.forEach(result => {
      const text = `${result.title} ${result.snippet}`.toLowerCase();
      digitalKeywords.forEach(keyword => {
        if (text.includes(keyword)) footprintScore++;
      });
    });
    
    if (footprintScore >= 3) return 'strong';
    if (footprintScore >= 1) return 'moderate';
    return 'minimal';
  }

  extractLegitimacySignals(results) {
    const signals = [];
    const legitimacyKeywords = ['iso certified', 'audit', 'compliance', 'award', 'penghargaan'];
    
    results.forEach(result => {
      const text = `${result.title} ${result.snippet}`.toLowerCase();
      legitimacyKeywords.forEach(keyword => {
        if (text.includes(keyword)) {
          signals.push(keyword);
        }
      });
    });
    
    return [...new Set(signals)]; // Remove duplicates
  }

  assessFraudRisk(results) {
    if (results.length === 0) return 'low';
    if (results.length >= 3) return 'high';
    return 'medium';
  }

  extractWarnings(results) {
    return results
      .filter(result => {
        const text = `${result.title} ${result.snippet}`.toLowerCase();
        return text.includes('peringatan') || text.includes('warning') || text.includes('waspada');
      })
      .map(result => ({
        title: result.title,
        source: new URL(result.url).hostname,
        snippet: result.snippet
      }));
  }

  /**
   * Cleanup browser resources
   */
  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log('🧹 Web scraper browser closed');
    }
  }
}

export default WebScrapingService;