from --platform=linux/amd64 node:latest

WORKDIR /app

# Install OS-level deps
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y \
    curl ca-certificates git libssl-dev pkg-config build-essential gnupg && \
    rm -rf /var/lib/apt/lists/*

COPY ./src/AI .
COPY ./src/AI/.env.example .env

# Install dependencies
RUN npm install -g pm2@latest
RUN npm install 

# Expose ports
EXPOSE 3001

# Start the server
CMD ["npm", "run", "start:prod"]
