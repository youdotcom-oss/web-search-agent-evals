FROM base

USER evaluser

# Install Claude Code CLI as evaluser (not root)
RUN curl -fsSL https://claude.ai/install.sh | bash

# Claude installs to ~/.local/bin for the current user
ENV PATH="/home/evaluser/.local/bin:${PATH}"

# Verify Claude CLI installed
RUN claude --version

COPY --chown=evaluser:evaluser docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
