import Time "mo:base/Time";
import Array "mo:base/Array";
import HashMap "mo:base/HashMap";
import Hash "mo:base/Hash";
import Text "mo:base/Text";
import Nat "mo:base/Nat";
import Nat64 "mo:base/Nat64";
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
persistent actor class VerificationEngine(init_admin: Principal, ai_service_url: ?Text, _ai_auth_token: ?Text) = self {
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
    // Admin principal is required - no fallback or null handling needed
    private transient let admin : Principal = init_admin;
    // AI Service Configuration
    private transient let AI_SERVICE_URL : Text = switch(ai_service_url) {
      case (?url) url;
      case null "http://localhost:3001"; // fallback for local dev
    };
    
    // Core canister registry - managed dynamically
    private var registeredCoreCanisterIds : [Principal] = [];
    
    // Core canister interface types
    public type CoreCompany = {
      id : Nat;
      name : Text;
      symbol : Text;
      owner : Principal;
      verification : Types.VerificationProfile;
      // Add other fields as needed
    };
    
    // Core canister interface for callbacks
    private func getCoreCanisterActor(canisterId : Principal) : actor {
      updateVerificationResult : (Nat, Types.VerificationProfile, Principal) -> async ();
      getCompany : (Nat) -> async ?CoreCompany;
      listCompanies : () -> async [CoreCompany];
    } {
      actor(Principal.toText(canisterId))
    };
    
    // Define core canister verification profile type
    type CoreVerificationProfile = {
      state : { #Registered; #VerificationPending; #Verified; #NeedsUpdate; #Rejected; #Failed };
      score : ?Float;
      risk_label : { #Trusted; #Caution; #HighRisk };
      last_scored_at : ?Nat64;
      next_due_at : ?Nat64;
      explanation_hash : ?Text;
      last_vc_registration : ?Nat64;
      last_vc_valuation : ?Nat64;
    };

    // Core canister interface type
    type CoreCanisterInterface = actor {
      updateVerificationResult : (Nat, CoreVerificationProfile, Principal) -> async ();
    };

    // Core canister management functions
    public func registerCoreCanister(canisterId : Principal, caller : Principal) : async () {
      if (caller != admin) {
        throw Error.reject("Authorization failed: Only admin can register core canisters");
      };
      
      // Check if already registered
      for (id in registeredCoreCanisterIds.vals()) {
        if (id == canisterId) { return }; // Already registered
      };
      
      registeredCoreCanisterIds := Array.append(registeredCoreCanisterIds, [canisterId]);
    };
    
    public func unregisterCoreCanister(canisterId : Principal, caller : Principal) : async () {
      if (caller != admin) {
        throw Error.reject("Authorization failed: Only admin can unregister core canisters");
      };
      
      registeredCoreCanisterIds := Array.filter(registeredCoreCanisterIds, func(id : Principal) : Bool { id != canisterId });
    };
    
    public query func listRegisteredCoreCanisterIds(caller : Principal) : async [Principal] {
      if (caller != admin) {
        return [];
      };
      registeredCoreCanisterIds;
    };
  
    // Custom hash function for Nat
    private func natHash(n : Nat) : Hash.Hash {
      Text.hash(Nat.toText(n));
    };

    // Storage for verification profiles and jobs
    private transient var verificationProfiles : HashMap.HashMap<Nat, VerificationProfile> = HashMap.HashMap(0, Nat.equal, natHash);
    private transient var verificationJobs : HashMap.HashMap<Nat, VerificationJob> = HashMap.HashMap(0, Nat.equal, natHash);
    private transient var jobCounter : Nat = 0;

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

            // Update core canisters with verification result
            for (coreCanisterId in registeredCoreCanisterIds.vals()) {
              let coreRef = getCoreCanisterActor(coreCanisterId);
              try {
                await coreRef.updateVerificationResult(job.companyId, profile, Principal.fromActor(self));
              } catch (error) {
                Debug.print("Failed to update core canister for company " # job.companyName # ": " # Error.message(error));
                // Continue anyway - verification is complete even if core update fails
              };
            };

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
        max_response_bytes = ?Constants.MAX_RESPONSE_BYTES;
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
      
      let scoreText = switch (profile.overallScore) {
        case (?score) Float.toText(score);
        case null "null";
      };
      Debug.print("Legacy verification completed for " # companyName # " with score: " # scoreText);
      
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
        max_response_bytes = ?Constants.MAX_RESPONSE_BYTES;
        headers = headers;
        body = null;
        method = #get;
        transform = null;
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
    private func getVerificationProfile(companyId : Nat) : ?VerificationProfile {
      verificationProfiles.get(companyId);
    };

    // Check if company needs re-verification
    private func needsReverification(companyId : Nat) : Bool {
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
    private func getJobStatus(jobId : Nat) : ?VerificationJob {
      verificationJobs.get(jobId);
    };

    // List pending verification jobs
    private func listPendingJobs() : [VerificationJob] {
      let allJobs = Iter.toArray(verificationJobs.vals());
      Array.filter(allJobs, func(job : VerificationJob) : Bool {
        job.status == #queued or job.status == #processing;
      });
    };

    // Cancel a verification job
    private func cancelJob(jobId : Nat) : Bool {
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
    
    // NEW: Clean up expired verification cache entries for memory management
    private func cleanupVerificationCache() : Nat {
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
    private func getVerificationCacheStats() : { entries : Nat; expiredEntries : Nat; hitRate : ?Float } {
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
    private func refreshCompanyVerification(companyId : Nat, _companyName : Text) : async VerificationProfile {
      // Remove from cache to force refresh
      verificationCache.delete(companyId);
      
      // Perform fresh verification
      await performCompanyVerification(companyId, _companyName);
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
        
        let scoreText = switch (profile.overallScore) {
          case (?score) Float.toText(score);
          case null "null";
        };
        Debug.print("Scorer API verification completed with score: " # scoreText);
        profile;
        
      } catch (error) {
        Debug.print("Scorer API verification failed: " # Error.message(error));
        throw error;
      };
    };

    // Map risk engine VerificationProfile to core canister types
    private func _mapToCoreverificationProfile(riskProfile : VerificationProfile) : CoreVerificationProfile {
      let state = switch (riskProfile.verificationStatus) {
        case (#verified) #Verified;
        case (#suspicious) #NeedsUpdate; 
        case (#failed) #Rejected;
        case (#pending) #VerificationPending;
        case (#error) #Failed;
      };
      
      let risk_label = switch (riskProfile.overallScore) {
        case (?score) {
          if (score < 30.0) #Trusted
          else if (score < 70.0) #Caution
          else #HighRisk;
        };
        case null #Caution; // Default to caution when score is not available
      };
      
      {
        state = state;
        score = riskProfile.overallScore;
        risk_label = risk_label;
        last_scored_at = ?Nat64.fromIntWrap(riskProfile.lastVerified);
        next_due_at = switch (riskProfile.nextDueAt) {
          case (?due) ?Nat64.fromIntWrap(due);
          case null null;
        };
        explanation_hash = null; // Could map to analysis summary in future
        last_vc_registration = null;
        last_vc_valuation = null;
      }
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
        // Step 3: Call off-chain AI service directly (no API key needed in canister)
        let aiRequest: AIAnalysisRequest = {
          name = companyName;
          description = "Company verification request";
          industry = null;
          region = null;
          valuation = null;
          symbol = null;
        };
        
        // Step 4: Call your off-chain AI service at localhost:3001
        let aiResponse = await callAIService(aiRequest, ?"off-chain-service");
        
        // Step 5: Map AI response to VerificationProfile
        let profile = mapAIResponseToProfile(companyId, companyName, aiResponse);
        
        // Step 6: Cache result
        cacheVerificationResult(companyId, profile);
        
        let scoreText = switch (profile.overallScore) {
          case (?score) Float.toText(score);
          case null "null";
        };
        Debug.print("Off-chain AI verification completed for " # companyName # " with score: " # scoreText);
        return profile;
        
      } catch (error) {
        Debug.print("Off-chain AI verification failed for " # companyName # ": " # Error.message(error));
        // NO FALLBACK - Return error immediately
        throw Error.reject("AI verification service unavailable: " # Error.message(error));
      };
    };

    // NEW: Map AI response to VerificationProfile (Step 5 of off-chain verification)
    private func mapAIResponseToProfile(companyId : Nat, companyName : Text, aiResponse : AIAnalysisResponse) : VerificationProfile {
      // Get current timestamp
      let currentTime = Time.now();
      
      switch (aiResponse.success) {
        case (true) {
          // Extract scores and confidence from AI response (convert Nat to Float)
          let fraudScore : Float = switch (aiResponse.fraudScore) {
            case (?score) Float.fromInt(score) / 100.0; // Convert Nat to Float (0-1 scale)
            case (null) 0.5; // Default medium risk
          };
          
          let confidence : Float = switch (aiResponse.confidence) {
            case (?conf) Float.fromInt(conf) / 100.0; // Convert Nat to Float (0-1 scale)
            case (null) 0.7; // Default confidence
          };
          
          // Convert fraud score to overall score (invert since fraud = bad)
          let overallScore : Float = (1.0 - fraudScore) * 100.0; // Scale to 0-100
          
          // Determine verification status based on fraud score
          let verificationStatus = if (fraudScore >= 0.8) {
            #suspicious
          } else if (fraudScore >= 0.5) {
            #failed
          } else {
            #verified
          };
          
          // Create basic verification checks with proper type structure
          let checks = [
            {
              checkType = "ai_web_presence";
              status = #pass;
              score = overallScore;
              confidence = confidence;
              details = "AI-powered web presence analysis";
              timestamp = currentTime;
              weightUsed = 1.0;
              contextAdjustment = null;
              evidenceSources = ["AI Service Analysis"];
              processingTimeMs = null;
            },
            {
              checkType = "ai_fraud_analysis";
              status = if (fraudScore >= 0.7) #fail else if (fraudScore >= 0.4) #warning else #pass;
              score = overallScore;
              confidence = confidence;
              details = "AI-powered fraud risk assessment";
              timestamp = currentTime;
              weightUsed = 1.0;
              contextAdjustment = null;
              evidenceSources = ["AI Service Analysis"];
              processingTimeMs = null;
            }
          ];
          
          // Create risk factors based on fraud score
          let riskFactors = if (fraudScore >= 0.7) {
            ["High fraud risk detected by AI", "Requires manual review"]
          } else if (fraudScore >= 0.4) {
            ["Medium fraud risk detected"]
          } else {
            []
          };
          
          // Create verification profile with correct type structure
          {
            companyId = companyId;
            overallScore = ?overallScore;
            verificationStatus = verificationStatus;
            lastVerified = currentTime;
            nextDueAt = ?(currentTime + (24 * 60 * 60 * 1_000_000_000)); // 24 hours from now
            checks = checks;
            fraudKeywords = []; // Empty for AI-based verification
            newsArticles = 0; // Not applicable for AI verification
            riskFactors = riskFactors;
            verificationContext = null; // Could be enhanced later
            weightConfigUsed = ?"ai-verification-v2.0";
            confidenceLevel = confidence;
            industryBenchmark = null; // Not available yet
          }
        };
        case (false) {
          // AI service failed - create low-confidence profile
          let checks = [
            {
              checkType = "ai_service_error";
              status = #error;
              score = 30.0;
              confidence = 0.2;
              details = "AI verification service unavailable";
              timestamp = currentTime;
              weightUsed = 1.0;
              contextAdjustment = null;
              evidenceSources = ["AI Service Failure"];
              processingTimeMs = null;
            }
          ];
          
          {
            companyId = companyId;
            overallScore = null; // No score available due to failed verification
            verificationStatus = #failed;
            lastVerified = currentTime;
            nextDueAt = ?(currentTime + (60 * 60 * 1_000_000_000)); // Retry in 1 hour
            checks = checks;
            fraudKeywords = [];
            newsArticles = 0;
            riskFactors = ["AI verification service unavailable", "Manual review required"];
            verificationContext = null;
            weightConfigUsed = ?"ai-verification-v2.0";
            confidenceLevel = 0.2; // Very low confidence
            industryBenchmark = null;
          }
        };
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

            let url = AI_SERVICE_URL # "/analyze";
            
            let headers : [HttpHeader] = [
              { name = "Content-Type"; value = "application/json" },
              { name = "Authorization"; value = "Bearer " # authToken },
              { name = "User-Agent"; value = "ARKS-RWA-Canister/1.0" }
            ];

            let request : HttpRequest = {
              url = url;
              max_response_bytes = ?Constants.MAX_RESPONSE_BYTES;
              headers = headers;
              body = ?Blob.toArray(Text.encodeUtf8(requestBody));
              method = #post;
              transform = null;
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
                verification_score = profile.overallScore;
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
    public func testScorerApiVerification(companyId : Nat, _apiKey : Text, caller : Principal) : async ?VerificationProfile {
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
              _apiKey
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

    // ==========================================
    // COMPANY MONITORING AND AUTO-VERIFICATION
    // ==========================================
    
    // Monitor registered core canisters for new companies needing verification
    public func scanCoreCanistersForPendingVerification(caller : Principal) : async Nat {
      if (caller != admin) {
        throw Error.reject("Authorization failed: Only admin can scan for pending verification.");
      };
      
      var companiesProcessed = 0;
      
      for (coreCanisterId in registeredCoreCanisterIds.vals()) {
        let coreRef = getCoreCanisterActor(coreCanisterId);
        try {
          let companies = await coreRef.listCompanies();
          
          for (company in companies.vals()) {
            // Check if company needs verification (status is pending or registered)
            switch (company.verification.verificationStatus) {
              case (#pending or #registered) {
                // Check if we don't already have a verification job for this company
                var hasExistingJob = false;
                for ((jobId, job) in verificationJobs.entries()) {
                  if (job.companyId == company.id and (job.status == #processing or job.status == #queued)) {
                    hasExistingJob := true;
                  };
                };
                
                if (not hasExistingJob) {
                  // Start verification for this company
                  ignore await startVerificationWithApiKey(company.id, company.name, #normal, null);
                  companiesProcessed += 1;
                };
              };
              case (_) {}; // Company doesn't need verification
            };
          };
        } catch (error) {
          Debug.print("Failed to scan core canister " # Principal.toText(coreCanisterId) # ": " # Error.message(error));
        };
      };
      
      companiesProcessed;
    };
    
    // Automatic periodic scan function (can be called by a heartbeat or external scheduler)
    public func periodicVerificationScan() : async Nat {
      // This function doesn't require admin access as it's meant to be called automatically
      // by the system or scheduled jobs
      await scanCoreCanistersForPendingVerification(admin);
    };
    
    // Get summary of companies across all registered core canisters
    public query func getMultiCoreCompanySummary(caller : Principal) : async ?{
      totalCompanies : Nat;
      pendingVerification : Nat;
      verified : Nat;
      failed : Nat;
      registeredCoreCanisterIds : [Principal];
    } {
      if (caller != admin) {
        return null;
      };
      
      // Note: This is a query function, so we can't make async calls to core canisters
      // This provides a summary of the monitoring setup only
      ?{
        totalCompanies = 0; // Would need to be populated from cached data
        pendingVerification = 0; // Would need to be populated from job queue
        verified = verificationProfiles.size();
        failed = 0; // Count from jobs with failed status
        registeredCoreCanisterIds = registeredCoreCanisterIds;
      };
    };

};

// module {
//   public func createVerificationEngine(admin : ?Principal, ai_service_url: ?Text, ai_auth_token: ?Text) : async VerificationEngine {
//     await VerificationEngine(admin, ai_service_url, ai_auth_token);
//   };
// }