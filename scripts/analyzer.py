#!/usr/bin/env python3
"""
Script to read and display JSONL result files

Usage:
    python scripts/analyzer.py [filepath]
"""

import json
import sys
from pathlib import Path
from collections import Counter
import numpy as np
from scipy import stats


def get_keys_recursive(obj, prefix=""):
    """Recursively get all keys from a nested dictionary"""
    keys = []
    if isinstance(obj, dict):
        for key, value in obj.items():
            full_key = f"{prefix}.{key}" if prefix else key
            keys.append(full_key)
            if isinstance(value, dict):
                keys.extend(get_keys_recursive(value, full_key))
            elif isinstance(value, list) and value and isinstance(value[0], dict):
                keys.extend(get_keys_recursive(value[0], f"{full_key}[]"))
    return keys


def read_records(file_path):
    """Read and parse JSONL file, return list of records"""
    records = []
    with open(file_path, "r", encoding="utf-8") as f:
        for line_num, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            
            try:
                record = json.loads(line)
                records.append(record)
            except json.JSONDecodeError as e:
                print(f"Error parsing line {line_num} in {file_path}: {e}", file=sys.stderr)
    return records


def print_stats(records, label=""):
    """Print statistics for a set of records"""
    if label:
        print(f"\n{'='*60}")
        print(f"{label}")
        print(f"{'='*60}")
    
    print(f"Total instances: {len(records)}")
    
    if not records:
        print("No records found.")
        return
    
    # Get keys from first record
    first_record = records[0]
    all_keys = get_keys_recursive(first_record)
    
    print("\nKeys in record structure:")
    for key in sorted(set(all_keys)):
        print(f"  - {key}")
    
    # Display one example record
    print("\nExample record (first one):")
    print(json.dumps(
        {
            "id": first_record["id"], 
            "input": first_record["input"],
            "passAtK": first_record.get("passAtK", None),
            "k": first_record.get("k", None),
        }, 
        indent=2)
    )
    
    # Overall statistics
    print("\nOverall Statistics:")
    
    # Score statistics
    scores = [r.get("score") for r in records if r.get("score")]
    if scores:
        pass_count = sum(1 for s in scores if s.get("pass", False))
        avg_score = sum(s.get("score", 0) for s in scores) / len(scores)
        print(f"  Records with scores: {len(scores)}/{len(records)}")
        print(f"  Pass rate: {pass_count}/{len(scores)} ({pass_count/len(scores)*100:.1f}%)")
        print(f"  Average score: {avg_score:.2f}")
    
    # Trial statistics
    trial_records = [r for r in records if "trials" in r]
    if trial_records:
        total_trials = sum(len(r.get("trials", [])) for r in records)
        avg_trials = total_trials / len(trial_records) if trial_records else 0
        print(f"  Records with trials: {len(trial_records)}/{len(records)}")
        print(f"  Total trials: {total_trials}")
        print(f"  Average trials per record: {avg_trials:.1f}")
    
    # Metadata statistics
    if "metadata" in first_record:
        agents = Counter(r.get("metadata", {}).get("agent") for r in records)
        if agents:
            print(f"  Agents: {dict(agents)}")
    
    # Timing statistics
    timings = [r.get("timing") for r in records if r.get("timing")]
    if timings:
        total_times = [t.get("total", 0) for t in timings if t.get("total")]
        if total_times:
            avg_time = sum(total_times) / len(total_times)
            print(f"  Average total time: {avg_time:.2f}s")

def calculate_percentile(values, percentile):
    """Calculate percentile from a list of values"""
    if not values:
        return None
    sorted_values = sorted(values)
    index = (percentile / 100) * (len(sorted_values) - 1)
    lower = int(index)
    upper = min(lower + 1, len(sorted_values) - 1)
    weight = index - lower
    return sorted_values[lower] * (1 - weight) + sorted_values[upper] * weight


def calculate_stats(values, label):
    """Calculate and print statistics for passAtK values"""
    if not values:
        return None
    
    avg = sum(values) / len(values)
    median = calculate_percentile(values, 50)
    p25 = calculate_percentile(values, 25)
    p75 = calculate_percentile(values, 75)
    
    return {
        "avg": avg,
        "median": median,
        "p25": p25,
        "p75": p75
    }

def statistical_comparison(you_values, builtin_values, alpha=0.05):
    """
    Perform statistical comparison between two groups with confidence intervals
    
    Returns dictionary with test results and confidence intervals
    """
    you_values = np.array(you_values)
    builtin_values = np.array(builtin_values)
    
    # Calculate differences (paired comparison)
    differences = you_values - builtin_values
    
    results = {}
    
    # Paired t-test
    t_stat, p_value = stats.ttest_rel(you_values, builtin_values)
    results['paired_t'] = {
        'statistic': t_stat,
        'p_value': p_value,
        'significant': p_value < alpha
    }
    
    # Mean difference and confidence interval
    mean_diff = np.mean(differences)
    std_diff = np.std(differences, ddof=1)
    n = len(differences)
    se_diff = std_diff / np.sqrt(n)
    
    # 95% confidence interval for mean difference
    t_critical = stats.t.ppf(1 - alpha/2, df=n-1)
    ci_lower = mean_diff - t_critical * se_diff
    ci_upper = mean_diff + t_critical * se_diff
    
    results['mean_difference'] = {
        'mean': mean_diff,
        'std': std_diff,
        'ci_lower': ci_lower,
        'ci_upper': ci_upper,
        'ci_level': (1 - alpha) * 100
    }
    
    # Effect size (Cohen's d for paired samples)
    cohens_d = mean_diff / std_diff
    results['effect_size'] = {
        'cohens_d': cohens_d,
        'interpretation': interpret_effect_size(abs(cohens_d))
    }
    
    # Mann-Whitney U test (non-parametric alternative)
    u_stat, u_p_value = stats.mannwhitneyu(you_values, builtin_values, alternative='two-sided')
    results['mannwhitney'] = {
        'statistic': u_stat,
        'p_value': u_p_value,
        'significant': u_p_value < alpha
    }
    
    # Wilcoxon signed-rank test (paired non-parametric)
    w_stat, w_p_value = stats.wilcoxon(you_values, builtin_values, alternative='two-sided')
    results['wilcoxon'] = {
        'statistic': w_stat,
        'p_value': w_p_value,
        'significant': w_p_value < alpha
    }
    
    return results


def interpret_effect_size(d):
    """Interpret Cohen's d effect size"""
    if d < 0.2:
        return "negligible"
    elif d < 0.5:
        return "small"
    elif d < 0.8:
        return "medium"
    else:
        return "large"

def main():
    # Default file paths
    default_you_path = "data/results/2026-02-18/droid/you.jsonl"
    parser = argparse.ArgumentParser(description="Analyze JSONL result files")
    parser.add_argument("you_path", nargs="?", default="data/results/2026-02-18/droid/you.jsonl")
    parser.add_argument("builtin_path", nargs="?", default="data/results/2026-02-18/droid/builtin.jsonl")
    args = parser.parse_args()

    you_path = Path(args.you_path)
    builtin_path = Path(args.builtin_path)
    
    # Read both files
    you_path = Path(default_you_path)
    builtin_path = Path(default_builtin_path)
    
    if not you_path.exists():
        print(f"Error: File not found: {you_path}", file=sys.stderr)
        sys.exit(1)
    
    if not builtin_path.exists():
        print(f"Error: File not found: {builtin_path}", file=sys.stderr)
        sys.exit(1)
    
    # Read records from both files
    you_records = read_records(you_path)
    builtin_records = read_records(builtin_path)
    
    # Print stats for both
    print_stats(you_records, f"YOU ({you_path.name})")
    print_stats(builtin_records, f"BUILTIN ({builtin_path.name})")
    
    # Compare passAtK values
    print(f"\n{'='*60}")
    print("COMPARISON: You vs Builtin (passAtK)")
    print(f"{'='*60}")
    
    # Create dictionaries indexed by id for easy lookup
    you_by_id = {r["id"]: r for r in you_records}
    builtin_by_id = {r["id"]: r for r in builtin_records}
    
    # Find all matching IDs
    matching_ids = set(you_by_id.keys()) & set(builtin_by_id.keys())
    print(f"Records with matching IDs: {len(matching_ids)}")
    
        # Compare passAtK values
    you_better = []
    you_passAtK_values = []
    builtin_passAtK_values = []
    
    for record_id in matching_ids:
        you_record = you_by_id[record_id]
        builtin_record = builtin_by_id[record_id]
        
        you_passAtK = you_record.get("passAtK")
        builtin_passAtK = builtin_record.get("passAtK")
        
        # Only compare if both have passAtK values
        if you_passAtK is not None and builtin_passAtK is not None:
            you_passAtK_values.append(you_passAtK)
            builtin_passAtK_values.append(builtin_passAtK)
            
            if you_passAtK > builtin_passAtK:
                you_better.append((record_id, you_record, builtin_record, you_passAtK, builtin_passAtK))
    
    print(f"\nRecords where You > Builtin: {len(you_better)}/{len(matching_ids)}")
    
        # Calculate passAtK statistics
    you_stats = calculate_stats(you_passAtK_values, "You")
    builtin_stats = calculate_stats(builtin_passAtK_values, "Builtin")
    
    # Print passAtK statistics
    print(f"\n{'='*60}")
    print("PassAtK Statistics")
    print(f"{'='*60}")
    print(f"{'Metric':<20} {'You':<15} {'Builtin':<15}")
    print("-" * 50)
    
    if you_stats and builtin_stats:
        print(f"{'Avg Pass@k':<20} {you_stats['avg']:<15.4f} {builtin_stats['avg']:<15.4f}")
        print(f"{'Median Pass@k':<20} {you_stats['median']:<15.4f} {builtin_stats['median']:<15.4f}")
        print(f"{'P25 Pass@k':<20} {you_stats['p25']:<15.4f} {builtin_stats['p25']:<15.4f}")
        print(f"{'P75 Pass@k':<20} {you_stats['p75']:<15.4f} {builtin_stats['p75']:<15.4f}")
    
        # Statistical comparison with individual provider stats
    if you_passAtK_values and builtin_passAtK_values and len(you_passAtK_values) == len(builtin_passAtK_values):
        you_array = np.array(you_passAtK_values)
        builtin_array = np.array(builtin_passAtK_values)
        n = len(you_passAtK_values)
        
        # Calculate statistics for each provider
        you_mean = np.mean(you_array)
        you_std = np.std(you_array, ddof=1)
        you_var = np.var(you_array, ddof=1)
        you_se = you_std / np.sqrt(n)
        
        builtin_mean = np.mean(builtin_array)
        builtin_std = np.std(builtin_array, ddof=1)
        builtin_var = np.var(builtin_array, ddof=1)
        builtin_se = builtin_std / np.sqrt(n)
        
        # Confidence intervals for each mean
        t_critical = stats.t.ppf(0.975, df=n-1)  # 95% CI
        you_ci_lower = you_mean - t_critical * you_se
        you_ci_upper = you_mean + t_critical * you_se
        builtin_ci_lower = builtin_mean - t_critical * builtin_se
        builtin_ci_upper = builtin_mean + t_critical * builtin_se
        
        print(f"\n{'='*60}")
        print("Individual Provider Statistics")
        print(f"{'='*60}")
        print(f"\n{'Metric':<25} {'You':<20} {'Builtin':<20}")
        print("-" * 65)
        print(f"{'Mean Pass@k':<25} {you_mean:<20.4f} {builtin_mean:<20.4f}")
        print(f"{'95% CI':<25} [{you_ci_lower:.4f}, {you_ci_upper:.4f}]  [{builtin_ci_lower:.4f}, {builtin_ci_upper:.4f}]")
        print(f"{'Std Deviation':<25} {you_std:<20.4f} {builtin_std:<20.4f}")
        print(f"{'Variance':<25} {you_var:<20.4f} {builtin_var:<20.4f}")
        print(f"{'Coefficient of Variation':<25} {(you_std/you_mean)*100:<20.2f}%  {(builtin_std/builtin_mean)*100:<20.2f}%")
        
        # Consistency comparison
        print(f"\nConsistency Analysis:")
        if you_std < builtin_std:
            consistency_diff = ((builtin_std - you_std) / builtin_std) * 100
            print(f"  You is MORE consistent (std dev {consistency_diff:.1f}% lower)")
        elif builtin_std < you_std:
            consistency_diff = ((you_std - builtin_std) / you_std) * 100
            print(f"  Builtin is MORE consistent (std dev {consistency_diff:.1f}% lower)")
        else:
            print(f"  Both have similar consistency")
        
        # Mean difference
        mean_diff = you_mean - builtin_mean
        differences = you_array - builtin_array
        diff_std = np.std(differences, ddof=1)
        diff_se = diff_std / np.sqrt(n)
        diff_ci_lower = mean_diff - t_critical * diff_se
        diff_ci_upper = mean_diff + t_critical * diff_se
        
        print(f"\n{'='*60}")
        print("Mean Difference Analysis")
        print(f"{'='*60}")
        print(f"Mean Difference (You - Builtin): {mean_diff:.4f}")
        print(f"95% CI for difference: [{diff_ci_lower:.4f}, {diff_ci_upper:.4f}]")
        
        # Head-to-head breakdown
        you_wins = sum(1 for d in differences if d > 0)
        builtin_wins = sum(1 for d in differences if d < 0)
        ties = sum(1 for d in differences if d == 0)
        
        print(f"\n{'='*60}")
        print("Head-to-Head Comparison Breakdown")
        print(f"{'='*60}")
        print(f"You > Builtin: {you_wins}/{n} ({you_wins/n*100:.1f}%)")
        print(f"Builtin > You: {builtin_wins}/{n} ({builtin_wins/n*100:.1f}%)")
        print(f"Ties (You == Builtin): {ties}/{n} ({ties/n*100:.1f}%)")
        
        # Explain the discrepancy
        print(f"\n{'='*60}")
        print("Why Average Differs from Head-to-Head Wins")
        print(f"{'='*60}")
        
        if you_wins > 0 and builtin_wins > 0:
            you_win_diffs = [d for d in differences if d > 0]
            builtin_win_diffs = [abs(d) for d in differences if d < 0]
            
            avg_you_win_margin = np.mean(you_win_diffs) if you_win_diffs else 0
            avg_builtin_win_margin = np.mean(builtin_win_diffs) if builtin_win_diffs else 0
            
            print(f"When You wins: average margin = {avg_you_win_margin:.4f}")
            print(f"When Builtin wins: average margin = {avg_builtin_win_margin:.4f}")
            print(f"\nExplanation:")
            print(f"  - You has higher average ({you_mean:.4f} vs {builtin_mean:.4f})")
            if you_std < builtin_std:
                print(f"  - You is more consistent (std: {you_std:.4f} vs {builtin_std:.4f})")
            else:
                print(f"  - Builtin is more consistent (std: {builtin_std:.4f} vs {you_std:.4f})")
            print(f"  - But {ties} records are tied, and {builtin_wins} records favor Builtin")
            print(f"  - You's wins tend to be by larger margins, explaining the better average")
        
        # Statistical tests
        stats_results = statistical_comparison(you_passAtK_values, builtin_passAtK_values)
        
        print(f"\n{'='*60}")
        print("Statistical Significance Tests")
        print(f"{'='*60}")
        
        # Paired t-test
        paired_t = stats_results['paired_t']
        sig_marker = "***" if paired_t['significant'] else ""
        print(f"\nPaired t-test:")
        print(f"  t = {paired_t['statistic']:.4f}, p = {paired_t['p_value']:.4f} {sig_marker}")
        print(f"  Tests if mean difference is significantly different from zero")
        
        # Wilcoxon signed-rank test
        wilcoxon = stats_results['wilcoxon']
        sig_marker = "***" if wilcoxon['significant'] else ""
        print(f"\nWilcoxon signed-rank test (non-parametric):")
        print(f"  W = {wilcoxon['statistic']:.4f}, p = {wilcoxon['p_value']:.4f} {sig_marker}")
        print(f"  Tests if distributions differ (doesn't assume normality)")
        
        # Effect size
        effect = stats_results['effect_size']
        print(f"\nEffect Size:")
        print(f"  Cohen's d: {effect['cohens_d']:.4f} ({effect['interpretation']})")
        print(f"  Measures practical significance of the difference")
        
        print(f"\n  *** p < 0.05 (statistically significant)")


if __name__ == "__main__":
    main()