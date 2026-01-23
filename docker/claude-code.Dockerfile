FROM base

USER evaluser

# Install Claude Code CLI as evaluser (not root)
RUN curl -fsSL https://claude.ai/install.sh | bash

# Claude installs to ~/.local/bin for the current user
ENV PATH="/home/evaluser/.local/bin:${PATH}"

# Verify Claude CLI installed
RUN claude --version

COPY --chown=evaluser:evaluser docker/entrypoint /entrypoint.ts
COPY --chown=evaluser:evaluser mcp-servers.ts /eval/mcp-servers.ts
RUN chmod +x /entrypoint.ts

ENTRYPOINT ["/entrypoint.ts"]
