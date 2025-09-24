// token_factory/types.mo
import Nat       "mo:base/Nat";
import Nat64     "mo:base/Nat64";
import Principal "mo:base/Principal";
import Text      "mo:base/Text";

module {
  public type CompanyId = Nat;

  public type Account = {
    owner : Principal;
    subaccount : ?[Nat8];
  };

  public type TransferError = {
    #BadFee : { expected_fee : Nat };
    #BadBurn : { min_burn_amount : Nat };
    #InsufficientFunds : { balance : Nat };
    #TooOld;
    #CreatedInFuture : { ledger_time : Nat64 };
    #Duplicate : { duplicate_of : Nat };
    #TemporarilyUnavailable;
    #GenericError : { error_code : Nat; message : Text };
  };

  public type TransferResult = { #Ok : Nat; #Err : TransferError };

  // Your renamed field
  public type TokenWasm = {
    version : Text;
    token_module : [Nat8];
    uploaded_at_ns : Nat64;
    notes : ?Text;
  };

  public type TokenInit = {
    company_id : CompanyId;
    // token meta
    name : Text;
    symbol : Text;
    decimals : Nat;
    total_supply : Nat;

    // monetization
    platform_equity_bips : Nat; // e.g. 300 = 3%
    platform_treasury : Account;

    // ownership
    company_owner : Principal;

    // policy
    freeze_mint_after_init : Bool;
  };

  public type SpawnOk = {
    company_id : CompanyId;
    token_canister_id : Principal;
    symbol : Text;
  };

  public type SpawnResult = { #ok : SpawnOk; #err : Text };
}