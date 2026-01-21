FROM base

USER root

# Install Claude Code CLI using official installer
RUN curl -fsSL https://claude.ai/install.sh | bash

# Add claude to PATH for all users
ENV PATH="/root/.local/bin:${PATH}"

USER evaluser

# Add claude to evaluser's PATH
ENV PATH="/root/.local/bin:${PATH}"

# Verify Claude CLI installed
RUN claude --version

COPY --chown=evaluser:evaluser docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
