FROM base

USER root

# Install Gemini CLI
RUN npm install -g @google/gemini-cli

USER evaluser

# Verify Gemini CLI installed
RUN gemini --version

COPY --chown=evaluser:evaluser docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
