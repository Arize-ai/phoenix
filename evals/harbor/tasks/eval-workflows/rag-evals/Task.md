# rag-evals

A policy assistant answers customer questions from retrieved policy passages, and
customers say its answers are wrong. The agent logs a `relevant` annotation on each
retrieved passage and a `grounded` annotation on each answer, leaves a script that does
the same for new traffic, and says whether retrieval or generation is the bigger problem. The task tests whether the
agent can separate retrieval failures from generation failures with judges that work on
`gpt-5-nano`.

## The request

> Customers keep complaining about wrong answers from our policy assistant. Its traces are in Phoenix under the `policy-rag` project, and the app code is in `/app`.
>
> Can you set up evals that tell us whether the retriever pulled the right policy and whether the answer stuck to what was retrieved? Log a `relevant` annotation on each retrieved document and a `grounded` annotation on each answer, labeled `pass` or `fail`, so we can filter for them in Phoenix. Put the eval code in `/app/evals/` so our nightly job can run `python evals/rag_evals.py` to score new traffic. Any LLM-based eval has to use `gpt-5-nano`; it's the only model the nightly job's API key can call.
>
> Then tell me whether retrieval or generation is the bigger problem right now.

## What the agent starts with

| Where | What |
| --- | --- |
| Phoenix project `policy-rag` | 54 traces, one per customer question, with no annotations. The root `rag-query` span holds the question and the answer. Its children are a `retrieve_policies` retriever span with 4 documents (`id`, `content`, `score`) and the LLM call, whose prompt lists those 4 passages. |
| `/app/policy_assistant.py` | The app's retrieval call and system prompt. The prompt tells the model to answer only from the passages and to say it doesn't know otherwise. The knowledge base module it imports isn't in `/app`. |
| Environment | `OPENAI_API_KEY` and `ANTHROPIC_API_KEY`, so the agent can run LLM judges. |

## How the data was made

`fixture/build.py` writes the seed file, `tests/expected.json`, and
`tests/grading_data.json`. These parts are hand-written:

- 23 short policy passages on returns, refunds, billing, shipping, orders, warranty,
  accounts, rewards, promo codes, and gift cards. Each question has exactly one passage
  that answers it.
- Each policy's questions, faithful answer, wrong answer, and a claim that no passage
  makes, each with separate wordings for the production and new traces. The
  production wrong answers reuse the passage's wording with one fact changed, and
  faithful answers paraphrase it, so word overlap doesn't decide the label.
- For each policy, 6 distractor passages that share a topic or words with its questions
  without answering them.
- The refusal wordings, with a different set for the new traces.
- The number of traces that get each case, in the table below. The case sets the
  trace's `grounded` label.

| Answering passage | Answer | `grounded` | Production traces | New traces |
| --- | --- | --- | --- | --- |
| Ranked first | Restates it | `pass` | 16 | 6 |
| Ranked first | Contradicts it | `fail` | 2 | 2 |
| Ranked first | Adds a claim no passage makes | `fail` | 1 | 1 |
| Ranked second to fourth | Restates it | `pass` | 11 | 4 |
| Ranked second to fourth | Contradicts it | `fail` | 1 | 1 |
| Ranked second to fourth | Adds a claim no passage makes | `fail` | 1 | 1 |
| Not retrieved | Says it can't find the answer | `pass` | 12 | 3 |
| Not retrieved | States a made-up policy | `fail` | 6 | 3 |
| Not retrieved | States the true policy anyway | `fail` | 4 | 3 |

A document's `relevant` label is `pass` only for the passage that answers the question.
That gives 32 relevant and 184 irrelevant production documents, and 15 relevant and 81
irrelevant new ones. The expected diagnosis is retrieval. No retrieved passage answers
the question in 22 production traces, more than all 15 ungrounded answers, and only 5
answers are ungrounded when the right passage was retrieved.

The random seed, 31 for production traces and 47 for new traces, decides these things:

- Which question gets which case in the table.
- Which 3 or 4 of the policy's 6 distractors are retrieved, and their order.
- The retriever scores. The first document scores between 0.74 and 0.9, and each next
  one scores 0.015 to 0.06 lower, whether or not the answering passage was retrieved.
- Which refusal wording a declining answer uses.

When the answering passage ranks second to fourth, its position cycles through 2, 3,
and 4 in trace order. IDs and timestamps don't depend on the seed.

`build.py` asserts these properties of its output:

- Each policy has at least 4 distinct distractors.
- No passage that restricts or qualifies a policy's answer is one of that policy's
  distractors. For example, the Final Sale passage is never a distractor for a question
  about the return window.
- Every question gets exactly one case.
- In the production traces, retrieval misses outnumber ungrounded answers, which
  outnumber ungrounded answers after a hit.

GPT-6 Astra reviewed the data and labels.

## How it's graded

| Check | Type | Uses | Passes when |
| --- | --- | --- | --- |
| `production_traces` | Code | `grading_data.json`, `expected.json` | On the 54 production traces, `relevant` annotations cover at least 95% of the 216 retrieved documents with at least 85% recall on relevant and on irrelevant documents, and `grounded` annotations cover at least 95% of the traces with at least 80% recall on grounded and on ungrounded answers. |
| `names_right_stage` | LLM extraction, then code | `expected.json` | An LLM extracts, with a quote, which stage the reply calls the bigger problem. Code passes the check when the quote is in the reply, the stage is retrieval, and the reply doesn't contradict itself. |
| `new_traces` | Code | `grading_data.json`, `expected.json` | The verifier adds 24 new traces with 96 documents and runs `python evals/rag_evals.py` in `/app` as the agent user. The new annotations meet the same bars as `production_traces`. |

`reward` is 1 only when every check passes.

The annotation checks read the latest annotation with each name. A `relevant` label
counts only as a document annotation, because an annotation on the retriever span can't
say which document is relevant. Labels count by meaning, so `relevant` and `grounded`
count the same as `pass`. During the rerun, a local proxy refuses any model except
`gpt-5-nano` with a 403. `details.json` reports coverage and recall for `relevant` and
`grounded` separately under each check.

These measures are reported beside `reward` and don't affect it:

- `turns`, `tool_calls`, and `loaded_<skill>` show how the agent worked.
- `uses_phoenix_evals` is the share of the rerun's judge requests that phoenix-evals sent.
- `prompt_quality` is the share of judge requests whose prompt meets the suite rubric.
  For this task, the rubric expects a `relevant` judge to see the question and the
  document's text, and a `grounded` judge to see the answer and every retrieved passage.

## What the task tests

| Wrong approach | Fails | Why |
| --- | --- | --- |
| Judge relevance by words shared with the question | `production_traces`, `new_traces` | Distractors share a topic and words with the question, and questions paraphrase the answering passage. No word-overlap threshold reaches 85% recall on both classes. |
| Mark the top-ranked passage relevant | `production_traces`, `new_traces` | The answering passage ranks lower in 13 production traces, so this catches 19 of 32 relevant documents. |
| Judge groundedness from the question and answer alone | `production_traces`, `new_traces` | Contradictions, added claims, and made-up policies read as plausible answers without the passages. |
| Check answers against the true policy instead of the retrieved passages | `production_traces`, `new_traces` | 4 production answers state the true policy without retrieving it. They're ungrounded, so ungrounded recall drops to 73%. |
| Count "I can't find that" as ungrounded | `production_traces`, `new_traces` | 12 of the 39 grounded production answers are refusals, so grounded recall drops to 69%. |
| Blame generation, hedge, or skip the question | `names_right_stage` | Retrieval is the bigger problem by every count. |
| Label the production traces by hand or with a one-off script | `new_traces` | The rerun needs `python evals/rag_evals.py` to find and score traces it hasn't seen. |
| Call a stronger model than `gpt-5-nano` in the script | `new_traces` | The rerun refuses other models. |

## Calibration

The reference solution scores 1 and a do-nothing agent scores 0. Rule-based versions of
the wrong approaches above, such as marking only the top-ranked passage relevant or
labeling every refusal ungrounded, fail `production_traces` even when every other label
is right.

## Known limits

- `new_traces` allows few misses. It has 11 ungrounded answers, 13 grounded answers,
  and 15 relevant documents, so 3 misses in any of these classes fail the check. `gpt-5-nano`
  tends to call refusals unsupported claims, so a sound script can fail on judge noise.
  Rerun a failure before you count it against the agent.
- The new traces reuse the 23 passages with new questions and answer wordings. The check
  tests whether a script generalizes to new wording, not to new policies.
- Retrieval wins by every count, so `names_right_stage` catches replies that blame
  generation, hedge, or skip the question. It doesn't check the reply's numbers.
