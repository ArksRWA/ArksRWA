import Array      "mo:base/Array";
import Nat        "mo:base/Nat";
import Nat64      "mo:base/Nat64";
import Principal  "mo:base/Principal";
import Text       "mo:base/Text";
import Time       "mo:base/Time";
import Option     "mo:base/Option";
import Types      "./types";

persistent actor class CompanyToken(init : Types.Init) = this {

  // ---------------- Stable metadata/config ----------------
  var _name : Text                 = init.name;
  var _symbol : Text               = init.symbol;
  var _decimals : Nat              = init.decimals;
  var _max_supply : Nat            = init.max_supply;

  // Admin & revenue
  var _factory : Principal         = init.token_factory;
  var _treasury : Principal        = init.treasury;
  var _primary_mint_fee_bips : Nat = init.primary_mint_fee_bips;
  var _transfer_fee : Nat          = init.transfer_fee; // ICRC-1 flat fee (default 0)

  // Supply / mint gate
  var _total : Nat = 0;
  var _mint_frozen : Bool = false;

  // Tx index counter (monotonic)
  var _next_tx_index : Nat = 0;

  // ---------------- Balances & Allowances (stable ALs) ----------------
  // Small, linear association lists (MVP). Replace with HashMaps if you need scale.
  var _balances : [(Types.Account, Nat)] = [];

  type Allow = { remaining : Nat; expires_at : ?Nat64 };
  type AllowKey = (Types.Account, Types.Account); // (owner, spender)
  var _allowances : [(AllowKey, Allow)] = [];

  // ---------------- Helpers: Account/Allow ops ----------------
  private func subEq(x : ?[Nat8], y : ?[Nat8]) : Bool {
    switch (x, y) {
      case (null, null) true;
      case (?a, ?b) {
        if (a.size() != b.size()) return false;
        var i = 0;
        while (i < a.size()) { if (a[i] != b[i]) return false; i += 1 };
        true
      };
      case _ false;
    }
  };

  private func accEq(a : Types.Account, b : Types.Account) : Bool {
    a.owner == b.owner and subEq(a.subaccount, b.subaccount)
  };

  private func getBal(a : Types.Account) : Nat {
    var i = 0;
    while (i < _balances.size()) {
      let e = _balances[i];
      if (accEq(e.0, a)) return e.1;
      i += 1;
    };
    0
  };

  private func setBal(a : Types.Account, n : Nat) {
    var i = 0;
    let len = _balances.size();
    while (i < len) {
      let e = _balances[i];
      if (accEq(e.0, a)) {
        let before = Array.subArray(_balances, 0, i);
        let after  = Array.subArray(_balances, i + 1, len - i - 1);
        _balances := if (n == 0)
          Array.append(before, after)
        else
          Array.append(before, Array.append([ (a, n) ], after));
        return;
      };
      i += 1;
    };
    if (n > 0) { _balances := Array.append(_balances, [ (a, n) ]) };
  };

  private func keyEq(k1 : AllowKey, k2 : AllowKey) : Bool {
    accEq(k1.0, k2.0) and accEq(k1.1, k2.1)
  };

  private func now64() : Nat64 { Nat64.fromIntWrap(Time.now()) };

  private func getAllow(k : AllowKey) : Allow {
    var i = 0;
    while (i < _allowances.size()) {
      let e = _allowances[i];
      if (keyEq(e.0, k)) {
        // prune if expired
        switch (e.1.expires_at) {
          case (?exp) { if (exp <= now64()) return { remaining = 0; expires_at = e.1.expires_at } };
          case null {};
        };
        return e.1;
      };
      i += 1;
    };
    { remaining = 0; expires_at = null }
  };

  private func setAllow(k : AllowKey, v : Allow) {
    var i = 0;
    let len = _allowances.size();
    while (i < len) {
      let e = _allowances[i];
      if (keyEq(e.0, k)) {
        // replace or delete
        let before = Array.subArray(_allowances, 0, i);
        let after  = Array.subArray(_allowances, i + 1, len - i - 1);
        _allowances := if (v.remaining == 0)
          Array.append(before, after)
        else
          Array.append(before, Array.append([ (k, v) ], after));
        return;
      };
      i += 1;
    };
    if (v.remaining > 0) { _allowances := Array.append(_allowances, [ (k, v) ]) };
  };

  private func bumpTx() : Nat { _next_tx_index += 1; _next_tx_index };

  // ---------------- ICRC-1: queries ----------------
  public query func icrc1Name() : async Text { _name };
  public query func icrc1Symbol() : async Text { _symbol };
  public query func icrc1Decimals() : async Nat { _decimals };
  public query func icrc1TotalSupply() : async Nat { _total };
  public query func icrc1Fee() : async Nat { _transfer_fee };

  public query func icrc1SupportedStandards() : async [{ name : Text; url : Text }] {
    [
      { name = "ICRC-1"; url = "https://github.com/dfinity/ICRC-1/tree/main/standards/ICRC-1" },
      { name = "ICRC-2"; url = "https://github.com/dfinity/ICRC-1/tree/main/standards/ICRC-2" }
    ]
  };

  public query func icrc1Metadata() : async [Types.Icrc1MetadataEntry] {
    [
      ("icrc1:name",     #Text(_name)),
      ("icrc1:symbol",   #Text(_symbol)),
      ("icrc1:decimals", #Nat(_decimals)),
      ("icrc1:fee",      #Nat(_transfer_fee))
    ]
  };

  public query func icrc1BalanceOf(a : Types.Account) : async Nat { getBal(a) };

  // ---------------- Core transfer ----------------
  private func do_transfer(from : Types.Account, to : Types.Account, amount : Nat, fee : Nat)
    : { #ok : Nat; #err : Types.TransferError } {

    // flat fee model (ICRC-1): sender pays fee to treasury
    let expected_fee = _transfer_fee;
    if (fee != expected_fee) {
      return #err(#BadFee({ expected_fee = expected_fee }));
    };

    let balFrom = getBal(from);
    let needed = amount + fee;
    if (balFrom < needed) {
      return #err(#InsufficientFunds({ balance = balFrom }));
    };

    // debit sender (amount + fee)
    let toTreasury : Types.Account = { owner = _treasury; subaccount = null };
    let balTo      = getBal(to);
    let balTreas   = getBal(toTreasury);

    setBal(from, balFrom - needed);
    setBal(to, balTo + amount);
    if (fee > 0) { setBal(toTreasury, balTreas + fee) };

    #ok(bumpTx())
  };

  // ---------------- ICRC-1: transfer ----------------
  public shared({ caller }) func icrc1Transfer(args : Types.TransferArgs) : async Types.TransferResult {
    let from : Types.Account = { owner = caller; subaccount = args.from_subaccount };
    switch (do_transfer(from, args.to, args.amount, Option.get(args.fee, _transfer_fee))) {
      case (#ok(idx))  { #Ok(idx) };
      case (#err(e))   { #Err(e) };
    }
  };

  // ---------------- ICRC-2: allowance/approve/transfer_from ----------------
  public query func icrc2Allowance(args : Types.AllowanceArgs) : async Types.Allowance {
    let a = getAllow((args.account, args.spender));
    { allowance = a.remaining; expires_at = a.expires_at }
  };

  public shared({ caller }) func icrc2Approve(args : Types.ApproveArgs) : async Types.ApproveResult {
    // spender must be a real account; avoid self-as-spender footgun per ecosystem guidance
    if (args.spender.owner == caller) {
      return #Err(#InvalidSpender);
    };

    // fee handling (ICRC-1 fee). Deduct from caller's account.
    let fromAcc : Types.Account = { owner = caller; subaccount = args.from_subaccount };
    let expected_fee = _transfer_fee;
    let fee = Option.get(args.fee, expected_fee);
    if (fee != expected_fee) {
      return #Err(#BadFee({ expected_fee }));
    };
    if (fee > 0) {
      let bal = getBal(fromAcc);
      if (bal < fee) {
        return #Err(#GenericError({ error_code = 402; message = "Insufficient tokens to pay approve fee" }));
      };
      // pay fee to treasury
      setBal(fromAcc, bal - fee);
      let tre = getBal({ owner = _treasury; subaccount = null });
      setBal({ owner = _treasury; subaccount = null }, tre + fee);
    };

    // expected_allowance check
    let cur = getAllow((fromAcc, args.spender));
    let curEff : Nat = switch (cur.expires_at) {
      case (?exp) { if (exp <= now64()) 0 else cur.remaining };
      case null   { cur.remaining };
    };
    switch (args.expected_allowance) {
      case (?expA) {
        if (expA != curEff) {
          return #Err(#AllowanceChanged({ current_allowance = curEff }));
        }
      };
      case null {};
    };

    // set/replace allowance
    setAllow((fromAcc, args.spender), { remaining = args.amount; expires_at = args.expires_at });

    #Ok(bumpTx())
  };

  public shared({ caller }) func icrc2TransferFrom(args : Types.TransferFromArgs) : async Types.TransferFromResult {
    let spender : Types.Account = { owner = caller; subaccount = args.spender_subaccount };
    let allowKey : AllowKey = (args.from, spender);
    let al = getAllow(allowKey);

    // expiration
    switch (al.expires_at) {
      case (?exp) { if (exp <= now64()) { return #Err(#Expired({ ledger_time = now64() })) } };
      case null {};
    };

    if (al.remaining < args.amount) {
      return #Err(#InsufficientAllowance({ allowance = al.remaining }));
    };

    // perform underlying transfer (owner pays fee)
    switch (do_transfer(args.from, args.to, args.amount, Option.get(args.fee, _transfer_fee))) {
      case (#err(e)) { return #Err(
        switch (e) {
          case (#BadFee(x))            #BadFee(x);
          case (#InsufficientFunds(x)) #InsufficientFunds(x);
          case (#TooOld)               #TooOld;
          case (#CreatedInFuture(x))   #CreatedInFuture(x);
          case (#Duplicate(x))         #Duplicate(x);
          case (#TemporarilyUnavailable) #TemporarilyUnavailable;
          case (#GenericError(x))      #GenericError(x);
        }
      ) };
      case (#ok(idx)) {
        // decrement allowance
        setAllow(allowKey, { remaining = al.remaining - args.amount; expires_at = al.expires_at });
        #Ok(idx)
      }
    }
  };

  // ---------------- Minting & admin ----------------
  public shared({ caller }) func mintTo(to : Types.Account, amount : Nat) : async Types.TransferResult {
    if (caller != _factory) {
      return #Err(#GenericError({ error_code = 403; message = "Not authorized" }));
    };
    if (_mint_frozen) {
      return #Err(#GenericError({ error_code = 423; message = "Minting frozen" }));
    };
    if (amount == 0) { return #Ok(_next_tx_index) };

    // revenue on primary issuance: mint fee to treasury
    let feeMint : Nat = (amount * _primary_mint_fee_bips) / 10_000;

    if (_total + amount + feeMint > _max_supply) {
      return #Err(#GenericError({ error_code = 400; message = "Exceeds max_supply" }));
    };

    // credit receiver
    let tb = getBal(to);
    setBal(to, tb + amount);

    // credit treasury with feeMint
    if (feeMint > 0) {
      let t = getBal({ owner = _treasury; subaccount = null });
      setBal({ owner = _treasury; subaccount = null }, t + feeMint);
    };

    _total += (amount + feeMint);
    #Ok(bumpTx())
  };

  public shared({ caller }) func burnFrom(from : Types.Account, amount : Nat) : async Types.TransferResult {
    if (caller != _factory) {
      return #Err(#GenericError({ error_code = 403; message = "Not authorized" }));
    };
    let b = getBal(from);
    if (b < amount) {
      return #Err(#InsufficientFunds({ balance = b }));
    };
    setBal(from, b - amount);
    _total -= amount;
    #Ok(bumpTx())
  };

  public shared({ caller }) func freezeMint() : async Bool {
    if (caller != _factory) return false;
    _mint_frozen := true;
    true
  };

  public shared({ caller }) func setTransferFee(newFee : Nat) : async Bool {
    if (caller != _factory) return false;
    _transfer_fee := newFee;
    true
  };

  public shared({ caller }) func setTreasury(newTreasury : Principal) : async Bool {
    if (caller != _factory) return false;
    _treasury := newTreasury;
    true
  };

  public shared({ caller }) func setPrimaryMintFeeBips(bips : Nat) : async Bool {
    if (caller != _factory) return false;
    _primary_mint_fee_bips := bips;
    true
  };

  // ---------------- Introspection helpers ----------------
  public query func holdersSnapshot(limit : Nat) : async [(Types.Account, Nat)] {
    let n = if (limit < _balances.size()) limit else _balances.size();
    Array.tabulate<(Types.Account, Nat)>(n, func(i : Nat) : (Types.Account, Nat) { _balances[i] })
  };

  public query func allowancesSnapshot(limit : Nat) : async [((Types.Account, Types.Account), { remaining : Nat; expires_at : ?Nat64 })] {
    let n = if (limit < _allowances.size()) limit else _allowances.size();
    Array.tabulate<((Types.Account, Types.Account), { remaining : Nat; expires_at : ?Nat64 })>(
      n, func(i : Nat) { _allowances[i] }
    )
  };

  // ---------------- Upgrade hooks ----------------
  system func preupgrade() {};
  system func postupgrade() {};
}