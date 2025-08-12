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

    // Cache for recent search results (to avoid repeated API calls)
    private var searchCache : HashMap.HashMap<Text, (Int, Text)> = HashMap.HashMap(0, Text.equal, Text.hash);
    private let CACHE_TTL_NS : Int = 24 * 60 * 60 * 1000_000_000; // 24 hours in nanoseconds

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

    // Main verification logic
    private func performCompanyVerification(companyId : Nat, companyName : Text) : async VerificationProfile {
      Debug.print("Starting verification for company: " # companyName);

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
      
      Debug.print("Verification completed for " # companyName # " with score: " # Float.toText(profile.overallScore));
      
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

      // Add cycles for the HTTP request
      Cycles.add(config.maxCycles);

      try {
        let response : HttpResponse = await ic.http_request(request);
        
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
    private func transformResponse(args : TransformArgs) : TransformResult {
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

    // Clear old cache entries
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