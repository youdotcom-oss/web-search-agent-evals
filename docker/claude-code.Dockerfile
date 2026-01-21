FROM base

USER root

# Note: Claude Code must be installed on host
# We'll use the headless adapter via acp-harness instead
# This allows the host's claude CLI to be used

USER evaluser

COPY --chown=evaluser:evaluser docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
