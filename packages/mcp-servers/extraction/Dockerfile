# ============================================
# Extraction MCP Server
# ============================================
# Extracts structured data from medical PDFs
# ============================================

FROM node:20-slim

LABEL maintainer="NeuroResearch Agent"
LABEL description="MCP server for PDF extraction"
LABEL version="1.0.0"

# Install PDF processing dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy package files
COPY package.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm install

# Copy source
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Run the server
CMD ["node", "dist/index.js"]
