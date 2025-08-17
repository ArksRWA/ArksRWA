/**
 * Entity Resolution Utilities for Indonesian Companies
 * Provides canonical name resolution, alias mapping, and entity certainty scoring
 */

class EntityUtils {
  constructor() {
    // Major Indonesian banks and companies with aliases
    this.entityDatabase = {
      // State Banks
      'bni': {
        canonical: 'PT Bank Negara Indonesia (Persero) Tbk',
        aliases: ['BNI', 'BNI46', 'BBNI', 'Bank Negara Indonesia', 'PT Bank Negara Indonesia'],
        ids: { idxTicker: 'BBNI', ojkId: 'BNI001' },
        entityType: 'bank',
        isListed: true
      },
      'bri': {
        canonical: 'PT Bank Rakyat Indonesia (Persero) Tbk',
        aliases: ['BRI', 'Bank Rakyat Indonesia', 'PT Bank Rakyat Indonesia'],
        ids: { idxTicker: 'BBRI', ojkId: 'BRI001' },
        entityType: 'bank',
        isListed: true
      },
      'mandiri': {
        canonical: 'PT Bank Mandiri (Persero) Tbk',
        aliases: ['Bank Mandiri', 'Mandiri', 'PT Bank Mandiri'],
        ids: { idxTicker: 'BMRI', ojkId: 'MDR001' },
        entityType: 'bank',
        isListed: true
      },
      'bca': {
        canonical: 'PT Bank Central Asia Tbk',
        aliases: ['BCA', 'Bank Central Asia', 'PT Bank Central Asia'],
        ids: { idxTicker: 'BBCA', ojkId: 'BCA001' },
        entityType: 'bank',
        isListed: true
      },
      
      // Major Corporates
      'telkom': {
        canonical: 'PT Telkom Indonesia (Persero) Tbk',
        aliases: ['Telkom', 'Telkom Indonesia', 'PT Telkom Indonesia'],
        ids: { idxTicker: 'TLKM', ojkId: null },
        entityType: 'telecommunications',
        isListed: true
      },
      'indofood': {
        canonical: 'PT Indofood Sukses Makmur Tbk',
        aliases: ['Indofood', 'PT Indofood', 'Indofood Sukses Makmur'],
        ids: { idxTicker: 'INDF', ojkId: null },
        entityType: 'manufacturing',
        isListed: true
      },
      'aqua': {
        canonical: 'PT Tirta Investama',
        aliases: ['Aqua', 'PT Aqua', 'Tirta Investama', 'Aqua Golden Mississippi'],
        ids: { idxTicker: null, ojkId: null },
        entityType: 'manufacturing',
        isListed: false
      },
      
      // Indonesian Tech Companies & Unicorns
      'efishery': {
        canonical: 'PT Multidaya Teknologi Nusantara',
        aliases: ['eFishery', 'e-Fishery', 'PT Multidaya Teknologi Nusantara', 'Multidaya Teknologi Nusantara', 'PT Multidaya Teknologi'],
        ids: { idxTicker: null, ojkId: null },
        entityType: 'technology',
        isListed: false
      },
      'gojek': {
        canonical: 'PT Aplikasi Karya Anak Bangsa',
        aliases: ['Gojek', 'GoJek', 'PT Aplikasi Karya Anak Bangsa', 'AKAB', 'Go-Jek'],
        ids: { idxTicker: null, ojkId: 'FIN001' },
        entityType: 'fintech',
        isListed: false
      },
      'tokopedia': {
        canonical: 'PT Tokopedia',
        aliases: ['Tokopedia', 'PT Tokopedia', 'Toko Pedia'],
        ids: { idxTicker: null, ojkId: null },
        entityType: 'ecommerce',
        isListed: false
      },
      'bukalapak': {
        canonical: 'PT Bukalapak.com Tbk',
        aliases: ['Bukalapak', 'PT Bukalapak', 'Bukalapak.com', 'PT Bukalapak.com'],
        ids: { idxTicker: 'BUKA', ojkId: null },
        entityType: 'ecommerce',
        isListed: true
      },
      'shopee': {
        canonical: 'PT Shopee International Indonesia',
        aliases: ['Shopee', 'PT Shopee', 'Shopee Indonesia', 'PT Shopee International Indonesia'],
        ids: { idxTicker: null, ojkId: null },
        entityType: 'ecommerce',
        isListed: false
      },
      'ovo': {
        canonical: 'PT Visionet Internasional',
        aliases: ['OVO', 'PT OVO', 'PT Visionet Internasional', 'Visionet'],
        ids: { idxTicker: null, ojkId: 'EMT001' },
        entityType: 'fintech',
        isListed: false
      },
      'dana': {
        canonical: 'PT Espay Debit Indonesia Koe',
        aliases: ['DANA', 'PT DANA Indonesia', 'PT Espay Debit Indonesia', 'Espay'],
        ids: { idxTicker: null, ojkId: 'EMT002' },
        entityType: 'fintech',
        isListed: false
      },
      'traveloka': {
        canonical: 'PT Trinusa Travelindo',
        aliases: ['Traveloka', 'PT Traveloka', 'PT Trinusa Travelindo', 'Trinusa Travelindo'],
        ids: { idxTicker: null, ojkId: null },
        entityType: 'technology',
        isListed: false
      },
      'tiket': {
        canonical: 'PT Global Tiket Network',
        aliases: ['Tiket.com', 'Tiket', 'PT Tiket', 'PT Global Tiket Network', 'Global Tiket Network'],
        ids: { idxTicker: null, ojkId: null },
        entityType: 'technology',
        isListed: false
      },
      'blibli': {
        canonical: 'PT Global Digital Niaga',
        aliases: ['Blibli', 'PT Blibli', 'PT Global Digital Niaga', 'Global Digital Niaga', 'Blibli.com'],
        ids: { idxTicker: null, ojkId: null },
        entityType: 'ecommerce',
        isListed: false
      },
      'grab': {
        canonical: 'PT Grab Indonesia',
        aliases: ['Grab', 'PT Grab', 'PT Grab Indonesia', 'Grab Indonesia'],
        ids: { idxTicker: null, ojkId: 'FIN003' },
        entityType: 'fintech',
        isListed: false
      }
    };
    
    // Common Indonesian business entity patterns
    this.entityPatterns = [
      /^PT\s+(.+?)\s*(?:\(Persero\))?\s*(?:Tbk)?$/i,
      /^CV\s+(.+)$/i,
      /^UD\s+(.+)$/i,
      /^Koperasi\s+(.+)$/i
    ];
    
    // Suspicious domain patterns for impersonation detection
    this.suspiciousDomainPatterns = [
      /bni-secure\./i,
      /bca-bank\./i,
      /mandiri-online\./i,
      /ojk-verify\./i,
      /bank-indonesia\./i
    ];
  }

  /**
   * Main entity resolution function with enhanced features
   */
  resolveEntity(name, description = '', searchResults = null) {
    const normalizedName = this.normalizeName(name);
    const text = `${name} ${description}`.toLowerCase();
    
    // Step 1: Try exact match in database
    const exactMatch = this.findExactMatch(normalizedName);
    if (exactMatch) {
      return this.createEntityResolution({
        canonicalName: exactMatch.canonical,
        aliases: exactMatch.aliases,
        ids: exactMatch.ids,
        erCertainty: 0.95,
        entityType: exactMatch.entityType,
        isListed: exactMatch.isListed,
        industry: this.determineIndustry(exactMatch.entityType, text),
        jurisdiction: this.determineJurisdiction(name, description),
        registrationStatus: this.determineRegistrationStatus(exactMatch, searchResults)
      });
    }
    
    // Step 2: Try alias matching
    const aliasMatch = this.findAliasMatch(normalizedName, text);
    if (aliasMatch) {
      return this.createEntityResolution({
        canonicalName: aliasMatch.canonical,
        aliases: aliasMatch.aliases,
        ids: aliasMatch.ids,
        erCertainty: 0.85,
        entityType: aliasMatch.entityType,
        isListed: aliasMatch.isListed,
        industry: this.determineIndustry(aliasMatch.entityType, text),
        jurisdiction: this.determineJurisdiction(name, description),
        registrationStatus: this.determineRegistrationStatus(aliasMatch, searchResults)
      });
    }
    
    // Step 3: Extract business entity info with enhanced analysis
    const entityInfo = this.extractEntityInfo(name);
    const enhancedAliases = this.extractAliasesFromSearchResults(name, searchResults);
    
    return this.createEntityResolution({
      canonicalName: this.standardizeCompanyName(name),
      aliases: [name, ...entityInfo.aliases, ...enhancedAliases],
      ids: {},
      erCertainty: entityInfo.certainty,
      entityType: this.determineEntityTypeFromName(name),
      isListed: false,
      industry: this.determineIndustry(entityInfo.type, text),
      jurisdiction: this.determineJurisdiction(name, description),
      registrationStatus: this.determineRegistrationStatus(null, searchResults)
    });
  }

  /**
   * Normalize company name for matching
   */
  normalizeName(name) {
    return name
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[.,()]/g, '')
      .trim();
  }

  /**
   * Find exact match in entity database
   */
  findExactMatch(normalizedName) {
    for (const [key, entity] of Object.entries(this.entityDatabase)) {
      const normalizedCanonical = this.normalizeName(entity.canonical);
      if (normalizedCanonical === normalizedName) {
        return entity;
      }
    }
    return null;
  }

  /**
   * Find alias match in entity database
   */
  findAliasMatch(normalizedName, fullText) {
    for (const [key, entity] of Object.entries(this.entityDatabase)) {
      // Check if any alias matches
      for (const alias of entity.aliases) {
        const normalizedAlias = this.normalizeName(alias);
        if (normalizedName.includes(normalizedAlias) || 
            normalizedAlias.includes(normalizedName) ||
            fullText.includes(alias.toLowerCase())) {
          return entity;
        }
      }
    }
    return null;
  }

  /**
   * Extract entity information from business name patterns
   */
  extractEntityInfo(name) {
    for (const pattern of this.entityPatterns) {
      const match = name.match(pattern);
      if (match) {
        const baseName = match[1].trim();
        const entityType = this.determineEntityType(name, baseName);
        
        return {
          canonical: name,
          aliases: [baseName],
          certainty: 0.7,
          type: entityType
        };
      }
    }
    
    // No pattern match - return as-is with low certainty
    return {
      canonical: name,
      aliases: [],
      certainty: 0.3,
      type: 'unknown'
    };
  }

  /**
   * Determine entity type from name and description
   */
  determineEntityType(name, baseName) {
    const text = `${name} ${baseName}`.toLowerCase();
    
    if (text.includes('bank')) return 'banking';
    if (text.includes('fintech') || text.includes('payment')) return 'fintech';
    if (text.includes('asuransi') || text.includes('insurance')) return 'insurance';
    if (text.includes('investasi') || text.includes('investment')) return 'investment';
    if (text.includes('teknologi') || text.includes('digital')) return 'technology';
    if (text.includes('manufaktur') || text.includes('industri')) return 'manufacturing';
    if (text.includes('pertanian') || text.includes('agriculture')) return 'agriculture';
    if (text.includes('retail') || text.includes('trading')) return 'retail';
    
    return 'business';
  }

  /**
   * Check for domain impersonation risks
   */
  checkImpersonationRisk(domains = []) {
    if (!Array.isArray(domains) || domains.length === 0) {
      return { risk: 'low', reasons: [] };
    }
    
    const risks = [];
    
    for (const domain of domains) {
      // Check against suspicious patterns
      for (const pattern of this.suspiciousDomainPatterns) {
        if (pattern.test(domain)) {
          risks.push(`Suspicious domain pattern: ${domain}`);
        }
      }
      
      // Check for typosquatting of major banks
      const bankDomains = ['bni.co.id', 'bca.co.id', 'bankmandiri.co.id', 'bri.co.id'];
      for (const legitDomain of bankDomains) {
        if (this.isTyposquatting(domain, legitDomain)) {
          risks.push(`Potential typosquatting of ${legitDomain}: ${domain}`);
        }
      }
    }
    
    if (risks.length === 0) return { risk: 'low', reasons: [] };
    if (risks.length <= 2) return { risk: 'medium', reasons: risks };
    return { risk: 'high', reasons: risks };
  }

  /**
   * Check if domain is typosquatting another domain using Levenshtein distance
   */
  isTyposquatting(domain1, domain2, threshold = 2) {
    const distance = this.levenshteinDistance(domain1, domain2);
    return distance > 0 && distance <= threshold && domain1 !== domain2;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Get authoritative override criteria
   */
  getAuthoritativeOverride(entityData, evidenceAtoms = []) {
    const { isListed, entityType, ids } = entityData;
    
    // Check for IDX listing evidence
    const hasIdxEvidence = evidenceAtoms.some(atom => 
      atom.tier === 0 && atom.source === 'IDX' && atom.verification === 'exact'
    );
    
    // Check for OJK registration evidence
    const hasOjkEvidence = evidenceAtoms.some(atom => 
      atom.tier <= 1 && atom.source === 'OJK' && 
      (atom.field === 'registration' || atom.field === 'license')
    );
    
    // Check for severe red flags
    const hasSevereRedFlags = evidenceAtoms.some(atom => 
      atom.field === 'fraud_warning' || atom.field === 'sanctions' ||
      (atom.source === 'PPATK' && atom.value.includes('investigation'))
    );
    
    const shouldOverride = (isListed || hasIdxEvidence) && 
                          (entityType === 'banking' ? hasOjkEvidence : true) && 
                          !hasSevereRedFlags;
    
    return {
      shouldApply: shouldOverride,
      reasons: {
        idxListed: isListed || hasIdxEvidence,
        ojkCompliant: entityType !== 'banking' || hasOjkEvidence,
        noSevereFlags: !hasSevereRedFlags
      }
    };
  }

  /**
   * Creates standardized entity resolution response
   */
  createEntityResolution(data) {
    return {
      canonicalName: data.canonicalName,
      entityType: data.entityType,
      industry: data.industry,
      jurisdiction: data.jurisdiction,
      registrationStatus: data.registrationStatus,
      aliases: [...new Set(data.aliases)], // Remove duplicates
      confidence: data.erCertainty,
      ids: data.ids || {},
      isListed: data.isListed || false
    };
  }

  /**
   * Standardizes Indonesian company names
   */
  standardizeCompanyName(name) {
    // Remove extra spaces and normalize punctuation
    let standardized = name.trim().replace(/\s+/g, ' ');
    
    // Standardize entity type abbreviations
    standardized = standardized.replace(/\bPT\s+/i, 'PT ');
    standardized = standardized.replace(/\bCV\s+/i, 'CV ');
    standardized = standardized.replace(/\s+Tbk$/i, ' Tbk');
    standardized = standardized.replace(/\s+\(Persero\)\s+/i, ' (Persero) ');
    
    return standardized;
  }

  /**
   * Determines Indonesian business entity type from name
   */
  determineEntityTypeFromName(name) {
    const nameUpper = name.toUpperCase();
    
    if (nameUpper.includes('TBK')) return 'tbk';
    if (nameUpper.includes('(PERSERO)')) return 'persero';
    if (nameUpper.startsWith('PT ')) return 'pt';
    if (nameUpper.startsWith('CV ')) return 'cv';
    if (nameUpper.includes('KOPERASI')) return 'koperasi';
    if (nameUpper.includes('PERUM')) return 'perum';
    
    return 'unknown';
  }

  /**
   * Determines industry from entity type and description
   */
  determineIndustry(entityType, text) {
    // Financial services
    if (text.includes('bank') || text.includes('finance') || text.includes('fintech')) {
      return 'banking';
    }
    if (text.includes('asuransi') || text.includes('insurance')) {
      return 'insurance';
    }
    if (text.includes('investasi') || text.includes('investment')) {
      return 'investment';
    }
    
    // Technology
    if (text.includes('teknologi') || text.includes('digital') || text.includes('software')) {
      return 'technology';
    }
    
    // Manufacturing
    if (text.includes('manufaktur') || text.includes('industri') || text.includes('pabrik')) {
      return 'manufacturing';
    }
    
    // Agriculture
    if (text.includes('pertanian') || text.includes('agriculture') || text.includes('perikanan')) {
      return 'agriculture';
    }
    
    // Retail/Trading
    if (text.includes('retail') || text.includes('trading') || text.includes('perdagangan')) {
      return 'retail';
    }
    
    // Use entity type as fallback
    return entityType || 'business';
  }

  /**
   * Determines jurisdiction from name and description
   */
  determineJurisdiction(name, description) {
    const text = `${name} ${description}`.toLowerCase();
    
    // Check for specific Indonesian cities/provinces
    if (text.includes('jakarta')) return 'DKI Jakarta';
    if (text.includes('surabaya')) return 'Jawa Timur';
    if (text.includes('bandung')) return 'Jawa Barat';
    if (text.includes('medan')) return 'Sumatera Utara';
    if (text.includes('makassar')) return 'Sulawesi Selatan';
    if (text.includes('yogyakarta') || text.includes('jogja')) return 'DIY Yogyakarta';
    if (text.includes('denpasar') || text.includes('bali')) return 'Bali';
    if (text.includes('semarang')) return 'Jawa Tengah';
    
    // Check for provincial indicators
    if (text.includes('jawa')) return 'Jawa';
    if (text.includes('sumatera') || text.includes('sumatra')) return 'Sumatera';
    if (text.includes('kalimantan') || text.includes('borneo')) return 'Kalimantan';
    if (text.includes('sulawesi')) return 'Sulawesi';
    if (text.includes('papua')) return 'Papua';
    
    // Default to Indonesia
    return 'Indonesia';
  }

  /**
   * Determines registration status from entity data and search results
   */
  determineRegistrationStatus(entityData, searchResults) {
    // Check if we have explicit registration data
    if (entityData?.ids?.ojkId) return 'registered';
    if (entityData?.isListed) return 'registered';
    
    // Check search results for registration indicators
    if (searchResults?.sources?.ojk) {
      const ojkStatus = searchResults.sources.ojk.registrationStatus;
      if (ojkStatus && ojkStatus !== 'unknown') {
        return ojkStatus;
      }
    }
    
    // Check search results for business registration
    if (searchResults?.sources?.businessInfo) {
      const businessReg = searchResults.sources.businessInfo.businessRegistration;
      if (businessReg === 'registered') return 'registered';
    }
    
    return 'unknown';
  }

  /**
   * Extracts additional aliases from search results
   */
  extractAliasesFromSearchResults(originalName, searchResults) {
    const aliases = [];
    
    if (!searchResults?.searches) return aliases;
    
    // Extract aliases from search result titles and snippets
    Object.values(searchResults.searches).forEach(searchData => {
      if (searchData.organic_results) {
        searchData.organic_results.forEach(result => {
          // Look for company name variations in titles
          const nameVariations = this.extractNameVariations(result.title, originalName);
          aliases.push(...nameVariations);
          
          // Look for company name variations in snippets
          if (result.snippet) {
            const snippetVariations = this.extractNameVariations(result.snippet, originalName);
            aliases.push(...snippetVariations);
          }
        });
      }
    });
    
    // Remove duplicates and filter out invalid aliases
    return [...new Set(aliases)]
      .filter(alias => alias.length > 2 && alias.length < 100)
      .slice(0, 5); // Limit to 5 additional aliases
  }

  /**
   * Extracts name variations from text
   */
  extractNameVariations(text, originalName) {
    const variations = [];
    const originalWords = originalName.toLowerCase().split(/\s+/);
    
    // Look for quoted company names
    const quotedMatches = text.match(/"([^"]+)"/g);
    if (quotedMatches) {
      quotedMatches.forEach(match => {
        const cleaned = match.replace(/"/g, '').trim();
        if (this.isLikelyCompanyName(cleaned, originalWords)) {
          variations.push(cleaned);
        }
      });
    }
    
    // Look for company name patterns (PT, CV, etc.)
    const companyPatterns = /\b(?:PT|CV|UD)\s+[A-Za-z\s]+(?:Tbk|\(Persero\))?/gi;
    const companyMatches = text.match(companyPatterns);
    if (companyMatches) {
      companyMatches.forEach(match => {
        if (this.isLikelyCompanyName(match, originalWords)) {
          variations.push(match.trim());
        }
      });
    }
    
    return variations;
  }

  /**
   * Checks if a text string is likely a company name variation
   */
  isLikelyCompanyName(text, originalWords) {
    const textLower = text.toLowerCase();
    const textWords = textLower.split(/\s+/);
    
    // Must share at least one significant word with original
    const significantWords = originalWords.filter(word => 
      word.length > 3 && !['dan', 'atau', 'dengan', 'yang', 'dari'].includes(word)
    );
    
    const hasSharedWord = significantWords.some(word => 
      textWords.some(textWord => textWord.includes(word) || word.includes(textWord))
    );
    
    // Must look like a company name
    const looksLikeCompany = /\b(?:pt|cv|ud|tbk|persero|company|corp|inc|ltd)\b/i.test(text);
    
    return hasSharedWord && (looksLikeCompany || text.length > 10);
  }

  /**
   * Test method for development
   */
  test() {
    const testCases = [
      'PT Bank Negara Indonesia (Persero) Tbk',
      'BNI',
      'Bank Mandiri',
      'PT Aqua Golden Mississippi',
      'PT Scam Investment Guaranteed'
    ];
    
    console.log('Entity Resolution Test Results:');
    for (const testCase of testCases) {
      const result = this.resolveEntity(testCase);
      console.log(`${testCase} → ${result.canonicalName} (${result.confidence})`);
      console.log(`  Entity Type: ${result.entityType}, Industry: ${result.industry}`);
      console.log(`  Jurisdiction: ${result.jurisdiction}, Status: ${result.registrationStatus}`);
      console.log(`  Aliases: ${result.aliases.slice(0, 3).join(', ')}\n`);
    }
  }
}

export default EntityUtils;