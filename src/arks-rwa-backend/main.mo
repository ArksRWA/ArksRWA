import Nat "mo:base/Nat";
import Text "mo:base/Text";
import Principal "mo:base/Principal";
import Error "mo:base/Error";
import Array "mo:base/Array";
import Float "mo:base/Float";
import Int "mo:base/Int";
import Debug "mo:base/Debug";
import Option "mo:base/Option";
import Time "mo:base/Time";
import Nat64 "mo:base/Nat64";

actor class ARKSRWA() = this {

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

    // 📦 New metadata fields
    logo_url : Text;
    description : Text;
    created_at : Nat;
  };

  type TokenHolder = {
    companyId : Nat;
    investor : Principal;
    amount : Nat;
  };

  type TransferArgs = {
  from_subaccount : ?[Nat8];
  to : Principal;
  to_subaccount : ?[Nat8];
  amount : Nat;
  fee : ?Nat;
  memo : ?Blob;
  created_at_time : ?Nat64;
};

type TransferError = {
  #InsufficientFunds;
  #InvalidToken;
  #Rejected : Text;
  #TooOld;
#BadFee : Nat;
  #Other : Text;
};

type TransferResult = {
  #Ok : Nat;
  #Err : TransferError;
};

type TransferLog = {
  companyId : Nat;
  from : Principal;
  to : Principal;
  amount : Nat;
  fee : Nat;
  memo : ?Blob;
  timestamp : Nat64;
};


  var companies : [Company] = [];
  var companyCount : Nat = 0;
  var holders : [TokenHolder] = [];
  var minValuationE8s : Nat = 10_000_000;
  var transferLogs : [TransferLog] = [];
  let TRANSFER_FEE : Nat = 10_000; // e.g. 0.0001 ICP
  let MAX_TIME_DIFF : Nat64 = 300_000_000_000; // 5 minutes in nanoseconds


  // Create company with valuation + either supply or price
  // The valuation is in ICP
  public func createCompany(
    name : Text,
    symbol : Text,
    logo_url : Text,
    description : Text,
    valuation : Nat,
    desiredSupply : ?Nat,
    desiredPrice : ?Nat
  ) : async Nat {
    let caller = Principal.fromActor(this);
    let created_at = Int.abs(Time.now());

    if (valuation == 0) {
      throw Error.reject("Valuation must be greater than 0");
    };
    if (valuation < getMinValuationE8s()) {
      throw Error.reject(
        "Valuation too low. Minimum required is " # Nat.toText(getMinValuationE8s()) # " e8s or " # formatE8sToICPString(getMinValuationE8s()) # " ICP"
      );
    };
    if (Text.size(symbol) < 3 or Text.size(symbol) > 5) {
      throw Error.reject("Symbol must be between 3 and 5 characters long");
    };
    if (Array.find<Company>(companies, func (c) = c.symbol == symbol) != null) {
      throw Error.reject("Symbol already used by another company");
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
      symbol = symbol;
      owner = caller;
      valuation = valuation;
      base_price = token_price;
      token_price = token_price;
      supply = supply;
      remaining = supply;
      minimum_purchase = minimum_purchase;
      logo_url = logo_url;
      description = description;
      created_at = created_at;
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
      symbol = company.symbol;
      owner = company.owner;
      valuation = company.valuation;
      base_price = company.base_price;
      token_price = newTokenPrice;
      supply = company.supply;
      remaining = updatedRemaining;
      minimum_purchase = company.minimum_purchase;

      logo_url = company.logo_url;
      description = company.description;
      created_at = company.created_at;
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
        symbol = company.symbol;
        owner = company.owner;
        valuation = company.valuation;
        base_price = company.base_price;
        token_price = newTokenPrice;
        supply = company.supply;
        remaining = updatedRemaining;
        minimum_purchase = company.minimum_purchase;
        logo_url = company.logo_url;
        description = company.description;
        created_at = company.created_at;
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

// Get full token name
public query func icrc1_name(companyId: Nat) : async Text {
  if (companyId >= companies.size()) {
    return "Unknown Company";
  };
  return companies[companyId].name;
};

// Get token symbol
public query func icrc1_symbol(companyId: Nat) : async Text {
  if (companyId >= companies.size()) {
    return "N/A";
  };
  return companies[companyId].symbol;
};

// Get decimals (we assume 8 decimals like ICP)
public query func icrc1_decimals(companyId: Nat) : async Nat8 {
  if (companyId >= companies.size()) {
    return 8;
  };
  return 8; // Or customize per token in the future
};

// Get total supply
public query func icrc1_total_supply(companyId: Nat) : async Nat {
  if (companyId >= companies.size()) {
    return 0;
  };
  return companies[companyId].supply;
};

// Get user's balance
public query func icrc1_balance_of(companyId: Nat, user: Principal) : async Nat {
  if (companyId >= companies.size()) {
    return 0;
  };

  let result = Array.find<TokenHolder>(
    holders,
    func(h) {
      h.companyId == companyId and h.investor == user
    }
  );

  switch (result) {
    case (?holder) { holder.amount };
    case null { 0 };
  }
};
public query func getCompanyMetadata(companyId: Nat) : async {
  name : Text;
  symbol : Text;
  logo_url : Text;
  description : Text;
  created_at : Nat;
} {
  if (companyId >= companies.size()) {
    return {
      name = "Unknown";
      symbol = "N/A";
      logo_url = "";
      description = "";
      created_at = 0;
    };
  };

  let c = companies[companyId];
  return {
    name = c.name;
    symbol = c.symbol;
    logo_url = c.logo_url;
    description = c.description;
    created_at = c.created_at;
  };
};

public func icrc1_transfer(companyId: Nat, args: TransferArgs) : async TransferResult {
  let caller = Principal.fromActor(this);

  if (companyId >= companies.size()) {
    return #Err(#InvalidToken);
  };

  if (args.amount == 0) {
    return #Err(#Rejected("Transfer amount must be greater than 0"));
  };

  // Fee validation
  let expectedFee = TRANSFER_FEE;
  let providedFee = Option.get(args.fee, 0);
  if (providedFee < expectedFee) {
    return #Err(#BadFee(expectedFee));
  };

  // Timestamp validation
  switch (args.created_at_time) {
    case (?ts) {
      let nowInt = Time.now();
      if (nowInt < 0) {
        return #Err(#Rejected("Invalid system time"));
      };
      let now : Nat64 = Nat64.fromIntWrap(nowInt);
      if (now - ts > MAX_TIME_DIFF) {
        return #Err(#TooOld);
      };
    };
    case null {
      return #Err(#Rejected("Missing created_at_time"));
    };
  };

  // Check sender's balance
  let senderHolding = Array.find<TokenHolder>(
    holders,
    func(h) { h.companyId == companyId and h.investor == caller }
  );

  switch (senderHolding) {
    case null {
      return #Err(#InsufficientFunds);
    };
    case (?h) {
      let total = args.amount + expectedFee;
      if (h.amount < total) {
        return #Err(#InsufficientFunds);
      };

      // Subtract from sender
      holders := Array.map<TokenHolder, TokenHolder>(
        holders,
        func (x) {
          if (x.companyId == companyId and x.investor == caller) {
            { x with amount = x.amount - total }
          } else x
        }
      );

      // Remove if 0
      holders := Array.filter<TokenHolder>(
        holders,
        func (x) {
          not (x.companyId == companyId and x.investor == caller and x.amount == 0)
        }
      );

      // Add to recipient
      let recipient = args.to;
      let recipientHolding = Array.find<TokenHolder>(
        holders,
        func(h) { h.companyId == companyId and h.investor == recipient }
      );

      switch (recipientHolding) {
        case null {
          holders := Array.append(holders, [{
            companyId = companyId;
            investor = recipient;
            amount = args.amount;
          }]);
        };
        case (?r) {
          holders := Array.map<TokenHolder, TokenHolder>(
            holders,
            func (x) {
              if (x.companyId == companyId and x.investor == recipient) {
                { x with amount = x.amount + args.amount }
              } else x
            }
          );
        };
      };

      // Log transfer
      let log : TransferLog = {
        companyId = companyId;
        from = caller;
        to = recipient;
        amount = args.amount;
        fee = expectedFee;
        memo = args.memo;
        timestamp = Option.get<Nat64>(args.created_at_time, 0 : Nat64);
      };
      transferLogs := Array.append(transferLogs, [log]);

      return #Ok(args.amount);
    };
  };
};

public query func listTransfers() : async [TransferLog] {
  transferLogs
};

public query func getCompanyById(companyId: Nat) : async ?Company {
  if (companyId >= companies.size()) {
    return null;
  };
  return ?companies[companyId];
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
