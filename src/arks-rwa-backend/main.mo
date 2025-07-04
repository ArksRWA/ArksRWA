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

  let admin : Principal = Principal.fromText("aaaaa-aa"); // Placeholder, should replace this later !

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

  var companies : HashMap.HashMap<Nat, Company> = HashMap.HashMap(0, Nat.equal, Hash.hash);

  var holdings : HashMap.HashMap<Principal, HashMap.HashMap<Nat, Nat>> = HashMap.HashMap(0, Principal.equal, Principal.hash);

  var companyCount : Nat = 0;
  var minValuationE8s : Nat = 10_000_000;

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

  public func setMinValuationE8s(newMin : Nat) : async () {
    let caller = Principal.fromActor(this);
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

  public query func icrc1_balance_of(companyId : Nat, user : Principal) : async Nat {
    switch (holdings.get(user)) {
      case (null) { return 0 };
      case (?personalHoldings) {
        return Option.get(personalHoldings.get(companyId), 0);
      };
    };
  };
};
