# Quickstart examples

The runnable code behind the Get Started guides in the Phoenix docs:

| Guide | Python | TypeScript |
| --- | --- | --- |
| [Observe](https://arize.com/docs/phoenix/get-started/get-started-tracing) | `python/observe.py` | `typescript/instrumentation.ts`, `typescript/app.ts` |
| [Evaluate](https://arize.com/docs/phoenix/get-started/get-started-evaluations) | `python/evaluate.py` | `typescript/evaluate.ts` |
| [Evaluate a Prompt Change in Code](https://arize.com/docs/phoenix/datasets-and-experiments/how-to-experiments/evaluate-a-prompt-change) | `python/experiment.py` | `typescript/experiment.ts` |

The guides' code blocks are copied from these files by `make sync-docs-snippets`,
and `make check-docs-snippets` fails CI when they drift. Edit and run the code
here, then sync. `python3 scripts/sync_docs_snippets.py --help` explains the markers.

## Run

With Phoenix running at `http://localhost:6006` (`uvx arize-phoenix serve`) and
`OPENAI_API_KEY` exported. The experiment examples need no model key.

```bash
cd python && pip install -r requirements.txt
python observe.py && python evaluate.py && python experiment.py
```

```bash
cd typescript && npm install
npm run observe && npm run evaluate && npm run experiment
```
