# rag-evals

Separate retrieval failures from generation failures in a RAG app, leave the evals
rerunnable, and say which stage to fix first. Workflow: **evaluate a RAG app**.

## The request

The agent receives `instruction.md` verbatim:

> Customers keep complaining about wrong answers from our policy assistant. Its traces are in Phoenix under the `policy-rag` project, and the app code is in `/app`.
>
> Can you set up evals that tell us whether the retriever pulled the right policy and whether the answer stuck to what was retrieved? Log a `relevant` annotation on each retrieved document and a `grounded` annotation on each answer, labeled `pass` or `fail`, so we can filter for them in Phoenix. Put the eval code in `/app/evals/` so our nightly job can run `python evals/rag_evals.py` to score new traffic. Any LLM-based eval has to use `gpt-5.4-nano`; it's the only model the nightly job's API key can call.
>
> Then tell me whether retrieval or generation is the bigger problem right now.

## What the agent starts with

| Where | What |
| --- | --- |
| Phoenix project `policy-rag` | 54 traces, one per customer question. Root `rag-query` chain span (input: the question; output: the answer). Children: a `retrieve_policies` retriever span with 4 documents (`id`, `content`, `score`), and the LLM call whose prompt lists those 4 passages. |
| `/app/policy_assistant.py` | The app's retrieval call and system prompt, which tells the model to answer only from the passages and to say it doesn't know otherwise. |
| Model access | `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` for LLM evaluators. |

The knowledge base has 23 short policy passages (returns, refunds, billing, shipping,
orders, warranty, accounts, rewards, promo codes, gift cards). Each question has
exactly one passage that answers it. No labels are visible.

Each trace gets a retrieval outcome and an answer type, assigned independently:

| Retrieval outcome | Visible traces | Answer types (visible count) |
| --- | --- | --- |
| Answering passage at position 0 | 19 | restates it (16), contradicts it (2), adds a claim no passage states (1) |
| Answering passage at position 1 to 3 | 13 | restates it (11), contradicts it (1), adds a claim no passage states (1) |
| Answering passage not retrieved | 22 | says it can't find the answer (12), makes up a policy (6), states the true policy that wasn't retrieved (4) |

Only restating the retrieved passage and saying it can't find the answer are grounded.
That gives 32 relevant and 184 irrelevant documents, and 39 grounded and 15 ungrounded
answers. Retrieval misses (22 of 54) outnumber all ungrounded answers (15), and only 5
answers are ungrounded when the right passage was retrieved, so retrieval is the bigger
problem by any count.

## How it's graded

`reward` is 1 only when every check passes. An annotation check passes when the
annotation covers at least 95% of its units, and its labels catch at least the stated
share of good units **and** of bad units. A constant label catches 0% of one class, so
it fails.

| Check | Units | Minimum recall on each class |
| --- | --- | --- |
| `production.relevant` | The 216 retrieved documents in the fixture, read as Phoenix document annotations keyed by (retriever span, position) | 0.85 |
| `production.grounded` | The 54 traces, read from any span of the trace or the trace itself | 0.8 |
| `reply.bigger_problem` | The final reply | An extractor model must find an uncontradicted, quoted claim that `retrieval` is the bigger problem |
| `new_traces.relevant`, `new_traces.grounded` | 24 new traces (96 documents) the verifier adds, then runs `python evals/rag_evals.py` as the agent user | Same as the production checks |

Labels map to good or bad by meaning (`pass`, `relevant`, `grounded`, ... versus
`fail`, `irrelevant`, `ungrounded`, ...), never by agreement with the hidden labels. A
`relevant` annotation logged on the retriever span instead of on each document doesn't
count, because it can't say which document was relevant.

The request pins LLM judges to `gpt-5.4-nano`, a small model that rewards a clear
prompt with the right evidence. During the rerun, model requests go through a recorder
that refuses any other model with a 403, as the nightly job's key would, so a script
that calls another model fails the new-trace checks. The reference solution passes on
`gpt-5.4-nano` (see Known limits).

## Practice measures

The verifier records the requests the rerun sends to model providers and reports
`practice_*` scores beside `reward`, without changing it (see the
[suite README](../README.md#practice-measures)). The rubric grader reads this task's
criteria with the evidence each one needs, and whether code can check it without a
model:

| Criterion | Evidence a judge needs | Code can check it |
| --- | --- | --- |
| `relevant` | The customer's question and the document's text. | No |
| `grounded` | The answer and the text of every retrieved passage. | No |

`practice_no_copied_examples` compares requests with the visible traces: text they
share with the new traces, such as policy passages and reply templates, doesn't count.

## What the task targets

| Trap | Which cases expose it |
| --- | --- |
| Judging relevance by keyword overlap or topic | Wrong passages share topic and words with the question (a question about the return deadline retrieves in-store returns and label fees), and questions paraphrase the answering passage. No keyword-overlap threshold reaches 0.85 on both classes. The best one on visible data (2 shared words) catches 72% of relevant visible documents and 33% of new ones. |
| Trusting retriever rank or score | The answering passage is at position 1 to 3 in 13 visible traces, and misses have top scores as high as hits. Marking only position 0 relevant catches 59% of relevant documents. |
| Judging groundedness from the question and answer only | Contradictions and made-up policies read as plausible answers. A question-only judge caught 33% of ungrounded answers. |
| Checking answers against the whole knowledge base | 4 visible answers state the true policy for a question whose passage wasn't retrieved. They're ungrounded. |
| Treating "I don't know" as a failure | 12 visible answers decline because nothing relevant came back. They're grounded. |
| Blaming generation for retrieval misses | 10 of the 15 ungrounded answers follow a retrieval miss. The reply must name retrieval. |
| Overfitting to visible wordings | New traces use questions, answer wordings, refusals, and unsupported claims the visible traces never show. |
| A one-off script | The rerun on new traces fails if the entry point is missing, hard-codes trace IDs, or doesn't write annotations. |

## Known limits

- Passages and answers are templated: each passage has a fixed correct answer and
  wrong answer per split. A determined agent could pattern-match visible answers, and
  the new traces limit how far that gets.
- Labels are correct by construction, but "answers the question" and "supported" are
  still judgments. Wrong passages are hand-picked to share a topic without stating the
  answer. In the local reference run, the LLM judge marked 1 of 81 new irrelevant
  documents relevant and matched every other label.
- Retrieval is clearly the bigger problem, so the diagnosis check mainly catches replies
  that blame generation, hedge, or skip the question. It doesn't grade numbers.
- On `gpt-5.4-nano`, the reference reaches at least 0.99 recall on every annotation
  check.

## Files

| Path | Purpose |
| --- | --- |
| `fixture/build.py` | Generates `fixture/spec.json` (the 54 visible traces) and `tests/truth.json` (document and answer labels, plus the 24 new traces and their labels). Rerun it after editing; it's deterministic. |
| `workdir/` | Copied to `/app`. |
| `tests/test.py` | The verifier. |
| `solution/rag_evals.py` | Reference evals: one LLM judge per retrieved document for relevance and one per answer for groundedness against the retrieved passages. `solution/solve.sh` installs it as the nightly entry point, runs it, and passes its summary to `solution/rag_reply.py`, which writes the reply. |
