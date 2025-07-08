// lib/arksBackend.ts

import { Actor, HttpAgent } from "@dfinity/agent";
import { idlFactory } from "../../../.dfx/local/canisters/arks-rwa-backend";
import canisterIds from "../../../.dfx/local/canister_ids.json";

const isLocal = process.env.NEXT_PUBLIC_DFX_NETWORK === "local";

const agent = new HttpAgent({
  host: isLocal ? "http://127.0.0.1:4943" : "https://icp-api.io",
});

// Only fetch root key in local for certificate validation
if (isLocal) {
  agent.fetchRootKey();
}

const backendActor = Actor.createActor(idlFactory, {
  agent,
  canisterId: canisterIds["arks-rwa-backend"].local, // or .ic
});

export default backendActor;
