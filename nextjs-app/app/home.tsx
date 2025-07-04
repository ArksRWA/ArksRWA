"use client";
import { useState, useEffect, ReactNode } from 'react';

// --- Type definitions for window.ic ---
// This extends the global Window interface to include the 'ic' object
// injected by the Plug wallet extension.
declare global {
  interface Window {
    ic?: {
      plug?: {
        requestConnect: (options?: { whitelist?: string[] }) => Promise<void>;
        isConnected: () => Promise<boolean>;
        createAgent: (options?: { whitelist?: string[] }) => Promise<void>;
        agent?: {
          getPrincipal: () => Promise<{ toText: () => string }>;
        };
      };
    };
  }
}


// --- Helper Component Types ---

interface WalletIconProps {
  children: ReactNode;
}

interface WalletButtonProps {
  onClick: () => void;
  children: ReactNode;
  disabled: boolean;
}

interface FeaturePointProps {
  children: ReactNode;
}


// --- Helper Components ---

// Icon component for the wallet options
const WalletIcon = ({ children }: WalletIconProps) => (
  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/20">
    {children}
  </div>
);

// Button component
const WalletButton = ({ onClick, children, disabled }: WalletButtonProps) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="w-full rounded-lg bg-primary px-6 py-3 text-sm font-medium text-white transition-all duration-200 hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card-bg disabled:cursor-not-allowed disabled:opacity-50"
  >
    {children}
  </button>
);

// Feature point component
const FeaturePoint = ({ children }: FeaturePointProps) => (
    <div className="flex items-center space-x-2">
        <span className="h-1.5 w-1.5 rounded-full bg-primary"></span>
        <span className="text-text-secondary">{children}</span>
    </div>
);


// --- Main App Component ---

export default function App() {
  const [plugConnected, setPlugConnected] = useState<boolean>(false);
  const [internetIdentityConnected, setInternetIdentityConnected] = useState<boolean>(false);
  const [principalId, setPrincipalId] = useState<string | null>(null);
  const [isPlugAvailable, setIsPlugAvailable] = useState<boolean>(false);

  // Check if Plug wallet is installed on component mount
  useEffect(() => {
    // The 'window.ic.plug' object might not be available immediately.
    // A short delay can help ensure it's loaded.
    const checkPlugAvailability = () => {
      if (window.ic?.plug) {
        setIsPlugAvailable(true);
      } else {
        // For development/testing, allow connection even without Plug installed
        setIsPlugAvailable(true);
      }
    };
    
    setTimeout(checkPlugAvailability, 500);
  }, []);


  // --- Wallet Connection Logic ---

  const handleConnectPlug = async () => {
    if (!window.ic?.plug) {
      // For demo purposes, simulate connection when Plug is not available
      console.log("Plug wallet not detected, simulating connection for demo...");
      setPrincipalId("demo-principal-id-" + Math.random().toString(36).substr(2, 9));
      setPlugConnected(true);
      alert("Demo connection successful! (Install Plug wallet for real connection)");
      return;
    }
    
    try {
      // Whitelist for the canister you want to interact with
      // Replace with your actual canister ID in a real application
      const canisterId = "ryjl3-tyaaa-aaaaa-aaaba-cai"; // Example canister
      const whitelist = [canisterId];

      // Request connection
      await window.ic.plug.requestConnect({ whitelist });

      // Verify connection and get principal
      const connected = await window.ic.plug.isConnected();
      if (!connected) {
          throw new Error("Plug connection failed silently.");
      }
      
      // Create an agent to interact with the IC if it doesn't exist
      if (!window.ic.plug.agent) {
        await window.ic.plug.createAgent({ whitelist });
      }

      // Get the principal ID
      const principal = await window.ic.plug.agent?.getPrincipal();
      if (principal) {
        setPrincipalId(principal.toText());
        setPlugConnected(true);
        console.log("Plug wallet connected successfully!");
      }

    } catch (e: any) {
      console.error("Plug connection failed:", e);
      alert(`Failed to connect Plug wallet: ${e.message}`);
    }
  };

  const handleConnectInternetIdentity = async () => {
    // This is a placeholder for Internet Identity connection logic.
    // In a real IC app, you would use the @dfinity/auth-client library.
    // This example simulates a successful connection.
    console.log("Simulating Internet Identity connection...");
    setPrincipalId("2vxsx-fae"); // Example Principal ID
    setInternetIdentityConnected(true);
    alert("Successfully connected with Internet Identity (Simulated).");
  };

  // --- Render Logic ---

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        .font-sans { font-family: 'Inter', sans-serif; }
      `}</style>
      <main className="flex min-h-screen w-full items-center justify-center bg-background text-foreground font-sans p-4">
        <div className="w-full max-w-4xl rounded-xl bg-card-bg p-8 border border-card-border">

          {/* --- Header Section --- */}
          <div className="text-center">
             <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-lg bg-primary/20">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H7a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white">
              Connect Your Wallet
            </h1>
            <p className="mt-4 text-base text-text-secondary">
              Access the Internet Computer ecosystem with your preferred wallet solution
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2">
                <FeaturePoint>Secure Authentication</FeaturePoint>
                <FeaturePoint>Seamless Integration</FeaturePoint>
                <FeaturePoint>Decentralized Access</FeaturePoint>
            </div>
          </div>

          {/* --- Connection Status --- */}
          {principalId && (
            <div className="mt-6 rounded-lg bg-primary/10 p-4 text-center border border-primary/30">
              <p className="font-medium text-primary">Connection Successful!</p>
              <p className="mt-1 text-xs text-text-secondary break-all">
                Principal ID: {principalId}
              </p>
            </div>
          )}

          {/* --- Wallet Options --- */}
          <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-2">

            {/* Plug Wallet Card */}
            <div className="rounded-lg bg-card-bg p-6 text-center transition-all duration-200 hover:bg-card-bg/80 border border-card-border">
              <WalletIcon>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-accent-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </svg>
              </WalletIcon>
              <h2 className="text-lg font-semibold text-white">Plug Wallet</h2>
              <p className="mt-2 text-sm text-text-secondary">
                Connect using the Plug browser extension for seamless ICP interactions.
              </p>
              <div className="mt-8">
                <WalletButton onClick={handleConnectPlug} disabled={!isPlugAvailable || plugConnected}>
                  {plugConnected ? 'Connected' : 'Connect Plug'}
                </WalletButton>
              </div>
            </div>

            {/* Internet Identity Card */}
            <div className="rounded-lg bg-card-bg p-6 text-center transition-all duration-200 hover:bg-card-bg/80 border border-card-border">
              <WalletIcon>
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-accent-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </WalletIcon>
              <h2 className="text-lg font-semibold text-white">Internet Identity</h2>
              <p className="mt-2 text-sm text-text-secondary">
                Use Internet Computer's native authentication for secure access.
              </p>
              <div className="mt-8">
                <WalletButton onClick={handleConnectInternetIdentity} disabled={internetIdentityConnected}>
                   {internetIdentityConnected ? 'Connected' : 'Connect Internet Identity'}
                </WalletButton>
              </div>
            </div>
          </div>

          {/* --- Footer --- */}
          <div className="mt-10 text-center text-xs text-text-muted">
            <p>Powered by Internet Computer Protocol • Secure • Fast • Decentralized</p>
          </div>
        </div>
      </main>
    </>
  );
}