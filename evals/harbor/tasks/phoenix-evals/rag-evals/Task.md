# rag-evals

The user's policy assistant answers customer questions from retrieved policy passages,
and customers say the answers are wrong. The agent has to build two evals: whether each
retrieved passage is relevant, and whether each answer sticks to what was retrieved. It
logs both, leaves a script for the nightly job, and says whether retrieval or generation
is the bigger problem. The verifier checks the annotations, runs the script on new
traces, and reads the agent's diagnosis.

## The request

The agent gets `instruction.md` word for word:

> Customers keep complaining about wrong answers from our policy assistant. Its traces are in Phoenix under the `policy-rag` project, and the app code is in `/app`.
>
> Can you set up evals that tell us whether the retriever pulled the right policy and whether the answer stuck to what was retrieved? Log a `relevant` annotation on each retrieved document and a `grounded` annotation on each answer, labeled `pass` or `fail`, so we can filter for them in Phoenix. Put the eval code in `/app/evals/` so our nightly job can run `python evals/rag_evals.py` to score new traffic. Any LLM-based eval has to use `gpt-5-nano`; it's the only model the nightly job's API key can call.
>
> Then tell me whether retrieval or generation is the bigger problem right now.

## What the agent starts with

| Where | What |
| --- | --- |
| Project `policy-rag` | 54 traces, one per customer question. The root `rag-query` span has the question and the answer. Its children are a `retrieve_policies` retriever span with 4 documents (`id`, `content`, `score`) and the LLM call, whose prompt lists those 4 passages. |
| `/app/policy_assistant.py` | The app's retrieval call and system prompt. The prompt tells the model to answer only from the passages and to say it doesn't know otherwise. |
| Model access | Real `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` values, so the agent can run LLM evaluators. |

The knowledge base has 23 short policy passages, on returns, refunds, billing,
shipping, orders, warranty, accounts, rewards, promo codes, and gift cards. Each
question has exactly one passage that answers it. No labels are visible.

Each trace gets a retrieval outcome and an answer type, chosen independently:

| Retrieval outcome | Production traces | Answer types (count) |
| --- | --- | --- |
| The answering passage is first | 19 | Restates it (16), contradicts it (2), adds a claim no passage makes (1) |
| The answering passage is second to fourth | 13 | Restates it (11), contradicts it (1), adds a claim no passage makes (1) |
| The answering passage isn't retrieved | 22 | Says it can't find the answer (12), makes up a policy (6), states the true policy even though it wasn't retrieved (4) |

Only restating a retrieved passage and saying it can't find the answer are grounded.
That gives 32 relevant and 184 irrelevant documents, and 39 grounded and 15 ungrounded
answers. Retrieval misses (22 of 54) outnumber all ungrounded answers (15), and only 5
answers are ungrounded when the right passage was retrieved. Retrieval is the bigger
problem by any count.

## How it's graded

`reward` is 1 only if every check passes. Each annotation check reads the latest
annotation with that name. It passes when those annotations cover at least 95% of the
documents or traces, and they catch enough of the good ones and enough of the bad ones.
Checking each class separately means a constant label fails. Labels count by meaning,
so `relevant` or `grounded` works as well as `pass`.

| Check | What it reads | What passes |
| --- | --- | --- |
| `production_relevant` | Document annotations on the 216 retrieved documents. An annotation on the retriever span doesn't count, because it can't say which document was relevant. | At least 85% recall on each class. |
| `production_grounded` | The 54 traces. | At least 80% recall on each class. |
| `bigger_problem` | The agent's final reply. | An LLM finds a quoted claim that retrieval is the bigger problem, and nothing in the reply contradicts it. |
| `new_traces_relevant`, `new_traces_grounded` | 24 new traces (96 documents) the verifier adds. It then runs `python evals/rag_evals.py` as the agent user. | The same as the production checks. |

During the rerun, every model request goes through a local recorder. It refuses any
model except `gpt-5-nano` with a 403, the way the nightly key would. A small model
like this one gets the labels right only when the prompt is clear and carries the right
evidence. With the reference prompts it reaches at least 85% recall on every check.

### Also reported

These don't change `reward`. The [suite README](../README.md#what-a-run-reports)
explains each one.

- `turns`, `tool_calls`, and a `loaded_<skill>` flag for each skill.
- `uses_phoenix_evals`: the share of the rerun's judge requests that phoenix-evals sent.
- `prompt_quality`: the share of judge requests whose prompt meets the rubric. For this
  task, the rubric grader knows that a `relevant` judge needs the question and the
  document's text, and a `grounded` judge needs the answer and the text of every
  retrieved passage. Neither can be checked by code alone.

## What the task tests

| Behavior | How the task checks it |
| --- | --- |
| Judging relevance by meaning, not keywords | Wrong passages share a topic and words with the question, and questions paraphrase the answering passage. No keyword-overlap rule reaches 85% on both classes. Wrong passages never bear on the answer, so a passage that restricts or qualifies it is never labeled irrelevant. |
| Not trusting retriever rank or score | The answering passage isn't first in 13 production traces, and misses have top scores as high as hits. Marking only the first passage relevant catches 59% of relevant documents. |
| Checking answers against what was retrieved | Contradictions and made-up policies read as plausible answers. Wrong answers reuse the passage's wording with one fact changed. A judge that sees only the question and answer catches about 13% of ungrounded answers. |
| Not checking against the whole knowledge base | 4 production answers state the true policy for a question whose passage wasn't retrieved. They're ungrounded, because the assistant had no source for them. |
| Treating "I don't know" as correct behavior | 12 production answers decline because nothing relevant came back. They're grounded. |
| Diagnosing the right stage | 10 of the 15 ungrounded answers follow a retrieval miss. The reply has to name retrieval. |
| Writing a script that generalizes | New traces use questions, answer wording, refusals, and unsupported claims the production traces never show. |
| Leaving a script the nightly job can run | The rerun fails if the entry point is missing, hard-codes trace IDs, or doesn't log annotations. |

## Known limits

- The passages and answers come from templates. The new traces' different wording
  limits how far pattern matching gets.
- Each label is correct by construction, but "answers the question" and "supported" are
  still judgment calls. Wrong passages are picked to share a topic without stating the
  answer. In one local run, the reference judge marked 1 of 32 relevant production documents
  irrelevant and matched every other label.
- On `gpt-5-nano`, the reference's `grounded` recall on grounded answers is 85% on
  production and 92% on new traces, close to the 80% bar. A reference run can fail on
  model noise.
- Retrieval is clearly the bigger problem, so `bigger_problem` mainly catches replies
  that blame generation, hedge, or skip the question. It doesn't grade numbers.

## Files

| Path | What it does |
| --- | --- |
| `fixture/build.py` | Generates `fixture/spec.json` (the 54 production traces) and `tests/truth.json` (document and answer labels, plus the 24 new traces and their labels). It's deterministic; rerun it after editing. |
| `workdir/` | Copied to `/app`. |
| `tests/test.py` | The verifier. |
| `solution/rag_evals.py` | The reference evals: one LLM judge per retrieved document for relevance, and one per answer for groundedness against the retrieved passages. `solution/solve.sh` installs it as the nightly entry point, runs it, and passes its summary to `solution/rag_reply.py`, which writes the reply. |
