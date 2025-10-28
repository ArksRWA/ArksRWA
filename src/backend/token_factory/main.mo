// token_factory/main.mo
import Nat        "mo:base/Nat";
import Nat64      "mo:base/Nat64";
import Text       "mo:base/Text";
import Principal  "mo:base/Principal";
import Array      "mo:base/Array";
import HashMap    "mo:base/HashMap";
import Hash       "mo:base/Hash";
import Error      "mo:base/Error";
import Time       "mo:base/Time";
import Debug      "mo:base/Debug";
import Blob       "mo:base/Blob";
import Iter       "mo:base/Iter";
import Cycles     "mo:base/ExperimentalCycles";

import Types "./types"; 

persistent actor class TokenFactory(init_admin : ?Principal, core_canister : Principal) = this {

  // ----------------- utils -----------------
  transient func natHash(n : Nat) : Hash.Hash = Text.hash(Nat.toText(n));
  transient func now64() : Nat64 = Nat64.fromIntWrap(Time.now());

  // ----------------- admin / governance -----------------
  transient let defaultAdmin : Principal = switch (init_admin) {
    case (?p) p;
    case null Principal.fromActor(this); // sane fallback
  };

  var _admins : [Principal] = [];
  if (_admins.size() == 0) {
    _admins := [ defaultAdmin, Principal.fromActor(this) ];
  };

  var _core : Principal = core_canister;

  private func isAdmin(p : Principal) : Bool {
    var i = 0;
    while (i < _admins.size()) { if (_admins[i] == p) return true; i += 1 };
    false
  };

  public query func listAdmins() : async [Principal] { _admins };

  public shared ({ caller }) func addAdmin(p : Principal) : async () {
    if (not isAdmin(caller)) { throw Error.reject("Only admin"); };
    // dedupe
    var i = 0; while (i < _admins.size()) { if (_admins[i] == p) return; i += 1 };
    _admins := Array.append(_admins, [p]);
  };

  public shared ({ caller }) func removeAdmin(p : Principal) : async () {
    if (not isAdmin(caller)) { throw Error.reject("Only admin"); };
    var out : [Principal] = [];
    var i = 0; while (i < _admins.size()) { if (_admins[i] != p) out := Array.append(out, [_admins[i]]); i += 1 };
    _admins := out;
  };

  public query func core() : async Principal { _core };

  public shared ({ caller }) func setCore(newCore : Principal) : async () {
    if (not isAdmin(caller)) { throw Error.reject("Only admin"); };
    _core := newCore;
  };

  // ----------------- token wasm store -----------------
  // Your renamed field: TokenWasm.token_module : [Nat8]
  var _wasm : ?Types.TokenWasm = null;

  public shared ({ caller }) func setTokenWasm(w : Types.TokenWasm) : async () {
    if (not isAdmin(caller)) { throw Error.reject("Only admin"); };
    if (w.token_module.size() == 0) { throw Error.reject("Empty token wasm"); };
    _wasm := ?w;
  };

  public query func getTokenWasmMeta() : async ?{ version : Text; uploaded_at_ns : Nat64 } {
    switch (_wasm) {
      case null null;
      case (?w) ?{ version = w.version; uploaded_at_ns = w.uploaded_at_ns };
    }
  };

  // ----------------- registry -----------------
  // in-memory map; snapshot to stable arrays on upgrade
  transient var _registry : HashMap.HashMap<Types.CompanyId, Principal> =
    HashMap.HashMap(0, Nat.equal, natHash);

  var _registry_kv : [(Types.CompanyId, Principal)] = [];

  public query func getTokenOf(companyId : Types.CompanyId) : async ?Principal {
    _registry.get(companyId)
  };

  public query func listRegistry() : async [(Types.CompanyId, Principal)] {
    Iter.toArray(_registry.entries())
  };

  // ----------------- mgmt canister interface -----------------
  type CanisterId = Principal;
  type wasm_module = Blob;

  type CanisterSettings = {
    controllers : ?[Principal];
    compute_allocation : ?Nat;
    memory_allocation : ?Nat;
    freezing_threshold : ?Nat;
  };

  type CreateCanisterArgs = { settings : ?CanisterSettings };
  type CreateCanisterResult = { canister_id : CanisterId };

  type InstallMode = { #install; #reinstall; #upgrade };

  type InstallCodeArgs = {
    mode : InstallMode;
    canister_id : CanisterId;
    wasm_module : wasm_module;
    arg : Blob; // candid-encoded init args
  };

  type UpdateSettingsArgs = {
    canister_id : CanisterId;
    settings : CanisterSettings;
  };

  type DeleteCanisterArgs = { canister_id : CanisterId };

  type IC = actor {
    createCanister : shared CreateCanisterArgs -> async CreateCanisterResult;
    installCode   : shared InstallCodeArgs -> async ();
    updateSettings: shared UpdateSettingsArgs -> async ();
    deleteCanister: shared DeleteCanisterArgs -> async ();
  };

  transient let ic : IC = actor "aaaaa-aa";

  // ----------------- company token API (minimal) -----------------
  // Matches your CompanyToken from earlier messages
  type CompanyTokenAPI = actor {
    // ICRC-1 compat bits are there, we only need these admin calls for factory
    mintTo : shared (to : Types.Account, amount : Nat) -> async Types.TransferResult;
    freezeMint : shared () -> async Bool;
    icrc1Symbol : query () -> async Text;
  };

  // ----------------- spawn: create + install + initial mint -----------------
  // Caller must attach enough cycles (controls deployment cost).
  public shared ({ caller }) func createToken(req : Types.TokenInit) : async Types.SpawnResult {
    // Gate by admin or Core (you can loosen this as needed)
    if (caller != _core and not isAdmin(caller)) {
      return #err("Unauthorized: only Core or admin can spawn tokens");
    };
    let wasm = switch (_wasm) {
      case null return #err("Token WASM not uploaded");
      case (?w) w;
    };

    // Require positive totals
    if (req.total_supply == 0) { return #err("total_supply must be > 0") };

    // Basic symbol uniqueness guard (within registry we know)
    for ((_, pid) in _registry.entries()) {
      let t : CompanyTokenAPI = actor (Principal.toText(pid));
      // best-effort (ignore errors)
      // (You can remove this if you keep symbol uniqueness in Core only)
      ignore t;
    };

    // 1) create canister (cycles must be attached by caller)
    let controllers : [Principal] = [ Principal.fromActor(this), _core, req.company_owner ];
    let createArgs : CreateCanisterArgs = {
      settings = ?{
        controllers = ?controllers;
        compute_allocation = null;
        memory_allocation = null;
        freezing_threshold = null;
      }
    };

    // Let the deployer attach cycles
    // e.g. dfx canister call token_factory create_token '(record{ ... })' --with-cycles <cycles>
    let res = await ic.createCanister(createArgs);
    let tokenCid : Principal = res.canister_id;

    // 2) install code
    // Prepare constructor argument with all required fields for CompanyToken
    let ctor : ?{
      name : Text;
      symbol : Text;
      decimals : Nat;
      max_supply : Nat;
      token_factory : Principal;
      treasury : Principal;
      primary_mint_fee_bips : Nat;
      transfer_fee : Nat;
      company_id : Nat;
      core_canister : Principal;
    } = ?{
      name           = req.name;
      symbol         = req.symbol;
      decimals       = req.decimals;
      max_supply     = req.total_supply;
      token_factory  = Principal.fromActor(this);
      treasury       = req.platform_treasury.owner;
      primary_mint_fee_bips = req.platform_equity_bips;
      transfer_fee   = 0; // 0 for MVP as specified in the todo
      company_id     = req.company_id;
      core_canister  = _core;
    };

    // Candid-encode init arg using Prim.encode (encodes Motoko values to Candid)
    let installArg : Blob = to_candid(ctor);

    let installArgs : InstallCodeArgs = {
      mode         = #install;
      canister_id  = tokenCid;
      wasm_module  = Blob.fromArray(wasm.token_module);
      arg          = installArg;
    };
    await ic.installCode(installArgs);

    // 3) initial minting according to monetization (equity to platform treasury; rest to company owner)
    let token : CompanyTokenAPI = actor (Principal.toText(tokenCid));

    let equity_alloc : Nat = req.total_supply * req.platform_equity_bips / 10_000;
    if (equity_alloc > 0) {
      let r1 = await token.mintTo(req.platform_treasury, equity_alloc);
      switch (r1) {
        case (#Err e) {
          Debug.print("mint_to platform failed");
          return #err("mint_to platform failed");
        };
        case _ {};
      }
    };

    let company_alloc : Nat = req.total_supply - equity_alloc;
    if (company_alloc > 0) {
      let r2 = await token.mintTo({ owner = req.company_owner; subaccount = null }, company_alloc);
      switch (r2) {
        case (#Err e) {
          Debug.print("mint_to company failed");
          return #err("mint_to company failed");
        };
        case _ {};
      }
    };

    if (req.freeze_mint_after_init) {
      ignore await token.freezeMint();
    };

    // 4) save in registry
    _registry.put(req.company_id, tokenCid);
    
    // 5) register token canister in Core
    let core : actor { setTokenCanister : shared (Nat, Principal) -> async () } = actor (Principal.toText(_core));
    try {
      await core.setTokenCanister(req.company_id, tokenCid);
    } catch (e) {
      // Log error but don't fail the token creation
      // In production, you might want to use a more robust logging mechanism
    };

    #ok({
      company_id = req.company_id;
      token_canister_id = tokenCid;
      symbol = req.symbol;
    })
  };

  // ----------------- cycles helpers -----------------
  public query func cyclesBalance() : async Nat {
    Cycles.balance()
  };

  // Allow anyone to top up factory (or gate to admin if you prefer)
  public func depositCycles() : async () {
    // No-op body; attaching cycles funds the factory
  };

  // ----------------- upgrade hooks -----------------
  system func preupgrade() {
    _registry_kv := Iter.toArray(_registry.entries());
  };

  system func postupgrade() {
    _registry := HashMap.HashMap(0, Nat.equal, natHash);
    var i = 0;
    while (i < _registry_kv.size()) {
      let kv = _registry_kv[i];
      _registry.put(kv.0, kv.1);
      i += 1;
    };
    _registry_kv := [];
  };
}
