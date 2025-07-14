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
import Iter "mo:base/Iter";
import Hash "mo:base/Hash";

actor class ARKSRWA(init_admin: ?Principal) = this {

  // Admin principal - configurable via constructor parameter
  let admin : Principal = switch(init_admin) {
    case (?p) p;
    case null Principal.fromText("o6dtt-od7eq-p5tmn-yilm3-4v453-v64p5-ep4q6-hxoeq-jhygx-u5dz7-aqe"); // fallback for local dev
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

  var companies : HashMap.HashMap<Nat, Company> = HashMap.HashMap(0, Nat.equal, Hash.hash);

  var holdings : HashMap.HashMap<Principal, HashMap.HashMap<Nat, Nat>> = HashMap.HashMap(0, Principal.equal, Principal.hash);

  var companyCount : Nat = 0;
  var minValuationE8s : Nat = 10_000_000;
  var transactionCount : Nat = 0;
  
  // Account type overrides - allows users to manually set their account type
  var accountTypeOverrides : HashMap.HashMap<Principal, AccountType> = HashMap.HashMap(0, Principal.equal, Principal.hash);

  // Enhanced pricing configuration
  let bondingCurveExponent : Float = 1.5;
  let volumeThreshold : Nat = 50;
  let volumeMultiplier : Float = 1.1;
  let velocityBonus : Float = 1.05;
  let scarcityThreshold : Float = 0.1;  // 10%
  let scarcityMultiplier : Float = 2.0;
  let defaultTokenPrice : Nat = 1_000_000;

  func getMinValuationE8s() : Nat {
    minValuationE8s;
  };

  // Enhanced pricing helper functions
  func safeDivide(numerator : Nat, denominator : Nat) : Nat {
    if (denominator == 0) {
      0; // Return 0 for division by zero to prevent traps
    } else {
      numerator / denominator;
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

  func calculateBondingCurvePrice(basePrice : Nat, sold : Nat, supply : Nat) : Nat {
    if (supply == 0) {
      basePrice; // Return base price if supply is zero
    } else {
      let soldRatio = Float.fromInt(sold) / Float.fromInt(supply);
      let priceMultiplier = powerFloat(1.0 + soldRatio, bondingCurveExponent);
      let newPrice = Float.fromInt(basePrice) * priceMultiplier;
      
      // Apply bounds checking
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

  func applyVolumeMultiplier(price : Nat, amount : Nat) : Nat {
    if (amount >= volumeThreshold) {
      let multipliedPrice = Float.fromInt(price) * volumeMultiplier;
      Int.abs(Float.toInt(multipliedPrice));
    } else {
      price;
    };
  };

  func applyScarcityMultiplier(price : Nat, remaining : Nat, supply : Nat) : Nat {
    if (supply == 0) {
      price;
    } else {
      let remainingRatio = Float.fromInt(remaining) / Float.fromInt(supply);
      if (remainingRatio < scarcityThreshold) {
        let multipliedPrice = Float.fromInt(price) * scarcityMultiplier;
        Int.abs(Float.toInt(multipliedPrice));
      } else {
        price;
      };
    };
  };

  func calculateEnhancedPrice(basePrice : Nat, sold : Nat, supply : Nat, purchaseAmount : Nat) : Nat {
    // Step 1: Calculate base bonding curve price
    var enhancedPrice = calculateBondingCurvePrice(basePrice, sold, supply);
    
    // Step 2: Apply volume multiplier for large purchases
    enhancedPrice := applyVolumeMultiplier(enhancedPrice, purchaseAmount);
    
    // Step 3: Apply scarcity multiplier if supply is low
    let remaining = supply - sold;
    enhancedPrice := applyScarcityMultiplier(enhancedPrice, remaining, supply);
    
    enhancedPrice;
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

    let updatedRemaining = company.remaining - amount;
    let sold = company.supply - updatedRemaining;
    
    // Use enhanced pricing calculation
    let newTokenPrice = calculateEnhancedPrice(company.base_price, sold, company.supply, amount);

    let updatedCompany : Company = {
      company with token_price = newTokenPrice;
      remaining = updatedRemaining;
    };
    companies.put(companyId, updatedCompany);

    let personalHoldings = Option.get(holdings.get(caller), HashMap.HashMap<Nat, Nat>(0, Nat.equal, Hash.hash));
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

        let newAmount = currentAmount - amount;

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
        let sold = company.supply - updatedRemaining;
        
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
          let updatedRemaining = company.remaining - amount;
          let sold = company.supply - updatedRemaining;
          let newPrice = calculateEnhancedPrice(company.base_price, sold, company.supply, amount);
          let priceImpact = if (newPrice > currentPrice) { newPrice - currentPrice } else { 0 };
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
        let sold = company.supply - updatedRemaining;
        let newPrice = calculateEnhancedPrice(company.base_price, sold, company.supply, amount);
        let priceImpact = if (currentPrice > newPrice) { currentPrice - newPrice } else { 0 };
        let totalReturn = (currentPrice + newPrice) * amount / 2; // Average price approximation
        #ok({ newPrice = newPrice; priceImpact = priceImpact; totalReturn = totalReturn });
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

        let fromHoldings = Option.get(holdings.get(fromPrincipal), HashMap.HashMap<Nat, Nat>(0, Nat.equal, Hash.hash));
        let currentBalance = Option.get(fromHoldings.get(companyId), 0);

        if (currentBalance < args.amount) {
          return #Err(#InsufficientFunds({ balance = currentBalance }));
        };

        let newFromBalance = currentBalance - args.amount;

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

        let toHoldings = Option.get(holdings.get(toPrincipal), HashMap.HashMap<Nat, Nat>(0, Nat.equal, Hash.hash));
        let currentToBalance = Option.get(toHoldings.get(companyId), 0);
        toHoldings.put(companyId, currentToBalance + args.amount);
        holdings.put(toPrincipal, toHoldings);

        transactionCount += 1;
        return #Ok(transactionCount);
      };
    };
  };
};
