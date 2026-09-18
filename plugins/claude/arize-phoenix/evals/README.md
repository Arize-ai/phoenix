# Plugin evals

Behavioral tests for the `phoenix-cli` skill, run with `claude plugin eval`. Cases are
agent-troubleshooting prompts (pasted `px trace get` output, symptom descriptions, one
script-writing task) plus two should-not-fire negatives. Every input runs twice, with the
plugin and without, so the headline number is Δ (with-plugin score minus without-plugin
score), not raw pass rate.

## Run

From this plugin's directory:

```bash
claude plugin eval . \
  --ablation with-without \
  --judge-model sonnet \
  --allow-tools Write "Read(//$(pwd)/**)" "Read(//$(git rev-parse --show-toplevel)/.agents/skills/**)"
```

Every flag matters:

- `--ablation with-without` is what makes Δ exist.
- `--judge-model sonnet`: the default judge is haiku, which misses nuance in long diagnoses.
- `--allow-tools Write`: `allowed_tools` in a case's `prompt.md` is a declaration, not a grant.
  Without this, `06-tool-audit-script` cannot create its file and scores 0 in both arms.
- `--allow-tools "Read(//<plugin dir>/**)"`: the sandbox only lets `Read` reach its working
  directory. The skill links `references/filter-expressions.md`; without this grant the model's
  read is denied and it says so in its answer. The second `Read(...)` covers the symlink target.

Add `--no-publish` to keep the HTML report local. Results land in `evals/results/<timestamp>/`
(gitignored) as `aggregate-result.json` plus `report.html` with every prompt, answer, and
per-claim judge verdict.

Iterate on one case with `--case 05-skill-never-loaded --runs 1` (about a dollar). `--case`
takes a single glob; bracket patterns like `0[125]-*` match nothing.

## Reading results

- **High Δ**: the skill teaches something Claude does not do on its own.
- **Both arms high, Δ near zero**: Claude already knows it; the case is a regression guard only.
- **With-plugin arm low**: a skill gap or a grader bug. Read the answer before deciding which.

Baseline (Sep 2026, skill 3.5.0, 3 runs): mean Δ +0.25 across the six fire cases, 0.00 on the
negatives, with-plugin arm at or near 1.0 everywhere. Full run costs about $17.

## Grader conventions

- Regex graders first (`uses-px-cli`, `no-invented-flags`, `no-invented-commands`), then one
  `llm` grader **per claim** at `weight: 0.5`. The runner's judge returns a bare verdict with no
  reasoning and fails correct answers on combined "all claims must hold" rubrics; single-claim
  graders fixed that and show which claim fails.
- `skill-fired` is `tool_used: Skill` with `input_match: phoenix-cli`. It is reported under
  ablation but never scored. Negatives use `min: 0`, `max: 0`, `arm: both`, `input_match: phoenix`
  so operator-level skills on the host (which leak into the sandbox) don't count.
- Trace fixtures embedded in prompts must be internally consistent (token counts vs. visible
  messages, distinct retry messages). Claude notices inconsistencies and calls them
  instrumentation gaps, which then trips the judge.

## Adding a case

Copy an existing directory to `NN-<slug>/`, write `prompt.md` and `graders/`. Real transcripts
where the skill fired and the answer was wrong are the best inputs; they are the only thing that
will move the with-plugin arm off its current ceiling.

The `mocks/phoenix/` agent mock covers the plugin's MCP server so no case can reach a real
Phoenix. No current case calls it.
