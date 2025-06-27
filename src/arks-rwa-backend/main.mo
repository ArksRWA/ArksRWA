import Nat "mo:base/Nat";
import Text "mo:base/Text";
import Principal "mo:base/Principal";
import Error "mo:base/Error";
import Array "mo:base/Array";
import Float "mo:base/Float";
import Int "mo:base/Int";
import Debug "mo:base/Debug";
import Option "mo:base/Option";

actor class ARKSRWA() = this {

  type Company = {
    id : Nat;
    name : Text;
    owner : Principal;
    valuation : Nat;
    base_price : Nat;
    token_price : Nat;
    supply : Nat;
    remaining : Nat;
    minimum_purchase : Nat;
  };

  type TokenHolder = {
    companyId : Nat;
    investor : Principal;
    amount : Nat;
  };

  var companies : [Company] = [];
  var companyCount : Nat = 0;
  var holders : [TokenHolder] = [];
var minValuationE8s : Nat = 10_000_000;

  // Create company with valuation + either supply or price
  // The valuation is in ICP
  public func createCompany(
    name : Text,
    valuation : Nat,
    desiredSupply : ?Nat,
    desiredPrice : ?Nat
  ) : async Nat {
    let caller = Principal.fromActor(this);

    if (valuation == 0) {
      throw Error.reject("Valuation must be greater than 0");
    };
    if (valuation < getMinValuationE8s()) {
      throw Error.reject(
        "Valuation too low. Minimum required is " # Nat.toText(getMinValuationE8s()) # " e8s or " # formatE8sToICPString(getMinValuationE8s()) # " ICP"
      );
    };
    var token_price : Nat = 0;
    var supply : Nat = 0;

    switch (desiredSupply, desiredPrice) {
      case (?supplyInput, null) {
        if (supplyInput == 0) {
          throw Error.reject("Supply must be greater than 0");
        };
        supply := supplyInput;
        token_price := valuation / supply;
      };
      case (null, ?priceInput) {
        if (priceInput == 0) {
          throw Error.reject("Token price must be greater than 0");
        };
        token_price := priceInput;
        supply := valuation / token_price;
      };
      case (null, null) {
        token_price := 1_000_000; // 0.01 ICP
        supply := valuation / token_price;
      };
      case (?_, ?_) {
        throw Error.reject("Only one of desiredSupply or desiredPrice should be set.");
      };
    };

    let minTokens : Nat = if (supply < 5) { 1 } else { 5 };
    let minimum_purchase = token_price * minTokens;

    let newCompany : Company = {
      id = companyCount;
      name = name;
      owner = caller;
      valuation = valuation;
      base_price = token_price;
      token_price = token_price;
      supply = supply;
      remaining = supply;
      minimum_purchase = minimum_purchase;
    };

    companies := Array.append(companies, [newCompany]);
    companyCount += 1;

    return supply;
  };

  // Query all companies
  public query func listCompanies() : async [Company] {
    return companies;
  };

  // Query all holders
  public query func listHoldings() : async [TokenHolder] {
    return holders;
  };

  public query func hasHolding(companyId: Nat) : async Bool {
  let caller = Principal.fromActor(this);
  let result = Array.find<TokenHolder>(
    holders,
    func (h) {
      h.companyId == companyId and h.investor == caller and h.amount > 0
    }
  );
  return Option.isSome(result);
};
public query func getMyHolding(companyId: Nat) : async Nat {
  let caller = Principal.fromActor(this);

  let result = Array.find<TokenHolder>(
    holders,
    func (h) {
      h.companyId == companyId and h.investor == caller
    }
  );

  switch (result) {
    case (?holder) { holder.amount };
    case null { 0 };
  }
};
  // Buy tokens
  public func buyTokens(companyId: Nat, amount: Nat) : async Text {
    let caller = Principal.fromActor(this);

    if (companyId >= companies.size()) {
      throw Error.reject("Invalid company ID");
    };

    let company = companies[companyId];
    let totalCost = company.token_price * amount;

    if (totalCost < company.minimum_purchase) {
      throw Error.reject("Amount too low. Minimum is " # Nat.toText(company.minimum_purchase) # ". Current total amount: " # Nat.toText(totalCost));
    };

    if (company.remaining < amount) {
      throw Error.reject("Not enough tokens available");
    };

    // Calculate remaining & bonding curve price
    let updatedRemaining = company.remaining - amount;
    let sold = company.supply - updatedRemaining;

    let newPriceFloat = Float.fromInt(company.base_price) * 
                        (1.0 + Float.fromInt(sold) / Float.fromInt(company.supply));

    let newTokenPrice : Nat = Int.abs(Float.toInt(newPriceFloat));

    // Update company
    let updatedCompany : Company = {
      id = company.id;
      name = company.name;
      owner = company.owner;
      valuation = company.valuation;
      base_price = company.base_price;
      token_price = newTokenPrice;
      supply = company.supply;
      remaining = updatedRemaining;
      minimum_purchase = company.minimum_purchase;
    };

    companies := updateAt<Company>(companies, companyId, updatedCompany);

    // Update investor holding
    let existing = Array.find<TokenHolder>(
      holders,
      func (h) { h.companyId == companyId and h.investor == caller }
    );

    switch (existing) {
      case (?holder) {
        holders := Array.map<TokenHolder, TokenHolder>(
  holders,
  func (h) {
    if (h.companyId == companyId and h.investor == caller) {
      { h with amount = h.amount + amount }
    } else h
  }
);

      };
      case null {
        holders := Array.append(holders, [{
          companyId = companyId;
          investor = caller;
          amount = amount;
        }]);
      };
    };

    return "Purchase successful. New price: " # Nat.toText(newTokenPrice);
  };
public func sellTokens(companyId: Nat, amount: Nat) : async Text {
  let caller = Principal.fromActor(this);

  if (companyId >= companies.size()) {
    throw Error.reject("Invalid company ID");
  };

  let company = companies[companyId];

  // Check if user holds enough
  let existing = Array.find<TokenHolder>(
    holders,
    func (h) { h.companyId == companyId and h.investor == caller }
  );

  switch (existing) {
    case (?holder) {
      if (holder.amount < amount) {
        throw Error.reject("Not enough tokens to sell");
      };

      let newAmount = holder.amount - amount;
      let updatedRemaining = company.remaining + amount;

      // Reverse bonding curve pricing (simple)
      let sold = company.supply - updatedRemaining;
      let newPriceFloat = Float.fromInt(company.base_price) * 
                          (1.0 + Float.fromInt(sold) / Float.fromInt(company.supply));
      let newTokenPrice : Nat = Int.abs(Float.toInt(newPriceFloat));

      // Update company
      let updatedCompany : Company = {
        id = company.id;
        name = company.name;
        owner = company.owner;
        valuation = company.valuation;
        base_price = company.base_price;
        token_price = newTokenPrice;
        supply = company.supply;
        remaining = updatedRemaining;
        minimum_purchase = company.minimum_purchase;
      };

      companies := updateAt<Company>(companies, companyId, updatedCompany);

      // Update holder
      if (newAmount == 0) {
        holders := Array.filter<TokenHolder>(
          holders,
          func(h) {
            not (h.companyId == companyId and h.investor == caller)
          }
        );
      } else {
        holders := Array.map<TokenHolder, TokenHolder>(
          holders,
          func(h) {
            if (h.companyId == companyId and h.investor == caller) {
              { h with amount = newAmount }
            } else h
          }
        );
      };

      return "Sold " # Nat.toText(amount) # " tokens. New price: " # Nat.toText(newTokenPrice);
    };
    case null {
      throw Error.reject("You do not own any tokens for this company");
    };
  };
};


func getMinValuationE8s() : Nat {
  minValuationE8s
};

public func setMinValuationE8s(newMin: Nat) : async () {
  // Add caller check here (e.g., only owner or DAO)
  minValuationE8s := newMin;
};
  // Helper: update array item by index
  func updateAt<T>(arr: [T], index: Nat, newItem: T) : [T] {
    if (index >= arr.size()) {
      Debug.trap("Index out of bounds");
    };
    Array.tabulate<T>(
      arr.size(),
       func(i : Nat) : T {
        if (i == index) {
          newItem
        } else {
          arr[i]
        }
      }
    )
  };
  
  func formatE8sToICPString(val: Nat) : Text {
  Float.format(#fix(2), Float.fromInt(val) / 100_000_000.0)
}
};
