import Nat       "mo:base/Nat";
import Nat64     "mo:base/Nat64";
import Principal "mo:base/Principal";
import Text      "mo:base/Text";
import Float "mo:base/Float";

module {
// ---------- Core enums ----------

public type VerificationState = {
  #Registered;
  #VerificationPending;
  #Verified;
  #NeedsUpdate;
  #Rejected;
  #Failed;
};

public type RiskLabel = {
  #Trusted;
  #Caution;
  #HighRisk;
};

// ---------- Core records ----------

public type VerificationProfile = {
  state : VerificationState;
  score : ?Float;                         // 0..100, null if verification incomplete
  risk_label : RiskLabel;               // renamed from label → risk_label
  last_scored_at : ?Nat64;
  next_due_at : ?Nat64;                 // when to re-score
  explanation_hash : ?Text;             // off-chain explainer hash/CID
  last_vc_registration : ?Nat64;        // snapshot of VC ids or timestamps
  last_vc_valuation : ?Nat64;
};

public type EscrowStatus = { #Open; #Paused };

public type Escrow = {
  raised : Nat;               // total gross proceeds (e.g., USDT e8s)
  withdrawn : Nat;            // cumulative withdrawn by company
  cap_per_window : Nat;       // admin policy
  next_window_at : ?Nat64;    // when next withdrawal is allowed
  status : EscrowStatus;
};

public type ListingState = { #Private; #PublicListed; #Delisted };

public type CompanyId = Nat;

public type Company = {
  // identity & presentation
  id : CompanyId;
  name : Text;
  symbol : Text;
  owner : Principal;
  logo_url : Text;
  description : Text;

  // economics (for display only; pricing/ledger live in CompanyToken)
  valuation : Nat;
  base_price : Nat;
  token_price : Nat;
  supply : Nat;
  remaining : Nat;
  minimum_purchase : Nat;

  // lifecycle
  created_at : Nat;
  verification : VerificationProfile;
  escrow : Escrow;

  // governance hooks
  treasury_account : Principal;

  // integration points
  token_canister_id : ?Principal;
  dex_pool_url : ?Text;
  listing_state : ListingState;
  trading_paused : Bool;
};

// ---------- Governance ----------

public type Governance = {
  min_valuation_e8s : Nat;     // guards registration
  freshness_days : Nat;        // when risk profile stales out
  allow_public_listing : Bool; // policy toggle
  fees_bips_primary : Nat;
  fees_bips_secondary : Nat;
  equity_pct_bips : Nat;       // platform equity allocation on tokenization
  withdraw_window_secs : Nat64;
  max_withdraw_bips : Nat;     // optional safety cap
  platform_treasury : Principal;
};

// ---------- Small helpers (shape only) ----------

public type CompanySummary = {
  id : CompanyId;
  name : Text;
  symbol : Text;
  owner : Principal;
  listing_state : ListingState;
  risk_label : RiskLabel;
  score : ?Float;
  token_canister_id : ?Principal;
};

 // New: a lightweight view row for UIs/analytics
  public type TokenHolder = {
    companyId : CompanyId;
    investor  : Principal;
    amount    : Nat;
  };
}