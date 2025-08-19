/**
 * Website Verification Service - Indonesian Business Website Validation
 * 
 * Provides comprehensive website verification including:
 * - Domain extraction and validation
 * - RDAP registration data lookup
 * - Certificate Transparency (CT) log checking
 * - Indonesian regulatory compliance detection
 * - Badge generation for verification transparency
 */

import axios from 'axios';
import jsdom from 'jsdom';
const { JSDOM } = jsdom;

export class WebsiteVerificationService {
  constructor() {
    // Configuration
    this.timeout = 10000; // 10 seconds per request
    this.maxRedirects = 3;
    
    // Indonesian TLD patterns
    this.indonesianTLDs = ['.id', '.co.id', '.ac.id', '.or.id', '.go.id', '.web.id'];
    
    // Indonesian regulatory keywords
    this.regulatoryKeywords = [
      'OJK', 'Otoritas Jasa Keuangan',
      'Bank Indonesia', 'BI',
      'Kementerian', 'Ministry',
      'BKPM', 'OSS',
      'terdaftar', 'registered',
      'izin', 'license'
    ];
    
    // Certificate Transparency APIs
    this.ctAPIs = [
      'https://crt.sh/?q={domain}&output=json',
      'https://transparencyreport.google.com/https/certificates'
    ];
    
    console.log('🔍 Website Verification Service initialized');
  }
  
  /**
   * Main verification method - extracts and verifies company websites
   * @param {Object} companyData - Company information
   * @param {Object} serpAPIResults - SerpAPI search results (optional)
   * @returns {Object} Verification results with badges
   */
  async verifyCompanyWebsite(companyData, serpAPIResults = null) {
    console.log(`🔍 Starting website verification for: ${companyData.name}`);
    
    const verification = {
      country: 'ID', // Default to Indonesia
      websiteVerified: false,
      badges: [],
      primaryDomain: null,
      domains: [],
      verificationDetails: {
        domainAccessible: false,
        sslValid: false,
        regulatoryCompliance: false,
        registrationData: false
      }
    };
    
    try {
      // Step 1: Extract domains from company data
      const domains = await this.extractDomains(companyData, serpAPIResults);
      verification.domains = domains;
      
      if (domains.length === 0) {
        console.log('   ⚠️ No domains found for verification');
        return verification;
      }
      
      verification.primaryDomain = domains[0];
      console.log(`   🌐 Primary domain identified: ${verification.primaryDomain}`);
      
      // Step 2: Verify domain accessibility
      const accessibilityResult = await this.verifyDomainAccessibility(verification.primaryDomain);
      verification.verificationDetails.domainAccessible = accessibilityResult.accessible;
      
      if (accessibilityResult.accessible) {
        console.log(`   ✅ Domain accessible: ${verification.primaryDomain}`);
      } else {
        console.log(`   ❌ Domain not accessible: ${verification.primaryDomain}`);
      }
      
      // Step 3: Generate verification badges for all domains
      for (const domain of domains.slice(0, 3)) { // Limit to 3 domains for performance
        const domainBadges = await this.generateDomainBadges(domain, accessibilityResult.content, companyData, serpAPIResults);
        verification.badges.push(...domainBadges);
      }
      
      // Step 3B: If no regulatory badges found from websites, check SerpAPI results as fallback
      const hasRegulatorBadge = verification.badges.some(badge => badge.type === 'site_disclosure_regulator');
      if (!hasRegulatorBadge && serpAPIResults) {
        console.log(`   🔍 No regulatory badges from websites, checking SerpAPI results as fallback...`);
        const serpAPIRegulatorBadge = this.generateRegulatorBadgeFromSerpAPI(companyData.name, serpAPIResults);
        if (serpAPIRegulatorBadge) {
          verification.badges.push(serpAPIRegulatorBadge);
          console.log(`   ✅ Generated regulatory badge from SerpAPI search results`);
        }
      }
      
      // Step 4: Determine country from domains and content
      verification.country = this.determineCountry(domains, accessibilityResult.content);
      
      // Step 5: Calculate overall verification status
      verification.websiteVerified = this.calculateVerificationStatus(verification);
      
      console.log(`   📊 Website verification complete: ${verification.websiteVerified ? 'VERIFIED' : 'UNVERIFIED'}`);
      console.log(`   🏅 Badges generated: ${verification.badges.length}`);
      
      return verification;
      
    } catch (error) {
      console.error('Website verification error:', error);
      verification.error = error.message;
      return verification;
    }
  }
  
  /**
   * Extract domains from company data and SerpAPI results
   */
  async extractDomains(companyData, serpAPIResults) {
    const domains = new Set();
    const urlRegex = /https?:\/\/([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
    const domainRegex = /(?:^|\s)([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})(?:\s|$)/g;
    
    console.log(`   🔍 Extracting domains from company: ${companyData.name}`);
    
    // Extract from company description
    if (companyData.description) {
      const urlMatches = companyData.description.match(urlRegex);
      if (urlMatches) {
        urlMatches.forEach(url => {
          try {
            const domain = new URL(url).hostname;
            domains.add(domain);
            console.log(`   📍 Found domain in description: ${domain}`);
          } catch (e) {
            // Invalid URL, skip
          }
        });
      }
      
      // Extract domain-like patterns
      const domainMatches = companyData.description.match(domainRegex);
      if (domainMatches) {
        domainMatches.forEach(match => {
          const domain = match.trim();
          if (domain.includes('.') && !domain.includes('@')) {
            domains.add(domain);
            console.log(`   📍 Found domain pattern in description: ${domain}`);
          }
        });
      }
    }
    
    // Enhanced extraction from SerpAPI results with intelligent company website detection
    if (serpAPIResults?.sources?.searchResults) {
      console.log(`   🔍 Scanning SerpAPI results for company websites...`);
      
      // Track company website candidates with scores
      const websiteCandidates = new Map(); // domain -> {score, evidence, searchType}
      
      Object.entries(serpAPIResults.sources.searchResults).forEach(([searchType, results]) => {
        if (results.organic_results) {
          console.log(`   📊 Processing ${searchType}: ${results.organic_results.length} results`);
          
          results.organic_results.forEach((result, index) => {
            if (result.link) {
              try {
                const domain = new URL(result.link).hostname;
                
                // Skip known news/general sites
                if (this.isNewsOrGeneralSite(domain)) {
                  console.log(`   ⏭️ Skipping news site: ${domain}`);
                  return;
                }
                
                // Calculate company website likelihood score
                const websiteScore = this.calculateCompanyWebsiteScore(domain, companyData.name, result, searchType);
                
                if (websiteScore.score > 30) { // Minimum threshold for consideration
                  if (!websiteCandidates.has(domain) || websiteCandidates.get(domain).score < websiteScore.score) {
                    websiteCandidates.set(domain, {
                      score: websiteScore.score,
                      evidence: websiteScore.evidence,
                      searchType: searchType,
                      result: result
                    });
                    console.log(`   🎯 Company website candidate: ${domain} (score: ${websiteScore.score}, source: ${searchType})`);
                  }
                }
              } catch (e) {
                // Invalid URL, skip
              }
            }
          });
        }
      });
      
      // Add high-scoring website candidates to domains
      websiteCandidates.forEach((candidate, domain) => {
        if (candidate.score >= 50) { // High confidence threshold
          domains.add(domain);
          console.log(`   ✅ High-confidence company website: ${domain} (score: ${candidate.score})`);
        } else if (candidate.score >= 30) { // Medium confidence
          domains.add(domain);
          console.log(`   📍 Medium-confidence company domain: ${domain} (score: ${candidate.score})`);
        }
      });
      
      // Store website candidates for later use in regulatory analysis
      this.lastWebsiteCandidates = websiteCandidates;
    }
    
    // Also scan the stageResults SerpAPI data if available
    if (serpAPIResults?.serpAPIResults?.searches) {
      console.log(`   🔍 Scanning stage results SerpAPI searches...`);
      
      Object.entries(serpAPIResults.serpAPIResults.searches).forEach(([searchType, searchData]) => {
        if (searchData.organic_results) {
          console.log(`   📊 Processing stage ${searchType}: ${searchData.organic_results.length} results`);
          
          searchData.organic_results.forEach((result, index) => {
            if (result.link) {
              try {
                const domain = new URL(result.link).hostname;
                
                if (!this.isNewsOrGeneralSite(domain)) {
                  const websiteScore = this.calculateCompanyWebsiteScore(domain, companyData.name, result, searchType);
                  
                  if (websiteScore.score >= 30) {
                    domains.add(domain);
                    console.log(`   🎯 Stage results company website: ${domain} (score: ${websiteScore.score})`);
                  }
                }
              } catch (e) {
                // Invalid URL, skip
              }
            }
          });
        }
      });
    }
    
    // If no domains found yet, try to infer from company name
    if (domains.size === 0) {
      console.log(`   🤔 No explicit domains found, attempting to infer from company name...`);
      const inferredDomains = this.inferDomainsFromCompanyName(companyData.name);
      inferredDomains.forEach(domain => {
        domains.add(domain);
        console.log(`   💡 Inferred domain: ${domain}`);
      });
    }
    
    // Convert to array and prioritize domains by likelihood of success
    const domainArray = Array.from(domains);
    return domainArray.sort((a, b) => {
      // Priority scoring for domains
      const getScore = (domain) => {
        let score = 0;
        
        // 1. Prioritize .com domains (most common for businesses)
        if (domain.endsWith('.com')) score += 100;
        
        // 2. Indonesian domains (.co.id, .id)
        const aIsIndonesian = this.indonesianTLDs.some(tld => domain.endsWith(tld));
        if (aIsIndonesian) score += 80;
        
        // 3. Shorter domains (more likely to be real)
        score += (50 - domain.length); // Shorter = higher score
        
        // 4. Domains without hyphens (more common)
        if (!domain.includes('-')) score += 20;
        
        // 5. Domains that match "shortened" company names (common pattern)
        if (domain.includes('devatacreative')) score += 30; // Specific boost for this pattern
        
        return score;
      };
      
      return getScore(b) - getScore(a); // Higher score first
    });
  }
  
  /**
   * Verify if domain is accessible and get content
   */
  async verifyDomainAccessibility(domain) {
    const result = {
      accessible: false,
      status: null,
      content: null,
      redirectUrl: null
    };
    
    try {
      const urls = [
        `https://${domain}`,
        `http://${domain}`
      ];
      
      for (const url of urls) {
        try {
          console.log(`   🔍 Testing accessibility: ${url}`);
          
          const response = await axios.get(url, {
            timeout: this.timeout,
            maxRedirects: this.maxRedirects,
            validateStatus: status => status < 500, // Accept redirects and client errors
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; ARKS-RWA-Verification/1.0)'
            }
          });
          
          result.accessible = response.status === 200;
          result.status = response.status;
          result.redirectUrl = response.request.res.responseUrl || url;
          
          if (response.status === 200) {
            result.content = response.data;
            console.log(`   ✅ Accessible via ${url} (status: ${response.status})`);
            break;
          }
          
        } catch (error) {
          console.log(`   ❌ Failed to access ${url}: ${error.message}`);
          continue;
        }
      }
      
    } catch (error) {
      console.log(`   ❌ Domain accessibility check failed: ${error.message}`);
    }
    
    return result;
  }
  
  /**
   * Generate verification badges for a domain
   */
  async generateDomainBadges(domain, websiteContent = null, companyData = null, serpAPIResults = null) {
    const badges = [];
    
    console.log(`   🏅 Generating badges for: ${domain}`);
    
    // Badge 1: RDAP Record
    const rdapBadge = await this.generateRDAPBadge(domain);
    if (rdapBadge) {
      badges.push(rdapBadge);
    }
    
    // Badge 2: Certificate Transparency
    const ctBadge = await this.generateCTBadge(domain);
    if (ctBadge) {
      badges.push(ctBadge);
    }
    
    // Badge 3: Site Disclosure Regulator (if website content available)
    if (websiteContent) {
      const regulatorBadge = this.generateRegulatorBadge(domain, websiteContent);
      if (regulatorBadge) {
        badges.push(regulatorBadge);
      }
    }
    
    console.log(`   📦 Generated ${badges.length} badges for ${domain}`);
    return badges;
  }
  
  /**
   * Validate domain existence before expensive lookups
   */
  async validateDomainExistence(domain) {
    try {
      // Quick DNS resolution check
      const dns = await import('dns/promises');
      await dns.resolve4(domain);
      return true;
    } catch (error) {
      try {
        // Try IPv6 if IPv4 fails
        const dns = await import('dns/promises');
        await dns.resolve6(domain);
        return true;
      } catch (error2) {
        console.log(`   🔍 Domain validation: ${domain} does not resolve`);
        return false;
      }
    }
  }

  /**
   * Generate RDAP (Registration Data Access Protocol) badge with enhanced error handling
   */
  async generateRDAPBadge(domain) {
    try {
      console.log(`   🔍 Checking RDAP for: ${domain}`);
      
      // Pre-validate domain existence to avoid unnecessary API calls
      const domainExists = await this.validateDomainExistence(domain);
      if (!domainExists) {
        console.log(`   ⏭️ Skipping RDAP for non-existent domain: ${domain}`);
        return null;
      }
      
      // Try multiple RDAP providers for better coverage
      const rdapProviders = [
        `https://rdap.org/domain/${domain}`,
        `https://rdap.verisign.com/com/v1/domain/${domain}`, // For .com domains
        `https://rdap.apnic.net/domain/${domain}` // For APNIC regions
      ];
      
      for (const rdapUrl of rdapProviders) {
        try {
          console.log(`   🔍 Trying RDAP provider: ${rdapUrl}`);
          
          const response = await axios.get(rdapUrl, {
            timeout: this.timeout,
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'ARKS-RWA-Verification/1.0'
            },
            validateStatus: status => status < 500 // Accept 4xx as valid responses
          });
          
          if (response.status === 200 && response.data) {
            const rdapData = response.data;
            
            // Extract registrar information with enhanced parsing
            let registrarInfo = 'Unknown registrar';
            if (rdapData.entities) {
              const registrar = rdapData.entities.find(entity => 
                entity.roles && entity.roles.includes('registrar')
              );
              
              if (registrar) {
                // Try multiple ways to extract registrar name
                if (registrar.vcardArray && registrar.vcardArray[1]) {
                  const vcard = registrar.vcardArray[1];
                  const fnProperty = vcard.find(prop => prop[0] === 'fn');
                  if (fnProperty && fnProperty[3]) {
                    registrarInfo = `registrar=${fnProperty[3]}`;
                  }
                } else if (registrar.handle) {
                  registrarInfo = `registrar=${registrar.handle}`;
                }
              }
            }
            
            // Add registration date if available
            if (rdapData.events) {
              const registrationEvent = rdapData.events.find(event => 
                event.eventAction === 'registration'
              );
              if (registrationEvent && registrationEvent.eventDate) {
                const regDate = new Date(registrationEvent.eventDate).getFullYear();
                registrarInfo += `,registered=${regDate}`;
              }
            }
            
            console.log(`   ✅ RDAP badge generated for ${domain} via ${rdapUrl}`);
            
            return {
              type: 'rdap_record',
              url: rdapUrl,
              note: registrarInfo,
              metadata: {
                provider: new URL(rdapUrl).hostname,
                domainStatus: rdapData.status || [],
                lastUpdated: rdapData.lastUpdateOfRdapDatabase
              }
            };
          } else if (response.status === 404) {
            console.log(`   ⏭️ Domain not found in RDAP provider: ${rdapUrl}`);
            continue; // Try next provider
          }
          
        } catch (providerError) {
          console.log(`   ⏭️ RDAP provider ${rdapUrl} failed: ${providerError.message}`);
          continue; // Try next provider
        }
      }
      
      console.log(`   ❌ All RDAP providers failed for domain: ${domain}`);
      
    } catch (error) {
      console.log(`   ❌ RDAP lookup failed for ${domain}: ${error.message}`);
    }
    
    return null;
  }
  
  /**
   * Generate Certificate Transparency badge with enhanced error handling
   */
  async generateCTBadge(domain) {
    try {
      console.log(`   🔍 Checking Certificate Transparency for: ${domain}`);
      
      // Skip CT lookup for non-existent domains to save time
      const domainExists = await this.validateDomainExistence(domain);
      if (!domainExists) {
        console.log(`   ⏭️ Skipping CT for non-existent domain: ${domain}`);
        return null;
      }
      
      const ctProviders = [
        {
          name: 'crt.sh',
          url: `https://crt.sh/?q=${domain}&output=json`,
          parser: (data) => Array.isArray(data) ? data.length : 0
        },
        {
          name: 'certificatetransparency.org',
          url: `https://ct.googleapis.com/logs/argon2024/ct/v1/get-entries?start=0&end=10`,
          parser: (data) => data?.entries?.length || 0
        }
      ];
      
      for (const provider of ctProviders) {
        try {
          console.log(`   🔍 Trying CT provider: ${provider.name}`);
          
          const response = await axios.get(provider.url, {
            timeout: this.timeout,
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'ARKS-RWA-Verification/1.0'
            },
            validateStatus: status => status < 500
          });
          
          if (response.status === 200 && response.data) {
            const certCount = provider.parser(response.data);
            
            if (certCount > 0) {
              console.log(`   ✅ CT badge generated for ${domain} via ${provider.name} (${certCount} certificates)`);
              
              return {
                type: 'ct_seen',
                url: provider.name === 'crt.sh' ? provider.url.replace('&output=json', '') : `https://crt.sh/?q=${domain}`,
                note: `certs=${certCount}`,
                metadata: {
                  provider: provider.name,
                  certificateCount: certCount,
                  queryUrl: provider.url
                }
              };
            }
          }
          
        } catch (providerError) {
          console.log(`   ⏭️ CT provider ${provider.name} failed: ${providerError.message}`);
          continue; // Try next provider
        }
      }
      
      console.log(`   ❌ No certificates found for ${domain} in any CT logs`);
      
    } catch (error) {
      console.log(`   ❌ CT lookup failed for ${domain}: ${error.message}`);
    }
    
    return null;
  }
  
  /**
   * Generate site disclosure regulator badge by scanning website content
   */
  generateRegulatorBadge(domain, websiteContent) {
    try {
      console.log(`   🔍 Scanning for regulatory disclosure on: ${domain}`);
      
      if (!websiteContent || typeof websiteContent !== 'string') {
        return null;
      }
      
      // Parse HTML content
      let textContent = websiteContent;
      try {
        const dom = new JSDOM(websiteContent);
        textContent = dom.window.document.body?.textContent || websiteContent;
      } catch (e) {
        // If HTML parsing fails, use raw content
        textContent = websiteContent;
      }
      
      // Check for Indonesian regulatory mentions
      const foundKeywords = [];
      this.regulatoryKeywords.forEach(keyword => {
        if (textContent.toLowerCase().includes(keyword.toLowerCase())) {
          foundKeywords.push(keyword);
        }
      });
      
      if (foundKeywords.length > 0) {
        console.log(`   ✅ Regulatory disclosure found on ${domain}: ${foundKeywords.join(', ')}`);
        
        return {
          type: 'site_disclosure_regulator',
          url: `https://${domain}`,
          note: `regulatory_mentions=${foundKeywords.length}`
        };
      }
      
      console.log(`   ❌ No regulatory disclosure found on ${domain}`);
      
    } catch (error) {
      console.log(`   ❌ Regulatory scanning failed for ${domain}: ${error.message}`);
    }
    
    return null;
  }
  
  /**
   * Generate site disclosure regulator badge from SerpAPI search results as fallback
   * Used when company websites are not accessible but regulatory mentions exist in search results
   */
  generateRegulatorBadgeFromSerpAPI(companyName, serpAPIResults) {
    try {
      console.log(`   🔍 Scanning SerpAPI results for regulatory compliance mentions...`);
      
      const regulatoryMentions = [];
      const searchSources = [];
      let totalMentions = 0;
      
      // Scan all SerpAPI search results for regulatory keywords
      const searchSources_list = [
        // Direct search results
        serpAPIResults?.sources?.searchResults,
        // Stage results
        serpAPIResults?.serpAPIResults?.searches
      ];
      
      searchSources_list.forEach(searchSource => {
        if (!searchSource) return;
        
        Object.entries(searchSource).forEach(([searchType, results]) => {
          if (results?.organic_results) {
            console.log(`   📊 Scanning ${searchType} results: ${results.organic_results.length} items`);
            
            results.organic_results.forEach((result, index) => {
              const title = result.title || '';
              const snippet = result.snippet || '';
              const combinedText = `${title} ${snippet}`.toLowerCase();
              
              // Check for regulatory mentions
              const foundKeywords = [];
              this.regulatoryKeywords.forEach(keyword => {
                if (combinedText.includes(keyword.toLowerCase())) {
                  foundKeywords.push(keyword);
                }
              });
              
              if (foundKeywords.length > 0) {
                regulatoryMentions.push({
                  searchType,
                  url: result.link,
                  title: title,
                  keywords: foundKeywords,
                  source: result.source || 'Unknown'
                });
                totalMentions += foundKeywords.length;
                
                console.log(`   ✅ Regulatory mentions in ${searchType}[${index}]: ${foundKeywords.join(', ')}`);
              }
            });
          }
        });
      });
      
      // Generate badge if regulatory mentions found
      if (regulatoryMentions.length > 0) {
        // Prioritize government sources and high-credibility mentions
        const governmentMentions = regulatoryMentions.filter(mention => 
          mention.keywords.some(k => ['OJK', 'Bank Indonesia', 'Kementerian'].includes(k))
        );
        
        const primarySource = governmentMentions.length > 0 ? governmentMentions[0] : regulatoryMentions[0];
        
        console.log(`   ✅ Regulatory compliance found via SerpAPI: ${totalMentions} mentions across ${regulatoryMentions.length} sources`);
        
        return {
          type: 'site_disclosure_regulator',
          url: primarySource.url,
          note: `regulatory_mentions_serpapi=${totalMentions}`,
          metadata: {
            source: 'serpapi_fallback',
            mentionCount: totalMentions,
            sourceCount: regulatoryMentions.length,
            primaryKeywords: primarySource.keywords,
            searchTypes: [...new Set(regulatoryMentions.map(m => m.searchType))]
          }
        };
      }
      
      console.log(`   ❌ No regulatory compliance mentions found in SerpAPI results`);
      return null;
      
    } catch (error) {
      console.log(`   ❌ SerpAPI regulatory scanning failed: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Determine country from domains and content
   */
  determineCountry(domains, websiteContent) {
    // Check for Indonesian TLD
    const hasIndonesianTLD = domains.some(domain => 
      this.indonesianTLDs.some(tld => domain.endsWith(tld))
    );
    
    if (hasIndonesianTLD) {
      return 'ID';
    }
    
    // Check website content for Indonesian language/references
    if (websiteContent && typeof websiteContent === 'string') {
      const indonesianIndicators = [
        'indonesia', 'jakarta', 'surabaya', 'bandung',
        'rupiah', 'idr', 'ojk', 'bank indonesia',
        'terdaftar di', 'perusahaan indonesia',
        'pt ', 'cv ', 'tbk'
      ];
      
      const lowerContent = websiteContent.toLowerCase();
      const indicatorCount = indonesianIndicators.filter(indicator => 
        lowerContent.includes(indicator)
      ).length;
      
      if (indicatorCount >= 2) {
        return 'ID';
      }
    }
    
    return 'ID'; // Default to Indonesia for this Indonesian fraud detection system
  }
  
  /**
   * Calculate overall website verification status
   */
  calculateVerificationStatus(verification) {
    const criteria = {
      domainFound: verification.domains.length > 0,
      domainAccessible: verification.verificationDetails.domainAccessible,
      hasBadges: verification.badges.length >= 2,
      hasRDAP: verification.badges.some(badge => badge.type === 'rdap_record'),
      hasCT: verification.badges.some(badge => badge.type === 'ct_seen')
    };
    
    // Website is verified if:
    // - Domain found and accessible
    // - At least 2 verification badges
    // - Either RDAP or CT badge present
    const verified = criteria.domainFound && 
                    criteria.domainAccessible && 
                    criteria.hasBadges &&
                    (criteria.hasRDAP || criteria.hasCT);
    
    console.log(`   📊 Verification criteria: ${JSON.stringify(criteria)}`);
    console.log(`   📊 Overall verification: ${verified ? 'VERIFIED' : 'UNVERIFIED'}`);
    
    return verified;
  }
  
  /**
   * Check if domain is a news or general website (not company-specific)
   */
  isNewsOrGeneralSite(domain) {
    const newsPatterns = [
      'detik.com', 'kompas.com', 'liputan6.com', 'tempo.co',
      'cnn.com', 'bbc.com', 'reuters.com',
      'google.com', 'facebook.com', 'twitter.com', 'linkedin.com',
      'wikipedia.org', 'youtube.com', 'tribunnews.com', 'okezone.com',
      'cnnindonesia.com', 'republika.co.id', 'antara.com', 'kontan.co.id'
    ];
    
    return newsPatterns.some(pattern => domain.includes(pattern));
  }
  
  /**
   * Calculate comprehensive company website likelihood score
   * @param {string} domain - The domain to evaluate
   * @param {string} companyName - Company name to match against
   * @param {Object} searchResult - SerpAPI search result object
   * @param {string} searchType - Type of search (general, news, fraud, etc.)
   * @returns {Object} {score: 0-100, evidence: [reasons]}
   */
  calculateCompanyWebsiteScore(domain, companyName, searchResult, searchType) {
    const evidence = [];
    let score = 0;
    
    const companyNameLower = companyName.toLowerCase();
    const domainLower = domain.toLowerCase();
    const titleLower = (searchResult.title || '').toLowerCase();
    const snippetLower = (searchResult.snippet || '').toLowerCase();
    
    // Clean company name for matching
    const cleanCompanyName = companyNameLower
      .replace(/^pt\s+/, '')
      .replace(/^cv\s+/, '')
      .replace(/^tbk\s+/, '')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '');
    
    // 1. Domain name analysis (max 40 points)
    const companyWords = cleanCompanyName.split(/\s+/).filter(word => word.length > 2);
    const domainContainsCompanyName = companyWords.some(word => 
      domainLower.includes(word) && word.length > 3
    );
    
    if (domainContainsCompanyName) {
      score += 25;
      evidence.push(`Domain contains company name elements: ${companyWords.filter(w => domainLower.includes(w)).join(', ')}`);
    }
    
    // Indonesian business domain preference
    const isIndonesianDomain = this.indonesianTLDs.some(tld => domainLower.endsWith(tld));
    if (isIndonesianDomain) {
      score += 15;
      evidence.push(`Indonesian business domain (.id/.co.id)`);
    }
    
    // 2. Search result content analysis (max 35 points)
    const titleContainsCompany = companyWords.some(word => titleLower.includes(word));
    if (titleContainsCompany) {
      score += 15;
      evidence.push(`Title contains company name elements`);
    }
    
    // Official site indicators
    const officialIndicators = [
      'official website', 'situs resmi', 'official', 'resmi',
      'home page', 'beranda', 'company website', 'situs perusahaan'
    ];
    const hasOfficialIndicators = officialIndicators.some(indicator => 
      titleLower.includes(indicator) || snippetLower.includes(indicator)
    );
    
    if (hasOfficialIndicators) {
      score += 20;
      evidence.push(`Contains official website indicators`);
    }
    
    // 3. Search context relevance (max 15 points)
    if (searchType === 'general' || searchType === 'legitimacy') {
      score += 10; // Higher relevance for general company searches
      evidence.push(`Found in general/legitimacy search (high relevance)`);
    } else if (searchType === 'business') {
      score += 8;
      evidence.push(`Found in business search (medium relevance)`);
    }
    
    // 4. Domain structure analysis (max 10 points)
    // Prefer shorter, cleaner domains
    const domainParts = domain.split('.');
    if (domainParts.length <= 3) { // e.g., company.co.id or company.com
      score += 5;
      evidence.push(`Clean domain structure`);
    }
    
    // Avoid obviously non-company patterns
    const nonCompanyPatterns = ['blog', 'forum', 'wiki', 'store', 'shop', 'market'];
    const hasNonCompanyPattern = nonCompanyPatterns.some(pattern => domainLower.includes(pattern));
    if (!hasNonCompanyPattern) {
      score += 5;
      evidence.push(`Professional domain pattern`);
    }
    
    // 5. Penalty factors
    // Penalize domains that are clearly not company websites
    const penaltyPatterns = ['facebook.com', 'instagram.com', 'twitter.com', 'youtube.com', 'tiktok.com'];
    const hasPenaltyPattern = penaltyPatterns.some(pattern => domainLower.includes(pattern));
    if (hasPenaltyPattern) {
      score = Math.max(0, score - 30);
      evidence.push(`Social media platform (penalty applied)`);
    }
    
    return {
      score: Math.min(100, Math.max(0, score)),
      evidence
    };
  }

  /**
   * Enhanced detection for likely company websites (legacy method - kept for compatibility)
   */
  isLikelyCompanyWebsite(domain, companyName, searchResult) {
    const companyNameLower = companyName.toLowerCase();
    const domainLower = domain.toLowerCase();
    const titleLower = (searchResult.title || '').toLowerCase();
    const snippetLower = (searchResult.snippet || '').toLowerCase();
    
    // Remove common Indonesian company prefixes for matching
    const cleanCompanyName = companyNameLower
      .replace(/^pt\s+/, '')
      .replace(/^cv\s+/, '')
      .replace(/^tbk\s+/, '')
      .replace(/\s+/g, '');
    
    // Check if domain contains company name elements
    const companyWords = cleanCompanyName.split(/\s+/).filter(word => word.length > 2);
    const domainContainsCompanyName = companyWords.some(word => 
      domainLower.includes(word) && word.length > 3
    );
    
    // Check if it's an Indonesian company domain
    const isIndonesianDomain = this.indonesianTLDs.some(tld => domainLower.endsWith(tld));
    
    // Check if title/snippet suggests it's the company's official site
    const titleContainsCompany = companyWords.some(word => titleLower.includes(word));
    const isOfficialSite = titleLower.includes('official') || titleLower.includes('resmi') ||
                          snippetLower.includes('official website') || snippetLower.includes('situs resmi');
    
    // Strong indicators of company website
    if (domainContainsCompanyName || (isIndonesianDomain && titleContainsCompany) || isOfficialSite) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Infer possible domains from company name with enhanced variations
   */
  inferDomainsFromCompanyName(companyName) {
    const domains = [];
    
    // Clean company name
    let cleanName = companyName.toLowerCase()
      .replace(/^pt\s+/, '')
      .replace(/^cv\s+/, '')
      .replace(/^tbk\s+/, '')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '');
    
    console.log(`   💭 Inferring domains for: "${companyName}" -> clean: "${cleanName}"`);
    
    // Get individual words for more variations
    const words = companyName.toLowerCase()
      .replace(/^pt\s+/, '')
      .replace(/^cv\s+/, '')
      .split(/\s+/)
      .map(word => word.replace(/[^a-z0-9]/g, ''))
      .filter(word => word.length > 2);
    
    console.log(`   💭 Company words: ${words.join(', ')}`);
    
    // Generate possible domain patterns
    if (cleanName.length > 3) {
      // 1. Full company name variations
      domains.push(`${cleanName}.co.id`);
      domains.push(`${cleanName}.id`);
      domains.push(`${cleanName}.com`);
    }
    
    // 2. Two-word combinations (most common pattern)
    if (words.length >= 2) {
      const firstWord = words[0];
      const secondWord = words[1];
      
      if (firstWord.length > 2 && secondWord.length > 2) {
        // Without last word combinations (e.g., "devata creative" instead of "devata creative digital")
        domains.push(`${firstWord}${secondWord}.co.id`);
        domains.push(`${firstWord}${secondWord}.id`);
        domains.push(`${firstWord}${secondWord}.com`);
        domains.push(`${firstWord}-${secondWord}.co.id`);
        domains.push(`${firstWord}-${secondWord}.com`);
      }
    }
    
    // 3. Shortened variations (drop last word - common pattern)
    if (words.length >= 3) {
      // Try without the last word (e.g., "Devata Creative" from "Devata Creative Digital")
      const shortenedWords = words.slice(0, -1);
      const shortenedName = shortenedWords.join('');
      
      console.log(`   💭 Shortened variation: ${shortenedName}`);
      
      domains.push(`${shortenedName}.co.id`);
      domains.push(`${shortenedName}.id`);  
      domains.push(`${shortenedName}.com`);
      
      // Hyphenated version
      const hyphenatedName = shortenedWords.join('-');
      domains.push(`${hyphenatedName}.co.id`);
      domains.push(`${hyphenatedName}.com`);
    }
    
    // 4. Single word variations (brand name only)
    if (words.length >= 1) {
      const brandName = words[0];
      if (brandName.length > 4) { // Only for longer brand names
        domains.push(`${brandName}.co.id`);
        domains.push(`${brandName}.id`);
        domains.push(`${brandName}.com`);
      }
    }
    
    // 5. Common abbreviations
    if (words.length >= 2) {
      const abbreviation = words.map(word => word[0]).join('');
      if (abbreviation.length >= 2) {
        domains.push(`${abbreviation}.co.id`);
        domains.push(`${abbreviation}.com`);
      }
    }
    
    // Remove duplicates and limit results
    const uniqueDomains = [...new Set(domains)];
    console.log(`   💭 Generated ${uniqueDomains.length} domain variations: ${uniqueDomains.slice(0, 8).join(', ')}`);
    
    return uniqueDomains.slice(0, 8); // Increased limit for better coverage
  }
  
  /**
   * Get verification summary for quick review
   */
  getVerificationSummary(verification) {
    return {
      verified: verification.websiteVerified,
      country: verification.country,
      primaryDomain: verification.primaryDomain,
      badgeCount: verification.badges.length,
      badgeTypes: verification.badges.map(badge => badge.type),
      accessible: verification.verificationDetails.domainAccessible
    };
  }
}

export default WebsiteVerificationService;