FROM --platform=linux/amd64 node:latest

# Install OS-level deps
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y \
    curl ca-certificates git libssl-dev pkg-config build-essential gnupg && \
    rm -rf /var/lib/apt/lists/*

# Install DFX
ENV DFX_VERSION=0.27.0
RUN curl -L https://github.com/dfinity/sdk/releases/download/${DFX_VERSION}/dfx-${DFX_VERSION}-x86_64-linux.tar.gz -o dfx.tar.gz && \
    tar -xzf dfx.tar.gz && mv dfx /usr/local/bin/dfx && chmod +x /usr/local/bin/dfx && rm -rf dfx.tar.gz LICENSE version.txt

# Use pre-existing node user
USER node
WORKDIR /app

# Copy project files
COPY --chown=node:node . .

# Switch to root to create directory with proper permissions
USER root
RUN mkdir -p /app/.dfx && chown -R node:node /app && \
    chmod +x /app/scripts/deploy-local.sh

# Switch back to node user
USER node

# Set up environment for local development
RUN cp .env.local.example .env.local

# Install AI service dependencies
RUN cd /app/src/AI && npm install

# Set up Docker-specific environment
ENV DOCKER_MODE=true
ENV DFX_NETWORK=local
ENV AI_SERVICE_URL=http://localhost:3001

# Use the production-ready deploy-local.sh script
RUN dfx start --background --clean && \
    ./scripts/deploy-local.sh

# Install frontend dependencies and build
RUN cd /app/src/frontend && \
    npm install && \
    npm run build

# Go back to app root
WORKDIR /app

# Expose ports for DFX, frontend, and AI service
EXPOSE 4943 3000 3001

# Start both DFX and AI service
CMD ["sh", "-c", "dfx start --host 0.0.0.0:4943 --background && cd src/AI && npm start & wait"]
