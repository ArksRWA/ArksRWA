import Time "mo:base/Time";
import Array "mo:base/Array";
import HashMap "mo:base/HashMap";
import Hash "mo:base/Hash";
import Text "mo:base/Text";
import Nat "mo:base/Nat";
import Int "mo:base/Int";
import Float "mo:base/Float";
import Principal "mo:base/Principal";
import Debug "mo:base/Debug";
import Blob "mo:base/Blob";
import Error "mo:base/Error";
import Iter "mo:base/Iter";

import Types "./types";
import Core "./core";
import Constants "./constants";
import OldTypes "./old_types";

// Verification Engine Class
persistent actor class VerificationEngine(init_admin: ?Principal, ai_service_url: ?Text, ai_auth_token: ?Text) {
  type VerificationProfile = Types.VerificationProfile;
  type VerificationJob = Types.VerificationJob;
  type VerificationStatus = Types.VerificationStatus;
  type JobStatus = Types.JobStatus;
  type JobPriority = Types.JobPriority;
  type HttpOutcallConfig = Types.HttpOutcallConfig;
  type HttpRequest = Core.HttpRequest;
  type HttpResponse = Core.HttpResponse;
  type TransformArgs = Core.TransformArgs;
  type TransformResult = Core.TransformResult;
  type AIAnalysisRequest = Types.AIAnalysisRequest;
  type AIAnalysisResponse = Types.AIAnalysisResponse;
  type HttpMethod = Core.HttpMethod;
  type HttpHeader = Core.HttpHeader;
    // Admin principal - configurable via constructor parameter
    private transient let admin : Principal = switch(init_admin) {
      case (?p) p;
      case null Principal.fromText("o6dtt-od7eq-p5tmn-yilm3-4v453-v64p5-ep4q6-hxoeq-jhygx-u5dz7-aqe"); // fallback for local dev
    };
    private transient let AI_AUTH_TOKEN : ?Text = ai_auth_token;
    // AI Service Configuration
    private transient let AI_SERVICE_URL : Text = switch(ai_service_url) {
      case (?url) url;
      case null "http://localhost:3001"; // fallback for local dev
    };
  
    // Custom hash function for Nat
    private func natHash(n : Nat) : Hash.Hash {
      Text.hash(Nat.toText(n));
    };

    // Storage for verification profiles and jobs
    private transient var verificationProfiles : HashMap.HashMap<Nat, VerificationProfile> = HashMap.HashMap(0, Nat.equal, natHash);
    private transient var verificationJobs : HashMap.HashMap<Nat, VerificationJob> = HashMap.HashMap(0, Nat.equal, natHash);
    private transient var jobCounter : Nat = 0;
    
    // Enhanced verification system storage (optional for future use)
    private transient var performanceMetrics : ?Types.PerformanceMetrics = null;
    private transient var weightSystemVersion : Text = "2.0.0-indonesian-enhanced";

    // Cache for recent search results (to avoid repeated API calls)
    private transient var searchCache : HashMap.HashMap<Text, (Int, Text)> = HashMap.HashMap(0, Text.equal, Text.hash);
    private transient let CACHE_TTL_NS : Int = 24 * 60 * 60 * 1000_000_000; // 24 hours in nanoseconds
    
    // NEW: Scorer API verification cache for 80%+ cycle reduction
    private transient var verificationCache : HashMap.HashMap<Nat, Types.CachedVerification> = HashMap.HashMap(0, Nat.equal, natHash);
    private transient let SCORER_CACHE_TTL_NS : Int = Constants.SCORER_CACHE_TTL_NS;
    
    // Environment detection (could be enhanced with canister args)
    private func getScorerApiUrl() : Text {
      // In production, this would be configurable via canister arguments
      // For now, use local URL for development, production URL for mainnet
      Constants.SCORER_API_LOCAL_URL # Constants.SCORER_API_SCORE_ENDPOINT;
    };

    // Configuration
    private transient let config : HttpOutcallConfig = Core.DEFAULT_CONFIG;
    private transient var companies : HashMap.HashMap<Nat, OldTypes.Company> = HashMap.HashMap(0, Nat.equal, natHash);
    // Try AI-powered verification first, fallback to legacy
    private transient var verificationStatus : VerificationStatus = #pending;
    private transient var verificationScore : ?Float = null;
    private transient var verificationJobId : ?Nat = null;
    private transient var companyCount : Nat = 0;
    // Public interface functions

    // Start verification for a company
    public func startVerification(companyId : Nat, companyName : Text, priority : JobPriority) : async Nat {
      let job : VerificationJob = {
        jobId = jobCounter;
        companyId = companyId;
        companyName = companyName;
        priority = priority;
        createdAt = Time.now();
        startedAt = null;
        completedAt = null;
        status = #queued;
        result = null;
        errorMessage = null;
      };

      verificationJobs.put(jobCounter, job);
      jobCounter += 1;

      // Start processing immediately for high priority jobs
      if (priority == #high) {
        ignore processVerificationJob(job.jobId);
      };

      job.jobId;
    };

    // Process a verification job
    public func processVerificationJob(jobId : Nat) : async Bool {
      switch (verificationJobs.get(jobId)) {
        case (null) { false };
        case (?job) {
          if (job.status != #queued) {
            return false; // Job already processed
          };

          // Update job status to processing
          let updatedJob = {
            job with 
            status = #processing;
            startedAt = ?Time.now();
          };
          verificationJobs.put(jobId, updatedJob);

          try {
            // Perform the actual verification
            let profile = await performCompanyVerification(job.companyId, job.companyName);
            
            // Store the verification profile
            verificationProfiles.put(job.companyId, profile);

            // Update job with successful completion
            let completedJob = {
              job with
              status = #completed;
              completedAt = ?Time.now();
              result = ?profile;
            };
            verificationJobs.put(jobId, completedJob);

            true;
          } catch (error) {
            // Update job with failure
            let failedJob = {
              job with
              status = #failed;
              completedAt = ?Time.now();
              errorMessage = ?Error.message(error);
            };
            verificationJobs.put(jobId, failedJob);

            false;
          };
        };
      };
    };

    // NEW: Main verification logic with cache-first architecture matching flowchart
    private func performCompanyVerification(companyId : Nat, companyName : Text) : async VerificationProfile {
      Debug.print("Starting verification for company: " # companyName);
      
      // Step 1: Check cache first (as per flowchart)
      switch (getFromVerificationCache(companyId)) {
        case (?cachedProfile) { 
          Debug.print("Cache hit for company " # companyName # " - returning cached result");
          return cachedProfile;
        };
        case (null) { 
          Debug.print("Cache miss for company " # companyName # " - proceeding with API call");
        };
      };
      
      // Step 2: No cache hit - proceed with new Scorer API architecture
      // No API key available in legacy mode - go directly to legacy verification
      Debug.print("No API key available - using legacy verification for " # companyName);
      return await performLegacyVerification(companyId, companyName);
    };
    
    // NEW: Cache-first verification lookup (Step 1 of flowchart)
    private func getFromVerificationCache(companyId : Nat) : ?VerificationProfile {
      switch (verificationCache.get(companyId)) {
        case (?cached) {
          let currentTime = Time.now();
          if (currentTime - cached.cachedAt <= cached.ttl) {
            ?cached.profile // Cache hit - return cached profile
          } else {
            // Cache expired - remove and return null
            verificationCache.delete(companyId);
            null
          };
        };
        case (null) { null }; // No cache entry
      };
    };
    
    // NEW: Build features from company data (Step 2 of flowchart)
    private func buildVerificationFeaturesFromCompanyData(companyId : Nat, companyName : Text) : async Types.CompanyFeatures {
      // In production, this would extract more data from company records
      // For now, use company name and basic description
      let description = "Indonesian company: " # companyName; // Would be actual company description
      let industryType = ?#services; // Would be determined from company data
      let registrationYear = null; // Would be extracted from company records
      
      Core.buildVerificationFeatures(companyId, companyName, description, industryType, registrationYear);
    };
    
    // NEW: Single efficient API call to Scorer API (Step 3 of flowchart)
    private func callScorerAPI(features : Types.CompanyFeatures, apiKey: Text) : async Types.ScorerResponse {
      let context = Core.createVerificationContext(features.companyName, features.description);
      let request = Core.createScorerRequest(features, context);
      let requestJson = Core.serializeScorerRequest(request);
      let requestBody = Text.encodeUtf8(requestJson);
      
      // Create headers with required Gemini API authentication
      let baseHeaders = Core.createScorerApiHeaders();
      let headers = Array.append(baseHeaders, [{
        name = "Authorization";
        value = "Bearer " # apiKey;
      }]);
      
      let scorerUrl = getScorerApiUrl();
      
      let httpRequest : HttpRequest = {
        url = scorerUrl;
        max_response_bytes = ?1048576; // 1MB limit
        headers = headers;
        body = ?Blob.toArray(requestBody);
        method = #post;
        transform = null; // Simplified for now
      };
      
      try {
        let response : HttpResponse = await (with cycles = Constants.SCORER_API_MAX_CYCLES) ic.http_request(httpRequest);
        
        if (response.status == 200) {
          let responseText = textFromBytes(response.body);
          Debug.print("Scorer API response received: " # Nat.toText(Text.size(responseText)) # " bytes");
          
          switch (Core.parseScorerResponse(responseText)) {
            case (?parsedResponse) { parsedResponse };
            case (null) { 
              throw Error.reject("Failed to parse Scorer API response"); 
            };
          };
        } else {
          throw Error.reject("Scorer API request failed with status: " # Nat.toText(response.status));
        };
      } catch (error) {
        Debug.print("Scorer API HTTP outcall failed: " # Error.message(error));
        throw error;
      };
    };
    
    // NEW: Map Scorer response to VerificationProfile (Step 4 of flowchart)
    private func mapScorerResponseToProfile(
      companyId : Nat, 
      response : Types.ScorerResponse, 
      features : Types.CompanyFeatures
    ) : VerificationProfile {
      let context = Core.createVerificationContext(features.companyName, features.description);
      Core.mapScorerResponseToProfile(companyId, response, features, context);
    };
    
    // NEW: Cache verification result with TTL (Step 5 of flowchart)
    private func cacheVerificationResult(companyId : Nat, profile : VerificationProfile) : () {
      let cachedVerification : Types.CachedVerification = {
        profile = profile;
        cachedAt = Time.now();
        ttl = SCORER_CACHE_TTL_NS;
      };
      verificationCache.put(companyId, cachedVerification);
      Debug.print("Cached verification result for company " # Nat.toText(companyId));
    };
    
    // LEGACY: Fallback to original Google search verification
    private func performLegacyVerification(companyId : Nat, companyName : Text) : async VerificationProfile {
      Debug.print("Performing legacy verification for company: " # companyName);

      // Create search queries for this company
      let queries = Core.createSearchQueries(companyName);
      var searchResults : [(Types.IndonesianSearchQuery, [Types.GoogleSearchResult])] = [];

      // Process each search query
      let queriesArray = Iter.toArray(queries.vals());
      for (i in queriesArray.keys()) {
        let searchQuery = queriesArray[i];
        try {
          let results = await performGoogleSearch(searchQuery);
          searchResults := Array.append(searchResults, [(searchQuery, results)]);
          
          // Add delay between requests to avoid rate limiting
          await waitForDelay(config.rateLimitDelayMs);
        } catch (error) {
          Debug.print("Search failed for query: " # Error.message(error));
          // Continue with other queries even if one fails
          searchResults := Array.append(searchResults, [(searchQuery, [])]);
        };
      };

      // Create verification profile from all search results
      let profile = Core.createVerificationProfile(companyId, searchResults);
      
      Debug.print("Legacy verification completed for " # companyName # " with score: " # Float.toText(profile.overallScore));
      
      profile;
    };

    // Perform Google search with HTTPS outcalls
    private func performGoogleSearch(searchQuery : Types.IndonesianSearchQuery) : async [Types.GoogleSearchResult] {
      let searchUrl = Core.buildGoogleSearchURL(searchQuery);
      let cacheKey = searchUrl;

      // Check cache first
      switch (searchCache.get(cacheKey)) {
        case (?cachedResult) {
          let (timestamp, content) = cachedResult;
          if (Time.now() - timestamp < CACHE_TTL_NS) {
            Debug.print("Using cached result for: " # cacheKey);
            return Core.parseGoogleSearchResults(content, searchQuery);
          };
        };
        case null {};
      };

      let headers = Core.createHttpHeaders(config);
      
      let request : HttpRequest = {
        url = searchUrl;
        max_response_bytes = ?1048576; // 1MB limit
        headers = headers;
        body = null;
        method = #get;
        transform = null; // Simplified for now - remove transform function
      };

      try {
        let response : HttpResponse = await (with cycles = config.maxCycles) ic.http_request(request);
        
        if (response.status == 200) {
          let contentText = textFromBytes(response.body);
          
          // Cache the result
          searchCache.put(cacheKey, (Time.now(), contentText));
          
          let results = Core.parseGoogleSearchResults(contentText, searchQuery);
          Debug.print("Google search completed, found " # Nat.toText(results.size()) # " results");
          
          results;
        } else {
          Debug.print("HTTP request failed with status: " # Nat.toText(response.status));
          [];
        };
      } catch (error) {
        Debug.print("HTTP outcall failed: " # Error.message(error));
        [];
      };
    };

    // Transform function for HTTP responses (required for consensus)  
    private func _transformResponse(args : TransformArgs) : TransformResult {
      {
        response = {
          status = args.response.status;
          headers = []; // Remove headers for consensus
          body = args.response.body;
        };
      };
    };

    // Convert bytes to text
    private func textFromBytes(bytes : [Nat8]) : Text {
      switch (Text.decodeUtf8(Blob.fromArray(bytes))) {
        case (?text) { text };
        case null { "" };
      };
    };

    // Simple delay function
    private func waitForDelay(delayMs : Nat) : async () {
      let delayNs = delayMs * 1_000_000; // Convert to nanoseconds
      let startTime = Time.now();
      while (Time.now() - startTime < delayNs) {
        // Simple busy wait - in production, use proper async delay
        ();
      };
    };

    // Get verification profile for a company
    func getVerificationProfile(companyId : Nat) : ?VerificationProfile {
      verificationProfiles.get(companyId);
    };

    // Get verification status for a company
    func getVerificationStatus(companyId : Nat) : ?VerificationStatus {
      switch (verificationProfiles.get(companyId)) {
        case (?profile) { ?profile.verificationStatus };
        case null { null };
      };
    };

    // Get verification score for a company
    func getVerificationScore(companyId : Nat) : ?Float {
      switch (verificationProfiles.get(companyId)) {
        case (?profile) { ?profile.overallScore };
        case null { null };
      };
    };

    // Check if company needs re-verification
    func needsReverification(companyId : Nat) : Bool {
      switch (verificationProfiles.get(companyId)) {
        case (?profile) {
          switch (profile.nextDueAt) {
            case (?dueTime) { Time.now() >= dueTime };
            case null { true }; // If no due date set, needs verification
          };
        };
        case null { true }; // No profile means needs verification
      };
    };

    // Get verification job status
    func getJobStatus(jobId : Nat) : ?VerificationJob {
      verificationJobs.get(jobId);
    };

    // List all verification profiles
    func listVerificationProfiles() : [VerificationProfile] {
      Iter.toArray(verificationProfiles.vals());
    };

    // List pending verification jobs
    func listPendingJobs() : [VerificationJob] {
      let allJobs = Iter.toArray(verificationJobs.vals());
      Array.filter(allJobs, func(job : VerificationJob) : Bool {
        job.status == #queued or job.status == #processing;
      });
    };

    // Cancel a verification job
    func cancelJob(jobId : Nat) : Bool {
      switch (verificationJobs.get(jobId)) {
        case (?job) {
          if (job.status == #queued or job.status == #processing) {
            let cancelledJob = {
              job with
              status = #cancelled;
              completedAt = ?Time.now();
            };
            verificationJobs.put(jobId, cancelledJob);
            true;
          } else {
            false; // Job already completed or cancelled
          };
        };
        case null { false };
      };
    };

    // Clear old cache entries (legacy search cache)
    func cleanupCache() : Nat {
      let currentTime = Time.now();
      var removedCount = 0;
      
      let entries = Iter.toArray(searchCache.entries());
      for ((key, value) in entries.vals()) {
        let (timestamp, _) = value;
        if (currentTime - timestamp > CACHE_TTL_NS) {
          searchCache.delete(key);
          removedCount += 1;
        };
      };
      
      removedCount;
    };
    
    // NEW: Clean up expired verification cache entries for memory management
    func cleanupVerificationCache() : Nat {
      let currentTime = Time.now();
      var removedCount = 0;
      
      let entries = Iter.toArray(verificationCache.entries());
      for ((companyId, cached) in entries.vals()) {
        if (currentTime - cached.cachedAt > cached.ttl) {
          verificationCache.delete(companyId);
          removedCount += 1;
        };
      };
      
      Debug.print("Cleaned up " # Nat.toText(removedCount) # " expired verification cache entries");
      removedCount;
    };
    
    // NEW: Get verification cache statistics
    func getVerificationCacheStats() : { entries : Nat; expiredEntries : Nat; hitRate : ?Float } {
      let currentTime = Time.now();
      var totalEntries = 0;
      var expiredEntries = 0;
      
      for ((companyId, cached) in verificationCache.entries()) {
        totalEntries += 1;
        if (currentTime - cached.cachedAt > cached.ttl) {
          expiredEntries += 1;
        };
      };
      
      { 
        entries = totalEntries; 
        expiredEntries = expiredEntries;
        hitRate = null; // Would track in production
      };
    };
    
    // NEW: Force cache refresh for a company (admin function)
    func refreshCompanyVerification(companyId : Nat, companyName : Text) : async VerificationProfile {
      // Remove from cache to force refresh
      verificationCache.delete(companyId);
      
      // Perform fresh verification
      await performCompanyVerification(companyId, companyName);
    };

    // Get cache statistics
    func getCacheStats() : { entries : Nat; oldEntries : Nat } {
      let currentTime = Time.now();
      var totalEntries = 0;
      var oldEntries = 0;
      
      for ((key, value) in searchCache.entries()) {
        totalEntries += 1;
        let (timestamp, _) = value;
        if (currentTime - timestamp > CACHE_TTL_NS) {
          oldEntries += 1;
        };
      };
      
      { entries = totalEntries; oldEntries = oldEntries };
    };

    // === ENHANCED VERIFICATION SYSTEM INTEGRATION ===
    
    // Get current weight system version
    func getWeightSystemVersion() : Text {
      weightSystemVersion;
    };
    
    // Get performance metrics (if available)
    func getPerformanceMetrics() : ?Types.PerformanceMetrics {
      performanceMetrics;
    };
    
    // Update performance metrics based on verification results
    func updatePerformanceMetrics(
      verificationResults: [(VerificationProfile, Bool)], // (profile, isActuallyFraudulent)
      processingTimes: [Int]
    ) : Types.PerformanceMetrics {
      let metrics = Core.calculatePerformanceMetrics(verificationResults, processingTimes);
      performanceMetrics := ?metrics;
      metrics;
    };
    
    // Enhanced verification with context awareness (future integration point)
    func performEnhancedVerification(
      companyId : Nat, 
      companyName : Text, 
      _companyDescription : Text,
      priority : JobPriority
    ) : async Nat {
      // For now, delegate to standard verification
      // Future enhancement: build verification context and use enhanced weight system
      await startVerification(companyId, companyName, priority);
    };
    
    // NEW: Direct Scorer API verification with external API key
    public func performScorerApiVerification(
      companyId : Nat,
      companyName : Text,
      companyDescription : Text,
      apiKey : Text
    ) : async VerificationProfile {
      Debug.print("Direct Scorer API verification for: " # companyName);
      
      // Check cache first
      switch (getFromVerificationCache(companyId)) {
        case (?cachedProfile) {
          Debug.print("Using cached Scorer API result for " # companyName);
          return cachedProfile;
        };
        case (null) {
          // Continue with fresh verification
        };
      };
      
      // Build features with provided description
      let industryType = ?#services; // Would be determined from company data
      let registrationYear = null; // Would be extracted from company records
      let features = Core.buildVerificationFeatures(companyId, companyName, companyDescription, industryType, registrationYear);
      
      try {
        // Call Scorer API with provided key
        let scorerResponse = await callScorerAPI(features, apiKey);
        
        // Map to verification profile
        let profile = mapScorerResponseToProfile(companyId, scorerResponse, features);
        
        // Cache the result
        cacheVerificationResult(companyId, profile);
        
        Debug.print("Scorer API verification completed with score: " # Float.toText(profile.overallScore));
        profile;
        
      } catch (error) {
        Debug.print("Scorer API verification failed: " # Error.message(error));
        throw error;
      };
    };
    
    // Validate current weight configuration
    func validateWeights() : { isValid: Bool; warnings: [Text]; recommendations: [Text] } {
      let weights = HashMap.HashMap<Text, Float>(6, Text.equal, Text.hash);
      weights.put("fraud_keywords", Constants.FRAUD_KEYWORDS_WEIGHT);
      weights.put("news_sentiment", Constants.NEWS_SENTIMENT_WEIGHT);
      weights.put("business_registry", Constants.BUSINESS_REGISTRY_WEIGHT);
      weights.put("authority_mentions", Constants.AUTHORITY_MENTIONS_WEIGHT);
      weights.put("digital_footprint", Constants.DIGITAL_FOOTPRINT_WEIGHT);
      weights.put("domain_age", Constants.DOMAIN_AGE_WEIGHT);
      
      Core.validateWeightConfiguration(weights);
    };
    
    // Get weight optimization recommendations (if performance metrics available)
    func getWeightOptimizationRecommendations() : ?[(Text, Float)] {
      switch (performanceMetrics) {
        case (?currentMetrics) {
          let targetMetrics : Types.PerformanceMetrics = {
            falsePositiveRate = Constants.TARGET_FALSE_POSITIVE_RATE;
            falseNegativeRate = Constants.TARGET_FALSE_NEGATIVE_RATE;
            f1Score = Constants.TARGET_F1_SCORE;
            accuracyScore = 0.85; // Target 85% accuracy
            processingTime = Constants.MAX_PROCESSING_TIME_MS * 1_000_000; // Convert to nanoseconds
            totalVerifications = 0; // Not used for recommendations
            lastCalculated = Time.now();
          };
          
          ?Core.recommendWeightAdjustments(currentMetrics, targetMetrics);
        };
        case (null) { null };
      };
    };

    // NEW: Enhanced verification with Gemini API key support
    public func startVerificationWithApiKey(
      companyId: Nat,
      companyName: Text,
      priority: JobPriority,
      apiKey: ?Text
    ) : async ?Nat {
      // Create verification job
      let jobId = jobCounter;
      jobCounter += 1;
      
      let job : VerificationJob = {
        jobId = jobId;
        companyId = companyId;
        companyName = companyName;
        priority = priority;
        status = #processing;
        createdAt = Time.now();
        startedAt = ?Time.now();
        completedAt = null;
        result = null;
        errorMessage = null;
      };
      
      verificationJobs.put(jobId, job);
      
      // Start verification process with API key support
      ignore async {
        try {
          let profile = await performEnhancedVerificationWithApiKey(companyId, companyName, apiKey);
          
          // Update job with success
          let completedJob : VerificationJob = {
            jobId = job.jobId;
            companyId = job.companyId;
            companyName = job.companyName;
            priority = job.priority;
            status = #completed;
            createdAt = job.createdAt;
            startedAt = job.startedAt;
            completedAt = ?Time.now();
            result = ?profile;
            errorMessage = null;
          };
          
          verificationJobs.put(jobId, completedJob);
        } catch (error) {
          // Update job with error
          let failedJob : VerificationJob = {
            jobId = job.jobId;
            companyId = job.companyId;
            companyName = job.companyName;
            priority = job.priority;
            status = #failed;
            createdAt = job.createdAt;
            startedAt = job.startedAt;
            completedAt = ?Time.now();
            result = null;
            errorMessage = ?Error.message(error);
          };
          
          verificationJobs.put(jobId, failedJob);
          Debug.print("Verification failed for company " # companyName # ": " # Error.message(error));
        };
      };
      
      ?jobId;
    };

    // Enhanced verification process with API key support
    private func performEnhancedVerificationWithApiKey(companyId: Nat, companyName: Text, apiKey: ?Text) : async VerificationProfile {
      // Check cache first
      switch (getFromVerificationCache(companyId)) {
        case (?cachedProfile) {
          Debug.print("Using cached verification profile for " # companyName);
          return cachedProfile;
        };
        case (null) {
          // Continue with verification
        };
      };
      
      try {
        // Step 3: Build features from company data
        let features = await buildVerificationFeaturesFromCompanyData(companyId, companyName);
        
        // Step 4: Enhanced API call with Gemini authentication
        let scorerResponse = switch (apiKey) {
          case (?key) { await callScorerAPI(features, key) };
          case (null) { throw Error.reject("API key required for AI-powered verification") };
        };
        
        // Step 5: Map response to VerificationProfile
        let profile = mapScorerResponseToProfile(companyId, scorerResponse, features);
        
        // Step 6: Cache result
        cacheVerificationResult(companyId, profile);
        
        Debug.print("Enhanced verification completed for " # companyName # " with API key support, score: " # Float.toText(profile.overallScore));
        return profile;
        
      } catch (error) {
        Debug.print("Enhanced verification failed for " # companyName # ", falling back to legacy: " # Error.message(error));
        // Fallback to legacy verification without API key
        return await performLegacyVerification(companyId, companyName);
      };
    };

    // System IC interface for HTTP requests
    private transient let ic : actor {
      http_request : HttpRequest -> async HttpResponse;
    } = actor("aaaaa-aa");

    

  // Call AI service for fraud analysis
  public func callAIService(companyData : AIAnalysisRequest, ai_auth_token : ?Text) : async AIAnalysisResponse {
    switch (ai_auth_token) {
      case (null) {
        Debug.print("No AI auth token configured, skipping AI analysis");
        return {
          success = false;
          fraudScore = null;
          riskLevel = null;
          confidence = null;
          processingTimeMs = null;
          error = ?"No AI authentication token configured";
        };
      };
      case (?authToken) {
        try {
          let requestBody = "{\"name\":\"" # companyData.name # "\",\"description\":\"" # companyData.description # "\"" #
            (switch (companyData.industry) { case (?industry) ",\"industry\":\"" # industry # "\""; case null "" }) #
            (switch (companyData.region) { case (?region) ",\"region\":\"" # region # "\""; case null "" }) #
            (switch (companyData.valuation) { case (?val) ",\"valuation\":" # Nat.toText(val); case null "" }) #
            (switch (companyData.symbol) { case (?sym) ",\"symbol\":\"" # sym # "\""; case null "" }) #
            "}";

          let url = AI_SERVICE_URL # "/analyze-company";
          
          let headers : [HttpHeader] = [
            { name = "Content-Type"; value = "application/json" },
            { name = "Authorization"; value = "Bearer " # authToken },
            { name = "User-Agent"; value = "ARKS-RWA-Canister/1.0" }
          ];

          let request : HttpRequest = {
            url = url;
            max_response_bytes = ?1048576; // 1MB limit
            headers = headers;
            body = ?Blob.toArray(Text.encodeUtf8(requestBody));
            method = #post;
            transform = null; // Simplified - no transform for now
          };

          Debug.print("Calling AI service at: " # url);
          let response = await (with cycles = 2_000_000_000) ic.http_request(request);

          if (response.status == 200) {
            let responseText = textFromBytes(response.body);
            Debug.print("AI service response: " # responseText);
            
            // Parse the JSON response (simplified parsing)
            return parseAIResponse(responseText);
          } else {
            Debug.print("AI service returned status: " # Nat.toText(response.status));
            return {
              success = false;
              fraudScore = null;
              riskLevel = null;
              confidence = null;
              processingTimeMs = null;
              error = ?"AI service returned error status";
            };
          };
        } catch (error) {
          Debug.print("AI service call failed: " # Error.message(error));
          return {
            success = false;
            fraudScore = null;
            riskLevel = null;
            confidence = null;
            processingTimeMs = null;
            error = ?"AI service call failed";
          };
        };
      };
    };
  };

  // Simple JSON response parser for AI service
  private func parseAIResponse(responseText : Text) : AIAnalysisResponse {
    // Simplified JSON parsing - in production, use proper JSON parser
    if (Text.contains(responseText, #text "\"success\":true")) {
      let fraudScore = extractNumberFromJson(responseText, "fraudScore");
      let confidence = extractNumberFromJson(responseText, "confidence");
      let processingTime = extractNumberFromJson(responseText, "processingTimeMs");
      let riskLevel = extractTextFromJson(responseText, "riskLevel");
      
      {
        success = true;
        fraudScore = fraudScore;
        riskLevel = riskLevel;
        confidence = confidence;
        processingTimeMs = processingTime;
        error = null;
      };
    } else {
      {
        success = false;
        fraudScore = null;
        riskLevel = null;
        confidence = null;
        processingTimeMs = null;
        error = ?"AI service returned unsuccessful response";
      };
    };
  };

  // Extract number from JSON string (simplified)
  private func extractNumberFromJson(_json : Text, _key : Text) : ?Nat {
    // Very simplified - in production use proper JSON parser
    null; // Would implement JSON parsing logic
  };

  // Extract text from JSON string (simplified)
  private func extractTextFromJson(_json : Text, _key : Text) : ?Text {
    // Very simplified - in production use proper JSON parser
    null; // Would implement JSON parsing logic
  };
  // ===== VERIFICATION SYSTEM FUNCTIONS =====

  // Get verification status for a company
  public query func getCompanyVerificationStatus(companyId : Nat) : async ?{
    status : VerificationStatus;
    score : ?Float;
    lastVerified : ?Int;
  } {
    switch (companies.get(companyId)) {
      case (?company) {
        ?{
          status = company.verification_status;
          score = company.verification_score;
          lastVerified = company.last_verified;
        };
      };
      case null { null };
    };
  };

  // Get detailed verification profile for a company
  public query func getCompanyVerificationProfile(companyId : Nat) : async ?VerificationProfile {
    getVerificationProfile(companyId);
  };

  // Check if company needs reverification
  public query func companyNeedsReverification(companyId : Nat) : async Bool {
    needsReverification(companyId);
  };

  // Get verification job status
  public query func getVerificationJobStatus(jobId : Nat) : async ?VerificationJob {
    getJobStatus(jobId);
  };

  // Start manual verification for a company (admin only)
  public func startManualVerification(companyId : Nat, priority : JobPriority, caller : Principal) : async ?Nat {
    if (caller != admin) {
      throw Error.reject("Authorization failed: Only admin can start manual verification.");
    };

    switch (companies.get(companyId)) {
      case (?company) {
        let jobId = await startVerification(companyId, company.name, priority);
        
        // Update company with new verification job ID
        let updatedCompany = {
          company with
          verification_status = #pending;
          verification_job_id = ?jobId;
        };
        companies.put(companyId, updatedCompany);
        
        ?jobId;
      };
      case null { null };
    };
  };

  // Process pending verification jobs (admin only)
  public func processVerificationJobs(maxJobs : Nat, caller : Principal) : async Nat {
    if (caller != admin) {
      throw Error.reject("Authorization failed: Only admin can process verification jobs.");
    };

    let pendingJobs = listPendingJobs();
    var processedCount = 0;

    for (job in pendingJobs.vals()) {
      if (processedCount < maxJobs and job.status == #queued) {
        let success = await processVerificationJob(job.jobId);
        if (success) {
          processedCount += 1;
          
          // Update company verification status
          await updateCompanyFromVerificationResult(job.companyId);
        };
      };
    };

    processedCount;
  };

  // Update company data from verification results
  private func updateCompanyFromVerificationResult(companyId : Nat) : async () {
    switch (companies.get(companyId)) {
      case (?company) {
        switch (getVerificationProfile(companyId)) {
          case (?profile) {
            let updatedCompany = {
              company with
              verification_status = profile.verificationStatus;
              verification_score = ?profile.overallScore;
              last_verified = ?profile.lastVerified;
            };
            companies.put(companyId, updatedCompany);
          };
          case null { /* No profile available yet */ };
        };
      };
      case null { /* Company not found */ };
    };
  };

  // Get verification statistics for admin dashboard
  public query func getVerificationStats(caller : Principal) : async ?{
    totalCompanies : Nat;
    verifiedCompanies : Nat;
    pendingVerifications : Nat;
    suspiciousCompanies : Nat;
    failedVerifications : Nat;
    averageScore : ?Float;
  } {
    if (caller != admin) {
      return null; // Only admin can access stats
    };

    var verifiedCount = 0;
    var pendingCount = 0;
    var suspiciousCount = 0;
    var failedCount = 0;
    var totalScore : Float = 0.0;
    var scoredCount = 0;

    for (company in companies.vals()) {
      switch (company.verification_status) {
        case (#verified) { verifiedCount += 1 };
        case (#pending) { pendingCount += 1 };
        case (#suspicious) { suspiciousCount += 1 };
        case (#failed) { failedCount += 1 };
        case (#error) { failedCount += 1 };
      };

      switch (company.verification_score) {
        case (?score) {
          totalScore += score;
          scoredCount += 1;
        };
        case null {};
      };
    };

    let averageScore = if (scoredCount > 0) {
      ?(totalScore / Float.fromInt(scoredCount));
    } else {
      null;
    };

    ?{
      totalCompanies = companyCount;
      verifiedCompanies = verifiedCount;
      pendingVerifications = pendingCount;
      suspiciousCompanies = suspiciousCount;
      failedVerifications = failedCount;
      averageScore = averageScore;
    };
  };

  // Cancel verification job (admin only)
  public func cancelVerificationJob(jobId : Nat, caller : Principal) : async Bool {
    if (caller != admin) {
      throw Error.reject("Authorization failed: Only admin can cancel verification jobs.");
    };

    cancelJob(jobId);
  };
  
  // NEW: Get Scorer API verification cache statistics
  public query func getScorerCacheStats(caller : Principal) : async ?{ entries : Nat; expiredEntries : Nat; hitRate : ?Float } {
    // Only admin can access cache stats
    if (caller != admin) {
      return null;
    };
    
    ?getVerificationCacheStats();
  };
  
  // NEW: Clean up expired Scorer API cache entries
  public func cleanupScorerCache(caller : Principal) : async ?Nat {
    // Only admin can clean cache
    if (caller != admin) {
      return null;
    };
    
    ?cleanupVerificationCache();
  };
  
  // NEW: Test Scorer API verification with external API key (for testing the new architecture)
  public func testScorerApiVerification(companyId : Nat, apiKey : Text, caller : Principal) : async ?VerificationProfile {
    // Only admin can test Scorer API
    if (caller != admin) {
      return null;
    };
    
    switch (companies.get(companyId)) {
      case (?company) {
        try {
          let profile = await performScorerApiVerification(
            companyId, 
            company.name, 
            company.description,
            apiKey
          );
          ?profile;
        } catch (_error) {
          null; // Return null on error for testing
        };
      };
      case (null) { null };
    };
  };
  
  // NEW: Force refresh company verification using new architecture
  public func refreshCompanyVerificationScorer(companyId : Nat, caller : Principal) : async ?VerificationProfile {
    // Only admin can force refresh
    if (caller != admin) {
      return null;
    };
    
    switch (companies.get(companyId)) {
      case (?company) {
        try {
          let profile = await refreshCompanyVerification(companyId, company.name);
          ?profile;
        } catch (_error) {
          null;
        };
      };
      case (null) { null };
    };
  };

  // Override verification status (admin emergency function)
  public func overrideVerificationStatus(
    companyId : Nat, 
    newStatus : VerificationStatus, 
    newScore : ?Float, 
    caller : Principal
  ) : async Bool {
    if (caller != admin) {
      throw Error.reject("Authorization failed: Only admin can override verification status.");
    };

    switch (companies.get(companyId)) {
      case (?company) {
        let updatedCompany = {
          company with
          verification_status = newStatus;
          verification_score = newScore;
          last_verified = ?Time.now();
        };
        companies.put(companyId, updatedCompany);
        true;
      };
      case null { false };
    };
  };
};

// module {
//   public func createVerificationEngine(admin : ?Principal, ai_service_url: ?Text, ai_auth_token: ?Text) : async VerificationEngine {
//     await VerificationEngine(admin, ai_service_url, ai_auth_token);
//   };
// }