// Canister configuration for different environments
export const CANISTER_IDS = {
  local: {
    // Adjust with your local env
    arks_rwa_backend: "ufxgi-4p777-77774-qaadq-cai",
    internet_identity: "vpyes-67777-77774-qaaeq-cai",
    frontend: "vizcg-th777-77774-qaaea-cai"
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