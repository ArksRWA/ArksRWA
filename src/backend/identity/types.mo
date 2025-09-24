import Nat       "mo:base/Nat";
import Nat64     "mo:base/Nat64";
import Text      "mo:base/Text";
import Principal "mo:base/Principal";
import Blob      "mo:base/Blob";

module {
  public type CompanyId = Nat;

  // Off-chain doc pointer (CID/hash + optional encryption)
  public type DocPointer = {
    doc_label     : Text;
    cid       : Text;                  // e.g., IPFS CID or HTTPS URL
    mime      : Text;                  // e.g., "application/pdf"
    sha256    : ?Text;                 // hex/base64 of content hash (optional)
    enc_ref   : ?{ alg : Text; key_ref : Text }; // optional envelope info
  };

  // VC kinds we issue
  public type VCType = { #Registration; #ValuationUpdate };

  public type VCBase = {
    vc_id             : Nat64;
    vc_type           : VCType;
    subject           : CompanyId;
    issuer            : Principal;
    issued_at         : Nat64;
    revoked           : Bool;
    revoked_at        : ?Nat64;
    revocation_reason : ?Text;
    proof_hash        : ?Text; // hash of source docs or application form
  };

  public type VCRegistration = {
    base                 : VCBase;
    company_name         : Text;
    symbol               : Text;
    init_valuation_usdt  : Nat;
    docs                 : [DocPointer];
  };

  public type VCValuationUpdate = {
    base                 : VCBase;
    new_valuation_usdt   : Nat;
  };

  // Presentation + signature (optional)
  public type Signature = {
    alg        : Text;   // "ic-tECDSA-secp256k1" | "ic-canister-sig" | "none"
    public_key : ?Blob;  // for tECDSA; can be absent for canister-sig
    sig        : ?Blob;  // raw signature bytes, if available
  };

  public type Presentation = {
    vc_id       : Nat64;
    vc_type     : VCType;
    subject     : CompanyId;
    disclosed   : [(Text, Text)]; // flattened name/value pairs (selective)
    issued_at   : Nat64;
    issuer_did  : Text;           // did:icp:<canister-id>
    revoked     : Bool;
    audience    : ?Principal;     // who this proof is for
    nonce       : ?Text;          // anti-replay
    exp         : ?Nat64;         // optional expiry timestamp
    signature   : Signature;      // signature over canonical payload (if configured)
  };

  // Errors returned by the canister
  public type IssueError = {
    #Unauthorized;
    #TooManyDocs;
    #Duplicate;
    #InvalidArgs : Text;
    #Internal    : Text;
  };

  public type RevokeError = {
    #Unauthorized;
    #NotFound;
  };

  public type DocError = {
    #Unauthorized;
    #TooManyDocs;
    #Duplicate;
    #NotFound;
    #InvalidArgs : Text;
  };

  // Admin/config
  public type Policy = {
    max_docs_per_company : Nat;     // hard cap per company
    allow_company_add    : Bool;    // if true, company principals may add docs
    signing_mode         : { #none; #tECDSA; #canisterSig }; // how to sign presentations
  };

  // For ECDSA config (optional)
  public type EcdsaKeyId = {
    curve : { #secp256k1; #secp256r1 };
    name  : Text;  // typically "dfx_test_key" on local; "key_1" on mainnet
  };

  // Cursor pagination (simple)
  public type Page<T> = {
    items : [T];
    next  : ?Nat; // next start index
  };

  // Lightweight audit log
  public type Event =
    { #IssuedReg : VCRegistration } or
    { #IssuedVal : VCValuationUpdate } or
    { #Revoked   : { vc_id : Nat64; reason : ?Text; at : Nat64 } } or
    { #DocsSet   : { company : CompanyId; count : Nat; at : Nat64 } };

  // Narrow list item
  public type VCIndexItem = { vc_id : Nat64; vc_type : VCType; subject : CompanyId; issued_at : Nat64; revoked : Bool };
}