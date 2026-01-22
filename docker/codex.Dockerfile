FROM base

USER root

# Install Codex CLI
# NOTE: Using latest version. For production, pin with @openai/codex@<version>
# and use npm ci with package-lock.json for reproducible installs
RUN npm install -g @openai/codex

USER evaluser

# Verify Codex CLI installed
RUN codex --version

COPY --chown=evaluser:evaluser docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
