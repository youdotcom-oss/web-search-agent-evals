FROM base

USER root

# Install Gemini CLI
RUN npm install -g @google/gemini-cli

USER evaluser

# Verify Gemini CLI installed
RUN gemini --version

COPY --chown=evaluser:evaluser docker/entrypoint /entrypoint.ts
COPY --chown=evaluser:evaluser mcp-servers.ts /eval/mcp-servers.ts
RUN chmod +x /entrypoint.ts

ENTRYPOINT ["/entrypoint.ts"]
