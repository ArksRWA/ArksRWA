import VerificationTypes "./types";

module {
    public type Company = {
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
    logo_url : Text;
    description : Text;
    created_at : Nat;

    // Verification fields
    verification_status : VerificationTypes.VerificationStatus;
    verification_score : ?Float;
    last_verified : ?Int;
    verification_job_id : ?Nat;
  };

  public type TokenHolder = {
    companyId : Nat;
    investor : Principal;
    amount : Nat;
  };

  public type AccountType = {
    #company;
    #user;
  };

  public type Account = {
    owner : Principal;
    subaccount : ?Blob;
  };

  public type TransferArgs = {
    from_subaccount : ?Blob;
    to : Account;
    amount : Nat;
    fee : ?Nat;
    memo : ?Blob;
    created_at_time : ?Nat64;
  };

  public type TransferResult = {
    #Ok : Nat;
    #Err : TransferError;
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
}