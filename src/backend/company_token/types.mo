import Principal "mo:base/Principal";
import Blob "mo:base/Blob";
import Nat "mo:base/Nat";
import Nat64 "mo:base/Nat64";
import Text "mo:base/Text";

module {
  // ----- Shared types -----
  public type Subaccount = [Nat8];
  public type Account = { owner : Principal; subaccount : ?Subaccount };

  // ----- ICRC-1 -----
  public type TransferArgs = {
    from_subaccount : ?Subaccount;
    to : Account;
    amount : Nat;
    fee : ?Nat;
    memo : ?Blob;
    created_at_time : ?Nat64;
  };

  public type TransferError = {
    #BadFee : { expected_fee : Nat };
    #InsufficientFunds : { balance : Nat };
    #TooOld;
    #CreatedInFuture : { ledger_time : Nat64 };
    #Duplicate : { duplicate_of : Nat };
    #TemporarilyUnavailable;
    #GenericError : { error_code : Nat; message : Text };
  };

  public type TransferResult = { #Ok : Nat; #Err : TransferError };

  public type Icrc1MetadataValue = {
    #Nat : Nat;
    #Text : Text;
    #Blob : Blob;
  };
  public type Icrc1MetadataEntry = (Text, Icrc1MetadataValue);

  // ----- ICRC-2 -----
  public type ApproveArgs = {
    from_subaccount : ?Subaccount;
    spender : Account;
    amount : Nat;
    expected_allowance : ?Nat;
    expires_at : ?Nat64;
    fee : ?Nat;
    memo : ?Blob;
    created_at_time : ?Nat64;
  };

  public type ApproveError = {
    #BadFee : { expected_fee : Nat };
    #Expired : { ledger_time : Nat64 };
    #AllowanceChanged : { current_allowance : Nat };
    #TooOld;
    #CreatedInFuture : { ledger_time : Nat64 };
    #Duplicate : { duplicate_of : Nat };
    #TemporarilyUnavailable;
    #GenericError : { error_code : Nat; message : Text };
    #InvalidSpender;
  };

  public type ApproveResult = { #Ok : Nat; #Err : ApproveError };

  public type AllowanceArgs = { account : Account; spender : Account };
  public type Allowance = { allowance : Nat; expires_at : ?Nat64 };

  public type TransferFromArgs = {
    spender_subaccount : ?Subaccount;
    from : Account;
    to : Account;
    amount : Nat;
    fee : ?Nat;
    memo : ?Blob;
    created_at_time : ?Nat64;
  };

  public type TransferFromError = {
    #BadFee : { expected_fee : Nat };
    #InsufficientFunds : { balance : Nat };
    #InsufficientAllowance : { allowance : Nat };
    #Expired : { ledger_time : Nat64 };
    #TooOld;
    #CreatedInFuture : { ledger_time : Nat64 };
    #Duplicate : { duplicate_of : Nat };
    #TemporarilyUnavailable;
    #GenericError : { error_code : Nat; message : Text };
  };

  public type TransferFromResult = { #Ok : Nat; #Err : TransferFromError };

  // ----- Init/config -----
  public type Init = {
    name : Text;
    symbol : Text;
    decimals : Nat;
    max_supply : Nat;
    token_factory : Principal;     // admin/controller (e.g., your TokenFactory/Core)
    treasury : Principal;          // platform revenue wallet
    primary_mint_fee_bips : Nat;   // e.g., 300 = 3% minted to treasury on mint_to
    transfer_fee : Nat;            // flat per-transaction fee (ICRC-1 fee), typically 0 for DEXs
    company_id : Nat;              // ID of the company this token represents
    core_canister : Principal;     // Core canister principal for holdings updates
  };
}