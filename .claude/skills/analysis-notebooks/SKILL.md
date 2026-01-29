# Analysis Notebooks

Jupyter notebooks for visualizing evaluation results and reliability metrics.

## Available Notebooks

### 1. comparison.ipynb - Quality Rankings & Head-to-Head

Visualizes pre-computed comparison metrics from weighted and statistical analysis.

**What it shows:**
- Overall quality rankings
- Quality vs performance tradeoff
- Head-to-head win/loss matrix
- Statistical significance (confidence intervals)
- Search provider comparison (builtin vs MCP)
- Pass rate analysis

**Data source:** `data/comparisons/{mode}-runs/*.json` or `data/comparisons/runs/YYYY-MM-DD/*.json`

**View on GitHub:**
Navigate to [`notebooks/comparison.ipynb`](../../notebooks/comparison.ipynb) - GitHub renders automatically

**Run on Google Colab:**
Click "Open in Colab" badge in notebook - runs interactively with repo clone

**Run locally:**
```bash
pip install -r notebooks/requirements.txt
jupyter notebook notebooks/comparison.ipynb
```

### 2. trials.ipynb - Pass@k Reliability Analysis

Deep dive into multi-trial evaluation results to measure agent reliability.

**What it shows:**
- pass@k (capability) vs pass^k (reliability) frontier
- Flakiness analysis (inconsistency detection)
- Prompt difficulty rankings
- Per-prompt trial heatmap (visual pattern inspection)
- Pass rate distributions

**Data source:** `data/results/trials/YYYY-MM-DD/{agent}/{provider}.jsonl`

**View/Run:** Same options as comparison.ipynb

**Typical use cases:**
- Production deployment decisions (need reliability)
- Prompt engineering (focus on flaky prompts)
- Regression testing (track reliability over time)

## Quick Start

### View Notebooks on GitHub

1. Navigate to `notebooks/` directory in repo
2. Click on `comparison.ipynb` or `trials.ipynb`
3. GitHub renders automatically with all visualizations

### Run on Google Colab

1. Open notebook in GitHub
2. Click "Open in Colab" badge at top
3. Colab clones repo and loads notebook
4. Run all cells (Runtime → Run all)

**No local setup required!** Colab provides Python environment and dependencies.

### Run Locally

```bash
# Install dependencies
pip install -r notebooks/requirements.txt

# Launch Jupyter
jupyter notebook

# Open comparison.ipynb or trials.ipynb from browser
```

## Configuration

Both notebooks have **USER CONFIGURATION** cells where you can set:

**comparison.ipynb:**
```python
MODE = 'test'        # Options: 'test' or 'full'
RUN_DATE = None      # For full mode: '2026-01-24' or None for latest
```

**trials.ipynb:**
```python
AGENT = 'droid'      # Options: 'claude-code', 'gemini', 'droid', 'codex'
PROVIDER = 'builtin' # Options: 'builtin', 'you' (or other MCP server keys)
TRIAL_TYPE = 'default'  # Options: 'default', 'capability', 'regression'
```

## Data Requirements

### For comparison.ipynb

Requires comparison results to exist:

```bash
# Generate comparison results first
bun run compare --mode test                    # → data/comparisons/test-runs/
bun run compare --mode test --strategy statistical

# For full runs
bun run compare:full                            # → data/comparisons/runs/YYYY-MM-DD/
bun run compare:full-statistical
```

### For trials.ipynb

Requires trials data to exist:

```bash
# Run trials first (all agents × all providers)
bun run trials                                  # All agents/providers, k=5
bun run trials:capability                       # All agents/providers, k=10

# Or filter to specific combinations
bun run trials -- --agent gemini                # Single agent, all providers
bun run trials -- --search-provider you         # All agents, MCP only

# Output: data/results/trials/{agent}-{provider}.jsonl
# e.g., droid-builtin.jsonl, gemini-you.jsonl, etc.
```

## Creating Custom Notebooks

### 1. Start with Template

Copy existing notebook structure for Colab compatibility:

```bash
cp notebooks/comparison.ipynb notebooks/my-analysis.ipynb
```

### 2. Essential Setup Cells

**Always include these first two cells:**

**Cell 1: Colab Detection & Repo Clone**
```python
import os
from pathlib import Path

try:
    import google.colab
    IN_COLAB = True
except ImportError:
    IN_COLAB = False

if IN_COLAB:
    print("🔧 Running in Google Colab - cloning repository...")
    repo_dir = Path('/content/web-search-agent-evals')
    if not repo_dir.exists():
        !git clone https://github.com/youdotcom-oss/web-search-agent-evals.git /content/web-search-agent-evals
        print("✓ Repository cloned")
    else:
        print("✓ Repository already exists")
        %cd /content/web-search-agent-evals
        !git pull origin main
    %cd /content/web-search-agent-evals
    print(f"✓ Working directory: {Path.cwd()}")
else:
    print("✓ Running locally")
```

**Cell 2: Dependencies & Path Setup**
```python
import json
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from pathlib import Path

# Configure plotting
sns.set_style('whitegrid')
plt.rcParams['figure.dpi'] = 100

# Find project root
PROJECT_ROOT = Path.cwd()
if PROJECT_ROOT.name == 'notebooks':
    PROJECT_ROOT = PROJECT_ROOT.parent

DATA_DIR = PROJECT_ROOT / 'data'
print(f"📁 Project root: {PROJECT_ROOT}")
print(f"📊 Data directory: {DATA_DIR}")

if not DATA_DIR.exists():
    raise FileNotFoundError(f"Data directory not found: {DATA_DIR}")
```

### 3. Add Colab Badge to Markdown

First cell should be markdown with Colab badge:

```markdown
# My Custom Analysis

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/youdotcom-oss/web-search-agent-evals/blob/main/notebooks/my-analysis.ipynb)

Description of what this analyzes...
```

### 4. Load Data

**For comparison analysis:**
```python
MODE = 'test'
comp_dir = DATA_DIR / 'comparisons' / (f'{MODE}-runs' if MODE == 'test' else f'runs/{RUN_DATE}')

with open(comp_dir / 'all-weighted.json') as f:
    weighted = json.load(f)
```

**For raw trajectory analysis:**
```python
AGENT = 'claude-code'
PROVIDER = 'builtin'
MODE = 'test'

results_dir = DATA_DIR / 'results' / (f'{MODE}-runs' if MODE == 'test' else f'runs/{RUN_DATE}')
results_file = results_dir / AGENT / f'{PROVIDER}.jsonl'

with open(results_file) as f:
    results = [json.loads(line) for line in f]

df = pd.DataFrame(results)
```

**For trials analysis:**
```python
AGENT = 'droid'
PROVIDER = 'builtin'
TRIAL_TYPE = 'default'  # or 'capability', 'regression'
RUN_DATE = None  # None for latest, or '2026-01-29' for specific date

# Find latest date if not specified
trials_dir = DATA_DIR / 'results' / 'trials'
if RUN_DATE is None:
    dirs = sorted([d.name for d in trials_dir.iterdir() if d.is_dir() and d.name[0].isdigit()])
    RUN_DATE = dirs[-1]

# Build filename based on trial type (same structure as runs)
suffix = '' if TRIAL_TYPE == 'default' else f'-{TRIAL_TYPE}'
trials_file = trials_dir / RUN_DATE / AGENT / f'{PROVIDER}{suffix}.jsonl'

with open(trials_file) as f:
    trials = [json.loads(line) for line in f]

df = pd.DataFrame(trials)
```

## Common Analysis Patterns

### Failure Analysis

```python
# Filter to failures only
failures = df[df['score'] < 0.65]

# Group by error type if available
if 'error' in failures.columns:
    error_counts = failures['error'].value_counts()
    error_counts.plot(kind='bar', title='Failure Types')
    plt.show()
```

### Latency Analysis

```python
# Extract latency from timing
df['latency_ms'] = df['timing'].apply(lambda x: x.get('total', 0))

# Plot distribution
df.boxplot(column='latency_ms', by='provider')
plt.title('Latency Distribution by Provider')
plt.ylabel('Latency (ms)')
plt.suptitle('')
plt.show()
```

### Token Usage (if available)

```python
# Extract token counts
df['input_tokens'] = df['timing'].apply(lambda x: x.get('inputTokens', 0))
df['output_tokens'] = df['timing'].apply(lambda x: x.get('outputTokens', 0))
df['total_tokens'] = df['input_tokens'] + df['output_tokens']

# Filter to rows with token data
df_with_tokens = df[df['total_tokens'] > 0]

if len(df_with_tokens) > 0:
    df_with_tokens.plot.scatter(x='input_tokens', y='output_tokens', alpha=0.5)
    plt.title('Input vs Output Tokens')
    plt.show()
else:
    print("⚠️  No token data available")
```

## Publishing Notebooks

### GitHub (Automatic)

Commit and push - GitHub renders `.ipynb` files automatically:

```bash
git add notebooks/my-analysis.ipynb
git commit -m "docs: add custom analysis notebook"
git push
```

### Google Colab (Shareable Link)

1. Add Colab badge to first markdown cell
2. Users click badge → Colab loads notebook from GitHub
3. No local setup required for users

### Static HTML Export

```bash
pip install nbconvert
jupyter nbconvert --to html notebooks/my-analysis.ipynb
# Output: notebooks/my-analysis.html
```

## Data Caveats

### Token Counts

Not all agents expose token usage:
- **Available**: Check if `timing.inputTokens` and `timing.outputTokens` exist
- **Partial**: May only include final turn, not tool calls
- **Missing**: Some agents don't report tokens at all

Always filter before analysis:
```python
df_with_tokens = df[df['total_tokens'] > 0]
if len(df_with_tokens) == 0:
    print("⚠️  No token data available for this agent")
```

### Timing Data

All agents report `timing.total` (end-to-end latency), but:
- Intermediate timing (per-turn) may vary
- Tool call latency may not be broken out separately

### Metadata Fields

Check available fields before assuming structure:

```python
# Inspect first record
first = results[0]
print("Fields:", list(first.keys()))

if 'metadata' in first:
    print("Metadata:", list(first['metadata'].keys()))
```

## Dependencies

Required packages (in `notebooks/requirements.txt`):

```
pandas>=2.0.0
matplotlib>=3.7.0
seaborn>=0.12.0
numpy>=1.24.0
jupyter>=1.0.0
```

Install locally:
```bash
pip install -r notebooks/requirements.txt
```

On Colab: Pre-installed (no action needed)

## Related Skills

- [@web-search-agent-evals](../web-search-agent-evals/SKILL.md) - Run evaluations and comparisons
- [@agent-eval-harness](../agent-eval-harness@plaited_agent-eval-harness/SKILL.md) - Trials and capture commands
