# Test Fixtures

This directory contains test fixtures for the compare script tests.

## Purpose

Tests should use stable fixture data instead of relying on real data that changes over time. This ensures:

- Tests remain stable regardless of when they run
- Tests don't break when new runs are added to production data
- Tests run faster since they use minimal data
- Tests are isolated from production data changes

## Structure

```
fixtures/
└── data/
    ├── results/
    │   ├── latest.json           # Points to fixed test date (2026-01-24)
    │   └── runs/
    │       └── 2026-01-24/       # Fixed test run directory
    │           ├── claude-code/
    │           │   ├── builtin.jsonl
    │           │   └── you.jsonl
    │           ├── gemini/
    │           │   ├── builtin.jsonl
    │           │   └── you.jsonl
    │           ├── droid/
    │           │   ├── builtin.jsonl
    │           │   └── you.jsonl
    │           └── codex/
    │               ├── builtin.jsonl
    │               └── you.jsonl
    └── comparisons/
        └── runs/
            └── 2026-01-24/       # Fixed test comparison directory
                ├── all-weighted.json
                └── gemini-you-statistical.json
```

## Usage

Tests use the `--fixture-dir` parameter to point the compare script at fixture data:

```typescript
const FIXTURE_DIR = join(import.meta.dir, "fixtures", "data");

const { stdout, exitCode } = await runScript(SCRIPT_PATH, [
  "--mode",
  "full",
  "--fixture-dir",
  FIXTURE_DIR,
  "--dry-run",
]);
```

## Fixture Data

The fixture data contains:

- **latest.json**: Points to the fixed test date `2026-01-24`
- **Result files**: Minimal JSONL files with 2 test entries each
- **Comparison files**: Pre-generated comparison JSON files

All files use minimal data sufficient for testing path generation and option parsing.

## Maintenance

When adding new test cases:

1. Add required fixture files if needed
2. Keep fixture data minimal (2-3 entries per file)
3. Use fixed dates to prevent test brittleness
4. Document any new fixture requirements
