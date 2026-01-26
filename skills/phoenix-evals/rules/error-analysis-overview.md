# Error Analysis: Overview

The most important activity in evals. Expect to spend **60-80% of development time** here.

## What Is Error Analysis?

1. **Review outputs** - Look at what your AI produces
2. **Identify failures** - Find where it goes wrong
3. **Understand why** - Diagnose root causes
4. **Prioritize fixes** - Decide what to address first

## Why It's Essential

- **Discovers unknown failure modes** - You can't automate what you don't know
- **Builds product intuition** - Reading traces teaches you your domain
- **Informs automation** - Tells you what to build evaluators for

## Error Analysis vs Automated Evals

| Aspect | Error Analysis | Automated Evals |
| ------ | -------------- | --------------- |
| Purpose | Discover problems | Monitor known problems |
| Scale | 100s of traces | 1000s of traces |
| Output | Insights, hypotheses | Scores, pass/fail |

They complement each other: Error analysis → Build evaluators → Run automated evals → New failures feed back to error analysis.

## The Benevolent Dictator

One domain expert should own error analysis. Benefits: consistent standards, faster decisions, deep expertise.

**Don't outsource.** You lose product intuition and tacit knowledge.

## Getting Started

1. Sample 50-100 traces
2. Review each personally
3. Note failures in free-form text
4. Group patterns after reviewing
5. Prioritize by frequency × severity

**See Also:** [error-analysis-process](error-analysis-process.md) for detailed steps.
