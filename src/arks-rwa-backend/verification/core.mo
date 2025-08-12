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
    let baseURL = "https://www.google.com/search?q=";

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

  // Assign weights to different types of checks
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
