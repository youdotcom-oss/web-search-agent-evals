FROM base

USER evaluser

# Install Droid CLI as evaluser (not root)
RUN curl -fsSL https://app.factory.ai/cli | sh

# Droid installs to ~/.local/bin for the current user
ENV PATH="/home/evaluser/.local/bin:${PATH}"

# Verify Droid CLI installed
RUN droid --version

COPY --chown=evaluser:evaluser docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
