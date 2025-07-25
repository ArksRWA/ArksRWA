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
RUN dfx generate arks-rwa-backend && \
    mkdir -p /app/src/frontend/declarations/arks-rwa-backend && \
    cp -r /app/src/declarations/arks-rwa-backend/* /app/src/frontend/declarations/arks-rwa-backend/

RUN dfx start --background --clean && \
    dfx deploy arks-rwa-backend && \
    . /app/.env && \
    cd /app/src/frontend && \
    npm install && \
    npm run build

# Go back to app root
WORKDIR /app

EXPOSE 4943 3000

CMD ["true"]
