import Nat       "mo:base/Nat";
import Nat64     "mo:base/Nat64";
import Int       "mo:base/Int";
import Float     "mo:base/Float";
import Text      "mo:base/Text";
import Time      "mo:base/Time";
import Principal "mo:base/Principal";
import Error     "mo:base/Error";
import Iter      "mo:base/Iter";
import HashMap   "mo:base/HashMap";
import Hash      "mo:base/Hash";
import Array     "mo:base/Array";
import Buffer "mo:base/Buffer";
import Option "mo:base/Option";

import Types     "./types";

persistent actor class ARKSRWA_Core(init_admin : Principal) = this {

  // ---------- Utils ----------
  transient func natHash(n : Nat) : Hash.Hash { Text.hash(Nat.toText(n)) };
  transient func now64() : Nat64 { Nat64.fromIntWrap(Time.now()) };
  transient func safeSub(a : Nat, b : Nat) : Nat { if (a >= b) a - b else 0 };

  // ---------- Risk Engine Integration ----------
  // Risk engine integration removed - verification is now event-based
  // Risk engine monitors company registrations and triggers verification automatically

  // ---------- Admins ----------
  // Admin principal is required - no fallback or null handling needed
  transient let defaultAdmin : Principal = init_admin;

  var _admins : [Principal] = [];
  // one-time bootstrap
  if (_admins.size() == 0) {
    _admins := [ defaultAdmin, Principal.fromActor(this) ];
  };

  private func isAdmin(p : Principal) : Bool {
    var i = 0;
    while (i < _admins.size()) { if (_admins[i] == p) return true; i += 1 };
    false
  };

  public func addAdmin(p : Principal, caller : Principal) : async () {
    if (not isAdmin(caller)) { throw Error.reject("Only admin"); };
    // no duplicates
    var i = 0; while (i < _admins.size()) { if (_admins[i] == p) return; i += 1 };
    _admins := Array.append(_admins, [p]);
  };

  public func removeAdmin(p : Principal, caller : Principal) : async () {
    if (not isAdmin(caller)) { throw Error.reject("Only admin"); };
    var out : [Principal] = [];
    var i = 0; while (i < _admins.size()) { if (_admins[i] != p) { out := Array.append(out, [_admins[i]]) }; i += 1 };
    _admins := out;
  };

  public query func listAdmins() : async [Principal] { _admins };

  // ---------- Governance ----------
  var governance : Types.Governance = {
    min_valuation_e8s    = 10_000_000;
    freshness_days       = 30;
    allow_public_listing = true;
    fees_bips_primary    = 0;
    fees_bips_secondary  = 0;
    equity_pct_bips      = 300; // 3%
    withdraw_window_secs = 7 * 24 * 60 * 60;
    max_withdraw_bips    = 0;
    platform_treasury    = defaultAdmin;
  };

  public query func getGovernance() : async Types.Governance { governance };

  public func setGovernance(g : Types.Governance, caller : Principal) : async () {
    if (not isAdmin(caller)) { throw Error.reject("Only admin"); };
    governance := g;
  };

  public func rotateTreasury(newTreasury : Principal, caller : Principal) : async () {
    if (not isAdmin(caller)) { throw Error.reject("Only admin"); };
    governance := { governance with platform_treasury = newTreasury };
  };

  // Global platform pause (affects orchestrations; trading is on CompanyToken)
  var _platform_paused : Bool = false;
  public func pausePlatform(caller : Principal) : async () {
    if (not isAdmin(caller)) { throw Error.reject("Only admin"); }; _platform_paused := true;
  };
  public func unpausePlatform(caller : Principal) : async () {
    if (not isAdmin(caller)) { throw Error.reject("Only admin"); }; _platform_paused := false;
  };

  // ---------- Storage (no balances; those live in CompanyToken) ----------
  public type CompanyId = Types.CompanyId;
  public type Company   = Types.Company;

  // non-stable maps (snapshotted on upgrade)
  transient var companies : HashMap.HashMap<CompanyId, Company> =
    HashMap.HashMap(0, Nat.equal, natHash);

  // counters
  var companyCount : Nat = 0;

  // stable snapshots
  var _companies_kv : [(CompanyId, Company)] = [];

  // ---------- Price helpers (display-only; trading moved out) ----------
  transient let bondingCurveExponent : Float = 1.5;
  transient let defaultTokenPrice    : Nat   = 1_000_000;

  transient func powF(base : Float, exp : Float) : Float {
    if (base <= 0.0) 1.0
    else if (exp == 1.0) base
    else if (exp == 1.5) base * Float.sqrt(base)
    else if (exp == 2.0) base * base
    else base * base
  };

  // ---------- Company Registration ----------
  public func createCompany(
    name : Text,
    symbol : Text,
    logo_url : Text,
    description : Text,
    valuation : Nat,
    desiredSupply : ?Nat,
    desiredPrice : ?Nat,
    caller : Principal
  ) : async CompanyId {
    if (_platform_paused) { throw Error.reject("Platform is paused"); };
    
    // Check if caller already owns a company
    for (c in companies.vals()) {
      if (c.owner == caller) {
        throw Error.reject("User can only create one company");
      }
    };
    
    if (valuation < governance.min_valuation_e8s) { throw Error.reject("Valuation too low"); };
    if (Text.size(symbol) < 3 or Text.size(symbol) > 5) { throw Error.reject("Symbol must be 3–5 chars"); };

    // unique symbol
    for (c in companies.vals()) { if (c.symbol == symbol) { throw Error.reject("Symbol already used") } };

    // derive supply/price (display-only; the ledger will mint independently)
    var token_price : Nat = 0;
    var supply      : Nat = 0;
    switch (desiredSupply, desiredPrice) {
      case (?s, null) {
        if (s == 0) { throw Error.reject("Supply must be > 0") };
        supply := s;
        token_price := if (supply == 0) defaultTokenPrice else valuation / supply;
      };
      case (null, ?p) {
        if (p == 0) { throw Error.reject("Price must be > 0") };
        token_price := p;
        supply := if (token_price == 0) 1 else valuation / token_price;
      };
      case (null, null) {
        token_price := defaultTokenPrice;
        supply := if (token_price == 0) 1 else valuation / token_price;
      };
      case (?_, ?_) { throw Error.reject("Set either supply or price, not both"); };
    };

    let minTokens = if (supply < 5) 1 else 5;

    // equity allocation (platform)
    let equity_alloc  = supply * governance.equity_pct_bips / 10_000;
    let company_alloc = safeSub(supply, equity_alloc);

    let created_at = Int.abs(Time.now());

    let c : Company = {
      id               = companyCount;
      name             = name;
      symbol           = symbol;
      owner            = caller;
      logo_url         = logo_url;
      description      = description;

      valuation        = valuation;
      base_price       = token_price;
      token_price      = token_price;
      supply           = supply;
      remaining        = company_alloc;
      minimum_purchase = token_price * minTokens;

      created_at       = created_at;

      verification     = {
        state = #Registered; score = null; risk_label = #Caution;
        last_scored_at = null; next_due_at = null;
        explanation_hash = null; last_vc_registration = null; last_vc_valuation = null;
      };

      escrow           = { raised = 0; withdrawn = 0; cap_per_window = 0; next_window_at = null; status = #Open };

      treasury_account = governance.platform_treasury;

      token_canister_id = null;
      dex_pool_url      = null;
      listing_state     = #Private;
      trading_paused    = false;
    };

    companies.put(companyCount, c);
    let currentCompanyId = c.id;
    companyCount += 1;

    // Note: Verification is now handled automatically by the risk engine
    // which monitors company registrations and triggers verification jobs

    currentCompanyId
  };

  public func setTokenCanister(id : CompanyId, tokenCid : Principal, caller : Principal) : async () {
    // called by TokenFactory or admin after spawning CompanyToken (ICRC-1/2)
    if (not isAdmin(caller)) { throw Error.reject("Only admin"); };
    let c = switch (companies.get(id)) { case (?x) x; case null { throw Error.reject("Invalid company") } };
    companies.put(id, { c with token_canister_id = ?tokenCid });
  };

  public func listOnDex(id : CompanyId, pool_url : Text, caller : Principal) : async () {
    let c = switch (companies.get(id)) { case (?x) x; case null { throw Error.reject("Invalid company") } };
    if (caller != c.owner and not isAdmin(caller)) { throw Error.reject("Only owner/admin"); };
    if (not governance.allow_public_listing) { throw Error.reject("Public listing disabled"); };
    if (c.verification.state != #Verified) { throw Error.reject("Not verified"); };
    companies.put(id, { c with dex_pool_url = ?pool_url; listing_state = #PublicListed; trading_paused = false });
  };

  // ---------- Company updates & queries ----------
  public func updateDescription(id : CompanyId, newDesc : Text, caller : Principal) : async () {
    let c = switch (companies.get(id)) { case (?x) x; case null { throw Error.reject("Invalid company") } };
    if (caller != c.owner) { throw Error.reject("Only company owner"); };
    companies.put(id, { c with description = newDesc });
  };

  public query func getCompany(id : CompanyId) : async ?Company { companies.get(id) };

  public query func listCompanies() : async [Company] {
    Iter.toArray(companies.vals())
  };

  public query func getOwnedCompanies(owner : Principal) : async [Company] {
    let buffer = Buffer.Buffer<Company>(0);
    for (c in companies.vals()) {
      if (c.owner == owner) {
        buffer.add(c);
      }
    };
    Buffer.toArray(buffer)
  };


  public query func listCompanySummaries() : async [Types.CompanySummary] {
    var out : [Types.CompanySummary] = [];
    for ((cid, c) in companies.entries()) {
      out := Array.append(out, [{
        id = cid; name = c.name; symbol = c.symbol; owner = c.owner;
        listing_state = c.listing_state; risk_label = c.verification.risk_label;
        score = c.verification.score; token_canister_id = c.token_canister_id;
      }]);
    };
    out
  };

  // ---------- Admin company controls ----------
  public func pauseCompany(id : CompanyId, caller : Principal) : async () {
    if (not isAdmin(caller)) { throw Error.reject("Only admin"); };
    let c = switch (companies.get(id)) { case (?x) x; case null { throw Error.reject("Invalid company") } };
    companies.put(id, { c with trading_paused = true });
  };

  public func unpauseCompany(id : CompanyId, caller : Principal) : async () {
    if (not isAdmin(caller)) { throw Error.reject("Only admin"); };
    let c = switch (companies.get(id)) { case (?x) x; case null { throw Error.reject("Invalid company") } };
    companies.put(id, { c with trading_paused = false });
  };

  public func delistCompany(id : CompanyId, caller : Principal) : async () {
    if (not isAdmin(caller)) { throw Error.reject("Only admin"); };
    let c = switch (companies.get(id)) { case (?x) x; case null { throw Error.reject("Invalid company") } };
    companies.put(id, { c with listing_state = #Delisted; trading_paused = true });
  };

  public func relistCompany(id : CompanyId, caller : Principal) : async () {
    if (not isAdmin(caller)) { throw Error.reject("Only admin"); };
    let c = switch (companies.get(id)) { case (?x) x; case null { throw Error.reject("Invalid company") } };
    if (c.verification.state != #Verified) { throw Error.reject("Not verified"); };
    companies.put(id, { c with listing_state = #PublicListed; trading_paused = false });
  };

  // ---------- Verification / Risk ----------
  public query func getVerification(id : CompanyId) : async Types.VerificationProfile {
    switch (companies.get(id)) { case (?c) c.verification; case null { throw Error.reject("Invalid company") } }
  };

  // Webhook for risk engine to update verification results
  public func updateVerificationResult(
    companyId : CompanyId, 
    profile : Types.VerificationProfile,
    caller : Principal
  ) : async () {
    // Note: Authorization now handled by risk engine canister registration
    // Risk engine must be registered as authorized caller via admin functions
    if (not isAdmin(caller)) {
      throw Error.reject("Unauthorized verification update - caller must be registered risk engine"); 
    };
    
    let c = switch (companies.get(companyId)) {
      case (?x) x;
      case null { throw Error.reject("Invalid company") };
    };
    
    companies.put(companyId, { c with verification = profile });
  };

  public func setRiskProfile(id : CompanyId, profile : Types.VerificationProfile, caller : Principal) : async () {
    if (not isAdmin(caller)) { throw Error.reject("Only admin"); };
    let c = switch (companies.get(id)) { case (?x) x; case null { throw Error.reject("Invalid company") } };
    companies.put(id, { c with verification = profile });
  };

  public func markVerificationPending(id : CompanyId, caller : Principal) : async () {
    if (not isAdmin(caller)) { throw Error.reject("Only admin"); };
    let c = switch (companies.get(id)) { case (?x) x; case null { throw Error.reject("Invalid company") } };
    companies.put(id, { c with verification = { c.verification with state = #VerificationPending } });
  };

  // Admin function to mark company for manual verification
  public func retriggerVerification(id : CompanyId, priority : { #high; #normal; #low }, caller : Principal) : async ?Nat {
    if (not isAdmin(caller)) { throw Error.reject("Only admin"); };
    
    let c = switch (companies.get(id)) {
      case (?x) x;
      case null { throw Error.reject("Invalid company") };
    };
    
    // Mark as pending - risk engine will pick this up automatically
    companies.put(id, { c with verification = { c.verification with state = #VerificationPending }});
    
    // Return company ID as job identifier
    ?id;
  };

  // Admin function to batch mark multiple companies for verification
  public func batchRetriggerVerification(companyIds : [CompanyId], caller : Principal) : async [(?Nat)] {
    if (not isAdmin(caller)) { throw Error.reject("Only admin"); };
    
    var results : [(?Nat)] = [];
    for (id in companyIds.vals()) {
      try {
        let jobId = await retriggerVerification(id, #normal, caller);
        results := Array.append(results, [jobId]);
      } catch (error) {
        // Continue with other companies even if one fails
        results := Array.append(results, [null]);
      };
    };
    results;
  };

  public query func listDueForRescore(nowTs : Nat64, limit : Nat) : async [CompanyId] {
  let cap = if (limit == 0) 1 else limit;
  let buf = Buffer.Buffer<CompanyId>(cap);

  for ((cid, c) in companies.entries()) {
    switch (c.verification.next_due_at) {
      case (?t) {
        if (t <= nowTs and buf.size() < limit) {
          buf.add(cid);
          if (buf.size() == limit) return Buffer.toArray(buf);
        };
      };
      case null {};
    };
  };

  Buffer.toArray(buf);
};

  // ---------- Escrow policy (accounting only; funds live off-ledger or in a separate canister) ----------
  public func setEscrowPolicy(id : CompanyId, cap_per_window : Nat, caller : Principal) : async () {
    if (not isAdmin(caller)) { throw Error.reject("Only admin"); };
    let c = switch (companies.get(id)) { case (?x) x; case null { throw Error.reject("Invalid company") } };
    companies.put(id, { c with escrow = { c.escrow with cap_per_window = cap_per_window } });
  };

  public func requestWithdraw(id : CompanyId, amount : Nat, caller : Principal) : async () {
    let c = switch (companies.get(id)) { case (?x) x; case null { throw Error.reject("Invalid company") } };
    if (caller != c.owner) { throw Error.reject("Only company owner"); };
    if (c.escrow.status != #Open) { throw Error.reject("Escrow paused"); };

    let now = now64();
    switch (c.escrow.next_window_at) {
      case (?ts) { if (now < ts) { throw Error.reject("Window not open") } };
      case null {};
    };

    if (c.escrow.cap_per_window > 0 and amount > c.escrow.cap_per_window) {
      throw Error.reject("Exceeds cap_per_window");
    };

    if (governance.max_withdraw_bips > 0) {
      let maxAllowed = c.escrow.raised * governance.max_withdraw_bips / 10_000;
      if (c.escrow.withdrawn + amount > maxAllowed) { throw Error.reject("Exceeds max withdrawals"); };
    };

    let e = c.escrow;
    let ne : Types.Escrow = {
      raised = e.raised;
      withdrawn = e.withdrawn + amount;
      cap_per_window = e.cap_per_window;
      next_window_at = ?(now + governance.withdraw_window_secs);
      status = e.status;
    };
    companies.put(id, { c with escrow = ne });
  };

// =====================================================================
// 1) HOLDINGS INDEX (not the source of truth; updated by token canisters)
// =====================================================================

// In‑memory index: Principal -> (CompanyId -> balance)
transient var _holdingsIndex : HashMap.HashMap<Principal, HashMap.HashMap<Types.CompanyId, Nat>> =
  HashMap.HashMap(0, Principal.equal, Principal.hash);

// Stable snapshot for upgrades
stable var _holdings_kv : [(Principal, [(Types.CompanyId, Nat)])] = [];

// Small helpers to read/write an inner map
private func getInner(p : Principal) : HashMap.HashMap<Types.CompanyId, Nat> {
  Option.get(_holdingsIndex.get(p), HashMap.HashMap<Types.CompanyId, Nat>(0, Nat.equal, natHash))
};

private func putInner(p : Principal, m : HashMap.HashMap<Types.CompanyId, Nat>) {
  _holdingsIndex.put(p, m)
};

// ======================================================
// 2) PUBLIC QUERY: list holdings & “my” holding (classic)
// ======================================================

public query func list_holdings() : async [Types.TokenHolder] {
  var out : [Types.TokenHolder] = [];
  for ((investor, inner) in _holdingsIndex.entries()) {
    for ((cid, amt) in inner.entries()) {
      if (amt > 0) {
        out := Array.append(out, [{
          companyId = cid;
          investor  = investor;
          amount    = amt
        }]);
      }
    }
  };
  out
};

public query func get_my_holding(companyId : Types.CompanyId, caller : Principal) : async Nat {
  switch (_holdingsIndex.get(caller)) {
    case null 0;
    case (?m) Option.get(m.get(companyId), 0);
  }
};

// ==================================================================
// 3) VERIFIED HOOK: token calls this after each transfer/mint/burn
// ==================================================================
//
// CompanyToken MUST call this once it has successfully applied the
// balance change. We verify the caller is the registered token canister
// of that company. This follows the usual Motoko `shared ({ caller })`
// pattern for authentication.  [oai_citation:2‡Internet Computer](https://internetcomputer.org/docs/motoko/fundamentals/types/functions?utm_source=chatgpt.com)
//
public shared ({ caller }) func on_token_transfer(args : {
  companyId : Types.CompanyId;
  from      : ?Principal;   // null for mint
  to        : ?Principal;   // null for burn
  amount    : Nat;
}) : async () {
  // 1) read company & its registered token canister
  let c = switch (companies.get(args.companyId)) {
    case (?x) x;
    case null { throw Error.reject("Unknown companyId") };
  };

  let tokenCid = switch (c.token_canister_id) {
    case (?pid) pid;
    case null { throw Error.reject("No token canister registered for this company") };
  };

  // 2) authenticate: only that token canister may report transfers
  if (caller != tokenCid) { throw Error.reject("Unauthorized token hook caller") };

  // 3) update index
  if (args.amount == 0) { return };

  // subtract from `from`
  switch (args.from) {
    case (?fp) {
      let inner = getInner(fp);
      let cur   = Option.get(inner.get(args.companyId), 0);
      let next  = safeSub(cur, args.amount);
      if (next == 0) { let _ = inner.remove(args.companyId) } else { inner.put(args.companyId, next) };
      if (inner.size() == 0) { let _ = _holdingsIndex.remove(fp) } else { putInner(fp, inner) };
    };
    case null {}; // mint
  };

  // add to `to`
  switch (args.to) {
    case (?tp) {
      let inner = getInner(tp);
      let cur   = Option.get(inner.get(args.companyId), 0);
      inner.put(args.companyId, cur + args.amount);
      putInner(tp, inner);
    };
    case null {
      // burn case: nothing to add
    };
  };
};

  // ---------- Upgrades: snapshot HashMaps to stable arrays ----------
system func preupgrade() {
  // 1) Companies -> stable array
  var accCompanies : [(CompanyId, Company)] = [];
  for ((id, c) in companies.entries()) {
    accCompanies := Array.append(accCompanies, [(id, c)]);
  };
  _companies_kv := accCompanies;

  // 2) Holdings index -> stable (Principal, [(CompanyId, Nat)])
  var accHoldings : [(Principal, [(Types.CompanyId, Nat)])] = [];
  for ((p, inner) in _holdingsIndex.entries()) {
    var rows : [(Types.CompanyId, Nat)] = [];
    for ((cid, amt) in inner.entries()) {
      rows := Array.append(rows, [(cid, amt)]);
    };
    accHoldings := Array.append(accHoldings, [(p, rows)]);
  };
  _holdings_kv := accHoldings;
};

system func postupgrade() {
  // 1) Restore companies HashMap
  companies := HashMap.HashMap<CompanyId, Company>(0, Nat.equal, natHash);
  var i = 0;
  while (i < _companies_kv.size()) {
    let kv = _companies_kv[i];
    companies.put(kv.0, kv.1);
    i += 1;
  };
  _companies_kv := [];

  // 2) Restore holdings index HashMap
  _holdingsIndex := HashMap.HashMap<Principal, HashMap.HashMap<Types.CompanyId, Nat>>(
    0, Principal.equal, Principal.hash
  );
  var j = 0;
  while (j < _holdings_kv.size()) {
    let p   = _holdings_kv[j].0;
    let arr = _holdings_kv[j].1;

    let inner = HashMap.HashMap<Types.CompanyId, Nat>(0, Nat.equal, natHash);
    var k = 0;
    while (k < arr.size()) {
      inner.put(arr[k].0, arr[k].1);
      k += 1;
    };

    _holdingsIndex.put(p, inner);
    j += 1;
  };
  _holdings_kv := [];
};
}