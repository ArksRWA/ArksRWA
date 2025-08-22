FROM --platform=linux/amd64 node:latest

# Install OS-level deps
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y \
    curl ca-certificates git libssl-dev pkg-config build-essential gnupg && \
    rm -rf /var/lib/apt/lists/*

# Install DFX
ENV DFX_VERSION=0.28.0
RUN curl -L https://github.com/dfinity/sdk/releases/download/${DFX_VERSION}/dfx-${DFX_VERSION}-x86_64-linux.tar.gz -o dfx.tar.gz && \
    tar -xzf dfx.tar.gz && mv dfx /usr/local/bin/dfx && chmod +x /usr/local/bin/dfx && rm -rf dfx.tar.gz LICENSE version.txt

# Use pre-existing node user
USER node
WORKDIR /app

# Copy project files
COPY --chown=node:node . .

# Switch to root to create directory with proper permissions
USER root
RUN mkdir -p /app/.dfx && chown -R node:node /app

# Switch back to node user
USER node

# Generate backend declarations
RUN dfx generate arks-core && \
    mkdir -p /app/src/frontend/declarations/arks-core && \
    cp -r /app/src/declarations/arks-core/* /app/src/frontend/declarations/arks-core/ && \
    dfx generate arks-identity && \
    mkdir -p /app/src/frontend/declarations/arks-identity && \
    cp -r /app/src/declarations/arks-identity/* /app/src/frontend/declarations/arks-identity/ && \
    dfx generate arks-risk-engine && \
    mkdir -p /app/src/frontend/declarations/arks-risk-engine && \
    cp -r /app/src/declarations/arks-risk-engine/* /app/src/frontend/declarations/arks-risk-engine/ && \
    dfx generate arks-token-factory && \
    mkdir -p /app/src/frontend/declarations/arks-token-factory && \
    cp -r /app/src/declarations/arks-token-factory/* /app/src/frontend/declarations/arks-token-factory/

RUN dfx start --background --clean && \
    dfx deploy arks-core --argument "(principal \"$(dfx identity get-principal)\", null)" && \
    . /app/.env && \
    [ ! -f .env ] || export $(grep -v '^#' .env | xargs) && \
    dfx deploy arks-identity --argument "(principal \"$(dfx identity get-principal)\")" && \
    dfx deploy arks-risk-engine --argument "(principal \"$(dfx identity get-principal)\", null, null, principal \"$(dfx canister id arks-core)\")"  && \
    dfx deploy arks-token-factory --argument "(principal \"$(dfx identity get-principal)\", principal \"$(dfx canister id arks-core)\")" && \
    cd /app/src/frontend && \
    npm install && \
    npm run build

# Go back to app root
WORKDIR /app

EXPOSE 4943 3000

CMD ["true"]
