import { arks_core } from "@declarations/arks-core";

// Canister configuration for different environments
export const CANISTER_IDS = {
  local: {
    arks_core: process.env.CANISTER_ID_ARKS_CORE || "uxrrr-q7777-77774-qaaaq-cai",
    frontend: process.env.CANISTER_ID_FRONTEND || "vizcg-th777-77774-qaaea-cai"
  },
  ic: {
    arks_core: process.env.CANISTER_ID_ARKS_CORE || "",
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