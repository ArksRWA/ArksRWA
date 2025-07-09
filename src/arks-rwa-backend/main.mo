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

actor class ARKSRWA() = this {

  // dfx identity get-principal
  let admin : Principal = Principal.fromText("o6dtt-od7eq-p5tmn-yilm3-4v453-v64p5-ep4q6-hxoeq-jhygx-u5dz7-aqe");

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

  public func buyTokens(companyId : Nat, amount : Nat) : async Text {
    let caller = Principal.fromActor(this);

    let company = switch (companies.get(companyId)) {
      case (?c) { c };
      case (null) { throw Error.reject("Invalid company ID") };
    };

    if (company.remaining < amount) {
      throw Error.reject("Not enough tokens available");
    };

    let updatedRemaining = company.remaining - amount;
    let sold = company.supply - updatedRemaining;
    let newPriceFloat = Float.fromInt(company.base_price) * (1.0 + Float.fromInt(sold) / Float.fromInt(company.supply));
    let newTokenPrice : Nat = Int.abs(Float.toInt(newPriceFloat));

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

  public func sellTokens(companyId : Nat, amount : Nat) : async Text {
    let caller = Principal.fromActor(this);
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
        let newPriceFloat = Float.fromInt(company.base_price) * (1.0 + Float.fromInt(sold) / Float.fromInt(company.supply));
        let newTokenPrice : Nat = Int.abs(Float.toInt(newPriceFloat));

        let updatedCompany : Company = {
          company with token_price = newTokenPrice;
          remaining = updatedRemaining;
        };
        companies.put(companyId, updatedCompany);

        return "Sold " # Nat.toText(amount) # " tokens. New price: " # Nat.toText(newTokenPrice);
      };
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
