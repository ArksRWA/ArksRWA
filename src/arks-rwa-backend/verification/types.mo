import Time "mo:base/Time";

module {
  // Verification status for companies
  public type VerificationStatus = {
    #pending;      // Initial state, verification in progress
    #verified;     // Passed verification checks
    #suspicious;   // Some red flags detected
    #failed;       // Failed verification, likely fraudulent
    #error;        // Technical error during verification
  };

  // Individual verification check result
  public type VerificationCheck = {
    checkType : Text;        // "business_registry", "news_sentiment", "domain_age", etc.
    status : CheckStatus;    // pass, fail, warning
    score : Float;          // 0-100 score for this specific check
    confidence : Float;     // 0-1 confidence level in this result
    details : Text;         // Human-readable explanation
    timestamp : Int;        // When this check was performed
  };

  public type CheckStatus = {
    #pass;     // Check passed - positive indicator
    #fail;     // Check failed - red flag
    #warning;  // Suspicious but not definitive
    #error;    // Technical error during check
  };

  // Complete verification profile for a company
  public type VerificationProfile = {
    companyId : Nat;
    overallScore : Float;           // 0-100 overall risk score
    verificationStatus : VerificationStatus;
    lastVerified : Int;             // Timestamp of last verification
    nextDueAt : ?Int;              // When re-verification is due
    checks : [VerificationCheck];  // Individual verification checks
    fraudKeywords : [Text];        // Indonesian fraud keywords found
    newsArticles : Nat;            // Number of news articles analyzed
    riskFactors : [Text];          // List of identified risk factors
  };

  // Search query configuration for Indonesian companies
  public type IndonesianSearchQuery = {
    companyName : Text;
    queryType : SearchQueryType;
    searchTerms : [Text];      // Additional search terms
    language : Text;           // "id" for Indonesian, "en" for English
  };

  public type SearchQueryType = {
    #fraud_check;           // Looking for fraud indicators
    #legitimacy_check;      // Checking if company is legitimate
    #news_sentiment;        // General news sentiment analysis
    #digital_footprint;     // Social media and website presence
    #authority_verification; // Government/OJK mentions
  };

  // Google search result parsing
  public type GoogleSearchResult = {
    title : Text;
    snippet : Text;
    url : Text;
    relevance : Float;     // 0-1 relevance to the search query
    sentiment : Float;     // -1 to 1 sentiment score
    fraudKeywords : [Text]; // Indonesian fraud keywords found
  };

  // HTTPS outcall configuration
  public type HttpOutcallConfig = {
    maxCycles : Nat;          // Maximum cycles to spend per request
    timeoutMs : Nat;          // Request timeout in milliseconds
    retryCount : Nat;         // Number of retries on failure
    userAgent : Text;         // User agent string for requests
    rateLimitDelayMs : Nat;   // Delay between requests to avoid blocking
  };

  // Verification job queue item
  public type VerificationJob = {
    jobId : Nat;
    companyId : Nat;
    companyName : Text;
    priority : JobPriority;
    createdAt : Int;
    startedAt : ?Int;
    completedAt : ?Int;
    status : JobStatus;
    result : ?VerificationProfile;
    errorMessage : ?Text;
  };

  public type JobPriority = {
    #high;     // Process immediately
    #normal;   // Standard queue processing
    #low;      // Background processing
  };

  public type JobStatus = {
    #queued;      // Waiting in queue
    #processing;  // Currently being processed
    #completed;   // Successfully completed
    #failed;      // Failed with error
    #cancelled;   // Cancelled by admin
  };

  // Indonesian fraud detection keywords
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
}