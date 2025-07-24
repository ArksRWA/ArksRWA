#!/bin/bash

set -e

echo "🛠️  Starting local DFX network..."
# dfx start --background --clean

echo "🧱 Creating backend canister..."
# dfx canister create arks-rwa-backend

echo "🚀 Deploying backend canister..."
dfx deploy arks-rwa-backend

echo "🌀 Generating TypeScript bindings..."
dfx generate arks-rwa-backend

echo "📦 Copying declarations to frontend..."
mkdir -p src/frontend/declarations
cp -R src/declarations/arks-rwa-backend src/frontend/declarations/

echo "🧪 Installing frontend dependencies..."
cd src/frontend
npm install

echo "🔨 Building and exporting frontend..."
npm run build

echo "🚢 Deploying frontend as a canister..."
cd ../../
dfx deploy frontend

echo "✅ All services deployed. You can now access your frontend via:"
echo "   http://localhost:4943/?canisterId=$(dfx canister id frontend)"

# Optional: keep container alive if needed
tail -f /dev/null

echo "✅ Canister URLs:"
env | grep CANISTER_ID_ | while read -r line; do
  name=$(echo "$line" | cut -d= -f1 | sed 's/CANISTER_ID_//')
  id=$(echo "$line" | cut -d= -f2)
  echo "🔗 $name → http://$id.localhost:4943"
done

