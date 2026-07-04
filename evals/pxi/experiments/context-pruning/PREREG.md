---
tags: [research, agents, context-engineering, pxi, prereg]
status: draft
created: 2026-07-03
related_notes: ["Projects/context-pruning/design.md"]
---

# PREREG (draft) — Context Pruning on a Production Agent

Draft of `evals/pxi/experiments/context-pruning/PREREG.md`, to be committed to `Arize-ai/phoenix` (public) **before any main-grid run**. Companion to [[design]] (design v2.1+). Items marked `[TBD-lit]` / `[TBD-telemetry]` / `[TBD-pilot]` are finalized by the named prerequisite; everything else is frozen as written.

## 1. Scoped claim under test (FINAL — related-work pass completed 2026-07-03)

> *The first study to measure context-management strategies (tool-result clearing, summarization-compaction, truncation, full history) jointly on task quality and cache-write-aware cost — explicitly modeling provider cache-write premiums, TTL, and invalidation — on a deployed product agent.*

Hedging rules (binding on all write-ups): (a) The Complexity Trap (arXiv:2508.21433) already compared these strategies with per-instance dollar cost and *identified* the caching interaction qualitatively — we claim first *measurement* of that interaction, never first comparison or first identification; (b) always "no cache-**write**-aware accounting," never "no cache awareness" (ACON is partially cache-read-aware; Gemini API costs are implicitly cache-discounted); (c) "deployed product agent," not bare "production agent." Must-cite list in design doc. Secondary analysis: cache-aware re-pricing of The Complexity Trap's released per-turn token data (design doc §9b).

## 2. Hypotheses, primary contrasts, decision rules

α = 0.05, Holm-corrected across H1–H3 (H4 is an estimation target, not a test). All other comparisons are exploratory and labeled as such in the paper.

- **H1 (context rot on a real agent).** P0 Type-A pass rate at 150K vs. 5K, per model. *Degradation confirmed*: drop ≥5 pts with 95% CI excluding 0. *Confirmed null*: 95% CI within ±5 pts. Otherwise inconclusive → expand pilot per §8 before proceeding.
- **H2 (recovery).** P1 vs. P0, Type A at 150K. Superiority, MCID 5 pts.
- **H3 (safety, mechanism-resolved).** P1 vs. P0, Type B at 150K, **within needle-carrier strata**: predicted harm on tool_result-carried needles; predicted non-inferiority (margin 5 pts) on user_text/assistant_text-carried needles. Both directions pre-registered.
- **H4 (economics, estimation).** Turns-to-break-even for P2 vs. P0 under (i) warm cache, (ii) the empirical inter-turn-gap distribution, (iii) 1-hr TTL — reported with cluster-bootstrap 95% CIs against the median observed PXI session length. Fallback if telemetry sparse: assume median 8 turns and disclose `[TBD-telemetry]`.

**Commitment**: results are published regardless of direction, including a confirmed null on H1 (which triggers the pre-planned economics-paper branch).

## 3. Pinned parameters

| Parameter | Value |
|---|---|
| Models | `claude-opus-4-6` (ANTHROPIC), `gpt-5.4` (OPENAI, responses API). Exact `response.model` recorded per call. |
| Temperature | 0 where the API accepts it; otherwise provider default, recorded. |
| Depths | {5K, 25K, 50K, 100K, 150K} tokens, nested prefixes. Full sweep: P0/P1/P2. {50K, 150K}: P1c/P3/P4/P5/P6. |
| P1 clearing | threshold 30K tokens; keep K=5 most recent tool returns; placeholder string as pinned in design doc §2. |
| P2 compaction | trigger 40K; keep system + first user turn + trailing 8K raw; ≤2,000-token summary; summarizer = same family as model-under-test, temp 0; prompt = design doc Appendix A. Summarizer call billed to the policy. |
| P4 truncation | retained tokens = P2's mean retained size, computed after P2 corpus pass. |
| Runs per task-cell | 5. |
| Type C turn cap | 6 live turns; controller decision table per design doc IV.3. |
| Cache TTL | 5-min default; scheduler keeps intra-cell inter-run gap <4 min, else that cell switches to 1-hr TTL and is flagged. |
| Corpus seed | 20260703. Run-order randomization seed: 20260704. |
| Contrast window | each pre-registered contrast completed within 14 days; canary cell (P0 × 50K × 10 Type-A tasks) re-run at study start and end; >3-pt canary shift → flag drift, re-run affected contrasts. |

## 4. Corpus construction (deterministic, published script)

- Nested prefixes assembled by seeded script from PII-scrubbed real tool outputs (dogfood telemetry; fallback: outputs recorded from Playwright PXI suite runs, disclosed).
- Composition targets `[TBD-telemetry, fallback defaults]`: 60% of prefix tokens in tool results, 25% assistant text, 15% user turns; tool-result sizes drawn to mean ≈4K tokens (range 0.5–16K); ≈12–14 messages per 25K tokens.
- Token accounting: Anthropic `count_tokens` API for the Claude arm; tiktoken for the GPT arm; prefix depth defined on the model-under-test's own count (so 150K means 150K *to that model*).
- Needle-uniqueness assertion: each Type-B needle token occurs exactly once in the prefix and nowhere in the system prompt or page context.
- Page context (context blocks / `/phoenix` files): one fixed payload per task, identical across all policies and depths.

## 5. Task admission gates (run before freeze; results recorded)

| Type | Gate |
|---|---|
| A (40; expand to 60 per §8) | zero-depth pass ≥90% over 5 runs. |
| B (36 = 3 carriers × 3 positions × 4) | pass at 5K depth ≥80% AND zero-history pass ≤20% over 5 runs each. Failing tasks replaced, replacements re-gated. |
| C (15) | end-state check must be a deterministic GraphQL-verifiable assertion on the seeded instance; dry-run of the user-turn controller completes ≤6 turns on at least one reference run. |

### Task freeze v1 (2026-07-04)

The gate-admitted Type A and Type B task list is frozen by the committed artifact
`evals/pxi/experiments/context-pruning/TASK_HASHES.json`, generated with corpus seed
`20260703`. That file contains one SHA-256 content hash per task example and is the
authoritative task-freeze artifact for the main grid. The tables below record the
dataset membership and first/last hash sentinels for reviewability.

Gate results used for admission:

| Gate | Dataset | Result | Decision |
|---|---|---:|---|
| Type A zero-history | `context_pruning_gate_type_a_zero` | 38/40 (95%) | admit |
| Type B zero-history | `context_pruning_gate_type_b_zero` | 0/36 (0%) | admit |
| Type B 5K positive control | `context_pruning_gate_type_b_5k` | 35/36 (97%) | admit |

Frozen datasets:

| Dataset | Examples | First hash | Last hash |
|---|---:|---|---|
| `context_pruning_type_a` | 200 | `d18beccfd2435be07259f1fe6ee3ca0815861058415360c194a16a72121d3361` | `eb23c4ff9bc0939a9600aa40f7dd34e47eb28456479620721e111fc133383c5d` |
| `context_pruning_type_b` | 180 | `48a16a35f4db205e046f4249fbbb53da789d6471ff162b859a14a83b755c33ec` | `290f16f7be95a61f02362f19cc29058858ec4a77ceecbe2c77e5e4d281df6890` |
| `context_pruning_type_a_5k` | 40 | `d18beccfd2435be07259f1fe6ee3ca0815861058415360c194a16a72121d3361` | `f720bbe357f490a03632ac25b8fc1da8e09ea68fe876156d07b250252b8fe517` |
| `context_pruning_type_a_25k` | 40 | `48f19d4a8e9bcdbd93ef17dd45e4aa2c2a4c467d1096698cd59ff3549bb9c885` | `a3b947733edf9e69490f2a3cdba76b7b7f35a8acc0004ecf99dd1c1fd1813465` |
| `context_pruning_type_a_50k` | 40 | `16617be19f72b159217cbec9b043087fdfdb817bcd39d331d5c968da39d049d0` | `cd64f25826feaeb9f3a59638f50af66cb25662822bbb2af36937019a9ffa775f` |
| `context_pruning_type_a_100k` | 40 | `e0fe930f6fd67f6429377589acfc7b05f029cf2f5c72f188c3a3580907d07281` | `84999cd8e029665bad8488ec9d8cb2005b5e8199ac03726ded125013ddbe7f5a` |
| `context_pruning_type_a_150k` | 40 | `26477f82010963aa3d1126192d7718a1524341f845f831c3181bbd8806e433e0` | `eb23c4ff9bc0939a9600aa40f7dd34e47eb28456479620721e111fc133383c5d` |
| `context_pruning_type_b_5k` | 36 | `48a16a35f4db205e046f4249fbbb53da789d6471ff162b859a14a83b755c33ec` | `7e09b2d42b553bacc44f3c829292700d6c9ba42793ff69996875d876592e6a5e` |
| `context_pruning_type_b_25k` | 36 | `a7d6575c130bc38eb4fa557969813aad822dc798991f89d66cc8d9400e9b5e95` | `9e755c93da15c592f9b895885b77a376cfcaa68b9f2fb82b9e1d997c7847a505` |
| `context_pruning_type_b_50k` | 36 | `2b697e3489c2b6d9d9506fe22bce71929d05583f151f51a7e304bc0fe5ff0ac5` | `ce59ae91d3276f2da07523a395107489d9c0d271bcaf4f510beefa316aa798a7` |
| `context_pruning_type_b_100k` | 36 | `0fd5aefd4beb1e2a0e78114a21cf0a42b421b00152fc84bdc481c93bdcb75864` | `9c5f6bc25ca4116579c9847af521a3af1e015716434eb884747e790f913f2f2e` |
| `context_pruning_type_b_150k` | 36 | `19565c738c99bbbea8bb000ec766f30f6077b70e45f6d711e45986525cb0b4f9` | `290f16f7be95a61f02362f19cc29058858ec4a77ceecbe2c77e5e4d281df6890` |

## 6. Scoring

- Pass = conjunction of the task's pre-registered assertions (tool/args match incl. needle-token containment; Type C adds end-state check).
- Judge (Type C secondary only): cross-family, temp 0, sees final answer + task spec + rubric only; κ ≥ 0.6 overall and ≥0.5 per depth×condition stratum on 50 hand-labeled trajectories, else judge metrics dropped.
- Evaluator audit: ~100 runs hand-labeled; evaluator error rate reported.

## 7. Analysis plan

- Unit of analysis: per-task pass proportion (5 runs collapsed). Primary test: paired Wilcoxon signed-rank across tasks. Sensitivity: mixed-effects logistic (task random intercept). Never run-level McNemar.
- Cost/latency: median + IQR over runs; cluster bootstrap (10,000 resamples, clustered by task/session) for CIs.
- Exclusions: infrastructure errors only (429/5xx/timeouts), logged; if >2% of a cell is excluded, the whole cell is re-run. No content-based exclusion ever.
- All cells reported; no silent truncation of the grid.

## 8. Pilot gate and power adaptation

- Pilot: P0 × 5 depths × 20 Type-A tasks × 5 runs × 2 models, plus simulator validation on P0.
- From pilot variance, compute MDE for H1 via cluster bootstrap. **Adaptation rule**: if MDE > 8 pts, expand Type A 40 → 60 tasks (tasks, not runs — task-level variance dominates). If still >8 pts, report the achievable MDE and proceed with widened claims.
- Gate: H1 confirmed on either model → full study. Confirmed null on both → economics paper branch (H4 + P1c/P2 cost curves + TTL sensitivity as the headline). Inconclusive → pilot n doubles once, then decide.

## 9. Artifacts released at publication

Corpus-builder script + seed, frozen task YAMLs + hashes, policy capability code, cost simulator + validation data, raw run outputs (all cells), judge labels, this PREREG with git history.
