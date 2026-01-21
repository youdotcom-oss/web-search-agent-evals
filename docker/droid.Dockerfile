FROM base

USER root

# Download and install Droid CLI
# Using the Factory CDN installer script
RUN curl -fsSL https://download.factory.ai/droid/install.sh | bash

# Add droid to PATH for all users
ENV PATH="/root/.local/bin:${PATH}"

USER evaluser

# Verify Droid CLI installed
RUN droid --version || echo "Droid installation will be completed in entrypoint"

COPY --chown=evaluser:evaluser docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
