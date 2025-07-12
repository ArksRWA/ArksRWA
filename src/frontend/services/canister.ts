// services/canister.ts

import { Actor, HttpAgent } from "@dfinity/agent";
import { idlFactory } from "../../declarations/arks-rwa-backend";
import { getCanisterId, HOST, isLocal } from "../config/canister";

// Create agent for the appropriate environment
const agent = new HttpAgent({
  host: HOST,
});

// Only fetch root key in local for certificate validation
if (isLocal()) {
  agent.fetchRootKey();
}

const backendActor = Actor.createActor(idlFactory, {
  agent,
  canisterId: getCanisterId('arks_rwa_backend'),
});

export default backendActor;
