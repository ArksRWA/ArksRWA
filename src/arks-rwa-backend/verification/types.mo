import Time "mo:base/Time";
import HashMap "mo:base/HashMap";

module {
  // === PHASE 1: ENHANCED WEIGHT SYSTEM TYPES ===
  
  // Weight configuration with confidence and evidence tracking
  public type WeightWithConfidence = {
    weight: Float;                      // Base weight value
    confidenceInterval: (Float, Float); // (lower_bound, upper_bound) 
    evidenceSource: Text;               // Research basis for this weight
    lastValidated: Int;                 // Timestamp of last validation
    calibrationType: CalibrationSource; // How this weight was determined
  };

  public type CalibrationSource = {
    #empirical_study;     // Based on actual fraud case analysis
    #regulatory_guidance; // Based on OJK/BI regulatory emphasis
    #expert_consensus;    // Indonesian financial security expert consensus
    #ml_optimization;     // Machine learning optimization result
    #cross_validation;    // Validated through multiple datasets
  };

  // === PHASE 2: CONTEXT-AWARE VERIFICATION TYPES ===
  
  // Enhanced verification context for intelligent weight calculation
  public type VerificationContext = {
    mentionType: AuthorityMentionType;  // Type of authority mention found
    isPreventionContent: Bool;          // Is this educational/prevention content?
    companyProfile: CompanyProfile;     // Company characteristics affecting verification
    confidenceLevel: Float;             // 0.0-1.0 confidence in this context assessment
    regionalContext: RegionalContext;   // Indonesian regional business context
  };
  
  // Classification of authority mentions for context-aware weighting
  public type AuthorityMentionType = {
    #positive_endorsement;  // OJK certification, government partnership
    #neutral_mention;       // Standard regulatory mention
    #educational_content;   // Mentioned in OJK educational material
    #warning_issued;        // OJK warning or sanction
    #under_investigation;   // Active investigation
    #fraud_confirmed;       // Confirmed fraudulent by authorities
  };
  
  // Company profile for industry-specific verification adjustments
  public type CompanyProfile = {
    isDigitalNative: Bool;              // Born-digital vs traditional business
    industry: IndustryType;             // Business industry classification
    establishedYear: ?Int;              // Year company was established
    businessSize: BusinessSize;         // Company size classification
    hasPhysicalPresence: Bool;          // Physical office/operations
    registrationStatus: RegistrationStatus; // Official registration status
  };
  
  public type IndustryType = {
    #fintech;           // Financial technology
    #e_commerce;        // Electronic commerce
    #cryptocurrency;    // Digital currency/blockchain
    #manufacturing;     // Traditional manufacturing
    #agriculture;       // Agricultural business
    #retail;            // Retail/consumer goods
    #services;          // Professional services
    #traditional;       // Traditional Indonesian business
    #unknown;           // Cannot determine industry
  };
  
  public type BusinessSize = {
    #startup;           // <2 years, minimal revenue
    #small;             // Small business (UMKM)
    #medium;            // Medium enterprise
    #large;             // Large corporation
    #unknown;           // Cannot determine size
  };
  
  public type RegistrationStatus = {
    #ojk_registered;    // Registered with OJK
    #oss_registered;    // Online Single Submission registered
    #ministry_registered; // Registered with relevant ministry
    #basic_registration; // Basic business registration only
    #unregistered;      // No official registration found
    #unknown;           // Cannot determine status
  };
  
  // Indonesian regional context for verification
  public type RegionalContext = {
    #jakarta;           // Jakarta - major business center
    #surabaya;          // Surabaya - East Java business hub
    #bandung;           // Bandung - Technology center
    #yogyakarta;        // Yogyakarta - Academic/cultural center
    #medan;             // Medan - North Sumatra business center
    #remote;            // Remote/rural areas
    #unknown;           // Cannot determine location
  };
  // Verification status for companies
  public type VerificationStatus = {
    #pending;      // Initial state, verification in progress
    #verified;     // Passed verification checks
    #suspicious;   // Some red flags detected
    #failed;       // Failed verification, likely fraudulent
    #error;        // Technical error during verification
  };

  // Enhanced individual verification check result
  public type VerificationCheck = {
    checkType : Text;                   // "business_registry", "news_sentiment", "domain_age", etc.
    status : CheckStatus;               // pass, fail, warning
    score : Float;                      // 0-100 score for this specific check
    confidence : Float;                 // 0-1 confidence level in this result
    details : Text;                     // Human-readable explanation
    timestamp : Int;                    // When this check was performed
    weightUsed : Float;                 // Weight used for this check
    contextAdjustment : ?Float;         // Context-based adjustment applied
    evidenceSources : [Text];           // Sources of evidence for this check
    processingTimeMs : ?Nat;            // Time taken for this check
  };

  public type CheckStatus = {
    #pass;     // Check passed - positive indicator
    #fail;     // Check failed - red flag
    #warning;  // Suspicious but not definitive
    #error;    // Technical error during check
  };

  // === PHASE 3: PERFORMANCE TRACKING TYPES ===
  
  // Performance metrics for weight optimization
  public type PerformanceMetrics = {
    falsePositiveRate: Float;       // Rate of legitimate companies flagged as fraudulent
    falseNegativeRate: Float;       // Rate of fraudulent companies passing verification
    f1Score: Float;                 // Harmonic mean of precision and recall
    accuracyScore: Float;           // Overall accuracy percentage
    processingTime: Int;            // Average processing time in nanoseconds
    totalVerifications: Nat;        // Total verifications processed
    lastCalculated: Int;            // When these metrics were calculated
  };
  
  // Weight performance tracking for optimization
  public type WeightPerformanceTracker = {
    var currentWeights: HashMap.HashMap<Text, WeightWithConfidence>;
    var performanceHistory: [(Int, PerformanceMetrics)];
    var lastOptimization: Int;      // Last optimization timestamp
    var optimizationThreshold: Float; // Performance change threshold for reoptimization
    var validationSamples: Nat;     // Number of samples used for validation
  };
  
  // A/B testing framework for weight optimization
  public type WeightTestConfiguration = {
    testId: Text;                   // Unique identifier for this test
    controlWeights: HashMap.HashMap<Text, Float>; // Control group weights
    treatmentWeights: HashMap.HashMap<Text, Float>; // Treatment group weights
    trafficSplit: Float;            // Percentage of traffic to treatment (0.0-1.0)
    startTime: Int;                 // Test start timestamp
    plannedDuration: Int;           // Planned test duration in nanoseconds
    minSampleSize: Nat;             // Minimum samples needed for statistical significance
    isActive: Bool;                 // Whether the test is currently running
  };

  // === PHASE 4: ML INTEGRATION TYPES ===
  
  // Dynamic weight configuration for ML-enhanced fraud detection
  public type DynamicWeightConfig = {
    baseWeights: HashMap.HashMap<Text, WeightWithConfidence>;
    contextMultipliers: HashMap.HashMap<Text, Float>;
    industryAdjustments: HashMap.HashMap<Text, Float>;
    performanceOptimizer: WeightPerformanceTracker;
    mlModelVersion: ?Text;          // Version of ML model if integrated
    lastModelUpdate: ?Int;          // Last ML model update timestamp
  };
  
  // Feature importance analysis for ML weight optimization
  public type FeatureImportanceAnalysis = {
    featureName: Text;              // Name of the verification feature
    importanceScore: Float;         // 0.0-1.0 importance score from ML model
    correlationWithFraud: Float;    // -1.0 to 1.0 correlation with fraud
    stabilityScore: Float;          // How stable this feature is across time
    regionalVariance: Float;        // Variance across Indonesian regions
    lastAnalyzed: Int;              // When this analysis was performed
  };
  
  // Bayesian optimization state for weight tuning
  public type BayesianOptimizationState = {
    exploredWeights: [(HashMap.HashMap<Text, Float>, PerformanceMetrics)];
    bestWeights: HashMap.HashMap<Text, Float>;
    bestScore: Float;               // Best F1 score achieved
    acquisitionFunction: Text;      // Type of acquisition function used
    iterationCount: Nat;            // Number of optimization iterations
    convergenceThreshold: Float;    // Threshold for convergence detection
    lastImprovement: Int;           // Timestamp of last improvement
  };

  // Enhanced verification profile for a company
  public type VerificationProfile = {
    companyId : Nat;
    overallScore : Float;               // 0-100 overall risk score
    verificationStatus : VerificationStatus;
    lastVerified : Int;                 // Timestamp of last verification
    nextDueAt : ?Int;                  // When re-verification is due
    checks : [VerificationCheck];      // Individual verification checks
    fraudKeywords : [Text];            // Indonesian fraud keywords found
    newsArticles : Nat;                // Number of news articles analyzed
    riskFactors : [Text];              // List of identified risk factors
    verificationContext : ?VerificationContext; // Context used for verification
    weightConfigUsed : ?Text;          // Version of weight config used
    confidenceLevel : Float;           // Overall confidence in verification result
    industryBenchmark : ?Float;        // Score relative to industry average
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

  // === BACKWARD COMPATIBILITY ===
  
  // Legacy types maintained for existing code during transition
  public type LegacyVerificationProfile = {
    companyId : Nat;
    overallScore : Float;
    verificationStatus : VerificationStatus;
    lastVerified : Int;
    nextDueAt : ?Int;
    checks : [VerificationCheck];
    fraudKeywords : [Text];
    newsArticles : Nat;
    riskFactors : [Text];
  };

  public type LegacyVerificationCheck = {
    checkType : Text;
    status : CheckStatus;
    score : Float;
    confidence : Float;
    details : Text;
    timestamp : Int;
  };

}