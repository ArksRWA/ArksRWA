import Time "mo:base/Time";
import Array "mo:base/Array";
import HashMap "mo:base/HashMap";
import Hash "mo:base/Hash";
import Text "mo:base/Text";
import Option "mo:base/Option";
import Result "mo:base/Result";
import Nat "mo:base/Nat";
import Int "mo:base/Int";
import Float "mo:base/Float";
import Principal "mo:base/Principal";
import Cycles "mo:base/ExperimentalCycles";
import Debug "mo:base/Debug";
import Blob "mo:base/Blob";
import Error "mo:base/Error";
import Iter "mo:base/Iter";

import Types "./types";
import Core "./core";
import Constants "./constants";

// Verification Engine Module
module {
  public type VerificationProfile = Types.VerificationProfile;
  public type VerificationJob = Types.VerificationJob;
  public type VerificationStatus = Types.VerificationStatus;
  public type JobStatus = Types.JobStatus;
  public type JobPriority = Types.JobPriority;
  public type HttpOutcallConfig = Types.HttpOutcallConfig;
  public type HttpRequest = Core.HttpRequest;
  public type HttpResponse = Core.HttpResponse;
  public type TransformArgs = Core.TransformArgs;
  public type TransformResult = Core.TransformResult;

  // Verification Engine Class
  public class VerificationEngine() {
    
    // Custom hash function for Nat
    private func natHash(n : Nat) : Hash.Hash {
      Text.hash(Nat.toText(n));
    };

    // Storage for verification profiles and jobs
    private var verificationProfiles : HashMap.HashMap<Nat, VerificationProfile> = HashMap.HashMap(0, Nat.equal, natHash);
    private var verificationJobs : HashMap.HashMap<Nat, VerificationJob> = HashMap.HashMap(0, Nat.equal, natHash);
    private var jobCounter : Nat = 0;
    
    // Enhanced verification system storage (optional for future use)
    private var performanceMetrics : ?Types.PerformanceMetrics = null;
    private var weightSystemVersion : Text = "2.0.0-indonesian-enhanced";

    // Cache for recent search results (to avoid repeated API calls)
    private var searchCache : HashMap.HashMap<Text, (Int, Text)> = HashMap.HashMap(0, Text.equal, Text.hash);
    private let CACHE_TTL_NS : Int = 24 * 60 * 60 * 1000_000_000; // 24 hours in nanoseconds
    
    // NEW: Scorer API verification cache for 80%+ cycle reduction
    private var verificationCache : HashMap.HashMap<Nat, Types.CachedVerification> = HashMap.HashMap(0, Nat.equal, natHash);
    private let SCORER_CACHE_TTL_NS : Int = Constants.SCORER_CACHE_TTL_NS;
    
    // Environment detection (could be enhanced with canister args)
    private func getScorerApiUrl() : Text {
      // In production, this would be configurable via canister arguments
      // For now, use local URL for development, production URL for mainnet
      Constants.SCORER_API_LOCAL_URL # Constants.SCORER_API_SCORE_ENDPOINT;
    };

    // Configuration
    private let config : HttpOutcallConfig = Core.DEFAULT_CONFIG;

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
    public func getVerificationProfile(companyId : Nat) : ?VerificationProfile {
      verificationProfiles.get(companyId);
    };

    // Get verification status for a company
    public func getVerificationStatus(companyId : Nat) : ?VerificationStatus {
      switch (verificationProfiles.get(companyId)) {
        case (?profile) { ?profile.verificationStatus };
        case null { null };
      };
    };

    // Get verification score for a company
    public func getVerificationScore(companyId : Nat) : ?Float {
      switch (verificationProfiles.get(companyId)) {
        case (?profile) { ?profile.overallScore };
        case null { null };
      };
    };

    // Check if company needs re-verification
    public func needsReverification(companyId : Nat) : Bool {
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
    public func getJobStatus(jobId : Nat) : ?VerificationJob {
      verificationJobs.get(jobId);
    };

    // List all verification profiles
    public func listVerificationProfiles() : [VerificationProfile] {
      Iter.toArray(verificationProfiles.vals());
    };

    // List pending verification jobs
    public func listPendingJobs() : [VerificationJob] {
      let allJobs = Iter.toArray(verificationJobs.vals());
      Array.filter(allJobs, func(job : VerificationJob) : Bool {
        job.status == #queued or job.status == #processing;
      });
    };

    // Cancel a verification job
    public func cancelJob(jobId : Nat) : Bool {
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
    public func cleanupCache() : Nat {
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
    public func cleanupVerificationCache() : Nat {
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
    public func getVerificationCacheStats() : { entries : Nat; expiredEntries : Nat; hitRate : ?Float } {
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
    public func refreshCompanyVerification(companyId : Nat, companyName : Text) : async VerificationProfile {
      // Remove from cache to force refresh
      verificationCache.delete(companyId);
      
      // Perform fresh verification
      await performCompanyVerification(companyId, companyName);
    };

    // Get cache statistics
    public func getCacheStats() : { entries : Nat; oldEntries : Nat } {
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
    public func getWeightSystemVersion() : Text {
      weightSystemVersion;
    };
    
    // Get performance metrics (if available)
    public func getPerformanceMetrics() : ?Types.PerformanceMetrics {
      performanceMetrics;
    };
    
    // Update performance metrics based on verification results
    public func updatePerformanceMetrics(
      verificationResults: [(VerificationProfile, Bool)], // (profile, isActuallyFraudulent)
      processingTimes: [Int]
    ) : Types.PerformanceMetrics {
      let metrics = Core.calculatePerformanceMetrics(verificationResults, processingTimes);
      performanceMetrics := ?metrics;
      metrics;
    };
    
    // Enhanced verification with context awareness (future integration point)
    public func performEnhancedVerification(
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
    public func validateWeights() : { isValid: Bool; warnings: [Text]; recommendations: [Text] } {
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
    public func getWeightOptimizationRecommendations() : ?[(Text, Float)] {
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
    private let ic : actor {
      http_request : HttpRequest -> async HttpResponse;
    } = actor("aaaaa-aa");
  };

  // Helper function to create verification engine instance
  public func createVerificationEngine() : VerificationEngine {
    VerificationEngine();
  };
}