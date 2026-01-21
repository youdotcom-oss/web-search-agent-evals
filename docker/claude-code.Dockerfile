FROM base

USER root

# Install Claude Code CLI
RUN npm install -g @anthropic/claude-cli

USER evaluser

# Verify Claude CLI installed
RUN claude --version

COPY --chown=evaluser:evaluser docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
