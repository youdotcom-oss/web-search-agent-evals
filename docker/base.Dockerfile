FROM oven/bun:1.3.5

# Install Node.js 24+ (required for Gemini CLI)
USER root
RUN apt-get update && apt-get install -y \
    curl \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 24
RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && \
    apt-get install -y nodejs

# Create non-root user (Claude CLI blocks root)
RUN useradd -m -s /bin/bash evaluser

# Install acp-harness globally
RUN npm install -g @plaited/acp-harness@^0.4.4

USER evaluser
WORKDIR /workspace

# Verify installations
RUN bun --version && node --version && npm --version
