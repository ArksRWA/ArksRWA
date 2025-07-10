// Canister configuration for different environments
export const CANISTER_IDS = {
  local: {
    arks_rwa_backend: process.env.CANISTER_ID_ARKS_RWA_BACKEND || process.env.NEXT_PUBLIC_CANISTER_ID_ARKS_RWA_BACKEND || "vt46d-j7777-77774-qaagq-cai",
    internet_identity: process.env.CANISTER_ID_INTERNET_IDENTITY || process.env.NEXT_PUBLIC_CANISTER_ID_INTERNET_IDENTITY || "v56tl-sp777-77774-qaahq-cai",
    frontend: process.env.CANISTER_ID_FRONTEND || process.env.NEXT_PUBLIC_CANISTER_ID_FRONTEND || "v27v7-7x777-77774-qaaha-cai"
  },
  ic: {
    arks_rwa_backend: process.env.CANISTER_ID_ARKS_RWA_BACKEND || "",
    internet_identity: "rdmx6-jaaaa-aaaaa-aaadq-cai", // Official II canister
    frontend: process.env.CANISTER_ID_FRONTEND || ""
  }
};

export const NETWORK = process.env.NEXT_PUBLIC_DFX_NETWORK || "local";

export const HOST = NETWORK === "local" 
  ? "http://localhost:4943" 
  : "https://icp-api.io";

export const getCurrentCanisterIds = () => {
  return CANISTER_IDS[NETWORK as keyof typeof CANISTER_IDS] || CANISTER_IDS.local;
};

export const getCanisterId = (canisterName: keyof typeof CANISTER_IDS.local) => {
  const ids = getCurrentCanisterIds();
  return ids[canisterName];
};

// Environment helpers
export const isLocal = () => NETWORK === "local";
export const isProduction = () => NETWORK === "ic";

// Force real wallet mode (set to true to enable real Plug wallet in local development)
export const FORCE_REAL_WALLET = true;
export const shouldUseRealWallet = () => isProduction() || FORCE_REAL_WALLET;