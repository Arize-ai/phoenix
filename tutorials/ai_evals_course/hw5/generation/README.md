# Synthetic Trace Generation (Instructor-only)

This folder **is not part of the student assignment**.  It contains helper
scripts we run once to create the pre-labeled conversation traces that ship
with Homework 5.

Files
-----
* `generate_traces.py`  – Produces two JSON files in `../data/`:
  1. `raw_traces.json` – conversations only
  2. `labeled_traces.json` – conversations plus `last_success_state` and
     `first_failure_state`

How it works
------------
1. The script samples a `first_failure_state` from a weighted distribution so
   failures are not uniform.
2. GPT-4.1 is asked to pick a plausible `last_success_state` that precedes it.
3. GPT-4.1 then writes a short conversation (≤ 10 messages) that succeeds
   through the last-success state and fails at the chosen failure state.  Tool
   executions are annotated as `TOOL_CALL[ToolName] …` lines for clarity.

Running
-------
```bash
cd homeworks/hw5/generation
export OPENAI_API_KEY=<your_key>
python generate_traces.py --n 100 --seed 42
```
This will regenerate `raw_traces.json` and `labeled_traces.json` one level up
in `../data/`.

Dependencies
------------
Add these to `homeworks/hw5/requirements.txt` if they are not already present:
```
litellm
python-dotenv
tqdm
```

Reproducibility
---------------
* Use `--seed` to make the sampling deterministic.
* Setting a seed does **not** remove all randomness in GPT outputs, but it does
  keep the failure distribution identical across runs. 