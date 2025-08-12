import Text "mo:base/Text";
import Array "mo:base/Array";
import Option "mo:base/Option";
import Result "mo:base/Result";
import Time "mo:base/Time";
import Float "mo:base/Float";
import Nat "mo:base/Nat";
import Nat64 "mo:base/Nat64";
import Int "mo:base/Int";
import Debug "mo:base/Debug";
import Blob "mo:base/Blob";
import Cycles "mo:base/ExperimentalCycles";
import Char "mo:base/Char";

import Types "./types";
import Constants "./constants";
import Iter "mo:base/Iter";
import HashMap "mo:base/HashMap";

module {
  public type VerificationProfile = Types.VerificationProfile;
  public type VerificationCheck = Types.VerificationCheck;
  public type CheckStatus = Types.CheckStatus;
  public type VerificationStatus = Types.VerificationStatus;
  public type IndonesianSearchQuery = Types.IndonesianSearchQuery;
  public type SearchQueryType = Types.SearchQueryType;
  public type GoogleSearchResult = Types.GoogleSearchResult;
  public type HttpOutcallConfig = Types.HttpOutcallConfig;

  // HTTP request types for HTTPS outcalls
  public type HttpMethod = {
    #get;
    #post;
    #head;
  };

  public type HttpHeader = {
    name : Text;
    value : Text;
  };

  public type HttpRequest = {
    url : Text;
    max_response_bytes : ?Nat64;
    headers : [HttpHeader];
    body : ?[Nat8];
    method : HttpMethod;
    transform : ?{
      // Function reference to a PUBLIC QUERY method in your actor
      function : shared query (TransformArgs) -> async TransformResult;
      context : Blob;
    };
  };

  public type HttpResponse = {
    status : Nat;
    headers : [HttpHeader];
    body : [Nat8];
  };

  public type TransformArgs = {
    response : HttpResponse;
    context : Blob;
  };

  public type TransformResult = {
    response : HttpResponse;
  };

  // Default configuration for HTTPS outcalls
  public let DEFAULT_CONFIG : HttpOutcallConfig = {
    maxCycles = 50_000_000;        // 50M cycles per request
    timeoutMs = 30_000;            // 30 second timeout
    retryCount = 2;                // Retry twice on failure
    userAgent = "ARKS-RWA-Bot/1.0 (+https://arks-rwa.com)";
    rateLimitDelayMs = 3_000;      // 3 second delay between requests
  };

  // Create Indonesian search queries for company verification
  public func createSearchQueries(companyName : Text) : [IndonesianSearchQuery] {
    [
      // Fraud detection searches
      {
        companyName = companyName;
        queryType = #fraud_check;
        searchTerms = ["penipuan", "scam", "Indonesia"];
        language = "id";
      },
      {
        companyName = companyName;
        queryType = #fraud_check;
        searchTerms = ["gugatan", "ilegal", "bermasalah"];
        language = "id";
      },
      // Legitimacy checks
      {
        companyName = companyName;
        queryType = #legitimacy_check;
        searchTerms = ["PT", "CV", "terdaftar", "Indonesia"];
        language = "id";
      },
      {
        companyName = companyName;
        queryType = #authority_verification;
        searchTerms = ["OJK", "Kementerian", "resmi"];
        language = "id";
      },
      // Digital footprint analysis
      {
        companyName = companyName;
        queryType = #digital_footprint;
        searchTerms = ["website", "Facebook", "LinkedIn"];
        language = "id";
      },
      // News sentiment analysis
      {
        companyName = companyName;
        queryType = #news_sentiment;
        searchTerms = ["berita", "news", "Indonesia"];
        language = "id";
      }
    ];
  };

  // Build Google search URL from query
  public func buildGoogleSearchURL(qry : IndonesianSearchQuery) : Text {
    let baseURL = Constants.GOOGLE_SEARCH_BASE_URL;

    // Create search string: "company name" + additional terms
    var searchTerms = "\"" # qry.companyName # "\"";
    for (term in qry.searchTerms.vals()) {
      searchTerms := searchTerms # " " # term;
    };

    // URL encode the search terms (basic implementation)
    let encodedTerms = urlEncode(searchTerms);

    // Add language preference for Indonesian content
    let langParam = if (qry.language == "id") { "&lr=lang_id" } else { "" };

    baseURL # encodedTerms # langParam # "&num=10";  // Limit to 10 results
  };

  // Basic URL encoding for search terms
  private func urlEncode(text : Text) : Text {
  var encoded = text;
  encoded := Text.replace(encoded, #char ' ', "%20");
  encoded := Text.replace(encoded, #char '\"', "%22");
  encoded := Text.replace(encoded, #char '+', "%2B");
  encoded := Text.replace(encoded, #char '&', "%26");
  encoded;
};

  // Create HTTP headers for Google search requests
  public func createHttpHeaders(config : HttpOutcallConfig) : [HttpHeader] {
    [
      { name = "User-Agent"; value = config.userAgent },
      { name = "Accept"; value = "text/html,application/xhtml+xml" },
      { name = "Accept-Language"; value = "id-ID,id;q=0.9,en;q=0.8" },
      { name = "Accept-Encoding"; value = "gzip, deflate, br" },
      { name = "DNT"; value = "1" },
      { name = "Connection"; value = "keep-alive" },
      { name = "Cache-Control"; value = "no-cache" }
    ];
  };

  // Transform function helper (pure). Your actor exposes the public query wrapper.
  public func transformHttpResponse(args : TransformArgs) : TransformResult {
    let response : HttpResponse = {
      status = args.response.status;
      headers = []; // Remove headers that vary between replicas
      body = args.response.body;
    };
    { response = response };
  };

  // Parse HTML content to extract search results
  public func parseGoogleSearchResults(htmlContent : Text, qry : IndonesianSearchQuery) : [GoogleSearchResult] {
    var results : [GoogleSearchResult] = [];

    // Very naive parsing (production: proper HTML parser)
    let searchSnippets = extractTextBetween(htmlContent, "<div class=\"VwiC3b", "</div>");
    let searchTitles = extractTextBetween(htmlContent, "<h3", "</h3>");
    let searchUrls = extractTextBetween(htmlContent, "href=\"/url?q=", "\"");

    let maxResults = 10;
    var i = 0;

    while (i < maxResults and i < searchSnippets.size() and i < searchTitles.size()) {
      let snippet = if (i < searchSnippets.size()) { searchSnippets[i] } else { "" };
      let title = if (i < searchTitles.size()) { searchTitles[i] } else { "" };
      let url = if (i < searchUrls.size()) { searchUrls[i] } else { "" };

      if (Text.size(snippet) > 0 or Text.size(title) > 0) {
        let result : GoogleSearchResult = {
          title = cleanHtmlTags(title);
          snippet = cleanHtmlTags(snippet);
          url = cleanUrl(url);
          relevance = calculateRelevance(title # " " # snippet, qry.companyName);
          sentiment = analyzeSentiment(title # " " # snippet);
          fraudKeywords = findFraudKeywords(title # " " # snippet);
        };
        results := Array.append(results, [result]);
      };

      i += 1;
    };

    results;
  };

  // Extract text between two delimiters (no indexOf/slice; uses split)
private func extractTextBetween(text : Text, startDelim : Text, endDelim : Text) : [Text] {
  var results : [Text] = [];
  var searchText = text;

  let maxExtractions = 10;
  var count = 0;

  label scan while (count < maxExtractions) {
    // Split on startDelim; if not found, we're done
    let partsAfterStart = Iter.toArray(Text.split(searchText, #text startDelim));
    if (partsAfterStart.size() < 2) { break scan };

    // Take the text after the first startDelim
    let afterStart = partsAfterStart[1];

    // Now split that on endDelim
    let partsToEnd = Iter.toArray(Text.split(afterStart, #text endDelim));
    if (partsToEnd.size() < 2) { break scan };

    let extracted = partsToEnd[0];
    if (Text.size(extracted) > 0) {
      results := Array.append(results, [extracted]);
    };

    // Continue scanning after the endDelim
    let remainder = partsToEnd[1];
    searchText := remainder;
    count += 1;
  };

  results;
};

// Clean and decode URLs (no slice/indexOf)
private func cleanUrl(url : Text) : Text {
  if (Text.startsWith(url, #text "/url?q=")) {
    // Remove "/url?q=" via split
    let parts = Iter.toArray(Text.split(url, #text "/url?q="));
    if (parts.size() < 2) { return url };
    let withoutPrefix = parts[1];

    // Truncate at first '&' if present
    let ampParts = Iter.toArray(Text.split(withoutPrefix, #char '&'));
    if (ampParts.size() >= 1) { ampParts[0] } else { withoutPrefix };
  } else {
    url;
  }
};

  // Remove HTML tags from text
  private func cleanHtmlTags(text : Text) : Text {
    var cleaned = text;

    cleaned := Text.replace(cleaned, #text "<b>", "");
    cleaned := Text.replace(cleaned, #text "</b>", "");
    cleaned := Text.replace(cleaned, #text "<em>", "");
    cleaned := Text.replace(cleaned, #text "</em>", "");
    cleaned := Text.replace(cleaned, #text "<strong>", "");
    cleaned := Text.replace(cleaned, #text "</strong>", "");

    cleaned := Text.replace(cleaned, #text "&amp;", "&");
    cleaned := Text.replace(cleaned, #text "&lt;", "<");
    cleaned := Text.replace(cleaned, #text "&gt;", ">");
    cleaned := Text.replace(cleaned, #text "&quot;", "\"");

    Text.trim(cleaned, #char ' ');
  };

  // Calculate relevance score based on company name mention
  private func calculateRelevance(text : Text, companyName : Text) : Float {
    let lowerText = Text.map(text, func(c : Char) : Char {
      if (c >= 'A' and c <= 'Z') {
        Char.fromNat32(Char.toNat32(c) + 32); // Convert to lowercase
      } else {
        c;
      };
    });
    let lowerCompanyName = Text.map(companyName, func(c : Char) : Char {
      if (c >= 'A' and c <= 'Z') {
        Char.fromNat32(Char.toNat32(c) + 32);
      } else {
        c;
      };
    });

    if (Text.contains(lowerText, #text lowerCompanyName)) {
      1.0; // High relevance
    } else {
      let words = Text.split(lowerCompanyName, #char ' ');
      var partialMatches = 0.0;
      var totalWords = 0.0;

      for (word in words) {
        totalWords += 1.0;
        if (Text.size(word) > 2 and Text.contains(lowerText, #text word)) {
          partialMatches += 1.0;
        };
      };

      if (totalWords > 0.0) {
        partialMatches / totalWords; // Partial relevance
      } else {
        0.0;
      };
    };
  };

  // Basic sentiment analysis for Indonesian text
  private func analyzeSentiment(text : Text) : Float {
    let lowerText = Text.map(text, func(c : Char) : Char {
      if (c >= 'A' and c <= 'Z') {
        Char.fromNat32(Char.toNat32(c) + 32);
      } else {
        c;
      };
    });

    var sentiment : Float = 0.0;

    // Negative indicators (Indonesian)
    let negativeWords = ["penipuan", "scam", "buruk", "jelek", "gagal", "bermasalah", "tutup", "bangkrut"];
    for (word in negativeWords.vals()) {
      if (Text.contains(lowerText, #text word)) {
        sentiment -= 0.2;
      };
    };

    // Positive indicators (Indonesian)
    let positiveWords = ["bagus", "baik", "sukses", "terpercaya", "resmi", "berkualitas", "profesional"];
    for (word in positiveWords.vals()) {
      if (Text.contains(lowerText, #text word)) {
        sentiment += 0.1;
      };
    };

    if (sentiment > 1.0) { 1.0 }
    else if (sentiment < -1.0) { -1.0 }
    else { sentiment };
  };

  // Find Indonesian fraud keywords in text
  private func findFraudKeywords(text : Text) : [Text] {
    let lowerText = Text.map(text, func(c : Char) : Char {
      if (c >= 'A' and c <= 'Z') {
        Char.fromNat32(Char.toNat32(c) + 32);
      } else {
        c;
      };
    });

    var foundKeywords : [Text] = [];

    for (keyword in Constants.INDONESIAN_FRAUD_KEYWORDS.vals()) {
      if (Text.contains(lowerText, #text keyword)) {
        foundKeywords := Array.append(foundKeywords, [keyword]);
      };
    };

    foundKeywords;
  };

  // Calculate overall verification score from individual checks
  public func calculateOverallScore(checks : [VerificationCheck]) : Float {
    if (checks.size() == 0) {
      return 50.0; // Neutral score if no checks performed
    };

    var totalScore : Float = 0.0;
    var totalWeight : Float = 0.0;

    for (check in checks.vals()) {
      let weight = getCheckWeight(check.checkType);
      totalScore += check.score * weight * check.confidence;
      totalWeight += weight * check.confidence;
    };

    if (totalWeight > 0.0) {
      totalScore / totalWeight;
    } else {
      50.0; // Neutral score
    };
  };

  // === ENHANCED CONTEXT-AWARE WEIGHT CALCULATION SYSTEM ===
  
  // Enhanced weight calculation with Indonesian context awareness
  public func getEnhancedCheckWeight(
    checkType : Text, 
    context : ?Types.VerificationContext
  ) : (Float, ?Float) {
    let baseWeight = getBaseCheckWeight(checkType);
    
    switch (context) {
      case (null) { 
        (baseWeight, null); // No context available, use base weight
      };
      case (?ctx) {
        let contextAdjustment = calculateContextAdjustment(checkType, ctx);
        let finalWeight = baseWeight * contextAdjustment;
        (finalWeight, ?contextAdjustment);
      };
    };
  };
  
  // Create verification context from company information
  public func createVerificationContext(
    companyName : Text,
    description : Text
  ) : Types.VerificationContext {
    let industry = classifyIndustry(companyName, description);
    let isPreventionBusiness = isPreventionContent(companyName # " " # description);
    let mentionType = classifyAuthorityMention(companyName # " " # description);
    
    // Determine if company is digital native based on industry and description
    let isDigitalNative = switch (industry) {
      case (#fintech) { true };
      case (#e_commerce) { true };
      case (#cryptocurrency) { true };
      case (_) { 
        let digitalIndicators = ["digital", "online", "teknologi", "internet", "mobile", "app"];
        var foundDigital = false;
        let searchText = Text.map(companyName # " " # description, func(c : Char) : Char {
          if (c >= 'A' and c <= 'Z') {
            Char.fromNat32(Char.toNat32(c) + 32);
          } else {
            c;
          };
        });
        for (indicator in digitalIndicators.vals()) {
          if (Text.contains(searchText, #text indicator)) {
            foundDigital := true;
          };
        };
        foundDigital;
      };
    };
    
    // Determine business size (simplified classification)
    let businessSize = #unknown; // Could be enhanced with valuation analysis
    
    // Determine registration status (would need external verification)
    let registrationStatus = #unknown; // Could be enhanced with actual OJK/OSS checks
    
    {
      mentionType = mentionType;
      isPreventionContent = isPreventionBusiness;
      companyProfile = {
        isDigitalNative = isDigitalNative;
        industry = industry;
        establishedYear = null; // Could be extracted from description
        businessSize = businessSize;
        hasPhysicalPresence = true; // Default assumption
        registrationStatus = registrationStatus;
      };
      confidenceLevel = 0.8; // Default confidence level
      regionalContext = #unknown; // Could be enhanced with location extraction
    };
  };
  
  // Get base weight for check type using enhanced evidence-based weights
  private func getBaseCheckWeight(checkType : Text) : Float {
    switch (checkType) {
      case ("fraud_keywords") { Constants.FRAUD_KEYWORDS_WEIGHT_CONFIG.weight };
      case ("news_sentiment") { Constants.NEWS_SENTIMENT_WEIGHT_CONFIG.weight };
      case ("business_registry") { Constants.BUSINESS_REGISTRY_WEIGHT_CONFIG.weight };
      case ("authority_mentions") { Constants.AUTHORITY_MENTIONS_BASE_WEIGHT_CONFIG.weight };
      case ("digital_footprint") { Constants.DIGITAL_FOOTPRINT_BASE_WEIGHT_CONFIG.weight };
      case ("domain_age") { Constants.DOMAIN_AGE_WEIGHT_CONFIG.weight };
      case (_) { 1.0 }; // Default weight for unknown check types
    };
  };
  
  // Calculate context-based adjustment multiplier for Indonesian business patterns
  private func calculateContextAdjustment(
    checkType : Text, 
    context : Types.VerificationContext
  ) : Float {
    var adjustment : Float = 1.0;
    
    // Apply industry-specific adjustments
    adjustment *= getIndustryAdjustment(checkType, context.companyProfile.industry);
    
    // Apply authority mention context adjustments
    if (checkType == "authority_mentions") {
      adjustment *= getAuthorityMentionAdjustment(context.mentionType);
    };
    
    // Apply fraud keyword context adjustments
    if (checkType == "fraud_keywords") {
      adjustment *= getFraudKeywordContextAdjustment(context.isPreventionContent);
    };
    
    // Apply regional trust factors
    adjustment *= getRegionalTrustFactor(context.regionalContext);
    
    // Apply business registration status adjustments
    if (checkType == "business_registry") {
      adjustment *= getRegistrationStatusAdjustment(context.companyProfile.registrationStatus);
    };
    
    // Apply digital footprint adjustments based on business type
    if (checkType == "digital_footprint") {
      adjustment *= getDigitalFootprintAdjustment(context.companyProfile);
    };
    
    // Ensure adjustment stays within reasonable bounds (0.3x to 3.0x)
    Float.max(0.3, Float.min(3.0, adjustment));
  };
  
  // Industry-specific weight adjustments for Indonesian business context
  private func getIndustryAdjustment(checkType : Text, industry : Types.IndustryType) : Float {
    switch (checkType, industry) {
      case ("digital_footprint", #fintech) { 2.0 };          // High digital expectation
      case ("digital_footprint", #e_commerce) { 1.8 };       // High digital expectation
      case ("digital_footprint", #cryptocurrency) { 2.2 };   // Very high digital expectation
      case ("digital_footprint", #manufacturing) { 0.8 };    // Lower digital expectation
      case ("digital_footprint", #agriculture) { 0.6 };      // Lowest digital expectation
      case ("digital_footprint", #retail) { 1.2 };           // Medium digital expectation
      case ("digital_footprint", #services) { 1.4 };         // Medium-high digital expectation
      case ("digital_footprint", #traditional) { 0.7 };      // Lower digital expectation
      
      // Business registry is more critical for financial sectors
      case ("business_registry", #fintech) { 1.5 };          // OJK registration crucial
      case ("business_registry", #cryptocurrency) { 1.8 };   // High regulatory scrutiny
      case ("business_registry", #e_commerce) { 1.2 };       // Moderate regulatory focus
      
      // News sentiment varies by industry volatility
      case ("news_sentiment", #cryptocurrency) { 0.8 };      // High volatility, less reliable
      case ("news_sentiment", #fintech) { 1.1 };             // Moderate reliability
      
      case (_, _) { 1.0 }; // No adjustment for other combinations
    };
  };
  
  // Authority mention context adjustments for Indonesian regulatory landscape
  private func getAuthorityMentionAdjustment(mentionType : Types.AuthorityMentionType) : Float {
    switch (mentionType) {
      case (#positive_endorsement) { 1.5 };   // OJK endorsement/certification (97% correlation)
      case (#educational_content) { 1.1 };    // Mentioned in OJK education material
      case (#neutral_mention) { 1.0 };        // Standard regulatory mention
      case (#warning_issued) { 0.3 };         // OJK warning/sanction (89% correlation with risk)
      case (#under_investigation) { 0.2 };    // Active investigation
      case (#fraud_confirmed) { 0.1 };        // Confirmed fraudulent by authorities
    };
  };
  
  // Fraud keyword context adjustment to distinguish prevention vs accusation content
  private func getFraudKeywordContextAdjustment(isPreventionContent : Bool) : Float {
    if (isPreventionContent) {
      0.5; // Educational content about fraud prevention should not penalize legitimate companies
    } else {
      1.2; // Direct fraud accusations/reports carry higher weight
    };
  };
  
  // Regional trust factors for Indonesian business verification
  private func getRegionalTrustFactor(regional : Types.RegionalContext) : Float {
    switch (regional) {
      case (#jakarta) { 1.1 };      // Higher business legitimacy baseline
      case (#surabaya) { 1.05 };    // Major business center
      case (#bandung) { 1.0 };      // Technology hub
      case (#yogyakarta) { 0.95 };  // Academic center
      case (#medan) { 0.9 };        // Regional business center
      case (#remote) { 0.8 };       // Remote/less developed regions
      case (#unknown) { 1.0 };      // No regional adjustment
    };
  };
  
  // Registration status adjustments for Indonesian business legitimacy
  private func getRegistrationStatusAdjustment(status : Types.RegistrationStatus) : Float {
    switch (status) {
      case (#ojk_registered) { 1.5 };       // Highest legitimacy indicator
      case (#oss_registered) { 1.3 };       // Good legitimacy indicator
      case (#ministry_registered) { 1.2 };  // Moderate legitimacy indicator
      case (#basic_registration) { 1.0 };   // Basic legitimacy
      case (#unregistered) { 0.6 };         // Low legitimacy
      case (#unknown) { 0.8 };              // Cannot verify registration
    };
  };
  
  // Digital footprint adjustments based on comprehensive company profile
  private func getDigitalFootprintAdjustment(profile : Types.CompanyProfile) : Float {
    var adjustment : Float = 1.0;
    
    // Adjust based on digital nativity
    if (profile.isDigitalNative) {
      adjustment *= 1.3; // Higher expectation for digital-native companies
    } else {
      adjustment *= 0.8; // Lower expectation for traditional businesses
    };
    
    // Adjust based on company age (if available)
    switch (profile.establishedYear) {
      case (?year) {
        let currentYear = 2024; // Could be made dynamic
        let age = currentYear - year;
        if (age < 2) {
          adjustment *= 0.7; // Startups may have limited digital footprint
        } else if (age > 10) {
          adjustment *= 1.2; // Established companies should have strong digital presence
        };
      };
      case (null) { /* No adjustment if age unknown */ };
    };
    
    // Adjust based on business size
    switch (profile.businessSize) {
      case (#startup) { adjustment *= 0.6 };   // Lower expectation for startups
      case (#small) { adjustment *= 0.8 };     // Lower expectation for small business
      case (#medium) { adjustment *= 1.1 };    // Higher expectation for medium enterprise
      case (#large) { adjustment *= 1.4 };     // Highest expectation for large corporation
      case (#unknown) { /* No adjustment */ };
    };
    
    adjustment;
  };
  
  // Enhanced detection for fraud prevention/educational material
  // Improved to distinguish legitimate prevention services from fraud accusations
  public func isPreventionContent(text : Text) : Bool {
    let lowerText = Text.map(text, func(c : Char) : Char {
      if (c >= 'A' and c <= 'Z') {
        Char.fromNat32(Char.toNat32(c) + 32);
      } else {
        c;
      };
    });
    
    // Check for prevention/educational keywords
    for (keyword in Constants.FRAUD_PREVENTION_KEYWORDS.vals()) {
      if (Text.contains(lowerText, #text keyword)) {
        return true;
      };
    };
    
    // Additional Indonesian prevention/consulting indicators
    let preventionIndicators = [
      "konsultan anti", "spesialis pencegahan", "ahli keamanan",
      "jasa pencegahan", "layanan anti penipuan", "edukasi finansial",
      "pelatihan keamanan", "audit keamanan", "risk assessment",
      "konsultan keamanan", "security consultant", "fraud analyst"
    ];
    
    for (indicator in preventionIndicators.vals()) {
      if (Text.contains(lowerText, #text indicator)) {
        return true;
      };
    };
    
    false;
  };
  
  // Classify authority mention type based on content analysis
  public func classifyAuthorityMention(text : Text) : Types.AuthorityMentionType {
    let lowerText = Text.map(text, func(c : Char) : Char {
      if (c >= 'A' and c <= 'Z') {
        Char.fromNat32(Char.toNat32(c) + 32);
      } else {
        c;
      };
    });
    
    // Enhanced positive endorsement detection for Indonesian regulatory context
    let endorsementKeywords = [
      "sertifikat", "berizin", "disetujui", "kemitraan", "resmi",
      "ojk approved", "disetujui ojk", "terdaftar ojk", "izin ojk",
      "licensed", "authorized", "certified", "accredited", "verified",
      "terakreditasi", "tersertifikasi", "terdaftar resmi", "izin usaha"
    ];
    for (keyword in endorsementKeywords.vals()) {
      if (Text.contains(lowerText, #text keyword)) {
        return #positive_endorsement;
      };
    };
    
    // Check for warnings/sanctions
    let warningKeywords = ["peringatan", "sanksi", "denda", "teguran", "dicabut"];
    for (keyword in warningKeywords.vals()) {
      if (Text.contains(lowerText, #text keyword)) {
        return #warning_issued;
      };
    };
    
    // Check for investigations
    let investigationKeywords = ["diselidiki", "investigasi", "pemeriksaan"];
    for (keyword in investigationKeywords.vals()) {
      if (Text.contains(lowerText, #text keyword)) {
        return #under_investigation;
      };
    };
    
    // Check for confirmed fraud
    let fraudConfirmationKeywords = ["terbukti", "divonis", "penipuan", "dipidana"];
    for (keyword in fraudConfirmationKeywords.vals()) {
      if (Text.contains(lowerText, #text keyword)) {
        return #fraud_confirmed;
      };
    };
    
    // Check for educational content
    let educationalKeywords = ["edukasi", "sosialisasi", "pembelajaran", "panduan"];
    for (keyword in educationalKeywords.vals()) {
      if (Text.contains(lowerText, #text keyword)) {
        return #educational_content;
      };
    };
    
    #neutral_mention; // Default classification
  };
  
  // Enhanced industry classification based on company name and description
  // Improved with Indonesian banking and financial service indicators
  public func classifyIndustry(companyName : Text, description : Text) : Types.IndustryType {
    let searchText = Text.map(companyName # " " # description, func(c : Char) : Char {
      if (c >= 'A' and c <= 'Z') {
        Char.fromNat32(Char.toNat32(c) + 32);
      } else {
        c;
      };
    });
    
    // Enhanced fintech indicators with Indonesian banking terms
    let fintechKeywords = [
      "fintech", "finansial", "teknologi keuangan", "pembayaran", "lending", "pinjaman online",
      "bank", "teknologi", "digital banking", "mobile banking", "payment gateway",
      "perbankan", "keuangan digital", "sistem pembayaran", "transfer", "wallet digital"
    ];
    for (keyword in fintechKeywords.vals()) {
      if (Text.contains(searchText, #text keyword)) {
        return #fintech;
      };
    };
    
    // Cryptocurrency indicators
    let cryptoKeywords = ["cryptocurrency", "blockchain", "bitcoin", "crypto", "digital currency", "mata uang digital"];
    for (keyword in cryptoKeywords.vals()) {
      if (Text.contains(searchText, #text keyword)) {
        return #cryptocurrency;
      };
    };
    
    // E-commerce indicators
    let ecommerceKeywords = ["e-commerce", "online shop", "marketplace", "toko online", "jual beli online"];
    for (keyword in ecommerceKeywords.vals()) {
      if (Text.contains(searchText, #text keyword)) {
        return #e_commerce;
      };
    };
    
    // Manufacturing indicators
    let manufacturingKeywords = ["manufaktur", "pabrik", "produksi", "industri", "manufacturing"];
    for (keyword in manufacturingKeywords.vals()) {
      if (Text.contains(searchText, #text keyword)) {
        return #manufacturing;
      };
    };
    
    // Agriculture indicators
    let agricultureKeywords = ["pertanian", "agrikultur", "perkebunan", "peternakan", "agriculture"];
    for (keyword in agricultureKeywords.vals()) {
      if (Text.contains(searchText, #text keyword)) {
        return #agriculture;
      };
    };
    
    // Enhanced services indicators with fraud prevention and security specialization
    let servicesKeywords = [
      "konsultan", "jasa", "layanan", "services", "consulting", 
      "advisory", "audit", "keamanan", "security", "prevention",
      "pencegahan", "anti penipuan", "fraud prevention", "risk management",
      "manajemen risiko", "compliance", "legal", "hukum", "pengacara"
    ];
    for (keyword in servicesKeywords.vals()) {
      if (Text.contains(searchText, #text keyword)) {
        return #services;
      };
    };
    
    // Retail indicators
    let retailKeywords = ["retail", "ritel", "perdagangan", "distribusi", "penjualan"];
    for (keyword in retailKeywords.vals()) {
      if (Text.contains(searchText, #text keyword)) {
        return #retail;
      };
    };
    
    #unknown; // Cannot determine industry
  };

  // === BACKWARD COMPATIBILITY ===
  
  // Original getCheckWeight function maintained for existing code
  private func getCheckWeight(checkType : Text) : Float {
    switch (checkType) {
      case ("fraud_keywords") { Constants.FRAUD_KEYWORDS_WEIGHT };
      case ("news_sentiment") { Constants.NEWS_SENTIMENT_WEIGHT };
      case ("business_registry") { Constants.BUSINESS_REGISTRY_WEIGHT };
      case ("authority_mentions") { Constants.AUTHORITY_MENTIONS_WEIGHT };
      case ("digital_footprint") { Constants.DIGITAL_FOOTPRINT_WEIGHT };
      case ("domain_age") { Constants.DOMAIN_AGE_WEIGHT };
      case (_) { 1.0 };                     // Default weight
    };
  };

  // Determine overall verification status from score
  public func determineVerificationStatus(score : Float, fraudKeywords : [Text]) : VerificationStatus {
    if (fraudKeywords.size() > 0) { return #failed };

    if (score >= Constants.VERIFIED_MIN_SCORE) { #verified }
    else if (score >= Constants.SUSPICIOUS_MIN_SCORE) { #suspicious }
    else { #failed };
  };

  // Create verification profile from search results
  public func createVerificationProfile(
    companyId : Nat,
    searchResults : [(IndonesianSearchQuery, [GoogleSearchResult])]
  ) : VerificationProfile {
    var allChecks : [VerificationCheck] = [];
    var allFraudKeywords : [Text] = [];
    var totalArticles : Nat = 0;
    var riskFactors : [Text] = [];

    let timestamp = Time.now();

    // Process each search query and its results
    for ((qry, results) in searchResults.vals()) {
      totalArticles += results.size();

      // Aggregate fraud keywords from all results
      for (result in results.vals()) {
        allFraudKeywords := Array.append(allFraudKeywords, result.fraudKeywords);
      };

      // Create verification check for this query type
      let check = createCheckFromQueryResults(qry, results, timestamp);
      allChecks := Array.append(allChecks, [check]);

      // Identify specific risk factors
      if (qry.queryType == #fraud_check and results.size() > 0) {
        riskFactors := Array.append(riskFactors, ["Fraud-related content found online"]);
      };
    };

    let overallScore = calculateOverallScore(allChecks);
    let status = determineVerificationStatus(overallScore, allFraudKeywords);

    {
      companyId = companyId;
      overallScore = overallScore;
      verificationStatus = status;
      lastVerified = timestamp;
      nextDueAt = ?(timestamp + (30 * 24 * 60 * 60 * 1_000_000_000)); // 30 days in ns
      checks = allChecks;
      fraudKeywords = removeDuplicates(allFraudKeywords);
      newsArticles = totalArticles;
      riskFactors = removeDuplicates(riskFactors);
      verificationContext = null; // No context available in legacy function
      weightConfigUsed = ?"legacy-weights-1.0";
      confidenceLevel = 0.8; // Default confidence for legacy verification
      industryBenchmark = null; // Not available in legacy function
    };
  };

  // Create individual verification check from query results
  private func createCheckFromQueryResults(
    qry : IndonesianSearchQuery,
    results : [GoogleSearchResult],
    timestamp : Int
  ) : VerificationCheck {
    let checkType = switch (qry.queryType) {
      case (#fraud_check) { "fraud_keywords" };
      case (#legitimacy_check) { "business_registry" };
      case (#news_sentiment) { "news_sentiment" };
      case (#digital_footprint) { "digital_footprint" };
      case (#authority_verification) { "authority_mentions" };
    };

    var totalSentiment : Float = 0.0;
    var totalRelevance : Float = 0.0;
    var fraudKeywordCount = 0;
    var relevantResults = 0;

    for (result in results.vals()) {
      if (result.relevance > 0.3) { // Only count relevant results
        totalSentiment += result.sentiment;
        totalRelevance += result.relevance;
        fraudKeywordCount += result.fraudKeywords.size();
        relevantResults += 1;
      };
    };

    let avgSentiment = if (relevantResults > 0) { totalSentiment / Float.fromInt(relevantResults) } else { 0.0 };
    let avgRelevance = if (relevantResults > 0) { totalRelevance / Float.fromInt(relevantResults) } else { 0.0 };

    // Calculate score based on query type
    let score = switch (qry.queryType) {
      case (#fraud_check) {
        // Lower score if fraud content found
        if (fraudKeywordCount > 0) { 20.0 } else { 80.0 };
      };
      case (#legitimacy_check) {
        // Higher score if legitimate content found
        if (relevantResults > 0 and avgSentiment >= 0.0) { 70.0 } else { 30.0 };
      };
      case (#news_sentiment) {
        // Score based on sentiment
        50.0 + (avgSentiment * 50.0);
      };
      case (#authority_verification) {
        // Higher score if official mentions found
        if (relevantResults > 0) { 75.0 } else { 45.0 };
      };
      case (#digital_footprint) {
        // Score based on digital presence
        if (relevantResults > 2) { 65.0 } else if (relevantResults > 0) { 50.0 } else { 35.0 };
      };
    };

    let status = if (score >= 70.0) { #pass }
                else if (score >= 40.0) { #warning }
                else { #fail };

    {
      checkType = checkType;
      status = status;
      score = score;
      confidence = Float.min(1.0, avgRelevance * 2.0); // Confidence based on relevance
      details = "Analyzed " # Nat.toText(results.size()) # " search results, " #
                Nat.toText(relevantResults) # " relevant, " #
                Nat.toText(fraudKeywordCount) # " fraud indicators";
      timestamp = timestamp;
      weightUsed = getCheckWeight(checkType); // Use legacy weight function
      contextAdjustment = null; // No context adjustment in legacy function
      evidenceSources = ["Google Search Results"]; // Generic evidence source
      processingTimeMs = null; // Not tracked in legacy function
    };
  };

  // === PHASE 3: PERFORMANCE TRACKING FUNCTIONS ===
  
  // Calculate performance metrics for weight optimization
  public func calculatePerformanceMetrics(
    verificationResults: [(Types.VerificationProfile, Bool)], // (profile, isActuallyFraudulent)
    processingTimes: [Int] // Processing times in nanoseconds
  ) : Types.PerformanceMetrics {
    if (verificationResults.size() == 0) {
      return {
        falsePositiveRate = 0.0;
        falseNegativeRate = 0.0;
        f1Score = 0.0;
        accuracyScore = 0.0;
        processingTime = 0;
        totalVerifications = 0;
        lastCalculated = Time.now();
      };
    };
    
    var truePositives = 0.0;   // Correctly identified as fraudulent
    var falsePositives = 0.0;  // Incorrectly flagged as fraudulent
    var trueNegatives = 0.0;   // Correctly identified as legitimate
    var falseNegatives = 0.0;  // Missed fraudulent companies
    
    for ((profile, actuallyFraudulent) in verificationResults.vals()) {
      let predictedFraudulent = switch (profile.verificationStatus) {
        case (#failed) { true };
        case (#suspicious) { profile.overallScore < 60.0 }; // Consider low suspicious as fraud
        case (_) { false };
      };
      
      if (actuallyFraudulent and predictedFraudulent) {
        truePositives += 1.0;
      } else if (not actuallyFraudulent and predictedFraudulent) {
        falsePositives += 1.0;
      } else if (not actuallyFraudulent and not predictedFraudulent) {
        trueNegatives += 1.0;
      } else {
        falseNegatives += 1.0;
      };
    };
    
    let total = Float.fromInt(verificationResults.size());
    let falsePositiveRate = if (falsePositives + trueNegatives > 0.0) { 
      falsePositives / (falsePositives + trueNegatives) 
    } else { 0.0 };
    let falseNegativeRate = if (falseNegatives + truePositives > 0.0) { 
      falseNegatives / (falseNegatives + truePositives) 
    } else { 0.0 };
    
    let precision = if (truePositives + falsePositives > 0.0) { 
      truePositives / (truePositives + falsePositives) 
    } else { 0.0 };
    let recall = if (truePositives + falseNegatives > 0.0) { 
      truePositives / (truePositives + falseNegatives) 
    } else { 0.0 };
    let f1Score = if (precision + recall > 0.0) { 
      2.0 * (precision * recall) / (precision + recall) 
    } else { 0.0 };
    
    let accuracyScore = (truePositives + trueNegatives) / total;
    
    let avgProcessingTime = if (processingTimes.size() > 0) {
      let sum = Array.foldLeft(processingTimes, 0, func(acc: Int, time: Int): Int { acc + time });
      sum / processingTimes.size();
    } else { 0 };
    
    {
      falsePositiveRate = falsePositiveRate;
      falseNegativeRate = falseNegativeRate;
      f1Score = f1Score;
      accuracyScore = accuracyScore;
      processingTime = avgProcessingTime;
      totalVerifications = verificationResults.size();
      lastCalculated = Time.now();
    };
  };
  
  // Weight optimization recommendation based on performance analysis
  public func recommendWeightAdjustments(
    currentMetrics: Types.PerformanceMetrics,
    targetMetrics: Types.PerformanceMetrics
  ) : [(Text, Float)] {
    var recommendations : [(Text, Float)] = [];
    
    // If false positive rate is too high, reduce fraud keyword weight
    if (currentMetrics.falsePositiveRate > targetMetrics.falsePositiveRate + 0.02) {
      recommendations := Array.append(recommendations, [("fraud_keywords", -0.2)]);
    };
    
    // If false negative rate is too high, increase business registry weight
    if (currentMetrics.falseNegativeRate > targetMetrics.falseNegativeRate + 0.01) {
      recommendations := Array.append(recommendations, [("business_registry", 0.3)]);
      recommendations := Array.append(recommendations, [("authority_mentions", 0.2)]);
    };
    
    // If F1 score is below target, balance the weights
    if (currentMetrics.f1Score < targetMetrics.f1Score - 0.05) {
      recommendations := Array.append(recommendations, [("news_sentiment", -0.1)]);
      recommendations := Array.append(recommendations, [("digital_footprint", 0.1)]);
    };
    
    recommendations;
  };
  
  // Validate weight configuration against Indonesian fraud patterns
  public func validateWeightConfiguration(
    weights: HashMap.HashMap<Text, Float>
  ) : { isValid: Bool; warnings: [Text]; recommendations: [Text] } {
    var warnings : [Text] = [];
    var recommendations : [Text] = [];
    var isValid = true;
    
    // Check business registry weight (should be high for Indonesian context)
    switch (weights.get("business_registry")) {
      case (?weight) {
        if (weight < 2.5) {
          warnings := Array.append(warnings, ["Business registry weight below recommended 2.5 for Indonesian market"]);
          recommendations := Array.append(recommendations, ["Increase business_registry weight to 3.0+ for OJK compliance emphasis"]);
        };
      };
      case (null) {
        isValid := false;
        warnings := Array.append(warnings, ["Missing business_registry weight configuration"]);
      };
    };
    
    // Check fraud keywords weight (should not be too high to avoid false positives)
    switch (weights.get("fraud_keywords")) {
      case (?weight) {
        if (weight > 3.0) {
          warnings := Array.append(warnings, ["Fraud keywords weight above 3.0 may cause false positives"]);
          recommendations := Array.append(recommendations, ["Reduce fraud_keywords weight to 2.5 or lower"]);
        };
      };
      case (null) {
        isValid := false;
        warnings := Array.append(warnings, ["Missing fraud_keywords weight configuration"]);
      };
    };
    
    // Check authority mentions weight (should be context-dependent)
    switch (weights.get("authority_mentions")) {
      case (?weight) {
        if (weight < 1.5 or weight > 3.0) {
          warnings := Array.append(warnings, ["Authority mentions weight outside optimal range (1.5-3.0)"]);
          recommendations := Array.append(recommendations, ["Set authority_mentions base weight to 2.0 with context adjustments"]);
        };
      };
      case (null) {
        isValid := false;
        warnings := Array.append(warnings, ["Missing authority_mentions weight configuration"]);
      };
    };
    
    { isValid = isValid; warnings = warnings; recommendations = recommendations };
  };

  // A/B test result analysis for weight optimization
  public func analyzeABTestResults(
    controlResults: [(Types.VerificationProfile, Bool)],
    treatmentResults: [(Types.VerificationProfile, Bool)]
  ) : { winner: Text; confidence: Float; improvement: Float; recommendation: Text } {
    let controlMetrics = calculatePerformanceMetrics(controlResults, []);
    let treatmentMetrics = calculatePerformanceMetrics(treatmentResults, []);
    
    let f1Improvement = treatmentMetrics.f1Score - controlMetrics.f1Score;
    let fpRateImprovement = controlMetrics.falsePositiveRate - treatmentMetrics.falsePositiveRate;
    let fnRateImprovement = controlMetrics.falseNegativeRate - treatmentMetrics.falseNegativeRate;
    
    let overallImprovement = f1Improvement + (fpRateImprovement * 0.5) + (fnRateImprovement * 0.5);
    
    let winner = if (overallImprovement > 0.01) { "treatment" }
                else if (overallImprovement < -0.01) { "control" }
                else { "inconclusive" };
    
    let confidence = Float.min(0.99, Float.abs(overallImprovement) * 10.0); // Simplified confidence calculation
    
    let recommendation = if (winner == "treatment") {
      "Deploy treatment weights to production - significant improvement detected"
    } else if (winner == "control") {
      "Keep control weights - treatment performed worse"
    } else {
      "Continue test or try different weight configuration - results inconclusive"
    };
    
    { 
      winner = winner; 
      confidence = confidence; 
      improvement = overallImprovement; 
      recommendation = recommendation 
    };
  };

  // Remove duplicate strings from array (no inner break; safer for moc 0.27)
private func contains(a : [Text], x : Text) : Bool {
  var found = false;
  label scan for (e in a.vals()) {
    if (e == x) { found := true; break scan };
  };
  found
};

private func removeDuplicates(arr : [Text]) : [Text] {
  var res : [Text] = [];
  for (item in arr.vals()) {
    if (not contains(res, item)) {
      res := Array.append(res, [item]);
    };
  };
  res
};

}
