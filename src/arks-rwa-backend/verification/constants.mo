// Indonesian Fraud Detection Constants
// Separated from types.mo for better code organization and maintainability

module {
  // Indonesian fraud detection keywords
  // These keywords indicate potential fraudulent activities in Indonesian companies
  public let INDONESIAN_FRAUD_KEYWORDS : [Text] = [
    "penipuan",      // fraud
    "scam", 
    "penipu",        // fraudster
    "gugatan",       // lawsuit
    "ilegal",        // illegal
    "tutup",         // closed
    "bangkrut",      // bankrupt
    "investasi bodong", // fraudulent investment
    "money game",
    "skema ponzi",   // ponzi scheme
    "multi level marketing palsu", // fake MLM
    "bermasalah",    // problematic
    "tertipu",       // deceived
    "kerugian",      // loss
    "polisi",        // police
    "kepolisian",    // police (formal)
    "kejaksaan",     // prosecutor's office
    "pengadilan",    // court
    "sanksi",        // sanctions
    "denda"          // fine
  ];

  // Indonesian legitimacy indicators
  // These keywords indicate legitimate business operations in Indonesia
  public let INDONESIAN_LEGITIMACY_KEYWORDS : [Text] = [
    "OJK",           // Financial Services Authority
    "Kementerian",   // Ministry
    "resmi",         // official
    "terdaftar",     // registered
    "izin",          // permit/license
    "sertifikat",    // certificate
    "akreditasi",    // accreditation
    "audit",         // audit
    "ISO",           // ISO certification
    "NPWP",          // Tax ID
    "NIB",           // Business ID Number
    "OSS"            // Online Single Submission
  ];

  // Search query templates for Indonesian company verification
  public let FRAUD_CHECK_TERMS : [Text] = ["penipuan", "scam", "gugatan", "ilegal"];
  public let LEGITIMACY_CHECK_TERMS : [Text] = ["PT", "CV", "terdaftar", "resmi"];
  public let AUTHORITY_VERIFICATION_TERMS : [Text] = ["OJK", "Kementerian", "pemerintah"];
  public let NEWS_SENTIMENT_TERMS : [Text] = ["berita", "news", "media"];
  public let DIGITAL_FOOTPRINT_TERMS : [Text] = ["website", "Facebook", "LinkedIn", "Instagram"];

  // Verification scoring weights for different check types
  public let FRAUD_KEYWORDS_WEIGHT : Float = 3.0;      // High weight for direct fraud indicators
  public let NEWS_SENTIMENT_WEIGHT : Float = 2.5;      // High weight for news analysis
  public let BUSINESS_REGISTRY_WEIGHT : Float = 2.0;   // Important for legitimacy
  public let AUTHORITY_MENTIONS_WEIGHT : Float = 2.0;  // OJK, government mentions
  public let DIGITAL_FOOTPRINT_WEIGHT : Float = 1.5;   // Medium weight for web presence
  public let DOMAIN_AGE_WEIGHT : Float = 1.0;          // Lower weight for technical factors

  // Score thresholds for verification status determination
  public let VERIFIED_MIN_SCORE : Float = 80.0;       // 80+ score = verified
  public let SUSPICIOUS_MIN_SCORE : Float = 50.0;     // 50-79 score = suspicious
  public let FAILED_MAX_SCORE : Float = 49.9;         // <50 score = failed

  // Cache and rate limiting constants
  public let CACHE_TTL_NANOSECONDS : Int = 86400000000000; // 24 hours in nanoseconds
  public let CACHE_MAX_ENTRIES : Nat = 1000;
  public let CACHE_CLEANUP_THRESHOLD : Nat = 100;

  // HTTP outcall configuration constants
  public let DEFAULT_TIMEOUT_MS : Nat = 30_000;        // 30 seconds
  public let MAX_RESPONSE_BYTES : Nat64 = 1_048_576;   // 1MB
  public let RATE_LIMIT_DELAY_MS : Nat = 3_000;        // 3 seconds between requests
  public let MAX_RETRIES : Nat = 2;
  public let MAX_CYCLES_PER_REQUEST : Nat = 50_000_000; // 50M cycles
}