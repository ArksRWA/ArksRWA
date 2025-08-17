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
   * Main entity resolution function
   */
  resolveEntity(name, description = '') {
    const normalizedName = this.normalizeName(name);
    const text = `${name} ${description}`.toLowerCase();
    
    // Step 1: Try exact match in database
    const exactMatch = this.findExactMatch(normalizedName);
    if (exactMatch) {
      return {
        canonicalName: exactMatch.canonical,
        aliases: exactMatch.aliases,
        ids: exactMatch.ids,
        erCertainty: 0.95,
        entityType: exactMatch.entityType,
        isListed: exactMatch.isListed
      };
    }
    
    // Step 2: Try alias matching
    const aliasMatch = this.findAliasMatch(normalizedName, text);
    if (aliasMatch) {
      return {
        canonicalName: aliasMatch.canonical,
        aliases: aliasMatch.aliases,
        ids: aliasMatch.ids,
        erCertainty: 0.85,
        entityType: aliasMatch.entityType,
        isListed: aliasMatch.isListed
      };
    }
    
    // Step 3: Extract business entity info
    const entityInfo = this.extractEntityInfo(name);
    return {
      canonicalName: entityInfo.canonical,
      aliases: [name, ...entityInfo.aliases],
      ids: {},
      erCertainty: entityInfo.certainty,
      entityType: entityInfo.type,
      isListed: false
    };
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
      console.log(`${testCase} → ${result.canonicalName} (${result.erCertainty})`);
    }
  }
}

export default EntityUtils;