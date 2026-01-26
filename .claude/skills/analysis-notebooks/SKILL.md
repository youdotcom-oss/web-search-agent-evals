# Analysis Notebooks

Create and use Jupyter notebooks for deep analysis of evaluation results. Notebooks combine raw trajectory data with statistical comparison analysis for comprehensive benchmarking.

## Quick Start

### View Summary Notebook

**On GitHub:**
- Navigate to `notebooks/summary.ipynb` in the repo
- GitHub renders it automatically with all visualizations

**On Google Colab:**
1. Click "Open in Colab" badge in notebook
2. Run all cells for interactive exploration

**Locally:**
```bash
# Install dependencies
pip install -r notebooks/requirements.txt

# Launch Jupyter
jupyter notebook notebooks/summary.ipynb
```

## Summary Notebook Structure

The `notebooks/summary.ipynb` combines multiple data sources:

**Data Sources:**
- `data/results/latest.json` - Points to current run
- `data/results/runs/YYYY-MM-DD/**/*.jsonl` - Raw trajectory results
- `data/comparisons/runs/YYYY-MM-DD/*.json` - Statistical analysis
- `data/results/MANIFEST.jsonl` - Historical metadata

**9 Analysis Cells:**
1. **Setup** - Load data, display run metadata
2. **Overall Rankings** - Bar chart from weighted comparison
3. **Head-to-Head Matrix** - Win/loss heatmap
4. **Statistical Significance** - Bootstrap confidence intervals
5. **Pass Rates** - Success rate by agent/provider
6. **Latency Distribution** - Response time histograms
7. **Error Rates** - Tool error analysis
8. **Token Usage** - Input/output tokens per query
9. **Historical Trends** - Performance over time

## Creating Custom Analysis Notebooks

### 1. Create New Notebook

```bash
jupyter notebook
# New → Python 3
# Save as notebooks/your-analysis.ipynb
```

### 2. Load Data

```python
import json
import pandas as pd

# Read latest.json to find current run
with open('../data/results/latest.json') as f:
    latest = json.load(f)

print(f"Analyzing run: {latest['date']}")

# Load raw results for specific agent/tool
with open(f"../data/results/{latest['path']}/claude-code/builtin.jsonl") as f:
    results = [json.loads(line) for line in f]

df = pd.DataFrame(results)
df.head()
```

### 3. Common Analysis Patterns

**Failure Clustering by Category:**
```python
failures = df[df['score'] < 0.5]
category_failures = failures['metadata'].apply(
    lambda x: x.get('category', 'unknown')
)

category_failures.value_counts().plot(kind='bar')
plt.title('Failures by Category')
plt.xlabel('Category')
plt.ylabel('Failure Count')
plt.show()
```

**Token Usage Analysis:**
```python
# Note: Token counts may not be available for all agents
df['total_tokens'] = df['timing'].apply(
    lambda x: x.get('inputTokens', 0) + x.get('outputTokens', 0)
)

# Filter to rows with token data
df_with_tokens = df[df['total_tokens'] > 0]

if len(df_with_tokens) > 0:
    df_with_tokens.boxplot(
        column='total_tokens',
        by='metadata.searchProvider'
    )
    plt.title('Token Usage by Search Provider')
    plt.ylabel('Tokens (input + output)')
    plt.suptitle('')  # Remove default title
    plt.show()
else:
    print("⚠️  No token data available in this run")
```

**Latency Time Series:**
```python
df['prompt_index'] = range(len(df))
df['latency_sec'] = df['timing'].apply(
    lambda x: x.get('total', 0) / 1000
)

plt.figure(figsize=(12, 6))
plt.plot(df['prompt_index'], df['latency_sec'], alpha=0.5)
plt.xlabel('Prompt Index')
plt.ylabel('Latency (seconds)')
plt.title('Latency Over Evaluation Run')
plt.axhline(
    df['latency_sec'].median(),
    color='red',
    linestyle='--',
    label='Median'
)
plt.legend()
plt.show()
```

**Success Rate by Prompt Difficulty:**
```python
# Analyze if certain prompts are harder
df['passed'] = df['score'] >= 0.5
prompt_difficulty = df.groupby('id')['passed'].mean()

# Hardest prompts
hardest = prompt_difficulty.nsmallest(10)
print("Hardest Prompts (lowest success rate):")
print(hardest)

# Easiest prompts
easiest = prompt_difficulty.nlargest(10)
print("\nEasiest Prompts (highest success rate):")
print(easiest)
```

### 4. Load Comparison Analysis

```python
# Load weighted comparison results
comparison_path = f"../data/comparisons/{latest['path']}/all-weighted.json"
with open(comparison_path) as f:
    comparison = json.load(f)

quality = comparison['quality']
head_to_head = comparison['headToHead']['pairwise']

# Rankings dataframe
rankings_df = pd.DataFrame(quality['rankings'])
rankings_df['score_pct'] = rankings_df['score'] * 100
print(rankings_df[['rank', 'run', 'score_pct']])
```

### 5. Add Colab Badge

```markdown
[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/<org>/acp-evals/blob/main/notebooks/your-analysis.ipynb)
```

## Historical Comparisons

Compare performance across multiple runs:

```python
import pandas as pd
import json

# Read MANIFEST.jsonl for all runs
with open('../data/results/MANIFEST.jsonl') as f:
    history = [json.loads(line) for line in f]

# Load results from each run
historical_data = []
for run in history:
    for agent in run['agents']:
        for provider in run['searchProviders']:
            path = f"../data/results/{run['path']}/{agent}/{provider}.jsonl"
            
            try:
                with open(path) as f:
                    results = [json.loads(line) for line in f]
                    avg_score = sum(r.get('score', 0) for r in results) / len(results)
                    
                    historical_data.append({
                        'date': run['date'],
                        'agent': agent,
                        'provider': provider,
                        'avg_score': avg_score * 100,  # Convert to percentage
                        'prompt_count': len(results),
                    })
            except FileNotFoundError:
                print(f"⚠️  Missing: {path}")

# Create dataframe
hist_df = pd.DataFrame(historical_data)

# Plot trends for each agent-provider combo
import matplotlib.pyplot as plt

fig, ax = plt.subplots(figsize=(14, 8))

for combo in hist_df.groupby(['agent', 'provider']):
    label = f"{combo[0][0]}-{combo[0][1]}"
    combo_data = combo[1].sort_values('date')
    ax.plot(combo_data['date'], combo_data['avg_score'], marker='o', label=label)

ax.set_xlabel('Run Date')
ax.set_ylabel('Average Score (%)')
ax.set_title('Performance Trends Over Time')
ax.axhline(50, color='black', linestyle='--', linewidth=1, label='50% baseline')
ax.legend(bbox_to_anchor=(1.05, 1), loc='upper left')
ax.grid(True, alpha=0.3)
plt.xticks(rotation=45)
plt.tight_layout()
plt.show()
```

## Publishing Notebooks

### GitHub Rendering

GitHub automatically renders `.ipynb` files with all outputs. Just commit and push:

```bash
git add notebooks/your-analysis.ipynb
git commit -m "docs: add custom analysis notebook"
git push
```

### Sharing via Colab

Colab can run notebooks directly from GitHub:

1. Add Colab badge to notebook header
2. Users click badge → Colab clones repo and opens notebook
3. All dependencies from `requirements.txt` can be installed in first cell

### Static HTML Export

```bash
# Install nbconvert
pip install nbconvert

# Export to HTML
jupyter nbconvert --to html notebooks/summary.ipynb

# Output: notebooks/summary.html (static page)
```

### Jupyter Book (Optional)

For a complete documentation site:

```bash
pip install jupyter-book

# Build book
jupyter-book build notebooks/

# Output: notebooks/_build/html/index.html
```

## Data Caveats

### Token Counts

Token data availability varies by agent:
- **Available**: Agents that report `inputTokens` and `outputTokens` in trajectory
- **Missing**: Agents that don't expose token counts
- **Partial**: May only include final turn, not intermediate tool calls

Always filter for non-zero token counts before analysis:

```python
df_with_tokens = df[df['total_tokens'] > 0]
if len(df_with_tokens) == 0:
    print("⚠️  No token data available")
```

### Timing Data

All agents report `timing.total` (end-to-end latency), but intermediate timing may vary.

### Metadata Fields

Check available fields before analysis:

```python
# Show all available fields in first result
first_result = results[0]
print("Available fields:", list(first_result.keys()))

# Check metadata structure
if 'metadata' in first_result:
    print("Metadata fields:", list(first_result['metadata'].keys()))
```

## Related Tools

- **Pandas Docs:** https://pandas.pydata.org/docs/
- **Matplotlib Gallery:** https://matplotlib.org/stable/gallery/
- **Seaborn Tutorial:** https://seaborn.pydata.org/tutorial.html
- **Jupyter Notebook Docs:** https://jupyter-notebook.readthedocs.io/

## Related Skills

- [@playoffs](../playoffs/SKILL.md) - Running evaluations and comparisons
- [@agent-eval-harness](../agent-eval-harness@plaited_agent-eval-harness/SKILL.md) - Capture and compare commands
