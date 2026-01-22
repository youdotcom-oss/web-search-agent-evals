# Grader Improvement Checklist

This checklist tracks improvements to grading infrastructure and evaluation best practices.

## Immediate Actions

- [x] Add "Unknown" escape hatch to LLM grader prompt
- [x] Document calibration workflow in README
- [x] Add grader validation examples to README
- [ ] Create reference solution test set for grader validation

## Calibration & Validation

- [ ] Run `validate-refs` on current grader with sample prompts
- [ ] Sample 20-50 failures manually to check for grader bugs
- [ ] Compare grader scores against human judgment (establish ground truth)
- [ ] Document systematic biases discovered during calibration
- [ ] Create calibration dataset for future grader improvements

## Evaluation Best Practices

- [ ] Add negative test cases (things agent should NOT do)
- [ ] Balance test set (positive/negative cases)
- [ ] Document transcript review process
- [ ] Add examples of grader bugs caught via calibration

## Documentation

- [x] Add examples of good vs bad grading to README
- [x] Document when to use pass@k vs pass^k in README
- [ ] Add troubleshooting section for grader issues
- [x] Link to Anthropic's eval guide in relevant sections

## Future Enhancements

- [ ] Consider multiple LLM judges for consensus scoring
- [ ] Add grader confidence scores
- [ ] Implement systematic bias detection
- [ ] Add grader performance metrics (precision, recall against human labels)
- [ ] Build comparison CLI tool in @plaited/agent-eval-harness with metrics:
  - Average pass/fail rates per run
  - Performance comparisons (latency p50/p90/p99)
  - Tool error counts
  - Search time analysis
  - Timeout tracking

## Notes

### Grading vs Evaluation Distinction

**Inline grading (evaluation):**
- Grader runs immediately after each prompt execution
- Results include `{pass: boolean, score: number}` per prompt
- Needed for pass@k and pass^k analysis
- This is what Anthropic calls an "evaluation"

**Post-hoc comparison (analysis):**
- Capture results first (no grading)
- Later, compare multiple runs for the same prompts
- Current `comparison-grader.ts` does this
- Useful for ranking different tools/configurations

### Reference Resources

- [Anthropic's Eval Guide](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) - Comprehensive best practices
- [Agent Eval Harness Docs](./.claude/skills/agent-eval-harness@plaited_agent-eval-harness/SKILL.md) - Grader interface and commands
- [Comparison Grader](./scripts/comparison-grader.ts) - MCP-specific hybrid grader implementation
