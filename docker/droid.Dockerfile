FROM base

USER root

# Install Droid CLI using official installer
RUN curl -fsSL https://app.factory.ai/cli | sh

# Add droid to PATH for all users
ENV PATH="/root/.local/bin:${PATH}"

USER evaluser

# Add droid to evaluser's PATH
ENV PATH="/root/.local/bin:${PATH}"

# Verify Droid CLI installed
RUN droid --version

COPY --chown=evaluser:evaluser docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
