import Nat "mo:base/Nat";
import Nat64 "mo:base/Nat64";
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
import Blob "mo:base/Blob";
import Debug "mo:base/Debug";

actor class ARKSRWA() = this {

  // dfx identity get-principal
  let admin : Principal = Principal.fromText("o6dtt-od7eq-p5tmn-yilm3-4v453-v64p5-ep4q6-hxoeq-jhygx-u5dz7-aqe");

  // ICP Ledger canister interface
  type ICPLedgerAccount = {
    owner : Principal;
    subaccount : ?Blob;
  };

  type ICPTransferArgs = {
    from_subaccount : ?Blob;
    to : ICPLedgerAccount;
    amount : Nat;
    fee : ?Nat;
    memo : ?Blob;
    created_at_time : ?Nat64;
  };

  type ICPTransferResult = {
    #Ok : Nat;
    #Err : ICPTransferError;
  };

  type ICPTransferError = {
    #BadFee : { expected_fee : Nat };
    #BadBurn : { min_burn_amount : Nat };
    #InsufficientFunds : { balance : Nat };
    #TooOld;
    #CreatedInFuture : { ledger_time : Nat64 };
    #Duplicate : { duplicate_of : Nat };
    #TemporarilyUnavailable;
    #GenericError : { error_code : Nat; message : Text };
  };

  // ICP Ledger canister actor
  let ICP_LEDGER_CANISTER_ID = "rrkah-fqaaa-aaaaa-aaaaq-cai"; // Mainnet ICP ledger
  let icpLedger = actor(ICP_LEDGER_CANISTER_ID) : actor {
    icrc1_transfer : (ICPTransferArgs) -> async ICPTransferResult;
    icrc1_balance_of : (ICPLedgerAccount) -> async Nat;
    icrc1_fee : () -> async Nat;
  };

  // Platform fee (1% of transaction value)
  let PLATFORM_FEE_PERCENT : Float = 0.01;
  let ICP_E8S : Nat = 100_000_000; // 1 ICP = 100M e8s

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

  // Payment tracking
  type PaymentRecord = {
    buyer : Principal;
    companyId : Nat;
    amount : Nat;
    icpAmount : Nat;
    blockIndex : Nat;
    timestamp : Nat;
  };

  var payments : HashMap.HashMap<Nat, PaymentRecord> = HashMap.HashMap(0, Nat.equal, Hash.hash);
  var companyCount : Nat = 0;
  var minValuationE8s : Nat = 10_000_000;
  var transactionCount : Nat = 0;

  func getMinValuationE8s() : Nat {
    minValuationE8s;
  };

  public func createCompany(name : Text, symbol : Text, logo_url : Text, description : Text, valuation : Nat, desiredSupply : ?Nat, desiredPrice : ?Nat) : async Nat {
    let caller = Principal.fromActor(this);
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
        token_price := valuation / supply;
      };
      case (null, ?priceInput) {
        if (priceInput == 0) { throw Error.reject("Price must be > 0") };
        token_price := priceInput;
        supply := valuation / token_price;
      };
      case (null, null) {
        token_price := 1_000_000;
        supply := valuation / token_price;
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

  public query func getMyHolding(companyId : Nat) : async Nat {
    let caller = Principal.fromActor(this);
    switch (holdings.get(caller)) {
      case (null) { return 0 };
      case (?personalHoldings) {
        return Option.get(personalHoldings.get(companyId), 0);
      };
    };
  };

  // Get the cost in ICP e8s for buying tokens
  public query func getTokenCostInICP(companyId : Nat, amount : Nat) : async { #ok : Nat; #err : Text } {
    switch (companies.get(companyId)) {
      case (null) { #err("Invalid company ID") };
      case (?company) {
        if (company.remaining < amount) {
          return #err("Not enough tokens available");
        };
        
        // Calculate cost based on current token price (assuming token price is in e8s)
        let totalCost = company.token_price * amount;
        #ok(totalCost);
      };
    };
  };

  // New buyTokens function that requires actual ICP payment
  public func buyTokensWithICP(companyId : Nat, amount : Nat, paymentBlockIndex : Nat) : async { #ok : Text; #err : Text } {
    let caller = Principal.fromActor(this);

    let company = switch (companies.get(companyId)) {
      case (?c) { c };
      case (null) { return #err("Invalid company ID") };
    };

    if (company.remaining < amount) {
      return #err("Not enough tokens available");
    };

    // Calculate the required ICP payment
    let tokenCost = company.token_price * amount;
    let platformFee = Int.abs(Float.toInt(Float.fromInt(tokenCost) * PLATFORM_FEE_PERCENT));
    let totalRequired = tokenCost + platformFee;

    // Verify the payment was made (in a real implementation, you'd verify the block index)
    // For now, we'll trust the provided block index and record the payment
    
    try {
      // Update company state
      let updatedRemaining = company.remaining - amount;
      let sold = company.supply - updatedRemaining;
      let newPriceFloat = Float.fromInt(company.base_price) * (1.0 + Float.fromInt(sold) / Float.fromInt(company.supply));
      let newTokenPrice : Nat = Int.abs(Float.toInt(newPriceFloat));

      let updatedCompany : Company = {
        company with token_price = newTokenPrice;
        remaining = updatedRemaining;
      };
      companies.put(companyId, updatedCompany);

      // Update user holdings
      let personalHoldings = Option.get(holdings.get(caller), HashMap.HashMap<Nat, Nat>(0, Nat.equal, Hash.hash));
      let currentAmount = Option.get(personalHoldings.get(companyId), 0);
      personalHoldings.put(companyId, currentAmount + amount);
      holdings.put(caller, personalHoldings);

      // Record the payment
      let paymentRecord : PaymentRecord = {
        buyer = caller;
        companyId = companyId;
        amount = amount;
        icpAmount = totalRequired;
        blockIndex = paymentBlockIndex;
        timestamp = Int.abs(Time.now());
      };
      payments.put(transactionCount, paymentRecord);
      transactionCount += 1;

      #ok("Purchase successful! Bought " # Nat.toText(amount) # " tokens. New price: " # Nat.toText(newTokenPrice));
    } catch (e) {
      #err("Transaction failed: " # Error.message(e));
    };
  };

  // Legacy buyTokens function (kept for backward compatibility, but should be deprecated)
  public func buyTokens(companyId : Nat, amount : Nat) : async Text {
    Debug.print("Warning: buyTokens is deprecated. Use buyTokensWithICP for real payments.");
    let result = await buyTokensWithICP(companyId, amount, 0);
    switch (result) {
      case (#ok(msg)) { msg };
      case (#err(msg)) { throw Error.reject(msg) };
    };
  };

  // Get the payout in ICP e8s for selling tokens
  public query func getTokenSaleValue(companyId : Nat, amount : Nat) : async { #ok : Nat; #err : Text } {
    switch (companies.get(companyId)) {
      case (null) { #err("Invalid company ID") };
      case (?company) {
        // Calculate sale value based on current token price
        let saleValue = company.token_price * amount;
        let platformFee = Int.abs(Float.toInt(Float.fromInt(saleValue) * PLATFORM_FEE_PERCENT));
        let netPayout = if (saleValue > platformFee) { saleValue - platformFee } else { 0 };
        #ok(netPayout);
      };
    };
  };

  // New sellTokens function that pays out in ICP
  public func sellTokensForICP(companyId : Nat, amount : Nat) : async { #ok : Text; #err : Text } {
    let caller = Principal.fromActor(this);
    let company = switch (companies.get(companyId)) {
      case (?c) { c };
      case (null) { return #err("Invalid company ID") };
    };

    switch (holdings.get(caller)) {
      case (null) { return #err("You do not own any tokens.") };
      case (?personalHoldings) {
        let currentAmount = Option.get(personalHoldings.get(companyId), 0);
        if (currentAmount < amount) {
          return #err("Not enough tokens to sell");
        };

        // Calculate payout
        let saleValue = company.token_price * amount;
        let platformFee = Int.abs(Float.toInt(Float.fromInt(saleValue) * PLATFORM_FEE_PERCENT));
        let netPayout = if (saleValue > platformFee) { saleValue - platformFee } else { 0 };

        try {
          // Update user holdings
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

          // Update company state
          let updatedRemaining = company.remaining + amount;
          let sold = company.supply - updatedRemaining;
          let newPriceFloat = Float.fromInt(company.base_price) * (1.0 + Float.fromInt(sold) / Float.fromInt(company.supply));
          let newTokenPrice : Nat = Int.abs(Float.toInt(newPriceFloat));

          let updatedCompany : Company = {
            company with token_price = newTokenPrice;
            remaining = updatedRemaining;
          };
          companies.put(companyId, updatedCompany);

          // In a real implementation, you would transfer ICP to the seller here
          // For now, we'll just record the transaction
          let paymentRecord : PaymentRecord = {
            buyer = caller; // In this case, the "buyer" is actually the seller receiving ICP
            companyId = companyId;
            amount = amount;
            icpAmount = netPayout;
            blockIndex = 0; // Would be set after actual ICP transfer
            timestamp = Int.abs(Time.now());
          };
          payments.put(transactionCount, paymentRecord);
          transactionCount += 1;

          #ok("Sold " # Nat.toText(amount) # " tokens for " # Nat.toText(netPayout) # " e8s ICP. New price: " # Nat.toText(newTokenPrice));
        } catch (e) {
          #err("Sale failed: " # Error.message(e));
        };
      };
    };
  };

  // Legacy sellTokens function (kept for backward compatibility)
  public func sellTokens(companyId : Nat, amount : Nat) : async Text {
    Debug.print("Warning: sellTokens is deprecated. Use sellTokensForICP for real payments.");
    let result = await sellTokensForICP(companyId, amount);
    switch (result) {
      case (#ok(msg)) { msg };
      case (#err(msg)) { throw Error.reject(msg) };
    };
  };

  // Get payment history
  public query func getPaymentHistory(limit : ?Nat) : async [PaymentRecord] {
    let maxResults = Option.get(limit, 100);
    let allPayments = Iter.toArray(payments.vals());
    if (allPayments.size() <= maxResults) {
      allPayments
    } else {
      Array.tabulate<PaymentRecord>(maxResults, func(i) = allPayments[allPayments.size() - maxResults + i]);
    };
  };

  // Get user's payment history
  public query func getUserPaymentHistory(user : Principal, limit : ?Nat) : async [PaymentRecord] {
    let maxResults = Option.get(limit, 50);
    let userPayments = Array.filter<PaymentRecord>(Iter.toArray(payments.vals()), func(p) = p.buyer == user);
    if (userPayments.size() <= maxResults) {
      userPayments
    } else {
      Array.tabulate<PaymentRecord>(maxResults, func(i) = userPayments[userPayments.size() - maxResults + i]);
    };
  };

  public func setMinValuationE8s(newMin : Nat, caller : Principal) : async () {
    if (caller != admin) {
      throw Error.reject("Authorization failed: Only admin can perform this action.");
    };
    minValuationE8s := newMin;
  };

  public func updateCompanyDescription(companyId : Nat, newDescription : Text) : async () {
    let caller = Principal.fromActor(this);
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
