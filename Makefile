.PHONY: all build clean run-%

# Default: build all Docker images
all: build

# Build all Docker images
build:
	docker compose build

# Clean results
clean:
	rm -rf data/results/*/*.jsonl

# Run specific pairing (e.g., make run-claude-code-builtin)
run-%:
	docker compose run --rm $*

# Common shortcuts
test-claude:
	docker compose run --rm claude-code-builtin

test-gemini:
	docker compose run --rm gemini-builtin

test-droid:
	docker compose run --rm droid-builtin
