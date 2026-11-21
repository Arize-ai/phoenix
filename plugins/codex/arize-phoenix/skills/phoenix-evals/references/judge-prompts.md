# Judge prompts

A judge prompt is a rubric for one decision. Most judge errors come from a rubric
that leaves the edge cases to the model's taste.

## Structure

1. **One sentence of task.** "You are checking whether the answer is supported by the
   sources."
2. **The inputs, each in its own tag.** `<question>{{input}}</question>`,
   `<answer>{{output}}</answer>`, `<sources>{{context}}</sources>`.
3. **A definition for each label.** Say exactly what puts a record in each label, in
   terms the judge can check against the inputs.
4. **The edge cases, decided.** Refusals, partial answers, empty context, an answer
   that's right but cites nothing. Write the label each one gets as a rule, not as a
   worked example.

```text
You are checking whether a travel assistant's itinerary respects the traveler's constraints.

<constraints>{{constraints}}</constraints>
<request>{{input}}</request>
<itinerary>{{output}}</itinerary>

"respects": every booking and suggestion fits the stated budget, dates, and
accessibility needs, and the itinerary says which constraint drove any trade-off.
"violates": any item breaks a stated constraint, or a trade-off is made without
saying so.

Edge cases:
- The assistant asks for missing details and proposes nothing yet: "respects".
- The itinerary meets one constraint by silently dropping part of the request: "violates".
```

Don't add few-shot examples of scored records to the prompt. They pull the judge
toward the surface features of those records, and when they also appear in the data
you measure the judge on, they inflate its agreement. Put what an example was meant to
teach into a definition or an edge-case rule.

## Rules

- **Choose labels with a meaning.** Two labels (`pass`/`fail`) or several
  (`positive`/`neutral`/`negative`, or `correct`/`partially_correct`/`incorrect`) both
  work, as long as each label has a sharp definition. Named labels agree with people
  more often than a numeric scale, so avoid a 1 to 5 scale unless the user needs one.
  To judge a quality with several parts, write one judge per part.
- **Every label the template names must be in `choices`.** The evaluator forces the
  model to pick from `choices`, so a label such as `cannot_evaluate` that appears only
  in the prompt can never come back. Add it to `choices` or remove it from the prompt.
- **Give the judge what it needs, and nothing more.** Include the evidence a reviewer
  would check, such as tool calls and results, retrieved documents, earlier turns, or
  the spec. Leave out fields the decision doesn't use, because extra text costs tokens
  and distracts the judge. Format the evidence for a person to read: a transcript
  with one turn per line, not a raw JSON dump of spans. Mustache sections can do the
  formatting in the template (see [evaluators-python](evaluators-python.md)).
- **Write criteria from the spec and from real failures, without overfitting.** When
  the judge gets records wrong, find the general rule the prompt was missing and add
  that. Don't add a rule that names one record's details, because it fixes that record
  and nothing else.
- **Keep explanations on** while you build the judge. Reading why it disagreed with a
  person is how you fix the rubric.

## Choose the judge model

Use the smallest, cheapest model whose accuracy you can accept.

1. Run the judge on a labeled set with a frontier model and with one or more cheaper
   models.
2. Improve the prompt for the cheaper models as far as it goes.
3. Compare cost against accuracy, such as F1 or recall and precision on the failure
   label, and pick the model you'll run at scale.

A decision model (`DecisionModel` in Python, `decisionModel()` in the AI SDK) is a
good first pass for most evals, and for any eval where cost, scale, or latency matter
more than explanations. It returns label probabilities, so you can send the records
it's least sure about to an LLM judge with explanations for review. Don't use a
decision model for checks that need arithmetic or multi-step reasoning.

The judge needs its own prompt, and the app's output never defines the reference.
Using a different model from the app is optional, and it can reduce shared blind
spots.

## Learn from the built-in prompts

The pre-built evaluators' prompts are in
`phoenix.evals.__generated__.classification_evaluator_configs` in Python, and each
evaluator class exposes its prompt as `PROMPT`. Read the one closest to your check
before writing your own, or start from it (see [pre-built](pre-built.md)).
