import Nat         "mo:base/Nat";
import Nat64       "mo:base/Nat64";
import Text        "mo:base/Text";
import Time        "mo:base/Time";
import Principal   "mo:base/Principal";
import Array       "mo:base/Array";

import Types "./types";

persistent actor class IdentityVC(init_admin : ?Principal) = this {

  // ---------- Utils ----------
  transient func now64() : Nat64 = Nat64.fromIntWrap(Time.now());
  transient func issuer() : Principal = Principal.fromActor(this);
  transient func issuerDid() : Text = "did:icp:" # Principal.toText(issuer());

  // ---------- Admins & authorization ----------
  transient let defaultAdmin : Principal = switch (init_admin) {
    case (?p) p;
    case null Principal.fromActor(this);
  };

  var _admins : [Principal] = [];
  if (_admins.size() == 0) { _admins := [ defaultAdmin ] };

  private func isAdmin(p : Principal) : Bool {
    var i = 0;
    while (i < _admins.size()) { if (_admins[i] == p) return true; i += 1 };
    false
  };

  // who can issue/revoke (typically Core canister + ops)
  var _authorized : [Principal] = [ defaultAdmin ];

  public shared ({ caller }) func addAdmin(p : Principal) : async Bool {
    if (not isAdmin(caller)) return false;
    var i = 0; while (i < _admins.size()) { if (_admins[i] == p) return true; i += 1 };
    _admins := Array.append(_admins, [p]); true
  };

  public shared ({ caller }) func removeAdmin(p : Principal) : async Bool {
    if (not isAdmin(caller)) return false;
    var out : [Principal] = [];
    var i = 0; while (i < _admins.size()) { if (_admins[i] != p) out := Array.append(out, [_admins[i]]); i += 1 };
    _admins := out; true
  };

  public shared ({ caller }) func authorize(c : Principal) : async Bool {
    if (not isAdmin(caller)) return false;
    // no dup
    var i = 0; while (i < _authorized.size()) { if (_authorized[i] == c) return true; i += 1 };
    _authorized := Array.append(_authorized, [c]); true
  };

  public shared ({ caller }) func unauthorize(c : Principal) : async Bool {
    if (not isAdmin(caller)) return false;
    var out : [Principal] = [];
    var i = 0; while (i < _authorized.size()) { if (_authorized[i] != c) out := Array.append(out, [_authorized[i]]); i += 1 };
    _authorized := out; true
  };

  public query func listAdmins() : async [Principal] { _admins };
  public query func listAuthorized() : async [Principal] { _authorized };

  // ---------- Policy & signing config ----------
  var _policy : Types.Policy = {
    max_docs_per_company = 16;
    allow_company_add    = false;   // only Core/admin by default
    signing_mode         = #none;   // upgrade later to #tECDSA or #canisterSig
  };
  public query func getPolicy() : async Types.Policy { _policy };

  public shared ({ caller }) func setPolicy(p : Types.Policy) : async Bool {
    if (not isAdmin(caller)) return false; _policy := p; true
  };

  // Optional tECDSA configuration (when signing_mode = #tECDSA)
  var _ecdsa_key : ?Types.EcdsaKeyId = null;
  public shared ({ caller }) func setEcdsaKey(key : Types.EcdsaKeyId) : async Bool {
    if (not isAdmin(caller)) return false; _ecdsa_key := ?key; true
  };
  public query func getEcdsaKey() : async ?Types.EcdsaKeyId { _ecdsa_key };

  // ---------- Stable state ----------
  var _vc_seq : Nat64 = 0;

  var _vc_registrations : [Types.VCRegistration] = [];
  var _vc_valuations    : [Types.VCValuationUpdate] = [];

  // Company → doc pointers
  var _docs_by_company  : [(Types.CompanyId, [Types.DocPointer])] = [];

  // Ring-buffer audit log (latest N events)
  var _events : [Types.Event] = [];
  var _events_cap : Nat = 500;

  private func bumpSeq() : Nat64 { _vc_seq += 1; _vc_seq };

  // ---------- Doc helpers ----------
  private func getDocs(c : Types.CompanyId) : [Types.DocPointer] {
    var i = 0;
    while (i < _docs_by_company.size()) {
      if (_docs_by_company[i].0 == c) return _docs_by_company[i].1;
      i += 1;
    }; []
  };

  private func putDocs(c : Types.CompanyId, docs : [Types.DocPointer]) {
    var i = 0;
    let n = _docs_by_company.size();
    while (i < n) {
      if (_docs_by_company[i].0 == c) {
        let before = Array.subArray(_docs_by_company, 0, i);
        let after  = Array.subArray(_docs_by_company, i + 1, n - i - 1);
        _docs_by_company := Array.append(before, Array.append([ (c, docs) ], after));
        return;
      };
      i += 1;
    };
    _docs_by_company := Array.append(_docs_by_company, [ (c, docs) ]);
  };

  // ---------- Small utils ----------
  private func containsText(xs : [Text], x : Text) : Bool {
    var i = 0;
    while (i < xs.size()) { if (xs[i] == x) return true; i += 1 };
    false
  };

  private func toKeyValsReg(reg : Types.VCRegistration) : [(Text, Text)] {
    [
      ("company_name", reg.company_name),
      ("symbol", reg.symbol),
      ("init_valuation_usdt", Nat.toText(reg.init_valuation_usdt))
    ]
  };

  private func toKeyValsVal(v : Types.VCValuationUpdate) : [(Text, Text)] {
    [ ("new_valuation_usdt", Nat.toText(v.new_valuation_usdt)) ]
  };

  private func filterKeys(kvs : [(Text, Text)], allow : [Text]) : [(Text, Text)] {
    if (allow.size() == 0) return kvs;
    var out : [(Text, Text)] = [];
    var i = 0;
    while (i < kvs.size()) {
      let kv = kvs[i];
      if (containsText(allow, kv.0)) { out := Array.append(out, [kv]) };
      i += 1;
    };
    out
  };

  private func logEvent(e : Types.Event) {
    // bounded log
    let withE = Array.append(_events, [e]);
    _events := if (withE.size() > _events_cap)
      Array.subArray(withE, withE.size() - _events_cap, _events_cap)
    else withE;
  };

  // ---------- Public: doc pointers ----------
  // Replaces all pointers for `company` (idempotent by content equality)
  public shared ({ caller }) func setDocPointers(company : Types.CompanyId, docs : [Types.DocPointer]) : async {
    #ok : Nat; #err : Types.DocError
  } {
    // Only admin/authorized by default; allow company principals if policy says so.
    if (not isAdmin(caller) and not containsPrin(_authorized, caller) and not _policy.allow_company_add) {
      return #err(#Unauthorized);
    };
    if (docs.size() > _policy.max_docs_per_company) return #err(#TooManyDocs);

    // naive dedupe by (label,cid)
    var clean : [Types.DocPointer] = [];
    var i = 0;
    label outer while (i < docs.size()) {
      let d = docs[i];
      var j = 0;
      while (j < clean.size()) {
        if (clean[j].doc_label == d.doc_label and clean[j].cid == d.cid) { i += 1; continue outer };
        j += 1;
      };
      clean := Array.append(clean, [d]);
      i += 1;
    };

    putDocs(company, clean);
    logEvent(#DocsSet({ company = company; count = clean.size(); at = now64() }));
    #ok(clean.size())
  };

  private func containsPrin(xs : [Principal], x : Principal) : Bool {
    var i = 0; while (i < xs.size()) { if (xs[i] == x) return true; i += 1 }; false
  };

  public query func listDocPointers(company : Types.CompanyId) : async [Types.DocPointer] {
    getDocs(company)
  };

  // ---------- Issue VC: Registration ----------
  public shared ({ caller }) func issueRegistrationVc(args : {
    subject              : Types.CompanyId;
    company_name         : Text;
    symbol               : Text;
    init_valuation_usdt  : Nat;
    proof_hash           : ?Text;
    idem_key             : ?Text;     // optional idempotency token
  }) : async { #ok : Types.VCRegistration; #err : Types.IssueError } {
    if (not containsPrin(_authorized, caller) and not isAdmin(caller)) return #err(#Unauthorized);

    let vc_id = bumpSeq();
    let docSnap = getDocs(args.subject);
    if (docSnap.size() > _policy.max_docs_per_company) return #err(#TooManyDocs);

    let vc : Types.VCRegistration = {
      base = {
        vc_id; vc_type = #Registration; subject = args.subject;
        issuer = issuer(); issued_at = now64(); revoked = false;
        revoked_at = null; revocation_reason = null; proof_hash = args.proof_hash;
      };
      company_name = args.company_name;
      symbol = args.symbol;
      init_valuation_usdt = args.init_valuation_usdt;
      docs = docSnap;
    };

    _vc_registrations := Array.append(_vc_registrations, [vc]);
    logEvent(#IssuedReg(vc));
    #ok(vc)
  };

  // ---------- Issue VC: Valuation Update ----------
  public shared ({ caller }) func issueValuationVc(args : {
    subject             : Types.CompanyId;
    new_valuation_usdt  : Nat;
    proof_hash          : ?Text;
    idem_key            : ?Text;
  }) : async { #ok : Types.VCValuationUpdate; #err : Types.IssueError } {
    if (not containsPrin(_authorized, caller) and not isAdmin(caller)) return #err(#Unauthorized);

    let vc_id = bumpSeq();
    let vc : Types.VCValuationUpdate = {
      base = {
        vc_id; vc_type = #ValuationUpdate; subject = args.subject;
        issuer = issuer(); issued_at = now64(); revoked = false;
        revoked_at = null; revocation_reason = null; proof_hash = args.proof_hash;
      };
      new_valuation_usdt = args.new_valuation_usdt;
    };

    _vc_valuations := Array.append(_vc_valuations, [vc]);
    logEvent(#IssuedVal(vc));
    #ok(vc)
  };

  // ---------- Revoke VC ----------
  public shared ({ caller }) func revoke(vc_id : Nat64, reason : ?Text)
    : async { #ok : Bool; #err : Types.RevokeError } {
    if (not containsPrin(_authorized, caller) and not isAdmin(caller)) return #err(#Unauthorized);

    // Registrations
    var i = 0;
    let nR = _vc_registrations.size();
    while (i < nR) {
      let cur = _vc_registrations[i];
      if (cur.base.vc_id == vc_id) {
        if (cur.base.revoked) return #ok(true);
        let updated = {
          base = {
            vc_id = cur.base.vc_id; vc_type = cur.base.vc_type; subject = cur.base.subject;
            issuer = cur.base.issuer; issued_at = cur.base.issued_at; revoked = true;
            revoked_at = ?now64(); revocation_reason = reason; proof_hash = cur.base.proof_hash;
          };
          company_name        = cur.company_name;
          symbol              = cur.symbol;
          init_valuation_usdt = cur.init_valuation_usdt;
          docs                = cur.docs;
        };
        let before = Array.subArray(_vc_registrations, 0, i);
        let after  = Array.subArray(_vc_registrations, i + 1, nR - i - 1);
        _vc_registrations := Array.append(before, Array.append([updated], after));
        logEvent(#Revoked({ vc_id; reason; at = now64() }));
        return #ok(true);
      };
      i += 1;
    };

    // Valuations
    var j = 0;
    let nV = _vc_valuations.size();
    while (j < nV) {
      let cur = _vc_valuations[j];
      if (cur.base.vc_id == vc_id) {
        if (cur.base.revoked) return #ok(true);
        let updated = {
          base = {
            vc_id = cur.base.vc_id; vc_type = cur.base.vc_type; subject = cur.base.subject;
            issuer = cur.base.issuer; issued_at = cur.base.issued_at; revoked = true;
            revoked_at = ?now64(); revocation_reason = reason; proof_hash = cur.base.proof_hash;
          };
          new_valuation_usdt = cur.new_valuation_usdt;
        };
        let before = Array.subArray(_vc_valuations, 0, j);
        let after  = Array.subArray(_vc_valuations, j + 1, nV - j - 1);
        _vc_valuations := Array.append(before, Array.append([updated], after));
        logEvent(#Revoked({ vc_id; reason; at = now64() }));
        return #ok(true);
      };
      j += 1;
    };

    #err(#NotFound)
  };

  // ---------- Present VC (selective disclosure + optional signature) ----------
  public query func presentVc(vc_id : Nat64, fields : [Text], audience : ?Principal, nonce : ?Text, exp : ?Nat64)
    : async ?Types.Presentation {
    // find
    var i = 0;
    while (i < _vc_registrations.size()) {
      let reg = _vc_registrations[i];
      if (reg.base.vc_id == vc_id) {
        let filtered = filterKeys(toKeyValsReg(reg), fields);
        return ?{
          vc_id       = reg.base.vc_id;
          vc_type     = #Registration;
          subject     = reg.base.subject;
          disclosed   = filtered;
          issued_at   = reg.base.issued_at;
          issuer_did  = issuerDid();
          revoked     = reg.base.revoked;
          audience    = audience;
          nonce       = nonce;
          exp         = exp;
          signature   = { alg = "none"; public_key = null; sig = null };
        };
      };
      i += 1;
    };

    var j = 0;
    while (j < _vc_valuations.size()) {
      let v = _vc_valuations[j];
      if (v.base.vc_id == vc_id) {
        let filtered = filterKeys(toKeyValsVal(v), fields);
        return ?{
          vc_id       = v.base.vc_id;
          vc_type     = #ValuationUpdate;
          subject     = v.base.subject;
          disclosed   = filtered;
          issued_at   = v.base.issued_at;
          issuer_did  = issuerDid();
          revoked     = v.base.revoked;
          audience    = audience;
          nonce       = nonce;
          exp         = exp;
          signature   = { alg = "none"; public_key = null; sig = null };
        };
      };
      j += 1;
    };

    null
  };

  // If you later enable signing, add a shared method to sign the canonicalized
  // presentation payload using tECDSA or canister-signatures and fill Signature.

  // ---------- Lookups, listings, pagination ----------
  public query func getVc(vc_id : Nat64) : async ?(Types.VCType, Text) {
    // narrow string form (simple debugging/interop)
    var i = 0;
    while (i < _vc_registrations.size()) {
      let r = _vc_registrations[i];
      if (r.base.vc_id == vc_id) {
        return ?(#Registration,
          "VCRegistration{vc_id=" # Nat64.toText(r.base.vc_id)
            # ",company_name=" # r.company_name
            # ",symbol=" # r.symbol
            # ",valuation=" # Nat.toText(r.init_valuation_usdt)
            # ",revoked=" # (if (r.base.revoked) "true" else "false") # "}"
        );
      };
      i += 1;
    };
    var j = 0;
    while (j < _vc_valuations.size()) {
      let v = _vc_valuations[j];
      if (v.base.vc_id == vc_id) {
        return ?(#ValuationUpdate,
          "VCValuationUpdate{vc_id=" # Nat64.toText(v.base.vc_id)
            # ",valuation=" # Nat.toText(v.new_valuation_usdt)
            # ",revoked=" # (if (v.base.revoked) "true" else "false") # "}"
        );
      };
      j += 1;
    };
    null
  };

  public query func listCompanyVcIds(company : Types.CompanyId, start : Nat, limit : Nat)
    : async Types.Page<Nat64> {
    // single pass over both arrays with cursor
    var ids : [Nat64] = [];
    // collect all then slice – OK for MVP sizes; switch to streaming if large.
    var r = 0;
    while (r < _vc_registrations.size()) {
      if (_vc_registrations[r].base.subject == company) {
        ids := Array.append(ids, [ _vc_registrations[r].base.vc_id ]);
      };
      r += 1;
    };
    var v = 0;
    while (v < _vc_valuations.size()) {
      if (_vc_valuations[v].base.subject == company) {
        ids := Array.append(ids, [ _vc_valuations[v].base.vc_id ]);
      };
      v += 1;
    };

    let s = if (start < ids.size()) start else ids.size();
    let take = if (limit == 0) 1 else limit;
    let end = if (s + take < ids.size()) s + take else ids.size();
    let slice = Array.subArray(ids, s, end - s);
    let nxt = if (end < ids.size()) ?end else null;
    { items = slice; next = nxt }
  };

  public query func listRecentEvents(limit : Nat) : async [Types.Event] {
    let n = _events.size();
    if (limit == 0 or n == 0) return [];
    let take = if (limit < n) limit else n;
    Array.subArray(_events, n - take, take)
  };

  public query func getIssuerDid() : async Text { issuerDid() };

  // ---------- Upgrade hooks ----------
  system func preupgrade() {};
  system func postupgrade() {};
}