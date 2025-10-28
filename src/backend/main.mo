import Nat "mo:base/Nat";
import Text "mo:base/Text";
import Principal "mo:base/Principal";
import Error "mo:base/Error";
import Array "mo:base/Array";
import Float "mo:base/Float";
import Int "mo:base/Int";
import Option "mo:base/Option";
import Time "mo:base/Time";
import HashMap "mo:base/HashMap";
import Hash "mo:base/Hash";
import Iter "mo:base/Iter";
import Blob "mo:base/Blob";
import Debug "mo:base/Debug";

// Import verification system
import VerificationTypes "./verification/types";
import VerificationEngine "./verification/main";

persistent actor class ARKSRWA(init_admin: ?Principal, ai_service_url: ?Text, ai_auth_token: ?Text) = this {

  // Custom hash function for Nat to avoid deprecation warning
  func natHash(n : Nat) : Hash.Hash {
    Text.hash(Nat.toText(n));
  };

  // Admin principal - configurable via constructor parameter
  transient let admin : Principal = switch(init_admin) {
    case (?p) p;
    case null Principal.fromText("o6dtt-od7eq-p5tmn-yilm3-4v453-v64p5-ep4q6-hxoeq-jhygx-u5dz7-aqe"); // fallback for local dev
  };

  // AI Service Configuration
  private transient let AI_SERVICE_URL : Text = switch(ai_service_url) {
    case (?url) url;
    case null "http://localhost:3001"; // fallback for local dev
  };
  
  private transient let AI_AUTH_TOKEN : ?Text = ai_auth_token;
  
  // HTTP Request/Response types for AI service integration
  type HttpRequest = {
    url : Text;
    max_response_bytes : ?Nat64;
    headers : [HttpHeader];
    body : ?[Nat8];
    method : HttpMethod;
    transform : ?TransformFunction;
  };
  
  type HttpHeader = {
    name : Text;
    value : Text;
  };
  
  type HttpMethod = {
    #get;
    #post;
    #head;
  };
  
  type HttpResponse = {
    status : Nat;
    headers : [HttpHeader];
    body : [Nat8];
  };
  
  type TransformArgs = {
    response : HttpResponse;
    context : Blob;
  };
  
  type TransformFunction = {
    function : shared query (TransformArgs) -> async HttpResponse;
  };
  
  // AI Analysis Request/Response types
  type AIAnalysisRequest = {
    name : Text;
    description : Text;
    industry : ?Text;
    region : ?Text;
    valuation : ?Nat;
    symbol : ?Text;
  };
  
  type AIAnalysisResponse = {
    success : Bool;
    fraudScore : ?Nat;
    riskLevel : ?Text;
    confidence : ?Nat;
    processingTimeMs : ?Nat;
    error : ?Text;
  };

  type Company = {
    id : Nat;
    name : Text;
    symbol : Text;
    owner : Principal;
    valuation : Nat;
    base_price : Nat;
    token_price : Nat;
    supply : Nat;
    remaining : Nat;
    minimum_purchase : Nat;
    logo_url : Text;
    description : Text;
    created_at : Nat;
    // Verification fields
    verification_status : VerificationTypes.VerificationStatus;
    verification_score : ?Float;
    last_verified : ?Int;
    verification_job_id : ?Nat;
  };

  type TokenHolder = {
    companyId : Nat;
    investor : Principal;
    amount : Nat;
  };

  type AccountType = {
    #company;
    #user;
  };

  type Account = {
    owner : Principal;
    subaccount : ?Blob;
  };

  type TransferArgs = {
    from_subaccount : ?Blob;
    to : Account;
    amount : Nat;
    fee : ?Nat;
    memo : ?Blob;
    created_at_time : ?Nat64;
  };

  type TransferResult = {
    #Ok : Nat;
    #Err : TransferError;
  };

  type TransferError = {
    #BadFee : { expected_fee : Nat };
    #BadBurn : { min_burn_amount : Nat };
    #InsufficientFunds : { balance : Nat };
    #TooOld;
    #CreatedInFuture : { ledger_time : Nat64 };
    #Duplicate : { duplicate_of : Nat };
    #TemporarilyUnavailable;
    #GenericError : { error_code : Nat; message : Text };
  };

  transient var companies : HashMap.HashMap<Nat, Company> = HashMap.HashMap(0, Nat.equal, natHash);

  transient var holdings : HashMap.HashMap<Principal, HashMap.HashMap<Nat, Nat>> = HashMap.HashMap(0, Principal.equal, Principal.hash);

  transient var companyCount : Nat = 0;
  transient var minValuationE8s : Nat = 10_000_000;
  transient var transactionCount : Nat = 0;
  
  // Account type overrides - allows users to manually set their account type
  transient var accountTypeOverrides : HashMap.HashMap<Principal, AccountType> = HashMap.HashMap(0, Principal.equal, Principal.hash);

  // Initialize verification engine
  private transient let verificationEngine = VerificationEngine.createVerificationEngine();

  // Enhanced pricing configuration
  transient let bondingCurveExponent : Float = 1.5;
  transient let volumeThreshold : Nat = 50;
  transient let volumeMultiplier : Float = 1.1;
  transient let scarcityThreshold : Float = 0.1;  // 10%
  transient let scarcityMultiplier : Float = 2.0;
  transient let defaultTokenPrice : Nat = 1_000_000;

  func getMinValuationE8s() : Nat {
    minValuationE8s;
  };

  // Enhanced pricing helper functions
  func safeSubtract(a : Nat, b : Nat) : Nat {
    if (a >= b) {
      a - b;
    } else {
      0; // Return 0 if subtraction would underflow
    };
  };

  func powerFloat(base : Float, exponent : Float) : Float {
    // Simple power function for bonding curve
    // For base^exponent, we use: e^(exponent * ln(base))
    if (base <= 0.0) {
      1.0; // Return 1.0 for invalid base to prevent traps
    } else {
      // Simplified implementation - in production, use proper math library
      if (exponent == 1.0) { base }
      else if (exponent == 1.5) { base * Float.sqrt(base) }
      else if (exponent == 2.0) { base * base }
      else { base * base }; // fallback to square for other exponents
    };
  };

  // Calculate base bonding curve price without additional multipliers
  func calculateBaseBondingCurvePrice(basePrice : Nat, sold : Nat, supply : Nat) : Nat {
    if (supply == 0) {
      basePrice; // Return base price if supply is zero
    } else {
      let soldRatio = Float.fromInt(sold) / Float.fromInt(supply);
      let priceMultiplier = powerFloat(1.0 + soldRatio, bondingCurveExponent);
      let newPrice = Float.fromInt(basePrice) * priceMultiplier;
      
      // Apply bounds checking to prevent extreme price movements
      let minPrice = Float.fromInt(basePrice) * 0.5;
      let maxPrice = Float.fromInt(basePrice) * 10.0;
      
      if (newPrice < minPrice) {
        Int.abs(Float.toInt(minPrice));
      } else if (newPrice > maxPrice) {
        Int.abs(Float.toInt(maxPrice));
      } else {
        Int.abs(Float.toInt(newPrice));
      };
    };
  };

  // Calculate combined multiplier for scarcity and volume effects
  func calculateCombinedMultiplier(remaining : Nat, supply : Nat, amount : Nat) : Float {
    // Handle edge case where supply is zero
    if (supply == 0) {
      return 1.0;
    };
    
    // Calculate scarcity factor - gradual increase as remaining supply decreases
    // scarcityRatio ranges from 1.0 (full supply) to 0.0 (no remaining)
    let scarcityRatio = Float.fromInt(remaining) / Float.fromInt(supply);
    let scarcityFactor = Float.max(1.0, 2.0 - scarcityRatio);
    
    // Calculate volume factor - gradual increase with purchase amount
    // Starts at 1.0 for small purchases, increases gradually, capped at 1.5
    let volumeFactor = Float.min(1.5, 1.0 + Float.fromInt(amount) / 100.0);
    
    // Combine factors multiplicatively for compound effect
    scarcityFactor * volumeFactor;
  };


  // Enhanced price calculation with clean, modular structure
  func calculateEnhancedPrice(basePrice : Nat, sold : Nat, supply : Nat, purchaseAmount : Nat) : Nat {
    // Step 1: Calculate base bonding curve price
    let baseBondingPrice = calculateBaseBondingCurvePrice(basePrice, sold, supply);
    
    // Step 2: Calculate combined multiplier for scarcity and volume effects
    let remaining = safeSubtract(supply, sold);
    let combinedMultiplier = calculateCombinedMultiplier(remaining, supply, purchaseAmount);
    
    // Step 3: Apply multiplier and convert safely back to Nat
    let finalPrice = Float.fromInt(baseBondingPrice) * combinedMultiplier;
    Int.abs(Float.toInt(finalPrice));
  };

  // === AI SERVICE INTEGRATION ===

  // System IC interface for HTTP requests
  private transient let ic : actor {
    http_request : HttpRequest -> async HttpResponse;
  } = actor("aaaaa-aa");

  // Transform function for HTTP responses (removes headers for consensus)
  private func _transformResponse(args : TransformArgs) : HttpResponse {
    {
      status = args.response.status;
      headers = []; // Remove headers for consensus
      body = args.response.body;
    };
  };

  // Convert bytes to text
  private func textFromBytes(bytes : [Nat8]) : Text {
    switch (Text.decodeUtf8(Blob.fromArray(bytes))) {
      case (?text) { text };
      case null { "" };
    };
  };

  // Call AI service for fraud analysis
  private func callAIService(companyData : AIAnalysisRequest) : async AIAnalysisResponse {
    switch (AI_AUTH_TOKEN) {
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

  public func createCompany(name : Text, symbol : Text, logo_url : Text, description : Text, valuation : Nat, desiredSupply : ?Nat, desiredPrice : ?Nat, caller : Principal) : async Nat {
    let created_at = Int.abs(Time.now());

    if (valuation < getMinValuationE8s()) {
      throw Error.reject("Valuation too low.");
    };
    if (Text.size(symbol) < 3 or Text.size(symbol) > 5) {
      throw Error.reject("Symbol must be 3-5 characters.");
    };

    for (c in companies.vals()) {
      if (c.symbol == symbol) { throw Error.reject("Symbol already used.") };
    };

    var token_price : Nat = 0;
    var supply : Nat = 0;
    switch (desiredSupply, desiredPrice) {
      case (?supplyInput, null) {
        if (supplyInput == 0) { throw Error.reject("Supply must be > 0") };
        supply := supplyInput;
        token_price := if (supply == 0) { defaultTokenPrice } else { valuation / supply };
      };
      case (null, ?priceInput) {
        if (priceInput == 0) { throw Error.reject("Price must be > 0") };
        token_price := priceInput;
        supply := if (token_price == 0) { 1 } else { valuation / token_price };
      };
      case (null, null) {
        token_price := defaultTokenPrice;
        supply := if (token_price == 0) { 1 } else { valuation / token_price };
      };
      case (?_, ?_) {
        throw Error.reject("Set either supply or price, not both.");
      };
    };

    let minTokens : Nat = if (supply < 5) { 1 } else { 5 };
    
    // Try AI-powered verification first, fallback to legacy
    var verificationStatus : VerificationTypes.VerificationStatus = #pending;
    var verificationScore : ?Float = null;
    var verificationJobId : ?Nat = null;
    
    try {
      // Call AI service for fraud analysis
      let aiRequest : AIAnalysisRequest = {
        name = name;
        description = description;
        industry = null; // Could be extracted from description
        region = ?"Indonesia"; // Default region
        valuation = ?valuation;
        symbol = ?symbol;
      };
      
      let aiResult = await callAIService(aiRequest);
      
      if (aiResult.success) {
        Debug.print("AI verification successful for " # name);
        switch (aiResult.fraudScore) {
          case (?score) {
            verificationScore := ?Float.fromInt(score);
            verificationStatus := if (score < 30) #verified 
                                 else if (score < 60) #suspicious 
                                 else #failed;
          };
          case null {};
        };
      } else {
        Debug.print("AI verification failed, falling back to legacy for " # name);
        // Fallback to legacy verification
        let jobId = await verificationEngine.startVerification(
          companyCount, 
          name, 
          #normal
        );
        verificationJobId := ?jobId;
      };
    } catch (error) {
      Debug.print("AI verification error, using legacy for " # name # ": " # Error.message(error));
      // Fallback to legacy verification
      let jobId = await verificationEngine.startVerification(
        companyCount, 
        name, 
        #normal
      );
      verificationJobId := ?jobId;
    };

    let newCompany : Company = {
      id = companyCount;
      name = name;
      symbol = symbol;
      owner = caller;
      valuation = valuation;
      base_price = token_price;
      token_price = token_price;
      supply = supply;
      remaining = supply;
      minimum_purchase = token_price * minTokens;
      logo_url = logo_url;
      description = description;
      created_at = created_at;
      // Initialize verification fields with AI or legacy results
      verification_status = verificationStatus;
      verification_score = verificationScore;
      last_verified = switch (verificationScore) { case (?_) ?Time.now(); case null null };
      verification_job_id = verificationJobId;
    };

    companies.put(companyCount, newCompany);
    companyCount += 1;
    return newCompany.id;
  };


  public query func listCompanies() : async [Company] {
    return Iter.toArray(companies.vals());
  };

  public query func listHoldings() : async [TokenHolder] {
    var allHolders : [TokenHolder] = [];
    for ((investor, personalHoldings) in holdings.entries()) {
      for ((companyId, amount) in personalHoldings.entries()) {
        if (amount > 0) {
          allHolders := Array.append(allHolders, [{ investor = investor; companyId = companyId; amount = amount }]);
        };
      };
    };
    return allHolders;
  };

  public query func getMyHolding(companyId : Nat, caller : Principal) : async Nat {
    switch (holdings.get(caller)) {
      case (null) { return 0 };
      case (?personalHoldings) {
        return Option.get(personalHoldings.get(companyId), 0);
      };
    };
  };

  public func buyTokens(companyId : Nat, amount : Nat, caller : Principal) : async Text {

    let company = switch (companies.get(companyId)) {
      case (?c) { c };
      case (null) { throw Error.reject("Invalid company ID") };
    };

    if (company.remaining < amount) {
      throw Error.reject("Not enough tokens available");
    };

    let updatedRemaining = safeSubtract(company.remaining, amount);
    let sold = safeSubtract(company.supply, updatedRemaining);
    
    // Use enhanced pricing calculation
    let newTokenPrice = calculateEnhancedPrice(company.base_price, sold, company.supply, amount);

    let updatedCompany : Company = {
      company with token_price = newTokenPrice;
      remaining = updatedRemaining;
    };
    companies.put(companyId, updatedCompany);

    let personalHoldings = Option.get(holdings.get(caller), HashMap.HashMap<Nat, Nat>(0, Nat.equal, natHash));
    let currentAmount = Option.get(personalHoldings.get(companyId), 0);
    personalHoldings.put(companyId, currentAmount + amount);
    holdings.put(caller, personalHoldings);

    return "Purchase successful. New price: " # Nat.toText(newTokenPrice);
  };

  public func sellTokens(companyId : Nat, amount : Nat, caller : Principal) : async Text {
    let company = switch (companies.get(companyId)) {
      case (?c) { c };
      case (null) { throw Error.reject("Invalid company ID") };
    };

    switch (holdings.get(caller)) {
      case (null) { throw Error.reject("You do not own any tokens.") };
      case (?personalHoldings) {
        let currentAmount = Option.get(personalHoldings.get(companyId), 0);
        if (currentAmount < amount) {
          throw Error.reject("Not enough tokens to sell");
        };

        let newAmount = safeSubtract(currentAmount, amount);

        if (newAmount == 0) {
          let _ = personalHoldings.remove(companyId);
        } else {
          personalHoldings.put(companyId, newAmount);
        };

        if (personalHoldings.size() == 0) {
          let _ = holdings.remove(caller);
        } else {
          holdings.put(caller, personalHoldings);
        };

        let updatedRemaining = company.remaining + amount;
        let sold = safeSubtract(company.supply, updatedRemaining);
        
        // Use enhanced pricing calculation
        let newTokenPrice = calculateEnhancedPrice(company.base_price, sold, company.supply, amount);

        let updatedCompany : Company = {
          company with token_price = newTokenPrice;
          remaining = updatedRemaining;
        };
        companies.put(companyId, updatedCompany);

        return "Sold " # Nat.toText(amount) # " tokens. New price: " # Nat.toText(newTokenPrice);
      };
    };
  };

  // Price simulation functions for frontend integration
  public query func simulatePurchasePrice(companyId : Nat, amount : Nat) : async {
    #ok : { newPrice : Nat; priceImpact : Nat; totalCost : Nat };
    #err : Text;
  } {
    switch (companies.get(companyId)) {
      case (null) { #err("Invalid company ID") };
      case (?company) {
        if (company.remaining < amount) {
          #err("Not enough tokens available");
        } else {
          let currentPrice = company.token_price;
          let updatedRemaining = safeSubtract(company.remaining, amount);
          let sold = safeSubtract(company.supply, updatedRemaining);
          let newPrice = calculateEnhancedPrice(company.base_price, sold, company.supply, amount);
          let priceImpact = if (newPrice > currentPrice) { safeSubtract(newPrice, currentPrice) } else { 0 };
          let totalCost = (currentPrice + newPrice) * amount / 2; // Average price approximation
          #ok({ newPrice = newPrice; priceImpact = priceImpact; totalCost = totalCost });
        };
      };
    };
  };

  public query func simulateSellPrice(companyId : Nat, amount : Nat) : async {
    #ok : { newPrice : Nat; priceImpact : Nat; totalReturn : Nat };
    #err : Text;
  } {
    switch (companies.get(companyId)) {
      case (null) { #err("Invalid company ID") };
      case (?company) {
        let currentPrice = company.token_price;
        let updatedRemaining = company.remaining + amount;
        
        // Handle potential underflow - if selling would result in more remaining than supply
        if (updatedRemaining > company.supply) {
          #err("Cannot sell more tokens than were originally sold");
        } else {
          let sold = safeSubtract(company.supply, updatedRemaining);
          let newPrice = calculateEnhancedPrice(company.base_price, sold, company.supply, amount);
          let priceImpact = if (currentPrice > newPrice) { safeSubtract(currentPrice, newPrice) } else { 0 };
          let totalReturn = (currentPrice + newPrice) * amount / 2; // Average price approximation
          #ok({ newPrice = newPrice; priceImpact = priceImpact; totalReturn = totalReturn });
        };
      };
    };
  };

  public query func getPricingParameters() : async {
    bondingCurveExponent : Float;
    volumeThreshold : Nat;
    volumeMultiplier : Float;
    scarcityThreshold : Float;
    scarcityMultiplier : Float;
    defaultTokenPrice : Nat;
  } {
    {
      bondingCurveExponent = bondingCurveExponent;
      volumeThreshold = volumeThreshold;
      volumeMultiplier = volumeMultiplier;
      scarcityThreshold = scarcityThreshold;
      scarcityMultiplier = scarcityMultiplier;
      defaultTokenPrice = defaultTokenPrice;
    };
  };

  // User type detection for role-based access
  public query func getUserType(caller : Principal) : async AccountType {
    // First check for manual account type override
    switch (accountTypeOverrides.get(caller)) {
      case (?accountType) { return accountType; };
      case null {
        // Fall back to company ownership detection
        for (company in companies.vals()) {
          if (company.owner == caller) {
            return #company;
          }
        };
        return #user;
      };
    };
  };

  // Set account type manually - users can set their own account type
  public func setAccountType(accountType : AccountType, caller : Principal) : async () {
    accountTypeOverrides.put(caller, accountType);
  };

  // Reset account type to automatic detection based on company ownership
  public func resetAccountType(caller : Principal) : async () {
    accountTypeOverrides.delete(caller);
  };

  // Check if account type is manually set or derived from company ownership
  public query func getAccountTypeSource(caller : Principal) : async Text {
    switch (accountTypeOverrides.get(caller)) {
      case (?_) { "manual" };
      case null { "derived" };
    };
  };

  public func setMinValuationE8s(newMin : Nat, caller : Principal) : async () {
    if (caller != admin) {
      throw Error.reject("Authorization failed: Only admin can perform this action.");
    };
    minValuationE8s := newMin;
  };

  public func updateCompanyDescription(companyId : Nat, newDescription : Text, caller : Principal) : async () {
    let company = switch (companies.get(companyId)) {
      case (?c) { c };
      case (null) { throw Error.reject("Invalid company ID") };
    };

    if (caller != company.owner) {
      throw Error.reject("Authorization failed: Only the company owner can perform this action.");
    };

    let updatedCompany = { company with description = newDescription };
    companies.put(companyId, updatedCompany);
  };

  public query func getCompanyById(companyId : Nat) : async ?Company {
    return companies.get(companyId);
  };

  // Test: dfx canister call arks-rwa-backend icrc1_balance_of '(0, record{owner=principal "o6dtt-od7eq-p5tmn-yilm3-4v453-v64p5-ep4q6-hxoeq-jhygx-u5dz7-aqe"; subaccount=null})'
  public query func icrc1_balance_of(companyId : Nat, account : Account) : async {
    #ok : Nat;
    #err : Text;
  } {
    switch (companies.get(companyId)) {
      case (null) { return #err("Invalid company ID") };
      case (?_) {
        switch (holdings.get(account.owner)) {
          case (null) { #ok(0) };
          case (?personalHoldings) {
            #ok(Option.get(personalHoldings.get(companyId), 0));
          };
        };
      };
    };
  };

  // Test: dfx canister call arks-rwa-backend icrc1_name '(0)'
  public query func icrc1_name(companyId : Nat) : async {
    #ok : Text;
    #err : Text;
  } {
    switch (companies.get(companyId)) {
      case (null) { #err("Invalid company ID") };
      case (?company) { #ok(company.name) };
    };
  };

  // Test: dfx canister call arks-rwa-backend icrc1_symbol '(0)'
  public query func icrc1_symbol(companyId : Nat) : async {
    #ok : Text;
    #err : Text;
  } {
    switch (companies.get(companyId)) {
      case (null) { #err("Invalid company ID") };
      case (?company) { #ok(company.symbol) };
    };
  };

  // Test: dfx canister call arks-rwa-backend icrc1_decimals '(0)'
  public query func icrc1_decimals(tokenCompanyId : Nat) : async {
    #ok : Nat;
    #err : Text;
  } {
    switch (companies.get(tokenCompanyId)) {
      case (null) { #err("Invalid company ID") };
      case (?_) { #ok(0) };
    };
  };

  // Test: dfx canister call arks-rwa-backend icrc1_total_supply '(0)'
  public query func icrc1_total_supply(tokenCompanyId : Nat) : async {
    #ok : Nat;
    #err : Text;
  } {
    switch (companies.get(tokenCompanyId)) {
      case (null) { #err("Invalid company ID") };
      case (?company) { #ok(company.supply) };
    };
  };

  // Test: dfx canister call arks-rwa-backend icrc1_fee '(0)'
  public query func icrc1_fee(tokenCompanyId : Nat) : async {
    #ok : Nat;
    #err : Text;
  } {
    switch (companies.get(tokenCompanyId)) {
      case (null) { #err("Invalid company ID") };
      case (?_) { #ok(0) };
    };
  };

  // Test: dfx canister call arks-rwa-backend icrc1_minting_account '(0)'
  public query func icrc1_minting_account(tokenCompanyId : Nat) : async {#ok : ?Account; #err : Text} {
    switch (companies.get(tokenCompanyId)) {
      case (null) { #err("Invalid company ID") };
      case (?company) { #ok(?{owner = company.owner; subaccount = null}) };
    };
  };

  // Test: dfx canister call arks-rwa-backend icrc1_supported_standards '()'
  public query func icrc1_supported_standards() : async [{
    name : Text;
    url : Text;
  }] {
    [
      {
        name = "ICRC-1";
        url = "https://github.com/dfinity/ICRC-1/tree/main/standards/ICRC-1";
      }
    ];
  };

  // Test: dfx canister call arks-rwa-backend icrc1_metadata '(0)'
  public query func icrc1_metadata(tokenCompanyId : Nat) : async {
    #ok : [(Text, { #Nat : Nat; #Text : Text })];
    #err : Text;
  } {
    switch (companies.get(tokenCompanyId)) {
      case (null) { #err("Invalid company ID") };
      case (?company) {
        #ok([
          ("icrc1:name", #Text(company.name)),
          ("icrc1:symbol", #Text(company.symbol)),
          ("icrc1:decimals", #Nat(0)),
          ("icrc1:fee", #Nat(0)),
          ("icrc1:logo", #Text(company.logo_url)),
          ("icrc1:description", #Text(company.description)),
        ]);
      };
    };
  };

  // Test: dfx canister call arks-rwa-backend icrc1_transfer '(0, record{from_subaccount=null; to=record{owner=principal "recipient-principal"; subaccount=null}; amount=100; fee=null; memo=null; created_at_time=null}, principal "sender-principal")'
  public func icrc1_transfer(companyId : Nat, args : TransferArgs, caller : Principal) : async TransferResult {

    switch (companies.get(companyId)) {
      case (null) {
        return #Err(#GenericError({ error_code = 404; message = "Invalid company ID" }));
      };
      case (?_company) {
        if (args.amount == 0) {
          return #Err(#GenericError({ error_code = 400; message = "Transfer amount must be greater than 0" }));
        };

        let fromPrincipal = caller;
        let toPrincipal = args.to.owner;

        let fromHoldings = Option.get(holdings.get(fromPrincipal), HashMap.HashMap<Nat, Nat>(0, Nat.equal, natHash));
        let currentBalance = Option.get(fromHoldings.get(companyId), 0);

        if (currentBalance < args.amount) {
          return #Err(#InsufficientFunds({ balance = currentBalance }));
        };

        let newFromBalance = safeSubtract(currentBalance, args.amount);

        if (newFromBalance == 0) {
          let _ = fromHoldings.remove(companyId);
        } else {
          fromHoldings.put(companyId, newFromBalance);
        };

        if (fromHoldings.size() == 0) {
          let _ = holdings.remove(fromPrincipal);
        } else {
          holdings.put(fromPrincipal, fromHoldings);
        };

        let toHoldings = Option.get(holdings.get(toPrincipal), HashMap.HashMap<Nat, Nat>(0, Nat.equal, natHash));
        let currentToBalance = Option.get(toHoldings.get(companyId), 0);
        toHoldings.put(companyId, currentToBalance + args.amount);
        holdings.put(toPrincipal, toHoldings);

        transactionCount += 1;
        return #Ok(transactionCount);
      };
    };
  };

  // ===== VERIFICATION SYSTEM FUNCTIONS =====

  // Get verification status for a company
  public query func getCompanyVerificationStatus(companyId : Nat) : async ?{
    status : VerificationTypes.VerificationStatus;
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
  public query func getCompanyVerificationProfile(companyId : Nat) : async ?VerificationTypes.VerificationProfile {
    verificationEngine.getVerificationProfile(companyId);
  };

  // Check if company needs reverification
  public query func companyNeedsReverification(companyId : Nat) : async Bool {
    verificationEngine.needsReverification(companyId);
  };

  // Get verification job status
  public query func getVerificationJobStatus(jobId : Nat) : async ?VerificationTypes.VerificationJob {
    verificationEngine.getJobStatus(jobId);
  };

  // Start manual verification for a company (admin only)
  public func startManualVerification(companyId : Nat, priority : VerificationTypes.JobPriority, caller : Principal) : async ?Nat {
    if (caller != admin) {
      throw Error.reject("Authorization failed: Only admin can start manual verification.");
    };

    switch (companies.get(companyId)) {
      case (?company) {
        let jobId = await verificationEngine.startVerification(companyId, company.name, priority);
        
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

    let pendingJobs = verificationEngine.listPendingJobs();
    var processedCount = 0;

    for (job in pendingJobs.vals()) {
      if (processedCount < maxJobs and job.status == #queued) {
        let success = await verificationEngine.processVerificationJob(job.jobId);
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
        switch (verificationEngine.getVerificationProfile(companyId)) {
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

    verificationEngine.cancelJob(jobId);
  };

  // Cleanup verification cache (admin only)
  public func cleanupVerificationCache(caller : Principal) : async Nat {
    if (caller != admin) {
      throw Error.reject("Authorization failed: Only admin can cleanup cache.");
    };

    verificationEngine.cleanupCache();
  };

  // Get cache statistics (admin only) - Legacy search cache
  public query func getVerificationCacheStats(caller : Principal) : async ?{
    entries : Nat;
    oldEntries : Nat;
  } {
    if (caller != admin) {
      return null;
    };

    ?verificationEngine.getCacheStats();
  };
  
  // NEW: Get Scorer API verification cache statistics
  public query func getScorerCacheStats(caller : Principal) : async ?{ entries : Nat; expiredEntries : Nat; hitRate : ?Float } {
    // Only admin can access cache stats
    if (caller != admin) {
      return null;
    };
    
    ?verificationEngine.getVerificationCacheStats();
  };
  
  // NEW: Clean up expired Scorer API cache entries
  public func cleanupScorerCache(caller : Principal) : async ?Nat {
    // Only admin can clean cache
    if (caller != admin) {
      return null;
    };
    
    ?verificationEngine.cleanupVerificationCache();
  };
  
  // NEW: Test Scorer API verification with external API key (for testing the new architecture)
  public func testScorerApiVerification(companyId : Nat, apiKey : Text, caller : Principal) : async ?VerificationTypes.VerificationProfile {
    // Only admin can test Scorer API
    if (caller != admin) {
      return null;
    };
    
    switch (companies.get(companyId)) {
      case (?company) {
        try {
          let profile = await verificationEngine.performScorerApiVerification(
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
  public func refreshCompanyVerificationScorer(companyId : Nat, caller : Principal) : async ?VerificationTypes.VerificationProfile {
    // Only admin can force refresh
    if (caller != admin) {
      return null;
    };
    
    switch (companies.get(companyId)) {
      case (?company) {
        try {
          let profile = await verificationEngine.refreshCompanyVerification(companyId, company.name);
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
    newStatus : VerificationTypes.VerificationStatus, 
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

  // ===== API KEY MANAGEMENT REMOVED FOR SECURITY =====
  // External API key injection used for AI-powered verification
  // No API keys stored in canister memory for enhanced security
};
