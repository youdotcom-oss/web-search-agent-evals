FROM base

USER evaluser

# Install Droid CLI as evaluser (not root)
# NOTE: Using latest version from installer. For production, pin to specific
# GitHub release (https://github.com/Factory-AI/factory/releases) and verify checksum
RUN curl -fsSL https://app.factory.ai/cli | sh

# Droid installs to ~/.local/bin for the current user
ENV PATH="/home/evaluser/.local/bin:${PATH}"

# Verify Droid CLI installed
RUN droid --version

COPY --chown=evaluser:evaluser docker/entrypoint /entrypoint.ts
COPY --chown=evaluser:evaluser mcp-servers.ts /eval/mcp-servers.ts
RUN chmod +x /entrypoint.ts

ENTRYPOINT ["/entrypoint.ts"]
