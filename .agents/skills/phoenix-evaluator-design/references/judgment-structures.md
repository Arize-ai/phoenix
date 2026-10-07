# Judgment structures

Choose the lightest structure that settles the judgment. From lightest to heaviest:

- **Deterministic check**: exact or normalized match, contains, regex, JSON validity or schema,
  JSON distance, edit distance, embedding distance, classification metrics, and structural checks
  on tool calls (name, argument keys, argument values). Cheap, fast, and repeatable; prefer one
  whenever the judgment can be computed.
- **Single LLM judge**: one rubric and one model, for reading comprehension or open-ended quality.
- **Composite**: several sub-checks (code or LLM) blended into one weighted score, with the
  per-check breakdown in the explanation.
- **Jury**: one judgment polled across several models, with the votes in the explanation; for
  judgments where a single model's bias matters.
- **Pairwise**: a blind head-to-head of the output against a reference, returning a winner or a
  tie; for "did this change make it better" against a baseline snapshot.

When the environment a code evaluator runs in can call a model, a code evaluator can implement the
heavier structures itself and record each step or vote in its explanation or metadata.

## Suites

Design a suite rather than a single check: a deterministic floor (format, required fields, tool
call shape) plus judged dimensions for what the floor cannot settle. Each evaluator in the suite
judges one dimension and can be read on its own.

## Writing a judge rubric

- Name each label and tie it to evidence the judge can see in the fields it is given.
- Say how the hard cases from the plan are labeled: partial credit, abstention, not applicable.
- Show the judge only the fields the judgment needs, each under a clear heading.
- Ask for the explanation before the label when the model reasons better that way.
- Keep the label set identical between the rubric and the output schema.
- Avoid vague words ("good", "helpful", "appropriate") unless the rubric defines them.

## Writing a code check

- Read the field defensively: it may be missing, empty, a stringified JSON value, or a different
  type than the happy path.
- Normalize the output and any reference the same way (case, whitespace, key order, number
  formatting) before comparing.
- Return the not-applicable outcome the plan chose, rather than a failure, when the evaluator
  cannot judge the record.
- Put the reason for the verdict in the explanation, so a failing case can be diagnosed without
  rerunning it.
